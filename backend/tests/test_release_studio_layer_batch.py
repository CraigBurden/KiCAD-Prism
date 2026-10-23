"""Layer pages are plotted from one board load per format, not three per layer.

EDA-04903 (fourteen pages, a 50 MB board) spent most of a 50-minute build in
forty-odd ``kicad-cli`` processes, each loading the whole board. The batch is
one SVG crop, one SVG page and one PDF invocation; a failed batch falls back
to the per-layer plots so one bad layer still costs only its own page.
"""

from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path

import pikepdf

from app.release_studio.documents import acquisition, artwork
from app.services.kicad_tools import ToolResult
from tests.kicad_tool_fakes import FakeTool

SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="30mm" viewBox="0 0 40 30">'
    '<path d="M 0,0 L 40,0 L 40,30 L 0,30 Z"/></svg>'
)


def _pdf() -> bytes:
    buffer = io.BytesIO()
    document = pikepdf.new()
    document.add_blank_page(page_size=(200, 200))
    document.save(buffer)
    return buffer.getvalue()


def _value(args: list[str], flag: str) -> str:
    return args[args.index(flag) + 1]


def _kicad(skip: tuple[str, ...] = (), fail_batch: bool = False):
    """A kicad-cli that writes what the real one writes, minus the layers in *skip*."""

    pdf = _pdf()

    def run(args, **_kwargs):
        args = list(args)
        fmt, out = args[2], Path(_value(args, "--output"))
        if "--mode-single" in args:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(pdf) if fmt == "pdf" else out.write_text(SVG, encoding="utf-8")
            return ToolResult(0, "", "")
        if fail_batch:
            return ToolResult(1, "", "boom")
        stem = Path(args[-1]).stem
        for layer in _value(args, "--layers").split(","):
            if layer in skip:
                continue
            target = out / f"{stem}-{layer.replace('.', '_')}.{fmt}"
            target.write_bytes(pdf) if fmt == "pdf" else target.write_text(SVG, encoding="utf-8")
        return ToolResult(0, "", "")

    return FakeTool(run)


class LayerBatchTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.board = self.root / "board.kicad_pcb"
        self.layers = ("F.Cu", "In1.Cu", "B.Cu", "Edge.Cuts")

    def test_every_layer_comes_from_three_invocations(self) -> None:
        tool = _kicad()
        acquired = artwork.acquire_layers(tool, self.board, self.layers, self.root / "w")

        self.assertEqual(len(tool.calls), 3)
        for call in tool.calls:
            args = list(call["args"])
            self.assertEqual(_value(args, "--common-layers"), "Edge.Cuts")
            self.assertEqual(_value(args, "--layers"), ",".join(self.layers))
            self.assertTrue({"--mode-multi", "--mode-separate"} & set(args))
            self.assertEqual(call["timeout"], artwork.PLOT_TIMEOUT_SECONDS)
        self.assertEqual(set(acquired), set(self.layers))
        self.assertEqual(acquired["F.Cu"].layers, ("Edge.Cuts", "F.Cu"))
        self.assertEqual(acquired["Edge.Cuts"].layers, ("Edge.Cuts",))
        self.assertEqual(acquired["B.Cu"].view_width, 40.0)

    def test_a_layer_kicad_did_not_write_costs_only_that_layer(self) -> None:
        acquired = artwork.acquire_layers(_kicad(skip=("In1.Cu",)), self.board, self.layers, self.root / "w")
        self.assertIsInstance(acquired["In1.Cu"], artwork.ArtworkError)
        self.assertIsInstance(acquired["F.Cu"], artwork.AcquiredArtwork)

    def _views(self, tool: FakeTool) -> acquisition.AcquisitionResult:
        def absent(*_args, **_kwargs):
            raise artwork.ArtworkError("not under test")

        return acquisition.acquire_views(
            acquisition.AcquisitionRequest(
                board=self.board,
                workdir=self.root / "w",
                layer_pages=self.layers,
                cli=tool,
                drill_acquirer=absent,
                board_render_acquirer=absent,
            )
        )

    def test_the_documents_use_the_batch(self) -> None:
        tool = _kicad()
        result = self._views(tool)
        self.assertEqual(len(tool.calls), 3)
        self.assertEqual(set(result.layers), {acquisition.layer_artwork_key(layer) for layer in self.layers})

    def test_a_layer_the_batch_missed_is_plotted_on_its_own(self) -> None:
        tool = _kicad(skip=("In1.Cu",))
        result = self._views(tool)
        self.assertEqual(len(tool.calls), 3 + 3)
        self.assertEqual(set(result.layers), {acquisition.layer_artwork_key(layer) for layer in self.layers})
        self.assertFalse([warning for warning in result.warnings if "layer:" in warning])

    def test_file_names_follow_the_boards_own_layer_names(self) -> None:
        # EDA-04903 calls F.Cu "Top Layer"; an older board spells silkscreen
        # F.SilkS and may name it; KiCad suffixes each file with that display name.
        self.board.write_text(
            '(kicad_pcb (version 20240108)\n (layers\n  (0 "F.Cu" signal "Top Layer")\n'
            '  (4 "In1.Cu" signal)\n  (37 "F.SilkS" user "f.silkscreen")\n  (36 "B.SilkS" user)\n'
            '  (25 "Edge.Cuts" user)\n )\n (gr_line (start 0 0) (end 1 1) (layer "Edge.Cuts")))\n',
            encoding="utf-8",
        )
        self.assertEqual(
            artwork.plot_file_layer_names(self.board),
            {
                "F.Cu": "Top Layer",
                "In1.Cu": "In1.Cu",
                "F.Silkscreen": "f.silkscreen",
                "B.Silkscreen": "B.Silkscreen",
                "Edge.Cuts": "Edge.Cuts",
            },
        )

    def test_a_failed_batch_falls_back_to_one_plot_per_layer(self) -> None:
        tool = _kicad(fail_batch=True)
        result = self._views(tool)
        self.assertEqual(set(result.layers), {acquisition.layer_artwork_key(layer) for layer in self.layers})
        self.assertEqual(len(tool.calls), 3 + 3 * len(self.layers))


if __name__ == "__main__":
    unittest.main()
