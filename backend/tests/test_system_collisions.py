"""SB2-108 (CONTRACTS_P2 §24.2, D-P2-58): the collision check, SYS-V22."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from test_system_parts import PartCase
from test_system_snapshots import DESIGNER

from app.services.systems import collision_meshes, collisions
from app.services.systems.collisions import Body


def cube(occurrence: str, at: tuple[float, float, float], size: float = 10.0, reference=None, matrix=None,
         solid: bool = False) -> Body:
    vertices, faces = collisions.box(at, [v + size for v in at])
    return Body(occurrence, occurrence.strip("/").upper(), reference, vertices, faces, matrix, solid)


def column_major(rotation: np.ndarray, translation) -> list[float]:
    m = np.eye(4)
    m[:3, :3], m[:3, 3] = rotation, translation
    return m.T.reshape(-1).tolist()


class CheckTest(unittest.TestCase):
    def test_overlapping_bodies_of_two_occurrences_collide(self) -> None:
        [found] = collisions.check([cube("/a", (0, 0, 0), reference="U1"), cube("/b", (5, 5, 5))])
        self.assertEqual((found["a"], found["b"]), ({"occurrence": "/a", "label": "A", "reference": "U1"},
                                                    {"occurrence": "/b", "label": "B", "reference": None}))
        self.assertEqual(len(found["pairs"]), 1)
        self.assertEqual(len(found["atMm"]), 3)

    def test_touching_apart_and_same_occurrence_bodies_do_not(self) -> None:
        self.assertEqual(collisions.check([cube("/a", (0, 0, 0)), cube("/b", (10, 0, 0))]), [])
        self.assertEqual(collisions.check([cube("/a", (0, 0, 0)), cube("/b", (30, 0, 0))]), [])
        self.assertEqual(collisions.check([cube("/a", (0, 0, 0)), cube("/a", (5, 5, 5))]), [])

    def test_a_mated_pair_is_exempt_but_not_its_neighbours(self) -> None:
        bodies = [cube("/a", (0, 0, 0), reference="J1"), cube("/b", (5, 5, 5), reference="P1"),
                  cube("/a", (0, 0, 20), reference="U1"), cube("/b", (5, 5, 25), reference="U2")]
        [found] = collisions.check(bodies, {frozenset({("/a", "J1"), ("/b", "P1")})})
        self.assertEqual([(p["a"], p["b"]) for p in found["pairs"]], [("U1", "U2")])

    def test_a_body_is_placed_by_its_matrix_not_copied(self) -> None:
        quarter = np.array([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])
        moved = cube("/b", (0, 0, 0), matrix=column_major(quarter, [100.0, 0.0, 0.0]))
        np.testing.assert_allclose((moved.lo, moved.hi), ([90, 0, 0], [100, 10, 10]))
        self.assertEqual(collisions.check([cube("/a", (95, 5, 5)), moved])[0]["b"]["occurrence"], "/b")
        self.assertEqual(collisions.check([cube("/a", (0, 0, 0)), moved]), [])

    def test_a_mirrored_placement_is_baked_into_the_mesh(self) -> None:
        mirror = np.diag([-1.0, 1.0, 1.0])
        body = cube("/b", (0, 0, 0), matrix=column_major(mirror, [0.0, 0.0, 0.0]))
        np.testing.assert_allclose(body.lo, [-10, 0, 0])
        np.testing.assert_allclose(body.hi, [0, 10, 10])
        self.assertEqual(len(collisions.check([cube("/a", (-5, 0, 0)), body])), 1)
        self.assertEqual(collisions.check([cube("/a", (5, 0, 0)), body]), [])
        solid = cube("/b", (0, 0, 0), matrix=column_major(mirror, [0.0, 0.0, 0.0]), solid=True)
        self.assertEqual(len(collisions.check([cube("/a", (-6, 4, 4), size=1), solid])), 1)

    def test_a_board_body_is_solid_a_mesh_only_its_surface(self) -> None:
        inside = cube("/b", (40, 40, 40), size=2)
        self.assertEqual(len(collisions.check([cube("/a", (0, 0, 0), size=100, solid=True), inside])), 1)
        self.assertEqual(collisions.check([cube("/a", (0, 0, 0), size=100), inside]), [])

    def test_pairs_group_per_occurrence_pair_and_are_capped(self) -> None:
        bodies = [cube("/a", (0, 0, 0), size=100, solid=True)] + [cube("/b", (i * 5.0, 1, 1), size=2, reference=f"C{i}")
                                                       for i in range(15)]
        [found] = collisions.check(bodies)
        self.assertEqual(len(found["pairs"]), collisions.MAX_PAIRS)


class BoardMeshesTest(unittest.TestCase):
    def test_component_bodies_by_reference_in_the_board_frame_and_cached(self) -> None:
        import trimesh

        root = Path(tempfile.mkdtemp())
        (root / "geometry").mkdir()
        (root / "semantic_geometry.json").write_text(json.dumps({"components": [{"designator": "U1"}]}))
        scene = trimesh.Scene()
        scene.graph.update(frame_to="U1", frame_from=scene.graph.base_frame,
                           matrix=trimesh.transformations.translation_matrix([0.01, 0.002, -0.02]))
        scene.add_geometry(trimesh.creation.box(extents=[0.002, 0.002, 0.002]), node_name="U1_body",
                           parent_node_name="U1")
        scene.add_geometry(trimesh.creation.box(extents=[0.001, 0.001, 0.001]), node_name="stray")
        scene.export(root / "geometry" / "components.glb")
        to_board = column_major(np.eye(3) * 1000.0, [0.0, 0.0, -1.0])  # metres → mm, z about the mid-plane
        cache = root / "cache" / "meshes.npz"
        [(reference, vertices, faces)] = collision_meshes.board_components(root, to_board, cache)
        self.assertEqual(reference, "U1")
        # glTF (x, y, z) → board (x, −z, y): the centre (10, 2, −20) mm lands at (10, 20, 2 − 1).
        np.testing.assert_allclose((vertices.min(axis=0) + vertices.max(axis=0)) / 2, [10, 20, 1], atol=1e-4)
        self.assertEqual(len(faces), 12)
        collision_meshes._cache.clear()
        [(again, cached, _faces)] = collision_meshes.board_components(root, to_board, cache)
        self.assertEqual(again, "U1")
        np.testing.assert_allclose(cached, vertices)


class CollisionServiceTest(PartCase):
    def place(self, instance_id: str, x: float) -> None:
        self.service.set_pose(DESIGNER, self.sid, self.version(), instance_id,
                              {"translationMm": [x, 0.0, 0.0], "rotation": [0.0, 0.0, 0.0, 1.0]})

    def state(self) -> tuple[str, list[dict]]:
        validation = self.service.document(DESIGNER, self.sid, include_validation=True).body["validation"]
        return validation["collisionCheck"]["state"], [f for f in validation["findings"] if f["rule"] == "SYS-V22"]

    def test_overlapping_parts_raise_v22_until_moved_apart(self) -> None:
        enclosure, lid = self.add("Enclosure"), self.add("Lid")
        self.place(enclosure["id"], 5000.0)
        self.place(lid["id"], 5000.0)
        self.assertEqual(self.state(), ("not_checked", []))

        result = self.service.run_collision_check(self.sid)
        [collision] = [c for c in result["collisions"] if {c["a"]["label"], c["b"]["label"]} == {"Enclosure", "Lid"}]
        self.assertEqual(collision["atMm"][0] > 4000, True)
        state, [finding] = self.state()
        self.assertEqual((state, finding["severity"]), ("current", "warning"))
        self.assertIn(finding["reference"], ("Enclosure ↔ Lid", "Lid ↔ Enclosure"))  # pairs sort by instance path
        # D12: the run refreshes the systems list's counts at the same version.
        listed = next(s for s in self.service.list_systems(DESIGNER) if s["id"] == self.sid)["findingCounts"]
        self.assertEqual(listed, self.service.document(DESIGNER, self.sid).body["findingCounts"])
        self.assertEqual({finding["detail"]["a"]["label"], finding["detail"]["b"]["label"]}, {"Enclosure", "Lid"})
        # Boards without a 3D bundle are listed, never passed.
        self.assertTrue(all(gap["reason"].startswith("bundle_") or gap["reason"] in ("restricted", "no_outline")
                            for gap in result["notEvaluated"]))

        self.place(lid["id"], 9000.0)
        self.assertEqual(self.state(), ("stale", []))
        self.service.run_collision_check(self.sid)
        self.assertEqual(self.state(), ("current", []))

    def test_the_check_reads_through_the_api_shape(self) -> None:
        self.add("Enclosure")
        self.service.run_collision_check(self.sid)
        body = self.service.collision_check(DESIGNER, self.sid)
        self.assertEqual((body["systemId"], body["state"], body["findings"]), (self.sid, "current", []))


if __name__ == "__main__":
    unittest.main()
