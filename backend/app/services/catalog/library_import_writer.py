"""The catalog writes behind the bulk library-import CLIs.

``scripts/import_database_library.py`` and ``scripts/import_footprint_library.py``
read a KiCad library and plan its components; every row they write goes through
this module. It inserts an imported component with its first revision, links
assets and previews, adds representations, seals the revision (manifest hash and
audit event) and, for a trusted database-library import, releases it.

Like the component writer, it allocates slugs and checks identities under the
writer's slug and identity advisory locks (:meth:`allocate_slug`,
:meth:`identity_holder`, :meth:`insert_component`), and a complete
database-library row is released through the release workflow's trusted-import
path (:meth:`release_trusted`), which applies the release gates. Each batch runs
in catalog migration mode (:meth:`begin_batch`), which the revision-preview
immutability guards require.

The metadata columns and their order are the component writer's. Nothing here
commits; the CLIs commit per batch.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable
import uuid

from app.services.catalog.asset_files import lock_and_check_asset_bytes
from app.services.catalog.asset_registry import CatalogAssetRegistry
from app.services.catalog.component_writer import (
    METADATA_INSERT_COLUMNS,
    CatalogComponentWriter,
    metadata_column_values,
)
from app.services.catalog.metadata_normalization import IDENTITY_KIND_MPN, IDENTITY_KIND_PROVISIONAL_IPN
from app.services.catalog.metadata_schema import CatalogMetadataSchema
from app.services.catalog.release_workflow import CatalogReleaseWorkflow
from app.services.catalog.revision_kernel import REVISION_MANIFEST_A3, CatalogRevisionKernel
from app.services.catalog.runtime import CatalogRuntime


IMPORT_SOURCE = "import"
IMPORT_CHANGE_KIND = "import"

#: Every catalog table a ``--replace-catalog`` import empties.
CATALOG_TABLES = (
    "asset_validation_findings",
    "asset_validation_runs",
    "revision_validation_evidence_links",
    "revision_preview_outputs",
    "revision_previews",
    "asset_preview_versions",
    "asset_previews",
    "revision_assets",
    "revision_representations",
    "inventory_levels",
    "component_release_records",
    "component_review_decisions",
    "catalog_audit_events",
    "catalog_metadata_batch_items",
    "catalog_metadata_batches",
    "component_usage",
    "project_catalog_placements",
    "project_catalog_scans",
    "project_component_import_proposals",
    "project_component_import_sessions",
    "component_heads",
    "component_revisions",
    "components",
    "assets",
    "catalog_meta",
)


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _identity(metadata: dict[str, Any]) -> dict[str, str]:
    return {
        "manufacturer": metadata["manufacturer"],
        "mpn": metadata["mpn"],
        "identity_kind": metadata["identity_kind"],
        "identity_source": metadata["identity_source"],
        "source_internal_part_number": metadata["source_internal_part_number"],
    }


class CatalogLibraryImportWriter:
    """Write imported components, their assets and representations."""

    def __init__(
        self,
        runtime: CatalogRuntime,
        revisions: CatalogRevisionKernel,
        component_writer: CatalogComponentWriter,
        release_workflow: CatalogReleaseWorkflow,
    ) -> None:
        self._runtime = runtime
        self._revisions = revisions
        self._component_writer = component_writer
        self._release_workflow = release_workflow

    # -- batches -------------------------------------------------------------

    @staticmethod
    def begin_batch(conn: Any) -> None:
        """Enter catalog migration mode. ``SET LOCAL`` ends with the transaction,
        so call this again after every commit or rollback."""
        conn.execute("SET LOCAL prism.catalog_migration = 'on'")

    @staticmethod
    def clear_catalog(conn: Any) -> None:
        tables = ", ".join(f'"{table}"' for table in CATALOG_TABLES)
        conn.execute(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE")

    @staticmethod
    def register_extra_fields(conn: Any, keys: Iterable[str], *, actor: str) -> None:
        """Label the extra-field keys the import's rows carry."""
        CatalogMetadataSchema().ensure_extra_field_definitions(conn, sorted(keys), actor=actor)

    def allocate_slug(self, conn: Any, base: str) -> str:
        """A slug unused in the catalog, under the component writer's slug lock."""
        return self._component_writer.unique_slug(conn, base)

    def identity_holder(self, conn: Any, metadata: dict[str, Any]) -> dict[str, Any] | None:
        """The component (active or retired) holding ``metadata``'s identity, under the identity lock."""
        return self._component_writer.identity_holder(conn, **_identity(metadata))

    def missing_custom_fields(self, conn: Any, metadata: dict[str, Any]) -> list[str]:
        """Labels of the custom required fields normalized ``metadata`` leaves blank.

        The same check as the component writer's create and PATCH and as import
        acceptance; the CLIs skip such a row and list it under ``skipped_missing_fields``.
        """
        return self._component_writer.missing_custom_fields(conn, metadata)

    # -- assets --------------------------------------------------------------

    def register_asset(
        self,
        conn: Any,
        *,
        asset_type: str,
        canonical_path: Path,
        target_library: str,
        target_name: str,
        source_group: str,
        runtime_store_root: Path | None,
    ) -> dict[str, Any]:
        """Register a canonical file; with ``runtime_store_root`` the row records
        the path the running service will see instead of the local one, and
        ``local_path`` keeps the local one for ``link_asset``'s byte check."""
        local_path = canonical_path.resolve()
        asset = CatalogAssetRegistry.register_asset(
            self._runtime,
            conn,
            asset_type=asset_type,
            canonical_path=local_path,
            target_library=target_library,
            target_name=target_name,
            source_group=source_group,
        )
        if runtime_store_root is None:
            runtime_path = str(local_path)
        else:
            relative = local_path.relative_to(self._runtime.store_root.resolve())
            runtime_path = str((runtime_store_root / relative).as_posix())
        if str(asset["canonical_path"]) != runtime_path:
            conn.execute("UPDATE assets SET canonical_path = %s WHERE id = %s", (runtime_path, asset["id"]))
            asset = dict(asset)
            asset["canonical_path"] = runtime_path
        return {**asset, "local_path": str(local_path)}

    # -- components ----------------------------------------------------------

    def insert_component(
        self,
        conn: Any,
        metadata: dict[str, Any],
        *,
        slug_base: str,
        now: str,
        actor: str,
        change_summary: str,
        external_source: str = "",
        external_id: str = "",
    ) -> tuple[str, str]:
        """An imported component and its open version-1 revision; returns ``(component_id, revision_id)``.

        ``metadata`` is normalized (``normalize_metadata``). As in the component
        writer, only a provisional part records its identity source and only a
        manufacturer part its normalized manufacturer. The identity is checked and
        the slug allocated under the component writer's locks; an identity some
        component already holds is refused with ``ValueError``.
        """
        self._component_writer.assert_identity_available(conn, **_identity(metadata))
        slug = self.allocate_slug(conn, slug_base)
        component_id = str(uuid.uuid4())
        revision_id = str(uuid.uuid4())
        identity_kind = metadata["identity_kind"]
        conn.execute(
            """
            INSERT INTO components (
                id, slug, identity_kind, identity_source, normalized_manufacturer,
                normalized_part_number, source, external_source, external_id, is_active, current_revision_id,
                released_revision_id, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, '', %s, %s)
            """,
            (
                component_id,
                slug,
                identity_kind,
                metadata["identity_source"] if identity_kind == IDENTITY_KIND_PROVISIONAL_IPN else "",
                metadata["normalized_manufacturer"] if identity_kind == IDENTITY_KIND_MPN else "",
                metadata["normalized_part_number"],
                IMPORT_SOURCE,
                external_source,
                external_id,
                revision_id,
                now,
                now,
            ),
        )
        columns = ", ".join(METADATA_INSERT_COLUMNS)
        placeholders = ", ".join("%s" for _ in range(len(METADATA_INSERT_COLUMNS) + 3))
        conn.execute(
            f"""
            INSERT INTO component_revisions (
                id, component_id, version, parent_revision_id, change_kind, change_summary, created_by,
                manifest_hash, manifest_schema, release_status, {columns},
                keywords, extra_fields, search_document, created_at, updated_at
            )
            VALUES (%s, %s, 1, '', %s, %s, %s, '', %s, 'open', {placeholders}, %s, %s)
            """,
            (
                revision_id,
                component_id,
                IMPORT_CHANGE_KIND,
                change_summary,
                actor,
                REVISION_MANIFEST_A3,
                *metadata_column_values(metadata),
                now,
                now,
            ),
        )
        return component_id, revision_id

    @staticmethod
    def link_asset(
        conn: Any,
        revision_id: str,
        asset: dict[str, Any],
        *,
        required: bool,
        now: str,
        bind_ready_previews: bool = False,
    ) -> None:
        """Attach an asset; ``bind_ready_previews`` also binds a symbol's or
        footprint's newest ready preview of each kind to the revision."""
        if asset["asset_type"] == "3dmodel":
            local_path = asset.get("local_path")
            lock_and_check_asset_bytes(conn, str(asset["id"]), local_path=Path(local_path) if local_path else None)
        conn.execute(
            """
            INSERT INTO revision_assets (revision_id, asset_type, asset_id, required, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (revision_id, asset_id)
            DO UPDATE SET required = excluded.required, updated_at = excluded.updated_at
            """,
            (revision_id, asset["asset_type"], asset["id"], 1 if required else 0, now, now),
        )
        if bind_ready_previews and asset["asset_type"] in {"symbol", "footprint"}:
            conn.execute(
                """
                INSERT INTO revision_preview_outputs (revision_id, asset_id, kind, preview_id, generated_at)
                SELECT %s, latest.asset_id, latest.kind, latest.id, %s
                FROM (
                    SELECT DISTINCT ON (asset_id, kind) id, asset_id, kind
                    FROM asset_preview_versions
                    WHERE asset_id = %s AND status = 'ready'
                    ORDER BY asset_id, kind, created_at DESC, id DESC
                ) latest
                ON CONFLICT (revision_id, asset_id, kind)
                DO UPDATE SET preview_id = EXCLUDED.preview_id, generated_at = EXCLUDED.generated_at
                """,
                (revision_id, now, asset["id"]),
            )

    @staticmethod
    def bind_preview(conn: Any, revision_id: str, asset_id: str, preview: dict[str, Any], now: str) -> None:
        """Bind a generated preview to the revision on both preview tables.

        ``revision_preview_outputs`` is what the catalog UI reads, but the
        ``remote_component_heads`` projection resolves ``footprint_preview_id``
        from ``revision_previews``. Writing only one leaves the preview missing
        from either the workspace or the KiCad Remote Symbol Panel.
        """
        preview_id = str(preview["id"])
        kind = str(preview["kind"])
        conn.execute(
            """
            INSERT INTO revision_preview_outputs (revision_id, asset_id, kind, preview_id, generated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (revision_id, asset_id, kind)
            DO UPDATE SET preview_id = excluded.preview_id, generated_at = excluded.generated_at
            """,
            (revision_id, asset_id, kind, preview_id, now),
        )
        conn.execute(
            """
            INSERT INTO revision_previews (revision_id, asset_id, kind, preview_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (revision_id, asset_id, kind) DO NOTHING
            """,
            (revision_id, asset_id, kind, preview_id, now),
        )

    @staticmethod
    def add_representation(
        conn: Any,
        revision_id: str,
        *,
        label: str,
        symbol_asset_id: str | None,
        footprint_asset_id: str | None,
        is_default: bool,
        display_order: int,
        source_internal_part_number: str,
        provenance: dict[str, Any],
        now: str,
    ) -> None:
        conn.execute(
            """
            INSERT INTO revision_representations (
                id, revision_id, label, symbol_asset_id, footprint_asset_id, is_default,
                display_order, source_internal_part_number, provenance_json, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                revision_id,
                label,
                symbol_asset_id,
                footprint_asset_id,
                1 if is_default else 0,
                display_order,
                source_internal_part_number,
                _json(provenance),
                now,
                now,
            ),
        )

    def seal(
        self,
        conn: Any,
        *,
        component_id: str,
        revision_id: str,
        now: str,
        actor: str,
        change_summary: str,
    ) -> str:
        """Record the finished revision's manifest hash and its ``component.created`` event."""
        manifest_hash = self._revisions.revision_manifest_hash(conn, revision_id)
        conn.execute(
            "UPDATE component_revisions SET manifest_hash = %s, updated_at = %s WHERE id = %s",
            (manifest_hash, now, revision_id),
        )
        self._revisions.append_audit_event(
            conn,
            component_id=component_id,
            revision_id=revision_id,
            event_type="component.created",
            actor=actor,
            details={
                "change_kind": IMPORT_CHANGE_KIND,
                "change_summary": change_summary,
                "manifest_hash": manifest_hash,
            },
        )
        return manifest_hash

    def release_trusted(
        self,
        conn: Any,
        *,
        component_id: str,
        revision_id: str,
        now: str,
        actor: str,
        release_label: str,
    ) -> None:
        """Release a sealed import revision through the release workflow's trusted-import path.

        Raises ``ValueError``, before writing anything, when a release gate refuses it.
        """
        self._release_workflow.release_trusted_import(
            conn,
            component_id=component_id,
            revision_id=revision_id,
            now=now,
            actor=actor,
            release_label=release_label,
        )


__all__ = ["CATALOG_TABLES", "IMPORT_SOURCE", "CatalogLibraryImportWriter"]
