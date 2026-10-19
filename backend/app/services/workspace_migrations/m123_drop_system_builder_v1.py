"""Workspace schema migration 123: drop_system_builder_v1.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any

#: Every table migrations 26-54 created for System Builder v1 (41 is not one of them).
TABLES = (
    "system_audit_events", "system_bundle_frames", "system_collision_checks", "system_driving_mates",
    "system_exports", "system_finding_counts", "system_finding_waivers", "system_git_links",
    "system_harness_ends", "system_harness_nodes", "system_harness_wires", "system_harnesses",
    "system_import_sessions", "system_instances", "system_interface_artifacts", "system_layouts",
    "system_link_rows", "system_links", "system_net_renames", "system_port_mating", "system_port_overrides",
    "system_poses", "system_projects", "system_review_items", "system_reviews", "system_snapshots",
    "system_source_checks", "system_step_exports", "system_subports",
)


def migrate(conn: Any) -> None:
    """System Builder v2, stage 0 (``docs/architecture/adr-system-builder-v2.md`` §6): a clean break.

    v1's systems are not migrated. Its tables go, with their triggers and indexes; the shared
    ``ws_bump_workspace_version`` function stays. The registry no longer lists migrations 26-54
    (except 41), so a new database never creates these tables.
    """

    for table in TABLES:
        conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
