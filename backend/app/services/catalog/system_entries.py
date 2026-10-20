"""Published systems in the catalog: the ``system`` component and its payload (CONTRACTS.md §11).

A published system is one catalog component of kind ``system``, with either an
in-house IPN or the catalog's ordinary manufacturer-part identity, and one
revision per snapshot in stage ``qa_review``. The revision carries the frozen
``prism.system_entry.a0`` payload as its required ``system_entry`` asset,
``interface_json`` for listings, and ``source_ref_json`` ``{systemId,
snapshotId}`` so a retry after a failed workspace write finds the revision
instead of publishing it twice.

This module owns the connection-level writes and reads. The System Builder
publishes through it (``app.system_builder.publishing``); the release gate reads
the same asset in ``release_workflow``.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import uuid
from typing import Any, Mapping

from app.services.catalog.asset_files import CatalogAssetFiles
from app.services.catalog.asset_links import CatalogAssetLinks
from app.services.catalog.asset_registry import CatalogAssetRegistry
from app.services.catalog.asset_types import SYSTEM_ENTRY_ASSET_TYPE
from app.services.catalog.component_identity import ComponentIdentity, find_identity_holder
from app.services.catalog.component_writer import (
    METADATA_INSERT_COLUMNS,
    CatalogComponentWriter,
)
from app.services.catalog.metadata_normalization import (
    IDENTITY_KIND_IPN,
    IDENTITY_KIND_MPN,
    IPN_SCOPE_SYSTEM,
    MPN_SOURCE_IPN,
    MPN_SOURCE_MANUFACTURER,
    normalize_identity_value,
)
from app.services.catalog.revision_finalization import CatalogRevisionFinalizer
from app.services.catalog.revision_kernel import CatalogRevisionKernel
from app.services.catalog.runtime import CatalogRuntime
from app.services.catalog.workflow_policy import normalize_workflow_stage
from app.services.catalog.normalization import utc_now_iso

SCHEMA = "prism.system_entry.a0"
ASSET_TYPE = SYSTEM_ENTRY_ASSET_TYPE
TARGET_LIBRARY = "Prism_SystemEntries"


@dataclass(frozen=True)
class EntryIdentity:
    """A published system's identity: an in-house IPN or an orderable MPN."""

    kind: str
    number: str
    manufacturer: str = ""

    @classmethod
    def ipn(cls, ipn: str) -> "EntryIdentity":
        return cls(kind=IDENTITY_KIND_IPN, number=str(ipn or "").strip())

    @classmethod
    def mpn(cls, manufacturer: str, mpn: str) -> "EntryIdentity":
        return cls(
            kind=IDENTITY_KIND_MPN,
            number=str(mpn or "").strip(),
            manufacturer=str(manufacturer or "").strip(),
        )

    @property
    def bought_out(self) -> bool:
        return self.kind == IDENTITY_KIND_MPN

    def component_identity(self) -> ComponentIdentity:
        if self.kind == IDENTITY_KIND_IPN:
            return ComponentIdentity.of(
                manufacturer="",
                mpn="",
                identity_kind=IDENTITY_KIND_IPN,
                identity_source=IPN_SCOPE_SYSTEM,
                source_internal_part_number=self.number,
            )
        return ComponentIdentity.of(manufacturer=self.manufacturer, mpn=self.number)

    def metadata(self, name: str, description: str) -> dict[str, Any]:
        """The revision columns this identity needs, with no part-only fields."""

        metadata: dict[str, Any] = {column: "" for column in METADATA_INSERT_COLUMNS}
        bought_out = self.bought_out
        metadata.update(
            {
                "name": name,
                "value": name,
                "description": description,
                "summary": description,
                "manufacturer": self.manufacturer if bought_out else "",
                "mpn": self.number if bought_out else "",
                "identity_kind": self.kind,
                "identity_source": "" if bought_out else IPN_SCOPE_SYSTEM,
                "source_internal_part_number": "" if bought_out else self.number,
                "normalized_part_number": normalize_identity_value(self.number),
                "normalized_manufacturer": (
                    normalize_identity_value(self.manufacturer) if bought_out else ""
                ),
                "normalized_mpn": normalize_identity_value(self.number) if bought_out else "",
                "mpn_source": MPN_SOURCE_MANUFACTURER if bought_out else MPN_SOURCE_IPN,
                "extra_fields": {},
            }
        )
        return metadata


