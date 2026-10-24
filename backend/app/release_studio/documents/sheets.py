"""Sheet templates: cover, fabrication, assembly, drill (D5-D8).

Each function composes one sheet from projections and returns the layout model
plus, where artwork is placed, the ratio it was placed at.  No function here
reads the clock or the build id: a sheet that carried either would move for
reasons unrelated to the design, and these are released members with digests.

The date shown on a sheet is the **commit author date**, which is a property of
the revision being documented rather than of the moment it was rendered.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.release_studio.documents import tables
from app.release_studio.documents.artwork import AcquiredArtwork, dnp_style
from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY
from app.release_studio.documents.layout import (
    PRISM_SCALE_MARGIN,
    PRISM_SCALES,
    SHEET_LADDER,
    SHEET_SIZES,
    Rect,
    Sheet,
    SheetBuilder,
    TitleBlockField,
    draw_notes,
    draw_table,
    notes_height,
    preferred_scale,
    split_columns,
)
from app.release_studio.documents.sheet_notes import DEFAULT_NOTES  # noqa: F401 - re-exported
from app.release_studio.documents.sheet_drawing import (
    _DNP_LEGEND_HEIGHT,
    _DNP_SWATCH,
    _HEADING_INSET,
    _board_size,
    _draw_artwork,
    _draw_dnp_legend,
    _draw_view_direction,
    _art_fits,
    _draw_board_render,
    _drawn_width,
    _view_caption,
)
from app.release_studio.documents.style import DEFAULT_SHEET_STYLE, MUTED, PRISM_STYLE
from app.release_studio.documents.worksheet import default_worksheet_elements

#: Used only when nothing is known about the board -- a document set composed
#: without projections and without artwork has no extent to size itself from.
DEFAULT_SIZE = "A3"


# Sheet furniture geometry mirrors Monkey's public default KiCad worksheet.
# The emitted worksheet uses 10 mm margins and a title block that starts 34 mm
# inward from the bottom margin.
MARGIN = 10.0
TITLE_BLOCK_HEIGHT = 34.0
TITLE_BLOCK_WIDTH = 110.0

#: Width reserved for the table column on each sheet that has one.
TABLE_WIDTHS: dict[str, float] = {
    "fabrication": 136.0,
    "assembly": 92.0,
    "testpoint": 92.0,
    "drill": 110.0,
}

# Insets between the body and the artwork window, and the strip below it that
# carries the `SCALE 1:1` statement.
_WINDOW_INSET = 4.0
_WINDOW_TOP = 6.0
_WINDOW_BOTTOM = 14.0


def body_rect(size: str, title_height: float = TITLE_BLOCK_HEIGHT) -> Rect:
    """The drawable area of *size*: inside the frame and above the title block.

    ``title_height`` is a parameter because a configuration may add title-block
    fields, and a body computed against the default height would let the tables
    run underneath a block that grew.
    """

    width, height = SHEET_SIZES[size]
    inner = Rect(0.0, 0.0, width, height).inset(MARGIN)
    return Rect(inner.x, inner.y, inner.width, inner.height - title_height)


def artwork_window(
    size: str, table_width: float, title_height: float = TITLE_BLOCK_HEIGHT
) -> Rect:
    """Where board artwork is placed on *size*, beside a *table_width* column."""

    body = body_rect(size, title_height)
    return Rect(
        body.x + _WINDOW_INSET,
        body.y + _WINDOW_TOP,
        body.width - table_width - 3 * _WINDOW_INSET,
        body.height - _WINDOW_BOTTOM,
    )


def select_sheet_size(
    board_width: float,
    board_height: float,
    *,
    ladder: Sequence[str] = SHEET_LADDER,
    title_height: float = TITLE_BLOCK_HEIGHT,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> str:
    """The smallest standard sheet the **board** fits on at 1:1.

    Only the board decides.  Table content does not: a stackup that gained rows
    is a reason to draw the table smaller, not a reason to hand a 40 mm board a
    sheet four times the size it needs -- see `layout.fit_columns`.

    The board is measured against the *narrowest* artwork window in the set,
    in both styles, so the paper is the same one a board and its widest table
    column fit on at 1:1.  ``prism`` then chooses the *scale* against the full
    body (`set_scale`), so a board with room to spare is drawn larger on that
    paper and its tables continue on their own sheet; choosing the paper
    against the full body as well would hand the same board smaller paper at
    the same ratio, which is the opposite of the point (JTYU-OBC, 132 x 90 mm:
    A4 at 1:1 instead of A3 at 2:1).

    Nothing here is tuned to a particular board.  A 38 mm trigger board and a
    500 mm backplane land on their sheets by the same rule.
    """

    if not ladder:
        raise ValueError("the sheet ladder is empty")
    _ = sheet_style  # the paper rule is the same for both styles

    widest_table = max(TABLE_WIDTHS.values())
    for size in ladder:
        window = artwork_window(size, widest_table, title_height)
        if board_width <= window.width and board_height <= window.height:
            return size
    # Larger than A0 at 1:1: the scale ladder reduces it onto the biggest sheet
    # rather than silently overflowing a smaller one.
    return ladder[-1]


def table_area(
    size: str, table_width: float, title_height: float = TITLE_BLOCK_HEIGHT
) -> Rect:
    """The column beside the artwork window that carries this sheet's tables."""

    body = body_rect(size, title_height)
    return Rect(
        body.right - table_width - 2.0,
        body.y + _WINDOW_TOP,
        table_width,
        body.height - _WINDOW_TOP - 2.0,
    )


