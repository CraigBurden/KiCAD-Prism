"""Workspace schema migration 129: drop_system_builder_v2.

Frozen. Applied deployments record this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any

#: Every table migrations 125-128 created for System Builder v2.
TABLES = (
    "ws_board_sub_port_history",
    "ws_board_sub_ports",
    "ws_system_bundles",
    "ws_system_git_links",
    "ws_system_ops",
    "ws_system_publications",
    "ws_system_snapshots",
    "ws_systems",
)


def migrate(conn: Any) -> None:
    """System Builder was removed on 2026-10-23 (archive tag ``archive/system-builder-v2``).

    Its systems are not kept. Its tables go, with their indexes; the registry no longer lists
    migrations 125-128, so a new database never creates them.
    """

    for table in TABLES:
        conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
