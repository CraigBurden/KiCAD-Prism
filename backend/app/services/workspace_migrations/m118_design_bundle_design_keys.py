"""Workspace schema migration 118: design_bundle_design_keys.

Frozen. Applied deployments recorded this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """The bundle's design key (ADR amendment K2 §3.6): the semantic index's
    ``designKey``, recorded when stage parse publishes so comment anchors can
    compare designs without opening archives. Every revision key an alias
    points at the bundle has the same design key. ``NULL`` until the parse
    stage of a bundle built before this migration is read once."""

    conn.execute(
        "ALTER TABLE ws_design_bundles ADD COLUMN IF NOT EXISTS design_key TEXT"
        " CHECK (design_key ~ '^[0-9a-f]{64}$')"
    )
