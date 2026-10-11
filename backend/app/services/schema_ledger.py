"""One migration ledger for every PostgreSQL schema Prism owns.

A :class:`Ledger` is an ordered list of numbered :class:`Step` s plus the table
that records which of them a database has run. It owns everything the per-schema
runners used to copy from each other:

- the ledger table (``version`` primary key, ``name``, ``applied_at``);
- renumbering, for a step a long-lived branch database recorded under an
  earlier number (the ledger keys on version, so the old row would otherwise
  hide another step's version);
- adoption, for work an earlier Prism did outside the ledger: a schema may
  name the steps a database with an empty ledger has already done, and those
  are recorded instead of replayed;
- the pending report, read-only, which accounts for renumbering and adoption;
- the advisory lock, schema creation and ``search_path`` around a run.

Steps run in order inside the caller's transaction, each followed by its ledger
row, so a step that fails rolls back together with its row and the next start
retries it. Every step must be additive and safe on a populated database: an
upgrade only adds, and anything that removes or narrows waits for a later
release. Gaps in the numbering are allowed; a number another branch took stays
reserved.

:mod:`app.services.schema_head` lists the ledgers in dependency order and
brings every one to head at startup.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

StepBody = Callable[[Any], None]
Hook = Callable[[Any], None]
Connect = Callable[[], AbstractContextManager[Any]]


@dataclass(frozen=True)
class Step:
    version: int
    name: str
    apply: StepBody


@dataclass(frozen=True)
class Renumbered:
    """A step a branch database recorded as ``old`` that now lives at ``new``."""

    name: str
    old: int
    new: int


@dataclass(frozen=True)
class Ledger:
    """The numbered steps of one schema and the table that records them.

    ``table`` is unqualified: :meth:`apply` and :meth:`pending` work on whatever
    ``search_path`` the caller set, which is how tests run a ledger inside a
    disposable schema. :meth:`migrate` sets the path itself.
    """

    name: str
    schema: str
    table: str
    steps: tuple[Step, ...]
    lock: str = "prism-schema"
    search_path: tuple[str, ...] = ("public",)
    renumbered: tuple[Renumbered, ...] = ()
    adopt: Callable[[Any], set[int]] | None = field(default=None, compare=False)

    def __post_init__(self) -> None:
        versions = [step.version for step in self.steps]
        if versions != sorted(set(versions)):
            raise ValueError(f"{self.name} ledger: step versions must be unique and ascending")
        names = [step.name for step in self.steps]
        if len(set(names)) != len(names):
            raise ValueError(f"{self.name} ledger: step names must be unique")

    @property
    def qualified_table(self) -> str:
        return f"{self.schema}.{self.table}"

    def _name_of(self, version: int) -> str:
        return next(step.name for step in self.steps if step.version == version)

    def apply(self, conn: Any) -> list[int]:
        """Run every pending step in order under the caller's lock; return the versions run."""

        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.table} (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        for moved in self.renumbered:
            conn.execute(
                f"UPDATE {self.table} SET version = %s WHERE version = %s AND name = %s",
                (moved.new, moved.old, moved.name),
            )
        applied = {int(row["version"]) for row in conn.execute(f"SELECT version FROM {self.table}").fetchall()}
        if not applied and self.adopt is not None:
            for version in sorted(self.adopt(conn)):
                name = self._name_of(version)
                logger.info("Adopting %s schema migration %s (%s) from its legacy marker", self.name, version, name)
                conn.execute(
                    f"INSERT INTO {self.table}(version, name) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (version, name),
                )
                applied.add(version)

        newly: list[int] = []
        for step in self.steps:
            if step.version in applied:
                continue
            logger.info("Applying %s schema migration %s (%s)", self.name, step.version, step.name)
            step.apply(conn)
            conn.execute(
                f"INSERT INTO {self.table}(version, name) VALUES (%s, %s)",
                (step.version, step.name),
            )
            newly.append(step.version)
        return newly

    def pending(self, conn: Any) -> list[tuple[int, str]]:
        """The steps :meth:`apply` would really run, for reporting before an upgrade.

        Read-only. A renumbered row counts under its new number, and a step that
        will only be adopted from its legacy marker is not listed.
        """

        existing = conn.execute("SELECT to_regclass(%s) AS relation", (self.table,)).fetchone()
        applied: set[int] = set()
        if existing and existing["relation"]:
            moved = {(entry.old, entry.name): entry.new for entry in self.renumbered}
            applied = {
                moved.get((int(row["version"]), str(row["name"])), int(row["version"]))
                for row in conn.execute(f"SELECT version, name FROM {self.table}").fetchall()
            }
        if not applied and self.adopt is not None:
            applied |= self.adopt(conn)
        return [(step.version, step.name) for step in self.steps if step.version not in applied]

    def migrate(
        self,
        connect: Connect,
        *,
        schema: str | None = None,
        before: Iterable[Hook] = (),
        after: Iterable[Hook] = (),
    ) -> list[int]:
        """Bring this schema to head in one transaction under the ledger's advisory lock.

        ``schema`` overrides the target schema (tests use disposable ones).
        ``before`` hooks run under the lock ahead of the steps; ``after`` hooks
        run after them in the same transaction. Both are for reconciliation that
        must happen on every start (guards, derived state, data backfills), not
        for schema changes, which belong in a step.
        """

        target = schema or self.schema
        path = ", ".join([f'"{target}"', *self.search_path])
        with connect() as conn:
            # Lock before the first DDL: CREATE SCHEMA/TABLE IF NOT EXISTS is not
            # race-safe, and workers start against the same database together.
            conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (self.lock,)).fetchone()
            conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{target}"')
            conn.execute(f"SET search_path TO {path}")
            for hook in before:
                hook(conn)
            newly = self.apply(conn)
            for hook in after:
                hook(conn)
            conn.commit()
        return newly


__all__ = ["Ledger", "Renumbered", "Step"]
