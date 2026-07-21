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
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
_CACHE_SCHEMA = "prism.design_compare_revision_v3"
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
            if key not in {"job_id", "status", "message", "percent"}
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


def _snapshot_commit(repo_path: Path, commit: str, destination: Path, relative_path: Optional[str]) -> None:
    """git archive into destination; Type-2 archives only the subproject prefix when set.

    Streams tar (no capture_output) so large Manufacturing-Outputs / STEP trees do not
    OOM the uvicorn worker. After extract, prune non-design artefacts.
    """
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    args = ["git", "-C", str(repo_path), "archive", "--format=tar", commit]
    if relative_path:
        args.append(relative_path)
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
        _snapshot_commit(repo_path, commit, snap, relative_path)

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
                semantic_index = semantic_index_service.build_semantic_index(
                    pro,
                    source_revision_key=commit,
                    commit=commit,
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
                stackup = _extract_stackup(snap)
            except Exception as exc:
                logs.append(f"Stackup extract failed: {exc}")

            try:
                if on_progress:
                    on_progress(f"Extracting geometry for {commit[:7]}…")
                geometry = _extract_geometry(snap, semantic_index)
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
                bom_csv = _export_bom_csv(snap, logs)
            except Exception as exc:
                logs.append(f"BOM export failed: {exc}")

        payload = {
            "schema": _CACHE_SCHEMA,
            "commit": commit,
            "semantic": semantic_index,
            # Keep the old key for one payload generation so callers that have
            # not migrated yet still receive the compact semantic document.
            "design": semantic_index,
            "geometry": geometry,
            "stackup": stackup,
            "bom_csv": bom_csv,
            "sources": _list_kicad_sources(snap),
        }
        cache.mkdir(parents=True, exist_ok=True)
        temporary = marker.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        temporary.replace(marker)
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
            sch_geom[source_id] = _enrich_geometry(
                {
                    "kind": "symbol",
                    "page": page,
                    "x": at[0],
                    "y": at[1],
                    "bounds": [at[0] - 2.54, at[1] - 2.54, 5.08, 5.08],
                },
                source_id=source_id,
                semantic_index=semantic_index,
                context="schematic",
            )
        for kind in ("wire", "bus", "polyline", "arc", "circle", "text", "text_box"):
            for block in _iter_sexpr_blocks(text, kind):
                source_id = _source_id(block)
                if not source_id:
                    continue
                points = _points(block)
                at = _point(block, "at")
                entry: Dict[str, Any] = {
                    "kind": "wire" if kind in {"wire", "bus"} else "graphic",
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
            if not source_id or not at:
                continue
            lib_id = re.match(r'\(footprint\s+"([^"]+)"', block)
            entry.update(
                {
                    "lib_id": lib_id.group(1) if lib_id else "",
                    "x": at[0],
                    "y": at[1],
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


def _summary(changes: List[Dict[str, Any]]) -> Dict[str, int]:
    return {
        "added": sum(1 for change in changes if change["kind"] == "added"),
        "removed": sum(1 for change in changes if change["kind"] == "removed"),
        "changed": sum(1 for change in changes if change["kind"] == "changed"),
    }


def _diff_designs(base: Dict[str, Any], head: Dict[str, Any]) -> Dict[str, Any]:
    """Diff compact kicad-monkey semantic indexes, preserving native source IDs."""
    base_components = {
        str(item.get("reference")): item
        for item in base.get("components") or []
        if item.get("reference")
    }
    head_components = {
        str(item.get("reference")): item
        for item in head.get("components") or []
        if item.get("reference")
    }
    base_nets = {str(item.get("name")): item for item in base.get("nets") or [] if item.get("name")}
    head_nets = {str(item.get("name")): item for item in head.get("nets") or [] if item.get("name")}
    changes: List[Dict[str, Any]] = []

    for reference in sorted(base_components.keys() | head_components.keys()):
        old, new = base_components.get(reference), head_components.get(reference)
        base_source = _component_source(old or {}, "schematic")
        compare_source = _component_source(new or {}, "schematic")
        page = next(
            (
                Path(str(ref.get("page") or "")).name
                for ref in ((new or old or {}).get("schematicRefs") or [])
                if ref.get("page")
            ),
            None,
        )
        semantic_id = (new or old or {}).get("componentUid")
        common = {
            "domain": "schematic",
            "category": "components",
            "label": reference,
            "reference": reference,
            "semantic_id": semantic_id,
            "page": page,
            "alsoOnPages": [page] if page else [],
            "source_id_base": base_source,
            "source_id_compare": compare_source,
            "uuid": compare_source or base_source,
            "base_item": _native_item(
                source_id=base_source,
                semantic_id=semantic_id,
                page=page,
                reference=reference,
            ),
            "compare_item": _native_item(
                source_id=compare_source,
                semantic_id=semantic_id,
                page=page,
                reference=reference,
            ),
            "classification": "primary",
        }
        if old is None:
            changes.append(
                {
                    **common,
                    "id": f"sch-comp-add-{semantic_id or reference}",
                    "kind": "added",
                    "fields": {
                        field: {"old": None, "new": value}
                        for field, value in (new.get("fields") or {}).items()
                        if value
                    },
                }
            )
        elif new is None:
            changes.append(
                {
                    **common,
                    "id": f"sch-comp-del-{semantic_id or reference}",
                    "kind": "removed",
                }
            )
        else:
            old_fields, new_fields = old.get("fields") or {}, new.get("fields") or {}
            field_diffs = {
                field: {"old": old_fields.get(field, ""), "new": new_fields.get(field, "")}
                for field in sorted(old_fields.keys() | new_fields.keys())
                if old_fields.get(field, "") != new_fields.get(field, "")
            }
            if field_diffs:
                changes.append(
                    {
                        **common,
                        "id": f"sch-comp-chg-{semantic_id or reference}",
                        "kind": "changed",
                        "fields": field_diffs,
                    }
                )

    for name in sorted(base_nets.keys() | head_nets.keys()):
        old, new = base_nets.get(name), head_nets.get(name)
        semantic_id = (new or old or {}).get("netUid")
        old_pairs = _terminal_pairs(base, old.get("netUid")) if old else set()
        new_pairs = _terminal_pairs(head, new.get("netUid")) if new else set()
        kind = "added" if old is None else "removed" if new is None else "changed"
        if old is not None and new is not None and old_pairs == new_pairs:
            continue
        changes.append(
            {
                "id": f"sch-net-{kind}-{semantic_id or name}",
                "kind": kind,
                "domain": "schematic",
                "category": "nets",
                "label": name,
                "net": name,
                "semantic_id": semantic_id,
                "classification": "primary",
                "base_item": _native_item(source_id=None, semantic_id=semantic_id, net=name),
                "compare_item": _native_item(source_id=None, semantic_id=semantic_id, net=name),
                "fields": {
                    "connections": {"old": len(old_pairs), "new": len(new_pairs)}
                },
            }
        )

    return {"changes": changes, "summary": _summary(changes)}


def _geometry_identity(source_id: str, item: Dict[str, Any]) -> str:
    if item.get("kind") in {"footprint", "symbol"}:
        return str(item.get("semantic_id") or item.get("reference") or source_id)
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
        native = geometry_by_semantic.get(str(semantic_id)) if semantic_id else None
        if not native:
            merged.append(semantic)
            continue

        merged_geometry_ids.add(id(native))
        combined = {**semantic, **native}
        combined["id"] = semantic["id"]
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
    )
    return merged


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
    for change in changes:
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


def _run_job(
    job_id: str,
    project_id: str,
    base: str,
    head: str,
    include_unchanged: bool,
) -> None:
    job = design_compare_jobs[job_id]
    logs: List[str] = job.setdefault("logs", [])

    def heartbeat(message: str, percent: Optional[float] = None) -> None:
        job["message"] = message
        if percent is not None:
            job["percent"] = percent
        job["logs"] = logs[-40:]
        _persist_job(job_id)

    try:
        repo_path, relative_path, _checkout = _repo_paths(project_id)
        heartbeat("Building revisions…", 10)

        revisions: Dict[str, Dict[str, Any]] = {}
        # Sequential builds: parallel monkey+geometry on large boards OOMs uvicorn workers
        # and orphans the in-memory job thread (status stuck at 10%).
        for idx, commit in enumerate((base, head)):
            label = "old" if idx == 0 else "new"
            pct = 15 + idx * 20
            heartbeat(f"Building {label} revision ({commit[:7]})…", pct)
            revisions[commit] = _load_or_build_revision(
                project_id,
                repo_path,
                relative_path,
                commit,
                logs,
                on_progress=lambda msg, p=pct: heartbeat(msg, p),
            )

        heartbeat("Diffing designs…", 55)

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
            "geometry": {
                "base": base_rev.get("geometry") or {},
                "head": head_rev.get("geometry") or {},
            },
        }

        out = _JOB_ROOT / job_id
        out.mkdir(parents=True, exist_ok=True)
        (out / "result.json").write_text(json.dumps(result), encoding="utf-8")

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
