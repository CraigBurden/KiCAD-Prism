"""Capture today's assembly HLR projections with KiCad Cruncher 2026.9.7.

Runs `kicad-cruncher pcb-svg` exactly as Release Studio's
`backend/app/release_studio/documents/artwork.py` does: Prism's own
`documents/pcb-svg.config.json`, the two assembly views in one invocation,
`KIPRJMOD` set to the project directory, and the KiCad stock 3D model
directories the worker image exports. It runs in this Python process so two
wrappers can record, per footprint, the model, the pose and the projected
geometry *after* Cruncher's own dedupe and its footprint placement:

- `_render_footprint_hlr` gives every footprint, its first STEP model and its
  pose, whether or not the projection succeeds;
- `_projected_geometry_to_footprint_board_world` gives the geometry
  (`kicad_cruncher_pcb_svg_projection.py:133-196`).

The geometry is Cruncher's board world in millimetres: board X, and board Y
negated (`board_world_to_svg`, `kicad_cruncher_pcb_model_pose.py:118-131`).
The member is in KiCad's board frame (conventions.md: +y down), so the golden
negates Y and converts to nanometres, as `prism-kicad` does.

The golden is an `AssemblyHlrA0` member. A sidecar `assembly-hlr.capture.json`
records the exact inputs and both runtime versions, because today's runtime is
wn-geometer 2026.9.7 while `prism-kicad` runs 2026.9.19.

Usage (the backend venv that has kicad_cruncher 2026.9.7):

    python native/parity/hlr/capture_hlr.py \
        [--cases rs-synthetic,rs-usb-pd,rs-cynthion] \
        [--bundles DIR] [--out DIR] [--work DIR] \
        [--config PATH] [--model-dir VAR=DIR]... \
        [--geometer-exe PATH] [--suffix today]

`--geometer-exe` sets `GEOMETER_EXE`, which the Python `geometer` package
honours, so the same capture also runs against 2026.9.19 for the
runtime-change evidence (`compare_hlr.py` does that in a scratch directory).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import tempfile
import traceback
import zipfile
from collections.abc import Sequence
from pathlib import Path

SCHEMA = "prism.assembly_hlr.a0"
MEMBER = "models/assembly-hlr.json"
DEFAULT_BUNDLES = Path(
    "/private/tmp/claude-503/-Users-Swaroop-Personal-Projects/"
    "f336681f-9155-4f00-80ce-4ac48096d8c0/scratchpad/c3/bundles"
)
DEFAULT_CASES = ("rs-synthetic", "rs-usb-pd", "rs-cynthion")
RUST_GEOMETER_VERSION = "2026.9.19"
VIEWS = ("assembly_top_view", "assembly_bottom_view")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", default=",".join(DEFAULT_CASES))
    parser.add_argument("--bundles", type=Path, default=DEFAULT_BUNDLES)
    parser.add_argument("--out", type=Path, default=repo_root() / "native/parity/goldens")
    parser.add_argument("--work", type=Path, default=None)
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root() / "backend/app/release_studio/documents/pcb-svg.config.json",
    )
    parser.add_argument("--model-dir", action="append", default=[])
    parser.add_argument("--geometer-exe", default=None)
    parser.add_argument("--suffix", default="today")
    return parser.parse_args(argv)


def model_directories(values: Sequence[str]) -> dict[str, str]:
    directories: dict[str, str] = {}
    for value in values:
        name, _, directory = value.partition("=")
        if not name or not directory:
            raise SystemExit(f"--model-dir takes VAR=DIR, not {value!r}")
        directories[name] = directory
    if not directories:
        kicad = Path("/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels")
        for name in ("KICAD6_3DMODEL_DIR", "KICAD7_3DMODEL_DIR", "KICAD8_3DMODEL_DIR",
                     "KICAD9_3DMODEL_DIR", "KICAD10_3DMODEL_DIR"):
            directories[name] = str(kicad)
    return directories


def case_sources(bundle: Path, directory: Path) -> dict:
    """Unpack the bundle's `sources/` under `directory`; return its manifest."""
    with zipfile.ZipFile(bundle) as archive:
        manifest = json.loads(archive.read("bundle.json"))
        for name in archive.namelist():
            if not name.startswith("sources/"):
                continue
            target = directory / name[len("sources/"):]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    return manifest


def point_nm(point: Sequence[float]) -> dict[str, int]:
    # Cruncher's board world has +y up; KiCad's board frame has +y down.
    return {"xNm": int(round(float(point[0]) * 1_000_000)),
            "yNm": int(round(-float(point[1]) * 1_000_000))}


def convert_projected(projected) -> dict:
    """One `_AssemblyProjectedGeometry` as the member's two edge sets."""
    return {
        "outline": {
            "segments": [
                {"startNm": point_nm(start), "endNm": point_nm(end)}
                for start, end in projected.outline_line_segments
            ],
            "arcs": [_arc_nm(arc) for arc in projected.outline_arcs],
        },
        "detail": {
            "segments": [
                {"startNm": point_nm(start), "endNm": point_nm(end)}
                for start, end in projected.detail_line_segments
            ],
            "arcs": [_arc_nm(arc) for arc in projected.detail_arcs],
        },
    }


