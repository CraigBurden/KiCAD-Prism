"""Workspace schema migration 124: drop_mesh_viewer_readiness.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """System Builder v2, stage 0 (``docs/architecture/adr-system-builder-v2.md`` §6): no mesh path.

    ``ws_webgpu_ready`` recorded the mesh bundles the ``webgpu_3d`` job published (migrations 4
    and 57). The 3D tab reads the design bundle's analytic model, which has its own readiness.
    """

    conn.execute("DROP TABLE IF EXISTS ws_webgpu_ready CASCADE")
