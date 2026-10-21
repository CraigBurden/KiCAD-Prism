"""System Builder v2's write and read paths (docs/system-builder/CONTRACTS.md §3–§6).

Routes call this; this calls :mod:`app.system_builder.ops` for the rules and
:class:`app.system_builder.store.SystemStore` for persistence. Every write
runs in one store transaction holding the system's row lock: compare the
caller's version, apply, refuse what touches a board the caller cannot see,
write the document and its log entry.
"""

from __future__ import annotations

import json
import logging
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional, Sequence

from app.core import errors, preconditions
from app.core.config import settings
from app.services.design_bundle import cli
from app.services.workspace_service import workspace
from app.system_builder import (
    board_sub_ports,
    bundle_store,
    git_link,
    integrity,
    ops,
    parts,
    publishing,
    redaction,
    step_store,
)
from app.system_builder import members as member_view
from app.system_builder.document import find, new_document, new_id
from app.system_builder.harness_outputs import catalog as harness_catalog
from app.system_builder.harness_outputs import drawing as harness_drawing
from app.system_builder.harness_outputs import files as harness_files
from app.system_builder.harness_outputs import model as harness_model
from app.system_builder.harness_outputs.model import HarnessModel
from app.system_builder.icd import files as icd_files
from app.system_builder.icd import model as icd_model
from app.system_builder.icd import sheets as icd_sheets
from app.system_builder.icd.model import IcdModel
from app.system_builder.jobs import (
    build_system_bundle_inline,
    start_system_bundle_job,
    start_system_step_job,
)
from app.system_builder.store import SystemStore

logger = logging.getLogger(__name__)

ETAG_KIND = "system"


class SystemNotFound(errors.NotFound):
    code = "system_not_found"
    default_detail = "System not found"


class StaleSystem(errors.StaleVersion):
    def __init__(self, system_id: str, version: int) -> None:
        super().__init__(
            "The system changed since you read it; reload it and apply your change again.",
            headers={"ETag": preconditions.etag(ETAG_KIND, system_id, version)},
        )


class OpsInvalid(errors.Invalid):
    code = "system_ops_invalid"

    def __init__(self, refused: ops.OpRefused) -> None:
        super().__init__(refused.message, pointer=refused.pointer)


class Redacted(errors.Forbidden):
    code = "system_redacted"
    default_detail = "The change touches a board you cannot see"


class UndoConflict(errors.Conflict):
    code = "system_undo_conflict"

    def __init__(self, version: int, later: Sequence[int]) -> None:
        super().__init__(
            f"Later changes touch what version {version} changed; undo them first.",
            laterVersions=list(later),
        )


