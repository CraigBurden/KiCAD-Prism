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
from app.release_studio.documents.layout import (
    SHEET_LADDER,
    SHEET_SIZES,
    Rect,
    Sheet,
    SheetBuilder,
    TitleBlockField,
    draw_frame,
    draw_notes,
    draw_table,
    draw_title_block,
    preferred_scale,
)

#: Used only when nothing is known about the board -- a document set composed
#: without projections and without artwork has no extent to size itself from.
DEFAULT_SIZE = "A3"

# Sheet furniture geometry.  These are the numbers `draw_frame` and
# `draw_title_block` are called with below; they live here as named constants
# because `select_sheet_size` has to predict the usable area of a sheet it has
# not drawn yet, and two independent copies of that arithmetic would eventually
# disagree.
MARGIN = 10.0
TITLE_BLOCK_HEIGHT = 30.0
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


def body_rect(size: str) -> Rect:
    """The drawable area of *size*: inside the frame and above the title block."""

    width, height = SHEET_SIZES[size]
    inner = Rect(0.0, 0.0, width, height).inset(MARGIN)
    return Rect(inner.x, inner.y, inner.width, inner.height - TITLE_BLOCK_HEIGHT)


def artwork_window(size: str, table_width: float) -> Rect:
    """Where board artwork is placed on *size*, beside a *table_width* column."""

    body = body_rect(size)
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
    table_height: float = 0.0,
    table_width: float = 0.0,
    ladder: Sequence[str] = SHEET_LADDER,
) -> str:
    """The smallest standard sheet this drawing fits on.

    Three things have to fit, and any of them can be the binding constraint:
    the board at 1:1 in the artwork window, the tallest table column, and the
    widest table row.  The board is measured against the *narrowest* window in
    the set so that one size serves every sheet -- a document set whose pages
    are different sizes is a nuisance to print and to file.

    Nothing here is tuned to a particular board.  A 38 mm trigger board and a
    500 mm backplane land on their sheets by the same rule.
    """

    if not ladder:
        raise ValueError("the sheet ladder is empty")

    widest_table = max(TABLE_WIDTHS.values())
    for size in ladder:
        window = artwork_window(size, widest_table)
        body = body_rect(size)
        if (
            board_width <= window.width
            and board_height <= window.height
            and table_height <= body.height
            and table_width <= body.width
        ):
            return size
    # Larger than A0 at 1:1: the scale ladder reduces it onto the biggest sheet
    # rather than silently overflowing a smaller one.
    return ladder[-1]


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


def _shell(key: str, title: str, context: Mapping[str, Any], size: str,
           extra: Sequence[TitleBlockField] = ()) -> tuple[SheetBuilder, Rect]:
    builder = SheetBuilder(key, title, size)
    inner = draw_frame(builder, margin=MARGIN)
    body = draw_title_block(
        builder, inner, title=title, fields=_title_fields(context, extra),
        height=TITLE_BLOCK_HEIGHT, width=TITLE_BLOCK_WIDTH,
    )
    return builder, body


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


def required_table_height(
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    variants: Mapping[str, Any],
    members: Sequence[Mapping[str, Any]],
    selected_variant: str = "",
) -> float:
    """Body height the tallest table column in the set needs.

    A twelve-layer stackup or a hundred-member dossier can be the reason a
    sheet has to grow, not just a large board -- so sheet selection asks for
    this alongside the board extent rather than assuming content always fits.
    """

    def column(*heights: float) -> float:
        return sum(heights) + _TABLE_GAP * len(heights) + _WINDOW_TOP

    fabrication = column(
        tables.stackup_table(stackup).height(),
        tables.drill_table(stackup, stats).height(),
        tables.key_value_table(
            "CHARACTERISTICS",
            tables.board_characteristics(stats, stackup),
            width=TABLE_WIDTHS["fabrication"],
        ).height(),
    )
    cover_left = column(
        tables.key_value_table(
            "BOARD CHARACTERISTICS",
            tables.board_characteristics(stats, stackup),
            width=_COVER_TABLE_WIDTH,
        ).height(),
        tables.variant_table(variants, selected_variant).height(),
    )
    cover_right = column(tables.member_table(members).height())
    # The cover's notes are anchored to the bottom of the body, so the tables
    # have to finish above them.
    cover = max(cover_left, cover_right) + _COVER_NOTES_HEIGHT
    return max(fabrication, cover)


#: Horizontal offset of the cover's right-hand column from its left column.
_COVER_COLUMN_SPLIT = 130.0
#: Narrowest artwork window worth placing a board in.
_MIN_ARTWORK_WIDTH = 60.0


