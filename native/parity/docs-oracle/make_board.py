"""Write the documentation-oracle board as KiCad 10 s-expression text.

    python3 native/parity/docs-oracle/make_board.py native/parity/docs-oracle/board

No pcbnew: the board is text, the stock footprints are copied from KiCad's own
library files, and KiCad is only the oracle. ``ipc_finish.py`` then has KiCad
open the board, fill its zones, save it in KiCad's own form and dump KiCad's
pad outlines; ``export.sh`` writes the reference outputs (README.md).

The board exists to catch transform mistakes in Prism's document generators:
every footprint is placed at an awkward angle, on both sides. ``OffsetDrills``
carries a drill offset, an oval slot, a pad turned inside its footprint and an
offset slot on a turned pad. ``UnusualPads`` carries custom pads with polygon,
circle and arc primitives, chamfered, round-rect, trapezoid and odd-angle oval
pads, a press-fit pad and counterbored and countersunk holes. The board has a
four-layer stackup, an Edge.Cuts outline with mixed-radius arc corners, a notch
and two cutouts (a circle and an arc-edged polygon), a castellated pad on the
edge, every via span (through, blind, buried, micro, backdrilled), arc tracks,
an arc-edged copper zone and a keep-out.

A back-side footprint is written the way KiCad writes a flipped one:
orientation 180 - angle, local y mirrored, pad and text angles negated, F/B
layers swapped, chamfer corners and trapezoid deltas mirrored, text mirrored.
"""

from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path

LIBRARIES = Path(os.environ.get("KICAD_FOOTPRINT_DIR", "/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints"))

#: (library, footprint, reference letter) stock parts placed on the board.
STOCK = [
    ("Resistor_SMD", "R_0603_1608Metric", "R"),
    ("Package_SO", "SOIC-8_3.9x4.9mm_P1.27mm", "U"),
    ("Connector_PinHeader_2.54mm", "PinHeader_1x04_P2.54mm_Vertical", "J"),
    ("Package_TO_SOT_SMD", "SOT-23", "Q"),
]

#: Footprint angles, degrees: right angles, a negative one and two that are not
#: multiples of 45 degrees.
ANGLES = [0.0, 90.0, 180.0, 270.0, -45.0, 30.0, 137.5]

#: The angles the unusual-pad footprint is turned to, on the front and back.
SHAPE_ANGLES = [0.0, 37.0, 90.0, 180.0]

BOARD_WIDTH = 320.0
BOARD_HEIGHT = 280.0

#: Deterministic uuids: the same text every run.
_UUIDS = uuid.UUID("6f1d7c1e-0b4a-4c55-9a62-0e5d0c9a0001")
_uuid_count = 0


def next_uuid() -> str:
    global _uuid_count
    _uuid_count += 1
    return f'"{uuid.uuid5(_UUIDS, str(_uuid_count))}"'


# --- s-expressions -----------------------------------------------------------
# A node is a list whose first item is its head; an atom is a str, a quoted
# string keeping its quotes.

TOKEN = re.compile(r'\s*(\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+)')


def parse(text: str) -> list:
    stack: list[list] = [[]]
    for match in TOKEN.finditer(text):
        token = match.group(1)
        if token == "(":
            stack.append([])
        elif token == ")":
            node = stack.pop()
            stack[-1].append(node)
        else:
            stack[-1].append(token)
    return stack[0][0]


def dump(node: list, depth: int = 0) -> str:
    if not any(isinstance(item, list) for item in node):
        return "(" + " ".join(node) + ")"
    tabs = "\t" * (depth + 1)
    parts = []
    for item in node:
        if isinstance(item, str):
            parts.append(" " + item if parts else item)
        else:
            parts.append(f"\n{tabs}{dump(item, depth + 1)}")
    return "(" + "".join(parts) + "\n" + "\t" * depth + ")"


def number(value: float) -> str:
    text = f"{value:.6f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def angle(value: float) -> float:
    """KiCad's stored range, (-180, 180]."""

    value = value % 360.0
    return value - 360.0 if value > 180.0 else value


def q(text: str) -> str:
    return f'"{text}"'


# --- footprints --------------------------------------------------------------

#: Library-only nodes a placed footprint does not carry.
LIBRARY_ONLY = {"version", "generator", "generator_version", "layer", "uuid", "at"}
#: Nodes whose second and third items are a point.
POINTS = {"at", "start", "mid", "end", "center", "xy", "offset"}
#: Nodes whose ``(at x y angle)`` turns with the footprint.
TURNED = {"pad", "property", "fp_text"}


