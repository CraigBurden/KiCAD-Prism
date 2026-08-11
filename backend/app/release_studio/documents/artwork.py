"""Board artwork acquisition and placement (D3).

Prism never re-implements KiCad's plotter.  Artwork is acquired by running
``kicad-cli`` and then *placed*: the SVG backend inlines the emitted geometry
inside a transformed group, and the PDF backend composites KiCad's own PDF page
onto the composed sheet with pikepdf.  In both cases the geometry that reaches
the released drawing is exactly the geometry KiCad produced.

The scale contract is explicit and testable.  ``kicad-cli pcb export svg``
emits a user-unit-per-millimetre document, so a placement at scale *s* means
one board millimetre occupies *s* sheet millimetres; a sheet claiming 1:1 must
measure 50.000 mm across a 50.000 mm board feature.
"""

from __future__ import annotations

import hashlib
import io
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from app.release_studio.documents.layout import Artwork, Rect

_SVG_OPEN = re.compile(r"<svg\b[^>]*>", re.IGNORECASE | re.DOTALL)
_SVG_CLOSE = re.compile(r"</svg\s*>\s*$", re.IGNORECASE)

# `kicad-cli pcb export svg` writes
#   <title>SVG Image created as board.svg date 2026-08-11T17:09:53 </title>
# which carries both the output filename and the plot time. Inlining that into
# a composed sheet makes the sheet vary per build, and hashing it makes the
# clip-path id vary too -- so it is removed at acquisition rather than left for
# a downstream canonicalizer to catch in a nested position.
_KICAD_TITLE = re.compile(
    r"<title>\s*SVG Image created as\b.*?</title>", re.IGNORECASE | re.DOTALL
)
_DATED_COMMENT = re.compile(
    r"<!--(?:(?!-->).)*?(?:date|created|generated|timestamp)(?:(?!-->).)*-->",
    re.IGNORECASE | re.DOTALL,
)


def sanitize_artwork_pdf(payload: bytes) -> bytes:
    """Strip plot-time metadata from an acquired artwork PDF.

    KiCad writes ``/Producer (KiCad PDF)`` and ``/CreationDate``; with those
    removed its output is byte-identical across runs, which is what lets a
    composed sheet carrying that artwork have a stable released digest.
    """

    import pikepdf

    try:
        with pikepdf.open(io.BytesIO(payload)) as document:
            for key in list(document.docinfo.keys()):
                del document.docinfo[key]
            with document.open_metadata(set_pikepdf_as_editor=False) as meta:
                meta.clear()
            out = io.BytesIO()
            document.save(out, deterministic_id=True, linearize=False)
            return out.getvalue()
    except Exception:  # noqa: BLE001 - an unreadable overlay is handled upstream
        return payload


def sanitize_artwork(svg_text: str) -> str:
    """Remove plot-time metadata from acquired artwork.

    Semantically null by construction: it deletes a title and comments, never
    geometry, so the placed drawing is the same drawing.
    """

    cleaned = _KICAD_TITLE.sub("", svg_text)
    return _DATED_COMMENT.sub("", cleaned)
_VIEWBOX = re.compile(r'viewBox\s*=\s*"([^"]+)"', re.IGNORECASE)
_WIDTH = re.compile(r'\bwidth\s*=\s*"([0-9.]+)([a-z]*)"', re.IGNORECASE)
_HEIGHT = re.compile(r'\bheight\s*=\s*"([0-9.]+)([a-z]*)"', re.IGNORECASE)

# `kicad-cli pcb export svg` writes user units per millimetre; anything else
# would make the scale contract below wrong, so it is asserted, not assumed.
_UNIT_TO_MM = {"mm": 1.0, "cm": 10.0, "in": 25.4, "pt": 25.4 / 72.0, "": 1.0}


class ArtworkError(RuntimeError):
    """Artwork could not be acquired or understood."""


