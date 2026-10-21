"""Parity: `models/assembly-hlr.json` against today's Cruncher projections.

For each case it builds the bundle chain `parse -> board -> models` with
`prism-kicad` (stage `models` with `--geometer`), extracts
`models/assembly-hlr.json`, and compares it with
`goldens/<case>/assembly-hlr.today.json` from `capture_hlr.py`:

- the same footprint set and the same per-footprint statuses;
- per edge set, the same segments and arcs, order-insensitive, within
  **1e-6 mm** (points and arc radii). Arc extents are compared within
  1e-6 degrees.

When a case differs, the harness also captures the same case with today's
Cruncher running the *Rust* Geometer release (`--geometer-exe`, i.e.
`GEOMETER_EXE`) and compares the member with that capture. A member equal
there proves the difference against `today` is the runtime change, not the
Rust producer (today's runtime is wn-geometer 2026.9.7; `prism-kicad` runs
2026.9.19).

Usage (from native/):

    python parity/hlr/compare_hlr.py \
        --prism-kicad <prism-kicad> --geometer <geometer-exe> \
        --model-dir KICAD10_3DMODEL_DIR=<models> \
        [--cases rs-synthetic,rs-usb-pd,rs-cynthion] \
        [--bundles DIR] [--goldens DIR] [--work DIR] [--no-runtime-check]

It exits 0 when every case matches (or differs only by the runtime change,
with the evidence printed), 1 otherwise, and 2 on a usage or tool error.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

DEFAULT_BUNDLES = Path(
    "/private/tmp/claude-503/-Users-Swaroop-Personal-Projects/"
    "f336681f-9155-4f00-80ce-4ac48096d8c0/scratchpad/c3/bundles"
)
DEFAULT_CASES = ("rs-synthetic", "rs-usb-pd", "rs-cynthion")
TOLERANCE_MM = 1e-6
TOLERANCE_DEG = 1e-6
RECORDINGS = {
    "rs-synthetic": ("fixtures/release-studio/synthetic", "synthetic.kicad_pcb"),
    "rs-usb-pd": ("fixtures/release-studio/usb-pd", "USB-PD-Trigger-Board.kicad_pcb"),
    "rs-cynthion": ("fixtures/release-studio/cynthion", "cynthion.kicad_pcb"),
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def native_root() -> Path:
    return repo_root() / "native"


def parse_args(argv) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", default=",".join(DEFAULT_CASES))
    parser.add_argument("--bundles", type=Path, default=DEFAULT_BUNDLES)
    parser.add_argument("--goldens", type=Path, default=native_root() / "parity/goldens")
    parser.add_argument("--work", type=Path, default=None)
    parser.add_argument("--prism-kicad", required=True)
    parser.add_argument("--geometer", required=True)
    parser.add_argument("--model-dir", action="append", default=[])
    parser.add_argument("--kicad-version", default="10.0.6")
    parser.add_argument("--golden-suffix", default="today")
    parser.add_argument("--no-runtime-check", action="store_true")
    return parser.parse_args(argv)


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


def run(argv, *, expect=(0,)):
    result = subprocess.run(argv, capture_output=True, text=True)
    if result.returncode not in expect:
        raise SystemExit(
            f"{' '.join(map(str, argv))} exited {result.returncode}\n"
            f"stdout:\n{result.stdout[-4000:]}\nstderr:\n{result.stderr[-4000:]}"
        )
    return result


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
            target = directory / name[len("sources/"):]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    return manifest


def refilled_board(case: str, destination: Path) -> Path:
    directory, name = RECORDINGS[case]
    source = (
        native_root()
        / "src/rs/prism-kicad-cli/tests/fixtures/recordings"
        / directory
        / f"{name}.zlib"
    )
    if not source.is_file():
        raise SystemExit(f"no refilled-board recording for {case}: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(zlib.decompress(source.read_bytes()))
    return destination


def glb_recording(case: str, destination: Path) -> Path:
    directory, _ = RECORDINGS[case]
    source = (
        native_root()
        / "src/rs/prism-kicad-cli/tests/fixtures/recordings"
        / directory
        / "components.glb.zlib"
    )
    if not source.is_file():
        raise SystemExit(f"no GLB recording for {case}: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(zlib.decompress(source.read_bytes()))
    return destination


def build_member(args, case: str, work: Path, directories) -> Path:
    """Build parse -> board -> models and return the extracted member."""
    bundle = args.bundles / f"{case}.prism"
    if not bundle.is_file():
        raise SystemExit(f"no case bundle: {bundle}")
    case_dir = work / case
    manifest = unpack(bundle, case_dir / "sources")
    project = case_dir / "sources" / manifest["config"]["project_file"]
    board = refilled_board(case, case_dir / "refilled.kicad_pcb")
    glb = glb_recording(case, case_dir / "components.glb")
    parse = case_dir / "parse.prism"
    board_bundle = case_dir / "board.prism"
    models = case_dir / "models.prism"
    run([
        args.prism_kicad, "bundle", "build", str(project), "--stage", "parse",
        "--source-root", str(case_dir / "sources"), "-o", str(parse), "--quiet",
    ])
    run([
        args.prism_kicad, "bundle", "build", "--stage", "board", "--in", str(parse),
        "--refilled-board", str(board), "--refill-tool", args.kicad_version,
        "-o", str(board_bundle), "--quiet",
    ])
    argv = [
        args.prism_kicad, "bundle", "build", "--stage", "models", "--in",
        str(board_bundle), "--models-glb", str(glb), "--models-tool",
        args.kicad_version, "--geometer", args.geometer,
        "--hlr-cache", str(case_dir / "hlr-cache"), "-o", str(models), "--quiet",
    ]
    for name, directory in directories.items():
        argv.extend(["--model-dir", f"{name}={directory}"])
    run(argv)
    extracted = case_dir / "member"
    if extracted.exists():
        shutil.rmtree(extracted)
    extracted.mkdir(parents=True)
    run([
        args.prism_kicad, "bundle", "extract", str(models),
        "models/assembly-hlr.json", "-o", str(extracted), "--quiet",
    ])
    return extracted / "models/assembly-hlr.json"


def mm(value_nm: float) -> float:
    return float(value_nm) / 1_000_000.0


def point_dev(left, right) -> float:
    return max(
        abs(mm(left["xNm"]) - mm(right["xNm"])),
        abs(mm(left["yNm"]) - mm(right["yNm"])),
    )


def segment_dev(left, right) -> float:
    straight = max(
        point_dev(left["startNm"], right["startNm"]),
        point_dev(left["endNm"], right["endNm"]),
    )
    reversed_ = max(
        point_dev(left["startNm"], right["endNm"]),
        point_dev(left["endNm"], right["startNm"]),
    )
    return min(straight, reversed_)


def arc_dev(left, right) -> float:
    return max(
        point_dev(left["startNm"], right["startNm"]),
        point_dev(left["endNm"], right["endNm"]),
        point_dev(left["centerNm"], right["centerNm"]),
        abs(mm(left["radiusNm"]) - mm(right["radiusNm"])),
        abs(float(left["extentDeg"]) - float(right["extentDeg"])) * TOLERANCE_DEG,
    )


def match(edges_left, edges_right, deviation, tolerance, key):
    """Greedy nearest match; return (deviations, missing, extra)."""
    remaining = list(edges_right)
    deviations = []
    missing = []
    for edge in edges_left:
        best = None
        for index, candidate in enumerate(remaining):
            distance = deviation(edge, candidate)
            if distance <= tolerance and (best is None or distance < best[0]):
                best = (distance, index)
        if best is None:
            missing.append(edge)
        else:
            deviations.append(best[0])
            remaining.pop(best[1])
    return deviations, missing, remaining


def compare_edges(left, right, label, reference, differences):
    left_segments = left.get("segments", [])
    right_segments = right.get("segments", [])
    deviations, missing, extra = match(
        left_segments, right_segments, segment_dev, TOLERANCE_MM, "segment"
    )
    if missing or extra:
        differences.append({
            "reference": reference, "edgeSet": label, "kind": "segments",
            "missing": len(missing), "extra": len(extra),
            "first": (missing or extra)[:2],
        })
    left_arcs = left.get("arcs", [])
    right_arcs = right.get("arcs", [])
    arc_deviations, arc_missing, arc_extra = match(
        left_arcs, right_arcs, arc_dev, TOLERANCE_MM, "arc"
    )
    if arc_missing or arc_extra:
        differences.append({
            "reference": reference, "edgeSet": label, "kind": "arcs",
            "missing": len(arc_missing), "extra": len(arc_extra),
            "first": (arc_missing or arc_extra)[:2],
        })
    return max(deviations + arc_deviations, default=0.0), (
        len(missing) + len(extra) + len(arc_missing) + len(arc_extra)
    )


def compare_documents(member: dict, golden: dict) -> dict:
    left = {footprint["uuid"]: footprint for footprint in member.get("footprints", [])}
    right = {footprint["uuid"]: footprint for footprint in golden.get("footprints", [])}
    report = {
        "footprints": len(right),
        "equal": 0,
        "differing": 0,
        "maxDeviationMm": 0.0,
        "missing": sorted(set(right) - set(left)),
        "extra": sorted(set(left) - set(right)),
        "optionsEqual": member.get("options") == golden.get("options"),
        "differences": [],
    }
    for uuid in sorted(set(left) & set(right)):
        member_footprint = left[uuid]
        golden_footprint = right[uuid]
        reference = golden_footprint.get("reference", uuid)
        if member_footprint.get("status") != golden_footprint.get("status"):
            report["differences"].append({
                "reference": reference, "kind": "status",
                "member": member_footprint.get("status"),
                "golden": golden_footprint.get("status"),
            })
            report["differing"] += 1
            continue
        if "outline" not in golden_footprint:
            report["equal"] += 1
            continue
        deviation = 0.0
        mismatches = 0
        for label in ("outline", "detail"):
            part_deviation, part_mismatches = compare_edges(
                member_footprint.get(label, {}),
                golden_footprint.get(label, {}),
                label,
                reference,
                report["differences"],
            )
            deviation = max(deviation, part_deviation)
            mismatches += part_mismatches
        report["maxDeviationMm"] = max(report["maxDeviationMm"], deviation)
        if mismatches:
            report["differing"] += 1
        else:
            report["equal"] += 1
    if report["missing"] or report["extra"]:
        report["differing"] += len(report["missing"]) + len(report["extra"])
    return report


def runtime_capture(args, case, work, directories):
    """Capture the case with today's Cruncher on the Rust Geometer runtime."""
    out = work / "runtime-913"
    command = [
        sys.executable, str(Path(__file__).with_name("capture_hlr.py")),
        "--cases", case, "--bundles", str(args.bundles), "--out", str(out),
        "--work", str(work / "runtime-913-work"),
        "--geometer-exe", args.geometer, "--suffix", "9.13",
    ]
    for name, directory in directories.items():
        command.extend(["--model-dir", f"{name}={directory}"])
    run(command)
    return out / case / "assembly-hlr.9.13.json"


