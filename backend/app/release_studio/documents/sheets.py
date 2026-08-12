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
from app.release_studio.documents.artwork import AcquiredArtwork, place, scale_label
from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY
from app.release_studio.documents.layout import (
    SHEET_LADDER,
    SHEET_SIZES,
    Rect,
    Sheet,
    SheetBuilder,
    TitleBlockField,
    draw_notes,
    draw_table,
    fit_columns,
    preferred_scale,
)
from app.release_studio.documents.vector import (
    VectorDrawing,
    clip,
    drop_illegible_text,
)
from app.release_studio.documents.worksheet import default_worksheet_elements

#: Used only when nothing is known about the board -- a document set composed
#: without projections and without artwork has no extent to size itself from.
DEFAULT_SIZE = "A3"

#: The note block each sheet carries when the configuration declares none.
#:
#: These are the statements Prism can make on its own authority: what the
#: released bytes are, which file governs, and what the drawing is a view of.
#: Anything that depends on the issuing organization -- IPC class, coupon
#: requirements, impedance tolerances -- is deliberately absent, because Prism
#: does not know it and a plausible-looking default would be worse than none.
#: `documents.notes.resolve_notes` replaces any of these from configuration.
DEFAULT_NOTES: dict[str, tuple[str, ...]] = {
    "cover": (
        # Deliberately not "the files listed above are the released bytes":
        # this sheet is itself a released member, and it is composed before the
        # other documentation members exist, so it can never list all of them.
        # A recipient reconciling the list against the dossier would find
        # extras and reasonably conclude the release had been tampered with.
        "The files listed above are released members produced before this "
        "sheet. manifest.json in this dossier lists the complete set, "
        "including the documentation sheets, with the SHA-256 digest of each.",
        "This sheet is generated from the board and schematic at the commit "
        "named in the title block. It carries no build time and no approver, "
        "so re-rendering it cannot change its digest.",
    ),
    "fabrication": (
        "The Gerber and Excellon files in this dossier are authoritative; this "
        "sheet is a view of them.",
        "Dimensions are in millimetres. The stated scale is the ratio the "
        "artwork was placed at.",
    ),
    "assembly-top": (
        "Reference designators follow the position file in this dossier.",
        "Do-not-populate parts are excluded from the placement count above.",
    ),
    "assembly-bottom": (
        "Reference designators follow the position file in this dossier.",
        "Do-not-populate parts are excluded from the placement count above.",
    ),
    "drill": (
        "Hole sizes are finished diameters unless a tolerance is stated.",
        "The Excellon file in this dossier is authoritative; this sheet is a view of it.",
    ),
}

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
) -> str:
    """The smallest standard sheet the **board** fits on at 1:1.

    Only the board decides.  Table content does not: a stackup that gained rows
    is a reason to draw the table smaller, not a reason to hand a 40 mm board a
    sheet four times the size it needs -- see `layout.fit_columns`.

    The board is measured against the *narrowest* artwork window in the set so
    that one size serves every sheet; a document set whose pages are different
    sizes is a nuisance to print and to file.

    Nothing here is tuned to a particular board.  A 38 mm trigger board and a
    500 mm backplane land on their sheets by the same rule.
    """

    if not ladder:
        raise ValueError("the sheet ladder is empty")

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


#: Smallest a reference designator may be drawn on a released sheet.
#:
#: Below this it is not small lettering, it is a smudge -- and a smudge on a
#: controlled drawing is worse than a blank, because it looks like data the
#: reader failed to see.  Set lower than `layout.MIN_TABLE_FONT` because an
#: assembly designator is read against the board in hand, often under
#: magnification, while a table is read as prose.
MIN_DESIGNATOR_HEIGHT = 1.0

#: Most of the body a table column may claim.  Past this the sheet stops being
#: a drawing with a schedule beside it and becomes a schedule with a thumbnail.
_MAX_TABLE_SHARE = 0.55


def set_scale(
    board_width: float,
    board_height: float,
    size: str,
    title_height: float = TITLE_BLOCK_HEIGHT,
) -> float:
    """The one placement ratio every sheet in the set is drawn at.

    A controlled drawing package where the same board measures 1:1 on the
    fabrication sheet and 2:1 on the assembly sheet is a defect: a reader who
    scales off one sheet and applies it to another gets the wrong number.  The
    ratio is chosen once, against the *narrowest* window any sheet has, so the
    sheet with the widest table can still hold the board at it.
    """

    if board_width <= 0 or board_height <= 0:
        return 1.0
    window = artwork_window(size, max(TABLE_WIDTHS.values()), title_height)
    return preferred_scale(board_width, board_height, window)


