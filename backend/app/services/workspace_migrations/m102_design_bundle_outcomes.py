"""Workspace schema migration 102: design_bundle_outcomes.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Two outcomes that are not bundles.

    ``ws_design_bundle_absences``: a commit at which the project's anchor is
    not in the tree, so it has no key and no bundle (revision-key.md §11).
    ``ws_design_bundle_flags``: what the first-deploy backfill found about a
    project, such as a board or schematic that no longer resolves now that
    files are attributed by anchor only (revision-key.md §4.4, decisions.md).
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_design_bundle_absences (
            project_id   TEXT NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
            commit_sha   TEXT NOT NULL CHECK (commit_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
            project_file TEXT NOT NULL,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (project_id, commit_sha, project_file)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_design_bundle_flags (
            project_id TEXT NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
            code       TEXT NOT NULL CHECK (code ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
            commit_sha TEXT NOT NULL,
            detail     TEXT NOT NULL DEFAULT '',
            flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (project_id, code)
        )
        """
    )
