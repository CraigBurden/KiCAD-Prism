"""Scratch PostgreSQL schemas for tests, migrated by the production ledgers.

``conftest`` gives every xdist worker its own copy of the three test databases;
this module hands out isolated schemas inside them. A scratch schema is created,
put first on the ``search_path``, brought to head by the ledgers the test names
(``COMMENTS_LEDGER`` creates the comment base tables from production code), and
dropped when the test or ``with`` block ends.
"""

from __future__ import annotations

import os
import unittest
import uuid
from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]


def dsn(url: str) -> str:
    """``url`` as psycopg accepts it (SQLAlchemy URLs carry a ``+psycopg`` driver)."""

    return url.strip().replace("postgresql+psycopg://", "postgresql://", 1)


# Read at import: conftest has already pointed them at this worker's databases.
CATALOG_URL = dsn(os.environ.get("TEST_POSTGRES_URL", ""))
APPLICATION_URL = dsn(os.environ.get("PRISM_DATABASE_URL", ""))
SURVIVOR_URL = dsn(os.environ.get("LEGACY_SURVIVOR_TEST_POSTGRES_URL", ""))


def _identity(url: str) -> tuple[str, str, int | None, str]:
    parsed = urlsplit(url)
    return (parsed.username or "", (parsed.hostname or "").lower(), parsed.port, parsed.path.lstrip("/"))


# Scratch schemas go in TEST_POSTGRES_URL; refuse when it is the application database.
SHARED_APPLICATION_DATABASE = bool(
    CATALOG_URL and APPLICATION_URL and _identity(CATALOG_URL) == _identity(APPLICATION_URL)
)


def requires_scratch_postgres(subject: str = "these tests") -> Callable[[Any], Any]:
    """Skip unless TEST_POSTGRES_URL is set, psycopg imports, and it is not the application database."""

    def decorate(target: Any) -> Any:
        target = unittest.skipIf(SHARED_APPLICATION_DATABASE, "TEST_POSTGRES_URL must not target PRISM_DATABASE_URL")(target)
        target = unittest.skipUnless(psycopg is not None, f"psycopg is required for {subject}")(target)
        return unittest.skipUnless(CATALOG_URL, f"TEST_POSTGRES_URL is required for {subject}")(target)

    return decorate


