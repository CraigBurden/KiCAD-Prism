"""Real-KiCad acceptance for undoing a placed footprint's rotation on import.

A footprint copied out of a board keeps every pad's and text's angle *including*
the placement angle, so importing a part placed at 90 degrees used to produce a
library footprint with rotated pads. `_sanitize_footprint` now keeps the
placement angle and `kicad_footprint_normalizer` returns the footprint to
orientation 0 with KiCad's own geometry.

That geometry can only be checked against KiCad itself, so the board fixtures
are built with pcbnew in a KiCad Python and the results are dumped back to JSON.
The suite is skipped - with a reason - when no KiCad Python with pcbnew is
available; CI provides one in its KiCad container.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import kicad_footprint_normalizer as normalizer  # noqa: E402
from app.services.project_component_asset_extractor import (  # noqa: E402
    _sanitize_footprint,
)

FIXTURE_LIBRARY = (
    Path(__file__).resolve().parent
    / "fixtures/system_builder/p2/sources/mezz_top/F0/PrismFixture.pretty"
)
FOOTPRINT_NAME = "Conn_Custom_2x05"
CASES = [
    ("front", 0), ("front", 90), ("front", 37.5), ("front", 180), ("front", 270),
    ("back", 0), ("back", 90), ("back", 37.5), ("back", 180), ("back", 270),
]

#: The pcbnew probe the test drives. Written to a temporary file and run under
#: the KiCad Python, because pcbnew cannot be imported into the test interpreter.
PROBE = '''\
"""pcbnew probe for the footprint-rotation acceptance test (not a test itself)."""
import json
import os
import sys

import pcbnew

CASES = [
    ("front", 0.0), ("front", 90.0), ("front", 37.5), ("front", 180.0), ("front", 270.0),
    ("back", 0.0), ("back", 90.0), ("back", 37.5), ("back", 180.0), ("back", 270.0),
]
ORIGIN = pcbnew.VECTOR2I(0, 0)


def _point(vec):
    return [int(vec.x), int(vec.y)]


def shape_geometry(item):
    kind = int(item.GetShape())
    layer = item.GetLayerName()
    if kind == pcbnew.SHAPE_T_SEGMENT:
        return {"layer": layer, "kind": "segment", "start": _point(item.GetStart()), "end": _point(item.GetEnd())}
    if kind == pcbnew.SHAPE_T_RECTANGLE:
        start, end = item.GetStart(), item.GetEnd()
        return {"layer": layer, "kind": "poly",
                "points": [[start.x, start.y], [end.x, start.y], [end.x, end.y], [start.x, end.y]]}
    if kind == pcbnew.SHAPE_T_CIRCLE:
        return {"layer": layer, "kind": "circle", "center": _point(item.GetStart()), "radius": int(item.GetRadius())}
    if kind == pcbnew.SHAPE_T_ARC:
        return {"layer": layer, "kind": "arc", "center": _point(item.GetCenter()),
                "start": _point(item.GetStart()), "end": _point(item.GetEnd()), "radius": int(item.GetRadius())}
    if kind == pcbnew.SHAPE_T_POLY:
        outline = item.GetPolyShape().Outline(0)
        return {"layer": layer, "kind": "poly",
                "points": [[outline.CPoint(i).x, outline.CPoint(i).y] for i in range(outline.PointCount())]}
    return {"layer": layer, "kind": "other", "shape": kind}


def footprint_geometry(footprint):
    footprint.SetPosition(ORIGIN)
    footprint.SetOrientationDegrees(0)
    pads = []
    for pad in footprint.Pads():
        position = pad.GetPosition()
        pads.append({"number": pad.GetNumber(), "x": int(position.x), "y": int(position.y),
                     "angle": round(pad.GetOrientationDegrees() % 180.0, 6),
                     "layers": pad.GetLayerSet().FmtHex(), "shape": int(pad.GetShape()),
                     "size": _point(pad.GetSize())})
    graphics = [shape_geometry(item) for item in footprint.GraphicalItems()]
    fields = []
    for field in footprint.GetFields():
        position = field.GetPosition()
        fields.append({"name": field.GetName(), "text": field.GetText(),
                       "x": int(position.x), "y": int(position.y),
                       "angle": round(field.GetTextAngleDegrees() % 180.0, 6),
                       "layer": field.GetLayerName()})
    return {"layer": footprint.GetLayerName(),
            "pads": sorted(pads, key=lambda pad: pad["number"]),
            "graphics": sorted(graphics, key=repr),
            "fields": sorted(fields, key=lambda field: field["name"])}


def _load(pretty_dir, name):
    board = pcbnew.CreateEmptyBoard()
    footprint = pcbnew.FootprintLoad(pretty_dir, name)
    if footprint is None:
        raise SystemExit("could not load %s from %s" % (name, pretty_dir))
    board.Add(footprint)
    return footprint


def prepare(lib_dir, name, workdir):
    os.makedirs(workdir, exist_ok=True)
    for side, angle in CASES:
        footprint = _load(lib_dir, name)
        footprint.SetPosition(pcbnew.VECTOR2I_MM(100, 100))
        footprint.SetOrientationDegrees(angle)
        if side == "back":
            footprint.Flip(footprint.GetPosition(), False)
        board = pcbnew.CreateEmptyBoard()
        board.Add(footprint)
        pcbnew.SaveBoard(os.path.join(workdir, "board-%s-%s.kicad_pcb" % (side, angle)), board)
    with open(os.path.join(workdir, "original.json"), "w") as handle:
        json.dump(footprint_geometry(_load(lib_dir, name)), handle)


def dump(manifest_path, out_path):
    with open(manifest_path) as handle:
        manifest = json.load(handle)
    base = os.path.dirname(os.path.abspath(out_path))
    plugin = pcbnew.PCB_IO_MGR.FindPlugin(pcbnew.PCB_IO_MGR.KICAD_SEXP)
    result = {}
    for label, entry in manifest.items():
        pretty, name = entry
        saved_dir = os.path.join(base, "resaved-%s.pretty" % label)
        os.makedirs(saved_dir, exist_ok=True)
        plugin.FootprintSave(saved_dir, _load(pretty, name))
        result[label] = footprint_geometry(_load(saved_dir, name))
    with open(out_path, "w") as handle:
        json.dump(result, handle)


def main(argv):
    if argv and argv[0] == "prepare" and len(argv) == 4:
        prepare(argv[1], argv[2], argv[3])
        return 0
    if argv and argv[0] == "dump" and len(argv) == 3:
        dump(argv[1], argv[2])
        return 0
    raise SystemExit("usage: probe <prepare|dump> ...")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
'''


def _kicad_python() -> str | None:
    """First interpreter that can import pcbnew: $PRISM_KICAD_PYTHON (a test-only override), else KiCad's."""
    candidates = [
        os.environ.get("PRISM_KICAD_PYTHON"),
        "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3",
    ]
    for candidate in candidates:
        if not candidate or not Path(candidate).is_file():
            continue
        try:
            probe = subprocess.run(
                [candidate, "-c", "import pcbnew"], capture_output=True, timeout=120
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if probe.returncode == 0:
            return candidate
    return None


KICAD_PYTHON = _kicad_python()


def _footprint_block(board_text: str) -> str:
    start = board_text.find('(footprint "')
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(board_text)):
        char = board_text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return board_text[start:index + 1]
    raise AssertionError("no footprint block found")


