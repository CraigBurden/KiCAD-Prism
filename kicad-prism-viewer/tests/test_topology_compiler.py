from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from pipeline.topology_compiler import compile_topology
from pipeline.topology_compiler.native_clipper import (
    DECIMAL_PRECISION,
    PROTOCOL_VERSION,
    A2_PROTOCOL_VERSION,
    A2_RESPONSE_MAGIC,
    A2_RESPONSE_SCHEMA,
    COORDINATE_SCALE_NM_PER_MM,
    RESPONSE_MAGIC,
    RESPONSE_SCHEMA,
    NativeClipperError,
    _Writer,
    _tiles_for_bounds,
    build_clip_jobs,
    build_native_clip_response,
    decode_batch_a2_response,
    decode_batch_response,
    encode_batch_a2_request,
    encode_batch_request,
    validate_preclipped_response,
)
from pipeline.topology_compiler.prism_clipper2 import (
    PrismClipper2Error,
    PrismClipper2Library,
    prism_clipper2_library_info,
    resolve_prism_clipper2_library_path,
)
from pipeline.topology_compiler.pcb_extract import _board_bbox, _declared_layers, _stackup_metadata_from_pcb_file
from pipeline.topology_compiler.pcb_extract import extract_pcb_metadata_light
from pipeline.topology_compiler.kicad_cli_export import (
    BOARD_CONTEXT_CACHE_VERSION,
    _board_context_export_args,
    _component_nodes,
)
from pipeline.topology_compiler.semantic_gltf import (
    SemanticGltfBuilder,
    _native_backend_for_semantic_mode,
    _semantic_clipper_backend,
)
from pipeline.topology_compiler.__main__ import _remove_stale_schematic_native, write_artifact_manifest


