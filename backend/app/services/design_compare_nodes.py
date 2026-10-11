"""Parser-level object changes, turned into review items.

Where the semantic pass compares meanings, this compares the objects KiCad
actually stores — every track, pad, zone, graphic and constraint — and decides
what each difference is called and which discipline it belongs to. Rolling
changes up into review items is the frontend's
(``comparison-review-groups.ts``).

Pure: it reads an already-computed object delta and returns change records.
"""

import hashlib
import math
from typing import Any, Dict, List, Optional, Tuple

from app.services import semantic_index_service
from .design_compare_occurrences import component_uid, is_power_symbol
from .design_compare_semantics import _native_item


_SCHEMATIC_NET_OBJECT_KINDS = {
    "wire",
    "bus",
    "bus_alias",
    "bus_entry",
    "label",
    "junction",
    "pin",
    "sheet_pin",
    "no_connect",
}


_PCB_COPPER_OBJECT_KINDS = {"track", "arc", "via"}


_PRIMARY_CONSTRAINT_KINDS = {
    "board_constraint",
    "custom_rule",
    "drc_exclusion",
    "erc_exclusion",
    "erc_pin_rule",
    "fabrication_output",
    "net_class",
    "net_class_assignment",
}


_SECONDARY_CONSTRAINT_KINDS = {
    "board_default",
    "drc_severity",
    "routing_preset",
    "teardrop_setting",
    "zone_setting",
}


_CONSTRAINT_KINDS = _PRIMARY_CONSTRAINT_KINDS | _SECONDARY_CONSTRAINT_KINDS


_SCHEMATIC_PROJECT_KINDS = {"erc_exclusion", "erc_pin_rule", "project_metadata"}


_NET_AGGREGATE_OBJECT_KINDS = {
    "track",
    "arc",
    "via",
    "wire",
    "bus",
    "label",
    "junction",
}


_PCB_GRAPHIC_OBJECT_KINDS = {"graphic", "footprint_graphic", "footprint_text"}


_PCB_FABRICATION_LAYER_SUFFIXES = (
    ".cu",
    ".mask",
    ".paste",
    ".silks",
    ".fab",
    ".crtyd",
    ".adhes",
)


def _parser_layer_name(value: Any) -> Optional[str]:
    if isinstance(value, dict):
        value = value.get("name") or value.get("canonical_name")
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _item_layers(item: Dict[str, Any]) -> List[str]:
    """Layers authored on one revision's native object.

    A track or arc names a single layer; a via names its span endpoints. The
    reviewer view needs these per revision, not merged, so a focused routing
    review can show each pane only the copper that revision actually carries.
    """
    return sorted(
        {
            normalized
            for layer in [item.get("layer"), *(item.get("layers") or [])]
            if (normalized := _parser_layer_name(layer))
        }
    )


def _is_pcb_fabrication_layer(value: str) -> bool:
    folded = value.casefold()
    return folded in {"edge.cuts", "margin"} or folded.endswith(
        _PCB_FABRICATION_LAYER_SUFFIXES
    )


def _node_classification(
    *,
    domain: str,
    native_kind: str,
    power_symbol: bool,
    layers: List[str],
) -> Tuple[str, str]:
    """Return the reviewer taxonomy, independent of incidental net/ref fields."""

    if native_kind == "project_metadata":
        return "text", "secondary"
    if native_kind in _CONSTRAINT_KINDS:
        classification = (
            "primary" if native_kind in _PRIMARY_CONSTRAINT_KINDS else "secondary"
        )
        return "rules", classification

    if domain == "schematic":
        if native_kind == "symbol" and not power_symbol:
            return "components", "primary"
        if power_symbol or native_kind in _SCHEMATIC_NET_OBJECT_KINDS:
            return "nets", "primary"
        if native_kind == "sheet":
            return "sheets", "primary"
        return "graphics", "secondary"

    if native_kind == "footprint":
        return "components", "primary"
    if native_kind == "pad":
        return "components", "primary"
    if native_kind == "zone":
        return "zones", "primary"
    if native_kind in _PCB_COPPER_OBJECT_KINDS:
        return "nets", "primary"
    if native_kind in _PCB_GRAPHIC_OBJECT_KINDS:
        classification = (
            "primary" if any(_is_pcb_fabrication_layer(layer) for layer in layers)
            else "secondary"
        )
        return "graphics", classification
    return "other", "secondary"


