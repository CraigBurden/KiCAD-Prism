"""
Design Comparison service — monkey design.a0 structured diff + geometry sidecars.

Replaces raster kicad-cli SVG overlays for History Design Comparison.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.services import bom_diff_service, project_service, semantic_index_service
from app.services.workspace_service import workspace

logger = logging.getLogger(__name__)

design_compare_jobs: Dict[str, dict] = {}
_CACHE_ROOT = Path(os.environ.get("PRISM_DESIGN_COMPARE_CACHE", "/tmp/prism_design_compare_cache"))
_JOB_ROOT = Path(os.environ.get("PRISM_DESIGN_COMPARE_JOBS", "/tmp/prism_design_compare"))


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
    """git archive into destination; Type-2 archives only the subproject prefix when set."""
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    args = ["git", "-C", str(repo_path), "archive", "--format=tar", commit]
    if relative_path:
        args.append(relative_path)
    proc = subprocess.run(args, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"git archive failed for {commit}: {proc.stderr.decode('utf-8', errors='replace')}"
        )
    tar = subprocess.run(
        ["tar", "-x", "-C", str(destination)],
        input=proc.stdout,
        capture_output=True,
    )
    if tar.returncode != 0:
        raise RuntimeError(f"tar extract failed for {commit}")
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


def _find_pro(root: Path) -> Optional[Path]:
    pros = list(root.rglob("*.kicad_pro"))
    if not pros:
        return None
    # Prefer shallowest
    pros.sort(key=lambda p: len(p.parts))
    return pros[0]


def _cache_dir(project_id: str, commit: str) -> Path:
    return _CACHE_ROOT / project_id / commit


def _load_or_build_revision(
    project_id: str,
    repo_path: Path,
    relative_path: Optional[str],
    commit: str,
    logs: List[str],
) -> Dict[str, Any]:
    cache = _cache_dir(project_id, commit)
    marker = cache / "revision.json"
    if marker.exists():
        logs.append(f"Cache hit for {commit[:7]}")
        return json.loads(marker.read_text(encoding="utf-8"))

    snap = cache / "snapshot"
    logs.append(f"Snapshotting {commit[:7]}…")
    _snapshot_commit(repo_path, commit, snap, relative_path)

    pro = _find_pro(snap)
    design_json: Dict[str, Any] = {}
    geometry: Dict[str, Any] = {"schematic": {}, "pcb": {}}
    stackup: Dict[str, Any] = {"present": False, "layers": []}
    bom_csv = ""

    if pro:
        try:
            semantic_index_service._add_kicad_monkey_import_paths()
            from kicad_monkey import KiCadDesign

            design = KiCadDesign.from_project_file(pro)
            design_json = design.to_json(include_indexes=True)
            logs.append(f"Compiled design.a0 for {commit[:7]}")
        except Exception as exc:
            logs.append(f"Monkey design compile failed for {commit[:7]}: {exc}")
            design_json = {"schema": "fallback", "components": [], "nets": [], "sheets": []}

        try:
            stackup = _extract_stackup(snap)
        except Exception as exc:
            logs.append(f"Stackup extract failed: {exc}")

        try:
            geometry = _extract_geometry(snap, design_json)
        except Exception as exc:
            logs.append(f"Geometry extract failed: {exc}")

        try:
            bom_csv = _export_bom_csv(snap, logs)
        except Exception as exc:
            logs.append(f"BOM export failed: {exc}")

    payload = {
        "commit": commit,
        "design": design_json,
        "geometry": geometry,
        "stackup": stackup,
        "bom_csv": bom_csv,
        "sources": _list_kicad_sources(snap),
    }
    cache.mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def _list_kicad_sources(root: Path) -> List[Dict[str, str]]:
    out = []
    for path in sorted(root.rglob("*")):
        if path.suffix in {".kicad_sch", ".kicad_pcb", ".kicad_pro"} and path.is_file():
            out.append(
                {
                    "filename": path.name,
                    "path": str(path.relative_to(root)).replace("\\", "/"),
                }
            )
    return out


def _export_bom_csv(snap: Path, logs: List[str]) -> str:
    from app.services.diff_service import _get_cli_command

    sch = project_service.find_schematic_file(str(snap))
    if not sch:
        return ""
    out = snap / "_bom.csv"
    cli = _get_cli_command()
    cmd = [cli, "sch", "export", "bom", "--output", str(out), sch]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not out.exists():
        logs.append(f"kicad-cli bom export failed: {proc.stderr[:200]}")
        return ""
    return out.read_text(encoding="utf-8", errors="replace")


def _extract_stackup(snap: Path) -> Dict[str, Any]:
    pcb = next(snap.rglob("*.kicad_pcb"), None)
    if not pcb:
        return {"present": False, "layers": []}
    text = pcb.read_text(encoding="utf-8", errors="replace")
    # Prefer (stackup ...) block layers
    layers: List[Dict[str, Any]] = []
    stackup_match = re.search(r"\(stackup\b(.*)\n\s*\)", text, re.DOTALL)
    body = stackup_match.group(1) if stackup_match else ""
    for m in re.finditer(
        r'\(layer\s+"([^"]+)"\s*\(type\s+"([^"]+)"\)(?:\s*\(thickness\s+([0-9.eE+-]+)\))?',
        body,
    ):
        layers.append(
            {
                "name": m.group(1),
                "type": m.group(2),
                "thickness": float(m.group(3)) if m.group(3) else None,
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


def _extract_geometry(snap: Path, design: Dict[str, Any]) -> Dict[str, Any]:
    """Compact UUID → world geometry for OverlayScene mapping."""
    sch_geom: Dict[str, Any] = {}
    pcb_geom: Dict[str, Any] = {}

    for sch in snap.rglob("*.kicad_sch"):
        page = sch.name
        text = sch.read_text(encoding="utf-8", errors="replace")
        # symbols
        for block in re.finditer(
            r'\(symbol\b.*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+[-\d.]+)?\).*?\(uuid\s+"([^"]+)"\)',
            text,
            re.DOTALL,
        ):
            sch_geom[block.group(3)] = {
                "kind": "symbol",
                "page": page,
                "x": float(block.group(1)),
                "y": float(block.group(2)),
                "bounds": [
                    float(block.group(1)) - 2.54,
                    float(block.group(2)) - 2.54,
                    5.08,
                    5.08,
                ],
            }
        # wires
        for block in re.finditer(
            r'\(wire\b.*?\(pts\s+\(xy\s+([-\d.]+)\s+([-\d.]+)\)\s+\(xy\s+([-\d.]+)\s+([-\d.]+)\)\).*?\(uuid\s+"([^"]+)"\)',
            text,
            re.DOTALL,
        ):
            x1, y1, x2, y2 = map(float, block.group(1, 2, 3, 4))
            sch_geom[block.group(5)] = {
                "kind": "wire",
                "page": page,
                "points": [[x1, y1], [x2, y2]],
                "x": (x1 + x2) / 2,
                "y": (y1 + y2) / 2,
            }

    pcb = next(snap.rglob("*.kicad_pcb"), None)
    if pcb:
        text = pcb.read_text(encoding="utf-8", errors="replace")
        for block in re.finditer(
            r'\(segment\b.*?\(start\s+([-\d.]+)\s+([-\d.]+)\).*?\(end\s+([-\d.]+)\s+([-\d.]+)\).*?\(width\s+([-\d.]+)\).*?\(layer\s+"([^"]+)"\).*?(?:\(net\s+\d+\s+"([^"]*)"\)|\(net\s+\d+\)).*?\(uuid\s+"([^"]+)"\)',
            text,
            re.DOTALL,
        ):
            pcb_geom[block.group(8)] = {
                "kind": "track",
                "points": [
                    [float(block.group(1)), float(block.group(2))],
                    [float(block.group(3)), float(block.group(4))],
                ],
                "width": float(block.group(5)),
                "layer": block.group(6),
                "net": block.group(7) or "",
            }
        # Simpler segment fallback without net name
        for block in re.finditer(
            r'\(segment\b[^)]*\(start\s+([-\d.]+)\s+([-\d.]+)\)[^)]*\(end\s+([-\d.]+)\s+([-\d.]+)\)[^)]*\(width\s+([-\d.]+)\)[^)]*\(layer\s+"([^"]+)"\)[\s\S]*?\(uuid\s+"([^"]+)"\)',
            text,
        ):
            uid = block.group(7)
            if uid in pcb_geom:
                continue
            pcb_geom[uid] = {
                "kind": "track",
                "points": [
                    [float(block.group(1)), float(block.group(2))],
                    [float(block.group(3)), float(block.group(4))],
                ],
                "width": float(block.group(5)),
                "layer": block.group(6),
                "net": "",
            }
        for block in re.finditer(
            r'\(via\b[\s\S]*?\(at\s+([-\d.]+)\s+([-\d.]+)\)[\s\S]*?\(size\s+([-\d.]+)\)[\s\S]*?\(uuid\s+"([^"]+)"\)',
            text,
        ):
            pcb_geom[block.group(4)] = {
                "kind": "via",
                "x": float(block.group(1)),
                "y": float(block.group(2)),
                "radius": float(block.group(3)) / 2,
            }
        for block in re.finditer(
            r'\(footprint\s+"([^"]+)"[\s\S]*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+[-\d.]+)?\)[\s\S]*?\(uuid\s+"([^"]+)"\)',
            text,
        ):
            pcb_geom[block.group(4)] = {
                "kind": "footprint",
                "lib_id": block.group(1),
                "x": float(block.group(2)),
                "y": float(block.group(3)),
                "bounds": [
                    float(block.group(2)) - 5,
                    float(block.group(3)) - 5,
                    10,
                    10,
                ],
            }

    # Enrich pages for nets from design JSON graphical lists
    return {"schematic": sch_geom, "pcb": pcb_geom}


def _component_key(comp: Dict[str, Any]) -> str:
    params = comp.get("parameters") or {}
    uid = params.get("kicad_instance_uuid") or comp.get("svg_id") or ""
    ref = comp.get("designator") or comp.get("reference") or ""
    return uid or f"ref:{ref}"


def _net_key(net: Dict[str, Any]) -> str:
    return (net.get("name") or "").strip()


def _net_pages(net: Dict[str, Any], design: Dict[str, Any]) -> List[str]:
    pages: set[str] = set()
    graphical = net.get("graphical") or {}
    # Prefer hierarchy sheet paths from member components
    for sheet in design.get("sheets") or []:
        name = sheet.get("filename") or sheet.get("name")
        if name:
            pages.add(Path(str(name)).name)
    # Fallback: collect from indexes if present
    if not pages and design.get("schematic_hierarchy"):
        for node in design.get("schematic_hierarchy") or []:
            if isinstance(node, dict):
                fn = node.get("filename") or node.get("sheet")
                if fn:
                    pages.add(Path(str(fn)).name)
    # From component hierarchy on this net's pins
    for pin in (graphical.get("pins") or []):
        if isinstance(pin, dict) and pin.get("sheet"):
            pages.add(Path(str(pin["sheet"])).name)
    return sorted(pages)


def _diff_designs(base: Dict[str, Any], head: Dict[str, Any]) -> Dict[str, Any]:
    base_comps = {_component_key(c): c for c in base.get("components") or [] if _component_key(c)}
    head_comps = {_component_key(c): c for c in head.get("components") or [] if _component_key(c)}
    base_nets = {_net_key(n): n for n in base.get("nets") or [] if _net_key(n)}
    head_nets = {_net_key(n): n for n in head.get("nets") or [] if _net_key(n)}

    changes: List[Dict[str, Any]] = []

    for key, comp in head_comps.items():
        ref = comp.get("designator") or comp.get("reference") or key
        hier = comp.get("hierarchy") or {}
        page = Path(str(hier.get("sheet") or "")).name or None
        uuid = (comp.get("parameters") or {}).get("kicad_instance_uuid") or comp.get("svg_id")
        if key not in base_comps:
            changes.append(
                {
                    "id": f"sch-comp-add-{key}",
                    "kind": "added",
                    "domain": "schematic",
                    "category": "components",
                    "label": str(ref),
                    "page": page,
                    "alsoOnPages": [page] if page else [],
                    "uuid": uuid,
                    "fields": {"value": comp.get("value"), "footprint": comp.get("footprint")},
                }
            )
        else:
            old = base_comps[key]
            field_diffs = {}
            for field in ("value", "footprint"):
                if (old.get(field) or "") != (comp.get(field) or ""):
                    field_diffs[field] = {"old": old.get(field), "new": comp.get(field)}
            if field_diffs:
                changes.append(
                    {
                        "id": f"sch-comp-chg-{key}",
                        "kind": "changed",
                        "domain": "schematic",
                        "category": "components",
                        "label": str(ref),
                        "page": page,
                        "alsoOnPages": [page] if page else [],
                        "uuid": uuid,
                        "fields": field_diffs,
                    }
                )

    for key, comp in base_comps.items():
        if key in head_comps:
            continue
        ref = comp.get("designator") or comp.get("reference") or key
        hier = comp.get("hierarchy") or {}
        page = Path(str(hier.get("sheet") or "")).name or None
        uuid = (comp.get("parameters") or {}).get("kicad_instance_uuid") or comp.get("svg_id")
        changes.append(
            {
                "id": f"sch-comp-del-{key}",
                "kind": "removed",
                "domain": "schematic",
                "category": "components",
                "label": str(ref),
                "page": page,
                "alsoOnPages": [page] if page else [],
                "uuid": uuid,
            }
        )

    for key, net in head_nets.items():
        pages = _net_pages(net, head) or _net_pages(net, base)
        if key not in base_nets:
            changes.append(
                {
                    "id": f"sch-net-add-{key}",
                    "kind": "added",
                    "domain": "schematic",
                    "category": "nets",
                    "label": key,
                    "page": pages[0] if pages else None,
                    "alsoOnPages": pages,
                    "net": key,
                }
            )
        else:
            old_pins = {
                (p.get("designator"), p.get("pin"))
                for p in (base_nets[key].get("pins") or [])
                if isinstance(p, dict)
            }
            new_pins = {
                (p.get("designator"), p.get("pin"))
                for p in (net.get("pins") or [])
                if isinstance(p, dict)
            }
            if old_pins != new_pins:
                changes.append(
                    {
                        "id": f"sch-net-chg-{key}",
                        "kind": "changed",
                        "domain": "schematic",
                        "category": "nets",
                        "label": key,
                        "page": pages[0] if pages else None,
                        "alsoOnPages": pages,
                        "net": key,
                        "fields": {
                            "pins": {
                                "old": len(old_pins),
                                "new": len(new_pins),
                            }
                        },
                    }
                )

    for key, net in base_nets.items():
        if key in head_nets:
            continue
        pages = _net_pages(net, base)
        changes.append(
            {
                "id": f"sch-net-del-{key}",
                "kind": "removed",
                "domain": "schematic",
                "category": "nets",
                "label": key,
                "page": pages[0] if pages else None,
                "alsoOnPages": pages,
                "net": key,
            }
        )

    # PCB footprint / track presence from geometry sidecars is applied by caller
    return {
        "changes": changes,
        "summary": {
            "added": sum(1 for c in changes if c["kind"] == "added"),
            "removed": sum(1 for c in changes if c["kind"] == "removed"),
            "changed": sum(1 for c in changes if c["kind"] == "changed"),
        },
    }


def _diff_pcb_geometry(base_geom: Dict[str, Any], head_geom: Dict[str, Any]) -> List[Dict[str, Any]]:
    base = base_geom.get("pcb") or {}
    head = head_geom.get("pcb") or {}
    changes: List[Dict[str, Any]] = []
    for uid, item in head.items():
        if uid not in base:
            changes.append(
                {
                    "id": f"pcb-add-{uid}",
                    "kind": "added",
                    "domain": "pcb",
                    "category": {
                        "track": "nets",
                        "via": "nets",
                        "footprint": "components",
                    }.get(item.get("kind"), "graphics"),
                    "label": item.get("net") or item.get("lib_id") or uid[:8],
                    "uuid": uid,
                    "layers": [item["layer"]] if item.get("layer") else [],
                    "geometry": item,
                }
            )
        elif item != base[uid]:
            layers = list(
                {
                    *( [item["layer"]] if item.get("layer") else [] ),
                    *( [base[uid]["layer"]] if base[uid].get("layer") else [] ),
                }
            )
            changes.append(
                {
                    "id": f"pcb-chg-{uid}",
                    "kind": "changed",
                    "domain": "pcb",
                    "category": {
                        "track": "nets",
                        "via": "nets",
                        "footprint": "components",
                    }.get(item.get("kind"), "graphics"),
                    "label": item.get("net") or item.get("lib_id") or uid[:8],
                    "uuid": uid,
                    "layers": layers,
                    "geometry": item,
                    "oldGeometry": base[uid],
                }
            )
    for uid, item in base.items():
        if uid in head:
            continue
        changes.append(
            {
                "id": f"pcb-del-{uid}",
                "kind": "removed",
                "domain": "pcb",
                "category": {
                    "track": "nets",
                    "via": "nets",
                    "footprint": "components",
                }.get(item.get("kind"), "graphics"),
                "label": item.get("net") or item.get("lib_id") or uid[:8],
                "uuid": uid,
                "layers": [item["layer"]] if item.get("layer") else [],
                "geometry": item,
            }
        )
    return changes


def _diff_stackup(base: Dict[str, Any], head: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "base": base.get("layers") or [],
        "head": head.get("layers") or [],
        "changed": json.dumps(base.get("layers") or [], sort_keys=True)
        != json.dumps(head.get("layers") or [], sort_keys=True),
        "present": bool(base.get("present") or head.get("present")),
    }


def _run_job(job_id: str, project_id: str, base: str, head: str) -> None:
    job = design_compare_jobs[job_id]
    logs: List[str] = job.setdefault("logs", [])
    try:
        repo_path, relative_path, _checkout = _repo_paths(project_id)
        job["message"] = "Building revisions…"
        job["percent"] = 10
        _persist_job(job_id)

        revisions: Dict[str, Dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = {
                pool.submit(
                    _load_or_build_revision,
                    project_id,
                    repo_path,
                    relative_path,
                    commit,
                    logs,
                ): commit
                for commit in (base, head)
            }
            for fut in as_completed(futures):
                commit = futures[fut]
                revisions[commit] = fut.result()

        job["percent"] = 55
        job["message"] = "Diffing designs…"
        _persist_job(job_id)

        base_rev = revisions[base]
        head_rev = revisions[head]
        sch_diff = _diff_designs(base_rev.get("design") or {}, head_rev.get("design") or {})
        pcb_changes = _diff_pcb_geometry(
            base_rev.get("geometry") or {}, head_rev.get("geometry") or {}
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
        bom = bom_diff_service.diff_boms(old_bom, new_bom, fields)

        stackup = _diff_stackup(base_rev.get("stackup") or {}, head_rev.get("stackup") or {})

        sheets = sorted(
            {
                Path(s["filename"]).name
                for s in (head_rev.get("sources") or []) + (base_rev.get("sources") or [])
                if s["filename"].endswith(".kicad_sch")
            }
        )

        result = {
            "base": base,
            "head": head,
            "files": {
                "base": base_rev.get("sources") or [],
                "head": head_rev.get("sources") or [],
            },
            "schematic": {
                "pages": sheets,
                "changes": [c for c in sch_diff["changes"] if c["domain"] == "schematic"],
                "summary": sch_diff["summary"],
            },
            "pcb": {
                "changes": pcb_changes,
                "summary": {
                    "added": sum(1 for c in pcb_changes if c["kind"] == "added"),
                    "removed": sum(1 for c in pcb_changes if c["kind"] == "removed"),
                    "changed": sum(1 for c in pcb_changes if c["kind"] == "changed"),
                },
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


def start_design_compare_job(project_id: str, base: str, head: str) -> str:
    job_id = str(uuid.uuid4())
    design_compare_jobs[job_id] = {
        "job_id": job_id,
        "project_id": project_id,
        "base": base,
        "head": head,
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
        base=base,
        head=head,
    )
    threading.Thread(
        target=_run_job, args=(job_id, project_id, base, head), daemon=True
    ).start()
    return job_id


def get_job_status(job_id: str) -> Optional[dict]:
    job = design_compare_jobs.get(job_id) or workspace.get_job(job_id, "design_compare")
    if not job:
        return None
    return {
        "job_id": job_id,
        "status": job.get("status"),
        "message": job.get("message"),
        "percent": job.get("percent", 0),
        "logs": job.get("logs") or [],
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
