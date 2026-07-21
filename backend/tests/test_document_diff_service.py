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
            },
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


if __name__ == "__main__":
    unittest.main()
