"""Today's placement values, and the field map's derivations of them from the member.

``today_values`` runs today's producers on the prepared board (W0 ``today.py``):
Release Studio's testpoints, population and designators; System Builder's
``_board_geometry``/``_board_outline``; the catalog import's footprint blocks.
The ``rs_*``/``sb_*``/catalog derivations (W0 ``derive.py``, field map
"Derivations of today's values") use only the member. ``checks`` compares them
as the field map's "How a golden is produced", step 3, says:

- Release Studio: canonical-JSON equality (the bytes the dossier digests hash);
- System Builder: per reference, field by field, exact except D2's tolerance
  (≤ 1e-4 mm on values computed through a rotation that is not a multiple of
  90°); references only the member has are D4 (reported); a board whose
  outline today falls back to ``items`` is D5 (outline skipped);
- catalog: span bytes (sha256), references and model paths equal, by index in file order.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .. import jsonvalue

DETAIL_LIMIT = 20
D2_TOLERANCE_MM = 1e-4 + 1e-12


def r4(value: float) -> float:
    """``interface_extractor._round``: 1e-4 mm, -0.0 folded."""

    return round(float(value), 4) + 0.0


def mm(value_nm: int) -> float:
    return value_nm / 1e6


def natural(pad: str) -> tuple:
    head = pad.rstrip("0123456789")
    tail = pad[len(head):]
    return (head, int(tail) if tail else -1, pad)


def canon(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


# ----------------------------------------------------------------- today


def today_values(board: Path) -> dict:
    from app.release_studio import projections as rsp
    from app.services.kicad_library_reader import iter_forms, model_references
    from app.services.project_component_asset_extractor import ProjectAssetSnapshotIndex
    from app.services.systems import interface_extractor as ie

    model = rsp.load_board_model(board)
    pcb, fallback = model
    record: dict = {
        "fallback": fallback,
        "rs": {
            "testpoints": rsp.project_testpoints(board, model=model),
            "population": rsp.project_population(board, model=model),
            "designators": list(rsp.board_designators(board, model=model)),
        },
    }
    if fallback is None:
        record["sb"] = {"geometry": ie._board_geometry(pcb), "outline": ie._board_outline(pcb)}
    text = board.read_text(encoding="utf-8", errors="ignore")
    record["catalog"] = [
        {
            "reference": ProjectAssetSnapshotIndex._reference_from_block(block),
            "sha256": hashlib.sha256(block.encode("utf-8")).hexdigest(),
            "models": model_references(block),
        }
        for block in iter_forms(text, "footprint")
    ]
    return json.loads(json.dumps(record))


# --------------------------------------------------------- Release Studio


def rs_testpoints(doc: dict, prefix: str = "TP") -> dict:
    marker = prefix.strip().upper()
    found = []
    for fp in doc["footprints"]:
        reference = fp.get("reference", "")
        if not reference.strip().upper().startswith(marker):
            continue
        rotation = fp["rotationDeg"]
        found.append({
            "ref": reference,
            "side": "bottom" if fp["side"] == "back" else "top",
            "x": mm(fp["positionNm"]["xNm"]),
            "y": mm(fp["positionNm"]["yNm"]),
            "rotation": None if rotation == 0 else float(rotation),  # D1: 0 ↔ omitted
            "excluded_from_position_file": fp["excludeFromPosFiles"],
        })
    return {"source": "board.footprints", "prefix": prefix, "testpoints": found}


def rs_population(doc: dict) -> dict:
    sides = {
        "top": {"components": 0, "dnp": 0, "fitted": 0, "absent_from_position_file": 0},
        "bottom": {"components": 0, "dnp": 0, "fitted": 0, "absent_from_position_file": 0},
    }
    for fp in doc["footprints"]:
        if "reference" not in fp:
            continue
        counts = sides["bottom" if fp["side"] == "back" else "top"]
        counts["components"] += 1
        counts["dnp" if fp["dnp"] else "fitted"] += 1
        if fp["excludeFromPosFiles"]:
            counts["absent_from_position_file"] += 1
    return {"source": "board.footprints", "sides": sides}


def rs_designators(doc: dict) -> list:
    return sorted({ref.strip() for ref in doc["designators"] if ref.strip()})  # D6: C3 trims


# --------------------------------------------------------- System Builder


def bounds_mm(b: dict) -> dict:
    """Board frame (y down, nm) → System Builder y-up mm."""

    return {
        "minMm": [r4(mm(b["minNm"]["xNm"])), r4(-mm(b["maxNm"]["yNm"]))],
        "maxMm": [r4(mm(b["maxNm"]["xNm"])), r4(-mm(b["minNm"]["yNm"]))],
    }


def sb_geometry(fp: dict) -> dict:
    pads = [
        {
            "pad": pad["number"],
            "positionMm": [r4(mm(pad["positionNm"]["xNm"])), r4(-mm(pad["positionNm"]["yNm"]))],
            "sizeMm": [r4(mm(pad["size"]["xNm"])), r4(mm(pad["size"]["yNm"]))],
            "shape": pad["shape"],
            "tht": pad["type"] in ("thru_hole", "np_thru_hole"),
        }
        for pad in fp["pads"]
    ]
    pads.sort(key=lambda item: natural(item["pad"]))
    return sb_geometry_with_model(fp, pads, next((m for m in fp["models"] if not m["hidden"]), None))


def sb_model(model: dict | None) -> dict | None:
    return None if model is None else {
        "path": model["path"],
        "offsetMm": [r4(mm(model["offset"][k])) for k in ("xNm", "yNm", "zNm")],
        "rotationDeg": [r4(model["rotation"][k]) for k in ("xDeg", "yDeg", "zDeg")],
        "scale": [r4(model["scale"][k]) for k in ("x", "y", "z")],
    }


def sb_geometry_with_model(fp: dict, pads: list, model: dict | None) -> dict:
    return {
        "side": "bottom" if fp["side"] == "back" else "top",
        "positionMm": [r4(mm(fp["positionNm"]["xNm"])), r4(-mm(fp["positionNm"]["yNm"]))],
        "rotationDeg": r4(fp["rotationDeg"]),
        "footprintName": fp.get("libId", "").split(":")[-1],
        "pads": pads,
        "courtyard": bounds_mm(fp["courtyardBounds"]) if "courtyardBounds" in fp else None,
        "model": sb_model(model),
    }


def sb_board_geometry(doc: dict) -> tuple[dict, dict]:
    """``reference → geometry`` (first footprint wins) and ``reference → footprint``."""

    result: dict = {}
    footprints: dict = {}
    for fp in doc["footprints"]:
        ref = fp.get("reference")
        if ref and ref not in result:
            result[ref] = sb_geometry(fp)
            footprints[ref] = fp
    return result, footprints


def sb_outline(doc: dict) -> dict | None:
    if "outlineBounds" not in doc:
        return None
    return {**bounds_mm(doc["outlineBounds"]), "source": "edge_cuts"}


# ------------------------------------------------------------- comparison


def _differences(expected: Any, actual: Any, prefix: str = "") -> list[jsonvalue.Difference]:
    out = []
    for d in jsonvalue.diff(expected, actual):
        out.append(jsonvalue.Difference(prefix + d.pointer, d.kind, d.expected, d.actual))
    return out


def _entry(shape: str, hard: list[str], divergences: dict[str, list[str]]) -> dict:
    if hard:
        return {"shape": shape, "result": "differs", "detail": hard[:DETAIL_LIMIT]}
    if divergences:
        detail = [f"{key}: {line}" for key, lines in sorted(divergences.items()) for line in lines]
        return {"shape": shape, "result": "divergence", "divergences": sorted(divergences), "detail": detail[:DETAIL_LIMIT]}
    return {"shape": shape, "result": "equal"}


def _is_d2(difference: jsonvalue.Difference, rotation: float) -> bool:
    """D2: a pad or courtyard value off by ≤ 1e-4 mm, from v1's float-mm rotation against KiCad's integer nm.

    The field map states D2 for rotations that are not multiples of 90°. The
    corpus also shows it at 0°, 90° and 180° (EDA-04903, vme-wren,
    openswitch-lan969x): there v1's float error is ~1e-14 mm, so a 1e-4
    difference can only be a value exactly on a 4th-decimal half-tie (e.g.
    x = 211.49225 mm) that the float rounds to the other side. Either way it
    is a one-unit display rounding of the same KiCad position.
    """

    del rotation  # any rotation: see above
    if difference.kind != "value":
        return False
    if not ("/pads/" in difference.pointer and "/positionMm/" in difference.pointer) and "/courtyard/" not in difference.pointer:
        return False
    return abs(float(difference.expected) - float(difference.actual)) <= D2_TOLERANCE_MM


def _is_d7(fp: dict, today_model: dict | None) -> bool:
    """D7: today's model is the first model of the footprint, which the file hides.

    v1 skips a model only when kicad_monkey's ``to_sexp()`` of it holds a
    ``(hide …)`` list (``ie:202``). kicad_monkey 2026.9.7 drops ``(hide yes)``
    from a model's ``to_sexp()``, so on an upgraded (KiCad 10) board today
    never skips a hidden model; the member marks it ``hidden: true``.
    """

    if today_model is None or not any(m["hidden"] for m in fp["models"]):
        return False
    return jsonvalue.equal(today_model, sb_model(fp["models"][0])) and fp["models"][0]["hidden"]


def check_rs(doc: dict, today: dict) -> list[dict]:
    out = []
    for name, derived in (
        ("testpoints", rs_testpoints(doc)),
        ("population", rs_population(doc)),
        ("designators", rs_designators(doc)),
    ):
        expected = today["rs"][name]
        if canon(derived) == canon(expected):
            out.append({"shape": f"rs-{name}", "result": "equal"})
        else:
            detail = [d.describe() for d in _differences(expected, derived)][:DETAIL_LIMIT] or ["canonical JSON differs"]
            out.append({"shape": f"rs-{name}", "result": "differs", "detail": detail})
    return out


def check_sb(doc: dict, today: dict) -> list[dict]:
    if "sb" not in today:
        return [{"shape": "sb-geometry", "result": "differs", "detail": [f"today fell back: {today['fallback']}"]}]
    derived, footprints = sb_board_geometry(doc)
    expected = today["sb"]["geometry"]
    hard: list[str] = []
    divergences: dict[str, list[str]] = {}
    for ref in sorted(expected):
        if ref not in derived:
            hard.append(f"/{ref}: only today has this reference")
            continue
        fp = footprints[ref]
        if not jsonvalue.equal(expected[ref]["model"], derived[ref]["model"]) and _is_d7(fp, expected[ref]["model"]):
            divergences.setdefault("D7", []).append(
                f"/{ref}/model: today {expected[ref]['model']['path']!r} is hidden in the file; "
                f"the member's first visible model is {(derived[ref]['model'] or {}).get('path')!r}"
            )
            expected = {**expected, ref: {**expected[ref], "model": derived[ref]["model"]}}
        for d in _differences(expected[ref], derived[ref], "/" + jsonvalue.escape(ref)):
            if _is_d2(d, fp["rotationDeg"]):
                divergences.setdefault("D2", []).append(d.describe())
            else:
                hard.append(d.describe())
    extra = sorted(set(derived) - set(expected))
    if extra:
        divergences.setdefault("D4", []).append(f"{len(extra)} references only the member has: {extra[:10]}")
    out = [_entry("sb-geometry", hard, divergences)]

    today_outline = today["sb"]["outline"]
    member_outline = sb_outline(doc)
    if today_outline is not None and today_outline.get("source") == "items":
        if member_outline is None:
            out.append(_entry("sb-outline", [], {"D5": ["today falls back to the items extent; the member has no outlineBounds"]}))
        else:
            out.append(_entry("sb-outline", ["the member has outlineBounds where today falls back to items"], {}))
    else:
        hard = [d.describe() for d in _differences(today_outline, member_outline)]
        out.append(_entry("sb-outline", hard, {}))
    return out


def check_catalog(doc: dict, today: dict, board: Path) -> dict:
    data = board.read_bytes()
    blocks = today["catalog"]
    hard: list[str] = []
    if len(blocks) != len(doc["footprints"]):
        hard.append(f"{len(blocks)} footprint blocks today, {len(doc['footprints'])} footprints in the member")
    for index, (fp, block) in enumerate(zip(doc["footprints"], blocks)):
        span = fp["sourceSpan"]
        raw = data[span["offsetBytes"]: span["offsetBytes"] + span["lengthBytes"]]
        label = f"/footprints/{index} ({fp.get('reference', '')})"
        if hashlib.sha256(raw).hexdigest() != block["sha256"]:
            hard.append(f"{label}: span bytes differ from today's iter_forms block")
        if fp.get("reference", "") != block["reference"]:
            hard.append(f"{label}: reference {fp.get('reference')!r} vs today's {block['reference']!r}")
        paths = [m["path"] for m in fp["models"]]
        if paths != block["models"]:
            hard.append(f"{label}: model paths {paths} vs today's {block['models']}")
    return _entry("catalog", hard, {})


def checks(doc: dict, today: dict, board: Path) -> list[dict]:
    return [*check_rs(doc, today), *check_sb(doc, today), check_catalog(doc, today, board)]
