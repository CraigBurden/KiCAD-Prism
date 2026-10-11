"""Workspace schema migration 55: project_path_settings.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Keep Prism-side project settings out of the checkout.

    ``path_settings`` holds what a user set in Prism (path overrides, name,
    description, workflows, portfolio); it wins over the committed
    ``.prism.json``. ``path_settings_checked`` records that a checkout's
    Prism-written ``.prism.json`` (untracked, or modified against HEAD) was
    imported once, which WorkspaceService does after migrating.
    """

    conn.execute(
        """
        ALTER TABLE ws_projects
            ADD COLUMN IF NOT EXISTS path_settings JSONB,
            ADD COLUMN IF NOT EXISTS path_settings_checked BOOLEAN NOT NULL DEFAULT FALSE
        """
    )
