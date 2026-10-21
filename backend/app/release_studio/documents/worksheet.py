"""Adapter from ``prism-kicad drawing-sheet`` to Prism's sheet model.

``prism-kicad`` owns ``.kicad_wks`` parsing, variable expansion, repeat
behavior, page visibility, and the default KiCad drawing-sheet geometry. Prism
only translates the emitted operations into the shared SVG/PDF layout model.
"""

from __future__ import annotations

import functools
import json
import os
import tempfile
from dataclasses import replace
from typing import Any, Mapping, Sequence

from app.release_studio.documents.fonts import (
    CLI_TIMEOUT_SECONDS,
    cap_height,
    prism_kicad_generator_digest,
)
from app.release_studio.documents.layout import (
    Line,
    Polyline,
    Rect,
    Rectangle,
    Text,
    TitleBlockField,
    text_width,
)
from app.release_studio.documents.style import (
    HEAD,
    INK,
    KICAD_STYLE,
    MUTED,
    PRISM_STYLE,
    RULE,
    STRIPE,
)

_NM_PER_MM = 1_000_000.0

#: The documented ``drawing-sheet`` result (cli-spec.md §5.9).
_DRAWING_SHEET_SCHEMA = "prism.cli.drawing_sheet_result.a0"


def default_worksheet_elements(
    *,
    width_mm: float,
    height_mm: float,
    paper_name: str,
    title: str,
    key: str,
    context: Mapping[str, Any],
    extra_fields: Sequence[TitleBlockField] = (),
    style: str = KICAD_STYLE,
) -> tuple[Line | Polyline | Rectangle | Text, ...]:
    """Emit ``prism-kicad``'s default worksheet as Prism layout elements.

    ``kicad`` returns the CLI's own red drawing sheet unchanged.  ``prism``
    keeps every coordinate and only changes how the same operations are painted:
    ink-black strokes and text, grey title-block structure, and the harness's
    header/stripe tints.  Recolouring here rather than in the producer means the
    style survives the producer changing.
    """

    extras = " · ".join(
        f"{field.label}: {field.value}" for field in extra_fields if field.value
    )
    comments = {
        "1": f"Document: {context.get('document_name') or context.get('document_number') or '—'}",
        "2": f"Commit: {str(context.get('commit_sha') or '')[:12] or '—'}",
        "3": f"Variant: {context.get('variant') or 'default'}",
        "4": extras,
    }
    generator = str(context.get("kicad_version") or "").strip()
    request = {
        "schema": "prism.drawing_sheet.request.a0",
        "paper_width_nm": int(round(width_mm * _NM_PER_MM)),
        "paper_height_nm": int(round(height_mm * _NM_PER_MM)),
        "title_block": {
            "title": title,
            "date": str(context.get("release_date") or context.get("commit_date") or "—"),
            "rev": str(context.get("revision") or "—"),
            "company": "Prism Release Studio",
            "comments": comments,
        },
        "sheet_index": 1,
        "sheet_count": 1,
        "paper_name": paper_name,
        "file_name": f"{context.get('document_name') or context.get('document_number') or key}.pdf",
        "sheet_path": f"/{key}",
        "sheet_name": key,
        "kicad_version": generator or "KiCad",
    }
    elements = _drawing_sheet_elements(
        json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=False),
        prism_kicad_generator_digest(),
    )
    if style == PRISM_STYLE:
        return _prism_worksheet(
            elements,
            width_mm=width_mm,
            height_mm=height_mm,
            drop_generator=not generator,
        )
    return elements


@functools.lru_cache(maxsize=512)
def _drawing_sheet_elements(
    request_json: str, generator: str
) -> tuple[Line | Polyline | Rectangle | Text, ...]:
    """One ``drawing-sheet --request`` per distinct request and generator.

    The cache is keyed by the whole request, so every sheet of a document shares
    the entry for a page it repeats; *generator* keeps a swapped CLI from
    serving another binary's geometry.
    """

    from app.services.design_bundle import cli as bundle_cli

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        suffix=".json",
        prefix="prism-drawing-sheet-",
        delete=False,
    ) as handle:
        handle.write(request_json)
        path = handle.name
    try:
        document = bundle_cli.run(
            ["drawing-sheet", "--request", path],
            timeout_seconds=CLI_TIMEOUT_SECONDS,
            expect=_DRAWING_SHEET_SCHEMA,
        ).document
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    if document is None:  # pragma: no cover - the CLI contract guarantees one
        raise RuntimeError("prism-kicad drawing-sheet printed no document")
    return tuple(_convert_cli_op(op) for op in document["ops"])


