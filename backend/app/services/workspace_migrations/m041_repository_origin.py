"""Workspace schema migration 41: repository_origin.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Record where each repository's git actually lives, and who owns it.

    ``clone_path``/``url`` used to carry both a real remote and, for a local
    import, a filesystem path the user picked, which a client cannot tell apart.
    origin_url is the true remote (asked of git) and origin_owner classifies it:
    "external" (a real remote like GitLab), "prism" (Prism hosts the git), or
    "none" (no remote yet). The agent's Open-in-KiCad needs this to know what, if
    anything, it can clone from. Backfilled by WorkspaceService after migration.
    """

    conn.execute(
        """
        ALTER TABLE ws_repositories
            ADD COLUMN IF NOT EXISTS origin_url TEXT,
            ADD COLUMN IF NOT EXISTS origin_owner TEXT
        """
    )
