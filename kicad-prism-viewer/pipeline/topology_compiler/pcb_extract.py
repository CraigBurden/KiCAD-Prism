from __future__ import annotations

from pathlib import Path
from typing import Any

from .models import stable_id


LAYER_COLORS = {
    "Board": "#2f6b4f",
    "F.Cu": "#df342b",
    "B.Cu": "#245fd3",
    "Edge.Cuts": "#d9d9d9",
    "F.SilkS": "#f2f2f2",
    "B.SilkS": "#dddddd",
    "F.Mask": "#316d4f",
    "B.Mask": "#275840",
    "F.Paste": "#c5cbd3",
    "B.Paste": "#aeb7c2",
}

INNER_LAYER_COLORS = [
    "#269e4d",
    "#93612f",
    "#159eb7",
    "#7047b8",
    "#b58b24",
    "#a34f76",
]


def _bbox_list(bounds: Any) -> list[float] | None:
    if bounds is None or not bounds.is_valid():
        return None
    return [
        round(float(bounds.min_x), 6),
        round(float(bounds.min_y), 6),
        round(float(bounds.max_x), 6),
        round(float(bounds.max_y), 6),
    ]


def _bbox_from_points(points: list[tuple[float, float]]) -> list[float] | None:
    if not points:
        return None
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    return [round(min(xs), 6), round(min(ys), 6), round(max(xs), 6), round(max(ys), 6)]


def _merge_bbox(left: list[float] | None, right: list[float] | None) -> list[float] | None:
    if not left:
        return right
    if not right:
        return left
    return [
        min(left[0], right[0]),
        min(left[1], right[1]),
        max(left[2], right[2]),
        max(left[3], right[3]),
    ]


def _clean_contour(points: list[tuple[float, float]]) -> list[list[float]]:
    cleaned: list[list[float]] = []
    for x, y in points:
        point = [round(float(x), 6), round(float(y), 6)]
        if cleaned and cleaned[-1] == point:
            continue
        cleaned.append(point)
    if len(cleaned) > 1 and cleaned[0] == cleaned[-1]:
        cleaned.pop()
    return cleaned if len(cleaned) >= 3 else []


def _geometry_from_contours(contours: list[list[tuple[float, float]]]) -> dict[str, Any]:
    cleaned = [_clean_contour(contour) for contour in contours]
    cleaned = [contour for contour in cleaned if contour]
    if not cleaned:
        return {}
    return {"type": "polygons", "contours": cleaned}


def _geometry_from_polyset(polyset: Any) -> dict[str, Any]:
    if polyset is None or polyset.is_empty():
        return {}
    return _geometry_from_contours(list(getattr(polyset, "outlines", []) or []))


def _transform_contour(
    contour: list[tuple[float, float]],
    x: float,
    y: float,
    angle: float,
) -> list[tuple[float, float]]:
    from kicad_monkey.kicad_geometry import rotate_point  # type: ignore

    transformed: list[tuple[float, float]] = []
    for px, py in contour:
        rx, ry = rotate_point(float(px), float(py), -angle)
        transformed.append((rx + x, ry + y))
    return transformed


def _pad_contours(pad: Any, footprint: Any) -> list[list[tuple[float, float]]]:
    from kicad_monkey.kicad_pcb_polygon_ops import circle_to_polygon, oval_to_polygon  # type: ignore

    shape = _value(getattr(getattr(pad, "shape", ""), "value", getattr(pad, "shape", "")))
    if shape == "circle":
        contours = [circle_to_polygon((pad.at_x, pad.at_y), pad.size_x / 2.0)]
    elif shape == "oval":
        start, end, width = pad._to_oval_segment(pad.at_x, pad.at_y)
        contours = [oval_to_polygon(start, end, width)]
    elif shape == "roundrect":
        contours = [pad._to_roundrect_polygon(pad.at_x, pad.at_y)]
    elif shape == "trapezoid":
        contours = [pad._to_trapezoid_polygon(pad.at_x, pad.at_y)]
    elif shape == "custom" and getattr(pad, "custom_primitives", None):
        contours = [
            list(primitive.points)
            for primitive in pad.custom_primitives
            if getattr(primitive, "primitive_type", "") == "gr_poly" and primitive.points
        ]
    else:
        contours = [pad._to_rect_polygon(pad.at_x, pad.at_y)]

    return [
        _transform_contour(
            contour,
            float(getattr(footprint, "at_x", 0.0) or 0.0),
            float(getattr(footprint, "at_y", 0.0) or 0.0),
            float(getattr(footprint, "at_angle", 0.0) or 0.0),
        )
        for contour in contours
    ]