@dataclass(frozen=True, slots=True)
class AcquiredArtwork:
    """One plotted view of the board, with the geometry needed to place it.

    Two coordinate frames are recorded because ``kicad-cli`` gives the two
    formats different pages.  ``pcb export svg --page-size-mode 2`` crops to the
    plotted content, so the SVG's frame *is* the artwork's extent.  ``pcb export
    pdf`` has no such option -- verified against the pinned 10.0.4 CLI -- so its
    page is the board's configured page size with the artwork sitting somewhere
    inside it.  ``page_offset_*`` locates the artwork within that page, which is
    what lets the PDF composite land at the same scale and position as the SVG
    instead of shrinking the whole page into the artwork's window.
    """

    layers: tuple[str, ...]
    svg_text: str
    pdf_bytes: bytes
    #: The artwork's own extents in millimetres.
    view_x: float
    view_y: float
    view_width: float
    view_height: float
    digest: str
    #: Where the artwork's top-left sits on the PDF page, in millimetres from
    #: that page's top-left.  ``None`` when it could not be established, in
    #: which case the PDF composite is skipped rather than placed wrongly.
    page_offset_x: float | None = None
    page_offset_y: float | None = None

    @property
    def body(self) -> str:
        """The artwork's contents with its own ``<svg>`` wrapper removed."""

        opened = _SVG_OPEN.search(self.svg_text)
        if opened is None:
            raise ArtworkError("acquired artwork is not an SVG document")
        inner = self.svg_text[opened.end():]
        return _SVG_CLOSE.sub("", inner).strip()


def acquire(
    cli_path: str,
    board: Path,
    layers: Sequence[str],
    workdir: Path,
    *,
    variant: str = "",
    black_and_white: bool = True,
    runner=subprocess.run,
) -> AcquiredArtwork:
    """Plot *layers* of *board* to SVG and PDF via ``kicad-cli``.

    Both formats come from the same invocation set so the SVG placed in an SVG
    sheet and the PDF composited into a PDF sheet show the same geometry.
    ``--exclude-drawing-sheet`` matters: the composed sheet supplies its own
    frame, and KiCad's would collide with it.
    """

    workdir.mkdir(parents=True, exist_ok=True)
    stem = "-".join(layer.replace(".", "_") for layer in layers) or "board"
    svg_path = workdir / f"{stem}.svg"
    page_svg_path = workdir / f"{stem}-page.svg"
    pdf_path = workdir / f"{stem}.pdf"

    # Three plots of one view.  The cropped SVG is the artwork; the PDF is what
    # gets composited; the full-page SVG exists only to locate the artwork
    # inside the PDF's page, because `pcb export pdf` cannot crop.
    plots = (
        ("svg", svg_path, ("--exclude-drawing-sheet", "--page-size-mode", "2")),
        ("svg", page_svg_path, ("--exclude-drawing-sheet",)),
        ("pdf", pdf_path, ()),
    )
    for fmt, out, extra in plots:
        argv = [
            cli_path, "pcb", "export", fmt,
            "--layers", ",".join(layers),
            # `--mode-single` makes `--output` a file rather than a directory.
            "--mode-single",
            "--output", str(out),
        ]
        # Verified against the pinned 10.0.4 CLI: `pcb export svg` takes
        # `--exclude-drawing-sheet` and `--page-size-mode`, while `pcb export
        # pdf` takes neither and omits the border unless asked.  There is no
        # `--svgprecision` on `pcb export` at all -- that flag belongs to the
        # schematic exporter.
        argv.extend(extra)
        if black_and_white:
            argv.append("--black-and-white")
        if variant:
            argv.extend(["--variant", variant])
        argv.append(str(board))

        result = runner(argv, capture_output=True, text=True)
        if getattr(result, "returncode", 1) != 0:
            # kicad-cli reports argument errors on stdout, so a stderr-only
            # message would be empty exactly when it is most needed.
            detail = " ".join(
                part.strip()
                for part in (
                    getattr(result, "stderr", "") or "",
                    getattr(result, "stdout", "") or "",
                )
                if part and part.strip()
            )
            raise ArtworkError(
                f"kicad-cli pcb export {fmt} failed for layers {','.join(layers)}: "
                f"{detail[:400]}"
            )
        if not out.is_file():
            raise ArtworkError(f"kicad-cli produced no {fmt} for layers {','.join(layers)}")

    svg_text = sanitize_artwork(svg_path.read_text(encoding="utf-8"))
    pdf_bytes = sanitize_artwork_pdf(pdf_path.read_bytes())
    x, y, width, height = extents(svg_text)
    offset = page_offset(svg_text, page_svg_path.read_text(encoding="utf-8"))
    return AcquiredArtwork(
        layers=tuple(layers),
        svg_text=svg_text,
        pdf_bytes=pdf_bytes,
        view_x=x,
        view_y=y,
        view_width=width,
        view_height=height,
        # Hashed *after* sanitizing: this digest becomes the clip-path id in the
        # composed sheet, so a volatile input here would move the sheet even
        # when the geometry is identical.
        digest=hashlib.sha256(svg_text.encode("utf-8")).hexdigest(),
        page_offset_x=offset[0] if offset else None,
        page_offset_y=offset[1] if offset else None,
    )


