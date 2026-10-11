"""A database deployed before the single migration ledger must reach head on its own.

Before AC-13 the workspace and comments ledgers had no baseline step, and the
auth, session, rate-limit and artifact tables were created by idempotent DDL
that ran on every start, outside any ledger. This seeds a database that way --
the auth and artifact tables from the DDL those services used to run, frozen
here -- puts rows in it, and starts the real startup entry point against it
twice, in a separate process exactly as the backend container does.

The fresh-database boot test at the bottom starts the same entry point against
an empty database.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

POSTGRES_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()
BACKEND = Path(__file__).resolve().parents[1]

# The DDL access_service, session_store_service, password_credential_service and
# rate_limit_service ran on every start, as an installation that predates the
# legacy-role mapping and the user_id columns left it.
OLD_AUTH_DDL = """
CREATE SCHEMA IF NOT EXISTS workspace;
SET search_path TO workspace, public;
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_roles (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'designer', 'viewer', 'qa', 'component_designer', 'component_qa')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);
CREATE TABLE user_sessions (
    session_digest TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    client_ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX user_sessions_email_idx ON user_sessions (email);
CREATE INDEX user_sessions_expires_idx ON user_sessions (expires_at);
CREATE TABLE auth_rate_limit (
    id BIGSERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_rate_limit_bucket_idx ON auth_rate_limit (bucket, occurred_at);
INSERT INTO user_roles (email, role, updated_by) VALUES
    ('legacy@example.com', 'component_designer', 'seed'),
    ('qa@example.com', 'component_qa', 'seed');
INSERT INTO user_sessions (session_digest, email, expires_at)
    VALUES ('digest-1', 'legacy@example.com', NOW() + INTERVAL '1 day');
INSERT INTO auth_rate_limit (bucket) VALUES ('login:seed');
"""

# What LocalArtifactStore.initialize() created under its own lock.
OLD_ARTIFACT_DDL = """
CREATE SCHEMA IF NOT EXISTS operations;
SET search_path TO operations, catalog, public;
CREATE TABLE catalog_artifacts (
    sha256 TEXT PRIMARY KEY,
    size_bytes BIGINT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    artifact_kind TEXT NOT NULL DEFAULT 'source',
    storage_state TEXT NOT NULL DEFAULT 'available',
    object_path TEXT NOT NULL,
    archived_path TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quarantined_at TIMESTAMPTZ,
    purged_at TIMESTAMPTZ
);
CREATE TABLE catalog_artifact_references (
    id TEXT PRIMARY KEY,
    artifact_sha256 TEXT NOT NULL REFERENCES catalog_artifacts(sha256),
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    released BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    UNIQUE(artifact_sha256, owner_type, owner_id, role)
);
INSERT INTO catalog_artifacts (sha256, size_bytes, object_path) VALUES ('aa11', 3, 'objects/aa11');
"""

# Workspace, comments and catalog as they stood: every numbered step applied and
# recorded, no baseline row. The services' own initialisers build that state.
SEED_LEDGERED_SCHEMAS = """
import os, sys
from pathlib import Path
from app.services.workspace_service import WorkspaceService
from app.services.comments_store_service import CommentsStoreService
from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService
from app.services.postgres_database import database

WorkspaceService().initialize()
CommentsStoreService().initialize()
ComponentCatalogPostgresService(store_root=Path(os.environ["KICAD_PROJECTS_ROOT"]) / "catalog").initialize()
with database.connection() as conn:
    conn.execute("DELETE FROM workspace.ws_schema_migrations WHERE version = 0")
    conn.execute("DELETE FROM comments.comment_schema_migrations WHERE version = 0")
    conn.execute("DELETE FROM catalog.catalog_schema_versions WHERE version = 0")
    conn.commit()
database.close()
"""

BOOT = """
from app.services.schema_head import bring_every_schema_to_head
from app.services.postgres_database import database

bring_every_schema_to_head()
database.close()
"""


@unittest.skipUnless(POSTGRES_URL, "PRISM_DATABASE_URL is required for schema adoption tests")
class SchemaLedgerAdoptionTests(unittest.TestCase):
    def setUp(self) -> None:
        import psycopg

        parts = urlsplit(POSTGRES_URL.replace("postgresql+psycopg://", "postgresql://", 1))
        self.name = f"{parts.path.lstrip('/')}_adopt"
        self.server = urlunsplit(parts._replace(path="/postgres"))
        with psycopg.connect(self.server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)')
            conn.execute(f'CREATE DATABASE "{self.name}"')
        self.dsn = urlunsplit(parts._replace(path=f"/{self.name}"))
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)

    def tearDown(self) -> None:
        import psycopg

        with psycopg.connect(self.server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)')

    def _run(self, script: str) -> None:
        env = {
            **os.environ,
            "PRISM_DATABASE_URL": self.dsn,
            "KICAD_PROJECTS_ROOT": self.temporary.name,
            "PYTHONPATH": str(BACKEND),
        }
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
            timeout=170,
        )
        self.assertEqual(result.returncode, 0, result.stderr[-4000:])

    def _sql(self, statement: str, params: tuple = ()) -> list[dict]:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(self.dsn, row_factory=dict_row) as conn:
            cursor = conn.execute(statement, params)
            rows = cursor.fetchall() if cursor.description else []
            conn.commit()
            return rows

    def _ledger(self, table: str) -> dict[int, str]:
        return {int(row["version"]): str(row["name"]) for row in self._sql(f"SELECT version, name FROM {table}")}

    def _expected(self, ledger) -> dict[int, str]:
        return {step.version: step.name for step in ledger.steps}

    def test_a_database_deployed_before_the_single_ledger_reaches_head_with_its_rows(self) -> None:
        from app.services.auth_schema_migrations import AUTH_LEDGER
        from app.services.artifact_schema_migrations import ARTIFACT_LEDGER
        from app.services.catalog_schema_migrations import CATALOG_LEDGER
        from app.services.comments_schema_migrations import COMMENTS_LEDGER
        from app.services.workspace_schema_migrations import WORKSPACE_LEDGER

        self._sql(OLD_AUTH_DDL)
        self._run(SEED_LEDGERED_SCHEMAS)
        self._sql(OLD_ARTIFACT_DDL)
        # Workspace triggers name their tables unqualified, as the backend's search path does.
        self._sql(
            "SET search_path TO workspace, public; INSERT INTO workspace.ws_repositories (id, name, url, clone_path, cloned_at) "
            "VALUES ('repo_1', 'board', 'https://example.com/board.git', 'board', NOW())"
        )
        self._sql(
            "INSERT INTO comments.comments (id, project_id, author, timestamp, status, context, "
            "location_x, location_y, content) VALUES ('c_1', 'prj', 'Alex', NOW(), 'OPEN', 'PCB', 1, 2, 'kept')"
        )
        before = {
            int(row["version"]): row["applied_at"]
            for row in self._sql("SELECT version, applied_at FROM workspace.ws_schema_migrations")
        }
        self.assertNotIn(0, before)

        self._run(BOOT)
        self._run(BOOT)

        self.assertEqual(self._ledger("workspace.ws_schema_migrations"), self._expected(WORKSPACE_LEDGER))
        self.assertEqual(self._ledger("comments.comment_schema_migrations"), self._expected(COMMENTS_LEDGER))
        self.assertEqual(self._ledger("catalog.catalog_schema_versions"), self._expected(CATALOG_LEDGER))
        self.assertEqual(self._ledger("workspace.auth_schema_migrations"), self._expected(AUTH_LEDGER))
        self.assertEqual(self._ledger("operations.artifact_schema_migrations"), self._expected(ARTIFACT_LEDGER))

        # Steps the old ledger recorded were not replayed.
        after = {
            int(row["version"]): row["applied_at"]
            for row in self._sql("SELECT version, applied_at FROM workspace.ws_schema_migrations")
        }
        self.assertEqual({version: after[version] for version in before}, before)

        roles = {
            str(row["email"]): (str(row["role"]), bool(row["user_id"]))
            for row in self._sql("SELECT email, role, user_id FROM workspace.user_roles")
        }
        self.assertEqual(
            roles,
            {"legacy@example.com": ("designer", True), "qa@example.com": ("qa", True)},
        )
        [session] = self._sql("SELECT email, user_id FROM workspace.user_sessions")
        self.assertEqual((session["email"], session["user_id"]), ("legacy@example.com", ""))
        self.assertEqual(len(self._sql("SELECT 1 FROM workspace.auth_rate_limit")), 1)
        self.assertEqual(len(self._sql("SELECT 1 FROM workspace.user_credentials")), 0)
        self.assertEqual(
            [row["sha256"] for row in self._sql("SELECT sha256 FROM operations.catalog_artifacts")],
            ["aa11"],
        )
        self.assertEqual(len(self._sql("SELECT 1 FROM workspace.ws_repositories WHERE id = 'repo_1'")), 1)
        [comment] = self._sql("SELECT content, author_kind FROM comments.comments WHERE id = 'c_1'")
        self.assertEqual((comment["content"], comment["author_kind"]), ("kept", "legacy"))

    def test_a_fresh_database_boots_to_head_and_a_restart_changes_nothing(self) -> None:
        from app.services.schema_head import LEDGERS

        self._run(BOOT)
        first = {
            ledger.qualified_table: self._ledger(ledger.qualified_table) for ledger in LEDGERS
        }
        for ledger in LEDGERS:
            self.assertEqual(first[ledger.qualified_table], self._expected(ledger), ledger.name)

        self._run(BOOT)
        for ledger in LEDGERS:
            self.assertEqual(self._ledger(ledger.qualified_table), first[ledger.qualified_table])


if __name__ == "__main__":
    unittest.main()
