"""Workspace schema migration 103: design_bundle_aliases.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """A revision key a stored bundle serves without being built for it
    (revision-key.md §10, ADR amendment K2 §3.3): one row pointing at the
    archive's ``bundle_key``. A row is written only after ``prism-kicad bundle
    reuse`` held for the key's record against that archive, and it is immutable;
    retention keeps the archive while any alias points to it."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_design_bundle_aliases (
            project_id       TEXT NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
            revision_key     TEXT NOT NULL CHECK (revision_key ~ '^[0-9a-f]{64}$'),
            algorithm        TEXT NOT NULL,
            generator_digest TEXT NOT NULL CHECK (generator_digest ~ '^[0-9a-f]{64}$'),
            bundle_key       TEXT NOT NULL CHECK (bundle_key ~ '^[0-9a-f]{64}$'),
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (project_id, revision_key, algorithm, generator_digest)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ws_design_bundle_aliases_bundle"
        " ON ws_design_bundle_aliases(project_id, bundle_key)"
    )
