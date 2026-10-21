"""WP-C3a: Release Studio's board projections from the design bundle.

With ``PRISM_DESIGN_SOURCE_RELEASE_STUDIO=bundle`` and a resolved commit, the
five read-only board projections are rebuilt from the bundle members
(``projections/stackup.json``, ``placements.json``, ``occurrences.json``,
``project.json``) instead of Python ``kicad_monkey``.  Two things are pinned
here.

**Parity.**  On the committed parity cases whose sources the bundle did not
upgrade and whose goldens hold a board, mapping the goldens must give the same
values today's ``project_stackup``, ``project_population``,
``project_testpoints``, ``board_designators`` and ``project_variants`` compute
from those files.  The derivations are the field maps' "Release Studio" rules
(``stackup.md``, ``placements.md``, ``occurrences.md``).

**The switch.**  ``legacy`` never opens a bundle, a working tree never opens
one, a member that is pending falls back to today's code, and a ready bundle is
used without loading the legacy ``KiCadPcb``.  The divergences the field maps
document are asserted here rather than hidden.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest import mock

from app.core.config import settings
from app.release_studio import bundle_projections
from app.release_studio import document_pipeline
from app.release_studio import projections
from app.release_studio.projections import _variant_declaration
from app.services.design_bundle import consumer
from app.services.design_bundle.manifest import Readiness

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
STACKUP_MEMBER = "projections/stackup.json"
PLACEMENTS_MEMBER = "projections/placements.json"
OCCURRENCES_MEMBER = "projections/occurrences.json"
BOARD_OBJECTS_MEMBER = "projections/board-objects.json"
PROJECT_MEMBER = "projections/project.json"
SHA = "c" * 40

#: WP-C3a's acceptance list: parity cases whose sources were not upgraded before
#: capture, so the golden's stackup/placements/occurrences describe the same
#: committed bytes today's projections read (the same set as WP-C4a; the
#: upgraded cases rs-cynthion, rs-usb-pd, rs-synthetic and dv-legacy_in_bom are
#: excluded, and dv-malformed captured nothing).
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


def _golden(case_id: str, member: str) -> dict:
    return json.loads((GOLDENS / case_id / member).read_text(encoding="utf-8"))


def _golden_members(case_id: str) -> dict[str, dict]:
    return {
        STACKUP_MEMBER: _golden(case_id, "stackup.json"),
        PLACEMENTS_MEMBER: _golden(case_id, "placements.json"),
        OCCURRENCES_MEMBER: _golden(case_id, "occurrences.json"),
        BOARD_OBJECTS_MEMBER: _golden(case_id, "board-objects.json"),
        PROJECT_MEMBER: _golden(case_id, "project.json"),
    }


def _without_testpoint_nets(document: dict) -> dict:
    """The parity shape: today's projection has no board-objects net column."""

    return {
        **document,
        "testpoints": [
            {key: value for key, value in item.items() if key != "net"}
            for item in document.get("testpoints") or []
        ],
    }


def _has_board(case_id: str) -> bool:
    """A case's golden holds a board when its project member lists a board document."""

    project = _golden(case_id, "project.json")
    return any(
        document.get("kind") == "board" for document in project.get("documents", [])
    )


