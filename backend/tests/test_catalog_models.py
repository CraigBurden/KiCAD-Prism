"""SB2-17: catalog STEP → GLB with Geometer, bounds and alignment (CONTRACTS_P2 §18.2).

The evidence (``fixtures/system_builder/p2/evidence/models/record.json``, from
``p2/model_evidence.py``) holds kicad-cli 10.0.6's own measurement of five
stock connector models placed by their stock footprints. Geometer's bounds
must match it within 0.05 mm. The STEP files ship with KiCad, not with Prism,
so a model that is not installed is skipped.
"""

from __future__ import annotations

import json
import math
import os
import tempfile
import unittest
import uuid
from pathlib import Path

from app.services.catalog import models

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()
MODELS = Path("/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels")
EVIDENCE = json.loads((Path(__file__).resolve().parent / "fixtures" / "system_builder" / "p2" / "evidence" / "models"
                       / "record.json").read_text())
HEADER = MODELS / "Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x04_P2.54mm_Vertical.step"
SOCKET = MODELS / "Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x04_P2.54mm_Vertical.step"


def _colours(glb: bytes) -> set[tuple]:
    length = int.from_bytes(glb[12:16], "little")
    document = json.loads(glb[20:20 + length])
    return {tuple(round(c, 3) for c in (m.get("pbrMetallicRoughness") or {}).get("baseColorFactor", [1, 1, 1, 1]))
            for m in document.get("materials") or []}


class ConversionEvidenceTest(unittest.TestCase):
    def test_five_stock_models_convert_with_colours_and_kicad_bounds(self) -> None:
        self.assertEqual(len(EVIDENCE["models"]), 5)
        self.assertEqual([m["label"] for m in EVIDENCE["models"] if "multi" in m["label"]],
                         ["multi-colour RJ45", "large multi-body FMC"])
        for sample in EVIDENCE["models"]:
            path = MODELS / sample["model"]
            with self.subTest(model=sample["label"]):
                if not path.is_file():
                    self.skipTest(f"KiCad stock model not installed: {sample['model']}")
                converted = models.convert(path.read_bytes())
                self.assertEqual(converted["glb"][:4], b"glTF")
                self.assertGreaterEqual(len(_colours(converted["glb"])), 2, "the model keeps its colours")
                size = [hi - lo for hi, lo in zip(converted["bounds"]["maxMm"], converted["bounds"]["minMm"])]
                kx, ky_up, kz = sample["kicadExtentsMm"]  # glTF is y-up
                for got, want in zip(size, (kx, kz, ky_up)):
                    self.assertLessEqual(abs(got - want), 0.05, (size, sample["kicadExtentsMm"]))

    def test_the_cache_key_follows_the_step_and_the_converter(self) -> None:
        self.assertEqual(models.glb_key("a" * 64, "geometer-1"), models.glb_key("a" * 64, "geometer-1"))
        self.assertNotEqual(models.glb_key("a" * 64, "geometer-1"), models.glb_key("a" * 64, "geometer-2"))
        self.assertNotEqual(models.glb_key("a" * 64, "geometer-1"), models.glb_key("b" * 64, "geometer-1"))
        self.assertTrue(models.converter_id().startswith("geometer-"))


