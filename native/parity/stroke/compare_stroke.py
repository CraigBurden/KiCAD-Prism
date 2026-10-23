#!/usr/bin/env python3
"""Parity harness for `prism-kicad stroke-text` and `prism-kicad drawing-sheet`.

ADR amendment C3 §4 asks for two equalities:

* stroke text: the NewStroke polylines, the advance widths and the missing code
  points equal Python kicad_monkey's `kicad_stroke_font` within 1e-9 mm, on
  every printable code point the font has plus the strings Release Studio's
  documents use, at several sizes and all nine h/v alignments;
* drawing sheet: the default worksheet's operations equal
  `drawing_sheet_to_ops(load_default_drawing_sheet(), …)` for every paper size
  Release Studio uses and empty, long and non-ASCII title blocks.

Run it from `native/`:

    $PY parity/stroke/compare_stroke.py --prism-kicad <path to prism-kicad>

Exit status is 0 when every comparison holds and 1 on the first difference,
printing the first few mismatches. The script imports the pinned Python
`kicad_monkey` from whichever interpreter (virtualenv) runs it.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from kicad_monkey import drawing_sheet_to_ops, load_default_drawing_sheet
from kicad_monkey.kicad_stroke_font import get_glyph, get_renderer

#: The contract's tolerance for one coordinate or one advance, in millimetres.
TOLERANCE_MM = 1e-9

#: NewStroke's printable range: U+0020 (space) through U+2BFF.
FIRST_CODEPOINT = 0x20
LAST_CODEPOINT = 0x2BFF

#: Sizes the documents use: table cells and notes, designators, titles.
STROKE_SIZES = (0.5, 1.0, 1.27, 2.5)

#: Every horizontal and vertical alignment the request can name.
ALIGNMENTS = tuple(
    (horizontal, vertical)
    for horizontal in ("left", "center", "right")
    for vertical in ("top", "center", "bottom")
)

#: Sizes Release Studio's layout uses, from backend/app/release_studio/
#: documents/layout.py's `SHEET_LADDER`.
PAPERS = {
    "A4": (297, 210),
    "A3": (420, 297),
    "A2": (594, 420),
    "A1": (841, 594),
    "A0": (1189, 841),
}

#: Strings the Release Studio documents carry: titles, units, drill notes,
#: designators, revision fields, markup and code points NewStroke lacks.
DOCUMENT_STRINGS = (
    "USB-PD Trigger Board",
    "Prism Release Studio",
    "ASSEMBLY TOP",
    "assembly-top",
    "\u2300 0.3 mm",
    "0.1 \u00b5F",
    "10 k\u03a9",
    "Target Z (\u03a9)",
    "Tolerance (\u03a9)",
    "38.0000 mm",
    "297.0000 mm",
    "R12",
    "TP7",
    "J1",
    "U3",
    "REV A1",
    "KiCad E.D.A. 10.0.0",
    "Document: assembly-top",
    "Variant: default",
    "\u2192 \u2190 \u2194 \u2713",
    "A~{ACTIVE LOW}",
    "x^{2}+y_{1}",
    "H_{2}O",
    "a~{b^{c}}_{d}",
    "\u6f22\u5b57 \U0001f600",
    "",
)

TITLE_BLOCKS = (
    {
        "title": "",
        "date": "",
        "rev": "",
        "company": "",
        "comments": {"1": "", "2": "", "3": "", "4": ""},
    },
    {
        "title": "USB-PD Trigger Board \u2014 assembly top view, revision A1",
        "date": "2026-10-17",
        "rev": "A1",
        "company": "Prism Release Studio, a deliberately long company name",
        "comments": {
            "1": "Document: assembly-top (a deliberately long comment 1)",
            "2": "Commit: 32e63e28c0de",
            "3": "Variant: default",
            "4": "Sheet: assembly_top_view and a long trailing note",
        },
    },
    {
        "title": "\u0394\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \u2014 \u2300 0.3 mm, 10 k\u03a9",
        "date": "2026-10-17",
        "rev": "\u00b5",
        "company": "Prism \u2014 \u00b5\u03a9 \u2192 \u2713",
        "comments": {
            "1": "Document: \u2300/\u00b5\u03a9",
            "2": "Commit: 32e63e28c0de",
            "3": "Variant: default",
            "4": "Sheet: \u2192 \u2190 \u2194",
        },
    },
)

SHEET_VARIANTS = (
    (1, 1, "assembly-top.pdf", "/assembly-top", "assembly-top", "10.0.6"),
    (3, 12, "rail.pdf", "/power/rail", "rail", "KiCad"),
    # A file name with a directory is drawn verbatim, as the oracle does.
    (2, 3, "nested/rail.pdf", "/power/rail", "rail", "10.0.6"),
)


@dataclass
class Diff:
    """The first few differences, and the counts the run compared."""

    runs: int = 0
    points: int = 0
    max_coordinate_mm: float = 0.0
    max_advance_mm: float = 0.0
    max_op_coordinate_mm: float = 0.0
    ops: int = 0
    messages: list[str] | None = None

    def difference(self, message: str) -> None:
        if self.messages is None:
            self.messages = []
        if len(self.messages) < 5:
            self.messages.append(message)


def chunks(values: Sequence[str], size: int) -> Iterable[str]:
    for start in range(0, len(values), size):
        yield "".join(values[start : start + size])


def font_codepoints() -> list[str]:
    """Every code point the NewStroke font data has a glyph for."""

    return [
        chr(codepoint)
        for codepoint in range(FIRST_CODEPOINT, LAST_CODEPOINT + 1)
        if get_glyph(chr(codepoint)) is not None
    ]


def run_request(binary: Path, command: str, request: dict[str, Any], directory: Path) -> dict[str, Any]:
    """Run one `--request` command and decode its one stdout document."""

    path = directory / "request.json"
    path.write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
    completed = subprocess.run(
        [str(binary), command, "--request", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SystemExit(
            f"{command} exited {completed.returncode}\nstdout: {completed.stdout}\nstderr: {completed.stderr}"
        )
    return json.loads(completed.stdout)


def stroke_runs() -> list[tuple[str, dict[str, Any]]]:
    """The labelled run corpus: every glyph, then the documents' strings."""

    codepoints = font_codepoints()
    glyph_chunks = list(chunks(codepoints, 256))
    runs: list[tuple[str, dict[str, Any]]] = []

    def add(label: str, text: str, size: float, horizontal: str, vertical: str) -> None:
        runs.append(
            (
                label,
                {
                    "text": text,
                    "x_mm": 123.456,
                    "y_mm": 78.9,
                    "size_mm": size,
                    "h_align": horizontal,
                    "v_align": vertical,
                },
            )
        )

    # Every glyph at several sizes.
    for size in (0.5, 1.27, 2.5):
        for index, chunk in enumerate(glyph_chunks):
            add(f"glyphs[{index}] {size}mm left/bottom", chunk, size, "left", "bottom")

    # Every other alignment on a sample of the glyph chunks; the document
    # strings below cover all nine alignments at all four sizes.
    for horizontal, vertical in ALIGNMENTS:
        if (horizontal, vertical) == ("left", "bottom"):
            continue
        for index in range(0, len(glyph_chunks), 8):
            add(
                f"glyphs[{index}] 1.27mm {horizontal}/{vertical}",
                glyph_chunks[index],
                1.27,
                horizontal,
                vertical,
            )

    # The strings the documents use, at every size and alignment.
    for text in DOCUMENT_STRINGS:
        for size in STROKE_SIZES:
            for horizontal, vertical in ALIGNMENTS:
                add(
                    f"{text!r} {size}mm {horizontal}/{vertical}",
                    text,
                    size,
                    horizontal,
                    vertical,
                )
    return runs


