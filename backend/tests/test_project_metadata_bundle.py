"""The card from ``projections/project.json`` (WP-C8a, ADR §8 flag ``PROJECT_METADATA``).

Two things are pinned here. **Parity**: on the committed parity cases whose
sources the bundle did not upgrade, the golden member is exactly what
``prism-kicad`` writes for the committed bytes, so mapping it must give the same
``schematic``/``pcb`` dicts today's readers compute from those files. **The
switch**: ``legacy`` never opens a bundle, ``bundle`` with a ready member uses
it, and a member that is pending or final-but-not-ready keeps today's answer.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.core.config import settings
from app.services import (
    kicad_board_stats_service,
    project_metadata_service,
    project_properties_service,
)
from app.services.design_bundle import consumer
from app.services.design_bundle.manifest import Readiness

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
MEMBER = "projections/project.json"

#: WP-C8a's acceptance list: parity cases whose sources were not upgraded, so
#: their golden is the member for the committed bytes (task WP-C8a).
NON_UPGRADED = (
    "dv-case_fold",
    "dv-kicad11_tokens",
    "dv-no_variants",
    "dv-oracle",
    "dv-oracle_rev2",
    "dv-rule_area",
    "dv-sch_only",
    "sb-mini_obc-F0",
    "sb-mini_obc-F1",
    "sb-mini_obc-F11.1",
    "sb-mini_obc-F11.2",
    "sb-mini_obc-F2",
    "sb-mini_obc-F3",
    "sb-mini_obc-F4",
    "sb-mini_obc-F5",
    "sb-mini_obc-F6",
    "sb-mini_obc-F7",
    "sb-mini_obc-F8",
    "sb-mini_obc-F9",
    "sb-mini_payload-F0",
    "sb-mini_power-F0",
    "sb-mini_power-F10",
    "sb-p2-ambiguous-F0",
    "sb-p2-edge_a-F0",
    "sb-p2-edge_b-F0",
    "sb-p2-mezz_base-F0",
    "sb-p2-mezz_top-F0",
    "sb-p2-mezz_top-F1",
)


def _fixtures_by_id() -> dict[str, dict]:
    document = json.loads(
        (REPO / "native" / "parity" / "fixtures.json").read_text(encoding="utf-8")
    )
    return {case["id"]: case for case in document["fixtures"]}


def _legacy_card(case_dir: Path, project_file: str) -> dict:
    """Today's card from the fixture's files (field map, "How a golden is produced").

    Board stats are stubbed to ``{}`` on both sides: geometry is ``kicad-cli``'s,
    not this mapping's, so the comparison drops it by giving both the empty set.
    """
    from kicad_monkey import KiCadProject

    project = case_dir / project_file
    variables = dict(KiCadProject.from_file(str(project)).text_variables)
    schematic = project.with_suffix(".kicad_sch")
    board = project.with_suffix(".kicad_pcb")
    return {
        "schematic": project_properties_service.compute_schematic_metadata(
            str(project.parent),
            str(schematic) if schematic.exists() else None,
            project_variables=variables,
            project_name=project.stem,
        ),
        "pcb": project_properties_service.compute_pcb_metadata(
            str(project.parent),
            str(board) if board.exists() else None,
            {},
            project_variables=variables,
            project_name=project.stem,
        ),
    }


class ParityTests(unittest.TestCase):
    """The member maps to byte-for-byte what today's readers compute."""

    def test_mapping_reproduces_the_legacy_card_on_every_fixture(self) -> None:
        fixtures = _fixtures_by_id()
        for case_id in NON_UPGRADED:
            with self.subTest(case=case_id):
                self.assertIn(case_id, fixtures)
                case = fixtures[case_id]
                member = json.loads(
                    (GOLDENS / case_id / "project.json").read_text(encoding="utf-8")
                )
                legacy = _legacy_card(REPO / case["sourceRoot"], case["project"])
                derived = project_properties_service.card_from_project_member(member, {})
                self.assertEqual(derived, legacy)


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


class SwitchTests(unittest.TestCase):
    """``refresh_project_metadata`` chooses the bundle only for the ``bundle`` switch."""

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

    def _refresh(self, source: str, opened: _Opened):
        with (
            mock.patch.object(settings, "PRISM_DESIGN_SOURCE_PROJECT_METADATA", source),
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

    def test_legacy_never_opens_the_bundle(self) -> None:
        computed, open_revision = self._refresh(
            "legacy", _Opened({MEMBER: "ready"}, self.MEMBER_DOCUMENT)
        )

        open_revision.assert_not_called()
        self.assertEqual(computed["schematic"]["version"], 20231120)
        self.assertIsNone(computed["schematic"]["generator_version"])
        self.assertFalse(computed["reused_file_metadata"])

    def test_bundle_with_a_ready_member_uses_it(self) -> None:
        computed, open_revision = self._refresh(
            "bundle", _Opened({MEMBER: "ready"}, self.MEMBER_DOCUMENT)
        )

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

    def test_a_member_that_is_not_ready_falls_back_to_legacy(self) -> None:
        for state in ("pending", "skipped", "not-applicable"):
            with self.subTest(state=state):
                computed, open_revision = self._refresh(
                    "bundle", _Opened({MEMBER: state}, self.MEMBER_DOCUMENT)
                )
                open_revision.assert_called_once()
                self.assertEqual(computed["schematic"]["version"], 20231120)


if __name__ == "__main__":
    unittest.main()
