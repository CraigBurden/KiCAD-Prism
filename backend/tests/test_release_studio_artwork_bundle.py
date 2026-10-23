"""Release Studio's artwork from a design bundle (C3 chunk F1).

The CLI's exit-7 ``stage-order`` is a clear "models not ready" failure, and
every other failure keeps the CLI's error message.
``artwork_line_weights: paper`` draws at the ratio the sheet will use.
"""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from unittest import mock

import pytest

from app.release_studio import pipeline
from app.release_studio.config import ConfigSchemaError, parse_configuration_yaml
from app.release_studio.documents import artwork as artwork_module
from app.release_studio.documents import sheets
from app.release_studio.documents.artwork import AcquiredArtwork, ArtworkError
from app.release_studio.documents.artwork_bundle import acquire_bundle_views
from app.release_studio.documents.inputs import DocumentInputs
from app.release_studio.documents.engine import compose_documents
from app.services.design_bundle import cli
from tests.release_studio_support import documents_stub
from tests.test_release_studio_config import _MIN_CONFIG

COMMIT = "a" * 40

SVG = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" '
    'viewBox="0 0 20 10"><rect x="0" y="0" width="20" height="10" '
    'fill="none" stroke="#000000" stroke-width="0.15"/></svg>'
)


def _drawing() -> AcquiredArtwork:
    x, y, width, height = artwork_module.extents(SVG)
    return AcquiredArtwork(
        layers=("Prism.test",),
        svg_text=SVG,
        pdf_bytes=b"",
        view_x=x,
        view_y=y,
        view_width=width,
        view_height=height,
        digest="d" * 64,
        page_offset_x=0.0,
        page_offset_y=0.0,
    )


# --------------------------------------------------------------- CLI failures


def test_a_stage_order_failure_names_the_stage_that_is_not_ready(tmp_path: Path) -> None:
    failure = cli.CliFailure(
        "stage models is not complete",
        exit_code=7,
        retryable=False,
        error={"code": "stage-order", "message": "stage models is not complete"},
    )
    with mock.patch.object(cli, "run", side_effect=failure):
        with pytest.raises(ArtworkError, match="design bundle stage models is not ready"):
            acquire_bundle_views(tmp_path / "a.prism", tmp_path / "out")


def test_another_failure_keeps_the_cli_error_message(tmp_path: Path) -> None:
    failure = cli.CliFailure(
        'the configuration has no view "nope"',
        exit_code=2,
        retryable=False,
        error={"code": "view-unknown", "message": 'the configuration has no view "nope"'},
    )
    with mock.patch.object(cli, "run", side_effect=failure):
        with pytest.raises(ArtworkError, match="the configuration has no view"):
            acquire_bundle_views(tmp_path / "a.prism", tmp_path / "out")


# ------------------------------------------------------------ paper line weights


def test_paper_mode_passes_the_ratio_the_sheet_will_use(tmp_path: Path) -> None:
    output = tmp_path / "outputs"
    stats = output / "fabrication" / "board-stats.json"
    stats.parent.mkdir(parents=True)
    stats.write_text(
        json.dumps({"board": {"width": "70.0000 mm", "height": "50.0000 mm"}}),
        encoding="utf-8",
    )
    config = {"artwork_line_weights": "paper", "sheet_style": "prism"}

    sheet_size, scale = pipeline._artwork_scale(config, output)
    assert (sheet_size, scale) == sheets.package_scale(
        70.0, 50.0, sheet_style="prism"
    )

    calls: list[list[str]] = []

    def runner(args: list[str]) -> cli.CliRun:
        calls.append(list(args))
        target = Path(args[args.index("-o") + 1])
        target.mkdir(parents=True, exist_ok=True)
        for index, argument in enumerate(args):
            if argument == "--view":
                (target / f"{args[index + 1]}.svg").write_text(SVG, encoding="utf-8")
        return cli.CliRun(argv=("prism-kicad", *args), exit_code=0, document={})

    drawings = acquire_bundle_views(
        tmp_path / "a.prism", output / "artwork", paper_scale=scale, runner=runner
    )
    assert set(drawings) == {
        "assembly-top",
        "assembly-bottom",
        "testpoint-top",
        "testpoint-bottom",
    }
    # One invocation per configuration, each carrying the sheet's ratio.
    assert len(calls) == 2
    for args in calls:
        passed = float(args[args.index("--paper-scale") + 1])
        assert passed == pytest.approx(scale)


