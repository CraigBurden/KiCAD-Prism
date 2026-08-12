"""Compose the documentation sheets into released members (D6-D8, D10).

This is the Documentation Engine's seam with Stage 1: it is a *member producer*.
It adds files to the dossier under the ``documentation`` domain and changes
nothing about the digest graph, the policy engine, or the approval model.

Artwork acquisition is optional by design.  Without ``kicad-cli`` the sheets
still compose -- frame, tables, notes, and a stated absence where the artwork
would be -- because a build that cannot plot copper should still produce the
document set and say what is missing, rather than fail.
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from app.release_studio.documents import notes as note_templates
from app.release_studio.documents import sheets as sheet_templates
from app.release_studio.documents.artwork import (
    AcquiredArtwork,
    ArtworkError,
    acquire,
    acquire_board_render,
    acquire_board_views,
    acquire_drill_map,
    assembly_density_warnings,
    assembly_projection_mix,
    assembly_projection_warnings,
    composite_pdf,
    content_view,
)
from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY, typography_preset
from app.release_studio.documents.layout import Rect, Sheet
from app.release_studio.documents.pdf import render_pdf_pages
from app.release_studio.documents.svg import render_svg

logger = logging.getLogger(__name__)

DOCUMENT_DOMAIN = "documentation"

# Which layers each sheet plots. Kept here rather than in the templates so the
# sheet code stays about layout and this stays about what KiCad is asked for.
#
# The assembly sheets are deliberately absent. Plotting `F.Fab` reproduces text
# authored per footprint at whatever size and offset each library chose, which
# on a dense board overlaps into an unreadable mass at every scale -- density
# does not change with scale. Those views come from Cruncher instead, below.
ARTWORK_LAYERS: dict[str, tuple[str, ...]] = {
    "fabrication": ("Edge.Cuts", "F.Cu"),
}

#: The board's raytraced isometric view, for the cover.
#:
#: The same `kicad-cli pcb render` the project thumbnail uses, so the picture on
#: a release cover is the picture of the project.
BOARD_RENDER_KEY = "board-render"

#: Technical layers plotted after the copper ones, in the order a reader walks
#: a board: what is on it, what covers it, what is cut out of it.
_TECHNICAL_LAYERS: tuple[str, ...] = (
    "F.Silkscreen",
    "B.Silkscreen",
    "F.Mask",
    "B.Mask",
    "F.Paste",
    "B.Paste",
    "Edge.Cuts",
)


def _layer_artwork_key(layer: str) -> str:
    return f"layer:{layer}"


def _layer_page_key(layer: str) -> str:
    return f"fabrication-{layer.replace('.', '_')}"


def fabrication_layers(stackup: Mapping[str, Any]) -> tuple[str, ...]:
    """Every layer the fabrication document gives a page to, outside in.

    Copper comes from the board's own stackup so a twelve-layer board gets
    twelve copper pages in stack order rather than a guessed `F.Cu`/`B.Cu`
    pair; the technical layers follow in a fixed order.
    """

    copper: list[str] = []
    for layer in (stackup.get("layers") or []) if isinstance(stackup, Mapping) else []:
        name = str(layer.get("name") or "").strip()
        kind = str(layer.get("type") or layer.get("kind") or "").strip().lower()
        if not name or not name.endswith(".Cu"):
            continue
        if kind and "copper" not in kind:
            continue
        if name not in copper:
            copper.append(name)
    return tuple(copper) + _TECHNICAL_LAYERS

#: The drill sheet's artwork is not a layer plot: holes are not a layer, so the
#: view comes from `pcb export drill --generate-map` instead.
DRILL_ARTWORK_KEY = "drill"

#: Assembly views come from `kicad-cruncher pcb-svg`, which fits one designator
#: into each component's own bounds over a hidden-line-removed outline.
ASSEMBLY_SIDES: tuple[str, ...] = ("top", "bottom")

#: The testpoint views are the same render with only `TP*` labelled.  They are
#: extra *views* in the one Cruncher configuration rather than a second
#: invocation, because loading the board is what costs and the render is cheap.
TESTPOINT_SIDES: tuple[str, ...] = ("top", "bottom")

#: Key the concurrent acquisition uses for the one job that returns every
#: Cruncher view.
_CRUNCHER_JOB = "__cruncher__"


def _acquire_concurrently(
    jobs: Mapping[str, Callable[[], Any]], warnings: list[str]
) -> dict[str, Any]:
    """Run every acquisition at once; a failure costs one view, not the set.

    These are subprocess calls, so threads are the right tool: each spends
    essentially all of its time waiting on a child process.
    """

    if not jobs:
        return {}

    results: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        futures = {pool.submit(job): key for key, job in jobs.items()}
        for future in as_completed(futures):
            key = futures[future]
            label = "board views" if key == _CRUNCHER_JOB else f"artwork for {key}"
            try:
                results[key] = future.result()
            except (ArtworkError, OSError) as exc:
                # A missing view degrades one sheet, never the document set.
                warnings.append(f"{label} unavailable: {exc}")
                logger.warning("Release Studio %s unavailable: %s", label, exc)
    return results


@dataclass(frozen=True, slots=True)
class DocumentPage:
    """One composed sheet: a page of a document, and its own SVG."""

    key: str
    title: str
    svg_path: str
    svg_bytes: bytes
    scale: float
    artwork_digest: str = ""


@dataclass(frozen=True, slots=True)
class DocumentOutput:
    """One released document: a single PDF over one or more pages.

    Drawings that belong together are one document -- every copper layer of a
    board, or both sides of an assembly -- because that is how a reader files
    and prints them.  SVG has no multi-page form, so each page keeps its own
    SVG beside the shared PDF; the SVGs are the previewable rendering and the
    PDF is the one a fabricator receives.
    """

    key: str
    title: str
    pdf_path: str
    pdf_bytes: bytes
    pages: tuple[DocumentPage, ...] = ()

    @property
    def scale(self) -> float:
        """The ratio the first page was placed at."""

        return self.pages[0].scale if self.pages else 1.0


@dataclass(frozen=True, slots=True)
class DocumentSet:
    outputs: tuple[DocumentOutput, ...]
    warnings: tuple[str, ...] = ()
    #: The standard sheet size the whole set was composed on.
    sheet_size: str = ""

    def files(self) -> dict[str, bytes]:
        """Released path -> bytes, ready to become dossier members."""

        payload: dict[str, bytes] = {}
        for output in self.outputs:
            for page in output.pages:
                payload[page.svg_path] = page.svg_bytes
            payload[output.pdf_path] = output.pdf_bytes
        return payload


def compose(
    *,
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    variants: Mapping[str, Any],
    placements: Sequence[Mapping[str, Any]],
    members: Sequence[Mapping[str, Any]],
    testpoints: Mapping[str, Any] | None = None,
    population: Mapping[str, Any] | None = None,
    board: Path | None = None,
    cli_path: str | None = None,
    cruncher_path: str | None = None,
    workdir: Path | None = None,
    sheet_size: str | None = None,
    notes: Mapping[str, Any] | None = None,
    fields: Mapping[str, Any] | None = None,
    typography: str = DEFAULT_TYPOGRAPHY,
    revision_history: Sequence[Mapping[str, Any]] | None = None,
    acquirer: Callable[..., AcquiredArtwork] | None = None,
    drill_acquirer: Callable[..., AcquiredArtwork] | None = None,
    assembly_acquirer: Callable[..., Mapping[str, AcquiredArtwork]] | None = None,
    board_render_acquirer: Callable[..., Any] | None = None,
) -> DocumentSet:
    """Compose the full document set.

    ``sheet_size`` is chosen from the standard ladder to suit the board unless a
    caller pins one; ``notes`` and ``fields`` are the configuration's own text
    (D5); ``acquirer`` is injectable so the templates can be exercised without a
    KiCad installation.
    """

    # Validate before acquiring artwork so an invalid technical configuration
    # cannot perform work and then degrade into a default-looking document.
    typography_preset(typography)
    warnings: list[str] = []
    art: dict[str, AcquiredArtwork] = {}
    assembly: dict[str, AcquiredArtwork] = {}
    testpoint: dict[str, AcquiredArtwork] = {}

    substitutions = note_templates.substitution_context(context, fields=fields, stats=stats)
    sheet_notes, note_warnings = note_templates.resolve_notes(
        notes,
        substitutions,
        defaults=sheet_templates.DEFAULT_NOTES,
        typography=typography,
    )
    title_fields, field_warnings = note_templates.resolve_fields(
        fields, substitutions, typography=typography
    )
    warnings.extend(note_warnings)
    warnings.extend(field_warnings)

    # Every acquisition below is an independent subprocess writing to its own
    # directory, so they are started together rather than queued behind each
    # other.  The Cruncher render is by far the longest, and running it beside
    # the plots instead of after them is most of the saving.
    layer_pages = fabrication_layers(stackup)
    jobs: dict[str, Callable[[], Any]] = {}
    if board is not None and cli_path and workdir is not None:
        fetch = acquirer or acquire
        for layer in layer_pages:
            jobs[_layer_artwork_key(layer)] = partial(
                fetch,
                cli_path,
                board,
                # The outline travels with every layer: a copper plot with no
                # board edge cannot be located on the board it came from.
                ("Edge.Cuts", layer) if layer != "Edge.Cuts" else ("Edge.Cuts",),
                workdir / f"layer-{layer.replace('.', '_')}",
                variant=str(context.get("variant") or ""),
            )
        jobs[BOARD_RENDER_KEY] = partial(
            board_render_acquirer or acquire_board_render, cli_path, board,
            workdir / "render",
        )
        for key, layers in ARTWORK_LAYERS.items():
            jobs[key] = partial(
                fetch,
                cli_path,
                board,
                layers,
                workdir / key,
                variant=str(context.get("variant") or ""),
            )
        jobs[DRILL_ARTWORK_KEY] = partial(
            drill_acquirer or acquire_drill_map, cli_path, board, workdir / DRILL_ARTWORK_KEY
        )
    else:
        warnings.append("kicad-cli unavailable: sheets composed without board artwork")

    if board is not None and cruncher_path and workdir is not None:
        # One invocation for every view: loading the board dominates the cost
        # and Cruncher writes them all from a single load.
        jobs[_CRUNCHER_JOB] = partial(
            assembly_acquirer or acquire_board_views,
            cruncher_path,
            board,
            workdir / "cruncher",
        )
    else:
        warnings.append(
            "kicad-cruncher unavailable: assembly sheets composed without artwork"
        )

    acquired = _acquire_concurrently(jobs, warnings)
    board_render = acquired.pop(BOARD_RENDER_KEY, None)
    for key, value in acquired.items():
        if key != _CRUNCHER_JOB:
            art[key] = value
            continue
        for view_key, drawing in value.items():
            kind, _, side = view_key.partition("-")
            if kind == "testpoint":
                testpoint[side] = drawing
            else:
                assembly[side] = drawing

    for side, drawing in assembly.items():
        side_count = sum(
            1 for item in placements if str(item.get("side") or "").lower() == side
        )
        warnings.extend(assembly_density_warnings(side, side_count))
        warnings.extend(
            assembly_projection_warnings(side, assembly_projection_mix(drawing.svg_text))
        )

    title_height = sheet_templates.title_block_height(context, title_fields)
    extent_width, extent_height = board_extent(stats)
    if sheet_size is None:
        sheet_size = _select_size(stats, title_height)
    # One ratio for the whole package. A reader who scales a dimension off the
    # fabrication sheet and applies it to the assembly sheet has to get the same
    # number, so the scale is a property of the set rather than of each sheet.
    scale = sheet_templates.set_scale(
        extent_width, extent_height, sheet_size, title_height
    )

    # Placement uses content bounds when an acquired SVG reports a drawing-sheet
    # frame (or otherwise dwarfs the board).  Package size already ignored those
    # frames; placement must too or the board sits tiny inside an empty window.
    art = {
        key: content_view(drawing, extent_width, extent_height)
        for key, drawing in art.items()
    }
    assembly = {
        side: content_view(drawing, extent_width, extent_height)
        for side, drawing in assembly.items()
    }
    testpoint = {
        side: content_view(drawing, extent_width, extent_height)
        for side, drawing in testpoint.items()
    }
    assembly_mix = {
        side: assembly_projection_mix(drawing.svg_text)
        for side, drawing in assembly.items()
    }

    outputs: list[DocumentOutput] = []

    cover, cover_overflow = sheet_templates.technical_cover(
        context, stats, stackup, variants, members, size=sheet_size,
        notes=sheet_notes["cover"], fields=title_fields, typography=typography,
        revision_history=revision_history,
        placements=placements,
        render=board_render,
    )
    _append_document(
        outputs,
        [(cover, "cover", 1.0, None, None)]
        + _continuation_pages(
            cover_overflow,
            context=context,
            prefix="cover",
            title="RELEASE COVER — CONTINUED",
            sheet_size=sheet_size,
            fields=title_fields,
            typography=typography,
            warnings=warnings,
        ),
        "cover",
        "RELEASE COVER",
        warnings,
    )

    fabrication, fab_scale, fab_overflow = sheet_templates.fabrication_sheet(
        context, stats, stackup, art.get("fabrication"), size=sheet_size, scale=scale,
        notes=sheet_notes["fabrication"], fields=title_fields, typography=typography,
    )
    fabrication_pages = [
        (
            fabrication,
            "fabrication",
            fab_scale,
            art.get("fabrication"),
            _artwork_window(fabrication),
        )
    ]
    # One page per plotted layer, so the document is the whole board rather
    # than its outline plus a schedule that names layers a reader cannot see.
    for layer in layer_pages:
        drawing = art.get(_layer_artwork_key(layer))
        if drawing is None:
            # Without a plot there is nothing this page could show that the
            # first one does not already say.
            continue
        sheet, used, _overflow = sheet_templates.fabrication_sheet(
            context, stats, stackup, drawing, size=sheet_size, scale=scale,
            notes=sheet_notes["fabrication"], fields=title_fields,
            typography=typography, layer=layer,
        )
        fabrication_pages.append(
            (sheet, _layer_page_key(layer), used, drawing, _artwork_window(sheet))
        )
    fabrication_pages.extend(
        _continuation_pages(
            fab_overflow,
            context=context,
            prefix="schedules",
            title="FABRICATION SCHEDULES",
            sheet_size=sheet_size,
            fields=title_fields,
            typography=typography,
            warnings=warnings,
        )
    )
    _append_document(
        outputs, fabrication_pages, "fabrication", "FABRICATION DRAWING", warnings
    )

    assembly_pages = []
    for side in ASSEMBLY_SIDES:
        key = f"assembly-{side}"
        sheet, used = sheet_templates.assembly_sheet(
            context, side, assembly.get(side), placements, size=sheet_size, scale=scale,
            notes=sheet_notes[key], fields=title_fields, typography=typography,
            projection_mix=assembly_mix.get(side),
            population=population or {},
        )
        assembly_pages.append(
            (sheet, key, used, assembly.get(side), _artwork_window(sheet))
        )
    _append_document(
        outputs, assembly_pages, "assembly", "ASSEMBLY DRAWING", warnings
    )

    testpoint_pages = []
    for side in TESTPOINT_SIDES:
        key = f"testpoint-{side}"
        sheet, used, overflow = sheet_templates.testpoint_sheet(
            context, side, testpoint.get(side), testpoints or {}, size=sheet_size, scale=scale,
            notes=sheet_notes[key], fields=title_fields, typography=typography,
        )
        testpoint_pages.append(
            (sheet, key, used, testpoint.get(side), _artwork_window(sheet))
        )
        testpoint_pages.extend(
            _continuation_pages(
                overflow,
                context=context,
                prefix=key,
                title=f"TESTPOINT SCHEDULE — {side.upper()}",
                sheet_size=sheet_size,
                fields=title_fields,
                typography=typography,
                warnings=warnings,
            )
        )
    _append_document(
        outputs, testpoint_pages, "testpoint", "TESTPOINT DRAWING", warnings
    )

    drill, drill_scale, drill_overflow = sheet_templates.drill_sheet(
        context, stats, stackup, art.get("drill"), size=sheet_size, scale=scale,
        notes=sheet_notes["drill"], fields=title_fields, typography=typography,
    )
    _append_document(
        outputs,
        [(drill, "drill", drill_scale, art.get("drill"), _artwork_window(drill))]
        + _continuation_pages(
            drill_overflow,
            context=context,
            prefix="drill",
            title="DRILL SCHEDULE",
            sheet_size=sheet_size,
            fields=title_fields,
            typography=typography,
            warnings=warnings,
        ),
        "drill",
        "DRILL DRAWING",
        warnings,
    )

    return DocumentSet(
        outputs=tuple(outputs), warnings=tuple(warnings), sheet_size=sheet_size
    )


_MM_VALUE = re.compile(r"-?\d+(?:\.\d+)?")


def _mm_value(value: Any) -> float:
    """Read a millimetre figure out of an R5 projection value.

    The projections hand back KiCad's own formatting -- ``"38.0000 mm"`` -- and
    the tables deliberately pass that through untouched.  Sizing needs the
    number, so it is parsed here rather than by changing what the tables show.
    """

    if isinstance(value, (int, float)):
        return float(value)
    match = _MM_VALUE.search(str(value or ""))
    return float(match.group(0)) if match else 0.0


def board_extent(stats: Mapping[str, Any]) -> tuple[float, float]:
    """The board outline from statistics, in millimetres.

    Package paper size follows the board alone.  Acquired SVG frames often
    report the project's drawing-sheet paper (A3/A2/…) rather than the ink; if
    those frames chose the package size, a 132 mm board would land on A2 at
    1:1 with most of the artwork window empty.  Placement still prefers content
    bounds via :func:`content_view` when a frame looks page-sized.
    """

    board = stats.get("board") if isinstance(stats, Mapping) else None
    width = _mm_value((board or {}).get("width"))
    height = _mm_value((board or {}).get("height"))
    return width, height


def _select_size(stats: Mapping[str, Any], title_height: float) -> str:
    """Pick one standard sheet size for the whole set, from the board alone."""

    width, height = board_extent(stats)
    if width <= 0 or height <= 0:
        # Nothing is known about the board -- no projections and no artwork.
        # Sizing from a guess would be worse than stating a conventional
        # default, so the set keeps the historical one.
        return sheet_templates.DEFAULT_SIZE
    return sheet_templates.select_sheet_size(width, height, title_height=title_height)


def _artwork_window(sheet: Sheet) -> Rect | None:
    from app.release_studio.documents.layout import Artwork

    for element in sheet.elements:
        if isinstance(element, Artwork):
            return element.rect
    return None


def _serialize(
    pages: Sequence[tuple[Sheet, str, float, AcquiredArtwork | None, Rect | None]],
    key: str,
    title: str,
    warnings: list[str] | None = None,
) -> DocumentOutput:
    """Render *pages* into one PDF and one SVG each."""

    sheets = [sheet for sheet, _k, _s, _a, _w in pages]
    pdf_bytes = render_pdf_pages(sheets)

    for index, (_sheet, page_key, scale, art, window) in enumerate(pages):
        if art is None or window is None:
            continue
        try:
            pdf_bytes = composite_pdf(pdf_bytes, art, window, scale, page_index=index)
        except Exception as exc:  # noqa: BLE001 - the furniture-only PDF still stands
            # The SVG page still carries the artwork, so this is a divergence
            # between two renderings of one sheet and has to be stated rather
            # than left to a log line nobody reads.
            logger.warning("Artwork could not be composited into %s: %s", page_key, exc)
            if warnings is not None:
                warnings.append(f"{key}.pdf page {index + 1} carries no artwork: {exc}")

    return DocumentOutput(
        key=key,
        title=title,
        pdf_path=f"documentation/{key}.pdf",
        pdf_bytes=pdf_bytes,
        pages=tuple(
            DocumentPage(
                key=page_key,
                title=sheet.title,
                svg_path=f"documentation/{page_key}.svg",
                svg_bytes=render_svg(sheet).encode("utf-8"),
                scale=scale,
                artwork_digest=art.digest if art else "",
            )
            for sheet, page_key, scale, art, _window in pages
        ),
    )


def _append_document(
    outputs: list[DocumentOutput],
    pages: Sequence[tuple[Sheet, str, float, AcquiredArtwork | None, Rect | None]],
    key: str,
    title: str,
    warnings: list[str],
) -> None:
    """Isolate a renderer failure to one document instead of the whole set."""

    if not pages:
        return
    try:
        outputs.append(_serialize(pages, key, title, warnings))
    except (KeyError, OSError, RuntimeError, TypeError, ValueError) as exc:
        logger.warning("Release Studio document %s could not be composed: %s", key, exc)
        warnings.append(f"{key} was not composed: {exc}")
#: Ceiling on continuation pages per originating document.
#:
#: Each lays its tables across the whole body in three columns, so one absorbs
#: a very large schedule and two is already implausible.  The cap guards
#: against a table that cannot shrink below one row per page turning into an
#: unbounded document; it is not a content decision.
MAX_CONTINUATION_SHEETS = 4


def _continuation_pages(
    carried: Sequence,
    *,
    context: Mapping[str, Any],
    prefix: str,
    title: str,
    sheet_size: str,
    fields: Sequence,
    typography: str,
    warnings: list[str],
) -> list[tuple[Sheet, str, float, None, None]]:
    """Pages carrying tables the originating sheet could not hold.

    They are pages of the same document rather than separate files: a schedule
    continued on its own PDF is a schedule a reader can lose.
    """

    pages: list[tuple[Sheet, str, float, None, None]] = []
    remaining = list(carried)
    index = 0
    while remaining and index < MAX_CONTINUATION_SHEETS:
        index += 1
        key = f"{prefix}-{index}"
        sheet, remaining = sheet_templates.continuation_sheet(
            context,
            remaining,
            key=key,
            title=f"{title} — SHEET {index}",
            size=sheet_size,
            fields=fields,
            typography=typography,
        )
        pages.append((sheet, key, 1.0, None, None))
    if remaining:
        # Nothing here can carry it, and silence would be the old defect in a
        # new place: the sheet set has to say the dossier holds more than it
        # drew.
        warnings.append(
            f"{prefix}: {len(remaining)} table(s) did not fit in "
            f"{MAX_CONTINUATION_SHEETS} continuation sheets; the released data "
            "files remain complete"
        )
    return pages
