"""
Design Comparison service — monkey design.a0 structured diff + geometry sidecars.

Replaces raster kicad-cli SVG overlays for History Design Comparison.
"""

from __future__ import annotations

import copy
import hashlib
import json
import logging
import math
import os
import re
import shutil
import subprocess
import multiprocessing
import tempfile
import threading
import time
import uuid
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.services import (
    bom_diff_service,
    document_diff_service,
    semantic_index_service,
)
from app.services.design_compare_benchmark import DesignCompareBenchmark
from app.services.job_artifact_service import job_artifacts
from app.services.job_runtime import JobContext, JobResult, job_state_root
from app.services.job_service import jobs as v3_jobs
from app.services.workspace_service import workspace

logger = logging.getLogger(__name__)

design_compare_jobs: Dict[str, dict] = {}
# Defaults land in the platform temporary directory rather than a literal
# `/tmp`, which does not exist on Windows.
_CACHE_ROOT = Path(
    os.environ.get("PRISM_DESIGN_COMPARE_CACHE")
    or Path(tempfile.gettempdir()) / "prism_design_compare_cache"
)
_JOB_ROOT = Path(
    os.environ.get("PRISM_DESIGN_COMPARE_JOBS")
    or Path(tempfile.gettempdir()) / "prism_design_compare"
)
_CACHE_SCHEMA = "prism.design_compare_revision_v5"
_INITIAL_CACHE_SCHEMA = "prism.design_compare_revision_initial_v1"
_CACHE_LOCKS: Dict[str, threading.Lock] = {}
_CACHE_LOCKS_GUARD = threading.Lock()
_GENERATED_PARTS = {
    ".cache",
    ".kicad-prism",
    "archive",
    "autosave",
    "backup",
    "backups",
}


def _persist_job(job_id: str) -> None:
    job = design_compare_jobs.get(job_id)
    if not job:
        return
    workspace.update_job(
        job_id,
        status=job.get("status", "running"),
        message=job.get("message", ""),
        percent=job.get("percent", 0),
        **{
            key: value
            for key, value in job.items()
            # The result is already published atomically under _JOB_ROOT. Writing
            # the multi-megabyte payload into the workspace JSONB row duplicates
            # serialization and can dominate completion time on large projects.
            if key not in {"job_id", "status", "message", "percent", "result"}
        },
    )


def _repo_paths(project_id: str) -> Tuple[Path, Optional[str], Path]:
    """Return (git_repo_root, relative_sub_path, project_checkout_path)."""
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError(f"Project '{project_id}' not found")
    checkout = Path(row["path"])
    import_type = row.get("import_type")
    parent = row.get("parent_repo_path")
    sub = row.get("sub_path")
    if parent and sub:
        return Path(parent), sub, checkout
    if import_type == "type2_subproject":
        return Path(parent or checkout.parent), sub, checkout
    return checkout, None, checkout


_SNAPSHOT_SUFFIXES = {
    ".kicad_dru",
    ".kicad_jobset",
    ".kicad_pcb",
    ".kicad_pro",
    ".kicad_sch",
    ".kicad_wks",
}
_SNAPSHOT_NAMES = {".prism.json", "fp-lib-table", "sym-lib-table"}


def _snapshot_paths(
    repo_path: Path,
    commit: str,
    relative_path: Optional[str],
) -> List[str]:
    """List only inputs needed by semantic, geometry, BOM, and viewer generation."""
    args = ["git", "-C", str(repo_path), "ls-tree", "-rz", "--name-only", commit]
    if relative_path:
        args.extend(["--", relative_path])
    process = subprocess.run(args, capture_output=True)
    if process.returncode != 0:
        raise RuntimeError(
            f"git ls-tree failed for {commit}: "
            f"{process.stderr.decode('utf-8', errors='replace')}"
        )
    paths: List[str] = []
    for raw in process.stdout.split(b"\0"):
        if not raw:
            continue
        value = raw.decode("utf-8", errors="surrogateescape")
        path = Path(value)
        folded_parts = {part.casefold() for part in path.parts[:-1]}
        if folded_parts & _GENERATED_PARTS:
            continue
        if path.name in _SNAPSHOT_NAMES or path.suffix.casefold() in _SNAPSHOT_SUFFIXES:
            paths.append(value)
    if not paths:
        raise RuntimeError(f"No KiCad design inputs found at {commit}")
    return paths


