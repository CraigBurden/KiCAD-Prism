"""Workspace schema migration 125: system_builder_v2.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """System Builder v2 systems, their operation log and snapshots.

    ``document`` is the complete stored ``prism.system.v2`` document; ``name``
    is copied out of it so listing needs no JSON read. ``seen_ids`` holds every
    object id the document has ever carried, so a removed id is never reused.
    The log records one row per request that produced a version; creation is
    version 1 and has no row. A snapshot copies the document at a version.
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_systems (
            system_id TEXT PRIMARY KEY,
            folder_id TEXT REFERENCES ws_folders(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            document JSONB NOT NULL,
            version INTEGER NOT NULL,
            seen_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS ws_systems_folder_idx ON ws_systems (folder_id)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_system_ops (
            system_id TEXT NOT NULL REFERENCES ws_systems(system_id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('edit', 'undo', 'system')),
            ops JSONB NOT NULL,
            inverse JSONB NOT NULL,
            touched JSONB NOT NULL,
            actor TEXT NOT NULL,
            undoes INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (system_id, version)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_system_snapshots (
            snapshot_id TEXT PRIMARY KEY,
            system_id TEXT NOT NULL REFERENCES ws_systems(system_id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            name TEXT NOT NULL,
            note TEXT,
            document JSONB NOT NULL,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS ws_system_snapshots_system_idx"
        " ON ws_system_snapshots (system_id, created_at)"
    )
