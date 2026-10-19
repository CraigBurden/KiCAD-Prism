"""Workspace schema migration 126: system_bundles.

One row per system bundle key (System Builder v2 stage 1b,
``docs/system-builder/CONTRACTS.md`` §8). The file is the authority on the
bundle; the row mirrors its state for listings, job deduplication and
retention. Keys are content keys, so a document restored by an undo reuses its
row and file.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """System bundle state, its job and its last use."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_system_bundles (
            system_id        TEXT NOT NULL REFERENCES ws_systems(system_id) ON DELETE CASCADE,
            bundle_key       TEXT NOT NULL,
            state            TEXT NOT NULL
                             CHECK (state IN ('queued', 'building', 'complete', 'failed')),
            job_id           TEXT,
            error            TEXT NOT NULL DEFAULT '',
            document_version INTEGER NOT NULL,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (system_id, bundle_key)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ws_system_bundles_last_used"
        " ON ws_system_bundles(last_used_at)"
    )
