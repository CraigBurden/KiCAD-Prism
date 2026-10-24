"""Workspace schema migration 56: release_studio_model_inputs.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """Keep each candidate's 3D model inputs and the acknowledgements they need.

    ``ws_release_model_inputs`` holds one row per model reference a
    candidate's closure resolved: where it resolved and, for a host model, the
    sha256 the build pinned.  ``self_contained`` is true when the build reads
    nothing outside the commit and the pinned toolchain; NULL on candidates
    made before it was recorded.  An approval or publish of a build whose
    models are not all pinned records the model keys it acknowledged.
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ws_release_model_inputs (
            id              TEXT PRIMARY KEY,
            candidate_id    TEXT NOT NULL
                            REFERENCES ws_release_candidates(id) ON DELETE CASCADE,
            source_path     TEXT NOT NULL,
            reference       TEXT NOT NULL,
            location        TEXT NOT NULL,
            resolved_path   TEXT NOT NULL DEFAULT '',
            digest          TEXT NOT NULL DEFAULT '',
            advisory        BOOLEAN NOT NULL DEFAULT FALSE,
            CONSTRAINT uq_ws_release_model_inputs_reference
                UNIQUE (candidate_id, source_path, reference)
        )
        """
    )
    conn.execute(
        """
        ALTER TABLE ws_release_candidates
            ADD COLUMN IF NOT EXISTS self_contained BOOLEAN
        """
    )
    conn.execute(
        """
        ALTER TABLE ws_release_review_decisions
            ADD COLUMN IF NOT EXISTS acknowledged_models JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )
    conn.execute(
        """
        ALTER TABLE ws_release_publish_records
            ADD COLUMN IF NOT EXISTS acknowledged_models JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )
