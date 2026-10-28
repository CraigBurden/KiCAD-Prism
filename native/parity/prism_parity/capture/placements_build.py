"""The golden producer of ``prism.placements.a1``, in Python.

The W0 prototype is Rust on the fork core, which is the code under test, so
the golden comes from this independent producer instead: the board's
S-expression tree from kicad_monkey's tokenizer (``parse_sexp_with_spans``,
whose list spans give the footprint forms' source ranges) and the field map's
normative rules R1-R13 as frozen now (``field-maps/placements.md``,
``placements-a1.tsp``), with decisions.md Placements 1-5 and Occurrences 1:

- R2/R3: identity is the footprint's ``(uuid …)`` and the reference its first
  ``(property "Reference" …)``, with no KiCad 7 fallback (``tstamp``,
  ``fp_text reference``): the prepared sources are upgraded to KiCad 10.0.6's
  format before anything reads them (decisions.md, Occurrences 1).
- R9 pad anchors: KiCad's integer-nm ``RotatePoint`` (Placements 5): exact
  swaps at 0/90/180/270°, ``EDA_ANGLE``'s ±√½ at the other multiples of 45°,
  otherwise ``sin``/``cos`` of θ·π/180. The contract names the pure-Rust
  ``libm`` crate for that case; this producer uses Python's ``math.sin``/``cos``
  (the platform libm), which agree to the last bit for nearly every argument.
  No committed fixture has an angle that is not a multiple of 90°.
- R8a/R12 arc extremes: ``atan2``/``cos``/``sin``/``hypot`` are Python's
  ``math`` (the contract names ``libm``; the results go through nm rounding).
"""

from __future__ import annotations

import math
import re
from typing import Any

SCHEMA = "prism.placements.a1"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
PAD_TYPES = {"thru_hole", "smd", "connect", "np_thru_hole"}
PAD_SHAPES = {"circle", "rect", "oval", "trapezoid", "roundrect", "custom"}
COURTYARD_LAYERS = ("F.CrtYd", "B.CrtYd")
FP_GRAPHICS = {"fp_line": "line", "fp_rect": "rect", "fp_circle": "circle", "fp_arc": "arc", "fp_poly": "poly", "fp_curve": "curve"}
GR_GRAPHICS = {"gr_line": "line", "gr_rect": "rect", "gr_circle": "circle", "gr_arc": "arc", "gr_poly": "poly", "gr_curve": "curve"}
SQRT1_2 = 0.7071067811865476  # M_SQRT1_2, EDA_ANGLE at odd multiples of 45°


class PlacementsError(ValueError):
    """The board is one KiCad rejects (R9: a pad type or shape outside the enums)."""


# ------------------------------------------------------------ numbers


def kiround(value: float) -> int:
    """Round half away from zero (conventions §6, KiCad's ``KiROUND``)."""

    return int(math.copysign(math.floor(abs(value) + 0.5), value))


def nm(value_mm: float) -> int:
    """conventions §6: ``(mm × 1e6).round()`` half away from zero; -0 becomes 0."""

    return kiround(float(value_mm) * 1e6) + 0


def fold(value: float) -> float | int:
    """A number as written, ``-0`` folded to ``0`` (R14)."""

    value = float(value)
    if value == 0:
        return 0
    return int(value) if value.is_integer() and abs(value) < 2**53 else value


def degrees(value: float) -> float:
    value = float(value)
    return 0.0 if value == 0 else value


# ---------------------------------------------------------- s-expressions


def is_form(item: Any, head: str | None = None) -> bool:
    return isinstance(item, list) and bool(item) and (head is None or str(item[0]) == head)


def child(form: list | None, head: str) -> list | None:
    if form is None:
        return None
    for item in form[1:]:
        if is_form(item, head):
            return item
    return None


def children(form: list, head: str) -> list[list]:
    return [item for item in form[1:] if is_form(item, head)]


def number(item: Any, default: float = 0.0) -> float:
    return float(item) if isinstance(item, (int, float)) and not isinstance(item, bool) else default


