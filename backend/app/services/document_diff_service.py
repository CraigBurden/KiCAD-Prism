"""KiCad-shaped document-diff normalization.

This module is independent of rendering. It adapts Prism's semantic comparison
result to the same PROJECT_DIFF / DOCUMENT_DIFF / ITEM_CHANGE shape consumed
by KiCad's comparison dialog and ecad-viewer. A future kicad-cli provider can
replace this adapter without changing the frontend or viewer contract.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Mapping, Optional


_TYPE_NAMES = {
    "symbol": "SCH_SYMBOL",
    "wire": "SCH_LINE",
    "graphic": "SCH_SHAPE",
    "footprint": "PCB_FOOTPRINT",
    "track": "PCB_TRACK",
    "arc": "PCB_ARC",
    "via": "PCB_VIA",
    "zone": "ZONE",
}

_KIND_NAMES = {
    "added": "added",
    "removed": "removed",
    "changed": "modified",
}


def _first_pcb_path(files: Mapping[str, Any]) -> Optional[str]:
    for side in ("head", "base"):
        for source in files.get(side) or []:
            path = str(source.get("path") or source.get("filename") or "")
            if path.endswith(".kicad_pcb"):
                return path.replace("\\", "/")
    return None


def _source_id(change: Mapping[str, Any]) -> Optional[str]:
    if change.get("kind") == "removed":
        value = change.get("source_id_base")
    else:
        value = change.get("source_id_compare") or change.get("source_id_base")
    return str(value) if value else None


def _geometry(change: Mapping[str, Any]) -> Mapping[str, Any]:
    if change.get("kind") == "removed":
        return change.get("oldGeometry") or {}
    return change.get("geometry") or change.get("oldGeometry") or {}


def _document_path(
    change: Mapping[str, Any],
    pcb_path: Optional[str],
) -> Optional[str]:
    if change.get("domain") == "pcb":
        return pcb_path
    geometry = _geometry(change)
    path = (
        geometry.get("page")
        or change.get("page")
        or (change.get("compare_item") or {}).get("page")
        or (change.get("base_item") or {}).get("page")
    )
    return str(path).replace("\\", "/") if path else None


def _bbox_iu(bounds: Any, domain: str) -> List[int]:
    if (
        not isinstance(bounds, (list, tuple))
        or len(bounds) != 4
        or not all(isinstance(value, (int, float)) for value in bounds)
    ):
        return [0, 0, 0, 0]
    iu_per_mm = 1_000_000 if domain == "pcb" else 10_000
    return [round(float(value) * iu_per_mm) for value in bounds]


def _diff_value(value: Any) -> Dict[str, Any]:
    if value is None:
        return {"type": "null", "v": None}
    if isinstance(value, bool):
        return {"type": "bool", "v": value}
    if isinstance(value, int):
        return {"type": "int", "v": value}
    if isinstance(value, float):
        return {"type": "double", "v": value}
    return {"type": "string", "v": str(value)}


def _property_deltas(change: Mapping[str, Any]) -> List[Dict[str, Any]]:
    deltas: List[Dict[str, Any]] = []
    for name, delta in sorted((change.get("fields") or {}).items()):
        if isinstance(delta, Mapping):
            before = delta.get("old")
            after = delta.get("new")
        else:
            before = None
            after = delta
        deltas.append(
            {
                "name": str(name),
                "before": _diff_value(before),
                "after": _diff_value(after),
            }
        )
    return deltas


def _item_change(change: Mapping[str, Any], source_id: str) -> Dict[str, Any]:
    geometry = _geometry(change)
    refdes = change.get("reference") or change.get("net")
    return {
        "id": f"/{source_id}",
        "typeName": _TYPE_NAMES.get(str(geometry.get("kind") or ""), "EDA_ITEM"),
        "kind": _KIND_NAMES[str(change.get("kind"))],
        "properties": _property_deltas(change),
        "bbox": _bbox_iu(geometry.get("bounds"), str(change.get("domain"))),
        **({"refdes": str(refdes)} if refdes else {}),
        "children": [],
    }


def build_project_diff(
    *,
    schematic_changes: Iterable[Mapping[str, Any]],
    pcb_changes: Iterable[Mapping[str, Any]],
    files: Mapping[str, Any],
    geometry: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Build one strict PROJECT_DIFF plus a Prism-ID navigation sidecar."""

    pcb_path = _first_pcb_path(files)
    by_document: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    document_types: Dict[str, str] = {}
    navigation: Dict[str, Dict[str, str]] = {}
    diagnostics: List[Dict[str, str]] = []

    for original_change in [*schematic_changes, *pcb_changes]:
        change = dict(original_change)
        prism_id = str(change.get("id") or "")
        source_id = _source_id(change)
        if source_id and not _geometry(change):
            side = "base" if change.get("kind") == "removed" else "head"
            domain = str(change.get("domain") or "")
            resolved = (
                (((geometry or {}).get(side) or {}).get(domain) or {}).get(
                    source_id
                )
            )
            if resolved:
                change[
                    "oldGeometry" if change.get("kind") == "removed" else "geometry"
                ] = resolved
        path = _document_path(change, pcb_path)
        if not prism_id or not source_id or not path:
            diagnostics.append(
                {
                    "changeId": prism_id,
                    "reason": (
                        "missing-source-id"
                        if not source_id
                        else "missing-document-path"
                    ),
                }
            )
            continue

        item = _item_change(change, source_id)
        by_document[path].append(item)
        document_types[path] = (
            "kicad_pcb" if change.get("domain") == "pcb" else "kicad_sch"
        )
        navigation[prism_id] = {
            "documentPath": path,
            "changeId": item["id"],
        }

    documents = [
        {
            "path": path,
            "docType": document_types[path],
            "changes": changes,
        }
        for path, changes in sorted(by_document.items())
    ]
    return {
        "schema": "prism.kicad_project_diff_v1",
        "provider": "prism-semantic",
        "project": {"documents": documents},
        "navigation": navigation,
        "diagnostics": diagnostics,
    }
