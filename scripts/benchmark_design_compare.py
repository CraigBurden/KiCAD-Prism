#!/usr/bin/env python3
"""Benchmark a cold Design Comparison build without the Prism API server.

The command uses an isolated cache by default, then writes a structured JSON
timeline suitable for comparing revisions of Prism and kicad-monkey.  Pass
``--warm`` to immediately repeat the revision phase against the populated
cache and quantify cache-read latency separately.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import (  # noqa: E402
    bom_diff_service,
    design_compare_service,
    document_diff_service,
    semantic_index_service,
)
from app.services.design_compare_benchmark import DesignCompareBenchmark  # noqa: E402


def _git(repo: Path, *arguments: str) -> str:
    process = subprocess.run(
        ["git", "-C", str(repo), *arguments],
        capture_output=True,
        text=True,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr.strip() or "git command failed")
    return process.stdout.strip()


def _resolve_project(project_file: Path) -> tuple[Path, str | None]:
    repo = Path(_git(project_file.parent, "rev-parse", "--show-toplevel"))
    try:
        relative_parent = project_file.parent.relative_to(repo)
    except ValueError as exc:
        raise SystemExit(f"Project is outside its Git repository: {project_file}") from exc
    relative_path = relative_parent.as_posix()
    return repo, None if relative_path == "." else relative_path


def _snapshot_stats(root: Path) -> dict[str, int]:
    files = [path for path in root.rglob("*") if path.is_file()]
    return {
        "files": len(files),
        "bytes": sum(path.stat().st_size for path in files),
        "schematics": sum(path.suffix == ".kicad_sch" for path in files),
        "boards": sum(path.suffix == ".kicad_pcb" for path in files),
    }


def _measure_assembly(
    recorder: DesignCompareBenchmark,
    base_revision: dict[str, Any],
    compare_revision: dict[str, Any],
) -> dict[str, int]:
    def measure(phase: str, action: Callable[[], Any]) -> Any:
        with recorder.span(phase, scope="assembly"):
            return action()

    schematic_semantic = measure(
        "schematic-semantic-diff",
        lambda: design_compare_service._diff_designs(
            base_revision.get("semantic") or {},
            compare_revision.get("semantic") or {},
        ),
    )
    schematic_geometry = measure(
        "schematic-geometry-diff",
        lambda: design_compare_service._diff_geometry(
            base_revision.get("geometry") or {},
            compare_revision.get("geometry") or {},
            "schematic",
        ),
    )
    schematic_changes = measure(
        "schematic-change-merge",
        lambda: design_compare_service._merge_semantic_geometry_changes(
            schematic_semantic["changes"],
            schematic_geometry,
        ),
    )
    measure(
        "visual-target-hydration",
        lambda: design_compare_service._hydrate_visual_target_pages_and_match_labels(
            schematic_changes,
            (base_revision.get("geometry") or {}).get("schematic") or {},
            (compare_revision.get("geometry") or {}).get("schematic") or {},
        ),
    )
    pcb_changes = measure(
        "pcb-geometry-diff",
        lambda: design_compare_service._diff_geometry(
            base_revision.get("geometry") or {},
            compare_revision.get("geometry") or {},
            "pcb",
        ),
    )
    old_bom = measure(
        "bom-parse-reference",
        lambda: bom_diff_service.parse_bom_csv(base_revision.get("bom_csv") or ""),
    )
    new_bom = measure(
        "bom-parse-comparison",
        lambda: bom_diff_service.parse_bom_csv(compare_revision.get("bom_csv") or ""),
    )
    bom = measure(
        "bom-diff",
        lambda: bom_diff_service.diff_boms(
            old_bom,
            new_bom,
            ["Reference", "Value", "Footprint", "Datasheet"],
        ),
    )
    measure(
        "stackup-diff",
        lambda: design_compare_service._diff_stackup(
            base_revision.get("stackup") or {},
            compare_revision.get("stackup") or {},
        ),
    )
    source_files = {
        "base": base_revision.get("sources") or [],
        "head": compare_revision.get("sources") or [],
    }
    measure(
        "document-diff",
        lambda: document_diff_service.build_project_diff(
            schematic_changes=schematic_changes,
            pcb_changes=pcb_changes,
            files=source_files,
            geometry={
                "base": base_revision.get("geometry") or {},
                "head": compare_revision.get("geometry") or {},
            },
        ),
    )
    measure(
        "change-grouping",
        lambda: (
            design_compare_service._group_changes(schematic_changes),
            design_compare_service._group_changes(pcb_changes),
        ),
    )
    return {
        "schematicChanges": len(schematic_changes),
        "pcbChanges": len(pcb_changes),
        "bomChanges": len(bom.get("changes") or []),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path, help="KiCad .kicad_pro project")
    parser.add_argument("--base", required=True, help="Reference revision")
    parser.add_argument("--compare", required=True, help="Comparison revision")
    parser.add_argument("--output", type=Path, help="Structured JSON output")
    parser.add_argument(
        "--cache-dir",
        type=Path,
        help="Persistent isolated cache. Existing entries are reused, never deleted.",
    )
    parser.add_argument("--warm", action="store_true", help="Also measure an immediate cache-hit run")
    parser.add_argument("--workers", choices=(1, 2), type=int, default=2)
    args = parser.parse_args()

    project_file = args.project.resolve()
    if not project_file.is_file() or project_file.suffix != ".kicad_pro":
        raise SystemExit(f"KiCad project does not exist: {project_file}")
    repo, relative_path = _resolve_project(project_file)
    base = design_compare_service._resolve_revision(repo, args.base)
    compare = design_compare_service._resolve_revision(repo, args.compare)
    output = (
        args.output.resolve()
        if args.output
        else Path(tempfile.gettempdir())
        / f"design-compare-benchmark-{int(time.time())}.json"
    )
    temporary_cache = None
    if args.cache_dir is None:
        temporary_cache = tempfile.TemporaryDirectory(prefix="prism-design-compare-benchmark-")
        cache_root = Path(temporary_cache.name)
    else:
        cache_root = args.cache_dir.resolve()
        cache_root.mkdir(parents=True, exist_ok=True)

    design_compare_service._CACHE_ROOT = cache_root
    os.environ["PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS"] = str(args.workers)
    semantic_index_service._add_kicad_monkey_import_paths()
    import kicad_monkey  # type: ignore[import-not-found]

    recorder = DesignCompareBenchmark(
        job_id=f"cli-{int(time.time())}",
        metadata={
            "project": str(project_file),
            "repo": str(repo),
            "base": base,
            "compare": compare,
            "workers": args.workers,
            "cacheRoot": str(cache_root),
            "semanticGenerator": semantic_index_service.generator_cache_tag(),
            "kicadMonkeyModule": str(Path(kicad_monkey.__file__).resolve()),
        },
    )
    project_id = "benchmark-" + hashlib.sha256(str(project_file).encode()).hexdigest()[:12]
    progress: list[str] = []

    def heartbeat(message: str, _percent: float | None = None) -> None:
        progress.append(message)
        print(message, flush=True)

    with recorder.span("cold-revision-pipeline"):
        revisions, revision_logs = design_compare_service._build_revisions(
            project_id,
            repo,
            relative_path,
            base,
            compare,
            heartbeat,
            benchmark=recorder,
        )

    counts = _measure_assembly(recorder, revisions[base], revisions[compare])
    snapshots = {
        revision: _snapshot_stats(
            design_compare_service._cache_dir(project_id, revision) / "snapshot"
        )
        for revision in dict.fromkeys((base, compare))
    }

    warm_elapsed_ms = None
    if args.warm:
        warm_started = time.perf_counter()
        with recorder.span("warm-revision-pipeline"):
            design_compare_service._build_revisions(
                project_id,
                repo,
                relative_path,
                base,
                compare,
                heartbeat,
                benchmark=recorder,
            )
        warm_elapsed_ms = round((time.perf_counter() - warm_started) * 1000, 3)

    payload = recorder.snapshot()
    payload["summary"] = {
        **counts,
        "warmElapsedMs": warm_elapsed_ms,
        "snapshots": snapshots,
        "revisionTimings": {
            revision: revisions[revision].get("timings") or {}
            for revision in dict.fromkeys((base, compare))
        },
        "revisionLogs": revision_logs,
        "progress": progress,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Benchmark written to {output}", flush=True)
    print(json.dumps(payload["summary"], indent=2), flush=True)
    if temporary_cache is not None:
        temporary_cache.cleanup()


if __name__ == "__main__":
    main()
