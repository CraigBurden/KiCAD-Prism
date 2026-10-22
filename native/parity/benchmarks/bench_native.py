"""Native bundle timings on the parity cases, set against the Python baseline.

The full comparison after Wave 4 (README "Benchmarks"). For each parity case:

- ``build``: ``prism-kicad bundle build --stage parse`` (every parse-stage
  member from one parse), as a fresh process each time: wall time and the
  child's peak RSS. ``--repeat`` runs; the best is reported.
- ``read``: what an endpoint that used to parse on demand now does with a
  warm bundle: open the verified archive and decode the member it serves.
  Timed in this process, best of ``--repeat``, after one untimed warm-up.
- ``verify``: ``prism-kicad bundle verify``, which the bundle job runs once
  before it publishes the archive and marks it verified (``jobs.py``): wall
  time and peak RSS, best of ``--repeat``. A bundle is readable after build
  plus verify.

``--extra-src``/``--extra-project``/``--extra-id`` add a case that is not a
committed fixture (a private board such as EDA-04903); it is prepared the same
way. Its Python side is timed with ``bench_python.py --child`` from the
baseline's commit (README).

Sources are prepared once by ``prism_parity`` (copy and KiCad upgrade, outside
the timings), as the baseline's were. ``--baseline`` names the Python run in
``results/`` to compare with; the report carries both and a per-case table.

Run inside the backend environment (the archive reader is the backend's):

    python native/parity/benchmarks/bench_native.py --prism-kicad <binary> \\
        --baseline native/parity/benchmarks/results/2026-10-17-ithelpdesk-macbook-pro-arm64.json \\
        --out native/parity/benchmarks/results/<date>-<host>-native.json
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve()
PARITY = HERE.parents[1]
REPO = HERE.parents[3]

#: Members an endpoint used to build on demand, and the Python target that did it.
READS = {
    "projections/semantic-index.json": "prod:semantic-index",
    "projections/system-interface.json": "prod:system-interface",
}

#: Baseline targets that one parse-stage build replaces, summed per case.
PROD_SUM = ("prod:semantic-index", "prod:system-interface", "prod:variant-catalog")


def _load_avg() -> list[float]:
    return [round(value, 2) for value in os.getloadavg()]


def _timed_build(command: list[str]) -> tuple[float, int, int]:
    """Wall seconds, peak RSS bytes and exit status of one child run."""

    started = time.perf_counter()
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    _, status, usage = os.wait4(process.pid, 0)
    wall = time.perf_counter() - started
    process.returncode = os.waitstatus_to_exitcode(status)
    scale = 1 if sys.platform == "darwin" else 1024  # ru_maxrss: bytes on macOS, KiB on Linux
    return wall, usage.ru_maxrss * scale, process.returncode


def _build(binary: Path, prepared, out: Path, repeat: int) -> dict:
    command = [
        str(binary), "bundle", "build", str(prepared.src / prepared.case.project),
        "--stage", "parse", "-o", str(out), "--source-root", str(prepared.src), "--quiet",
    ]
    for record in prepared.inputs:
        if "upgradedFromVersion" in record:
            command += ["--upgraded", f"{record['path']}={record['upgradedFromVersion']}"]
    times, peaks, exits = [], [], []
    for _ in range(repeat):
        out.unlink(missing_ok=True)
        wall, peak, code = _timed_build(command)
        times.append(wall)
        peaks.append(peak)
        exits.append(code)
    return {"timesS": times, "peakRssBytes": max(peaks), "exits": exits}


def _reads(archive_path: Path, repeat: int) -> dict:
    """Per member, the read an endpoint makes of a verified archive.

    The job verifies an archive once and the store marks it (``jobs.py``,
    ``store.py``); every read after that runs the digest check only
    (bundle-format.md §9, C2r §2 item 9): open, inflate, digest, JSON decode.
    """

    from app.services.design_bundle.archive import open_archive, parse_json_member

    result = {}
    for member in READS:
        if open_archive(archive_path).member(member) is None:
            continue  # this case's bundle has no such member (a refused or partial case)

        def once() -> int:
            archive = open_archive(archive_path)
            archive.verified = True
            data = archive.read(member)
            parse_json_member(data, member)
            return len(data)

        size = once()  # warm-up
        times = []
        for _ in range(repeat):
            started = time.perf_counter()
            once()
            times.append(time.perf_counter() - started)
        result[member] = {"timesS": times, "bytes": size}
    return result


def _verify(binary: Path, archive_path: Path, repeat: int) -> dict:
    times, peaks, exits = [], [], []
    for _ in range(repeat):
        wall, peak, code = _timed_build([str(binary), "bundle", "verify", str(archive_path)])
        times.append(wall)
        peaks.append(peak)
        exits.append(code)
    return {"timesS": times, "peakRssBytes": max(peaks), "exits": exits}


def _baseline(path: Path | None) -> dict[str, dict[str, dict]]:
    if not path:
        return {}
    by_case: dict[str, dict[str, dict]] = {}
    for row in json.loads(path.read_text(encoding="utf-8"))["results"]:
        by_case.setdefault(row["case"], {})[row["target"]] = row
    return by_case


def _best(row: dict | None) -> float | None:
    times = (row or {}).get("timesS") or []
    return min(times) if times and not (row or {}).get("error") else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--prism-kicad", required=True)
    ap.add_argument("--baseline", type=Path)
    ap.add_argument("--work", default="/tmp/prism-bench-native")
    ap.add_argument("--cases", default=None, help="comma-separated case ids (default: all)")
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--extra-src", type=Path, help="source root of a case outside fixtures.json")
    ap.add_argument("--extra-project", help="the extra case's anchor, relative to --extra-src")
    ap.add_argument("--extra-id", default="extra")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    sys.path[:0] = [str(PARITY), str(REPO / "backend")]
    from prism_parity import fixtures as fx

    binary = Path(args.prism_kicad).resolve()
    work = Path(args.work).resolve()
    kicad = fx.find_kicad()
    baseline = _baseline(args.baseline)
    version = subprocess.run([str(binary), "--version"], capture_output=True, text=True).stdout.strip()
    report = {
        "schema": "prism.parity.bench.native.a0",
        "host": {
            "machine": platform.machine(),
            "system": platform.platform(),
            "cpus": os.cpu_count(),
            "python": platform.python_version(),
            "prismKicad": version,
            "commit": subprocess.run(
                ["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True
            ).stdout.strip(),
            "loadAvgStart": _load_avg(),
        },
        "repeat": args.repeat,
        "baseline": str(args.baseline) if args.baseline else None,
        "results": [],
    }
    cases, _ = fx.load_fixtures()
    selected = fx.select(cases, args.cases) if args.cases or not args.extra_src else []
    if args.extra_src:
        selected.append(fx.Case(id=args.extra_id, source_root=args.extra_src.resolve(), project=args.extra_project))
    for case in selected:
        prepared = fx.prepare(case, work / "prepared", kicad)
        archive = work / "bundles" / f"{case.id}.prism"
        archive.parent.mkdir(parents=True, exist_ok=True)
        build = _build(binary, prepared, archive, args.repeat)
        reads = _reads(archive, args.repeat) if archive.exists() else {}
        verify = _verify(binary, archive, args.repeat) if archive.exists() else None
        python = baseline.get(case.id, {})
        row = {
            "case": case.id,
            "build": build,
            "reads": reads,
            "verify": verify,
            "python": {target: _best(python.get(target)) for target in python},
            "pythonPeakRssBytes": max((r.get("peakRssBytes") or 0 for r in python.values()), default=0),
        }
        report["results"].append(row)
        prod = [row["python"].get(t) for t in PROD_SUM]
        prod_sum = sum(v for v in prod if v is not None)
        print(
            f"{case.id}: build best {min(build['timesS']):.3f}s "
            f"peak {build['peakRssBytes'] / 2**20:.0f} MiB exits {build['exits']}; "
            f"python prod sum {prod_sum:.3f}s",
            flush=True,
        )
    report["host"]["loadAvgEnd"] = _load_avg()
    Path(args.out).write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
