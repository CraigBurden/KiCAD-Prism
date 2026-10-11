from __future__ import annotations

import json
import unittest

from pipeline.topology_compiler.compiler import _layers_from_pcb_metadata
from pipeline.topology_compiler.semantic_gltf import SemanticGltfBuilder
from pipeline.topology_compiler.soldermask import _mask_faces_mm
from pipeline.topology_compiler.stackup_frame import STACKUP_FRAME_GOLDEN, stackup_frame, stackup_role


def _golden() -> dict:
    return json.loads(STACKUP_FRAME_GOLDEN.read_text(encoding="utf-8"))


class StackupFrameTest(unittest.TestCase):
    """The Python lane against the golden the Rust lane's stackup_frame.rs also reads."""

    def test_frames_match_the_shared_golden(self) -> None:
        for case in _golden()["cases"]:
            with self.subTest(case["name"]):
                self.assertEqual(stackup_frame(case["stackup"]), case["frame"])

    def test_the_compiler_and_scene_writer_place_layers_in_the_golden_frame(self) -> None:
        for case in _golden()["cases"]:
            with self.subTest(case["name"]):
                metadata = {
                    "board": {
                        "thickness_mm": 1.6,
                        "stackup": {
                            "layers": [
                                {
                                    "name": layer["name"],
                                    "role": stackup_role(layer["name"], layer["type"]),
                                    "thickness_mm": layer["thicknessMm"],
                                    "stack_index": index,
                                }
                                for index, layer in enumerate(case["stackup"])
                            ]
                        },
                    }
                }
                layers = [
                    {"name": layer.name, "role": layer.role, "z_mm": layer.z_mm, "thickness_mm": layer.thickness_mm}
                    for layer in _layers_from_pcb_metadata(metadata)
                ]
                builder = SemanticGltfBuilder({"layers": layers, "board": {"thickness_mm": 1.6}})
                for layer, expected in zip(layers, case["frame"]):
                    # The compiler rounds centred z to 6 places before the shift.
                    self.assertAlmostEqual(layer["z_mm"], expected["zMm"], places=6)
                    self.assertAlmostEqual(builder._runtime_z_mm(layer["z_mm"]), expected["runtimeZMm"], places=6)
                faces = _mask_faces_mm({"layers": layers})
                by_name = {layer["name"]: layer for layer in case["frame"]}
                self.assertAlmostEqual(faces["top"], by_name["F.Mask"]["faceZMm"], places=6)
                self.assertAlmostEqual(faces["bottom"], by_name["B.Mask"]["faceZMm"], places=6)


if __name__ == "__main__":
    unittest.main()
