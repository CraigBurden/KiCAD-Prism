#!/usr/bin/env python3
"""Acceptance checks for `prism-kicad artwork` (ADR amendment C3 §4, §7 R3).

For each Release Studio fixture this script:

1. builds the bundle chain `parse -> board -> models` with the running
   `prism-kicad` and the pinned Geometer runtime (the same construction as
   `parity/hlr/compare_hlr.py`);
2. runs `prism-kicad artwork` for every view of both configuration files,
   twice, and requires byte-identical files and stdout;
3. checks that every placed designator's text box lies inside its body region
   (the HLR outline when present, else the pad envelope from `placements`),
   keeping half the body outline's stroke width clear of the drawn line, that
   every footprint the view's selector picks is drawn and labelled, and counts
   the labels drawn below the configured minimum font (as today's Cruncher
   does, a label shrinks to fit its body rather than being dropped);
4. for a callout view (assembly designators `callout: true`), checks that each
   label sits outside the pad at the minimum font, that its leader joins the
   label box to the pad, and reports how many label boxes overlap;
5. for a `board_and_bodies` canvas, checks that every label box, pad and body
   region stays inside the canvas and that the viewBox matches it;
6. for a bottom view with `mirror_bottom_view`, checks that the SVG records
   `data-view-direction="bottom-mirrored"`, and that a DNP hatch is drawn only
   for the DNP footprints the result document counts;
4. optionally (`--cruncher`) runs today's `kicad-cruncher pcb-svg` exactly as
   `backend/app/release_studio/documents/artwork.py` does and renders both
   SVGs beside each other to PNG under `--compare-dir`.

Usage (from native/):

    python parity/artwork/check_artwork.py \
        --prism-kicad <prism-kicad> --geometer <geometer-exe> \
        [--model-dir KICAD10_3DMODEL_DIR=<models>] \
        [--cases rs-synthetic,rs-usb-pd,rs-cynthion] \
        [--bundles DIR] [--work DIR] \
        [--cruncher <kicad-cruncher> --compare-dir DIR]

Exit 0 when every check passes, 1 when a check fails, 2 on a usage or tool
error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import zlib
from pathlib import Path

DEFAULT_BUNDLES = Path(
    "/private/tmp/claude-503/-Users-Swaroop-Personal-Projects/"
    "f336681f-9155-4f00-80ce-4ac48096d8c0/scratchpad/c3/bundles-m"
)
DEFAULT_CASES = ("rs-synthetic", "rs-usb-pd", "rs-cynthion")
DEFAULT_COMPARE = Path(
    "/private/tmp/claude-503/-Users-Swaroop-Personal-Projects/"
    "f336681f-9155-4f00-80ce-4ac48096d8c0/scratchpad/c3/artwork-compare"
)
RECORDINGS = {
    "rs-synthetic": ("fixtures/release-studio/synthetic", "synthetic.kicad_pcb"),
    "rs-usb-pd": ("fixtures/release-studio/usb-pd", "USB-PD-Trigger-Board.kicad_pcb"),
    "rs-cynthion": ("fixtures/release-studio/cynthion", "cynthion.kicad_pcb"),
}
CONFIGS = (
    ("assembly", "configs/assembly.json", "pcb-svg.config.json"),
    ("testpoints", "configs/testpoints.json", "pcb-svg.testpoints.config.json"),
)
TEXT_ADVANCE = 0.62


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def native_root() -> Path:
    return repo_root() / "native"


def parse_args(argv) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", default=",".join(DEFAULT_CASES))
    parser.add_argument("--bundles", type=Path, default=DEFAULT_BUNDLES)
    parser.add_argument("--work", type=Path, default=None)
    parser.add_argument("--compare-dir", type=Path, default=DEFAULT_COMPARE)
    parser.add_argument("--prism-kicad", required=True)
    parser.add_argument("--geometer", required=True)
    parser.add_argument("--model-dir", action="append", default=[])
    parser.add_argument("--kicad-version", default="10.0.6")
    parser.add_argument("--cruncher", default=None)
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args(argv)


def run(argv, *, expect=(0,), env=None):
    result = subprocess.run(argv, capture_output=True, text=True, env=env)
    if result.returncode not in expect:
        raise SystemExit(
            f"{' '.join(map(str, argv))} exited {result.returncode}\n"
            f"stdout:\n{result.stdout[-4000:]}\nstderr:\n{result.stderr[-4000:]}"
        )
    return result


def model_directories(values):
    directories = {}
    for value in values:
        name, _, directory = value.partition("=")
        if not name or not directory:
            raise SystemExit(f"--model-dir takes VAR=DIR, not {value!r}")
        directories[name] = directory
    if not directories:
        models = Path("/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels")
        for name in ("KICAD6_3DMODEL_DIR", "KICAD9_3DMODEL_DIR", "KICAD10_3DMODEL_DIR"):
            directories[name] = str(models)
    return directories


def unpack(bundle: Path, directory: Path) -> dict:
    import zipfile

    if directory.exists():
        shutil.rmtree(directory)
    directory.mkdir(parents=True)
    with zipfile.ZipFile(bundle) as archive:
        manifest = json.loads(archive.read("bundle.json"))
        for name in archive.namelist():
            if not name.startswith("sources/"):
                continue
            target = directory / name[len("sources/") :]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    return manifest


def recording(case: str, name: str, destination: Path) -> Path:
    directory, _ = RECORDINGS[case]
    source = (
        native_root()
        / "src/rs/prism-kicad-cli/tests/fixtures/recordings"
        / directory
        / f"{name}.zlib"
    )
    if not source.is_file():
        raise SystemExit(f"no recording for {case}: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(zlib.decompress(source.read_bytes()))
    return destination


def build_bundle(args, case: str, work: Path, directories) -> Path:
    bundle = args.bundles / f"{case}.prism"
    if not bundle.is_file():
        raise SystemExit(f"no case bundle: {bundle}")
    case_dir = work / case
    manifest = unpack(bundle, case_dir / "sources")
    project = case_dir / "sources" / manifest["config"]["project_file"]
    board = recording(case, RECORDINGS[case][1], case_dir / "refilled.kicad_pcb")
    glb = recording(case, "components.glb", case_dir / "components.glb")
    parse = case_dir / "parse.prism"
    board_bundle = case_dir / "board.prism"
    models = case_dir / "models.prism"
    if args.skip_build and models.is_file():
        return models
    run(
        [
            args.prism_kicad,
            "bundle",
            "build",
            str(project),
            "--stage",
            "parse",
            "--source-root",
            str(case_dir / "sources"),
            "-o",
            str(parse),
            "--quiet",
        ]
    )
    run(
        [
            args.prism_kicad,
            "bundle",
            "build",
            "--stage",
            "board",
            "--in",
            str(parse),
            "--refilled-board",
            str(board),
            "--refill-tool",
            args.kicad_version,
            "-o",
            str(board_bundle),
            "--quiet",
        ]
    )
    argv = [
        args.prism_kicad,
        "bundle",
        "build",
        "--stage",
        "models",
        "--in",
        str(board_bundle),
        "--models-glb",
        str(glb),
        "--models-tool",
        args.kicad_version,
        "--geometer",
        args.geometer,
        "--hlr-cache",
        str(case_dir / "hlr-cache"),
        "-o",
        str(models),
        "--quiet",
    ]
    for name, directory in directories.items():
        argv.extend(["--model-dir", f"{name}={directory}"])
    run(argv)
    return models


# --------------------------------------------------------------- members


def member(bundle: Path, path: str):
    import zipfile

    with zipfile.ZipFile(bundle) as archive:
        return json.loads(archive.read(path))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# -------------------------------------------------------------- geometry


def nm(value: int) -> float:
    return float(value) / 1_000_000.0


def arc_points(arc):
    center = (nm(arc["centerNm"]["xNm"]), nm(arc["centerNm"]["yNm"]))
    start = (nm(arc["startNm"]["xNm"]), nm(arc["startNm"]["yNm"]))
    radius = nm(arc["radiusNm"])
    if arc.get("fullCircle"):
        return [
            (
                center[0] + math.cos(2 * math.pi * index / 64) * radius,
                center[1] + math.sin(2 * math.pi * index / 64) * radius,
            )
            for index in range(64)
        ]
    start_angle = math.atan2(start[1] - center[1], start[0] - center[0])
    extent = math.radians(arc["extentDeg"]) * (1.0 if arc["ccw"] else -1.0)
    steps = max(2, int(math.ceil(abs(extent) / (math.pi / 24.0))))
    return [
        (
            center[0] + math.cos(start_angle + extent * index / steps) * radius,
            center[1] + math.sin(start_angle + extent * index / steps) * radius,
        )
        for index in range(steps + 1)
    ]


def key(point):
    return (round(point[0] * 1_000_000.0), round(point[1] * 1_000_000.0))


def assemble_rings(edges):
    adjacency = {}
    for index, edge in enumerate(edges):
        adjacency.setdefault(key(edge[0]), []).append(index)
        adjacency.setdefault(key(edge[-1]), []).append(index)
    visited = [False] * len(edges)
    rings = []
    for start_index, start in enumerate(edges):
        if visited[start_index]:
            continue
        start_key = key(start[0])
        points = list(start)
        current = key(start[-1])
        visited[start_index] = True
        while current != start_key:
            next_index = next(
                (index for index in adjacency.get(current, []) if not visited[index]),
                None,
            )
            if next_index is None:
                break
            edge = edges[next_index]
            oriented = edge if key(edge[0]) == current else list(reversed(edge))
            points.extend(oriented[1:])
            current = key(oriented[-1])
            visited[next_index] = True
        if current == start_key and len(points) >= 3:
            rings.append(points)
    return rings


def hlr_rings(footprint):
    edges = []
    outline = footprint.get("outline") or {}
    for segment in outline.get("segments", []):
        edges.append(
            [
                (nm(segment["startNm"]["xNm"]), nm(segment["startNm"]["yNm"])),
                (nm(segment["endNm"]["xNm"]), nm(segment["endNm"]["yNm"])),
            ]
        )
    for arc in outline.get("arcs", []):
        edges.append(arc_points(arc))
    rings = assemble_rings([edge for edge in edges if len(edge) >= 2])
    if rings:
        return rings
    points = [point for edge in edges for point in edge]
    if len(points) < 3:
        return []
    points = sorted(set(points))
    hull = []

    def cross(origin, left, right):
        return (left[0] - origin[0]) * (right[1] - origin[1]) - (
            left[1] - origin[1]
        ) * (right[0] - origin[0])

    for point in points:
        while len(hull) >= 2 and cross(hull[-2], hull[-1], point) <= 0:
            hull.pop()
        hull.append(point)
    lower = len(hull) + 1
    for point in reversed(points):
        while len(hull) >= lower and cross(hull[-2], hull[-1], point) <= 0:
            hull.pop()
        hull.append(point)
    hull.pop()
    return [hull]


def point_in_rings(point, rings) -> bool:
    inside = False
    x, y = point
    for ring in rings:
        previous = ring[-1]
        for current in ring:
            if (current[1] > y) != (previous[1] > y):
                crossing = (previous[0] - current[0]) * (y - current[1]) / (
                    previous[1] - current[1]
                ) + current[0]
                if x < crossing:
                    inside = not inside
            previous = current
    return inside


def distance_to_segment(point, start, end) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    length_squared = dx * dx + dy * dy
    if length_squared <= 1e-18:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_squared))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def point_clears_rings(point, rings, margin: float) -> bool:
    """True when `point` is inside `rings` and `margin` away from their edges."""
    if not point_in_rings(point, rings):
        return False
    if margin <= 0.0:
        return True
    for ring in rings:
        previous = ring[-1]
        for current in ring:
            if distance_to_segment(point, previous, current) < margin - 1e-9:
                return False
            previous = current
    return True


def pad_envelope(footprint) -> list:
    points = []
    for pad in footprint.get("pads", []):
        x = nm(pad["positionNm"]["xNm"])
        y = nm(pad["positionNm"]["yNm"])
        half = max(nm(pad["size"]["xNm"]), nm(pad["size"]["yNm"])) / 2.0
        points.extend([(x - half, y - half), (x + half, y + half)])
    if not points:
        return []
    min_x = min(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_x = max(point[0] for point in points)
    max_y = max(point[1] for point in points)
    return [[(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)]]


def text_corners(attrs: dict) -> list:
    x = float(attrs["x"])
    y = float(attrs["y"])
    font = float(attrs["data-font-size-mm"])
    rotation = math.radians(float(attrs.get("data-rotation-deg", "0")))
    text_length = int(attrs.get("data-text-length", "1"))
    half_width = text_length * TEXT_ADVANCE * font / 2.0
    half_height = font / 2.0
    corners = []
    for local_x, local_y in (
        (-half_width, -half_height),
        (half_width, -half_height),
        (half_width, half_height),
        (-half_width, half_height),
    ):
        corners.append(
            (
                x + local_x * math.cos(rotation) - local_y * math.sin(rotation),
                y + local_x * math.sin(rotation) + local_y * math.cos(rotation),
            )
        )
    return corners


# ------------------------------------------------------------- selectors


def style_block(config: dict, view: dict) -> dict:
    merged = dict(config["global"]["styles"].get("assembly_designators") or {})
    merged.update((view.get("styles") or {}).get("assembly_designators") or {})
    return merged


def selector_enabled(reference: str | None, selectors: dict) -> bool:
    if not selectors:
        return True
    reference = (reference or "").strip().upper()
    matched = None
    for selector, override in selectors.items():
        if matches(reference, selector):
            matched = override
    return bool(matched and matched.get("enabled"))


def matches(designator: str, selector: str) -> bool:
    raw = selector.strip().upper()
    if not raw:
        return False
    if raw.endswith("*"):
        return designator.startswith(raw[:-1])
    if raw.isalpha():
        return designator.startswith(raw)
    match = re.fullmatch(r"([A-Z]+)(\d+)-([A-Z]+)(\d+)", raw)
    if match:
        prefix_a, start, prefix_b, end = match.groups()
        if prefix_a != prefix_b:
            return False
        designator_match = re.match(r"([A-Z]+)(\d+)", designator)
        if not designator_match:
            return False
        prefix, number = designator_match.groups()
        return prefix == prefix_a and min(int(start), int(end)) <= int(number) <= max(
            int(start), int(end)
        )
    return designator == raw


def min_font(config: dict, view: dict) -> float:
    return float(style_block(config, view).get("min_font_size_mm", 0.35))


def hlr_stroke_mm(config: dict, view: dict, reference: str | None) -> float:
    """The stroke the footprint's body outline is drawn with, in millimetres.

    `--paper-scale` divides the configured width before drawing; this check
    runs the config unscaled, so the configured width is the drawn width.
    """
    merged = dict(config["global"]["styles"].get("assembly_hlr") or {})
    merged.update((view.get("styles") or {}).get("assembly_hlr") or {})
    component = (config.get("components") or {}).get(reference or "") or {}
    merged.update(component.get("assembly_hlr") or {})
    if not merged.get("enabled", True) or not merged.get("include_outline", True):
        return 0.0
    return float(merged.get("line_width_mm", 0.12))


def selected_by_side(config, view, placements):
    selectors = style_block(config, view).get("selector_overrides") or {}
    side = "back" if "BOTTOM" in " ".join(view["layers"]) else "front"
    return [
        footprint
        for footprint in placements["footprints"]
        if footprint["side"] == side
        and selector_enabled(footprint.get("reference"), selectors)
    ]


# --------------------------------------------------------------- checks


TEXT = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.DOTALL)
SVG = re.compile(r"<svg\b([^>]*)>", re.DOTALL)
LEADER = re.compile(r"<line\b([^>]*)/>")
ATTR = re.compile(r'([a-zA-Z0-9_:-]+)="([^"]*)"')
DNP_GROUP = '<g data-dnp="true"'


def attributes(raw: str) -> dict:
    return dict(ATTR.findall(raw))


def label_box(attrs: dict) -> tuple:
    """A label's box from its emitted `data-text-box-*` attributes.

    The attributes are the authoritative box: a callout label is placed by the
    renderer, and a mirrored view's box is already mirrored.
    """
    if "data-text-box-min-x" in attrs:
        return (
            float(attrs["data-text-box-min-x"]),
            float(attrs["data-text-box-min-y"]),
            float(attrs["data-text-box-max-x"]),
            float(attrs["data-text-box-max-y"]),
        )
    corners = text_corners(attrs)
    return (
        min(point[0] for point in corners),
        min(point[1] for point in corners),
        max(point[0] for point in corners),
        max(point[1] for point in corners),
    )


def boxes_overlap(left: tuple, right: tuple, epsilon: float = 1e-6) -> bool:
    return (
        left[0] < right[2] - epsilon
        and right[0] < left[2] - epsilon
        and left[1] < right[3] - epsilon
        and right[1] < left[3] - epsilon
    )


def inside_box(point: tuple, box: tuple, epsilon: float = 0.05) -> bool:
    return (
        box[0] - epsilon <= point[0] <= box[2] + epsilon
        and box[1] - epsilon <= point[1] <= box[3] + epsilon
    )


def canvas_of(svg: str) -> dict:
    match = SVG.search(svg)
    attrs = attributes(match.group(1))
    return {
        "min_x": float(attrs["data-canvas-min-x"]),
        "min_y": float(attrs["data-canvas-min-y"]),
        "max_x": float(attrs["data-canvas-max-x"]),
        "max_y": float(attrs["data-canvas-max-y"]),
        "direction": attrs.get("data-view-direction", ""),
        "view_box": attrs["viewBox"],
    }


def mirror_rings(rings: list, mirrored: bool) -> list:
    """Body rings read in the board frame; a mirrored view draws x -> -x."""
    if not mirrored:
        return rings
    return [[(-x, y) for x, y in ring] for ring in rings]


def pad_boxes(footprint: dict, mirrored: bool) -> list:
    """Each pad's square extent, from the footprint's placement."""
    boxes = []
    for pad in footprint.get("pads", []):
        x = nm(pad["positionNm"]["xNm"])
        if mirrored:
            x = -x
        y = nm(pad["positionNm"]["yNm"])
        half = max(nm(pad["size"]["xNm"]), nm(pad["size"]["yNm"])) / 2.0
        boxes.append((x - half, y - half, x + half, y + half))
    return boxes


def check_view(
    case: str,
    config_name: str,
    config: dict,
    view: dict,
    svg: str,
    result_view: dict,
    hlr: dict,
    placements: dict,
    failures: list,
) -> dict:
    hlr_by_uuid = {footprint["uuid"]: footprint for footprint in hlr["footprints"]}
    placements_by_uuid = {
        footprint["uuid"]: footprint for footprint in placements["footprints"]
    }
    root = canvas_of(svg)
    mirrored = root["direction"] == "bottom-mirrored"
    style = style_block(config, view)
    callout = bool(style.get("callout"))
    texts = []
    for raw, text in TEXT.findall(svg):
        attrs = attributes(raw)
        if attrs.get("data-primitive") != "assembly-designator":
            continue
        attrs["data-text-length"] = str(len(text))
        texts.append((attrs, text))
    minimum = min_font(config, view)
    fallback = 0
    below_minimum = 0
    callouts = 0
    for attrs, _text in texts:
        font = float(attrs["data-font-size-mm"])
        if font + 1e-9 < minimum:
            below_minimum += 1
        if attrs.get("data-callout") == "true":
            callouts += 1
            if font + 1e-9 < minimum:
                failures.append(
                    f"{case} {config_name} {view['name']}: callout "
                    f"{attrs['data-component']} is {font} mm, below the {minimum} mm minimum"
                )
            continue
        uuid = attrs.get("data-footprint-uuid", "")
        footprint = hlr_by_uuid.get(uuid)
        rings = mirror_rings(hlr_rings(footprint), mirrored) if footprint else []
        if not rings:
            fallback += 1
            placement = placements_by_uuid.get(uuid)
            rings = (
                mirror_rings(pad_envelope(placement), mirrored) if placement else []
            )
        corners = text_corners(attrs)
        if not rings:
            failures.append(
                f"{case} {config_name} {view['name']}: {attrs['data-component']} "
                "has no body region"
            )
            continue
        # The body region is stroked, so half that stroke sits inside it. A
        # label must clear it or it prints through the line.
        margin = hlr_stroke_mm(config, view, attrs.get("data-component")) / 2.0
        for corner in corners:
            if not point_clears_rings(corner, rings, margin):
                failures.append(
                    f"{case} {config_name} {view['name']}: {attrs['data-component']} "
                    f"text box corner {corner} does not lie inside its body inset by "
                    f"half the {2.0 * margin:.3f} mm outline"
                )
                break

    # Every callout label has one leader that joins its box to its pad.
    leaders = {}
    for raw in LEADER.findall(svg):
        attrs = attributes(raw)
        if attrs.get("data-primitive") != "callout-leader":
            continue
        leaders.setdefault(attrs.get("data-footprint-uuid", ""), []).append(attrs)
    boxes = [(attrs, label_box(attrs)) for attrs, _text in texts]
    overlapping = 0
    for index, (_attrs, box) in enumerate(boxes):
        for _other_attrs, other in boxes[index + 1 :]:
            if boxes_overlap(box, other):
                overlapping += 1
    if callout:
        for attrs, box in boxes:
            if attrs.get("data-callout") != "true":
                continue
            uuid = attrs.get("data-footprint-uuid", "")
            found = leaders.get(uuid, [])
            if len(found) != 1:
                failures.append(
                    f"{case} {config_name} {view['name']}: callout "
                    f"{attrs['data-component']} has {len(found)} leader lines"
                )
                continue
            line = found[0]
            label_end = (float(line["x1"]), float(line["y1"]))
            pad_end = (float(line["x2"]), float(line["y2"]))
            if not inside_box(label_end, box, 0.02):
                failures.append(
                    f"{case} {config_name} {view['name']}: the leader of "
                    f"{attrs['data-component']} does not touch its label box"
                )
            placement = placements_by_uuid.get(uuid)
            pad_shapes = pad_boxes(placement, mirrored) if placement else []
            if not pad_shapes or not any(
                inside_box(pad_end, pad, 0.2) for pad in pad_shapes
            ):
                failures.append(
                    f"{case} {config_name} {view['name']}: the leader of "
                    f"{attrs['data-component']} does not reach its pad"
                )
        reported = sum(
            1 for attrs, _box in boxes if attrs.get("data-overlapping") == "true"
        )
        if reported != overlapping:
            failures.append(
                f"{case} {config_name} {view['name']}: reports {reported} overlapping "
                f"labels, {overlapping} boxes overlap"
            )

    layers = view["layers"]
    has_bottom = any(token.endswith("_BOTTOM") for token in layers)
    has_top = any(token.endswith("_TOP") for token in layers)
    want_mirrored = bool(
        has_bottom and not has_top and config["global"]["mirror_bottom_view"]
    )
    expected_direction = "bottom-mirrored" if want_mirrored else "top"
    if root["direction"] != expected_direction:
        failures.append(
            f"{case} {config_name} {view['name']}: data-view-direction is "
            f"{root['direction']!r}, expected {expected_direction!r}"
        )

    selected = selected_by_side(config, view, placements)
    expected = [
        footprint
        for footprint in selected
        if footprint["uuid"] in hlr_by_uuid
        or placements_by_uuid[footprint["uuid"]].get("pads")
    ]
    if result_view["footprints_drawn"] != len(expected):
        failures.append(
            f"{case} {config_name} {view['name']}: drew "
            f"{result_view['footprints_drawn']} footprints, expected {len(expected)}"
        )
    body_uuids = set(
        re.findall(r'<g data-component="[^"]*" data-footprint-uuid="([^"]+)"', svg)
    )
    placed_designators = {
        attrs.get("data-footprint-uuid", "") for attrs, _text in texts
    }
    for footprint in expected:
        if footprint["uuid"] not in body_uuids and footprint["uuid"] not in placed_designators:
            failures.append(
                f"{case} {config_name} {view['name']}: selected footprint "
                f"{footprint.get('reference')} is not drawn"
            )
        if footprint.get("reference") and footprint["uuid"] not in placed_designators:
            failures.append(
                f"{case} {config_name} {view['name']}: selected footprint "
                f"{footprint.get('reference')} has no designator"
            )

    dnp_groups = svg.count(DNP_GROUP)
    if result_view.get("dnp_footprints_hatched") != dnp_groups:
        failures.append(
            f"{case} {config_name} {view['name']}: result says "
            f"{result_view.get('dnp_footprints_hatched')} DNP hatches, the SVG has {dnp_groups}"
        )

    canvas = (root["min_x"], root["min_y"], root["max_x"], root["max_y"])
    if config["global"]["canvas"]["bounds"] == "board_and_bodies":
        for attrs, box in boxes:
            if not inside_box((box[0], box[1]), canvas, 1e-6) or not inside_box(
                (box[2], box[3]), canvas, 1e-6
            ):
                failures.append(
                    f"{case} {config_name} {view['name']}: label box {box} of "
                    f"{attrs['data-component']} leaves the canvas {canvas}"
                )
        for footprint in expected:
            for pad_box in pad_boxes(footprint, mirrored):
                if not inside_box((pad_box[0], pad_box[1]), canvas, 1e-6) or not inside_box(
                    (pad_box[2], pad_box[3]), canvas, 1e-6
                ):
                    failures.append(
                        f"{case} {config_name} {view['name']}: a pad of "
                        f"{footprint.get('reference')} leaves the canvas"
                    )
                    break
            body = hlr_by_uuid.get(footprint["uuid"])
            for ring in mirror_rings(hlr_rings(body), mirrored) if body else []:
                if any(
                    not inside_box(point, canvas, 1e-6) for point in ring
                ):
                    failures.append(
                        f"{case} {config_name} {view['name']}: the body of "
                        f"{footprint.get('reference')} leaves the canvas"
                    )
                    break
        view_width, view_height = (
            float(value) for value in root["view_box"].split()[2:]
        )
        scale = float(config["global"]["svg_scale"])
        if abs(view_width - (canvas[2] - canvas[0]) * scale) > 1e-3 or abs(
            view_height - (canvas[3] - canvas[1]) * scale
        ) > 1e-3:
            failures.append(
                f"{case} {config_name} {view['name']}: viewBox {root['view_box']} "
                "does not match the canvas and scale"
            )

    return {
        "texts": len(texts),
        "callouts": callouts,
        "overlapping": overlapping,
        "dnp": dnp_groups,
        "below_minimum": below_minimum,
        "fallback_regions": fallback,
        "selected": len(selected),
        "expected_drawn": len(expected),
        "drawn": result_view["footprints_drawn"],
        "drawn_uuids": len(body_uuids),
        "canvas": (round(canvas[2] - canvas[0], 3), round(canvas[3] - canvas[1], 3)),
        "direction": root["direction"],
    }


# ---------------------------------------------------------- visual compare


def find_svg(directory: Path, view: str) -> Path | None:
    matches = sorted(directory.rglob(f"*{view}*.svg"))
    return matches[0] if matches else None


def render_png(svg: Path, directory: Path) -> Path | None:
    if shutil.which("qlmanage") is None:
        return None
    result = subprocess.run(
        ["qlmanage", "-t", "-s", "2000", "-o", str(directory), str(svg)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    candidate = directory / f"{svg.name}.png"
    return candidate if candidate.is_file() else None


def testpoint_board(board: Path, workdir: Path) -> Path:
    """Release Studio's testpoint staging board (`_stage_testpoint_board`).

    Cruncher 2026.9.7 reads designators from the `Reference` property and uses
    `selector_overrides` only for labels, so today's testpoint view ran on a
    filtered board. Reproduce that staging so the visual comparison is fair.
    """

    try:
        from kicad_monkey.kicad_pcb import KiCadPcb
    except Exception:
        return board
    pcb = KiCadPcb.from_file(board)
    retained = []
    for footprint in getattr(pcb, "footprints", ()) or ():
        reference = ""
        getter = getattr(footprint, "get_property_value", None)
        if callable(getter):
            reference = str(getter("Reference", "") or "").strip()
        if not reference:
            for text in getattr(footprint, "fp_texts", ()) or ():
                if str(getattr(text, "text_type", "") or "").lower() == "reference":
                    reference = str(getattr(text, "text", "") or "").strip()
                    if reference:
                        break
        if not reference.upper().startswith("TP"):
            continue
        upsert = getattr(footprint, "upsert_property", None)
        if callable(upsert):
            upsert("Reference", reference)
        retained.append(footprint)
    pcb.footprints = retained
    destination = workdir / f"{board.stem}.testpoints.kicad_pcb"
    pcb.save(destination)
    return destination


def compare_today(args, case: str, case_dir: Path, views_by_config, failures):
    sources = case_dir / "sources"
    board_name = RECORDINGS[case][1]
    board = sources / board_name
    if not board.is_file():
        failures.append(f"{case}: today's comparison has no source board {board}")
        return
    destination = args.compare_dir / case
    destination.mkdir(parents=True, exist_ok=True)
    documents = repo_root() / "backend/app/release_studio/documents"
    for config_name, _prism_config, cruncher_config in CONFIGS:
        for view in views_by_config[config_name]:
            today_dir = case_dir / "today" / config_name
            if today_dir.exists():
                shutil.rmtree(today_dir)
            today_dir.mkdir(parents=True)
            env = dict(__import__("os").environ)
            env["KIPRJMOD"] = str(sources.resolve())
            today_board = (
                testpoint_board(board, case_dir)
                if config_name == "testpoints"
                else board
            )
            run(
                [
                    args.cruncher,
                    "pcb-svg",
                    str(today_board),
                    "--config",
                    str(documents / cruncher_config),
                    "--views",
                    view,
                    "--output",
                    str(today_dir),
                ],
                env=env,
            )
            ours = case_dir / "artwork" / config_name / "run1" / view / f"{view}.svg"
            theirs = find_svg(today_dir, view)
            if theirs is None:
                failures.append(f"{case} {view}: today's Cruncher wrote no SVG")
                continue
            shutil.copyfile(ours, destination / f"{config_name}__{view}.prism.svg")
            shutil.copyfile(theirs, destination / f"{config_name}__{view}.today.svg")
            for svg, side in ((ours, "prism"), (theirs, "today")):
                png = render_png(svg, destination)
                if png is not None:
                    png.replace(destination / f"{config_name}__{view}.{side}.png")


# ------------------------------------------------------------------ main


def main(argv) -> int:
    args = parse_args(argv)
    cases = [case for case in args.cases.split(",") if case]
    work = args.work or (DEFAULT_COMPARE.parent / "artwork-work")
    work.mkdir(parents=True, exist_ok=True)
    directories = model_directories(args.model_dir)
    failures: list[str] = []
    summaries = []
    views_by_config = {}
    for name, relative, _today in CONFIGS:
        config = json.loads((native_root() / "src/rs/prism-artwork" / relative).read_text())
        views_by_config[name] = [
            view["name"] for view in config["views"] if view.get("enabled", True)
        ]

    for case in cases:
        models = build_bundle(args, case, work, directories)
        hlr = member(models, "models/assembly-hlr.json")
        placements = member(models, "projections/placements.json")
        case_dir = work / case
        for config_name, relative, _today in CONFIGS:
            config_path = native_root() / "src/rs/prism-artwork" / relative
            config = json.loads(config_path.read_text())
            for view in config["views"]:
                if not view.get("enabled", True):
                    continue
                results = []
                for run_index in (1, 2):
                    output = (
                        case_dir
                        / "artwork"
                        / config_name
                        / f"run{run_index}"
                        / view["name"]
                    )
                    if output.exists():
                        shutil.rmtree(output)
                    output.mkdir(parents=True)
                    argv_artwork = [
                        args.prism_kicad,
                        "artwork",
                        "--in",
                        str(models),
                        "--config",
                        str(config_path),
                        "--view",
                        view["name"],
                        "-o",
                        str(output),
                    ]
                    result = run(argv_artwork)
                    results.append((output, result.stdout))
                first, second = results
                first_file = first[0] / f"{view['name']}.svg"
                second_file = second[0] / f"{view['name']}.svg"
                if first[1] != second[1]:
                    failures.append(f"{case} {config_name} {view['name']}: stdout differs")
                if first_file.read_bytes() != second_file.read_bytes():
                    failures.append(f"{case} {config_name} {view['name']}: SVG differs")
                document = json.loads(first[1])
                result_view = next(
                    entry for entry in document["views"] if entry["name"] == view["name"]
                )
                if result_view["sha256"] != sha256(first_file.read_bytes()):
                    failures.append(
                        f"{case} {config_name} {view['name']}: result sha256 is wrong"
                    )
                summary = check_view(
                    case,
                    config_name,
                    config,
                    view,
                    first_file.read_text(),
                    result_view,
                    hlr,
                    placements,
                    failures,
                )
                summary.update(
                    {
                        "case": case,
                        "config": config_name,
                        "view": view["name"],
                        "deterministic": first[1] == second[1]
                        and first_file.read_bytes() == second_file.read_bytes(),
                    }
                )
                summaries.append(summary)
                print(
                    f"{case:12} {config_name:11} {view['name']:22} "
                    f"drawn={summary['drawn']}/{summary['expected_drawn']} "
                    f"labels={summary['texts']} callouts={summary['callouts']} "
                    f"overlapping={summary['overlapping']} dnp={summary['dnp']} "
                    f"below-min={summary['below_minimum']} fallback={summary['fallback_regions']} "
                    f"canvas={summary['canvas'][0]}x{summary['canvas'][1]} "
                    f"direction={summary['direction']} "
                    f"deterministic={summary['deterministic']}"
                )

    if args.cruncher:
        for case in cases:
            compare_today(args, case, work / case, views_by_config, failures)

    if failures:
        print("\nFAIL", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1
    print("\nOK: every artwork check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
