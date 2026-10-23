"""Acquire plotted board views for the Documentation Engine.

This is the one boundary that talks to ``kicad-cli`` for documentation
artwork. A missing view degrades the sheets that depend on it and is recorded
as a warning; it does not abort the document set. Concurrency is capped by
memory, not cores: every job loads the whole board.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from app.release_studio.documents.artwork import (
    AcquiredArtwork,
    ArtworkError,
    acquire,
    acquire_board_render,
    acquire_drill_map,
    acquire_layers,
)
from app.services.kicad_tools import KicadTool

logger = logging.getLogger(__name__)

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

#: The drill sheet's artwork is not a layer plot: holes are not a layer, so the
#: view comes from `pcb export drill --generate-map` instead.
DRILL_ARTWORK_KEY = "drill"

#: Key the concurrent acquisition uses for the one job that returns every
#: assembly and testpoint view from the design bundle. It runs in the same
#: pool as the plots because the bundle load is a separate process.
_BUNDLE_ARTWORK_JOB = "__artwork__"
_LAYER_BATCH_JOB = "__layers__"

#: Ceiling on concurrent acquisitions.
#:
#: Bounded by memory, not cores: every one of these loads the whole board, and
#: a twelve-layer board asks for twenty-odd plots.  Running them all at once
#: exhausted the worker on a 35 MB `.kicad_pcb` -- the processes were killed
#: with no output at all, which looked like a silent failure rather than the
#: resource limit it was.
_MAX_PARALLEL_ACQUISITIONS = 4


def layer_artwork_key(layer: str) -> str:
    return f"layer:{layer}"


def layer_page_key(layer: str) -> str:
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
        # `kind` is the projection's own normalized classification; `type` is
        # KiCad's raw value, which for copper is "signal"/"power"/"mixed" and
        # never the word "copper". Reading `type` first therefore rejected
        # every copper layer on a board that declares signal layers, leaving
        # the fabrication document with no copper pages at all and an
        # "unavailable" overview page where the first copper plot belongs.
        kind = str(layer.get("kind") or layer.get("type") or "").strip().lower()
        if not name or not name.endswith(".Cu"):
            continue
        if kind and "copper" not in kind:
            continue
        if name not in copper:
            copper.append(name)
    return tuple(copper) + _TECHNICAL_LAYERS


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
    workers = min(len(jobs), _MAX_PARALLEL_ACQUISITIONS)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(job): key for key, job in jobs.items()}
        for future in as_completed(futures):
            key = futures[future]
            label = {
                _BUNDLE_ARTWORK_JOB: "assembly views",
                _LAYER_BATCH_JOB: "batched layer artwork",
            }.get(key, f"artwork for {key}")
            try:
                results[key] = future.result()
            except (ArtworkError, OSError) as exc:
                # A missing view degrades one sheet, never the document set.
                warnings.append(f"{label} unavailable: {exc}")
                logger.warning("Release Studio %s unavailable: %s", label, exc)
    return results


@dataclass(frozen=True, slots=True)
class AcquisitionRequest:
    """What the Documentation Engine asks KiCad and ``prism-kicad`` to plot."""

    board: Path | None
    workdir: Path | None
    layer_pages: tuple[str, ...]
    variant: str = ""
    cli: KicadTool | None = None
    designators: tuple[str, ...] = ()
    acquirer: Callable[..., AcquiredArtwork] | None = None
    drill_acquirer: Callable[..., AcquiredArtwork] | None = None
    assembly_acquirer: Callable[..., Mapping[str, AcquiredArtwork]] | None = None
    board_render_acquirer: Callable[..., Any] | None = None
    testpoint_acquirer: Callable[..., Mapping[str, AcquiredArtwork]] | None = None


@dataclass(frozen=True, slots=True)
class AcquisitionResult:
    """Views sheet composition can place, plus stated absences.

    A missing view is a warning on this record, never an exception out of
    :func:`acquire_views`. The dependent sheet then draws its stated absence.
    """

    layers: Mapping[str, AcquiredArtwork]
    assembly: Mapping[str, AcquiredArtwork]
    testpoints: Mapping[str, AcquiredArtwork]
    board_render: Any | None = None
    warnings: tuple[str, ...] = ()


def acquire_views(request: AcquisitionRequest) -> AcquisitionResult:
    """Run every independent acquisition; a failure costs one view, not the set.

    Layer plots, the cover render and the drill map share one bounded pool with
    the assembly artwork (one ``prism-kicad artwork`` invocation over the design
    bundle). Testpoint views are a second bundle load and run after that pool so
    they cannot steal a plot slot.
    """

    warnings: list[str] = []
    layers: dict[str, AcquiredArtwork] = {}
    assembly: dict[str, AcquiredArtwork] = {}
    testpoint: dict[str, AcquiredArtwork] = {}

    jobs: dict[str, Callable[[], Any]] = {}
    board = request.board
    cli = request.cli
    workdir = request.workdir
    if board is not None and cli and workdir is not None:
        if request.acquirer is None and request.layer_pages:
            # One board load per format for every layer (acquire_layers).
            jobs[_LAYER_BATCH_JOB] = partial(
                acquire_layers,
                cli,
                board,
                request.layer_pages,
                workdir / "layers",
                variant=request.variant,
            )
        fetch = request.acquirer or acquire
        for layer in request.layer_pages if request.acquirer is not None else ():
            jobs[layer_artwork_key(layer)] = partial(
                fetch,
                cli,
                board,
                # The outline travels with every layer: a copper plot with no
                # board edge cannot be located on the board it came from.
                ("Edge.Cuts", layer) if layer != "Edge.Cuts" else ("Edge.Cuts",),
                workdir / f"layer-{layer.replace('.', '_')}",
                variant=request.variant,
            )
        jobs[BOARD_RENDER_KEY] = partial(
            request.board_render_acquirer or acquire_board_render,
            cli,
            board,
            workdir / "render",
        )
        jobs[DRILL_ARTWORK_KEY] = partial(
            request.drill_acquirer or acquire_drill_map,
            cli,
            board,
            workdir / DRILL_ARTWORK_KEY,
        )
    else:
        warnings.append("kicad-cli unavailable: sheets composed without board artwork")

    if workdir is not None and request.assembly_acquirer is not None:
        # One invocation for every assembly view: loading the bundle dominates
        # the cost and the producer writes them all from a single load. The
        # injected acquirer is the bundle artwork call.
        jobs[_BUNDLE_ARTWORK_JOB] = partial(
            request.assembly_acquirer, workdir / "bundle"
        )

    acquired = _acquire_concurrently(jobs, warnings)
    if _LAYER_BATCH_JOB in jobs:

        def one_by_one(pages: Sequence[str]) -> dict[str, Any]:
            return _acquire_concurrently(
                {
                    layer: partial(
                        acquire,
                        cli,
                        board,
                        ("Edge.Cuts", layer) if layer != "Edge.Cuts" else ("Edge.Cuts",),
                        workdir / f"layer-{layer.replace('.', '_')}",
                        variant=request.variant,
                    )
                    for layer in pages
                },
                warnings,
            )

        batch = acquired.pop(_LAYER_BATCH_JOB, None)
        if batch is None:
            # The batched plot failed outright: plot layer by layer, so one
            # bad layer costs its own page rather than all of them.
            batch = one_by_one(request.layer_pages)
        else:
            # A layer the batch did not write (a file name KiCad chose that
            # plot_file_layer_names did not predict) is plotted on its own.
            missing = [layer for layer, artwork in batch.items() if isinstance(artwork, ArtworkError)]
            for layer in missing:
                del batch[layer]
            batch.update(one_by_one(missing))
        for layer, artwork in batch.items():
            layers[layer_artwork_key(layer)] = artwork
    board_render = acquired.pop(BOARD_RENDER_KEY, None)
    for key, value in acquired.items():
        if key != _BUNDLE_ARTWORK_JOB:
            layers[key] = value
            continue
        for view_key, drawing in value.items():
            kind, _, side = view_key.partition("-")
            if kind == "testpoint":
                testpoint[side] = drawing
            else:
                assembly[side] = drawing

    # Testpoints are a second bundle load, with the testpoint configuration's
    # ``TP*`` selector limiting the view. They run *after* the plot pool so
    # they cannot steal an acquisition slot from a layer plot.
    testpoint_job = None
    if workdir is not None and not testpoint and request.testpoint_acquirer is not None:
        testpoint_job = partial(
            request.testpoint_acquirer,
            workdir / "testpoints",
            designators=tuple(request.designators or ()),
        )
    if testpoint_job is not None:
        try:
            testpoint_views = testpoint_job()
            for view_key, drawing in testpoint_views.items():
                kind, _, side = view_key.partition("-")
                if kind == "testpoint":
                    testpoint[side] = drawing
                else:
                    assembly.setdefault(side, drawing)
        except (ArtworkError, OSError, TypeError) as exc:
            warnings.append(f"testpoint views unavailable: {exc}")
            logger.warning("Release Studio testpoint views unavailable: %s", exc)

    return AcquisitionResult(
        layers=layers,
        assembly=assembly,
        testpoints=testpoint,
        board_render=board_render,
        warnings=tuple(warnings),
    )
