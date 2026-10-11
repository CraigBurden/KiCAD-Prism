"""Numbered steps for the ``operations`` schema: catalog artifact ownership.

``LocalArtifactStore`` used to create these tables on every start under its own
advisory lock. The ledger keeps that lock, because catalog jobs initialise the
store from separate processes at the same moment. Step 1 is the DDL the store
ran, safe on a database that already has it.

The store also used to index ``catalog.revision_assets`` for retention's
reverse lookup. That index belongs to the catalog and is now catalog step 8, so
it comes back when the catalog schema is reset.
"""

from __future__ import annotations

from typing import Any

from app.services.schema_ledger import Ledger, Step


def _catalog_artifacts(conn: Any) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_artifacts (
            sha256 TEXT PRIMARY KEY,
            size_bytes BIGINT NOT NULL,
            media_type TEXT NOT NULL DEFAULT 'application/octet-stream',
            artifact_kind TEXT NOT NULL DEFAULT 'source',
            storage_state TEXT NOT NULL DEFAULT 'available',
            object_path TEXT NOT NULL,
            archived_path TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            quarantined_at TIMESTAMPTZ,
            purged_at TIMESTAMPTZ
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_artifact_references (
            id TEXT PRIMARY KEY,
            artifact_sha256 TEXT NOT NULL REFERENCES catalog_artifacts(sha256),
            owner_type TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT '',
            released BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            removed_at TIMESTAMPTZ,
            UNIQUE(artifact_sha256, owner_type, owner_id, role)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_import_snapshots (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            display_name TEXT NOT NULL,
            source_locator TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'uploading',
            manifest_sha256 TEXT NOT NULL DEFAULT '',
            file_count INTEGER NOT NULL DEFAULT 0,
            size_bytes BIGINT NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_import_snapshot_files (
            snapshot_id TEXT NOT NULL REFERENCES catalog_import_snapshots(id) ON DELETE CASCADE,
            relative_path TEXT NOT NULL,
            artifact_sha256 TEXT NOT NULL REFERENCES catalog_artifacts(sha256),
            size_bytes BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY(snapshot_id, relative_path)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_artifact_refs_active "
        "ON catalog_artifact_references(artifact_sha256, removed_at, released)"
    )


ARTIFACT_LEDGER = Ledger(
    name="artifacts",
    schema="operations",
    table="artifact_schema_migrations",
    steps=(Step(1, "catalog_artifacts", _catalog_artifacts),),
    lock="prism-artifacts-schema",
)
