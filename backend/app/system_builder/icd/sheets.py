"""The ICD's release-studio sheets (CONTRACTS.md §17).

Sheet 1 is the summary: the heading, the version and counts, and the
occurrences table. The interfaces, connections and system nets follow as
tables on as many A3 sheets as they need, each continued like the harness
document's tables. Every sheet carries the Release Studio frame and title
block; there is nothing time-varying or host-specific in either.
"""

from __future__ import annotations

from typing import Sequence

from app.release_studio.documents.layout import (
    Rect,
    Sheet,
    SheetBuilder,
    Table,
    TitleBlockField,
    draw_frame,
    draw_title_block,
)
from app.system_builder.icd.model import Connection, IcdModel, Interface, Pin, SystemNet
from app.system_builder.output_sheets import (
    TITLE_BLOCK,
    Placed,
    draw_placed,
    paginate_tables,
    table_area,
)

SUMMARY_TITLE = "Interface control document"


def endpoint(pin: Pin) -> str:
    """``<occurrence> <connector>.<pad>``, or just the node a loose end names."""

    if pin.connector and pin.pad:
        return f"{pin.occurrence} {pin.connector}.{pin.pad}"
    if pin.connector:
        return f"{pin.occurrence} {pin.connector}"
    return pin.occurrence


def _text(value: str) -> str:
    return "—" if value == "" else value


def counts(model: IcdModel) -> str:
    return (
        f"v{model.version} · {len(model.occurrences)} occurrences · "
        f"{len(model.interfaces)} interfaces · {len(model.connections)} connections · "
        f"{len(model.nets)} system nets "
        f"({model.local_nets} single-board nets not listed)"
    )


def _occurrences_table(model: IcdModel) -> Table:
    return Table(
        columns=("Occurrence", "Kind", "Source"),
        rows=tuple((item.label, item.kind, item.source) for item in model.occurrences),
        widths=(46.0, 26.0, 240.0),
        title="OCCURRENCES",
        bordered=True,
    )


def _interface_table(interface: Interface) -> Table:
    return Table(
        columns=("Pad", "Interface name", "Net"),
        rows=tuple((_text(pin.pad), _text(pin.name), _text(pin.net)) for pin in interface.pins),
        widths=(24.0, 78.0, 78.0),
        title=f"{interface.name} — {interface.site}",
        bordered=True,
    )


def _connections_table(group: str, rows: Sequence[Connection]) -> Table:
    return Table(
        columns=("A", "A pin", "A net", "B", "B pin", "B net", "Via", "Detail", "Note"),
        rows=tuple(
            (
                endpoint(row.a), _text(row.a.name), _text(row.a.net),
                endpoint(row.b), _text(row.b.name), _text(row.b.net),
                _text(row.via), _text(row.detail), _text(row.note),
            )
            for row in rows
        ),
        widths=(46.0, 28.0, 40.0, 46.0, 28.0, 40.0, 30.0, 48.0, 36.0),
        title=group,
        bordered=True,
    )


def _nets_table(nets: Sequence[SystemNet]) -> Table:
    return Table(
        columns=("Net", "Board nets", "Pins"),
        rows=tuple(
            (net.name, ", ".join(net.board_nets), ", ".join(net.pins))
            for net in nets
        ),
        widths=(52.0, 130.0, 150.0),
        title="SYSTEM NETS",
        bordered=True,
    )


def _connection_tables(model: IcdModel) -> list[Table]:
    """One table per mate or harness, in document order."""

    grouped: dict[tuple[str, str], list[Connection]] = {}
    for connection in model.connections:
        grouped.setdefault((connection.kind, connection.group), []).append(connection)
    return [
        _connections_table(group, rows)
        for (_, group), rows in grouped.items()
    ]


def _tables(model: IcdModel) -> list[Table]:
    tables = [_interface_table(interface) for interface in model.interfaces]
    tables += _connection_tables(model)
    if model.nets:
        tables.append(_nets_table(model.nets))
    return tables


def _title_block(builder: SheetBuilder, area: Rect, model: IcdModel, sheet: int, total: int) -> Rect:
    fields = [
        TitleBlockField(
            "System",
            f"{model.system} v{model.version}" if model.version else model.system,
        ),
        TitleBlockField("Sheet", f"{sheet} of {total}"),
    ]
    if model.bundle_key:
        fields.append(TitleBlockField("Bundle", model.bundle_key[:16]))
    width, height = TITLE_BLOCK
    return draw_title_block(
        builder, area, title=f"{model.system} · ICD", fields=fields,
        width=width, height=height,
    )


def _sheet(model: IcdModel, index: int, total: int, page: list[Placed], summary: bool) -> Sheet:
    key, title = ("icd-summary", SUMMARY_TITLE) if summary else (f"icd-tables-{index - 1}", "ICD tables")
    builder = SheetBuilder(key, f"{model.system} · {title}", "A3")
    inner = draw_frame(builder)
    if summary:
        builder.text(inner.x + 6, inner.y + 8, f"{model.system} · {SUMMARY_TITLE}",
                     size=5.0, family="display", bold=True)
        builder.text(inner.x + 6, inner.y + 13, counts(model), size=2.2, colour="#6b6b70")
    draw_placed(builder, page)
    _title_block(builder, inner, model, index, total)
    return builder.build()


def sheets(model: IcdModel) -> list[Sheet]:
    """The ICD's sheets: a summary and the occurrences on sheet 1, the tables flowing on from under it."""

    area = table_area("A3")
    occurrences = _occurrences_table(model)
    top = area.y + 10.0  # under the heading and the counts line
    summary = Rect(area.x, top, area.width, area.bottom - top)
    pages = paginate_tables([occurrences, *_tables(model)], area, first=summary)
    total = len(pages)
    return [_sheet(model, index, total, page, index == 1) for index, page in enumerate(pages, 1)]
