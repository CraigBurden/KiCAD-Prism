"""Ingest an externally produced SVG drawing into the sheet layout model.

``kicad-cruncher pcb-svg`` renders the assembly views -- one designator per
component, fitted to that component's own bounds, over a hidden-line-removed
outline.  Unlike ``kicad-cli``, it emits SVG only, so its drawing cannot be
composited into a PDF page the way an acquired KiCad PDF is.

Rather than grow a second renderer for one format, the drawing is *ingested*:
parsed into the same primitives every other sheet element uses, transformed
onto the sheet, and then drawn by both backends.  Three things follow from
that, and they are the reason this module exists instead of an SVG→PDF shim:

* the SVG sheet and the PDF sheet cannot disagree, because there is one model;
* designators are set in the sheet's own typography with the bundled, digest-
  checked face, rather than in whatever monospace font the reader's machine
  happens to resolve for ``Consolas, 'Liberation Mono', monospace``;
* nothing host-dependent survives into the released bytes.

The accepted vocabulary is deliberately closed.  Anything outside it raises
:class:`VectorIngestError` rather than being skipped, because a silently
dropped drill or outline is a defective drawing that still looks plausible.
"""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from typing import Iterable, Sequence
from xml.etree import ElementTree

from app.release_studio.documents.layout import (
    Anchor,
    Circle,
    Element,
    Line,
    Polyline,
    Rect,
    Rectangle,
    Text,
)

_SVG_NS = "http://www.w3.org/2000/svg"
_UNIT_TO_MM = {"mm": 1.0, "cm": 10.0, "in": 25.4, "pt": 25.4 / 72.0, "px": 25.4 / 96.0, "": 1.0}
_LENGTH = re.compile(r"^\s*(-?[0-9.eE+]+)\s*([a-z%]*)\s*$")
_NUMBER = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")
_TRANSFORM = re.compile(r"([a-zA-Z]+)\s*\(([^)]*)\)")
_STYLE_ENTRY = re.compile(r"([a-zA-Z-]+)\s*:\s*([^;]+)")

#: ``(a, b, c, d, e, f)`` mapping ``x' = ax + cy + e``, ``y' = bx + dy + f``.
Matrix = tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

#: Path commands this ingester understands, with how many numbers each takes.
_PATH_ARITY = {"m": 2, "l": 2, "h": 1, "v": 1, "a": 7, "z": 0}
_PATH_TOKEN = re.compile(r"([MmLlHhVvAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)")

#: Chord length used when flattening an elliptical arc, in source units.
#:
#: The source is millimetres and these arcs are footprint-scale, so a tenth of
#: a millimetre is finer than any plotter resolves and finer than the 0.001 mm
#: the layout model serializes to.  Fixed rather than adaptive on purpose: the
#: sampling has to be a property of this code, not of the placement scale, or
#: the same board would ingest to different geometry on different sheets.
_ARC_CHORD_MM = 0.1


class VectorIngestError(RuntimeError):
    """An SVG drawing could not be ingested into the layout model."""


@dataclass(frozen=True, slots=True)
class VectorDrawing:
    """A parsed drawing in its own millimetre coordinate space."""

    elements: tuple[Element, ...]
    view_x: float
    view_y: float
    view_width: float
    view_height: float
    #: SHA-256 of the source drawing, so a sheet can name the exact bytes it
    #: was composed from without those bytes being released themselves.
    digest: str = ""

    def placed(self, window: Rect, scale: float) -> tuple[Element, ...]:
        """The same drawing mapped onto *window* at *scale* sheet-mm per mm.

        Centred in the window, exactly as an acquired artwork placement is, so
        a sheet that states a ratio measures at that ratio whichever renderer
        produced its artwork.
        """

        if self.view_width <= 0 or self.view_height <= 0:
            raise VectorIngestError("the drawing has no extent to place")
        offset_x = (
            window.x + (window.width - self.view_width * scale) / 2 - self.view_x * scale
        )
        offset_y = (
            window.y + (window.height - self.view_height * scale) / 2 - self.view_y * scale
        )
        return tuple(
            _transform(element, scale, offset_x, offset_y) for element in self.elements
        )