def _convert_cli_op(op: Mapping[str, Any]) -> Line | Polyline | Rectangle | Text:
    kind = str(op.get("kind") or "")
    colour = _colour(op.get("stroke_color") or op.get("color"))

    if kind == "poly":
        points = tuple(
            (_mm(point["x_nm"]), _mm(point["y_nm"])) for point in op.get("points", ())
        )
        width = max(0.01, _mm(op.get("width_nm", 0)))
        if len(points) == 2:
            return Line(
                points[0][0],
                points[0][1],
                points[1][0],
                points[1][1],
                width=width,
                colour=colour,
            )
        return Polyline(
            points=points,
            width=width,
            colour=colour,
            close=bool(points and points[0] == points[-1]),
        )

    if kind == "rect":
        x1 = _mm(op.get("x1_nm", 0))
        y1 = _mm(op.get("y1_nm", 0))
        x2 = _mm(op.get("x2_nm", 0))
        y2 = _mm(op.get("y2_nm", 0))
        return Rectangle(
            Rect(min(x1, x2), min(y1, y2), abs(x2 - x1), abs(y2 - y1)),
            width=max(0.01, _mm(op.get("width_nm", 0))),
            colour=colour,
        )

    if kind == "text":
        anchor = {
            "GR_TEXT_H_ALIGN_CENTER": "middle",
            "GR_TEXT_H_ALIGN_RIGHT": "end",
        }.get(str(op.get("h_align") or ""), "start")
        # The default worksheet sets its text ``GR_TEXT_V_ALIGN_CENTER`` and the
        # layout model states text on its baseline, so ``y`` stays the centre
        # point here: ``_centred`` drops it by half a cap height for ``prism``,
        # and ``kicad`` keeps today's baseline-at-the-centre bytes.
        return Text(
            x=_mm(op.get("x_nm", 0)),
            y=_mm(op.get("y_nm", 0)),
            value=str(op.get("text") or ""),
            size=max(0.1, _mm(op.get("size_y_nm", 0))),
            anchor=anchor,
            family="display" if op.get("bold") else "sans",
            bold=bool(op.get("bold")),
            colour=_colour(op.get("color") or op.get("stroke_color")),
        )

    raise ValueError(f"unsupported prism-kicad worksheet operation: {kind}")


def _reset_drawing_sheet_cache() -> None:
    """Drop cached worksheet geometry (tests swap the CLI between cases)."""

    _drawing_sheet_elements.cache_clear()


def _mm(value: Any) -> float:
    return float(value or 0) / _NM_PER_MM


def _colour(value: Any) -> str:
    text = str(value or "#000000").strip()
    if not text.startswith("#"):
        return "#000000"
    if len(text) == 9:
        return text[:7]
    return text if len(text) in {4, 7} else "#000000"


# ---------------------------------------------------------------------------
# Prism style: same geometry, harness palette
# ---------------------------------------------------------------------------

_TOL = 0.05


def title_block_rect(
    elements: Sequence[Line | Polyline | Rectangle | Text],
    *,
    width_mm: float,
    height_mm: float,
) -> Rect | None:
    """The title block's rectangle, found from the worksheet's own geometry.

    The block is the small rectangle in the bottom-right corner.  Page-sized
    rectangles -- the two frame borders -- are excluded by size, so the same
    rule finds the block on A4 through A0 without a coordinate table.
    """

    candidates = [
        element.rect
        for element in elements
        if isinstance(element, Rectangle)
        and element.rect.width < width_mm * 0.6
        and element.rect.height < height_mm * 0.4
        and element.rect.x > width_mm * 0.5
        and element.rect.y > height_mm * 0.5
    ]
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda rect: (
            round(rect.right, 3),
            round(rect.bottom, 3),
            rect.width * rect.height,
        ),
    )


def _inside(rect: Rect, block: Rect) -> bool:
    return (
        block.x - _TOL <= rect.x
        and rect.right <= block.right + _TOL
        and block.y - _TOL <= rect.y
        and rect.bottom <= block.bottom + _TOL
    )


def _element_inside(
    element: Line | Polyline | Rectangle | Text, block: Rect
) -> bool:
    if isinstance(element, Rectangle):
        return _inside(element.rect, block)
    if isinstance(element, Line):
        return all(
            block.x - _TOL <= x <= block.right + _TOL
            and block.y - _TOL <= y <= block.bottom + _TOL
            for x, y in ((element.x1, element.y1), (element.x2, element.y2))
        )
    if isinstance(element, Polyline):
        return bool(element.points) and all(
            block.x - _TOL <= x <= block.right + _TOL
            and block.y - _TOL <= y <= block.bottom + _TOL
            for x, y in element.points
        )
    return (
        block.x - _TOL <= element.x <= block.right + _TOL
        and block.y - _TOL <= element.y <= block.bottom + _TOL
    )


def _dedupe(values: Sequence[float], tolerance: float = _TOL) -> list[float]:
    ordered: list[float] = []
    for value in sorted(values):
        if not ordered or abs(value - ordered[-1]) > tolerance:
            ordered.append(value)
    return ordered


def _inked(element):
    """The same element painted in ink, with its geometry untouched."""

    if isinstance(element, (Line, Rectangle, Polyline, Text)):
        return replace(element, colour=INK)
    return element


