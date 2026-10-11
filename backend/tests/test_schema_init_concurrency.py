"""Schema initialisers must survive running at the same moment.

Each catalog job runs in its own process, so two jobs starting together both
initialise the artifact store against a database that may not have the
``operations`` schema yet. ``CREATE SCHEMA IF NOT EXISTS`` and
``CREATE TABLE IF NOT EXISTS`` are not race-safe in PostgreSQL: the loser fails
with a duplicate key on ``pg_namespace`` or ``pg_type``. Every initialiser must
take its schema's advisory lock before the first DDL statement.

The services' in-process locks would serialise threads sharing one instance,
so each racer gets its own instance (or a reset module flag) and its own
connection, which is what separate worker processes have.
"""

from __future__ import annotations

import tempfile
import threading
import unittest
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator
from unittest.mock import patch
from urllib.parse import urlsplit, urlunsplit

from support.postgres import APPLICATION_URL, drop_schema

ROUNDS = 5


class _FreshDatabase:
    """Stands in for the shared pool: one new connection per call."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    @contextmanager
    def connection(self) -> Iterator[Any]:
        import psycopg

        from app.services.postgres_database import connection_kwargs

        with psycopg.connect(self.dsn, **connection_kwargs(self.dsn)) as conn:
            yield conn


def _race(*initialisers: Callable[[], None]) -> list[BaseException]:
    barrier = threading.Barrier(len(initialisers))
    errors: list[BaseException] = []

    def run(initialise: Callable[[], None]) -> None:
        barrier.wait()
        try:
            initialise()
        except BaseException as error:  # noqa: BLE001 - reported by the test
            errors.append(error)

    threads = [threading.Thread(target=run, args=(item,)) for item in initialisers]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=120)
    return errors


@unittest.skipUnless(APPLICATION_URL, "PRISM_DATABASE_URL is required for schema race tests")
class ConcurrentSchemaInitializationTests(unittest.TestCase):
    def setUp(self) -> None:
        import psycopg

        parts = urlsplit(APPLICATION_URL)
        self.name = f"{parts.path.lstrip('/')}_initrace"
        self.server = urlunsplit(parts._replace(path="/postgres"))
        with psycopg.connect(self.server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)')
            conn.execute(f'CREATE DATABASE "{self.name}"')
        self.dsn = urlunsplit(parts._replace(path=f"/{self.name}"))
        self.database = _FreshDatabase(self.dsn)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)

    def tearDown(self) -> None:
        import psycopg

        with psycopg.connect(self.server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)')

    def _drop_schema(self, schema: str) -> None:
        drop_schema(schema, url=self.dsn)

    def _catalog(self, label: str):
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

        return ComponentCatalogPostgresService(
            store_root=Path(self.temporary.name) / label,
            database_url=self.dsn,
        )

    def test_catalog_initializers_race_on_a_fresh_schema(self) -> None:
        for round_number in range(ROUNDS):
            self._drop_schema("catalog")
            first = self._catalog(f"catalog-a{round_number}")
            second = self._catalog(f"catalog-b{round_number}")
            errors = _race(first.initialize, second.initialize)
            self.assertEqual(errors, [], f"round {round_number}")

    def test_artifact_store_initializers_race_on_a_fresh_schema(self) -> None:
        from app.services import local_artifact_store
        from app.services.local_artifact_store import LocalArtifactStore

        # The artifact store indexes catalog.revision_assets, so the catalog
        # schema has to exist first, exactly as it does in a worker.
        self._catalog("catalog").initialize()
        root = Path(self.temporary.name)
        with patch.object(local_artifact_store, "database", self.database):
            for round_number in range(ROUNDS):
                self._drop_schema("operations")
                first = LocalArtifactStore(root / f"artifacts-a{round_number}")
                second = LocalArtifactStore(root / f"artifacts-b{round_number}")
                errors = _race(first.initialize, second.initialize)
                self.assertEqual(errors, [], f"round {round_number}")

    def test_workspace_initializers_race_on_a_fresh_schema(self) -> None:
        from app.services import (
            access_service,
            rate_limit_service,
            session_store_service,
            workspace_service,
        )
        from app.services.workspace_service import WorkspaceService

        modules = (access_service, rate_limit_service, session_store_service, workspace_service)
        with ExitStack() as stack:
            for module in modules:
                stack.enter_context(patch.object(module, "database", self.database))
            for round_number in range(ROUNDS):
                self._drop_schema("workspace")
                for module in modules[:3]:
                    stack.enter_context(patch.object(module, "_initialized", False))
                errors = _race(
                    WorkspaceService().initialize,
                    access_service.initialize_role_store,
                    rate_limit_service.initialize_rate_limit_store,
                    session_store_service.initialize_session_store,
                )
                self.assertEqual(errors, [], f"round {round_number}")


if __name__ == "__main__":
    unittest.main()
