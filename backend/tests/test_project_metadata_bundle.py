"""The card from ``projections/project.json`` (ADR §8, §9.7 R1).

The mapping's own rules are pinned here, and the metadata job's contract:
a ready member supplies the card, a pending one raises ``DesignDataPending``
(so the job retries), a failed one raises ``DesignDataFailed``, and a final
non-member leaves the card empty.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.services import (
    kicad_board_stats_service,
    project_metadata_service,
    project_properties_service,
)
from app.services.design_bundle import consumer
from app.services.design_bundle.errors import DesignDataFailed, DesignDataPending
from app.services.design_bundle.manifest import Readiness

MEMBER = "projections/project.json"


class CardMappingTests(unittest.TestCase):
    """The mapping's own rules, apart from any fixture."""

    def test_strips_the_project_directory_and_carries_the_header_fields(self) -> None:
        member = {
            "projectFile": "sub/proj.kicad_pro",
            "documents": [
                {
                    "path": "sub/proj.kicad_sch",
                    "kind": "root-schematic",
                    "formatVersion": 20260306,
                    "generator": "eeschema",
                    "generatorVersion": "10.0",
                    "expandedTitleBlock": {"title": "Board", "date": "2026-01-01", "comments": []},
                    "properties": {},
                },
                {
                    "path": "sub/proj.kicad_pcb",
                    "kind": "board",
                    "formatVersion": 20260206,
                    "generator": "pcbnew",
                    "generatorVersion": "10.0",
                    "properties": {},
                },
            ],
        }

        card = project_properties_service.card_from_project_member(
            member, {"dimensions_mm": {"width_mm": 1.0}, "thickness_mm": 1.6}
        )

        self.assertEqual(
            card["schematic"],
            {
                "path": "proj.kicad_sch",
                "filename": "proj.kicad_sch",
                "version": 20260306,
                "generator": "eeschema",
                "generator_version": "10.0",
                "title_block": {"title": "Board", "date": "2026-01-01"},
            },
        )
        self.assertEqual(card["pcb"]["path"], "proj.kicad_pcb")
        self.assertEqual(card["pcb"]["dimensions_mm"], {"width_mm": 1.0})
        self.assertEqual(card["pcb"]["thickness_mm"], 1.6)
        self.assertIsNone(card["pcb"]["title_block"])

    def test_a_document_outside_the_project_directory_shows_its_file_name(self) -> None:
        # Today's ``_relative_or_name``: a path that is not below the project
        # directory is shown by its name.
        self.assertEqual(
            project_properties_service._strip_project_directory("sub", "other/proj.kicad_pcb"),
            "proj.kicad_pcb",
        )
        self.assertEqual(
            project_properties_service._strip_project_directory("sub", "sub/deep/a.kicad_sch"),
            "deep/a.kicad_sch",
        )

    def test_absent_documents_and_an_empty_title_block(self) -> None:
        member = {
            "projectFile": "proj.kicad_pro",
            "documents": [
                {
                    "path": "proj.kicad_sch",
                    "kind": "root-schematic",
                    "expandedTitleBlock": {"title": "", "date": "", "comments": []},
                    "properties": {},
                },
            ],
        }

        card = project_properties_service.card_from_project_member(member)

        self.assertIsNone(card["pcb"])
        self.assertEqual(card["schematic"]["title_block"], {"title": "", "date": ""})


class _Opened:
    """The parts of ``reader.OpenedRevision`` that ``bundle_read`` touches."""

    def __init__(self, states: dict[str, str], member: dict):
        self.absent = False
        self._states = states
        self._member = member

    def readiness(self, paths):
        return {
            path: Readiness(path, self._states.get(path, "pending"), "parse", "")
            for path in paths
        }

    def read_json(self, path):
        return self._member


class BundleCardTests(unittest.TestCase):
    """``refresh_project_metadata`` reads the bundle; pending and failed are typed."""

    MEMBER_DOCUMENT = {
        "schema": "prism.project.a0",
        "projectFile": "board/board.kicad_pro",
        "projectName": "board",
        "textVariables": {},
        "netClasses": [],
        "documents": [
            {
                "path": "board/board.kicad_sch",
                "kind": "root-schematic",
                "formatVersion": 20260306,
                "generator": "eeschema",
                "generatorVersion": "9.0",
                "expandedTitleBlock": {"title": "From the member", "date": "2026-01-01", "comments": []},
                "properties": {},
            },
            {
                "path": "board/board.kicad_pcb",
                "kind": "board",
                "formatVersion": 20260206,
                "generator": "pcbnew",
                "generatorVersion": "9.0",
                "properties": {},
            },
        ],
        "references": [],
    }

    def setUp(self) -> None:
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.project_dir = root / "board"
        self.project_dir.mkdir()
        (self.project_dir / "board.kicad_pro").write_text(
            '{"meta": {"filename": "board.kicad_pro"}, "text_variables": {}}',
            encoding="utf-8",
        )
        (self.project_dir / "board.kicad_sch").write_text(
            '(kicad_sch (version 20231120) (generator "eeschema"))\n', encoding="utf-8"
        )
        (self.project_dir / "board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240819) (generator "pcbnew"))\n', encoding="utf-8"
        )
        self.schematic = str(self.project_dir / "board.kicad_sch")
        self.pcb = str(self.project_dir / "board.kicad_pcb")

    def _refresh(self, opened: _Opened):
        with (
            mock.patch.object(project_metadata_service, "workspace") as workspace,
            mock.patch.object(
                kicad_board_stats_service,
                "export_board_stats",
                side_effect=kicad_board_stats_service.BoardStatsUnavailable("stub"),
            ),
            mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision,
        ):
            workspace.get_project_metadata.return_value = None
            computed = project_metadata_service.refresh_project_metadata(
                "prj-1", str(self.project_dir), self.schematic, self.pcb
            )
        return computed, open_revision

    def test_a_ready_member_supplies_the_card(self) -> None:
        computed, open_revision = self._refresh(_Opened({MEMBER: "ready"}, self.MEMBER_DOCUMENT))

        open_revision.assert_called_once()
        self.assertEqual(computed["schematic"]["version"], 20260306)
        self.assertEqual(computed["schematic"]["generator_version"], "9.0")
        self.assertEqual(computed["schematic"]["path"], "board.kicad_sch")
        self.assertEqual(
            computed["schematic"]["title_block"],
            {"title": "From the member", "date": "2026-01-01"},
        )
        self.assertEqual(computed["pcb"]["generator"], "pcbnew")
        self.assertEqual(computed["board_stats_source"], "")

    def test_a_member_that_is_not_ready_is_pending(self) -> None:
        for state in ("pending", "unavailable"):
            with self.subTest(state=state), self.assertRaises(DesignDataPending):
                self._refresh(_Opened({MEMBER: state}, self.MEMBER_DOCUMENT))

    def test_a_failed_member_is_a_typed_failure(self) -> None:
        with self.assertRaises(DesignDataFailed):
            self._refresh(_Opened({MEMBER: "failed"}, self.MEMBER_DOCUMENT))

    def test_a_final_non_member_leaves_the_card_empty(self) -> None:
        for state in ("skipped", "not-applicable"):
            with self.subTest(state=state):
                computed, _ = self._refresh(_Opened({MEMBER: state}, self.MEMBER_DOCUMENT))
                self.assertIsNone(computed["schematic"])
                self.assertIsNone(computed["pcb"])


if __name__ == "__main__":
    unittest.main()