def _node_label(
    active: Dict[str, Any],
    *,
    native_kind: str,
    reference: Optional[str],
    net: Optional[str],
) -> str:
    number = active.get("number")
    text = active.get("text")
    name = active.get("name")
    if reference and native_kind == "pad" and number not in (None, ""):
        return f"{reference} pad {number}"
    if reference and native_kind == "pin" and number not in (None, ""):
        return f"{reference} pin {number}"
    if reference and native_kind in {"footprint_graphic", "footprint_text"}:
        detail = text or native_kind.replace("_", " ")
        return f"{reference} · {detail}"
    if native_kind == "sheet_pin" and text:
        return f"Sheet pin {text}"
    if native_kind == "no_connect":
        return "No-connect marker"
    if native_kind == "zone" and name:
        return str(name)
    if native_kind == "group" and name:
        return str(name)
    if native_kind in _CONSTRAINT_KINDS and name:
        return str(name)
    return str(
        reference
        or net
        or name
        or text
        or active.get("libId")
        or str(active.get("uuid") or "")[:12]
    )


def _native_index(side: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {
        str(item["uuid"]): item
        for item in side.get("nativeObjects") or []
        if item.get("uuid")
    }


def _property_value(item: Dict[str, Any], name: str) -> str:
    for prop in item.get("properties") or []:
        if str(prop.get("name") or "") == name:
            return str(prop.get("value") or "")
    return ""


def _property_attributes(value: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(value, dict):
        return None
    compact = {
        key: item
        for key, item in value.items()
        if item not in (None, False, "", [], {})
    }
    # Keep this structured all the way to the review card. Serializing it here
    # exposed implementation JSON instead of readable position/visibility and
    # text-effect evidence.
    return compact


def _node_change(change: Dict[str, Any]) -> Dict[str, Any]:
    before = change.get("base") or {}
    after = change.get("compare") or {}
    active = after or before or change
    # The parser emits canonical kinds (`track`, `label`, ...; CANONICAL_KINDS in
    # backend/design-compare-parser/ecad-parse.mjs).
    native_kind = str(active.get("kind") or change.get("kind") or "")
    document_path = str(active.get("documentPath") or change.get("documentPath") or "")
    domain = (
        "schematic"
        if native_kind in _SCHEMATIC_PROJECT_KINDS
        else "pcb"
        if native_kind in _CONSTRAINT_KINDS
        or document_path.endswith((".kicad_pcb", ".kicad_pro", ".kicad_dru"))
        else "schematic"
    )
    power_symbol = is_power_symbol(active)
    base_layers = _item_layers(before)
    compare_layers = _item_layers(after)
    layers = sorted(set(base_layers) | set(compare_layers))
    category, classification = _node_classification(
        domain=domain,
        native_kind=native_kind,
        power_symbol=power_symbol,
        layers=layers,
    )
    reference = None if power_symbol else active.get("refdes")
    net = (
        active.get("net")
        or (_property_value(active, "Value") if power_symbol else None)
        or (str(active.get("libId") or "").split(":", 1)[-1] if power_symbol else None)
    )
    status = str(change.get("status") or "")
    kind = "changed" if status == "modified" else status
    base_source = before.get("uuid") if before else None
    compare_source = after.get("uuid") if after else None
    native_source = compare_source or base_source
    if reference and native_kind in {"footprint", "symbol"}:
        semantic_id = component_uid(str(reference))
    elif net and (power_symbol or native_kind in _NET_AGGREGATE_OBJECT_KINDS):
        semantic_id = semantic_index_service._stable_uid("net", str(net))
    elif native_source:
        # Pads, zones, no-connect markers and authored graphics must remain
        # independently selectable even when they inherit a parent RefDes or
        # net name. Grouping those by the parent hid the exact fabrication
        # object that changed.
        semantic_id = semantic_index_service._stable_uid(
            "obj",
            domain,
            active.get("documentPath") or change.get("documentPath"),
            native_kind,
            native_source,
        )
    elif net:
        semantic_id = semantic_index_service._stable_uid("net", str(net))
    else:
        semantic_id = None
    source_side = "reference" if kind == "removed" else "comparison"
    fields: Dict[str, Any] = {}
    for delta in change.get("properties") or []:
        name = str(delta.get("name") or "")
        if not name:
            continue
        if delta.get("from") != delta.get("to"):
            fields[name] = {"old": delta.get("from"), "new": delta.get("to")}
        if delta.get("attributesChanged"):
            fields[f"{name} attributes"] = {
                "old": _property_attributes(delta.get("fromAttributes")),
                "new": _property_attributes(delta.get("toAttributes")),
            }

    def targets_for(item: Dict[str, Any], side: str, target_status: str) -> List[Dict[str, Any]]:
        if item.get("reviewOnly"):
            return []
        paths = item.get("kiidPaths") or [None]
        return [
            {
                "side": side,
                "status": target_status,
                "sourceId": item.get("uuid"),
                "parentSourceId": item.get("parentUuid"),
                "page": item.get("documentPath"),
                "documentPath": item.get("documentPath"),
                "sheetPath": (
                    str(path)[: -(len(str(item.get("uuid") or "")) + 1)] or "/"
                    if path and str(path).endswith(f"/{item.get('uuid')}")
                    else None
                ),
                "kind": native_kind,
                "at": item.get("at"),
                "reference": reference,
                "role": (
                    "component"
                    if category == "components"
                    else "label"
                    if power_symbol
                    else native_kind
                ),
            }
            for path in paths
        ]

    if (
        kind == "changed"
        and domain == "pcb"
        and native_kind in _PCB_COPPER_OBJECT_KINDS
    ):
        # A routing modification is intrinsically two-sided. Carry both
        # native identities even when KiCad preserved the same UUID so each
        # revision pane resolves its own copper geometry and layer set. The
        # viewer must never infer the old route from the comparison object.
        targets = [
            *targets_for(before, "reference", "modified"),
            *targets_for(after, "comparison", "modified"),
        ]
    else:
        targets = targets_for(
            before if source_side == "reference" else after or before,
            source_side,
            "modified" if kind == "changed" else kind,
        )
    if kind == "changed" and "re-pathed" in (change.get("reasons") or []):
        targets = [
            *targets_for(before, "reference", "modified"),
            *targets_for(after, "comparison", "modified"),
        ]
    digest = hashlib.sha256(str(change.get("key") or "").encode("utf-8")).hexdigest()[:20]
    old_at = before.get("at")
    new_at = after.get("at")
    return {
        "id": f"{'sch' if domain == 'schematic' else 'pcb'}-{kind}-{digest}",
        "kind": kind,
        "domain": domain,
        "category": category,
        "classification": classification,
        "label": _node_label(
            active,
            native_kind=native_kind,
            reference=reference,
            net=net,
        ),
        "page": active.get("documentPath"),
        "alsoOnPages": [active["documentPath"]] if active.get("documentPath") else [],
        "reference": reference,
        "net": net,
        "semantic_id": semantic_id,
        "uuid": compare_source or base_source,
        "source_id_base": base_source,
        "source_id_compare": compare_source,
        "parent_source_id_base": before.get("parentUuid"),
        "parent_source_id_compare": after.get("parentUuid"),
        "source_side": source_side,
        "layers": layers,
        "position_base": old_at,
        "position_compare": new_at,
        "position_delta": change.get("positionDelta"),
        "base_item": _native_item(
            source_id=base_source,
            semantic_id=semantic_id,
            page=before.get("documentPath"),
            layer=_parser_layer_name(before.get("layer")),
            layers=base_layers,
            reference=before.get("refdes"),
            net=before.get("net"),
            parent_source_id=before.get("parentUuid"),
        ),
        "compare_item": _native_item(
            source_id=compare_source,
            semantic_id=semantic_id,
            page=after.get("documentPath"),
            layer=_parser_layer_name(after.get("layer")),
            layers=compare_layers,
            reference=after.get("refdes"),
            net=after.get("net"),
            parent_source_id=after.get("parentUuid"),
        ),
        "fields": fields,
        "reasons": change.get("reasons")
        or (["object-added"] if kind == "added" else ["object-removed"]),
        "details": {
            "visualTargets": targets,
            **({"reviewOnly": True} if active.get("reviewOnly") else {}),
        },
        "object_kind": native_kind,
    }


def _node_changes(delta: Dict[str, Any], domain: str) -> List[Dict[str, Any]]:
    return [
        adapted
        for change in delta.get("changes") or []
        if (adapted := _node_change(change)).get("domain") == domain
    ]


def _hydrate_native_targets(
    changes: List[Dict[str, Any]],
    base_side: Dict[str, Any],
    head_side: Dict[str, Any],
) -> None:
    indexes = {
        "reference": _native_index(base_side),
        "comparison": _native_index(head_side),
    }
    for change in changes:
        details = change.get("details") or {}
        targets = list(details.get("visualTargets") or [])
        for target in targets:
            index = indexes[
                "reference" if target.get("side") == "reference" else "comparison"
            ]
            native = index.get(str(target.get("sourceId") or "")) or index.get(
                str(target.get("parentSourceId") or "")
            )
            if not native:
                continue
            semantic_page = target.get("page")
            native_page = native.get("documentPath")
            if semantic_page and semantic_page != native_page:
                target["sheetPath"] = str(semantic_page)
            target.update(
                {
                    "page": native_page,
                    "documentPath": native_page,
                    "kind": native.get("kind"),
                    "parentSourceId": native.get("parentUuid"),
                    "at": native.get("at"),
                }
            )
        if "label-count-changed" in (change.get("reasons") or []):
            removed = [
                target
                for target in targets
                if target.get("role") == "label"
                and target.get("side") == "reference"
            ]
            added = [
                target
                for target in targets
                if target.get("role") == "label"
                and target.get("side") == "comparison"
            ]
            paired_added: set[int] = set()
            paired_removed: set[int] = set()
            for old_target in sorted(
                removed, key=lambda target: str(target.get("sourceId"))
            ):
                old_page = old_target.get("sheetPath") or old_target.get("page")
                old_at = old_target.get("at") or [0, 0]
                candidates = [
                    (index, target)
                    for index, target in enumerate(added)
                    if index not in paired_added
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
                            float((candidate[1].get("at") or [0, 0])[0])
                            - float(old_at[0]),
                            float((candidate[1].get("at") or [0, 0])[1])
                            - float(old_at[1]),
                        ),
                        str(candidate[1].get("sourceId")),
                    ),
                )
                paired_added.add(match_index)
                paired_removed.add(id(old_target))
            targets = [
                target
                for target in targets
                if id(target) not in paired_removed
                and not (
                    target.get("role") == "label"
                    and target.get("side") == "comparison"
                    and any(target is added[index] for index in paired_added)
                )
            ]
        details["visualTargets"] = targets


