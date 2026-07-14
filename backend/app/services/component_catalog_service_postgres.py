from __future__ import annotations

import re
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Sequence

from app.core.config import settings
from app.services.component_catalog_service_sqlite import ComponentCatalogService


POSTGRES_SCHEMA_VERSION = "catalog-postgres-v6"
POSTGRES_SEARCH_VERSION = "catalog-search-v1"
POSTGRES_INTEGRITY_GUARDS_VERSION = "catalog-integrity-guards-v3"

def _postgres_dsn(value: str) -> str:
    """Accept both native and SQLAlchemy-style psycopg URLs."""
    return value.strip().replace("postgresql+psycopg://", "postgresql://", 1)


def _translate_qmark_sql(sql: str) -> str:
    """Translate sqlite qmark parameters without touching quoted SQL text."""
    translated: list[str] = []
    quote = ""
    index = 0
    while index < len(sql):
        char = sql[index]
        if quote:
            translated.append(char)
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    translated.append(sql[index + 1])
                    index += 1
                else:
                    quote = ""
        elif char in {"'", '"'}:
            quote = char
            translated.append(char)
        elif char == "?":
            translated.append("%s")
        else:
            translated.append(char)
        index += 1
    return "".join(translated)


def _translate_postgres_sql(sql: str) -> str:
    # The runtime only uses SQLite's REPLACE spelling for the single-row audit
    # anchor. Preserve its upsert semantics explicitly in PostgreSQL.
    sql = re.sub(
        r"INSERT\s+OR\s+REPLACE\s+INTO\s+catalog_meta\s*"
        r"\(\s*key\s*,\s*value\s*\)\s*VALUES\s*\(\s*\?\s*,\s*\?\s*\)",
        "INSERT INTO catalog_meta (key, value) VALUES (?, ?) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if re.search(r"INSERT\s+OR\s+IGNORE\s+INTO", sql, flags=re.IGNORECASE):
        sql = re.sub(
            r"INSERT\s+OR\s+IGNORE\s+INTO",
            "INSERT INTO",
            sql,
            count=1,
            flags=re.IGNORECASE,
        ).rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
    return _translate_qmark_sql(sql)


def _split_sql_script(script: str) -> list[str]:
    """Split the catalog's simple DDL script while respecting quoted strings."""
    statements: list[str] = []
    current: list[str] = []
    quote = ""
    index = 0
    while index < len(script):
        char = script[index]
        if quote:
            current.append(char)
            if char == quote:
                if index + 1 < len(script) and script[index + 1] == quote:
                    current.append(script[index + 1])
                    index += 1
                else:
                    quote = ""
        elif char in {"'", '"'}:
            quote = char
            current.append(char)
        elif char == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)
        index += 1
    statement = "".join(current).strip()
    if statement:
        statements.append(statement)
    return statements