def xy(form: list | None) -> tuple[float, float] | None:
    if form is None or len(form) < 3:
        return None
    return (number(form[1]), number(form[2]))


def xyz(form: list | None, default: float) -> list[float]:
    inner = child(form, "xyz") if form is not None else None
    if inner is None:
        return [default, default, default]
    return [number(inner[i], default) if len(inner) > i else default for i in (1, 2, 3)]


def layer_of(form: list) -> str | None:
    found = child(form, "layer")
    return str(found[1]) if found is not None and len(found) > 1 else None


# --------------------------------------------------------------- geometry


def floormod(a: float, m: float) -> float:
    """Python's float ``%`` for a positive divisor (R8a step 3)."""

    return a % m


def arc_points(a: tuple, m: tuple, b: tuple) -> list[tuple[float, float]]:
    """R8a, operation for operation as ``interface_extractor._arc_points``."""

    (ax, ay), (mx, my), (bx, by) = a, m, b
    points = [a, m, b]
    d = 2.0 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my))
    if abs(d) < 1e-12:
        return points
    ux = ((ax * ax + ay * ay) * (my - by) + (mx * mx + my * my) * (by - ay) + (bx * bx + by * by) * (ay - my)) / d
    uy = ((ax * ax + ay * ay) * (bx - mx) + (mx * mx + my * my) * (ax - bx) + (bx * bx + by * by) * (mx - ax)) / d
    radius = math.hypot(ax - ux, ay - uy)

    def angle(x: float, y: float) -> float:
        return floormod(math.atan2(y - uy, x - ux), math.tau)

    start, mid, end = angle(ax, ay), angle(mx, my), angle(bx, by)
    sweep = floormod(end - start, math.tau)
    if floormod(mid - start, math.tau) > sweep:
        start, sweep = end, math.tau - sweep
    for quarter in range(4):
        theta = quarter * math.pi / 2.0
        if floormod(theta - start, math.tau) <= sweep:
            points.append((ux + radius * math.cos(theta), uy + radius * math.sin(theta)))
    return points


def graphic_points(form: list, kind: str) -> list[tuple[float, float]]:
    """R8: the characteristic points of one graphic, in the frame the file writes it in."""

    out: list[tuple[float, float]] = []
    if kind in ("line", "rect"):
        for head in ("start", "end"):
            point = xy(child(form, head))
            if point is not None:
                out.append(point)
    elif kind == "circle":
        centre, end = xy(child(form, "center")), xy(child(form, "end"))
        if centre is not None and end is not None:
            radius = math.hypot(end[0] - centre[0], end[1] - centre[1])
            out += [(centre[0] - radius, centre[1] - radius), (centre[0] + radius, centre[1] + radius)]
    elif kind == "arc":
        a, m, b = xy(child(form, "start")), xy(child(form, "mid")), xy(child(form, "end"))
        if a is not None and m is not None and b is not None:
            out += arc_points(a, m, b)
    elif kind in ("poly", "curve"):
        for element in (child(form, "pts") or [None])[1:]:
            if is_form(element, "xy"):
                out.append(xy(element))
            elif is_form(element, "arc") and kind == "poly":
                a, m, b = xy(child(element, "start")), xy(child(element, "mid")), xy(child(element, "end"))
                if a is not None and m is not None and b is not None:
                    out += arc_points(a, m, b)
    return out


def bounds(points: list[tuple[float, float]]) -> dict | None:
    if not points:
        return None
    return {
        "minNm": {"xNm": nm(min(p[0] for p in points)), "yNm": nm(min(p[1] for p in points))},
        "maxNm": {"xNm": nm(max(p[0] for p in points)), "yNm": nm(max(p[1] for p in points))},
    }