def flip_layer(name: str) -> str:
    if name.startswith('"F.'):
        return '"B.' + name[3:]
    if name.startswith('"B.'):
        return '"F.' + name[3:]
    return name


def transform(node: list, back: bool, orientation: float, parent: str = "") -> list:
    head = node[0]
    out = [head] + [transform(item, back, orientation, head) if isinstance(item, list) else item
                    for item in node[1:]]
    if back and head in POINTS and len(out) >= 3 and parent != "model":
        out[2] = number(-float(out[2]))
    if head == "at" and parent in TURNED:
        local = float(out[3]) if len(out) > 3 else 0.0
        turned = angle((-local if back else local) + orientation)
        out = out[:3] + ([number(turned)] if turned != 0.0 else [])
    if not back:
        return out
    if head in ("layer", "layers"):
        out = [head] + [flip_layer(item) if isinstance(item, str) else item for item in out[1:]]
    elif head == "rect_delta":
        out[2] = number(-float(out[2]))
    elif head == "chamfer":
        swap = {"top_left": "bottom_left", "bottom_left": "top_left",
                "top_right": "bottom_right", "bottom_right": "top_right"}
        out = [head] + [swap.get(item, item) for item in out[1:]]
    elif head == "effects" and parent in ("property", "fp_text"):
        justify = next((item for item in out if isinstance(item, list) and item[0] == "justify"), None)
        if justify is None:
            out.append(["justify", "mirror"])
        elif "mirror" not in justify:
            justify.append("mirror")
    return out


def place(footprint: list, reference: str, x: float, y: float, turn: float, back: bool) -> list:
    """A library footprint placed on the board, the way KiCad saves it."""

    orientation = angle(180.0 - turn if back else turn)
    at = ["at", number(x), number(y)] + ([number(orientation)] if orientation != 0.0 else [])
    placed = [footprint[0], footprint[1], ["layer", q("B.Cu" if back else "F.Cu")], ["uuid", next_uuid()], at]
    for item in footprint[2:]:
        if isinstance(item, list) and item[0] in LIBRARY_ONLY:
            continue
        item = transform(item, back, orientation) if isinstance(item, list) else item
        if isinstance(item, list) and item[0] == "property" and item[1] == '"Reference"':
            item[2] = q(reference)
        placed.append(item)
    return placed


def library(name: str, footprint: str) -> list:
    return parse((LIBRARIES / f"{name}.pretty" / f"{footprint}.kicad_mod").read_text(encoding="utf-8"))


def oracle(name: str, body: str) -> list:
    """A footprint written in library form (footprint-local coordinates)."""

    return parse(f"""(footprint "Oracle:{name}" (layer "F.Cu")
        (property "Reference" "REF**" (at 0 -3) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))
        (property "Value" "{name}" (at 0 3) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))
        {body})""")


OFFSET_DRILLS = """
    (attr through_hole)
    (fp_rect (start -4 -2) (end 6.5 6) (stroke (width 0.05) (type default)) (fill no) (layer "F.CrtYd"))
    (pad "1" thru_hole rect (at 0 0) (size 2.4 2.4) (drill 1 (offset 0.5 0)) (layers "*.Cu" "*.Mask"))
    (pad "2" thru_hole oval (at 4 0) (size 3.2 1.8) (drill oval 2.2 0.9) (layers "*.Cu" "*.Mask"))
    (pad "3" thru_hole rect (at 0 4 30) (size 2.4 2) (drill 1 (offset 0.4 -0.3)) (layers "*.Cu" "*.Mask"))
    (pad "4" thru_hole oval (at 4 4 60) (size 3.4 2) (drill oval 2.4 1 (offset 0.5 0)) (layers "*.Cu" "*.Mask"))
    (pad "5" smd roundrect (at -2.5 2 15) (size 1.6 0.8) (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.25))
"""

