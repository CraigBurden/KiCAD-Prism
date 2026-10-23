"""Have KiCad finish the oracle board over its IPC API, and dump its pad outlines.

Run with ``kicad-python`` (``kipy``) while KiCad's PCB editor has
``board/oracle.kicad_pcb`` open and Preferences > Plugins > "Enable IPC API
server" is on (README.md):

    python ipc_finish.py kicad/pad-outlines.json

KiCad fills the zones and saves the board in its own form, then gives every
pad's outline on every copper layer the pad has copper on, shaped the way KiCad
shapes it (custom primitives, chamfers, round-rect corners, trapezoids) and
recorded as its bounding box and area.
The oracle test compares Prism's pad outlines with these.

Records are one per line so a regenerated file diffs by pad.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from kipy import KiCad
from kipy.proto.board import board_commands_pb2
from kipy.proto.board.board_types_pb2 import BoardLayer

LAYERS = {"F.Cu": BoardLayer.BL_F_Cu, "In1.Cu": BoardLayer.BL_In1_Cu,
          "In2.Cu": BoardLayer.BL_In2_Cu, "B.Cu": BoardLayer.BL_B_Cu}


def nm(value: int) -> float:
    return round(value / 1e6, 6)


def summary(outline: list[list[float]]) -> dict:
    """A pad outline as its bounding box and area (shoelace), mm and mm²."""

    xs = [x for x, _ in outline]
    ys = [y for _, y in outline]
    twice = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]))
    return {"box": [min(xs), min(ys), max(xs), max(ys)], "area": round(abs(twice) / 2, 6)}


def outlines(kicad: KiCad, board, pads, layer) -> dict[str, list]:
    """Each pad's outline on one layer, by pad id; arcs come back as points."""

    command = board_commands_pb2.GetPadShapeAsPolygon()
    command.board.CopyFrom(board._doc)
    command.layer = layer
    command.pads.extend([pad.id for pad in pads])
    response = kicad._client.send(command, board_commands_pb2.PadShapeAsPolygonResponse)
    shapes = {}
    for pad_id, polygon in zip(response.pads, response.polygons):
        nodes = polygon.outline.nodes
        if any(node.HasField("arc") for node in nodes):
            raise SystemExit(f"pad {pad_id.value}: KiCad returned an arc; this script expects points")
        shapes[pad_id.value] = [[nm(node.point.x_nm), nm(node.point.y_nm)] for node in nodes]
    return shapes


def write(out: Path, version: str, records: list[dict]) -> None:
    lines = ",\n".join(json.dumps(record, separators=(",", ":")) for record in records)
    out.write_text(f'{{"kicad":{json.dumps(version)},"pads":[\n{lines}\n]}}\n', encoding="utf-8")


def main(out: Path) -> None:
    kicad = KiCad()
    board = kicad.get_board()
    if board.name != "oracle.kicad_pcb":
        raise SystemExit(f"KiCad has {board.name} open, not oracle.kicad_pcb")
    board.refill_zones()
    board.save()

    records = []
    footprints = sorted(board.get_footprints(), key=lambda fp: fp.reference_field.text.value)
    pads = [(fp.reference_field.text.value, pad) for fp in footprints for pad in fp.definition.pads]
    for name, layer in LAYERS.items():
        shapes = outlines(kicad, board, [pad for _, pad in pads], layer)
        for reference, pad in pads:
            shape = shapes.get(pad.id.value)
            if shape:
                records.append({"reference": reference, "pad": pad.number, "layer": name, **summary(shape)})
    write(out, kicad.get_version().full_version, records)
    print(f"saved the board; wrote {len(records)} pad outlines to {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "kicad/pad-outlines.json"))