def eda_sin_cos(theta: float) -> tuple[float, float]:
    """``EDA_ANGLE::Sin``/``Cos`` for θ in [0, 360) (eda_angle.h:177-215)."""

    exact = {
        0.0: (0.0, 1.0), 90.0: (1.0, 0.0), 180.0: (0.0, -1.0), 270.0: (-1.0, 0.0),
        45.0: (SQRT1_2, SQRT1_2), 135.0: (SQRT1_2, -SQRT1_2), 225.0: (-SQRT1_2, -SQRT1_2), 315.0: (-SQRT1_2, SQRT1_2),
    }
    if theta in exact:
        return exact[theta]
    radians = theta * math.pi / 180.0
    return (math.sin(radians), math.cos(radians))


def rotate_point(lx: int, ly: int, rotation: float) -> tuple[int, int]:
    """R9 steps 2-4: KiCad's ``RotatePoint`` (trigo.cpp:227-262) of an integer-nm point."""

    theta = float(rotation) % 360.0
    if theta == 0.0:
        return (lx, ly)
    if theta == 90.0:
        return (ly, -lx)
    if theta == 180.0:
        return (-lx, -ly)
    if theta == 270.0:
        return (-ly, lx)
    s, c = eda_sin_cos(theta)
    return (kiround(ly * s + lx * c), kiround(ly * c - lx * s))


# --------------------------------------------------------------- producer


