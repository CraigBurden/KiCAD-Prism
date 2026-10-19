"""Workspace schema migration 127: board_sub_ports.

Board-level sub-ports (System Builder v2 stage 1c,
``docs/system-builder/CONTRACTS.md`` §10): a board's named, ordered pin groups,
stored against a project and connector and shared by every system that places
the board. ``ws_board_sub_port_history`` keeps one row per version, written in
the same transaction as the row it describes.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Board-level sub-ports and their history.

    A delete is soft: the row stays so systems can report what was deleted, and
    the partial unique index only constrains the live rows of a project and
    connector. A sub-port id is never reused, live or deleted.
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_board_sub_ports (
            sub_port_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            connector TEXT NOT NULL,
            name TEXT NOT NULL,
            pins JSONB NOT NULL,
            version INTEGER NOT NULL CHECK (version >= 1),
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ,
            deleted_by TEXT
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ws_board_sub_ports_project_connector"
        " ON ws_board_sub_ports (project_id, connector)"
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_ws_board_sub_ports_live_name
            ON ws_board_sub_ports (project_id, connector, name)
         WHERE deleted_at IS NULL
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_board_sub_port_history (
            sub_port_id TEXT NOT NULL
                REFERENCES ws_board_sub_ports(sub_port_id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
            name TEXT NOT NULL,
            pins JSONB NOT NULL,
            actor TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (sub_port_id, version)
        )
        """
    )