#: A custom pad's primitives must join its anchor into one shape (KiCad keeps
#: one polygon per pad): pad 1's arc rides the anchor's edge and reaches past it.
UNUSUAL_PADS = """
    (attr through_hole)
    (fp_rect (start -12 -9) (end 12 9) (stroke (width 0.05) (type default)) (fill no) (layer "F.CrtYd"))
    (pad "1" thru_hole custom (at -9 -6) (size 4 4) (drill 1) (layers "*.Cu" "*.Mask") (net "GND")
        (options (clearance outline) (anchor circle))
        (primitives
            (gr_poly (pts (xy -2 -1) (xy 2 -1) (xy 0 2)) (width 0) (fill yes))
            (gr_circle (center 2 0) (end 3 0) (width 0) (fill yes))
            (gr_arc (start -0.364661 2.068096) (mid -1.484924 1.484924) (end -2.068096 0.364661) (width 0.3))))
    (pad "2" thru_hole custom (at -3 -6) (size 4 3) (drill 0.8) (layers "*.Cu" "*.Mask") (net "VCC")
        (options (clearance outline) (anchor rect))
        (primitives (gr_poly (pts (xy -2 -1.5) (xy 2 -1.5) (xy 2.5 0) (xy 0 1.5) (xy -2.5 0)) (width 0) (fill yes))))
    (pad "3" smd roundrect (at 3 -6) (size 3 2) (layers "F.Cu" "F.Mask" "F.Paste")
        (roundrect_rratio 0) (chamfer_ratio 0.25) (chamfer top_left top_right bottom_left bottom_right))
    (pad "4" smd roundrect (at 9 -6) (size 3 2) (layers "F.Cu" "F.Mask" "F.Paste")
        (roundrect_rratio 0) (chamfer_ratio 0.3) (chamfer top_left top_right))
    (pad "5" smd roundrect (at -9 0) (size 3.5 2.5) (layers "F.Cu" "F.Mask" "F.Paste")
        (roundrect_rratio 0.2) (chamfer_ratio 0.2) (chamfer bottom_left bottom_right))
    (pad "6" smd roundrect (at -3 0) (size 3 2) (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.1))
    (pad "7" smd roundrect (at 3 0) (size 3 2) (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.5))
    (pad "8" smd trapezoid (at 9 0) (size 3 2) (rect_delta 0.6 0.3) (layers "F.Cu" "F.Mask" "F.Paste"))
    (pad "9" smd oval (at -9 6 17) (size 3 1.5) (layers "F.Cu" "F.Mask" "F.Paste"))
    (pad "10" thru_hole circle (at -3 6) (size 3 3) (drill 1) (property pad_prop_pressfit)
        (layers "*.Cu" "*.Mask") (net "VCC"))
    (pad "11" thru_hole circle (at 3 6) (size 3 3) (drill 1)
        (front_post_machining counterbore (size 2) (depth 0.5)) (layers "*.Cu" "*.Mask"))
    (pad "12" thru_hole circle (at 9 6) (size 3 3) (drill 1)
        (front_post_machining countersink (size 2.2) (depth 0.4)) (layers "*.Cu" "*.Mask"))
"""

EDGE_PADS = """
    (attr through_hole)
    (pad "1" thru_hole circle (at 0 0) (size 2 2) (drill 1) (property pad_prop_castellated)
        (layers "*.Cu" "*.Mask") (net "GND"))
    (pad "2" thru_hole oval (at 10 0) (size 2.4 1.4) (drill oval 1.2 0.6) (property pad_prop_pressfit)
        (layers "*.Cu" "*.Mask") (net "VCC"))
"""

ARC_LINK = """
    (attr smd)
    (pad "1" smd rect (at -6 0) (size 2 1.5) (layers "F.Cu" "F.Mask" "F.Paste") (net "SIG_LINK"))
    (pad "2" smd rect (at 6 0) (size 2 1.5) (layers "F.Cu" "F.Mask" "F.Paste") (net "SIG_LINK"))
"""


