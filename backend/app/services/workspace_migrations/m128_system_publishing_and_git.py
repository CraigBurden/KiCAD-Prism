"""Workspace schema migration 128: system publishing and Git links.

System Builder v2 stage 1c (``docs/system-builder/CONTRACTS.md`` §4, §11.2,
§13.1). The system document itself already lives in 125 and its bundle state in
126. This step adds the catalog identity a published system keeps, the frozen
board-level sub-port definitions a snapshot copies, the publication record, and
the one Git link a system may have.

Only ``ws_system_git_links`` is used by stage 1c's Git link; the other columns
and the publication table are the schema publishing needs, added here so 1c
ships one migration as §4 assigns.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Catalog link, snapshot sub-ports, publication records and Git links."""

    conn.execute(
        "ALTER TABLE ws_systems ADD COLUMN IF NOT EXISTS catalog_component_id TEXT"
    )
    conn.execute(
        "ALTER TABLE ws_system_snapshots ADD COLUMN IF NOT EXISTS board_sub_ports JSONB"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_system_publications (
            system_id    TEXT NOT NULL REFERENCES ws_systems(system_id) ON DELETE CASCADE,
            version      INTEGER NOT NULL,
            snapshot_id  TEXT NOT NULL,
            component_id TEXT NOT NULL,
            revision_id  TEXT NOT NULL,
            published_by TEXT NOT NULL,
            published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (system_id, version, revision_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_system_git_links (
            system_id    TEXT PRIMARY KEY REFERENCES ws_systems(system_id) ON DELETE CASCADE,
            project_id   TEXT NOT NULL,
            branch       TEXT NOT NULL,
            path         TEXT NOT NULL,
            last_commit  TEXT,
            last_blob    TEXT,
            last_version INTEGER,
            linked_by    TEXT NOT NULL,
            linked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