class ParityTests(unittest.TestCase):
    """The golden members map to what today's projections compute on the sources."""

    def test_mapping_reproduces_today_projections_on_every_board_fixture(self) -> None:
        fixtures = _fixtures_by_id()
        checked = 0
        for case_id in NON_UPGRADED:
            if not _has_board(case_id):
                continue
            with self.subTest(case=case_id):
                self.assertIn(case_id, fixtures)
                checked += 1
                case = fixtures[case_id]
                root = (REPO / case["sourceRoot"]).resolve()
                project = _golden(case_id, "project.json")
                board_document = next(
                    document
                    for document in project["documents"]
                    if document.get("kind") == "board"
                )
                board = root / board_document["path"]
                project_file = root / case["project"]

                model = projections.load_board_model(board)
                pcb, fallback_reason = model
                today_stackup = projections.project_stackup(board, model=model)
                today_population = projections.project_population(board, model=model)
                today_testpoints = projections.project_testpoints(board, model=model)
                today_designators = projections.board_designators(board, model=model)
                today_variants = projections.project_variants(
                    board,
                    project_file if project_file.is_file() else None,
                    pcb=None if fallback_reason else pcb,
                )

                members = _golden_members(case_id)
                derived_stackup = bundle_projections.stackup(members[STACKUP_MEMBER])
                derived_population = bundle_projections.population(
                    members[PLACEMENTS_MEMBER]
                )
                derived_testpoints = bundle_projections.testpoints(
                    members[PLACEMENTS_MEMBER],
                    board_objects=members[BOARD_OBJECTS_MEMBER],
                )
                derived_designators = bundle_projections.designators(
                    members[PLACEMENTS_MEMBER]
                )
                derived_variants = bundle_projections.variants(
                    members[OCCURRENCES_MEMBER]
                )

                # Values and stable key order both matter: these dicts feed
                # canonical JSON, so a reordered key is a moved digest.
                for derived, today in (
                    (derived_stackup, today_stackup),
                    (derived_population, today_population),
                    (derived_variants, today_variants),
                ):
                    self.assertEqual(list(derived), list(today), case_id)
                self.assertEqual(derived_stackup, today_stackup)
                self.assertEqual(derived_population, today_population)
                # The one accepted difference: the bundle names each probe
                # target's net from its pad; today's Monkey projection has no
                # net to read (chunk F removes that path).
                self.assertEqual(list(derived_testpoints), list(today_testpoints))
                self.assertEqual(
                    _without_testpoint_nets(derived_testpoints), today_testpoints
                )
                self.assertTrue(
                    all(
                        isinstance(item.get("net"), str) and item["net"]
                        for item in derived_testpoints["testpoints"]
                    ),
                    case_id,
                )
                self.assertEqual(derived_designators, today_designators)
                self.assertEqual(derived_variants, today_variants)
        self.assertGreater(checked, 0, "no board parity case was exercised")


