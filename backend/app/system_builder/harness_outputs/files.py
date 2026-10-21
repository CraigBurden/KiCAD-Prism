"""The harness output files (CONTRACTS.md §16.7): the CSVs, ``prism.harness.v1``
and the rendered sheets.

Every file is a pure function of one :class:`~app.system_builder.harness_outputs.model.HarnessModel`,
so the wiring table, the BOM CSV, the YAML and the drawing cannot disagree.
Bytes are deterministic: no dates, nothing from the host, ``\\n`` line endings
and UTF-8 everywhere.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import yaml

from app.release_studio.documents.pdf import render_pdf_pages
from app.release_studio.documents.svg import render_svg
from app.system_builder.harness_outputs.drawing import sheets
from app.system_builder.harness_outputs.model import (
    Cable,
    Cavity,
    End,
    HarnessModel,
    Node,
    Part,
    Terminal,
    Wire,
    colour_codes,
    colour_text,
)
from app.system_builder.tabular import csv_bytes as _csv

SCHEMA = "prism.harness.v1"
PDF = "harness.pdf"
WIRING = "wiring.csv"
BOM = "bom.csv"
HARNESS = "harness.yaml"
SHEET_PATTERN = re.compile(r"sheet-([1-9][0-9]*)\.svg")
PDF_CONTENT_TYPE = "application/pdf"
SHEET_CONTENT_TYPE = "image/svg+xml"
CSV_CONTENT_TYPE = "text/csv"
YAML_CONTENT_TYPE = "application/yaml"

WIRING_COLUMNS = (
    "wire", "from_end", "from_cavity", "from_signal",
    "to_end", "to_cavity", "to_signal",
    "net", "gauge_awg", "colour", "colour_code",
    "length_mm", "length_typed", "label", "cable", "conductor",
)
BOM_COLUMNS = ("item", "kind", "part", "manufacturer", "description", "quantity", "where")


@dataclass(frozen=True)
class FileSpec:
    """One downloadable output."""

    name: str
    title: str
    content_type: str


#: The output table of §16.7; ``sheet-<i>.svg`` is expanded by :func:`file_entries`.
FILES: tuple[FileSpec, ...] = (
    FileSpec(PDF, "Harness document", PDF_CONTENT_TYPE),
    FileSpec("sheet-<i>.svg", "Sheet <i> of the harness document", SHEET_CONTENT_TYPE),
    FileSpec(WIRING, "Wiring table", CSV_CONTENT_TYPE),
    FileSpec(BOM, "Bill of materials", CSV_CONTENT_TYPE),
    FileSpec(HARNESS, "Harness data", YAML_CONTENT_TYPE),
)


def sheet_file(index: int) -> FileSpec:
    return FileSpec(f"sheet-{index}.svg", f"Sheet {index}", SHEET_CONTENT_TYPE)


def file_entries(sheet_count: int) -> list[dict[str, str]]:
    """The index's ``files`` list: the PDF, one entry per sheet, then the data files."""

    specs = [FILES[0], *(sheet_file(index) for index in range(1, sheet_count + 1)), *FILES[2:]]
    return [
        {"name": spec.name, "title": spec.title, "contentType": spec.content_type}
        for spec in specs
    ]


def content_type(name: str) -> str:
    """The media type of a known output name, or ``""``."""

    if name == PDF:
        return PDF_CONTENT_TYPE
    if name in (WIRING, BOM):
        return CSV_CONTENT_TYPE
    if name == HARNESS:
        return YAML_CONTENT_TYPE
    if SHEET_PATTERN.fullmatch(name):
        return SHEET_CONTENT_TYPE
    return ""


def filename(system: str, label: str, name: str) -> str:
    """``<system>-<label>-<name>``, lowercased and slugged."""

    slug = re.sub(r"[^a-z0-9.]+", "-", f"{system}-{label}-{name}".lower())
    return slug.strip("-")


# ------------------------------------------------------------------- tables


def _end(model: HarnessModel, end_id: str) -> End | None:
    return next((end for end in model.ends if end.id == end_id), None)


def _cavity(end: End | None, cavity: str) -> Cavity | None:
    if end is None:
        return None
    return next((item for item in end.cavities if item.cavity == cavity), None)


def _node(model: HarnessModel, node_id: str) -> Node | None:
    return next((node for node in model.nodes if node.id == node_id), None)


def _terminal(model: HarnessModel, terminal: Terminal) -> tuple[str, str, str]:
    """``(end or node name, cavity, signal)``; a splice or loose end has no cavity or signal."""

    if terminal.kind == "contact":
        end = _end(model, terminal.node)
        cavity = _cavity(end, terminal.cavity)
        return (end.title if end else terminal.node, terminal.cavity, cavity.signal if cavity else "")
    node = _node(model, terminal.node)
    return (node.name if node else terminal.node, "", "")


def _length_mm(nm: int | None) -> str:
    return "" if nm is None else f"{nm / 1e6:.1f}"


