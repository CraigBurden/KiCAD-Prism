"""Layer and drill-map plots are bounded like every other kicad-cli run.

They used to call kicad-cli with no timeout and the worker's own temp dir, so a
wedged plot held the build forever and three concurrent plots shared one
KiCad instance lock. Isolation now belongs to the kicad-cli tool itself
(``test_kicad_tools``); these tests pin that each plot states a timeout and
that an expired one costs the sheet, not the document set.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.release_studio.documents import artwork
from app.services.kicad_tools import ToolResult, ToolTimeout
from tests.kicad_tool_fakes import FakeTool


class ArtworkPlotBoundsTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def test_layer_plots_state_a_timeout(self) -> None:
        tool = FakeTool(lambda args, **_: ToolResult(1, "", "refused"))
        with self.assertRaises(artwork.ArtworkError):
            artwork.acquire(tool, self.root / "b.kicad_pcb", ("F.Cu",), self.root / "w")
        self.assertEqual(len(tool.calls), 3)
        self.assertTrue(all(call["timeout"] == artwork.PLOT_TIMEOUT_SECONDS for call in tool.calls))

    def test_the_drill_map_states_a_timeout(self) -> None:
        tool = FakeTool(lambda args, **_: ToolResult(1, "", "refused"))
        with self.assertRaises(artwork.ArtworkError):
            artwork.acquire_drill_map(tool, self.root / "b.kicad_pcb", self.root / "w")
        self.assertEqual(tool.calls[0]["timeout"], artwork.PLOT_TIMEOUT_SECONDS)

    def test_an_expired_plot_is_an_artwork_error(self) -> None:
        def expire(args, **_kwargs):
            raise ToolTimeout("kicad-cli timed out after 600s: pcb export drill", 600)

        with self.assertRaisesRegex(artwork.ArtworkError, "timed out"):
            artwork.acquire_drill_map(FakeTool(expire), self.root / "b.kicad_pcb", self.root / "w")


if __name__ == "__main__":
    unittest.main()
