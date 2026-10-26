"""Drawing on a sheet: artwork windows, view captions, DNP hatching and legend,
and the overall board dimensions (split from :mod:`sheets` for the module-size
limit; the sheet composers in :mod:`sheets` call these).
"""

from __future__ import annotations

import math
from dataclasses import replace
from typing import Any, Mapping, Sequence

from app.release_studio.documents.artwork import (
    AcquiredArtwork,
    DnpStyle,
    place,
    scale_label,
)
from app.release_studio.documents.fonts import cap_height
from app.release_studio.documents.layout import (
    PRISM_SCALE_MARGIN,
    PRISM_SCALES,
    Rect,
    SheetBuilder,
    centred_baseline,
    fit_text,
    preferred_scale,
)
from app.release_studio.documents.style import (
    DEFAULT_SHEET_STYLE,
    INK,
    MUTED,
    PRISM_STYLE,
    RULE,
)


def _drawn_width(art: AcquiredArtwork | None, scale: float | None) -> float:
    """How wide the artwork will actually be drawn, in sheet millimetres.

    Zero when there is nothing to draw or no ratio yet, which leaves the table
    column at its configured width rather than letting it claim the sheet.
    """

    if art is None or scale is None:
        return 0.0
    return max(0.0, float(art.view_width) * scale)


