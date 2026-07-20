import tempfile
import unittest
from pathlib import Path
import subprocess

from app.services import bom_diff_service, design_compare_service


class DesignCompareServiceTests(unittest.TestCase):
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

    def test_geometry_extract_preserves_native_ids_and_routing_shapes(self) -> None:
        segment_id = "11111111-1111-1111-1111-111111111111"
        arc_id = "22222222-2222-2222-2222-222222222222"
        via_id = "33333333-3333-3333-3333-333333333333"
        footprint_id = "44444444-4444-4444-4444-444444444444"
        symbol_id = "55555555-5555-5555-5555-555555555555"
        wire_id = "66666666-6666-6666-6666-666666666666"
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
                  (symbol (lib_id "Device:R") (at 10 20) (uuid "{symbol_id}"))
                  (wire (pts (xy 1 2) (xy 3 4)) (uuid "{wire_id}"))
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
                    (uuid "{footprint_id}") (at 20 30))
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
        self.assertEqual(geometry["schematic"][wire_id]["net"], "VCC")

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


if __name__ == "__main__":
    unittest.main()
