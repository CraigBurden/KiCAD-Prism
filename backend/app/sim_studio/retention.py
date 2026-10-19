"""Retention for Simulation Studio runs: rows, run folders and their inputs,
and the meshes engines keep per project for re-runs.

A run folder holds its input ``board.prism`` (a hard link to the design
bundle it ran on) and the engine's output. Artifact maintenance runs this once
a day.
"""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path

from app.core.config import settings
from app.sim_studio.run_store import RunStore
from app.sim_studio.runs import mesh_cache_dir, run_dir, sim_root

#: A partly written mesh older than this was left by a crash.
PARTIAL_GRACE_SECONDS = 24 * 3600


def prune_runs(store: RunStore | None = None) -> dict[str, int]:
    store = store or RunStore()
    removed = store.prune(keep_succeeded=settings.PRISM_SIM_SUCCEEDED_RUNS_KEPT)
    folders = 0
    for run_id in removed:
        folder = run_dir(run_id)
        if folder.is_dir():
            shutil.rmtree(folder, ignore_errors=True)
            folders += 1
    folders += _remove_orphan_runs(sim_root() / "runs", store.ids())
    return {
        "sim_runs_pruned": len(removed), "sim_run_folders_removed": folders, **_share_inputs(store.bundles()),
        "sim_meshes_removed": prune_meshes(),
    }


def prune_meshes(keep: int | None = None, *, now: float | None = None) -> int:
    """Keep each project's newest meshes by use (a re-run marks its mesh used); drop the rest."""

    keep = settings.PRISM_SIM_MESHES_KEPT if keep is None else keep
    now = time.time() if now is None else now
    root = mesh_cache_dir("_").parent
    if not root.is_dir():
        return 0
    removed = 0
    for project in root.iterdir():
        if not project.is_dir():
            continue
        meshes = sorted(project.glob("*.dcmesh"), key=lambda p: p.stat().st_mtime, reverse=True)
        stale = meshes[max(keep, 0):]
        stale += [p for p in project.glob("*.partial") if now - p.stat().st_mtime > PARTIAL_GRACE_SECONDS]
        for path in stale:
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def _remove_orphan_runs(root: Path, known: set[str]) -> int:
    """Run folders with no row (deleted projects, rows removed by hand)."""

    if not root.is_dir():
        return 0
    removed = 0
    for folder in root.iterdir():
        if folder.is_dir() and folder.name not in known:
            shutil.rmtree(folder, ignore_errors=True)
            removed += 1
    return removed


def _share_inputs(bundles: dict[str, str]) -> dict[str, int]:
    """Hard-link runs' identical input bundles to one file (same recorded sha256)."""

    first: dict[str, Path] = {}
    linked = 0
    reclaimed = 0
    for run_id, digest in sorted(bundles.items()):
        path = run_dir(run_id) / "input" / "board.prism"
        try:
            stat = path.stat()
        except OSError:
            continue
        keep = first.setdefault(digest, path)
        if keep == path:
            continue
        try:
            if os.path.samefile(keep, path) or keep.stat().st_size != stat.st_size:
                continue
            partial = path.with_name(".board.prism.link")
            partial.unlink(missing_ok=True)
            os.link(keep, partial)
            partial.replace(path)
        except OSError:
            continue
        linked += 1
        reclaimed += stat.st_size
    return {"sim_inputs_linked": linked, "sim_input_bytes_reclaimed": reclaimed}
