"""Today's stackup shapes, and the field map's reader adapters that re-derive them.

``today_shapes`` runs today's producers on the prepared board (W0 ``today.py``);
the ``derive_*`` adapters (W0 ``derive.py``) use only the member, plus today's
pure presentation helpers where a reader adapter would reuse them
(``field-maps/stackup.md``, "Reader adapters"). ``checks`` compares the two by
JSON value, one entry per shape.
"""

from __future__ import annotations

import dataclasses
import enum
import importlib.util
import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from .. import jsonvalue
from . import Context

VIA_TYPES = ("through", "blind", "buried", "micro")
KICAD_STACKUP_TYPES = (
    "Top Silk Screen", "Top Solder Paste", "Top Solder Mask", "copper", "core", "prepreg",
    "Bottom Solder Mask", "Bottom Solder Paste", "Bottom Silk Screen",
)
DETAIL_LIMIT = 20


def mm(value_nm: int | None) -> float | None:
    return None if value_nm is None else value_nm / 1e6


def plain(value: Any) -> Any:
    """Today's values as JSON values (dataclasses, enums and tuples flattened)."""

    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {k: plain(v) for k, v in dataclasses.asdict(value).items()}
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    if isinstance(value, enum.Enum):
        return value.value
    return value


def board_looks_module(ctx: Context):
    path = ctx.reference / "kicad-prism-viewer/pipeline/topology_compiler/board_looks.py"
    spec = importlib.util.spec_from_file_location("ref_board_looks", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ----------------------------------------------------------------- today


def today_shapes(ctx: Context, board: Path) -> dict:
    """Run today's producers on ``board`` (inside ``ctx.src``). W0 ``today.py``."""

    from app.release_studio.projections import project_stackup
    from app.services.design_compare_artifacts import _extract_stackup
    from app.services.systems.bundles import mid_plane_from_layers
    from kicad_monkey import KiCadPcb
    from topology_compiler import pcb_extract
    from topology_compiler.compiler import _board_from_pcb_metadata, _layers_from_pcb_metadata

    result: dict = {"rs": plain(project_stackup(board))}

    snapshot = ctx.scratch / "dc-snapshot"
    if snapshot.exists():
        shutil.rmtree(snapshot)
    snapshot.mkdir(parents=True)
    shutil.copy(board, snapshot / board.name)
    result["dc"] = plain(_extract_stackup(snapshot, None))

    pcb = KiCadPcb.from_file(board)
    metadata = pcb_extract._pcb_metadata_common(
        pcb,
        board.with_suffix(".kicad_pro"),
        physical_objects=[],
        terminal_pad_links=[],
        board_bbox=[0.0, 0.0, 1.0, 1.0],
        components=[],
        stats={},
    )
    result["td"] = plain({"thickness_mm": metadata["board"]["thickness_mm"], "stackup": metadata["board"]["stackup"]})
    layers = [plain(layer) for layer in _layers_from_pcb_metadata(metadata)]
    result["topo_layers"] = layers
    result["topo_board"] = plain(_board_from_pcb_metadata(metadata))
    result["mid"] = mid_plane_from_layers(layers)
    result["looks"] = plain(board_looks_module(ctx).board_looks(board))
    return result


# ------------------------------------------------------------- adapters


def forms_of(doc: dict) -> list[dict]:
    """Fold to forms: one row per stackup ``(layer …)`` form; each field is the
    first value written across the form's sub-layers."""

    groups: list[list[dict]] = []
    for entry in doc["layers"]:
        if entry["sublayer"] == 0 or not groups:
            groups.append([entry])
        else:
            groups[-1].append(entry)
    rows = []
    for group in groups:
        row = {"name": group[0]["name"], "kind": group[0]["kind"]}
        for key in ("type", "thicknessNm", "material", "epsilonR", "lossTangent", "color"):
            found = next((part[key] for part in group if key in part), None)
            if found is not None:
                row[key] = found
        rows.append(row)
    return rows


def derive_rs(doc: dict) -> dict:
    """C3: Release Studio ``prism.release_studio.stackup.a0``."""

    from app.release_studio.projections import _empty_stackup, _layer_kind

    present = doc["present"]
    if present:
        layers = [
            {
                "order": order,
                "layer_id": None,
                "name": entry["name"],
                "type": entry.get("type") or None,
                "material": entry.get("material", ""),
                "thickness": mm(entry.get("thicknessNm")),
                "epsilon_r": entry.get("epsilonR") or None,
                "loss_tangent": entry.get("lossTangent") or None,
                "color": entry.get("color", ""),
                "user_name": None,
                "kind": _layer_kind(entry["name"], entry.get("type", "")),
            }
            for order, entry in enumerate(forms_of(doc))
        ]
    else:
        layers = [
            {
                "order": order,
                "layer_id": row["ordinal"],
                "name": row["name"],
                "type": row.get("type", "user"),
                "material": None,
                "thickness": None,
                "epsilon_r": None,
                "loss_tangent": None,
                "color": None,
                "user_name": row.get("userName"),
                "kind": _layer_kind(row["name"], row.get("type", "user")),
            }
            for order, row in enumerate(doc["boardLayers"])
        ]
    if not layers:
        return plain(_empty_stackup())
    copper = [layer["name"] for layer in layers if layer["kind"] == "copper"]
    if copper != doc["copperLayers"]:
        raise AssertionError(f"RS copper {copper} != copperLayers {doc['copperLayers']}")
    dielectric = [layer["name"] for layer in layers if layer["kind"] == "dielectric"]
    physical = [layer for layer in layers if layer["kind"] in {"copper", "dielectric", "mask"}]
    values = [float(layer["thickness"]) for layer in physical if layer["thickness"] is not None]
    complete = bool(physical) and all(layer["thickness"] is not None for layer in physical)
    settings = doc.get("settings")
    if settings is not None:
        rs_settings = {
            "copper_finish": settings.get("copperFinish", ""),
            "dielectric_constraints": settings["dielectricConstraints"],
            "edge_connector": None if settings["edgeConnector"] == "none" else settings["edgeConnector"],
            "edge_plating": settings["edgePlating"],
        }
    else:
        rs_settings = {"copper_finish": None, "dielectric_constraints": None, "edge_connector": None, "edge_plating": None}

    def drill(item):
        if item is None:
            return None
        return {"size": mm(item.get("sizeNm")), "start_layer": item.get("startLayer"), "stop_layer": item.get("stopLayer")}

    spans = []
    counts = {via_type: 0 for via_type in VIA_TYPES}
    for span in doc["viaSpans"]:
        counts[span["viaType"]] += span["count"]
        spans.append({
            "via_type": span["viaType"],
            "start_layer": span.get("startLayer"),
            "stop_layer": span.get("stopLayer"),
            "span_layers": list(span["spanLayers"]) or None,
            "span_layer_count": len(span["spanLayers"]) or None,
            "backdrill": drill(span.get("backdrill")),
            "tertiary_drill": drill(span.get("tertiaryDrill")),
            "count": span["count"],
        })
    source = "board.setup.stackup" if present else "board.layers"
    return {
        "schema": "prism.release_studio.stackup.a0",
        "present": present,
        "source": source,
        "source_detail": source,
        "fallback_reason": None,
        "units": "mm",
        "layers": layers,
        "copper_layers": copper,
        "dielectric_layers": dielectric,
        "copper_layer_count": len(copper),
        "dielectric_layer_count": len(dielectric),
        "board_thickness": mm(doc["boardThicknessNm"]) or None,
        "total_thickness": float(sum(values)) if complete else None,
        "total_thickness_status": "available" if complete else "partial" if values else "unsupported",
        "total_thickness_source": "board.setup.stackup.layer.thickness" if complete else None,
        "settings": rs_settings,
        "via_count": sum(counts.values()),
        "via_type_counts": counts,
        "via_spans": spans,
    }


def derive_dc(doc: dict) -> dict:
    """C2: Design Comparison ``_extract_stackup``."""

    if not doc["present"]:
        # Today's layer-table fallback needs a quoted type token, which no
        # KiCad 6+ layer table writes: it yields no layers.
        return {"present": False, "layers": [], "settings": {"copper_finish": None, "dielectric_constraints": None}}
    layers = [
        {
            "name": row["name"],
            "type": row.get("type", ""),
            "thickness": mm(row.get("thicknessNm")),
            "material": row.get("material"),
            "color": row.get("color"),
            "epsilon_r": row.get("epsilonR"),
            "loss_tangent": row.get("lossTangent"),
        }
        for row in forms_of(doc)
    ]
    settings = doc["settings"]
    return {
        "present": bool(layers),
        "layers": layers,
        "settings": {"copper_finish": settings.get("copperFinish"), "dielectric_constraints": settings["dielectricConstraints"]},
    }


def derive_td(doc: dict) -> tuple[dict, dict]:
    """C5: the legacy 3D pipeline's ``board.thickness_mm`` and ``board.stackup``, and the metadata it sits in."""

    from kicad_monkey.kicad_base import EdgeConnectorConstraint, LayerType
    from kicad_monkey.kicad_pcb_other import Layer, Stackup, StackupLayer
    from topology_compiler import pcb_extract

    stackup = None
    settings = doc.get("settings")
    if doc["present"]:
        stackup = Stackup(
            layers=[
                StackupLayer(
                    name=e["name"],
                    type_name=e.get("type", ""),
                    thickness=mm(e.get("thicknessNm")) or 0.0,
                    material=e.get("material", ""),
                    epsilon_r=e.get("epsilonR") or None,
                    loss_tangent=e.get("lossTangent") or None,
                    color=e.get("color", ""),
                )
                for e in forms_of(doc)
            ],
            copper_finish=settings.get("copperFinish", ""),
            dielectric_constraints=settings["dielectricConstraints"],
            edge_connector={
                "none": EdgeConnectorConstraint.NONE,
                "yes": EdgeConnectorConstraint.IN_USE,
                "bevelled": EdgeConnectorConstraint.BEVELLED,
            }[settings["edgeConnector"]],
            edge_plating=settings["edgePlating"],
        )
    pcb = SimpleNamespace(
        thickness=mm(doc["boardThicknessNm"]),
        stackup=stackup,
        layers=[
            Layer(
                ordinal=row["ordinal"],
                canonical_name=row["name"],
                layer_type=LayerType(row.get("type", "user")),
                user_name=row.get("userName"),
            )
            for row in doc["boardLayers"]
        ],
    )
    layers = pcb_extract._declared_layers(pcb, None)
    computed = float(pcb.thickness or 1.6)
    if stackup is not None:
        computed = float(stackup.get_board_thickness() or computed)
    from_file = {
        "copper_finish": (pcb_extract._clean_enum_text(settings.get("copperFinish")) or "None") if settings else "None",
        "edge_connector": (settings["edgeConnector"] != "none") if settings else False,
        "castellated_pads": settings["castellatedPads"] if settings else False,
        "edge_plating": settings["edgePlating"] if settings else False,
    }
    td_stackup = {
        "present": True,
        "layers": layers,
        "computed_thickness_mm": computed,
        "copper_finish": pcb_extract._clean_enum_text(getattr(stackup, "copper_finish", None)) or from_file["copper_finish"],
        "edge_connector": pcb_extract._first_boolish(getattr(stackup, "edge_connector", None), from_file["edge_connector"], default=False),
        "castellated_pads": pcb_extract._first_boolish(None, from_file["castellated_pads"], default=False),
        "edge_plating": pcb_extract._first_boolish(getattr(stackup, "edge_plating", None), from_file["edge_plating"], default=False),
    }
    td = {"thickness_mm": computed, "stackup": td_stackup}
    metadata = {"board": {"thickness_mm": computed, "stackup": td_stackup}}
    return td, metadata


def mid_plane_exact(doc: dict) -> float:
    """C4: the System Builder mid-plane from the member alone, exact in nm."""

    if doc["present"]:
        kept = [e for e in doc["layers"] if e["sublayer"] == 0 and e.get("type") in KICAD_STACKUP_TYPES]
        copper = [i for i, e in enumerate(kept) if e["kind"] == "copper"]
        if len(copper) < 2:
            return 0.0
        body = sum(e.get("thicknessNm", 0) for e in kept[copper[0] + 1:copper[-1]])
        return body / 2 / 1e6 if body > 0 else 0.0
    return doc["boardThicknessNm"] / 2 / 1e6


def derive_looks(ctx: Context, doc: dict) -> dict:
    """C5/V1: the reference branch's ``board_looks`` from ``maskColors``."""

    looks = board_looks_module(ctx)
    colors = doc["maskColors"]
    front = colors.get("front", "")
    return {
        "soldermask": {"front": looks.mask_rgba(front), "back": looks.mask_rgba(colors.get("back", front))},
        "paste": looks.PASTE_COLOR,
    }


# ------------------------------------------------------------- comparison


def _json(value: Any) -> Any:
    return json.loads(json.dumps(plain(value)))


def compare(shape: str, today: Any, derived: Any) -> dict:
    """One check entry: today's value is the expectation, the re-derivation the actual."""

    differences = list(jsonvalue.diff(_json(today), _json(derived)))
    if not differences:
        return {"shape": shape, "result": "equal"}
    return {"shape": shape, "result": "differs", "detail": [d.describe() for d in differences[:DETAIL_LIMIT]]}


def checks(ctx: Context, doc: dict, today: dict) -> list[dict]:
    from app.services.systems.bundles import mid_plane_from_layers
    from topology_compiler.compiler import _board_from_pcb_metadata, _layers_from_pcb_metadata

    out = [compare("rs", today["rs"], derive_rs(doc)), compare("dc", today["dc"], derive_dc(doc))]
    td, metadata = derive_td(doc)
    out.append(compare("3d", today["td"], td))
    topo_layers = [plain(layer) for layer in _layers_from_pcb_metadata(metadata)]
    out.append(compare("topology-layers", today["topo_layers"], topo_layers))
    keys = ("thickness_mm", "stackup_present", "stackup", "materials")
    board = plain(_board_from_pcb_metadata(metadata))
    out.append(compare("topology-board", {k: today["topo_board"][k] for k in keys}, {k: board[k] for k in keys}))
    out.append(compare("mid-plane", today["mid"], mid_plane_from_layers(topo_layers)))
    exact = mid_plane_exact(doc)
    entry = compare("mid-plane-nm", round(today["mid"], 9), round(exact, 9))
    out.append(entry)
    out.append(compare("board-looks", today["looks"], derive_looks(ctx, doc)))
    return out
