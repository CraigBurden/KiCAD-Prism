"""Deterministic SVG serializer for composed sheets (D1).

The output carries no date, no generator banner, and no generated identifiers,
so two renders of the same :class:`~app.release_studio.documents.layout.Sheet`
are byte-identical.  That is what lets a composed drawing be a released member
with a stable ``released_digest`` rather than something re-derived on demand.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

from app.release_studio.documents.layout import (
    Artwork,
    Line,
    Polyline,
    Rectangle,
    Sheet,
    Text,
    fmt,
)

_FONT_FAMILY = {
    "sans": "Helvetica, Arial, sans-serif",
    "mono": "Courier New, Courier, monospace",
}


def render_svg(sheet: Sheet) -> str:
    """Serialize *sheet* to a standalone SVG document."""

    parts: list[str] = [
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{fmt(sheet.width)}mm" height="{fmt(sheet.height)}mm" '
        f'viewBox="0 0 {fmt(sheet.width)} {fmt(sheet.height)}">',
        # A title is content, not metadata: it survives canonicalization and
        # identifies the sheet to anyone opening the file directly.
        f"<title>{escape(sheet.title)}</title>",
        f'<rect x="0" y="0" width="{fmt(sheet.width)}" height="{fmt(sheet.height)}" '
        'fill="#ffffff"/>',
    ]
    for element in sheet.elements:
        parts.append(_render_element(element))
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def _render_element(element) -> str:
    if isinstance(element, Line):
        return (
            f'<line x1="{fmt(element.x1)}" y1="{fmt(element.y1)}" '
            f'x2="{fmt(element.x2)}" y2="{fmt(element.y2)}" '
            f'stroke="{element.colour}" stroke-width="{fmt(element.width)}"/>'
        )
    if isinstance(element, Rectangle):
        rect = element.rect
        return (
            f'<rect x="{fmt(rect.x)}" y="{fmt(rect.y)}" '
            f'width="{fmt(rect.width)}" height="{fmt(rect.height)}" '
            f'fill="{element.fill}" stroke="{element.colour}" '
            f'stroke-width="{fmt(element.width)}"/>'
        )
    if isinstance(element, Text):
        weight = ' font-weight="bold"' if element.bold else ""
        return (
            f'<text x="{fmt(element.x)}" y="{fmt(element.y)}" '
            f'font-family="{_FONT_FAMILY[element.family]}" '
            f'font-size="{fmt(element.size)}" text-anchor="{element.anchor}" '
            f'fill="{element.colour}"{weight}>{escape(element.value)}</text>'
        )
    if isinstance(element, Polyline):
        points = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in element.points)
        tag = "polygon" if element.close else "polyline"
        return (
            f'<{tag} points="{points}" fill="{element.fill}" '
            f'stroke="{element.colour}" stroke-width="{fmt(element.width)}"/>'
        )
    if isinstance(element, Artwork):
        return _render_artwork(element)
    raise TypeError(f"unrenderable sheet element: {type(element).__name__}")


def _render_artwork(artwork: Artwork) -> str:
    """Place acquired artwork inside a clipped, transformed group.

    The artwork keeps its own coordinate system; only the group transform maps
    it onto the sheet, so the placed geometry is exactly what ``kicad-cli``
    emitted rather than something re-projected by us.
    """

    rect = artwork.rect
    clip_id = f"clip-{artwork.source_digest[:16]}"
    body = artwork.svg_body or ""
    return "\n".join(
        [
            f'<clipPath id="{clip_id}"><rect x="{fmt(rect.x)}" y="{fmt(rect.y)}" '
            f'width="{fmt(rect.width)}" height="{fmt(rect.height)}"/></clipPath>',
            f'<g clip-path="url(#{clip_id})">',
            f'<g transform="translate({fmt(artwork.offset_x)},{fmt(artwork.offset_y)}) '
            f'scale({fmt(artwork.scale)})">',
            body,
            "</g></g>",
        ]
    )
