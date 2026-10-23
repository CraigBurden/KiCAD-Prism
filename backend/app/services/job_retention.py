"""Retention for finished jobs: their rows, events and log folders.

Routine background jobs (tracker polls and sweeps, background fetches,
system source checks) run every few minutes per repository and used to be
kept forever: tens of thousands of rows, events and one log folder each.
Artifact maintenance runs this once a day.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.job_runtime import job_state_root
from app.services.postgres_database import database

#: Kinds a scheduler queues on its own, many times a day.
ROUTINE_KINDS = (
    "tracker_poll",
    "tracker_sweep",
    "tracker_dispatch",
    "project_sync",
    "project_fetch",
    "system_source_check",
)
_DAY = 24 * 60 * 60
#: Upper bound on rows deleted per maintenance run, in batches.
_MAX_ROWS_PER_RUN = 200_000


def _remove_log_folder(log_path: str, root: Path) -> bool:
    folder = Path(log_path).parent
    try:
        folder.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return False  # Only ever a folder under <state>/jobs.
    shutil.rmtree(folder, ignore_errors=True)
    return True


def prune_jobs(jobs: Any) -> dict[str, int]:
    """Delete finished jobs past retention, then log folders no job row owns."""

    jobs.initialize()
    root = job_state_root() / "jobs"
    routine = max(0, settings.PRISM_ROUTINE_JOB_RETENTION_DAYS) * _DAY
    other = max(0, settings.PRISM_JOB_RETENTION_DAYS) * _DAY
    rows = folders = 0
    while rows < _MAX_ROWS_PER_RUN:
        log_paths = _prune_batch(routine_kinds=ROUTINE_KINDS, routine_seconds=routine, other_seconds=other)
        rows += len(log_paths)
        folders += sum(_remove_log_folder(path, root) for path in log_paths)
        if not log_paths:
            break
    folders += _remove_orphan_log_folders(root, older_than_seconds=routine)
    return {"job_rows_pruned": rows, "job_log_folders_removed": folders}


def _prune_batch(
    *, routine_kinds: tuple[str, ...], routine_seconds: int, other_seconds: int, batch: int = 5000
) -> list[str]:
    """Delete one batch of finished jobs past retention; returns their log paths.

    Events go with them (ON DELETE CASCADE). A job is kept while anything
    still points at it: a 3D readiness row (which would cascade away), an
    artifact (pruned on its own schedule first), a release build, or being
    the newest job of its kind and key (status lookups read that one).
    """

    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        rows = conn.execute(
            """
            WITH doomed AS (
                SELECT job.id
                FROM ws_jobs job
                WHERE job.status IN ('completed', 'failed', 'cancelled')
                  AND COALESCE(job.completed_at, job.updated_at) < NOW() - (
                      CASE WHEN job.kind = ANY(%s) THEN %s ELSE %s END * INTERVAL '1 second')
                  AND NOT EXISTS (SELECT 1 FROM ws_artifacts artifact WHERE artifact.source_job_id = job.id)
                  AND NOT EXISTS (SELECT 1 FROM ws_release_builds build WHERE build.job_id = job.id)
                  AND NOT (
                      COALESCE(job.artifact_key, '') <> ''
                      AND NOT EXISTS (
                          SELECT 1 FROM ws_jobs newer
                          WHERE newer.kind = job.kind
                            AND newer.artifact_key = job.artifact_key
                            AND newer.created_at > job.created_at
                      )
                  )
                ORDER BY COALESCE(job.completed_at, job.updated_at)
                LIMIT %s
            )
            DELETE FROM ws_jobs job USING doomed
            WHERE job.id = doomed.id
            RETURNING job.log_path
            """,
            (list(routine_kinds), max(0, int(routine_seconds)), max(0, int(other_seconds)), max(1, int(batch))),
        ).fetchall()
        conn.commit()
    return [str(row["log_path"]) for row in rows if row["log_path"]]


def _job_ids() -> set[str]:
    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        return {str(row["id"]) for row in conn.execute("SELECT id FROM ws_jobs").fetchall()}


def _remove_orphan_log_folders(root: Path, *, older_than_seconds: int) -> int:
    """Log folders whose job row is gone (deleted before retention existed)."""

    import time

    if not root.is_dir():
        return 0
    known = _job_ids()
    cutoff = time.time() - older_than_seconds
    removed = 0
    for folder in root.iterdir():
        try:
            if folder.name in known or not folder.is_dir() or folder.stat().st_mtime >= cutoff:
                continue
        except OSError:
            continue
        shutil.rmtree(folder, ignore_errors=True)
        removed += 1
    return removed