def wiring_csv(model: HarnessModel) -> bytes:
    rows = []
    for wire in model.wires:
        source = _terminal(model, wire.source)
        target = _terminal(model, wire.target)
        rows.append((
            wire.number,
            source[0], source[1], source[2],
            target[0], target[1], target[2],
            wire.net,
            wire.gauge_awg,
            wire.colour,
            colour_text(wire.colour),
            _length_mm(wire.length_nm),
            "true" if wire.typed_length else "false",
            wire.label,
            wire.cable,
            wire.conductor,
        ))
    return _csv(WIRING_COLUMNS, rows)


def bom_csv(model: HarnessModel) -> bytes:
    rows = [
        (row.item, row.kind, row.part, row.manufacturer, row.description, row.quantity, row.where)
        for row in model.bom
    ]
    return _csv(BOM_COLUMNS, rows)


# --------------------------------------------------------------------- YAML


def _part(part: Part | None) -> dict[str, str] | None:
    if part is None:
        return None
    return {
        "reference": part.reference,
        "mpn": part.mpn,
        "name": part.name,
        "manufacturer": part.manufacturer,
        "description": part.description,
    }


def _yaml_terminal(terminal: Terminal) -> dict[str, str]:
    out = {"kind": terminal.kind, "node": terminal.node}
    if terminal.kind == "contact":
        out["cavity"] = terminal.cavity
    return out


def _yaml_mm(nm: int) -> float:
    return round(nm / 1e6, 3)


def harness_yaml(model: HarnessModel) -> bytes:
    payload = {
        "schema": SCHEMA,
        "system": {
            "name": model.system,
            "version": model.system_version,
            "bundleKey": model.bundle_key,
        },
        "harness": {"id": model.harness, "label": model.label, "routed": model.routed},
        "ends": [
            {
                "id": end.id,
                "title": end.title,
                "connector": end.connector,
                "ways": end.ways,
                "housing": _part(end.housing),
                "cavities": [
                    {
                        "cavity": cavity.cavity,
                        "pad": cavity.pad,
                        "signal": cavity.signal,
                        "net": cavity.net,
                        "contact": _part(cavity.contact),
                        "wires": list(cavity.wires),
                    }
                    for cavity in end.cavities
                ],
            }
            for end in model.ends
        ],
        "nodes": [
            {
                "id": node.id,
                "name": node.name,
                "kind": node.kind,
                "detail": node.detail,
                "wires": list(node.wires),
            }
            for node in model.nodes
        ],
        "wires": [_yaml_wire(wire) for wire in model.wires],
        "cables": [_yaml_cable(cable) for cable in model.cables],
        "segments": [
            {
                "id": segment.id,
                "from": segment.source,
                "to": segment.target,
                "wires": list(segment.wires),
                "lengthMm": _yaml_mm(segment.length_nm),
                "diameterMm": _yaml_mm(segment.diameter_nm),
                "coverings": list(segment.coverings),
            }
            for segment in model.segments
        ],
        "coverings": [
            {
                "id": covering.id,
                "segment": covering.segment,
                "kind": covering.kind,
                "part": _part(covering.part),
            }
            for covering in model.coverings
        ],
        "nodeNames": dict(model.node_names),
        "bom": [
            {
                "item": row.item,
                "kind": row.kind,
                "part": row.part,
                "manufacturer": row.manufacturer,
                "description": row.description,
                "quantity": row.quantity,
                "where": row.where,
            }
            for row in model.bom
        ],
    }
    return yaml.safe_dump(
        payload, allow_unicode=True, default_flow_style=False, sort_keys=False,
    ).encode("utf-8")


def _yaml_wire(wire: Wire) -> dict[str, object]:
    return {
        "number": wire.number,
        "id": wire.id,
        "origin": wire.origin,
        "from": _yaml_terminal(wire.source),
        "to": _yaml_terminal(wire.target),
        "gaugeAwg": wire.gauge_awg,
        "colour": wire.colour,
        "colourCodes": colour_codes(wire.colour),
        "label": wire.label,
        "net": wire.net,
        "cable": wire.cable,
        "conductor": wire.conductor,
        "lengthMm": None if wire.length_nm is None else _yaml_mm(wire.length_nm),
        "lengthTyped": wire.typed_length,
    }


def _yaml_cable(cable: Cable) -> dict[str, object]:
    return {
        "id": cable.id,
        "label": cable.label,
        "part": _part(cable.part),
        "conductors": [
            {"name": conductor.name, "wire": conductor.wire, "drain": conductor.drain}
            for conductor in cable.conductors
        ],
    }


# ------------------------------------------------------------------ render


def render(model: HarnessModel, name: str) -> bytes | None:
    """The bytes of one output, or ``None`` for an unknown name or a sheet out of range."""

    if name == PDF:
        return render_pdf_pages(sheets(model))
    if name == WIRING:
        return wiring_csv(model)
    if name == BOM:
        return bom_csv(model)
    if name == HARNESS:
        return harness_yaml(model)
    match = SHEET_PATTERN.fullmatch(name)
    if match is None:
        return None
    index = int(match.group(1))
    pages = sheets(model)
    if index > len(pages):
        return None
    return render_svg(pages[index - 1]).encode("utf-8")
