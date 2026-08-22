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
import math
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Mapping, Sequence

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
    #: True when the PDF page *is* the artwork viewport (a Cruncher view
    #: rendered by :func:`render_pdf_page`): the whole page is the drawing,
    #: and its declared size is intentional -- never a stray frame that
    #: ``content_view`` should second-guess.
    page_is_viewport: bool = False

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
    # inside the PDF's page, because `pcb export pdf` cannot crop.  They share
    # no output path, so they run together rather than queueing three board
    # loads behind each other.
    plots = (
        ("svg", svg_path, ("--exclude-drawing-sheet", "--page-size-mode", "2")),
        ("svg", page_svg_path, ("--exclude-drawing-sheet",)),
        ("pdf", pdf_path, ()),
    )

    def _plot(fmt: str, out: Path, extra: tuple[str, ...]) -> None:
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

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(_plot, fmt, out, extra) for fmt, out, extra in plots]
        for future in futures:
            future.result()

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


#: Prism's own Cruncher view configuration, checked in beside this module.
#:
#: It is passed with ``--config`` so Cruncher never writes a template next to
#: the board: a config the build created would put a build output inside the
#: input closure, and the closure digest would then depend on the build.
PCB_SVG_CONFIG = Path(__file__).with_name("pcb-svg.config.json")

#: The testpoint views, which need a per-board component map (see its own
#: ``_prism`` note for why it cannot share the assembly configuration).
PCB_SVG_TESTPOINT_CONFIG = Path(__file__).with_name("pcb-svg.testpoints.config.json")

#: Cruncher view name per assembly side.
ASSEMBLY_VIEWS: dict[str, str] = {
    "top": "assembly_top_view",
    "bottom": "assembly_bottom_view",
}

#: The same board with only the testpoints labelled.
TESTPOINT_VIEWS: dict[str, str] = {
    "top": "testpoint_top_view",
    "bottom": "testpoint_bottom_view",
}

#: Every view kind Prism's checked-in Cruncher configuration declares.
VIEW_KINDS: dict[str, dict[str, str]] = {
    "assembly": ASSEMBLY_VIEWS,
    "testpoint": TESTPOINT_VIEWS,
}

#: What Cruncher *actually* drew each component from.
#:
#: Deliberately not ``data-projection``, which records the mode the config
#: asked for and is therefore the same string on every component whether or not
#: a model resolved.  ``data-bounds-kind`` is the outcome -- ``model``,
#: ``holes`` or ``pads`` -- which is the only one of the two that can tell a
#: reader whether this is the HLR drawing the sheet claims to be.
_BOUNDS_KIND_ATTR = re.compile(r'\bdata-bounds-kind\s*=\s*"([^"]+)"', re.IGNORECASE)

#: Sides with at least this many placements get a density warning.  Density is
#: scale-invariant: past this, one sheet cannot carry every designator legibly,
#: and detail/zone sheets are the real answer (not yet generated).
DENSE_PLACEMENT_WARN = 400


def assembly_projection_mix(svg_text: str) -> dict[str, int]:
    """Count what each component in one assembly SVG was actually drawn from.

    ``model`` is the 3D model's own silhouette -- the drawing this sheet is
    meant to be.  ``holes`` and ``pads`` are the rectangular fallbacks Cruncher
    substitutes, per component, when no model resolves for that footprint.
    """

    counts: dict[str, int] = {}
    for match in _BOUNDS_KIND_ATTR.finditer(svg_text or ""):
        key = match.group(1).strip() or "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts


def assembly_projection_warnings(side: str, mix: Mapping[str, int]) -> list[str]:
    """Warn when components fell back to a bounding box instead of the model.

    The fallback is correct behaviour, not a failure -- a part with no 3D model
    has no silhouette to draw.  It is still worth stating: a reader comparing
    the sheet against the boards in front of them should know which outlines
    are the part and which are a box around it.
    """

    total = sum(mix.values())
    if total <= 0:
        return []
    boxed = int(mix.get("pads") or 0) + int(mix.get("holes") or 0)
    if boxed <= 0:
        return []
    if boxed == total:
        return [
            f"assembly {side}: no component resolved a 3D model; all {total} are "
            "drawn as bounding boxes (check that the models are embedded or that "
            "${KIPRJMOD} resolves)"
        ]
    if boxed / total >= 0.10:
        return [
            f"assembly {side}: {boxed}/{total} components have no 3D model and are "
            "drawn as bounding boxes"
        ]
    return []


