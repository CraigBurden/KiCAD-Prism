import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services import semantic_index_service, semantic_visualizer_service


class SemanticIndexServiceTests(unittest.TestCase):
    def test_webgpu_bundle_path_rejects_cache_key_traversal(self) -> None:
        for source_key, build_key in (
            ("../outside", "build-a"),
            ("revision-a", "../../outside"),
            ("revision/a", "build-a"),
        ):
            with self.subTest(source_key=source_key, build_key=build_key):
                with self.assertRaises(ValueError):
                    semantic_visualizer_service.bundle_dir("prj_test", source_key, build_key)

    def test_source_revision_key_ignores_heavy_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / "board.kicad_pro"
            schematic = root / "board.kicad_sch"
            model = root / "board.glb"
            project.write_text("project-a", encoding="utf-8")
            schematic.write_text("schematic-a", encoding="utf-8")
            model.write_bytes(b"model-a")

            initial = semantic_index_service.source_revision_key_for_project_file(project)
            model.write_bytes(b"model-b")
            self.assertEqual(semantic_index_service.source_revision_key_for_project_file(project), initial)

            schematic.write_text("schematic-b", encoding="utf-8")
            self.assertNotEqual(semantic_index_service.source_revision_key_for_project_file(project), initial)

    def test_build_semantic_index_maps_schematic_and_pcb_identities(self) -> None:
        design_payload = {
            "components": [{
                "designator": "U12",
                "svg_id": "symbol-u12",
                "value": "TPS55289",
                "footprint": "QFN",
                "description": "Buck-boost controller",
                "parameters": {"Manufacturer": "TI", "MPN": "TPS55289"},
                "hierarchy": {"sheet_path": "/Power/", "sheet": "power.kicad_sch"},
            }],
            "nets": [{
                "name": "VBUS",
                "net_class": "Power",
                "graphical": {
                    "wires": ["wire-vbus"],
                    "labels": ["label-vbus"],
                    "junctions": ["junction-vbus"],
                    "ports": [],
                    "power_ports": [],
                    "sheet_entries": [],
                    "pins": [{
                        "designator": "U12",
                        "pin": "5",
                        "source_pin_id": "pin-u12-5",
                    }],
                },
                "terminals": [{"designator": "U12", "pin": "5"}],
            }],
        }

        net_ref = SimpleNamespace(name="VBUS", ordinal=17)
        pad = SimpleNamespace(uuid="pad-u12-5", number="5", net=net_ref)
        footprint = SimpleNamespace(
            uuid="footprint-u12",
            properties=[SimpleNamespace(name="Reference", value="U12")],
            pads=[pad],
        )
        track = SimpleNamespace(uuid="track-vbus", net=net_ref)
        pcb = SimpleNamespace(
            footprints=[footprint],
            segments=[track],
            arcs=[],
            vias=[],
            zones=[],
            resolve_net_name=lambda ref: ref.name,
        )

        class FakeDesign:
            def __init__(self):
                self.pcb = pcb

            def to_json(self, include_indexes=True):
                if not include_indexes:
                    raise AssertionError("semantic index requires kicad-monkey indexes")
                return design_payload

        class FakeKiCadDesign:
            @staticmethod
            def from_project_file(_path):
                return FakeDesign()

        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            sys.modules,
            {"kicad_monkey": SimpleNamespace(KiCadDesign=FakeKiCadDesign)},
        ):
            Path(temporary, "board.kicad_sch").write_text(
                '(kicad_sch (symbol (lib_id "Acme:U12") (uuid "symbol-u12") '
                '(property "Datasheet" "https://example.test/u12.pdf")))',
                encoding="utf-8",
            )
            payload = semantic_index_service.build_semantic_index(
                Path(temporary) / "board.kicad_pro",
                source_revision_key="revision-a",
            )

        component_index = payload["indexes"]["componentByReference"]["U12"]
        component = payload["components"][component_index]
        self.assertTrue(component["componentUid"].startswith("cmp:"))
        self.assertEqual(component["pcbRefs"][0]["footprintUuid"], "footprint-u12")
        self.assertEqual(component["fields"]["Datasheet"], "https://example.test/u12.pdf")
        self.assertTrue(all(field in component["fields"] for field in semantic_index_service.REQUIRED_BOM_FIELDS))

        net_index = payload["indexes"]["netByName"]["VBUS"]
        net = payload["nets"][net_index]
        self.assertEqual(net["netCode"], 17)
        self.assertEqual(payload["indexes"]["netBySchematicUuid"]["wire-vbus"], net_index)
        self.assertEqual(payload["indexes"]["netByPcbUuid"]["track-vbus"], net_index)

        terminal_index = payload["indexes"]["terminalByReferencePin"]["U12:5"]
        terminal = payload["terminals"][terminal_index]
        self.assertEqual(terminal["schematicPinUuid"], "pin-u12-5")
        self.assertEqual(terminal["pcbPadUuid"], "pad-u12-5")

    def test_canonical_fields_accepts_standard_and_custom_datasheet_spellings(self) -> None:
        fields = semantic_index_service._canonical_fields(
            {
                "parameters": {
                    "Datasheet Link": "",
                    "Datasheet": "https://example.test/part.pdf",
                }
            }
        )
        self.assertEqual(fields["Datasheet"], "https://example.test/part.pdf")


if __name__ == "__main__":
    unittest.main()