def _value(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _net_name(net: Any) -> str:
    return _value(getattr(net, "name", ""))


def _net_uid(name: str) -> str:
    return stable_id("net", name) if name else ""


def _component_uid(designator: str) -> str:
    return stable_id("cmp", designator) if designator else ""


def _role_for_layer(name: str, raw_type: str = "") -> str:
    if name == "Board":
        return "dielectric"
    if name == "Edge.Cuts":
        return "outline"
    if name.endswith(".Cu"):
        return "copper"
    if name.endswith(".Mask"):
        return "soldermask"
    if name.endswith(".Paste"):
        return "paste"
    if name.endswith(".SilkS"):
        return "silkscreen"
    if name.endswith(".Fab"):
        return "fabrication"
    if raw_type:
        return raw_type
    return "drawing"


def _layer_material(role: str) -> str:
    if role == "dielectric":
        return "FR4"
    if role == "copper":
        return "copper"
    if role == "soldermask":
        return "soldermask"
    if role == "silkscreen":
        return "ink"
    return role


def _declared_layers(pcb: Any, pcb_file: Path | None = None) -> list[dict[str, Any]]:
    board_thickness = float(getattr(pcb, "thickness", 1.6) or 1.6)
    stackup = getattr(pcb, "stackup", None)
    stackup_layers = list(getattr(stackup, "layers", []) or [])

    allowed_roles = {"copper", "dielectric", "soldermask", "silkscreen", "paste"}
    if stackup_layers:
        return _normalize_stackup_layers(
            [
                {
                    "name": _value(getattr(raw, "name", "")) or f"stackup_{index}",
                    "role": _stackup_role(raw),
                    "type": _value(getattr(raw, "type_name", "")),
                    "thickness_mm": float(getattr(raw, "thickness", 0.0) or 0.0),
                    "material": _value(getattr(raw, "material", "")),
                    "epsilon_r": _float_or_none(getattr(raw, "epsilon_r", None)),
                    "loss_tangent": _float_or_none(getattr(raw, "loss_tangent", None)),
                    "color": _value(getattr(raw, "color", "")),
                }
                for index, raw in enumerate(stackup_layers)
            ],
            allowed_roles,
        )

    if pcb_file:
        parsed_layers = _stackup_layers_from_pcb_file(pcb_file)
        if parsed_layers:
            return _normalize_stackup_layers(parsed_layers, allowed_roles)

    # Fallback when no physical stackup is defined
    extracted_layers = []
    for raw in getattr(pcb, "layers", []) or []:
        name = _value(getattr(raw, "canonical_name", ""))
        if not name:
            continue
        raw_type = _value(getattr(getattr(raw, "layer_type", ""), "value", ""))
        role = _role_for_layer(name, raw_type)
        if role not in allowed_roles:
            continue
        thickness = 0.035 if role == "copper" else 0.01 if role == "soldermask" else 0.0
        extracted_layers.append(
            {
                "name": name,
                "role": role,
                "thickness_mm": thickness,
                "material": _layer_material(role),
                "color": LAYER_COLORS.get(name, "#8a8a8a"),
                "synthetic_stackup": True,
            }
        )

    existing_physical_thickness = sum(layer.get("thickness_mm", 0.0) or 0.0 for layer in extracted_layers)
    board_layer = {
        "name": "Board",
        "role": "dielectric",
        "type": "core",
        "thickness_mm": max(0.0, board_thickness - existing_physical_thickness),
        "material": "FR4",
        "color": LAYER_COLORS["Board"],
        "synthetic_stackup": True,
    }

    return _canonical_fallback_stackup(extracted_layers, board_layer)


def _canonical_fallback_stackup(
    extracted_layers: list[dict[str, Any]],
    board_layer: dict[str, Any],
) -> list[dict[str, Any]]:
    by_name = {str(layer.get("name") or ""): layer for layer in extracted_layers}
    used: set[int] = set()

    def take(name: str) -> dict[str, Any] | None:
        layer = by_name.get(name)
        if layer is None:
            return None
        used.add(id(layer))
        return layer

    ordered: list[dict[str, Any]] = []
    for name in ("F.SilkS", "F.Paste", "F.Mask", "F.Cu"):
        layer = take(name)
        if layer:
            ordered.append(layer)

    top_inner = [
        layer
        for layer in extracted_layers
        if id(layer) not in used and str(layer.get("role") or "") == "copper" and str(layer.get("name") or "").startswith("In")
    ]
    top_inner.sort(key=lambda layer: str(layer.get("name") or ""))
    for layer in top_inner:
        used.add(id(layer))
        ordered.append(layer)

    ordered.append(board_layer)

    bottom_copper = take("B.Cu")
    if bottom_copper:
        ordered.append(bottom_copper)

    for name in ("B.Mask", "B.Paste", "B.SilkS"):
        layer = take(name)
        if layer:
            ordered.append(layer)

    remainder = [layer for layer in extracted_layers if id(layer) not in used]
    remainder.sort(key=lambda layer: _fallback_layer_sort_key(str(layer.get("name") or ""), str(layer.get("role") or "")))
    ordered.extend(remainder)

    for index, layer in enumerate(ordered):
        layer["stack_index"] = index
    return ordered


def _fallback_layer_sort_key(name: str, role: str) -> tuple[int, str]:
    if name.startswith("F."):
        return (10, name)
    if role == "copper":
        return (20, name)
    if name.startswith("B."):
        return (30, name)
    return (40, name)


def _stackup_role(raw: Any) -> str:
    name = _value(getattr(raw, "name", ""))
    get_item_type = getattr(raw, "get_item_type", None)
    item_type = get_item_type() if callable(get_item_type) else ""
    role = _value(getattr(item_type, "value", item_type)).lower()
    return _normalize_physical_role(role or _role_for_layer(name, _value(getattr(raw, "type_name", ""))))


def _normalize_physical_role(role: str) -> str:
    normalized = _value(role).lower()
    if normalized == "solderpaste":
        return "paste"
    if normalized in {"core", "prepreg"}:
        return "dielectric"
    return normalized


def _normalize_stackup_layers(raw_layers: list[dict[str, Any]], allowed_roles: set[str]) -> list[dict[str, Any]]:
    extracted_layers = []
    inner_index = 0
    for raw in raw_layers:
        name = _value(raw.get("name")) or f"stackup_{len(extracted_layers)}"
        role = _normalize_physical_role(_value(raw.get("role")) or _role_for_layer(name, _value(raw.get("type"))))
        if role not in allowed_roles:
            continue
        color = _value(raw.get("color"))
        if role == "copper":
            if name == "F.Cu":
                color = "#df342b"
            elif name == "B.Cu":
                color = "#245fd3"
            else:
                color = INNER_LAYER_COLORS[inner_index % len(INNER_LAYER_COLORS)]
                inner_index += 1
        extracted_layers.append(
            {
                "name": name,
                "role": role,
                "type": _value(raw.get("type")),
                "thickness_mm": float(raw.get("thickness_mm") or 0.0),
                "material": _value(raw.get("material")) or _layer_material(role),
                "color": color or LAYER_COLORS.get(name, "#8a8a8a"),
                "stack_index": len(extracted_layers),
                "epsilon_r": _float_or_none(raw.get("epsilon_r")),
                "loss_tangent": _float_or_none(raw.get("loss_tangent")),
            }
        )
    return extracted_layers


def _stackup_layers_from_pcb_file(pcb_file: Path) -> list[dict[str, Any]]:
    if not pcb_file.is_file():
        return []
    try:
        from kicad_monkey.kicad_sexpr import parse_sexp  # type: ignore
    except Exception:
        return []
    try:
        root = parse_sexp(pcb_file.read_text(encoding="utf-8"))
    except Exception:
        return []
    setup = _sexp_child(root, "setup")
    stackup = _sexp_child(setup, "stackup") if setup else None
    if not stackup:
        return []
    layers: list[dict[str, Any]] = []
    for item in stackup:
        if not _sexp_is(item, "layer") or len(item) < 2:
            continue
        name = _value(item[1])
        layer_type = _value(_sexp_value(item, "type"))
        role = _normalize_physical_role(_role_for_layer(name, layer_type))
        layers.append(
            {
                "name": name,
                "role": role,
                "type": layer_type,
                "thickness_mm": _float_or_zero(_sexp_value(item, "thickness")),
                "material": _value(_sexp_value(item, "material")),
                "epsilon_r": _float_or_none(_sexp_value(item, "epsilon_r")),
                "loss_tangent": _float_or_none(_sexp_value(item, "loss_tangent")),
                "color": "",
            }
        )
    return layers


def _default_stackup_metadata() -> dict[str, Any]:
    return {
        "copper_finish": "None",
        "edge_connector": False,
        "castellated_pads": False,
        "edge_plating": False,
    }


def _stackup_metadata_from_pcb_file(pcb_file: Path) -> dict[str, Any]:
    defaults = _default_stackup_metadata()
    if not pcb_file.is_file():
        return defaults
    try:
        from kicad_monkey.kicad_sexpr import parse_sexp  # type: ignore
    except Exception:
        return defaults
    try:
        root = parse_sexp(pcb_file.read_text(encoding="utf-8"))
    except Exception:
        return defaults
    setup = _sexp_child(root, "setup")
    stackup = _sexp_child(setup, "stackup") if setup else None
    if not stackup:
        return defaults
    return {
        "copper_finish": _clean_enum_text(_sexp_value(stackup, "copper_finish")) or "None",
        "edge_connector": _manufacturing_bool(_sexp_value(stackup, "edge_connector"), default=False),
        "castellated_pads": _manufacturing_bool(_sexp_value(stackup, "castellated_pads"), default=False),
        "edge_plating": _manufacturing_bool(_sexp_value(stackup, "edge_plating"), default=False),
    }


def _sexp_is(value: Any, name: str) -> bool:
    return isinstance(value, list) and bool(value) and _value(value[0]) == name


def _sexp_child(value: Any, name: str) -> list[Any] | None:
    if not isinstance(value, list):
        return None
    return next((item for item in value if _sexp_is(item, name)), None)


def _sexp_value(value: Any, name: str) -> Any:
    child = _sexp_child(value, name)
    if child and len(child) > 1:
        return child[1]
    return None


def _float_or_zero(value: Any) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _float_or_none(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _boolish(value: Any) -> bool:
    return _value(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _boolish_or_none(value: Any) -> bool | None:
    text = _value(value).strip().lower()
    if not text:
        return None
    return text in {"1", "true", "yes", "y", "on"}


def _clean_enum_text(value: Any) -> str:
    text = _value(value).strip()
    if not text:
        return ""
    if "." in text:
        text = text.rsplit(".", 1)[-1]
    if text.lower() == "none":
        return "None"
    return text


def _manufacturing_bool(value: Any, *, default: bool | None = None) -> bool | None:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    text = _clean_enum_text(value).strip().lower().replace("-", "_")
    if not text:
        return default
    if text in {"0", "false", "no", "n", "off", "none"}:
        return False
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    return True


def _first_boolish(*values: Any, default: bool | None = None) -> bool | None:
    for value in values:
        parsed = _manufacturing_bool(value)
        if parsed is not None:
            return parsed
    return default


def _board_bbox(pcb: Any) -> list[float]:
    bbox: list[float] | None = None
    for item in pcb.top_level_outline_items(layer_name="Edge.Cuts"):
        bbox = _merge_bbox(bbox, _item_bbox(item))
    if bbox:
        return bbox
    board_bounds = _bbox_list(pcb.get_bounds())
    return board_bounds or [0.0, 0.0, 80.0, 50.0]


def _item_bbox(item: Any) -> list[float] | None:
    get_bounds = getattr(item, "get_bounds", None)
    if callable(get_bounds):
        return _bbox_list(get_bounds())
    get_corners = getattr(item, "get_corners", None)
    if callable(get_corners):
        return _bbox_from_points(list(get_corners()) or [])
    if all(hasattr(item, attr) for attr in ("start_x", "start_y", "end_x", "end_y")):
        return _bbox_from_points(
            [
                (float(item.start_x), float(item.start_y)),
                (float(item.end_x), float(item.start_y)),
                (float(item.end_x), float(item.end_y)),
                (float(item.start_x), float(item.end_y)),
            ]
        )
    return None


def _physical(
    *,
    uid_seed: str,
    kind: str,
    layer: str,
    layers: list[str] | None = None,
    bbox: list[float] | None,
    source_id: str = "",
    net_name: str = "",
    designator: str = "",
    geometry: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if not bbox:
        return None
    return {
        "uid": stable_id("obj", uid_seed),
        "kind": kind,
        "layer": layer,
        "layers": list(layers or ([layer] if layer else [])),
        "net_uid": _net_uid(net_name),
        "net_name": net_name,
        "component_uid": _component_uid(designator),
        "designator": designator,
        "bbox_mm": bbox,
        "source_ids": [source_id] if source_id else [],
        "geometry": geometry or {},
    }


def _extract_footprints(pcb: Any, *, include_geometry: bool = True) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    objects: list[dict[str, Any]] = []
    terminal_pad_links: list[dict[str, str]] = []
    for footprint in getattr(pcb, "footprints", []) or []:
        designator = _value(footprint.get_property_value("Reference", ""))
        footprint_bbox: list[float] | None = None
        source_id = _value(getattr(footprint, "uuid", ""))

        for pad in getattr(footprint, "pads", []) or []:
            pad_bounds = _bbox_list(pad.get_bounds())
            if not pad_bounds:
                continue
            transformed = _transform_local_bbox(
                pad_bounds,
                float(getattr(footprint, "at_x", 0.0) or 0.0),
                float(getattr(footprint, "at_y", 0.0) or 0.0),
                float(getattr(footprint, "at_angle", 0.0) or 0.0),
            )
            pad_geometry = _geometry_from_contours(_pad_contours(pad, footprint)) if include_geometry else {}
            footprint_bbox = _merge_bbox(footprint_bbox, transformed)
            layers = list(getattr(pad, "layers", []) or [])
            layer = next((name for name in layers if name.endswith(".Cu")), layers[0] if layers else _value(getattr(footprint, "layer", "")))
            net_name = _net_name(getattr(pad, "net", None))
            pad_uuid = _value(getattr(pad, "uuid", ""))
            pad_uid_seed = f"pad:{source_id}:{pad_uuid or pad.number}"
            pad_item = _physical(
                uid_seed=pad_uid_seed,
                kind="pad",
                layer=layer or "F.Cu",
                layers=layers,
                bbox=transformed,
                source_id=pad_uuid,
                net_name=net_name,
                designator=designator,
                geometry=pad_geometry,
            )
            if pad_item:
                objects.append(pad_item)
                terminal_pad_links.append(
                    {
                        "designator": designator,
                        "pin": _value(getattr(pad, "number", "")),
                        "net_name": net_name,
                        "object_uid": pad_item["uid"],
                    }
                )
        if footprint_bbox:
            footprint_bbox = [
                footprint_bbox[0] - 0.35,
                footprint_bbox[1] - 0.35,
                footprint_bbox[2] + 0.35,
                footprint_bbox[3] + 0.35,
            ]
        else:
            footprint_bbox = _bbox_list(footprint.get_bounds())
        item = _physical(
            uid_seed=f"footprint:{source_id or designator}",
            kind="footprint_body",
            layer=_value(getattr(footprint, "layer", "")) or "F.Cu",
            bbox=footprint_bbox,
            source_id=source_id,
            designator=designator,
        )
        if item:
            objects.append(item)
    return objects, terminal_pad_links


def _component_footprints(pcb: Any) -> list[dict[str, Any]]:
    components: list[dict[str, Any]] = []
    for footprint in getattr(pcb, "footprints", []) or []:
        designator = _value(footprint.get_property_value("Reference", ""))
        source_id = _value(getattr(footprint, "uuid", ""))
        bbox = _bbox_list(footprint.get_bounds())
        components.append(
            {
                "designator": designator,
                "uid": _component_uid(designator),
                "unique_id": source_id,
                "layer": _value(getattr(footprint, "layer", "")) or "F.Cu",
                "bbox_mm": bbox,
                "x_mm": float(getattr(footprint, "at_x", 0.0) or 0.0),
                "y_mm": float(getattr(footprint, "at_y", 0.0) or 0.0),
                "angle_deg": float(getattr(footprint, "at_angle", 0.0) or 0.0),
            }
        )
    return components


def _pad_records_and_links(pcb: Any) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    pads: list[dict[str, Any]] = []
    links: list[dict[str, str]] = []
    for footprint in getattr(pcb, "footprints", []) or []:
        designator = _value(footprint.get_property_value("Reference", ""))
        source_id = _value(getattr(footprint, "uuid", ""))
        for pad in getattr(footprint, "pads", []) or []:
            pad_bounds = _bbox_list(pad.get_bounds())
            if not pad_bounds:
                continue
            transformed = _transform_local_bbox(
                pad_bounds,
                float(getattr(footprint, "at_x", 0.0) or 0.0),
                float(getattr(footprint, "at_y", 0.0) or 0.0),
                float(getattr(footprint, "at_angle", 0.0) or 0.0),
            )
            layers = list(getattr(pad, "layers", []) or [])
            net_name = _net_name(getattr(pad, "net", None))
            pad_uuid = _value(getattr(pad, "uuid", ""))
            object_uid = stable_id("obj", f"pad:{source_id}:{pad_uuid or pad.number}")
            number = _value(getattr(pad, "number", ""))
            pads.append(
                {
                    "uid": object_uid,
                    "source_id": pad_uuid,
                    "designator": designator,
                    "pin": number,
                    "net_name": net_name,
                    "layers": layers,
                    "bbox_mm": transformed,
                    "drill": {
                        "drill_mm": _float_or_none(getattr(pad, "drill", None)),
                        "drill_width_mm": _float_or_none(getattr(pad, "drill_width", None)),
                        "drill_height_mm": _float_or_none(getattr(pad, "drill_height", None)),
                        "plated": bool(getattr(pad, "plated", False)),
                    },
                }
            )
            links.append(
                {
                    "designator": designator,
                    "pin": number,
                    "net_name": net_name,
                    "object_uid": object_uid,
                }
            )
    return pads, links


def _transform_local_bbox(bbox: list[float], x: float, y: float, angle: float) -> list[float]:
    if abs(angle) < 1e-12:
        return [bbox[0] + x, bbox[1] + y, bbox[2] + x, bbox[3] + y]
    from kicad_monkey.kicad_geometry import rotate_point  # type: ignore

    min_x, min_y, max_x, max_y = bbox
    points = [
        (min_x, min_y),
        (max_x, min_y),
        (max_x, max_y),
        (min_x, max_y),
    ]
    transformed = []
    for px, py in points:
        rx, ry = rotate_point(px, py, -angle)
        transformed.append((rx + x, ry + y))
    return _bbox_from_points(transformed) or bbox


def _extract_routing(pcb: Any) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for segment in getattr(pcb, "segments", []) or []:
        net_name = _net_name(getattr(segment, "net", None))
        item = _physical(
            uid_seed=f"segment:{getattr(segment, 'uuid', '')}",
            kind="track",
            layer=_value(getattr(segment, "layer", "")) or "F.Cu",
            bbox=_bbox_list(segment.get_bounds()),
            source_id=_value(getattr(segment, "uuid", "")),
            net_name=net_name,
            geometry=_geometry_from_polyset(segment._to_poly()),
        )
        if item:
            objects.append(item)

    for via in getattr(pcb, "vias", []) or []:
        layers = list(getattr(via, "layers", []) or [])
        net_name = _net_name(getattr(via, "net", None))
        item = _physical(
            uid_seed=f"via:{getattr(via, 'uuid', '')}",
            kind="via",
            layer=layers[0] if layers else "F.Cu",
            layers=layers,
            bbox=_bbox_list(via.get_bounds()),
            source_id=_value(getattr(via, "uuid", "")),
            net_name=net_name,
            geometry=_geometry_from_polyset(via._to_poly()),
        )
        if item:
            objects.append(item)

    for arc in getattr(pcb, "arcs", []) or []:
        net_name = _net_name(getattr(arc, "net", None))
        item = _physical(
            uid_seed=f"arc:{getattr(arc, 'uuid', '')}",
            kind="track_arc",
            layer=_value(getattr(arc, "layer", "")) or "F.Cu",
            bbox=_bbox_list(arc.get_bounds()),
            source_id=_value(getattr(arc, "uuid", "")),
            net_name=net_name,
            geometry=_geometry_from_polyset(arc._to_poly()),
        )
        if item:
            objects.append(item)
    return objects


def _extract_zones(pcb: Any) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for zone in getattr(pcb, "zones", []) or []:
        net_name = _net_name(getattr(zone, "net", None))
        layers = list(getattr(zone, "layers", []) or [])
        if not layers:
            layers = [_value(getattr(zone, "layer", "")) or "F.Cu"]
        for layer in layers:
            contours = [
                list(filled.points)
                for filled in getattr(zone, "filled_polygons", []) or []
                if getattr(filled, "points", None)
                and _value(getattr(filled, "layer", "")) in {"", layer}
            ]
            if not contours:
                contours = [
                    list(poly.points)
                    for poly in getattr(zone, "polygons", []) or []
                    if getattr(poly, "points", None)
                ]
            item = _physical(
                uid_seed=f"zone:{getattr(zone, 'uuid', '')}:{layer}",
                kind="zone",
                layer=layer,
                bbox=_bbox_list(zone.get_bounds()),
                source_id=_value(getattr(zone, "uuid", "")),
                net_name=net_name,
                geometry=_geometry_from_contours(contours),
            )
            if item:
                objects.append(item)
    return objects


def _extract_board_graphics(pcb: Any) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for rect in getattr(pcb, "gr_rects", []) or []:
        bbox = _bbox_from_points(
            [
                (rect.start_x, rect.start_y),
                (rect.end_x, rect.start_y),
                (rect.end_x, rect.end_y),
                (rect.start_x, rect.end_y),
            ]
        )
        item = _physical(
            uid_seed=f"graphic_rect:{getattr(rect, 'uuid', '')}",
            kind="board_outline" if getattr(rect, "layer", "") == "Edge.Cuts" else "graphic_rect",
            layer=_value(getattr(rect, "layer", "")) or "Edge.Cuts",
            bbox=bbox,
            source_id=_value(getattr(rect, "uuid", "")),
            geometry=_geometry_from_polyset(rect._to_poly()),
        )
        if item:
            objects.append(item)
    return objects


def _pcb_metadata_common(pcb: Any, project_file: Path, *, physical_objects: list[dict[str, Any]], terminal_pad_links: list[dict[str, str]]) -> dict[str, Any]:
    pcb_file = project_file.with_suffix(".kicad_pcb")
    layers = _declared_layers(pcb, pcb_file)
    stackup = getattr(pcb, "stackup", None)
    file_stackup_metadata = _stackup_metadata_from_pcb_file(pcb_file)
    computed_thickness = float(getattr(pcb, "thickness", 1.6) or 1.6)
    get_board_thickness = getattr(stackup, "get_board_thickness", None)
    if callable(get_board_thickness):
        computed_thickness = float(get_board_thickness() or computed_thickness)
    project_file_pro = project_file.with_suffix(".kicad_pro")
    net_classes_list = []
    if project_file_pro.is_file():
        try:
            from kicad_monkey.kicad_project import KiCadProject
            proj = KiCadProject.from_file(project_file_pro)
            if proj.net_settings and proj.net_settings.classes:
                for nc in proj.net_settings.classes:
                    net_classes_list.append({
                        "name": nc.name,
                        "track_width": nc.track_width,
                        "clearance": nc.clearance,
                        "diff_pair_gap": nc.diff_pair_gap,
                        "diff_pair_width": nc.diff_pair_width,
                        "via_diameter": nc.via_diameter,
                        "via_drill": nc.via_drill,
                    })
        except Exception:
            pass

    return {
        "source": str(pcb_file),
        "board": {
            "bbox_mm": _board_bbox(pcb),
            "thickness_mm": computed_thickness,
            "aux_axis_origin_mm": [0.0, 0.0],
            "stackup": {
                "present": True,
                "layers": layers,
                "computed_thickness_mm": computed_thickness,
                "copper_finish": _clean_enum_text(getattr(stackup, "copper_finish", ""))
                or file_stackup_metadata.get("copper_finish", "None"),
                "edge_connector": _first_boolish(
                    getattr(stackup, "edge_connector", None),
                    file_stackup_metadata.get("edge_connector"),
                    default=False,
                ),
                "castellated_pads": _first_boolish(
                    getattr(stackup, "castellated_pads", None),
                    file_stackup_metadata.get("castellated_pads"),
                    default=False,
                ),
                "edge_plating": _first_boolish(
                    getattr(stackup, "edge_plating", None),
                    file_stackup_metadata.get("edge_plating"),
                    default=False,
                ),
            },
            "net_classes": net_classes_list,
        },
        "physical_objects": physical_objects,
        "terminal_pad_links": terminal_pad_links,
        "components": _component_footprints(pcb),
        "stats": {
            "layers": len(layers),
            "footprints": len(getattr(pcb, "footprints", []) or []),
            "pads": sum(len(getattr(fp, "pads", []) or []) for fp in getattr(pcb, "footprints", []) or []),
            "segments": len(getattr(pcb, "segments", []) or []),
            "vias": len(getattr(pcb, "vias", []) or []),
            "zones": len(getattr(pcb, "zones", []) or []),
            "physical_objects": len(physical_objects),
        },
    }


def _profile_emit(callback, key: str, elapsed_ms: float | None = None, **values: Any) -> None:
    if not callback:
        return
    payload = dict(values)
    if elapsed_ms is not None:
        payload["elapsed_ms"] = elapsed_ms
    callback(key, payload)


def _profile_timed(callback, key: str, factory):
    import time

    started = time.perf_counter()
    result = factory()
    _profile_emit(callback, key, (time.perf_counter() - started) * 1000.0)
    return result


def extract_pcb_metadata_light(pcb: Any, project_file: Path, profile_callback=None) -> dict[str, Any]:
    import time

    started = time.perf_counter()
    pads, terminal_pad_links = _pad_records_and_links(pcb)
    _profile_emit(
        profile_callback,
        "extract_footprints",
        None,
        pads=len(pads),
        terminal_pad_links=len(terminal_pad_links),
    )
    metadata = _profile_timed(
        profile_callback,
        "common_metadata",
        lambda: _pcb_metadata_common(
            pcb,
            project_file,
            physical_objects=[],
            terminal_pad_links=terminal_pad_links,
        ),
    )
    metadata["pads"] = pads
    metadata["mode"] = "light"
    metadata["stats"]["physical_objects"] = 0
    _profile_emit(profile_callback, "total", (time.perf_counter() - started) * 1000.0)
    return metadata


def extract_pcb_metadata_full(project_file: Path, pcb: Any | None = None, profile_callback=None) -> dict[str, Any]:
    import time

    started = time.perf_counter()
    if pcb is None:
        def load_pcb():
            from kicad_monkey import KiCadPcb  # type: ignore

            return KiCadPcb.from_file(project_file.with_suffix(".kicad_pcb"))

        pcb = _profile_timed(profile_callback, "kicad_pcb_from_file", load_pcb)
    else:
        _profile_emit(profile_callback, "kicad_pcb_from_file", 0.0, reused_loaded_pcb=True)
    footprint_objects, terminal_pad_links = _profile_timed(
        profile_callback,
        "extract_footprints",
        lambda: _extract_footprints(pcb, include_geometry=True),
    )
    physical_objects = []
    physical_objects.extend(_profile_timed(profile_callback, "extract_board_graphics", lambda: _extract_board_graphics(pcb)))
    physical_objects.extend(_profile_timed(profile_callback, "extract_zones", lambda: _extract_zones(pcb)))
    physical_objects.extend(_profile_timed(profile_callback, "extract_routing", lambda: _extract_routing(pcb)))
    physical_objects.extend(footprint_objects)
    metadata = _profile_timed(
        profile_callback,
        "common_metadata",
        lambda: _pcb_metadata_common(
            pcb,
            project_file,
            physical_objects=physical_objects,
            terminal_pad_links=terminal_pad_links,
        ),
    )
    metadata["mode"] = "full"
    _profile_emit(
        profile_callback,
        "total",
        (time.perf_counter() - started) * 1000.0,
        physical_objects=len(physical_objects),
        terminal_pad_links=len(terminal_pad_links),
        stats=metadata.get("stats") or {},
    )
    return metadata


def extract_pcb_metadata(project_file: Path) -> dict[str, Any]:
    return extract_pcb_metadata_full(project_file)
