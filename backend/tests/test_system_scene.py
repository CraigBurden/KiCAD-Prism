"""SB2-22: the system scene descriptor and ``GET …/scene`` (CONTRACTS_P2 §20)."""

from __future__ import annotations

import json
import math
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from fastapi import FastAPI

from test_system_api import _request
from test_system_assemblies import AssemblyCase
from test_system_publish import ADMIN
from test_system_snapshots import DESIGNER, VIEWER

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import service as service_module
from app.services.systems import bundles
from app.services.systems.bundles import BundleSource, BundleUnreadable, mid_plane_from_layers
from app.services.systems.interface_extractor import EXTRACTOR_VERSION, _arc_points, extract_interface
from app.services.systems.placement import poses
from app.services.systems.scene import asset_id, board_bounds
from support.postgres import seed_folder

P2 = Path(__file__).resolve().parent / "fixtures" / "system_builder" / "p2" / "sources"


def _apply(matrix: list[float], point: list[float]) -> list[float]:
    return [sum(matrix[c * 4 + r] * v for c, v in enumerate([*point, 1.0])) for r in range(3)]


class PoseTest(unittest.TestCase):
    def test_matrix_is_column_major_translate_after_rotate(self) -> None:
        quarter = [0.0, 0.0, math.sin(math.pi / 4), math.cos(math.pi / 4)]  # +90° about z
        pose = {"translationMm": [10.0, 0.0, 0.0], "rotation": quarter}
        self.assertEqual(_apply(poses.matrix(pose), [1.0, 0.0, 0.0]), [10.0, 1.0, 0.0])
        self.assertEqual(poses.matrix(pose)[12:15], [10.0, 0.0, 0.0])

    def test_compose_applies_the_child_first(self) -> None:
        quarter = [0.0, 0.0, math.sin(math.pi / 4), math.cos(math.pi / 4)]
        parent = {"translationMm": [100.0, 0.0, 0.0], "rotation": quarter}
        child = {"translationMm": [5.0, 0.0, 0.0], "rotation": quarter}
        both = poses.compose(parent, child)
        self.assertEqual(both["translationMm"], [100.0, 5.0, 0.0])
        self.assertEqual(both["rotation"], [0.0, 0.0, 1.0, 0.0])  # 180° about z, w = 0 canonicalised
        point = [1.0, 2.0, 3.0]
        self.assertEqual([round(v, 9) for v in _apply(poses.matrix(both), point)],
                         [round(v, 9) for v in _apply(poses.matrix(parent), _apply(poses.matrix(child), point))])

    def test_transform_bounds_takes_all_eight_corners(self) -> None:
        quarter = [0.0, 0.0, math.sin(math.pi / 4), math.cos(math.pi / 4)]
        box = {"minMm": [0.0, 0.0, -1.0], "maxMm": [40.0, 10.0, 1.0]}
        moved = poses.transform_bounds({"translationMm": [0.0, 0.0, 5.0], "rotation": quarter}, box)
        self.assertEqual(moved, {"minMm": [-10.0, 0.0, 4.0], "maxMm": [0.0, 40.0, 6.0]})

    def test_default_row(self) -> None:
        """§14.3: a 50×40 board at KiCad (100..150, 100..140), then no bounds, then a 30×20 at the origin."""
        items = [("a", {"minMm": [100.0, -140.0, -0.8], "maxMm": [150.0, -100.0, 0.8]}), ("b", None),
                 ("c", {"minMm": [0.0, -20.0, -0.8], "maxMm": [30.0, 0.0, 0.8]})]
        row = poses.default_row(items)
        self.assertEqual({k: v["translationMm"] for k, v in row.items()},
                         {"a": [-100.0, 140.0, 0.0], "b": [70.0, 0.0, 0.0], "c": [90.0, 20.0, 0.0]})
        self.assertTrue(all(v["rotation"] == [0.0, 0.0, 0.0, 1.0] for v in row.values()))