def _draw_missing(
    builder: SheetBuilder,
    window: Rect,
    label: str,
    *,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> float:
    """State the absence where artwork would be, rather than leaving a gap."""

    if sheet_style == PRISM_STYLE:
        builder.rect(window, width=0.2, colour=RULE)
        builder.text(
            window.x + window.width / 2,
            window.y + window.height / 2,
            f"{label} unavailable",
            size=3.0,
            anchor="middle",
            colour=MUTED,
        )
        return 1.0
    builder.rect(window, width=0.2, colour="#999999")
    builder.text(
        window.x + window.width / 2,
        window.y + window.height / 2,
        f"{label} unavailable",
        size=3.0,
        anchor="middle",
        colour="#999999",
    )
    return 1.0


#: The gap between a drawing (or its width dimension) and the caption's capitals.
CAPTION_GAP = 2.5
#: The caption's type size, which is also its depth with descenders.
CAPTION_SIZE = 2.6
#: The least clear space between a caption and whatever sits under the window.
_CAPTION_CLEAR = 1.0


def _drawn_rect(window: Rect, art: AcquiredArtwork, scale: float) -> Rect:
    """Where the placed artwork actually sits inside its window."""

    drawn_width = max(0.0, art.view_width * scale)
    drawn_height = max(0.0, art.view_height * scale)
    return Rect(
        window.x + (window.width - drawn_width) / 2,
        window.y + (window.height - drawn_height) / 2,
        drawn_width,
        drawn_height,
    )


def _draw_artwork_caption(
    builder: SheetBuilder,
    window: Rect,
    art: AcquiredArtwork,
    scale: float,
    view_caption: str,
    *,
    clear_of: float | None = None,
) -> None:
    """The view direction and ratio, directly under the placed artwork.

    ``clear_of`` is the lowest point of anything drawn under the artwork with
    it -- the overall width dimension on a fabrication sheet -- and the caption
    starts below that instead.
    """

    placed = _drawn_rect(window, art, scale)
    top = placed.bottom if clear_of is None else max(placed.bottom, clear_of)
    caption = (
        f"{view_caption} · SCALE {scale_label(scale)}"
        if view_caption
        else f"SCALE {scale_label(scale)}"
    )
    builder.text(
        placed.x + placed.width / 2,
        # A 2.5 mm gap between the drawing and the caption's capitals.
        top + CAPTION_GAP + cap_height(CAPTION_SIZE, bold=True, typography=builder.typography),
        caption,
        size=CAPTION_SIZE,
        bold=True,
        anchor="middle",
        colour=MUTED,
    )


def _draw_artwork(
    builder: SheetBuilder,
    window: Rect,
    art: AcquiredArtwork | None,
    *,
    label: str,
    scale: float | None,
    sheet_style: str = DEFAULT_SHEET_STYLE,
    view_caption: str = "",
    overall: tuple[float, float, str, str] | None = None,
) -> float:
    """Place *art* in *window* at a stated ratio; return the ratio used.

    With no ``scale`` given the placement is quantized to a preferred drawing
    ratio rather than shrunk to fit exactly, because the number printed under
    the window is meant to be measured against.

    ``prism`` puts the ratio under the artwork itself -- beside the view
    direction where a sheet has one -- so the caption travels with the drawing
    instead of sitting at the window's bottom edge.  ``kicad`` keeps the old
    bottom-left label.

    ``overall`` is the board's ``(width, height, width label, height label)``
    from :func:`_board_size`; when given, the overall dimensions are drawn
    around the board here, so the caption can sit clear of them.
    """

    if art is None:
        _draw_missing(builder, window, label, sheet_style=sheet_style)
        if sheet_style == PRISM_STYLE and view_caption:
            builder.text(
                window.x + window.width / 2.0,
                window.bottom + 3.0,
                view_caption,
                size=2.6,
                bold=True,
                anchor="middle",
                colour=MUTED,
            )
        return 1.0

    if scale is None:
        if sheet_style == PRISM_STYLE:
            scale = preferred_scale(
                art.view_width,
                art.view_height,
                window,
                ladder=PRISM_SCALES,
                margin=PRISM_SCALE_MARGIN,
            )
        else:
            scale = preferred_scale(art.view_width, art.view_height, window)
    element, used = place(art, window, scale=scale, label=label)
    if sheet_style == PRISM_STYLE:
        element = replace(element, border_colour=RULE)
        builder.add(element)
        clear_of = _draw_overall(builder, window, art, used, overall)
        _draw_artwork_caption(builder, window, art, used, view_caption, clear_of=clear_of)
        return used
    builder.add(element)
    builder.text(
        window.x, window.bottom + 4.0, f"SCALE {scale_label(used)}", size=2.8, bold=True
    )
    _draw_overall(builder, window, art, used, overall)
    return used


def _draw_overall(
    builder: SheetBuilder,
    window: Rect,
    art: AcquiredArtwork,
    scale: float,
    overall: tuple[float, float, str, str] | None,
) -> float | None:
    """Draw the overall dimensions; return how far down the width dimension reaches."""

    if overall is None or scale <= 0:
        return None
    board_w, board_h, width_label, height_label = overall
    if board_w <= 0 or board_h <= 0:
        return None
    target = _dimension_rect(art, window, scale, board_w, board_h)
    draw_overall_dimensions(
        builder, target, width_label=width_label, height_label=height_label
    )
    return target.bottom + DIMENSION_DEPTH if width_label else None


def _view_caption(side: str) -> str:
    return "VIEWED FROM TOP" if side == "top" else "VIEWED FROM BOTTOM (MIRRORED)"


def _draw_view_direction(builder: SheetBuilder, window: Rect, side: str) -> None:
    """State which face of the board the artwork is seen from.

    ``kicad`` draws it inside the artwork window's bottom edge.  ``prism``
    folded it into the under-artwork caption in :func:`_draw_artwork`, so this
    is a no-op there.
    """

    if builder.sheet_style == PRISM_STYLE:
        return
    builder.text(
        window.x + window.width / 2.0,
        window.bottom - 1.8,
        _view_caption(side),
        size=2.6,
        bold=True,
        anchor="middle",
    )


#: How far below its slot a 3 mm heading's capitals start (baseline 3.2 mm,
#: cap height 2.17 mm): the blank band every heading carries above its ink.
_HEADING_INSET = 1.0

#: Height of the DNP legend under the population table, and its swatch size.
_DNP_LEGEND_HEIGHT = 5.0
_DNP_SWATCH = 4.0


def _draw_hatch(
    builder: SheetBuilder, rect: Rect, style: DnpStyle
) -> None:
    """Hatch *rect* at the artwork configuration's spacing and angle."""

    if not style.hatch or style.spacing <= 0 or style.line_width < 0:
        return
    theta = math.radians(style.angle)
    dx, dy = math.cos(theta), math.sin(theta)
    nx, ny = -dy, dx
    corners = (
        (rect.x, rect.y),
        (rect.right, rect.y),
        (rect.right, rect.bottom),
        (rect.x, rect.bottom),
    )
    offsets = [x * nx + y * ny for x, y in corners]
    low, high = min(offsets), max(offsets)
    epsilon = 1e-9
    offset = low + style.spacing / 2.0
    while offset < high:
        points: list[tuple[float, float]] = []
        if abs(dx) > epsilon:
            for x in (rect.x, rect.right):
                parameter = (x - offset * nx) / dx
                y = offset * ny + parameter * dy
                if rect.y - epsilon <= y <= rect.bottom + epsilon:
                    points.append((x, y))
        if abs(dy) > epsilon:
            for y in (rect.y, rect.bottom):
                parameter = (y - offset * ny) / dy
                x = offset * nx + parameter * dx
                if rect.x - epsilon <= x <= rect.right + epsilon:
                    points.append((x, y))
        if len(points) >= 2:
            points.sort(key=lambda point: point[0] * dx + point[1] * dy)
            (x1, y1), (x2, y2) = points[0], points[-1]
            builder.line(
                x1, y1, x2, y2, width=style.line_width, colour=style.colour
            )
        offset += style.spacing


def _draw_dnp_legend(
    builder: SheetBuilder,
    origin: tuple[float, float],
    *,
    width: float,
    style: DnpStyle,
    scale: float = 1.0,
) -> float:
    """Draw the DNP key under the population table; return its height.

    The swatch repeats the artwork's own treatment rather than inventing a
    second symbol for it: a reader matching the sheet against the drawing sheet
    sees the same colour and the same hatch. ``scale`` is the factor the tables
    above were fitted at; ``prism`` centres the text on the swatch.
    """

    x0, y0 = origin
    side = _DNP_SWATCH * scale
    size = 2.4 * scale
    swatch = Rect(x0, y0, side, side)
    builder.rect(swatch, width=0.25, colour=style.colour, fill="#ffffff")
    _draw_hatch(builder, swatch.inset(0.3 * scale), style)
    if builder.sheet_style == PRISM_STYLE:
        baseline = centred_baseline(y0, side, size, typography=builder.typography)
        gap = size * 0.8
    else:
        baseline = y0 + _DNP_SWATCH - 0.9
        gap = 2.0
    builder.text(
        x0 + side + gap,
        baseline,
        fit_text(
            "Do not populate — hatched, designator in red",
            max(width - side - gap, 1.0),
            size,
            typography=builder.typography,
        ),
        size=size,
        **({"colour": INK} if builder.sheet_style == PRISM_STYLE else {}),
    )
    return _DNP_LEGEND_HEIGHT * scale


#: How far overall dimensions sit outside the board outline, in millimetres.
_DIM_OFFSET = 5.0
_DIM_TICK = 2.0
_DIM_LINE = 0.18
_DIM_TEXT = 2.5
#: How far below the board outline the width dimension reaches: its end ticks.
DIMENSION_DEPTH = _DIM_OFFSET + _DIM_TICK / 2


def _mm_figure(value: Any) -> float:
    """Parse a KiCad ``MessageTextFromValue`` millimetre string into a float."""

    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip()
    if not text:
        return 0.0
    try:
        return float(text.split()[0])
    except (TypeError, ValueError, IndexError):
        return 0.0


def _board_size(stats: Mapping[str, Any]) -> tuple[float, float, str, str]:
    """Overall board width/height from the statistics projection.

    Returns ``(width_mm, height_mm, width_label, height_label)``.  Labels are
    KiCad's own formatting so the dimension text matches the characteristics
    table on the same sheet.
    """

    board = stats.get("board") if isinstance(stats.get("board"), Mapping) else {}
    width_raw = board.get("width")
    height_raw = board.get("height")
    width = _mm_figure(width_raw)
    height = _mm_figure(height_raw)
    width_label = str(width_raw) if width_raw not in (None, "") else ""
    height_label = str(height_raw) if height_raw not in (None, "") else ""
    return width, height, width_label, height_label


def _dimension_rect(
    art: AcquiredArtwork,
    window: Rect,
    scale: float,
    board_width: float,
    board_height: float,
) -> Rect:
    """Where the overall-dimension box sits on the sheet.

    Centre it on the placed artwork so the lines hug the board rather than the
    window.  Size it from the board statistics (at the stated scale), not from
    the artwork extent -- copper that overhangs Edge.Cuts must not stretch the
    claimed overall dimensions.
    """

    drawn_art_w = art.view_width * scale
    drawn_art_h = art.view_height * scale
    art_left = window.x + (window.width - drawn_art_w) / 2
    art_top = window.y + (window.height - drawn_art_h) / 2
    cx = art_left + drawn_art_w / 2
    cy = art_top + drawn_art_h / 2
    width = board_width * scale
    height = board_height * scale
    return Rect(cx - width / 2, cy - height / 2, width, height)


def draw_overall_dimensions(
    builder: SheetBuilder,
    target: Rect,
    *,
    width_label: str,
    height_label: str,
) -> None:
    """Draw overall width (below) and height (left) around *target*.

    Deliberately plain: extension lines, a dimension line, end ticks, and the
    same millimetre label the characteristics table already shows.  No arrows,
    no callouts, no authored overrides -- those are drafting-editor features.
    """

    if target.width <= 0 or target.height <= 0:
        return
    if width_label:
        y = target.bottom + _DIM_OFFSET
        builder.line(target.x, target.bottom, target.x, y + _DIM_TICK / 2, width=_DIM_LINE)
        builder.line(
            target.right, target.bottom, target.right, y + _DIM_TICK / 2, width=_DIM_LINE
        )
        builder.line(target.x, y, target.right, y, width=_DIM_LINE)
        builder.line(target.x, y - _DIM_TICK / 2, target.x, y + _DIM_TICK / 2, width=_DIM_LINE)
        builder.line(
            target.right, y - _DIM_TICK / 2, target.right, y + _DIM_TICK / 2, width=_DIM_LINE
        )
        builder.text(
            target.x + target.width / 2,
            y - 1.2,
            width_label,
            size=_DIM_TEXT,
            anchor="middle",
        )
    if height_label:
        x = target.x - _DIM_OFFSET
        builder.line(target.x, target.y, x - _DIM_TICK / 2, target.y, width=_DIM_LINE)
        builder.line(
            target.x, target.bottom, x - _DIM_TICK / 2, target.bottom, width=_DIM_LINE
        )
        builder.line(x, target.y, x, target.bottom, width=_DIM_LINE)
        builder.line(x - _DIM_TICK / 2, target.y, x + _DIM_TICK / 2, target.y, width=_DIM_LINE)
        builder.line(
            x - _DIM_TICK / 2, target.bottom, x + _DIM_TICK / 2, target.bottom, width=_DIM_LINE
        )
        builder.text(
            x - 1.5,
            target.y + target.height / 2,
            height_label,
            size=_DIM_TEXT,
            anchor="middle",
            rotation=-90.0,
        )


#: Vertical gap left between stacked tables, and the cover's bottom note block.


def _art_fits(
    window: Rect,
    art: Any,
    scale: float | None,
    *,
    dimensioned: bool = False,
    room_below: float = 0.0,
) -> bool:
    """Whether the artwork, at the set's ratio, fits *window* with its caption.

    A ``dimensioned`` drawing carries the overall width dimension under it and
    the caption under that. The artwork is centred, so that caption may use
    the half of the spare height below it plus ``room_below`` (the gap the
    window leaves above the notes band), and must end clear of the band.
    """

    if art is None or scale is None or not hasattr(art, "view_height"):
        return True
    drawn_height = float(art.view_height) * scale
    if float(art.view_width) * scale > window.width:
        return False
    if dimensioned:
        hanging = DIMENSION_DEPTH + CAPTION_GAP + CAPTION_SIZE + _CAPTION_CLEAR
        return (window.height - drawn_height) / 2 + room_below >= hanging
    caption_and_clearance = 10.0
    return drawn_height + caption_and_clearance <= window.height


def _draw_board_render(
    builder: SheetBuilder,
    render: Any,
    area: Rect,
    origins: Sequence[float],
    left_width: float,
    column_gap: float,
) -> None:
    """Place the board picture in the gap the two table columns leave."""

    from app.release_studio.documents.layout import Image

    left = origins[0] + left_width + column_gap
    right = origins[-1] - column_gap
    width = right - left
    if width <= 20.0:
        return
    window = Rect(left, area.y, width, area.height)
    builder.add(
        Image(
            rect=window,
            png_bytes=render.png_bytes,
            width_px=render.width_px,
            height_px=render.height_px,
            source_digest=render.digest,
            label="board render",
        )
    )
    builder.text(
        left + width / 2,
        area.y + min(area.height, width / max(render.aspect, 0.01)) + 5.0,
        "RAYTRACED VIEW — ILLUSTRATIVE, NOT A CONTROLLED DIMENSION",
        size=2.2,
        anchor="middle",
        colour=MUTED if builder.sheet_style == PRISM_STYLE else "#555555",
    )
