"""Tests for back-side footprint normalisation.

The geometric transform itself is KiCad's own `FOOTPRINT::Flip`, verified against
pcbnew in the KiCad container. These tests cover the parts that run everywhere:
side detection, and that a missing or failing KiCad runtime degrades to importing
the original bytes rather than raising or corrupting them.
"""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import kicad_footprint_normalizer as normalizer  # noqa: E402

FRONT_FOOTPRINT = b"""(footprint "R_0402"
\t(version 20240108)
\t(generator "kicad-prism")
\t(layer "F.Cu")
\t(pad "1" smd roundrect
\t\t(at -0.4825 0)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t)
)
"""

BACK_FOOTPRINT = b"""(footprint "R_0402"
\t(version 20240108)
\t(generator "kicad-prism")
\t(layer "B.Cu")
\t(pad "1" smd roundrect
\t\t(at -0.4825 0)
\t\t(layers "B.Cu" "B.Paste" "B.Mask")
\t)
)
"""

# What the extractor writes for a resistor placed at 90 degrees: the placement
# position is dropped and the angle kept, because KiCad stores the pads' and
# text's angles *including* the placement angle.
ROTATED_FRONT_FOOTPRINT = b"""(footprint "R_0402"
\t(version 20240108)
\t(generator "kicad-prism")
\t(at 0 0 90)
\t(layer "F.Cu")
\t(pad "1" smd roundrect
\t\t(at -0.4825 0 90)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t)
)
"""

ROTATED_BACK_FOOTPRINT = (
    ROTATED_FRONT_FOOTPRINT.replace(b'(layer "F.Cu")', b'(layer "B.Cu")').replace(
        b'"F.Cu" "F.Paste" "F.Mask"', b'"B.Cu" "B.Paste" "B.Mask"'
    )
)


class SideDetectionTests(unittest.TestCase):
    def test_front_footprint_is_not_flagged(self) -> None:
        self.assertFalse(normalizer._looks_back_side(FRONT_FOOTPRINT))

    def test_back_footprint_is_flagged(self) -> None:
        self.assertTrue(normalizer._looks_back_side(BACK_FOOTPRINT))

    def test_only_the_footprint_layer_decides(self) -> None:
        """A front footprint with back-layer pads is still a front footprint."""
        mixed = FRONT_FOOTPRINT.replace(b'"F.Cu" "F.Paste"', b'"B.Cu" "B.Paste"')
        self.assertFalse(normalizer._looks_back_side(mixed))

    def test_detection_survives_undecodable_bytes(self) -> None:
        self.assertFalse(normalizer._looks_back_side(b"\xff\xfe not a footprint"))


class NormalizationTests(unittest.TestCase):
    def test_front_footprints_skip_the_subprocess_entirely(self) -> None:
        with patch.object(subprocess, "run") as run:
            result = normalizer.normalize_footprint(FRONT_FOOTPRINT, "R_0402")
        run.assert_not_called()
        self.assertFalse(result.changed)
        self.assertEqual(result.payload, FRONT_FOOTPRINT)

    def test_missing_kicad_runtime_keeps_the_original_bytes(self) -> None:
        """Without pcbnew the import must still succeed, mirrored but intact."""
        with patch.object(
            normalizer.subprocess, "run", side_effect=OSError("pcbnew unavailable")
        ):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")

        self.assertFalse(result.changed)
        self.assertEqual(result.payload, BACK_FOOTPRINT)
        self.assertIn("pcbnew unavailable", result.error)

    def test_normaliser_failure_is_reported_not_raised(self) -> None:
        completed = subprocess.CompletedProcess(
            args=[], returncode=3, stdout="", stderr="could not load footprint R_0402\n"
        )
        with patch.object(normalizer.subprocess, "run", return_value=completed):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")

        self.assertFalse(result.changed)
        self.assertEqual(result.payload, BACK_FOOTPRINT)
        self.assertEqual(result.error, "could not load footprint R_0402")

    def test_timeout_does_not_propagate(self) -> None:
        with patch.object(
            normalizer.subprocess,
            "run",
            side_effect=subprocess.TimeoutExpired(cmd="normalize", timeout=60),
        ):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")
        self.assertFalse(result.changed)
        self.assertEqual(result.payload, BACK_FOOTPRINT)

    def test_successful_run_returns_the_rewritten_footprint(self) -> None:
        rewritten = FRONT_FOOTPRINT.replace(b"R_0402", b"R_0402")

        def fake_run(command, **_kwargs):
            output_dir = Path(command[-2])
            (output_dir / f"{command[-1]}.kicad_mod").write_bytes(rewritten)
            return subprocess.CompletedProcess(args=command, returncode=0, stdout="", stderr="")

        with patch.object(normalizer.subprocess, "run", side_effect=fake_run):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")

        self.assertTrue(result.changed)
        self.assertEqual(result.payload, rewritten)

    def test_a_silent_normaliser_is_treated_as_failure(self) -> None:
        """Exit code 0 without an output file must not be reported as success."""
        completed = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        with patch.object(normalizer.subprocess, "run", return_value=completed):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")

        self.assertFalse(result.changed)
        self.assertEqual(result.payload, BACK_FOOTPRINT)
        self.assertIn("no footprint", result.error)

    def test_hostile_footprint_names_cannot_escape_the_temp_directory(self) -> None:
        captured: dict[str, str] = {}

        def fake_run(command, **_kwargs):
            captured["name"] = command[-1]
            output_dir = Path(command[-2])
            (output_dir / f"{command[-1]}.kicad_mod").write_bytes(FRONT_FOOTPRINT)
            return subprocess.CompletedProcess(args=command, returncode=0, stdout="", stderr="")

        with patch.object(normalizer.subprocess, "run", side_effect=fake_run):
            normalizer.normalize_footprint(BACK_FOOTPRINT, "../../etc/passwd")

        # The name becomes a filename inside a temp directory, so it must not carry
        # any path structure.
        self.assertNotIn("/", captured["name"])
        self.assertNotIn("\\", captured["name"])


