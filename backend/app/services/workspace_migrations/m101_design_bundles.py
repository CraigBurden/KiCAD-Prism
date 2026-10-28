"""Workspace schema migration 101: design_bundles.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """One row per stored design bundle (ADR §5): where it is, how far its
    stages got, which job builds it, and when a reader last used it (retention).
    The archive itself is the authority on its stages; ``stages`` mirrors it
    for listings and the backfill. Bundles are stored per project, so two
    projects whose revisions have the same content (a repository imported
    twice) have one row each under the same bundle key."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_design_bundles (
            project_id       TEXT NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
            bundle_key       TEXT NOT NULL CHECK (bundle_key ~ '^[0-9a-f]{64}$'),
            revision_key     TEXT NOT NULL CHECK (revision_key ~ '^[0-9a-f]{64}$'),
            generator_digest TEXT NOT NULL CHECK (generator_digest ~ '^[0-9a-f]{64}$'),
            commit_sha       TEXT,
            state            TEXT NOT NULL DEFAULT 'queued'
                             CHECK (state IN ('queued', 'building', 'complete', 'failed')),
            stages           JSONB NOT NULL DEFAULT '{}'::jsonb,
            job_id           TEXT,
            error            TEXT NOT NULL DEFAULT '',
            archive_bytes    BIGINT NOT NULL DEFAULT 0,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (project_id, bundle_key),
            CONSTRAINT uq_ws_design_bundles_revision UNIQUE (project_id, revision_key, generator_digest)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ws_design_bundles_last_used ON ws_design_bundles(last_used_at)"
    )
