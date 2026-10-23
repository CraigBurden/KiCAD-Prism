"""Baseline timings of today's Python producers on the parity cases.

The native bundle replaces these paths (ADR §9). This records what they cost
before the C-steps remove them, so the full comparison after Wave 4 has a
baseline: wall time per call and peak RSS per producer and case.

Two families, reported separately:

- ``prod:*``: today's production entry points, called as the backend calls
  them: ``build_semantic_index`` (with its own phase timings),
  ``variant_catalog_service.discover_snapshot_catalog``,
  ``interface_extractor.load_configured_design`` + ``extract_interface``, and
  kicad_monkey's design load alone.
- ``golden:<member>``: each parity capture module end to end
  (``prism_parity.capture.<member>.capture``). Several are W0 prototypes or
  adapters around today's code, not production paths; they are recorded so
  every member has a number.

Each (case, target) runs in a fresh interpreter, so peak RSS is that target's
alone and the first call is cold (imports are timed apart). Within it the call
repeats ``--repeat`` times with nothing cached between calls.

Run inside the backend environment (Python 3.12, kicad_monkey of
``requirements/``), on a quiet machine:

    python native/parity/benchmarks/bench_python.py \\
        --today . --prepared <dir with <case>/src, e.g. a capture scratch> \\
        --out native/parity/benchmarks/results/<date>-<host>.json

Without ``--prepared`` each case is prepared by ``prism_parity`` (copy and
KiCad upgrade, outside the timings).
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import resource
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve()
PARITY = HERE.parents[1]

PROD = ["prod:km-load", "prod:semantic-index", "prod:variant-catalog", "prod:system-interface"]
GOLDEN_MEMBERS = [
    "semantic-index",
    "system-interface",
    "project",
    "stackup",
    "placements",
    "occurrences",
    "board-objects",
    "route-metrics",
]


def peak_rss_bytes() -> int:
    """The larger of this process's and its children's peak RSS (Node helpers run as children)."""

    scale = 1 if sys.platform == "darwin" else 1024  # ru_maxrss: bytes on macOS, KiB on Linux
    own = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    children = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
    return max(own, children) * scale


# ------------------------------------------------------------------ child


def child(target: str, case_json: str, repeat: int, today: Path) -> dict:
    case = json.loads(case_json)
    src, project = Path(case["src"]), case["project"]
    pro = (src / project).resolve()
    sys.path[:0] = [str(PARITY), str(today / "kicad-prism-viewer" / "pipeline"), str(today / "backend")]

    started = time.perf_counter()
    run, phases = _prepare_target(target, case, pro, today)
    imports_s = time.perf_counter() - started

    times, phase_runs, error = [], [], None
    for _ in range(repeat):
        collected: list[dict] = []
        started = time.perf_counter()
        try:
            run(collected)
        except Exception as exc:  # noqa: BLE001 - today's failure is the recorded outcome
            error = f"{type(exc).__name__}: {exc}"[:300]
            break
        times.append(time.perf_counter() - started)
        if phases:
            phase_runs.append(collected)
    return {
        "importsS": imports_s,
        "timesS": times,
        "phases": phase_runs[0] if phase_runs else None,
        "peakRssBytes": peak_rss_bytes(),
        "error": error,
    }


def _prepare_target(target: str, case: dict, pro: Path, today: Path):
    """Import what ``target`` needs (timed as imports) and return ``(run, has_phases)``."""

    snapshot = SimpleNamespace(root=pro.parent, project_file=pro, commit=None)
    if target == "prod:km-load":
        from app.services.systems import interface_extractor as ie

        def run(_collected):
            design = ie.load_configured_design(snapshot)
            design.to_netlist()
            if getattr(design, "pcb_path", None):
                design.pcb  # noqa: B018 - force the lazy board parse

        return run, False
    if target == "prod:semantic-index":
        from app.services import semantic_index_service as service

        def run(collected):
            service.build_semantic_index(pro, source_revision_key="0" * 64, commit=None, timing_callback=collected.append)

        return run, True
    if target == "prod:variant-catalog":
        from app.services import variant_catalog_service as catalog

        def run(_collected):
            catalog.discover_snapshot_catalog(snapshot)

        return run, False
    if target == "prod:system-interface":
        from app.services.systems import interface_extractor as ie

        def run(_collected):
            design = ie.load_configured_design(snapshot)
            ie.extract_interface(pro, project_id="prj_bench", commit=None, design=design)

        return run, False
    if target.startswith("golden:"):
        from prism_parity import capture, fixtures as fx

        capture.setup_today(today)
        module = capture.load(target.split(":", 1)[1])
        fixture = fx.Case(id=case["id"], source_root=Path(case["src"]), project=case["project"])
        work = Path(case["work"])

        def run(_collected):
            scratch = work / f"bench-{target.replace(':', '-')}-{time.perf_counter_ns()}"
            scratch.mkdir(parents=True, exist_ok=True)
            prepared = fx.Prepared(case=fixture, src=Path(case["src"]), work=work, inputs=[], kicad=None)
            ctx = capture.Context(
                prepared=prepared, today=today, reference=capture.DEFAULT_REFERENCE,
                scratch=scratch, node=capture.default_node(), cache={},
            )
            try:
                module.capture(ctx)
            except capture.NotCaptured:
                pass  # today's code refuses this case; the time to refuse is still a cost

        return run, False
    raise SystemExit(f"unknown target {target}")


# ------------------------------------------------------------------ parent


def cases(args) -> list[dict]:
    sys.path.insert(0, str(PARITY))
    from prism_parity import fixtures as fx

    fixture_cases, _ = fx.load_fixtures()
    selected = fx.select(fixture_cases, args.cases)
    work_root = Path(args.work).resolve()
    result = []
    for case in selected:
        work = work_root / case.id
        work.mkdir(parents=True, exist_ok=True)
        if args.prepared:
            src = Path(args.prepared).resolve() / case.id / "src"
            if not src.is_dir():
                raise SystemExit(f"{case.id}: no prepared sources at {src}")
        else:
            from prism_parity import capture

            capture.setup_today(Path(args.today).resolve())
            src = fx.prepare(case, work_root / "prepared", fx.find_kicad()).src
        result.append({"id": case.id, "src": str(src), "project": case.project, "work": str(work)})
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--today", default=".", help="repository root whose backend/ is today's code")
    ap.add_argument("--prepared", help="directory with <case>/src already prepared (upgraded)")
    ap.add_argument("--work", default="/tmp/prism-bench", help="scratch for capture side files")
    ap.add_argument("--cases", default=None, help="comma-separated case ids (default: all)")
    ap.add_argument("--targets", nargs="*", default=PROD + [f"golden:{m}" for m in GOLDEN_MEMBERS])
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=1800)
    ap.add_argument("--out", required=True)
    ap.add_argument("--child", nargs=2, metavar=("TARGET", "CASE_JSON"), help=argparse.SUPPRESS)
    args = ap.parse_args()
    today = Path(args.today).resolve()
    if args.child:
        print(json.dumps(child(args.child[0], args.child[1], args.repeat, today)))
        return 0

    from importlib.metadata import version

    report = {
        "schema": "prism.parity.bench.python.a0",
        "host": {
            "platform": f"{sys.platform}-{platform.machine()}",
            "python": platform.python_version(),
            "kicadMonkey": version("kicad-monkey"),
            "cpus": os.cpu_count(),
            "loadAverageAtStart": list(os.getloadavg()),
        },
        "repeat": args.repeat,
        "results": [],
    }
    for case in cases(args):
        for target in args.targets:
            command = [sys.executable, str(HERE), "--today", str(today), "--repeat", str(args.repeat),
                       "--out", "-", "--child", target, json.dumps(case)]
            started = time.perf_counter()
            try:
                out = subprocess.run(command, capture_output=True, text=True, timeout=args.timeout)
                row = json.loads(out.stdout.strip().splitlines()[-1]) if out.returncode == 0 else {
                    "error": f"exit {out.returncode}: {out.stderr[-300:]}"}
            except subprocess.TimeoutExpired:
                row = {"error": f"timeout after {args.timeout}s"}
            row.update({"case": case["id"], "target": target, "processS": time.perf_counter() - started})
            best = min(row["timesS"]) if row.get("timesS") else None
            print(f"{case['id']:28} {target:26} "
                  + (f"best {best:8.3f}s  first {row['timesS'][0]:8.3f}s  rss {row['peakRssBytes'] / 2**20:7.1f} MiB"
                     if best is not None else f"ERROR {row.get('error')}"), flush=True)
            report["results"].append(row)
    report["host"]["loadAverageAtEnd"] = list(os.getloadavg())
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