class OutlineTest(unittest.TestCase):
    def test_v8_outline_is_the_edge_cuts_box_in_the_board_frame(self) -> None:
        payload = extract_interface(P2 / "mezz_base" / "F0" / "mezz_base.kicad_pro", project_id="p", commit=None)
        self.assertEqual(payload["extractor"]["version"], EXTRACTOR_VERSION)
        self.assertEqual(payload["boardOutlineMm"],
                         {"minMm": [100.0, -140.0], "maxMm": [150.0, -100.0], "source": "edge_cuts"},
                         "line centres of the 50 × 40 mm Edge.Cuts rectangle at (100, 100), y flipped")
        self.assertEqual(board_bounds(payload), {"minMm": [100.0, -140.0, -0.8], "maxMm": [150.0, -100.0, 0.8]})

    def test_arc_extents_include_the_axis_crossings(self) -> None:
        arc = SimpleNamespace(start_x=10.0, start_y=0.0, mid_x=0.0, mid_y=10.0, end_x=-10.0, end_y=0.0)
        points = _arc_points(arc)
        self.assertEqual((min(y for _, y in points), max(y for _, y in points)), (0.0, 10.0))
        wide = SimpleNamespace(start_x=10.0, start_y=0.0, mid_x=0.0, mid_y=-10.0, end_x=0.0, end_y=10.0)
        xs = [x for x, _ in _arc_points(wide)]
        ys = [y for _, y in _arc_points(wide)]
        self.assertEqual((round(min(xs), 9), round(min(ys), 9)), (-10.0, -10.0), "three quarters of a circle")


class BundleFrameTest(unittest.TestCase):
    def test_mid_plane_is_half_the_substrate_between_the_outer_copper(self) -> None:
        layers = [{"role": "copper", "z_mm": 0.8175, "thickness_mm": 0.035},
                  {"role": "copper", "z_mm": -0.8175, "thickness_mm": 0.035},
                  {"role": "dielectric", "z_mm": 0.0, "thickness_mm": 1.51}]
        self.assertAlmostEqual(mid_plane_from_layers(layers), 0.8)
        self.assertEqual(mid_plane_from_layers(layers[:1]), 0.0)


