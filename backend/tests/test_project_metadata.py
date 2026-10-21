from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services import kicad_board_stats_service, project_metadata_service
from support.repo import git, init_repo  # noqa: E402


# A board header in the shape KiCad writes one: the fields the project card
# shows are all in the first few hundred bytes, before any geometry.
BOARD_HEADER = """(kicad_pcb
\t(version 20240819)
\t(generator "pcbnew")
\t(generator_version "8.99")
\t(paper "A4")
\t(title_block
\t\t(title "Mainboard")
\t\t(date "2026-08-31")
\t\t(rev "V1.0")
\t\t(company "Example Ltd")
\t\t(comment 1 "First note")
\t)
"""

SCHEMATIC_HEADER = """(kicad_sch
\t(version 20231120)
\t(generator "eeschema")
\t(generator_version "8.0")
\t(paper "A3")
\t(uuid "00000000-0000-0000-0000-000000000001")
\t(title_block
\t\t(title "Sheet")
\t\t(rev "A")
\t)
"""

# The project sidecar Cynthion ships: every title block field is authored from
# one of these, and the values live here rather than in the board.
PROJECT_SETTINGS = {
    "meta": {"filename": "board.kicad_pro", "version": 3},
    "text_variables": {
        "TITLE": "Cynthion",
        "DATE": "2024-08-27",
        "VERSION": "1.4.0",
        "COPYRIGHT": "Copyright 2019-2024 Great Scott Gadgets",
        "LICENSE": "Licensed under the CERN-OHL-P v2",
    },
}

# Cynthion's authoring shape, on a KiCad 7 board: every field is a variable.
VARIABLE_BOARD_HEADER = """(kicad_pcb
\t(version 20221018)
\t(generator "pcbnew")
\t(title_block
\t\t(title "${TITLE}")
\t\t(date "${DATE}")
\t\t(rev "${VERSION}")
\t\t(company "${COPYRIGHT}")
\t\t(comment 1 "${LICENSE}")
\t)
)
"""

# Yard Stick One, same authors: a literal title beside variable fields. The
# split is per field, so one file can be half expanded and half not.
MIXED_BOARD_HEADER = """(kicad_pcb
\t(version 20221018)
\t(generator "pcbnew")
\t(title_block
\t\t(title "YARD Stick One")
\t\t(date "${DATE}")
\t\t(rev "${VERSION}")
\t)
)
"""

# KiCad 8+ writes a copy of the project variables into the board as top-level
# `(property ...)` entries, so the board still resolves without its sidecar.
# The nested footprint entry is a footprint property and must not be read.
DOCUMENT_PROPERTY_BOARD_HEADER = """(kicad_pcb
\t(version 20240706)
\t(generator "pcbnew")
\t(title_block
\t\t(title "${TITLE1}")
\t)
\t(property "TITLE1" "WREN-V Single")
\t(footprint "Pads:MTG370_800"
\t\t(property "TITLE1" "footprint property, not a variable")
\t)
)
"""

VARIABLE_SCHEMATIC_HEADER = """(kicad_sch
\t(version 20231120)
\t(generator "eeschema")
\t(uuid "00000000-0000-0000-0000-000000000001")
\t(title_block
\t\t(title "${TITLE}")
\t\t(date "${DATE}")
\t)
)
"""


def _write_project(root: Path, settings: dict = PROJECT_SETTINGS, name: str = "board") -> str:
    path = root / f"{name}.kicad_pro"
    path.write_text(json.dumps(settings), encoding="utf-8")
    return str(path)


def _write(directory: Path, name: str, header: str, filler_mb: int = 0) -> str:
    path = directory / name
    with path.open("w", encoding="utf-8") as handle:
        handle.write(header)
        # Geometry after the header, so a test that reads only the header slice
        # is genuinely reading past nothing it needs.
        for _ in range(filler_mb * 1024):
            handle.write('\t(gr_line (start 0 0) (end 1 1) (layer "Edge.Cuts"))\n' * 16)
        handle.write(")\n")
    return str(path)


