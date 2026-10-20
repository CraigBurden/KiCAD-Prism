"""Publishing a system and reading a published entry (CONTRACTS.md §11–§12).

Publishing freezes a snapshot's document, the board-level sub-ports it names and
the system bundle built from exactly those into one ``prism.system_entry.a0``
payload. The payload becomes the required ``system_entry`` asset of a catalog
revision in ``qa_review``. The catalog and the workspace are separate
databases, so the revision is written first with ``source_ref_json``
``{systemId, snapshotId}``; a retry after a failed workspace write finds it
instead of publishing a second revision.

The same module answers a placed entry's state for the bundle build and the
placement check, and reads a published entry's insides for the catalog route.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping, Sequence

from app.core import errors, preconditions
from app.services.catalog import system_entries
from app.services.catalog.asset_files import CatalogAssetFiles
from app.services.catalog.asset_registry import CatalogAssetRegistry
from app.services.catalog.component_writer import CatalogComponentWriter
from app.services.catalog.locking import PostgresCatalogLocks
from app.services.catalog.metadata_normalization import (
    IDENTITY_KIND_IPN,
    IDENTITY_KIND_MPN,
    normalize_identity_value,
)
from app.services.catalog.metadata_schema import CatalogMetadataSchema
from app.services.catalog.normalization import sha256_bytes
from app.services.catalog.revision_finalization import CatalogRevisionFinalizer
from app.services.catalog.workflow_policy import normalize_workflow_stage
from app.services.design_bundle import cli, schemas
from app.system_builder import board_sub_ports, bundle_store, parts, redaction
from app.system_builder import members as member_view
from app.system_builder.store import SystemStore

SCHEMA = system_entries.SCHEMA
ENTRY_ASSET_TYPE = system_entries.ASSET_TYPE
ETAG_KIND = "system"

RELEASED = "released"

IN_HOUSE = "in-house"
BOUGHT_OUT = "bought-out"


def identity_kind(identity: str | None, *, default: str) -> str:
    """Map a publish request's ``identity`` to a catalog identity kind."""

    if identity == BOUGHT_OUT:
        return IDENTITY_KIND_MPN
    if identity == IN_HOUSE:
        return IDENTITY_KIND_IPN
    if identity:
        raise errors.Invalid(
            "identity must be 'in-house' or 'bought-out'",
            code="system_identity_invalid",
        )
    return default


def mismatch_code(kind: str | None) -> str:
    return "system_mpn_mismatch" if kind == IDENTITY_KIND_MPN else "system_ipn_mismatch"


class SystemNotFound(errors.NotFound):
    code = "system_not_found"
    default_detail = "System not found"


class StaleSystem(errors.StaleVersion):
    def __init__(self, system_id: str, version: int) -> None:
        super().__init__(
            "The system changed since you read it; reload it and apply your change again.",
            headers={"ETag": preconditions.etag(ETAG_KIND, system_id, version)},
        )


class Redacted(errors.Forbidden):
    code = "system_redacted"
    default_detail = "The change touches a board you cannot see"


class EntryUnreleased(errors.Conflict):
    code = "system_entry_unreleased"
    default_detail = "The system entry revision is not released"


@dataclass(frozen=True)
class EntryInput:
    """One placed entry as the bundle build reads it (§12.2)."""

    component_id: str
    revision_id: str
    payload: dict[str, Any]
    payload_path: Path
    payload_sha256: str
    stage: str

    @property
    def system_id(self) -> str:
        return str(((self.payload.get("source") or {}).get("systemId")) or "")

    @property
    def system_bundle_key(self) -> str:
        return str(((self.payload.get("source") or {}).get("systemBundleKey")) or "")


# --------------------------------------------------------------- catalog