class GoldenDerivationTests(unittest.TestCase):
    """Small, synthetic members pin the field-map rules the goldens do not reach."""

    def test_stackup_folds_addsublayer_entries_to_one_row_per_form(self) -> None:
        # stackup.md "Fold to forms": today's readers see one row per (layer …)
        # form; a form's own values are the sublayer-0 entry, and each later
        # entry is one addsublayer.  thicknessNm must be the *first* written
        # value, exactly as kicad_monkey's find_element takes the first match.
        member = {
            "schema": "prism.stackup.a0",
            "present": True,
            "boardThicknessNm": 1600000,
            "layers": [
                {"name": "F.Cu", "sublayer": 0, "kind": "copper", "type": "copper", "thicknessNm": 35000},
                {
                    "name": "dielectric 1",
                    "sublayer": 0,
                    "kind": "dielectric",
                    "type": "core",
                    "thicknessNm": 300000,
                    "material": "FR4",
                },
                {
                    "name": "dielectric 1",
                    "sublayer": 1,
                    "kind": "dielectric",
                    "type": "core",
                    "thicknessNm": 250000,
                    "material": "FR4-HiTg",
                    "color": "FR4 natural",
                },
                {"name": "B.Cu", "sublayer": 0, "kind": "copper", "type": "copper", "thicknessNm": 35000},
            ],
        }

        derived = bundle_projections.stackup(member)

        self.assertEqual(len(derived["layers"]), 3)
        dielectric = next(
            layer for layer in derived["layers"] if layer["name"] == "dielectric 1"
        )
        # Each field is the first value written across the group: the form's own
        # thickness and material, and the sub-layer colour that follows them.
        self.assertEqual(dielectric["material"], "FR4")
        self.assertEqual(dielectric["thickness"], 0.3)
        self.assertEqual(dielectric["color"], "FR4 natural")
        self.assertEqual(derived["copper_layers"], ["F.Cu", "B.Cu"])
        self.assertEqual(derived["total_thickness"], 0.37)

    def test_testpoint_rotation_zero_maps_to_null_placements_d1(self) -> None:
        # placements.md D1: a hand-written `(at x y 0)` gives today's RS the
        # float 0.0; the member spells "no rotation" as 0, which C3 maps to
        # null.  KiCad omits a zero angle, so no committed fixture shows it.
        member = {
            "schema": "prism.placements.a1",
            "footprints": [
                {
                    "uuid": "u",
                    "reference": "TP1",
                    "side": "front",
                    "positionNm": {"xNm": 0, "yNm": 2000000},
                    "rotationDeg": 0,
                    "dnp": False,
                    "excludeFromPosFiles": True,
                }
            ],
            "designators": ["TP1"],
        }

        derived = bundle_projections.testpoints(member)

        self.assertEqual(
            derived["testpoints"],
            [
                {
                    "ref": "TP1",
                    "net": "—",
                    "side": "top",
                    "x": None,
                    "y": 2.0,
                    "rotation": None,
                    "excluded_from_position_file": True,
                }
            ],
        )

    def test_a_testpoint_takes_the_net_of_its_first_pad(self) -> None:
        # board-objects.md: footprints and pads are sibling objects in document
        # order, and a pad names the net it is connected to.  A probe target is
        # the first pad, so a later pad's net is not the one the reader probes.
        placements = {
            "schema": "prism.placements.a1",
            "footprints": [
                {"uuid": "tp-1", "reference": "TP1", "side": "front"},
                {"uuid": "tp-2", "reference": "TP2", "side": "front"},
                {"uuid": "tp-3", "reference": "TP3", "side": "front"},
            ],
            "designators": ["TP1", "TP2", "TP3"],
        }
        board_objects = {
            "schema": "prism.board_objects.a0",
            "documents": [
                {
                    "path": "board.kicad_pcb",
                    "objects": [
                        {"kind": "footprint", "uuid": "tp-1", "refdes": "TP1"},
                        {
                            "kind": "pad",
                            "parentUuid": "tp-1",
                            "refdes": "TP1",
                            "number": "1",
                            "net": "VCC",
                        },
                        {
                            "kind": "pad",
                            "parentUuid": "tp-1",
                            "refdes": "TP1",
                            "number": "2",
                            "net": "GND",
                        },
                        {"kind": "footprint", "uuid": "tp-2", "refdes": "TP2"},
                        {
                            "kind": "pad",
                            "parentUuid": "tp-2",
                            "refdes": "TP2",
                            "number": "1",
                        },
                        {"kind": "footprint", "uuid": "tp-3", "refdes": "TP3"},
                    ],
                }
            ],
        }

        derived = bundle_projections.testpoints(
            placements, board_objects=board_objects
        )

        nets = {
            item["ref"]: item["net"] for item in derived["testpoints"]
        }
        self.assertEqual(nets["TP1"], "VCC")
        # A pad with no net is unconnected, not a blank cell.
        self.assertEqual(nets["TP2"], "—")
        # No pad at all is equally unconnected.
        self.assertEqual(nets["TP3"], "—")

    def test_variant_description_empty_is_absent_occurrences_divergence(self) -> None:
        # occurrences.md "Expected divergences": a `.kicad_pro` registry entry
        # with `"description": ""` reaches today's project_variants as "" and
        # the member as absent.  The bundle derivation reports None.
        member = {
            "schema": "prism.occurrences.a0",
            "variantDeclarations": [
                {"source": "project", "name": "Lite"},
            ],
            "footprints": [],
        }

        derived = bundle_projections.variants(member)

        project_declaration = derived["declarations"]["project"][0]
        self.assertIsNone(project_declaration["description"])
        # The value today's `_project_variant_declarations` would carry for the
        # same empty registry description.
        self.assertEqual(_variant_declaration("Lite", "", None)["description"], "")


