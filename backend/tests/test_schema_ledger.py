"""The migration ledger over a list of fake steps, against a real PostgreSQL server.

Every schema Prism owns runs through this one ledger, so its rules are tested
here once: order, recording, renumbering, adoption of legacy markers, the
pending report, and that a step which fails takes its ledger row with it.
"""

from __future__ import annotations

import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.schema_ledger import Ledger, Renumbered, Step  # noqa: E402
from support.postgres import APPLICATION_URL, connect, scratch_schema  # noqa: E402



class LedgerDeclarationTests(unittest.TestCase):
    def test_versions_must_be_unique_and_ascending(self) -> None:
        noop = lambda conn: None  # noqa: E731
        with self.assertRaises(ValueError):
            Ledger("t", "s", "t_ledger", (Step(2, "b", noop), Step(1, "a", noop)))
        with self.assertRaises(ValueError):
            Ledger("t", "s", "t_ledger", (Step(1, "a", noop), Step(1, "b", noop)))
        with self.assertRaises(ValueError):
            Ledger("t", "s", "t_ledger", (Step(1, "a", noop), Step(2, "a", noop)))

    def test_every_schema_ledger_is_declared_once(self) -> None:
        from app.services.schema_head import LEDGERS

        tables = [ledger.qualified_table for ledger in LEDGERS]
        self.assertEqual(len(tables), len(set(tables)))
        self.assertEqual(
            [ledger.name for ledger in LEDGERS],
            ["workspace", "auth", "comments", "catalog", "artifacts"],
        )


@unittest.skipUnless(APPLICATION_URL, "PRISM_DATABASE_URL is required for ledger tests")
class LedgerPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        # Ledger.migrate creates the schema itself; the scratch only names and drops it.
        self.scratch = scratch_schema(self, "ledger", create=False, url=APPLICATION_URL)
        self.schema = self.scratch.name
        self.calls: list[str] = []
        self.admin = connect(url=APPLICATION_URL, autocommit=True)
        self.addCleanup(self.admin.close)

    @contextmanager
    def connect(self) -> Iterator[Any]:
        with connect(url=APPLICATION_URL) as conn:
            yield conn

    def step(self, version: int, name: str, *, fail: bool = False) -> Step:
        def body(conn: Any) -> None:
            self.calls.append(name)
            conn.execute(f"CREATE TABLE {name} (id INTEGER)")
            if fail:
                raise RuntimeError(f"{name} failed")

        return Step(version, name, body)

    def ledger(self, *steps: Step, **options: Any) -> Ledger:
        return Ledger("fake", self.schema, "fake_ledger", tuple(steps), lock=f"test-{self.schema}", **options)

    def recorded(self) -> dict[int, str]:
        rows = self.admin.execute(f'SELECT version, name FROM "{self.schema}".fake_ledger').fetchall()
        return {int(row["version"]): str(row["name"]) for row in rows}

    def tables(self) -> set[str]:
        rows = self.admin.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = %s", (self.schema,)
        ).fetchall()
        return {str(row["table_name"]) for row in rows}

    def test_steps_run_once_in_order_and_a_restart_runs_nothing(self) -> None:
        ledger = self.ledger(self.step(1, "one"), self.step(3, "three"), self.step(7, "seven"))

        self.assertEqual(ledger.migrate(self.connect), [1, 3, 7])
        self.assertEqual(ledger.migrate(self.connect), [])

        self.assertEqual(self.calls, ["one", "three", "seven"])
        self.assertEqual(self.recorded(), {1: "one", 3: "three", 7: "seven"})

    def test_a_later_release_runs_only_its_new_steps(self) -> None:
        self.ledger(self.step(1, "one")).migrate(self.connect)
        self.calls.clear()

        newly = self.ledger(self.step(1, "one"), self.step(2, "two")).migrate(self.connect)

        self.assertEqual((newly, self.calls), ([2], ["two"]))

    def test_a_failing_step_rolls_back_with_its_row_and_the_next_start_retries(self) -> None:
        broken = self.ledger(self.step(1, "one"), self.step(2, "two", fail=True))
        with self.assertRaisesRegex(RuntimeError, "two failed"):
            broken.migrate(self.connect)
        # One transaction: neither the earlier step nor the ledger table survived.
        self.assertEqual(self.tables(), set())

        fixed = self.ledger(self.step(1, "one"), self.step(2, "two"))
        self.assertEqual(fixed.migrate(self.connect), [1, 2])
        self.assertEqual(self.recorded(), {1: "one", 2: "two"})

    def test_a_renumbered_row_moves_instead_of_replaying(self) -> None:
        self.ledger(self.step(1, "one"), self.step(3, "moved")).migrate(self.connect)
        self.calls.clear()
        ledger = self.ledger(
            self.step(1, "one"),
            self.step(3, "three"),
            self.step(6, "moved"),
            renumbered=(Renumbered("moved", 3, 6),),
        )

        with self.connect() as conn:
            conn.execute(f'SET search_path TO "{self.schema}"')
            self.assertEqual(ledger.pending(conn), [(3, "three")])
        self.assertEqual(self.recorded()[3], "moved", "reporting must not modify the database")

        self.assertEqual(ledger.migrate(self.connect), [3])
        self.assertEqual(self.recorded(), {1: "one", 3: "three", 6: "moved"})
        self.assertEqual(self.calls, ["three"])

    def test_an_empty_ledger_adopts_legacy_markers_and_pending_says_so(self) -> None:
        def adopt(conn: Any) -> set[int]:
            marker = conn.execute("SELECT to_regclass('legacy_marker') AS relation").fetchone()
            return {1} if marker["relation"] else set()

        self.admin.execute(f'CREATE SCHEMA "{self.schema}"')
        self.admin.execute(f'CREATE TABLE "{self.schema}".legacy_marker (id INTEGER)')
        ledger = self.ledger(self.step(1, "one"), self.step(2, "two"), adopt=adopt)

        with self.connect() as conn:
            conn.execute(f'SET search_path TO "{self.schema}"')
            self.assertEqual(ledger.pending(conn), [(2, "two")])
        self.assertNotIn("fake_ledger", self.tables(), "reporting must not create the ledger")

        self.assertEqual(ledger.migrate(self.connect), [2])
        self.assertEqual(self.calls, ["two"])
        self.assertEqual(self.recorded(), {1: "one", 2: "two"})

    def test_adoption_only_considers_a_database_with_no_ledger(self) -> None:
        asked: list[bool] = []

        def adopt(conn: Any) -> set[int]:
            asked.append(True)
            return {2}

        self.ledger(self.step(1, "one")).migrate(self.connect)
        self.ledger(self.step(1, "one"), self.step(2, "two"), adopt=adopt).migrate(self.connect)

        self.assertEqual(asked, [])
        self.assertEqual(self.calls, ["one", "two"])

    def test_hooks_run_around_the_steps_in_the_same_transaction(self) -> None:
        order: list[str] = []
        ledger = self.ledger(self.step(1, "one"))

        ledger.migrate(
            self.connect,
            before=(lambda conn: order.append("before"),),
            after=(lambda conn: order.append("after"),),
        )

        self.assertEqual(order, ["before", "after"])
        self.assertEqual(self.calls, ["one"])


if __name__ == "__main__":
    unittest.main()