class AlignmentMathTest(unittest.TestCase):
    def apply(self, alignment: dict, point: tuple[float, float, float]) -> list[float]:
        m = models.alignment_matrix(models.normalized_alignment(alignment))
        return [round(m[i] * point[0] + m[4 + i] * point[1] + m[8 + i] * point[2] + m[12 + i], 9) + 0.0 for i in range(3)]

    def test_rotation_order_offset_and_scale(self) -> None:
        self.assertEqual(self.apply({"offsetMm": [0, 0, 0], "rotationDeg": [0, 0, 90]}, (1, 0, 0)), [0.0, 1.0, 0.0])
        self.assertEqual(self.apply({"offsetMm": [0, 0, 0], "rotationDeg": [90, 0, 0]}, (0, 1, 0)), [0.0, 0.0, 1.0])
        # x first, then z: (0, 1, 0) → (0, 0, 1) → (0, 0, 1)
        self.assertEqual(self.apply({"offsetMm": [0, 0, 0], "rotationDeg": [90, 0, 90]}, (0, 1, 0)), [0.0, 0.0, 1.0])
        self.assertEqual(self.apply({"offsetMm": [1, 2, 3], "rotationDeg": [0, 0, 0], "scale": 2}, (1, 1, 1)), [3.0, 4.0, 5.0])

    def test_invalid_alignments_are_refused(self) -> None:
        for bad in ({"offsetMm": [0, 0], "rotationDeg": [0, 0, 0]}, {"offsetMm": [0, 0, math.nan], "rotationDeg": [0, 0, 0]},
                    {"offsetMm": [0, 0, 0], "rotationDeg": [0, 0, 0], "scale": 0}):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                models.normalized_alignment(bad)


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for catalog model tests")
@unittest.skipUnless(HEADER.is_file() and SOCKET.is_file(), "KiCad stock models are required")
class CatalogModelsTest(unittest.TestCase):
    def setUp(self) -> None:
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

        self.tempdir = tempfile.TemporaryDirectory()
        self.service = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components", database_url=POSTGRES_URL,
        )
        self.service.initialize()
        self.created: list[str] = []

    def tearDown(self) -> None:
        for component_id in self.created:
            self.service.deactivate_component(component_id, actor="test@local", reason="SB2-17 test cleanup")
        self.service.close()
        self.tempdir.cleanup()

    def part_with_model(self, step: Path) -> tuple[str, str]:
        created = self.service.create_manual_component(
            value="conn", description="connector", datasheet="https://example.com/c.pdf", manufacturer="Test",
            manufacturer_part_number=f"MD-{uuid.uuid4().hex[:8]}", actor="author@example.com",
        )
        component_id = str(created["id"])
        self.created.append(component_id)
        self.service.attach_auxiliary_asset(component_id, asset_type="3dmodel", upload_name=step.name,
                                            payload=step.read_bytes(), target_library="Test", actor="author@example.com")
        [model] = self.service.part_relations.list_models(component_id)
        asset_id = model["assetId"]
        return component_id, asset_id

    def test_convert_once_align_and_preview_a_mated_pair(self) -> None:
        header, header_model = self.part_with_model(HEADER)
        socket, _socket_model = self.part_with_model(SOCKET)
        [before] = self.service.part_relations.list_models(header)
        self.assertIsNone(before["glb"])
        [converted] = self.service.part_relations.convert_models(header)
        glb = converted["glb"]
        self.assertEqual(glb["bounds"], {"minMm": [-1.27, -8.89, -3.0], "maxMm": [1.27, 1.27, 8.54]})
        self.assertTrue(self.service.part_relations.model_glb_path(glb["key"]).read_bytes().startswith(b"glTF"))
        self.assertEqual(self.service.part_relations.convert_models(header)[0]["glb"], glb, "an unchanged STEP is not converted again")

        aligned = self.service.part_relations.set_model_alignment(header, header_model, {
            "offsetMm": [0, 3.81, -8.54], "rotationDeg": [0, 0, 0], "scale": 1}, actor="author@example.com")
        self.assertEqual(aligned[0]["alignment"]["offsetMm"], [0.0, 3.81, -8.54])
        events = [e for e in self.service.list_component_audit_events(header)
                  if str(e.get("event_type") or e.get("eventType")) == "component.model_aligned"]
        self.assertEqual(len(events), 1)
        with self.assertRaises(ValueError):
            self.service.part_relations.set_model_alignment(header, header_model, {"offsetMm": [0, 0, 0], "rotationDeg": [0, 0, 0], "scale": -1})
        with self.assertRaises(LookupError):
            self.service.part_relations.set_model_alignment(header, "not-a-model", models.IDENTITY)

        alone = self.service.part_relations.model_preview(header, header_model, view="front", alignment=None, partner_id=None)
        mated = self.service.part_relations.model_preview(header, header_model, view="side", alignment=None, partner_id=socket)
        self.assertTrue(alone.lstrip().startswith("<?xml") and "<svg" in alone)
        self.assertGreater(len(mated), len(alone), "the partner is drawn too")