class ByteOffsets:
    """Character offsets of the decoded text → byte offsets of its UTF-8 encoding."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.ascii = text.isascii()
        self.char = 0
        self.byte = 0

    def __call__(self, offset: int) -> int:
        if self.ascii:
            return offset
        if offset < self.char:  # offsets come in increasing order; restart otherwise
            self.char = self.byte = 0
        self.byte += len(self.text[self.char:offset].encode("utf-8"))
        self.char = offset
        return self.byte


def empty_form() -> dict:
    """R1 without a board: no footprints, no designators, no outline."""

    return {"schema": SCHEMA, "footprints": [], "designators": []}


def _reference(fp: list) -> str | None:
    for prop in children(fp, "property"):
        if len(prop) > 1 and str(prop[1]) == "Reference":
            value = str(prop[2]) if len(prop) > 2 and not isinstance(prop[2], list) else ""
            return value or None  # the first Reference property decides; not trimmed
    return None


def _pad(fp_at: tuple[int, int], rotation: float, form: list) -> dict:
    number_text = str(form[1]) if len(form) > 1 and not isinstance(form[1], list) else ""
    pad_type = str(form[2]) if len(form) > 2 and not isinstance(form[2], list) else ""
    shape = str(form[3]) if len(form) > 3 and not isinstance(form[3], list) else ""
    if pad_type not in PAD_TYPES or shape not in PAD_SHAPES:
        raise PlacementsError(f"pad {number_text!r}: type {pad_type!r} / shape {shape!r} is one KiCad rejects")
    local = xy(child(form, "at")) or (0.0, 0.0)
    rx, ry = rotate_point(nm(local[0]), nm(local[1]), rotation)
    size = xy(child(form, "size")) or (0.0, 0.0)
    return {
        "number": number_text,
        "type": pad_type,
        "shape": shape,
        "positionNm": {"xNm": fp_at[0] + rx + 0, "yNm": fp_at[1] + ry + 0},
        "size": {"xNm": nm(size[0]), "yNm": nm(size[1])},
    }


def _model(form: list) -> dict | None:
    path = str(form[1]) if len(form) > 1 and not isinstance(form[1], list) else ""
    if not path:
        return None
    hidden = False
    for item in form[2:]:
        if is_form(item, "hide"):
            hidden = len(item) < 2 or str(item[1]) != "no"
        elif not isinstance(item, list) and str(item) == "hide":
            hidden = True
    if child(form, "offset") is not None:
        offset = xyz(child(form, "offset"), 0.0)
    elif child(form, "at") is not None:
        offset = [v * 25.4 for v in xyz(child(form, "at"), 0.0)]  # pre-KiCad 5, inches
    else:
        offset = [0.0, 0.0, 0.0]
    rotation = xyz(child(form, "rotate"), 0.0)
    scale = xyz(child(form, "scale"), 1.0)
    return {
        "path": path,
        "hidden": hidden,
        "offset": {"xNm": nm(offset[0]), "yNm": nm(offset[1]), "zNm": nm(offset[2])},
        "rotation": {"xDeg": fold(rotation[0]), "yDeg": fold(rotation[1]), "zDeg": fold(rotation[2])},
        "scale": {"x": fold(scale[0]), "y": fold(scale[1]), "z": fold(scale[2])},
    }


def build(board_text: str) -> tuple[dict, list[tuple[str, str]]]:
    """``(document, warnings)`` for one ``.kicad_pcb`` text (R1-R13)."""

    from kicad_monkey.kicad_sexpr import parse_sexp_with_spans

    root, spans = parse_sexp_with_spans(board_text)
    if not is_form(root, "kicad_pcb"):
        raise PlacementsError("not a kicad_pcb")
    to_bytes = ByteOffsets(board_text)
    warnings: list[tuple[str, str]] = []
    footprints: list[dict] = []
    seen: set[str] = set()
    outline_points: list[tuple[float, float]] = []
    for index, form in enumerate(root[1:]):
        if not isinstance(form, list) or not form:
            continue
        head = str(form[0])
        if head in GR_GRAPHICS:
            if layer_of(form) == "Edge.Cuts":  # R12: board-level graphics only
                outline_points += graphic_points(form, GR_GRAPHICS[head])
            continue
        if head != "footprint":
            continue
        span = spans[id(form)]
        uuid_form = child(form, "uuid")
        uuid = str(uuid_form[1]) if uuid_form is not None and len(uuid_form) > 1 else ""
        if not UUID.match(uuid) or uuid in seen:  # R2
            warnings.append(("placements-footprint-skipped", f"footprint at byte {to_bytes(span.offset)}: uuid {uuid!r}"))
            continue
        seen.add(uuid)
        item: dict = {"uuid": uuid}
        reference = _reference(form)
        if reference is not None:
            item["reference"] = reference
        lib_id = str(form[1]) if len(form) > 1 and not isinstance(form[1], list) else ""
        if lib_id:
            item["libId"] = lib_id
        layer = layer_of(form) or ""
        item["side"] = "back" if layer.startswith("B.") else "front"
        at = child(form, "at")
        ax, ay = xy(at) or (0.0, 0.0)
        rotation = degrees(number(at[3])) if at is not None and len(at) > 3 else 0.0
        fp_at = (nm(ax), nm(ay))
        item["positionNm"] = {"xNm": fp_at[0], "yNm": fp_at[1]}
        item["rotationDeg"] = fold(rotation)
        attr = child(form, "attr")
        tokens = {str(token) for token in attr[1:] if not isinstance(token, list)} if attr is not None else set()
        item["dnp"] = "dnp" in tokens
        item["excludeFromPosFiles"] = "exclude_from_pos_files" in tokens
        courtyard: list[tuple[float, float]] = []
        for graphic in form[1:]:
            if is_form(graphic) and str(graphic[0]) in FP_GRAPHICS and layer_of(graphic) in COURTYARD_LAYERS:
                courtyard += graphic_points(graphic, FP_GRAPHICS[str(graphic[0])])
        box = bounds(courtyard)
        if box is not None:
            item["courtyardBounds"] = box
        item["pads"] = [_pad(fp_at, rotation, pad) for pad in children(form, "pad")]
        item["models"] = [model for model in (_model(m) for m in children(form, "model")) if model is not None]
        start = to_bytes(span.offset)
        item["sourceSpan"] = {"offsetBytes": start, "lengthBytes": to_bytes(span.end_offset) - start}
        footprints.append(item)
    document: dict = {
        "schema": SCHEMA,
        "footprints": footprints,
        "designators": sorted({fp["reference"] for fp in footprints if "reference" in fp}),
    }
    outline = bounds(outline_points)
    if outline is not None:
        document["outlineBounds"] = outline
    setup = child(root, "setup")
    aux = child(setup, "aux_axis_origin") if setup is not None else None
    if aux is not None and len(aux) > 2:
        document["auxAxisOrigin"] = {"xNm": nm(number(aux[1])), "yNm": nm(number(aux[2]))}
    return document, warnings
