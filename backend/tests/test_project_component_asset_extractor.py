from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.kicad_footprint_normalizer import NormalizedFootprint  # noqa: E402
from app.services.project_component_asset_extractor import (  # noqa: E402
    ContentAddressedAssetStager,
    sanitize_board_footprint,
)


class ProjectComponentAssetExtractorTests(unittest.TestCase):
    def test_board_footprint_sanitizing_leaves_no_blank_lines(self) -> None:
        # KiCad writes each pad child on its own line; removing the board-only
        # ones used to leave their indented lines behind, empty.
        block = """(footprint "Acme:R_0402"
\t(layer "F.Cu")
\t(uuid "7d1f")
\t(at 10 20)
\t(property "Reference" "R5"
\t\t(at 0 -1 0)
\t)
\t(property "Sheetname" "/")
\t(property "Sheetfile" "main.kicad_sch")
\t(pad "1" smd roundrect
\t\t(at -0.5 0)
\t\t(size 0.6 0.6)
\t\t(layers "F.Cu" "F.Mask")
\t\t(net 2 "VBUS")
\t\t(pinfunction "1")
\t\t(pintype "passive")
\t\t(uuid "a1")
\t)
)"""
        _, payload, _ = sanitize_board_footprint(block, "Acme:R_0402", version="20260206")
        text = payload.decode("utf-8")
        self.assertNotIn("pinfunction", text)
        self.assertNotIn("Sheetfile", text)
        self.assertNotIn("(net ", text)
        self.assertIn('(property "Reference" "REF**"', text)
        self.assertIn("(version 20260206)", text)
        self.assertEqual([line for line in text.splitlines() if not line.strip()], [])

    def test_content_stager_hard_links_same_bytes_with_different_logical_names(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            stager = ContentAddressedAssetStager(Path(tmp))
            first = stager.stage(filename="first.step", payload=b"same-model")
            repeated = stager.stage(filename="first.step", payload=b"same-model")
            alias = stager.stage(filename="second.step", payload=b"same-model")

            self.assertEqual(first, repeated)
            self.assertNotEqual(first, alias)
            self.assertTrue(first.samefile(alias))


if __name__ == "__main__":
    unittest.main()