def footprints() -> list[list]:
    placed = []
    counters: dict[str, int] = {}
    row = 0
    parts = [(library(lib, name), letter) for lib, name, letter in STOCK]
    parts.append((oracle("OffsetDrills", OFFSET_DRILLS), "J"))
    for back in (False, True):
        for part, letter in parts:
            for column, turn in enumerate(ANGLES):
                counters[letter] = counters.get(letter, 0) + 1
                placed.append(place(part, f"{letter}{counters[letter]}", 15.0 + column * 30.0,
                                    12.0 + row * 17.5, turn, back))
            row += 1
    # A solder jumper: KiCad's JP prefix, which the connector ICD must not take.
    placed.append(place(library("Jumper", "SolderJumper-2_P1.3mm_Open_Pad1.0x1.5mm"), "JP1",
                        230.0, 180.0, 90.0, False))
    unusual = oracle("UnusualPads", UNUSUAL_PADS)
    for back in (False, True):
        for column, turn in enumerate(SHAPE_ANGLES):
            placed.append(place(unusual, f"U{100 + column + (4 if back else 0)}",
                                35.0 + column * 55.0, 225.0 if back else 175.0, turn, back))
    # A castellated pad on the left edge, a press-fit slot beside it.
    placed.append(place(oracle("EdgePads", EDGE_PADS), "J90", 0.0, 110.0, 0.0, False))
    placed.append(place(oracle("ArcLink", ARC_LINK), "J91", 120.0, 150.0, 0.0, False))
    return placed


# --- board items -------------------------------------------------------------

def p(x: float, y: float) -> str:
    return f"{number(x)} {number(y)}"


def edge(kind: str, geometry: str) -> str:
    return f'({kind} {geometry} (stroke (width 0.1) (type default)) (layer "Edge.Cuts") (uuid {next_uuid()}))'


def outline() -> list[str]:
    """A rounded rectangle with mixed corner radii, a bottom notch and two cutouts."""

    w, h = BOARD_WIDTH, BOARD_HEIGHT
    d = 2 ** -0.5

    def line(a, b):
        return edge("gr_line", f"(start {p(*a)}) (end {p(*b)})")

    def arc(a, m, b):
        return edge("gr_arc", f"(start {p(*a)}) (mid {p(*m)}) (end {p(*b)})")

    return [
        line((12, 0), (w - 5, 0)),
        arc((w - 5, 0), (w - 5 + 5 * d, 5 - 5 * d), (w, 5)),
        line((w, 5), (w, h - 16)),
        arc((w, h - 16), (w - 16 + 16 * d, h - 16 + 16 * d), (w - 16, h)),
        line((w - 16, h), (160, h)),
        line((160, h), (160, h - 10)),
        line((160, h - 10), (140, h - 10)),
        line((140, h - 10), (140, h)),
        line((140, h), (8, h)),
        arc((8, h), (8 - 8 * d, h - 8 + 8 * d), (0, h - 8)),
        line((0, h - 8), (0, 12)),
        arc((0, 12), (12 - 12 * d, 12 - 12 * d), (12, 0)),
        # Cutouts: a circle, and a polygon whose top edge is an arc.
        edge("gr_circle", f"(center {p(250, 255)}) (end {p(256, 255)}) (fill no)"),
        line((300, 246), (300, 266)),
        line((300, 266), (275, 266)),
        line((275, 266), (275, 246)),
        arc((275, 246), (287.5, 252), (300, 246)),
    ]


def via(x: float, y: float, kind: str, layers: tuple[str, str], net: str, extra: str = "") -> str:
    return (f'(via{" " + kind if kind else ""} (at {p(x, y)}) (size 0.6) (drill 0.3) {extra}'
            f'(layers "{layers[0]}" "{layers[1]}") (net "{net}") (uuid {next_uuid()}))')


def arc_track(start, mid, end, net: str) -> str:
    return (f'(arc (start {p(*start)}) (mid {p(*mid)}) (end {p(*end)}) (width 0.25) (layer "F.Cu") '
            f'(net "{net}") (uuid {next_uuid()}))')


