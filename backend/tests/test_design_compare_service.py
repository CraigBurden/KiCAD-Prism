import copy
import os
import tempfile
import threading
import unittest
from pathlib import Path
import subprocess
from unittest import mock

from app.services import bom_diff_service, design_compare_service
from app.services.design_compare_benchmark import DesignCompareBenchmark


class DesignCompareServiceTests(unittest.TestCase):
    @staticmethod
    def _design(*, components=None, nets=None, terminals=None):
        return {
            "components": components or [],
            "nets": nets or [],
            "terminals": terminals or [],
        }

    @staticmethod
    def _component(reference, source_id, *, value="A", page="root.kicad_sch"):
        return {
            "componentUid": f"cmp:{source_id}",
            "reference": reference,
            "fields": {"Value": value},
            "schematicRefs": [{"symbolUuid": source_id, "page": page}],
        }

    @staticmethod
    def _net(name, uid, source_id, *, labels=0):
        return {
            "netUid": uid,
            "name": name,
            "schematicRefs": [{
                "wireUuids": [source_id],
                "labelUuids": [f"label-{index}" for index in range(labels)],
                "labelInstanceCount": labels,
                "pinUuids": [],
            }],
        }

    def test_generated_kicad_files_are_folded_out_of_semantic_sources(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            primary = root / "board.kicad_sch"
            backup = root / "board-backups" / "board-backup-2026-01-01.kicad_sch"
            autosave = root / "autosave" / "board.kicad_pcb"
            backup.parent.mkdir()
            autosave.parent.mkdir()
            primary.write_text("(kicad_sch)", encoding="utf-8")
            backup.write_text("(kicad_sch)", encoding="utf-8")
            autosave.write_text("(kicad_pcb)", encoding="utf-8")
            sources = design_compare_service._list_kicad_sources(root)
        self.assertEqual([source["path"] for source in sources], ["board.kicad_sch"])

    def test_snapshot_archives_design_inputs_without_manufacturing_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            destination = Path(temporary) / "snapshot"
            root.mkdir()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(
                ["git", "-C", str(root), "config", "user.email", "test@example.invalid"],
                check=True,
            )
            (root / "board.kicad_pro").write_text("{}", encoding="utf-8")
            (root / "board.kicad_sch").write_text("(kicad_sch)", encoding="utf-8")
            manufacturing = root / "Manufacturing-Outputs"
            manufacturing.mkdir()
            (manufacturing / "board.step").write_bytes(b"large-model")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "fixture"], check=True)

            design_compare_service._snapshot_commit(root, "HEAD", destination, None)

            self.assertTrue((destination / "board.kicad_pro").exists())
            self.assertTrue((destination / "board.kicad_sch").exists())
            self.assertFalse((destination / "Manufacturing-Outputs").exists())

    def test_geometry_extract_preserves_native_ids_and_routing_shapes(self) -> None:
        segment_id = "11111111-1111-1111-1111-111111111111"
        arc_id = "22222222-2222-2222-2222-222222222222"
        via_id = "33333333-3333-3333-3333-333333333333"
        footprint_id = "44444444-4444-4444-4444-444444444444"
        symbol_id = "55555555-5555-5555-5555-555555555555"
        wire_id = "66666666-6666-6666-6666-666666666666"
        label_id = "77777777-7777-7777-7777-777777777777"
        global_label_id = "88888888-8888-8888-8888-888888888888"
        junction_id = "99999999-9999-9999-9999-999999999999"
        pin_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        semantic_index = {
            "components": [
                {
                    "componentUid": "cmp:u1",
                    "reference": "U1",
                }
            ],
            "nets": [{"netUid": "net:vcc", "name": "VCC"}],
            "indexes": {
                "componentBySchematicUuid": {symbol_id: 0},
                "componentByPcbFootprintUuid": {footprint_id: 0},
                "netBySchematicUuid": {wire_id: 0},
                "netByPcbUuid": {segment_id: 0, arc_id: 0, via_id: 0},
            },
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "board.kicad_sch").write_text(
                f"""
                (kicad_sch
                  (symbol (lib_id "Device:R") (at 10 20) (uuid "{symbol_id}")
                    (pin "1" (uuid "{pin_id}")))
                  (wire (pts (xy 1 2) (xy 3 4)) (uuid "{wire_id}"))
                  (label "LOCAL" (at 5 6 0) (uuid "{label_id}"))
                  (global_label "GLOBAL" (at 7 8 0) (uuid "{global_label_id}"))
                  (junction (at 9 10) (diameter 0) (uuid "{junction_id}"))
                )
                """,
                encoding="utf-8",
            )
            (root / "board.kicad_pcb").write_text(
                f"""
                (kicad_pcb
                  (net 1 "VCC")
                  (segment (start 0 0) (end 3 4) (width 0.25)
                    (layer "F.Cu") (net 1) (uuid "{segment_id}"))
                  (arc (start 1 0) (mid 0.7071 0.7071) (end 0 1)
                    (width 0.25) (layer "F.Cu") (net 1) (uuid "{arc_id}"))
                  (via (at 2 3) (size 0.8) (drill 0.4)
                    (layers "F.Cu" "B.Cu") (net 1) (uuid "{via_id}"))
                  (footprint "Package:QFN" (layer "F.Cu")
                    (uuid "{footprint_id}") (at 20 30 90))
                )
                """,
                encoding="utf-8",
            )
            geometry = design_compare_service._extract_geometry(root, semantic_index)

        self.assertEqual(geometry["pcb"][segment_id]["source_id"], segment_id)
        self.assertEqual(geometry["pcb"][segment_id]["semantic_id"], "net:vcc")
        self.assertEqual(geometry["pcb"][arc_id]["kind"], "arc")
        self.assertEqual(geometry["pcb"][via_id]["layers"], ["F.Cu", "B.Cu"])
        self.assertEqual(geometry["pcb"][footprint_id]["reference"], "U1")
        self.assertEqual(geometry["pcb"][footprint_id]["rotation"], 90)
        self.assertEqual(geometry["schematic"][wire_id]["net"], "VCC")
        self.assertEqual(geometry["schematic"][label_id]["kind"], "label")
        self.assertEqual(geometry["schematic"][global_label_id]["page"], "board.kicad_sch")
        self.assertEqual(geometry["schematic"][junction_id]["kind"], "junction")
        self.assertEqual(geometry["schematic"][pin_id]["kind"], "pin")
        self.assertEqual(
            geometry["schematic"][pin_id]["parent_source_id"],
            symbol_id,
        )
        self.assertEqual(geometry["schematic"][pin_id]["page"], "board.kicad_sch")

    def test_pcb_footprint_rotation_is_a_physical_modification(self) -> None:
        source_id = "44444444-4444-4444-4444-444444444444"
        base = {
            "pcb": {
                source_id: {
                    "kind": "footprint",
                    "source_id": source_id,
                    "semantic_id": "cmp:u1",
                    "reference": "U1",
                    "x": 20,
                    "y": 30,
                    "rotation": 0,
                },
            },
        }
        compare = {
            "pcb": {
                source_id: {
                    **base["pcb"][source_id],
                    "rotation": 90,
                },
            },
        }

        changes = design_compare_service._diff_geometry(base, compare, "pcb")

        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["kind"], "changed")
        self.assertEqual(changes[0]["category"], "components")

    def test_geometry_extract_preserves_schematic_repository_path(self) -> None:
        symbol_id = "55555555-5555-5555-5555-555555555555"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subsheets = root / "Subsheets"
            subsheets.mkdir()
            (subsheets / "Power.kicad_sch").write_text(
                f"""
                (kicad_sch
                  (symbol (lib_id "Device:R") (at 10 20) (uuid "{symbol_id}"))
                )
                """,
                encoding="utf-8",
            )
            geometry = design_compare_service._extract_geometry(
                root,
                {"components": [], "nets": [], "indexes": {}},
            )

        self.assertEqual(
            geometry["schematic"][symbol_id]["page"],
            "Subsheets/Power.kicad_sch",
        )

    def test_semantic_diff_has_explicit_base_compare_identity(self) -> None:
        base = {
            "components": [
                {
                    "componentUid": "cmp:u1",
                    "reference": "U1",
                    "fields": {"Value": "A"},
                    "schematicRefs": [{"symbolUuid": "old-u1", "page": "root.kicad_sch"}],
                }
            ],
            "nets": [],
            "terminals": [],
        }
        compare = {
            "components": [
                {
                    "componentUid": "cmp:u1",
                    "reference": "U1",
                    "fields": {"Value": "B"},
                    "schematicRefs": [{"symbolUuid": "new-u1", "page": "root.kicad_sch"}],
                }
            ],
            "nets": [],
            "terminals": [],
        }
        result = design_compare_service._diff_designs(base, compare)
        change = result["changes"][0]
        self.assertEqual(change["source_id_base"], "old-u1")
        self.assertEqual(change["source_id_compare"], "new-u1")
        self.assertEqual(change["base_item"]["semantic_id"], "cmp:u1")
        self.assertEqual(change["fields"]["Value"], {"old": "A", "new": "B"})

    def test_native_key_matching_builds_keys_once_per_item(self) -> None:
        base = [{"key": f"key-{index}"} for index in range(500)]
        compare = list(reversed(base))
        calls = 0

        def keys_of(item):
            nonlocal calls
            calls += 1
            return {item["key"]}

        pairs = design_compare_service._match_by_keys(base, compare, keys_of)

        self.assertEqual(len(pairs), len(base))
        self.assertEqual(calls, len(base) + len(compare))
        self.assertTrue(all(old is not None and new is not None for old, new in pairs))

    def test_same_page_symbol_movement_and_wire_reroute_are_suppressed(self) -> None:
        component = self._component("U1", "u1")
        semantic = design_compare_service._diff_designs(
            self._design(
                components=[component],
                nets=[self._net("VCC", "net:vcc", "wire-old")],
                terminals=[{"reference": "U1", "pin": "1", "netUid": "net:vcc"}],
            ),
            self._design(
                components=[component],
                nets=[self._net("VCC", "net:vcc", "wire-new")],
                terminals=[{"reference": "U1", "pin": "1", "netUid": "net:vcc"}],
            ),
        )
        geometry = [
            {
                "id": "moved-u1",
                "kind": "changed",
                "category": "components",
                "classification": "primary",
                "semantic_id": "cmp:u1",
            },
            {
                "id": "rerouted-vcc",
                "kind": "changed",
                "category": "nets",
                "classification": "primary",
                "semantic_id": "net:vcc",
            },
        ]
        self.assertEqual(semantic["changes"], [])
        self.assertEqual(
            design_compare_service._merge_semantic_geometry_changes([], geometry),
            [],
        )

    def test_component_field_change_has_structured_reason(self) -> None:
        result = design_compare_service._diff_designs(
            self._design(components=[self._component("U1", "u1", value="LM358")]),
            self._design(components=[self._component("U1", "u1", value="TL072")]),
        )
        self.assertEqual(len(result["changes"]), 1)
        change = result["changes"][0]
        self.assertEqual(change["reasons"], ["symbol-fields-changed"])
        self.assertEqual(
            change["details"]["fieldDeltas"]["Value"],
            {"old": "LM358", "new": "TL072"},
        )

    def test_same_refdes_with_new_uuid_is_instance_replacement(self) -> None:
        result = design_compare_service._diff_designs(
            self._design(components=[self._component("U5", "old-u5")]),
            self._design(components=[self._component("U5", "new-u5")]),
        )
        self.assertEqual(len(result["changes"]), 1)
        change = result["changes"][0]
        self.assertEqual(change["kind"], "changed")
        self.assertEqual(change["reasons"], ["instance-replaced"])
        self.assertEqual(change["source_id_base"], "old-u5")
        self.assertEqual(change["source_id_compare"], "new-u5")

    def test_duplicate_refdes_count_changes_are_one_modified_change(self) -> None:
        retained = self._component("U7", "u7-retained")
        extra = self._component("U7", "u7-extra")
        added = design_compare_service._diff_designs(
            self._design(components=[retained]),
            self._design(components=[retained, extra]),
        )["changes"]
        self.assertEqual(len(added), 1)
        self.assertEqual(added[0]["details"]["instanceCount"], {"old": 1, "new": 2})
        self.assertEqual(added[0]["source_side"], "comparison")
        self.assertEqual(
            added[0]["affected_source_ids_compare"],
            ["u7-retained", "u7-extra"],
        )

        removed = design_compare_service._diff_designs(
            self._design(components=[retained, extra]),
            self._design(components=[retained]),
        )["changes"]
        self.assertEqual(len(removed), 1)
        self.assertEqual(removed[0]["details"]["instanceCount"], {"old": 2, "new": 1})
        self.assertEqual(removed[0]["source_side"], "reference")
        self.assertEqual(removed[0]["source_id_base"], "u7-extra")

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
        change = design_compare_service._diff_designs(base, compare)["changes"][0]
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
        change = design_compare_service._diff_designs(
            self._design(nets=[self._net("PF_01", "net:pf01", "wire", labels=2)]),
            self._design(nets=[self._net("PF_01", "net:pf01", "wire", labels=0)]),
        )["changes"][0]
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

    def test_net_semantics_cannot_inherit_component_category(self) -> None:
        semantic = [{
            "id": "semantic-net",
            "kind": "changed",
            "domain": "schematic",
            "category": "nets",
            "classification": "primary",
            "label": "USB_D_P",
            "net": "USB_D_P",
            "semantic_id": "shared-id",
            "reasons": ["connectivity-changed"],
            "details": {},
        }]
        geometry = [{
            "id": "native-symbol",
            "kind": "added",
            "domain": "schematic",
            "category": "components",
            "classification": "primary",
            "label": "J1",
            "semantic_id": "shared-id",
            "geometry": {"kind": "symbol", "bounds": [0, 0, 1, 1]},
        }]
        merged = design_compare_service._merge_semantic_geometry_changes(
            semantic,
            geometry,
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["category"], "nets")
        self.assertEqual(
            design_compare_service._group_changes(merged)[0]["category"],
            "nets",
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
            for item in design_compare_service._diff_designs(
                self._design(components=[component]),
                compare,
            )["changes"]
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
        change = design_compare_service._diff_designs(
            self._design(),
            compare,
        )["changes"][0]

        self.assertEqual(change["fields"]["instances"], {"old": 0, "new": 1})
        self.assertEqual(change["fields"]["connections"], {"old": 0, "new": 1})
        self.assertEqual(
            change["details"]["netInstances"],
            {"old": 0, "new": 1},
        )

    def test_label_uuid_churn_is_matched_by_nearest_geometry(self) -> None:
        change = {
            "reasons": ["label-count-changed"],
            "details": {
                "visualTargets": [
                    {
                        "side": "reference",
                        "status": "removed",
                        "sourceId": "old-label",
                        "role": "label",
                    },
                    {
                        "side": "comparison",
                        "status": "added",
                        "sourceId": "replacement-label",
                        "role": "label",
                    },
                    {
                        "side": "comparison",
                        "status": "added",
                        "sourceId": "new-extra-label",
                        "role": "label",
                    },
                ],
            },
        }
        design_compare_service._hydrate_visual_target_pages_and_match_labels(
            [change],
            {
                "old-label": {
                    "page": "root.kicad_sch",
                    "bounds": [10, 10, 2, 1],
                },
            },
            {
                "replacement-label": {
                    "page": "root.kicad_sch",
                    "bounds": [10.1, 10, 2, 1],
                },
                "new-extra-label": {
                    "page": "root.kicad_sch",
                    "bounds": [40, 40, 2, 1],
                },
            },
        )
        self.assertEqual(
            change["details"]["visualTargets"],
            [{
                "side": "comparison",
                "status": "added",
                "sourceId": "new-extra-label",
                "role": "label",
                "page": "root.kicad_sch",
            }],
        )

    def test_human_hierarchy_is_replaced_by_native_document_path(self) -> None:
        change = {
            "reasons": ["connectivity-changed"],
            "details": {
                "visualTargets": [{
                    "side": "comparison",
                    "status": "modified",
                    "sourceId": "pin-a1",
                    "page": "/S32G399/Boot & Low Speed Interfaces/",
                    "role": "terminal",
                }],
            },
        }
        design_compare_service._hydrate_visual_target_pages_and_match_labels(
            [change],
            {},
            {
                "pin-a1": {
                    "page": "Subsheets/S32G3_Boot_LS_Interfaces.kicad_sch",
                    "bounds": [10, 20, 1, 1],
                },
            },
        )
        target = change["details"]["visualTargets"][0]
        self.assertEqual(
            target["page"],
            "Subsheets/S32G3_Boot_LS_Interfaces.kicad_sch",
        )
        self.assertEqual(
            target["sheetPath"],
            "/S32G399/Boot & Low Speed Interfaces/",
        )

    def test_cross_page_symbol_move_is_semantic_change(self) -> None:
        change = design_compare_service._diff_designs(
            self._design(components=[self._component("U1", "u1", page="A.kicad_sch")]),
            self._design(components=[self._component("U1", "u1", page="B.kicad_sch")]),
        )["changes"][0]
        self.assertEqual(change["reasons"], ["sheet-changed"])
        self.assertEqual(
            change["details"]["sheetChange"],
            {"old": "A.kicad_sch", "new": "B.kicad_sch"},
        )

    def test_pcb_placement_change_remains_reportable(self) -> None:
        changes = design_compare_service._diff_geometry(
            {"pcb": {"u1": {"kind": "footprint", "semantic_id": "cmp:u1", "x": 1, "y": 2}}},
            {"pcb": {"u1": {"kind": "footprint", "semantic_id": "cmp:u1", "x": 4, "y": 6}}},
            "pcb",
        )
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["kind"], "changed")

    def test_revision_builds_overlap_and_identical_shas_are_deduplicated(self) -> None:
        barrier = threading.Barrier(2)
        started = []
        started_lock = threading.Lock()

        def fake_load(_project, _repo, _relative, commit, logs, *, on_progress):
            with started_lock:
                started.append(commit)
            on_progress("started")
            barrier.wait(timeout=2)
            logs.append(f"built {commit}")
            return {"commit": commit}

        with mock.patch.dict(os.environ, {"PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS": "2"}), mock.patch.object(
            design_compare_service,
            "_load_or_build_revision",
            side_effect=fake_load,
        ) as load:
            revisions, revision_logs = design_compare_service._build_revisions(
                "project",
                Path("/repo"),
                "board.kicad_pro",
                "base",
                "head",
                lambda _message, _percent=None: None,
            )
        self.assertCountEqual(started, ["base", "head"])
        self.assertEqual(set(revisions), {"base", "head"})
        self.assertEqual(revision_logs["base"], ["built base"])
        self.assertEqual(load.call_count, 2)

        with mock.patch.object(
            design_compare_service,
            "_load_or_build_revision",
            return_value={"commit": "same"},
        ) as deduplicated:
            revisions, _ = design_compare_service._build_revisions(
                "project",
                Path("/repo"),
                "board.kicad_pro",
                "same",
                "same",
                lambda _message, _percent=None: None,
            )
        self.assertEqual(revisions, {"same": {"commit": "same"}})
        deduplicated.assert_called_once()

    def test_component_rename_matches_by_native_uuid(self) -> None:
        base = {
            "components": [
                {
                    "componentUid": "cmp:old",
                    "reference": "U1",
                    "fields": {"Value": "MCU"},
                    "schematicRefs": [{"symbolUuid": "sym-1", "page": "root.kicad_sch"}],
                }
            ],
            "nets": [],
            "terminals": [],
        }
        compare = {
            "components": [
                {
                    "componentUid": "cmp:new",
                    "reference": "U100",
                    "fields": {"Value": "MCU"},
                    "schematicRefs": [{"symbolUuid": "sym-1", "page": "root.kicad_sch"}],
                }
            ],
            "nets": [],
            "terminals": [],
        }
        result = design_compare_service._diff_designs(base, compare)
        self.assertEqual(len(result["changes"]), 1)
        change = result["changes"][0]
        self.assertEqual(change["kind"], "changed")
        self.assertEqual(change["fields"]["Reference"], {"old": "U1", "new": "U100"})
        self.assertEqual(change["source_id_base"], "sym-1")
        self.assertEqual(change["source_id_compare"], "sym-1")

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
        result = design_compare_service._diff_designs(base, compare)
        self.assertEqual(len(result["changes"]), 1)
        change = result["changes"][0]
        self.assertEqual(change["kind"], "changed")
        self.assertEqual(change["fields"]["name"], {"old": "VCC", "new": "3V3"})
        self.assertEqual(change["source_id_base"], "wire-1")
        self.assertEqual(change["source_id_compare"], "wire-1")
        self.assertNotIn("connections", change["fields"])

    def test_component_uuid_replacement_matches_by_semantic_identity(self) -> None:
        base = {
            "schematic": {},
            "pcb": {
                "old-source": {
                    "kind": "footprint",
                    "semantic_id": "cmp:u1",
                    "reference": "U1",
                    "x": 10,
                    "y": 10,
                }
            },
        }
        compare = {
            "schematic": {},
            "pcb": {
                "new-source": {
                    "kind": "footprint",
                    "semantic_id": "cmp:u1",
                    "reference": "U1",
                    "x": 20,
                    "y": 10,
                }
            },
        }
        changes = design_compare_service._diff_geometry(base, compare, "pcb")
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["kind"], "changed")
        self.assertEqual(changes[0]["source_id_base"], "old-source")
        self.assertEqual(changes[0]["source_id_compare"], "new-source")

    def test_groups_keep_secondary_graphics_but_classify_them(self) -> None:
        changes = [
            {
                "id": "graphic-a",
                "kind": "added",
                "category": "graphics",
                "classification": "secondary",
                "label": "Dwgs.User line",
            },
            {
                "id": "component-a",
                "kind": "changed",
                "category": "components",
                "classification": "primary",
                "label": "U1",
                "semantic_id": "cmp:u1",
            },
        ]
        groups = design_compare_service._group_changes(changes)
        self.assertEqual({group["classification"] for group in groups}, {"primary", "secondary"})
        self.assertTrue(all(group["id"].startswith("grp:") for group in groups))

    def test_semantic_component_change_folds_into_exact_native_geometry(self) -> None:
        semantic = [{
            "id": "sch-comp-del-cmp:u1",
            "kind": "removed",
            "domain": "schematic",
            "category": "components",
            "label": "U1",
            "reference": "U1",
            "semantic_id": "cmp:u1",
            "page": "Power",
            "source_id_base": "uuid-u1",
            "source_id_compare": None,
            "fields": {"Value": {"old": "MCU", "new": None}},
        }]
        geometry = [{
            "id": "sch-removed-cmp:u1",
            "kind": "removed",
            "domain": "schematic",
            "category": "components",
            "label": "U1",
            "reference": "U1",
            "semantic_id": "cmp:u1",
            "page": "Power.kicad_sch",
            "source_id_base": "uuid-u1",
            "source_id_compare": None,
            "oldGeometry": {
                "kind": "symbol",
                "source_id": "uuid-u1",
                "bounds": [10, 20, 4, 5],
            },
        }]
        merged = design_compare_service._merge_semantic_geometry_changes(
            semantic,
            geometry,
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["page"], "Power.kicad_sch")
        self.assertEqual(merged[0]["oldGeometry"]["bounds"], [10, 20, 4, 5])
        self.assertIn("Value", merged[0]["fields"])

    def test_groups_include_position_delta_and_geometry_bounds(self) -> None:
        groups = design_compare_service._group_changes([{
            "id": "pcb-changed-u1",
            "kind": "changed",
            "domain": "pcb",
            "category": "components",
            "classification": "primary",
            "label": "U1",
            "semantic_id": "cmp:u1",
            "oldGeometry": {"x": 10.0, "y": 20.0, "bounds": [8, 18, 4, 4]},
            "geometry": {"x": 13.0, "y": 24.0, "bounds": [11, 22, 4, 4]},
        }])
        self.assertEqual(
            groups[0]["position_delta"],
            {"dx": 3.0, "dy": 4.0, "distance": 5.0},
        )
        self.assertEqual(groups[0]["geometry_bounds"]["base"], [[8, 18, 4, 4]])

    def test_route_metrics_include_arc_via_layers_and_diagnostics(self) -> None:
        geometry = {
            "pcb": {
                "track": {
                    "kind": "track",
                    "net": "VCC",
                    "layer": "F.Cu",
                    "points": [[0, 0], [3, 4]],
                },
                "arc": {
                    "kind": "arc",
                    "net": "VCC",
                    "layer": "B.Cu",
                    "points": [[1, 0], [0.707106, 0.707106], [0, 1]],
                },
                "via": {
                    "kind": "via",
                    "net": "VCC",
                    "layers": ["F.Cu", "B.Cu"],
                },
            }
        }
        metrics = design_compare_service._route_metrics(
            geometry,
            {
                "layers": [
                    {"name": "F.Cu", "thickness": 0.035},
                    {"name": "dielectric", "thickness": 1.53},
                    {"name": "B.Cu", "thickness": 0.035},
                ]
            },
        )["VCC"]
        self.assertAlmostEqual(metrics["centerline_length_mm"], 5 + 1.5708, places=3)
        self.assertEqual(metrics["via_count"], 1)
        self.assertEqual(metrics["used_layers"], ["B.Cu", "F.Cu"])
        self.assertAlmostEqual(metrics["via_barrel_length_mm"], 1.6)
        self.assertIsNone(metrics["propagation_delay"])

    def test_bom_unchanged_rows_are_opt_in_and_detected_fields_are_exposed(self) -> None:
        old = [{"Reference": "R1", "Value": "10k", "Tolerance": "1%"}]
        new = [{"Reference": "R1", "Value": "10k", "Tolerance": "1%"}]
        compact = bom_diff_service.diff_boms(old, new, ["Value"])
        full = bom_diff_service.diff_boms(old, new, ["Value"], include_unchanged=True)
        self.assertEqual(compact["changes"], [])
        self.assertEqual(full["changes"][0]["status"], "unchanged")
        self.assertIn("Tolerance", full["fields"])

    def test_bom_value_change_with_kicad_cli_refs_header(self) -> None:
        """Default kicad-cli BOM CSV uses Refs, not Reference."""
        old_csv = "Refs,Value,Footprint,Qty,DNP\nR5,5.1k,R_0805_2012Metric,1,\n"
        new_csv = "Refs,Value,Footprint,Qty,DNP\nR5,2.4k,R_0805_2012Metric,1,\n"
        old = bom_diff_service.parse_bom_csv(old_csv)
        new = bom_diff_service.parse_bom_csv(new_csv)
        result = bom_diff_service.diff_boms(old, new, ["Value", "Footprint"])
        self.assertEqual(result["summary"], {"added": 0, "removed": 0, "changed": 1})
        self.assertEqual(result["changes"][0]["ref"], "R5")
        self.assertEqual(result["changes"][0]["status"], "changed")
        self.assertEqual(
            result["changes"][0]["diffs"]["Value"],
            {"old": "5.1k", "new": "2.4k"},
        )

    def test_stackup_extract_reads_thickness_after_color(self) -> None:
        """KiCad often writes (color ...) between (type ...) and (thickness ...)."""
        pcb_text = """(kicad_pcb
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
  )
  (setup
    (stackup
      (layer "F.Mask"
        (type "Top Solder Mask")
        (color "Green")
        (thickness 0.0254)
      )
      (layer "F.Cu"
        (type "copper")
        (thickness 0.035)
      )
      (layer "dielectric 1"
        (type "core")
        (color "FR4 natural")
        (thickness 1.51)
        (material "FR4")
      )
      (layer "B.Cu"
        (type "copper")
        (thickness 0.035)
      )
    )
  )
)
"""
        with tempfile.TemporaryDirectory() as temporary:
            snap = Path(temporary)
            (snap / "board.kicad_pcb").write_text(pcb_text, encoding="utf-8")
            stackup = design_compare_service._extract_stackup(snap)
        self.assertTrue(stackup["present"])
        by_name = {layer["name"]: layer for layer in stackup["layers"]}
        self.assertEqual(by_name["F.Mask"]["thickness"], 0.0254)
        self.assertEqual(by_name["dielectric 1"]["thickness"], 1.51)
        self.assertEqual(by_name["F.Cu"]["type"], "copper")

    def test_stackup_diff_detects_thickness_change(self) -> None:
        base = {
            "present": True,
            "layers": [
                {"name": "F.Cu", "type": "copper", "thickness": 0.035},
                {"name": "dielectric 1", "type": "core", "thickness": 1.51},
            ],
        }
        head = {
            "present": True,
            "layers": [
                {"name": "F.Cu", "type": "copper", "thickness": 0.035},
                {"name": "dielectric 1", "type": "core", "thickness": 1.2},
            ],
        }
        diff = design_compare_service._diff_stackup(base, head)
        self.assertTrue(diff["changed"])
        self.assertTrue(diff["present"])
        self.assertEqual(diff["head"][1]["thickness"], 1.2)

    def test_bom_grouped_refs_expand_to_per_designator_rows(self) -> None:
        old_csv = "Refs,Value,Footprint\n\"R1, R2\",10k,R_0805_2012Metric\n"
        new_csv = "Refs,Value,Footprint\n\"R1, R2\",4.7k,R_0805_2012Metric\n"
        old = bom_diff_service.parse_bom_csv(old_csv)
        new = bom_diff_service.parse_bom_csv(new_csv)
        result = bom_diff_service.diff_boms(old, new, ["Value"])
        self.assertEqual(result["summary"]["changed"], 2)
        self.assertEqual(
            {row["ref"] for row in result["changes"]},
            {"R1", "R2"},
        )

    def test_revision_resolution_returns_full_immutable_sha(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(
                ["git", "-C", str(root), "config", "user.email", "test@example.invalid"],
                check=True,
            )
            (root / "board.kicad_pro").write_text("{}", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "board.kicad_pro"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "fixture"], check=True)
            resolved = design_compare_service._resolve_revision(root, "HEAD")
            self.assertRegex(resolved, r"^[0-9a-f]{40}$")
            with self.assertRaises(ValueError):
                design_compare_service._resolve_revision(root, "../not-a-revision")

    def test_semantic_bom_projection_reuses_components_and_excludes_non_bom(self) -> None:
        rows = design_compare_service._semantic_bom_rows({
            "components": [
                {
                    "reference": "R1",
                    "value": "10k",
                    "footprint": "R_0402",
                    "fields": {"Manufacturer": "ACME", "kicad_in_bom": "true"},
                },
                {
                    "reference": "TP1",
                    "fields": {"kicad_in_bom": "false"},
                },
            ],
        })
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["Reference"], "R1")
        self.assertEqual(rows[0]["Manufacturer"], "ACME")

    def test_initial_stage_workers_overlap_and_publish_both_revisions(self) -> None:
        barrier = threading.Barrier(2)

        def fake_initial(_project, _repo, _relative, commit, logs, **_kwargs):
            barrier.wait(timeout=2)
            logs.append(f"initial {commit}")
            return {"commit": commit}

        with mock.patch.dict(
            os.environ,
            {
                "PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS": "2",
                # A threading.Barrier only synchronises within one process,
                # and a patched module attribute does not survive into a
                # spawned worker. This case is about the fan-out mechanics,
                # so it stays in-process; the worker contract used by the
                # process path is covered separately below.
                "PRISM_DESIGN_COMPARE_REVISION_PROCESSES": "0",
            },
        ), mock.patch.object(
            design_compare_service,
            "_load_or_build_initial_revision",
            side_effect=fake_initial,
        ):
            revisions, logs = design_compare_service._build_initial_revisions(
                "project",
                Path("/repo"),
                None,
                "base",
                "head",
                lambda _message, _percent=None: None,
            )

        self.assertEqual(set(revisions), {"base", "head"})
        self.assertEqual(logs["head"], ["initial head"])

    def test_revision_processes_are_the_default_and_can_be_switched_off(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PRISM_DESIGN_COMPARE_REVISION_PROCESSES", None)
            self.assertTrue(design_compare_service._revision_processes_enabled())
        for disabled in ("0", "false", "no", "off", "OFF"):
            with mock.patch.dict(
                os.environ,
                {"PRISM_DESIGN_COMPARE_REVISION_PROCESSES": disabled},
            ):
                self.assertFalse(
                    design_compare_service._revision_processes_enabled(),
                    msg=f"{disabled!r} should disable the process pool",
                )

    def test_initial_revision_task_returns_logs_and_events_for_the_parent(self) -> None:
        # The worker runs where the caller's logs list, progress callback and
        # benchmark cannot reach it, so it has to hand all three back.
        def fake_initial(_project, repo, _relative, commit, logs, **kwargs):
            logs.append(f"built {commit}")
            benchmark = kwargs["benchmark"]
            benchmark.mark("snapshot", scope=f"revision:{commit}:initial")
            self.assertEqual(repo, Path("/repo"))
            return {"commit": commit}

        with mock.patch.object(
            design_compare_service,
            "_load_or_build_initial_revision",
            side_effect=fake_initial,
        ):
            result = design_compare_service._initial_revision_task({
                "project_id": "project",
                "repo_path": "/repo",
                "relative_path": None,
                "commit": "head",
                "benchmark_job_id": "job-1",
            })

        self.assertEqual(result["revision"], {"commit": "head"})
        self.assertEqual(result["logs"], ["built head"])
        self.assertEqual([event["phase"] for event in result["events"]], ["snapshot"])

    def test_initial_revision_task_skips_benchmarking_when_unrequested(self) -> None:
        def fake_initial(_project, _repo, _relative, commit, logs, **kwargs):
            self.assertIsNone(kwargs["benchmark"])
            logs.append(commit)
            return {"commit": commit}

        with mock.patch.object(
            design_compare_service,
            "_load_or_build_initial_revision",
            side_effect=fake_initial,
        ):
            result = design_compare_service._initial_revision_task({
                "project_id": "project",
                "repo_path": "/repo",
                "relative_path": None,
                "commit": "base",
                "benchmark_job_id": None,
            })

        self.assertEqual(result["events"], [])

    def test_pcb_stage_workers_overlap_and_reuse_initial_revisions(self) -> None:
        barrier = threading.Barrier(2)
        received_initial = {}

        def fake_pcb(_project, commit, initial, logs, **_kwargs):
            received_initial[commit] = initial
            barrier.wait(timeout=2)
            logs.append(f"pcb {commit}")
            return {"commit": commit, "initial": initial}

        initial = {
            "base": {"commit": "base", "stage": "initial"},
            "head": {"commit": "head", "stage": "initial"},
        }
        with mock.patch.dict(
            os.environ,
            {"PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS": "2"},
        ), mock.patch.object(
            design_compare_service,
            "_load_or_build_pcb_revision",
            side_effect=fake_pcb,
        ):
            revisions, logs = design_compare_service._build_pcb_revisions(
                "project",
                "base",
                "head",
                initial,
                lambda _message, _percent=None: None,
            )

        self.assertEqual(set(revisions), {"base", "head"})
        self.assertIs(received_initial["base"], initial["base"])
        self.assertIs(received_initial["head"], initial["head"])
        self.assertEqual(logs["base"], ["pcb base"])

    def test_stage_worker_count_honors_global_fallback_and_stage_override(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS": "1"},
            clear=False,
        ):
            os.environ.pop("PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS", None)
            os.environ.pop("PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS", None)
            self.assertEqual(
                design_compare_service._stage_worker_count("initial", 2),
                1,
            )
            self.assertEqual(
                design_compare_service._stage_worker_count("pcb", 2),
                1,
            )
            os.environ["PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS"] = "2"
            self.assertEqual(
                design_compare_service._stage_worker_count("pcb", 2),
                2,
            )

    def test_initial_assembly_marks_only_schematic_and_bom_ready(self) -> None:
        revision = {
            "semantic": self._design(),
            "geometry": {"schematic": {}, "pcb": {}},
            "sources": [{"filename": "root.kicad_sch", "path": "root.kicad_sch"}],
            "bom_rows": [],
        }
        benchmark = DesignCompareBenchmark(job_id="staged-test")
        result, _state = design_compare_service._assemble_initial_comparison(
            project_id="project",
            base="base",
            head="head",
            revisions={"base": revision, "head": revision},
            include_unchanged=False,
            benchmark=benchmark,
        )
        self.assertEqual(result["readiness"]["stage"], "initial-ready")
        self.assertEqual(result["readiness"]["domains"]["schematic"], "ready")
        self.assertEqual(result["readiness"]["domains"]["bom"], "ready")
        self.assertEqual(result["readiness"]["domains"]["pcb"], "building")
        self.assertEqual(result["readiness"]["domains"]["stackup"], "building")

    def test_pcb_geometry_reuses_stage_one_component_and_net_identities(self) -> None:
        semantic = {
            "components": [{"componentUid": "cmp:u1", "reference": "U1"}],
            "nets": [{"netUid": "net:sig", "name": "SIG"}],
            "indexes": {
                "componentByReference": {"U1": 0},
                "componentByPcbFootprintUuid": {},
                "netByName": {"SIG": 0},
                "netByPcbUuid": {},
            },
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "board.kicad_pcb").write_text(
                '''(kicad_pcb
                  (net 1 "SIG")
                  (segment (start 1 2) (end 3 4) (width 0.2) (layer "F.Cu")
                    (net 1) (uuid "11111111-1111-1111-1111-111111111111"))
                  (footprint "Demo:Part" (layer "F.Cu") (at 10 20)
                    (property "Reference" "U1")
                    (uuid "22222222-2222-2222-2222-222222222222")))''',
                encoding="utf-8",
            )
            geometry = design_compare_service._extract_geometry(root, semantic, {"pcb"})["pcb"]

        self.assertEqual(
            geometry["11111111-1111-1111-1111-111111111111"]["semantic_id"],
            "net:sig",
        )
        footprint = geometry["22222222-2222-2222-2222-222222222222"]
        self.assertEqual(footprint["semantic_id"], "cmp:u1")
        self.assertEqual(footprint["reference"], "U1")

    def test_job_publishes_initial_result_before_starting_background_stage(self) -> None:
        events = []
        job_id = "staged-job"
        design_compare_service.design_compare_jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "logs": [],
            "result": None,
        }
        initial_result = {
            "readiness": {
                "stage": "initial-ready",
                "domains": {
                    "schematic": "ready",
                    "bom": "ready",
                    "pcb": "building",
                    "stackup": "building",
                },
            },
            "schematic": {"changes": []},
            "pcb": {"changes": []},
            "bom": {"changes": []},
        }
        complete_result = {
            **initial_result,
            "readiness": {
                "stage": "complete",
                "domains": {
                    "schematic": "ready",
                    "bom": "ready",
                    "pcb": "ready",
                    "stackup": "ready",
                },
            },
        }

        def publish(_job_id, job, result, *, version, benchmark):
            del benchmark
            events.append(f"publish-{version}")
            job["result"] = result
            job["result_version"] = version
            job["readiness"] = result["readiness"]
            result_path = design_compare_service._JOB_ROOT / _job_id / "result.json"
            result_path.parent.mkdir(parents=True, exist_ok=True)
            result_path.write_text("{}", encoding="utf-8")
            return result_path

        def build_pcb(*_args, **_kwargs):
            self.assertEqual(events, ["publish-1"])
            events.append("pcb-start")
            return {"base": {}, "head": {}}, {"base": [], "head": []}

        with tempfile.TemporaryDirectory() as temporary, mock.patch.object(
            design_compare_service,
            "_JOB_ROOT",
            Path(temporary),
        ), mock.patch.object(
            design_compare_service,
            "_repo_paths",
            return_value=(Path("/repo"), None, Path("/repo")),
        ), mock.patch.object(
            design_compare_service,
            "_build_initial_revisions",
            return_value=({"base": {}, "head": {}}, {"base": [], "head": []}),
        ), mock.patch.object(
            design_compare_service,
            "_assemble_initial_comparison",
            return_value=(initial_result, {"schematic_changes": []}),
        ), mock.patch.object(
            design_compare_service,
            "_publish_comparison_result",
            side_effect=publish,
        ), mock.patch.object(
            design_compare_service,
            "_build_pcb_revisions",
            side_effect=build_pcb,
        ), mock.patch.object(
            design_compare_service,
            "_complete_comparison",
            return_value=complete_result,
        ), mock.patch.object(
            design_compare_service,
            "_persist_job",
        ), mock.patch.object(
            design_compare_service.logger,
            "exception",
        ):
            design_compare_service._run_job(
                job_id,
                "project",
                "base",
                "head",
                False,
            )

        self.assertEqual(events, ["publish-1", "pcb-start", "publish-2"])
        self.assertEqual(design_compare_service.design_compare_jobs[job_id]["status"], "completed")
        design_compare_service.design_compare_jobs.pop(job_id, None)

    def test_background_failure_preserves_initial_result_and_marks_late_domains_failed(self) -> None:
        job_id = "staged-background-failure"
        design_compare_service.design_compare_jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "logs": [],
            "result": None,
        }
        initial_result = {
            "readiness": {
                "stage": "initial-ready",
                "domains": {
                    "schematic": "ready",
                    "bom": "ready",
                    "pcb": "building",
                    "stackup": "building",
                },
            },
            "schematic": {"changes": [{"id": "schematic-change"}]},
            "pcb": {"changes": []},
            "bom": {"changes": [{"ref": "R1"}]},
        }
        published = []

        def publish(_job_id, job, result, *, version, benchmark):
            del benchmark
            published.append((version, copy.deepcopy(result)))
            job["result"] = result
            job["result_version"] = version
            job["readiness"] = result["readiness"]
            result_path = design_compare_service._JOB_ROOT / _job_id / "result.json"
            result_path.parent.mkdir(parents=True, exist_ok=True)
            result_path.write_text("{}", encoding="utf-8")
            return result_path

        with tempfile.TemporaryDirectory() as temporary, mock.patch.object(
            design_compare_service,
            "_JOB_ROOT",
            Path(temporary),
        ), mock.patch.object(
            design_compare_service,
            "_repo_paths",
            return_value=(Path("/repo"), None, Path("/repo")),
        ), mock.patch.object(
            design_compare_service,
            "_build_initial_revisions",
            return_value=({"base": {}, "head": {}}, {"base": [], "head": []}),
        ), mock.patch.object(
            design_compare_service,
            "_assemble_initial_comparison",
            return_value=(initial_result, {"schematic_changes": []}),
        ), mock.patch.object(
            design_compare_service,
            "_publish_comparison_result",
            side_effect=publish,
        ), mock.patch.object(
            design_compare_service,
            "_build_pcb_revisions",
            side_effect=RuntimeError("PCB worker failed"),
        ), mock.patch.object(
            design_compare_service,
            "_persist_job",
        ), mock.patch.object(
            design_compare_service.logger,
            "exception",
        ):
            design_compare_service._run_job(
                job_id,
                "project",
                "base",
                "head",
                False,
            )

        self.assertEqual([version for version, _result in published], [1, 2])
        failed_result = published[-1][1]
        self.assertEqual(failed_result["readiness"]["stage"], "background-failed")
        self.assertEqual(failed_result["readiness"]["domains"]["schematic"], "ready")
        self.assertEqual(failed_result["readiness"]["domains"]["bom"], "ready")
        self.assertEqual(failed_result["readiness"]["domains"]["pcb"], "failed")
        self.assertEqual(failed_result["readiness"]["domains"]["stackup"], "failed")
        self.assertEqual(failed_result["schematic"], initial_result["schematic"])
        self.assertEqual(
            design_compare_service.design_compare_jobs[job_id]["status"],
            "failed",
        )
        design_compare_service.design_compare_jobs.pop(job_id, None)


if __name__ == "__main__":
    unittest.main()