def _route_metrics_from_digest(
    digest: Dict[str, Any],
    stackup: Dict[str, Any],
) -> Dict[str, Any]:
    """Finish route metrics from the parser's compact per-net aggregates."""

    stack_layers = stackup.get("layers") or []
    layer_indexes = {
        str(layer.get("name")): index
        for index, layer in enumerate(stack_layers)
        if layer.get("name")
    }

    def span_length(span: str) -> Optional[float]:
        endpoints = span.split("|") if span else []
        if len(endpoints) != 2 or any(name not in layer_indexes for name in endpoints):
            return None
        start, end = sorted(layer_indexes[name] for name in endpoints)
        thicknesses = [
            layer.get("thickness")
            for layer in stack_layers[start : end + 1]
        ]
        if not thicknesses or not all(
            isinstance(value, (int, float)) for value in thicknesses
        ):
            return None
        return float(sum(thicknesses))

    result: Dict[str, Any] = {}
    for net, raw in (digest.get("routeMetrics") or {}).items():
        name = str(net).strip()
        if not name:
            continue
        reliable = True
        barrel = 0.0
        for span, count in (raw.get("viaSpans") or {}).items():
            length = span_length(str(span))
            if length is None:
                reliable = False
            else:
                barrel += length * int(count)
        via_count = int(raw.get("viaCount") or 0)
        diagnostics = ["Propagation delay is not available from source geometry."]
        if not reliable and via_count:
            diagnostics.append(
                "Via barrel length is unavailable because the via span or stack thickness is incomplete."
            )
        result[name] = {
            "centerline_length_mm": round(float(raw.get("routeLengthMm") or 0), 4),
            "via_count": via_count,
            "used_layers": sorted(str(value) for value in raw.get("usedLayers") or []),
            "via_barrel_length_mm": round(barrel, 4) if reliable else None,
            "propagation_delay": None,
            "diagnostics": diagnostics,
        }
    return result
