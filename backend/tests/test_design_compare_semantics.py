"""The semantic diff: nets matched on membership, buses and sheets on identity."""

import copy
import unittest
from unittest import mock

from app.services import design_compare_semantics
from tests.design_compare_fixtures import component, design, net


class SemanticFixtures:
    """Adapts the shared builders onto the `self._design(...)` call style the
    tests were written in, so moving them between files changes only imports."""

    _design = staticmethod(design)
    _component = staticmethod(component)
    _net = staticmethod(net)


class DesignCompareSemanticsTests(SemanticFixtures, unittest.TestCase):
    def test_net_targets_are_distinct_per_sheet_instance(self) -> None:
        targets = design_compare_semantics._net_bucket_targets(
            {
                "schematicRefs": [
                    {
                        "sheetInstancePath": "/channel-a/",
                        "page": "shared.kicad_sch",
                        "labelUuids": ["label-shared"],
                    },
                    {
                        "sheetInstancePath": "/channel-b/",
                        "page": "shared.kicad_sch",
                        "labelUuids": ["label-shared"],
                    },
                ]
            },
            side="comparison",
            status="modified",
        )
        self.assertEqual(len(targets), 2)
        self.assertEqual(
            [target["sheetPath"] for target in targets],
            ["/channel-a/", "/channel-b/"],
        )
        self.assertEqual(
            len(design_compare_semantics._dedupe_visual_targets(targets)),
            2,
        )
    def test_bus_membership_changes_are_semantic_net_changes(self) -> None:
        base_net = self._net("DATA0", "net-data0", "wire-data0")
        compare_net = copy.deepcopy(base_net)
        base_net["aliases"] = ["DATA[0..7]"]
        compare_net["aliases"] = ["DATA[0..15]"]

        result = design_compare_semantics._connectivity_changes(
            self._design(nets=[base_net]),
            self._design(nets=[compare_net]),
        )

        self.assertEqual(len(result), 1)
        change = result[0]
        self.assertIn("bus-membership-changed", change["reasons"])
        self.assertEqual(
            change["fields"]["busMembership"],
            {"old": "DATA[0..7]", "new": "DATA[0..15]"},
        )
    def test_bus_and_sheet_instances_are_first_class_semantic_changes(self) -> None:
        result = design_compare_semantics._semantic_structure_changes(
            {"buses": [], "sheetInstances": []},
            {
                "buses": [{
                    "busUid": "bus:1",
                    "kind": "bus",
                    "sourceUuid": "bus-native",
                    "sheetInstancePath": "/root/",
                    "page": "root.kicad_sch",
                    "points": [[0, 0], [10, 0]],
                }],
                "sheetInstances": [{
                    "sheetInstanceUid": "sheet-instance:1",
                    "sheetInstancePath": "/root/power/",
                    "parentSheetInstancePath": "/root/",
                    "sheetPath": "/Power/",
                    "page": "power.kicad_sch",
                    "parentPage": "root.kicad_sch",
                    "sheetSymbolUuid": "sheet-native",
                    "sheetName": "Power",
                }],
            },
        )

        self.assertEqual(
            [(change["category"], change["kind"]) for change in result],
            [("nets", "added"), ("sheets", "added")],
        )
        self.assertEqual(
            result[0]["details"]["visualTargets"][0]["sourceId"],
            "bus-native",
        )
        self.assertEqual(
            result[1]["details"]["visualTargets"][0],
            {
                "side": "comparison",
                "status": "added",
                "sourceId": "sheet-native",
                "page": "root.kicad_sch",
                "sheetPath": "/root/",
                "role": "sheet",
                "kind": "sheet",
            },
        )
    def test_net_connectivity_and_label_count_deltas_are_exact(self) -> None:
        base = self._design(
            nets=[self._net("RESET", "net:reset", "wire-reset", labels=1)],
            terminals=[
                {"reference": "U1", "pin": "4", "netUid": "net:reset"},
                {"reference": "U2", "pin": "3", "netUid": "net:reset"},
            ],
        )
        compare = self._design(
            nets=[self._net("RESET", "net:reset", "wire-reset", labels=2)],
            terminals=[
                {"reference": "U2", "pin": "3", "netUid": "net:reset"},
                {"reference": "U3", "pin": "1", "netUid": "net:reset"},
            ],
        )
        change = design_compare_semantics._connectivity_changes(base, compare)[0]
        self.assertEqual(
            change["reasons"],
            ["connectivity-changed", "label-count-changed"],
        )
        self.assertEqual(
            change["details"]["connectivity"],
            {"addedTerminals": ["U3.1"], "removedTerminals": ["U1.4"]},
        )
        self.assertEqual(change["details"]["labelInstances"], {"old": 1, "new": 2})
        self.assertEqual(
            change["details"]["visualTargets"],
            [{
                "side": "comparison",
                "status": "added",
                "sourceId": "label-1",
                "page": None,
                "role": "label",
            }],
        )
    def test_label_count_down_targets_every_removed_native_label(self) -> None:
        change = design_compare_semantics._connectivity_changes(
            self._design(nets=[self._net("PF_01", "net:pf01", "wire", labels=2)]),
            self._design(nets=[self._net("PF_01", "net:pf01", "wire", labels=0)]),
        )[0]
        self.assertEqual(change["category"], "nets")
        self.assertEqual(
            [
                (target["sourceId"], target["side"], target["status"])
                for target in change["details"]["visualTargets"]
            ],
            [
                ("label-0", "reference", "removed"),
                ("label-1", "reference", "removed"),
            ],
        )
    def test_unconnected_addition_targets_pin_with_component_fallback(self) -> None:
        component = self._component("U30", "symbol-u30", page="io.kicad_sch")
        added_net = {
            "netUid": "net:unconnected",
            "name": "unconnected-(U30-SPK_R-Pad16)",
            "schematicRefs": [{
                "wireUuids": [],
                "labelUuids": [],
                "junctionUuids": [],
                "pinUuids": ["pin-u30-16"],
                "labelInstanceCount": 0,
            }],
        }
        compare = self._design(
            components=[component],
            nets=[added_net],
            terminals=[{
                "reference": "U30",
                "pin": "16",
                "netUid": "net:unconnected",
                "schematicPinUuid": "pin-u30-16",
            }],
        )
        change = next(
            item
            for item in design_compare_semantics._connectivity_changes(
                self._design(components=[component]),
                compare,
            )
            if item["category"] == "nets"
        )
        target = change["details"]["visualTargets"][0]
        self.assertEqual(target["sourceId"], "pin-u30-16")
        self.assertEqual(target["parentSourceId"], "symbol-u30")
        self.assertEqual(target["page"], "io.kicad_sch")
        self.assertEqual(target["role"], "terminal")
    def test_added_net_reports_logical_instance_and_terminal_count(self) -> None:
        added_net = self._net("LLCE_CAN5_TX", "net:can5", "wire-can5")
        compare = self._design(
            nets=[added_net],
            terminals=[{
                "reference": "U30",
                "pin": "16",
                "netUid": "net:can5",
                "schematicPinUuid": "pin-u30-16",
            }],
        )
        change = design_compare_semantics._connectivity_changes(
            self._design(),
            compare,
        )[0]

        self.assertEqual(change["fields"]["instances"], {"old": 0, "new": 1})
        self.assertEqual(change["fields"]["connections"], {"old": 0, "new": 1})
        self.assertEqual(
            change["details"]["netInstances"],
            {"old": 0, "new": 1},
        )
    def test_net_rename_matches_by_connectivity_fingerprint(self) -> None:
        base = {
            "components": [],
            "nets": [
                {
                    "netUid": "net:vcc",
                    "name": "VCC",
                    "schematicRefs": [{"wireUuids": ["wire-1"], "labelUuids": [], "pinUuids": []}],
                }
            ],
            "terminals": [
                {"reference": "U1", "pin": "1", "netUid": "net:vcc", "schematicPinUuid": "pin-1"},
                {"reference": "C1", "pin": "1", "netUid": "net:vcc"},
            ],
        }
        compare = {
            "components": [],
            "nets": [
                {
                    "netUid": "net:3v3",
                    "name": "3V3",
                    "schematicRefs": [{"wireUuids": ["wire-1"], "labelUuids": [], "pinUuids": []}],
                }
            ],
            "terminals": [
                {"reference": "U1", "pin": "1", "netUid": "net:3v3", "schematicPinUuid": "pin-1"},
                {"reference": "C1", "pin": "1", "netUid": "net:3v3"},
            ],
        }
        result = design_compare_semantics._connectivity_changes(base, compare)
        self.assertEqual(len(result), 1)
        change = result[0]
        self.assertEqual(change["kind"], "changed")
        self.assertEqual(change["fields"]["name"], {"old": "VCC", "new": "3V3"})
        self.assertEqual(change["source_id_base"], "wire-1")
        self.assertEqual(change["source_id_compare"], "wire-1")
        self.assertNotIn("connections", change["fields"])


class NetPairingEvidenceTests(SemanticFixtures, unittest.TestCase):
    def test_shared_connectivity_never_pairs_one_net_twice(self) -> None:
        """Two nets with identical terminals: the name match wins, the other
        base net takes the remaining head net rather than the same one."""
        base = self._design(
            nets=[self._net("X", "net:x", "wire-x"), self._net("Y", "net:y", "wire-y")],
            terminals=[
                {"reference": "U1", "pin": "1", "netUid": "net:x"},
                {"reference": "U1", "pin": "1", "netUid": "net:y"},
            ],
        )
        compare = self._design(
            nets=[self._net("Y", "net:y2", "wire-y"), self._net("Z", "net:z", "wire-z")],
            terminals=[
                {"reference": "U1", "pin": "1", "netUid": "net:y2"},
                {"reference": "U1", "pin": "1", "netUid": "net:z"},
            ],
        )
        result = design_compare_semantics._connectivity_changes(base, compare)
        self.assertEqual(
            [(change["kind"], change["label"], change["fields"].get("name")) for change in result],
            [("changed", "Z", {"old": "X", "new": "Z"})],
        )
