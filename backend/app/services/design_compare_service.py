"""
Design Comparison service — monkey design.a0 structured diff + geometry sidecars.

Replaces raster kicad-cli SVG overlays for History Design Comparison.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.services import (
    bom_diff_service,
    document_diff_service,
    project_service,
    semantic_index_service,
)
from app.services.workspace_service import workspace

logger = logging.getLogger(__name__)

design_compare_jobs: Dict[str, dict] = {}
_CACHE_ROOT = Path(os.environ.get("PRISM_DESIGN_COMPARE_CACHE", "/tmp/prism_design_compare_cache"))
_JOB_ROOT = Path(os.environ.get("PRISM_DESIGN_COMPARE_JOBS", "/tmp/prism_design_compare"))
_CACHE_SCHEMA = "prism.design_compare_revision_v4"
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


def _read_revision_cache(marker: Path) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if payload.get("schema") != _CACHE_SCHEMA:
        return None
    return payload


def _load_or_build_revision(
    project_id: str,
    repo_path: Path,
    relative_path: Optional[str],
    commit: str,
    logs: List[str],
    on_progress: Optional[Any] = None,
) -> Dict[str, Any]:
    revision_started = time.perf_counter()
    timings: Dict[str, float] = {}

    def timed(label: str, action: Callable[[], Any]) -> Any:
        started = time.perf_counter()
        try:
            return action()
        finally:
            elapsed = time.perf_counter() - started
            timings[label] = elapsed
            logs.append(f"Timing {commit[:7]} {label}: {elapsed:.3f}s")

    cache = _cache_dir(project_id, commit)
    marker = cache / "revision.json"
    cached = _read_revision_cache(marker) if marker.exists() else None
    if cached is not None:
        logs.append(f"Cache hit for {commit[:7]}")
        if on_progress:
            on_progress(f"Cache hit {commit[:7]}")
        return cached

    with _cache_lock(project_id, commit):
        cached = _read_revision_cache(marker) if marker.exists() else None
        if cached is not None:
            logs.append(f"Cache hit for {commit[:7]} after wait")
            if on_progress:
                on_progress(f"Cache hit {commit[:7]}")
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
        geometry: Dict[str, Any] = {"schematic": {}, "pcb": {}}
        stackup: Dict[str, Any] = {"present": False, "layers": []}
        bom_csv = ""

        if pro:
            try:
                if on_progress:
                    on_progress(f"Building semantic index for {commit[:7]}…")
                semantic_index = timed(
                    "semantic-index",
                    lambda: semantic_index_service.build_semantic_index(
                        pro,
                        source_revision_key=commit,
                        commit=commit,
                    ),
                )
                logs.append(f"Built semantic index for {commit[:7]}")
            except Exception as exc:
                logs.append(f"Semantic index failed for {commit[:7]}: {exc}")
                semantic_index = {
                    "schema": "fallback",
                    "components": [],
                    "nets": [],
                    "terminals": [],
                    "indexes": {},
                }

            try:
                stackup = timed("stackup", lambda: _extract_stackup(snap))
            except Exception as exc:
                logs.append(f"Stackup extract failed: {exc}")

            try:
                if on_progress:
                    on_progress(f"Extracting geometry for {commit[:7]}…")
                geometry = timed(
                    "geometry",
                    lambda: _extract_geometry(snap, semantic_index),
                )
                logs.append(
                    f"Geometry {commit[:7]}: "
                    f"sch={len(geometry.get('schematic') or {})} "
                    f"pcb={len(geometry.get('pcb') or {})}"
                )
            except Exception as exc:
                logs.append(f"Geometry extract failed: {exc}")

            try:
                if on_progress:
                    on_progress(f"Exporting BOM for {commit[:7]}…")
                bom_csv = timed("bom", lambda: _export_bom_csv(snap, logs))
            except Exception as exc:
                logs.append(f"BOM export failed: {exc}")

        payload = {
            "schema": _CACHE_SCHEMA,
            "commit": commit,
            "semantic": semantic_index,
            "geometry": geometry,
            "stackup": stackup,
            "bom_csv": bom_csv,
            "sources": timed("source-list", lambda: _list_kicad_sources(snap)),
            "timings": timings,
        }
        cache.mkdir(parents=True, exist_ok=True)
        temporary = marker.with_suffix(".json.tmp")
        timed(
            "cache-write",
            lambda: (
                temporary.write_text(
                    json.dumps(payload, separators=(",", ":")),
                    encoding="utf-8",
                ),
                temporary.replace(marker),
            ),
        )
        total = time.perf_counter() - revision_started
        logs.append(
            f"Timing {commit[:7]} total: {total:.3f}s; "
            f"cache={marker.stat().st_size / (1024 * 1024):.1f}MiB"
        )
        if on_progress:
            on_progress(f"Revision {commit[:7]} ready")
        return payload


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


def _export_bom_csv(snap: Path, logs: List[str]) -> str:
    from app.services.diff_service import _get_cli_command

    sch = project_service.find_schematic_file(str(snap))
    if not sch:
        return ""
    out = snap / "_bom.csv"
    cli = _get_cli_command()
    # Request Reference explicitly. Default kicad-cli labels use "Refs", which
    # historically caused every BOM row to be dropped by the Reference matcher.
    bom_fields = ["Reference", "Value", "Footprint", "Datasheet"]
    cmd = [
        cli,
        "sch",
        "export",
        "bom",
        "--fields",
        ",".join(bom_fields),
        "--output",
        str(out),
        sch,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not out.exists():
        logs.append(f"kicad-cli bom export failed: {proc.stderr[:200]}")
        return ""
    return out.read_text(encoding="utf-8", errors="replace")


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
    if component:
        entry["semantic_id"] = component.get("componentUid")
        entry["reference"] = component.get("reference")
    if net:
        entry["semantic_id"] = net.get("netUid")
        entry["net"] = net.get("name") or entry.get("net")
    return entry


def _extract_geometry(snap: Path, semantic_index: Dict[str, Any]) -> Dict[str, Any]:
    """Compact native source-id → exact/fallback geometry sidecars."""
    sch_geom: Dict[str, Any] = {}
    pcb_geom: Dict[str, Any] = {}

    for sch in snap.rglob("*.kicad_sch"):
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
    )
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
            entry.update(
                {
                    "lib_id": lib_id.group(1) if lib_id else "",
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
) -> Optional[Dict[str, Any]]:
    reference, pin = pair
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
    index: Dict[str, Any], net: Dict[str, Any]
) -> frozenset[tuple[str, str]]:
    """Cross-revision net identity from terminal/pad membership, not name."""
    return frozenset(_terminal_pairs(index, str(net.get("netUid") or "")))


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
    """Greedy 1:1 match: shared native keys first, then leftover unpaired."""
    pairs: List[tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = []
    head_unused = list(head_items)
    for old in base_items:
        old_keys = keys_of(old)
        match_idx = next(
            (
                index
                for index, candidate in enumerate(head_unused)
                if old_keys and old_keys & keys_of(candidate)
            ),
            None,
        )
        if match_idx is None:
            pairs.append((old, None))
            continue
        pairs.append((old, head_unused.pop(match_idx)))
    for new in head_unused:
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
    head_unused = list(head_components)
    matched_pairs: List[tuple[Dict[str, Any], Dict[str, Any]]] = []
    base_unmatched: List[Dict[str, Any]] = []
    for old in base_components:
        keys = _component_native_keys(old)
        index = next(
            (
                offset
                for offset, candidate in enumerate(head_unused)
                if keys and keys & _component_native_keys(candidate)
            ),
            None,
        )
        if index is None:
            base_unmatched.append(old)
        else:
            matched_pairs.append((old, head_unused.pop(index)))

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
        fp = _net_connectivity_fingerprint(base, net)
        if fp:
            base_by_fp.setdefault(fp, []).append(net)
    for net in head_nets:
        fp = _net_connectivity_fingerprint(head, net)
        if fp:
            head_by_fp.setdefault(fp, []).append(net)

    net_pairs: List[tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = []
    used_base: set[int] = set()
    used_head: set[int] = set()

    for fp in sorted(base_by_fp.keys() & head_by_fp.keys(), key=lambda value: sorted(value)):
        base_group = list(base_by_fp[fp])
        head_group = list(head_by_fp[fp])
        # Disambiguate identical connectivity by net name when possible.
        head_by_name = {str(item.get("name")): item for item in head_group}
        for old in base_group:
            named = head_by_name.pop(str(old.get("name")), None)
            if named is not None:
                net_pairs.append((old, named))
                used_base.add(id(old))
                used_head.add(id(named))
                continue
            if head_group:
                # Prefer unmatched head with same fingerprint.
                candidate = next(
                    (item for item in head_group if id(item) not in used_head),
                    None,
                )
                if candidate is not None:
                    net_pairs.append((old, candidate))
                    used_base.add(id(old))
                    used_head.add(id(candidate))

    leftover_base_nets = [net for net in base_nets if id(net) not in used_base]
    leftover_head_nets = [net for net in head_nets if id(net) not in used_head]
    by_name_base = {str(item.get("name")): item for item in leftover_base_nets}
    by_name_head = {str(item.get("name")): item for item in leftover_head_nets}
    for name in sorted(by_name_base.keys() | by_name_head.keys()):
        net_pairs.append((by_name_base.get(name), by_name_head.get(name)))

    for old, new in net_pairs:
        name = str((new or old or {}).get("name") or "")
        old_pairs = _terminal_pairs(base, old.get("netUid")) if old else set()
        new_pairs = _terminal_pairs(head, new.get("netUid")) if new else set()
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

        revision = _load_or_build_revision(
            project_id,
            repo_path,
            relative_path,
            commit,
            local_logs,
            on_progress=report,
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


def _run_job(
    job_id: str,
    project_id: str,
    base: str,
    head: str,
    include_unchanged: bool,
) -> None:
    job = design_compare_jobs[job_id]
    logs: List[str] = job.setdefault("logs", [])
    job_lock = threading.Lock()
    job_started = time.perf_counter()

    def heartbeat(message: str, percent: Optional[float] = None) -> None:
        with job_lock:
            job["message"] = message
            if percent is not None:
                job["percent"] = percent
            job["logs"] = logs[-40:]
            _persist_job(job_id)

    try:
        repo_path, relative_path, _checkout = _repo_paths(project_id)
        heartbeat("Building revisions…", 10)

        revisions_started = time.perf_counter()
        revisions, revision_logs = _build_revisions(
            project_id,
            repo_path,
            relative_path,
            base,
            head,
            heartbeat,
        )
        for commit in dict.fromkeys((base, head)):
            label = "old/new" if base == head else "old" if commit == base else "new"
            logs.extend(
                f"[{label}] {message}"
                for message in revision_logs.get(commit, [])
            )
        logs.append(
            f"Timing revision pipeline: {time.perf_counter() - revisions_started:.3f}s"
        )

        heartbeat("Diffing designs…", 55)
        assembly_started = time.perf_counter()

        base_rev = revisions[base]
        head_rev = revisions[head]
        sch_diff = _diff_designs(
            base_rev.get("semantic") or base_rev.get("design") or {},
            head_rev.get("semantic") or head_rev.get("design") or {},
        )
        sch_geometry_changes = _diff_geometry(
            base_rev.get("geometry") or {},
            head_rev.get("geometry") or {},
            "schematic",
        )
        schematic_changes = _merge_semantic_geometry_changes(
            sch_diff["changes"],
            sch_geometry_changes,
        )
        _hydrate_visual_target_pages_and_match_labels(
            schematic_changes,
            (base_rev.get("geometry") or {}).get("schematic") or {},
            (head_rev.get("geometry") or {}).get("schematic") or {},
        )
        pcb_changes = _diff_geometry(
            base_rev.get("geometry") or {},
            head_rev.get("geometry") or {},
            "pcb",
        )

        # BOM
        fields = ["Reference", "Value", "Footprint", "Datasheet"]
        try:
            cfg_path = _cache_dir(project_id, head) / "snapshot" / ".prism.json"
            if cfg_path.exists():
                cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
                fields = cfg.get("bom", {}).get("fields") or fields
        except Exception:
            pass
        old_bom = bom_diff_service.parse_bom_csv(base_rev.get("bom_csv") or "")
        new_bom = bom_diff_service.parse_bom_csv(head_rev.get("bom_csv") or "")
        bom = bom_diff_service.diff_boms(
            old_bom,
            new_bom,
            fields,
            include_unchanged=include_unchanged,
        )

        stackup = _diff_stackup(base_rev.get("stackup") or {}, head_rev.get("stackup") or {})
        route_metrics = {
            "base": _route_metrics(
                base_rev.get("geometry") or {},
                base_rev.get("stackup") or {},
            ),
            "compare": _route_metrics(
                head_rev.get("geometry") or {},
                head_rev.get("stackup") or {},
            ),
        }

        sheets = sorted(
            {
                Path(s["filename"]).name
                for s in (head_rev.get("sources") or []) + (base_rev.get("sources") or [])
                if s["filename"].endswith(".kicad_sch")
            }
        )

        source_files = {
            "base": base_rev.get("sources") or [],
            "head": head_rev.get("sources") or [],
        }
        document_diff = document_diff_service.build_project_diff(
            schematic_changes=schematic_changes,
            pcb_changes=pcb_changes,
            files=source_files,
            geometry={
                "base": base_rev.get("geometry") or {},
                "head": head_rev.get("geometry") or {},
            },
        )

        result = {
            "schema": "prism.semantic_comparison_v2",
            "base": base,
            "head": head,
            "compare": head,
            "diagnostics": [],
            "files": source_files,
            "document_diff": document_diff,
            "schematic": {
                "pages": sheets,
                "changes": schematic_changes,
                "groups": _group_changes(schematic_changes),
                "summary": _summary(schematic_changes),
            },
            "pcb": {
                "changes": pcb_changes,
                "groups": _group_changes(pcb_changes),
                "summary": _summary(pcb_changes),
                "route_metrics": route_metrics,
            },
            "bom": bom,
            "stackup": stackup,
        }
        logs.append(
            f"Timing diff assembly: {time.perf_counter() - assembly_started:.3f}s"
        )

        out = _JOB_ROOT / job_id
        out.mkdir(parents=True, exist_ok=True)
        publish_started = time.perf_counter()
        result_path = out / "result.json"
        result_path.write_text(
            json.dumps(result, separators=(",", ":")),
            encoding="utf-8",
        )
        logs.append(
            f"Timing result publish: {time.perf_counter() - publish_started:.3f}s; "
            f"result={result_path.stat().st_size / (1024 * 1024):.1f}MiB"
        )
        logs.append(
            f"Timing comparison total: {time.perf_counter() - job_started:.3f}s"
        )

        job["status"] = "completed"
        job["message"] = "Design comparison ready"
        job["percent"] = 100
        job["result"] = result
        job["logs"] = logs
        _persist_job(job_id)
    except Exception as exc:
        logger.exception("design-compare failed")
        job["status"] = "failed"
        job["message"] = str(exc)
        job["logs"] = logs + [str(exc)]
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
) -> str:
    repo_path, _relative_path, _checkout = _repo_paths(project_id)
    resolved_base = _resolve_revision(repo_path, base)
    resolved_head = _resolve_revision(repo_path, head)
    job_id = str(uuid.uuid4())
    design_compare_jobs[job_id] = {
        "job_id": job_id,
        "project_id": project_id,
        "base": resolved_base,
        "head": resolved_head,
        "include_unchanged": include_unchanged,
        "status": "running",
        "message": "Queued",
        "percent": 0,
        "logs": [],
        "result": None,
    }
    workspace.create_job(
        job_id,
        "design_compare",
        status="running",
        message="Queued",
        percent=0,
        project_id=project_id,
        base=resolved_base,
        head=resolved_head,
        include_unchanged=include_unchanged,
    )
    threading.Thread(
        target=_run_job,
        args=(job_id, project_id, resolved_base, resolved_head, include_unchanged),
        daemon=True,
    ).start()
    return job_id


def get_job_status(job_id: str) -> Optional[dict]:
    job = design_compare_jobs.get(job_id) or workspace.get_job(job_id, "design_compare")
    if not job:
        return None

    status = job.get("status")
    # Orphan detection: worker OOM/restart leaves DB row stuck at running forever.
    if status == "running":
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
                    if job_id in design_compare_jobs:
                        design_compare_jobs[job_id]["status"] = "failed"
                        design_compare_jobs[job_id]["message"] = msg
                    workspace.update_job(job_id, status="failed", message=msg)
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
        "base": job.get("base"),
        "head": job.get("head"),
    }


def get_job_result(job_id: str) -> Optional[dict]:
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


def delete_job(job_id: str) -> None:
    design_compare_jobs.pop(job_id, None)
    path = _JOB_ROOT / job_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    try:
        workspace.delete_job(job_id)
    except Exception:
        pass
