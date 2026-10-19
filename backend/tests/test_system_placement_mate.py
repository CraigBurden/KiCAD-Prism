"""SB2-35: the mate transform, connector bodies and clearance (CONTRACTS_P2 §14.5, §14.8).

Two kinds of check:

- **Datasheet goldens.** The SB2-21 Samtec mezzanine (``p2/goldens/geometry_fixtures.json``,
  written by hand from Samtec's drawings) posed by Prism's extractor and this library
  must land within 0.01 mm: the 7.00 mm stack puts the top board at z = 8.6, the second
  pair checks with zero residual, the shifted commit misses by 1.5 mm, and the body
  heights give the clearance fallback.
- **Shared goldens** (``placement_cases.json`` ``mates``), replayed here and by
  ``frontend/.../placement/mate.test.ts``, each also checked by meaning: mating axes
  opposed, B's connector exactly ``h`` along A's axis, pad 1 on pad 1.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from app.services.systems.placement import mate
from app.services.systems.placement.frames import _pad_one, connector_frame
from app.services.systems.placement.poses import IDENTITY, compose, rotate

HERE = Path(__file__).resolve().parent
P2 = HERE / "fixtures" / "system_builder" / "p2"
GOLDEN = json.loads((P2 / "goldens" / "geometry_fixtures.json").read_text())
CASES = json.loads((HERE / "fixtures" / "system_builder" / "placement_cases.json").read_text())
MM, UNIT = CASES["tolerance"]["mm"], CASES["tolerance"]["unit"]
DATASHEET_MM = 0.01
# Meaning checks: the extractor rounds pads to 1e-4 mm and stored quaternions to 1e-9.
MEANING_MM, MEANING_UNIT = 1e-4, 1e-6


# The mezzanine connectors as System Builder v1 extracted them from ``p2/sources`` (frozen at stage 0,
# when the extractor went): each snapshot's board thickness and its J1 and J2 geometry.
ENDS = json.loads((P2 / "goldens" / "mezzanine_ends.json").read_text())


def fixture_end(snapshot: str, reference: str) -> dict:
    board = ENDS[snapshot]
    return {"geometry": board["ends"][reference], "thicknessMm": board["thicknessMm"], "stored": None}


def with_body(end: dict, height: float) -> dict:
    lo, hi = end["geometry"]["courtyard"]["minMm"], end["geometry"]["courtyard"]["maxMm"]
    return {**end, "bodyMm": {"minMm": [*lo, 0.0], "maxMm": [*hi, height]}}


class DatasheetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        mezz = GOLDEN["mezzanine"]
        cls.base = {ref: fixture_end(mezz["base"], ref) for ref in ("J1", "J2")}
        cls.top = {ref: fixture_end(mezz["top"], ref) for ref in ("J1", "J2")}
        cls.shifted = {ref: fixture_end(GOLDEN["mezzanineShifted"]["top"], ref) for ref in ("J1", "J2")}

    def assert_within(self, actual, expected, label: str) -> None:
        for a, e in zip(actual, expected):
            self.assertLessEqual(abs(a - e), DATASHEET_MM, f"{label}: {actual} != {expected}")

    def test_the_mated_height_poses_the_top_board(self) -> None:
        mezz = GOLDEN["mezzanine"]
        result = mate.mate(self.base["J1"], self.top["J1"], mezz["matedHeightMm"])
        self.assertEqual((result["heightSource"], result["stackHeightMm"]), ("link", mezz["matedHeightMm"]))
        self.assert_within(result["pose"]["translationMm"], mezz["topPoseInBaseFrame"]["translationMm"], "translation")
        self.assert_within(result["pose"]["rotation"], mezz["topPoseInBaseFrame"]["rotation"], "rotation")

    def test_residuals_with_j1_driving(self) -> None:
        mezz = GOLDEN["mezzanine"]
        for top, expected in ((self.top, mezz["residualMm"]), (self.shifted, GOLDEN["mezzanineShifted"]["residualMm"])):
            placed = mate.mate(self.base["J1"], top["J1"], mezz["matedHeightMm"])["pose"]
            for ref in ("J1", "J2"):
                with self.subTest(top=top is self.shifted, ref=ref):
                    own = mate.mate(self.base[ref], top[ref], mezz["matedHeightMm"])
                    got = mate.residual(IDENTITY, placed, self.base[ref], top[ref], own)
                    self.assertAlmostEqual(got["distanceMm"], expected[ref], delta=DATASHEET_MM)
                    self.assertAlmostEqual(got["angleDeg"], 0.0, delta=1e-6)
        # The shift is across the mating plane, along the rows (the frames' x is the row axis).
        shifted = mate.residual(IDENTITY, mate.mate(self.base["J1"], self.shifted["J1"], 7.0)["pose"],
                                self.base["J2"], self.shifted["J2"], mate.mate(self.base["J2"], self.shifted["J2"], 7.0))
        self.assertAlmostEqual(shifted["lateralMm"], 1.5, delta=DATASHEET_MM)
        self.assertAlmostEqual(shifted["offsetMm"][2], 0.0, delta=DATASHEET_MM)

    def test_clearance_from_the_datasheet_body_heights(self) -> None:
        clearance = GOLDEN["mezzanine"]["clearance"]
        result = mate.mate(with_body(self.base["J1"], clearance["terminalBodyHeightMm"]),
                           with_body(self.top["J1"], clearance["socketBodyHeightMm"]))
        self.assertEqual(result["heightSource"], "clearance")
        self.assertAlmostEqual(result["stackHeightMm"], clearance["stackHeightMm"], delta=DATASHEET_MM)
        self.assertAlmostEqual(result["pose"]["translationMm"][2], clearance["topPoseZMm"], delta=DATASHEET_MM)

    def test_clearance_without_bodies_assumes_five_millimetres(self) -> None:
        clearance = GOLDEN["mezzanine"]["clearance"]
        result = mate.mate(self.base["J1"], self.top["J1"])
        self.assertAlmostEqual(result["stackHeightMm"], clearance["assumedStackHeightMm"], delta=DATASHEET_MM)
        self.assertAlmostEqual(result["pose"]["translationMm"][2], clearance["assumedTopPoseZMm"], delta=DATASHEET_MM)

    def test_a_given_stack_height_wins_over_clearance(self) -> None:
        result = mate.mate(with_body(self.base["J1"], 4.9), with_body(self.top["J1"], 3.23), 7.0)
        self.assertEqual((result["heightSource"], result["stackHeightMm"]), ("link", 7.0))


def resolve(end: dict) -> dict:
    """``{"end": key}`` names a fixture connector in ``mateEnds``; other keys (``bodyMm``) override it."""
    return {**CASES["mateEnds"][end["end"]], **{k: v for k, v in end.items() if k != "end"}} if "end" in end else end


def mate_cases() -> list[dict]:
    out = []
    for c in CASES["mates"]:
        if c["op"] == "mate":
            out.append({**c, "input": {**c["input"], "a": resolve(c["input"]["a"]), "b": resolve(c["input"]["b"])}})
    return out


class SharedGoldenTest(unittest.TestCase):
    def assert_close(self, actual, expected, tolerance: float, label: str) -> None:
        self.assertEqual(len(actual), len(expected), label)
        for a, e in zip(actual, expected):
            self.assertLessEqual(abs(a - e), tolerance, f"{label}: {actual} != {expected}")

    def test_every_case_replays(self) -> None:
        self.assertGreaterEqual(len(CASES["mates"]), 11)
        for spec in CASES["mates"]:
            with self.subTest(case=spec["name"]):
                i = spec["input"]
                if spec["op"] == "mate":
                    got = mate.mate(resolve(i["a"]), resolve(i["b"]), i["stackHeightMm"])
                else:
                    got = mate.residual(i["aWorld"], i["bWorld"], resolve(i["a"]), resolve(i["b"]), i["result"])
                expected = spec["expected"]
                if expected is None:
                    self.assertIsNone(got)
                    continue
                if spec["op"] == "mate":
                    self.assertEqual((got["quarterTurns"], got["heightSource"]),
                                     (expected["quarterTurns"], expected["heightSource"]))
                    self.assertAlmostEqual(got["stackHeightMm"], expected["stackHeightMm"], delta=MM)
                    self.assert_close(got["pose"]["translationMm"], expected["pose"]["translationMm"], MM, "translation")
                    self.assert_close(got["pose"]["rotation"], expected["pose"]["rotation"], UNIT, "rotation")
                else:
                    self.assert_close(got["offsetMm"], expected["offsetMm"], MM, "offset")
                    for key in ("distanceMm", "lateralMm", "angleDeg"):
                        self.assertAlmostEqual(got[key], expected[key], delta=MM)

    def test_every_mate_means_what_it_says(self) -> None:
        """Axes opposed; B's connector origin exactly h along A's axis; pad 1 on pad 1 unless the case says otherwise."""
        for spec in mate_cases():
            if spec["expected"] is None:
                continue
            with self.subTest(case=spec["name"]):
                a, b, result = spec["input"]["a"], spec["input"]["b"], spec["expected"]
                frame_a = connector_frame(a["geometry"], a["thicknessMm"], a["stored"])
                frame_b = connector_frame(b["geometry"], b["thicknessMm"], b["stored"])
                z_b = rotate(result["pose"]["rotation"], frame_b["zAxis"])
                self.assertAlmostEqual(sum(x * y for x, y in zip(z_b, frame_a["zAxis"])), -1.0, delta=MEANING_UNIT)
                origin_b = compose(result["pose"], {"translationMm": frame_b["originMm"], "rotation": IDENTITY["rotation"]})
                self.assert_close(mate._local(frame_a, origin_b["translationMm"]), [0.0, 0.0, result["stackHeightMm"]],
                                  MEANING_MM, "B's connector origin")
                pad_a, pad_b = self.pad_one(a), self.pad_one(b)
                landed = mate._local(frame_a, compose(result["pose"], {"translationMm": pad_b,
                                                                       "rotation": IDENTITY["rotation"]})["translationMm"])
                own = mate._local(frame_a, pad_a)
                if "quarter-turn" in spec["name"]:
                    # Turned 90° about A's mating axis: pad 1 is where the unturned mate's pad 1 lands, rotated.
                    self.assert_close(landed[:2], [-own[1], own[0]], MEANING_MM, "pad 1, turned")
                elif "one row across" in spec["name"]:
                    self.assert_close(landed[:2], [own[0], -own[1]], MEANING_MM, "pad 1, mirrored row")
                else:
                    self.assert_close(landed[:2], own[:2], MEANING_MM, "pad 1")

    @staticmethod
    def pad_one(end: dict) -> list[float]:
        geometry = end["geometry"]
        half = end["thicknessMm"] / 2.0
        return [*_pad_one(geometry)["positionMm"], half if geometry["side"] == "top" else -half]

    def test_named_assemblies(self) -> None:
        by_name = {c["name"]: c["expected"] for c in mate_cases()}
        orthogonal = by_name["orthogonal: right-angle header into a vertical socket"]["pose"]
        coplanar = by_name["coplanar: right-angle socket and right-angle header"]["pose"]
        # The vertical socket's board stands at 90° to the header's; the coplanar boards share a plane.
        self.assertAlmostEqual(abs(rotate(orthogonal["rotation"], [0.0, 0.0, 1.0])[2]), 0.0, delta=MEANING_UNIT)
        self.assert_close(rotate(coplanar["rotation"], [0.0, 0.0, 1.0]), [0.0, 0.0, 1.0], MEANING_UNIT, "coplanar normal")
        self.assertAlmostEqual(coplanar["translationMm"][2], 0.0, delta=MM)
        self.assertEqual(by_name["square 2x2 headers: k turns pad 1 onto pad 1"]["quarterTurns"], 1)
        self.assertIsNone(by_name["an end without a frame gives no mate"])


class BodyTest(unittest.TestCase):
    def test_a_back_side_body_hangs_below_the_board(self) -> None:
        geometry = {"side": "bottom", "positionMm": [10.0, 0.0], "rotationDeg": 90.0, "pads": [],
                    "courtyard": {"minMm": [-1.0, -2.0], "maxMm": [1.0, 2.0]}}
        corners = mate.body_corners(geometry, 1.6)
        self.assertEqual({round(c[2], 9) for c in corners}, {-0.8, -5.8})
        self.assertEqual(sorted({(round(c[0], 9), round(c[1], 9)) for c in corners}),
                         [(8.0, -1.0), (8.0, 1.0), (12.0, -1.0), (12.0, 1.0)])

    def test_bodies_side_by_side_need_only_the_margin(self) -> None:
        a = {"originMm": [0.0, 0.0, 0.0], "xAxis": [1.0, 0.0, 0.0], "yAxis": [0.0, 1.0, 0.0], "zAxis": [0.0, 0.0, 1.0]}
        box = lambda x0: [[x, y, z] for x in (x0, x0 + 1) for y in (-0.5, 0.5) for z in (0, 3)]
        self.assertEqual(mate.clearance_height(a, box(0.0), a, box(5.0), 0), mate.CLEARANCE_MARGIN_MM)
        self.assertEqual(mate.clearance_height(a, box(0.0), a, box(0.5), 0), 6.0 + mate.CLEARANCE_MARGIN_MM)


if __name__ == "__main__":
    unittest.main()