class BoardFactsTests(unittest.TestCase):
    """KiCad reports dimensions as formatted quantities, not numbers."""

    def test_reduces_a_real_stats_report(self) -> None:
        stats = {
            "metadata": {"generator": "KiCad 10.0.4"},
            "board": {
                "has_outline": True,
                "width": "160.0000 mm",
                "height": "233.3500 mm",
                "board_thickness": "1.5640 mm",
            },
        }

        facts = kicad_board_stats_service.board_facts(stats)

        self.assertEqual(facts["dimensions_mm"], {"width_mm": 160.0, "height_mm": 233.35})
        self.assertEqual(facts["thickness_mm"], 1.564)
        self.assertEqual(facts["stats_generator"], "KiCad 10.0.4")

    def test_dimension_keys_match_what_the_panel_reads(self) -> None:
        """The response model cannot catch a renamed key here.

        ``ProjectPropertiesPcbFile.dimensions_mm`` is typed ``Dict[str, float]``,
        so any key names validate. The panel's ``formatPcbDimensions`` reads
        ``width_mm`` and ``height_mm`` specifically, and renders "Not available"
        for anything else -- which looks exactly like a board with no outline
        rather than like a bug.
        """
        facts = kicad_board_stats_service.board_facts(
            {"board": {"has_outline": True, "width": "10.0000 mm", "height": "20.0000 mm"}}
        )

        self.assertEqual(sorted(facts["dimensions_mm"]), ["height_mm", "width_mm"])

    def test_board_without_an_outline_reports_no_dimensions(self) -> None:
        facts = kicad_board_stats_service.board_facts(
            {"board": {"has_outline": False, "width": "0.0000 mm", "height": "0.0000 mm"}}
        )

        self.assertIsNone(facts["dimensions_mm"])

    def test_refuses_a_unit_it_does_not_understand(self) -> None:
        # Better a blank field than a number silently in the wrong unit.
        facts = kicad_board_stats_service.board_facts(
            {"board": {"has_outline": True, "width": "6.3 in", "height": "9.1 in"}}
        )

        self.assertIsNone(facts["dimensions_mm"])

    def test_empty_report_is_survivable(self) -> None:
        facts = kicad_board_stats_service.board_facts({})

        self.assertIsNone(facts["dimensions_mm"])
        self.assertIsNone(facts["thickness_mm"])


class RepositoryFactsTests(unittest.TestCase):
    """The commit and tag lines on the card are Git work, so they are stored too."""

    def _repo(self, directory: Path) -> str:
        init_repo(directory)
        (directory / "board.kicad_pcb").write_text(BOARD_HEADER + ")\n", encoding="utf-8")
        git(directory, "add", "-A")
        git(directory, "commit", "-qm", "first")
        return str(directory)

    def test_fingerprint_moves_with_head(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = self._repo(Path(directory))
            before = project_metadata_service.repo_fingerprint(repo)

            (Path(repo) / "note.txt").write_text("x", encoding="utf-8")
            git(repo, "add", "-A")
            git(repo, "commit", "-qm", "second")

            self.assertNotEqual(before, project_metadata_service.repo_fingerprint(repo))

    def test_fingerprint_moves_when_a_tag_is_added_without_a_commit(self) -> None:
        # A release can be tagged without HEAD moving, and the card shows the
        # latest tag, so HEAD alone is not a sufficient fingerprint.
        with tempfile.TemporaryDirectory() as directory:
            repo = self._repo(Path(directory))
            before = project_metadata_service.repo_fingerprint(repo)

            git(repo, "tag", "v1.0")

            self.assertNotEqual(before, project_metadata_service.repo_fingerprint(repo))

    def test_no_repository_fingerprints_to_nothing(self) -> None:
        self.assertEqual(project_metadata_service.repo_fingerprint(None), "")


class ProjectFileLocationTests(unittest.TestCase):
    def test_locates_the_project_file_the_anchor_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_project(root, name="alpha")
            beta = _write_project(root, name="beta")

            located = project_metadata_service.locate_project_file(str(root), "beta.kicad_pro")

        self.assertEqual(Path(located).resolve(), Path(beta).resolve())

    def test_missing_project_file_is_not_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.assertIsNone(project_metadata_service.locate_project_file(directory))


class SourceFingerprintTests(unittest.TestCase):
    """The fingerprint is what lets a stored row notice it has gone stale."""

    def test_changes_when_a_file_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pcb = _write(root, "board.kicad_pcb", BOARD_HEADER)
            before = project_metadata_service.source_fingerprint(None, pcb)

            with open(pcb, "a", encoding="utf-8") as handle:
                handle.write("\n; edited\n")
            os.utime(pcb, (0, 0))

            after = project_metadata_service.source_fingerprint(None, pcb)

        self.assertNotEqual(before, after)

    def test_changes_when_the_project_file_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pcb = _write(root, "board.kicad_pcb", BOARD_HEADER)
            pro = _write_project(root, {"text_variables": {"TITLE": "Before"}})
            before = project_metadata_service.source_fingerprint(None, pcb, pro)

            _write_project(root, {"text_variables": {"TITLE": "After"}})
            os.utime(pro, (0, 0))
            after = project_metadata_service.source_fingerprint(None, pcb, pro)

        self.assertNotEqual(before, after)
        self.assertNotEqual(
            before, project_metadata_service.source_fingerprint(None, pcb)
        )

    def test_is_stable_for_an_untouched_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            pcb = _write(Path(directory), "board.kicad_pcb", BOARD_HEADER)

            self.assertEqual(
                project_metadata_service.source_fingerprint(None, pcb),
                project_metadata_service.source_fingerprint(None, pcb),
            )

    def test_distinguishes_absent_from_missing(self) -> None:
        self.assertNotEqual(
            project_metadata_service.source_fingerprint(None, None),
            project_metadata_service.source_fingerprint(None, "/nonexistent.kicad_pcb"),
        )


if __name__ == "__main__":
    unittest.main()