class BundleSourceTest(unittest.TestCase):
    def test_last_build_reads_the_latest_job(self) -> None:
        job = {"id": "job_9", "status": "failed", "error_message": "kicad-cli missing", "message": ""}
        with mock.patch("app.services.workspace_service.workspace.get_project_by_id", return_value={"id": "prj_1"}), \
                mock.patch("app.services.project_service.webgpu_artifact_key", return_value="key"), \
                mock.patch("app.services.systems.bundles.latest_job", return_value=job) as latest:
            last = BundleSource().last_build("prj_1", "a" * 40)
        latest.assert_called_once_with("webgpu_3d", "key")
        self.assertEqual(last, {"jobId": "job_9", "status": "failed", "error": "kicad-cli missing"})


    def test_a_bundle_whose_files_are_gone_is_unreadable_not_board_stage(self) -> None:
        # SB2-91: None means "board stage, wait"; files that are gone must not read the same.
        bundles._FRAMES.clear()
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("app.services.semantic_visualizer_service.bundle_dir", return_value=Path(tmp) / "gone"), \
                mock.patch("app.services.systems.bundles._stored_frame", return_value=None):
            with self.assertRaises(BundleUnreadable):
                BundleSource().mid_plane_mm("prj_1", {"source_fingerprint": "src", "build_fingerprint": "gen",
                                                       "bundle_url": "/b/bundle.json"})

    def bundle(self, root: Path) -> dict:
        """A semantic-stage bundle in ``root``: copper inner faces 0.035 and 1.6 mm apart, so mid-plane 0.7825."""
        root.mkdir(parents=True, exist_ok=True)
        (root / "bundle.json").write_text(json.dumps({"semantic_geometry": "geo.json"}))
        (root / "geo.json").write_text(json.dumps({"assets": {"scene_manifest": "scene.json"}}))
        (root / "scene.json").write_text(json.dumps({"layers": [
            {"role": "copper", "z_mm": 0.0175, "thickness_mm": 0.035},
            {"role": "copper", "z_mm": 1.6175, "thickness_mm": 0.035}]}))
        return {"source_fingerprint": "src", "build_fingerprint": "gen", "bundle_url": "/b/bundle.json"}

    def test_a_computed_mid_plane_is_kept_and_reused_without_parsing(self) -> None:
        # SB2-96: the scene parsed three bundle files per board per request.
        bundles._FRAMES.clear()
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("app.services.semantic_visualizer_service.bundle_dir", return_value=Path(tmp)), \
                mock.patch("app.services.systems.bundles._stored_frame", return_value=None) as stored, \
                mock.patch("app.services.systems.bundles._store_frame") as store:
            status = self.bundle(Path(tmp))
            self.assertAlmostEqual(BundleSource().mid_plane_mm("prj_1", status), 0.7825)
            store.assert_called_once_with(("prj_1", "src", "gen"), "scene.json", mock.ANY)
            (Path(tmp) / "geo.json").unlink()  # a parse would now fail; the kept frame must not need one
            self.assertAlmostEqual(BundleSource().mid_plane_mm("prj_1", status), 0.7825)
            stored.assert_called_once()
        bundles._FRAMES.clear()

    def test_a_stored_frame_is_used_by_a_fresh_process(self) -> None:
        bundles._FRAMES.clear()
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("app.services.semantic_visualizer_service.bundle_dir", return_value=Path(tmp)), \
                mock.patch("app.services.systems.bundles._stored_frame", return_value=("scene.json", 0.5)), \
                mock.patch("app.services.systems.bundles._store_frame") as store:
            status = self.bundle(Path(tmp))
            self.assertEqual(BundleSource().mid_plane_mm("prj_1", status), 0.5)
            store.assert_not_called()
        bundles._FRAMES.clear()

    def test_a_kept_frame_whose_files_are_gone_is_unreadable(self) -> None:
        # SB2-91 still holds when the mid-plane is known: gone files must read as failed.
        bundles._FRAMES.clear()
        bundles._FRAMES[("prj_1", "src", "gen")] = ("scene.json", 0.8)
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("app.services.semantic_visualizer_service.bundle_dir", return_value=Path(tmp) / "gone"):
            with self.assertRaises(BundleUnreadable):
                BundleSource().mid_plane_mm("prj_1", {"source_fingerprint": "src", "build_fingerprint": "gen"})
        self.assertNotIn(("prj_1", "src", "gen"), bundles._FRAMES)

    def test_a_board_stage_bundle_is_not_kept(self) -> None:
        bundles._FRAMES.clear()
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("app.services.semantic_visualizer_service.bundle_dir", return_value=Path(tmp)), \
                mock.patch("app.services.systems.bundles._stored_frame", return_value=None), \
                mock.patch("app.services.systems.bundles._store_frame") as store:
            status = self.bundle(Path(tmp))
            (Path(tmp) / "geo.json").write_text(json.dumps({"assets": {}}))
            self.assertIsNone(BundleSource().mid_plane_mm("prj_1", status))
            store.assert_not_called()
        self.assertEqual(bundles._FRAMES, {})

    def test_the_job_key_names_the_generator_build(self) -> None:
        # A completed job satisfies a request with the same key; one built by an older
        # viewer or pipeline must not, or a stale bundle reads as "building" forever.
        from app.services import project_service

        row = {"id": "prj_1", "project_file_rel": "board.kicad_pro"}
        with mock.patch("app.services.semantic_visualizer_service.BUILD_FINGERPRINT", "build_a"):
            first = project_service.webgpu_artifact_key(row, "a" * 40)
            again = project_service.webgpu_artifact_key(row, "a" * 40)
        with mock.patch("app.services.semantic_visualizer_service.BUILD_FINGERPRINT", "build_b"):
            rebuilt = project_service.webgpu_artifact_key(row, "a" * 40)
        self.assertEqual(first, again)
        self.assertNotEqual(first, rebuilt)