def copper() -> list[str]:
    return [
        # Every via span, on named nets.
        via(25, 150, "", ("F.Cu", "B.Cu"), "GND"),
        via(40, 150, "blind", ("F.Cu", "In1.Cu"), "SIG_A"),
        via(55, 150, "buried", ("In1.Cu", "In2.Cu"), "SIG_A"),
        via(70, 150, "micro", ("F.Cu", "In1.Cu"), "SIG_B"),
        via(85, 150, "", ("F.Cu", "B.Cu"), "SIG_B", '(backdrill (size 0.8) (layers "F.Cu" "In1.Cu")) '),
        # Tracks, including arcs, so the nets are named on copper as well as pads.
        arc_track((26, 169), (18, 160), (25, 150), "GND"),
        arc_track((40, 150), (47.5, 145), (55, 150), "SIG_A"),
        arc_track((70, 150), (77.5, 155), (85, 150), "SIG_B"),
        arc_track((114, 150), (120, 142), (126, 150), "SIG_LINK"),
        f'(segment (start {p(114, 150)}) (end {p(114, 160)}) (width 0.25) (layer "F.Cu") '
        f'(net "SIG_LINK") (uuid {next_uuid()}))',
        # A GND pour whose far edge is an arc, and a keep-out below it.
        f'(zone (net "GND") (layer "F.Cu") (uuid {next_uuid()}) (hatch edge 0.5) '
        f'(connect_pads (clearance 0.5)) (min_thickness 0.25) '
        f'(fill yes (thermal_gap 0.5) (thermal_bridge_width 0.5)) '
        f'(polygon (pts (xy {p(225, 165)}) (xy {p(310, 165)}) '
        f'(arc (start {p(310, 190)}) (mid {p(267.5, 205)}) (end {p(225, 190)})))))',
        f'(zone (layer "F.Cu") (uuid {next_uuid()}) (hatch edge 0.5) (connect_pads (clearance 0)) '
        f'(min_thickness 0.25) (keepout (tracks not_allowed) (vias not_allowed) (pads not_allowed) '
        f'(copperpour not_allowed) (footprints allowed)) '
        f'(polygon (pts (xy {p(225, 212)}) (xy {p(310, 212)}) (xy {p(310, 242)}) (xy {p(225, 242)}))))',
    ]


HEADER = """(kicad_pcb (version 20260206) (generator "prism-oracle") (generator_version "10.0")
    (general (thickness 1.6) (legacy_teardrops no))
    (paper "A4")
    (layers
        (0 "F.Cu" signal) (4 "In1.Cu" signal) (6 "In2.Cu" signal) (2 "B.Cu" signal)
        (9 "F.Adhes" user "F.Adhesive") (11 "B.Adhes" user "B.Adhesive")
        (13 "F.Paste" user) (15 "B.Paste" user)
        (5 "F.SilkS" user "F.Silkscreen") (7 "B.SilkS" user "B.Silkscreen")
        (1 "F.Mask" user) (3 "B.Mask" user)
        (17 "Dwgs.User" user "User.Drawings") (19 "Cmts.User" user "User.Comments")
        (21 "Eco1.User" user "User.Eco1") (23 "Eco2.User" user "User.Eco2")
        (25 "Edge.Cuts" user) (27 "Margin" user)
        (31 "F.CrtYd" user "F.Courtyard") (29 "B.CrtYd" user "B.Courtyard")
        (35 "F.Fab" user) (33 "B.Fab" user))
    (setup
        (stackup
            (layer "F.SilkS" (type "Top Silk Screen"))
            (layer "F.Paste" (type "Top Solder Paste"))
            (layer "F.Mask" (type "Top Solder Mask") (thickness 0.01))
            (layer "F.Cu" (type "copper") (thickness 0.035))
            (layer "dielectric 1" (type "core") (thickness 1.51) (material "FR4") (epsilon_r 4.5) (loss_tangent 0.02))
            (layer "In1.Cu" (type "copper") (thickness 0.035))
            (layer "dielectric 2" (type "prepreg") (thickness 0.1) (material "FR4") (epsilon_r 4.3) (loss_tangent 0.02))
            (layer "In2.Cu" (type "copper") (thickness 0.035))
            (layer "dielectric 3" (type "core") (thickness 0.1) (material "FR4") (epsilon_r 4.5) (loss_tangent 0.02))
            (layer "B.Cu" (type "copper") (thickness 0.035))
            (layer "B.Mask" (type "Bottom Solder Mask") (thickness 0.01))
            (layer "B.SilkS" (type "Bottom Silk Screen"))
            (copper_finish "None")
            (dielectric_constraints no)
            (edge_connector bevelled)
            (edge_plating yes))
        (pad_to_mask_clearance 0))
"""


def build(out: Path) -> None:
    items = [dump(footprint, 1) for footprint in footprints()] + outline() + copper()
    out.mkdir(parents=True, exist_ok=True)
    board = out / "oracle.kicad_pcb"
    board.write_text(HEADER + "".join(f"\t{item}\n" for item in items) + ")\n", encoding="utf-8")
    (out / "oracle.kicad_pro").write_text("{}\n", encoding="utf-8")
    (out / "oracle.kicad_prl").unlink(missing_ok=True)
    print(f"wrote {board}")


if __name__ == "__main__":
    build(Path(sys.argv[1] if len(sys.argv) > 1 else "board"))
