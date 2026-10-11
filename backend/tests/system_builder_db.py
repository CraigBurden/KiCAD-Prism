"""A PostgreSQL schema holding the SYS-01 fixture system at F0, for System Builder tests.

``FixtureSystemCase`` builds the three fixture boards as Git repositories once
per class, then gives every test a schema with the workspace migrations applied
and the fixture system loaded. The schema is migrated once per class; between
tests its tables are emptied and the rows the migrations seed are put back,
which is the same starting state at a fraction of the cost (CI plan item 3). Each instance tracks branch
``track``; ``move_track`` simulates a fetch that moves it.
"""

from __future__ import annotations

import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

from system_builder_fixtures import build_fixture_repo, fixture_system

from app.services.systems.detection import Detector
from app.services.systems.drift import pad_sort_key
from app.services.systems.store import SystemStore
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from support.postgres import (
    connect, drop_schema, requires_scratch_postgres, seed_project, seed_repository, set_path, unique_name,
)
from support.repo import git

BOARDS = {"mini_obc": "prj_obc", "mini_payload": "prj_pay", "mini_power": "prj_pwr"}


@requires_scratch_postgres("System Builder database tests")
class FixtureSystemCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._scratch = tempfile.TemporaryDirectory()
        root = Path(cls._scratch.name)
        cls.commits = {board: build_fixture_repo(board, root / board) for board in BOARDS}
        cls.repos = {board: root / board for board in BOARDS}
        cls.projects = {
            project_id: SimpleNamespace(id=project_id, path=str(root / board),
                                        project_file=f"{board}.kicad_pro")
            for board, project_id in BOARDS.items()
        }

    @classmethod
    def tearDownClass(cls) -> None:
        schema = cls.__dict__.get("_schema")
        if schema:
            drop_schema(schema, f"{schema}_seed")
            cls._schema = None
        cls._scratch.cleanup()

    def setUp(self) -> None:
        self.conn = connect()
        owner = type(self)
        if owner.__dict__.get("_schema"):
            self.schema = owner._schema
            self._reset_schema(owner._seeded)
        else:
            self.schema = unique_name("system_detect")
            owner._seeded = self._migrate_schema()
            owner._schema = self.schema
        schema = self.schema

        @contextmanager
        def schema_connection():
            conn = connect(schema)
            try:
                yield conn
            finally:
                conn.close()

        self.connect = schema_connection
        self.detector = Detector(connect=schema_connection, project_loader=self.projects.get)
        for board in BOARDS:
            self.move_track(board, "F0")
        self.store = SystemStore(self.conn)
        self.sid, self.instances, self.links = self.load_fixture_system()

    def _tables(self) -> list[str]:
        return [row["tablename"] for row in self.conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = %s ORDER BY tablename", (self.schema,))]

    def _reset_schema(self, seeded: list[str]) -> None:
        """Empty every table and put back the rows the migrations seeded, as a fresh schema has them."""
        self.conn.execute("SET lock_timeout = '10s'")  # a connection a test left open fails loudly, not hangs
        self.conn.execute(f'SET search_path TO "{self.schema}", public')
        tables = ", ".join(f'"{self.schema}"."{name}"' for name in self._tables())
        self.conn.execute(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")
        for name in seeded:
            self.conn.execute(f'INSERT INTO "{self.schema}"."{name}" OVERRIDING SYSTEM VALUE '
                              f'SELECT * FROM "{self.schema}_seed"."{name}"')
        self.conn.commit()

    def _migrate_schema(self) -> list[str]:
        """Create and migrate this class's schema; copy the rows it starts with into ``<schema>_seed``."""
        self.conn.execute(f'CREATE SCHEMA "{self.schema}"')
        set_path(self.conn, self.schema)
        WORKSPACE_LEDGER.apply(self.conn)
        for project in BOARDS.values():
            repo = f"repo_{project.removeprefix('prj_')}"
            seed_repository(self.conn, repo)
            seed_project(self.conn, project, repo)
        self.conn.execute(f'CREATE SCHEMA "{self.schema}_seed"')
        seeded = []
        for name in self._parents_first(self._tables()):
            if self.conn.execute(f'SELECT EXISTS (SELECT 1 FROM "{self.schema}"."{name}") AS rows').fetchone()["rows"]:
                self.conn.execute(f'CREATE TABLE "{self.schema}_seed"."{name}" AS SELECT * FROM "{self.schema}"."{name}"')
                seeded.append(name)
        self.conn.commit()
        return seeded

    def _parents_first(self, tables: list[str]) -> list[str]:
        """``tables`` ordered so a table comes after every table its foreign keys point at."""
        parents: dict[str, set[str]] = {name: set() for name in tables}
        for row in self.conn.execute(
            """SELECT child.relname AS child, parent.relname AS parent
               FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid
               JOIN pg_class parent ON parent.oid = c.confrelid
               JOIN pg_namespace n ON n.oid = child.relnamespace
               WHERE c.contype = 'f' AND n.nspname = %s""", (self.schema,)):
            if row["child"] in parents and row["parent"] in parents and row["child"] != row["parent"]:
                parents[row["child"]].add(row["parent"])
        ordered: list[str] = []
        while parents:
            ready = sorted(name for name, needs in parents.items() if not needs - set(ordered))
            if not ready:  # a cycle: keep the remaining order; such tables are empty after migrations
                ready = sorted(parents)
            for name in ready:
                ordered.append(name)
                del parents[name]
        return ordered

    def tearDown(self) -> None:
        self.conn.rollback()
        self.conn.close()

    # ------------------------------------------------------------------ helpers

    def move_track(self, board: str, snapshot: str) -> str:
        sha = self.commits[board][snapshot]
        git(self.repos[board], "branch", "-f", "track", sha)
        return sha

    def load_fixture_system(self):
        system = fixture_system()
        created = self.store.create_system(name="Fixture", folder_id=None, actor="user:t")
        sid = created["id"]
        instances, links = {}, {}
        with self.store.mutation(sid, expected_version=None, actor="user:t") as change:
            for label, spec in system["instances"].items():
                row = self.store.add_instance(
                    change, project_id=BOARDS[spec["board"]], label=label,
                    baseline_commit=self.commits[spec["board"]][spec["baseline"]],
                    tracked_ref="track", pinned=spec["pinned"],
                )
                instances[label] = row["id"]
            for link in system["links"]:
                ports = {end: {k: v for k, v in link[end].items() if k != "instance"} for end in "ab"}
                made = self.store.create_link(
                    change, a_instance_id=instances[link["a"]["instance"]], a_port=ports["a"],
                    b_instance_id=instances[link["b"]["instance"]], b_port=ports["b"],
                    name=link["id"], harness=link["harness"],
                )
                self.store.replace_rows(change, made["id"], link["rows"])
                links[link["id"]] = made["id"]
        self.conn.commit()
        return sid, instances, links

    def version(self) -> int:
        self.conn.commit()
        return self.store.get_system(self.sid)["version"]

    def reviews(self, label: str, status: str | None = None) -> list[dict]:
        self.conn.commit()
        iid = self.instances[label]
        return [r for r in self.store.list_reviews(self.sid, status=status) if r["instance_id"] == iid]

    def events(self, kind: str) -> list[dict]:
        self.conn.commit()
        return [e for e in self.store.history(self.sid, limit=500) if e["kind"] == kind]

    def comparable_items(self, review: dict) -> list[dict]:
        link_names = {v: k for k, v in self.links.items()}
        rows = {r["id"]: r for link in self.store.list_links(self.sid) for r in link["rows"]}
        out = []
        for item in review["items"]:
            pins = sorted({rows[rid][f"pin_{item['link_end']}"] for rid in item["row_ids"]},
                          key=pad_sort_key)
            entry = {"kind": item["kind"], "link": link_names[item["link_id"]], "end": item["link_end"],
                     "pins": pins}
            if item["kind"] != "connector_missing":
                entry["expected"], entry["observed"] = item["expected"], item["observed"]
            out.append(entry)
        return out

    def golden_items(self, items: list[dict]) -> list[dict]:
        return [{k: v for k, v in i.items() if k not in ("note", "candidates")} for i in items]

