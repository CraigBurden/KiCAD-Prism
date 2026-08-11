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
    Rect,
    Sheet,
    SheetBuilder,
    TitleBlockField,
    draw_frame,
    draw_notes,
    draw_table,
    draw_title_block,
)

DEFAULT_SIZE = "A3"


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
    inner = draw_frame(builder)
    body = draw_title_block(
        builder, inner, title=title, fields=_title_fields(context, extra)
    )
    return builder, body


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

    table_width = 136.0
    window = Rect(body.x + 4.0, body.y + 6.0, body.width - table_width - 12.0, body.height - 14.0)

    used = 1.0
    if art is not None:
        element, used = place(art, window, scale=scale, label="board outline")
        builder.add(element)
        builder.text(
            window.x,
            window.bottom + 4.0,
            f"SCALE {scale_label(used)}",
            size=2.8,
            bold=True,
        )
    else:
        builder.rect(window, width=0.2, colour="#999999")
        builder.text(
            window.x + window.width / 2,
            window.y + window.height / 2,
            "board artwork unavailable",
            size=3.0,
            anchor="middle",
            colour="#999999",
        )

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

    table_width = 92.0
    window = Rect(body.x + 4.0, body.y + 6.0, body.width - table_width - 12.0, body.height - 14.0)

    used = 1.0
    if art is not None:
        element, used = place(art, window, scale=scale, label=f"assembly {side}")
        builder.add(element)
        builder.text(
            window.x, window.bottom + 4.0, f"SCALE {scale_label(used)}", size=2.8, bold=True
        )
    else:
        builder.rect(window, width=0.2, colour="#999999")
        builder.text(
            window.x + window.width / 2,
            window.y + window.height / 2,
            "assembly artwork unavailable",
            size=3.0,
            anchor="middle",
            colour="#999999",
        )

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

    table_width = 110.0
    window = Rect(body.x + 4.0, body.y + 6.0, body.width - table_width - 12.0, body.height - 14.0)

    used = 1.0
    if art is not None:
        element, used = place(art, window, scale=scale, label="drill map")
        builder.add(element)
        builder.text(
            window.x, window.bottom + 4.0, f"SCALE {scale_label(used)}", size=2.8, bold=True
        )
    else:
        builder.rect(window, width=0.2, colour="#999999")
        builder.text(
            window.x + window.width / 2,
            window.y + window.height / 2,
            "drill artwork unavailable",
            size=3.0,
            anchor="middle",
            colour="#999999",
        )

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