def assembly_density_warnings(side: str, placement_count: int) -> list[str]:
    """Warn when one sheet cannot honestly carry every designator."""

    if placement_count < DENSE_PLACEMENT_WARN:
        return []
    return [
        f"assembly {side}: {placement_count} placements — designators may be "
        "incomplete at any scale; detail/zone sheets are not yet generated; "
        "positions.csv remains authoritative"
    ]


@dataclass(frozen=True, slots=True)
class BoardRender:
    """A raytraced isometric picture of the board, for the cover."""

    png_bytes: bytes
    width_px: int
    height_px: int
    digest: str

    @property
    def aspect(self) -> float:
        return (self.width_px / self.height_px) if self.height_px else 1.0


def acquire_board_render(
    cli_path: str,
    board: Path,
    workdir: Path,
    *,
    width: int = 1200,
    height: int = 900,
    runner=subprocess.run,
    timeout_seconds: int = 600,
) -> BoardRender:
    """Render the board the way the project thumbnail is rendered.

    `kicad-cli pcb render` is KiCad's own raytracer, and this is deliberately
    the same invocation `project_import_service.generate_thumbnail_for_project`
    uses -- same quality, floor, perspective and rotation -- so the picture on
    a release cover is recognisably the picture of the project.
    """

    workdir.mkdir(parents=True, exist_ok=True)
    out = workdir / "board.png"
    argv = [
        cli_path, "pcb", "render",
        "--quality", "high",
        "--floor",
        "--perspective",
        "--rotate", "-45,0,45",
        "--width", str(width),
        "--height", str(height),
        "-o", str(out),
        str(board),
    ]
    try:
        result = runner(argv, capture_output=True, text=True, timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        raise ArtworkError(
            f"kicad-cli pcb render timed out after {timeout_seconds}s"
        ) from exc
    if getattr(result, "returncode", 1) != 0 or not out.is_file():
        detail = " ".join(
            part.strip()
            for part in (
                getattr(result, "stderr", "") or "", getattr(result, "stdout", "") or ""
            )
            if part and part.strip()
        )
        raise ArtworkError(f"kicad-cli pcb render failed: {detail[:400]}")

    payload = out.read_bytes()
    from PIL import Image as PILImage

    with PILImage.open(io.BytesIO(payload)) as image:
        size = image.size
    return BoardRender(
        png_bytes=payload,
        width_px=int(size[0]),
        height_px=int(size[1]),
        digest=hashlib.sha256(payload).hexdigest(),
    )


def testpoint_config(
    designators: Sequence[str],
    workdir: Path,
    *,
    prefix: str = "TP",
    base: Path | None = None,
) -> Path:
    """Write the testpoint configuration for one board, and return its path.

    Cruncher draws a component's outline unless that component says otherwise,
    and it has no wildcard for saying so -- ``components`` is keyed by exact
    designator.  So "only the testpoints" is written as every other designator
    switched off.  The map is a pure function of the board's sorted designator
    list, which keeps two builds of one board byte-identical here.
    """

    import json

    source = base or PCB_SVG_TESTPOINT_CONFIG
    if not source.is_file():
        raise ArtworkError(f"the Prism testpoint configuration is missing: {source}")
    config = json.loads(source.read_text(encoding="utf-8"))
    marker = prefix.strip().upper()
    config["components"] = {
        designator: {"assembly_hlr": {"enabled": False}}
        for designator in sorted({str(d).strip() for d in designators if str(d).strip()})
        if not designator.strip().upper().startswith(marker)
    }
    workdir.mkdir(parents=True, exist_ok=True)
    written = workdir / "pcb-svg.testpoints.generated.json"
    written.write_text(
        json.dumps(config, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )
    return written


def acquire_testpoint_views(
    cruncher_path: str,
    board: Path,
    workdir: Path,
    *,
    designators: Sequence[str] = (),
    sides: Sequence[str] = ("top", "bottom"),
    runner=subprocess.run,
    timeout_seconds: int = 900,
) -> dict[str, AcquiredArtwork]:
    """Render the testpoint views, keyed ``"testpoint-<side>"``."""

    views = []
    for side in sides:
        view = TESTPOINT_VIEWS.get(side)
        if view is None:
            raise ArtworkError(f"unknown testpoint side: {side!r}")
        views.append(view)
    if not views:
        return {}

    workdir.mkdir(parents=True, exist_ok=True)
    config = testpoint_config(designators, workdir)
    _run_pcb_svg(
        cruncher_path, board, views, workdir,
        config_path=config, runner=runner, timeout_seconds=timeout_seconds,
    )
    return {
        f"testpoint-{side}": _read_assembly_view(
            workdir, f"testpoint-{side}", TESTPOINT_VIEWS[side]
        )
        for side in sides
    }


def acquire_board_views(
    cruncher_path: str,
    board: Path,
    workdir: Path,
    *,
    kinds: Sequence[str] = ("assembly",),
    sides: Sequence[str] = ("top", "bottom"),
    config_path: Path | None = None,
    runner=subprocess.run,
    timeout_seconds: int = 900,
) -> dict[str, AcquiredArtwork]:
    """Render every requested view in **one** Cruncher invocation.

    Keyed ``"<kind>-<side>"``.

    Loading the board dominates: on a 35 MB ``.kicad_pcb`` it is ~70 s against
    a couple of seconds to render one more view off the same load.  So every
    view Prism wants is declared in the one checked-in configuration and asked
    for together -- the testpoint views cost the render, not another load.
    """

    wanted: dict[str, str] = {}
    for kind in kinds:
        views = VIEW_KINDS.get(kind)
        if views is None:
            raise ArtworkError(f"unknown view kind: {kind!r}")
        for side in sides:
            view = views.get(side)
            if view is None:
                raise ArtworkError(f"unknown {kind} side: {side!r}")
            wanted[f"{kind}-{side}"] = view
    if not wanted:
        return {}

    workdir.mkdir(parents=True, exist_ok=True)
    _run_pcb_svg(
        cruncher_path,
        board,
        list(wanted.values()),
        workdir,
        config_path=config_path,
        runner=runner,
        timeout_seconds=timeout_seconds,
    )
    return {
        key: _read_assembly_view(workdir, key, view)
        for key, view in wanted.items()
    }


def acquire_assembly_view(
    cruncher_path: str,
    board: Path,
    side: str,
    workdir: Path,
    *,
    config_path: Path | None = None,
    runner=subprocess.run,
    timeout_seconds: int = 900,
) -> AcquiredArtwork:
    """Render one assembly view with ``kicad-cruncher pcb-svg``.

    KiCad's ``F.Fab`` layer is authored per footprint, so plotting it faithfully
    reproduces whatever size and offset each library chose -- on a dense board
    that is an illegible mass of overlapping text at every scale, because
    density does not change with scale.  Cruncher instead fits exactly one
    designator into each component's own bounds over a hidden-line-removed
    outline, which is the drawing an assembler actually uses.

    Cruncher's SVG is placed exactly as it was emitted, which is why this
    returns the same :class:`AcquiredArtwork` a ``kicad-cli`` plot does: the
    assembly view then travels the one placement path every other view uses.
    The PDF is that same document rendered by cairo, so both serializations of
    the sheet carry Cruncher's drawing rather than an interpretation of it.

    Loading a large board can take the better part of a minute, hence the
    generous timeout; it is bounded so a wedged render fails the sheet rather
    than the job's whole time budget.
    """

    view = ASSEMBLY_VIEWS.get(side)
    if view is None:
        raise ArtworkError(f"unknown assembly side: {side!r}")

    workdir.mkdir(parents=True, exist_ok=True)
    _run_pcb_svg(
        cruncher_path,
        board,
        [view],
        workdir,
        config_path=config_path,
        runner=runner,
        timeout_seconds=timeout_seconds,
    )
    return _read_assembly_view(workdir, side, view)


def _run_pcb_svg(
    cruncher_path: str,
    board: Path,
    views: Sequence[str],
    workdir: Path,
    *,
    config_path: Path | None,
    runner,
    timeout_seconds: int,
) -> None:
    """Invoke ``kicad-cruncher pcb-svg`` for *views* and check it succeeded."""

    config = config_path or PCB_SVG_CONFIG
    if not config.is_file():
        raise ArtworkError(f"the Prism pcb-svg configuration is missing: {config}")

    named = ",".join(views)
    argv = [
        cruncher_path, "pcb-svg", str(board),
        "--config", str(config),
        "--views", named,
        "--output", str(workdir),
    ]
    # KiCad resolves ``${KIPRJMOD}/packages3D/...`` against the project
    # directory that contains the board.  Without this binding Geometer cannot
    # open STEPs that are already present in the closed tree.
    env = os.environ.copy()
    env["KIPRJMOD"] = str(Path(board).resolve().parent)
    try:
        result = runner(
            argv, capture_output=True, text=True, timeout=timeout_seconds, env=env
        )
    except subprocess.TimeoutExpired as exc:
        raise ArtworkError(
            f"kicad-cruncher pcb-svg timed out after {timeout_seconds}s for {named}"
        ) from exc
    if getattr(result, "returncode", 1) != 0:
        detail = " ".join(
            part.strip()
            for part in (
                getattr(result, "stderr", "") or "", getattr(result, "stdout", "") or ""
            )
            if part and part.strip()
        )
        raise ArtworkError(f"kicad-cruncher pcb-svg failed for {named}: {detail[:400]}")


def _read_assembly_view(workdir: Path, label: str, view: str) -> AcquiredArtwork:
    """Turn one written Cruncher view into placeable artwork.

    ``label`` names the view on the sheet (``assembly-top``, ``testpoint-top``,
    or a bare side for the single-view path).
    """

    found = sorted((workdir / "views").glob(f"*__{view}.svg"))
    if not found:
        raise ArtworkError(f"kicad-cruncher produced no {view}")

    # Cruncher's A0-style canvas carries wide margins and hidden white
    # markers; crop to the drawn board so the shared package scale fits.
    svg_text = crop_viewport_to_ink(found[0].read_text(encoding="utf-8"))
    x, y, width, height = extents(svg_text)
    return AcquiredArtwork(
        layers=(f"Cruncher.{label}",),
        svg_text=svg_text,
        pdf_bytes=render_pdf_page(svg_text),
        view_x=x,
        view_y=y,
        view_width=width,
        view_height=height,
        digest=hashlib.sha256(svg_text.encode("utf-8")).hexdigest(),
        # The rendered page *is* the view: cairo sizes it from the SVG's own
        # viewport, so the artwork's top-left is the page's top-left.
        page_offset_x=0.0,
        page_offset_y=0.0,
        page_is_viewport=True,
    )


def render_pdf_page(svg_text: str) -> bytes:
    """Render *svg_text* to a one-page PDF whose page is the SVG's viewport.

    Used where the producing tool emits SVG only.  cairo draws the document it
    is given -- paths stay paths and text stays text -- so this is a change of
    container, not of content, and the PDF sheet shows the same drawing the SVG
    sheet does.
    """

    import cairosvg

    try:
        return cairosvg.svg2pdf(bytestring=svg_text.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - any cairo failure is one failure here
        raise ArtworkError(f"the assembly view could not be rendered to PDF: {exc}") from exc


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


#: How each bounds kind is described on a sheet, best first.  Cruncher's own
#: vocabulary is terse enough to mislead -- "pads" on a drawing would read as a
#: layer, not as "this outline is a box around the pads".
BOUNDS_KIND_LABELS: dict[str, str] = {
    "model": "3D model outline",
    "holes": "hole bounds",
    "pads": "pad bounds",
}


def assembly_projection_label(mix: Mapping[str, int]) -> str:
    """Compact statement of what the components on a sheet were drawn from."""

    ordered = ("model", "holes", "pads", "unknown")
    parts: list[str] = []
    seen: set[str] = set()
    for key in ordered:
        count = int(mix.get(key) or 0)
        if count <= 0:
            continue
        parts.append(f"{BOUNDS_KIND_LABELS.get(key, key)} {count}")
        seen.add(key)
    for key, count in sorted(mix.items()):
        if key in seen or int(count or 0) <= 0:
            continue
        parts.append(f"{key} {int(count)}")
    return " · ".join(parts)


#: ISO A-series sheet sizes in millimetres (portrait).  Landscape is the swap.
_ISO_A_SHEETS: tuple[tuple[float, float], ...] = (
    (1189.0, 841.0),
    (841.0, 594.0),
    (594.0, 420.0),
    (420.0, 297.0),
    (297.0, 210.0),
    (210.0, 148.0),
)


def looks_like_drawing_sheet(width: float, height: float, *, tol: float = 2.0) -> bool:
    """True when *width*×*height* matches an ISO A drawing sheet."""

    for sheet_w, sheet_h in _ISO_A_SHEETS:
        if (
            abs(width - sheet_w) <= tol and abs(height - sheet_h) <= tol
        ) or (
            abs(width - sheet_h) <= tol and abs(height - sheet_w) <= tol
        ):
            return True
    return False


def content_view(
    art: AcquiredArtwork,
    board_width: float = 0.0,
    board_height: float = 0.0,
) -> AcquiredArtwork:
    """Prefer content bounds when the declared SVG frame is a drawing sheet.

    ``kicad-cli`` / Cruncher sometimes emit a page-sized viewport with the board
    drawn inside it.  Placing that page at 1:1 leaves the board looking tiny in
    an empty artwork window.  Ink bounds (or the board outline as a last resort)
    keep placement honest without changing the SVG body.
    """

    page_like = looks_like_drawing_sheet(art.view_width, art.view_height)
    oversized = (
        board_width > 0
        and board_height > 0
        and (
            art.view_width > board_width * 1.75
            or art.view_height > board_height * 1.75
        )
        and (
            art.view_width > board_width + 40.0
            or art.view_height > board_height + 40.0
        )
    )
    if not page_like and not oversized:
        return art
    # A Cruncher view's canvas is the drawing itself (render_pdf_page makes
    # the PDF page exactly this viewport).  Its margins are deliberate; the
    # ink box of a transformed, partially-clipped document is not a better
    # frame, and trusting one desynchronises the PDF composite from the page
    # it stamps.
    if art.page_is_viewport:
        return art

    ink = ink_extent(art.svg_text)
    if ink is not None:
        left, top, width, height = ink
        if width > 0 and height > 0:
            ink_still_page = looks_like_drawing_sheet(width, height) or (
                board_width > 0
                and board_height > 0
                and (
                    width > board_width * 1.75
                    or height > board_height * 1.75
                )
                and (
                    width > board_width + 40.0
                    or height > board_height + 40.0
                )
            )
            if not ink_still_page:
                return replace(
                    art,
                    view_x=left,
                    view_y=top,
                    view_width=width,
                    view_height=height,
                )

    if board_width > 0 and board_height > 0:
        cx = art.view_x + art.view_width / 2.0
        cy = art.view_y + art.view_height / 2.0
        return replace(
            art,
            view_x=cx - board_width / 2.0,
            view_y=cy - board_height / 2.0,
            view_width=board_width,
            view_height=board_height,
        )
    return art


def _fmt_mm(value: float) -> str:
    """Compact millimetre figure matching the rest of the document engine."""

    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return text or "0"


def crop_viewport_to_ink(svg_text: str, margin_mm: float = 5.0) -> str:
    """Shrink *svg_text*\'s viewport to its drawn content plus ``margin_mm``.

    Cruncher\'s explicit A0-style views emit a canvas much larger than the
    board -- sized for on-screen panning, not for placement.  A canvas bigger
    than the board breaks the sheet set: the shared package scale is chosen
    against the board, so an oversized canvas overruns the artwork window and
    the released PDF shows only a clipped slice of the drawing.

    The crop rewrites only the ``viewBox``/``width``/``height`` attributes;
    every element keeps its own coordinates.  Ink is measured with ancestor
    transforms applied, because Cruncher nests rotated designators inside
    per-component groups whose local coordinates say nothing about where the
    ink lands.  Content outside the declared viewport is already invisible to
    any renderer, so the measured box is intersected with it.
    """

    import xml.etree.ElementTree as ET

    opened = _SVG_OPEN.search(svg_text)
    if opened is None:
        return svg_text
    header = opened.group(0)
    box = _VIEWBOX.search(header)
    size_w = _WIDTH.search(header)
    size_h = _HEIGHT.search(header)
    if box is None or size_w is None or size_h is None:
        return svg_text

    try:
        vx, vy, vw, vh = (float(p) for p in box.group(1).replace(",", " ").split())
        width_mm = float(size_w.group(1)) * _UNIT_TO_MM.get(size_w.group(2).lower(), 1.0)
        height_mm = float(size_h.group(1)) * _UNIT_TO_MM.get(size_h.group(2).lower(), 1.0)
        if vw <= 0 or vh <= 0 or width_mm <= 0 or height_mm <= 0:
            return svg_text
    except ValueError:
        return svg_text

    units = vw / width_mm  # user units per millimetre

    widths = [float(m.group(1)) for m in _STROKE_WIDTH.finditer(svg_text)]
    pad_user = (max(widths) / 2.0) if widths else 0.0

    xs: list[float] = []
    ys: list[float] = []

    def note(x: float, y: float, radius: float) -> None:
        xs.extend((x - radius - pad_user, x + radius + pad_user))
        ys.extend((y - radius - pad_user, y + radius + pad_user))

    def matrix_for(element: ET.Element) -> list[float]:
        tf = element.get("transform")
        m = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
        if not tf:
            return m
        for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", tf):
            v = [float(p) for p in re.split(r"[\s,]+", args.strip()) if p]
            if name == "translate":
                t = (1.0, 0.0, 0.0, 1.0, v[0], v[1] if len(v) > 1 else 0.0)
            elif name == "scale":
                sx = v[0]
                sy = v[1] if len(v) > 1 else v[0]
                t = (sx, 0.0, 0.0, sy, 0.0, 0.0)
            elif name == "rotate":
                angle = math.radians(v[0])
                cos_a, sin_a = math.cos(angle), math.sin(angle)
                if len(v) == 3:
                    cx, cy = v[1], v[2]
                    t = (
                        cos_a, sin_a, -sin_a, cos_a,
                        cx - (cos_a * cx - sin_a * cy),
                        cy - (sin_a * cx + cos_a * cy),
                    )
                else:
                    t = (cos_a, sin_a, -sin_a, cos_a, 0.0, 0.0)
            elif name == "matrix" and len(v) == 6:
                t = tuple(v)
            else:
                continue
            m = [
                m[0] * t[0] + m[1] * t[2], m[0] * t[1] + m[1] * t[3],
                m[2] * t[0] + m[3] * t[2], m[2] * t[1] + m[3] * t[3],
                m[4] * t[0] + m[5] * t[2] + t[4],
                m[4] * t[1] + m[5] * t[3] + t[5],
            ]
        return m

    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError:
        return svg_text

    _INVISIBLE = {"none", "", "white", "#fff", "#ffffff"}

    def resolve_paint(element: ET.Element, inherited: tuple[str, str]) -> tuple[str, str]:
        style = {}
        raw_style = element.get("style")
        if raw_style:
            style = dict(
                (k.strip().lower(), v.strip())
                for k, v in (
                    part.split(":", 1) for part in raw_style.split(";") if ":" in part
                )
            )
        fill = element.get("fill") or style.get("fill") or inherited[0] or "black"
        stroke = element.get("stroke") or style.get("stroke") or inherited[1] or "none"
        return fill.lower(), stroke.lower()

    def paints(fill: str, stroke: str) -> bool:
        """True when this shape shows anything on a white sheet."""

        return (fill not in _INVISIBLE) or (stroke not in _INVISIBLE)

    def walk(element: ET.Element, matrix: list[float], paint: tuple[str, str]) -> None:
        local = matrix_for(element)
        m = [
            matrix[0] * local[0] + matrix[1] * local[2],
            matrix[0] * local[1] + matrix[1] * local[3],
            matrix[2] * local[0] + matrix[3] * local[2],
            matrix[2] * local[1] + matrix[3] * local[3],
            matrix[4] * local[0] + matrix[5] * local[2] + local[4],
            matrix[4] * local[1] + matrix[5] * local[3] + local[5],
        ]
        ink_paint = resolve_paint(element, paint)

        def apply(x: float, y: float) -> tuple[float, float]:
            return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])

        stretch = max(math.hypot(m[0], m[1]), math.hypot(m[2], m[3]))

        tag = element.tag.rsplit("}", 1)[-1]
        if paints(*ink_paint):
            if tag == "circle":
                cx = float(element.get("cx", "0"))
                cy = float(element.get("cy", "0"))
                r = float(element.get("r", "0"))
                X, Y = apply(cx, cy)
                note(X, Y, r * stretch)
            elif tag == "path":
                for x_pt, y_pt, radius in _path_points(element.get("d", "")):
                    X, Y = apply(x_pt, y_pt)
                    note(X, Y, radius * stretch)
            elif tag == "polygon":
                pairs = re.findall(
                    r"(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)",
                    element.get("points", ""),
                )
                for px, py in pairs:
                    X, Y = apply(float(px), float(py))
                    note(X, Y, 0.0)
            elif tag == "text":
                X, Y = apply(
                    float(element.get("x", "0")), float(element.get("y", "0"))
                )
                probe = element.get("font-size") or element.get("style", "")
                font = re.search(r"([0-9.]+)", probe)
                note(X, Y, (float(font.group(1)) if font else 1.6) * 0.7 * stretch)

        for child in element:
            walk(child, m, ink_paint)

    walk(root, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], ("black", "none"))
    if not xs:
        return svg_text

    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)

    margin_user = margin_mm * units
    new_x = max(vx, left - margin_user)
    new_y = max(vy, top - margin_user)
    new_right = min(vx + vw, right + margin_user)
    new_bottom = min(vy + vh, bottom + margin_user)
    if new_right - new_x < vw * 0.05 or new_bottom - new_y < vh * 0.05:
        # Degenerate measurement: keep the original viewport rather than
        # cropping to something unusable.
        return svg_text

    new_vw = new_right - new_x
    new_vh = new_bottom - new_y

    new_header = _VIEWBOX.sub(
        f'viewBox="{_fmt_mm(new_x)} {_fmt_mm(new_y)} {_fmt_mm(new_vw)} {_fmt_mm(new_vh)}"',
        header,
    )
    new_header = _WIDTH.sub(f'width="{_fmt_mm(new_vw / units)}mm"', new_header, count=1)
    new_header = _HEIGHT.sub(f'height="{_fmt_mm(new_vh / units)}mm"', new_header, count=1)
    return svg_text[: opened.start()] + new_header + svg_text[opened.end():]


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


def composite_pdf(
    sheet_pdf: bytes,
    art: AcquiredArtwork,
    window: Rect,
    scale: float,
    *,
    page_index: int = 0,
) -> bytes:
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
        if page_index >= len(base.pages):
            raise ArtworkError(
                f"page {page_index + 1} does not exist in a "
                f"{len(base.pages)}-page document"
            )
        page = base.pages[page_index]
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

        if art.page_is_viewport:
            # The overlay page *is* the artwork viewport: stamp the whole
            # page, exactly where the SVG backend draws the same document.
            # Anchoring by `view_*` here would desynchronise the two backends
            # whenever a caller narrowed the view (content_view) without
            # changing the physical page.
            art_x_pt = source_x0
            art_top_pt = source_y1
            art_bottom_pt = float(source_box[1])
        else:
            # The artwork's top-left on the overlay page, expressed in that
            # page's own PDF coordinates (origin bottom-left).
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
        name = pikepdf.Name(f"/PrismArtwork{page_index}")
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
                f"/PrismArtwork{page_index} Do\nQ\n"
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