def _snapshot_commit(repo_path: Path, commit: str, destination: Path, relative_path: Optional[str]) -> None:
    """Archive only comparison inputs, excluding manufacturing and 3D asset bulk."""
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    paths = _snapshot_paths(repo_path, commit, relative_path)
    args = ["git", "-C", str(repo_path), "archive", "--format=tar", commit, "--", *paths]
    archive = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert archive.stdout is not None
    tar = subprocess.Popen(
        ["tar", "-x", "-C", str(destination)],
        stdin=archive.stdout,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    archive.stdout.close()
    _, tar_err = tar.communicate()
    _, arch_err = archive.communicate()
    if archive.returncode != 0:
        raise RuntimeError(
            f"git archive failed for {commit}: {arch_err.decode('utf-8', errors='replace')}"
        )
    if tar.returncode != 0:
        raise RuntimeError(
            f"tar extract failed for {commit}: {tar_err.decode('utf-8', errors='replace')}"
        )
    # Type-2 archives extract as <sub_path>/... — flatten to destination root
    if relative_path:
        nested = destination / relative_path
        if nested.exists() and nested.is_dir():
            for child in list(nested.iterdir()):
                target = destination / child.name
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
                shutil.move(str(child), str(target))
            # remove emptied prefix dirs
            try:
                shutil.rmtree(destination / Path(relative_path).parts[0])
            except Exception:
                pass

    # Drop manufacturing / CI / asset bulk — design compare only needs KiCad sources.
    for name in (
        "Manufacturing-Outputs",
        "Design-Outputs",
        "archive",
        ".github",
        "packages3D",
        "simulation",
        "docs",
        "assets",
    ):
        heavy = destination / name
        if heavy.exists():
            shutil.rmtree(heavy, ignore_errors=True)

def _find_pro(root: Path) -> Optional[Path]:
    pros = [path for path in root.rglob("*.kicad_pro") if not _is_generated_kicad_path(path, root)]
    if not pros:
        return None
    # Prefer shallowest
    pros.sort(key=lambda p: len(p.parts))
    return pros[0]


def _cache_dir(project_id: str, commit: str) -> Path:
    return (
        _CACHE_ROOT
        / project_id
        / commit
        / semantic_index_service.generator_cache_tag()
    )


def _cache_lock(project_id: str, commit: str) -> threading.Lock:
    key = f"{project_id}:{commit}:{semantic_index_service.generator_cache_tag()}"
    with _CACHE_LOCKS_GUARD:
        return _CACHE_LOCKS.setdefault(key, threading.Lock())


def _read_revision_cache(
    marker: Path,
    *,
    schema: str = _CACHE_SCHEMA,
) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if payload.get("schema") != schema:
        return None
    return payload


def _timed_revision_action(
    *,
    commit: str,
    label: str,
    action: Callable[[], Any],
    logs: List[str],
    timings: Dict[str, float],
    benchmark: Optional[DesignCompareBenchmark],
    stage: str,
) -> Any:
    started = time.perf_counter()
    scope = f"revision:{commit}:{stage}"
    if benchmark is None:
        try:
            return action()
        finally:
            elapsed = time.perf_counter() - started
            timings[label] = elapsed
            logs.append(f"Timing {commit[:7]} {stage}.{label}: {elapsed:.3f}s")
    with benchmark.span(label, scope=scope):
        try:
            return action()
        finally:
            elapsed = time.perf_counter() - started
            timings[label] = elapsed
            logs.append(f"Timing {commit[:7]} {stage}.{label}: {elapsed:.3f}s")


def _semantic_timing_callback(
    benchmark: Optional[DesignCompareBenchmark],
    *,
    commit: str,
    stage: str,
) -> Optional[Callable[[Dict[str, Any]], None]]:
    if benchmark is None:
        return None

    def record(event: Dict[str, Any]) -> None:
        benchmark.record_duration(
            event["phase"],
            elapsed_ns=event["elapsedNs"],
            cpu_ns=event["cpuNs"],
            scope=f"revision:{commit}:{stage}:semantic",
            metadata=event.get("metadata"),
        )

    return record


def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # The temporary name carries the writer's identity. A fixed `.tmp`
    # suffix is only safe while one process writes a given cache entry, and
    # the revision stages now build in worker processes -- two writers
    # racing on one name would interleave into a corrupt file that then
    # gets renamed into place as if it were whole.
    temporary = path.with_suffix(f"{path.suffix}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, separators=(",", ":")), encoding="utf-8"
        )
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _load_or_build_initial_revision(
    project_id: str,
    repo_path: Path,
    relative_path: Optional[str],
    commit: str,
    logs: List[str],
    on_progress: Optional[Any] = None,
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> Dict[str, Any]:
    """Build the Schematic+BOM revision stage without materializing the PCB."""

    revision_started = time.perf_counter()
    timings: Dict[str, float] = {}

    def timed(label: str, action: Callable[[], Any]) -> Any:
        return _timed_revision_action(
            commit=commit,
            label=label,
            action=action,
            logs=logs,
            timings=timings,
            benchmark=benchmark,
            stage="initial",
        )

    cache = _cache_dir(project_id, commit)
    full_marker = cache / "revision.json"
    initial_marker = cache / "initial.json"
    cached = _read_revision_cache(full_marker) if full_marker.exists() else None
    if cached is not None:
        logs.append(f"Full cache hit for {commit[:7]}")
        if benchmark is not None:
            benchmark.mark("full-cache-hit", scope=f"revision:{commit}:initial")
        if on_progress:
            on_progress(f"Initial assets cached {commit[:7]}")
        return cached
    cached = (
        _read_revision_cache(initial_marker, schema=_INITIAL_CACHE_SCHEMA)
        if initial_marker.exists()
        else None
    )
    if cached is not None:
        logs.append(f"Initial cache hit for {commit[:7]}")
        if benchmark is not None:
            benchmark.mark("initial-cache-hit", scope=f"revision:{commit}:initial")
        if on_progress:
            on_progress(f"Initial assets cached {commit[:7]}")
        return cached

    with _cache_lock(project_id, commit):
        cached = _read_revision_cache(full_marker) if full_marker.exists() else None
        if cached is not None:
            logs.append(f"Full cache hit for {commit[:7]} after wait")
            if benchmark is not None:
                benchmark.mark("full-cache-hit-after-wait", scope=f"revision:{commit}:initial")
            if on_progress:
                on_progress(f"Initial assets cached {commit[:7]}")
            return cached
        cached = (
            _read_revision_cache(initial_marker, schema=_INITIAL_CACHE_SCHEMA)
            if initial_marker.exists()
            else None
        )
        if cached is not None:
            logs.append(f"Initial cache hit for {commit[:7]} after wait")
            if benchmark is not None:
                benchmark.mark("initial-cache-hit-after-wait", scope=f"revision:{commit}:initial")
            return cached

        snap = cache / "snapshot"
        logs.append(f"Snapshotting {commit[:7]}…")
        if on_progress:
            on_progress(f"Snapshotting {commit[:7]}…")
        timed(
            "snapshot",
            lambda: _snapshot_commit(repo_path, commit, snap, relative_path),
        )

        pro = _find_pro(snap)
        semantic_index: Dict[str, Any] = {
            "schema": semantic_index_service.SCHEMA,
            "components": [],
            "nets": [],
            "terminals": [],
            "indexes": {},
        }
        if pro:
            try:
                if on_progress:
                    on_progress(f"Building schematic semantics for {commit[:7]}…")
                semantic_index = timed(
                    "schematic-semantic-index",
                    lambda: semantic_index_service.build_semantic_index(
                        pro,
                        source_revision_key=commit,
                        commit=commit,
                        timing_callback=_semantic_timing_callback(
                            benchmark,
                            commit=commit,
                            stage="initial",
                        ),
                        include_pcb=False,
                    ),
                )
                logs.append(f"Built schematic semantic index for {commit[:7]}")
            except Exception as exc:
                logs.append(f"Schematic semantic index failed for {commit[:7]}: {exc}")
                semantic_index = {
                    "schema": "fallback",
                    "components": [],
                    "nets": [],
                    "terminals": [],
                    "indexes": {},
                }

            try:
                if on_progress:
                    on_progress(f"Extracting schematic geometry for {commit[:7]}…")
                geometry = timed(
                    "schematic-geometry",
                    lambda: _extract_geometry(
                        snap,
                        semantic_index,
                        {"schematic"},
                    ),
                )
                logs.append(
                    f"Schematic geometry {commit[:7]}: "
                    f"{len(geometry.get('schematic') or {})} objects"
                )
            except Exception as exc:
                logs.append(f"Schematic geometry extract failed: {exc}")
                geometry = {"schematic": {}, "pcb": {}}
        else:
            geometry = {"schematic": {}, "pcb": {}}

        payload = {
            "schema": _INITIAL_CACHE_SCHEMA,
            "commit": commit,
            "semantic": semantic_index,
            "geometry": geometry,
            "stackup": {"present": False, "layers": []},
            "bom_rows": timed(
                "bom-projection",
                lambda: _semantic_bom_rows(semantic_index),
            ),
            "sources": timed("source-list", lambda: _list_kicad_sources(snap)),
            "timings": timings,
        }
        timed("cache-write", lambda: _atomic_write_json(initial_marker, payload))
        total = time.perf_counter() - revision_started
        logs.append(
            f"Timing {commit[:7]} initial total: {total:.3f}s; "
            f"cache={initial_marker.stat().st_size / (1024 * 1024):.1f}MiB"
        )
        if on_progress:
            on_progress(f"Schematic and BOM ready for {commit[:7]}")
        return payload


def _load_or_build_pcb_revision(
    project_id: str,
    commit: str,
    initial: Dict[str, Any],
    logs: List[str],
    on_progress: Optional[Any] = None,
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> Dict[str, Any]:
    """Finish PCB+Stackup by scanning the existing Stage 1 snapshot."""

    if initial.get("schema") == _CACHE_SCHEMA:
        logs.append(f"PCB cache already loaded for {commit[:7]}")
        if benchmark is not None:
            benchmark.mark("pcb-cache-reused", scope=f"revision:{commit}:pcb")
        return initial

    timings = dict(initial.get("timings") or {})

    def timed(label: str, action: Callable[[], Any]) -> Any:
        return _timed_revision_action(
            commit=commit,
            label=label,
            action=action,
            logs=logs,
            timings=timings,
            benchmark=benchmark,
            stage="pcb",
        )

    cache = _cache_dir(project_id, commit)
    marker = cache / "revision.json"
    cached = _read_revision_cache(marker) if marker.exists() else None
    if cached is not None:
        logs.append(f"PCB cache hit for {commit[:7]}")
        if benchmark is not None:
            benchmark.mark("pcb-cache-hit", scope=f"revision:{commit}:pcb")
        return cached

    with _cache_lock(project_id, commit):
        cached = _read_revision_cache(marker) if marker.exists() else None
        if cached is not None:
            logs.append(f"PCB cache hit for {commit[:7]} after wait")
            return cached

        snap = cache / "snapshot"
        semantic_index = copy.deepcopy(initial.get("semantic") or {})

        geometry = copy.deepcopy(initial.get("geometry") or {"schematic": {}, "pcb": {}})
        try:
            if on_progress:
                on_progress(f"Indexing PCB geometry for {commit[:7]}…")
            pcb_geometry = timed(
                "pcb-geometry",
                lambda: _extract_geometry(snap, semantic_index, {"pcb"}),
            )
            geometry["pcb"] = pcb_geometry.get("pcb") or {}
        except Exception as exc:
            logs.append(f"PCB geometry extract failed for {commit[:7]}: {exc}")
            geometry["pcb"] = {}

        try:
            stackup = timed("stackup", lambda: _extract_stackup(snap))
        except Exception as exc:
            logs.append(f"Stackup extract failed for {commit[:7]}: {exc}")
            stackup = {"present": False, "layers": []}

        payload = {
            **initial,
            "schema": _CACHE_SCHEMA,
            "semantic": semantic_index,
            "geometry": geometry,
            "stackup": stackup,
            "timings": timings,
        }
        timed("cache-write", lambda: _atomic_write_json(marker, payload))
        if on_progress:
            on_progress(f"PCB and Stackup ready for {commit[:7]}")
        return payload


def _load_or_build_revision(
    project_id: str,
    repo_path: Path,
    relative_path: Optional[str],
    commit: str,
    logs: List[str],
    on_progress: Optional[Any] = None,
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> Dict[str, Any]:
    """Compatibility full-revision entry point used by cache warmers/tests."""

    initial = _load_or_build_initial_revision(
        project_id,
        repo_path,
        relative_path,
        commit,
        logs,
        on_progress=on_progress,
        benchmark=benchmark,
    )
    return _load_or_build_pcb_revision(
        project_id,
        commit,
        initial,
        logs,
        on_progress=on_progress,
        benchmark=benchmark,
    )


def _list_kicad_sources(root: Path) -> List[Dict[str, str]]:
    out = []
    for path in sorted(root.rglob("*")):
        if (
            path.suffix in {".kicad_sch", ".kicad_pcb", ".kicad_pro"}
            and path.is_file()
            and not _is_generated_kicad_path(path, root)
        ):
            out.append(
                {
                    "filename": path.name,
                    "path": str(path.relative_to(root)).replace("\\", "/"),
                }
            )
    return out


def _is_generated_kicad_path(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        relative = path
    parts = [part.casefold() for part in relative.parts]
    name = path.name.casefold()
    return (
        any(part in _GENERATED_PARTS or part.endswith("-backups") for part in parts[:-1])
        or name.startswith(("~", "._"))
        or "-backup-" in name
        or name.endswith((".bak", ".lck"))
    )


def _semantic_bom_rows(semantic_index: Dict[str, Any]) -> List[Dict[str, str]]:
    """Project BOM rows projected from the already-compiled schematic model.

    Design Comparison used to invoke kicad-cli after kicad-monkey had already
    parsed and compiled the same schematic hierarchy. Keeping the projection
    in-process removes that second parser pass and preserves every canonical
    and custom field exposed by the semantic index.
    """

    rows: List[Dict[str, str]] = []
    for component in semantic_index.get("components") or []:
        reference = str(component.get("reference") or "").strip()
        if not reference:
            continue
        fields = {
            str(key): "" if value is None else str(value)
            for key, value in (component.get("fields") or {}).items()
            if str(key)
        }
        if fields.get("kicad_in_bom", "true").strip().casefold() == "false":
            continue
        rows.append(
            {
                **fields,
                "Reference": reference,
                "Value": str(component.get("value") or fields.get("Value") or ""),
                "Footprint": str(
                    component.get("footprint") or fields.get("Footprint") or ""
                ),
            }
        )
    return sorted(rows, key=lambda row: row["Reference"])


def _extract_stackup(snap: Path) -> Dict[str, Any]:
    pcb = next(
        (
            path
            for path in snap.rglob("*.kicad_pcb")
            if not _is_generated_kicad_path(path, snap)
        ),
        None,
    )
    if not pcb:
        return {"present": False, "layers": []}
    text = pcb.read_text(encoding="utf-8", errors="replace")
    # Prefer (stackup ...) block layers. Parse each (layer ...) form independently so
    # fields like (color ...) between (type ...) and (thickness ...) are tolerated.
    layers: List[Dict[str, Any]] = []
    stackup_start = re.search(r"\(stackup(?=\s|\))", text)
    stackup_end = (
        semantic_index_service._balanced_s_expression_end(text, stackup_start.start())
        if stackup_start
        else None
    )
    body = text[stackup_start.start():stackup_end] if stackup_start and stackup_end else ""
    for layer_block in _iter_sexpr_blocks(body, "layer"):
        name_match = re.match(r'\(layer\s+"([^"]+)"', layer_block)
        if not name_match:
            continue
        type_match = re.search(r'\(type\s+"([^"]*)"\)', layer_block)
        thickness_match = re.search(r"\(thickness\s+([-+0-9.eE]+)\)", layer_block)
        layers.append(
            {
                "name": name_match.group(1),
                "type": type_match.group(1) if type_match else "",
                "thickness": float(thickness_match.group(1)) if thickness_match else None,
            }
        )
    if not layers:
        # Fallback: board layer table
        for m in re.finditer(r'\(\s*(\d+)\s+"([^"]+)"\s+"([^"]+)"', text):
            layers.append({"name": m.group(2), "type": m.group(3), "ordinal": int(m.group(1))})
    return {"present": bool(layers), "layers": layers}


_UUID_RE = re.compile(
    r'\(uuid\s+"([0-9a-fA-F-]{36})"\)|\(tstamp\s+"([0-9a-fA-F-]{8,})"\)'
)


def _iter_sexpr_blocks(text: str, kind: str):
    """Yield bounded KiCad S-expressions without catastrophic cross-file regexes."""
    pattern = re.compile(rf"\({re.escape(kind)}(?=\s|\))")
    for match in pattern.finditer(text):
        end = semantic_index_service._balanced_s_expression_end(text, match.start())
        if end is not None:
            yield text[match.start():end]


def _source_id(block: str) -> Optional[str]:
    match = _UUID_RE.search(block)
    return next((value for value in match.groups() if value), None) if match else None


def _point(block: str, key: str) -> Optional[List[float]]:
    match = re.search(
        rf"\({re.escape(key)}\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)",
        block,
    )
    return [float(match.group(1)), float(match.group(2))] if match else None


def _point_angle(block: str, key: str) -> Optional[float]:
    match = re.search(
        rf"\({re.escape(key)}\s+[-+0-9.eE]+\s+[-+0-9.eE]+(?:\s+([-+0-9.eE]+))?",
        block,
    )
    if not match:
        return None
    return float(match.group(1) or 0)


def _points(block: str) -> List[List[float]]:
    return [
        [float(x), float(y)]
        for x, y in re.findall(r"\(xy\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\)", block)
    ]


def _bounds(points: List[List[float]]) -> Optional[List[float]]:
    if not points:
        return None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)]


def _semantic_lookup(index: Dict[str, Any], bucket: str, source_id: str) -> Optional[Dict[str, Any]]:
    position = (index.get("indexes") or {}).get(bucket, {}).get(source_id)
    if not isinstance(position, int):
        return None
    collection = "components" if "component" in bucket.lower() else "nets"
    values = index.get(collection) or []
    return values[position] if 0 <= position < len(values) else None


def _enrich_geometry(
    entry: Dict[str, Any],
    *,
    source_id: str,
    semantic_index: Dict[str, Any],
    context: str,
) -> Dict[str, Any]:
    entry["source_id"] = source_id
    component_bucket = (
        "componentBySchematicUuid" if context == "schematic" else "componentByPcbFootprintUuid"
    )
    net_bucket = "netBySchematicUuid" if context == "schematic" else "netByPcbUuid"
    component = _semantic_lookup(semantic_index, component_bucket, source_id)
    net = _semantic_lookup(semantic_index, net_bucket, source_id)
    if context == "pcb" and component is None and entry.get("reference"):
        component = _semantic_lookup(
            semantic_index,
            "componentByReference",
            str(entry["reference"]),
        )
    if context == "pcb" and net is None and entry.get("net"):
        net = _semantic_lookup(
            semantic_index,
            "netByName",
            str(entry["net"]),
        )
    if component:
        entry["semantic_id"] = component.get("componentUid")
        entry["reference"] = component.get("reference")
    if net:
        entry["semantic_id"] = net.get("netUid")
        entry["net"] = net.get("name") or entry.get("net")
    elif context == "pcb" and entry.get("net"):
        entry["semantic_id"] = semantic_index_service._stable_uid(
            "net",
            entry["net"],
        )
    return entry


def _extract_geometry(
    snap: Path,
    semantic_index: Dict[str, Any],
    domains: Optional[set[str]] = None,
) -> Dict[str, Any]:
    """Compact native source-id → exact/fallback geometry sidecars."""
    sch_geom: Dict[str, Any] = {}
    pcb_geom: Dict[str, Any] = {}
    requested = domains or {"schematic", "pcb"}

    schematic_paths = snap.rglob("*.kicad_sch") if "schematic" in requested else ()
    for sch in schematic_paths:
        if _is_generated_kicad_path(sch, snap):
            continue
        page = sch.relative_to(snap).as_posix()
        text = sch.read_text(encoding="utf-8", errors="replace")
        for block in _iter_sexpr_blocks(text, "symbol"):
            if "(lib_id " not in block:
                continue
            source_id = _source_id(block)
            at = _point(block, "at")
            if not source_id or not at:
                continue
            symbol_bounds = [at[0] - 2.54, at[1] - 2.54, 5.08, 5.08]
            sch_geom[source_id] = _enrich_geometry(
                {
                    "kind": "symbol",
                    "page": page,
                    "x": at[0],
                    "y": at[1],
                    "bounds": symbol_bounds,
                },
                source_id=source_id,
                semantic_index=semantic_index,
                context="schematic",
            )
            # Instance pins have native UUIDs but no independent `(at ...)` in
            # the schematic file. Index them against their owning symbol so a
            # terminal-only semantic net can still resolve the correct page
            # and let ecad-viewer obtain the exact painted pin bounds.
            for pin_block in _iter_sexpr_blocks(block, "pin"):
                pin_source_id = _source_id(pin_block)
                if not pin_source_id:
                    continue
                sch_geom[pin_source_id] = _enrich_geometry(
                    {
                        "kind": "pin",
                        "page": page,
                        "x": at[0],
                        "y": at[1],
                        "bounds": symbol_bounds,
                        "parent_source_id": source_id,
                    },
                    source_id=pin_source_id,
                    semantic_index=semantic_index,
                    context="schematic",
                )
        for kind in (
            "wire",
            "bus",
            "polyline",
            "arc",
            "circle",
            "text",
            "text_box",
            "label",
            "global_label",
            "hierarchical_label",
            "junction",
            "no_connect",
        ):
            for block in _iter_sexpr_blocks(text, kind):
                source_id = _source_id(block)
                if not source_id:
                    continue
                points = _points(block)
                at = _point(block, "at")
                if kind in {"label", "global_label", "hierarchical_label"}:
                    geometry_kind = "label"
                elif kind == "junction":
                    geometry_kind = "junction"
                elif kind == "no_connect":
                    geometry_kind = "graphic"
                else:
                    geometry_kind = "wire" if kind in {"wire", "bus"} else "graphic"
                entry: Dict[str, Any] = {
                    "kind": geometry_kind,
                    "page": page,
                }
                if points:
                    entry["points"] = points
                    entry["bounds"] = _bounds(points)
                    entry["x"] = sum(point[0] for point in points) / len(points)
                    entry["y"] = sum(point[1] for point in points) / len(points)
                elif at:
                    entry.update({"x": at[0], "y": at[1], "bounds": [at[0] - 1, at[1] - 1, 2, 2]})
                sch_geom[source_id] = _enrich_geometry(
                    entry,
                    source_id=source_id,
                    semantic_index=semantic_index,
                    context="schematic",
                )

    pcb = next(
        (
            path
            for path in snap.rglob("*.kicad_pcb")
            if not _is_generated_kicad_path(path, snap)
        ),
        None,
    ) if "pcb" in requested else None
    if pcb:
        text = pcb.read_text(encoding="utf-8", errors="replace")
        net_names = {
            int(code): name
            for code, name in re.findall(r'\(net\s+(\d+)\s+"([^"]*)"\)', text)
        }

        def common(block: str, kind: str) -> tuple[Optional[str], Dict[str, Any]]:
            source_id = _source_id(block)
            entry: Dict[str, Any] = {"kind": kind}
            layer = re.search(r'\(layer\s+"([^"]+)"\)', block)
            if layer:
                entry["layer"] = layer.group(1)
            net_code = re.search(r"\(net\s+(\d+)(?:\s|\))", block)
            if net_code:
                entry["net"] = net_names.get(int(net_code.group(1)), "")
            width = re.search(r"\(width\s+([-+0-9.eE]+)\)", block)
            if width:
                entry["width"] = float(width.group(1))
            return source_id, entry

        for block in _iter_sexpr_blocks(text, "segment"):
            source_id, entry = common(block, "track")
            start, end = _point(block, "start"), _point(block, "end")
            if not source_id or not start or not end:
                continue
            entry.update({"points": [start, end], "bounds": _bounds([start, end])})
            pcb_geom[source_id] = _enrich_geometry(
                entry, source_id=source_id, semantic_index=semantic_index, context="pcb"
            )

        for block in _iter_sexpr_blocks(text, "arc"):
            source_id, entry = common(block, "arc")
            start, mid, end = _point(block, "start"), _point(block, "mid"), _point(block, "end")
            if not source_id or not start or not mid or not end:
                continue
            entry.update({"points": [start, mid, end], "bounds": _bounds([start, mid, end])})
            pcb_geom[source_id] = _enrich_geometry(
                entry, source_id=source_id, semantic_index=semantic_index, context="pcb"
            )

        for block in _iter_sexpr_blocks(text, "via"):
            source_id, entry = common(block, "via")
            at = _point(block, "at")
            size = re.search(r"\(size\s+([-+0-9.eE]+)\)", block)
            if not source_id or not at:
                continue
            radius = float(size.group(1)) / 2 if size else 0.3
            layer_pair = re.search(r'\(layers\s+"([^"]+)"\s+"([^"]+)"\)', block)
            entry.update(
                {
                    "x": at[0],
                    "y": at[1],
                    "radius": radius,
                    "bounds": [at[0] - radius, at[1] - radius, radius * 2, radius * 2],
                    "layers": list(layer_pair.groups()) if layer_pair else [],
                }
            )
            pcb_geom[source_id] = _enrich_geometry(
                entry, source_id=source_id, semantic_index=semantic_index, context="pcb"
            )

        for block in _iter_sexpr_blocks(text, "zone"):
            source_id, entry = common(block, "zone")
            points = _points(block)
            if not source_id:
                continue
            entry.update({"points": points, "bounds": _bounds(points)})
            pcb_geom[source_id] = _enrich_geometry(
                entry, source_id=source_id, semantic_index=semantic_index, context="pcb"
            )

        for block in _iter_sexpr_blocks(text, "footprint"):
            source_id, entry = common(block, "footprint")
            at = _point(block, "at")
            rotation = _point_angle(block, "at")
            if not source_id or not at:
                continue
            lib_id = re.match(r'\(footprint\s+"([^"]+)"', block)
            reference_match = re.search(
                r'\(property\s+"Reference"\s+"((?:\\.|[^"\\])*)"',
                block,
            )
            entry.update(
                {
                    "lib_id": lib_id.group(1) if lib_id else "",
                    "reference": reference_match.group(1) if reference_match else "",
                    "x": at[0],
                    "y": at[1],
                    "rotation": rotation or 0,
                    # Used only if native UUID focus is unavailable.
                    "bounds": [at[0] - 5, at[1] - 5, 10, 10],
                }
            )
            pcb_geom[source_id] = _enrich_geometry(
                entry, source_id=source_id, semantic_index=semantic_index, context="pcb"
            )

    return {"schematic": sch_geom, "pcb": pcb_geom}


def _component_source(component: Dict[str, Any], context: str) -> Optional[str]:
    refs = component.get("schematicRefs" if context == "schematic" else "pcbRefs") or []
    if not refs:
        return None
    key = "symbolUuid" if context == "schematic" else "footprintUuid"
    return refs[0].get(key)


def _component_sources(component: Dict[str, Any], context: str = "schematic") -> List[str]:
    refs = component.get("schematicRefs" if context == "schematic" else "pcbRefs") or []
    key = "symbolUuid" if context == "schematic" else "footprintUuid"
    return [str(ref[key]) for ref in refs if ref.get(key)]


def _component_page(component: Dict[str, Any]) -> Optional[str]:
    return next(
        (
            str(ref.get("page"))
            for ref in component.get("schematicRefs") or []
            if ref.get("page")
        ),
        None,
    )


def _native_item(
    *,
    source_id: Optional[str],
    semantic_id: Optional[str],
    page: Optional[str] = None,
    layer: Optional[str] = None,
    reference: Optional[str] = None,
    net: Optional[str] = None,
    parent_source_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not any((source_id, semantic_id, reference, net)):
        return None
    return {
        "source_id": source_id,
        "parent_source_id": parent_source_id,
        "semantic_id": semantic_id,
        "page": page,
        "path": page,
        "layer": layer,
        "reference": reference,
        "net": net,
    }


def _terminal_pairs(index: Dict[str, Any], net_uid: str) -> set[tuple[str, str]]:
    return {
        (str(item.get("reference") or ""), str(item.get("pin") or ""))
        for item in index.get("terminals") or []
        if item.get("netUid") == net_uid
    }


def _semantic_lookups(index: Dict[str, Any]) -> Dict[str, Any]:
    """Build the revision's hot lookup tables once for linear-time matching."""

    terminal_pairs_by_net: Dict[str, set[tuple[str, str]]] = defaultdict(set)
    terminals_by_pair: Dict[tuple[str, str], Dict[str, Any]] = {}
    for terminal in index.get("terminals") or []:
        pair = (
            str(terminal.get("reference") or ""),
            str(terminal.get("pin") or ""),
        )
        net_uid = str(terminal.get("netUid") or "")
        if net_uid:
            terminal_pairs_by_net[net_uid].add(pair)
        terminals_by_pair.setdefault(pair, terminal)

    components_by_reference: Dict[str, Dict[str, Any]] = {}
    components_by_native_key: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for component in index.get("components") or []:
        reference = str(component.get("reference") or "")
        if reference:
            components_by_reference.setdefault(reference, component)
        for key in _component_native_keys(component):
            components_by_native_key[key].append(component)

    return {
        "terminal_pairs_by_net": terminal_pairs_by_net,
        "terminals_by_pair": terminals_by_pair,
        "components_by_reference": components_by_reference,
        "components_by_native_key": components_by_native_key,
    }


def _lookup_terminal_pairs(
    index: Dict[str, Any],
    net_uid: str,
    lookups: Optional[Dict[str, Any]] = None,
) -> set[tuple[str, str]]:
    if lookups is None:
        return _terminal_pairs(index, net_uid)
    return set((lookups.get("terminal_pairs_by_net") or {}).get(str(net_uid), set()))


def _terminal_names(pairs: set[tuple[str, str]]) -> List[str]:
    return sorted(f"{reference}.{pin}" for reference, pin in pairs)


def _net_label_count(net: Optional[Dict[str, Any]]) -> int:
    if not net:
        return 0
    return sum(
        int(ref.get("labelInstanceCount") or 0)
        for ref in net.get("schematicRefs") or []
    )


def _net_source_ids(net: Optional[Dict[str, Any]]) -> List[str]:
    if not net:
        return []
    values: List[str] = []
    for ref in net.get("schematicRefs") or []:
        for bucket in ("wireUuids", "labelUuids", "pinUuids", "junctionUuids"):
            values.extend(str(value) for value in ref.get(bucket) or [] if value)
    return list(dict.fromkeys(values))


def _component_visual_targets(
    component: Optional[Dict[str, Any]],
    *,
    side: str,
    status: str,
) -> List[Dict[str, Any]]:
    if not component:
        return []
    return [
        {
            "side": side,
            "status": status,
            "sourceId": source_id,
            "page": _component_page(component),
            "role": "component",
        }
        for source_id in _component_sources(component)
    ]


def _net_bucket_targets(
    net: Optional[Dict[str, Any]],
    *,
    side: str,
    status: str,
    buckets: Optional[set[str]] = None,
) -> List[Dict[str, Any]]:
    if not net:
        return []
    roles = {
        "wireUuids": "wire",
        "labelUuids": "label",
        "junctionUuids": "junction",
        "pinUuids": "terminal",
    }
    selected = buckets or set(roles)
    targets: List[Dict[str, Any]] = []
    for ref in net.get("schematicRefs") or []:
        page = ref.get("page")
        for bucket, role in roles.items():
            if bucket not in selected:
                continue
            for source_id in ref.get(bucket) or []:
                if not source_id:
                    continue
                targets.append(
                    {
                        "side": side,
                        "status": status,
                        "sourceId": str(source_id),
                        "page": str(page) if page else None,
                        "role": role,
                    }
                )
    return targets


def _terminal_visual_target(
    index: Dict[str, Any],
    pair: tuple[str, str],
    *,
    side: str,
    status: str,
    lookups: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    reference, pin = pair
    if lookups is None:
        terminal = next(
            (
                item
                for item in index.get("terminals") or []
                if str(item.get("reference") or "") == reference
                and str(item.get("pin") or "") == pin
            ),
            None,
        )
        component = next(
            (
                item
                for item in index.get("components") or []
                if str(item.get("reference") or "") == reference
            ),
            None,
        )
    else:
        terminal = (lookups.get("terminals_by_pair") or {}).get(pair)
        component = (lookups.get("components_by_reference") or {}).get(reference)
    source_id = str((terminal or {}).get("schematicPinUuid") or "")
    parent_sources = _component_sources(component or {})
    parent_source_id = parent_sources[0] if parent_sources else None
    if not source_id and not parent_source_id:
        return None
    return {
        "side": side,
        "status": status,
        "sourceId": source_id or parent_source_id,
        "parentSourceId": parent_source_id,
        "page": _component_page(component or {}),
        "role": "terminal" if source_id else "component",
        "reference": reference,
        "pin": pin,
    }


def _dedupe_visual_targets(targets: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    positions: Dict[tuple[str, str, str], int] = {}
    for target in targets:
        key = (
            str(target.get("side") or ""),
            str(target.get("status") or ""),
            str(target.get("sourceId") or ""),
        )
        if not key[2]:
            continue
        if key in positions:
            existing = result[positions[key]]
            existing.update(
                {
                    name: value
                    for name, value in target.items()
                    if value not in (None, "", [])
                }
            )
            continue
        positions[key] = len(result)
        result.append(dict(target))
    return result


def _net_connectivity_fingerprint(
    index: Dict[str, Any],
    net: Dict[str, Any],
    lookups: Optional[Dict[str, Any]] = None,
) -> frozenset[tuple[str, str]]:
    """Cross-revision net identity from terminal/pad membership, not name."""
    return frozenset(
        _lookup_terminal_pairs(
            index,
            str(net.get("netUid") or ""),
            lookups,
        )
    )


def _net_source_id(net: Dict[str, Any], index: Dict[str, Any]) -> Optional[str]:
    """Pick a native paint identity so net-owned geometry enters PROJECT_DIFF."""
    for ref in net.get("schematicRefs") or []:
        for bucket in ("wireUuids", "labelUuids", "pinUuids", "junctionUuids"):
            for uid in ref.get(bucket) or []:
                if uid:
                    return str(uid)
    for ref in net.get("pcbRefs") or []:
        for bucket in ("trackUuids", "arcUuids", "viaUuids", "padUuids", "zoneUuids"):
            for uid in ref.get(bucket) or []:
                if uid:
                    return str(uid)
    net_uid = net.get("netUid")
    for item in index.get("terminals") or []:
        if item.get("netUid") == net_uid and item.get("schematicPinUuid"):
            return str(item["schematicPinUuid"])
        if item.get("netUid") == net_uid and item.get("pcbPadUuid"):
            return str(item["pcbPadUuid"])
    return None


def _component_native_keys(component: Dict[str, Any]) -> set[str]:
    keys: set[str] = set()
    for ref in component.get("schematicRefs") or []:
        uuid = ref.get("symbolUuid")
        if uuid:
            keys.add(f"sch:{uuid}")
    for ref in component.get("pcbRefs") or []:
        uuid = ref.get("footprintUuid")
        if uuid:
            keys.add(f"pcb:{uuid}")
    return keys


def _match_by_keys(
    base_items: List[Dict[str, Any]],
    head_items: List[Dict[str, Any]],
    keys_of,
) -> List[tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]]:
    """Greedy 1:1 match using a prebuilt key index."""
    pairs: List[tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = []
    head_by_key: Dict[str, deque[Dict[str, Any]]] = defaultdict(deque)
    for candidate in head_items:
        for key in keys_of(candidate):
            head_by_key[str(key)].append(candidate)
    used_head: set[int] = set()
    for old in base_items:
        match = None
        for key in sorted(str(value) for value in keys_of(old)):
            candidates = head_by_key.get(key) or []
            while candidates and id(candidates[0]) in used_head:
                candidates.popleft()
            if candidates:
                match = candidates.popleft()
                break
        if match is None:
            pairs.append((old, None))
            continue
        used_head.add(id(match))
        pairs.append((old, match))
    for new in head_items:
        if id(new) not in used_head:
            pairs.append((None, new))
    return pairs


def _summary(changes: List[Dict[str, Any]]) -> Dict[str, int]:
    return {
        "added": sum(1 for change in changes if change["kind"] == "added"),
        "removed": sum(1 for change in changes if change["kind"] == "removed"),
        "changed": sum(1 for change in changes if change["kind"] == "changed"),
    }


def _diff_designs(base: Dict[str, Any], head: Dict[str, Any]) -> Dict[str, Any]:
    """Diff compact kicad-monkey semantic indexes with connectivity-aware matching.

    Components prefer native schematic/PCB UUIDs over refdes so renames become
    modified. Nets prefer terminal/pad fingerprints over name so renames and
    rewires are explicit; name-hash netUid is never treated as a cross-commit UID.
    """
    base_components = [item for item in base.get("components") or [] if item.get("reference")]
    head_components = [item for item in head.get("components") or [] if item.get("reference")]
    base_lookups = _semantic_lookups(base)
    head_lookups = _semantic_lookups(head)
    changes: List[Dict[str, Any]] = []

    def component_change(
        old: Optional[Dict[str, Any]],
        new: Optional[Dict[str, Any]],
        *,
        kind: Optional[str] = None,
        reasons: Optional[List[str]] = None,
        details: Optional[Dict[str, Any]] = None,
        base_sources: Optional[List[str]] = None,
        compare_sources: Optional[List[str]] = None,
        source_side: Optional[str] = None,
        semantic_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        old_reference = str((old or {}).get("reference") or "")
        new_reference = str((new or {}).get("reference") or "")
        reference = new_reference or old_reference
        old_page, new_page = _component_page(old or {}), _component_page(new or {})
        base_ids = base_sources if base_sources is not None else _component_sources(old or {})
        compare_ids = compare_sources if compare_sources is not None else _component_sources(new or {})
        change_kind = kind or ("added" if old is None else "removed" if new is None else "changed")
        resolved_side = source_side or ("reference" if change_kind == "removed" else "comparison")
        base_source = base_ids[0] if base_ids else None
        compare_source = compare_ids[0] if compare_ids else None
        active_source = base_source if resolved_side == "reference" else compare_source or base_source
        resolved_semantic_id = semantic_id or (new or old or {}).get("componentUid") or f"ref:{reference}"
        pages = list(dict.fromkeys(page for page in (old_page, new_page) if page))
        instance_delta = (details or {}).get("instanceCount") or {}
        old_instance_count = instance_delta.get("old")
        new_instance_count = instance_delta.get("new")
        visual_targets: List[Dict[str, Any]] = []
        if change_kind != "added":
            visual_targets.extend(
                {
                    "side": "reference",
                    "status": (
                        "removed"
                        if change_kind == "removed"
                        or (
                            isinstance(old_instance_count, int)
                            and isinstance(new_instance_count, int)
                            and new_instance_count < old_instance_count
                        )
                        else "modified"
                    ),
                    "sourceId": source_id,
                    "page": old_page,
                    "role": "component",
                }
                for source_id in base_ids
            )
        if change_kind != "removed":
            visual_targets.extend(
                {
                    "side": "comparison",
                    "status": (
                        "added"
                        if change_kind == "added"
                        or (
                            isinstance(old_instance_count, int)
                            and isinstance(new_instance_count, int)
                            and new_instance_count > old_instance_count
                        )
                        else "modified"
                    ),
                    "sourceId": source_id,
                    "page": new_page,
                    "role": "component",
                }
                for source_id in compare_ids
            )
        resolved_details = dict(details or {})
        resolved_details["visualTargets"] = _dedupe_visual_targets(visual_targets)
        fields: Dict[str, Any] = {}
        if old is None:
            fields = {
                field: {"old": None, "new": value}
                for field, value in ((new or {}).get("fields") or {}).items()
                if value not in (None, "")
            }
        elif new is not None:
            old_fields = dict(old.get("fields") or {})
            new_fields = dict(new.get("fields") or {})
            if old_reference != new_reference:
                old_fields["Reference"] = old_reference
                new_fields["Reference"] = new_reference
            fields = {
                field: {"old": old_fields.get(field, ""), "new": new_fields.get(field, "")}
                for field in sorted(old_fields.keys() | new_fields.keys())
                if old_fields.get(field, "") != new_fields.get(field, "")
            }
        return {
            "id": f"sch-comp-{change_kind}-{resolved_semantic_id}",
            "kind": change_kind,
            "domain": "schematic",
            "category": "components",
            "classification": "primary",
            "label": reference,
            "reference": reference,
            "semantic_id": resolved_semantic_id,
            "page": new_page or old_page,
            "alsoOnPages": pages,
            "source_id_base": base_source,
            "source_id_compare": compare_source,
            "affected_source_ids_base": base_ids,
            "affected_source_ids_compare": compare_ids,
            "source_side": resolved_side,
            "uuid": active_source,
            "base_item": _native_item(
                source_id=base_source,
                semantic_id=resolved_semantic_id,
                page=old_page,
                reference=old_reference or reference,
            ),
            "compare_item": _native_item(
                source_id=compare_source,
                semantic_id=resolved_semantic_id,
                page=new_page,
                reference=new_reference or reference,
            ),
            "fields": fields,
            "reasons": reasons or (["object-added"] if change_kind == "added" else ["object-removed"]),
            "details": resolved_details,
        }

    # Match native identities first. This preserves renames and lets placement
    # changes disappear when fields, sheet, and connectivity are unchanged.
    native_pairs = _match_by_keys(
        base_components,
        head_components,
        _component_native_keys,
    )
    matched_pairs = [
        (old, new)
        for old, new in native_pairs
        if old is not None and new is not None
    ]
    base_unmatched = [
        old for old, new in native_pairs if old is not None and new is None
    ]
    head_unused = [
        new for old, new in native_pairs if old is None and new is not None
    ]

    for old, new in matched_pairs:
        field_probe = component_change(old, new)
        reasons: List[str] = []
        details: Dict[str, Any] = {}
        if field_probe["fields"]:
            reasons.append("symbol-fields-changed")
            details["fieldDeltas"] = field_probe["fields"]
        old_page, new_page = _component_page(old), _component_page(new)
        if old_page != new_page:
            reasons.append("sheet-changed")
            details["sheetChange"] = {"old": old_page, "new": new_page}
        if _component_sources(old) != _component_sources(new):
            reasons.append("instance-replaced")
        if reasons:
            change = component_change(old, new, reasons=reasons, details=details)
            changes.append(change)

    base_by_ref: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    head_by_ref: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_base_by_ref: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_head_by_ref: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for component in base_unmatched:
        base_by_ref[str(component.get("reference"))].append(component)
    for component in head_unused:
        head_by_ref[str(component.get("reference"))].append(component)
    for component in base_components:
        all_base_by_ref[str(component.get("reference"))].append(component)
    for component in head_components:
        all_head_by_ref[str(component.get("reference"))].append(component)

    for reference in sorted(base_by_ref.keys() | head_by_ref.keys()):
        old_group = sorted(base_by_ref.get(reference, []), key=lambda item: _component_sources(item))
        new_group = sorted(head_by_ref.get(reference, []), key=lambda item: _component_sources(item))
        old_all = all_base_by_ref.get(reference, [])
        new_all = all_head_by_ref.get(reference, [])
        old_count, new_count = len(old_all), len(new_all)
        base_ids = [source for item in old_group for source in _component_sources(item)]
        compare_ids = [source for item in new_group for source in _component_sources(item)]
        semantic_id = (
            str((new_group[0] if len(new_group) == 1 else {}).get("componentUid") or "")
            or str((old_group[0] if len(old_group) == 1 else {}).get("componentUid") or "")
            or f"ref:{reference}"
        )

        if old_count and new_count and old_count != new_count:
            source_side = "comparison" if new_count > old_count else "reference"
            change = component_change(
                old_group[0] if old_group else old_all[0],
                new_group[0] if new_group else new_all[0],
                kind="changed",
                reasons=["instance-count-changed"],
                details={"instanceCount": {"old": old_count, "new": new_count}},
                base_sources=base_ids,
                compare_sources=compare_ids,
                source_side=source_side,
                semantic_id=semantic_id,
            )
            change["affected_source_ids_base"] = [
                source for item in old_all for source in _component_sources(item)
            ]
            change["affected_source_ids_compare"] = [
                source for item in new_all for source in _component_sources(item)
            ]
            change["fields"]["instanceCount"] = {"old": old_count, "new": new_count}
            changes.append(change)
        elif old_group and new_group:
            # Same RefDes, same multiplicity, but no shared native UUID: a
            # copy/paste or delete/recreate operation is a semantic replacement.
            changes.append(
                component_change(
                    old_group[0],
                    new_group[0],
                    kind="changed",
                    reasons=["instance-replaced"],
                    details={"instanceReplacement": {"old": base_ids, "new": compare_ids}},
                    base_sources=base_ids,
                    compare_sources=compare_ids,
                    semantic_id=semantic_id,
                )
            )
        elif old_group:
            change = component_change(
                old_group[0],
                None,
                kind="removed",
                base_sources=base_ids,
                compare_sources=[],
                semantic_id=semantic_id,
            )
            change["details"]["instanceCount"] = {"old": old_count, "new": 0}
            changes.append(change)
        elif new_group:
            change = component_change(
                None,
                new_group[0],
                kind="added",
                base_sources=[],
                compare_sources=compare_ids,
                semantic_id=semantic_id,
            )
            change["details"]["instanceCount"] = {"old": 0, "new": new_count}
            changes.append(change)

    base_nets = [item for item in base.get("nets") or [] if item.get("name")]
    head_nets = [item for item in head.get("nets") or [] if item.get("name")]
    base_by_fp: Dict[frozenset[tuple[str, str]], List[Dict[str, Any]]] = {}
    head_by_fp: Dict[frozenset[tuple[str, str]], List[Dict[str, Any]]] = {}
    for net in base_nets:
        fp = _net_connectivity_fingerprint(base, net, base_lookups)
        if fp:
            base_by_fp.setdefault(fp, []).append(net)
    for net in head_nets:
        fp = _net_connectivity_fingerprint(head, net, head_lookups)
        if fp:
            head_by_fp.setdefault(fp, []).append(net)

    net_pairs: List[tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = []
    used_base: set[int] = set()
    used_head: set[int] = set()

    for fp in sorted(base_by_fp.keys() & head_by_fp.keys(), key=lambda value: sorted(value)):
        base_group = list(base_by_fp[fp])
        head_group = list(head_by_fp[fp])
        # Disambiguate identical connectivity by net name when possible.
        head_by_name: Dict[str, deque[Dict[str, Any]]] = defaultdict(deque)
        unmatched_heads: deque[Dict[str, Any]] = deque()
        for item in head_group:
            head_by_name[str(item.get("name"))].append(item)
            unmatched_heads.append(item)
        for old in base_group:
            named_candidates = head_by_name.get(str(old.get("name")))
            named = named_candidates.popleft() if named_candidates else None
            if named is not None:
                net_pairs.append((old, named))
                used_base.add(id(old))
                used_head.add(id(named))
                continue
            while unmatched_heads and id(unmatched_heads[0]) in used_head:
                unmatched_heads.popleft()
            if unmatched_heads:
                candidate = unmatched_heads.popleft()
                net_pairs.append((old, candidate))
                used_base.add(id(old))
                used_head.add(id(candidate))

    leftover_base_nets = [net for net in base_nets if id(net) not in used_base]
    leftover_head_nets = [net for net in head_nets if id(net) not in used_head]
    by_name_base: Dict[str, deque[Dict[str, Any]]] = defaultdict(deque)
    by_name_head: Dict[str, deque[Dict[str, Any]]] = defaultdict(deque)
    for item in leftover_base_nets:
        by_name_base[str(item.get("name"))].append(item)
    for item in leftover_head_nets:
        by_name_head[str(item.get("name"))].append(item)
    for name in sorted(by_name_base.keys() | by_name_head.keys()):
        old_group = by_name_base.get(name, deque())
        new_group = by_name_head.get(name, deque())
        while old_group or new_group:
            net_pairs.append(
                (
                    old_group.popleft() if old_group else None,
                    new_group.popleft() if new_group else None,
                )
            )

    for old, new in net_pairs:
        name = str((new or old or {}).get("name") or "")
        old_pairs = (
            _lookup_terminal_pairs(base, str(old.get("netUid") or ""), base_lookups)
            if old
            else set()
        )
        new_pairs = (
            _lookup_terminal_pairs(head, str(new.get("netUid") or ""), head_lookups)
            if new
            else set()
        )
        # Prefer compare-side identity for navigation; never use name-hash as UID.
        semantic_id = (new or old or {}).get("netUid")
        base_source = _net_source_id(old, base) if old else None
        compare_source = _net_source_id(new, head) if new else None
        base_sources = _net_source_ids(old)
        compare_sources = _net_source_ids(new)
        base_label_count = _net_label_count(old)
        compare_label_count = _net_label_count(new)
        page = None
        kind = "added" if old is None else "removed" if new is None else "changed"
        fields: Dict[str, Any] = {}
        reasons: List[str] = []
        details: Dict[str, Any] = {}
        if old is not None and new is not None:
            old_name, new_name = str(old.get("name") or ""), str(new.get("name") or "")
            if old_name != new_name:
                fields["name"] = {"old": old_name, "new": new_name}
                reasons.append("net-renamed")
            if old_pairs != new_pairs:
                fields["connections"] = {"old": len(old_pairs), "new": len(new_pairs)}
                reasons.append("connectivity-changed")
                details["connectivity"] = {
                    "addedTerminals": _terminal_names(new_pairs - old_pairs),
                    "removedTerminals": _terminal_names(old_pairs - new_pairs),
                }
            if base_label_count != compare_label_count:
                fields["labelInstances"] = {
                    "old": base_label_count,
                    "new": compare_label_count,
                }
                reasons.append("label-count-changed")
                details["labelInstances"] = {
                    "old": base_label_count,
                    "new": compare_label_count,
                }
            if not reasons:
                continue
        elif kind == "added":
            fields["instances"] = {"old": 0, "new": 1}
            if new_pairs:
                fields["connections"] = {"old": 0, "new": len(new_pairs)}
            details["netInstances"] = {"old": 0, "new": 1}
            reasons.append("object-added")
        elif kind == "removed":
            fields["instances"] = {"old": 1, "new": 0}
            if old_pairs:
                fields["connections"] = {"old": len(old_pairs), "new": 0}
            details["netInstances"] = {"old": 1, "new": 0}
            reasons.append("object-removed")

        visual_targets: List[Dict[str, Any]] = []
        if kind == "added":
            visual_targets.extend(
                _net_bucket_targets(
                    new,
                    side="comparison",
                    status="added",
                )
            )
            visual_targets.extend(
                target
                for pair in new_pairs
                if (
                    target := _terminal_visual_target(
                        head,
                        pair,
                        side="comparison",
                        status="added",
                        lookups=head_lookups,
                    )
                )
            )
        elif kind == "removed":
            visual_targets.extend(
                _net_bucket_targets(
                    old,
                    side="reference",
                    status="removed",
                )
            )
            visual_targets.extend(
                target
                for pair in old_pairs
                if (
                    target := _terminal_visual_target(
                        base,
                        pair,
                        side="reference",
                        status="removed",
                        lookups=base_lookups,
                    )
                )
            )
        else:
            if "net-renamed" in reasons:
                visual_targets.extend(
                    _net_bucket_targets(
                        old,
                        side="reference",
                        status="modified",
                    )
                )
                visual_targets.extend(
                    _net_bucket_targets(
                        new,
                        side="comparison",
                        status="modified",
                    )
                )
            if "connectivity-changed" in reasons:
                visual_targets.extend(
                    target
                    for pair in old_pairs - new_pairs
                    if (
                        target := _terminal_visual_target(
                            base,
                            pair,
                            side="reference",
                            status="removed",
                            lookups=base_lookups,
                        )
                    )
                )
                visual_targets.extend(
                    target
                    for pair in new_pairs - old_pairs
                    if (
                        target := _terminal_visual_target(
                            head,
                            pair,
                            side="comparison",
                            status="added",
                            lookups=head_lookups,
                        )
                    )
                )
            if "label-count-changed" in reasons:
                old_labels = _net_bucket_targets(
                    old,
                    side="reference",
                    status="removed",
                    buckets={"labelUuids"},
                )
                new_labels = _net_bucket_targets(
                    new,
                    side="comparison",
                    status="added",
                    buckets={"labelUuids"},
                )
                old_ids = {str(target["sourceId"]) for target in old_labels}
                new_ids = {str(target["sourceId"]) for target in new_labels}
                visual_targets.extend(
                    target
                    for target in old_labels
                    if str(target["sourceId"]) not in new_ids
                )
                visual_targets.extend(
                    target
                    for target in new_labels
                    if str(target["sourceId"]) not in old_ids
                )

        visual_targets = _dedupe_visual_targets(visual_targets)
        if not visual_targets:
            visual_targets.extend(
                _net_bucket_targets(
                    old,
                    side="reference",
                    status="modified",
                )
            )
            visual_targets.extend(
                _net_bucket_targets(
                    new,
                    side="comparison",
                    status="modified",
                )
            )
            visual_targets = _dedupe_visual_targets(visual_targets)
        details["visualTargets"] = visual_targets
        page = next(
            (
                str(target.get("page"))
                for target in visual_targets
                if target.get("page")
            ),
            None,
        )

        changes.append(
            {
                "id": f"sch-net-{kind}-{semantic_id or name}",
                "kind": kind,
                "domain": "schematic",
                "category": "nets",
                "label": name,
                "net": name,
                "semantic_id": semantic_id,
                "page": page,
                "classification": "primary",
                "source_id_base": base_source,
                "source_id_compare": compare_source,
                "affected_source_ids_base": base_sources,
                "affected_source_ids_compare": compare_sources,
                "source_side": "reference" if kind == "removed" else "comparison",
                "uuid": compare_source or base_source,
                "base_item": _native_item(
                    source_id=base_source, semantic_id=semantic_id, net=name
                ),
                "compare_item": _native_item(
                    source_id=compare_source, semantic_id=semantic_id, net=name
                ),
                "fields": fields,
                "reasons": reasons,
                "details": details,
            }
        )

    return {"changes": changes, "summary": _summary(changes)}


def _geometry_identity(source_id: str, item: Dict[str, Any]) -> str:
    # Prefer semantic identity, then native UUID — never refdes alone across commits.
    if item.get("kind") in {"footprint", "symbol"}:
        return str(item.get("semantic_id") or source_id)
    return source_id


def _geometry_category(item: Dict[str, Any]) -> tuple[str, str]:
    kind = item.get("kind")
    if kind in {"footprint", "symbol"}:
        return "components", "primary"
    if kind in {"track", "arc", "via", "wire"} or (kind == "zone" and item.get("net")):
        return "nets", "primary"
    return "graphics", "secondary"


def _diff_geometry(
    base_geom: Dict[str, Any],
    head_geom: Dict[str, Any],
    domain: str,
) -> List[Dict[str, Any]]:
    base = base_geom.get(domain) or {}
    head = head_geom.get(domain) or {}
    base_by_identity = {_geometry_identity(uid, item): (uid, item) for uid, item in base.items()}
    head_by_identity = {_geometry_identity(uid, item): (uid, item) for uid, item in head.items()}
    changes: List[Dict[str, Any]] = []

    for identity in sorted(base_by_identity.keys() | head_by_identity.keys()):
        base_pair, compare_pair = base_by_identity.get(identity), head_by_identity.get(identity)
        base_source, old = base_pair if base_pair else (None, None)
        compare_source, new = compare_pair if compare_pair else (None, None)
        if old == new:
            continue
        kind = "added" if old is None else "removed" if new is None else "changed"
        item = new or old or {}
        category, classification = _geometry_category(item)
        semantic_id = item.get("semantic_id")
        label = item.get("reference") or item.get("net") or item.get("lib_id") or str(identity)[:12]
        layers = sorted(
            {
                value
                for candidate in (old, new)
                if candidate
                for value in ([candidate.get("layer")] + list(candidate.get("layers") or []))
                if value
            }
        )
        prefix = "sch" if domain == "schematic" else "pcb"
        changes.append(
            {
                "id": f"{prefix}-{kind}-{semantic_id or identity}",
                "kind": kind,
                "domain": domain,
                "category": category,
                "classification": classification,
                "label": label,
                "page": item.get("page"),
                "alsoOnPages": [item["page"]] if item.get("page") else [],
                "reference": item.get("reference"),
                "net": item.get("net"),
                "semantic_id": semantic_id,
                "uuid": compare_source or base_source,
                "source_id_base": base_source,
                "source_id_compare": compare_source,
                "layers": layers,
                "geometry": new,
                "oldGeometry": old,
                "base_item": _native_item(
                    source_id=base_source,
                    semantic_id=semantic_id,
                    page=(old or {}).get("page"),
                    layer=(old or {}).get("layer"),
                    reference=(old or {}).get("reference"),
                    net=(old or {}).get("net"),
                ),
                "compare_item": _native_item(
                    source_id=compare_source,
                    semantic_id=semantic_id,
                    page=(new or {}).get("page"),
                    layer=(new or {}).get("layer"),
                    reference=(new or {}).get("reference"),
                    net=(new or {}).get("net"),
                ),
            }
        )
    return changes


def _merge_semantic_geometry_changes(
    semantic_changes: List[Dict[str, Any]],
    geometry_changes: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Fold duplicate component records into the exact native geometry record.

    kicad-monkey owns semantic identity and field changes, while the granular
    extractor owns the source filename and exact native geometry. A component
    addition/removal can be reported by both adapters; presenting both creates
    duplicate review rows and can select kicad-monkey's hierarchy label instead
    of the renderable KiCad filename. Keep one record with data from both.
    """
    geometry_by_semantic: Dict[str, Dict[str, Any]] = {
        str(change["semantic_id"]): change
        for change in geometry_changes
        if change.get("category") == "components" and change.get("semantic_id")
    }
    merged_geometry_ids: set[int] = set()
    merged: List[Dict[str, Any]] = []

    for semantic in semantic_changes:
        semantic_id = semantic.get("semantic_id")
        native = (
            geometry_by_semantic.get(str(semantic_id))
            if semantic_id and semantic.get("category") == "components"
            else None
        )
        if not native:
            merged.append(semantic)
            continue

        merged_geometry_ids.add(id(native))
        combined = {**semantic, **native}
        combined["id"] = semantic["id"]
        combined["category"] = semantic["category"]
        combined["classification"] = semantic.get("classification", "primary")
        combined["label"] = semantic["label"]
        combined["reference"] = semantic.get("reference")
        combined["net"] = semantic.get("net")
        combined["reasons"] = semantic.get("reasons") or []
        combined["details"] = semantic.get("details") or {}
        combined["kind"] = (
            semantic["kind"]
            if semantic["kind"] == native["kind"]
            else "changed"
        )
        combined["fields"] = {
            **(native.get("fields") or {}),
            **(semantic.get("fields") or {}),
        }
        combined["source_id_base"] = (
            native.get("source_id_base") or semantic.get("source_id_base")
        )
        combined["source_id_compare"] = (
            native.get("source_id_compare") or semantic.get("source_id_compare")
        )
        combined["base_item"] = native.get("base_item") or semantic.get("base_item")
        combined["compare_item"] = native.get("compare_item") or semantic.get("compare_item")
        combined["page"] = native.get("page") or semantic.get("page")
        combined["alsoOnPages"] = list(
            dict.fromkeys(
                [
                    value
                    for value in (
                        *(native.get("alsoOnPages") or []),
                        *(semantic.get("alsoOnPages") or []),
                    )
                    if value
                ]
            )
        )
        merged.append(combined)

    merged.extend(
        change
        for change in geometry_changes
        if id(change) not in merged_geometry_ids
        and change.get("classification") == "secondary"
        and change.get("kind") in {"added", "removed"}
    )
    return merged


def _hydrate_visual_target_pages_and_match_labels(
    changes: List[Dict[str, Any]],
    base_geometry: Dict[str, Any],
    compare_geometry: Dict[str, Any],
) -> None:
    """Attach source pages and remove deterministically matched label churn."""

    def geometry_for(target: Dict[str, Any]) -> Dict[str, Any]:
        index = base_geometry if target.get("side") == "reference" else compare_geometry
        return (
            index.get(target.get("sourceId"))
            or index.get(target.get("parentSourceId"))
            or {}
        )

    def center(target: Dict[str, Any]) -> tuple[float, float]:
        geometry = geometry_for(target)
        bounds = geometry.get("bounds") or []
        if len(bounds) == 4:
            return (
                float(bounds[0]) + float(bounds[2]) / 2,
                float(bounds[1]) + float(bounds[3]) / 2,
            )
        return (float(geometry.get("x") or 0), float(geometry.get("y") or 0))

    for change in changes:
        details = change.get("details") or {}
        targets = list(details.get("visualTargets") or [])
        for target in targets:
            # Semantic extraction names a sheet by its human hierarchy
            # (for example "/S32G399/Boot & Low Speed Interfaces/"). Native
            # rendering must load the actual KiCad filename. Preserve the
            # hierarchy separately, then make `page` the paintable document
            # identity resolved from the source UUID's geometry sidecar.
            geometry_page = geometry_for(target).get("page")
            semantic_page = target.get("page")
            if geometry_page:
                if semantic_page and semantic_page != geometry_page:
                    target["sheetPath"] = str(semantic_page)
                target["page"] = str(geometry_page)

        if "label-count-changed" not in (change.get("reasons") or []):
            details["visualTargets"] = targets
            continue
        removed = [
            target
            for target in targets
            if target.get("role") == "label" and target.get("side") == "reference"
        ]
        added = [
            target
            for target in targets
            if target.get("role") == "label" and target.get("side") == "comparison"
        ]
        paired: set[int] = set()
        removed_pairs: set[int] = set()
        for old_target in sorted(removed, key=lambda target: str(target.get("sourceId"))):
            old_page = old_target.get("sheetPath") or old_target.get("page")
            old_center = center(old_target)
            candidates = [
                (index, target)
                for index, target in enumerate(added)
                if index not in paired
                and (
                    not old_page
                    or not (target.get("sheetPath") or target.get("page"))
                    or (target.get("sheetPath") or target.get("page")) == old_page
                )
            ]
            if not candidates:
                continue
            match_index, _match = min(
                candidates,
                key=lambda candidate: (
                    math.hypot(
                        center(candidate[1])[0] - old_center[0],
                        center(candidate[1])[1] - old_center[1],
                    ),
                    str(candidate[1].get("sourceId")),
                ),
            )
            paired.add(match_index)
            removed_pairs.add(id(old_target))
        details["visualTargets"] = [
            target
            for target in targets
            if id(target) not in removed_pairs
            and not (
                target.get("role") == "label"
                and target.get("side") == "comparison"
                and target in [added[index] for index in paired]
            )
        ]


def _arc_length(points: List[List[float]]) -> float:
    if len(points) != 3:
        return 0.0
    (ax, ay), (bx, by), (cx, cy) = points
    determinant = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(determinant) < 1e-9:
        return math.hypot(cx - ax, cy - ay)
    ux = (
        (ax * ax + ay * ay) * (by - cy)
        + (bx * bx + by * by) * (cy - ay)
        + (cx * cx + cy * cy) * (ay - by)
    ) / determinant
    uy = (
        (ax * ax + ay * ay) * (cx - bx)
        + (bx * bx + by * by) * (ax - cx)
        + (cx * cx + cy * cy) * (bx - ax)
    ) / determinant
    radius = math.hypot(ax - ux, ay - uy)
    start = math.atan2(ay - uy, ax - ux)
    middle = math.atan2(by - uy, bx - ux)
    end = math.atan2(cy - uy, cx - ux)
    ccw = (end - start) % (2 * math.pi)
    mid_ccw = (middle - start) % (2 * math.pi)
    sweep = ccw if mid_ccw <= ccw else (2 * math.pi - ccw)
    return radius * sweep


def _route_metrics(geometry: Dict[str, Any], stackup: Dict[str, Any]) -> Dict[str, Any]:
    metrics: Dict[str, Dict[str, Any]] = {}
    stack_layers = stackup.get("layers") or []

    def via_span(item: Dict[str, Any]) -> Optional[float]:
        endpoints = item.get("layers") or []
        if len(endpoints) != 2:
            return None
        indexes = {
            str(layer.get("name")): index
            for index, layer in enumerate(stack_layers)
            if layer.get("name")
        }
        if endpoints[0] not in indexes or endpoints[1] not in indexes:
            return None
        start, end = sorted((indexes[endpoints[0]], indexes[endpoints[1]]))
        thicknesses = [
            layer.get("thickness")
            for layer in stack_layers[start:end + 1]
        ]
        if not thicknesses or not all(
            isinstance(value, (int, float)) for value in thicknesses
        ):
            return None
        return float(sum(thicknesses))

    for item in (geometry.get("pcb") or {}).values():
        net = str(item.get("net") or "").strip()
        if not net:
            continue
        current = metrics.setdefault(
            net,
            {
                "centerline_length_mm": 0.0,
                "via_count": 0,
                "used_layers": set(),
                "via_barrel_length_mm": 0.0,
                "_barrel_reliable": True,
            },
        )
        if item.get("kind") == "track" and len(item.get("points") or []) >= 2:
            start, end = item["points"][0], item["points"][-1]
            current["centerline_length_mm"] += math.hypot(end[0] - start[0], end[1] - start[1])
        elif item.get("kind") == "arc":
            current["centerline_length_mm"] += _arc_length(item.get("points") or [])
        elif item.get("kind") == "via":
            current["via_count"] += 1
            span = via_span(item)
            if span is None:
                current["_barrel_reliable"] = False
            else:
                current["via_barrel_length_mm"] += span
        if item.get("layer"):
            current["used_layers"].add(item["layer"])
        current["used_layers"].update(item.get("layers") or [])
    for value in metrics.values():
        value["centerline_length_mm"] = round(value["centerline_length_mm"], 4)
        barrel_reliable = value.pop("_barrel_reliable")
        if not barrel_reliable:
            value["via_barrel_length_mm"] = None
        else:
            value["via_barrel_length_mm"] = round(value["via_barrel_length_mm"], 4)
        value["used_layers"] = sorted(value["used_layers"])
        value["propagation_delay"] = None
        value["diagnostics"] = ["Propagation delay is not available from source geometry."]
        if not barrel_reliable and value["via_count"]:
            value["diagnostics"].append(
                "Via barrel length is unavailable because the via span or stack thickness is incomplete."
            )
    return metrics


def _group_changes(changes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    normalized_changes: List[Dict[str, Any]] = []
    for original in changes:
        change = dict(original)
        if change.get("net") or set(change.get("reasons") or []) & {
            "connectivity-changed",
            "net-renamed",
            "label-count-changed",
        }:
            change["category"] = "nets"
        normalized_changes.append(change)
    for change in normalized_changes:
        identity = (
            change.get("semantic_id")
            or change.get("reference")
            or change.get("net")
            or change["id"]
        )
        buckets.setdefault(f"{change['category']}:{identity}", []).append(change)
    groups = []
    for key, members in buckets.items():
        kinds = {member["kind"] for member in members}
        status = next(iter(kinds)) if len(kinds) == 1 else "changed"
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]
        old_bounds = [
            (member.get("oldGeometry") or {}).get("bounds")
            for member in members
            if (member.get("oldGeometry") or {}).get("bounds")
        ]
        new_bounds = [
            (member.get("geometry") or {}).get("bounds")
            for member in members
            if (member.get("geometry") or {}).get("bounds")
        ]
        old_points = [
            (
                (member.get("oldGeometry") or {}).get("x"),
                (member.get("oldGeometry") or {}).get("y"),
            )
            for member in members
            if (member.get("oldGeometry") or {}).get("x") is not None
            and (member.get("oldGeometry") or {}).get("y") is not None
        ]
        new_points = [
            (
                (member.get("geometry") or {}).get("x"),
                (member.get("geometry") or {}).get("y"),
            )
            for member in members
            if (member.get("geometry") or {}).get("x") is not None
            and (member.get("geometry") or {}).get("y") is not None
        ]
        position_delta = None
        if old_points and new_points:
            old_x = sum(point[0] for point in old_points) / len(old_points)
            old_y = sum(point[1] for point in old_points) / len(old_points)
            new_x = sum(point[0] for point in new_points) / len(new_points)
            new_y = sum(point[1] for point in new_points) / len(new_points)
            position_delta = {
                "dx": round(new_x - old_x, 4),
                "dy": round(new_y - old_y, 4),
                "distance": round(math.hypot(new_x - old_x, new_y - old_y), 4),
            }
        groups.append(
            {
                "id": f"grp:{digest}",
                "category": members[0]["category"],
                "status": status,
                "classification": (
                    "secondary"
                    if all(member.get("classification") == "secondary" for member in members)
                    else "primary"
                ),
                "label": members[0]["label"],
                "semantic_id": members[0].get("semantic_id"),
                "members": [member["id"] for member in members],
                "reasons": list(
                    dict.fromkeys(
                        reason
                        for member in members
                        for reason in member.get("reasons") or []
                    )
                ),
                "details": {
                    key: value
                    for member in members
                    for key, value in (member.get("details") or {}).items()
                },
                "old_fields": {
                    field: value.get("old")
                    for member in members
                    for field, value in (member.get("fields") or {}).items()
                    if isinstance(value, dict)
                },
                "new_fields": {
                    field: value.get("new")
                    for member in members
                    for field, value in (member.get("fields") or {}).items()
                    if isinstance(value, dict)
                },
                "position_delta": position_delta,
                "geometry_bounds": {
                    "base": old_bounds,
                    "compare": new_bounds,
                },
                "unresolved_thread_count": 0,
            }
        )
    return sorted(groups, key=lambda group: (group["classification"], group["category"], group["label"]))


def _diff_stackup(base: Dict[str, Any], head: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "base": base.get("layers") or [],
        "head": head.get("layers") or [],
        "changed": json.dumps(base.get("layers") or [], sort_keys=True)
        != json.dumps(head.get("layers") or [], sort_keys=True),
        "present": bool(base.get("present") or head.get("present")),
    }


_STALE_JOB_SECONDS = int(os.environ.get("PRISM_DESIGN_COMPARE_STALE_SECONDS", "300"))


def _build_revisions(
    project_id: str,
    repo_path: Path,
    relative_path: str,
    base: str,
    head: str,
    heartbeat: Callable[[str, Optional[float]], None],
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> tuple[Dict[str, Dict[str, Any]], Dict[str, List[str]]]:
    """Build the requested snapshots with bounded, newest-independent workers."""
    unique_commits = list(dict.fromkeys((base, head)))
    try:
        configured_workers = int(
            os.environ.get("PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS", "2")
        )
    except ValueError:
        configured_workers = 2
    max_workers = max(1, min(2, configured_workers, len(unique_commits)))
    revision_labels = {
        commit: (
            "old/new"
            if base == head
            else "old"
            if commit == base
            else "new"
        )
        for commit in unique_commits
    }
    revisions: Dict[str, Dict[str, Any]] = {}
    revision_logs: Dict[str, List[str]] = {}
    state_lock = threading.Lock()
    completed = 0

    def build_revision(commit: str) -> tuple[Dict[str, Any], List[str]]:
        local_logs: List[str] = []

        def report(message: str) -> None:
            with state_lock:
                progress = 15 + completed * 20
            heartbeat(
                f"{revision_labels[commit].capitalize()}: {message}",
                progress,
            )

        load_arguments = {
            "on_progress": report,
        }
        if benchmark is not None:
            load_arguments["benchmark"] = benchmark
        revision = _load_or_build_revision(
            project_id,
            repo_path,
            relative_path,
            commit,
            local_logs,
            **load_arguments,
        )
        return revision, local_logs

    heartbeat(
        "Building old and new revisions…"
        if len(unique_commits) == 2 and max_workers == 2
        else "Building revisions…",
        15,
    )
    executor = ThreadPoolExecutor(
        max_workers=max_workers,
        thread_name_prefix="design-compare-revision",
    )
    futures = {
        executor.submit(build_revision, commit): commit
        for commit in unique_commits
    }
    try:
        for future in as_completed(futures):
            commit = futures[future]
            revision, local_logs = future.result()
            revisions[commit] = revision
            revision_logs[commit] = local_logs
            with state_lock:
                completed += 1
                progress = 15 + completed * 20
            heartbeat(
                f"{revision_labels[commit].capitalize()} revision ready",
                progress,
            )
    except Exception:
        for future in futures:
            future.cancel()
        raise
    finally:
        executor.shutdown(wait=True, cancel_futures=True)

    return revisions, revision_logs


def _stage_worker_count(stage: str, revision_count: int) -> int:
    # Both stages are bounded at two. Stage 1 overlaps the two independent
    # schematic compiles; Stage 2 runs only lightweight source-geometry scans
    # after parser sessions have been released (no concurrent PCB ASTs).
    defaults = {"initial": 2, "pcb": 2}
    variable = {
        "initial": "PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS",
        "pcb": "PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS",
    }[stage]
    configured_value = os.environ.get(
        variable,
        os.environ.get(
            "PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS",
            str(defaults[stage]),
        ),
    )
    try:
        configured = int(configured_value)
    except ValueError:
        configured = defaults[stage]
    return max(1, min(2, configured, revision_count))


def _revision_processes_enabled() -> bool:
    """Whether the two revisions are compiled in separate processes.

    Stage 1 is pure CPU work -- lexing and parsing schematics -- so running
    the two revisions on threads leaves them serialised behind the GIL and
    the pool buys nothing. Processes are the default for that reason; the
    switch exists so a constrained deployment can go back to one address
    space, and so the unit tests can stay in-process.
    """
    raw = os.environ.get("PRISM_DESIGN_COMPARE_REVISION_PROCESSES", "1").strip()
    return raw.lower() not in {"0", "false", "no", "off"}


def _initial_revision_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build one initial revision, callable from a worker process.

    Everything crossing the boundary has to pickle, so the caller's logs
    list, progress callback and benchmark recorder cannot come along. The
    worker collects its own and hands them back for the parent to merge.
    """
    logs: List[str] = []
    benchmark: Optional[DesignCompareBenchmark] = None
    if payload.get("benchmark_job_id"):
        benchmark = DesignCompareBenchmark(job_id=payload["benchmark_job_id"])

    revision = _load_or_build_initial_revision(
        payload["project_id"],
        Path(payload["repo_path"]),
        payload["relative_path"],
        payload["commit"],
        logs,
        benchmark=benchmark,
    )
    return {
        "revision": revision,
        "logs": logs,
        "events": benchmark.drain_events() if benchmark is not None else [],
    }


def _build_initial_revisions(
    project_id: str,
    repo_path: Path,
    relative_path: Optional[str],
    base: str,
    head: str,
    heartbeat: Callable[[str, Optional[float]], None],
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> tuple[
    Dict[str, Dict[str, Any]],
    Dict[str, List[str]],
]:
    unique_commits = list(dict.fromkeys((base, head)))
    max_workers = _stage_worker_count("initial", len(unique_commits))
    revisions: Dict[str, Dict[str, Any]] = {}
    revision_logs: Dict[str, List[str]] = {}
    completed = 0
    state_lock = threading.Lock()

    def build(commit: str) -> tuple[Dict[str, Any], List[str]]:
        local_logs: List[str] = []

        def report(message: str) -> None:
            with state_lock:
                progress = 10 + completed * 18
            heartbeat(f"Initial {commit[:7]}: {message}", progress)

        revision = _load_or_build_initial_revision(
            project_id,
            repo_path,
            relative_path,
            commit,
            local_logs,
            on_progress=report,
            benchmark=benchmark,
        )
        return revision, local_logs

    heartbeat("Building Schematic and BOM assets…", 10)

    use_processes = max_workers > 1 and _revision_processes_enabled()
    if use_processes:
        # `spawn` rather than the Linux default `fork`: this runs inside a
        # threaded server, and forking a process that holds locks in other
        # threads is a deadlock waiting to happen.
        executor = ProcessPoolExecutor(
            max_workers=max_workers,
            mp_context=multiprocessing.get_context("spawn"),
        )
        submit = lambda commit: executor.submit(  # noqa: E731
            _initial_revision_task,
            {
                "project_id": project_id,
                "repo_path": str(repo_path),
                "relative_path": relative_path,
                "commit": commit,
                "benchmark_job_id": benchmark.job_id if benchmark is not None else None,
            },
        )
    else:
        executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="design-compare-initial",
        )
        submit = lambda commit: executor.submit(build, commit)  # noqa: E731

    stage_started_ms = time.perf_counter() * 1000
    try:
        futures = {submit(commit): commit for commit in unique_commits}
        try:
            for future in as_completed(futures):
                commit = futures[future]
                result = future.result()
                if use_processes:
                    revision = result["revision"]
                    local_logs = result["logs"]
                    if benchmark is not None and result["events"]:
                        benchmark.absorb_events(
                            result["events"],
                            offset_ms=stage_started_ms - benchmark.started_ms,
                            thread=f"design-compare-initial-{commit[:7]}",
                        )
                else:
                    revision, local_logs = result
                revisions[commit] = revision
                revision_logs[commit] = local_logs
                with state_lock:
                    completed += 1
                    progress = 10 + completed * 18
                heartbeat(f"Schematic and BOM ready for {commit[:7]}", progress)
        except Exception:
            for future in futures:
                future.cancel()
            raise
    finally:
        executor.shutdown(wait=True)
    return revisions, revision_logs


def _build_pcb_revisions(
    project_id: str,
    base: str,
    head: str,
    initial_revisions: Dict[str, Dict[str, Any]],
    heartbeat: Callable[[str, Optional[float]], None],
    benchmark: Optional[DesignCompareBenchmark] = None,
) -> tuple[Dict[str, Dict[str, Any]], Dict[str, List[str]]]:
    unique_commits = list(dict.fromkeys((base, head)))
    max_workers = _stage_worker_count("pcb", len(unique_commits))
    revisions: Dict[str, Dict[str, Any]] = {}
    revision_logs: Dict[str, List[str]] = {}
    completed = 0
    state_lock = threading.Lock()

    def build(commit: str) -> tuple[Dict[str, Any], List[str]]:
        local_logs: List[str] = []

        def report(message: str) -> None:
            with state_lock:
                progress = 60 + completed * 16
            heartbeat(f"Background {commit[:7]}: {message}", progress)

        revision = _load_or_build_pcb_revision(
            project_id,
            commit,
            initial_revisions[commit],
            local_logs,
            on_progress=report,
            benchmark=benchmark,
        )
        return revision, local_logs

    heartbeat("Schematic and BOM ready; building PCB and Stackup in background…", 60)
    with ThreadPoolExecutor(
        max_workers=max_workers,
        thread_name_prefix="design-compare-pcb",
    ) as executor:
        futures = {executor.submit(build, commit): commit for commit in unique_commits}
        try:
            for future in as_completed(futures):
                commit = futures[future]
                revision, local_logs = future.result()
                revisions[commit] = revision
                revision_logs[commit] = local_logs
                with state_lock:
                    completed += 1
                    progress = 60 + completed * 16
                heartbeat(f"PCB and Stackup ready for {commit[:7]}", progress)
        except Exception:
            for future in futures:
                future.cancel()
            raise
    return revisions, revision_logs


def _revision_bom_rows(revision: Dict[str, Any]) -> List[Dict[str, str]]:
    rows = revision.get("bom_rows")
    if isinstance(rows, list):
        return rows
    return bom_diff_service.parse_bom_csv(revision.get("bom_csv") or "")


def _comparison_bom_fields(project_id: str, head: str) -> List[str]:
    fields = ["Reference", "Value", "Footprint", "Datasheet"]
    try:
        cfg_path = _cache_dir(project_id, head) / "snapshot" / ".prism.json"
        if cfg_path.exists():
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            fields = cfg.get("bom", {}).get("fields") or fields
    except Exception:
        pass
    return fields


def _assemble_initial_comparison(
    *,
    project_id: str,
    base: str,
    head: str,
    revisions: Dict[str, Dict[str, Any]],
    include_unchanged: bool,
    benchmark: DesignCompareBenchmark,
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    def assemble(phase: str, action: Callable[[], Any]) -> Any:
        with benchmark.span(phase, scope="assembly:initial"):
            return action()

    base_rev = revisions[base]
    head_rev = revisions[head]
    sch_diff = assemble(
        "schematic-semantic-diff",
        lambda: _diff_designs(base_rev.get("semantic") or {}, head_rev.get("semantic") or {}),
    )
    sch_geometry_changes = assemble(
        "schematic-geometry-diff",
        lambda: _diff_geometry(
            base_rev.get("geometry") or {},
            head_rev.get("geometry") or {},
            "schematic",
        ),
    )
    schematic_changes = assemble(
        "schematic-change-merge",
        lambda: _merge_semantic_geometry_changes(sch_diff["changes"], sch_geometry_changes),
    )
    assemble(
        "visual-target-hydration",
        lambda: _hydrate_visual_target_pages_and_match_labels(
            schematic_changes,
            (base_rev.get("geometry") or {}).get("schematic") or {},
            (head_rev.get("geometry") or {}).get("schematic") or {},
        ),
    )
    bom = assemble(
        "bom-diff",
        lambda: bom_diff_service.diff_boms(
            _revision_bom_rows(base_rev),
            _revision_bom_rows(head_rev),
            _comparison_bom_fields(project_id, head),
            include_unchanged=include_unchanged,
        ),
    )
    source_files = {
        "base": base_rev.get("sources") or [],
        "head": head_rev.get("sources") or [],
    }
    empty_pcb_changes: List[Dict[str, Any]] = []
    document_diff = assemble(
        "document-diff",
        lambda: document_diff_service.build_project_diff(
            schematic_changes=schematic_changes,
            pcb_changes=empty_pcb_changes,
            files=source_files,
            geometry={
                "base": base_rev.get("geometry") or {},
                "head": head_rev.get("geometry") or {},
            },
        ),
    )
    sheets = sorted(
        {
            Path(source["filename"]).name
            for source in source_files["base"] + source_files["head"]
            if source["filename"].endswith(".kicad_sch")
        }
    )
    result = {
        "schema": "prism.semantic_comparison_v3",
        "base": base,
        "head": head,
        "compare": head,
        "diagnostics": [],
        "readiness": {
            "stage": "initial-ready",
            "domains": {
                "schematic": "ready",
                "bom": "ready",
                "pcb": "building",
                "stackup": "building",
            },
        },
        "files": source_files,
        "document_diff": document_diff,
        "schematic": {
            "pages": sheets,
            "changes": schematic_changes,
            "groups": assemble("schematic-grouping", lambda: _group_changes(schematic_changes)),
            "summary": _summary(schematic_changes),
        },
        "pcb": {
            "changes": [],
            "groups": [],
            "summary": {"added": 0, "removed": 0, "changed": 0},
            "route_metrics": {"base": {}, "compare": {}},
        },
        "bom": bom,
        "stackup": {"base": [], "head": [], "changed": False, "present": False},
    }
    state = {"schematic_changes": schematic_changes}
    return result, state


def _complete_comparison(
    *,
    initial_result: Dict[str, Any],
    assembly_state: Dict[str, Any],
    base: str,
    head: str,
    revisions: Dict[str, Dict[str, Any]],
    benchmark: DesignCompareBenchmark,
) -> Dict[str, Any]:
    def assemble(phase: str, action: Callable[[], Any]) -> Any:
        with benchmark.span(phase, scope="assembly:pcb"):
            return action()

    base_rev = revisions[base]
    head_rev = revisions[head]
    pcb_changes = assemble(
        "pcb-geometry-diff",
        lambda: _diff_geometry(
            base_rev.get("geometry") or {},
            head_rev.get("geometry") or {},
            "pcb",
        ),
    )
    stackup = assemble(
        "stackup-diff",
        lambda: _diff_stackup(base_rev.get("stackup") or {}, head_rev.get("stackup") or {}),
    )
    route_metrics = assemble(
        "route-metrics",
        lambda: {
            "base": _route_metrics(base_rev.get("geometry") or {}, base_rev.get("stackup") or {}),
            "compare": _route_metrics(head_rev.get("geometry") or {}, head_rev.get("stackup") or {}),
        },
    )
    source_files = initial_result["files"]
    schematic_changes = assembly_state["schematic_changes"]
    document_diff = assemble(
        "document-diff",
        lambda: document_diff_service.build_project_diff(
            schematic_changes=schematic_changes,
            pcb_changes=pcb_changes,
            files=source_files,
            geometry={
                "base": base_rev.get("geometry") or {},
                "head": head_rev.get("geometry") or {},
            },
        ),
    )
    return {
        **initial_result,
        "readiness": {
            "stage": "complete",
            "domains": {
                "schematic": "ready",
                "bom": "ready",
                "pcb": "ready",
                "stackup": "ready",
            },
        },
        "document_diff": document_diff,
        "pcb": {
            "changes": pcb_changes,
            "groups": assemble("pcb-grouping", lambda: _group_changes(pcb_changes)),
            "summary": _summary(pcb_changes),
            "route_metrics": route_metrics,
        },
        "stackup": stackup,
    }


def _prepare_comparison_bundle(
    context: JobContext,
    result: Dict[str, Any],
    *,
    artifact_key: str,
) -> tuple[Any, tuple[Any, ...]]:
    """Split the completed result into immutable, independently served sidecars."""

    core = {
        key: result.get(key)
        for key in (
            "schema",
            "base",
            "head",
            "compare",
            "diagnostics",
            "readiness",
            "files",
        )
    }
    payloads = {
        "core": core,
        "schematic": result.get("schematic") or {},
        "pcb": result.get("pcb") or {},
        "bom": result.get("bom"),
        "stackup": result.get("stackup") or {},
        "document_diff": result.get("document_diff") or {},
    }
    sidecars = []
    manifest_sidecars: Dict[str, Dict[str, Any]] = {}
    for name, payload in payloads.items():
        prepared = job_artifacts.prepare_json(
            context,
            payload,
            kind="design_compare_sidecar",
            artifact_key=f"{artifact_key}:sidecar:{name}",
            schema_version=str(result.get("schema") or ""),
            generator_version=semantic_index_service.generator_cache_tag(),
            readiness="sidecar",
        )
        sidecars.append(prepared)
        manifest_sidecars[name] = {
            "digest": prepared.digest,
            "sizeBytes": prepared.size_bytes,
            "mediaType": prepared.media_type,
        }

    manifest = {
        "schema": "prism.design_compare_bundle_v1",
        "resultSchema": result.get("schema"),
        "base": result.get("base"),
        "head": result.get("head"),
        "compare": result.get("compare"),
        "readiness": result.get("readiness"),
        "domains": {
            name: {
                "summary": (
                    (result.get(name) or {}).get("summary")
                    if isinstance(result.get(name), dict)
                    else None
                ),
                "changeCount": len((result.get(name) or {}).get("changes") or [])
                if isinstance(result.get(name), dict)
                else 0,
                "groupCount": len((result.get(name) or {}).get("groups") or [])
                if isinstance(result.get(name), dict)
                else 0,
            }
            for name in ("schematic", "pcb", "bom", "stackup")
        },
        "sidecars": manifest_sidecars,
    }
    primary = job_artifacts.prepare_json(
        context,
        manifest,
        kind="design_compare",
        artifact_key=artifact_key,
        schema_version="prism.design_compare_bundle_v1",
        generator_version=semantic_index_service.generator_cache_tag(),
        readiness="ready",
    )
    return primary, tuple(sidecars)


def _publish_comparison_result(
    job_id: str,
    job: Dict[str, Any],
    result: Dict[str, Any],
    *,
    version: int,
    benchmark: DesignCompareBenchmark,
) -> Path:
    result_path = _JOB_ROOT / job_id / "result.json"
    with benchmark.span(f"result-publish-v{version}"):
        _atomic_write_json(result_path, result)
    job["result"] = result
    job["result_version"] = version
    job["readiness"] = result["readiness"]
    job["ready_domains"] = [
        domain
        for domain, status in result["readiness"]["domains"].items()
        if status == "ready"
    ]
    return result_path


def _run_job(
    job_id: str,
    project_id: str,
    base: str,
    head: str,
    include_unchanged: bool,
) -> None:
    """Legacy in-process runner retained for unit tests only.

    Production work is enqueued through ``start_design_compare_job`` and executed
    by ``run_design_compare_job_v3`` inside ``prism-worker``.
    """

    job = design_compare_jobs[job_id]
    logs: List[str] = job.setdefault("logs", [])
    job_lock = threading.Lock()
    job_started = time.perf_counter()
    benchmark = DesignCompareBenchmark(
        job_id=job_id,
        metadata={
            "projectId": project_id,
            "base": base,
            "compare": head,
            "initialWorkers": _stage_worker_count("initial", len(set((base, head)))),
            "pcbWorkers": _stage_worker_count("pcb", len(set((base, head)))),
            "semanticGenerator": semantic_index_service.generator_cache_tag(),
            "pipeline": "staged-domain-v1",
        },
    )

    def heartbeat(message: str, percent: Optional[float] = None) -> None:
        with job_lock:
            job["message"] = message
            if percent is not None:
                job["percent"] = percent
            job["logs"] = logs[-40:]
            _persist_job(job_id)

    def append_revision_logs(
        revision_logs: Dict[str, List[str]],
        *,
        stage: str,
    ) -> None:
        for commit in dict.fromkeys((base, head)):
            side = "old/new" if base == head else "old" if commit == base else "new"
            logs.extend(
                f"[{stage}:{side}] {message}"
                for message in revision_logs.get(commit, [])
            )

    try:
        repo_path, relative_path, _checkout = _repo_paths(project_id)
        initial_started = time.perf_counter()
        with benchmark.span("initial-revision-pipeline"):
            initial_revisions, initial_logs = _build_initial_revisions(
                project_id,
                repo_path,
                relative_path,
                base,
                head,
                heartbeat,
                benchmark=benchmark,
            )
        append_revision_logs(initial_logs, stage="initial")

        heartbeat("Assembling Schematic and BOM differences…", 50)
        initial_result, assembly_state = _assemble_initial_comparison(
            project_id=project_id,
            base=base,
            head=head,
            revisions=initial_revisions,
            include_unchanged=include_unchanged,
            benchmark=benchmark,
        )
        result_path = _publish_comparison_result(
            job_id,
            job,
            initial_result,
            version=1,
            benchmark=benchmark,
        )
        initial_elapsed = time.perf_counter() - initial_started
        logs.append(f"Timing initial ready: {initial_elapsed:.3f}s")
        benchmark.update_metadata(initialReadyMs=round(initial_elapsed * 1000, 3))
        heartbeat(
            "Schematic and BOM ready; building PCB and Stackup in background…",
            60,
        )
        with benchmark.span("pcb-revision-pipeline"):
            complete_revisions, pcb_logs = _build_pcb_revisions(
                project_id,
                base,
                head,
                initial_revisions,
                heartbeat,
                benchmark=benchmark,
            )
        append_revision_logs(pcb_logs, stage="pcb")
        heartbeat("Assembling PCB and Stackup differences…", 92)
        result = _complete_comparison(
            initial_result=initial_result,
            assembly_state=assembly_state,
            base=base,
            head=head,
            revisions=complete_revisions,
            benchmark=benchmark,
        )
        result_path = _publish_comparison_result(
            job_id,
            job,
            result,
            version=2,
            benchmark=benchmark,
        )

        total_elapsed = time.perf_counter() - job_started
        logs.append(f"Timing comparison total: {total_elapsed:.3f}s")
        benchmark.update_metadata(
            totalReadyMs=round(total_elapsed * 1000, 3),
            resultBytes=result_path.stat().st_size,
            schematicChanges=len(result["schematic"]["changes"]),
            pcbChanges=len(result["pcb"]["changes"]),
            bomChanges=len((result.get("bom") or {}).get("changes") or []),
        )
        job["status"] = "completed"
        job["message"] = "Design comparison ready"
        job["percent"] = 100
        job["logs"] = logs
    except Exception as exc:
        logger.exception("staged design-compare failed")
        if job.get("result"):
            failed_result = copy.deepcopy(job["result"])
            domains = failed_result.setdefault("readiness", {}).setdefault("domains", {})
            for domain in ("pcb", "stackup"):
                if domains.get(domain) != "ready":
                    domains[domain] = "failed"
            failed_result["readiness"]["stage"] = "background-failed"
            _publish_comparison_result(
                job_id,
                job,
                failed_result,
                version=int(job.get("result_version") or 1) + 1,
                benchmark=benchmark,
            )
        job["status"] = "failed"
        job["message"] = str(exc)
        job["logs"] = logs + [str(exc)]
        benchmark.update_metadata(error=str(exc))
    finally:
        benchmark_path = _JOB_ROOT / job_id / "benchmark.json"
        try:
            benchmark.write(benchmark_path)
            job["benchmark_path"] = str(benchmark_path)
            job.setdefault("logs", []).append(f"Structured benchmark: {benchmark_path}")
        except Exception:
            logger.exception("design-compare benchmark publish failed")
        _persist_job(job_id)


def _resolve_revision(repo_path: Path, revision: str) -> str:
    process = subprocess.run(
        ["git", "-C", str(repo_path), "rev-parse", "--verify", f"{revision}^{{commit}}"],
        capture_output=True,
        text=True,
    )
    resolved = process.stdout.strip()
    if process.returncode != 0 or not re.fullmatch(r"[0-9a-f]{40}", resolved):
        raise ValueError(f"Invalid commit revision: {revision}")
    return resolved


def start_design_compare_job(
    project_id: str,
    base: str,
    head: str,
    *,
    include_unchanged: bool = False,
    requested_by: str = "",
) -> str:
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError(f"Project '{project_id}' not found")
    artifact_key = hashlib.sha256(
        json.dumps(
            {
                "project": project_id,
                "base": base,
                "head": head,
                "includeUnchanged": include_unchanged,
                "cacheSchema": _CACHE_SCHEMA,
                "initialCacheSchema": _INITIAL_CACHE_SCHEMA,
                "generator": semantic_index_service.generator_cache_tag(),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    repository_id = str(row.get("repo_id") or "")
    queued = v3_jobs.enqueue(
        "design_compare",
        {
            "project_id": project_id,
            "base": base,
            "head": head,
            "include_unchanged": include_unchanged,
            "artifact_key": artifact_key,
        },
        worker_pool="prism",
        artifact_key=artifact_key,
        project_id=project_id,
        repository_id=repository_id or None,
        requested_by=requested_by,
        resources={
            "prism_worker": 1,
            "design_compare": 1,
            "semantic_compile": 2,
        },
        locks=(
            [{"key": f"repository:{repository_id}", "mode": "read"}]
            if repository_id
            else [{"key": f"project:{project_id}", "mode": "read"}]
        ),
    )
    return str(queued["job_id"])


def get_job_status(job_id: str) -> Optional[dict]:
    v3_job = v3_jobs.get(job_id)
    if v3_job and v3_job.get("kind") == "design_compare":
        metadata = dict(v3_job.get("result_metadata") or {})
        payload = dict(v3_job.get("payload") or {})
        return {
            "job_id": job_id,
            "status": v3_job.get("status"),
            "message": v3_job.get("message"),
            "percent": v3_job.get("percent", 0),
            "logs": [],
            "project_id": v3_job.get("project_id") or payload.get("project_id"),
            "base": payload.get("base"),
            "head": payload.get("head"),
            "benchmark_path": metadata.get("benchmark_path"),
            "result_version": metadata.get("result_version", 0),
            "ready_domains": metadata.get("ready_domains") or [],
            "readiness": metadata.get("readiness"),
            "result_digest": v3_job.get("result_digest"),
            "error": v3_job.get("error_message") or None,
        }

    # Legacy in-memory / pre-V3 rows are retained only for unit tests that still
    # exercise _run_job directly. Production enqueue never populates this path.
    job = design_compare_jobs.get(job_id) or workspace.get_job(job_id, "design_compare")
    if not job:
        return None

    status = job.get("status")
    if status == "running" and job_id in design_compare_jobs:
        updated = job.get("updated_at")
        try:
            if updated is not None:
                from datetime import datetime, timezone

                if isinstance(updated, str):
                    updated = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                if getattr(updated, "tzinfo", None) is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - updated).total_seconds()
                if age > _STALE_JOB_SECONDS:
                    msg = (
                        f"Design compare stalled after {int(age)}s "
                        f"(likely worker restart during large-board compile). "
                        f"Close and retry."
                    )
                    job["status"] = "failed"
                    job["message"] = msg
                    design_compare_jobs[job_id]["status"] = "failed"
                    design_compare_jobs[job_id]["message"] = msg
                    status = "failed"
        except Exception:
            logger.exception("stale design-compare check failed")

    return {
        "job_id": job_id,
        "status": status,
        "message": job.get("message"),
        "percent": job.get("percent", 0),
        "logs": job.get("logs") or [],
        "project_id": job.get("project_id"),
        "base": job.get("base") or (job.get("payload") or {}).get("base"),
        "head": job.get("head") or (job.get("payload") or {}).get("head"),
        "benchmark_path": job.get("benchmark_path") or (job.get("result_metadata") or {}).get("benchmark_path"),
        "result_version": job.get("result_version", 0) or (job.get("result_metadata") or {}).get("result_version", 0),
        "ready_domains": job.get("ready_domains") or (job.get("result_metadata") or {}).get("ready_domains") or [],
        "readiness": job.get("readiness") or (job.get("result_metadata") or {}).get("readiness"),
    }


def get_job_result(job_id: str) -> Optional[dict]:
    v3_job = v3_jobs.get(job_id)
    if v3_job and v3_job.get("result_path"):
        path = Path(str(v3_job["result_path"]))
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    job = design_compare_jobs.get(job_id)
    if job and job.get("result"):
        return job["result"]
    path = _JOB_ROOT / job_id / "result.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    stored = workspace.get_job(job_id, "design_compare")
    if stored and stored.get("result"):
        return stored["result"]
    return None


def get_job_sidecar(job_id: str, digest: str) -> Optional[dict]:
    artifact = v3_jobs.get_artifact_for_job_digest(job_id, digest)
    if not artifact or artifact.get("kind") != "design_compare_sidecar":
        return None
    return artifact


def delete_job(job_id: str) -> None:
    v3_job = v3_jobs.get(job_id)
    if v3_job:
        if v3_job.get("status") in {"queued", "running", "retry_wait", "cancel_requested"}:
            v3_jobs.request_cancel(job_id)
        return
    design_compare_jobs.pop(job_id, None)
    path = _JOB_ROOT / job_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    try:
        workspace.delete_job(job_id)
    except Exception:
        logger.exception("Failed to delete legacy design-compare job %s", job_id)


def run_design_compare_job_v3(context: JobContext) -> JobResult:
    """Execute and publish a semantic comparison under a fenced worker lease."""

    payload = context.payload
    project_id = str(payload["project_id"])
    requested_base = str(payload["base"])
    requested_head = str(payload["head"])
    include_unchanged = bool(payload.get("include_unchanged"))
    artifact_key = str(payload["artifact_key"])
    repo_path, relative_path, _checkout = _repo_paths(project_id)
    base = _resolve_revision(repo_path, requested_base)
    head = _resolve_revision(repo_path, requested_head)
    logs: list[str] = []
    started = time.perf_counter()
    benchmark = DesignCompareBenchmark(
        job_id=context.job_id,
        metadata={
            "projectId": project_id,
            "base": base,
            "compare": head,
            "initialWorkers": _stage_worker_count("initial", len(set((base, head)))),
            "pcbWorkers": _stage_worker_count("pcb", len(set((base, head)))),
            "semanticGenerator": semantic_index_service.generator_cache_tag(),
            "pipeline": "staged-domain-v3-worker",
            "fence": context.fence,
        },
    )

    def heartbeat(message: str, percent: Optional[float] = None) -> None:
        print(message, flush=True)
        context.progress(
            stage="building",
            message=message,
            percent=percent,
        )

    def append_revision_logs(revision_logs: Dict[str, List[str]], stage: str) -> None:
        for commit in dict.fromkeys((base, head)):
            side = "old/new" if base == head else "old" if commit == base else "new"
            for message in revision_logs.get(commit, []):
                rendered = f"[{stage}:{side}] {message}"
                logs.append(rendered)
                print(rendered, flush=True)

    try:
        context.check_cancelled()
        with benchmark.span("initial-revision-pipeline"):
            initial_revisions, initial_logs = _build_initial_revisions(
                project_id,
                repo_path,
                relative_path,
                base,
                head,
                heartbeat,
                benchmark=benchmark,
            )
        append_revision_logs(initial_logs, "initial")
        context.check_cancelled()
        heartbeat("Assembling Schematic and BOM differences…", 50)
        initial_result, assembly_state = _assemble_initial_comparison(
            project_id=project_id,
            base=base,
            head=head,
            revisions=initial_revisions,
            include_unchanged=include_unchanged,
            benchmark=benchmark,
        )
        partial = job_artifacts.prepare_json(
            context,
            initial_result,
            kind="design_compare",
            artifact_key=artifact_key,
            schema_version=str(initial_result.get("schema") or ""),
            generator_version=semantic_index_service.generator_cache_tag(),
            readiness="partial",
        )
        partial_details = {
            "result_version": 1,
            "ready_domains": ["schematic", "bom"],
            "readiness": initial_result["readiness"],
            "base": base,
            "head": head,
        }
        if not v3_jobs.publish_partial_artifact(
            context.job_id,
            context.worker_id,
            context.fence,
            partial.__dict__,
            stage="background-pcb",
            message="Schematic and BOM ready; building PCB and Stackup in background…",
            percent=60,
            details=partial_details,
        ):
            raise RuntimeError("Fenced partial comparison publication was rejected")

        context.check_cancelled()
        with benchmark.span("pcb-revision-pipeline"):
            complete_revisions, pcb_logs = _build_pcb_revisions(
                project_id,
                base,
                head,
                initial_revisions,
                heartbeat,
                benchmark=benchmark,
            )
        append_revision_logs(pcb_logs, "pcb")
        context.check_cancelled()
        heartbeat("Assembling PCB and Stackup differences…", 92)
        result = _complete_comparison(
            initial_result=initial_result,
            assembly_state=assembly_state,
            base=base,
            head=head,
            revisions=complete_revisions,
            benchmark=benchmark,
        )
        elapsed = time.perf_counter() - started
        benchmark.update_metadata(
            totalReadyMs=round(elapsed * 1000, 3),
            schematicChanges=len(result["schematic"]["changes"]),
            pcbChanges=len(result["pcb"]["changes"]),
            bomChanges=len((result.get("bom") or {}).get("changes") or []),
        )
        benchmark_path = (
            job_state_root()
            / "jobs"
            / context.job_id
            / f"benchmark-fence-{context.fence}.json"
        )
        benchmark.write(benchmark_path)
        complete, sidecars = _prepare_comparison_bundle(
            context,
            result,
            artifact_key=artifact_key,
        )
        return JobResult(
            message="Design comparison ready",
            artifact=complete,
            sidecar_artifacts=sidecars,
            details={
                "result_version": 2,
                "ready_domains": ["schematic", "bom", "pcb", "stackup"],
                "readiness": result["readiness"],
                "benchmark_path": str(benchmark_path),
                "base": base,
                "head": head,
                "sidecar_count": len(sidecars),
            },
        )
    except Exception:
        try:
            benchmark_path = (
                job_state_root()
                / "jobs"
                / context.job_id
                / f"benchmark-fence-{context.fence}.json"
            )
            benchmark.write(benchmark_path)
        except Exception:
            logger.exception("Could not publish failed V3 comparison benchmark")
        raise