class RotationDetectionTests(unittest.TestCase):
    """The placement angle is only the footprint's own top-level ``(at …)``."""

    def test_placement_angle_is_read_from_the_footprint(self) -> None:
        self.assertEqual(normalizer._footprint_rotation_degrees(ROTATED_FRONT_FOOTPRINT), 90.0)

    def test_an_absent_placement_angle_reads_as_zero(self) -> None:
        self.assertEqual(normalizer._footprint_rotation_degrees(FRONT_FOOTPRINT), 0.0)

    def test_a_pads_angle_is_not_the_placement_angle(self) -> None:
        pad_rotated = FRONT_FOOTPRINT.replace(b"(at -0.4825 0)", b"(at -0.4825 0 90)")
        self.assertEqual(normalizer._footprint_rotation_degrees(pad_rotated), 0.0)

    def test_a_property_angle_is_not_the_placement_angle(self) -> None:
        property_rotated = FRONT_FOOTPRINT.replace(b"\t(layer \"F.Cu\")", b'\t(property "Value" "x" (at 0 0 90))\n\t(layer "F.Cu")')
        self.assertEqual(normalizer._footprint_rotation_degrees(property_rotated), 0.0)

    def test_attr_is_not_mistaken_for_at(self) -> None:
        with_attr = FRONT_FOOTPRINT.replace(b'\t(layer "F.Cu")', b'\t(layer "F.Cu")\n\t(attr smd)')
        self.assertEqual(normalizer._footprint_rotation_degrees(with_attr), 0.0)


class NormalizeFootprintTests(unittest.TestCase):
    @staticmethod
    def _fake_run(rewritten: bytes):
        def fake_run(command, **_kwargs):
            output_dir = Path(command[-2])
            (output_dir / f"{command[-1]}.kicad_mod").write_bytes(rewritten)
            return subprocess.CompletedProcess(args=command, returncode=0, stdout="", stderr="")

        return fake_run

    def test_front_side_at_zero_degrees_skips_the_subprocess(self) -> None:
        with patch.object(subprocess, "run") as run:
            result = normalizer.normalize_footprint(FRONT_FOOTPRINT, "R_0402")
        run.assert_not_called()
        self.assertFalse(result.changed)
        self.assertFalse(result.rotated)
        self.assertEqual(result.payload, FRONT_FOOTPRINT)

    def test_rotated_front_footprint_is_rewritten(self) -> None:
        with patch.object(subprocess, "run", side_effect=self._fake_run(FRONT_FOOTPRINT)) as run:
            result = normalizer.normalize_footprint(ROTATED_FRONT_FOOTPRINT, "R_0402")

        run.assert_called_once()
        self.assertTrue(result.changed)
        self.assertFalse(result.flipped)
        self.assertTrue(result.rotated)
        self.assertEqual(result.rotation_degrees, 90.0)
        self.assertEqual(result.payload, FRONT_FOOTPRINT)

    def test_back_footprint_reports_the_flip_alone(self) -> None:
        with patch.object(subprocess, "run", side_effect=self._fake_run(FRONT_FOOTPRINT)):
            result = normalizer.normalize_footprint(BACK_FOOTPRINT, "R_0402")

        self.assertTrue(result.changed)
        self.assertTrue(result.flipped)
        self.assertFalse(result.rotated)

    def test_a_rotated_back_footprint_reports_both(self) -> None:
        with patch.object(subprocess, "run", side_effect=self._fake_run(FRONT_FOOTPRINT)):
            result = normalizer.normalize_footprint(ROTATED_BACK_FOOTPRINT, "R_0402")

        self.assertTrue(result.changed)
        self.assertTrue(result.flipped)
        self.assertTrue(result.rotated)
        self.assertEqual(result.rotation_degrees, 90.0)

    def test_a_failed_rotation_still_reports_why(self) -> None:
        completed = subprocess.CompletedProcess(args=[], returncode=3, stdout="", stderr="no pcbnew\n")
        with patch.object(subprocess, "run", return_value=completed):
            result = normalizer.normalize_footprint(ROTATED_FRONT_FOOTPRINT, "R_0402")

        self.assertFalse(result.changed)
        self.assertEqual(result.payload, ROTATED_FRONT_FOOTPRINT)
        self.assertEqual(result.error, "no pcbnew")
        self.assertTrue(result.rotated)

    def test_the_subprocess_runs_on_the_backend_interpreter(self) -> None:
        captured: dict[str, str] = {}

        def fake_run(command, **_kwargs):
            captured["executable"] = command[0]
            output_dir = Path(command[-2])
            (output_dir / f"{command[-1]}.kicad_mod").write_bytes(FRONT_FOOTPRINT)
            return subprocess.CompletedProcess(args=command, returncode=0, stdout="", stderr="")

        with patch.object(subprocess, "run", side_effect=fake_run):
            normalizer.normalize_footprint(ROTATED_FRONT_FOOTPRINT, "R_0402")

        self.assertEqual(captured["executable"], sys.executable)

if __name__ == "__main__":
    unittest.main()
