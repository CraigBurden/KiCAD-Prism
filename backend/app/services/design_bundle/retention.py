"""Bundle retention (ADR §5, §11 G2; bundle-format.md §8).

Kept always: the bundles of every commit the prebuild keeps warm (branch
heads, each branch's newest ``PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS`` commits,
every tagged commit), of System Builder instances' baseline commits and of
released Release Studio commits (Simulation Studio's kept runs join when WP-C6
lands), and every bundle an alias row points to (ADR amendment K2). An alias
of an unkept revision goes once unused for ``PRISM_DESIGN_BUNDLE_RETENTION_DAYS``;
every other bundle goes once unused for as long. A bundle whose job is still
queued or building is never removed.

Also swept: unpacked-cache versions that are not the archive's current one
(after a grace period), caches of archives no read has used for
``PRISM_DESIGN_BUNDLE_CACHE_IDLE_DAYS`` (the archive itself stays), and the
least recently used caches until the store and each project fit under
``PRISM_DESIGN_BUNDLE_CACHE_MAX_BYTES`` /
``PRISM_DESIGN_BUNDLE_CACHE_PROJECT_MAX_BYTES``. A version directory touched
inside ``PRISM_DESIGN_BUNDLE_CACHE_GRACE_SECONDS`` is never removed: a reader
may still be using it. Archives on disk that no row knows, the CLI's stale
temporary files, commit-index rows of unkept commits whose key has no
bundle left, and the persistent KiCad caches unused for
``PRISM_DESIGN_BUNDLE_RETENTION_DAYS``: component GLBs of the models stage's
export cache, refilled boards, upgraded files, and Release Studio's raytraced
cover renders (their sizes are reported).
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
from app.services.design_bundle import kicad_steps, reuse, rows, stage_models, store
from app.services.design_bundle.archive import BundleInvalid, open_archive
from app.services.design_bundle.backfill import repo_of

logger = logging.getLogger(__name__)

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _as_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value))


def kept_commits(project: dict[str, Any], *, connect: rows.Connect | None = None) -> set[str]:
    repo = repo_of(project)
    warm = set(reuse.prebuild_commits(repo)) if repo.is_dir() else set()
    return warm | rows.pinned_commits(str(project["id"]), connect=connect)


def run(*, now: datetime | None = None, connect: rows.Connect | None = None) -> dict[str, Any]:
    """One retention pass over every project. Returns counts for the log."""

    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS)
    report = {
        "kept": 0, "removed": 0, "aliases_removed": 0, "orphan_archives": 0, "cache_versions": 0, "index_rows": 0,
        "temp_files": 0, "cache_idle_versions": 0, "cache_idle_bytes": 0, "cache_capped_versions": 0,
        "cache_capped_bytes": 0, "cache_bytes": 0,
    }
    known: set[tuple[str, str, str]] = set()
    cache_keep: dict[tuple[str, str, str], str] = {}
    cache_last_used: dict[tuple[str, str, str], float] = {}
    for project in rows.projects(connect=connect):
        project_id = str(project["id"])
        keep_commits = kept_commits(project, connect=connect)
        keep_keys = rows.keys_for_commits(project_id, keep_commits, connect=connect)
        report["aliases_removed"] += rows.prune_aliases(
            project_id, sorted(keep_keys), older_than_days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS, connect=connect
        )
        aliased = {str(alias["bundle_key"]) for alias in rows.aliases(project_id, connect=connect)}
        doomed: list[str] = []
        for bundle in rows.bundles(project_id, connect=connect):
            identity = (project_id, str(bundle["revision_key"]), str(bundle["generator_digest"]))
            active = bundle["state"] in ("queued", "building") and rows.job_status(bundle.get("job_id"), connect=connect) in (
                "queued", "running", "retry_wait", "cancel_requested",
            )
            kept = bundle["revision_key"] in keep_keys or bundle["bundle_key"] in aliased
            if kept or active or _as_utc(bundle["last_used_at"]) >= cutoff:
                known.add(identity)
                report["kept"] += 1
                current = _current_manifest(*identity)
                if current is not None:
                    cache_keep[identity] = current
                    cache_last_used[identity] = _as_utc(bundle["last_used_at"]).timestamp()
                continue
            store.delete(*identity)
            doomed.append(str(bundle["bundle_key"]))
        rows.delete_aliases(project_id, bundle_keys=doomed, connect=connect)
        rows.delete_bundles(project_id, doomed, connect=connect)
        report["removed"] += len(doomed)
        report["index_rows"] += rows.prune_index(
            project_id, keep_commits, older_than_days=settings.PRISM_DESIGN_BUNDLE_RETENTION_DAYS, connect=connect
        )
    caches = store.prune_cache_store(
        keep=cache_keep,
        last_used=cache_last_used,
        grace_seconds=settings.PRISM_DESIGN_BUNDLE_CACHE_GRACE_SECONDS,
        idle_before=(
            (now - timedelta(days=settings.PRISM_DESIGN_BUNDLE_CACHE_IDLE_DAYS)).timestamp()
            if settings.PRISM_DESIGN_BUNDLE_CACHE_IDLE_DAYS > 0
            else float("-inf")
        ),
        max_bytes=settings.PRISM_DESIGN_BUNDLE_CACHE_MAX_BYTES,
        max_bytes_per_project=settings.PRISM_DESIGN_BUNDLE_CACHE_PROJECT_MAX_BYTES,
        now=now.timestamp(),
    )
    report["cache_versions"] = caches["versions"]
    report["cache_idle_versions"] = caches["idle_versions"]
    report["cache_idle_bytes"] = caches["idle_bytes"]
    report["cache_capped_versions"] = caches["capped_versions"]
    report["cache_capped_bytes"] = caches["capped_bytes"]
    report["cache_bytes"] = caches["cache_bytes"]
    report["orphan_archives"] = _sweep_orphans(known, cutoff)
    report["temp_files"] = store.sweep_temporary_files(now=now.timestamp())
    models = stage_models.prune_cache(unused_before=cutoff.timestamp(), now=now.timestamp())
    report["model_cache_removed"], report["model_cache_bytes"] = models["removed"], models["bytes"]
    refill = kicad_steps.prune_refill_cache(unused_before=cutoff.timestamp(), now=now.timestamp())
    report["refill_cache_removed"], report["refill_cache_bytes"] = refill["removed"], refill["bytes"]
    upgrade = kicad_steps.prune_upgrade_cache(unused_before=cutoff.timestamp(), now=now.timestamp())
    report["upgrade_cache_removed"], report["upgrade_cache_bytes"] = upgrade["removed"], upgrade["bytes"]
    # Imported here, not at module scope: this sweep belongs to Release Studio,
    # and a design-bundle consumer that never composes documents should not load
    # the document engine behind it.
    from app.release_studio.documents import render_cache

    renders = render_cache.prune(unused_before=cutoff.timestamp(), now=now.timestamp())
    report["render_cache_removed"], report["render_cache_bytes"] = renders["removed"], renders["bytes"]
    return report


def _current_manifest(project_id: str, revision_key: str, generator_digest: str) -> str | None:
    path = store.archive_path(project_id, revision_key, generator_digest)
    if not path.is_file():
        return None
    try:
        return open_archive(path).manifest_sha256
    except BundleInvalid:
        return None


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
