import unittest

from app.services import document_diff_service


class DocumentDiffServiceTests(unittest.TestCase):
    def test_builds_strict_kicad_documents_and_navigation(self) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[
                {
                    "id": "prism-sch-u1",
                    "kind": "changed",
                    "domain": "schematic",
                    "reference": "U1",
                    "source_id_base": "old-u1",
                    "source_id_compare": "new-u1",
                    "fields": {"Value": {"old": "A", "new": "B"}},
                    "geometry": {
                        "kind": "symbol",
                        "page": "Sheets/Power.kicad_sch",
                        "bounds": [10.0, 20.0, 4.0, 5.0],
                    },
                }
            ],
            pcb_changes=[
                {
                    "id": "prism-pcb-track",
                    "kind": "removed",
                    "domain": "pcb",
                    "net": "VCC",
                    "source_id_base": "track-old",
                    "source_id_compare": None,
                    "oldGeometry": {
                        "kind": "track",
                        "bounds": [1.0, 2.0, 3.0, 4.0],
                    },
                }
            ],
            files={
                "base": [
                    {
                        "filename": "board.kicad_pcb",
                        "path": "Hardware/board.kicad_pcb",
                    }
                ],
                "head": [],
            },
        )

        self.assertEqual(result["provider"], "prism-semantic")
        documents = {
            document["path"]: document
            for document in result["project"]["documents"]
        }
        schematic = documents["Sheets/Power.kicad_sch"]
        self.assertEqual(schematic["docType"], "kicad_sch")
        self.assertEqual(schematic["changes"][0]["id"], "/new-u1")
        self.assertEqual(schematic["changes"][0]["kind"], "modified")
        self.assertEqual(
            schematic["changes"][0]["bbox"],
            [100_000, 200_000, 40_000, 50_000],
        )
        self.assertEqual(
            schematic["changes"][0]["properties"][0],
            {
                "name": "Value",
                "before": {"type": "string", "v": "A"},
                "after": {"type": "string", "v": "B"},
            },
        )

        pcb = documents["Hardware/board.kicad_pcb"]
        self.assertEqual(pcb["changes"][0]["id"], "/track-old")
        self.assertEqual(pcb["changes"][0]["kind"], "removed")
        self.assertEqual(
            pcb["changes"][0]["bbox"],
            [1_000_000, 2_000_000, 3_000_000, 4_000_000],
        )
        self.assertEqual(
            result["navigation"]["prism-sch-u1"],
            {
                "documentPath": "Sheets/Power.kicad_sch",
                "changeId": "/new-u1",
                "changeIds": ["/new-u1"],
            },
        )

    def test_emits_multi_target_change_as_one_native_tree(self) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[{
                "id": "pf-01-count",
                "kind": "changed",
                "domain": "schematic",
                "category": "nets",
                "net": "PF_01",
                "details": {
                    "visualTargets": [
                        {
                            "side": "reference",
                            "status": "removed",
                            "sourceId": "label-a",
                            "page": "root.kicad_sch",
                            "role": "label",
                        },
                        {
                            "side": "reference",
                            "status": "removed",
                            "sourceId": "label-b",
                            "page": "root.kicad_sch",
                            "role": "label",
                        },
                    ],
                },
            }],
            pcb_changes=[],
            files={},
        )

        root = result["project"]["documents"][0]["changes"][0]
        self.assertEqual(root["id"], "/label-a")
        self.assertEqual(root["kind"], "removed")
        self.assertEqual(root["sourceSide"], "reference")
        self.assertEqual([child["id"] for child in root["children"]], ["/label-b"])
        self.assertEqual(
            result["navigation"]["pf-01-count"]["changeIds"],
            ["/label-a", "/label-b"],
        )

    def test_reports_non_renderable_semantic_only_changes(self) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[
                {
                    "id": "semantic-net",
                    "kind": "changed",
                    "domain": "schematic",
                    "net": "VCC",
                }
            ],
            pcb_changes=[],
            files={},
        )

        self.assertEqual(result["project"]["documents"], [])
        self.assertEqual(
            result["diagnostics"],
            [{"changeId": "semantic-net", "reason": "missing-source-id"}],
        )

    def test_hydrates_field_only_changes_from_the_semantic_geometry_index(
        self,
    ) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[
                {
                    "id": "field-only-u1",
                    "kind": "changed",
                    "domain": "schematic",
                    "source_id_base": "u1",
                    "source_id_compare": "u1",
                    "page": "root.kicad_sch",
                    "fields": {"Value": {"old": "A", "new": "B"}},
                }
            ],
            pcb_changes=[],
            files={},
            geometry={
                "base": {"schematic": {}, "pcb": {}},
                "head": {
                    "schematic": {
                        "u1": {
                            "kind": "symbol",
                            "page": "root.kicad_sch",
                            "bounds": [10, 20, 4, 5],
                        }
                    },
                    "pcb": {},
                },
            },
        )

        item = result["project"]["documents"][0]["changes"][0]
        self.assertEqual(item["typeName"], "SCH_SYMBOL")
        self.assertEqual(item["bbox"], [100_000, 200_000, 40_000, 50_000])

    def test_reference_sourced_modified_change_preserves_source_side(self) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[
                {
                    "id": "duplicate-count-down",
                    "kind": "changed",
                    "domain": "schematic",
                    "source_side": "reference",
                    "source_id_base": "removed-duplicate",
                    "source_id_compare": None,
                    "page": "root.kicad_sch",
                    "fields": {"instanceCount": {"old": 2, "new": 1}},
                    "oldGeometry": {
                        "kind": "symbol",
                        "page": "root.kicad_sch",
                        "bounds": [10, 20, 4, 5],
                    },
                }
            ],
            pcb_changes=[],
            files={},
        )

        item = result["project"]["documents"][0]["changes"][0]
        self.assertEqual(item["kind"], "modified")
        self.assertEqual(item["id"], "/removed-duplicate")
        self.assertEqual(item["sourceSide"], "reference")

    def test_native_geometry_page_overrides_human_hierarchy_and_folds_siblings(self) -> None:
        hierarchy = "/S32G399/Ethernet & PCIe Section/USB/"
        native_page = "Subsheets/USB.kicad_sch"
        result = document_diff_service.build_project_diff(
            schematic_changes=[{
                "id": "usb-data0",
                "kind": "changed",
                "domain": "schematic",
                "category": "nets",
                "net": "USB_ULPI_DATA0",
                "details": {
                    "visualTargets": [
                        {
                            "side": "comparison",
                            "status": "modified",
                            "sourceId": "wire-a",
                            "page": native_page,
                            "role": "wire",
                        },
                        {
                            "side": "comparison",
                            "status": "modified",
                            "sourceId": "label-a",
                            "page": hierarchy,
                            "role": "label",
                        },
                    ],
                },
            }],
            pcb_changes=[],
            files={},
            geometry={
                "base": {"schematic": {}, "pcb": {}},
                "head": {
                    "schematic": {
                        "wire-a": {"kind": "wire", "page": native_page},
                        "label-a": {"kind": "label", "page": native_page},
                    },
                    "pcb": {},
                },
            },
        )

        self.assertEqual(
            [document["path"] for document in result["project"]["documents"]],
            [native_page],
        )
        self.assertEqual(
            result["navigation"]["usb-data0"]["changeIds"],
            ["/wire-a", "/label-a"],
        )

    def test_unresolved_hierarchy_does_not_create_an_unloadable_document(self) -> None:
        result = document_diff_service.build_project_diff(
            schematic_changes=[{
                "id": "unresolved-label",
                "kind": "changed",
                "domain": "schematic",
                "details": {
                    "visualTargets": [{
                        "side": "comparison",
                        "status": "modified",
                        "sourceId": "label-a",
                        "page": "/Human/Hierarchy/",
                        "role": "label",
                    }],
                },
            }],
            pcb_changes=[],
            files={},
        )

        self.assertEqual(result["project"]["documents"], [])
        self.assertEqual(
            result["diagnostics"],
            [{"changeId": "unresolved-label", "reason": "unresolved-schematic-hierarchy"}],
        )


if __name__ == "__main__":
    unittest.main()
