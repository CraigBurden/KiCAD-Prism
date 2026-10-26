"""The ``prism`` command-line client.

Thin wrappers over :class:`prism.client.Client`: human-readable tables by
default, the raw JSON body with ``--json``, and exit code 1 with
``code: detail`` on stderr when the API refuses a request.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from typing import Any, Iterable, Sequence

from .client import Client, PrismError

__all__ = ["main"]


def _json(data: Any) -> None:
    print(json.dumps(data, indent=2, sort_keys=True))


def _table(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> None:
    body = [[str(cell) for cell in row] for row in rows]
    widths = [len(str(header)) for header in headers]
    for row in body:
        for index, cell in enumerate(row):
            if index < len(widths):
                widths[index] = max(widths[index], len(cell))
    print("  ".join(str(header).ljust(widths[index]) for index, header in enumerate(headers)).rstrip())
    for row in body:
        print("  ".join(cell.ljust(widths[index]) for index, cell in enumerate(row)).rstrip())


def _project_row(project: dict[str, Any]) -> list[Any]:
    return [
        project.get("id", ""),
        project.get("display_name") or project.get("name", ""),
        project.get("path", ""),
    ]


def _projects_list(client: Client, args: argparse.Namespace) -> int:
    projects = client.list_projects() or []
    if args.json:
        _json(projects)
        return 0
    _table(["ID", "NAME", "PATH"], (_project_row(project) for project in projects))
    return 0


def _project_show(client: Client, args: argparse.Namespace) -> int:
    project = client.get_project_detail(args.id)
    if args.json:
        _json(project)
        return 0
    project = project or {}
    fields = ("id", "name", "display_name", "path", "description", "origin_url", "last_synced_at")
    _table(["FIELD", "VALUE"], ((name, project.get(name, "")) for name in fields))
    return 0


def _bom_table(data: dict[str, Any]) -> tuple[list[str], list[list[str]]]:
    columns = list(data.get("columns") or ["Reference", "Qty", "Value"])
    rows: list[list[str]] = []
    for line in data.get("lines") or []:
        fields = line.get("fields") or {}
        row: list[str] = []
        for column in columns:
            if column == "Reference":
                row.append(", ".join(str(reference) for reference in line.get("references") or []))
            elif column == "Qty":
                row.append(str(line.get("quantity", "")))
            else:
                row.append(str(fields.get(column, "")))
        rows.append(row)
    return columns, rows


def _bom(client: Client, args: argparse.Namespace) -> int:
    data = client.get_project_bom(args.project, commit=args.revision, assembly=args.assembly)
    data = data or {}
    if args.json:
        _json(data)
        return 0
    columns, rows = _bom_table(data)
    if args.csv:
        writer = csv.writer(sys.stdout, lineterminator="\n")
        writer.writerow(columns)
        writer.writerows(rows)
        return 0
    _table(columns, rows)
    return 0


def _design_search(client: Client, args: argparse.Namespace) -> int:
    data = client.search_design(args.project, q=args.query, revision=args.revision)
    data = data or {}
    if args.json:
        _json(data)
        return 0
    rows = []
    for hit in data.get("results") or []:
        rows.append(
            [
                hit.get("kind", ""),
                hit.get("reference") or hit.get("name") or "",
                hit.get("value") or "",
                hit.get("footprint") or "",
                hit.get("matched", ""),
                hit.get("field") or "",
            ]
        )
    _table(["KIND", "REFERENCE/NAME", "VALUE", "FOOTPRINT", "MATCHED", "FIELD"], rows)
    return 0


def _design_component(client: Client, args: argparse.Namespace) -> int:
    data = client.get_design_component(args.project, args.ref, revision=args.revision)
    data = data or {}
    if args.json:
        _json(data)
        return 0
    component = data.get("component") or {}
    _table(
        ["FIELD", "VALUE"],
        [
            ("Reference", component.get("reference", "")),
            ("Value", component.get("value", "")),
            ("Footprint", component.get("footprint", "")),
            ("Library", component.get("libraryRef") or ""),
            ("Sheet", component.get("sheet") or ""),
            ("DNP", component.get("dnp", False)),
        ],
    )
    pins = component.get("pins") or []
    if pins:
        print()
        _table(
            ["PIN", "NAME", "NET"],
            ((pin.get("pin", ""), pin.get("pinName", ""), pin.get("net") or "") for pin in pins),
        )
    return 0


def _design_net(client: Client, args: argparse.Namespace) -> int:
    data = client.get_design_net(args.project, args.name, revision=args.revision)
    data = data or {}
    if args.json:
        _json(data)
        return 0
    net = data.get("net") or {}
    _table(
        ["FIELD", "VALUE"],
        [
            ("Name", net.get("name", "")),
            ("Net class", net.get("netClass") or ""),
            ("Components", ", ".join(str(item) for item in net.get("components") or [])),
        ],
    )
    pins = net.get("pins") or []
    if pins:
        print()
        _table(
            ["REFERENCE", "PIN", "NAME"],
            ((pin.get("reference", ""), pin.get("pin", ""), pin.get("pinName", "")) for pin in pins),
        )
    return 0


def _event_row(event: dict[str, Any]) -> list[Any]:
    return [
        event.get("id", ""),
        event.get("kind", ""),
        event.get("topic", ""),
        event.get("projectId") or "",
        event.get("createdAt", ""),
    ]


def _events(client: Client, args: argparse.Namespace) -> int:
    if not args.follow:
        page = client.list_events(after=args.after) or {}
        if args.json:
            _json(page)
            return 0
        _table(["ID", "KIND", "TOPIC", "PROJECT", "CREATED"], (_event_row(e) for e in page.get("events") or []))
        return 0

    cursor = args.after
    while True:
        page = client.list_events(after=cursor) or {}
        for event in page.get("events") or []:
            if args.json:
                print(json.dumps(event, sort_keys=True))
            else:
                print("\t".join(str(cell) for cell in _event_row(event)))
        next_cursor = page.get("next")
        if not isinstance(next_cursor, int) or next_cursor <= cursor:
            time.sleep(2)
        else:
            cursor = next_cursor


def _job(client: Client, args: argparse.Namespace) -> int:
    job = client.wait_for_job(args.id) if args.wait else client.get_job(args.id)
    if args.json:
        _json(job)
        return 0
    job = job or {}
    _table(
        ["FIELD", "VALUE"],
        [
            ("Job", job.get("job_id", args.id)),
            ("Status", job.get("status") or ""),
            ("Kind", job.get("kind") or ""),
            ("Percent", job.get("percent") if job.get("percent") is not None else ""),
            ("Message", job.get("message") or ""),
            ("Error", (job.get("error_code") or "") + (f": {job['error_message']}" if job.get("error_message") else "")),
        ],
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="prism", description="KiCAD Prism from the command line.")
    commands = parser.add_subparsers(dest="command", required=True)

    projects = commands.add_parser("projects", help="Projects registered in Prism")
    project_commands = projects.add_subparsers(dest="action", required=True)
    project_list = project_commands.add_parser("list", help="List projects")
    project_list.add_argument("--json", action="store_true", help="print the raw JSON")
    project_list.set_defaults(handler=_projects_list)

    project = commands.add_parser("project", help="One project")
    project.add_argument("id")
    project.add_argument("--json", action="store_true", help="print the raw JSON")
    project.set_defaults(handler=_project_show)

    bom = commands.add_parser("bom", help="A revision's engineering BOM")
    bom.add_argument("project")
    bom.add_argument("--revision", help="commit or ref (default: HEAD)")
    bom.add_argument("--assembly", choices=("all", "assembly"), default="all")
    bom.add_argument("--csv", action="store_true", help="write CSV")
    bom.add_argument("--json", action="store_true", help="print the raw JSON")
    bom.set_defaults(handler=_bom)

    design = commands.add_parser("design", help="Design queries at a revision")
    design_commands = design.add_subparsers(dest="action", required=True)

    search = design_commands.add_parser("search", help="Find components and nets")
    search.add_argument("project")
    search.add_argument("query")
    search.add_argument("--revision", help="commit or ref (default: HEAD)")
    search.add_argument("--json", action="store_true", help="print the raw JSON")
    search.set_defaults(handler=_design_search)

    component = design_commands.add_parser("component", help="One component")
    component.add_argument("project")
    component.add_argument("ref")
    component.add_argument("--revision", help="commit or ref (default: HEAD)")
    component.add_argument("--json", action="store_true", help="print the raw JSON")
    component.set_defaults(handler=_design_component)

    net = design_commands.add_parser("net", help="One net")
    net.add_argument("project")
    net.add_argument("name")
    net.add_argument("--revision", help="commit or ref (default: HEAD)")
    net.add_argument("--json", action="store_true", help="print the raw JSON")
    net.set_defaults(handler=_design_net)

    events = commands.add_parser("events", help="The event log")
    events.add_argument("--after", type=int, default=0, help="start after this event id")
    events.add_argument("--follow", action="store_true", help="keep polling for new events")
    events.add_argument("--json", action="store_true", help="print the raw JSON")
    events.set_defaults(handler=_events)

    job = commands.add_parser("job", help="One job's status")
    job.add_argument("id")
    job.add_argument("--wait", action="store_true", help="poll until the job finishes")
    job.add_argument("--json", action="store_true", help="print the raw JSON")
    job.set_defaults(handler=_job)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        client = Client()
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    try:
        return int(args.handler(client, args) or 0)
    except PrismError as error:
        print(f"{error.code}: {error.detail}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
