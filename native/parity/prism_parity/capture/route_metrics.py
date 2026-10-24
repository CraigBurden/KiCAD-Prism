"""Golden for ``projections/route-metrics.json`` (``prism.route_metrics.a0``).

Field map ``route-metrics.md``, "How a golden is produced from today's code":

1. Snapshot: the project directory as Design Comparison materializes it (shared
   with board-objects, ``board_objects.snapshot``). D1: when it holds more than
   one ``.kicad_pcb``, only the project's own board is kept (the board named
   after the anchor, as DC's stackup and Gerber passes choose it).
2. Digest: ``index_snapshot(snapshot).routeMetrics`` of dev's ecad-parse.mjs,
   ``ECAD_INDEX_CACHE=0``.
3. Transform: the field map's Python, verbatim (``golden``).

The golden is today's truth: it does not apply D7 (via spans add every copper
layer they cross). The runner applies D7 through the rule
``route-metrics/via-spans-used-layers`` (``divergences/route-metrics.json``).

Check ``dc`` (step 5): today's ``_route_metrics_from_digest`` on today's digest
against the C2 rebuild from the golden, both with today's ``_extract_stackup``.
Equal except D3 (4th-decimal display rounding) and D4 (DC strips net names).
"""

from __future__ import annotations

import shutil
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path, PurePosixPath
from typing import Any, Optional

from .. import jsonvalue
from . import Context, NotCaptured, Result
from . import board_objects

MEMBER = "route-metrics"
SCHEMA = "prism.route_metrics.a0"


def golden(route_metrics: dict) -> dict:
    """Field map step 3, verbatim."""

    nets = []
    for name, raw in route_metrics.items():
        if name == "":  # no-net copper: not reported (R1)
            continue
        spans: dict = {}
        for key, count in raw["viaSpans"].items():
            parts = key.split("|") if key else []
            if len(parts) == 2:  # other vias: in viaCount only (R6)
                spans[tuple(parts)] = spans.get(tuple(parts), 0) + count
        nets.append({
            "netName": name,
            "routeLengthNm": int(Decimal(raw["routeLengthMm"] * 1e6).quantize(Decimal(1), rounding=ROUND_HALF_UP)),
            "viaCount": raw["viaCount"],
            "usedLayers": sorted(set(raw["usedLayers"])),
            "viaSpans": [{"startLayer": a, "stopLayer": b, "viaCount": c} for (a, b), c in sorted(spans.items())],
        })
    nets.sort(key=lambda n: n["netName"])  # code point order
    return {"schema": SCHEMA, "nets": nets}


# ------------------------------------------------------------------ inputs


def own_board_snapshot(ctx: Context, shared: Path, boards: list[Path]) -> tuple[Path, str]:
    """D1: a copy of the snapshot holding only the project's own board."""

    stem = PurePosixPath(ctx.project).stem.casefold()
    root = ctx.scratch / "own-board" / "snapshot"
    if root.parent.exists():
        shutil.rmtree(root.parent)
    shutil.copytree(shared, root)
    own = [b for b in boards if b.parent == shared and b.stem.casefold() == stem]
    kept = own[0] if own else None
    for board in boards:
        if board != kept:
            (root / board.relative_to(shared)).unlink()
    dropped = [b.relative_to(shared).as_posix() for b in boards if b != kept]
    note = (f"D1: snapshot held {len(boards)} boards; kept {kept.relative_to(shared).as_posix() if kept else 'none'}, "
            f"dropped {', '.join(dropped)}")
    return root, note


def today_digest(ctx: Context) -> tuple[dict, Path, list[str]]:
    index = board_objects.today_index(ctx)
    failures = board_objects.design_parse_failures(ctx, index)
    if failures:
        raise NotCaptured("malformed design, stage parse fails (no member): " + "; ".join(failures), status="stage-parse-fails")
    shared = Path(index["snapshot"])
    boards = sorted(p for p in shared.rglob("*.kicad_pcb") if p.is_file())
    if len(boards) <= 1:
        return index["routeMetrics"], shared, []
    root, note = own_board_snapshot(ctx, shared, boards)
    parser = ctx.today / "backend" / "design-compare-parser" / "ecad-parse.mjs"
    own = ctx.run_node(board_objects.HELPER, str(parser), str(root))
    return own["routeMetrics"], root, [note]


