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
    acquire_assembly_views,
    acquire_drill_map,
    assembly_density_warnings,
    assembly_projection_mix,
    assembly_projection_warnings,
    composite_pdf,
    content_view,
)
from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY, typography_preset
from app.release_studio.documents.layout import Rect, Sheet
from app.release_studio.documents.pdf import render_pdf
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

#: The drill sheet's artwork is not a layer plot: holes are not a layer, so the
#: view comes from `pcb export drill --generate-map` instead.
DRILL_ARTWORK_KEY = "drill"

#: Assembly views come from `kicad-cruncher pcb-svg`, which fits one designator
#: into each component's own bounds over a hidden-line-removed outline.
ASSEMBLY_SIDES: tuple[str, ...] = ("top", "bottom")

#: Key the concurrent acquisition uses for the one job that returns both sides.
_ASSEMBLY_JOB = "__assembly__"


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
            label = "assembly views" if key == _ASSEMBLY_JOB else f"artwork for {key}"
            try:
                results[key] = future.result()
            except (ArtworkError, OSError) as exc:
                # A missing view degrades one sheet, never the document set.
                warnings.append(f"{label} unavailable: {exc}")
                logger.warning("Release Studio %s unavailable: %s", label, exc)
    return results


@dataclass(frozen=True, slots=True)
class DocumentOutput:
    """One composed sheet, in both serializations."""

    key: str
    title: str
    svg_path: str
    pdf_path: str
    svg_bytes: bytes
    pdf_bytes: bytes
    scale: float
    artwork_digest: str = ""


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
            payload[output.svg_path] = output.svg_bytes
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
    jobs: dict[str, Callable[[], Any]] = {}
    if board is not None and cli_path and workdir is not None:
        fetch = acquirer or acquire
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
        # One invocation for both sides: loading the board dominates the cost
        # and Cruncher writes every requested view from a single load.
        jobs[_ASSEMBLY_JOB] = partial(
            assembly_acquirer or acquire_assembly_views,
            cruncher_path,
            board,
            ASSEMBLY_SIDES,
            workdir / "assembly",
        )
    else:
        warnings.append(
            "kicad-cruncher unavailable: assembly sheets composed without artwork"
        )

    acquired = _acquire_concurrently(jobs, warnings)
    for key, value in acquired.items():
        if key == _ASSEMBLY_JOB:
            assembly.update(value)
        else:
            art[key] = value

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
    )
    _append_serialized(outputs, cover, "cover", 1.0, None, None, warnings)
    _append_continuations(
        outputs,
        cover_overflow,
        context=context,
        prefix="cover",
        title="RELEASE COVER — CONTINUED",
        sheet_size=sheet_size,
        fields=title_fields,
        typography=typography,
        warnings=warnings,
    )

    fabrication, fab_scale, fab_overflow = sheet_templates.fabrication_sheet(
        context, stats, stackup, art.get("fabrication"), size=sheet_size, scale=scale,
        notes=sheet_notes["fabrication"], fields=title_fields, typography=typography,
    )
    _append_serialized(
        outputs,
        fabrication,
        "fabrication",
        fab_scale,
        art.get("fabrication"),
        _artwork_window(fabrication),
        warnings,
    )
    _append_continuations(
        outputs,
        fab_overflow,
        context=context,
        prefix="schedules",
        title="FABRICATION SCHEDULES",
        sheet_size=sheet_size,
        fields=title_fields,
        typography=typography,
        warnings=warnings,
    )

    for side in ASSEMBLY_SIDES:
        key = f"assembly-{side}"
        sheet, used = sheet_templates.assembly_sheet(
            context, side, assembly.get(side), placements, size=sheet_size, scale=scale,
            notes=sheet_notes[key], fields=title_fields, typography=typography,
            projection_mix=assembly_mix.get(side),
        )
        _append_serialized(
            outputs,
            sheet,
            key,
            used,
            assembly.get(side),
            _artwork_window(sheet),
            warnings,
        )

    drill, drill_scale, drill_overflow = sheet_templates.drill_sheet(
        context, stats, stackup, art.get("drill"), size=sheet_size, scale=scale,
        notes=sheet_notes["drill"], fields=title_fields, typography=typography,
    )
    _append_serialized(
        outputs,
        drill,
        "drill",
        drill_scale,
        art.get("drill"),
        _artwork_window(drill),
        warnings,
    )
    _append_continuations(
        outputs,
        drill_overflow,
        context=context,
        prefix="drill",
        title="DRILL SCHEDULE",
        sheet_size=sheet_size,
        fields=title_fields,
        typography=typography,
        warnings=warnings,
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
    sheet: Sheet,
    key: str,
    scale: float,
    art: AcquiredArtwork | None,
    window: Rect | None,
    warnings: list[str] | None = None,
    artwork_digest: str = "",
) -> DocumentOutput:
    svg_bytes = render_svg(sheet).encode("utf-8")
    pdf_bytes = render_pdf(sheet)

    if art is not None and window is not None:
        try:
            pdf_bytes = composite_pdf(pdf_bytes, art, window, scale)
        except Exception as exc:  # noqa: BLE001 - the furniture-only PDF still stands
            # The SVG sheet still carries the artwork, so this is a divergence
            # between two renderings of one sheet and has to be stated rather
            # than left to a log line nobody reads.
            logger.warning("Artwork could not be composited into %s: %s", key, exc)
            if warnings is not None:
                warnings.append(f"{key}.pdf carries no board artwork: {exc}")

    return DocumentOutput(
        key=key,
        title=sheet.title,
        svg_path=f"documentation/{key}.svg",
        pdf_path=f"documentation/{key}.pdf",
        svg_bytes=svg_bytes,
        pdf_bytes=pdf_bytes,
        scale=scale,
        artwork_digest=art.digest if art else artwork_digest,
    )


#: Ceiling on continuation sheets per originating sheet.
#:
#: Each continuation lays its tables across the whole body in three columns, so
#: one absorbs a very large schedule and two is already implausible.  The cap is
#: a guard against a table that cannot shrink below one row per sheet turning
#: into an unbounded document set, not a content decision.
MAX_CONTINUATION_SHEETS = 4


def _append_continuations(
    outputs: list[DocumentOutput],
    carried: Sequence,
    *,
    context: Mapping[str, Any],
    prefix: str,
    title: str,
    sheet_size: str,
    fields: Sequence,
    typography: str,
    warnings: list[str],
) -> None:
    """Emit continuation sheets until nothing is left to carry."""

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
        _append_serialized(outputs, sheet, key, 1.0, None, None, warnings)
    if remaining:
        # Nothing here can carry it, and silence would be the old defect in a
        # new place: the sheet set has to say the dossier holds more than it
        # drew.
        warnings.append(
            f"{prefix}: {len(remaining)} table(s) did not fit in "
            f"{MAX_CONTINUATION_SHEETS} continuation sheets; the released data "
            "files remain complete"
        )


def _append_serialized(
    outputs: list[DocumentOutput],
    sheet: Sheet,
    key: str,
    scale: float,
    art: AcquiredArtwork | None,
    window: Rect | None,
    warnings: list[str],
    artwork_digest: str = "",
) -> None:
    """Isolate a renderer failure to one sheet instead of the document set."""

    try:
        output = _serialize(sheet, key, scale, art, window, warnings, artwork_digest)
    except (KeyError, OSError, RuntimeError, TypeError, ValueError) as exc:
        logger.warning("Release Studio sheet %s could not be composed: %s", key, exc)
        warnings.append(f"{key} sheet was not composed: {exc}")
        return
    outputs.append(output)
