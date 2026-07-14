from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from app.core.config import settings
from app.services.component_catalog_domain import ComponentCatalogDomainService
from app.services.postgres_database import database


POSTGRES_SCHEMA_VERSION = "catalog-postgres-v6"
POSTGRES_SEARCH_VERSION = "catalog-search-v1"
POSTGRES_INTEGRITY_GUARDS_VERSION = "catalog-integrity-guards-v3"

def _postgres_dsn(value: str) -> str:
    """Accept both native and SQLAlchemy-style psycopg URLs."""
    return value.strip().replace("postgresql+psycopg://", "postgresql://", 1)


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


class _CatalogConnection:
    """Native psycopg connection with the domain's DDL-script convenience API."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    def execute(self, sql: str, params: Any = None) -> Any:
        return self._connection.execute(sql, params, prepare=False)

    def executescript(self, script: str) -> None:
        for statement in _split_sql_script(script):
            self.execute(statement)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()


class ComponentCatalogPostgresService(ComponentCatalogDomainService):
    """PostgreSQL-backed catalog with the existing stable domain/API contract.

    The file store remains content-addressed on the shared projects volume. PostgreSQL
    owns identities, revisions, workflow, usage, review, and audit state.
    """

    def __init__(self, store_root: Path | None = None, database_url: str | None = None) -> None:
        self._postgres_url = _postgres_dsn(database_url or settings.PRISM_DATABASE_URL)
        if not self._postgres_url:
            raise ValueError("PRISM_DATABASE_URL is required for PostgreSQL catalog storage")
        super().__init__(store_root=store_root, database_url="postgres")

    def _database_path(self, database_url: str | None) -> Path:
        # Retained only for the legacy service's diagnostic property. PostgreSQL does
        # not use this path and no data is written here.
        _ = database_url
        return Path("/dev/null")

    @contextmanager
    def _connect(self) -> Iterator[_CatalogConnection]:
        with database.connection() as connection:
            connection.execute("SET search_path TO catalog, public")
            yield _CatalogConnection(connection)

    def initialize(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self._ensure_storage_dirs()
            with self._connect() as conn:
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(%s))",
                    ("prism-component-catalog-schema",),
                ).fetchone()
                conn.execute("CREATE SCHEMA IF NOT EXISTS catalog")
                conn.execute("SET search_path TO catalog, public")
                existing = conn.execute(
                    "SELECT to_regclass('catalog.components') AS relation"
                ).fetchone()
                if not existing or not existing["relation"]:
                    self._create_schema(conn)
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
                    self._ensure_metadata_schema(conn)
                    conn.execute(
                        """
                        INSERT INTO catalog_schema_migrations (version, applied_at)
                        VALUES (%s, CURRENT_TIMESTAMP::text)
                        ON CONFLICT (version) DO NOTHING
                        """,
                        (POSTGRES_SCHEMA_VERSION,),
                    )
                else:
                    version = conn.execute(
                        "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = %s",
                        (POSTGRES_SCHEMA_VERSION,),
                    ).fetchone()
                    if not version:
                        raise RuntimeError(
                            "Catalog schema predates the PostgreSQL reset architecture. "
                            "Run scripts/reset_prism_postgres.py with destructive confirmation."
                        )
                conn.commit()
            self._ensure_postgres_search_indexes()
            self._ensure_postgres_integrity_guards()
            self._fts_available = False
            self._initialized = True

    def _ensure_postgres_search_indexes(self) -> None:
        # Trigram search keeps the existing forgiving catalog query behavior while
        # avoiding full scans at tens of thousands of components. Extension creation
        # can be disallowed on managed databases, so degrade to ordinary indexes.
        with self._connect() as conn:
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))",
                ("prism-component-catalog-search",),
            ).fetchone()
            marker = conn.execute(
                "SELECT value FROM catalog_meta WHERE key = %s",
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
                    INSERT INTO catalog_meta (key, value) VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    ("postgres_search_version", POSTGRES_SEARCH_VERSION),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(%s))",
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
                    INSERT INTO catalog_meta (key, value) VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    ("postgres_search_version", POSTGRES_SEARCH_VERSION),
                )
                conn.commit()

    def _ensure_postgres_integrity_guards(self) -> None:
        with self._connect() as conn:
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))",
                ("prism-component-catalog-integrity-guards",),
            ).fetchone()
            marker = conn.execute(
                "SELECT value FROM catalog_meta WHERE key = %s",
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
                    WHERE tgname = %s AND tgrelid = to_regclass(%s) AND NOT tgisinternal
                    """,
                    (trigger_name, f"catalog.{table}"),
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
                  AND tgrelid = to_regclass('catalog.assets')
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
                  AND tgrelid = to_regclass('catalog.component_revisions')
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
                  AND tgrelid = to_regclass('catalog.revision_previews')
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
                  AND tgrelid = to_regclass('catalog.revision_assets')
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
                INSERT INTO catalog_meta (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                ("postgres_integrity_guards_version", POSTGRES_INTEGRITY_GUARDS_VERSION),
            )
            conn.commit()

    def _clone_revision(self, conn: Any, component_id: str, **kwargs: Any) -> dict[str, Any]:
        # Serialize version allocation and head updates per component. The unique
        # (component_id, version) constraint remains the final invariant.
        conn.execute("SELECT id FROM components WHERE id = %s FOR UPDATE", (component_id,)).fetchone()
        return super()._clone_revision(conn, component_id, **kwargs)

    def _lock_component_for_mutation(self, conn: Any, component_id: str) -> None:
        conn.execute("SELECT id FROM components WHERE id = %s FOR UPDATE", (component_id,)).fetchone()

    def _append_audit_event(self, conn: Any, *, component_id: str, **kwargs: Any) -> None:
        # Prevent audit forks when independent workflow/import requests arrive at once.
        conn.execute("SELECT id FROM components WHERE id = %s FOR UPDATE", (component_id,)).fetchone()
        super()._append_audit_event(conn, component_id=component_id, **kwargs)

    def _unique_slug(self, conn: Any, base: str) -> str:
        # Stable transaction-scoped advisory lock eliminates concurrent slug races.
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"catalog-slug:{base}",)).fetchone()
        return super()._unique_slug(conn, base)

    def _lock_component_identity(self, conn: Any, manufacturer: str, mpn: str) -> None:
        normalized = f"{manufacturer.strip().casefold()}\n{mpn.strip().casefold()}"
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))",
            (f"catalog-component-identity:{normalized}",),
        ).fetchone()

    def close(self) -> None:
        with self._lock:
            self._initialized = False


__all__ = [
    "ComponentCatalogPostgresService",
    "_postgres_dsn",
    "_split_sql_script",
    "POSTGRES_SCHEMA_VERSION",
]
