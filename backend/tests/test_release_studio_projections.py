"""Board-statistics projection and its read-only/live boundary."""

from __future__ import annotations

import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.release_studio.projections import (
    project_board_stats,
    project_board_stats_file,
)
from tests.release_studio_support import (
    fixture_entrypoint,
    fixture_root,
    requires_kicad_cli,
    run_kicad_cli,
)


def _assert_owned_stats_dates_absent(
    test_case: unittest.TestCase,
    value: object,
    *,
    wrapper: bool = False,
) -> None:
    test_case.assertIsInstance(value, dict)
    metadata = value.get("metadata")
    if isinstance(metadata, dict):
        test_case.assertNotIn("date", metadata)
    if wrapper:
        stats = value.get("stats")
        test_case.assertIsInstance(stats, dict)
        stats_metadata = stats.get("metadata")
        if isinstance(stats_metadata, dict):
            test_case.assertNotIn("date", stats_metadata)


class ReleaseStudioProjectionTests(unittest.TestCase):
    def test_board_stats_reuses_r4_boundary_without_mutating_input(self) -> None:
        raw = {
            "metadata": {
                "date": "2026-08-11T00:00:00Z",
                "generator": "KiCad 10.0.4",
            },
            "board": {
                "has_outline": True,
                "width": "30 mm",
                "height": "15 mm",
                "board_thickness": "1.6 mm",
            },
            "nested": {"metadata": {"date": "nested volatile value", "keep": True}},
        }
        original = copy.deepcopy(raw)

        projected = project_board_stats(raw)

        self.assertEqual(raw, original)
        self.assertEqual(projected["metadata"], {"generator": "KiCad 10.0.4"})
        self.assertEqual(
            projected["nested"],
            {"metadata": {"date": "nested volatile value", "keep": True}},
        )
        self.assertEqual(projected["board"]["board_thickness"], "1.6 mm")
        _assert_owned_stats_dates_absent(self, projected)

    def test_known_r4_wrapper_canonicalizes_only_owned_stats_paths(self) -> None:
        wrapper = {
            "metadata": {"date": "wrapper date", "owner": "R4"},
            "stats": {
                "metadata": {"date": "raw stats date", "generator": "KiCad 10.0.4"},
                "board": {"board_thickness": "1.6 mm"},
            },
            "nested": {"metadata": {"date": "unrelated date", "keep": True}},
        }
        original = copy.deepcopy(wrapper)

        projected = project_board_stats(wrapper)

        self.assertEqual(wrapper, original)
        _assert_owned_stats_dates_absent(self, projected, wrapper=True)
        self.assertEqual(projected["stats"]["metadata"]["generator"], "KiCad 10.0.4")
        self.assertEqual(
            projected["nested"]["metadata"],
            {"date": "unrelated date", "keep": True},
        )

    def test_object_json_text_does_not_probe_path_for_filename_length(self) -> None:
        raw_text = json.dumps(
            {
                "metadata": {"date": "volatile", "generator": "KiCad 10.0.4"},
                "board": {"board_thickness": "1.6 mm"},
            }
        )

        with patch("pathlib.Path.is_file", side_effect=OSError("filename too long")):
            projected = project_board_stats(raw_text)

        _assert_owned_stats_dates_absent(self, projected)

    def test_a_board_stats_file_is_read_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "board-stats.json"
            path.write_text(
                json.dumps(
                    {
                        "metadata": {"date": "volatile", "generator": "KiCad 10.0.4"},
                        "board": {"board_thickness": "1.6 mm"},
                    }
                ),
                encoding="utf-8",
            )
            with patch("pathlib.Path.open", autospec=True, side_effect=Path.open) as opened:
                projected = project_board_stats_file(path)

        _assert_owned_stats_dates_absent(self, projected)
        for call in opened.call_args_list:
            mode = call.kwargs.get("mode", "r")
            self.assertNotIn("w", mode)
            self.assertNotIn("a", mode)
            self.assertNotIn("+", mode)


class ReleaseStudioProjectionLiveTests(unittest.TestCase):
    @requires_kicad_cli()
    def test_kicad_10_0_4_board_stats_feed_projection_without_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            live_root = Path(temporary) / "cynthion"
            shutil.copytree(fixture_root("cynthion"), live_root)
            board = live_root / fixture_entrypoint("cynthion", "board").relative_to(
                fixture_root("cynthion")
            )
            stats_path = Path(temporary) / "board-stats.json"
            result = run_kicad_cli(
                "pcb",
                "export",
                "stats",
                "--format",
                "json",
                "--output",
                str(stats_path),
                str(board),
                cwd=live_root,
            )
            self.assertEqual(
                result.returncode,
                0,
                f"board stats export failed:\n{result.stdout}\n{result.stderr}",
            )
            raw = json.loads(stats_path.read_text(encoding="utf-8"))
            projected = project_board_stats(stats_path)

        self.assertIn("metadata", raw)
        self.assertIn("date", raw["metadata"])
        self.assertEqual(projected["metadata"]["generator"], raw["metadata"]["generator"])
        self.assertEqual(projected["board"], raw["board"])
        self.assertNotIn("date", projected["metadata"])
        _assert_owned_stats_dates_absent(self, projected)


if __name__ == "__main__":
    unittest.main()
