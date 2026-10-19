"""System bundles on disk and their workspace rows
(docs/system-builder/CONTRACTS.md §8; ADR System Builder v2 §3.3).

```text
<KICAD_PROJECTS_ROOT>/.kicad-prism/system-bundles/<system_id>/<bundle_key>.json
```

The file is the complete ``prism.system_bundle.a0`` document ``prism-kicad
system build`` wrote; the cache key is the content key, so a file is written
once and read by every caller (redacted at read time, §6). ``ws_system_bundles``
mirrors the file's state and job for listings, deduplication and retention.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
from contextlib import AbstractContextManager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

from app.core.config import settings

Connect = Callable[[], AbstractContextManager[Any]]

_SYSTEM_ID = re.compile(r"^[A-Za-z0-9._-]{1,200}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_ACTIVE_JOBS = ("queued", "running", "retry_wait", "cancel_requested")
_STATES = ("queued", "building", "complete", "failed")


def default_connect() -> AbstractContextManager[Any]:
    """The workspace connection, through the design bundle's factory.

    Retention already patches (or supplies) that factory, so the system bundle
    pass shares one transaction story with the rest of the bundle upkeep.
    """

    from app.services.design_bundle import rows

    return rows.default_connect()


def _with(connect: Connect | None) -> Connect:
    return connect or default_connect


# -------------------------------------------------------------------- files


def root() -> Path:
    return Path(settings.KICAD_PROJECTS_ROOT).expanduser() / ".kicad-prism" / "system-bundles"


def _checked(system_id: str, bundle_key: str) -> None:
    if not _SYSTEM_ID.match(system_id) or system_id in (".", ".."):
        raise ValueError(f"unusable system id for the system bundle store: {system_id!r}")
    if not _HEX64.match(bundle_key):
        raise ValueError("a system bundle key is 64 lowercase hex digits")


def path(system_id: str, bundle_key: str) -> Path:
    _checked(system_id, bundle_key)
    return root() / system_id / f"{bundle_key}.json"


def exists(system_id: str, bundle_key: str) -> bool:
    return path(system_id, bundle_key).is_file()


def read(system_id: str, bundle_key: str) -> dict[str, Any] | None:
    """The stored bundle, or ``None`` when no file holds that key."""

    source = path(system_id, bundle_key)
    if not source.is_file():
        return None
    return json.loads(source.read_text(encoding="utf-8"))


def write(system_id: str, bundle_key: str, bundle: Mapping[str, Any]) -> Path:
    """Write ``bundle`` atomically; used by tests and tools that hold the document already."""

    target = path(system_id, bundle_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(bundle, separators=(",", ":"), ensure_ascii=False).encode("utf-8") + b"\n"
    _atomic_write(target, data)
    return target


def install(system_id: str, bundle_key: str, source: Path) -> Path:
    """Move the CLI's output into the store, atomically from a reader's point of view."""

    target = path(system_id, bundle_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.parent / f".{target.name}.prism-kicad-{os.getpid()}-{time.monotonic_ns()}.tmp"
    try:
        with open(source, "rb") as source_handle, open(temp, "xb") as target_handle:
            shutil.copyfileobj(source_handle, target_handle)
            target_handle.flush()
            os.fsync(target_handle.fileno())
        os.chmod(temp, 0o644)
        os.replace(temp, target)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise
    return target


def _atomic_write(target: Path, data: bytes) -> None:
    temp = target.parent / f".{target.name}.prism-kicad-{os.getpid()}-{time.monotonic_ns()}.tmp"
    try:
        with open(temp, "xb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, 0o644)
        os.replace(temp, target)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise


def delete(system_id: str, bundle_key: str) -> None:
    """Remove one stored file and its now-empty system directory."""

    path(system_id, bundle_key).unlink(missing_ok=True)
    try:
        (root() / system_id).rmdir()
    except OSError:
        pass


# --------------------------------------------------------------------- rows


def upsert(
    *,
    system_id: str,
    bundle_key: str,
    state: str,
    document_version: int,
    job_id: str | None = None,
    error: str = "",
    connect: Connect | None = None,
) -> None:
    """Insert or update the row for one bundle key."""

    if state not in _STATES:
        raise ValueError(f"unknown system bundle state: {state!r}")
    with _with(connect)() as conn:
        conn.execute(
            """
            INSERT INTO ws_system_bundles
                (system_id, bundle_key, state, job_id, error, document_version)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (system_id, bundle_key) DO UPDATE SET
                state = EXCLUDED.state,
                job_id = COALESCE(EXCLUDED.job_id, ws_system_bundles.job_id),
                error = EXCLUDED.error,
                document_version = EXCLUDED.document_version,
                updated_at = now()
            """,
            (system_id, bundle_key, state, job_id, error, int(document_version)),
        )


def get(system_id: str, bundle_key: str, *, connect: Connect | None = None) -> dict[str, Any] | None:
    with _with(connect)() as conn:
        row = conn.execute(
            "SELECT * FROM ws_system_bundles WHERE system_id = %s AND bundle_key = %s",
            (system_id, bundle_key),
        ).fetchone()
    return dict(row) if row is not None else None


def get_by_job(
    system_id: str, job_id: str, *, connect: Connect | None = None
) -> dict[str, Any] | None:
    """The live row the job owns, whichever key it ended up building."""

    with _with(connect)() as conn:
        row = conn.execute(
            """SELECT * FROM ws_system_bundles
                WHERE system_id = %s AND job_id = %s
                  AND state IN ('queued', 'building')
                ORDER BY updated_at DESC, bundle_key LIMIT 1""",
            (system_id, job_id),
        ).fetchone()
    return dict(row) if row is not None else None


def touch(system_id: str, bundle_key: str, *, connect: Connect | None = None) -> None:
    """Mark a read (retention keeps bundles by use)."""

    with _with(connect)() as conn:
        conn.execute(
            "UPDATE ws_system_bundles SET last_used_at = now()"
            " WHERE system_id = %s AND bundle_key = %s",
            (system_id, bundle_key),
        )


def supersede(
    system_id: str, bundle_key: str, by_key: str, *, connect: Connect | None = None
) -> None:
    """Fail a still-queued row whose key the system has moved past."""

    with _with(connect)() as conn:
        conn.execute(
            """UPDATE ws_system_bundles
                  SET state = 'failed', error = %s, updated_at = now()
                WHERE system_id = %s AND bundle_key = %s
                  AND state IN ('queued', 'building')""",
            (f"the system changed after queueing; the current key is {by_key}", system_id, bundle_key),
        )


def active_job(job_id: str | None, *, connect: Connect | None = None) -> bool:
    """Whether ``job_id`` is a job the worker may still run."""

    if not job_id:
        return False
    with _with(connect)() as conn:
        row = conn.execute("SELECT status FROM ws_jobs WHERE id = %s", (job_id,)).fetchone()
    return bool(row and row["status"] in _ACTIVE_JOBS)


def failed_recently(row: Mapping[str, Any], *, within: timedelta = timedelta(hours=1)) -> bool:
    """Whether a failed row was last touched inside the no-retry window."""

    updated = row.get("updated_at")
    if not isinstance(updated, datetime):
        return False
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return updated >= datetime.now(timezone.utc) - within


def bundles(system_id: str, *, connect: Connect | None = None) -> list[dict[str, Any]]:
    with _with(connect)() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_system_bundles WHERE system_id = %s"
            " ORDER BY updated_at DESC, bundle_key",
            (system_id,),
        ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------- retention


def prune(*, now: datetime | None = None, connect: Connect | None = None) -> dict[str, int]:
    """Keep the newest complete bundle per system and every bundle used recently.

    A soft-deleted system keeps nothing: its files and rows go. Queued or
    building rows whose job may still run are never removed. Returns counts for
    the retention log.
    """

    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS)
    report = {"systems": 0, "kept": 0, "removed": 0, "deleted_systems": 0}
    with _with(connect)() as conn:
        systems = conn.execute(
            "SELECT system_id, deleted_at FROM ws_systems ORDER BY system_id"
        ).fetchall()
        for system in systems:
            report["systems"] += 1
            system_id = str(system["system_id"])
            rows = conn.execute(
                """
                SELECT b.*, j.status AS job_status
                  FROM ws_system_bundles b
                  LEFT JOIN ws_jobs j ON j.id = b.job_id
                 WHERE b.system_id = %s
                 ORDER BY b.updated_at DESC, b.bundle_key
                """,
                (system_id,),
            ).fetchall()
            if system["deleted_at"] is not None:
                if _SYSTEM_ID.match(system_id) and system_id not in (".", ".."):
                    shutil.rmtree(root() / system_id, ignore_errors=True)
                conn.execute("DELETE FROM ws_system_bundles WHERE system_id = %s", (system_id,))
                report["deleted_systems"] += 1
                report["removed"] += len(rows)
                continue
            keep: set[str] = set()
            newest_complete = next((row for row in rows if row["state"] == "complete"), None)
            if newest_complete is not None:
                keep.add(str(newest_complete["bundle_key"]))
            for row in rows:
                bundle_key = str(row["bundle_key"])
                if _as_utc(row["last_used_at"]) >= cutoff:
                    keep.add(bundle_key)
                elif row["state"] in ("queued", "building") and row.get("job_status") in _ACTIVE_JOBS:
                    keep.add(bundle_key)
            for row in rows:
                bundle_key = str(row["bundle_key"])
                if bundle_key in keep:
                    report["kept"] += 1
                    continue
                delete(system_id, bundle_key)
                conn.execute(
                    "DELETE FROM ws_system_bundles WHERE system_id = %s AND bundle_key = %s",
                    (system_id, bundle_key),
                )
                report["removed"] += 1
    return report


def _as_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value))
