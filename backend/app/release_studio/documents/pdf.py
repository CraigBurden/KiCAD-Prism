"""Deterministic PDF writer for composed sheets (D2).

Writes the sheet furniture -- frame, title block, tables, notes -- as a single
page using only the base-14 fonts, so nothing has to be embedded and no new
dependency is introduced.  Board artwork is *not* redrawn here: it is acquired
from ``kicad-cli`` as PDF and overlaid by
:mod:`app.release_studio.documents.artwork`, which keeps KiCad's plotter as the
only thing that ever renders copper.

The file carries no ``/CreationDate``, no ``/Producer`` and a fixed ``/ID``, so
two renders of the same sheet are byte-identical before canonicalization ever
runs.
"""

from __future__ import annotations

from app.release_studio.documents.layout import (
    Artwork,
    Line,
    Polyline,
    Rectangle,
    Sheet,
    Text,
    text_width,
)

MM_TO_PT = 72.0 / 25.4

_FONTS = {
    ("sans", False): ("F1", "Helvetica"),
    ("sans", True): ("F2", "Helvetica-Bold"),
    ("mono", False): ("F3", "Courier"),
    ("mono", True): ("F4", "Courier-Bold"),
}


def _pt(value: float) -> str:
    """Format a point value; PDF operators are whitespace-separated numbers."""

    rounded = round(float(value), 3)
    if rounded == 0:
        rounded = 0.0
    text = f"{rounded:.3f}".rstrip("0").rstrip(".")
    return text or "0"


