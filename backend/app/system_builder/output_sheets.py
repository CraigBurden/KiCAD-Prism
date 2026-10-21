"""Table pages shared by the harness document and the ICD.

Both documents continue their tables over as many A3 sheets as they need: the
same usable area, the same scale search, the same continuation. Only the title
block's fields differ, so each document draws its own.
"""

from __future__ import annotations

from typing import Sequence

from app.release_studio.documents.layout import (
    Rect,
    SHEET_SIZES,
    SheetBuilder,
    Table,
    draw_table,
)

#: The title block's width and height, in millimetres.
TITLE_BLOCK = (110.0, 30.0)
#: The top of a table page, below the frame's top edge.
TABLE_TOP = 8.0
#: A malformed document must not spin forever.
MAX_TABLE_PAGES = 50


def table_area(size: str = "A3", *, top: float = TABLE_TOP) -> Rect:
    """The usable table area of one sheet, above the title block."""

    width, height = SHEET_SIZES[size]
    inner = Rect(0, 0, width, height).inset(10.0)
    return Rect(
        inner.x + 6,
        inner.y + top,
        inner.width - 12,
        inner.height - top - TITLE_BLOCK[1] - 6,
    )


#: A table drawn at its place on a sheet: (table, x, y).
Placed = tuple[Table, float, float]


def paginate_tables(
    tables: Sequence[Table],
    area: Rect,
    *,
    gap: float = 6.0,
    column_gap: float = 10.0,
    max_pages: int = MAX_TABLE_PAGES,
    first: Rect | None = None,
) -> list[list[Placed]]:
    """The tables as they fall on sheets, at full size.

    Unlike a drawing's tables (which shrink to the legibility floor to stay on
    the sheet the drawing earned), a schedule keeps its text size: tables flow
    down as many columns as fit across the area, a table that reaches a
    column's foot continues at the top of the next (marked continued), and a
    full sheet continues on another. Only a table wider than the area shrinks,
    to its width. ``first``, when given, is the first sheet's area (what is
    left under a summary); later sheets use ``area``.
    """

    if not tables:
        return []
    widest = max(table.width() for table in tables)
    factor = min(1.0, area.width / widest) if widest > 0 else 1.0
    pending = [table.scaled(factor) for table in tables]
    column = max(table.width() for table in pending)
    columns = max(1, int((area.width + column_gap) // (column + column_gap)))
    pages: list[list[Placed]] = []
    page: list[Placed] = []
    here = first or area
    index, y = 0, here.y
    while pending and len(pages) < max_pages:
        table = pending.pop(0)
        head, tail = table.split(here.bottom - y)
        if head is None and y == here.y and here is area:  # not one row fits even an empty column
            head, tail = table, None
        if head is not None:
            page.append((head, area.x + index * (column + column_gap), y))
            y += head.height() + gap
        if head is None or tail is not None:
            pending.insert(0, tail if tail is not None else table)
            index, y = index + 1, here.y
            if index == columns:
                pages.append(page)
                page, index, here = [], 0, area
                y = here.y
    if page:
        pages.append(page)
    return pages


def draw_placed(builder: SheetBuilder, page: Sequence[Placed]) -> None:
    for table, x, y in page:
        draw_table(builder, table, (x, y))