class DivergenceTests(unittest.TestCase):
    """Every difference the field maps accept is asserted, never hidden."""

    def test_stackup_source_is_never_the_km_fallback_tag_stackup_d5(self) -> None:
        # stackup.md D5: today's project_stackup tags a targeted-fallback parse
        # "kicad_monkey.fallback" with a fallback_reason.  The member has no
        # such state, so the derivation always reports the typed source.
        for case_id in NON_UPGRADED:
            if not _has_board(case_id):
                continue
            with self.subTest(case=case_id):
                derived = bundle_projections.stackup(_golden(case_id, "stackup.json"))
                self.assertIn(
                    derived["source"], {"board.setup.stackup", "board.layers"}
                )
                self.assertEqual(derived["source_detail"], derived["source"])
                self.assertIsNone(derived["fallback_reason"])

        # The legacy shape can carry the tag: a model whose typed parse was
        # rejected reaches project_stackup as (targeted_model, reason).
        from types import SimpleNamespace

        targeted = SimpleNamespace(
            layers=[
                SimpleNamespace(
                    ordinal=0, canonical_name="F.Cu", layer_type="signal", user_name=None
                )
            ],
            stackup=None,
            vias=[],
            thickness=1.6,
        )
        legacy = projections.project_stackup(
            Path("unused.kicad_pcb"), model=(targeted, "ValueError: boom")
        )
        self.assertEqual(legacy["source"], "kicad_monkey.fallback")
        self.assertEqual(legacy["fallback_reason"], "ValueError: boom")


class _Opened:
    """The parts of ``reader.OpenedRevision`` that ``bundle_read`` touches."""

    def __init__(self, states: dict[str, str], members: dict[str, dict] | None = None) -> None:
        self.absent = False
        self._states = states
        self._members = members or {}

    def readiness(self, paths):
        return {
            path: Readiness(path, self._states.get(path, "pending"), "parse", "why")
            for path in paths
        }

    def read_json(self, path):
        return self._members[path]


def _read(source: str, opened: _Opened, commit: str | None = SHA):
    with mock.patch.object(settings, "PRISM_DESIGN_SOURCE_RELEASE_STUDIO", source), \
            mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
        result = bundle_projections.board_projections_from_bundle("prj-1", commit)
    return result, open_revision


class BundleReadTests(unittest.TestCase):
    """``board_projections_from_bundle``'s switch and fallback policy."""

    def test_legacy_never_opens_the_bundle(self) -> None:
        opened = _Opened({m: "ready" for m in bundle_projections.MEMBERS})
        result, open_revision = _read("legacy", opened)
        self.assertIsNone(result)
        open_revision.assert_not_called()

    def test_a_working_tree_never_opens_the_bundle(self) -> None:
        for commit in (None, ""):
            with self.subTest(commit=commit):
                result, open_revision = _read(
                    "bundle", _Opened({m: "ready" for m in bundle_projections.MEMBERS}), commit=commit
                )
                self.assertIsNone(result)
                open_revision.assert_not_called()

    def test_an_empty_project_id_never_opens_the_bundle(self) -> None:
        opened = _Opened({m: "ready" for m in bundle_projections.MEMBERS})
        with mock.patch.object(
            settings, "PRISM_DESIGN_SOURCE_RELEASE_STUDIO", "bundle"
        ), mock.patch.object(
            consumer.reader, "open_revision", return_value=opened
        ) as open_revision:
            result = bundle_projections.board_projections_from_bundle("", SHA)
        self.assertIsNone(result)
        open_revision.assert_not_called()

    def test_a_member_that_is_not_ready_falls_back(self) -> None:
        for state in ("pending", "unavailable", "failed", "skipped", "not-applicable"):
            with self.subTest(state=state):
                states = {m: "ready" for m in bundle_projections.MEMBERS}
                states[PLACEMENTS_MEMBER] = state
                result, open_revision = _read("bundle", _Opened(states, _golden_members("dv-oracle")))
                open_revision.assert_called_once()
                self.assertIsNone(result)

    def test_an_unreadable_member_falls_back(self) -> None:
        opened = _Opened({m: "ready" for m in bundle_projections.MEMBERS})
        opened.read_json = mock.Mock(side_effect=ValueError("member-digest-mismatch"))
        result, open_revision = _read("bundle", opened)
        open_revision.assert_called_once()
        self.assertIsNone(result)

    def test_a_ready_bundle_is_used(self) -> None:
        members = _golden_members("dv-oracle")
        result, open_revision = _read(
            "bundle", _Opened({m: "ready" for m in bundle_projections.MEMBERS}, members)
        )

        open_revision.assert_called_once_with("prj-1", SHA, queue=True, requested_by="")
        self.assertEqual(
            list(result),
            ["stackup", "variants", "testpoints", "population", "designators"],
        )
        self.assertEqual(result, bundle_projections.build(members))
        self.assertEqual(
            result["variants"]["ordering"],
            ["Lite", "Pro", "BoardOnly", "PcbOnly", "Unused", "Édition-µ"],
        )


