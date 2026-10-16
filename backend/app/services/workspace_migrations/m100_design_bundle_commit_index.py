"""Workspace schema migration 100: design_bundle_commit_index.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """The commit index of revision-key.md §10: ``(project, commit, effective-config
    digest, algorithm) -> revision key``. A row is immutable; rows go only with
    retention. ``commit_sha`` is the spec's ``commit`` column."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_design_bundle_commit_index (
            project_id    TEXT NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
            commit_sha    TEXT NOT NULL CHECK (commit_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
            config_digest TEXT NOT NULL CHECK (config_digest ~ '^[0-9a-f]{64}$'),
            algorithm     TEXT NOT NULL CHECK (btrim(algorithm) <> ''),
            revision_key  TEXT NOT NULL CHECK (revision_key ~ '^[0-9a-f]{64}$'),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (project_id, commit_sha, config_digest, algorithm)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ws_design_bundle_commit_index_key"
        " ON ws_design_bundle_commit_index(project_id, revision_key)"
    )
