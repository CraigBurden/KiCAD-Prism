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


def _yes_no(value: Any) -> str:
    """KiCad's own `_( "Yes" ) : _( "No" )` for a boolean characteristic."""

    return "Yes" if value else "No"


#: The rows `Build_Board_Characteristics_Table` emits, in its order, with its
#: labels (`board_characteristics_table.cpp:78-134`).  Kept as data rather than
#: inline so the conformance test can compare this list against the labels it
#: parses out of the pinned KiCad source, and so a KiCad change that reorders or
#: renames a row fails a test instead of quietly making our sheet disagree.
KICAD_CHARACTERISTIC_LABELS: tuple[str, ...] = (
    "Copper layer count",
    "Board thickness",
    "Board overall dimensions",
    "Min track/spacing",
    "Min hole diameter",
    "Copper finish",
    "Impedance control",
    "Castellated pads",
    "Press-fit pads",
    "Plated board edge",
    "Edge card connectors",
)


def board_characteristics(
    stats: Mapping[str, Any], stackup: Mapping[str, Any]
) -> tuple[tuple[str, str], ...]:
    """Board characteristics as KiCad itself renders them.

    This is a *reproduction* of `Build_Board_Characteristics_Table`
    (`board_characteristics_table.cpp:34`), not an interpretation of it: same
    rows, same order, same labels, same value strings.  A fabricator who opens
    the board in KiCad and inserts its characteristics table has to see the same
    text as the released sheet, or one of the two is lying about the board.

    Both sides are cheap to keep aligned because both read the same numbers.
    KiCad's table calls `ComputeBoardStatistics()`; so does
    `pcb export stats --format json`, and it formats through the same
    `MessageTextFromValue`.  The values are therefore passed through *as KiCad
    wrote them* -- "38.0000 mm", never a float we re-render -- since
    re-formatting is exactly how the two renderings would start to diverge.

    The three facts the statistics JSON does not carry come from the stackup,
    which is where KiCad's table reads them from too.
    """

    board = stats.get("board") or {}
    pads = stats.get("pads") or {}
    settings = stackup.get("settings") or {}

    # `wxString::Format( "%s x %s" )` -- a lowercase ASCII x, not a multiplication
    # sign.  Trivial, and exactly the kind of difference "string-for-string"
    # exists to catch.
    dimensions = f"{_text(board.get('width'))} x {_text(board.get('height'))}"
    track_spacing = (
        f"{_text(board.get('min_track_width'))} / {_text(board.get('min_track_clearance'))}"
    )

    # `edge_connector` is absent when unconstrained, "yes" when in use, and
    # "bevelled" when bevelled (`board_stackup.cpp:808`); KiCad's table renders
    # those three as "No", "Yes", and "Yes, Bevelled".
    edge_connector = str(settings.get("edge_connector") or "").strip().lower()
    connectors = {
        "": "No",
        "yes": "Yes",
        "bevelled": "Yes, Bevelled",
    }.get(edge_connector, "Yes")

    return (
        ("Copper layer count", _text(stackup.get("copper_layer_count"))),
        ("Board thickness", _text(board.get("board_thickness"))),
        ("Board overall dimensions", dimensions),
        ("Min track/spacing", track_spacing),
        ("Min hole diameter", _text(board.get("min_drill_diameter"))),
        ("Copper finish", _text(settings.get("copper_finish"))),
        ("Impedance control", _yes_no(settings.get("dielectric_constraints"))),
        ("Castellated pads", _yes_no(pads.get("castellated"))),
        ("Press-fit pads", _yes_no(pads.get("press_fit"))),
        ("Plated board edge", _yes_no(settings.get("edge_plating"))),
        ("Edge card connectors", connectors),
    )


def board_summary(stats: Mapping[str, Any]) -> tuple[tuple[str, str], ...]:
    """Facts a release cover wants that KiCad's characteristics table omits.

    Kept apart from :func:`board_characteristics` on purpose.  That table has a
    conformance obligation to KiCad's own rendering, so anything Prism wants to
    add to it is really a second table -- adding rows there would break the
    correspondence it exists to maintain.
    """

    board = stats.get("board") or {}
    holes = _drill_rows(stats)
    components = (stats.get("components") or {}).get("total") or {}
    total_holes = sum(int(item.get("count") or 0) for item in holes)

    return (
        ("Board area", _text(board.get("area"))),
        ("Components", _text(components.get("total"))),
        ("Drilled holes", _text(total_holes or None)),
        ("Distinct drills", _text(len(holes) or None)),
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
                # An arrow would be nicer, but it is outside WinAnsi and the PDF
                # backend can only emit what the base-14 fonts encode -- so the
                # two renderings of this sheet would show different text.
                f"{_text(entry.get('start_layer'))} - {_text(entry.get('stop_layer'))}",
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
    """Declared variants, marking the one this release was built for.

    A project with no variants gets a stated fact rather than a header row over
    nothing: an empty table reads as data that failed to load, which is a
    different and more alarming thing than a board that has one build.
    """

    rows: list[tuple[str, ...]] = []
    for name in variants.get("variants") or []:
        rows.append((str(name), "released" if str(name) == selected else ""))
    if variants.get("diverged"):
        # A board and schematic that disagree about the variant set is a real
        # defect, and the sheet says so rather than silently picking one.
        rows.append(("variant sets disagree", "review"))
    if not rows:
        return Table(
            title="VARIANTS",
            columns=("Variant", "Status"),
            rows=(("no variants declared", "—"),),
            widths=(52.0, 24.0),
        )
    return Table(
        title="VARIANTS",
        columns=("Variant", "Status"),
        rows=tuple(rows),
        widths=(52.0, 24.0),
    )


def member_table(members: Sequence[Mapping[str, Any]]) -> Table:
    """The released members and their digests.

    This is the sheet that makes the drawing self-describing: a recipient can
    hash the files they received and compare them here without any Prism.

    Every member is listed.  Capping the list here would decide, before the
    sheet size is known, that a release is too long to describe -- whereas
    `layout.fit_columns` knows how much room the sheet actually has and trims
    with the count stated only when it must.
    """

    rows: list[tuple[str, ...]] = []
    for member in members:
        rows.append(
            (
                _text(member.get("path")),
                _text(member.get("canonicalizer")),
                str(member.get("released_digest") or "")[:16],
            )
        )
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
