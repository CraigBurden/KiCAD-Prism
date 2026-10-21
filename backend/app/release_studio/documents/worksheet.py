"""Adapter from Monkey's public KiCad worksheet IR to Prism's sheet model.

Monkey owns ``.kicad_wks`` parsing, variable expansion, repeat behavior, page
visibility, and the default KiCad drawing-sheet geometry. Prism only translates
the emitted public Plotter operations into the shared SVG/PDF layout model.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Mapping, Sequence

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
    """Emit the pinned Monkey default worksheet as Prism layout elements.

    ``kicad`` returns the plotter's own red drawing sheet unchanged.  ``prism``
    keeps every coordinate and only changes how the same operations are painted:
    ink-black strokes and text, grey title-block structure, and the harness's
    header/stripe tints.  Recolouring here rather than in the producer means the
    style survives chunk F replacing Monkey with ``prism-kicad drawing-sheet``.
    """

    from kicad_monkey import drawing_sheet_to_ops, load_default_drawing_sheet

    extras = " · ".join(
        f"{field.label}: {field.value}" for field in extra_fields if field.value
    )
    comments = {
        1: f"Document: {context.get('document_name') or context.get('document_number') or '—'}",
        2: f"Commit: {str(context.get('commit_sha') or '')[:12] or '—'}",
        3: f"Variant: {context.get('variant') or 'default'}",
        4: extras,
    }
    generator = str(context.get("kicad_version") or "").strip()
    ops = drawing_sheet_to_ops(
        load_default_drawing_sheet(),
        paper_width_nm=int(round(width_mm * _NM_PER_MM)),
        paper_height_nm=int(round(height_mm * _NM_PER_MM)),
        title_block={
            "title": title,
            "date": str(context.get("release_date") or context.get("commit_date") or "—"),
            "rev": str(context.get("revision") or "—"),
            "company": "Prism Release Studio",
            "comments": comments,
        },
        sheet_index=1,
        sheet_count=1,
        paper_name=paper_name,
        filename=f"{context.get('document_name') or context.get('document_number') or key}.pdf",
        sheet_path=f"/{key}",
        sheet_name=key,
        kicad_version=generator or "KiCad",
    )
    elements = tuple(_convert_op(op) for op in ops if _supported_op(op))
    if style == PRISM_STYLE:
        return _prism_worksheet(
            elements,
            width_mm=width_mm,
            height_mm=height_mm,
            drop_generator=not generator,
        )
    return elements


def _supported_op(op: Any) -> bool:
    kind = op.kind.value if hasattr(op.kind, "value") else str(op.kind)
    return kind in {"PlotPoly", "Rect", "Text"}


def _convert_op(op: Any) -> Line | Polyline | Rectangle | Text:
    kind = op.kind.value if hasattr(op.kind, "value") else str(op.kind)
    payload = op.payload
    colour = _colour(payload.get("stroke_color") or payload.get("color"))

    if kind == "PlotPoly":
        points = tuple(
            (_mm(point[0]), _mm(point[1])) for point in payload.get("points", ())
        )
        width = max(0.01, _mm(payload.get("width_nm", 0)))
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

    if kind == "Rect":
        x1 = _mm(payload.get("x1", 0))
        y1 = _mm(payload.get("y1", 0))
        x2 = _mm(payload.get("x2", 0))
        y2 = _mm(payload.get("y2", 0))
        return Rectangle(
            Rect(min(x1, x2), min(y1, y2), abs(x2 - x1), abs(y2 - y1)),
            width=max(0.01, _mm(payload.get("width_nm", 0))),
            colour=colour,
        )

    if kind == "Text":
        anchor = {
            "GR_TEXT_H_ALIGN_CENTER": "middle",
            "GR_TEXT_H_ALIGN_RIGHT": "end",
        }.get(str(payload.get("h_align") or ""), "start")
        return Text(
            x=_mm(payload.get("x", 0)),
            y=_mm(payload.get("y", 0)),
            value=str(payload.get("text") or ""),
            size=max(0.1, _mm(payload.get("size_y_nm", 0))),
            anchor=anchor,
            family="display" if payload.get("bold") else "sans",
            bold=bool(payload.get("bold")),
            colour=_colour(payload.get("color") or payload.get("stroke_color")),
        )

    raise ValueError(f"unsupported Monkey worksheet operation: {kind}")


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
        _inked(element) for element in outside
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
            body.append(replace(element, colour=INK))
            continue
        body.append(
            Text(
                x=element.x,
                y=element.y,
                value=label,
                size=element.size,
                anchor=element.anchor,
                family=element.family,
                bold=False,
                colour=MUTED,
                rotation=element.rotation,
            )
        )
        if not rest:
            continue
        offset = text_width(
            f"{label} ",
            element.size,
            family=element.family,
            bold=False,
        )
        body.append(
            Text(
                x=element.x + offset,
                y=element.y,
                value=rest,
                size=element.size,
                anchor=element.anchor,
                family=element.family,
                bold=element.bold,
                colour=INK,
                rotation=element.rotation,
            )
        )

    return tuple(body)


__all__ = ["default_worksheet_elements", "title_block_rect"]
