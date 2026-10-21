"""Tabular text shared by the system-builder's generated files.

A CSV cell a spreadsheet would read as a formula is prefixed with ``'`` so an
opened download cannot run it. The harness outputs (CONTRACTS.md §16.7) and the
ICD (§17) use the same rule, so the two cannot drift.

Pure and deterministic: ``\\n`` line endings for both.
"""

from __future__ import annotations

import csv
import io
from typing import Sequence

#: The formula prefixes a spreadsheet would evaluate, and the quote that stops it.
FORMULA_PREFIXES = ("=", "+", "-", "@")


def _number(text: str) -> bool:
    try:
        float(text)
    except ValueError:
        return False
    return True


def cell(value: object) -> str:
    """A CSV cell, prefixed with ``'`` when a spreadsheet would read it as a formula."""

    text = "" if value is None else str(value)
    if text.startswith(FORMULA_PREFIXES) and not _number(text):
        return "'" + text
    return text


def csv_bytes(columns: Sequence[str], rows: Sequence[Sequence[object]]) -> bytes:
    """A UTF-8 CSV with ``\\n`` line endings and escaped formula-like cells."""

    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([cell(value) for value in row])
    return buffer.getvalue().encode("utf-8")
