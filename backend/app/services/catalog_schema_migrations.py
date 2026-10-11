"""Versioned, additive migrations for the component catalog schema.

The workspace schema has carried a migration ladder since it was introduced.
The catalog instead had a single version string, and an installation whose
database did not carry that exact string was told at startup to run
``scripts/reset_prism_postgres.py`` with destructive confirmation. That made the
first catalog schema change in any release equivalent to discarding every
component, revision, release record, review decision and asset row on the
installation -- and it would have surfaced for the first time on somebody's
production database, mid-upgrade, after the old stack had already been stopped.

Migrations here follow the same contract as every other schema
(:mod:`app.services.schema_ledger`): numbered, additive and idempotent, applied
once under the catalog's advisory lock and recorded in
``catalog_schema_versions``. An upgrade may only add. Anything that removes or
narrows waits for a later release, once the version that needed it is out of
support, so that rolling the application back does not require restoring data.

Derived state stays out of this ladder on purpose. The component-head
projections, search indexes and integrity guards are rebuilt whenever their
definition version changes, which a run-once ledger cannot express; they keep
their own version markers in ``catalog_meta``. The catalog's baseline (the
epoch guard, ``create_base_schema`` and the metadata registry seed) also runs on
every start, ahead of these steps, from
``ComponentCatalogPostgresService.initialize``: the projections the first step
widens are part of that baseline.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.services.schema_ledger import Ledger, Renumbered, Step


Migration = Callable[[Any], None]

# Bumping this rewrites the listed columns, so a database that already carries
# the marker must not be made to do the work again.
PORTABLE_TYPES_MARKER = "postgres_portable_types_version"
PORTABLE_TYPES_VERSION = "catalog-portable-types-v1"


def _portable_column_types(conn: Any) -> None:
    """Widen columns whose original types came from the SQLite-era schema.

    Catalog storage started on SQLite, where a column's declared type is close
    to advisory. PostgreSQL is not so forgiving: stock quantities need to hold
    fractional values, byte counts and audit sequences overflow a 32-bit
    integer, and OAuth expiry timestamps are seconds since the epoch.
    """
    for table, column, target in (
        ("component_heads", "stock_quantity", "DOUBLE PRECISION"),
        ("remote_component_heads", "stock_quantity", "DOUBLE PRECISION"),
        ("assets", "size_bytes", "BIGINT"),
        ("asset_preview_versions", "size_bytes", "BIGINT"),
        ("catalog_audit_events", "sequence", "BIGINT"),
        ("oauth_auth_codes", "exp", "BIGINT"),
        ("oauth_revoked_tokens", "exp", "BIGINT"),
    ):
        conn.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE {target} USING {column}::{target}"
        )
    conn.execute(
        """
        INSERT INTO catalog_meta (key, value)
        VALUES (%s, %s)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (PORTABLE_TYPES_MARKER, PORTABLE_TYPES_VERSION),
    )


def _import_proposal_draft_column(conn: Any) -> None:
    """Keep in-progress import remediation edits across a page reload."""
    conn.execute(
        "ALTER TABLE project_component_import_proposals "
        "ADD COLUMN IF NOT EXISTS draft_json TEXT NOT NULL DEFAULT '{}'"
    )


def _component_kinds(conn: Any) -> None:
    """System Builder P2 (CONTRACTS_P2 §3): ``part`` | ``module`` | ``assembly``.

    Every existing component is a ``part``. Module and assembly revisions carry
    their connector ``interface`` and (assemblies) the ``source_ref`` of the
    system snapshot they were published from, both as JSON text like the rest
    of the catalog's JSON columns.
    """
    conn.execute(
        "ALTER TABLE components ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'part'"
    )
    conn.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'components_kind_check'
            ) THEN
                ALTER TABLE components
                    ADD CONSTRAINT components_kind_check CHECK (kind IN ('part', 'module', 'assembly'));
            END IF;
        END $$
        """
    )
    conn.execute(
        "ALTER TABLE component_revisions ADD COLUMN IF NOT EXISTS interface_json TEXT NOT NULL DEFAULT '{}'"
    )
    conn.execute(
        "ALTER TABLE component_revisions ADD COLUMN IF NOT EXISTS source_ref_json TEXT NOT NULL DEFAULT '{}'"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS components_kind_idx ON components (kind)")


def _mates_with(conn: Any) -> None:
    """System Builder P2 (CONTRACTS_P2 §18): parts that mate, stored once per pair with ``part_a < part_b``."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_mates_with (
            part_a     TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            part_b     TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            created_by TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            PRIMARY KEY (part_a, part_b),
            CHECK (part_a < part_b)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS catalog_mates_with_b_idx ON catalog_mates_with (part_b)")