def empty_system_metadata(ipn: str, name: str, description: str) -> dict[str, Any]:
    """The revision columns an in-house system component carries (kept for callers)."""

    return EntryIdentity.ipn(ipn).metadata(name, description)


def identity_metadata(identity: EntryIdentity, name: str, description: str) -> dict[str, Any]:
    """The revision columns a system component carries for ``identity``."""

    return identity.metadata(name, description)


def ipn_identity(ipn: str) -> ComponentIdentity:
    return EntryIdentity.ipn(ipn).component_identity()


def identity_holder(conn: Any, identity: EntryIdentity) -> dict[str, Any] | None:
    """The component, active or retired, holding ``identity``."""

    return find_identity_holder(conn, identity.component_identity())


def ipn_holder(conn: Any, ipn: str) -> dict[str, Any] | None:
    """The component, active or retired, holding ``ipn`` in the system scope."""

    return identity_holder(conn, EntryIdentity.ipn(ipn))


def entry_revision(
    conn: Any,
    revision_id: str,
    *,
    component_id: str = "",
) -> dict[str, Any] | None:
    """A system revision, its component and its one ``system_entry`` asset, or None."""

    row = conn.execute(
        """
        SELECT revision.*, component.kind AS component_kind,
               component.identity_kind AS component_identity_kind,
               component.identity_source AS component_identity_source,
               component.normalized_part_number AS component_normalized_part_number,
               component.is_active AS component_is_active
          FROM component_revisions revision
          JOIN components component ON component.id = revision.component_id
         WHERE revision.id = %s
        """,
        (revision_id,),
    ).fetchone()
    if row is None:
        return None
    found = dict(row)
    if component_id and str(found["component_id"]) != component_id:
        return None
    asset = conn.execute(
        """
        SELECT asset.*, link.required AS required
          FROM revision_assets link
          JOIN assets asset ON asset.id = link.asset_id
         WHERE link.revision_id = %s AND asset.asset_type = %s
        """,
        (revision_id, ASSET_TYPE),
    ).fetchone()
    found["entry_asset"] = dict(asset) if asset is not None else None
    return found


def revision_by_source(
    conn: Any,
    component_id: str,
    system_id: str,
    snapshot_id: str,
) -> dict[str, Any] | None:
    """The revision a previous attempt wrote for ``(systemId, snapshotId)``, if any."""

    rows = conn.execute(
        "SELECT id, release_status, source_ref_json FROM component_revisions"
        " WHERE component_id = %s ORDER BY version DESC",
        (component_id,),
    ).fetchall()
    for row in rows:
        try:
            source = json.loads(str(row["source_ref_json"] or "{}"))
        except ValueError:
            continue
        if (
            isinstance(source, dict)
            and str(source.get("systemId") or "") == system_id
            and str(source.get("snapshotId") or "") == snapshot_id
        ):
            return {"revision_id": str(row["id"]), "stage": normalize_workflow_stage(str(row["release_status"]))}
    return None


def read_payload(asset: Mapping[str, Any] | None) -> tuple[dict[str, Any], Path] | None:
    """The payload bytes of an asset row, parsed; None when missing or unreadable."""

    if not asset:
        return None
    path = Path(str(asset.get("canonical_path") or ""))
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    return payload, path