def main(argv=None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    directories = model_directories(args.model_dir)
    if args.work is None:
        args.work = Path(tempfile.mkdtemp(prefix="prism-hlr-compare-"))
    args.work.mkdir(parents=True, exist_ok=True)
    exit_code = 0
    reports = []
    for case in [name.strip() for name in args.cases.split(",") if name.strip()]:
        member_path = build_member(args, case, args.work, directories)
        golden_path = args.goldens / case / f"assembly-hlr.{args.golden_suffix}.json"
        if not golden_path.is_file():
            print(f"{case}: no golden at {golden_path}", file=sys.stderr)
            exit_code = 1
            continue
        member = json.loads(member_path.read_text())
        golden = json.loads(golden_path.read_text())
        report = compare_documents(member, golden)
        report["case"] = case
        report["runtime"] = {
            "member": member.get("runtime", {}).get("geometerVersion"),
            "golden": golden.get("runtime", {}).get("geometerVersion"),
        }
        if report["missing"] or report["extra"] or report["differing"] or not report["optionsEqual"]:
            exit_code = 1
            if not args.no_runtime_check:
                same_runtime = runtime_capture(args, case, args.work, directories)
                runtime_report = compare_documents(member, json.loads(same_runtime.read_text()))
                report["runtimeCheck"] = {
                    "golden": str(same_runtime),
                    "equal": not (
                        runtime_report["missing"] or runtime_report["extra"]
                        or runtime_report["differing"] or not runtime_report["optionsEqual"]
                    ),
                    "differing": runtime_report["differing"],
                    "maxDeviationMm": runtime_report["maxDeviationMm"],
                }
                if report["runtimeCheck"]["equal"]:
                    exit_code = 0
                    report["verdict"] = (
                        "differs from today only by the Geometer runtime change "
                        f"({report['runtime']['golden']} -> {report['runtime']['member']}); "
                        "the member equals the same Cruncher run on the member's runtime"
                    )
        reports.append(report)
        print_case(report)
    print(json.dumps({"cases": reports}, indent=1))
    return exit_code


def print_case(report: dict) -> None:
    print(f"== {report['case']}")
    print(
        f"   footprints {report['footprints']}, equal {report['equal']}, "
        f"differing {report['differing']}, max deviation "
        f"{report['maxDeviationMm']:.9f} mm"
    )
    print(
        "   runtime today {} / member {}".format(
            report["runtime"]["golden"], report["runtime"]["member"]
        )
    )
    if report["missing"] or report["extra"]:
        print(f"   missing {len(report['missing'])}, extra {len(report['extra'])}")
    if not report["optionsEqual"]:
        print("   /options differ")
    for difference in report["differences"][:10]:
        print(f"   first difference: {json.dumps(difference)[:600]}")
    if "runtimeCheck" in report:
        check = report["runtimeCheck"]
        print(
            "   runtime check: member vs Cruncher on {}: equal {}, differing {}, "
            "max deviation {:.9f} mm".format(
                report["runtime"]["member"], check["equal"], check["differing"],
                check["maxDeviationMm"],
            )
        )
    if "verdict" in report:
        print(f"   verdict: {report['verdict']}")


if __name__ == "__main__":
    raise SystemExit(main())