def test_drawing_mode_asks_for_no_ratio(tmp_path: Path) -> None:
    output = tmp_path / "outputs"
    stats = output / "fabrication" / "board-stats.json"
    stats.parent.mkdir(parents=True)
    stats.write_text(
        json.dumps({"board": {"width": "70.0000 mm", "height": "50.0000 mm"}}),
        encoding="utf-8",
    )
    assert pipeline._artwork_scale({"artwork_line_weights": "drawing"}, output) == (
        None,
        None,
    )


def test_the_sheet_is_placed_at_the_ratio_the_artwork_was_drawn_at() -> None:
    sheet_size, scale = sheets.package_scale(70.0, 50.0, sheet_style="prism")
    inputs = DocumentInputs(
        context={
            "title": "Demo",
            "document_number": "DOC-1",
            "revision": "A",
            "commit_sha": "a" * 40,
            "variant": "default",
        },
        stats={"board": {"width": "70.0000 mm", "height": "50.0000 mm"}},
        stackup={},
        variants={},
        placements=[],
        members=[],
        sheet_size=sheet_size,
        artwork_paper_scale=scale,
        board=Path("/nonexistent/board.kicad_pcb"),
        workdir=Path("/tmp"),
    )
    with documents_stub():
        result = compose_documents(
            inputs,
            assembly_acquirer=lambda *_args, **_kwargs: {
                "assembly-top": _drawing(),
                "assembly-bottom": _drawing(),
            },
            testpoint_acquirer=lambda *_args, **_kwargs: {
                "testpoint-top": _drawing(),
                "testpoint-bottom": _drawing(),
            },
        )
    assembly = next(output for output in result.outputs if output.key == "assembly")
    assert assembly.scale == pytest.approx(scale)


def test_paper_mode_and_composition_agree_on_a_large_board(tmp_path: Path) -> None:
    """The early ratio and the engine's sheet choice come from one function."""

    output = tmp_path / "outputs"
    stats = output / "fabrication" / "board-stats.json"
    stats.parent.mkdir(parents=True)
    stats.write_text(
        json.dumps({"board": {"width": "220.0000 mm", "height": "130.0000 mm"}}),
        encoding="utf-8",
    )
    sheet_size, scale = pipeline._artwork_scale(
        {"artwork_line_weights": "paper", "sheet_style": "prism"}, output
    )
    assert (sheet_size, scale) == ("A3", 1.5)

    def drawing(width: float, height: float) -> AcquiredArtwork:
        return replace(_drawing(), view_width=width, view_height=height)

    art = drawing(220.0, 130.0)
    inputs = DocumentInputs(
        context={
            "title": "Demo",
            "document_number": "DOC-1",
            "revision": "A",
            "commit_sha": "a" * 40,
            "variant": "default",
        },
        stats={"board": {"width": "220.0000 mm", "height": "130.0000 mm"}},
        stackup={},
        variants={},
        placements=[],
        members=[],
        artwork_paper_scale=scale,
        board=Path("/nonexistent/board.kicad_pcb"),
        workdir=Path("/tmp"),
    )
    with documents_stub():
        result = compose_documents(
            inputs,
            assembly_acquirer=lambda *_args, **_kwargs: {
                "assembly-top": art,
                "assembly-bottom": art,
            },
            testpoint_acquirer=lambda *_args, **_kwargs: {
                "testpoint-top": art,
                "testpoint-bottom": art,
            },
        )
    assert result.sheet_size == sheet_size
    assembly = next(output for output in result.outputs if output.key == "assembly")
    assert assembly.pages[0].scale == pytest.approx(scale)
    # At that ratio the population tables no longer fit beside the art.
    assert "assembly-top-1" in result.page_svgs()


# ------------------------------------------------------------------- the config


def test_artwork_line_weights_defaults_to_paper() -> None:
    assert parse_configuration_yaml(_MIN_CONFIG)["artwork_line_weights"] == "paper"


def test_artwork_line_weights_still_accepts_drawing() -> None:
    configured = parse_configuration_yaml(
        _MIN_CONFIG + "\nartwork_line_weights: drawing\n"
    )
    assert configured["artwork_line_weights"] == "drawing"


def test_artwork_line_weights_accepts_paper_only() -> None:
    configured = parse_configuration_yaml(
        _MIN_CONFIG + "\nartwork_line_weights: paper\n"
    )
    assert configured["artwork_line_weights"] == "paper"
    with pytest.raises(ConfigSchemaError, match="unknown mode 'blueprint'"):
        parse_configuration_yaml(
            _MIN_CONFIG + "\nartwork_line_weights: blueprint\n"
        )