_QUANTUM = 1000  # 1 micrometre: finer than any placement can round, coarser than float noise.


def _quantise(value: int, step: int = _QUANTUM) -> int:
    return int(round(value / step)) * step


def _graphics_edges(graphics: list[dict]) -> tuple[set, set]:
    edges: set = set()
    circles: set = set()
    for item in graphics:
        if item["kind"] == "segment":
            start = tuple(_quantise(value) for value in item["start"])
            end = tuple(_quantise(value) for value in item["end"])
            edges.add(tuple(sorted((start, end))))
        elif item["kind"] == "poly":
            points = [tuple(_quantise(value) for value in point) for point in item["points"]]
            if points and points[0] == points[-1]:
                points = points[:-1]
            for index in range(len(points)):
                left, right = points[index], points[(index + 1) % len(points)]
                edges.add(tuple(sorted((left, right))))
        elif item["kind"] == "circle":
            circles.add((tuple(_quantise(value) for value in item["center"]), _quantise(item["radius"])))
    return edges, circles


def _differences(original: dict, candidate: dict) -> list[str]:
    """Geometry differences between two footprints, tolerant of writer rounding."""
    problems: list[str] = []
    if original["layer"] != candidate["layer"]:
        problems.append(f"layer {original['layer']} != {candidate['layer']}")
    if len(original["pads"]) != len(candidate["pads"]):
        problems.append(f"pad count {len(original['pads'])} != {len(candidate['pads'])}")
    else:
        for expected, actual in zip(original["pads"], candidate["pads"]):
            if expected["number"] != actual["number"]:
                problems.append(f"pad order {expected['number']} != {actual['number']}")
            elif abs(expected["x"] - actual["x"]) > _QUANTUM or abs(expected["y"] - actual["y"]) > _QUANTUM:
                problems.append(f"pad {expected['number']} position {expected['x'], expected['y']} != {actual['x'], actual['y']}")
            elif abs(expected["angle"] - actual["angle"]) > 0.01:
                problems.append(f"pad {expected['number']} angle {expected['angle']} != {actual['angle']}")
            elif expected["layers"] != actual["layers"] or expected["shape"] != actual["shape"]:
                problems.append(f"pad {expected['number']} layers/shape differ")
    expected_edges, expected_circles = _graphics_edges(original["graphics"])
    actual_edges, actual_circles = _graphics_edges(candidate["graphics"])
    if expected_edges != actual_edges:
        problems.append(
            f"graphics edges: only expected {sorted(expected_edges - actual_edges)}; "
            f"only found {sorted(actual_edges - expected_edges)}"
        )
    if expected_circles != actual_circles:
        problems.append(f"graphics circles {expected_circles} != {actual_circles}")
    for expected, actual in zip(original["fields"], candidate["fields"]):
        if (expected["name"], expected["text"], expected["layer"]) != (
            actual["name"], actual["text"], actual["layer"],
        ):
            problems.append(f"field {expected} != {actual}")
        elif (
            abs(expected["x"] - actual["x"]) > _QUANTUM
            or abs(expected["y"] - actual["y"]) > _QUANTUM
            or abs(expected["angle"] - actual["angle"]) > 0.01
        ):
            problems.append(f"field position/angle {expected} != {actual}")
    return problems


