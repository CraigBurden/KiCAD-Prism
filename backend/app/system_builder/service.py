"""System Builder v2's write and read paths (docs/system-builder/CONTRACTS.md §3–§6).

Routes call this; this calls :mod:`app.system_builder.ops` for the rules and
:class:`app.system_builder.store.SystemStore` for persistence. Every write
runs in one store transaction holding the system's row lock: compare the
caller's version, apply, refuse what touches a board the caller cannot see,
write the document and its log entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional, Sequence

from app.core import errors, preconditions
from app.services.design_bundle import cli
from app.system_builder import bundle_store, integrity, ops, redaction
from app.system_builder import members as member_view
from app.system_builder.document import new_document, new_id
from app.system_builder.jobs import start_system_bundle_job
from app.system_builder.store import SystemStore

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


@dataclass(frozen=True)
class Caller:
    """Who is asking: audit identity and the project visibility test."""

    email: str
    can_see_project: Callable[[str], bool]


def etag(record: Mapping[str, Any]) -> str:
    return preconditions.etag(ETAG_KIND, record["system_id"], record["version"])


class SystemService:
    def __init__(self, store: SystemStore, limits: Callable[[], integrity.Limits]) -> None:
        self._store = store
        self._limits = limits

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
        resolved = member_view.resolve(document, requested_by=caller.email)
        generator = cli.generator()
        key = member_view.system_bundle_key(document, generator.digest, resolved)
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

        start_system_bundle_job(
            system_id, key, record["version"], requested_by=caller.email
        )
        return {"state": "building", **answer}

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
            record = tx.write(applied, actor=caller.email, kind="edit", ops=list(request_ops))
        return self.view(record, caller)

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
            later = [later for later in tx.entries_after(version) if set(later["touched"]) & set(entry["touched"])]
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

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _check_version(record: Mapping[str, Any], expected: Optional[str]) -> None:
        if preconditions.int_version(expected) != record["version"]:
            raise StaleSystem(record["system_id"], record["version"])

    def _apply(self, record: Mapping[str, Any], caller: Caller, request_ops: Sequence[Mapping[str, Any]], *, undo: bool) -> ops.Applied:
        try:
            applied = ops.apply(record["document"], request_ops, seen_ids=record["seen_ids"], limits=self._limits(), undo=undo)
        except ops.OpRefused as refused:
            raise OpsInvalid(refused) from None
        hidden = redaction.hidden_occurrences(record["document"], caller.can_see_project)
        hidden |= redaction.hidden_occurrences(applied.document, caller.can_see_project)
        if hidden:
            protected = redaction.protected_ids(record["document"], hidden) | redaction.protected_ids(applied.document, hidden)
            if applied.touched & protected:
                raise Redacted()
        return applied