def _arc_nm(arc) -> dict:
    return {
        "startNm": point_nm(arc.start),
        "endNm": point_nm(arc.end),
        "centerNm": point_nm(arc.center),
        "radiusNm": int(round(float(arc.radius) * 1_000_000)),
        "extentDeg": math.degrees(float(arc.extent_rad)),
        "ccw": bool(arc.ccw),
        "fullCircle": bool(arc.full_circle),
    }


def options_document(options) -> dict:
    """`_AssemblyProjectionOptions` as the member's `/options`."""
    document: dict = {
        "outlineAlgorithm": options.outline_algorithm,
        "curveMode": options.curve_mode,
        "samplesPerCurve": int(max(2, options.samples_per_curve)),
        "roundDigits": int(max(0, options.round_digits)),
        "includeVisible": bool(options.include_visible),
        "includeOutline": bool(options.include_outline),
        "unionPolygons": bool(options.union_polygons),
    }
    if options.projection_algorithm:
        document["projectionAlgorithm"] = options.projection_algorithm
    if options.mesh_linear_deflection is not None:
        document["meshLinearDeflection"] = float(options.mesh_linear_deflection)
    if options.mesh_angular_deflection is not None:
        document["meshAngularDeflection"] = float(options.mesh_angular_deflection)
    if options.mesh_relative is not None:
        document["meshRelative"] = bool(options.mesh_relative)
    if options.hlr_angle_tolerance is not None:
        document["hlrAngleTolerance"] = float(options.hlr_angle_tolerance)
    if options.edge_flags:
        document["edgeFlags"] = {key: bool(options.edge_flags[key])
                                 for key in sorted(options.edge_flags)}
    return document