def _standing(entries: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    """The entries whose effect still stands: a change and the undo of it cancel.

    Read newest first, a standing undo cancels itself and its target, so an
    undone redo (an undo of an undo) leaves the original change standing.
    """

    versions = {int(item["version"]) for item in entries}
    cancelled: set[int] = set()
    for item in reversed(entries):
        version = int(item["version"])
        if version in cancelled:
            continue
        undoes = item.get("undoes")
        if item["kind"] == "undo" and undoes is not None and int(undoes) in versions:
            cancelled.update((version, int(undoes)))
    return [item for item in entries if int(item["version"]) not in cancelled]


class HarnessNotFound(errors.NotFound):
    code = "harness_not_found"
    default_detail = "Harness not found"


class HarnessOutputNotFound(errors.NotFound):
    code = "harness_output_not_found"
    default_detail = "Harness output not found"


class HarnessOutputsBuilding(errors.Conflict):
    """The outputs read the bundle, which is not ready yet (§16.7)."""

    code = "harness_outputs_building"
    default_detail = "The system bundle is still building; try the harness outputs when it is ready"


class IcdOutputNotFound(errors.NotFound):
    code = "icd_output_not_found"
    default_detail = "ICD output not found"


class IcdOutputsBuilding(errors.Conflict):
    """The ICD reads the bundle, which is not ready yet (§17)."""

    code = "icd_outputs_building"
    default_detail = "The system bundle is still building; try the ICD when it is ready"


class SystemBundleBuilding(errors.Conflict):
    """The STEP POST needs the bundle, which is not ready yet (§18)."""

    code = "system_bundle_building"
    default_detail = "The system bundle is still building; build the STEP when it is ready"


class StepNotReady(errors.Conflict):
    """The STEP file is only offered once the assembly is ready (§18)."""

    code = "system_step_not_ready"
    default_detail = "The STEP assembly is not ready yet"


#: Rendered files and the model behind them are cached in-process, keyed by the
#: bundle identity and the caller's hidden occurrences, so a second reader pays
#: for the render once (§16.7, §17).
_CACHE_SIZE = 64
_models: "OrderedDict[tuple[Any, ...], HarnessModel]" = OrderedDict()
_rendered: "OrderedDict[tuple[Any, ...], bytes]" = OrderedDict()
_icd_models: "OrderedDict[tuple[Any, ...], IcdModel]" = OrderedDict()
_icd_rendered: "OrderedDict[tuple[Any, ...], bytes]" = OrderedDict()


def _remember(cache: "OrderedDict[tuple[Any, ...], Any]", key: tuple[Any, ...], value: Any) -> Any:
    cache[key] = value
    cache.move_to_end(key)
    while len(cache) > _CACHE_SIZE:
        cache.popitem(last=False)
    return value


@dataclass(frozen=True)
class Caller:
    """Who is asking: audit identity, role and the project visibility test."""

    email: str
    can_see_project: Callable[[str], bool]
    name: str = ""
    role: str = "viewer"


def etag(record: Mapping[str, Any]) -> str:
    return preconditions.etag(ETAG_KIND, record["system_id"], record["version"])


class SystemService:
    def __init__(
        self, store: SystemStore, limits: Callable[[], integrity.Limits],
        links: Optional[git_link.GitLinkStore] = None,
        catalog: Any = None,
    ) -> None:
        self._store = store
        self._limits = limits
        self._links = links or git_link.GitLinkStore()
        self._publishing = publishing.PublishingService(store, catalog)

    # ----------------------------------------------------------------- reads

    def view(self, record: Mapping[str, Any], caller: Caller) -> dict[str, Any]:
        """A stored record as ``caller`` reads it: the document redacted, plus which occurrences were."""

        hidden = redaction.hidden_occurrences(record["document"], caller.can_see_project)
        return {**record, "document": redaction.redact(record["document"], hidden), "redacted": sorted(hidden)}

    def read(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        return self.view(record, caller)

    def bundle(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """The system's bundle, its build state, and what it is waiting on (§8).

        Reading the design bundles with ``queue=True`` is how a missing board
        bundle starts building; the system bundle job follows once they are
        ready. A failed build is not retried automatically for an hour, so a
        page refresh is not a retry storm.
        """

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        document = record["document"]
        key, resolved = self._current_bundle(record, requested_by=caller.email)
        answer: dict[str, Any] = {
            "key": key,
            "pending": sorted(
                member.occurrence for member in resolved if member.state == member_view.PENDING
            ),
            "documentVersion": record["version"],
        }

        stored = bundle_store.read(system_id, key)
        if stored is not None:
            bundle_store.touch(system_id, key)
            hidden = redaction.hidden_occurrences(document, caller.can_see_project)
            return {
                "state": "ready",
                **answer,
                "bundle": redaction.redact_bundle(stored, hidden, document=document),
            }

        row = bundle_store.get(system_id, key)
        if row is not None:
            if row["state"] in ("queued", "building") and bundle_store.active_job(
                row.get("job_id")
            ):
                return {"state": "building", **answer}
            if row["state"] == "failed" and bundle_store.failed_recently(row):
                return {
                    "state": "failed",
                    **answer,
                    "error": str(row.get("error") or "The system bundle build failed"),
                }

        # Every board ready: build here rather than queue (§8.1), and answer with it.
        if settings.PRISM_SYSTEM_BUNDLE_INLINE and not answer["pending"]:
            built = build_system_bundle_inline(system_id, requested_by=caller.email)
            stored = bundle_store.read(system_id, key) if built == key else None
            if stored is not None:
                hidden = redaction.hidden_occurrences(document, caller.can_see_project)
                return {
                    "state": "ready",
                    **answer,
                    "bundle": redaction.redact_bundle(stored, hidden, document=document),
                }

        start_system_bundle_job(
            system_id, key, record["version"], requested_by=caller.email
        )
        return {"state": "building", **answer}

    def _current_bundle(
        self, record: Mapping[str, Any], *, requested_by: str
    ) -> tuple[str, tuple[member_view.Member, ...]]:
        """The key of the system as it is now, and its resolved members.

        The bundle and the STEP assembly must agree on the key, so both read it
        through this one rule (§8.1, §18).
        """

        document = record["document"]
        resolved = member_view.resolve(document, requested_by=requested_by)
        generator = cli.generator()
        with self._store.connection() as conn:
            board_input = board_sub_ports.build_input(conn, document)
        key = member_view.system_bundle_key(
            document, generator.digest, resolved, board_sub_ports=board_input,
            entries=member_view.entry_key_input(resolved),
            parts=parts.digest(parts.build_input(document)[0]),
        )
        return key, resolved

    # ------------------------------------------------------------------ STEP

    def step_state(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """The current bundle key's STEP state (§18)."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        self._require_no_hidden(record, caller)
        key, _resolved = self._current_bundle(record, requested_by=caller.email)
        return self._step_view(system_id, key)

    def start_step(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """Start (or reuse) the STEP job for the current bundle key (§18).

        A caller who cannot see a board gets the redaction refusal: a STEP file
        cannot hide it. The job needs the bundle, so a bundle that is not ready
        is ``409 system_bundle_building``.
        """

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        self._require_no_hidden(record, caller)
        key, _resolved = self._current_bundle(record, requested_by=caller.email)
        if bundle_store.read(system_id, key) is None:
            raise SystemBundleBuilding()
        stored = step_store.system_record(system_id, key)
        if stored is not None:
            if stored.get("state") == "ready" and step_store.system_exists(system_id, key):
                step_store.system_touch(system_id, key)
                return self._step_view(system_id, key)
            if stored.get("state") == "building" and bundle_store.active_job(
                str(stored.get("jobId") or "")
            ):
                return self._step_view(system_id, key)
        retry_failed = bool(stored and stored.get("state") == "failed")
        start_system_step_job(
            system_id, key, requested_by=caller.email, retry_failed=retry_failed
        )
        return self._step_view(system_id, key)

    def step_file(
        self, system_id: str, caller: Caller, *, role: str
    ) -> tuple[bytes, str, str]:
        """The system STEP file, its media type and download name (§18)."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        self._require_no_hidden(record, caller)
        key, _resolved = self._current_bundle(record, requested_by=caller.email)
        stored = step_store.system_record(system_id, key)
        if (
            stored is None
            or stored.get("state") != "ready"
            or not step_store.system_exists(system_id, key)
        ):
            raise StepNotReady()
        step_store.system_touch(system_id, key)
        content = step_store.system_path(system_id, key).read_bytes()
        return content, "model/step", f"{git_link.slug(str(record['name']))}.step"

    def _step_view(self, system_id: str, key: str) -> dict[str, Any]:
        """One sidecar in the API's §18 shape; ``none`` when nothing exists."""

        stored = step_store.system_record(system_id, key)
        if stored is None:
            return {"state": "none", "boards": [], "missing": []}
        state = str(stored.get("state") or "none")
        if state == "ready" and not step_store.system_exists(system_id, key):
            state = "failed"
        step_store.system_touch(system_id, key)
        answer: dict[str, Any] = {
            "state": state,
            "boards": list(stored.get("boards") or []),
            "missing": list(stored.get("missing") or []),
        }
        error = str(stored.get("error") or "")
        if state == "failed":
            answer["error"] = error or "The STEP assembly did not finish"
        elif error:
            answer["error"] = error
        if state == "ready":
            answer["sizeBytes"] = int(stored.get("sizeBytes") or 0)
        return answer

    @staticmethod
    def _require_no_hidden(record: Mapping[str, Any], caller: Caller) -> None:
        if redaction.hidden_occurrences(record["document"], caller.can_see_project):
            raise Redacted()

    # ------------------------------------------------------- harness outputs

    def harness_outputs(
        self, system_id: str, harness: str, caller: Caller, *, role: str,
    ) -> dict[str, Any]:
        """The output index of one harness (§16.7): its files and sheet count."""

        record, document, hidden = self._harness_source(system_id, harness, caller, role=role)
        answer = self.bundle(system_id, caller, role=role)
        if answer["state"] != "ready":
            return {"state": "building", "files": [], "sheets": 0}
        model = self._harness_model(system_id, record, document, hidden, harness, answer)
        count = len(harness_drawing.sheets(model))
        return {
            "state": "ready",
            "files": harness_files.file_entries(count),
            "sheets": count,
        }

    def harness_output(
        self, system_id: str, harness: str, name: str, caller: Caller, *, role: str,
    ) -> tuple[bytes, str, str]:
        """One generated file, its media type and its download name (§16.7)."""

        record, document, hidden = self._harness_source(system_id, harness, caller, role=role)
        answer = self.bundle(system_id, caller, role=role)
        if answer["state"] != "ready":
            raise HarnessOutputsBuilding()
        model = self._harness_model(system_id, record, document, hidden, harness, answer)
        key = (system_id, str(answer["key"]), record.get("version"), harness, hidden, name)
        content = _rendered.get(key)
        if content is None:
            rendered = harness_files.render(model, name)
            if rendered is None:
                raise HarnessOutputNotFound()
            content = _remember(_rendered, key, rendered)
        return (
            content,
            harness_files.content_type(name),
            harness_files.filename(str(record["name"]), model.label, name),
        )

    def _harness_source(
        self, system_id: str, harness: str, caller: Caller, *, role: str,
    ) -> tuple[dict[str, Any], dict[str, Any], frozenset[str]]:
        """The record, the document as ``caller`` reads it, and the occurrences they cannot see."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        document = self.view(record, caller)["document"]
        if not any(item.get("id") == harness for item in document.get("harnesses") or []):
            raise HarnessNotFound()
        hidden = redaction.hidden_occurrences(record["document"], caller.can_see_project)
        return record, document, hidden

    def _harness_model(
        self,
        system_id: str,
        record: Mapping[str, Any],
        document: Mapping[str, Any],
        hidden: frozenset[str],
        harness: str,
        answer: Mapping[str, Any],
    ) -> HarnessModel:
        key = (system_id, str(answer["key"]), record.get("version"), harness, hidden)
        cached = _models.get(key)
        if cached is not None:
            _models.move_to_end(key)
            return cached
        model = harness_model.build(
            document,
            answer.get("bundle") or {},
            harness,
            harness_catalog.lookup,
            system=str(record.get("name") or ""),
            version=int(record.get("version") or 0),
            bundle_key=str(answer["key"]),
        )
        if model is None:
            raise HarnessNotFound()
        return _remember(_models, key, model)

    # ---------------------------------------------------------------- the ICD

    def icd(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """The ICD index (§17): its files and sheet count."""

        record, document, hidden, names = self._icd_source(system_id, caller, role=role)
        answer = self.bundle(system_id, caller, role=role)
        if answer["state"] != "ready":
            return {"state": "building", "files": [], "sheets": 0}
        model = self._icd_model(system_id, record, document, hidden, names, answer)
        count = len(icd_sheets.sheets(model))
        return {
            "state": "ready",
            "files": icd_files.file_entries(count),
            "sheets": count,
        }

    def icd_output(
        self, system_id: str, name: str, caller: Caller, *, role: str,
    ) -> tuple[bytes, str, str]:
        """One generated ICD file, its media type and its download name (§17)."""

        record, document, hidden, names = self._icd_source(system_id, caller, role=role)
        answer = self.bundle(system_id, caller, role=role)
        if answer["state"] != "ready":
            raise IcdOutputsBuilding()
        model = self._icd_model(system_id, record, document, hidden, names, answer)
        key = (
            system_id, str(answer["key"]), record.get("version"), hidden,
            tuple(sorted(names.items())), name,
        )
        content = _icd_rendered.get(key)
        if content is None:
            rendered = icd_files.render(model, name)
            if rendered is None:
                raise IcdOutputNotFound()
            content = _remember(_icd_rendered, key, rendered)
        return (
            content,
            icd_files.content_type(name),
            icd_files.filename(str(record["name"]), name),
        )

    def _icd_source(
        self, system_id: str, caller: Caller, *, role: str,
    ) -> tuple[dict[str, Any], dict[str, Any], frozenset[str], dict[str, str]]:
        """The record, the document as ``caller`` reads it, hidden occurrences and project names."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        document = self.view(record, caller)["document"]
        hidden = redaction.hidden_occurrences(record["document"], caller.can_see_project)
        names = self._project_names(record["document"], caller, role)
        return record, document, hidden, names

    @staticmethod
    def _project_names(
        document: Mapping[str, Any], caller: Caller, role: str,
    ) -> dict[str, str]:
        """The display name of every board project ``caller`` can see.

        A restricted occurrence is named by the caller's redacted document as
        ``restricted`` and its project is never looked up, so a display name
        cannot leak a board the caller cannot see.
        """

        names: dict[str, str] = {}
        for item in document.get("occurrences") or []:
            source = item.get("source") or {}
            if source.get("kind") != "board":
                continue
            project_id = str(source.get("projectId") or "")
            if not project_id or project_id in names:
                continue
            if not caller.can_see_project(project_id):
                continue
            project = workspace.get_project_for_role(project_id, role)
            if project:
                names[project_id] = str(
                    project.get("display_name") or project.get("name") or project_id
                )
        return names

    def _icd_model(
        self,
        system_id: str,
        record: Mapping[str, Any],
        document: Mapping[str, Any],
        hidden: frozenset[str],
        names: Mapping[str, str],
        answer: Mapping[str, Any],
    ) -> IcdModel:
        key = (
            system_id, str(answer["key"]), record.get("version"), hidden,
            tuple(sorted(names.items())),
        )
        cached = _icd_models.get(key)
        if cached is not None:
            _icd_models.move_to_end(key)
            return cached
        model = icd_model.build(
            document,
            answer.get("bundle") or {},
            system=str(record.get("name") or ""),
            version=int(record.get("version") or 0),
            bundle_key=str(answer["key"]),
            project_names=names,
            lookup=harness_catalog.lookup_entry,
        )
        return _remember(_icd_models, key, model)

    # ---------------------------------------------------------------- writes

    def create(self, caller: Caller, *, role: str, name: str, description: Optional[str], folder_id: Optional[str]) -> dict[str, Any]:
        document = new_document(name, description)
        record = self._store.create(new_id("sys"), document, folder_id=folder_id, created_by=caller.email, role=role)
        return self.view(record, caller)

    def apply(self, system_id: str, caller: Caller, *, role: str, expected: Optional[str], request_ops: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
        with self._store.transaction(system_id, role=role) as tx:
            if tx.record is None:
                raise SystemNotFound()
            self._check_version(tx.record, expected)
            applied = self._apply(tx.record, caller, request_ops, undo=False)
            self._publishing.check_placement(
                tx.record["document"], applied.document, request_ops, caller, role=role,
            )
            self._promote(tx, applied.document, caller, request_ops)
            record = tx.write(applied, actor=caller.email, kind="edit", ops=list(request_ops))
        return self.view(record, caller)

    @staticmethod
    def _promote(tx: Any, document: Mapping[str, Any], caller: Caller, request_ops: Sequence[Mapping[str, Any]]) -> None:
        """Create the board-level record of each ``promote-sub-port`` in the request's transaction (§10.5).

        The route already required ``design``; the caller must also see the
        board's project. Only a board occurrence's sub-port can be promoted.
        """

        for op in request_ops:
            if op["kind"] != "promote-sub-port":
                continue
            sub_port = find(document, "subPorts", op["subPort"])
            occurrence = find(document, "occurrences", sub_port["occurrence"]) if sub_port else None
            source = (occurrence or {}).get("source", {})
            if source.get("kind") != "board":
                raise board_sub_ports.BoardSubPortInvalid("Only a board occurrence's sub-port can be promoted")
            if not caller.can_see_project(source["projectId"]):
                raise board_sub_ports.BoardSubPortForbidden()
            board_sub_ports.create_on(
                tx.conn, source["projectId"], op["boardSubPort"], sub_port["connector"],
                sub_port["name"], sub_port["pins"], actor=caller.email,
            )

    def undo(self, system_id: str, caller: Caller, *, role: str, expected: Optional[str], version: int) -> dict[str, Any]:
        with self._store.transaction(system_id, role=role) as tx:
            if tx.record is None:
                raise SystemNotFound()
            self._check_version(tx.record, expected)
            entry = tx.entry(version)
            if entry is None:
                raise errors.NotFound(f"No change at version {version}")
            if not entry["inverse"]:
                raise errors.Conflict(f"Version {version} changed nothing; there is nothing to undo.", code="system_undo_nothing")
            later = [
                item for item in _standing(tx.entries_after(version))
                if set(item["touched"]) & set(entry["touched"])
            ]
            if later:
                raise UndoConflict(version, [item["version"] for item in later])
            applied = self._apply(tx.record, caller, entry["inverse"], undo=True)
            record = tx.write(applied, actor=caller.email, kind="undo", ops=entry["inverse"], undoes=version)
        return self.view(record, caller)

    def advance(self, system_id: str, occurrence: str, commit: str) -> dict[str, Any]:
        """``advance-occurrence`` as the system job issues it: rebased on the current version, never stale (§3.4)."""

        with self._store.transaction(system_id, role="admin") as tx:
            if tx.record is None:
                raise SystemNotFound()
            request_ops = [{"kind": "advance-occurrence", "occurrence": occurrence, "commit": commit}]
            applied = ops.apply(tx.record["document"], request_ops, seen_ids=tx.record["seen_ids"], limits=self._limits())
            return tx.write(applied, actor="system", kind="system", ops=request_ops)

    # ------------------------------------------------------------------ git

    def git(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """The system's link and its last commit job (§13.1)."""

        self.read(system_id, caller, role=role)
        return {
            "systemId": system_id,
            "link": self._links.read(system_id),
            "job": self._links.last_job(system_id),
        }

    def link_record(self, system_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """The system's link, or ``409 system_git_not_linked``."""

        self.read(system_id, caller, role=role)
        link = self._links.read(system_id)
        if link is None:
            raise git_link.NotLinked()
        return link

    def link_git(
        self, system_id: str, caller: Caller, *, role: str, project: Mapping[str, Any],
        branch: str, path: Optional[str],
    ) -> dict[str, Any]:
        """Link or relink the system; the route authorized ``project`` for design."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        target = git_link.validate_path(path) if path else git_link.default_path(record["name"])
        link = self._links.upsert(
            system_id,
            project_id=str(project["id"]),
            branch=git_link.validate_branch(branch),
            path=target,
            linked_by=caller.email,
        )
        return {"systemId": system_id, "link": link, "job": None}

    def unlink_git(self, system_id: str, caller: Caller, *, role: str) -> None:
        """Remove the link; no link is ``409 system_git_not_linked``."""

        self.read(system_id, caller, role=role)
        if not self._links.unlink(system_id):
            raise git_link.NotLinked()

    def commit_git(
        self, system_id: str, caller: Caller, *, role: str, project: Mapping[str, Any],
        message: str, expected: Optional[str],
    ) -> dict[str, Any]:
        """Queue a commit of the document at the ``If-Match`` version (§13.2)."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        self._check_version(record, expected)
        link = self._links.read(system_id)
        if link is None or str(link["project_id"]) != str(project["id"]):
            raise git_link.NotLinked()
        if redaction.hidden_occurrences(record["document"], caller.can_see_project):
            # The file is the complete document; committing it would hand a
            # board the caller cannot see to everyone who can read the branch.
            raise Redacted()
        text = str(message or "").strip()
        if not text:
            raise errors.Invalid("A commit message is required", code="system_git_message_invalid")
        job = git_link.start_system_git_commit_job(
            system_id=system_id,
            project_id=str(project["id"]),
            repository_id=str(project.get("repo_id") or "") or None,
            branch=str(link["branch"]),
            path=str(link["path"]),
            message=text,
            document=record["document"],
            document_version=int(record["version"]),
            author_name=caller.name,
            author_email=caller.email,
            requested_by=caller.email,
        )
        return {"systemId": system_id, "link": link, "job": job}

    def import_git(
        self, system_id: str, caller: Caller, *, role: str, project: Mapping[str, Any],
        expected: Optional[str],
    ) -> dict[str, Any]:
        """Replace the document with the linked file as one undoable request (§13.3)."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        self._check_version(record, expected)
        link = self._links.read(system_id)
        if link is None or str(link["project_id"]) != str(project["id"]):
            raise git_link.NotLinked()

        try:
            source = git_link.fetch_branch_file(
                str(link["project_id"]),
                str(link["branch"]),
                str(link["path"]),
                with_data=True,
            )
        except git_link.BranchMissing:
            raise errors.Conflict(
                f"The linked branch {link['branch']!r} does not exist",
                code="system_git_branch_missing",
            ) from None
        except UnicodeDecodeError:
            raise OpsInvalid(
                ops.OpRefused("/document", "the file on the branch is not UTF-8 text")
            ) from None
        except git_link.GitFailure as error:
            logger.warning("system %s: %s: %s", system_id, error, error.detail)
            raise git_link.ProjectUnavailable() from None
        if not source.blob:
            raise errors.Conflict(
                "the linked file does not exist on the branch; import needs a file to read",
                code="system_git_diverged",
                blob="",
            )

        try:
            document = json.loads(source.data.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise OpsInvalid(
                ops.OpRefused("/document", "the file on the branch is not valid JSON")
            ) from None
        if not isinstance(document, Mapping):
            raise OpsInvalid(
                ops.OpRefused("/document", "the file on the branch is not a system document")
            )

        request_ops = [{"kind": "import-document", "document": dict(document)}]
        with self._store.transaction(system_id, role=role) as tx:
            if tx.record is None:
                raise SystemNotFound()
            self._check_version(tx.record, expected)
            applied = self._apply(tx.record, caller, request_ops, undo=False, importing=True)
            updated = tx.write(applied, actor=caller.email, kind="edit", ops=request_ops)
        self._links.record_imported_blob(system_id, blob=source.blob)
        return self.view(updated, caller)

    # ------------------------------------------------------------- snapshots

    def snapshot(
        self, system_id: str, caller: Caller, *, role: str, name: str, note: Optional[str],
    ) -> dict[str, Any]:
        """Take a snapshot; a linked system also queues its commit (§13.2)."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        created = self._store.create_snapshot(
            system_id, name=name, note=note, created_by=caller.email,
        )
        job_id = self._queue_snapshot_commit(created, caller)
        return {**created, "git_commit_job_id": job_id}

    def _queue_snapshot_commit(self, snapshot: Mapping[str, Any], caller: Caller) -> Optional[str]:
        """Queue ``Snapshot: <name>``; a failure is logged and never undoes the snapshot."""

        system_id = str(snapshot["system_id"])
        link = self._links.read(system_id)
        if link is None:
            return None
        if redaction.hidden_occurrences(snapshot["document"], caller.can_see_project):
            return None
        try:
            job = git_link.start_system_git_commit_job(
                system_id=system_id,
                project_id=str(link["project_id"]),
                repository_id=self._project_repository_id(str(link["project_id"])),
                branch=str(link["branch"]),
                path=str(link["path"]),
                message=f"Snapshot: {snapshot['name']}",
                document=snapshot["document"],
                document_version=int(snapshot["version"]),
                author_name=caller.name,
                author_email=caller.email,
                requested_by=caller.email,
            )
        except Exception:  # noqa: BLE001 - the snapshot stands on its own
            logger.exception("Could not queue the snapshot commit for system %s", system_id)
            return None
        return str(job["job_id"])

    @staticmethod
    def _project_repository_id(project_id: str) -> Optional[str]:
        """The project's repository, for the job's lock; never an access decision."""

        row = workspace.get_project_by_id(project_id)
        return str((row or {}).get("repo_id") or "") or None

    # ------------------------------------------------------------ publishing

    def publish(
        self,
        system_id: str,
        caller: Caller,
        *,
        role: str,
        expected: Optional[str],
        snapshot_id: Optional[str],
        ipn: Optional[str],
        change_summary: str,
        identity: Optional[str] = None,
        manufacturer: Optional[str] = None,
        mpn: Optional[str] = None,
    ) -> dict[str, Any]:
        """Freeze a snapshot into a catalog revision in ``qa_review`` (§11.2)."""

        return self._publishing.publish(
            system_id,
            caller,
            role=role,
            expected=expected,
            snapshot_id=snapshot_id,
            ipn=ipn,
            change_summary=change_summary,
            identity=identity,
            manufacturer=manufacturer,
            mpn=mpn,
        )

    def publication(self, system_id: str, *, role: str) -> dict[str, Any]:
        """The system's catalog component, identity and publications (§11.4)."""

        return self._publishing.publication(system_id, role=role)

    def entry_view(self, revision_id: str, caller: Caller, *, role: str) -> dict[str, Any]:
        """A published entry's insides, redacted for the caller (§12.3)."""

        return self._publishing.entry_view(revision_id, caller, role=role)

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _check_version(record: Mapping[str, Any], expected: Optional[str]) -> None:
        if preconditions.int_version(expected) != record["version"]:
            raise StaleSystem(record["system_id"], record["version"])

    def _apply(self, record: Mapping[str, Any], caller: Caller, request_ops: Sequence[Mapping[str, Any]], *, undo: bool, importing: bool = False) -> ops.Applied:
        try:
            applied = ops.apply(
                record["document"], request_ops, seen_ids=record["seen_ids"],
                limits=self._limits(), undo=undo, importing=importing,
            )
        except ops.OpRefused as refused:
            raise OpsInvalid(refused) from None
        hidden = redaction.hidden_occurrences(record["document"], caller.can_see_project)
        hidden |= redaction.hidden_occurrences(applied.document, caller.can_see_project)
        if hidden:
            protected = redaction.protected_ids(record["document"], hidden) | redaction.protected_ids(applied.document, hidden)
            if applied.touched & protected:
                raise Redacted()
        return applied