class _PostgresCompatConnection:
    """Small DB-API adapter that lets the proven catalog domain use psycopg."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    def execute(self, sql: str, params: Sequence[Any] | None = None) -> Any:
        return self._connection.execute(
            _translate_postgres_sql(sql),
            tuple(params or ()),
            prepare=False,
        )

    def executescript(self, script: str) -> None:
        for statement in _split_sql_script(script):
            self.execute(statement)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()


class ComponentCatalogPostgresService(ComponentCatalogService):
    """PostgreSQL-backed catalog with the existing stable domain/API contract.

    The file store remains content-addressed on the shared projects volume. PostgreSQL
    owns identities, revisions, workflow, usage, review, and audit state.
    """

    def __init__(self, store_root: Path | None = None, database_url: str | None = None) -> None:
        self._postgres_url = _postgres_dsn(database_url or settings.CATALOG_DATABASE_URL)
        if not self._postgres_url:
            raise ValueError("CATALOG_DATABASE_URL is required for PostgreSQL catalog storage")
        self._pool: Any = None
        self._pool_lock = threading.Lock()
        super().__init__(store_root=store_root, database_url="postgres")

    def _database_path(self, database_url: str | None) -> Path:
        # Retained only for the legacy service's diagnostic property. PostgreSQL does
        # not use this path and no data is written here.
        _ = database_url
        return Path("/dev/null")

    def _ensure_pool(self) -> Any:
        if self._pool is not None:
            return self._pool
        with self._pool_lock:
            if self._pool is None:
                try:
                    from psycopg.rows import dict_row
                    from psycopg_pool import ConnectionPool
                except ImportError as exc:  # pragma: no cover - deployment dependency guard
                    raise RuntimeError(
                        "PostgreSQL catalog support requires psycopg and psycopg-pool"
                    ) from exc
                pool = ConnectionPool(
                    conninfo=self._postgres_url,
                    min_size=settings.CATALOG_DATABASE_POOL_MIN_SIZE,
                    max_size=settings.CATALOG_DATABASE_POOL_MAX_SIZE,
                    kwargs={"row_factory": dict_row, "autocommit": False},
                    open=False,
                    name="prism-component-catalog",
                )
                pool.open(wait=True)
                self._pool = pool
        return self._pool

    @contextmanager
    def _connect(self) -> Iterator[_PostgresCompatConnection]:
        pool = self._ensure_pool()
        with pool.connection() as connection:
            yield _PostgresCompatConnection(connection)

    def initialize(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self._ensure_storage_dirs()
            with self._connect() as conn:
                # Only one worker may initialize or upgrade the catalog schema. Normal
                # worker startup is a version read, not a full DDL replay.
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(?))",
                    ("prism-component-catalog-schema",),
                ).fetchone()
                existing = conn.execute(
                    "SELECT to_regclass('public.components') AS relation"
                ).fetchone()
                if not existing or not existing["relation"]:
                    self._create_schema(conn)  # Portable bootstrap DDL.
                    conn.execute(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_component_sequence "
                        "ON catalog_audit_events(component_id, sequence)"
                    )
                    conn.execute(
                        "CREATE INDEX IF NOT EXISTS idx_component_usage_current "
                        "ON component_usage(component_id, is_current, last_seen_at DESC)"
                    )
                    conn.execute(
                        """
                        CREATE TABLE IF NOT EXISTS catalog_schema_migrations (
                            version TEXT PRIMARY KEY,
                            applied_at TEXT NOT NULL
                        )
                        """
                    )
                    self._migrate_workflow_stages(conn)
                    self._upgrade_postgres_v5(conn)
                    self._ensure_metadata_schema(conn)
                    conn.execute(
                        """
                        INSERT INTO catalog_schema_migrations (version, applied_at)
                        VALUES (?, CURRENT_TIMESTAMP::text)
                        ON CONFLICT (version) DO NOTHING
                        """,
                        (POSTGRES_SCHEMA_VERSION,),
                    )
                else:
                    migration_table = conn.execute(
                        "SELECT to_regclass('public.catalog_schema_migrations') AS relation"
                    ).fetchone()
                    if not migration_table or not migration_table["relation"]:
                        raise RuntimeError(
                            "PostgreSQL catalog schema is unversioned; run the catalog migration command"
                        )
                    version = conn.execute(
                        "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                        (POSTGRES_SCHEMA_VERSION,),
                    ).fetchone()
                    if not version:
                        version_v5 = conn.execute(
                            "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                            ("catalog-postgres-v5",),
                        ).fetchone()
                        version_v4 = conn.execute(
                            "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                            ("catalog-postgres-v4",),
                        ).fetchone()
                        version_v3 = conn.execute(
                            "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                            ("catalog-postgres-v3",),
                        ).fetchone()
                        version_v2 = conn.execute(
                            "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                            ("catalog-postgres-v2",),
                        ).fetchone()
                        version_v1 = conn.execute(
                            "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = ?",
                            ("catalog-postgres-v1",),
                        ).fetchone()
                        if not version_v1 and not version_v2 and not version_v3 and not version_v4 and not version_v5:
                            raise RuntimeError(
                                f"PostgreSQL catalog schema is not at required version {POSTGRES_SCHEMA_VERSION}"
                            )
                        if not version_v2:
                            conn.execute(
                                "ALTER TABLE component_usage ADD COLUMN IF NOT EXISTS details_json TEXT NOT NULL DEFAULT '[]'"
                            )
                            conn.execute(
                                "ALTER TABLE component_usage ADD COLUMN IF NOT EXISTS is_current INTEGER NOT NULL DEFAULT 1"
                            )
                            conn.execute(
                                "CREATE INDEX IF NOT EXISTS idx_component_usage_current "
                                "ON component_usage(component_id, is_current, last_seen_at DESC)"
                            )
                            conn.execute(
                                """
                                INSERT INTO catalog_schema_migrations (version, applied_at)
                                VALUES (?, CURRENT_TIMESTAMP::text)
                                ON CONFLICT (version) DO NOTHING
                                """,
                                ("catalog-postgres-v2",),
                            )
                        component_sync_columns = {
                            "external_url": "TEXT NOT NULL DEFAULT ''",
                            "external_payload_json": "TEXT NOT NULL DEFAULT '{}'",
                            "external_updated_at": "TEXT",
                            "sync_status": "TEXT NOT NULL DEFAULT ''",
                            "sync_error": "TEXT NOT NULL DEFAULT ''",
                        }
                        for column, declaration in component_sync_columns.items():
                            conn.execute(
                                f"ALTER TABLE components ADD COLUMN IF NOT EXISTS {column} {declaration}"
                            )
                        self._upgrade_postgres_v5(conn)
                        self._ensure_metadata_schema(conn)
                        conn.execute(
                            """
                            INSERT INTO catalog_schema_migrations (version, applied_at)
                            VALUES (?, CURRENT_TIMESTAMP::text)
                            ON CONFLICT (version) DO NOTHING
                            """,
                            (POSTGRES_SCHEMA_VERSION,),
                        )
                conn.commit()
            self._ensure_postgres_search_indexes()
            self._ensure_postgres_integrity_guards()
            self._fts_available = False
            self._initialized = True

    def _upgrade_postgres_v5(self, conn: _PostgresCompatConnection) -> None:
        conn.execute(
            "ALTER TABLE component_revisions ADD COLUMN IF NOT EXISTS manifest_schema "
            "TEXT NOT NULL DEFAULT 'prism.revision_manifest_a0'"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS asset_preview_versions (
                id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL REFERENCES assets(id),
                kind TEXT NOT NULL,
                status TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'image/svg+xml',
                file_path TEXT NOT NULL DEFAULT '',
                sha256 TEXT NOT NULL DEFAULT '',
                size_bytes BIGINT NOT NULL DEFAULT 0,
                generator_name TEXT NOT NULL DEFAULT '',
                generator_version TEXT NOT NULL DEFAULT '',
                pipeline_version TEXT NOT NULL DEFAULT '',
                generator_fingerprint TEXT NOT NULL DEFAULT '',
                generation_error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(asset_id, kind, sha256, generator_fingerprint)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS revision_previews (
                revision_id TEXT NOT NULL REFERENCES component_revisions(id) ON DELETE CASCADE,
                asset_id TEXT NOT NULL REFERENCES assets(id),
                kind TEXT NOT NULL,
                preview_id TEXT NOT NULL REFERENCES asset_preview_versions(id),
                created_at TEXT NOT NULL,
                PRIMARY KEY(revision_id, asset_id, kind)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS revision_preview_outputs (
                revision_id TEXT NOT NULL REFERENCES component_revisions(id) ON DELETE CASCADE,
                asset_id TEXT NOT NULL REFERENCES assets(id),
                kind TEXT NOT NULL,
                preview_id TEXT NOT NULL REFERENCES asset_preview_versions(id),
                generated_at TEXT NOT NULL,
                PRIMARY KEY(revision_id, asset_id, kind)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_asset_preview_versions_asset "
            "ON asset_preview_versions(asset_id, kind, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_revision_previews_revision "
            "ON revision_previews(revision_id, kind)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_revision_preview_outputs_revision "
            "ON revision_preview_outputs(revision_id, kind)"
        )
        conn.execute(
            "ALTER TABLE components ALTER COLUMN stock_quantity TYPE DOUBLE PRECISION "
            "USING stock_quantity::DOUBLE PRECISION"
        )
        for table, column in (
            ("assets", "size_bytes"),
            ("catalog_audit_events", "sequence"),
            ("oauth_auth_codes", "exp"),
            ("oauth_revoked_tokens", "exp"),
        ):
            conn.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} TYPE BIGINT USING {column}::BIGINT"
            )
        # Older deployments already protect finalized revision evidence. The
        # idempotent legacy-preview backfill is a schema migration and must run
        # within the explicit migration fence on this initialization connection.
        conn.execute("SELECT set_config('prism.catalog_migration', 'on', true)")
        self._backfill_legacy_preview_versions(conn)

    def _ensure_postgres_search_indexes(self) -> None:
        # Trigram search keeps the existing forgiving catalog query behavior while
        # avoiding full scans at tens of thousands of components. Extension creation
        # can be disallowed on managed databases, so degrade to ordinary indexes.
        with self._connect() as conn:
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext(?))",
                ("prism-component-catalog-search",),
            ).fetchone()
            marker = conn.execute(
                "SELECT value FROM catalog_meta WHERE key = ?",
                ("postgres_search_version",),
            ).fetchone()
            if marker and str(marker["value"]) == POSTGRES_SEARCH_VERSION:
                conn.commit()
                return
            try:
                conn.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_revisions_search_trgm "
                    "ON component_revisions USING GIN (lower(search_document) gin_trgm_ops)"
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_revisions_mpn_trgm "
                    "ON component_revisions USING GIN (lower(mpn) gin_trgm_ops)"
                )
                conn.execute(
                    """
                    INSERT INTO catalog_meta (key, value) VALUES (?, ?)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    ("postgres_search_version", POSTGRES_SEARCH_VERSION),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(?))",
                    ("prism-component-catalog-search",),
                ).fetchone()
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_revisions_search_lower "
                    "ON component_revisions(lower(search_document))"
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_revisions_mpn_lower "
                    "ON component_revisions(lower(mpn))"
                )
                conn.execute(
                    """
                    INSERT INTO catalog_meta (key, value) VALUES (?, ?)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    ("postgres_search_version", POSTGRES_SEARCH_VERSION),
                )
                conn.commit()

    def _ensure_postgres_integrity_guards(self) -> None:
        with self._connect() as conn:
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext(?))",
                ("prism-component-catalog-integrity-guards",),
            ).fetchone()
            marker = conn.execute(
                "SELECT value FROM catalog_meta WHERE key = ?",
                ("postgres_integrity_guards_version",),
            ).fetchone()
            if marker and str(marker["value"]) == POSTGRES_INTEGRITY_GUARDS_VERSION:
                conn.commit()
                return
            conn.execute(
                """
                CREATE OR REPLACE FUNCTION prism_reject_catalog_evidence_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'immutable catalog evidence cannot be updated or deleted';
                END;
                $$
                """
            )
            guarded_tables = {
                "catalog_audit_events": "UPDATE OR DELETE",
                "component_review_decisions": "UPDATE OR DELETE",
                "component_release_records": "UPDATE OR DELETE",
                "components": "DELETE",
                "component_revisions": "DELETE",
                "asset_previews": "UPDATE OR DELETE",
                "asset_preview_versions": "UPDATE OR DELETE",
            }
            for table, operations in guarded_tables.items():
                trigger_name = f"trg_{table}_immutable"
                exists = conn.execute(
                    """
                    SELECT 1 AS present
                    FROM pg_trigger
                    WHERE tgname = ? AND tgrelid = to_regclass(?) AND NOT tgisinternal
                    """,
                    (trigger_name, f"public.{table}"),
                ).fetchone()
                if not exists:
                    conn.execute(
                        f"CREATE TRIGGER {trigger_name} BEFORE {operations} ON {table} "
                        "FOR EACH ROW EXECUTE FUNCTION prism_reject_catalog_evidence_mutation()"
                    )
            conn.execute(
                """
                CREATE OR REPLACE FUNCTION prism_guard_revision_preview_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    guarded_revision_id TEXT;
                    parent_manifest_hash TEXT;
                BEGIN
                    IF current_setting('prism.catalog_migration', true) = 'on' THEN
                        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                    END IF;
                    guarded_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
                    SELECT manifest_hash INTO parent_manifest_hash
                    FROM component_revisions revision
                    WHERE revision.id = guarded_revision_id;
                    IF COALESCE(parent_manifest_hash, '') <> '' THEN
                        RAISE EXCEPTION 'finalized revision preview evidence is immutable';
                    END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$
                """
            )
            conn.execute(
                """
                CREATE OR REPLACE FUNCTION prism_guard_finalized_revision_update()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    IF current_setting('prism.catalog_migration', true) = 'on' THEN
                        RETURN NEW;
                    END IF;
                    IF COALESCE(OLD.manifest_hash, '') <> ''
                       AND (to_jsonb(NEW) - ARRAY['release_status', 'updated_at'])
                           IS DISTINCT FROM
                           (to_jsonb(OLD) - ARRAY['release_status', 'updated_at']) THEN
                        RAISE EXCEPTION 'finalized component revision evidence is immutable';
                    END IF;
                    RETURN NEW;
                END;
                $$
                """
            )
            conn.execute(
                """
                CREATE OR REPLACE FUNCTION prism_guard_asset_identity_update()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    IF current_setting('prism.catalog_migration', true) = 'on' THEN
                        RETURN NEW;
                    END IF;
                    IF (to_jsonb(NEW) - ARRAY['name', 'canonical_path', 'size_bytes', 'content_type', 'updated_at'])
                       IS DISTINCT FROM
                       (to_jsonb(OLD) - ARRAY['name', 'canonical_path', 'size_bytes', 'content_type', 'updated_at']) THEN
                        RAISE EXCEPTION 'immutable asset identity or content hash cannot be changed';
                    END IF;
                    RETURN NEW;
                END;
                $$
                """
            )
            asset_update_trigger = conn.execute(
                """
                SELECT 1 AS present
                FROM pg_trigger
                WHERE tgname = 'trg_assets_identity_update'
                  AND tgrelid = to_regclass('public.assets')
                  AND NOT tgisinternal
                """
            ).fetchone()
            if not asset_update_trigger:
                conn.execute(
                    "CREATE TRIGGER trg_assets_identity_update BEFORE UPDATE ON assets "
                    "FOR EACH ROW EXECUTE FUNCTION prism_guard_asset_identity_update()"
                )
            revision_update_trigger = conn.execute(
                """
                SELECT 1 AS present
                FROM pg_trigger
                WHERE tgname = 'trg_component_revisions_finalized_update'
                  AND tgrelid = to_regclass('public.component_revisions')
                  AND NOT tgisinternal
                """
            ).fetchone()
            if not revision_update_trigger:
                conn.execute(
                    "CREATE TRIGGER trg_component_revisions_finalized_update "
                    "BEFORE UPDATE ON component_revisions "
                    "FOR EACH ROW EXECUTE FUNCTION prism_guard_finalized_revision_update()"
                )
            revision_preview_trigger = conn.execute(
                """
                SELECT 1 AS present
                FROM pg_trigger
                WHERE tgname = 'trg_revision_previews_finalized'
                  AND tgrelid = to_regclass('public.revision_previews')
                  AND NOT tgisinternal
                """
            ).fetchone()
            if not revision_preview_trigger:
                conn.execute(
                    "CREATE TRIGGER trg_revision_previews_finalized "
                    "BEFORE INSERT OR UPDATE OR DELETE ON revision_previews "
                    "FOR EACH ROW EXECUTE FUNCTION prism_guard_revision_preview_mutation()"
                )
            revision_asset_trigger = conn.execute(
                """
                SELECT 1 AS present
                FROM pg_trigger
                WHERE tgname = 'trg_revision_assets_finalized'
                  AND tgrelid = to_regclass('public.revision_assets')
                  AND NOT tgisinternal
                """
            ).fetchone()
            if not revision_asset_trigger:
                conn.execute(
                    "CREATE TRIGGER trg_revision_assets_finalized "
                    "BEFORE INSERT OR UPDATE OR DELETE ON revision_assets "
                    "FOR EACH ROW EXECUTE FUNCTION prism_guard_revision_preview_mutation()"
                )
            conn.execute(
                """
                INSERT INTO catalog_meta (key, value) VALUES (?, ?)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                ("postgres_integrity_guards_version", POSTGRES_INTEGRITY_GUARDS_VERSION),
            )
            conn.commit()

    def _clone_revision(self, conn: Any, component_id: str, **kwargs: Any) -> dict[str, Any]:
        # Serialize version allocation and head updates per component. The unique
        # (component_id, version) constraint remains the final invariant.
        conn.execute("SELECT id FROM components WHERE id = ? FOR UPDATE", (component_id,)).fetchone()
        return super()._clone_revision(conn, component_id, **kwargs)

    def _lock_component_for_mutation(self, conn: Any, component_id: str) -> None:
        conn.execute("SELECT id FROM components WHERE id = ? FOR UPDATE", (component_id,)).fetchone()

    def _append_audit_event(self, conn: Any, *, component_id: str, **kwargs: Any) -> None:
        # Prevent audit forks when independent workflow/import requests arrive at once.
        conn.execute("SELECT id FROM components WHERE id = ? FOR UPDATE", (component_id,)).fetchone()
        super()._append_audit_event(conn, component_id=component_id, **kwargs)

    def _unique_slug(self, conn: Any, base: str) -> str:
        # Stable transaction-scoped advisory lock eliminates concurrent slug races.
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(?))", (f"catalog-slug:{base}",)).fetchone()
        return super()._unique_slug(conn, base)

    def _lock_component_identity(self, conn: Any, manufacturer: str, mpn: str) -> None:
        normalized = f"{manufacturer.strip().casefold()}\n{mpn.strip().casefold()}"
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(?))",
            (f"catalog-component-identity:{normalized}",),
        ).fetchone()

    def close(self) -> None:
        with self._lock:
            pool = self._pool
            self._pool = None
            self._initialized = False
        if pool is not None:
            pool.close()


__all__ = [
    "ComponentCatalogPostgresService",
    "_postgres_dsn",
    "_split_sql_script",
    "_translate_postgres_sql",
    "_translate_qmark_sql",
    "POSTGRES_SCHEMA_VERSION",
]