class CatalogGateway:
    """The catalog operations publishing needs, over one service instance."""

    def __init__(self, service: Any = None) -> None:
        self._service = service
        self._finalizer: CatalogRevisionFinalizer | None = None
        self._writer: CatalogComponentWriter | None = None

    @property
    def service(self) -> Any:
        if self._service is None:
            from app.services.component_catalog_service import catalog_service

            self._service = catalog_service
        return self._service

    @contextmanager
    def connection(self) -> Iterator[Any]:
        with self.service.connection() as conn:
            yield conn

    @property
    def runtime(self) -> Any:
        return self.service.runtime

    @property
    def revisions(self) -> Any:
        return self.service.revisions

    @property
    def previews(self) -> Any:
        return self.service.previews

    @property
    def asset_files(self) -> CatalogAssetFiles:
        return self.service.asset_files

    @property
    def asset_registry(self) -> CatalogAssetRegistry:
        return self.service.asset_registry

    def finalizer(self) -> CatalogRevisionFinalizer:
        if self._finalizer is None:
            self._finalizer = CatalogRevisionFinalizer(self.revisions, self.previews)
        return self._finalizer

    def writer(self) -> CatalogComponentWriter:
        if self._writer is None:
            self._writer = CatalogComponentWriter(
                PostgresCatalogLocks(),
                self.revisions,
                self.finalizer(),
                CatalogMetadataSchema(),
            )
        return self._writer