# --------------------------------------------------------------- DC check


def dc_from_contract(doc: dict, stackup: dict) -> dict:
    """C2's ``_route_metrics_from_digest`` on the member (field map, "Design Comparison's derived values")."""

    stack_layers = stackup.get("layers") or []
    layer_indexes = {str(layer.get("name")): i for i, layer in enumerate(stack_layers) if layer.get("name")}

    def span_length(start: str, stop: str) -> Optional[float]:
        if start not in layer_indexes or stop not in layer_indexes:
            return None
        lo, hi = sorted((layer_indexes[start], layer_indexes[stop]))
        thicknesses = [layer.get("thickness") for layer in stack_layers[lo: hi + 1]]
        if not thicknesses or not all(isinstance(v, (int, float)) for v in thicknesses):
            return None
        return float(sum(thicknesses))

    result: dict[str, Any] = {}
    for net in doc["nets"]:
        reliable = sum(span["viaCount"] for span in net["viaSpans"]) == net["viaCount"]
        barrel = 0.0
        for span in net["viaSpans"]:
            length = span_length(span["startLayer"], span["stopLayer"])
            if length is None:
                reliable = False
            else:
                barrel += length * span["viaCount"]
        diagnostics = ["Propagation delay is not available from source geometry."]
        if not reliable and net["viaCount"]:
            diagnostics.append("Via barrel length is unavailable because the via span or stack thickness is incomplete.")
        result[net["netName"]] = {
            "centerline_length_mm": round(net["routeLengthNm"] / 1e6, 4),
            "via_count": net["viaCount"],
            "used_layers": list(net["usedLayers"]),
            "via_barrel_length_mm": round(barrel, 4) if reliable else None,
            "propagation_delay": None,
            "diagnostics": diagnostics,
        }
    return result


def dc_check(ctx: Context, digest: dict, root: Path, doc: dict) -> dict:
    from app.services import design_compare_nodes
    from app.services.design_compare_artifacts import _extract_stackup

    stackup = _extract_stackup(root, ctx.project)
    today = design_compare_nodes._route_metrics_from_digest({"routeMetrics": digest}, stackup)
    rebuilt = dc_from_contract(doc, stackup)
    diffs = list(jsonvalue.diff(today, rebuilt))
    if not diffs:
        return {"shape": "dc", "result": "equal", "detail": [f"{len(today)} nets"]}
    lengths = {n["netName"]: n["routeLengthNm"] for n in doc["nets"]}
    # D4: DC strips net names; a padded name (or the stripped key it becomes) differs.
    padded = {n for n in lengths if n != n.strip()} | {n.strip() for n in lengths if n != n.strip()}
    used: set[str] = set()
    unexplained = []
    for d in diffs:
        parts = jsonvalue.split(d.pointer)
        net = parts[0] if parts else ""
        if parts[1:] == ["centerline_length_mm"] and lengths.get(net, 0) % 100 == 50:
            used.add("D3")
        elif net in padded:
            used.add("D4")
        else:
            unexplained.append(d)
    if unexplained:
        return {"shape": "dc", "result": "differs",
                "detail": [f"{p.pointer}: today {p.expected!r} != rebuilt {p.actual!r}" for p in unexplained[:10]]}
    return {"shape": "dc", "result": "divergence", "divergences": sorted(used),
            "detail": [f"{d.pointer}: today {d.expected!r} != rebuilt {d.actual!r}" for d in diffs[:10]]}


def capture(ctx: Context) -> Result:
    digest, root, notes = today_digest(ctx)
    doc = golden(digest)
    check = dc_check(ctx, digest, root, doc)
    vias = sum(n["viaCount"] for n in doc["nets"])
    notes = [f"{len(doc['nets'])} nets, {vias} vias", *notes]
    if "" in digest:
        notes.append(f"no-net copper dropped (R1): {digest['']['viaCount']} vias, {digest['']['routeLengthMm']:.6f} mm")
    return Result(document=doc, checks=[check], notes=notes)
