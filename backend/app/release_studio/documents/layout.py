"""Sheet layout model for the Documentation Engine (D1).

One model, two backends: :mod:`app.release_studio.documents.svg` and
:mod:`app.release_studio.documents.pdf` both consume the structures here, so a
sheet is described once and the two renderings cannot drift apart in content.

Everything is in **millimetres** with the origin at the sheet's top-left and
``y`` increasing downwards, which is how drawing sheets are described and how
SVG works.  The PDF backend flips into PDF's bottom-left origin at emit time,
so nothing above that boundary has to think about it.

Determinism is a property of this module: no timestamps, no identity-derived
ordering, and every number formatted through :func:`fmt` so the same layout
always serializes to the same bytes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Literal, Sequence

# ISO A and ANSI sheet sizes in millimetres, landscape (width, height).
SHEET_SIZES: dict[str, tuple[float, float]] = {
    "A5": (210.0, 148.0),
    "A4": (297.0, 210.0),
    "A3": (420.0, 297.0),
    "A2": (594.0, 420.0),
    "A1": (841.0, 594.0),
    "A0": (1189.0, 841.0),
    "A": (279.4, 215.9),
    "B": (431.8, 279.4),
    "C": (558.8, 431.8),
    "D": (863.6, 558.8),
}

#: The sizes a sheet is allowed to be chosen from, smallest first.
#:
#: Only ISO A sizes: a released drawing is printed and filed by people who have
#: A-series paper, and mixing in ANSI sizes would make the choice depend on
#: which ladder a board happened to land on.  ``A5`` is excluded -- it cannot
#: hold a title block plus a table column at a legible font size.
SHEET_LADDER: tuple[str, ...] = ("A4", "A3", "A2", "A1", "A0")

#: Placement ratios a drawing is allowed to state, largest first.
#:
#: The ISO 5455 preferred series.  A drawing states its scale and a reader
#: measures against it, so ratios like ``1:1.187`` -- which is what "shrink
#: until it fits" produces -- are unusable; the placement is quantized to the
#: standard series and the sheet grows instead when none of them fit.  Note
#: that 4:1 and 1:4 are deliberately absent: they are not in the series.
PREFERRED_SCALES: tuple[float, ...] = (
    10.0, 5.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01,
)


def preferred_scale(view_width: float, view_height: float, window: "Rect") -> float:
    """The largest preferred ratio at which *view* fits inside *window*.

    Falls back to an exact fit only when the artwork is too large for even the
    smallest preferred reduction, which on an A0 sheet means a board over ten
    metres across.  The ratio is reported either way, so a sheet never claims a
    scale it was not placed at.
    """

    if view_width <= 0 or view_height <= 0:
        raise ValueError("artwork has no extent to scale")
    for ratio in PREFERRED_SCALES:
        if view_width * ratio <= window.width and view_height * ratio <= window.height:
            return ratio
    return min(window.width / view_width, window.height / view_height)

Anchor = Literal["start", "middle", "end"]
Family = Literal["sans", "mono"]


def fmt(value: float) -> str:
    """Format a millimetre value identically in every backend.

    Three decimals is finer than any plotter cares about and coarse enough that
    floating-point noise in the last bit cannot change the emitted text.  The
    ``-0`` case is normalized because ``round(-0.0001, 3)`` is ``-0.0``, which
    would otherwise make two equal layouts serialize differently.
    """

    rounded = round(float(value), 3)
    if rounded == 0:
        rounded = 0.0
    text = f"{rounded:.3f}".rstrip("0").rstrip(".")
    return text or "0"


@dataclass(frozen=True, slots=True)
class Rect:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def inset(self, amount: float) -> "Rect":
        return Rect(
            self.x + amount,
            self.y + amount,
            max(0.0, self.width - 2 * amount),
            max(0.0, self.height - 2 * amount),
        )


@dataclass(frozen=True, slots=True)
class Line:
    x1: float
    y1: float
    x2: float
    y2: float
    width: float = 0.25
    colour: str = "#000000"


@dataclass(frozen=True, slots=True)
class Rectangle:
    rect: Rect
    width: float = 0.25
    colour: str = "#000000"
    fill: str = "none"


@dataclass(frozen=True, slots=True)
class Text:
    x: float
    y: float
    value: str
    size: float = 2.5
    anchor: Anchor = "start"
    family: Family = "sans"
    bold: bool = False
    colour: str = "#000000"


@dataclass(frozen=True, slots=True)
class Polyline:
    points: tuple[tuple[float, float], ...]
    width: float = 0.25
    colour: str = "#000000"
    fill: str = "none"
    close: bool = False


@dataclass(frozen=True, slots=True)
class Artwork:
    """A placed block of externally produced vector artwork.

    The Documentation Engine never re-implements KiCad's plotter: board artwork
    is acquired from ``kicad-cli`` and *placed*.  ``scale`` and the offsets map
    the artwork's own coordinate space onto the sheet, and ``source_digest``
    identifies the exact bytes placed so a sheet's provenance is checkable.
    """

    rect: Rect
    scale: float
    offset_x: float
    offset_y: float
    source_digest: str
    svg_body: str = ""
    label: str = ""


Element = Line | Rectangle | Text | Polyline | Artwork


@dataclass(frozen=True, slots=True)
class Sheet:
    """One composed drawing sheet."""

    key: str
    title: str
    size: str
    elements: tuple[Element, ...] = ()

    @property
    def width(self) -> float:
        return SHEET_SIZES[self.size][0]

    @property
    def height(self) -> float:
        return SHEET_SIZES[self.size][1]

    @property
    def frame(self) -> Rect:
        return Rect(0.0, 0.0, self.width, self.height)


class SheetBuilder:
    """Accumulates elements in draw order.

    Draw order is emission order, so a sheet's appearance is a property of the
    code that describes it rather than of a sort applied afterwards.
    """

    def __init__(self, key: str, title: str, size: str = "A3") -> None:
        if size not in SHEET_SIZES:
            raise ValueError(f"unknown sheet size: {size!r}")
        self.key = key
        self.title = title
        self.size = size
        self._elements: list[Element] = []

    @property
    def width(self) -> float:
        return SHEET_SIZES[self.size][0]

    @property
    def height(self) -> float:
        return SHEET_SIZES[self.size][1]

    def add(self, element: Element) -> None:
        self._elements.append(element)

    def extend(self, elements: Iterable[Element]) -> None:
        self._elements.extend(elements)

    def line(self, x1: float, y1: float, x2: float, y2: float, **kwargs) -> None:
        self.add(Line(x1, y1, x2, y2, **kwargs))

    def rect(self, rect: Rect, **kwargs) -> None:
        self.add(Rectangle(rect, **kwargs))

    def text(self, x: float, y: float, value: str, **kwargs) -> None:
        self.add(Text(x, y, value, **kwargs))

    def build(self) -> Sheet:
        return Sheet(
            key=self.key, title=self.title, size=self.size, elements=tuple(self._elements)
        )


# ---------------------------------------------------------------------------
# Text metrics
# ---------------------------------------------------------------------------

# Helvetica advance widths (units per 1000 em) for the printable ASCII range,
# taken from the standard AFM set.  The PDF backend needs these to right- and
# centre-align text, because unlike SVG it has no `text-anchor`.
_HELVETICA_WIDTHS: dict[int, int] = {
    32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
    40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
    56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
    64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
    72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
    80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
    88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
    96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
    104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
    111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556,
    118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260,
    125: 334, 126: 584,
}
_HELVETICA_BOLD_EXTRA = 1.06  # Bold is uniformly a little wider than regular.
_COURIER_WIDTH = 600


def text_width(value: str, size: float, *, family: Family = "sans", bold: bool = False) -> float:
    """Advance width of *value* in millimetres at *size* millimetres."""

    if family == "mono":
        return len(value) * _COURIER_WIDTH / 1000.0 * size
    total = sum(_HELVETICA_WIDTHS.get(ord(ch), 556) for ch in value)
    width = total / 1000.0 * size
    return width * _HELVETICA_BOLD_EXTRA if bold else width


def fit_text(value: str, limit: float, size: float, *, family: Family = "sans",
             bold: bool = False) -> str:
    """Truncate *value* with an ellipsis so it fits *limit* millimetres.

    A table cell that silently overflows its column is worse than one that
    admits it was too narrow, so truncation is visible rather than clipped.
    """

    if text_width(value, size, family=family, bold=bold) <= limit:
        return value
    ellipsis = "…"
    trimmed = value
    while trimmed and text_width(trimmed + ellipsis, size, family=family, bold=bold) > limit:
        trimmed = trimmed[:-1]
    return (trimmed + ellipsis) if trimmed else ""


# ---------------------------------------------------------------------------
# Shared furniture
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TitleBlockField:
    label: str
    value: str


def draw_frame(builder: SheetBuilder, *, margin: float = 10.0) -> Rect:
    """Draw the sheet border and return the usable interior rectangle."""

    outer = Rect(0.0, 0.0, builder.width, builder.height)
    inner = outer.inset(margin)
    builder.rect(inner, width=0.5)
    return inner


def draw_title_block(
    builder: SheetBuilder,
    area: Rect,
    *,
    title: str,
    fields: Sequence[TitleBlockField],
    height: float = 30.0,
    width: float = 110.0,
) -> Rect:
    """Draw a title block in *area*'s bottom-right; return the space left above.

    The fields are supplied by the caller and rendered in the given order --
    the engine never invents a date or an author, because a sheet that carries
    build-time metadata is not reproducible.
    """

    block = Rect(area.right - width, area.bottom - height, width, height)
    builder.rect(block, width=0.5)

    title_height = 8.0
    builder.line(block.x, block.y + title_height, block.right, block.y + title_height, width=0.35)
    builder.text(
        block.x + 2.0,
        block.y + title_height - 2.5,
        fit_text(title, width - 4.0, 3.5, bold=True),
        size=3.5,
        bold=True,
    )

    rows = max(1, len(fields))
    row_height = (height - title_height) / rows
    for index, entry in enumerate(fields):
        top = block.y + title_height + index * row_height
        if index:
            builder.line(block.x, top, block.right, top, width=0.2, colour="#666666")
        baseline = top + row_height - 1.6
        builder.text(block.x + 2.0, baseline, entry.label, size=2.2, colour="#444444")
        builder.text(
            block.right - 2.0,
            baseline,
            fit_text(entry.value, width - 34.0, 2.6, family="mono"),
            size=2.6,
            anchor="end",
            family="mono",
        )

    return Rect(area.x, area.y, area.width, block.y - area.y)


@dataclass(frozen=True, slots=True)
class Table:
    """A simple column-aligned table."""

    columns: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]
    widths: tuple[float, ...]
    align: tuple[Anchor, ...] = ()
    font_size: float = 2.4
    row_height: float = 4.2
    title: str = ""

    def height(self) -> float:
        header = self.row_height + (5.0 if self.title else 0.0)
        return header + self.row_height * len(self.rows)


#: Gutter kept clear at a cell's trailing edge, so a right-aligned value cannot
#: sit flush against the next column's left-aligned one and read as one word.
_CELL_GUTTER = 1.0


def _cell_anchor(offset: float, width: float, align: Anchor) -> float:
    if align == "end":
        return offset + width - _CELL_GUTTER
    if align == "middle":
        return offset + width / 2
    return offset


def draw_table(builder: SheetBuilder, table: Table, origin: tuple[float, float]) -> float:
    """Draw *table* with its top-left at *origin*; return the y after it."""

    x0, y0 = origin
    cursor = y0

    if table.title:
        builder.text(x0, cursor + 3.2, table.title, size=3.0, bold=True)
        cursor += 5.0

    aligns = table.align or tuple("start" for _ in table.columns)
    header_baseline = cursor + table.row_height - 1.4
    offset = x0
    for column, width, align in zip(table.columns, table.widths, aligns):
        anchor_x = _cell_anchor(offset, width, align)
        builder.text(
            anchor_x,
            header_baseline,
            fit_text(column, width - 1.0, table.font_size, bold=True),
            size=table.font_size,
            anchor=align,
            bold=True,
        )
        offset += width
    cursor += table.row_height
    total_width = sum(table.widths)
    builder.line(x0, cursor - 0.8, x0 + total_width, cursor - 0.8, width=0.3)

    for row in table.rows:
        baseline = cursor + table.row_height - 1.4
        offset = x0
        for value, width, align in zip(row, table.widths, aligns):
            anchor_x = offset if align == "start" else (
                offset + width if align == "end" else offset + width / 2
            )
            builder.text(
                anchor_x,
                baseline,
                fit_text(str(value), width - 1.0, table.font_size, family="mono"),
                size=table.font_size,
                anchor=align,
                family="mono",
            )
            offset += width
        cursor += table.row_height

    return cursor


def draw_notes(
    builder: SheetBuilder,
    notes: Sequence[str],
    origin: tuple[float, float],
    *,
    width: float,
    size: float = 2.4,
    title: str = "NOTES",
) -> float:
    """Draw a numbered note block, wrapping each note to *width*."""

    x0, y0 = origin
    cursor = y0
    if title:
        builder.text(x0, cursor + 3.2, title, size=3.0, bold=True)
        cursor += 5.5

    for index, note in enumerate(notes, start=1):
        prefix = f"{index}."
        builder.text(x0, cursor + size, prefix, size=size)
        for line in _wrap(note, width - 6.0, size):
            builder.text(x0 + 6.0, cursor + size, line, size=size)
            cursor += size * 1.5
        cursor += size * 0.5
    return cursor


def _wrap(value: str, width: float, size: float) -> list[str]:
    words = value.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and text_width(candidate, size) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines or [""]