def _centred(element: Text, *, family: str, colour: str = INK, **changes: Any) -> Text:
    """*element* in one Prism face, its anchor moved from KiCad's centre to a baseline.

    KiCad's default drawing sheet sets every text vertically centred on its
    point (``GR_TEXT_V_ALIGN_CENTER``); Prism's layout draws text on its
    baseline. Dropping the baseline by half the cap height puts the ink where
    KiCad centres it, so each field sits in the middle of its cell. One face
    for labels and values: KiCad's bold fields (``Rev``, the company) would
    otherwise switch to the display face mid-block.
    """

    size = changes.get("size", element.size)
    cap = cap_height(size, role=family)
    return replace(
        element,
        y=element.y + cap / 2.0,
        family=family,
        bold=False,
        colour=colour,
        **changes,
    )


def _split_field(value: str) -> tuple[str | None, str]:
    """``"Size: A3"`` -> ``("Size:", "A3")``; a value without a label stays whole."""

    if ": " not in value:
        return None, value
    label, rest = value.split(": ", 1)
    return f"{label}:", rest


def _prism_worksheet(
    elements: Sequence[Line | Polyline | Rectangle | Text],
    *,
    width_mm: float,
    height_mm: float,
    drop_generator: bool,
) -> tuple[Line | Polyline | Rectangle | Text, ...]:
    """Recolour the worksheet and tint its title block."""

    block = title_block_rect(elements, width_mm=width_mm, height_mm=height_mm)
    if block is None:  # pragma: no cover - the default worksheet always has one
        return tuple(_inked(element) for element in elements)

    inside = [element for element in elements if _element_inside(element, block)]
    outside = [element for element in elements if not _element_inside(element, block)]

    horizontal = _dedupe(
        [block.y, block.bottom]
        + [
            element.y1
            for element in inside
            if isinstance(element, Line) and abs(element.y1 - element.y2) <= _TOL
        ]
    )
    vertical = [
        element
        for element in inside
        if isinstance(element, Line) and abs(element.x1 - element.x2) <= _TOL
    ]

    texts = [element for element in inside if isinstance(element, Text)]
    title_band: int | None = None
    for band_index, (top, bottom) in enumerate(zip(horizontal, horizontal[1:])):
        for element in texts:
            label, _rest = _split_field(element.value)
            if (
                label is not None
                and label.rstrip(":").strip().casefold() == "title"
                and top - _TOL <= element.y <= bottom + _TOL
            ):
                title_band = band_index
                break
        if title_band is not None:
            break
    if title_band is None:
        # No labelled title row: tint the tallest band, which is where a title
        # is set on a default worksheet.
        spans = list(zip(horizontal, horizontal[1:]))
        if spans:
            title_band = max(
                range(len(spans)), key=lambda index: spans[index][1] - spans[index][0]
            )

    body: list[Line | Polyline | Rectangle | Text] = [
        _centred(element, family="sans") if isinstance(element, Text) else _inked(element)
        for element in outside
    ]

    field_index = 0
    for band_index, (top, bottom) in enumerate(zip(horizontal, horizontal[1:])):
        if bottom - top <= _TOL:
            continue
        if band_index == title_band:
            fill = HEAD
        else:
            fill = STRIPE if field_index % 2 == 1 else None
            field_index += 1
        if fill is None:
            continue
        midpoint = (top + bottom) / 2.0
        dividers = _dedupe(
            [
                element.x1
                for element in vertical
                if min(element.y1, element.y2) - _TOL
                <= midpoint
                <= max(element.y1, element.y2) + _TOL
            ]
        )
        edges = _dedupe([block.x, *dividers, block.right])
        for left, right in zip(edges, edges[1:]):
            if right - left <= _TOL:
                continue
            body.append(
                Rectangle(
                    Rect(left, top, right - left, bottom - top),
                    width=0.0,
                    colour="none",
                    fill=fill,
                )
            )

    for y in horizontal:
        body.append(Line(block.x, y, block.right, y, width=0.15, colour=RULE))
    for line in vertical:
        body.append(
            Line(
                line.x1,
                min(line.y1, line.y2),
                line.x2,
                max(line.y1, line.y2),
                width=0.15,
                colour=RULE,
            )
        )
    body.append(Rectangle(block, width=0.3, colour=INK))

    for element in texts:
        value = element.value
        if not value.strip():
            continue
        if drop_generator and value.strip().casefold() == "kicad":
            continue
        label, rest = _split_field(value)
        if label is None or element.anchor != "start":
            body.append(_centred(element, family="sans"))
            continue
        title = label.rstrip(":").strip().casefold() == "title"
        body.append(_centred(element, value=label, family="sans", colour=MUTED))
        if not rest:
            continue
        offset = text_width(f"{label} ", element.size, family="sans", bold=False)
        body.append(
            _centred(
                element,
                value=rest,
                x=element.x + offset,
                family="display" if title else "sans",
                colour=INK,
            )
        )

    return tuple(body)


__all__ = ["default_worksheet_elements", "title_block_rect"]
