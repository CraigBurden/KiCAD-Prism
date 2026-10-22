"""Workspace schema migration 130: sim_run_solved_commit.

Frozen. Applied deployments record this body in ``ws_schema_migrations``;
edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    """``ws_sim_runs.solved_commit`` for databases that ran Simulation Studio before it existed.

    Migration 121 creates the column on a new database. A database that recorded Simulation
    Studio's migrations as 9056-9058 (renumbered to 120-122) made the table without it.
    """

    conn.execute("ALTER TABLE ws_sim_runs ADD COLUMN IF NOT EXISTS solved_commit TEXT")
