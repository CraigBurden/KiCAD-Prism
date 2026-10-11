"""Layer and drill-map plots are bounded and isolated like every other kicad-cli run.

They used to call kicad-cli with no timeout and the worker's own temp dir, so a
wedged plot held the build forever and three concurrent plots shared one
KiCad instance lock.
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from app.release_studio.documents import artwork


class _Refused:
    returncode = 1
    stdout = ""
    stderr = "refused"


class ArtworkPlotBoundsTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.calls: list[dict] = []

    def _runner(self, argv, **kwargs):  # noqa: ANN001
        self.calls.append(kwargs)
        return _Refused()

    def _assert_bounded_and_isolated(self) -> None:
        self.assertTrue(self.calls)
        for call in self.calls:
            self.assertGreater(call.get("timeout") or 0, 0)
            env = call.get("env") or {}
            self.assertIn("TMPDIR", env)
            self.assertNotEqual(env["TMPDIR"], os.environ.get("TMPDIR"))
            self.assertEqual(env["XDG_RUNTIME_DIR"], env["TMPDIR"])

    def test_layer_plots_have_a_timeout_and_their_own_temp_dir(self) -> None:
        with self.assertRaises(artwork.ArtworkError):
            artwork.acquire(
                "kicad-cli", self.root / "b.kicad_pcb", ("F.Cu",), self.root / "w",
                runner=self._runner,
            )
        self._assert_bounded_and_isolated()

    def test_the_drill_map_has_a_timeout_and_its_own_temp_dir(self) -> None:
        with self.assertRaises(artwork.ArtworkError):
            artwork.acquire_drill_map(
                "kicad-cli", self.root / "b.kicad_pcb", self.root / "w", runner=self._runner,
            )
        self._assert_bounded_and_isolated()


if __name__ == "__main__":
    unittest.main()
