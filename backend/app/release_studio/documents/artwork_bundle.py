"""Assembly and testpoint artwork from a design bundle (`prism-kicad artwork`).

Release Studio draws its assembly and testpoint views with ``prism-kicad
artwork`` over the build's design bundle (ADR amendment C3 §3.2). The SVG and
PDF are placed by the same :class:`AcquiredArtwork` path as every other
acquired view.

The run is two commands: one for the assembly configuration and one for the
testpoint configuration. The testpoint configuration's ``TP*`` selector is
what limits the view, so no testpoint-only board is staged. The configuration
files are the native ones; ``PRISM_ARTWORK_CONFIG_DIR`` names them, and the
default resolves the checkout's or the image's copy.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Callable, Mapping

from app.core.config import settings
from app.release_studio.documents.artwork import (
    ASSEMBLY_VIEWS,
    TESTPOINT_VIEWS,
    AcquiredArtwork,
    ArtworkError,
    extents,
    render_pdf_page,
    sanitize_artwork,
)
from app.services.design_bundle import cli
from app.services.design_bundle.cli import CliFailure, CliRun

#: The assembly and testpoint configurations, from `native/src/rs/prism-artwork/configs`.
ASSEMBLY_CONFIG = "assembly.json"
TESTPOINT_CONFIG = "testpoints.json"

#: Ceiling for one artwork invocation. A bundle load plus HLR overlay is
#: bounded like a plot; a wedged run fails its step rather than the build.
BUNDLE_ARTWORK_TIMEOUT_SECONDS = 900

Runner = Callable[[list[str]], CliRun]


def config_dir() -> Path:
    """``PRISM_ARTWORK_CONFIG_DIR``, else the checkout's (or the image's) copy."""

    configured = settings.PRISM_ARTWORK_CONFIG_DIR.strip()
    if configured:
        return Path(configured)
    here = Path(__file__).resolve()
    for root in (here.parents[4], here.parents[3]):  # repository checkout, then /app in the image
        candidate = root / "native" / "src" / "rs" / "prism-artwork" / "configs"
        if candidate.is_dir():
            return candidate
    return here.parents[4] / "native" / "src" / "rs" / "prism-artwork" / "configs"


def config_path(name: str) -> Path:
    """One native artwork configuration; missing is a clear failure."""

    path = config_dir() / name
    if not path.is_file():
        raise ArtworkError(f"the artwork configuration is missing: {path}")
    return path


def _ratio(value: float) -> str:
    """A positive ratio in a form the CLI parses and the recorded argv keeps stable."""

    return f"{value:.12g}"


def _command(
    archive: Path,
    config: Path,
    views: Mapping[str, str],
    output: Path,
    *,
    variant: str,
    paper_scale: float | None,
) -> list[str]:
    args = ["artwork", "--in", str(archive), "--config", str(config)]
    for view in views.values():
        args += ["--view", view]
    args += ["-o", str(output)]
    if variant:
        args += ["--variant", variant]
    if paper_scale is not None:
        args += ["--paper-scale", _ratio(paper_scale)]
    return args


def _run(args: list[str]) -> CliRun:
    try:
        return cli.run(
            args,
            timeout_seconds=BUNDLE_ARTWORK_TIMEOUT_SECONDS,
            expect="prism.cli.artwork_result.a0",
        )
    except CliFailure as failure:
        if failure.exit_code == 7 and failure.code == "stage-order":
            raise ArtworkError("design bundle stage models is not ready") from failure
        raise ArtworkError(str(failure)) from failure


def _drawing(path: Path, label: str) -> AcquiredArtwork:
    if not path.is_file():
        raise ArtworkError(f"prism-kicad artwork produced no {path.name}")
    svg_text = sanitize_artwork(path.read_text(encoding="utf-8"))
    x, y, width, height = extents(svg_text)
    return AcquiredArtwork(
        layers=(f"Prism.{label}",),
        svg_text=svg_text,
        pdf_bytes=render_pdf_page(svg_text),
        view_x=x,
        view_y=y,
        view_width=width,
        view_height=height,
        digest=hashlib.sha256(svg_text.encode("utf-8")).hexdigest(),
        # The cairo page is the SVG's own viewport, so the artwork's top-left
        # is the page's top-left, exactly as for a Cruncher view.
        page_offset_x=0.0,
        page_offset_y=0.0,
    )


def acquire_bundle_views(
    archive: Path,
    output_root: Path,
    *,
    variant: str = "",
    paper_scale: float | None = None,
    runner: Runner | None = None,
) -> dict[str, AcquiredArtwork]:
    """The assembly and testpoint views of *archive*, keyed ``"<kind>-<side>"``.

    ``paper_scale`` is passed through so the CLI divides the configuration's
    lengths and prints them at their configured size on paper at that ratio.
    """

    run = runner or _run
    output_root = Path(output_root)
    run(
        _command(
            Path(archive),
            config_path(ASSEMBLY_CONFIG),
            ASSEMBLY_VIEWS,
            output_root / "assembly",
            variant=variant,
            paper_scale=paper_scale,
        )
    )
    run(
        _command(
            Path(archive),
            config_path(TESTPOINT_CONFIG),
            TESTPOINT_VIEWS,
            output_root / "testpoints",
            variant=variant,
            paper_scale=paper_scale,
        )
    )
    drawings: dict[str, AcquiredArtwork] = {}
    for kind, folder, views in (
        ("assembly", "assembly", ASSEMBLY_VIEWS),
        ("testpoint", "testpoints", TESTPOINT_VIEWS),
    ):
        for side, view in views.items():
            drawings[f"{kind}-{side}"] = _drawing(
                output_root / folder / f"{view}.svg", f"{kind}-{side}"
            )
    return drawings