def ingest_svg(svg_text: str) -> VectorDrawing:
    """Parse *svg_text* into layout primitives in millimetres."""

    try:
        root = ElementTree.fromstring(svg_text)
    except ElementTree.ParseError as exc:
        raise VectorIngestError(f"the drawing is not well-formed XML: {exc}") from exc
    if _tag(root) != "svg":
        raise VectorIngestError("the drawing's root element is not <svg>")

    units = _user_units_per_mm(root)
    view_x, view_y, view_width, view_height = _view_box(root)

    elements: list[Element] = []
    # Reading the document in millimetres from the outset means every primitive
    # is built in the unit the layout model uses, and no later pass has to know
    # what the source's user units were.
    _walk(root, _Style(), (1.0 / units, 0.0, 0.0, 1.0 / units, 0.0, 0.0), elements)
    return VectorDrawing(
        elements=tuple(elements),
        view_x=view_x / units,
        view_y=view_y / units,
        view_width=view_width / units,
        view_height=view_height / units,
        digest=hashlib.sha256(svg_text.encode("utf-8")).hexdigest(),
    )


# ---------------------------------------------------------------------------
# Affine transforms
# ---------------------------------------------------------------------------


def multiply(outer: Matrix, inner: Matrix) -> Matrix:
    """``outer ∘ inner`` -- apply *inner* first, as SVG nesting does."""

    a1, b1, c1, d1, e1, f1 = outer
    a2, b2, c2, d2, e2, f2 = inner
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def apply(matrix: Matrix, x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    return a * x + c * y + e, b * x + d * y + f


def _scale_of(matrix: Matrix) -> float:
    """The uniform scale factor of *matrix*.

    Stroke widths and font sizes are scalars; they can only follow a transform
    that scales both axes alike.  Cruncher's transforms are rotations and
    translations composed with the document's own uniform unit scale, so a
    non-uniform one means something changed upstream and is refused rather than
    approximated.
    """

    a, b, c, d, _e, _f = matrix
    sx, sy = math.hypot(a, b), math.hypot(c, d)
    if sx <= 0 or sy <= 0 or abs(sx - sy) > 1e-9 * max(sx, sy):
        raise VectorIngestError(
            f"the drawing uses a non-uniform transform (x×{sx:g}, y×{sy:g})"
        )
    return sx


def _rotation_of(matrix: Matrix) -> float:
    """The rotation *matrix* applies, in degrees clockwise on a y-down sheet."""

    a, b, _c, _d, _e, _f = matrix
    return math.degrees(math.atan2(b, a))


def parse_transform(text: str) -> Matrix:
    """Parse an SVG ``transform`` list into one matrix."""

    stripped = text.strip()
    if not stripped:
        return IDENTITY
    # Anything the operation pattern does not consume is a transform this
    # ingester would silently ignore, which would leave geometry off its true
    # place while still producing a plausible drawing.
    if _TRANSFORM.sub("", stripped).strip(" ,\t\r\n"):
        raise VectorIngestError(f"unreadable transform: {text!r}")

    matrix = IDENTITY
    for match in _TRANSFORM.finditer(stripped):
        values = [float(number.group(0)) for number in _NUMBER.finditer(match.group(2))]
        matrix = multiply(matrix, _transform_matrix(match.group(1).lower(), values, text))
    return matrix


def _transform_matrix(name: str, values: list[float], source: str) -> Matrix:
    if name == "translate":
        tx = values[0] if values else 0.0
        ty = values[1] if len(values) > 1 else 0.0
        return (1.0, 0.0, 0.0, 1.0, tx, ty)
    if name == "scale":
        sx = values[0] if values else 1.0
        sy = values[1] if len(values) > 1 else sx
        return (sx, 0.0, 0.0, sy, 0.0, 0.0)
    if name == "rotate":
        if not values:
            raise VectorIngestError(f"rotate() with no angle: {source!r}")
        radians = math.radians(values[0])
        cos, sin = math.cos(radians), math.sin(radians)
        spin: Matrix = (cos, sin, -sin, cos, 0.0, 0.0)
        if len(values) >= 3:
            cx, cy = values[1], values[2]
            return multiply(
                multiply((1.0, 0.0, 0.0, 1.0, cx, cy), spin),
                (1.0, 0.0, 0.0, 1.0, -cx, -cy),
            )
        return spin
    if name == "matrix" and len(values) == 6:
        return (values[0], values[1], values[2], values[3], values[4], values[5])
    raise VectorIngestError(f"unsupported transform {name!r} in {source!r}")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _Style:
    """Presentation attributes inherited down the element tree."""

    stroke: str = "none"
    fill: str = "none"
    stroke_width: float = 0.0

    def inherit(self, node: ElementTree.Element) -> "_Style":
        declared = dict(_STYLE_ENTRY.findall(node.get("style", "")))
        stroke = _first(node.get("stroke"), declared.get("stroke"), self.stroke)
        fill = _first(node.get("fill"), declared.get("fill"), self.fill)
        width = _first(node.get("stroke-width"), declared.get("stroke-width"), None)
        # The sheet model carries no alpha, so a translucent primitive would be
        # flattened to solid and change the drawing.  Refusing it keeps that
        # decision with whoever configured the renderer.
        for name in ("opacity", "fill-opacity", "stroke-opacity"):
            value = _first(node.get(name), declared.get(name), None)
            if value is not None and abs(float(value) - 1.0) > 1e-6:
                raise VectorIngestError(
                    f"the drawing uses {name}={value}; sheet primitives are opaque"
                )
        return _Style(
            stroke=_colour(stroke),
            fill=_colour(fill),
            stroke_width=float(width) if width is not None else self.stroke_width,
        )


def _first(*values: str | None) -> str | None:
    for value in values:
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _colour(value: str | None) -> str:
    """Normalize a paint value; anything unrecognized paints nothing.

    Cruncher writes plain hex and the keyword ``none``.  A gradient or a
    ``url(...)`` paint server would silently become black under a permissive
    reader, so it is refused instead.
    """

    if value is None:
        return "none"
    text = value.strip().lower()
    if text in ("none", "transparent"):
        return "none"
    if re.fullmatch(r"#[0-9a-f]{3}|#[0-9a-f]{6}", text):
        return text
    raise VectorIngestError(f"unsupported paint value: {value!r}")


def _walk(
    node: ElementTree.Element,
    inherited: _Style,
    matrix: Matrix,
    out: list[Element],
) -> None:
    for child in node:
        tag = _tag(child)
        if tag in ("metadata", "title", "desc", "defs", "style"):
            continue
        style = inherited.inherit(child)
        local = multiply(matrix, parse_transform(child.get("transform", "")))
        width = style.stroke_width * _scale_of(local)
        if tag == "g":
            _walk(child, style, local, out)
        elif tag in ("polyline", "polygon"):
            out.append(
                _polyline(_points(child.get("points", "")), style, local, tag == "polygon")
            )
        elif tag == "line":
            x1, y1 = apply(local, _number(child.get("x1")), _number(child.get("y1")))
            x2, y2 = apply(local, _number(child.get("x2")), _number(child.get("y2")))
            out.append(Line(x1, y1, x2, y2, width=width, colour=style.stroke))
        elif tag == "rect":
            # Emitted as a closed polyline rather than a Rectangle: under a
            # rotation a rectangle is no longer axis-aligned, and the layout
            # model's Rectangle cannot say so.
            rx, ry = _number(child.get("x")), _number(child.get("y"))
            rw, rh = _number(child.get("width")), _number(child.get("height"))
            corners = ((rx, ry), (rx + rw, ry), (rx + rw, ry + rh), (rx, ry + rh))
            out.append(_polyline(corners, style, local, True))
        elif tag == "circle":
            cx, cy = apply(local, _number(child.get("cx")), _number(child.get("cy")))
            out.append(
                Circle(
                    cx, cy, _number(child.get("r")) * _scale_of(local),
                    width=width, colour=style.stroke, fill=style.fill,
                )
            )
        elif tag == "path":
            out.extend(_path_elements(child.get("d", ""), style, local))
        elif tag == "text":
            out.append(_text_element(child, style, local))
        else:
            raise VectorIngestError(f"unsupported drawing element: <{tag}>")


def _points(data: str) -> tuple[tuple[float, float], ...]:
    numbers = [float(match.group(0)) for match in _NUMBER.finditer(data)]
    if len(numbers) < 4 or len(numbers) % 2:
        raise VectorIngestError("a points list did not contain coordinate pairs")
    return tuple(zip(numbers[0::2], numbers[1::2]))


def _polyline(
    points: Sequence[tuple[float, float]],
    style: _Style,
    matrix: Matrix,
    close: bool,
) -> Polyline:
    return Polyline(
        points=tuple(apply(matrix, px, py) for px, py in points),
        width=style.stroke_width * _scale_of(matrix),
        colour=style.stroke,
        fill=style.fill,
        close=close,
    )


def _text_element(node: ElementTree.Element, style: _Style, matrix: Matrix) -> Text:
    value = "".join(node.itertext()).strip()
    anchor: Anchor = {
        "start": "start", "middle": "middle", "end": "end"
    }.get(node.get("text-anchor", "start"), "start")  # type: ignore[assignment]
    x, y = apply(matrix, _number(node.get("x")), _number(node.get("y")))
    scale = _scale_of(matrix)
    # The source's own font-family is deliberately discarded.  It names host
    # fonts, and a released drawing whose lettering depends on the reader's
    # installed faces is not the same drawing twice.
    return Text(
        x=x,
        y=y,
        value=value,
        size=_number(node.get("font-size"), default=2.0) * scale,
        anchor=anchor,
        family="mono",
        bold=_number(node.get("font-weight"), default=400.0) >= 600,
        colour=style.fill if style.fill != "none" else "#000000",
        rotation=_rotation_of(matrix),
        baseline=(
            "central"
            if node.get("dominant-baseline", "") in ("central", "middle")
            else "alphabetic"
        ),
    )


def _path_elements(data: str, style: _Style, matrix: Matrix) -> list[Element]:
    """Flatten a path into polylines, sampling arcs into chords."""

    elements: list[Element] = []
    current: list[tuple[float, float]] = []
    start = (0.0, 0.0)
    x = y = 0.0
    command = ""
    numbers: list[float] = []

    def flush(close: bool) -> None:
        nonlocal current
        if len(current) >= 2:
            elements.append(_polyline(current, style, matrix, close))
        current = []

    for token in _PATH_TOKEN.finditer(data):
        letter, number = token.group(1), token.group(2)
        if letter is not None:
            if letter in ("z", "Z"):
                flush(True)
                x, y = start
                current = [start]
            command = letter
            numbers = []
            continue
        if not command:
            raise VectorIngestError("path data began with a coordinate")
        numbers.append(float(number))
        arity = _PATH_ARITY.get(command.lower())
        if arity is None:
            raise VectorIngestError(f"unsupported path command: {command!r}")
        if len(numbers) < arity:
            continue

        chunk, numbers = numbers, []
        lower = command.lower()
        relative = command.islower()
        if lower == "m":
            flush(False)
            x = x + chunk[0] if relative else chunk[0]
            y = y + chunk[1] if relative else chunk[1]
            start = (x, y)
            current = [start]
            # Repeated parameters after a move-to are line-tos, per SVG 1.1.
            command = "l" if relative else "L"
            continue
        if lower == "h":
            x = x + chunk[0] if relative else chunk[0]
        elif lower == "v":
            y = y + chunk[0] if relative else chunk[0]
        elif lower == "l":
            x = x + chunk[0] if relative else chunk[0]
            y = y + chunk[1] if relative else chunk[1]
        elif lower == "a":
            end_x = x + chunk[5] if relative else chunk[5]
            end_y = y + chunk[6] if relative else chunk[6]
            current.extend(
                _arc_points(
                    x, y, chunk[0], chunk[1], chunk[2],
                    bool(chunk[3]), bool(chunk[4]), end_x, end_y,
                )
            )
            x, y = end_x, end_y
            continue
        current.append((x, y))

    flush(False)
    return elements


def _arc_points(
    x1: float, y1: float,
    rx: float, ry: float, rotation_deg: float,
    large_arc: bool, sweep: bool,
    x2: float, y2: float,
) -> list[tuple[float, float]]:
    """Sample an SVG elliptical arc into chords, per the SVG 1.1 endpoint form."""

    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(x2, y2)]

    phi = math.radians(rotation_deg)
    cos_phi, sin_phi = math.cos(phi), math.sin(phi)
    dx2, dy2 = (x1 - x2) / 2.0, (y1 - y2) / 2.0
    x1p = cos_phi * dx2 + sin_phi * dy2
    y1p = -sin_phi * dx2 + cos_phi * dy2

    # An arc whose radii cannot span the endpoints is scaled up until it can,
    # which is what SVG 1.1 F.6.6 requires rather than an error.
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        rx *= math.sqrt(lam)
        ry *= math.sqrt(lam)

    numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    factor = math.sqrt(max(0.0, numerator / denominator)) if denominator else 0.0
    if large_arc == sweep:
        factor = -factor
    cxp = factor * rx * y1p / ry
    cyp = -factor * ry * x1p / rx
    cx = cos_phi * cxp - sin_phi * cyp + (x1 + x2) / 2.0
    cy = sin_phi * cxp + cos_phi * cyp + (y1 + y2) / 2.0

    def angle(ux: float, uy: float, vx: float, vy: float) -> float:
        dot = ux * vx + uy * vy
        norm = math.hypot(ux, uy) * math.hypot(vx, vy)
        value = math.acos(max(-1.0, min(1.0, dot / norm))) if norm else 0.0
        return -value if ux * vy - uy * vx < 0 else value

    theta1 = angle(1.0, 0.0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    delta = angle(
        (x1p - cxp) / rx, (y1p - cyp) / ry,
        (-x1p - cxp) / rx, (-y1p - cyp) / ry,
    )
    if not sweep and delta > 0:
        delta -= 2 * math.pi
    elif sweep and delta < 0:
        delta += 2 * math.pi

    radius = max(rx, ry)
    steps = max(2, math.ceil(abs(delta) * radius / _ARC_CHORD_MM))
    points: list[tuple[float, float]] = []
    for step in range(1, steps + 1):
        theta = theta1 + delta * step / steps
        ex, ey = rx * math.cos(theta), ry * math.sin(theta)
        points.append(
            (cos_phi * ex - sin_phi * ey + cx, sin_phi * ex + cos_phi * ey + cy)
        )
    return points


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def _transform(element: Element, scale: float, dx: float, dy: float) -> Element:
    """Map one primitive through ``p -> p * scale + (dx, dy)``.

    Stroke widths scale with the drawing.  A placement at 1:2 that kept its
    hairlines at source width would draw a board half the size with lines the
    same weight, which reads as a heavier board rather than a smaller one.
    """

    if isinstance(element, Line):
        return Line(
            element.x1 * scale + dx, element.y1 * scale + dy,
            element.x2 * scale + dx, element.y2 * scale + dy,
            width=element.width * scale, colour=element.colour,
        )
    if isinstance(element, Rectangle):
        rect = element.rect
        return Rectangle(
            Rect(
                rect.x * scale + dx, rect.y * scale + dy,
                rect.width * scale, rect.height * scale,
            ),
            width=element.width * scale, colour=element.colour, fill=element.fill,
        )
    if isinstance(element, Polyline):
        return Polyline(
            points=tuple((px * scale + dx, py * scale + dy) for px, py in element.points),
            width=element.width * scale, colour=element.colour,
            fill=element.fill, close=element.close,
        )
    if isinstance(element, Circle):
        return Circle(
            element.cx * scale + dx, element.cy * scale + dy, element.r * scale,
            width=element.width * scale, colour=element.colour, fill=element.fill,
        )
    if isinstance(element, Text):
        return Text(
            x=element.x * scale + dx, y=element.y * scale + dy, value=element.value,
            size=element.size * scale, anchor=element.anchor, family=element.family,
            bold=element.bold, colour=element.colour, rotation=element.rotation,
            baseline=element.baseline,
        )
    raise VectorIngestError(f"cannot place a {type(element).__name__}")


def clip(elements: Iterable[Element], window: Rect) -> tuple[Element, ...]:
    """Drop primitives that fall entirely outside *window*.

    Whole-primitive rejection rather than geometric clipping: a partly visible
    trace must stay whole, because a clipped-in-half segment on a released
    drawing would look like a break in the copper.  The window is a
    placement-fit guard, not a rendering effect.
    """

    kept: list[Element] = []
    for element in elements:
        bounds = _bounds(element)
        if bounds is None:
            kept.append(element)
            continue
        left, top, right, bottom = bounds
        if right < window.x or left > window.right:
            continue
        if bottom < window.y or top > window.bottom:
            continue
        kept.append(element)
    return tuple(kept)


def _bounds(element: Element) -> tuple[float, float, float, float] | None:
    if isinstance(element, Line):
        xs, ys = (element.x1, element.x2), (element.y1, element.y2)
    elif isinstance(element, Rectangle):
        rect = element.rect
        xs, ys = (rect.x, rect.right), (rect.y, rect.bottom)
    elif isinstance(element, Polyline):
        if not element.points:
            return None
        xs = tuple(point[0] for point in element.points)
        ys = tuple(point[1] for point in element.points)
    elif isinstance(element, Circle):
        xs = (element.cx - element.r, element.cx + element.r)
        ys = (element.cy - element.r, element.cy + element.r)
    elif isinstance(element, Text):
        # The run's advance is not known here and its anchor may be either end,
        # so the mark is treated as a point.  Designators sit inside the board.
        xs, ys = (element.x, element.x), (element.y, element.y)
    else:
        return None
    return min(xs), min(ys), max(xs), max(ys)


# ---------------------------------------------------------------------------
# Document geometry
# ---------------------------------------------------------------------------


def _tag(node: ElementTree.Element) -> str:
    tag = node.tag
    if isinstance(tag, str) and tag.startswith(f"{{{_SVG_NS}}}"):
        return tag[len(_SVG_NS) + 2:]
    return str(tag)


def _number(value: str | None, *, default: float = 0.0) -> float:
    if value is None or not str(value).strip():
        return default
    match = _NUMBER.search(str(value))
    return float(match.group(0)) if match else default


def _view_box(root: ElementTree.Element) -> tuple[float, float, float, float]:
    box = root.get("viewBox")
    if not box:
        raise VectorIngestError("the drawing has no viewBox and cannot be placed")
    parts = [float(part) for part in box.replace(",", " ").split()]
    if len(parts) != 4 or parts[2] <= 0 or parts[3] <= 0:
        raise VectorIngestError(f"the drawing's viewBox is unusable: {box!r}")
    return parts[0], parts[1], parts[2], parts[3]


def _user_units_per_mm(root: ElementTree.Element) -> float:
    """How many of the document's user units make one millimetre."""

    _vx, _vy, view_width, _vh = _view_box(root)
    match = _LENGTH.match(root.get("width", ""))
    if match is None:
        # No physical width declared: the viewBox is then taken as millimetres,
        # which is the convention every producer here follows.
        return 1.0
    unit = match.group(2).lower()
    if unit not in _UNIT_TO_MM:
        raise VectorIngestError(f"the drawing declares an unusable width unit: {unit!r}")
    width_mm = float(match.group(1)) * _UNIT_TO_MM[unit]
    if width_mm <= 0:
        raise VectorIngestError("the drawing declares a non-positive width")
    return view_width / width_mm


def drop_illegible_text(
    elements: Iterable[Element], floor_mm: float
) -> tuple[tuple[Element, ...], int]:
    """Remove text drawn below *floor_mm*; return what is left and how much went.

    A designator fitted into an 0402 pad pair is 0.16 mm tall on a 1:1 sheet.
    That is not small lettering, it is a smudge -- and a smudge is worse than a
    blank, because it makes the drawing look as though it carries data a reader
    merely failed to see.  Density is scale-invariant, so no ratio rescues it:
    a board dense enough to produce sub-millimetre designators cannot show all
    of them on one sheet at any scale.

    The count is returned rather than logged so the sheet can state it.  The
    position file in the same dossier remains the authoritative placement
    record, and the note block points at it.
    """

    kept: list[Element] = []
    dropped = 0
    for element in elements:
        if isinstance(element, Text) and element.size < floor_mm:
            dropped += 1
            continue
        kept.append(element)
    return tuple(kept), dropped


def used_glyphs(elements: Sequence[Element]) -> set[str]:
    """Every character the ingested drawing sets, for font-coverage checks."""

    return {
        char
        for element in elements
        if isinstance(element, Text)
        for char in element.value
    }


__all__ = [
    "VectorDrawing",
    "VectorIngestError",
    "clip",
    "drop_illegible_text",
    "ingest_svg",
    "used_glyphs",
]