def capture_case(case: str, bundle: Path, out: Path, work: Path,
                 config: Path, model_dirs: dict[str, str], suffix: str,
                 geometer_exe: str | None) -> dict:
    import kicad_cruncher
    import kicad_cruncher.kicad_cruncher_cmd_pcb_svg as command
    import kicad_cruncher.kicad_cruncher_pcb_model_pose as pose_module
    from kicad_cruncher._cli import main as cruncher_main

    project = work / case
    if project.exists():
        shutil.rmtree(project)
    project.mkdir(parents=True)
    manifest = case_sources(bundle, project)
    board_rel = manifest["config"]["board"]
    board = project / board_rel
    workdir = work / f"{case}-views"
    workdir.mkdir(parents=True, exist_ok=True)

    records: dict[str, dict] = {}
    geometry: dict[str, object] = {}
    captured_options: list = []
    config_document = json.loads(config.read_text(encoding="utf-8"))
    baseline_options = command._assembly_projection_options(
        side="top", styles=(config_document.get("global") or {}).get("styles") or {}
    )

    original_transform = command._projected_geometry_to_footprint_board_world
    original_options = command._assembly_projection_options
    original_render = command._render_footprint_hlr

    def transform(projected, footprint):
        result = original_transform(projected, footprint)
        geometry[str(footprint.uuid)] = result
        return result

    def options(*args, **kwargs):
        result = original_options(*args, **kwargs)
        if not captured_options:
            captured_options.append(result)
        return result

    def render(pcb, pcb_path, footprint, **kwargs):
        uuid = str(footprint.uuid)
        geometry.pop(uuid, None)
        result = original_render(pcb, pcb_path, footprint, **kwargs)
        reference = ""
        try:
            reference = str(footprint.get_property_value("Reference", "") or "")
        except Exception:  # noqa: BLE001 - today's getter, best effort
            reference = ""
        models = list(getattr(footprint, "models", []) or [])
        step = command._first_step_model(footprint)
        record = {
            "uuid": uuid,
            "reference": reference,
            "side": "back" if str(getattr(footprint, "layer", "") or "").startswith("B.")
                    else "front",
            "models": models,
            "step": step,
            "pose": None,
            "positionNm": {
                "xNm": int(round(float(getattr(footprint, "at_x", 0.0) or 0.0) * 1_000_000)),
                "yNm": int(round(float(getattr(footprint, "at_y", 0.0) or 0.0) * 1_000_000)),
            },
            "rotationDeg": float(getattr(footprint, "at_angle", 0.0) or 0.0),
            "status": None,
            "geometry": None,
        }
        if models:
            if step is None:
                record["status"] = "model-not-step"
            else:
                step_bytes = command._resolve_model_step_bytes(pcb, footprint, step, pcb_path)
                if step_bytes is None:
                    record["status"] = "model-unavailable"
                else:
                    local = pose_module.kicad_model_local_pose(pcb, footprint, step)
                    record["pose"] = local
                    record["sha256"] = hashlib.sha256(step_bytes).hexdigest()
                    projected = geometry.get(uuid)
                    if projected is None:
                        record["status"] = "projection-failed"
                    else:
                        record["geometry"] = projected
        records[uuid] = record
        return result

    command._projected_geometry_to_footprint_board_world = transform
    command._assembly_projection_options = options
    command._render_footprint_hlr = render
    environment = {name: value for name, value in model_dirs.items()}
    environment["KIPRJMOD"] = str(project)
    previous = {name: os.environ.get(name) for name in environment}
    os.environ.update(environment)
    if geometer_exe:
        os.environ["GEOMETER_EXE"] = geometer_exe
    argv = ["kicad-cruncher", "pcb-svg", str(board), "--config", str(config),
            "--views", ",".join(VIEWS), "--output", str(workdir)]
    saved_argv = sys.argv
    sys.argv = argv
    try:
        try:
            code = cruncher_main()
        except SystemExit as exit_code:
            code = exit_code.code if isinstance(exit_code.code, int) else 1
    finally:
        sys.argv = saved_argv
        command._projected_geometry_to_footprint_board_world = original_transform
        command._assembly_projection_options = original_options
        command._render_footprint_hlr = original_render
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
    if code not in (0, None):
        raise SystemExit(f"{case}: kicad-cruncher pcb-svg exited {code}")

    import geometer

    document = {
        "schema": SCHEMA,
        "options": options_document(captured_options[0] if captured_options else baseline_options),
        "runtime": {"geometerVersion": geometer.version().string},
        "footprints": [],
    }
    for record in sorted(records.values(), key=lambda item: (board_rel, item["uuid"])):
        if not record["models"]:
            continue
        footprint: dict = {
            "documentPath": board_rel,
            "uuid": record["uuid"],
            "side": record["side"],
        }
        if record["reference"].strip():
            footprint["reference"] = record["reference"]
        if record["step"] is not None:
            model: dict = {"reference": str(record["step"].path)}
            if record.get("sha256"):
                model["sha256"] = record["sha256"]
            footprint["stepModel"] = model
        if record["geometry"] is not None:
            local = record["pose"]
            model = record["step"]
            footprint["pose"] = {
                "positionNm": record["positionNm"],
                "rotationDeg": record["rotationDeg"],
                "modelOffset": {
                    "xNm": int(round(float(model.offset[0]) * 1_000_000)),
                    "yNm": int(round(float(model.offset[1]) * 1_000_000)),
                    "zNm": int(round(float(model.offset[2]) * 1_000_000)),
                },
                "modelRotation": {
                    "xDeg": float(model.rotate[0]),
                    "yDeg": float(model.rotate[1]),
                    "zDeg": float(model.rotate[2]),
                },
                "modelScale": {
                    "x": float(model.scale[0]),
                    "y": float(model.scale[1]),
                    "z": float(model.scale[2]),
                },
            }
            footprint.update(convert_projected(record["geometry"]))
        else:
            footprint["status"] = record["status"]
        document["footprints"].append(footprint)
    target = out / case / f"assembly-hlr.{suffix}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, indent=1, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    sidecar = out / case / f"assembly-hlr.{suffix}.capture.json"
    sidecar.write_text(json.dumps({
        "case": case,
        "bundle": str(bundle),
        "documentPath": board_rel,
        "bundleSha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
        "config": str(config),
        "configSha256": hashlib.sha256(config.read_bytes()).hexdigest(),
        "views": list(VIEWS),
        "argv": argv[1:],
        "kicadCruncherVersion": getattr(kicad_cruncher, "__version__", ""),
        "geometerVersion": geometer.version().string,
        "geometerAbi": geometer.version().abi,
        "rustGeometerVersion": RUST_GEOMETER_VERSION,
        "modelDirs": model_dirs,
        "footprints": len(document["footprints"]),
        "statuses": _statuses(document["footprints"]),
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        "case": case,
        "golden": str(target),
        "sidecar": str(sidecar),
        "footprints": len(document["footprints"]),
        "statuses": _statuses(document["footprints"]),
        "geometer": geometer.version().string,
    }


def _statuses(footprints: Sequence[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for footprint in footprints:
        status = footprint.get("status", "projected")
        counts[status] = counts.get(status, 0) + 1
    return counts


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    directories = model_directories(args.model_dir)
    if not args.config.is_file():
        raise SystemExit(f"the pcb-svg config is missing: {args.config}")
    scratch = args.work or Path(tempfile.mkdtemp(prefix="prism-hlr-capture-"))
    scratch.mkdir(parents=True, exist_ok=True)
    if args.geometer_exe:
        os.environ["GEOMETER_EXE"] = args.geometer_exe
    results = []
    for case in [name.strip() for name in args.cases.split(",") if name.strip()]:
        try:
            results.append(capture_case(
                case, args.bundles / f"{case}.prism", args.out, scratch,
                args.config, directories, args.suffix, args.geometer_exe,
            ))
        except Exception:  # noqa: BLE001 - report which case failed, then stop
            traceback.print_exc()
            return 1
    print(json.dumps({"cases": results}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