_PATH_DATA = re.compile(r'\bd\s*=\s*"([^"]*)"', re.IGNORECASE)
# Each subpath's move-to, whatever separator the plotter used.  KiCad writes
# `M 0.0000,0.0000` for filled shapes and `M126.0000 90.0000` for strokes, so a
# comma-only reader finds nothing at all on an outline-only plot -- which is
# exactly the drill sheet.
_MOVE_TO = re.compile(r"[Mm]\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)")


def _coordinate_pairs(svg_text: str, limit: int = 64) -> list[tuple[float, float]]:
    """The first *limit* subpath origins in the document's path data.

    Move-to points are enough: the two plots being compared contain the same
    subpaths in the same order, so their origins differ by exactly the crop
    translation and nothing else has to be parsed.
    """

    pairs: list[tuple[float, float]] = []
    for match in _PATH_DATA.finditer(svg_text):
        for pair in _MOVE_TO.finditer(match.group(1)):
            pairs.append((float(pair.group(1)), float(pair.group(2))))
            if len(pairs) >= limit:
                return pairs
    return pairs


def acquire_drill_map(
    cli_path: str,
    board: Path,
    workdir: Path,
    *,
    runner=subprocess.run,
) -> AcquiredArtwork:
    """Plot the drill map -- hole symbols, outline, and symbol key.

    A drill drawing that shows only the board outline documents nothing, and
    the holes are not a layer that ``pcb export svg`` can plot.  They come from
    ``pcb export drill --generate-map``, which writes a full page in both
    formats, so the placement extent is measured from the plotted ink rather
    than taken from a crop KiCad cannot perform here.

    The symbol key below the board is deliberately inside the placed extent:
    it is what tells a reader which mark is which diameter, and the sheet's own
    drill schedule does not carry the symbols.
    """

    workdir.mkdir(parents=True, exist_ok=True)
    outputs: dict[str, Path] = {}
    for fmt in ("svg", "pdf"):
        target = workdir / fmt
        target.mkdir(parents=True, exist_ok=True)
        argv = [
            cli_path, "pcb", "export", "drill",
            "--generate-map", "--map-format", fmt,
            "--output", f"{target}/",
            str(board),
        ]
        result = runner(argv, capture_output=True, text=True)
        if getattr(result, "returncode", 1) != 0:
            detail = " ".join(
                part.strip()
                for part in (
                    getattr(result, "stderr", "") or "",
                    getattr(result, "stdout", "") or "",
                )
                if part and part.strip()
            )
            raise ArtworkError(f"kicad-cli pcb export drill failed: {detail[:400]}")
        found = sorted(target.glob(f"*drl_map.{fmt}"))
        if not found:
            raise ArtworkError(f"kicad-cli produced no drill map in {fmt}")
        outputs[fmt] = found[0]

    svg_text = sanitize_artwork(outputs["svg"].read_text(encoding="utf-8"))
    pdf_bytes = sanitize_artwork_pdf(outputs["pdf"].read_bytes())
    extent = ink_extent(svg_text)
    if extent is None:
        raise ArtworkError("the drill map carries no plotted geometry")
    x, y, width, height = extent
    return AcquiredArtwork(
        layers=("Drill.Map",),
        svg_text=svg_text,
        pdf_bytes=pdf_bytes,
        view_x=x,
        view_y=y,
        view_width=width,
        view_height=height,
        digest=hashlib.sha256(svg_text.encode("utf-8")).hexdigest(),
        # Both formats are the same full page, so the ink sits at the same
        # place in each and no cross-plot comparison is needed.
        page_offset_x=x,
        page_offset_y=y,
    )


# One SVG path command letter, or one number.
_PATH_TOKEN = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)")
#: Parameters each path command consumes, per SVG 1.1.
_PATH_ARITY = {
    "m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4, "q": 4, "t": 2, "a": 7, "z": 0,
}
_STROKE_WIDTH = re.compile(r"stroke-width\s*:\s*([0-9.]+)", re.IGNORECASE)
_CIRCLE = re.compile(
    r'<circle\b[^>]*\bcx\s*=\s*"([-0-9.]+)"[^>]*\bcy\s*=\s*"([-0-9.]+)"'
    r'[^>]*\br\s*=\s*"([0-9.]+)"',
    re.IGNORECASE,
)