@unittest.skipUnless(
    KICAD_PYTHON,
    "no KiCad Python with pcbnew (set PRISM_KICAD_PYTHON to point at one)",
)
class FootprintRotationAcceptanceTests(unittest.TestCase):
    """A placed footprint must normalise back to the library footprint."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._temporary = tempfile.TemporaryDirectory(prefix="prism-fp-rotation-")
        cls.addClassCleanup(cls._temporary.cleanup)
        root = Path(cls._temporary.name)
        cls.probe = root / "kicad_fp_probe.py"
        cls.probe.write_text(PROBE, encoding="utf-8")
        cls.work = root / "work"
        cls.work.mkdir()

        cls._environment = mock.patch.dict(
            os.environ,
            {"PYTHONPATH": os.pathsep.join(filter(None, [str(BACKEND_ROOT), os.environ.get("PYTHONPATH")]))},
        )
        cls._environment.start()
        cls.addClassCleanup(cls._environment.stop)
        # The backend runs on KiCad's Python; a dev venv does not, so point the
        # normalizer's subprocess at the interpreter that imports pcbnew.
        cls._interpreter = mock.patch.object(normalizer, "_python_executable", return_value=KICAD_PYTHON)
        cls._interpreter.start()
        cls.addClassCleanup(cls._interpreter.stop)

        subprocess.run(
            [KICAD_PYTHON, str(cls.probe), "prepare", str(FIXTURE_LIBRARY), FOOTPRINT_NAME, str(cls.work)],
            check=True,
            capture_output=True,
        )
        cls.original = json.loads((cls.work / "original.json").read_text(encoding="utf-8"))
        cls.sanitized: dict[str, bytes] = {}
        cls.results: dict[str, object] = {}

        manifest: dict[str, list[str]] = {}
        for side, angle in CASES:
            label = f"{side}-{angle}"
            board_text = (cls.work / f"board-{side}-{float(angle)}.kicad_pcb").read_text(encoding="utf-8")
            target_name, payload, _models = _sanitize_footprint(
                _footprint_block(board_text), f"PrismFixture:{FOOTPRINT_NAME}"
            )
            cls.sanitized[label] = payload
            result = normalizer.normalize_footprint(payload, target_name)
            cls.results[label] = result
            pretty = root / f"normalized-{label}.pretty"
            pretty.mkdir()
            (pretty / f"{target_name}.kicad_mod").write_bytes(result.payload)
            manifest[label] = [str(pretty), target_name]

        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        dumped_path = root / "dump.json"
        subprocess.run(
            [KICAD_PYTHON, str(cls.probe), "dump", str(manifest_path), str(dumped_path)],
            check=True,
            capture_output=True,
        )
        cls.dumped = json.loads(dumped_path.read_text(encoding="utf-8"))

    def test_every_placement_normalises_to_the_library_footprint(self) -> None:
        for side, angle in CASES:
            with self.subTest(placement=f"{side}-{angle}"):
                self.assertEqual(_differences(self.original, self.dumped[f"{side}-{angle}"]), [])

    def test_the_cheap_pre_check_skips_a_front_placement_at_zero(self) -> None:
        # No placement angle is kept for a part at 0, so KiCad is never asked.
        payload = self.sanitized["front-0"]
        self.assertFalse(normalizer._looks_back_side(payload))
        self.assertEqual(normalizer._footprint_rotation_degrees(payload), 0.0)
        self.assertFalse(self.results["front-0"].changed)

    def test_a_rotated_front_placement_keeps_only_the_angle_and_is_rewritten(self) -> None:
        self.assertIn(b"(at 0 0 90)", self.sanitized["front-90"])
        result = self.results["front-90"]
        self.assertTrue(result.changed)
        self.assertFalse(result.flipped)
        self.assertTrue(result.rotated)
        self.assertEqual(result.rotation_degrees, 90.0)

    def test_a_back_placement_reports_the_flip_with_the_rotation(self) -> None:
        result = self.results["back-90"]
        self.assertTrue(result.changed)
        self.assertTrue(result.flipped)
        self.assertTrue(result.rotated)

    def test_a_back_placement_turned_fully_around_does_not_report_rotation(self) -> None:
        # A part placed at 180 on the back is stored at orientation 0: only the
        # flip is left to undo.
        result = self.results["back-180"]
        self.assertTrue(result.flipped)
        self.assertFalse(result.rotated)


if __name__ == "__main__":
    unittest.main()