def _canonical_payload_bytes(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(
        dict(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def lookup_entry(
    component_id: str,
    revision_id: str,
    *,
    catalog: CatalogGateway | None = None,
) -> EntryInput | None:
    """A placed entry's payload and stage, or None when it no longer exists."""

    gateway = catalog or CatalogGateway()
    with gateway.connection() as conn:
        found = system_entries.entry_revision(
            conn, revision_id, component_id=component_id
        )
    if found is None:
        return None
    if str(found.get("component_kind") or "") != "system":
        return None
    if not bool(found.get("component_is_active", True)):
        return None
    read = system_entries.read_payload(found.get("entry_asset"))
    if read is None:
        return None
    payload, path = read
    return EntryInput(
        component_id=str(found["component_id"]),
        revision_id=str(found["id"]),
        payload=payload,
        payload_path=path,
        payload_sha256=sha256_bytes(_canonical_payload_bytes(payload)),
        stage=normalize_workflow_stage(str(found.get("release_status") or "")),
    )


def entry_lookup(component_id: str, revision_id: str) -> EntryInput | None:
    """The default lookup the bundle resolver uses (production's catalog singleton)."""

    return lookup_entry(component_id, revision_id)


# ------------------------------------------------------------- interface


def _bundle_pins_by_occurrence(
    bundle: Mapping[str, Any],
) -> dict[str, dict[str, dict[str, Any]]]:
    occurrences: dict[str, dict[str, dict[str, Any]]] = {}
    for occurrence in bundle.get("occurrences", []):
        connectors = {
            str(connector.get("refdes") or ""): connector
            for connector in occurrence.get("connectors", [])
        }
        occurrences[str(occurrence.get("occurrence") or "")] = connectors
    return occurrences


def _net_by_pin(bundle: Mapping[str, Any]) -> dict[tuple[str, str, str], Mapping[str, Any]]:
    found: dict[tuple[str, str, str], Mapping[str, Any]] = {}
    for net in bundle.get("nets", []):
        for pin in net.get("pins", []):
            key = (
                str(pin.get("occurrence") or ""),
                str(pin.get("connector") or ""),
                str(pin.get("pad") or ""),
            )
            found.setdefault(key, net)
    return found


def _site_pins(
    document: Mapping[str, Any],
    board_sub_ports: Mapping[str, Any],
    connectors: Mapping[str, Any],
    site: Mapping[str, Any],
) -> list[str]:
    occurrence_id = str(site.get("occurrence") or "")
    connector_ref = str(site.get("connector") or "")
    sub_port = site.get("subPort") or {}
    if sub_port:
        if sub_port.get("kind") == "occurrence":
            for candidate in document.get("subPorts", []):
                if candidate.get("id") == sub_port.get("id"):
                    return [str(pin) for pin in candidate.get("pins", [])]
        elif sub_port.get("kind") == "board":
            for candidate in board_sub_ports.get("subPorts", []):
                if candidate.get("id") == sub_port.get("id"):
                    return [str(pin) for pin in candidate.get("pins", [])]
        return []
    connector = connectors.get(connector_ref) or {}
    return [str(pin.get("pad") or "") for pin in connector.get("pins", [])]


def compute_interface(
    document: Mapping[str, Any], bundle: Mapping[str, Any],
    board_sub_ports: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """The interface the document's exports make (CONTRACTS.md §11.1)."""

    copied = board_sub_ports or {"schema": "prism.board_sub_ports.a0", "subPorts": []}
    connectors = _bundle_pins_by_occurrence(bundle)
    pins_by_net = _net_by_pin(bundle)
    exports: list[dict[str, Any]] = []
    for export in sorted(document.get("exports", []), key=lambda item: item["id"]):
        site = export["site"]
        occurrence_id = str(site.get("occurrence") or "")
        connector_ref = str(site.get("connector") or "")
        connector = (connectors.get(occurrence_id) or {}).get(connector_ref) or {}
        pin_info = {
            str(pin.get("pad") or ""): pin for pin in connector.get("pins", [])
        }
        pin_names = export.get("pinNames") or {}
        pins = []
        for pad in _site_pins(document, copied, connectors.get(occurrence_id) or {}, site):
            info = pin_info.get(pad) or {}
            name = (
                pin_names.get(pad)
                or info.get("pinName")
                or pad
            )
            net = pins_by_net.get((occurrence_id, connector_ref, pad))
            if net is None:
                # A missing connector or pin is an error finding that blocks
                # publishing; the interface simply carries no such pin.
                continue
            item: dict[str, Any] = {
                "pad": pad,
                "name": str(name),
                "net": str(net["id"]),
            }
            if net.get("name"):
                item["signal"] = str(net["name"])
            pins.append(item)
        entry: dict[str, Any] = {
            "id": str(export["id"]),
            "name": str(export["name"]),
            "occurrence": occurrence_id,
            "connector": connector_ref,
            "pins": pins,
        }
        if site.get("subPort"):
            entry["subPort"] = site["subPort"]
        exports.append(entry)
    return {"exports": exports}


def build_payload(
    document: Mapping[str, Any],
    board_sub_ports: Mapping[str, Any],
    bundle: Mapping[str, Any],
    *,
    system_id: str,
    version: int,
    snapshot_id: str,
    system_bundle_key: str,
    parts: Mapping[str, Any],
) -> dict[str, Any]:
    """The validated ``prism.system_entry.a0`` payload for a snapshot."""

    payload = {
        "schema": SCHEMA,
        "source": {
            "systemId": system_id,
            "version": int(version),
            "snapshotId": snapshot_id,
            "systemBundleKey": system_bundle_key,
        },
        "document": dict(document),
        "boardSubPorts": dict(board_sub_ports),
        "bundle": dict(bundle),
        "parts": dict(parts),
        "interface": compute_interface(document, bundle, board_sub_ports),
    }
    schemas.validate(payload, SCHEMA)
    return payload


# -------------------------------------------------------------- publish


def _finding_codes(findings: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "code": str(finding.get("code") or ""),
            "subject": str(finding.get("subject") or ""),
            "severity": str(finding.get("severity") or ""),
        }
        for finding in findings
    ]


class PublishingService:
    """§11.2 publishing and §12 placement, over one system store and catalog."""

    def __init__(self, store: SystemStore, catalog: Any = None) -> None:
        self._store = store
        self._gateway = CatalogGateway(catalog)

    # ------------------------------------------------------------- reads

    def entry_lookup(self, component_id: str, revision_id: str) -> EntryInput | None:
        return lookup_entry(component_id, revision_id, catalog=self._gateway)

    def _entry_stage(self, component_id: str, revision_id: str) -> str | None:
        found = self.entry_lookup(component_id, revision_id)
        return found.stage if found is not None else None

    # ----------------------------------------------------------- publish

    def publish(
        self,
        system_id: str,
        caller: Any,
        *,
        role: str,
        expected: str | None,
        snapshot_id: str | None,
        ipn: str | None,
        change_summary: str,
        identity: str | None = None,
        manufacturer: str | None = None,
        mpn: str | None = None,
    ) -> dict[str, Any]:
        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        if preconditions.int_version(expected) != record["version"]:
            raise StaleSystem(system_id, record["version"])
        if redaction.hidden_occurrences(record["document"], caller.can_see_project):
            raise Redacted()

        entry_identity, component_hint = self._require_identity(
            record,
            identity=identity,
            ipn=ipn,
            manufacturer=manufacturer,
            mpn=mpn,
            snapshot_id=snapshot_id,
        )
        if snapshot_id:
            snapshot = self._store.read_snapshot(system_id, snapshot_id)
            if snapshot is None:
                raise errors.NotFound("Snapshot not found")
        else:
            # Check the live system first and take the snapshot only once it
            # passes, so a publish the UI retries while the bundle builds does
            # not leave a snapshot behind on every attempt.
            with self._store.connection() as conn:
                live = board_sub_ports.build_input(conn, record["document"])
            snapshot = {
                "document": record["document"],
                "version": record["version"],
                "boardSubPorts": live,
            }
        key, parts_document = self._checked_key(
            system_id, snapshot, caller, entry_identity,
        )
        if not snapshot_id:
            snapshot = self._store.create_snapshot(
                system_id, name=f"Published {entry_identity.number}".strip(), note=None,
                created_by=getattr(caller, "email", ""),
            )
            if (
                int(snapshot["version"]) != int(record["version"])
                or (snapshot.get("boardSubPorts") or board_sub_ports_empty()) != live
            ):
                raise StaleSystem(system_id, int(snapshot["version"]))
        document = snapshot["document"]
        version = int(snapshot["version"])
        copied = snapshot.get("boardSubPorts") or board_sub_ports_empty()
        bundle = bundle_store.read(system_id, key)

        payload = build_payload(
            document, copied, bundle,
            system_id=system_id, version=version, snapshot_id=str(snapshot["snapshot_id"]),
            system_bundle_key=key, parts=parts_document,
        )
        component_id, revision_id, stage = self._write_revision(
            record, snapshot, payload, identity=entry_identity,
            component_id=component_hint, caller=caller,
            change_summary=change_summary,
        )
        self._record(self._store, system_id, version, str(snapshot["snapshot_id"]),
                     component_id, revision_id, getattr(caller, "email", ""))
        return {"componentId": component_id, "revisionId": revision_id, "stage": stage}

    def _require_identity(
        self,
        record: Mapping[str, Any],
        *,
        identity: str | None,
        ipn: str | None,
        manufacturer: str | None,
        mpn: str | None,
        snapshot_id: str | None,
    ) -> tuple[system_entries.EntryIdentity, str]:
        """§11.2 step 4's identity rules, checked before anything is written.

        Returns the frozen identity and, when one already exists, the component
        it belongs to (empty for a first publish that creates a new component).
        """

        system_id = str(record["system_id"])
        component_id = str(record.get("catalog_component_id") or "")
        with self._gateway.connection() as conn:
            if component_id:
                component = self._gateway.revisions.component_row(conn, component_id)
                if component is None:
                    raise errors.Conflict(
                        "The system's catalog component no longer exists",
                        code=mismatch_code(identity_kind(identity, default=IDENTITY_KIND_IPN)),
                    )
                existing = self._identity_of(conn, component)
                requested = identity_kind(identity, default=existing.kind)
                if requested != existing.kind:
                    raise errors.Conflict(
                        "The system is published under another identity",
                        code="system_identity_mismatch",
                    )
                if existing.kind == IDENTITY_KIND_IPN:
                    supplied = str(ipn or "").strip()
                    if supplied and normalize_identity_value(supplied) != normalize_identity_value(existing.number):
                        raise errors.Conflict(
                            "The IPN does not match the published component",
                            code="system_ipn_mismatch",
                        )
                else:
                    supplied_manufacturer = str(manufacturer or "").strip()
                    supplied_mpn = str(mpn or "").strip()
                    if supplied_manufacturer and normalize_identity_value(supplied_manufacturer) != normalize_identity_value(existing.manufacturer):
                        raise errors.Conflict(
                            "The manufacturer and MPN do not match the published component",
                            code="system_mpn_mismatch",
                        )
                    if supplied_mpn and normalize_identity_value(supplied_mpn) != normalize_identity_value(existing.number):
                        raise errors.Conflict(
                            "The manufacturer and MPN do not match the published component",
                            code="system_mpn_mismatch",
                        )
                return existing, component_id

            requested = identity_kind(identity, default=IDENTITY_KIND_IPN)
            if requested == IDENTITY_KIND_IPN:
                supplied = str(ipn or "").strip()
                if not supplied:
                    raise errors.Invalid(
                        "The first publish needs the system's IPN",
                        code="system_ipn_required",
                    )
                entry_identity = system_entries.EntryIdentity.ipn(supplied)
                conflict_code = "system_ipn_mismatch"
            else:
                supplied_manufacturer = str(manufacturer or "").strip()
                supplied_mpn = str(mpn or "").strip()
                if not supplied_manufacturer or not supplied_mpn:
                    raise errors.Invalid(
                        "The first bought-out publish needs the manufacturer and MPN",
                        code="system_mpn_required",
                    )
                entry_identity = system_entries.EntryIdentity.mpn(
                    supplied_manufacturer, supplied_mpn,
                )
                conflict_code = "system_mpn_mismatch"
            holder = system_entries.identity_holder(conn, entry_identity)
            if holder is not None:
                previous = (
                    system_entries.revision_by_source(
                        conn, str(holder["id"]), system_id, str(snapshot_id),
                    )
                    if snapshot_id else None
                )
                if previous is None:
                    raise errors.Conflict(
                        "Another component holds that identity",
                        code=conflict_code,
                    )
                return entry_identity, str(holder["id"])
            return entry_identity, ""

    def publication(self, system_id: str, *, role: str) -> dict[str, Any]:
        """§11.4: the system's catalog component, its identity and its publications."""

        record = self._store.read(system_id, role=role)
        if record is None:
            raise SystemNotFound()
        with self._store.connection() as conn:
            rows = conn.execute(
                """
                SELECT version, snapshot_id, revision_id, published_by, published_at
                  FROM ws_system_publications
                 WHERE system_id = %s
                 ORDER BY published_at DESC, version DESC
                """,
                (system_id,),
            ).fetchall()
        component_id = str(record.get("catalog_component_id") or "")
        answer: dict[str, Any] = {"componentId": component_id or None, "identity": None, "publications": []}
        if not component_id:
            return answer
        with self._gateway.connection() as conn:
            component = self._gateway.revisions.component_row(conn, component_id)
            if component is None:
                return {**answer, "componentId": None}
            identity = self._identity_of(conn, component)
            if identity.bought_out:
                answer.update(identity=BOUGHT_OUT, manufacturer=identity.manufacturer, mpn=identity.number)
            else:
                answer.update(identity=IN_HOUSE, ipn=identity.number)
            for row in rows:
                revision = self._gateway.revisions.revision_row(conn, str(row["revision_id"])) or {}
                answer["publications"].append({
                    "version": int(row["version"]),
                    "snapshotId": str(row["snapshot_id"]),
                    "revisionId": str(row["revision_id"]),
                    "stage": normalize_workflow_stage(str(revision.get("release_status") or "")) if revision else None,
                    "publishedBy": str(row["published_by"]),
                    "publishedAt": row["published_at"].isoformat() if hasattr(row["published_at"], "isoformat") else str(row["published_at"]),
                })
        return answer

    @staticmethod
    def _identity_of(conn: Any, component: Mapping[str, Any]) -> system_entries.EntryIdentity:
        """A published component's frozen identity, raw enough to compare again."""

        kind = str(component.get("identity_kind") or "")
        if kind == IDENTITY_KIND_IPN:
            return system_entries.EntryIdentity.ipn(
                str(component.get("normalized_part_number") or ""),
            )
        revision = conn.execute(
            "SELECT manufacturer, mpn FROM component_revisions WHERE id = %s",
            (str(component.get("current_revision_id") or ""),),
        ).fetchone()
        revision = dict(revision) if revision is not None else {}
        return system_entries.EntryIdentity.mpn(
            str(revision.get("manufacturer") or ""),
            str(revision.get("mpn") or component.get("normalized_part_number") or ""),
        )

    def _checked_key(
        self, system_id: str, snapshot: Mapping[str, Any], caller: Any,
        identity: system_entries.EntryIdentity,
    ) -> tuple[str, dict[str, Any]]:
        """The snapshot's system bundle key and parts input, after §11.2 step 3."""

        document = snapshot["document"]
        copied = snapshot.get("boardSubPorts") or board_sub_ports_empty()
        # The first checks need no build input; the parts input reads the catalog.
        self._check_document(document)
        resolved = member_view.resolve(
            document, requested_by=getattr(caller, "email", ""),
            entry_resolver=self.entry_lookup,
        )
        try:
            generator = cli.generator()
        except cli.CliUnavailable as error:
            raise errors.Unavailable(str(error), code="system_cli_unavailable") from error
        parts_document = parts.build_input(document)[0]
        key = member_view.system_bundle_key(
            document, generator.digest, resolved, board_sub_ports=copied,
            entries=member_view.entry_key_input(resolved),
            parts=parts.digest(parts_document),
        )
        bundle = bundle_store.read(system_id, key)
        self._check(system_id, document, bundle, resolved)
        self._check_entries(document)
        if identity.bought_out:
            self._check_body(document, bundle)
        return key, parts_document

    @staticmethod
    def _check_document(document: Mapping[str, Any]) -> None:
        """§11.2 step 3's document checks, in order, each a ``409``."""

        if not document.get("exports"):
            raise errors.Conflict(
                "The system has no exports to publish", code="system_no_exports",
            )

    @staticmethod
    def _check(
        system_id: str,
        document: Mapping[str, Any],
        bundle: Mapping[str, Any] | None,
        resolved: Sequence[member_view.Member],
    ) -> None:
        """§11.2 step 3's build checks, in order, each a ``409`` naming what failed."""

        if bundle is None:
            raise errors.Conflict(
                "The snapshot's system bundle is not built yet", code="system_bundle_not_ready",
            )
        states = {
            str(item.get("occurrence") or ""): str(item.get("state") or "")
            for item in bundle.get("occurrences", [])
        }
        boards = {
            str(occurrence["id"])
            for occurrence in document.get("occurrences", [])
            if (occurrence.get("source") or {}).get("kind") == "board"
        }
        not_ready = [
            member.occurrence
            for member in resolved
            if member.occurrence in boards
            and (
                member.state in (member_view.PENDING, member_view.ABSENT)
                or states.get(member.occurrence) != member_view.READY
            )
        ]
        if not_ready:
            raise errors.Conflict(
                "The snapshot's system bundle is not ready",
                code="system_bundle_not_ready",
                occurrences=sorted(set(not_ready)),
            )
        unwaived = [
            finding for finding in bundle.get("findings", [])
            if str(finding.get("severity") or "") == "error" and not finding.get("waived")
        ]
        if unwaived:
            raise errors.Conflict(
                "The system has unwaived error findings",
                code="system_not_clean",
                findings=_finding_codes(unwaived),
            )

    def _check_entries(self, document: Mapping[str, Any]) -> None:
        """§11.2 step 5: every entry occurrence is on a released revision."""

        for occurrence in document.get("occurrences", []):
            source = occurrence.get("source") or {}
            if source.get("kind") != "entry":
                continue
            revision_id = str(source.get("revisionId") or "")
            stage = self._entry_stage(str(source.get("componentId") or ""), revision_id)
            if stage != RELEASED:
                raise errors.Conflict(
                    "The system places an entry revision that is not released",
                    code="system_entry_unreleased",
                    occurrence=str(occurrence.get("id") or ""),
                    revisionId=revision_id,
                    stage=stage,
                )

    @staticmethod
    def _check_body(document: Mapping[str, Any], bundle: Mapping[str, Any]) -> None:
        """§11.2 step 3: a bought-out entry needs a ready body with its model."""

        states = {
            str(item.get("occurrence") or ""): str(item.get("state") or "")
            for item in bundle.get("occurrences", [])
        }
        missing_model = {
            str(finding.get("subject") or "")
            for finding in bundle.get("findings", [])
            if str(finding.get("code") or "") == "body-model-missing"
        }
        for occurrence in document.get("occurrences", []):
            source = occurrence.get("source") or {}
            if source.get("kind") != "body":
                continue
            occurrence_id = str(occurrence.get("id") or "")
            if (
                states.get(occurrence_id) == member_view.READY
                and f"occurrence:{occurrence_id}" not in missing_model
            ):
                return
        raise errors.Conflict(
            "A bought-out system needs a body with its STEP model",
            code="system_body_required",
        )

    def _write_revision(
        self,
        record: Mapping[str, Any],
        snapshot: Mapping[str, Any],
        payload: Mapping[str, Any],
        *,
        identity: system_entries.EntryIdentity,
        component_id: str,
        caller: Any,
        change_summary: str,
    ) -> tuple[str, str, str]:
        """§11.2 step 4: the catalog revision, reusing a retry's existing one."""

        document = snapshot["document"]
        system_id = str(record["system_id"])
        conflict_code = mismatch_code(identity.kind)
        gateway = self._gateway
        with gateway.connection() as conn:
            try:
                chosen = str(component_id or "")
                if chosen:
                    component = gateway.revisions.component_row(conn, chosen)
                    if component is None:
                        raise errors.Conflict(
                            "The system's catalog component no longer exists",
                            code=conflict_code,
                        )
                    existing = self._identity_of(conn, component)
                    if (
                        existing.kind != identity.kind
                        or normalize_identity_value(existing.number)
                        != normalize_identity_value(identity.number)
                        or (
                            identity.bought_out
                            and normalize_identity_value(existing.manufacturer)
                            != normalize_identity_value(identity.manufacturer)
                        )
                    ):
                        raise errors.Conflict(
                            "The identity does not match the published component",
                            code=(
                                "system_identity_mismatch"
                                if existing.kind != identity.kind else conflict_code
                            ),
                        )
                else:
                    holder = system_entries.identity_holder(conn, identity)
                    if holder is not None:
                        previous = system_entries.revision_by_source(
                            conn, str(holder["id"]), system_id, str(snapshot["snapshot_id"]),
                        )
                        if previous is None:
                            raise errors.Conflict(
                                "Another component holds that identity",
                                code=conflict_code,
                            )
                        chosen = str(holder["id"])
                    else:
                        chosen = system_entries.new_component_id()
                previous = system_entries.revision_by_source(
                    conn, chosen, system_id, str(snapshot["snapshot_id"]),
                )
                if previous is not None:
                    conn.commit()
                    return chosen, str(previous["revision_id"]), str(previous["stage"])
                entry_component, revision_id = system_entries.write_entry_revision(
                    conn,
                    gateway.runtime,
                    revision_kernel=gateway.revisions,
                    finalizer=gateway.finalizer(),
                    component_writer=gateway.writer(),
                    asset_files=gateway.asset_files,
                    asset_registry=gateway.asset_registry,
                    component_id=chosen,
                    entry_payload=payload,
                    interface=payload["interface"],
                    source_ref={"systemId": system_id, "snapshotId": str(snapshot["snapshot_id"])},
                    identity=identity,
                    name=str(document.get("name") or "System"),
                    description=str(document.get("description") or ""),
                    actor=getattr(caller, "email", ""),
                    change_summary=change_summary,
                )
                stage = normalize_workflow_stage(
                    str((gateway.revisions.revision_row(conn, revision_id) or {}).get("release_status") or "qa_review")
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
        return entry_component, revision_id, stage

    @staticmethod
    def _record(
        store: SystemStore,
        system_id: str,
        version: int,
        snapshot_id: str,
        component_id: str,
        revision_id: str,
        published_by: str,
    ) -> None:
        """§11.2 step 5: the workspace record and the component link."""

        with store.connection() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO ws_system_publications
                        (system_id, version, snapshot_id, component_id, revision_id, published_by)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (system_id, version, snapshot_id, component_id, revision_id, published_by),
                )
                conn.execute(
                    "UPDATE ws_systems SET catalog_component_id = %s, updated_at = now()"
                    " WHERE system_id = %s",
                    (component_id, system_id),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    # --------------------------------------------------------- placement

    def check_placement(
        self,
        before: Mapping[str, Any],
        after: Mapping[str, Any],
        request_ops: Sequence[Mapping[str, Any]],
        caller: Any,
        *,
        role: str,
    ) -> None:
        """§12.1: an occurrence set to a published entry must be visible and released.

        Only an added occurrence or one whose source moves to a different entry
        revision is checked; a ``replace-occurrence`` that keeps the same entry
        revision is a local edit.
        """

        previous = {
            str(item["id"]): item.get("source") or {}
            for item in before.get("occurrences", [])
        }
        for op in request_ops:
            if op.get("kind") not in ("add-occurrence", "replace-occurrence"):
                continue
            occurrence = op.get("occurrence") or {}
            source = occurrence.get("source") or {}
            if source.get("kind") != "entry":
                continue
            occurrence_id = str(occurrence.get("id") or "")
            if op["kind"] == "replace-occurrence":
                old = previous.get(occurrence_id) or {}
                if (
                    old.get("kind") == "entry"
                    and str(old.get("componentId") or "") == str(source.get("componentId") or "")
                    and str(old.get("revisionId") or "") == str(source.get("revisionId") or "")
                ):
                    continue
            self._require_entry(
                str(source.get("componentId") or ""),
                str(source.get("revisionId") or ""),
                caller,
                role=role,
            )

    def _require_entry(self, component_id: str, revision_id: str, caller: Any, *, role: str) -> None:
        if not component_id or not revision_id:
            raise errors.NotFound("System entry revision not found")
        found = self.entry_lookup(component_id, revision_id)
        if found is None:
            raise errors.NotFound("System entry revision not found")
        if found.stage == RELEASED:
            return
        source_system = found.system_id
        if source_system and role in ("designer", "admin"):
            source = self._store.read(source_system, role=role)
            if source is not None:
                return
        raise EntryUnreleased(
            "The system entry revision is not released",
            revisionId=revision_id,
            stage=found.stage,
        )

    # ------------------------------------------------------------- reads

    def entry_view(self, revision_id: str, caller: Any, *, role: str) -> dict[str, Any]:
        """§12.3: a published entry's payload, redacted for the caller's hidden boards."""

        with self._gateway.connection() as conn:
            found = system_entries.entry_revision(conn, revision_id)
        if (
            found is None
            or str(found.get("component_kind") or "") != "system"
            or not bool(found.get("component_is_active", True))
        ):
            raise errors.NotFound("System entry not found")
        read = system_entries.read_payload(found.get("entry_asset"))
        if read is None:
            raise errors.NotFound("System entry not found")
        payload, _path = read
        document = payload.get("document") or {}
        hidden = redaction.hidden_occurrences(document, caller.can_see_project)
        answer = dict(payload)
        answer["document"] = redaction.redact(document, hidden)
        answer["bundle"] = redaction.redact_bundle(
            payload.get("bundle") or {}, hidden, document=document,
        )
        source_system = str(((payload.get("source") or {}).get("systemId")) or "")
        if source_system and role in ("designer", "admin"):
            if self._store.read(source_system, role=role) is not None:
                answer["systemId"] = source_system
        return answer


def board_sub_ports_empty() -> dict[str, Any]:
    return {"schema": "prism.board_sub_ports.a0", "subPorts": []}


__all__ = [
    "CatalogGateway",
    "EntryInput",
    "EntryUnreleased",
    "PublishingService",
    "SCHEMA",
    "build_payload",
    "compute_interface",
    "entry_lookup",
    "lookup_entry",
]