def write_entry_revision(
    conn: Any,
    runtime: CatalogRuntime,
    *,
    revision_kernel: CatalogRevisionKernel,
    finalizer: CatalogRevisionFinalizer,
    component_writer: CatalogComponentWriter,
    asset_files: CatalogAssetFiles,
    asset_registry: CatalogAssetRegistry,
    component_id: str,
    entry_payload: Mapping[str, Any],
    interface: Mapping[str, Any],
    source_ref: Mapping[str, Any],
    identity: EntryIdentity,
    name: str,
    description: str,
    actor: str,
    change_summary: str,
) -> tuple[str, str]:
    """Write the payload as a ``system_entry`` revision in ``qa_review``.

    ``component_id`` is the system's existing component or a new id. The caller
    owns the transaction and the retry lookup; this never creates a second
    revision for the same ``(systemId, snapshotId)`` on its own. Returns
    ``(component_id, revision_id)``.
    """

    snapshot_id = str(source_ref.get("snapshotId") or "entry")
    payload_bytes = json.dumps(
        dict(entry_payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    existing = revision_kernel.component_row(conn, component_id) is not None
    if existing:
        component = revision_kernel.component_row(conn, component_id) or {}
        if str(component.get("kind") or "part") != "system":
            raise ValueError("A system_entry can only be written to a system component")
        if str(component.get("identity_kind") or "") != identity.kind:
            raise ValueError("The system component's identity kind does not match")
        if str(component.get("normalized_part_number") or "") != normalize_identity_value(identity.number):
            raise ValueError("The identity does not match the system component's identity")
        if identity.bought_out and str(component.get("normalized_manufacturer") or "") != normalize_identity_value(identity.manufacturer):
            raise ValueError("The manufacturer does not match the system component's identity")
        metadata = identity_metadata(identity, name, description)
    else:
        metadata = identity_metadata(identity, name, description)
    written_component, revision_id = component_writer.upsert_metadata_row(
        conn,
        runtime,
        component_id=component_id,
        metadata=metadata,
        now=_now(),
        existing_component_id=component_id if existing else None,
        actor=actor,
        change_summary=change_summary,
        finalize_revision=False,
        change_kind="system_entry" if existing else "create",
        kind="system",
    )
    conn.execute(
        """
        UPDATE component_revisions
           SET interface_json = %s, source_ref_json = %s, release_status = 'qa_review',
               updated_at = %s
         WHERE id = %s
        """,
        (
            json.dumps(dict(interface), sort_keys=True, separators=(",", ":")),
            json.dumps(dict(source_ref), sort_keys=True, separators=(",", ":")),
            _now(),
            revision_id,
        ),
    )
    # A cloned revision inherits the previous payload; this revision freezes a
    # different snapshot, so only the new asset may be linked.
    conn.execute(
        "DELETE FROM revision_assets WHERE revision_id = %s AND asset_type = %s",
        (revision_id, ASSET_TYPE),
    )
    destination = (
        runtime.store_root / "system_entries" / str(written_component) / f"{snapshot_id}.json"
    )
    stored = asset_files.write_canonical_file(runtime, destination, payload_bytes)
    asset = asset_registry.register_asset(
        runtime,
        conn,
        asset_type=ASSET_TYPE,
        canonical_path=stored,
        target_library=TARGET_LIBRARY,
        target_name=stored.name,
    )
    CatalogAssetLinks.link_asset_to_revision(conn, revision_id, asset, required=True)
    finalizer.finalize_revision(
        conn,
        runtime,
        component_id=str(written_component),
        revision_id=revision_id,
        event_type="revision.created" if existing else "component.created",
        actor=actor,
        details={
            "change_kind": "system_entry" if existing else "create",
            "change_summary": change_summary,
            "system_id": str(source_ref.get("systemId") or ""),
            "snapshot_id": snapshot_id,
            "asset_sha256": str(asset.get("sha256") or ""),
        },
    )
    return str(written_component), revision_id


def new_component_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return utc_now_iso()


__all__ = [
    "ASSET_TYPE",
    "EntryIdentity",
    "SCHEMA",
    "empty_system_metadata",
    "entry_revision",
    "identity_holder",
    "identity_metadata",
    "ipn_holder",
    "ipn_identity",
    "new_component_id",
    "read_payload",
    "revision_by_source",
    "write_entry_revision",
]
