"""The ICD output files (CONTRACTS.md §17): the PDF, the sheets, HTML and CSV.

Every file is a pure function of one
:class:`~app.system_builder.icd.model.IcdModel`, so the sheets, the HTML and the
CSV cannot disagree. Bytes are deterministic: no dates, nothing from the host,
``\\n`` line endings and UTF-8 everywhere. Cells a spreadsheet would read as a
formula are escaped exactly as the harness outputs' CSVs are.
"""

from __future__ import annotations

import re

from app.release_studio.documents.pdf import render_pdf_pages
from app.release_studio.documents.svg import render_svg
from app.system_builder.harness_outputs.files import FileSpec
from app.system_builder.icd.html import render_html
from app.system_builder.icd.model import IcdModel
from app.system_builder.icd.sheets import sheets
from app.system_builder.tabular import csv_bytes

PDF = "icd.pdf"
HTML = "icd.html"
CSV = "icd.csv"
SHEET_PATTERN = re.compile(r"sheet-([1-9][0-9]*)\.svg")
PDF_CONTENT_TYPE = "application/pdf"
SHEET_CONTENT_TYPE = "image/svg+xml"
HTML_CONTENT_TYPE = "text/html"
CSV_CONTENT_TYPE = "text/csv"

ICD_COLUMNS = (
    "group", "kind",
    "a_occurrence", "a_connector", "a_pad", "a_pin_name", "a_net",
    "b_occurrence", "b_connector", "b_pad", "b_pin_name", "b_net",
    "via", "detail", "note",
)

#: The output table of §17; ``sheet-<i>.svg`` is expanded by :func:`file_entries`.
FILES: tuple[FileSpec, ...] = (
    FileSpec(PDF, "Interface control document", PDF_CONTENT_TYPE),
    FileSpec("sheet-<i>.svg", "Sheet <i> of the interface control document", SHEET_CONTENT_TYPE),
    FileSpec(HTML, "Interface control document (HTML)", HTML_CONTENT_TYPE),
    FileSpec(CSV, "Interface control document rows", CSV_CONTENT_TYPE),
)


def sheet_file(index: int) -> FileSpec:
    return FileSpec(f"sheet-{index}.svg", f"Sheet {index}", SHEET_CONTENT_TYPE)


def file_entries(sheet_count: int) -> list[dict[str, str]]:
    """The index's ``files`` list: the PDF, one entry per sheet, then HTML and CSV."""

    specs = [FILES[0], *(sheet_file(index) for index in range(1, sheet_count + 1)), *FILES[2:]]
    return [
        {"name": spec.name, "title": spec.title, "contentType": spec.content_type}
        for spec in specs
    ]


def content_type(name: str) -> str:
    """The media type of a known output name, or ``""``."""

    if name == PDF:
        return PDF_CONTENT_TYPE
    if name == HTML:
        return HTML_CONTENT_TYPE
    if name == CSV:
        return CSV_CONTENT_TYPE
    if SHEET_PATTERN.fullmatch(name):
        return SHEET_CONTENT_TYPE
    return ""


def filename(system: str, name: str) -> str:
    """``<system>-icd.pdf``, ``<system>-icd-sheet-1.svg``, lowercased and slugged."""

    stem = f"{system}-icd-{name}" if SHEET_PATTERN.fullmatch(name) else f"{system}-{name}"
    slug = re.sub(r"[^a-z0-9.]+", "-", stem.lower())
    return slug.strip("-")


def icd_csv(model: IcdModel) -> bytes:
    """One row per connection, in the contract's columns."""

    return csv_bytes(
        ICD_COLUMNS,
        [
            (
                row.group, row.kind,
                row.a.occurrence, row.a.connector, row.a.pad, row.a.name, row.a.net,
                row.b.occurrence, row.b.connector, row.b.pad, row.b.name, row.b.net,
                row.via, row.detail, row.note,
            )
            for row in model.connections
        ],
    )


def render(model: IcdModel, name: str) -> bytes | None:
    """The bytes of one output, or ``None`` for an unknown name or a sheet out of range."""

    if name == PDF:
        return render_pdf_pages(sheets(model))
    if name == HTML:
        return render_html(model).encode("utf-8")
    if name == CSV:
        return icd_csv(model)
    match = SHEET_PATTERN.fullmatch(name)
    if match is None:
        return None
    index = int(match.group(1))
    pages = sheets(model)
    if index > len(pages):
        return None
    return render_svg(pages[index - 1]).encode("utf-8")