def _path_points(data: str) -> list[tuple[float, float, float]]:
    """Absolute ``(x, y, pad)`` points a path visits.

    ``pad`` is how far the drawn curve may bulge past that point: zero for a
    line, the arc radius for an arc.  Bounding an arc by its endpoints alone
    would clip a circle in half, and solving arcs exactly buys nothing here --
    over-reaching only pads the placement, while under-reaching cuts ink off.
    """

    points: list[tuple[float, float, float]] = []
    numbers: list[float] = []
    command = ""
    x = y = 0.0

    for token in _PATH_TOKEN.finditer(data):
        letter, number = token.group(1), token.group(2)
        if letter is not None:
            command = letter
            numbers = []
            continue
        if not command:
            continue
        numbers.append(float(number))
        arity = _PATH_ARITY.get(command.lower(), 0)
        if arity == 0 or len(numbers) < arity:
            continue

        chunk, numbers = numbers, []
        lower = command.lower()
        relative = command.islower()
        radius = 0.0
        if lower == "h":
            x = x + chunk[0] if relative else chunk[0]
        elif lower == "v":
            y = y + chunk[0] if relative else chunk[0]
        else:
            if lower == "a":
                radius = max(abs(chunk[0]), abs(chunk[1]))
            dx, dy = chunk[-2], chunk[-1]
            x = x + dx if relative else dx
            y = y + dy if relative else dy
        points.append((x, y, radius))

        # Repeated parameter sets continue the same command, except that a
        # move-to's repeats are line-tos -- which is exactly how KiCad writes
        # a polyline: one `M`, then bare coordinate pairs.
        if lower == "m":
            command = "l" if relative else "L"

    return points


def ink_extent(svg_text: str) -> tuple[float, float, float, float] | None:
    """The drawn extent of *svg_text*, in millimetres, or ``None`` if empty.

    Needed where ``kicad-cli`` cannot crop for us.  ``pcb export drill`` always
    writes a full page, so the only way to place a drill map beside a board
    drawn at a stated ratio is to measure where its ink actually is.
    """

    try:
        units = user_units_per_mm(svg_text)
    except ArtworkError:
        return None
    if units <= 0:
        return None

    widths = [float(match.group(1)) for match in _STROKE_WIDTH.finditer(svg_text)]
    pad = (max(widths) / 2.0) if widths else 0.0

    xs: list[float] = []
    ys: list[float] = []

    def note(x: float, y: float, radius: float) -> None:
        xs.extend((x - radius - pad, x + radius + pad))
        ys.extend((y - radius - pad, y + radius + pad))

    for match in _PATH_DATA.finditer(svg_text):
        for x, y, radius in _path_points(match.group(1)):
            note(x, y, radius)
    for match in _CIRCLE.finditer(svg_text):
        note(float(match.group(1)), float(match.group(2)), float(match.group(3)))

    if not xs:
        return None
    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)
    return left / units, top / units, (right - left) / units, (bottom - top) / units


def page_offset(cropped_svg: str, page_svg: str) -> tuple[float, float] | None:
    """Where the cropped artwork sits on the full page, in millimetres.

    The two documents are the same plot of the same layers, so their geometry
    differs by exactly the crop translation.  Reading that translation off the
    coordinates is exact, and it is the only way to learn it -- ``pcb export
    pdf`` cannot crop, and nothing in the PDF says where the ink is.

    Returns ``None`` rather than a guess when the two plots do not line up, so
    the caller can skip the composite instead of placing artwork wrongly.
    """

    try:
        cropped_units = user_units_per_mm(cropped_svg)
        page_units = user_units_per_mm(page_svg)
    except ArtworkError:
        return None
    if cropped_units <= 0 or page_units <= 0:
        return None

    cropped = _coordinate_pairs(cropped_svg)
    full = _coordinate_pairs(page_svg)
    if not cropped or len(cropped) != len(full):
        return None
    # Both documents are read in their own user units; the comparison is only
    # meaningful in millimetres.
    deltas = {
        (round(fx / page_units - cx / cropped_units, 3),
         round(fy / page_units - cy / cropped_units, 3))
        for (cx, cy), (fx, fy) in zip(cropped, full)
    }
    if len(deltas) != 1:
        return None
    return deltas.pop()


