"""WP-C3a: Release Studio's board projections from the design bundle.

The five read-only board projections are rebuilt from the bundle members
(``projections/stackup.json``, ``placements.json``, ``occurrences.json``,
``project.json``) instead of Python ``kicad_monkey``.  The field maps'
"Release Studio" rules (``stackup.md``, ``placements.md``,
``occurrences.md``) are pinned here on synthetic members and the committed
parity goldens.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from app.release_studio import bundle_projections
from app.release_studio.projections import _variant_declaration

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
STACKUP_MEMBER = "projections/stackup.json"
PLACEMENTS_MEMBER = "projections/placements.json"
OCCURRENCES_MEMBER = "projections/occurrences.json"
BOARD_OBJECTS_MEMBER = "projections/board-objects.json"
PROJECT_MEMBER = "projections/project.json"
SHA = "c" * 40

#: Parity cases whose sources were not upgraded before capture, so the golden's
#: stackup/placements/occurrences describe the same committed bytes.
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


def _has_board(case_id: str) -> bool:
    """A case's golden holds a board when its project member lists a board document."""

    project = _golden(case_id, "project.json")
    return any(
        document.get("kind") == "board" for document in project.get("documents", [])
    )


class FromDesignTests(unittest.TestCase):
    """The one already-checked-bundle seam reads every projection member."""

    def test_board_projections_from_design_equals_build(self) -> None:
        class _Opened:
            def __init__(self, members: dict[str, dict]) -> None:
                self._members = members

            def read_json(self, path: str) -> dict:
                return self._members[path]

        class _Design:
            opened = _Opened(_golden_members("dv-oracle"))

        members = _golden_members("dv-oracle")
        result = bundle_projections.board_projections_from_design(_Design())
        self.assertEqual(result, bundle_projections.build(members))
        self.assertEqual(
            list(result),
            ["stackup", "variants", "testpoints", "population", "designators"],
        )
        self.assertEqual(
            result["variants"]["ordering"],
            ["Lite", "Pro", "BoardOnly", "PcbOnly", "Unused", "Édition-µ"],
        )


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
                    # rs-3: x = 0 is a position; legacy printed it as unknown.
                    "x": 0.0,
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

        nets = {item["ref"]: item["net"] for item in derived["testpoints"]}
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
        # stackup.md D5: today's project_stackup tagged a targeted-fallback
        # parse "kicad_monkey.fallback" with a fallback_reason.  The member has
        # no such state, so the derivation always reports the typed source.
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


if __name__ == "__main__":
    unittest.main()