def _rgb(colour: str) -> tuple[float, float, float]:
    value = colour.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return (0.0, 0.0, 0.0)
    return tuple(int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def _escape_pdf_text(value: str) -> bytes:
    """Encode a string literal for a base-14 font.

    The fonts are declared ``/WinAnsiEncoding``, so the bytes must be cp1252 --
    not Latin-1.  The difference is not academic: the em dash the tables use for
    an absent value, and the ellipsis `fit_text` appends, both exist in WinAnsi
    and neither exists in Latin-1, so encoding as Latin-1 turned every one of
    them into a literal ``?`` while the SVG rendering of the same sheet showed
    it correctly.
    """

    encoded = value.encode("cp1252", errors="replace")
    out = bytearray()
    for byte in encoded:
        if byte in (0x28, 0x29, 0x5C):  # ( ) \
            out.append(0x5C)
        out.append(byte)
    return bytes(out)


def render_pdf(sheet: Sheet) -> bytes:
    """Serialize *sheet* to a one-page PDF."""

    height_pt = sheet.height * MM_TO_PT
    width_pt = sheet.width * MM_TO_PT

    def y(value: float) -> float:
        """Flip millimetre-from-top into PDF points-from-bottom."""

        return height_pt - value * MM_TO_PT

    def x(value: float) -> float:
        return value * MM_TO_PT

    ops: list[str] = ["1 J", "1 j"]  # round caps and joins
    used_fonts: set[tuple[str, bool]] = set()

    # A white page: a released drawing must not depend on the viewer's theme.
    ops.append("1 1 1 rg")
    ops.append(f"0 0 {_pt(width_pt)} {_pt(height_pt)} re f")

    for element in sheet.elements:
        if isinstance(element, Line):
            r, g, b = _rgb(element.colour)
            ops.append(f"{_pt(r)} {_pt(g)} {_pt(b)} RG")
            ops.append(f"{_pt(element.width * MM_TO_PT)} w")
            ops.append(
                f"{_pt(x(element.x1))} {_pt(y(element.y1))} m "
                f"{_pt(x(element.x2))} {_pt(y(element.y2))} l S"
            )
        elif isinstance(element, Rectangle):
            rect = element.rect
            ops.append(f"{_pt(element.width * MM_TO_PT)} w")
            painted = ""
            if element.fill != "none":
                fr, fg, fb = _rgb(element.fill)
                ops.append(f"{_pt(fr)} {_pt(fg)} {_pt(fb)} rg")
                painted = "f"
            if element.colour != "none":
                r, g, b = _rgb(element.colour)
                ops.append(f"{_pt(r)} {_pt(g)} {_pt(b)} RG")
                painted = "B" if painted else "S"
            ops.append(
                f"{_pt(x(rect.x))} {_pt(y(rect.bottom))} "
                f"{_pt(rect.width * MM_TO_PT)} {_pt(rect.height * MM_TO_PT)} re {painted or 'n'}"
            )
        elif isinstance(element, Polyline):
            r, g, b = _rgb(element.colour)
            ops.append(f"{_pt(r)} {_pt(g)} {_pt(b)} RG")
            ops.append(f"{_pt(element.width * MM_TO_PT)} w")
            if element.points:
                first = element.points[0]
                ops.append(f"{_pt(x(first[0]))} {_pt(y(first[1]))} m")
                for px, py in element.points[1:]:
                    ops.append(f"{_pt(x(px))} {_pt(y(py))} l")
                ops.append("h S" if element.close else "S")
        elif isinstance(element, Text):
            key = (element.family, element.bold)
            used_fonts.add(key)
            resource, _name = _FONTS[key]
            # PDF has no text-anchor, so alignment is resolved here from the
            # same metrics the SVG backend relies on the renderer to apply.
            width = text_width(
                element.value, element.size, family=element.family, bold=element.bold
            )
            start = element.x
            if element.anchor == "middle":
                start -= width / 2
            elif element.anchor == "end":
                start -= width
            r, g, b = _rgb(element.colour)
            ops.append("BT")
            ops.append(f"{_pt(r)} {_pt(g)} {_pt(b)} rg")
            ops.append(f"/{resource} {_pt(element.size * MM_TO_PT)} Tf")
            ops.append(f"1 0 0 1 {_pt(x(start))} {_pt(y(element.y))} Tm")
            literal = _escape_pdf_text(element.value).decode("latin-1")
            ops.append(f"({literal}) Tj")
            ops.append("ET")
        elif isinstance(element, Artwork):
            # Placeholder outline only. Real artwork is stamped in by the
            # overlay step, which composites KiCad's own PDF onto this page.
            ops.append("0.6 0.6 0.6 RG")
            ops.append(f"{_pt(0.2 * MM_TO_PT)} w")
            rect = element.rect
            ops.append(
                f"{_pt(x(rect.x))} {_pt(y(rect.bottom))} "
                f"{_pt(rect.width * MM_TO_PT)} {_pt(rect.height * MM_TO_PT)} re S"
            )
        else:  # pragma: no cover - guarded by the layout element union
            raise TypeError(f"unrenderable sheet element: {type(element).__name__}")

    content = "\n".join(ops).encode("latin-1", errors="replace")
    return _assemble(content, width_pt, height_pt, used_fonts)


def _assemble(
    content: bytes,
    width_pt: float,
    height_pt: float,
    used_fonts: set[tuple[str, bool]],
) -> bytes:
    """Build the PDF object graph with a fixed, content-independent trailer."""

    # Always emit every base-14 font: making the resource dictionary depend on
    # which fonts a sheet happened to use would make byte output vary with
    # content in a way that is invisible and annoying to diff.
    _ = used_fonts
    font_objects = sorted(_FONTS.items(), key=lambda item: item[1][0])

    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    font_ids: dict[str, int] = {}
    for _key, (resource, base_font) in font_objects:
        font_ids[resource] = add(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /"
            + base_font.encode("ascii")
            + b" /Encoding /WinAnsiEncoding >>"
        )

    content_id = add(
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n"
        + content
        + b"\nendstream"
    )

    resources = b"<< /Font << " + b" ".join(
        b"/" + resource.encode("ascii") + b" " + str(font_ids[resource]).encode("ascii") + b" 0 R"
        for resource, _ in sorted(font_ids.items())
    ) + b" >> >>"

    pages_id = len(objects) + 2  # page object is next, pages after it
    page_id = add(
        b"<< /Type /Page /Parent " + str(pages_id).encode("ascii") + b" 0 R"
        b" /MediaBox [0 0 " + _pt(width_pt).encode("ascii") + b" "
        + _pt(height_pt).encode("ascii") + b"]"
        b" /Resources " + resources
        + b" /Contents " + str(content_id).encode("ascii") + b" 0 R >>"
    )
    add(
        b"<< /Type /Pages /Kids [" + str(page_id).encode("ascii") + b" 0 R] /Count 1 >>"
    )
    catalog_id = add(b"<< /Type /Catalog /Pages " + str(pages_id).encode("ascii") + b" 0 R >>")

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(index).encode("ascii") + b" 0 obj\n" + body + b"\nendobj\n"

    xref_at = len(out)
    count = len(objects) + 1
    out += b"xref\n0 " + str(count).encode("ascii") + b"\n"
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("ascii")

    # A fixed /ID and no /Info: an identical sheet must produce identical bytes,
    # and a creation date would defeat that before canonicalization saw it.
    out += (
        b"trailer\n<< /Size " + str(count).encode("ascii")
        + b" /Root " + str(catalog_id).encode("ascii") + b" 0 R"
        b" /ID [<00000000000000000000000000000000>"
        b" <00000000000000000000000000000000>] >>\n"
        b"startxref\n" + str(xref_at).encode("ascii") + b"\n%%EOF\n"
    )
    return bytes(out)