def compare_stroke(binary: Path, directory: Path, diff: Diff) -> None:
    """Compare every run's polylines, advance and missing code points."""

    renderer = get_renderer()
    labelled = stroke_runs()
    request = {
        "schema": "prism.stroke_text.request.a0",
        "runs": [run for _, run in labelled],
    }
    result = run_request(binary, "stroke-text", request, directory).get("runs", [])
    if len(result) != len(labelled):
        raise SystemExit(f"stroke-text returned {len(result)} runs for {len(labelled)}")

    for (label, run), rust in zip(labelled, result):
        text = run["text"]
        size = run["size_mm"]
        python = renderer.render_text_polylines(
            text,
            run["x_mm"],
            run["y_mm"],
            size,
            size,
            h_align=run["h_align"],
            v_align=run["v_align"],
        )
        rust_polylines = rust["polylines_mm"]
        diff.runs += 1
        if len(python) != len(rust_polylines):
            diff.difference(f"{label}: {len(python)} polylines, Rust {len(rust_polylines)}")
            continue
        for index, (expected, actual) in enumerate(zip(python, rust_polylines)):
            if len(expected) != len(actual):
                diff.difference(
                    f"{label}: polyline {index} has {len(expected)} points, Rust {len(actual)}"
                )
                break
            for (px, py), (rx, ry) in zip(expected, actual):
                deviation = max(abs(px - rx), abs(py - ry))
                diff.points += 1
                diff.max_coordinate_mm = max(diff.max_coordinate_mm, deviation)
                if deviation > TOLERANCE_MM:
                    diff.difference(
                        f"{label}: polyline {index} point ({px}, {py}) vs Rust ({rx}, {ry})"
                    )
                    break
        advance = renderer._calculate_text_width(text) * size
        deviation = abs(advance - rust["advance_mm"])
        diff.max_advance_mm = max(diff.max_advance_mm, deviation)
        if deviation > TOLERANCE_MM:
            diff.difference(f"{label}: advance {advance} vs Rust {rust['advance_mm']}")
        expected_missing = sorted(
            {
                ord(character)
                for character in text
                if character not in "\n\r\t" and get_glyph(character) is None
            }
        )
        if expected_missing != rust["missing_codepoints"]:
            diff.difference(
                f"{label}: missing {expected_missing} vs Rust {rust['missing_codepoints']}"
            )