def extents(svg_text: str) -> tuple[float, float, float, float]:
    """Return the artwork's ``(x, y, width, height)`` in millimetres.

    The viewBox gives the user-unit extents and the ``width``/``height``
    attributes give the same extents in real units; their ratio is the
    user-units-per-millimetre factor.  Reading both is what makes the scale
    contract checkable rather than assumed.
    """

    opened = _SVG_OPEN.search(svg_text)
    if opened is None:
        raise ArtworkError("artwork is not an SVG document")
    header = opened.group(0)

    box = _VIEWBOX.search(header)
    if box is None:
        raise ArtworkError("artwork has no viewBox and cannot be placed")
    try:
        vx, vy, vw, vh = (float(part) for part in box.group(1).replace(",", " ").split())
    except ValueError as exc:
        raise ArtworkError(f"artwork viewBox is unreadable: {box.group(1)!r}") from exc
    if vw <= 0 or vh <= 0:
        raise ArtworkError("artwork viewBox has no area")

    width_attr = _WIDTH.search(header)
    height_attr = _HEIGHT.search(header)
    if width_attr is None or height_attr is None:
        # No physical size to check against; the viewBox is then taken as
        # millimetres, which is what kicad-cli emits.
        return vx, vy, vw, vh

    width_mm = float(width_attr.group(1)) * _UNIT_TO_MM.get(width_attr.group(2).lower(), 1.0)
    height_mm = float(height_attr.group(1)) * _UNIT_TO_MM.get(height_attr.group(2).lower(), 1.0)
    if width_mm <= 0 or height_mm <= 0:
        raise ArtworkError("artwork declares a non-positive physical size")

    # Report extents in millimetres so callers reason in one unit only.
    return vx * width_mm / vw, vy * height_mm / vh, width_mm, height_mm


def user_units_per_mm(svg_text: str) -> float:
    """How many artwork user units make one millimetre."""

    opened = _SVG_OPEN.search(svg_text)
    if opened is None:
        raise ArtworkError("artwork is not an SVG document")
    header = opened.group(0)
    box = _VIEWBOX.search(header)
    width_attr = _WIDTH.search(header)
    if box is None or width_attr is None:
        return 1.0
    _vx, _vy, vw, _vh = (float(part) for part in box.group(1).replace(",", " ").split())
    width_mm = float(width_attr.group(1)) * _UNIT_TO_MM.get(width_attr.group(2).lower(), 1.0)
    if width_mm <= 0:
        raise ArtworkError("artwork declares a non-positive width")
    return vw / width_mm


def place(
    art: AcquiredArtwork,
    window: Rect,
    *,
    scale: float | None = None,
    label: str = "",
) -> tuple[Artwork, float]:
    """Place *art* inside *window*, returning the element and the scale used.

    With ``scale`` given, the placement is at exactly that ratio and the caller
    is responsible for the artwork fitting -- a drawing labelled 1:1 must be
    1:1 even if that means it overruns.  With ``scale`` omitted, the largest
    ratio that fits is chosen and reported back so the sheet can state it.
    """

    if art.view_width <= 0 or art.view_height <= 0:
        raise ArtworkError("artwork has no extent to place")

    if scale is None:
        scale = min(window.width / art.view_width, window.height / art.view_height)
    if scale <= 0:
        raise ArtworkError(f"invalid artwork scale: {scale}")

    # Centre the artwork in its window, then undo the artwork's own origin.
    drawn_width = art.view_width * scale
    drawn_height = art.view_height * scale
    left = window.x + (window.width - drawn_width) / 2
    top = window.y + (window.height - drawn_height) / 2

    units = user_units_per_mm(art.svg_text)
    # `scale` is sheet-mm per board-mm; the group transform works in the
    # artwork's user units, so convert once here.
    group_scale = scale / units
    return (
        Artwork(
            rect=window,
            scale=group_scale,
            offset_x=left - art.view_x * scale,
            offset_y=top - art.view_y * scale,
            source_digest=art.digest,
            svg_body=art.body,
            label=label,
        ),
        scale,
    )


def scale_label(scale: float) -> str:
    """Render a placement ratio the way a drawing states it."""

    def trim(value: float) -> str:
        text = f"{value:.3f}".rstrip("0").rstrip(".")
        return text or "0"

    if abs(scale - 1.0) < 1e-9:
        return "1:1"
    if scale > 1.0:
        return f"{trim(scale)}:1"
    return f"1:{trim(1 / scale)}"


