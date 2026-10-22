"""Build the documentation-oracle board with KiCad's own pcbnew.

Run with KiCad's Python (it ships ``pcbnew``):

    <KiCad>/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 \\
        native/parity/docs-oracle/make_board.py native/parity/docs-oracle/board

The board exists to catch transform mistakes in Prism's document generators:
every footprint is placed at an awkward angle, on both sides, and the custom
footprint carries what a stock library rarely does at once: a drill offset, an
oval slot, a pad turned inside its footprint and an offset slot on a turned pad.
KiCad then writes the reference outputs (drill file, position file, IPC-D-356)
with ``export.sh``; the oracle test compares Prism's documents with them.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pcbnew

LIBRARIES = Path(os.environ.get("KICAD_FOOTPRINT_DIR", "/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints"))

#: (library, footprint) stock parts placed on the board.
STOCK = [
    ("Resistor_SMD", "R_0603_1608Metric"),
    ("Package_SO", "SOIC-8_3.9x4.9mm_P1.27mm"),
    ("Connector_PinHeader_2.54mm", "PinHeader_1x04_P2.54mm_Vertical"),
    ("Package_TO_SOT_SMD", "SOT-23"),
]

#: Footprint angles, degrees: right angles, a negative one and two that are not
#: multiples of 45 degrees.
ANGLES = [0.0, 90.0, 180.0, 270.0, -45.0, 30.0, 137.5]


def mm(value: float) -> int:
    return pcbnew.FromMM(value)


def point(x: float, y: float) -> pcbnew.VECTOR2I:
    return pcbnew.VECTOR2I(mm(x), mm(y))


def custom_footprint(board: pcbnew.BOARD) -> pcbnew.FOOTPRINT:
    """A footprint with an offset drill, an oval slot and turned pads."""

    footprint = pcbnew.FOOTPRINT(board)
    footprint.SetFPID(pcbnew.LIB_ID("Oracle", "OffsetDrills"))
    footprint.SetReference("J1")
    footprint.SetValue("OffsetDrills")

    def pad(number: str, at: tuple[float, float], size: tuple[float, float], drill: tuple[float, float],
            offset: tuple[float, float], angle: float, oval: bool) -> None:
        item = pcbnew.PAD(footprint)
        item.SetNumber(number)
        item.SetAttribute(pcbnew.PAD_ATTRIB_PTH)
        item.SetShape(pcbnew.PAD_SHAPE_OVAL if oval else pcbnew.PAD_SHAPE_RECTANGLE)
        item.SetSize(point(*size))
        item.SetDrillShape(pcbnew.PAD_DRILL_SHAPE_OBLONG if oval else pcbnew.PAD_DRILL_SHAPE_CIRCLE)
        item.SetDrillSize(point(*drill))
        item.SetOffset(pcbnew.F_Cu, point(*offset))
        item.SetLayerSet(pcbnew.PAD.PTHMask())
        item.SetFPRelativePosition(point(*at))
        item.SetFPRelativeOrientation(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
        footprint.Add(item)

    pad("1", (0.0, 0.0), (2.4, 2.4), (1.0, 1.0), (0.5, 0.0), 0.0, False)
    pad("2", (4.0, 0.0), (3.2, 1.8), (2.2, 0.9), (0.0, 0.0), 0.0, True)
    pad("3", (0.0, 4.0), (2.4, 2.0), (1.0, 1.0), (0.4, -0.3), 30.0, False)
    pad("4", (4.0, 4.0), (3.4, 2.0), (2.4, 1.0), (0.5, 0.0), 60.0, True)

    smd = pcbnew.PAD(footprint)
    smd.SetNumber("5")
    smd.SetAttribute(pcbnew.PAD_ATTRIB_SMD)
    smd.SetShape(pcbnew.PAD_SHAPE_ROUNDRECT)
    smd.SetSize(point(1.6, 0.8))
    smd.SetLayerSet(pcbnew.PAD.SMDMask())
    smd.SetFPRelativePosition(point(-2.5, 2.0))
    smd.SetFPRelativeOrientation(pcbnew.EDA_ANGLE(15.0, pcbnew.DEGREES_T))
    footprint.Add(smd)

    courtyard = pcbnew.PCB_SHAPE(footprint)
    courtyard.SetShape(pcbnew.SHAPE_T_RECT)
    courtyard.SetStart(point(-4.0, -2.0))
    courtyard.SetEnd(point(6.5, 6.0))
    courtyard.SetLayer(pcbnew.F_CrtYd)
    courtyard.SetWidth(mm(0.05))
    footprint.Add(courtyard)
    return footprint


def place(board: pcbnew.BOARD, footprint: pcbnew.FOOTPRINT, reference: str, x: float, y: float,
          angle: float, back: bool) -> None:
    footprint.SetReference(reference)
    board.Add(footprint)
    footprint.SetPosition(point(x, y))
    footprint.SetOrientation(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    if back:
        footprint.Flip(footprint.GetPosition(), pcbnew.FLIP_DIRECTION_LEFT_RIGHT)


def build(out: Path) -> None:
    board = pcbnew.BOARD()
    width, height = 240.0, 190.0
    outline = pcbnew.PCB_SHAPE(board)
    outline.SetShape(pcbnew.SHAPE_T_RECT)
    outline.SetStart(point(0, 0))
    outline.SetEnd(point(width, height))
    outline.SetLayer(pcbnew.Edge_Cuts)
    outline.SetWidth(mm(0.1))
    board.Add(outline)

    prefix = {"Resistor_SMD": "R", "Package_SO": "U", "Connector_PinHeader_2.54mm": "J", "Package_TO_SOT_SMD": "Q"}
    counters: dict[str, int] = {}
    row = 0
    for back in (False, True):
        for library, name in STOCK + [("Oracle", "OffsetDrills")]:
            for column, angle in enumerate(ANGLES):
                if library == "Oracle":
                    footprint = custom_footprint(board)
                    letter = "J"
                else:
                    footprint = pcbnew.FootprintLoad(str(LIBRARIES / f"{library}.pretty"), name)
                    letter = prefix[library]
                counters[letter] = counters.get(letter, 0) + 1
                reference = f"{letter}{counters[letter]}"
                place(board, footprint, reference, 15.0 + column * 30.0, 12.0 + row * 17.5, angle, back)
            row += 1

    # A solder jumper: KiCad's JP prefix, which the connector ICD must not take.
    jumper = pcbnew.FootprintLoad(str(LIBRARIES / "Jumper.pretty"), "SolderJumper-2_P1.3mm_Open_Pad1.0x1.5mm")
    place(board, jumper, "JP1", 230.0, 180.0, 90.0, False)

    out.mkdir(parents=True, exist_ok=True)
    board_path = out / "oracle.kicad_pcb"
    pcbnew.SaveBoard(str(board_path), board)
    (out / "oracle.kicad_pro").write_text("{}\n", encoding="utf-8")
    print(f"wrote {board_path} with {len(board.GetFootprints())} footprints")


if __name__ == "__main__":
    build(Path(sys.argv[1] if len(sys.argv) > 1 else "board"))