class FakeBundles:
    """``ready`` holds (project, commit) pairs whose bundle exists."""

    def __init__(self) -> None:
        self.ready: set[tuple[str, str]] = set()
        self.builds: list[tuple[str, str, str]] = []
        self.jobs: dict[tuple[str, str], dict] = {}
        self.unreadable: set[str] = set()  # projects whose ready bundle's files are gone

    def status(self, project, commit: str) -> dict:
        if (project.id, commit) in self.ready:
            return {"available": True, "status": "ready", "bundle_url": f"/b/{project.id}/{commit}/bundle.json",
                    "sourceRevisionKey": "src", "source_fingerprint": "src", "build_fingerprint": "gen"}
        return {"available": False, "status": "missing"}

    def last_build(self, project_id: str, commit: str):
        return self.jobs.get((project_id, commit))

    def build(self, project_id: str, commit: str, *, requested_by: str) -> str:
        self.builds.append((project_id, commit, requested_by))
        job_id = f"job-{len(self.builds)}"
        self.jobs[(project_id, commit)] = {"jobId": job_id, "status": "queued", "error": None}
        return job_id

    def mid_plane_mm(self, project_id: str, status: dict) -> float:
        if project_id in self.unreadable:
            raise BundleUnreadable("bundle.json: No such file or directory")
        return 0.8


class SceneCase(AssemblyCase):
    def setUp(self) -> None:
        super().setUp()
        self.bundles = FakeBundles()
        self.service._bundles = self.bundles

    def interface(self, label: str) -> dict:
        row = self.store.get_instance(self.sid, self.instances[label])
        return self.store.get_interface(row["project_id"], row["baseline_commit"], EXTRACTOR_VERSION)