def sheet_columns(
    size: str,
    key: str,
    title_height: float,
    drawn_width: float,
) -> tuple[float, Rect, Rect]:
    """Split one sheet's body into an artwork window and a table column.

    The sheet size is chosen for the board and the scale is chosen for the set,
    so by the time this runs the artwork's drawn width is known -- and any body
    width beyond it is space the drawing has no use for.  Handing that space to
    the table column is what stops a 132 mm board from truncating a 12-layer
    stackup to "and 4 more" while two thirds of the sheet is blank.
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
        table_width = max(base, min(spare, body.width * _MAX_TABLE_SHARE))
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
        TitleBlockField("DOCUMENT", str(context.get("document_number") or "—")),
        TitleBlockField("REVISION", str(context.get("revision") or "—")),
        TitleBlockField("COMMIT", str(context.get("commit_sha") or "")[:12] or "—"),
        TitleBlockField("VARIANT", str(context.get("variant") or "default")),
        TitleBlockField("DATE", str(context.get("commit_date") or "—")),
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
) -> tuple[SheetBuilder, Rect]:
    builder = SheetBuilder(key, title, size, typography=typography)
    builder.extend(
        default_worksheet_elements(
            width_mm=builder.width,
            height_mm=builder.height,
            paper_name=size,
            title=title,
            key=key,
            context=context,
            extra_fields=extra,
        )
    )
    body = body_rect(size, title_block_height(context, extra))
    return builder, body


def _drawn_width(art: AcquiredArtwork | VectorDrawing | None, scale: float | None) -> float:
    """How wide the artwork will actually be drawn, in sheet millimetres.

    Zero when there is nothing to draw or no ratio yet, which leaves the table
    column at its configured width rather than letting it claim the sheet.
    """

    if art is None or scale is None:
        return 0.0
    return max(0.0, float(art.view_width) * scale)


def _draw_vector(
    builder: SheetBuilder,
    window: Rect,
    drawing: VectorDrawing | None,
    *,
    label: str,
    scale: float | None,
) -> tuple[float, int]:
    """Place an ingested vector drawing; return its ratio and what it dropped.

    Same contract as `_draw_artwork`, for artwork that arrives as primitives
    rather than as an opaque block: the sheet is one model, so the SVG and PDF
    renderings of this drawing cannot diverge.
    """

    if drawing is None or not drawing.elements:
        return _draw_missing(builder, window, label), 0

    if scale is None:
        scale = preferred_scale(drawing.view_width, drawing.view_height, window)
    placed, illegible = drop_illegible_text(
        drawing.placed(window, scale), MIN_DESIGNATOR_HEIGHT
    )
    builder.extend(clip(placed, window))
    builder.text(
        window.x, window.bottom + 4.0, f"SCALE {scale_label(scale)}", size=2.8, bold=True
    )
    return scale, illegible


def _draw_missing(builder: SheetBuilder, window: Rect, label: str) -> float:
    """State the absence where artwork would be, rather than leaving a gap."""

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


def _draw_artwork(
    builder: SheetBuilder,
    window: Rect,
    art: AcquiredArtwork | None,
    *,
    label: str,
    scale: float | None,
) -> float:
    """Place *art* in *window* at a stated ratio; return the ratio used.

    With no ``scale`` given the placement is quantized to a preferred drawing
    ratio rather than shrunk to fit exactly, because the number printed under
    the window is meant to be measured against.
    """

    if art is None:
        return _draw_missing(builder, window, label)

    if scale is None:
        scale = preferred_scale(art.view_width, art.view_height, window)
    element, used = place(art, window, scale=scale, label=label)
    builder.add(element)
    builder.text(
        window.x, window.bottom + 4.0, f"SCALE {scale_label(used)}", size=2.8, bold=True
    )
    return used


#: Vertical gap left between stacked tables, and the cover's bottom note block.
_TABLE_GAP = 6.0
_COVER_NOTES_HEIGHT = 26.0
_COVER_TABLE_WIDTH = 120.0
_COVER_COLUMN_GAP = 10.0
#: Space kept below a sheet's tables for its note block.
_NOTES_RESERVE = 30.0


def _draw_column(builder: SheetBuilder, column: Sequence, origin: tuple[float, float]) -> float:
    """Draw a stack of tables from *origin*; return the y after the last one."""

    x, cursor = origin
    for index, table in enumerate(column):
        if index:
            cursor += _TABLE_GAP
        cursor = draw_table(builder, table, (x, cursor))
    return cursor


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
) -> Sheet:
    """The rich cover: what this release is, and exactly what is in it."""

    builder, body = _shell(
        "cover",
        str(context.get("title") or "RELEASE COVER"),
        context,
        size,
        fields,
        typography=typography,
    )

    area = Rect(
        body.x + _WINDOW_INSET,
        body.y + _WINDOW_TOP,
        body.width - 2 * _WINDOW_INSET,
        body.height - _WINDOW_TOP - _COVER_NOTES_HEIGHT,
    )
    columns, _factor = fit_columns(
        [
            [
                tables.key_value_table(
                    "BOARD CHARACTERISTICS",
                    tables.board_characteristics(stats, stackup),
                    width=_COVER_TABLE_WIDTH,
                ),
                tables.key_value_table(
                    "RELEASE SUMMARY",
                    tables.board_summary(stats),
                    width=_COVER_TABLE_WIDTH,
                ),
                tables.variant_table(variants, str(context.get("variant") or "")),
            ],
            [tables.member_table(members)],
        ],
        area,
        gap=_TABLE_GAP,
        column_gap=_COVER_COLUMN_GAP,
    )

    _draw_column(builder, columns[0], (area.x, area.y))
    left_width = max((table.width() for table in columns[0]), default=0.0)
    _draw_column(builder, columns[1], (area.x + left_width + _COVER_COLUMN_GAP, area.y))

    draw_notes(
        builder,
        notes if notes is not None else DEFAULT_NOTES["cover"],
        (area.x, body.bottom - _COVER_NOTES_HEIGHT),
        width=body.width - 2 * _WINDOW_INSET,
    )
    return builder.build()


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
) -> tuple[Sheet, float]:
    """Board outline and stackup: what the fabricator needs to make the bare board."""

    builder, body = _shell(
        "fabrication",
        "FABRICATION DRAWING",
        context,
        size,
        fields,
        typography=typography,
    )
    title_height = title_block_height(context, fields)

    table_width, window, area = sheet_columns(
        size, "fabrication", title_height, _drawn_width(art, scale)
    )
    used = _draw_artwork(builder, window, art, label="board artwork", scale=scale)

    column, _factor = fit_columns(
        [[
            tables.stackup_table(stackup),
            tables.drill_table(stackup, stats),
            tables.key_value_table(
                "BOARD CHARACTERISTICS",
                tables.board_characteristics(stats, stackup),
                width=table_width,
            ),
        ]],
        Rect(area.x, area.y, area.width, area.height - _NOTES_RESERVE),
        gap=_TABLE_GAP,
    )
    cursor = _draw_column(builder, column[0], (area.x, area.y))
    draw_notes(
        builder,
        notes if notes is not None else DEFAULT_NOTES["fabrication"],
        (area.x, cursor + _TABLE_GAP),
        width=table_width,
    )
    return builder.build(), used


def assembly_sheet(
    context: Mapping[str, Any],
    side: str,
    art: VectorDrawing | None,
    placements: Sequence[Mapping[str, Any]],
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
    notes: Sequence[str] | None = None,
    fields: Sequence[TitleBlockField] = (),
    typography: str = DEFAULT_TYPOGRAPHY,
) -> tuple[Sheet, float]:
    """One assembly view, with the population count for the released variant.

    The artwork is a Cruncher assembly view ingested into the layout model, not
    a plotted KiCad layer: one designator per component, fitted to that
    component's own bounds.  See `documents.vector` for why it is ingested
    rather than placed as an opaque block.
    """

    label = "TOP" if side == "top" else "BOTTOM"
    builder, body = _shell(
        f"assembly-{side}",
        f"ASSEMBLY DRAWING — {label}",
        context,
        size,
        fields,
        typography=typography,
    )
    title_height = title_block_height(context, fields)

    table_width, window, area = sheet_columns(
        size, "assembly", title_height, _drawn_width(art, scale)
    )
    used, illegible = _draw_vector(
        builder, window, art, label="assembly artwork", scale=scale
    )

    fitted = [item for item in placements if str(item.get("side") or "").lower() == side]
    summary = [
        ("Side", label),
        ("Placements", str(len(fitted))),
        ("Variant", str(context.get("variant") or "default")),
    ]
    if illegible:
        # Stated, not hidden. A designator drawn at 0.16 mm is a smudge, and a
        # smudge makes the drawing look as though it carries data the reader
        # merely failed to see.
        summary.append(("Designators omitted", str(illegible)))
    summary_rows = tuple(summary)
    column, _factor = fit_columns(
        [[tables.key_value_table("POPULATION", summary_rows, width=table_width)]],
        Rect(area.x, area.y, area.width, area.height - _NOTES_RESERVE),
        gap=_TABLE_GAP,
    )
    cursor = _draw_column(builder, column[0], (area.x, area.y))
    draw_notes(
        builder,
        notes if notes is not None else DEFAULT_NOTES[f"assembly-{side}"],
        (area.x, cursor + _TABLE_GAP),
        width=table_width,
    )
    return builder.build(), used


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
) -> tuple[Sheet, float]:
    """The drill drawing: hole map alongside the drill schedule."""

    builder, body = _shell(
        "drill", "DRILL DRAWING", context, size, fields, typography=typography
    )
    title_height = title_block_height(context, fields)

    table_width, window, area = sheet_columns(
        size, "drill", title_height, _drawn_width(art, scale)
    )
    used = _draw_artwork(builder, window, art, label="drill artwork", scale=scale)

    column, _factor = fit_columns(
        [[tables.drill_table(stackup, stats)]],
        Rect(area.x, area.y, area.width, area.height - _NOTES_RESERVE),
        gap=_TABLE_GAP,
    )
    cursor = _draw_column(builder, column[0], (area.x, area.y))
    draw_notes(
        builder,
        notes if notes is not None else DEFAULT_NOTES["drill"],
        (area.x, cursor + _TABLE_GAP),
        width=table_width,
    )
    return builder.build(), used
