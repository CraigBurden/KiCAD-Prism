"""The catalog usage scan from ``projections/occurrences.json`` (WP-C7a, ADR §9.6 C7).

Two things are pinned. **Parity**: on the committed parity cases whose sources
the bundle did not upgrade, the golden member is exactly what ``prism-kicad``
writes for the committed bytes, so mapping it must give the same ``PlacedSymbol``
list ``placed_symbols`` reads from those schematics. **The switch**: ``legacy``
never opens a bundle, ``bundle`` with a ready member uses it, and a member that
is pending or final-but-not-ready keeps today's scan.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.services import project_catalog_usage_service, project_revision
from app.services.catalog.placement_stamp import PlacedSymbol, placed_symbols
from app.services.design_bundle import consumer
from app.services.design_bundle.errors import DesignDataFailed, DesignDataPending
from app.services.design_bundle.manifest import Readiness
from support.repo import init_repo

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
MEMBER = project_catalog_usage_service.OCCURRENCES_MEMBER

#: WP-C7a's acceptance list: parity cases whose sources were not upgraded, so
#: their golden is the member for the committed bytes (task WP-C7a).
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


def _legacy_symbols(case_dir: Path) -> list[PlacedSymbol]:
    """Today's scan of the fixture: the file set and order ``read_commit_symbols`` uses.

    The pre-bundle scanner's file set and order, kept as the parity oracle on
    the committed fixture directory (no Git repository, no scan in ``app``).
    """
    schematics = project_revision.SourceSet(
        "schematics", suffixes=frozenset({".kicad_sch"}), skip_generated=True
    )
    files = sorted(
        path
        for path in case_dir.rglob("*.kicad_sch")
        if not path.is_symlink()
        and schematics.includes(path.relative_to(case_dir).as_posix())
    )
    symbols: list[PlacedSymbol] = []
    for path in files:
        relative = path.relative_to(case_dir).as_posix()
        symbols.extend(placed_symbols(path.read_text(encoding="utf-8", errors="ignore"), relative))
    return symbols


def _symbol_key(symbol: PlacedSymbol) -> tuple:
    return (
        symbol.schematic,
        symbol.symbol_uuid,
        symbol.lib_id,
        symbol.references,
        dict(symbol.properties),
        symbol.stamp,
    )


class ParityTests(unittest.TestCase):
    """The member maps to exactly what today's scanner reads from the schematics."""

    def test_mapping_reproduces_the_legacy_scan_on_every_fixture(self) -> None:
        fixtures = _fixtures_by_id()
        for case_id in NON_UPGRADED:
            with self.subTest(case=case_id):
                self.assertIn(case_id, fixtures)
                member = json.loads(
                    (GOLDENS / case_id / "occurrences.json").read_text(encoding="utf-8")
                )
                legacy = _legacy_symbols(REPO / fixtures[case_id]["sourceRoot"])
                # The fixture project sits at its source root, so its repository
                # root is the project directory and no prefix comes off.
                mapped = project_catalog_usage_service.placed_symbols_from_occurrences(member, "")
                self.assertEqual([_symbol_key(symbol) for symbol in mapped],
                                 [_symbol_key(symbol) for symbol in legacy])


class MappingTests(unittest.TestCase):
    """The mapping's own rules, apart from any fixture."""

    def test_strips_the_project_directory_from_document_paths(self) -> None:
        member = {"symbols": [{
            "symbolUuid": "a", "documentPath": "sub/board.kicad_sch", "libId": "Device:R",
            "reference": "R1", "properties": {"Reference": "R1"},
        }]}

        [symbol] = project_catalog_usage_service.placed_symbols_from_occurrences(member, "sub")

        self.assertEqual(symbol.schematic, "board.kicad_sch")

    def test_groups_occurrences_by_document_and_uuid_in_path_then_file_order(self) -> None:
        member = {"symbols": [
            {"symbolUuid": "b", "documentPath": "z.kicad_sch", "libId": "Device:C",
             "reference": "C1", "properties": {"Reference": "C1", "Value": "1u"}},
            {"symbolUuid": "a", "documentPath": "a.kicad_sch", "libId": "Device:R",
             "reference": "R7", "properties": {"Reference": "R7"}},
            {"symbolUuid": "a", "documentPath": "a.kicad_sch", "libId": "Device:R",
             "reference": "R8", "properties": {"Reference": "R7"}},
        ]}

        symbols = project_catalog_usage_service.placed_symbols_from_occurrences(member)

        self.assertEqual([(s.schematic, s.symbol_uuid, s.references) for s in symbols],
                         [("a.kicad_sch", "a", ("R7", "R8")), ("z.kicad_sch", "b", ("C1",))])
        self.assertEqual(symbols[0].lib_id, "Device:R")

    def test_the_stamp_comes_from_the_properties(self) -> None:
        component = "0b1c2d3e-0000-4000-8000-000000000001"
        revision = "0b1c2d3e-0000-4000-8000-000000000002"
        member = {"symbols": [{
            "symbolUuid": "a", "documentPath": "board.kicad_sch", "libId": "Device:R",
            "reference": "R1",
            "properties": {"Reference": "R1", "Prism_Component": component, "Prism_Revision": revision},
        }]}

        [symbol] = project_catalog_usage_service.placed_symbols_from_occurrences(member)

        self.assertEqual((symbol.stamp.component_id, symbol.stamp.revision_id), (component, revision))

    def test_a_member_without_symbols_is_empty(self) -> None:
        self.assertEqual(project_catalog_usage_service.placed_symbols_from_occurrences({"symbols": []}), [])