def unique_name(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def connect(schema: str | None = None, *, url: str | None = None, autocommit: bool = False):
    """A new ``dict_row`` connection, with ``schema`` first on its ``search_path``. The caller closes it."""

    conn = psycopg.connect(url or CATALOG_URL, row_factory=dict_row, autocommit=autocommit)
    if schema is not None:
        set_path(conn, schema)
    return conn


def set_path(conn: Any, *schemas: str) -> None:
    path = ", ".join(f'"{name}"' for name in schemas)
    conn.execute(f"SET search_path TO {path}, public")


def drop_schema(*names: str, url: str | None = None) -> None:
    with psycopg.connect(url or CATALOG_URL, autocommit=True) as conn:
        # A connection a test left in a transaction on the schema fails the drop loudly, not hangs it.
        conn.execute("SET lock_timeout = '20s'")
        for name in names:
            conn.execute(f'DROP SCHEMA IF EXISTS "{name}" CASCADE')


class ScratchSchema:
    """One disposable schema. ``conn`` is its held connection (``None`` when not created here)."""

    def __init__(self, name: str, url: str) -> None:
        self.name = name
        self.url = url
        self.conn: Any = None

    def connect(self, *, autocommit: bool = False):
        """A new connection on this schema's ``search_path``. The caller closes it."""

        return connect(self.name, url=self.url, autocommit=autocommit)

    @contextmanager
    def connection(self) -> Iterator[Any]:
        """A connection that commits on success and closes, for services taking a ``connect`` factory."""

        with psycopg.connect(self.url, row_factory=dict_row) as conn:
            set_path(conn, self.name)
            yield conn

    def reset_path(self) -> None:
        """Roll back the held connection and put this schema back on its path."""

        self.conn.rollback()
        set_path(self.conn, self.name)

    def close(self) -> None:
        conn, self.conn = self.conn, None
        if conn is not None and not conn.closed:
            try:
                conn.rollback()
            finally:
                conn.close()
        drop_schema(self.name, url=self.url)


@contextmanager
def open_scratch_schema(
    prefix: str,
    *,
    ledgers: Iterable[Any] = (),
    then: Iterable[Callable[[Any], Any]] = (),
    create: bool = True,
    url: str | None = None,
) -> Iterator[ScratchSchema]:
    """A scratch schema migrated by ``ledgers`` then ``then``, dropped on exit.

    With ``create=False`` nothing is created and no connection is held: the code
    under test creates the schema itself (a service given ``name``), and the
    schema is still dropped on exit.
    """

    scratch = ScratchSchema(unique_name(prefix), url or CATALOG_URL)
    try:
        if create:
            scratch.conn = connect(url=scratch.url)
            scratch.conn.execute(f'CREATE SCHEMA "{scratch.name}"')
            set_path(scratch.conn, scratch.name)
            for ledger in ledgers:
                ledger.apply(scratch.conn)
            for step in then:
                step(scratch.conn)
            scratch.conn.commit()
        yield scratch
    finally:
        scratch.close()


def scratch_schema(test: unittest.TestCase, prefix: str, **options: Any) -> ScratchSchema:
    """:func:`open_scratch_schema` for the length of ``test`` (dropped in its cleanups)."""

    return test.enterContext(open_scratch_schema(prefix, **options))


def tracker_tables(conn: Any) -> None:
    """The tracker tables the workspace and comments schemas carry, on ``conn``'s path."""

    from app.services.trackers.inbox_store import apply_schema as apply_inbox_schema
    from app.services.trackers.migrations import migrate_workspace_tracker_tables
    from app.services.trackers.op_store import apply_schema as apply_op_schema

    migrate_workspace_tracker_tables(conn)
    apply_op_schema(conn)
    apply_inbox_schema(conn)


def tracker_schema(test: unittest.TestCase, prefix: str) -> ScratchSchema:
    """A scratch schema with the comment tables at head plus :func:`tracker_tables`."""

    from app.services.comments_schema_migrations import COMMENTS_LEDGER

    return scratch_schema(test, prefix, ledgers=(COMMENTS_LEDGER,), then=(tracker_tables,))


def comments_store_on(scratch: ScratchSchema):
    """A ``CommentsStoreService`` on ``scratch``; it creates and migrates the schema itself."""

    from app.services.comments_store_service import CommentsStoreService

    store = CommentsStoreService()
    store.schema = scratch.name
    store._connect = scratch.connection
    return store


def comments_store(test: unittest.TestCase, prefix: str):
    """:func:`comments_store_on` a scratch schema of its own, dropped after ``test``."""

    return comments_store_on(scratch_schema(test, prefix, create=False))


# ---------------------------------------------------------------------------
# Seed rows. Production tables have no defaults for these columns; tests that
# only need a row to point at get the same values everywhere.


def _insert(conn: Any, table: str, values: dict[str, Any], suffix: str = "") -> None:
    columns = ", ".join(values)
    marks = ", ".join(["%s"] * len(values))
    conn.execute(f"INSERT INTO {table} ({columns}) VALUES ({marks}){suffix}", tuple(values.values()))


def seed_comment(conn: Any, comment_id: str, project_id: str, *, on_conflict_skip: bool = False, **columns: Any) -> None:
    """A ``comments`` row; ``columns`` override the defaults (author Priya, an open PCB pin at 0,0)."""

    values = {
        "id": comment_id,
        "project_id": project_id,
        "author": "Priya",
        "timestamp": datetime.now(timezone.utc),
        "status": "OPEN",
        "context": "PCB",
        "location_x": 0.0,
        "location_y": 0.0,
        "content": "",
        **columns,
    }
    _insert(conn, "comments", values, " ON CONFLICT (id) DO NOTHING" if on_conflict_skip else "")


def seed_reply(conn: Any, reply_id: str, comment_id: str, project_id: str, **columns: Any) -> None:
    """A ``comment_replies`` row; ``columns`` override the defaults (author Arjun, empty content)."""

    values = {
        "id": reply_id,
        "comment_id": comment_id,
        "project_id": project_id,
        "author": "Arjun",
        "timestamp": datetime.now(timezone.utc),
        "content": "",
        **columns,
    }
    _insert(conn, "comment_replies", values)


def seed_repository(conn: Any, repo_id: str, **columns: Any) -> None:
    """A ``ws_repositories`` row with a unique URL and clone path."""

    values = {
        "id": repo_id,
        "name": repo_id,
        "url": f"https://example.invalid/{repo_id}.git",
        "clone_path": f"clones/{repo_id}",
        "cloned_at": datetime.now(timezone.utc),
        **columns,
    }
    _insert(conn, "ws_repositories", values)


def seed_job(conn: Any, job_id: str, kind: str, status: str, **columns: Any) -> None:
    """A ``ws_jobs`` row."""

    now = datetime.now(timezone.utc)
    _insert(conn, "ws_jobs", {"id": job_id, "kind": kind, "status": status, "created_at": now, "updated_at": now, **columns})


def seed_folder(
    conn: Any, folder_id: str, *, allowed_roles: list[str] | None = None, on_conflict_skip: bool = False, **columns: Any,
) -> None:
    """A ``ws_folders`` row (top level unless ``parent_id`` is given)."""

    from psycopg.types.json import Jsonb

    now = datetime.now(timezone.utc)
    values = {
        "id": folder_id,
        "name": folder_id,
        "allowed_roles": Jsonb(allowed_roles or []),
        "created_at": now,
        "updated_at": now,
        **columns,
    }
    _insert(conn, "ws_folders", values, " ON CONFLICT DO NOTHING" if on_conflict_skip else "")


def seed_project(conn: Any, project_id: str, repo_id: str, **columns: Any) -> None:
    """A ``ws_projects`` row in ``repo_id`` (seed the repository first)."""

    now = datetime.now(timezone.utc)
    values = {
        "id": project_id,
        "repo_id": repo_id,
        "name": "board",
        "relative_path": project_id,
        "registered_at": now,
        "last_modified": now,
        **columns,
    }
    _insert(conn, "ws_projects", values)


__all__ = [
    "APPLICATION_URL",
    "CATALOG_URL",
    "SHARED_APPLICATION_DATABASE",
    "SURVIVOR_URL",
    "ScratchSchema",
    "comments_store",
    "comments_store_on",
    "connect",
    "drop_schema",
    "dsn",
    "open_scratch_schema",
    "requires_scratch_postgres",
    "scratch_schema",
    "seed_comment",
    "seed_folder",
    "seed_job",
    "seed_project",
    "seed_reply",
    "seed_repository",
    "set_path",
    "tracker_schema",
    "tracker_tables",
    "unique_name",
]