def composite_pdf(sheet_pdf: bytes, art: AcquiredArtwork, window: Rect, scale: float) -> bytes:
    """Stamp KiCad's own artwork PDF onto a composed sheet page.

    Keeping the artwork as a composited PDF page rather than re-drawing it
    preserves KiCad's geometry exactly, which is the same guarantee the SVG
    path gives by inlining the emitted markup.

    The placement is computed for the *artwork*, not for the page that carries
    it.  Fitting the overlay page into the artwork's window -- which is what
    the obvious `calc_form_xobject_placement` call does -- puts the board on
    the sheet at the ratio of board to page, roughly eight times smaller than
    the ``SCALE`` the sheet states, and disagreeing with the SVG rendering of
    the same sheet.
    """

    import pikepdf

    from app.release_studio.documents.pdf import MM_TO_PT

    if art.page_offset_x is None or art.page_offset_y is None:
        raise ArtworkError(
            "the artwork's position on its PDF page is unknown; the composite "
            "would be placed at the wrong scale"
        )
    if art.view_width <= 0 or art.view_height <= 0:
        raise ArtworkError("artwork has no extent to place")

    with pikepdf.open(io.BytesIO(sheet_pdf)) as base, pikepdf.open(
        io.BytesIO(art.pdf_bytes)
    ) as overlay:
        if len(overlay.pages) == 0:
            raise ArtworkError("artwork PDF has no pages")
        page = base.pages[0]
        source = overlay.pages[0]

        drawn_width = art.view_width * scale
        drawn_height = art.view_height * scale
        left = window.x + (window.width - drawn_width) / 2
        top = window.y + (window.height - drawn_height) / 2

        media = page.mediabox
        sheet_height_pt = float(media[3]) - float(media[1])

        source_box = source.mediabox
        source_x0 = float(source_box[0])
        source_y1 = float(source_box[3])

        # The artwork's top-left on the overlay page, expressed in that page's
        # own PDF coordinates (origin bottom-left).
        art_x_pt = source_x0 + art.page_offset_x * MM_TO_PT
        art_top_pt = source_y1 - art.page_offset_y * MM_TO_PT
        art_bottom_pt = art_top_pt - art.view_height * MM_TO_PT

        # Target: the same artwork corner, on the sheet, at the stated ratio.
        target_x_pt = left * MM_TO_PT
        target_bottom_pt = sheet_height_pt - (top + drawn_height) * MM_TO_PT

        # `scale` is sheet-millimetres per board-millimetre, and both pages are
        # in points, so it is also the point-to-point factor.
        tx = target_x_pt - scale * art_x_pt
        ty = target_bottom_pt - scale * art_bottom_pt

        # `Page.add_overlay` invents a *random* XObject resource name, which
        # would make the composed sheet's bytes differ on every render even
        # though the drawing is identical. Placing the form explicitly under a
        # fixed name is the same operation with a name we control.
        form = source.as_form_xobject()
        name = pikepdf.Name("/PrismArtwork")
        page.add_resource(form, pikepdf.Name("/XObject"), name=name)

        def number(value: float) -> str:
            text = f"{round(value, 4):.4f}".rstrip("0").rstrip(".")
            return text or "0"

        # Clip to the window so the rest of the overlay page -- which is mostly
        # empty, but is a whole A-series page -- cannot spill over the frame,
        # the title block, or the tables.
        clip = (
            f"{number(window.x * MM_TO_PT)} "
            f"{number(sheet_height_pt - window.bottom * MM_TO_PT)} "
            f"{number(window.width * MM_TO_PT)} {number(window.height * MM_TO_PT)} re W n"
        )
        page.contents_add(
            (
                f"q\n{clip}\n"
                f"{number(scale)} 0 0 {number(scale)} {number(tx)} {number(ty)} cm\n"
                "/PrismArtwork Do\nQ\n"
            ).encode("ascii")
        )

        # KiCad's PDF carries /CreationDate and a Producer banner; strip
        # anything the copy may have brought across.
        for key in ("/CreationDate", "/ModDate", "/Producer", "/Creator"):
            if key in base.docinfo:
                del base.docinfo[key]

        out = io.BytesIO()
        base.save(out, deterministic_id=True, linearize=False)
        return out.getvalue()