def _model_glb(conn: Any) -> None:
    """System Builder P2 (CONTRACTS_P2 §18.2): GLBs converted from STEP models, and per-part model alignment.

    A GLB is cached by ``key`` = sha256(STEP sha256 + converter), so it is shared by every part that
    carries the same STEP and replaced only when the converter changes.
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_model_glb (
            key         TEXT PRIMARY KEY,
            step_sha256 TEXT NOT NULL,
            converter   TEXT NOT NULL,
            glb_sha256  TEXT NOT NULL,
            glb_path    TEXT NOT NULL,
            bounds_json TEXT NOT NULL,
            materials   INTEGER NOT NULL,
            size_bytes  INTEGER NOT NULL,
            created_at  TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_model_alignment (
            component_id   TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            asset_id       TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
            alignment_json TEXT NOT NULL,
            updated_by     TEXT NOT NULL DEFAULT '',
            updated_at     TEXT NOT NULL,
            PRIMARY KEY (component_id, asset_id)
        )
        """
    )


def _agent_tokens_registry(conn: Any) -> None:
    """Track issued KiCad agent sign-in tokens so they can be listed and revoked.

    The token value is never stored; the jti is the handle the revocation list
    keys on when a row is revoked from the web console.
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_tokens (
            jti TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT '',
            scopes TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            last_used_at TEXT,
            revoked_at TEXT
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS agent_tokens_email_idx ON agent_tokens (email)"
    )


def _module_connectors(conn: Any) -> None:
    """System Builder P2 (CONTRACTS_P2 §3.6): the connector part placed for each unit of a module's symbol.

    Keyed by the unit's letter like model alignment is keyed by asset: a placement belongs to the
    component, not to a revision.
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS catalog_module_connectors (
            component_id   TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            unit_key       TEXT NOT NULL,
            part_id        TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            placement_json TEXT NOT NULL,
            updated_by     TEXT NOT NULL DEFAULT '',
            updated_at     TEXT NOT NULL,
            PRIMARY KEY (component_id, unit_key)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS catalog_module_connectors_part_idx ON catalog_module_connectors (part_id)")


def _revision_assets_asset_index(conn: Any) -> None:
    """Retention's reverse lookup, asset -> revision, without scanning every revision link.

    ``LocalArtifactStore`` created this on every start before the single ledger,
    so most databases already have it.
    """
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_revision_assets_asset "
        "ON revision_assets(asset_id, revision_id)"
    )


MIGRATIONS: tuple[tuple[int, str, Migration], ...] = (
    (1, "portable_column_types", _portable_column_types),
    (2, "import_proposal_draft_column", _import_proposal_draft_column),
    (3, "component_kinds", _component_kinds),
    (4, "mates_with", _mates_with),
    (5, "model_glb", _model_glb),
    (6, "agent_tokens_registry", _agent_tokens_registry),
    (7, "module_connectors", _module_connectors),
    (8, "revision_assets_asset_index", _revision_assets_asset_index),
)

# Migrations that a long-lived branch database recorded under an earlier number.
# The ledger keys on version, so without this the old row would hide another
# migration's version and the new one would fail on the unique name.
RENUMBERED: tuple[tuple[str, int, int], ...] = (
    ("agent_tokens_registry", 3, 6),
)


def _adopt_legacy_markers(conn: Any) -> set[int]:
    """Record work an earlier Prism already did outside the ledger.

    Both migrations below predate this module and ran on every startup, guarded
    by their own marker or by ``IF NOT EXISTS``. Re-running the column widening
    would rewrite whole tables for nothing, so an installation that already
    carries its marker is credited with the migration instead.
    """
    adopted: set[int] = set()
    marker = conn.execute(
        "SELECT value FROM catalog_meta WHERE key = %s",
        (PORTABLE_TYPES_MARKER,),
    ).fetchone()
    if marker and str(marker["value"]) == PORTABLE_TYPES_VERSION:
        adopted.add(1)
    return adopted


CATALOG_LEDGER = Ledger(
    name="catalog",
    schema="catalog",
    table="catalog_schema_versions",
    steps=tuple(Step(version, name, body) for version, name, body in MIGRATIONS),
    # Catalog jobs and the reset/survivor scripts take this lock; keep it.
    lock="prism-component-catalog-schema",
    renumbered=tuple(Renumbered(name, old, new) for name, old, new in RENUMBERED),
    adopt=_adopt_legacy_markers,
)


def apply_catalog_migrations(conn: Any) -> list[int]:
    """Apply versioned, additive catalog migrations under the caller's lock."""
    return CATALOG_LEDGER.apply(conn)


def pending_catalog_migrations(conn: Any) -> list[tuple[int, str]]:
    """Migrations this build would really run, for reporting before an upgrade."""
    return CATALOG_LEDGER.pending(conn)