class DocumentPipelineSwitchTests(unittest.TestCase):
    """``_gather_document_inputs`` prefers a ready bundle and never parses then."""

    def _gather(self, tmp: Path, *, bundle_result, legacy) -> object:
        import shutil

        from tests.release_studio_support import fixture_root

        shutil.copy(
            fixture_root("synthetic") / "synthetic.kicad_pcb",
            tmp / "synthetic.kicad_pcb",
        )
        with mock.patch.object(
            bundle_projections, "board_projections_from_bundle", return_value=bundle_result
        ), mock.patch.object(
            projections, "load_board_model", side_effect=legacy["model"]
        ), mock.patch.object(
            projections, "project_stackup", side_effect=legacy["stackup"]
        ), mock.patch.object(
            projections, "project_variants", side_effect=legacy["variants"]
        ), mock.patch.object(
            projections, "project_testpoints", side_effect=legacy["testpoints"]
        ), mock.patch.object(
            projections, "project_population", side_effect=legacy["population"]
        ), mock.patch.object(
            projections, "board_designators", side_effect=legacy["designators"]
        ):
            inputs, _warnings, _projections = document_pipeline._gather_document_inputs(
                [],
                closure_root=tmp,
                config={"board": "synthetic.kicad_pcb"},
                candidate={"project_id": "prj-1", "commit_sha": SHA},
                output_root=tmp / "outputs",
                cli=None,
                cruncher=None,
                staging=tmp / "staging",
                repo_root=None,
                repo_url="",
            )
        return inputs

    def test_a_ready_bundle_is_used_without_loading_the_legacy_model(self) -> None:
        import tempfile

        bundle_result = {
            "stackup": {"source": "board.setup.stackup"},
            "variants": {"ordering": ["bundle"]},
            "testpoints": {"testpoints": []},
            "population": {"sides": {}},
            "designators": ("B1",),
        }
        legacy = {
            name: mock.Mock()
            for name in (
                "model",
                "stackup",
                "variants",
                "testpoints",
                "population",
                "designators",
            )
        }
        with tempfile.TemporaryDirectory() as temporary:
            inputs = self._gather(
                Path(temporary), bundle_result=bundle_result, legacy=legacy
            )

        legacy["model"].assert_not_called()
        self.assertEqual(inputs.stackup, bundle_result["stackup"])
        self.assertEqual(inputs.variants, bundle_result["variants"])
        self.assertEqual(inputs.testpoints, bundle_result["testpoints"])
        self.assertEqual(inputs.population, bundle_result["population"])
        self.assertEqual(inputs.designators, bundle_result["designators"])

    def test_a_pending_bundle_uses_the_legacy_projections(self) -> None:
        import tempfile

        legacy = {
            "model": mock.Mock(return_value=("MODEL", None)),
            "stackup": mock.Mock(return_value={"source": "board.layers"}),
            "variants": mock.Mock(return_value={"legacy": True}),
            "testpoints": mock.Mock(return_value={"legacy": True}),
            "population": mock.Mock(return_value={"legacy": True}),
            "designators": mock.Mock(return_value=("R1",)),
        }
        with tempfile.TemporaryDirectory() as temporary:
            inputs = self._gather(Path(temporary), bundle_result=None, legacy=legacy)

        legacy["model"].assert_called_once()
        self.assertEqual(inputs.stackup, {"source": "board.layers"})
        self.assertEqual(inputs.variants, {"legacy": True})
        self.assertEqual(inputs.designators, ("R1",))


if __name__ == "__main__":
    unittest.main()