def compare_metrics(binary: Path, diff: Diff) -> None:
    """Compare the advance table with the oracle's per-glyph advance."""

    completed = subprocess.run(
        [str(binary), "stroke-text", "--metrics"],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SystemExit(f"stroke-text --metrics exited {completed.returncode}: {completed.stderr}")
    document = json.loads(completed.stdout)
    if document["schema"] != "prism.cli.stroke_font_metrics.a0":
        raise SystemExit(f"--metrics wrote {document['schema']}")
    advances = document["advances"]
    expected = {
        str(codepoint): get_glyph(chr(codepoint)).width
        for codepoint in range(FIRST_CODEPOINT, LAST_CODEPOINT + 1)
        if get_glyph(chr(codepoint)) is not None
    }
    if set(advances) != set(expected):
        diff.difference(
            f"metrics: {len(expected)} expected entries, Rust {len(advances)}"
        )
    for key, value in expected.items():
        actual = advances.get(key)
        if actual is None:
            continue
        diff.max_advance_mm = max(diff.max_advance_mm, abs(actual - value))
        if actual != value:
            diff.difference(f"metrics[{key}]: {value} vs Rust {actual}")


def sheet_requests() -> list[tuple[str, dict[str, Any]]]:
    """Every paper size Release Studio uses times the title-block variants."""

    requests: list[tuple[str, dict[str, Any]]] = []
    for paper, (width_mm, height_mm) in PAPERS.items():
        for index, title_block in enumerate(TITLE_BLOCKS):
            for sheet_index, sheet_count, file_name, path, name, version in SHEET_VARIANTS:
                requests.append(
                    (
                        f"{paper} block {index} {sheet_index}/{sheet_count}",
                        {
                            "schema": "prism.drawing_sheet.request.a0",
                            "paper_width_nm": width_mm * 1_000_000,
                            "paper_height_nm": height_mm * 1_000_000,
                            "title_block": title_block,
                            "sheet_index": sheet_index,
                            "sheet_count": sheet_count,
                            "paper_name": paper,
                            "file_name": file_name,
                            "sheet_path": path,
                            "sheet_name": name,
                            "kicad_version": version,
                        },
                    )
                )
    return requests


def normalized_op(op: Any) -> dict[str, Any]:
    """One Python plotter op in `CliDrawingSheetOp`'s field names."""

    kind = op.kind.value if hasattr(op.kind, "value") else str(op.kind)
    payload = op.payload
    if kind == "Rect":
        return {
            "kind": "rect",
            "x1_nm": payload["x1"],
            "y1_nm": payload["y1"],
            "x2_nm": payload["x2"],
            "y2_nm": payload["y2"],
            "corner_radius_nm": payload.get("corner_radius_nm", 0),
            "fill": payload["fill"],
            "width_nm": payload["width_nm"],
            "stroke_color": payload["stroke_color"],
        }
    if kind == "PlotPoly":
        return {
            "kind": "poly",
            "points": [{"x_nm": x, "y_nm": y} for x, y in payload["points"]],
            "fill": payload["fill"],
            "width_nm": payload["width_nm"],
            "stroke_color": payload["stroke_color"],
        }
    if kind == "Text":
        return {
            "kind": "text",
            "x_nm": payload["x"],
            "y_nm": payload["y"],
            "text": payload["text"],
            "color": payload.get("color", ""),
            "orient_deg": payload.get("orient_deg", 0.0),
            "size_x_nm": payload["size_x_nm"],
            "size_y_nm": payload["size_y_nm"],
            "pen_width_nm": payload["pen_width_nm"],
            "h_align": payload["h_align"],
            "v_align": payload["v_align"],
            "italic": payload.get("italic", False),
            "bold": payload.get("bold", False),
            "multiline": payload.get("multiline", False),
            "font_face": payload.get("font_face", ""),
        }
    raise SystemExit(f"the worksheet emitted an op kind the harness does not know: {kind}")


def compare_op(expected: dict[str, Any], actual: dict[str, Any]) -> list[str]:
    """The differing fields of one op, with coordinates in millimetres."""

    if expected["kind"] != actual["kind"]:
        return [f"kind {expected['kind']} vs {actual['kind']}"]
    if expected["kind"] == "poly":
        if len(expected["points"]) != len(actual["points"]):
            return [f"{len(expected['points'])} points vs {len(actual['points'])}"]
        differences = [
            f"point ({e['x_nm']}, {e['y_nm']}) vs ({a['x_nm']}, {a['y_nm']})"
            for e, a in zip(expected["points"], actual["points"])
            if e != a
        ]
        expected = {key: value for key, value in expected.items() if key != "points"}
        actual = {key: value for key, value in actual.items() if key != "points"}
        return differences + [
            f"{key} {value!r} vs {actual.get(key)!r}"
            for key, value in expected.items()
            if actual.get(key) != value
        ]
    return [
        f"{key} {value!r} vs {actual.get(key)!r}"
        for key, value in expected.items()
        if actual.get(key) != value
    ]


def compare_drawing_sheet(binary: Path, directory: Path, diff: Diff) -> None:
    """Compare every page's operations, in order."""

    worksheet = load_default_drawing_sheet()
    for label, request in sheet_requests():
        rust = run_request(binary, "drawing-sheet", request, directory)
        python = [
            normalized_op(op)
            for op in drawing_sheet_to_ops(
                worksheet,
                paper_width_nm=request["paper_width_nm"],
                paper_height_nm=request["paper_height_nm"],
                title_block=request["title_block"],
                sheet_index=request["sheet_index"],
                sheet_count=request["sheet_count"],
                paper_name=request["paper_name"],
                filename=request["file_name"],
                sheet_path=request["sheet_path"],
                sheet_name=request["sheet_name"],
                kicad_version=request["kicad_version"],
            )
        ]
        actual = rust["ops"]
        if len(python) != len(actual):
            diff.difference(f"{label}: {len(python)} ops, Rust {len(actual)}")
            continue
        for index, (expected, value) in enumerate(zip(python, actual)):
            diff.ops += 1
            differences = compare_op(expected, value)
            if differences:
                diff.difference(f"{label}: op {index}: {'; '.join(differences[:3])}")
                continue
            if expected["kind"] in {"poly", "rect"}:
                diff.max_op_coordinate_mm = max(
                    diff.max_op_coordinate_mm, op_deviation(expected, value)
                )


def op_deviation(expected: dict[str, Any], actual: dict[str, Any]) -> float:
    """The largest per-coordinate difference of one equal op, in mm."""

    if expected["kind"] == "rect":
        pairs = [
            (expected["x1_nm"], actual["x1_nm"]),
            (expected["y1_nm"], actual["y1_nm"]),
            (expected["x2_nm"], actual["x2_nm"]),
            (expected["y2_nm"], actual["y2_nm"]),
        ]
    else:
        pairs = [
            (point["x_nm"], other["x_nm"])
            for point, other in zip(expected["points"], actual["points"])
        ] + [
            (point["y_nm"], other["y_nm"])
            for point, other in zip(expected["points"], actual["points"])
        ]
    return max((abs(left - right) * 1e-6 for left, right in pairs), default=0.0)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prism-kicad", required=True, type=Path, help="the built binary")
    arguments = parser.parse_args(argv)
    binary = arguments.prism_kicad.resolve()
    if not binary.is_file():
        parser.error(f"{binary} is not a file")

    diff = Diff()
    with tempfile.TemporaryDirectory(prefix="prism-stroke-parity-") as temporary:
        directory = Path(temporary)
        compare_stroke(binary, directory, diff)
        compare_metrics(binary, diff)
        compare_drawing_sheet(binary, directory, diff)

    print(
        "stroke-text: "
        f"{diff.runs} runs, {diff.points} points, "
        f"max coordinate deviation {diff.max_coordinate_mm:.3e} mm, "
        f"max advance deviation {diff.max_advance_mm:.3e} mm"
    )
    print(f"drawing-sheet: {diff.ops} operations, max coordinate deviation {diff.max_op_coordinate_mm:.3e} mm")
    if diff.messages:
        print(f"FAIL: {len(diff.messages)} difference(s), first ones:", file=sys.stderr)
        for message in diff.messages:
            print(f"  {message}", file=sys.stderr)
        return 1
    print("OK: every stroke run and drawing-sheet operation matches the oracle")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