class FlatSceneTest(SceneCase):
    def test_boards_sit_in_a_default_row_and_repeated_boards_share_one_asset(self) -> None:
        scene = self.service.scene(DESIGNER, self.sid)
        self.assertEqual((scene["schema"], scene["units"]), ("prism.system_scene.a0", "mm"))
        labels = [o["displayPath"] for o in scene["occurrences"]]
        self.assertEqual(sorted(labels), ["OBC-A", "OBC-B", "PAY", "PWR"])

        expected = poses.default_row([(label, board_bounds(self.interface(label)))
                                      for label in ("OBC-A", "OBC-B", "PAY", "PWR")])
        for occurrence in scene["occurrences"]:
            with self.subTest(board=occurrence["displayPath"]):
                pose = expected[occurrence["displayPath"]]
                self.assertEqual(occurrence["pose"], {**pose, "source": "default"})
                self.assertEqual(occurrence["worldMatrix"], poses.matrix(pose))
                self.assertEqual(occurrence["boundsMm"], board_bounds(self.interface(occurrence["displayPath"])))
        self.assertIsNone(board_bounds(self.interface("PAY")), "mini_payload has no board: an empty slot")

        obc = [o for o in scene["occurrences"] if o["displayPath"].startswith("OBC")]
        self.assertEqual(obc[0]["assetId"], obc[1]["assetId"], "OBC-A and OBC-B are mini_obc at F0")
        self.assertEqual(len(scene["assets"]), 3)

    def test_a_designer_queues_missing_bundles_once_and_a_viewer_does_not(self) -> None:
        viewed = self.service.scene(VIEWER, self.sid)
        self.assertEqual(self.bundles.builds, [])
        self.assertEqual({a["status"] for a in viewed["assets"]}, {"missing"})

        scene = self.service.scene(DESIGNER, self.sid)
        self.assertEqual(sorted(p for p, _c, _u in self.bundles.builds), ["prj_obc", "prj_pay", "prj_pwr"])
        self.assertTrue(all(a["status"] == "building" and a["jobId"] for a in scene["assets"]))
        again = self.service.scene(DESIGNER, self.sid)
        self.assertEqual(len(self.bundles.builds), 3, "a queued build is reported, not queued again")
        self.assertEqual({a["assetId"]: a["jobId"] for a in again["assets"]},
                         {a["assetId"]: a["jobId"] for a in scene["assets"]})

    def test_a_failed_build_is_reported_and_never_requeued_by_a_read(self) -> None:
        row = self.store.get_instance(self.sid, self.instances["PWR"])
        key = (row["project_id"], row["baseline_commit"])
        self.bundles.jobs[key] = {"jobId": "job-old", "status": "failed", "error": "Missing required executable: kicad-cli"}
        for _ in range(2):
            scene = self.service.scene(DESIGNER, self.sid)
        [failed] = [a for a in scene["assets"] if a["projectId"] == "prj_pwr"]
        self.assertEqual((failed["status"], failed["jobId"], failed["error"]),
                         ("failed", "job-old", "Missing required executable: kicad-cli"))
        self.assertNotIn(key, [(p, c) for p, c, _u in self.bundles.builds])

    def test_a_ready_status_over_missing_files_is_failed_not_building(self) -> None:
        # SB2-91: the status says ready but the bundle's files are gone (replaced under another
        # generator build, or pruned): without a frame the page showed "generating" forever.
        row = self.store.get_instance(self.sid, self.instances["PWR"])
        self.bundles.ready.add((row["project_id"], row["baseline_commit"]))
        self.bundles.unreadable = {"prj_pwr"}
        scene = self.service.scene(DESIGNER, self.sid)
        [asset] = [a for a in scene["assets"] if a["projectId"] == "prj_pwr"]
        self.assertEqual((asset["status"], asset["bundleUrl"], asset["bundleToBoard"]), ("failed", None, None))
        self.assertIn("Regenerate", asset["error"])
        self.assertNotIn(("prj_pwr", row["baseline_commit"]), [(p, c) for p, c, _u in self.bundles.builds])

    def test_a_completed_build_without_a_bundle_is_failed_not_building(self) -> None:
        # E.g. the worker built under another generator build, or the bundle was pruned:
        # a new request would return the same completed job, so "building" would never end.
        row = self.store.get_instance(self.sid, self.instances["PWR"])
        key = (row["project_id"], row["baseline_commit"])
        self.bundles.jobs[key] = {"jobId": "job-done", "status": "completed", "error": None}
        with self.assertLogs("app.services.systems.service", "WARNING"):
            scene = self.service.scene(DESIGNER, self.sid)
        [asset] = [a for a in scene["assets"] if a["projectId"] == "prj_pwr"]
        self.assertEqual((asset["status"], asset["jobId"]), ("failed", "job-done"))
        self.assertIn("Regenerate", asset["error"])
        self.assertNotIn(key, [(p, c) for p, c, _u in self.bundles.builds])

    def test_a_ready_bundle_carries_its_url_and_frame(self) -> None:
        row = self.store.get_instance(self.sid, self.instances["OBC-A"])
        self.bundles.ready.add((row["project_id"], row["baseline_commit"]))
        scene = self.service.scene(VIEWER, self.sid)
        [ready] = [a for a in scene["assets"] if a["status"] == "ready"]
        self.assertEqual(ready["assetId"], asset_id(row["project_id"], row["baseline_commit"]))
        self.assertEqual(ready["bundleUrl"], f"/b/prj_obc/{row['baseline_commit']}/bundle.json")
        self.assertEqual(ready["bundleToBoard"][:12], [1000.0, 0, 0, 0, 0, 1000.0, 0, 0, 0, 0, 1000.0, 0])
        self.assertEqual(ready["bundleToBoard"][12:], [0.0, 0.0, -0.8, 1.0])

    def test_a_restricted_board_leaks_only_its_bounds(self) -> None:
        admin = {o["path"]: o for o in self.service.scene(ADMIN, self.sid)["occurrences"]}
        self.hide_pay()
        scene = self.service.scene(VIEWER, self.sid)
        [pay] = [o for o in scene["occurrences"] if o["restricted"]]
        self.assertEqual((pay["displayPath"], pay["assetId"]), ("PAY", None))
        self.assertEqual((pay["boundsMm"], pay["worldMatrix"]), (admin[pay["path"]]["boundsMm"], admin[pay["path"]]["worldMatrix"]))
        text = json.dumps(scene)
        pay_commit = self.store.get_instance(self.sid, self.instances["PAY"])["baseline_commit"]
        self.assertNotIn("prj_pay", text)
        self.assertNotIn(pay_commit, text)
        self.assertEqual(len(scene["assets"]), 2)

    def test_api(self) -> None:
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        with mock.patch.object(service_module, "service", self.service):
            response = _request(app, "GET", f"/api/systems/{self.sid}/scene", user="viewer")
            missing = _request(app, "GET", "/api/systems/sys_missing/scene", user="viewer")
        self.assertEqual(response.status, 200, response.text)
        self.assertEqual(len(response.json["occurrences"]), 4)
        self.assertEqual(missing.status, 404)