def required_body_width(members: Sequence[Mapping[str, Any]]) -> float:
    """Body width the widest sheet in the set needs.

    The cover's member table is the usual reason a set cannot sit on A4: its
    columns are sized for a path, a canonicalizer name, and a digest prefix.
    Deriving the requirement from the table rather than asserting a minimum
    size means a narrower cover would reach A4 on its own.
    """

    cover = (
        _WINDOW_INSET
        + _COVER_COLUMN_SPLIT
        + sum(tables.member_table(members).widths)
        + _WINDOW_INSET
    )
    artwork = max(TABLE_WIDTHS.values()) + 3 * _WINDOW_INSET + _MIN_ARTWORK_WIDTH
    return max(cover, artwork)


def technical_cover(
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    variants: Mapping[str, Any],
    members: Sequence[Mapping[str, Any]],
    *,
    size: str = DEFAULT_SIZE,
) -> Sheet:
    """The rich cover: what this release is, and exactly what is in it."""

    builder, body = _shell("cover", str(context.get("title") or "RELEASE COVER"), context, size)

    left = body.x + 4.0
    top = body.y + 6.0

    cursor = draw_table(
        builder,
        tables.key_value_table(
            "BOARD CHARACTERISTICS", tables.board_characteristics(stats, stackup), width=120.0
        ),
        (left, top),
    )
    cursor = draw_table(builder, tables.variant_table(variants, str(context.get("variant") or "")),
                        (left, cursor + 6.0))

    right = left + 130.0
    draw_table(builder, tables.member_table(members), (right, top))

    draw_notes(
        builder,
        [
            "The files listed above are the released bytes. Their SHA-256 digests "
            "are recorded in the dossier manifest and are reproducible from the "
            "commit named in the title block.",
            "This sheet is generated from the board and schematic at that commit. "
            "It carries no build time and no approver, so re-rendering it cannot "
            "change its digest.",
        ],
        (left, body.bottom - 26.0),
        width=body.width - 8.0,
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
) -> tuple[Sheet, float]:
    """Board outline and stackup: what the fabricator needs to make the bare board."""

    builder, body = _shell("fabrication", "FABRICATION DRAWING", context, size)

    table_width = TABLE_WIDTHS["fabrication"]
    window = artwork_window(size, table_width)
    used = _draw_artwork(builder, window, art, label="board artwork", scale=scale)

    right = body.right - table_width - 2.0
    cursor = draw_table(builder, tables.stackup_table(stackup), (right, body.y + 6.0))
    cursor = draw_table(builder, tables.drill_table(stackup, stats), (right, cursor + 6.0))
    draw_table(
        builder,
        tables.key_value_table(
            "CHARACTERISTICS", tables.board_characteristics(stats, stackup), width=table_width
        ),
        (right, cursor + 6.0),
    )
    return builder.build(), used


def assembly_sheet(
    context: Mapping[str, Any],
    side: str,
    art: AcquiredArtwork | None,
    placements: Sequence[Mapping[str, Any]],
    *,
    size: str = DEFAULT_SIZE,
    scale: float | None = None,
) -> tuple[Sheet, float]:
    """One assembly view, with the population count for the released variant."""

    label = "TOP" if side == "top" else "BOTTOM"
    builder, body = _shell(
        f"assembly-{side}", f"ASSEMBLY DRAWING — {label}", context, size
    )

    table_width = TABLE_WIDTHS["assembly"]
    window = artwork_window(size, table_width)
    used = _draw_artwork(builder, window, art, label="assembly artwork", scale=scale)

    fitted = [item for item in placements if str(item.get("side") or "").lower() == side]
    summary = (
        ("Side", label),
        ("Placements", str(len(fitted))),
        ("Variant", str(context.get("variant") or "default")),
    )
    right = body.right - table_width - 2.0
    cursor = draw_table(
        builder, tables.key_value_table("POPULATION", summary, width=table_width),
        (right, body.y + 6.0),
    )
    draw_notes(
        builder,
        [
            "Reference designators follow the position file in this dossier.",
            "Do-not-populate parts are excluded from the placement count above.",
        ],
        (right, cursor + 6.0),
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
) -> tuple[Sheet, float]:
    """The drill drawing: hole map alongside the drill schedule."""

    builder, body = _shell("drill", "DRILL DRAWING", context, size)

    table_width = TABLE_WIDTHS["drill"]
    window = artwork_window(size, table_width)
    used = _draw_artwork(builder, window, art, label="drill artwork", scale=scale)

    right = body.right - table_width - 2.0
    cursor = draw_table(builder, tables.drill_table(stackup, stats), (right, body.y + 6.0))
    draw_notes(
        builder,
        [
            "Hole sizes are finished diameters unless a tolerance is stated.",
            "The Excellon file in this dossier is authoritative; this sheet is a view of it.",
        ],
        (right, cursor + 6.0),
        width=table_width,
    )
    return builder.build(), used
