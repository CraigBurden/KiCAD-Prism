"""The ICD as one self-contained HTML page (CONTRACTS.md §17).

No scripts and no external requests: the stylesheet is inline, fonts are the
engine's families as CSS fallbacks, and every value is escaped. The page has
the sheets' sections in the same order, with a contents list and a title block
as its header. Deterministic: no dates, nothing from the host.
"""

from __future__ import annotations

from html import escape
from typing import Sequence

from app.system_builder.icd.model import Connection, IcdModel
from app.system_builder.icd.sheets import SUMMARY_TITLE, counts, endpoint

_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0 auto; padding: 24px; max-width: 250mm;
  background: #ffffff; color: #1d1d1f;
  font-family: "Noto Sans", "DejaVu Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 13px; line-height: 1.45;
}
h1, h2, h3 { font-family: "Noto Sans Display", "Noto Sans", "DejaVu Sans", sans-serif; }
h1 { margin: 2px 0 4px; font-size: 26px; font-weight: 600; }
h2 { margin: 28px 0 8px; padding-bottom: 4px; font-size: 18px; border-bottom: 1px solid #9a9aa0; }
h3 { margin: 18px 0 6px; font-size: 14px; }
p { margin: 0 0 8px; }
a { color: #1d4f91; text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: #6b6b70; }
header.sheet-title {
  display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;
  justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #1d1d1f;
}
.kicker { margin: 0; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6b70; }
.title-block {
  display: grid; grid-template-columns: auto auto; gap: 2px 18px; align-items: baseline; margin: 0;
  padding: 8px 12px; border: 1px solid #9a9aa0; font-family: "Noto Sans Mono", "DejaVu Sans Mono", monospace;
}
.title-block div { display: contents; }
.title-block dt { color: #6b6b70; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
.title-block dd { margin: 0; font-size: 11px; }
nav.contents {
  display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 16px 0 4px;
  padding: 8px 12px; background: #f7f8fa; border: 1px solid #eef0f3; font-size: 12px;
}
nav.contents span { color: #6b6b70; text-transform: uppercase; letter-spacing: 0.06em; }
table { width: 100%; margin: 0 0 12px; border-collapse: collapse; table-layout: fixed; }
caption { caption-side: top; padding: 6px 0; text-align: left; font-weight: 600; }
th, td {
  padding: 4px 6px; border: 1px solid #c4c8cf; vertical-align: top;
  font-family: "Noto Sans Mono", "DejaVu Sans Mono", monospace; font-size: 11px;
  overflow-wrap: anywhere;
}
th { background: #eef0f3; text-align: left; font-weight: 600; }
tbody tr:nth-child(even) { background: #f7f8fa; }
td.empty { color: #6b6b70; text-align: center; }
td.num { text-align: right; }
"""


def _table(
    columns: Sequence[str],
    rows: Sequence[Sequence[str]],
    *,
    caption: str = "",
) -> str:
    caption_html = (
        f"<caption>{escape(caption)}</caption>" if caption else ""
    )
    head = "".join(f"<th scope=\"col\">{escape(column)}</th>" for column in columns)
    if rows:
        body = "".join(
            "<tr>" + "".join(f"<td>{escape(value)}</td>" for value in row) + "</tr>"
            for row in rows
        )
    else:
        body = f'<tr><td class="empty" colspan="{len(columns)}">—</td></tr>'
    return (
        f"<table>{caption_html}<thead><tr>{head}</tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def _connections(model: IcdModel) -> str:
    if not model.connections:
        return '<p class="muted">No connections.</p>'
    grouped: dict[tuple[str, str], list[Connection]] = {}
    for connection in model.connections:
        grouped.setdefault((connection.kind, connection.group), []).append(connection)
    parts = []
    for (_, group), rows in grouped.items():
        parts.append(f"<h3>{escape(group)}</h3>")
        parts.append(_table(
            ("A", "A pin", "A net", "B", "B pin", "B net", "Via", "Detail", "Note"),
            [
                (
                    endpoint(row.a), row.a.name, row.a.net,
                    endpoint(row.b), row.b.name, row.b.net,
                    row.via, row.detail, row.note,
                )
                for row in rows
            ],
        ))
    return "".join(parts)


def _interfaces(model: IcdModel) -> str:
    if not model.interfaces:
        return '<p class="muted">No interfaces.</p>'
    parts = []
    for interface in model.interfaces:
        parts.append(f"<h3>{escape(interface.name)} — {escape(interface.site)}</h3>")
        parts.append(_table(
            ("Pad", "Interface name", "Net"),
            [(pin.pad, pin.name, pin.net) for pin in interface.pins],
        ))
    return "".join(parts)


def _occurrences(model: IcdModel) -> str:
    return _table(
        ("Occurrence", "Kind", "Source"),
        [(item.label, item.kind, item.source) for item in model.occurrences],
    )


def _nets(model: IcdModel) -> str:
    if not model.nets:
        return '<p class="muted">No system nets cross occurrences.</p>'
    return _table(
        ("Net", "Board nets", "Pins"),
        [(net.name, ", ".join(net.board_nets), ", ".join(net.pins)) for net in model.nets],
    )


def render_html(model: IcdModel) -> str:
    """One page: header, contents, then the same sections as the PDF."""

    title = f"{model.system} · ICD"
    system = f"{model.system} v{model.version}" if model.version else model.system
    fields = [
        ("System", system),
    ]
    if model.bundle_key:
        fields.append(("Bundle", model.bundle_key[:16]))
    block = "".join(
        f"<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>"
        for label, value in fields
    )
    contents = "".join(
        f'<a href="#{anchor}">{escape(label)}</a>'
        for anchor, label in (
            ("summary", "Summary"),
            ("occurrences", "Occurrences"),
            ("interfaces", "Interfaces"),
            ("connections", "Connections"),
            ("system-nets", "System nets"),
        )
    )
    return (
        "<!doctype html>\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        f"<title>{escape(title)}</title>\n<style>{_STYLE}</style>\n</head>\n<body>\n"
        '<header class="sheet-title">\n<div>\n'
        f'<p class="kicker">{escape(SUMMARY_TITLE)}</p>\n'
        f"<h1>{escape(title)}</h1>\n"
        f'<p class="muted">{escape(counts(model))}</p>\n'
        "</div>\n"
        f'<dl class="title-block">{block}</dl>\n'
        "</header>\n"
        f'<nav class="contents" aria-label="Contents"><span>Contents</span>{contents}</nav>\n'
        "<main>\n"
        '<section id="summary">\n<h2>Summary</h2>\n'
        f"<p>{escape(counts(model))}</p>\n</section>\n"
        '<section id="occurrences">\n<h2>Occurrences</h2>\n'
        f"{_occurrences(model)}\n</section>\n"
        '<section id="interfaces">\n<h2>Interfaces</h2>\n'
        f"{_interfaces(model)}\n</section>\n"
        '<section id="connections">\n<h2>Connections</h2>\n'
        f"{_connections(model)}\n</section>\n"
        '<section id="system-nets">\n<h2>System nets</h2>\n'
        f"{_nets(model)}\n</section>\n"
        "</main>\n</body>\n</html>\n"
    )