class TopologyCompilerTests(unittest.TestCase):
    def test_semantic_clipper_defaults_to_auto(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(_semantic_clipper_backend(), "auto")

    def test_auto_clipper_uses_native_when_available_and_js_otherwise(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with patch(
                "pipeline.topology_compiler.semantic_gltf.prism_clipper2_library_info",
                return_value={"a2Support": True},
            ):
                self.assertEqual(_native_backend_for_semantic_mode("auto"), "clipper2")
            with patch(
                "pipeline.topology_compiler.semantic_gltf.prism_clipper2_library_info",
                return_value={"a2Support": False},
            ):
                self.assertEqual(_native_backend_for_semantic_mode("auto"), "js")

    def sample_design(self) -> dict:
        return {
            "schema": "kicad_monkey.design.a0",
            "project": {"filename": "unit.kicad_pro"},
            "components": [
                {"designator": "U1", "value": "MCU", "footprint": "QFN"},
                {"designator": "J1", "value": "USB", "footprint": "USB-C"},
            ],
            "nets": [
                {
                    "uid": "net_vbus",
                    "name": "VBUS",
                    "terminals": [
                        {"designator": "U1", "pin": "1", "svg_id": "u1_pin_1"},
                        {"designator": "J1", "pin": "A4", "svg_id": "j1_pin_a4"},
                    ],
                    "graphical": {"wires": ["wire_vbus"], "pins": ["u1_pin_1", "j1_pin_a4"]},
                }
            ],
        }

    def semantic_topology(self) -> dict:
        topology = compile_topology(self.sample_design())
        topology["board"] = {"thickness_mm": 1.6}
        topology["layers"] = [
            {"name": "Board", "role": "dielectric", "z_mm": 0.0, "thickness_mm": 1.6},
            {"name": "F.Cu", "role": "copper", "z_mm": 0.8, "thickness_mm": 0.035},
            {"name": "In1.Cu", "role": "copper", "z_mm": 0.2, "thickness_mm": 0.035},
            {"name": "B.Cu", "role": "copper", "z_mm": -0.8, "thickness_mm": 0.035},
        ]
        return topology

    def test_compile_topology_contract(self) -> None:
        topology = compile_topology(self.sample_design())
        self.assertEqual(topology["schema"], "prism.topology_model_a0")
        self.assertEqual(len(topology["components"]), 2)
        self.assertEqual(len(topology["nets"]), 1)
        self.assertEqual(len(topology["terminals"]), 2)
        self.assertEqual(topology["indexes"]["net_name_to_net"]["VBUS"], "net_vbus")

    def test_physical_stackup_keeps_paste_and_real_dielectric(self) -> None:
        class ItemType:
            def __init__(self, value: str) -> None:
                self.value = value

        def layer(
            name: str,
            role: str,
            thickness: float,
            type_name: str = "",
            epsilon_r: float | None = None,
            loss_tangent: float | None = None,
        ) -> SimpleNamespace:
            return SimpleNamespace(
                name=name,
                type_name=type_name,
                thickness=thickness,
                material="FR4" if role == "dielectric" else "",
                color="",
                epsilon_r=epsilon_r,
                loss_tangent=loss_tangent,
                get_item_type=lambda: ItemType(role),
            )

        pcb = SimpleNamespace(
            thickness=1.6,
            stackup=SimpleNamespace(
                layers=[
                    layer("F.SilkS", "silkscreen", 0.0, "Top Silk Screen"),
                    layer("F.Paste", "solderpaste", 0.0, "Top Solder Paste"),
                    layer("F.Mask", "soldermask", 0.01, "Top Solder Mask"),
                    layer("F.Cu", "copper", 0.035, "copper"),
                    layer("dielectric 1", "dielectric", 1.51, "core", 4.2, 0.018),
                    layer("B.Cu", "copper", 0.035, "copper"),
                    layer("B.Mask", "soldermask", 0.01, "Bottom Solder Mask"),
                    layer("B.Paste", "solderpaste", 0.0, "Bottom Solder Paste"),
                    layer("B.SilkS", "silkscreen", 0.0, "Bottom Silk Screen"),
                ]
            ),
        )
        extracted = _declared_layers(pcb)
        self.assertEqual([item["name"] for item in extracted], [
            "F.SilkS",
            "F.Paste",
            "F.Mask",
            "F.Cu",
            "dielectric 1",
            "B.Cu",
            "B.Mask",
            "B.Paste",
            "B.SilkS",
        ])
        self.assertEqual(extracted[1]["role"], "paste")
        self.assertEqual(extracted[7]["role"], "paste")
        self.assertEqual([item["stack_index"] for item in extracted], list(range(9)))
        self.assertEqual(extracted[3]["color"], "#df342b")
        self.assertEqual(extracted[5]["color"], "#245fd3")
        self.assertEqual(extracted[4]["epsilon_r"], 4.2)
        self.assertEqual(extracted[4]["loss_tangent"], 0.018)

        topology = compile_topology(
            self.sample_design(),
            pcb_metadata={
                "board": {
                    "bbox_mm": [0, 0, 10, 10],
                    "thickness_mm": 1.6,
                    "stackup": {
                        "present": True,
                        "layers": extracted,
                        "copper_finish": "ENIG",
                        "edge_connector": True,
                        "castellated_pads": True,
                        "edge_plating": False,
                    },
                }
            },
        )
        self.assertNotIn("Board", [item["name"] for item in topology["layers"]])
        dielectric = next(item for item in topology["layers"] if item["name"] == "dielectric 1")
        self.assertEqual(dielectric["epsilon_r"], 4.2)
        self.assertEqual(dielectric["loss_tangent"], 0.018)
        self.assertEqual(topology["board"]["stackup"]["copper_finish"], "ENIG")
        self.assertTrue(topology["board"]["stackup"]["edge_connector"])
        self.assertTrue(topology["board"]["stackup"]["castellated_pads"])
        self.assertFalse(topology["board"]["stackup"]["edge_plating"])
        self.assertAlmostEqual(
            sum(item["thickness_mm"] for item in topology["layers"] if item["role"] in {"copper", "dielectric", "paste", "soldermask", "silkscreen"}),
            1.6,
        )

    def test_physical_stackup_falls_back_to_kicad_pcb_stackup_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pcb_file = Path(tmp) / "unit.kicad_pcb"
            pcb_file.write_text(
                """(kicad_pcb
                  (setup
                    (stackup
                      (layer "F.SilkS" (type "Top Silk Screen"))
                      (layer "F.Paste" (type "Top Solder Paste"))
                      (layer "F.Mask" (type "Top Solder Mask") (thickness 0.01))
                      (layer "F.Cu" (type "copper") (thickness 0.035))
                      (layer "dielectric 1" (type "core") (thickness 1.51) (material "FR4") (epsilon_r 4.1) (loss_tangent 0.017))
                      (layer "B.Cu" (type "copper") (thickness 0.035))
                      (layer "B.Mask" (type "Bottom Solder Mask") (thickness 0.01))
                      (layer "B.Paste" (type "Bottom Solder Paste"))
                      (layer "B.SilkS" (type "Bottom Silk Screen"))
                      (copper_finish "ENIG")
                      (edge_connector "bevelled")
                      (castellated_pads yes)
                      (edge_plating no)
                    )
                  )
                )""",
                encoding="utf-8",
            )
            pcb = SimpleNamespace(thickness=1.6, stackup=SimpleNamespace(layers=[]), layers=[])
            extracted = _declared_layers(pcb, pcb_file)
            stackup_metadata = _stackup_metadata_from_pcb_file(pcb_file)

        self.assertEqual([item["name"] for item in extracted], [
            "F.SilkS",
            "F.Paste",
            "F.Mask",
            "F.Cu",
            "dielectric 1",
            "B.Cu",
            "B.Mask",
            "B.Paste",
            "B.SilkS",
        ])
        self.assertEqual(extracted[1]["thickness_mm"], 0.0)
        self.assertEqual(extracted[7]["thickness_mm"], 0.0)
        self.assertEqual([item["stack_index"] for item in extracted], list(range(9)))
        self.assertEqual(extracted[3]["color"], "#df342b")
        self.assertEqual(extracted[5]["color"], "#245fd3")
        self.assertEqual(extracted[4]["epsilon_r"], 4.1)
        self.assertEqual(extracted[4]["loss_tangent"], 0.017)
        self.assertEqual(stackup_metadata["copper_finish"], "ENIG")
        self.assertTrue(stackup_metadata["edge_connector"])
        self.assertTrue(stackup_metadata["castellated_pads"])
        self.assertFalse(stackup_metadata["edge_plating"])
        self.assertAlmostEqual(sum(item["thickness_mm"] for item in extracted), 1.6)

    def test_stackup_metadata_defaults_without_stackup_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pcb_file = Path(tmp) / "unit.kicad_pcb"
            pcb_file.write_text(
                """(kicad_pcb
                  (setup
                    (pad_to_mask_clearance 0)
                  )
                )""",
                encoding="utf-8",
            )
            stackup_metadata = _stackup_metadata_from_pcb_file(pcb_file)

        self.assertEqual(stackup_metadata["copper_finish"], "None")
        self.assertFalse(stackup_metadata["edge_connector"])
        self.assertFalse(stackup_metadata["castellated_pads"])
        self.assertFalse(stackup_metadata["edge_plating"])

    def test_layer_list_fallback_keeps_total_thickness_without_stackup(self) -> None:
        def layer(name: str) -> SimpleNamespace:
            return SimpleNamespace(canonical_name=name, layer_type=SimpleNamespace(value=""))

        pcb = SimpleNamespace(
            thickness=1.6,
            stackup=SimpleNamespace(layers=[]),
            layers=[
                layer("F.SilkS"),
                layer("F.Paste"),
                layer("F.Mask"),
                layer("F.Cu"),
                layer("B.Cu"),
                layer("B.Mask"),
                layer("B.Paste"),
                layer("B.SilkS"),
            ],
        )
        extracted = _declared_layers(pcb)
        self.assertEqual([item["name"] for item in extracted], [
            "F.SilkS",
            "F.Paste",
            "F.Mask",
            "F.Cu",
            "Board",
            "B.Cu",
            "B.Mask",
            "B.Paste",
            "B.SilkS",
        ])
        self.assertEqual([item["stack_index"] for item in extracted], list(range(9)))
        by_name = {item["name"]: item for item in extracted}
        self.assertEqual(by_name["F.Cu"]["color"], "#df342b")
        self.assertEqual(by_name["B.Cu"]["color"], "#245fd3")
        self.assertEqual(by_name["F.Paste"]["thickness_mm"], 0.0)
        self.assertEqual(by_name["F.SilkS"]["thickness_mm"], 0.0)
        self.assertAlmostEqual(by_name["Board"]["thickness_mm"], 1.51)
        self.assertAlmostEqual(sum(item["thickness_mm"] for item in extracted), 1.6)
        topology = compile_topology(
            self.sample_design(),
            pcb_metadata={
                "board": {
                    "bbox_mm": [0, 0, 10, 10],
                    "thickness_mm": 1.6,
                    "stackup": {"present": True, "layers": extracted},
                }
            },
        )
        self.assertEqual([item["name"] for item in sorted(topology["layers"], key=lambda item: item["stack_index"])], [
            "F.SilkS",
            "F.Paste",
            "F.Mask",
            "F.Cu",
            "Board",
            "B.Cu",
            "B.Mask",
            "B.Paste",
            "B.SilkS",
        ])
        by_topology_name = {item["name"]: item for item in topology["layers"]}
        self.assertAlmostEqual(by_topology_name["F.Cu"]["z_mm"], 0.8175)
        self.assertAlmostEqual(by_topology_name["B.Cu"]["z_mm"], -0.8175)

    def test_board_bbox_accepts_outline_items_without_get_bounds(self) -> None:
        rect = SimpleNamespace(
            get_corners=lambda: [
                (108.575, 95.575),
                (146.625, 95.575),
                (146.625, 125.525),
                (108.575, 125.525),
            ]
        )
        pcb = SimpleNamespace(top_level_outline_items=lambda layer_name: [rect])
        self.assertEqual(_board_bbox(pcb), [108.575, 95.575, 146.625, 125.525])

    def test_light_pcb_metadata_uses_pad_bboxes_without_contours(self) -> None:
        class Bounds:
            def __init__(self, min_x: float, min_y: float, max_x: float, max_y: float) -> None:
                self.min_x = min_x
                self.min_y = min_y
                self.max_x = max_x
                self.max_y = max_y

            def is_valid(self) -> bool:
                return True

        pad = SimpleNamespace(
            number="1",
            layers=["F.Cu"],
            net=SimpleNamespace(name="VBUS"),
            uuid="pad-1",
            drill=0.3,
            drill_width=0.3,
            drill_height=0.3,
            plated=True,
            get_bounds=lambda: Bounds(-0.5, -0.5, 0.5, 0.5),
        )
        footprint = SimpleNamespace(
            pads=[pad],
            uuid="fp-1",
            at_x=10.0,
            at_y=20.0,
            at_angle=0.0,
            layer="F.Cu",
            get_property_value=lambda name, default="": "U1" if name == "Reference" else default,
            get_bounds=lambda: Bounds(9.0, 19.0, 11.0, 21.0),
        )
        pcb = SimpleNamespace(
            thickness=1.6,
            stackup=SimpleNamespace(layers=[]),
            layers=[],
            footprints=[footprint],
            segments=[],
            vias=[],
            zones=[],
            top_level_outline_items=lambda layer_name: [],
            get_bounds=lambda: Bounds(0, 0, 25, 25),
        )
        with patch("pipeline.topology_compiler.pcb_extract._pad_contours", side_effect=AssertionError("contours")):
            metadata = extract_pcb_metadata_light(pcb, Path("unit.kicad_pro"))
        self.assertEqual(metadata["mode"], "light")
        self.assertEqual(metadata["physical_objects"], [])
        self.assertEqual(metadata["terminal_pad_links"][0]["object_uid"], metadata["pads"][0]["uid"])
        self.assertEqual(metadata["components"][0]["designator"], "U1")

    def test_artifact_manifest_is_deterministic_and_removes_stale_native(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "schematic-vector").mkdir()
            (root / "schematic-vector" / "stale.json").write_text("{}", encoding="utf-8")
            _remove_stale_schematic_native(root)
            self.assertFalse((root / "schematic-vector").exists())
            (root / "topology.json").write_text("{}", encoding="utf-8")
            (root / "viewer.html").write_text("<html></html>", encoding="utf-8")
            (root / "schematic-world").mkdir()
            (root / "schematic-world" / "schematic.manifest.json").write_text("{}", encoding="utf-8")
            first = write_artifact_manifest(root)
            second = write_artifact_manifest(root)
            self.assertEqual(first, second)
            self.assertEqual(first["schema"], "prism.artifact_manifest_a0")
            total = sum(item["bytes"] for item in first["files"])
            self.assertEqual(first["totalBytes"], total)
            self.assertEqual(first["totalsByFamily"]["schematic_vector"]["files"], 0)
            self.assertEqual(first["totalsByFamily"]["schematic_world"]["files"], 1)

    def test_component_nodes_preserve_designator(self) -> None:
        gltf = {
            "asset": {"version": "2.0"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"children": [1]}, {"name": "U1", "children": [2]}, {"mesh": 0}],
            "meshes": [{"name": "Body", "primitives": []}],
        }
        payload = json.dumps(gltf).encode("utf-8")
        payload += b" " * ((4 - len(payload) % 4) % 4)
        total = 12 + 8 + len(payload)
        glb = b"glTF" + (2).to_bytes(4, "little") + total.to_bytes(4, "little")
        glb += len(payload).to_bytes(4, "little") + b"JSON" + payload
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "components.glb"
            path.write_bytes(glb)
            components = _component_nodes(path)
        self.assertEqual(components, [{"designator": "U1", "node_index": 1, "mesh_names": ["Body"]}])

    def test_board_context_export_excludes_duplicate_pad_geometry(self) -> None:
        args = _board_context_export_args(Path("geometry"), Path("unit.kicad_pcb"))
        self.assertIn("--include-soldermask", args)
        self.assertIn("--include-silkscreen", args)
        self.assertIn("--no-components", args)
        self.assertNotIn("--include-pads", args)
        self.assertIn("no-pads", BOARD_CONTEXT_CACHE_VERSION)

    def test_via_caps_and_barrel_share_one_source_feature(self) -> None:
        builder = SemanticGltfBuilder(self.semantic_topology())
        builder.add_pcb_ir(
            {
                "records": [
                    {
                        "uuid": "via-1",
                        "kind": "via",
                        "net_name": "VBUS",
                        "layers": ["F.Cu", "B.Cu"],
                        "drill": 0.3,
                        "operations": [
                            {
                                "kind": "FlashPadCircle",
                                "x": 10_000_000,
                                "y": 20_000_000,
                                "diameter_nm": 600_000,
                            }
                        ],
                    }
                ]
            }
        )
        via_objects = [item for item in builder.objects if item["kindId"] == 5]
        self.assertEqual(len(via_objects), 3)
        self.assertEqual(len({item["objectFeatureId"] for item in via_objects}), 1)
        barrel = builder.barrels[0]
        self.assertEqual(barrel["layerIds"], [2, 3, 4])
        self.assertEqual(barrel["startLayerId"], 2)
        self.assertEqual(barrel["endLayerId"], 4)
        self.assertEqual(barrel["netId"], 1)
        self.assertGreater(barrel["startZMm"], barrel["endZMm"])
        self.assertGreater(barrel["outerWidthMm"], barrel["drillWidthMm"])

    def test_plated_pad_barrel_uses_pad_feature_and_layer_mask(self) -> None:
        builder = SemanticGltfBuilder(self.semantic_topology())
        builder.add_pcb_ir(
            {
                "records": [
                    {
                        "kind": "footprint",
                        "placement": {"x_nm": 0, "y_nm": 0, "angle_deg": 0},
                        "operations": [
                            {
                                "kind": "StartBlock",
                                "data_ref": "pad",
                                "data_uuid": "pad-1",
                                "extra_attrs": {"net": "VBUS"},
                            },
                            {
                                "kind": "FlashPadCircle",
                                "x": 5_000_000,
                                "y": 6_000_000,
                                "diameter_nm": 900_000,
                                "layers": ["*.Cu"],
                            },
                            {"kind": "EndBlock"},
                        ],
                    }
                ]
            },
            pad_holes={
                "pad-1": {
                    "drill_mm": 0.4,
                    "drill_width_mm": 0.4,
                    "drill_height_mm": 0.4,
                    "plated": True,
                }
            },
        )
        barrel = builder.barrels[0]
        feature_id = barrel["objectFeatureId"]
        self.assertTrue(all(item["objectFeatureId"] == feature_id for item in builder.objects))
        self.assertEqual(barrel["layerMask"], 0b111)
        self.assertEqual(barrel["kind"], "plated_pad")

    def test_build_input_contains_coordinate_bounds_and_component_features(self) -> None:
        builder = SemanticGltfBuilder(self.semantic_topology())
        builder.add_component_nodes([{"designator": "U1", "node_index": 4, "mesh_names": ["Body"]}])
        builder.add_pcb_ir(
            {
                "records": [
                    {
                        "uuid": "track-1",
                        "kind": "segment",
                        "layer": "F.Cu",
                        "net_name": "VBUS",
                        "operations": [
                            {
                                "kind": "ThickSegment",
                                "start_x": 0,
                                "start_y": 0,
                                "end_x": 10_000_000,
                                "end_y": 0,
                                "width_nm": 250_000,
                            }
                        ],
                    }
                ]
            }
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "input.json"
            payload = builder.write_input(path)
        self.assertEqual(payload["schema"], "prism.semantic_gltf_build_a0")
        self.assertEqual(payload["coordinateSystem"]["runtime"]["gltfToRuntime"], ["x", "-z", "y"])
        self.assertIsNotNone(payload["nets"][1]["boundsMm"])
        self.assertEqual(payload["components"][0]["nodeIndex"], 4)
        self.assertGreater(payload["components"][0]["featureId"], 0)

    def native_fixture_input(self) -> dict:
        return {
            "schema": "prism.semantic_gltf_build_a0",
            "geometryRevision": "compiled-fixture",
            "sourceGeometryRevision": "source-fixture",
            "tileSizeMm": 20,
            "coordinateSystem": {"source": {"units": "millimetres"}},
            "objects": [
                {
                    "layerId": 1,
                    "layerName": "F.Cu",
                    "zMm": 0,
                    "thicknessMm": 0.035,
                    "netId": 2,
                    "objectFeatureId": 3,
                    "polygons": [
                        {
                            "sourcePolygonRecordId": "poly-1",
                            "sourceOrder": 7,
                            "outer": [[0, 0], [25, 0], [25, 5], [0, 5]],
                            "holes": [],
                        }
                    ],
                }
            ],
        }

    def native_response_bytes(self, jobs, digest: str = "digest", omit_last: bool = False) -> bytes:
        writer = _Writer()
        writer.raw(RESPONSE_MAGIC)
        writer.u32(PROTOCOL_VERSION)
        writer.string(RESPONSE_SCHEMA)
        writer.string(digest)
        writer.string("source-fixture")
        writer.u32(DECIMAL_PRECISION)
        writer.f64(20)
        writer.string("test-native")
        writer.u32(20260708)
        for _ in range(5):
            writer.f64(0)
        encoded_jobs = jobs[:-1] if omit_last else jobs
        writer.u32(len(encoded_jobs))
        writer.u32(0)
        for job in encoded_jobs:
            writer.string(job.job_id)
            writer.string(job.source_polygon_record_id)
            writer.u32(job.source_order)
            writer.i32(job.tile_x)
            writer.i32(job.tile_y)
            writer.u32(0)
            writer.string("")
            writer.string("")
            writer.u32(1)
            writer.ring(job.clip)
            writer.u32(0)
        return bytes(writer.data)

    def native_a2_response_bytes(self, jobs, digest: str = "digest", omit_last: bool = False) -> bytes:
        writer = _Writer()
        writer.raw(A2_RESPONSE_MAGIC)
        writer.u32(A2_PROTOCOL_VERSION)
        writer.string(A2_RESPONSE_SCHEMA)
        writer.string(digest)
        writer.string("source-fixture")
        writer.u32(COORDINATE_SCALE_NM_PER_MM)
        writer.i64(20 * COORDINATE_SCALE_NM_PER_MM)
        writer.string("test-native")
        writer.u32(20260708)
        writer.f64(0)
        writer.f64(0)
        writer.u32(1)
        writer.u32(len(jobs))
        writer.i64(4)
        writer.f64(0)
        writer.f64(0)
        writer.f64(0)
        writer.i64(128)
        writer.i64(256)
        encoded_jobs = jobs[:-1] if omit_last else jobs
        writer.u32(len(encoded_jobs))
        writer.u32(0)
        for job in encoded_jobs:
            writer.string(job.job_id)
            writer.string(job.source_polygon_record_id)
            writer.i32(job.tile_x)
            writer.i32(job.tile_y)
            writer.u32(0)
            writer.string("")
            writer.string("")
            writer.u32(1)
            writer.ring_i64_nm(job.clip)
            writer.u32(0)
        return bytes(writer.data)

    def test_prism_clipper2_info_reports_packaged_library(self) -> None:
        info = prism_clipper2_library_info()
        if resolve_prism_clipper2_library_path() is None:
            self.skipTest("packaged Prism Clipper2 library is not built")
        self.assertEqual(info["backend"], "clipper2")
        self.assertTrue(info["a2Support"])
        self.assertEqual(info["batchSymbol"], "prism_clipper2_batch_a2_bytes")
        self.assertEqual(info["protocolVersion"], 2)
        self.assertEqual(info["manifestMatch"], True)
        self.assertRegex(info["librarySha256"], r"^[0-9a-f]{64}$")

    def test_prism_clipper2_rejects_missing_library(self) -> None:
        missing = Path(tempfile.gettempdir()) / "missing-libprism_clipper2.dylib"
        with self.assertRaisesRegex(PrismClipper2Error, "does not exist"):
            PrismClipper2Library(missing)

    def test_prism_clipper2_rejects_missing_symbol(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            fake_library = Path(tmp) / "libprism_clipper2.dylib"
            fake_library.write_bytes(b"not a real dynamic library")
            with patch("pipeline.topology_compiler.prism_clipper2.ctypes.CDLL", return_value=SimpleNamespace()):
                with self.assertRaisesRegex(PrismClipper2Error, "missing required C ABI symbol"):
                    PrismClipper2Library(fake_library)

    def test_prism_clipper2_rejects_packaged_manifest_sha_mismatch(self) -> None:
        packaged = resolve_prism_clipper2_library_path()
        if packaged is None:
            self.skipTest("packaged Prism Clipper2 library is not built")
        manifest = {
            "schema": "prism.clipper2_bundle_a0",
            "version": "0.1.0",
            "abi": 20260708,
            "protocols": ["a2"],
            "libraries": {
                packaged.parent.name: {
                    "path": str(packaged.relative_to(packaged.parents[1])),
                    "sha256": "0" * 64,
                }
            },
        }
        with patch("pipeline.topology_compiler.prism_clipper2._manifest_library_info", return_value=manifest):
            info = prism_clipper2_library_info(packaged)
        self.assertFalse(info["a2Support"])
        self.assertIn("SHA-256 does not match manifest", info["error"])

    def test_clip_job_tile_enumeration_matches_bounds_helper(self) -> None:
        payload = self.native_fixture_input()
        jobs, direct, stats = build_clip_jobs(payload, tile_size=20)
        expected_tiles: set[tuple[int, int]] = set()
        for obj in payload["objects"]:
            for polygon in obj["polygons"]:
                outer = polygon["outer"]
                holes = polygon.get("holes", [])
                points = [point for ring in [outer, *holes] for point in ring]
                bounds = (
                    min(point[0] for point in points),
                    min(point[1] for point in points),
                    max(point[0] for point in points),
                    max(point[1] for point in points),
                )
                expected_tiles.update(tuple(tile) for tile in _tiles_for_bounds(bounds, 20))
        actual_tiles = {(job.tile_x, job.tile_y) for job in jobs}
        actual_tiles.update(tuple(entry["tile"]) for entry in direct)
        self.assertEqual(actual_tiles, expected_tiles)
        self.assertIn("source_bounds_ms", stats)
        self.assertIn("tile_job_generation_ms", stats)

    def test_native_response_valid_fixture_is_accepted(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        _request, digest = encode_batch_request(payload, jobs, tile_size=20)
        decoded = decode_batch_response(
            self.native_response_bytes(jobs, digest),
            expected_jobs=jobs,
            expected_request_digest=digest,
            expected_geometry_revision="source-fixture",
            expected_tile_size=20,
        )
        self.assertEqual(decoded["schema"], RESPONSE_SCHEMA)
        self.assertEqual(len(decoded["results"]), 2)

    def test_native_a2_request_is_factorized_and_response_is_accepted(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        request, digest, request_stats = encode_batch_a2_request(payload, jobs, tile_size=20)
        self.assertIn(b"prism.clipper2_batch_request_a2", request)
        self.assertEqual(request_stats["subject_count"], 1)
        self.assertEqual(request_stats["job_count"], len(jobs))
        self.assertLess(
            request_stats["unique_subject_vertices"],
            request_stats["a1_equivalent_repeated_vertices"],
        )
        decoded = decode_batch_a2_response(
            self.native_a2_response_bytes(jobs, digest),
            expected_jobs=jobs,
            expected_request_digest=digest,
            expected_geometry_revision="source-fixture",
            expected_tile_size=20,
        )
        self.assertEqual(decoded["schema"], A2_RESPONSE_SCHEMA)
        self.assertEqual(decoded["timings"]["subject_count"], 1)
        self.assertEqual(len(decoded["results"]), len(jobs))

    def test_prism_clipper2_native_a2_response_is_accepted(self) -> None:
        if resolve_prism_clipper2_library_path() is None:
            self.skipTest("packaged Prism Clipper2 library is not built")
        payload = self.native_fixture_input()
        response, timings = build_native_clip_response(
            payload,
            library=PrismClipper2Library(),
            protocol="a2",
        )
        self.assertEqual(response["clipper"]["backend"], "clipper2")
        self.assertEqual(response["clipper"]["batchSymbol"], "prism_clipper2_batch_a2_bytes")
        self.assertEqual(response["native"]["batchSymbol"], "prism_clipper2_batch_a2_bytes")
        self.assertEqual(response["stats"]["native_boolean_jobs"], 2)
        self.assertEqual(len(response["clippedTiles"]), 2)
        self.assertGreaterEqual(response["stats"]["clipped_regions"], 1)
        self.assertIn("native_batch_call_ms", timings)
        validate_preclipped_response(
            payload,
            response,
            expected_jobs=build_clip_jobs(payload, tile_size=20, include_direct_entries=False, include_clip_rings=False, clean_geometry=False)[0],
        )

    def test_native_response_rejects_wrong_request_digest(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        _request, digest = encode_batch_request(payload, jobs, tile_size=20)
        with self.assertRaisesRegex(NativeClipperError, "request digest"):
            decode_batch_response(
                self.native_response_bytes(jobs, "wrong"),
                expected_jobs=jobs,
                expected_request_digest=digest,
                expected_geometry_revision="source-fixture",
                expected_tile_size=20,
            )

    def test_native_response_rejects_incomplete_job_accounting(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        _request, digest = encode_batch_request(payload, jobs, tile_size=20)
        with self.assertRaisesRegex(NativeClipperError, "omitted job"):
            decode_batch_response(
                self.native_response_bytes(jobs, digest, omit_last=True),
                expected_jobs=jobs,
                expected_request_digest=digest,
                expected_geometry_revision="source-fixture",
                expected_tile_size=20,
            )

    def test_native_response_rejects_malformed_bytes(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        with self.assertRaisesRegex(NativeClipperError, "invalid magic"):
            decode_batch_response(
                b"not-a-native-response",
                expected_jobs=jobs,
                expected_request_digest="digest",
                expected_geometry_revision="source-fixture",
                expected_tile_size=20,
            )

    def test_native_preclip_rejects_direct_entries(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        response = {
            "schema": RESPONSE_SCHEMA,
            "protocolVersion": PROTOCOL_VERSION,
            "sourceGeometryRevision": "source-fixture",
            "tileSizeMm": 20,
            "coordinateSystem": payload["coordinateSystem"],
            "precisionDecimalPlaces": DECIMAL_PRECISION,
            "clippedTiles": [
                {
                    "jobId": "direct:poly-1:0:0",
                    "sourcePolygonRecordId": "poly-1",
                    "sourceOrder": 7,
                    "tile": [0, 0],
                    "regions": [{"outer": [[0, 0], [1, 0], [1, 1], [0, 1]], "holes": []}],
                }
            ],
        }
        with self.assertRaisesRegex(NativeClipperError, "must not include direct"):
            validate_preclipped_response(payload, response, expected_jobs=jobs)

    def test_native_preclip_rejects_missing_a2_identity(self) -> None:
        payload = self.native_fixture_input()
        jobs, _direct, _stats = build_clip_jobs(payload, tile_size=20)
        response = {
            "schema": RESPONSE_SCHEMA,
            "protocolVersion": PROTOCOL_VERSION,
            "sourceGeometryRevision": "source-fixture",
            "tileSizeMm": 20,
            "coordinateSystem": payload["coordinateSystem"],
            "precisionDecimalPlaces": DECIMAL_PRECISION,
            "native": {"protocol": "a2", "version": "2026.7.8"},
            "clippedTiles": [],
        }
        with self.assertRaisesRegex(NativeClipperError, "missing identity"):
            validate_preclipped_response(payload, response, expected_jobs=jobs)


if __name__ == "__main__":
    unittest.main()