#: Most of the body a table column may claim.  Past this the sheet stops being
#: a drawing with a schedule beside it and becomes a schedule with a thumbnail.
_MAX_TABLE_SHARE = 0.45

#: Millimetres a table column may grow past its configured base when the board
#: leaves spare width.  Dumping all leftover body width into the schedule made
#: A3/A2 sheets carry ultra-wide empty columns while cell text still ellipsized.
_MAX_TABLE_GROWTH = 24.0


def set_scale(
    board_width: float,
    board_height: float,
    size: str,
    title_height: float = TITLE_BLOCK_HEIGHT,
    *,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> float:
    """The one placement ratio every sheet in the set is drawn at.

    A controlled drawing package where the same board measures 1:1 on the
    fabrication sheet and 2:1 on the assembly sheet is a defect: a reader who
    scales off one sheet and applies it to another gets the wrong number.  The
    ratio is chosen once for the set.  ``prism`` measures it against the full
    body -- its tables move to a continuation sheet rather than narrowing the
    art -- and searches the full ISO series with 10 mm clear inside the window.
    ``kicad`` measures against the narrowest window any sheet has, so the sheet
    with the widest table can still hold the board at the historical ratio.
    """

    if board_width <= 0 or board_height <= 0:
        return 1.0
    # `prism` chooses against the full body: its tables leave the artwork sheet
    # when they do not fit beside the drawing.  `kicad` keeps the narrowest
    # window so the sheet with the widest table can still hold the board.
    table_width = 0.0 if sheet_style == PRISM_STYLE else max(TABLE_WIDTHS.values())
    window = artwork_window(size, table_width, title_height)
    if sheet_style == PRISM_STYLE:
        return preferred_scale(
            board_width,
            board_height,
            window,
            ladder=PRISM_SCALES,
            margin=PRISM_SCALE_MARGIN,
        )
    return preferred_scale(board_width, board_height, window)


def package_scale(
    board_width: float,
    board_height: float,
    *,
    sheet_size: str | None = None,
    title_height: float = TITLE_BLOCK_HEIGHT,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[str, float]:
    """The one sheet size and placement ratio a document set is drawn at.

    Release Studio chooses both before it draws the artwork when
    ``artwork_line_weights`` is ``paper``, so the CLI can print its strokes at a
    known ratio; the document engine calls this same function.  Keeping the
    choice here is what stops a second guess from disagreeing with the sheet.

    ``sheet_size`` pins the paper when a caller already chose it; otherwise the
    smallest standard sheet that holds the board at 1:1 is used.
    """

    if sheet_size is None:
        sheet_size = (
            select_sheet_size(
                board_width,
                board_height,
                title_height=title_height,
                sheet_style=sheet_style,
            )
            if board_width > 0 and board_height > 0
            else DEFAULT_SIZE
        )
    return (
        sheet_size,
        set_scale(
            board_width,
            board_height,
            sheet_size,
            title_height,
            sheet_style=sheet_style,
        ),
    )


def sheet_columns(
    size: str,
    key: str,
    title_height: float,
    drawn_width: float,
    *,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[float, Rect, Rect]:
    """Split one sheet's body into an artwork window and a table column.

    The sheet size is chosen for the board and the scale is chosen for the set,
    so by the time this runs the artwork's drawn width is known -- and any body
    width beyond it is space the drawing has no use for.  Handing that space to
    the table column is what stops a 132 mm board from truncating a 12-layer
    stackup to "and 4 more" while two thirds of the sheet is blank.

    ``prism`` returns a zero table width when even the sheet's base column
    cannot sit beside the drawn artwork: the caller then gives the art the full
    body and carries every table to a continuation sheet.  Widening the column
    is never allowed to narrow the window below the ratio the set states.
    """

    body = body_rect(size, title_height)
    base = TABLE_WIDTHS[key]
    if drawn_width <= 0:
        # No artwork, or no ratio chosen yet: there is no known slack, and a
        # table that claimed the sheet on that basis would shrink the window
        # the ratio is about to be chosen against.
        table_width = base
    else:
        spare = body.width - (drawn_width + 2 * _WINDOW_INSET) - _WINDOW_INSET
        if sheet_style == PRISM_STYLE and spare < base:
            return (
                0.0,
                artwork_window(size, 0.0, title_height),
                Rect(0.0, 0.0, 0.0, 0.0),
            )
        table_width = max(
            base,
            min(spare, base + _MAX_TABLE_GROWTH, body.width * _MAX_TABLE_SHARE),
        )
    return (
        table_width,
        artwork_window(size, table_width, title_height),
        table_area(size, table_width, title_height),
    )


#: Height one title-block row occupies once the block's own caption is removed.
#: The block grows rather than compressing when a configuration adds fields,
#: because squeezing eight rows into thirty millimetres puts the text below the
#: ISO 3098 floor the tables are held to.
_TITLE_ROW_HEIGHT = 4.4
_TITLE_CAPTION_HEIGHT = 8.0


def _title_fields(context: Mapping[str, Any], extra: Sequence[TitleBlockField] = ()) -> list[
    TitleBlockField
]:
    fields = [
        TitleBlockField("DOCUMENT", str(context.get("document_name") or context.get("document_number") or "—")),
        TitleBlockField("REVISION", str(context.get("revision") or "—")),
        TitleBlockField("COMMIT", str(context.get("commit_sha") or "")[:12] or "—"),
        TitleBlockField("VARIANT", str(context.get("variant") or "default")),
        TitleBlockField("DATE", str(context.get("release_date") or context.get("commit_date") or "—")),
    ]
    fields.extend(extra)
    return fields


def title_block_height(
    context: Mapping[str, Any], extra: Sequence[TitleBlockField] = ()
) -> float:
    """How tall this sheet's title block has to be.

    `select_sheet_size` and `body_rect` have to agree about this number. The
    default KiCad worksheet has four comment rows; additional configured values
    are compacted into those fields, while a conservative larger body reserve
    keeps unusually rich configurations away from the worksheet furniture.
    """

    rows = len(_title_fields(context, extra))
    return max(
        TITLE_BLOCK_HEIGHT,
        _TITLE_CAPTION_HEIGHT + _TITLE_ROW_HEIGHT * max(rows, 1),
    )


def _shell(
    key: str,
    title: str,
    context: Mapping[str, Any],
    size: str,
    extra: Sequence[TitleBlockField] = (),
    *,
    typography: str = DEFAULT_TYPOGRAPHY,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[SheetBuilder, Rect]:
    builder = SheetBuilder(
        key, title, size, typography=typography, sheet_style=sheet_style
    )
    builder.extend(
        default_worksheet_elements(
            width_mm=builder.width,
            height_mm=builder.height,
            paper_name=size,
            title=title,
            key=key,
            context=context,
            extra_fields=extra,
            style=sheet_style,
        )
    )
    body = body_rect(size, title_block_height(context, extra))
    return builder, body


_TABLE_GAP = 6.0
_COVER_NOTES_HEIGHT = 26.0
_COVER_TABLE_WIDTH = 110.0
_COVER_COLUMN_GAP = 10.0


def _draw_column(builder: SheetBuilder, column: Sequence, origin: tuple[float, float]) -> float:
    """Draw a stack of tables from *origin*; return the y after the last one."""

    x, cursor = origin
    for index, table in enumerate(column):
        if index:
            cursor += _TABLE_GAP
        cursor = draw_table(builder, table, (x, cursor))
    return cursor


def _noted_window(
    size: str,
    title_height: float,
    notes: Sequence[str],
    typography: str = DEFAULT_TYPOGRAPHY,
) -> Rect:
    """The full-body artwork window, ending above the sheet's notes band.

    When a sheet's tables have moved to a continuation page its notes run
    across the foot of the body (`_draw_body_notes`); the window stops short of
    them so a drawing never runs under its own notes.
    """

    window = artwork_window(size, 0.0, title_height)
    body = body_rect(size, title_height)
    band = notes_height(notes, width=body.width - 2 * _WINDOW_INSET, typography=typography)
    return Rect(window.x, window.y, window.width, max(window.height - band - _TABLE_GAP, 1.0))


def _draw_body_notes(
    builder: SheetBuilder,
    body: Rect,
    notes: Sequence[str],
    *,
    typography: str = DEFAULT_TYPOGRAPHY,
) -> None:
    """Draw a drawing sheet's notes across the body when its tables moved away.

    With a table column the notes sit under the schedule; with none they keep
    their position at the foot of the sheet, where the reader already looks for
    them. The block is bottom-aligned so the artwork window keeps the full body.
    """

    width = body.width - 2 * _WINDOW_INSET
    height = notes_height(notes, width=width, typography=typography)
    draw_notes(
        builder,
        notes,
        (body.x + _WINDOW_INSET, body.bottom - height),
        width=width,
    )


def _lane_origins(area: Rect, lanes: Sequence[Sequence], gap: float) -> list[float]:
    """Left edge of each lane, spread across *area* rather than packed left.

    The last lane is pinned to the area's right edge and the rest are spaced
    between.  Packing them left instead left the sheet with one wide empty
    band down the right-hand side, which is the space the reader's eye goes to
    first and the reason the cover looked half-finished.

    An empty lane keeps its slot: a cover whose columns move depending on
    whether the project has tags is harder to read across a set of releases
    than one whose columns are always in the same place.
    """

    widths = [
        max((table.width() for table in lane), default=0.0) for lane in lanes
    ]
    if not widths:
        return []
    origins = [area.x] * len(widths)
    if len(widths) == 1:
        return origins

    origins[-1] = max(area.x, area.right - widths[-1])
    if len(widths) == 2:
        return origins

    # Distribute the middle lanes evenly through the space the outer two leave.
    span_start = area.x + widths[0]
    span_end = origins[-1]
    middle = widths[1:-1]
    free = span_end - span_start - sum(middle)
    step = free / (len(middle) + 1)
    cursor = span_start
    for index, width in enumerate(middle, start=1):
        cursor += max(step, gap)
        origins[index] = cursor
        cursor += width
    return origins


def technical_cover(
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    variants: Mapping[str, Any],
    members: Sequence[Mapping[str, Any]],
    *,
    size: str = DEFAULT_SIZE,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    revision_history: Sequence[Mapping[str, Any]] | None = None,
    placements: Sequence[Mapping[str, Any]] | None = None,
    render: Any = None,
    release_fields: Mapping[str, Any] | None = None,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, list]:
    """The rich cover: what this release is, and exactly what is in it.

    Returns the sheet and any table rows it could not hold, which
    :func:`continuation_sheet` carries rather than the cover dropping them.
    """

    builder, body = _shell(
        "cover",
        str(context.get("title") or "RELEASE COVER"),
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )

    # The notes run the full width of the body, so their height is measured at
    # that width and subtracted before the tables are fitted.  A flat reserve
    # is what let a long note block push itself down into the title block.
    sheet_notes = notes if notes is not None else DEFAULT_NOTES["cover"]
    body_width = body.width - 2 * _WINDOW_INSET
    reserve = notes_height(sheet_notes, width=body_width, typography=typography) + _TABLE_GAP

    area = Rect(
        body.x + _WINDOW_INSET,
        body.y + _WINDOW_TOP,
        body_width,
        body.height - _WINDOW_TOP - reserve,
    )

    # Left: what the board is and where this release sits in its history.
    # Middle: a picture of it. Right: exactly which files were released.
    facts: list = [
        tables.variant_table(variants, str(context.get("variant") or "")),
        tables.revision_history_table(revision_history or (), width=_COVER_TABLE_WIDTH),
        tables.key_value_table(
            "MANUFACTURING & ASSEMBLY SPEC",
            tables.manufacturing_spec(release_fields),
            width=_COVER_TABLE_WIDTH,
        ),
        tables.key_value_table(
            "BOARD CHARACTERISTICS",
            tables.release_board_characteristics(stats, stackup, release_fields),
            width=_COVER_TABLE_WIDTH,
        ),
        tables.key_value_table(
            "RELEASE SUMMARY",
            tables.board_summary(stats, placements=placements),
            width=_COVER_TABLE_WIDTH,
        ),
    ]

    lanes = [facts, [], [tables.member_table(members)]]
    columns, overflow, _factor = split_columns(
        lanes,
        area,
        gap=_TABLE_GAP,
        column_gap=_COVER_COLUMN_GAP,
        sheet_style=sheet_style,
    )

    origins = _lane_origins(area, columns, _COVER_COLUMN_GAP)
    for lane, origin in zip(columns, origins):
        if lane:
            _draw_column(builder, lane, (origin, area.y))

    if render is not None and len(origins) >= 3:
        # Measured, not assumed: the gap starts after the widest table actually
        # drawn in the left column, so nothing can overhang into the picture.
        left_width = max((table.width() for table in columns[0]), default=0.0)
        _draw_board_render(builder, render, area, origins, left_width, _COVER_COLUMN_GAP)

    draw_notes(
        builder,
        sheet_notes,
        (area.x, area.bottom + _TABLE_GAP),
        width=body_width,
    )
    return builder.build(), overflow


def fabrication_sheet(
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    art: AcquiredArtwork | None,
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    layer: str = "",
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, float, list]:
    """Board outline and stackup: what the fabricator needs to make the bare board.

    ``layer`` names the layer this page plots, which the stackup table marks in
    bold -- a fifteen-page document is only navigable if each page says where
    in the stack it is.

    Returns the sheet, the ratio the artwork was placed at, and any schedule
    rows the sheet could not hold, for :func:`schedule_sheet` to continue.
    """

    builder, body = _shell(
        "fabrication" if not layer else f"fabrication-{layer.replace('.', '_')}",
        "FABRICATION DRAWING" if not layer else f"FABRICATION DRAWING — {layer}",
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )
    title_height = title_block_height(context, fields)
    sheet_notes = notes if notes is not None else DEFAULT_NOTES["fabrication"]

    table_width, window, area = sheet_columns(
        size,
        "fabrication",
        title_height,
        _drawn_width(art, scale),
        sheet_style=sheet_style,
    )
    schedule = [
        tables.stackup_table(stackup, highlight=layer),
        tables.drill_table(stackup, stats),
        tables.key_value_table(
            "BOARD CHARACTERISTICS",
            tables.board_characteristics(stats, stackup),
            width=table_width or TABLE_WIDTHS["fabrication"],
        ),
    ]
    column: list[list] | None = None
    carried: list = []
    if table_width > 0:
        reserve = notes_height(
            sheet_notes, width=table_width, typography=typography
        ) + _TABLE_GAP
        column, overflow, _factor = split_columns(
            [schedule],
            Rect(area.x, area.y, area.width, area.height - reserve),
            gap=_TABLE_GAP,
            sheet_style=sheet_style,
        )
        if overflow and sheet_style == PRISM_STYLE:
            # The schedule does not fit in the column: the drawing keeps the
            # whole body and the tables continue together on their own sheet.
            table_width = 0.0
            window = artwork_window(size, 0.0, title_height)
            carried = schedule
            column = None
        else:
            carried = overflow
    else:
        carried = schedule
    notes_carried = False
    if column is None:
        noted = _noted_window(size, title_height, sheet_notes, typography)
        if _art_fits(noted, art, scale, dimensioned=True, room_below=_TABLE_GAP):
            window = noted
        else:
            # No room for the notes under the drawing at the set's ratio:
            # they continue with the tables rather than run under the art.
            notes_carried = True
            carried = [*carried, tables.notes_table(sheet_notes)]

    used = _draw_artwork(
        builder,
        window,
        art,
        label="board artwork",
        scale=scale,
        sheet_style=sheet_style,
        overall=_board_size(stats),
    )

    if column is not None:
        cursor = _draw_column(builder, column[0], (area.x, area.y))
        draw_notes(builder, sheet_notes, (area.x, cursor + _TABLE_GAP), width=table_width)
    else:
        if not notes_carried:
            _draw_body_notes(builder, body, sheet_notes, typography=typography)
    return builder.build(), used, carried


#: How many columns of tables a continuation sheet lays out across the body.
_CONTINUATION_COLUMNS = 3


def continuation_sheet(
    context: Mapping[str, Any],
    carried: Sequence,
    *,
    key: str,
    title: str,
    size: str = DEFAULT_SIZE,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, list]:
    """Continue tables that did not fit on the sheet they belong to.

    A drawing sheet gives its schedule one narrow column beside the artwork.
    This sheet has no artwork, so the same tables get the whole body across
    several columns -- which is why one continuation almost always suffices,
    and why nothing has to be dropped when it does not.
    """

    builder, body = _shell(
        key,
        title,
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )
    title_height = title_block_height(context, fields)
    body = body_rect(size, title_height)
    area = Rect(
        body.x + _WINDOW_INSET,
        body.y + _WINDOW_TOP,
        body.width - 2 * _WINDOW_INSET,
        body.height - _WINDOW_TOP - _WINDOW_INSET,
    )

    # Deal the carried tables across the columns in order, so a stackup that
    # spans two columns still reads top-to-bottom, left-to-right.
    lanes: list[list] = [[] for _ in range(_CONTINUATION_COLUMNS)]
    for position, table in enumerate(carried):
        lanes[position % _CONTINUATION_COLUMNS].append(table)

    columns, overflow, _factor = split_columns(
        lanes,
        area,
        gap=_TABLE_GAP,
        column_gap=_COVER_COLUMN_GAP,
        sheet_style=sheet_style,
    )
    cursor_x = area.x
    for lane in columns:
        if not lane:
            continue
        _draw_column(builder, lane, (cursor_x, area.y))
        cursor_x += max(table.width() for table in lane) + _COVER_COLUMN_GAP
    # A long table fills its lane and spills; the rest of the page is still
    # free, so its tail continues in the next lane here rather than on a new
    # sheet (JTYU-OBC's 81-row testpoint schedule used one lane of four).
    while overflow and cursor_x < area.right:
        free = Rect(cursor_x, area.y, area.right - cursor_x, area.height)
        placed, rest, _factor = split_columns(
            [overflow], free, gap=_TABLE_GAP, sheet_style=sheet_style
        )
        lane = placed[0] if placed else []
        if not lane or rest == overflow:
            break
        width = max(table.width() for table in lane)
        if width > free.width:
            break
        _draw_column(builder, lane, (cursor_x, area.y))
        cursor_x += width + _COVER_COLUMN_GAP
        overflow = rest
    return builder.build(), overflow


def assembly_sheet(
    context: Mapping[str, Any],
    side: str,
    art: AcquiredArtwork | None,
    placements: Sequence[Mapping[str, Any]],
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    projection_mix: Mapping[str, int] | None = None,
    population: Mapping[str, Any] | None = None,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, float, list]:
    """One assembly view, with the population count for the released variant.

    The artwork is a ``prism-kicad artwork`` assembly view rather than a plotted
    KiCad layer -- one designator per component, fitted to that component's own
    bounds, with do-not-populate parts hatched in the DNP colour -- and it is
    placed exactly as the renderer emitted it.

    When this side has do-not-populate parts, a legend under the population
    table repeats the artwork's own swatch so the hatch is decodable without
    the drawing's key.

    Returns the sheet, the ratio the artwork was placed at, and the tables that
    did not fit beside the drawing for a continuation sheet.
    """

    from app.release_studio.documents.artwork import assembly_projection_label

    label = "TOP" if side == "top" else "BOTTOM"
    builder, body = _shell(
        f"assembly-{side}",
        f"ASSEMBLY DRAWING — {label}",
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )
    title_height = title_block_height(context, fields)

    # Counts come from the board, not from the position file: that file omits
    # anything flagged "exclude from position files" -- every testpoint, on a
    # typical board -- and includes do-not-populate parts, so neither its total
    # nor its absence from it means what a reader would assume.
    counts = ((population or {}).get("sides") or {}).get(side) or {}
    in_position_file = [
        item for item in placements if str(item.get("side") or "").lower() == side
    ]
    summary_rows = [("Side", label)]
    if counts:
        summary_rows.extend(
            [
                ("Components", str(counts.get("components", 0))),
                ("To fit", str(counts.get("fitted", 0))),
                ("Do not populate", str(counts.get("dnp", 0))),
            ]
        )
        absent = int(counts.get("absent_from_position_file") or 0)
        if absent:
            summary_rows.append(("Not in position file", str(absent)))
    else:
        summary_rows.append(("In position file", str(len(in_position_file))))
    summary_rows.append(("Variant", str(context.get("variant") or "default")))
    mix = dict(projection_mix or {})
    if not mix and art is not None:
        from app.release_studio.documents.artwork import assembly_projection_mix

        mix = assembly_projection_mix(art.svg_text)
    mix_label = assembly_projection_label(mix)
    if mix_label:
        summary_rows.append(("Component outlines", mix_label))
    dense = int(counts.get("components") or 0) or len(in_position_file)
    if dense >= 400:
        summary_rows.append(
            (
                "Designator note",
                f"{dense} parts on this side — positions.csv is authoritative; "
                "detail views are not yet generated",
            )
        )
    sheet_notes = notes if notes is not None else DEFAULT_NOTES[f"assembly-{side}"]
    legend_style = dnp_style() if int(counts.get("dnp") or 0) > 0 else None
    dnp_refs = list(counts.get("dnp_refs") or ())

    table_width, window, area = sheet_columns(
        size,
        "assembly",
        title_height,
        _drawn_width(art, scale),
        sheet_style=sheet_style,
    )
    population_table = tables.key_value_table(
        "POPULATION", tuple(summary_rows), width=table_width or TABLE_WIDTHS["assembly"]
    )
    dnp_schedule = (
        tables.dnp_table(
            dnp_refs, width=table_width or TABLE_WIDTHS["assembly"]
        )
        if sheet_style == PRISM_STYLE and legend_style is not None and dnp_refs
        else None
    )
    schedule = [population_table] + ([dnp_schedule] if dnp_schedule is not None else [])
    column: list[list] | None = None
    carried: list = []
    factor = 1.0
    if table_width > 0:
        reserve = notes_height(
            sheet_notes, width=table_width, typography=typography
        ) + _TABLE_GAP
        if legend_style is not None:
            reserve += _DNP_LEGEND_HEIGHT + _TABLE_GAP
        if dnp_schedule is not None:
            reserve += dnp_schedule.height(typography, sheet_style) + _TABLE_GAP
        # The DNP list is drawn after the hatch legend below, so only the
        # population table goes in the column; both move if the column fails.
        column, overflow, factor = split_columns(
            [[population_table]],
            Rect(area.x, area.y, area.width, area.height - reserve),
            gap=_TABLE_GAP,
            sheet_style=sheet_style,
        )
        if overflow and sheet_style == PRISM_STYLE:
            table_width = 0.0
            window = artwork_window(size, 0.0, title_height)
            carried = schedule
            column = None
            factor = 1.0
        else:
            carried = overflow
    else:
        carried = schedule
    notes_carried = False
    if column is None:
        noted = _noted_window(size, title_height, sheet_notes, typography)
        if _art_fits(noted, art, scale):
            window = noted
        else:
            # No room for the notes under the drawing at the set's ratio:
            # they continue with the tables rather than run under the art.
            notes_carried = True
            carried = [*carried, tables.notes_table(sheet_notes)]

    used = _draw_artwork(
        builder,
        window,
        art,
        label="assembly artwork",
        scale=scale,
        sheet_style=sheet_style,
        view_caption=_view_caption(side),
    )
    _draw_view_direction(builder, window, side)

    # The legend and the DNP list follow the population table at its scale, so
    # the column reads as one block of one text size.
    prism_scale = factor if sheet_style == PRISM_STYLE else 1.0
    if column is not None:
        cursor = _draw_column(builder, column[0], (area.x, area.y))
        if legend_style is not None:
            # ``prism``: the swatch's top sits where a heading's capitals would,
            # so table → legend → heading are the same visual gap apart.
            legend_top = cursor + _TABLE_GAP + (
                _HEADING_INSET if sheet_style == PRISM_STYLE else 0.0
            )
            _draw_dnp_legend(
                builder,
                (area.x, legend_top),
                width=table_width,
                style=legend_style,
                scale=prism_scale,
            )
            cursor = legend_top + (
                _DNP_SWATCH * prism_scale
                if sheet_style == PRISM_STYLE
                else _DNP_LEGEND_HEIGHT
            )
        if dnp_schedule is not None:
            cursor = draw_table(
                builder, dnp_schedule.scaled(prism_scale), (area.x, cursor + _TABLE_GAP)
            )
        draw_notes(builder, sheet_notes, (area.x, cursor + _TABLE_GAP), width=table_width)
    else:
        # The schedule moved away, but the hatch still needs its key on the
        # drawing: put it in the window's own bottom margin, clear of the art.
        if legend_style is not None:
            _draw_dnp_legend(
                builder,
                (window.x + _WINDOW_INSET, window.bottom - _DNP_LEGEND_HEIGHT),
                width=window.width - 2 * _WINDOW_INSET,
                style=legend_style,
            )
        if not notes_carried:
            _draw_body_notes(builder, body, sheet_notes, typography=typography)
    return builder.build(), used, carried


def testpoint_sheet(
    context: Mapping[str, Any],
    side: str,
    art: AcquiredArtwork | None,
    testpoints: Mapping[str, Any],
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, float, list]:
    """One side of the board with only its testpoints labelled.

    The artwork is a ``prism-kicad artwork`` testpoint view: the configuration's
    ``TP*`` designator selector draws only those footprints, so a probe target
    is not competing with hundreds of assembly outlines or labels. The schedule
    beside it gives each testpoint's board position and net, which is what makes
    the sheet usable at a bench rather than only pretty.
    """

    label = "TOP" if side == "top" else "BOTTOM"
    builder, body = _shell(
        f"testpoint-{side}",
        f"TESTPOINT DRAWING — {label}",
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )
    title_height = title_block_height(context, fields)

    found = tables.testpoints_for_side(testpoints, side)
    table_width, window, area = sheet_columns(
        size,
        "testpoint",
        title_height,
        _drawn_width(art, scale),
        sheet_style=sheet_style,
    )
    summary = tables.key_value_table(
        "TESTPOINTS",
        (
            ("Side", label),
            ("Testpoints", str(len(found))),
            ("Variant", str(context.get("variant") or "default")),
        ),
        width=table_width or TABLE_WIDTHS["testpoint"],
    )
    schedule = tables.testpoint_table(
        testpoints,
        side,
        width=table_width or TABLE_WIDTHS["testpoint"],
        typography=typography,
    )

    sheet_notes = notes if notes is not None else DEFAULT_NOTES[f"testpoint-{side}"]
    column: list[list] | None = None
    carried: list = []
    if table_width > 0:
        reserve = notes_height(
            sheet_notes, width=table_width, typography=typography
        ) + _TABLE_GAP
        column, overflow, _factor = split_columns(
            [[summary, schedule]],
            Rect(area.x, area.y, area.width, area.height - reserve),
            gap=_TABLE_GAP,
            sheet_style=sheet_style,
        )
        if overflow and sheet_style == PRISM_STYLE:
            table_width = 0.0
            window = artwork_window(size, 0.0, title_height)
            carried = [summary, schedule]
            column = None
        else:
            carried = overflow
    else:
        carried = [summary, schedule]
    notes_carried = False
    if column is None:
        noted = _noted_window(size, title_height, sheet_notes, typography)
        if _art_fits(noted, art, scale):
            window = noted
        else:
            # No room for the notes under the drawing at the set's ratio:
            # they continue with the tables rather than run under the art.
            notes_carried = True
            carried = [*carried, tables.notes_table(sheet_notes)]

    used = _draw_artwork(
        builder,
        window,
        art,
        label="testpoint artwork",
        scale=scale,
        sheet_style=sheet_style,
        view_caption=_view_caption(side),
    )
    _draw_view_direction(builder, window, side)

    if column is not None:
        cursor = _draw_column(builder, column[0], (area.x, area.y))
        draw_notes(builder, sheet_notes, (area.x, cursor + _TABLE_GAP), width=table_width)
    else:
        if not notes_carried:
            _draw_body_notes(builder, body, sheet_notes, typography=typography)
    return builder.build(), used, carried


def drill_sheet(
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    art: AcquiredArtwork | None,
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
    sheet_style: str = DEFAULT_SHEET_STYLE,
) -> tuple[Sheet, float, list]:
    """The drill drawing: hole map alongside the drill schedule.

    Returns the sheet, the placement ratio, and any schedule rows that did not
    fit, which continue on their own sheet rather than being dropped.
    """

    builder, body = _shell(
        "drill",
        "DRILL DRAWING",
        context,
        size,
        fields,
        typography=typography,
        sheet_style=sheet_style,
    )
    title_height = title_block_height(context, fields)

    table_width, window, area = sheet_columns(
        size,
        "drill",
        title_height,
        _drawn_width(art, scale),
        sheet_style=sheet_style,
    )
    schedule = [
        tables.via_statistics_table(stackup),
        tables.drill_table(stackup, stats),
    ]
    sheet_notes = notes if notes is not None else DEFAULT_NOTES["drill"]
    column: list[list] | None = None
    carried: list = []
    if table_width > 0:
        reserve = notes_height(
            sheet_notes, width=table_width, typography=typography
        ) + _TABLE_GAP
        column, overflow, _factor = split_columns(
            [schedule],
            Rect(area.x, area.y, area.width, area.height - reserve),
            gap=_TABLE_GAP,
            sheet_style=sheet_style,
        )
        if overflow and sheet_style == PRISM_STYLE:
            table_width = 0.0
            window = artwork_window(size, 0.0, title_height)
            carried = schedule
            column = None
        else:
            carried = overflow
    else:
        carried = schedule
    notes_carried = False
    if column is None:
        noted = _noted_window(size, title_height, sheet_notes, typography)
        if _art_fits(noted, art, scale):
            window = noted
        else:
            # No room for the notes under the drawing at the set's ratio:
            # they continue with the tables rather than run under the art.
            notes_carried = True
            carried = [*carried, tables.notes_table(sheet_notes)]

    used = _draw_artwork(
        builder,
        window,
        art,
        label="drill artwork",
        scale=scale,
        sheet_style=sheet_style,
    )

    if column is not None:
        cursor = _draw_column(builder, column[0], (area.x, area.y))
        draw_notes(builder, sheet_notes, (area.x, cursor + _TABLE_GAP), width=table_width)
    else:
        if not notes_carried:
            _draw_body_notes(builder, body, sheet_notes, typography=typography)
    return builder.build(), used, carried