class NestedSceneTest(SceneCase):
    def setUp(self) -> None:
        super().setUp()
        publication = self.child()
        self.bus, version = self.parent()
        added = self.add(self.bus, version, "CNDH-A", publication["componentId"])
        self.add(self.bus, added.version, "CNDH-B", publication["componentId"])

    def test_two_copies_of_an_assembly_are_rigid_groups_drawn_from_one_set_of_assets(self) -> None:
        scene = self.service.scene(DESIGNER, self.bus)
        by_display = {o["displayPath"]: o for o in scene["occurrences"]}
        self.assertEqual(sum(o["kind"] == "board" for o in scene["occurrences"]), 8)
        self.assertEqual(len(scene["assets"]), 3, "eight board occurrences, three distinct (project, commit)")

        group = by_display["CNDH-A"]["boundsMm"]
        self.assertIsNotNone(group)
        shift = group["maxMm"][0] - group["minMm"][0] + poses.DEFAULT_GAP_MM
        for label in ("OBC-A", "OBC-B", "PAY", "PWR"):
            a, b = by_display[f"CNDH-A ▸ {label}"], by_display[f"CNDH-B ▸ {label}"]
            with self.subTest(board=label):
                self.assertEqual(a["pose"], b["pose"], "the same pose inside each copy")
                self.assertEqual(a["assetId"], b["assetId"])
                offset = [round(q - p, 6) for p, q in zip(a["worldMatrix"][12:15], b["worldMatrix"][12:15])]
                self.assertEqual(offset, [round(shift, 6), 0.0, 0.0])
                self.assertEqual(a["parentPath"], by_display["CNDH-A"]["path"])

    def test_a_hidden_child_system_is_one_box(self) -> None:
        admin = {o["displayPath"]: o for o in self.service.scene(ADMIN, self.bus)["occurrences"]}
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"])
        self.conn.execute("UPDATE system_projects SET folder_id = 'fld_admins' WHERE id = %s", (self.sid,))
        self.conn.commit()
        scene = self.service.scene(VIEWER, self.bus)
        self.assertEqual(sorted((o["displayPath"], o["restricted"]) for o in scene["occurrences"]),
                         [("CNDH-A", True), ("CNDH-B", True)])
        self.assertEqual(scene["assets"], [])
        for occurrence in scene["occurrences"]:
            self.assertEqual(occurrence["boundsMm"], admin[occurrence["displayPath"]]["boundsMm"])


if __name__ == "__main__":
    unittest.main()
