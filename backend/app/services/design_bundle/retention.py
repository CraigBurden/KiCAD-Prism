"""Bundle retention (ADR §5, §11 G2; bundle-format.md §8).

Kept always: the bundles of every branch head, of System Builder instances'
baseline commits and of released Release Studio commits (Simulation Studio's
kept runs join when WP-C6 lands). Every other bundle goes once it has been
unused for ``PRISM_DESIGN_BUNDLE_RETENTION_DAYS``. A bundle whose job is still
queued or building is never removed.

Also swept: unpacked-cache versions that are not the archive's current one
(after a grace period), archives on disk that no row knows, the CLI's stale
temporary files, and commit-index rows of unkept commits whose key has no
bundle left.
"""

from __future__ import annotations

import logging
import re
import shutil
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.design_bundle import rows, store
from app.services.design_bundle.archive import BundleInvalid, open_archive
from app.services.design_bundle.backfill import branch_heads, repo_of

logger = logging.getLogger(__name__)

CACHE_GRACE_SECONDS = 3600
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _as_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value))


def kept_commits(project: dict[str, Any], *, connect: rows.Connect | None = None) -> set[str]:
    repo = repo_of(project)
    heads = set(branch_heads(repo)) if repo.is_dir() else set()
    return heads | rows.pinned_commits(str(project["id"]), connect=connect)


def run(*, now: datetime | None = None, connect: rows.Connect | None = None) -> dict[str, Any]:
    """One retention pass over every project. Returns counts for the log."""

    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS)
    report = {"kept": 0, "removed": 0, "orphan_archives": 0, "cache_versions": 0, "index_rows": 0, "temp_files": 0}
    known: set[tuple[str, str, str]] = set()
    for project in rows.projects(connect=connect):
        project_id = str(project["id"])
        keep_commits = kept_commits(project, connect=connect)
        keep_keys = rows.keys_for_commits(project_id, keep_commits, connect=connect)
        doomed: list[str] = []
        for bundle in rows.bundles(project_id, connect=connect):
            identity = (project_id, str(bundle["revision_key"]), str(bundle["generator_digest"]))
            active = bundle["state"] in ("queued", "building") and rows.job_status(bundle.get("job_id"), connect=connect) in (
                "queued", "running", "retry_wait", "cancel_requested",
            )
            if bundle["revision_key"] in keep_keys or active or _as_utc(bundle["last_used_at"]) >= cutoff:
                known.add(identity)
                report["kept"] += 1
                report["cache_versions"] += _prune_cache(*identity)
                continue
            store.delete(*identity)
            doomed.append(str(bundle["bundle_key"]))
        rows.delete_bundles(project_id, doomed, connect=connect)
        report["removed"] += len(doomed)
        report["index_rows"] += rows.prune_index(
            project_id, keep_commits, older_than_days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS, connect=connect
        )
    report["orphan_archives"] = _sweep_orphans(known, cutoff)
    report["temp_files"] = store.sweep_temporary_files(now=now.timestamp())
    return report


def _prune_cache(project_id: str, revision_key: str, generator_digest: str) -> int:
    path = store.archive_path(project_id, revision_key, generator_digest)
    if not path.is_file():
        return 0
    try:
        current = open_archive(path).manifest_sha256
    except BundleInvalid:
        return 0
    return store.prune_versions(project_id, revision_key, generator_digest, current, grace_seconds=CACHE_GRACE_SECONDS)


def _sweep_orphans(known: set[tuple[str, str, str]], cutoff: datetime) -> int:
    """Archives (and caches) on disk that no row names, once older than the retention cutoff."""

    base = store.root()
    removed = 0
    if not base.is_dir():
        return 0
    for project in sorted(p for p in base.iterdir() if p.is_dir() and not p.is_symlink()):
        for revision in sorted(r for r in project.iterdir() if r.is_dir() and _HEX64.match(r.name)):
            for item in sorted(revision.iterdir()):
                digest = item.name[: -len(".prism")] if item.name.endswith(".prism") else item.name
                if not _HEX64.match(digest) or (project.name, revision.name, digest) in known:
                    continue
                if item.lstat().st_mtime >= cutoff.timestamp():
                    continue
                if item.is_dir() and not item.is_symlink():
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    item.unlink(missing_ok=True)
                removed += item.name.endswith(".prism")
            _remove_if_empty(revision)
        _remove_if_empty(project)
    return removed


def _remove_if_empty(path: Path) -> None:
    try:
        path.rmdir()
    except OSError:
        pass


def due(last_run: float, *, interval_seconds: float = 3600) -> bool:
    return time.monotonic() - last_run >= interval_seconds