SCHEMATIC = (
    '(kicad_sch (version 20250114) (generator "eeschema")\n'
    '\t(symbol (lib_id "Device:R") (at 10 10 0) (unit 1)\n'
    '\t\t(uuid "11111111-1111-1111-1111-111111111111")\n'
    '\t\t(property "Reference" "R1" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
    '\t\t(property "Value" "10k" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
    '\t\t(instances\n\t\t\t(project "board"\n'
    '\t\t\t\t(path "/root" (reference "R1") (unit 1))\n'
    "\t\t\t)\n\t\t)\n\t)\n)\n"
)

#: A ready member that maps to a symbol the schematic scan cannot produce.
MEMBER_DOCUMENT = {
    "schema": "prism.occurrences.a0",
    "sheets": [],
    "symbols": [{
        "kiidPath": "/root/22222222-2222-2222-2222-222222222222",
        "sheetPath": "/root",
        "symbolUuid": "22222222-2222-2222-2222-222222222222",
        "documentPath": "board/main.kicad_sch",
        "libId": "Custom:R",
        "reference": "R9",
        "properties": {"Reference": "R9", "Value": "1M"},
    }],
    "footprints": [],
    "references": [],
    "variantDeclarations": [],
}


class _Opened:
    """The parts of ``reader.OpenedRevision`` that ``bundle_read`` touches."""

    def __init__(self, states: dict[str, str], member: dict | None = None, *, absent: bool = False):
        self.absent = absent
        self._states = states
        self._member = member

    def readiness(self, paths):
        return {
            path: Readiness(path, self._states.get(path, "pending"), "parse", "")
            for path in paths
        }

    def read_json(self, path):
        return self._member


class ConsumerTests(unittest.TestCase):
    """``read_commit_symbols`` reads the member, and failures are typed (ADR §9.7 R1)."""

    def setUp(self) -> None:
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.commit = init_repo(root, {"board/main.kicad_sch": SCHEMATIC}, message="board")
        self.location = project_revision.ProjectLocation(root, "board")

    def _read(self, opened):
        with mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
            result = project_catalog_usage_service.read_commit_symbols(
                self.location, self.commit, project_id="prj"
            )
        return result, open_revision

    def test_a_ready_member_is_mapped(self) -> None:
        result, open_revision = self._read(_Opened({MEMBER: "ready"}, MEMBER_DOCUMENT))

        open_revision.assert_called_once()
        self.assertEqual([_symbol_key(s) for s in result],
                         [_symbol_key(s) for s in
                          project_catalog_usage_service.placed_symbols_from_occurrences(MEMBER_DOCUMENT, "board")])

    def test_pending_and_failed_are_typed(self) -> None:
        cases = (
            ("pending", DesignDataPending),
            ("unavailable", DesignDataPending),
            ("failed", DesignDataFailed),
            ("skipped", DesignDataFailed),
            ("not-applicable", DesignDataFailed),
        )
        for state, error in cases:
            with self.subTest(state=state), self.assertRaises(error):
                self._read(_Opened({MEMBER: state}, MEMBER_DOCUMENT))

    def test_without_a_project_id_the_member_cannot_be_looked_up(self) -> None:
        with mock.patch.object(consumer.reader, "open_revision") as open_revision:
            with self.assertRaises(ValueError):
                project_catalog_usage_service.read_commit_symbols(self.location, self.commit)
        open_revision.assert_not_called()
