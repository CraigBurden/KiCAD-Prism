"""Rendering projections: board facts as drawable tables (D4).

Every value here comes from an R5 projection, which in turn comes from KiCad's
own data -- ``ComputeBoardStatistics`` for the statistics and the board file's
own stackup for the layers.  Nothing is re-derived from geometry, because a
drawing that disagrees with the board it documents is worse than no drawing.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.release_studio.documents.layout import Table


def _mm(value: Any, digits: int = 3) -> str:
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return "—"


def _text(value: Any) -> str:
    if value is None or value == "":
        return "—"
    return str(value)


def _drill_rows(stats: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """`drill_holes` is a *list* of hole groups, not a summary object."""

    holes = stats.get("drill_holes")
    return [item for item in holes if isinstance(item, Mapping)] if isinstance(holes, list) else []


def board_characteristics(
    stats: Mapping[str, Any], stackup: Mapping[str, Any]
) -> tuple[tuple[str, str], ...]:
    """Key/value board characteristics, in KiCad's own presentation order.

    Mirrors the ordering of `Build_Board_Characteristics_Table`
    (`board_characteristics_table.cpp:40`) so a reader comparing this sheet with
    KiCad's own table finds the rows where they expect them.

    The values are taken from the projection *as KiCad formatted them* --
    "38.0000 mm" rather than a float we re-render -- because re-formatting is
    how a documentation table starts disagreeing with the tool it documents.
    """

    board = stats.get("board") or {}
    settings = stackup.get("settings") or {}
    holes = _drill_rows(stats)
    total_holes = sum(int(item.get("count") or 0) for item in holes)
    smallest = min(
        (str(item.get("x_size") or "") for item in holes if item.get("x_size")),
        default="",
    )

    return (
        ("Board size", f"{_text(board.get('width'))} × {_text(board.get('height'))}"),
        ("Board area", _text(board.get("area"))),
        ("Board thickness", _text(board.get("board_thickness") or stackup.get("board_thickness"))),
        ("Copper layers", _text(stackup.get("copper_layer_count"))),
        ("Copper finish", _text(settings.get("copper_finish"))),
        ("Solder mask", _text(settings.get("solder_mask_color") or settings.get("solder_mask"))),
        ("Silkscreen", _text(settings.get("silk_screen_color") or settings.get("silk_screen"))),
        ("Edge plating", _text(settings.get("edge_plating"))),
        ("Castellated pads", _text(settings.get("castellated_pads"))),
        ("Min track width", _text(board.get("min_track_width"))),
        ("Min track clearance", _text(board.get("min_track_clearance"))),
        ("Min drill diameter", _text(board.get("min_drill_diameter") or smallest)),
        ("Total holes", _text(total_holes or None)),
    )


def stackup_table(stackup: Mapping[str, Any]) -> Table:
    """The layer stack, outside in, exactly as the board file declares it."""

    rows: list[tuple[str, ...]] = []
    for layer in stackup.get("layers") or []:
        thickness = layer.get("thickness")
        rows.append(
            (
                _text(layer.get("user_name") or layer.get("name")),
                _text(layer.get("kind") or layer.get("type")),
                _mm(thickness, 4) if thickness is not None else "—",
                _text(layer.get("material")),
                _text(layer.get("epsilon_r")),
            )
        )
    return Table(
        title="LAYER STACKUP",
        columns=("Layer", "Type", "Thickness mm", "Material", "Er"),
        rows=tuple(rows),
        widths=(42.0, 20.0, 24.0, 34.0, 12.0),
        align=("start", "start", "end", "start", "end"),
    )


def drill_table(stackup: Mapping[str, Any], stats: Mapping[str, Any]) -> Table:
    """Via spans and hole counts by diameter.

    Both facts a fabricator asks for first: which layer pairs are drilled, and
    how many holes of each size there are.
    """

    rows: list[tuple[str, ...]] = []
    for entry in _drill_rows(stats):
        rows.append(
            (
                _text(entry.get("source")),
                f"{_text(entry.get('start_layer'))} → {_text(entry.get('stop_layer'))}",
                _text(entry.get("x_size")),
                "yes" if entry.get("plated") else "no",
                _text(entry.get("count")),
            )
        )
    # Ordering is the projection's, which is KiCad's; a re-sort here would make
    # two builds of the same board differ for presentational reasons only.
    return Table(
        title="DRILL SCHEDULE",
        columns=("Source", "Span", "Drill", "Plated", "Count"),
        rows=tuple(rows),
        widths=(18.0, 34.0, 22.0, 16.0, 14.0),
        align=("start", "start", "end", "middle", "end"),
    )


def variant_table(variants: Mapping[str, Any], selected: str) -> Table:
    """Declared variants, marking the one this release was built for."""

    rows: list[tuple[str, ...]] = []
    for name in variants.get("variants") or []:
        rows.append((str(name), "released" if str(name) == selected else ""))
    if variants.get("diverged"):
        # A board and schematic that disagree about the variant set is a real
        # defect, and the sheet says so rather than silently picking one.
        rows.append(("variant sets disagree", "review"))
    return Table(
        title="VARIANTS",
        columns=("Variant", "Status"),
        rows=tuple(rows),
        widths=(52.0, 24.0),
    )


def member_table(members: Sequence[Mapping[str, Any]], *, limit: int = 28) -> Table:
    """The released members and their digests.

    This is the sheet that makes the drawing self-describing: a recipient can
    hash the files they received and compare them here without any Prism.
    """

    rows: list[tuple[str, ...]] = []
    for member in members[:limit]:
        rows.append(
            (
                _text(member.get("path")),
                _text(member.get("canonicalizer")),
                str(member.get("released_digest") or "")[:16],
            )
        )
    if len(members) > limit:
        rows.append((f"… and {len(members) - limit} more", "", ""))
    return Table(
        title="RELEASED MEMBERS",
        columns=("Path", "Canonicalizer", "Released digest"),
        rows=tuple(rows),
        widths=(96.0, 28.0, 42.0),
    )


def key_value_table(title: str, pairs: Sequence[tuple[str, str]], *, width: float = 130.0) -> Table:
    """Render key/value pairs as a two-column table."""

    return Table(
        title=title,
        columns=("Property", "Value"),
        rows=tuple((key, value) for key, value in pairs),
        widths=(width * 0.45, width * 0.55),
    )
