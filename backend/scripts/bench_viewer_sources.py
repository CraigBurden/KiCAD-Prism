#!/usr/bin/env python3
"""Measure how a large viewer-source read affects concurrent small requests.

The viewer-source routes (``app/api/project_viewer_sources.py``) prepare a
revision's files: they open its design bundle and read a 50+ MB source, decode
a schematic hierarchy, or extract a member to the version directory. When that
work runs on the event loop it stalls every other request in the process.

This benchmark builds one synthetic bundle whose hierarchy holds a single
large sheet, then sends one ``GET .../schematic/subsheets?include=content`` (or
``GET .../pcb``, which extracts the large member) concurrently with N small
``GET .../projects/{id}`` requests. It reports each small request's latency
(p50/p95), the large request's duration, and the scenario's wall time.

Run it against two checkouts with the same arguments: the numbers are the
deliverable, and both runs must use the same machine and inputs.

    /Users/Swaroop/.cache/prism-venvs/backend/bin/python \
        scripts/bench_viewer_sources.py --scenario subsheets --runs 5 --json /tmp/before.json

``.prism`` members are written with the contract stub's canonical zip writer
(``tests/support/prism_kicad_stub.py``), so the archive passes the real
``open_archive`` validation. Nothing here touches a database or a live service.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import resource
import shutil
import statistics
import sys
import tempfile
import time
from pathlib import Path
from unittest import mock

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "tests"))

from fastapi import FastAPI  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.api import project_viewer_sources as viewer_sources  # noqa: E402
from app.api import projects as projects_api  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import AuthenticatedUser, get_current_user  # noqa: E402
from app.services import project_service  # noqa: E402
from app.services.design_bundle import reader  # noqa: E402
from app.services.design_bundle.archive import open_archive  # noqa: E402
from app.services.design_bundle.generator import bundle_key  # noqa: E402
from app.services.design_bundle.reader import OpenedRevision  # noqa: E402
from support import prism_kicad_stub as stub  # noqa: E402

PROJECT_ID = "prj_bench"
REVISION_KEY = "b" * 64
GENERATOR_DIGEST = "c" * 64
EXAMPLES = REPO / "native" / "contracts" / "prism" / "examples"
GENERATOR = json.loads((EXAMPLES / "CliVersionA0.example.json").read_text(encoding="utf-8"))

USER = AuthenticatedUser(email="viewer@example.com", name="Viewer", role="viewer")

#: Lines that look like a KiCad board/schematic, so the member compresses like
#: real text (roughly 4-8x) instead of collapsing to nothing.
_LINE = "(segment (start {a}.{b} {c}.{d}) (end {e}.{f} {g}.{h}) (width 0.25) (layer \"F.Cu\"))\n"


def large_source(size_bytes: int) -> bytes:
    """About ``size_bytes`` of plausible source text."""

    text = bytearray()
    index = 0
    while len(text) < size_bytes:
        text += _LINE.format(
            a=index % 997, b=index % 89, c=index % 991, d=index % 83,
            e=(index + 7) % 997, f=index % 79, g=(index + 11) % 991, h=index % 73,
        ).encode()
        index += 1
    return bytes(text[:size_bytes])


def project_document(big_schematic: str) -> dict:
    """A ``projections/project.json`` naming the large sheet in the hierarchy."""

    return {
        "schema": "prism.project.a0",
        "projectFile": "board/demo.kicad_pro",
        "projectName": "demo",
        "textVariables": {},
        "netClasses": [],
        "documents": [
            {"path": big_schematic, "kind": "schematic", "properties": {}},
            {"path": "board/demo.kicad_pcb", "kind": "board", "properties": {}},
            {"path": "board/demo.kicad_sch", "kind": "root-schematic", "properties": {}},
        ],
        "references": [],
    }


def manifest_for(members: dict[str, bytes], config: dict) -> dict:
    listed = []
    for path, data in sorted(members.items(), key=lambda item: item[0].encode("utf-8")):
        entry = {"path": path, "stage": "parse", "sha256": stub.digest(data), "bytes": len(data)}
        if path.startswith("sources/"):
            entry.update(
                role=stub.source_role(path.rsplit("/", 1)[-1]),
                source={"path": path[len("sources/"):], "kind": "regular", "object_id": stub.blob_id(data)},
            )
        else:
            entry.update(
                role="projection",
                member_schema=next(
                    schema["schema"] for schema in GENERATOR["member_schemas"] if schema["path"] == path
                ),
            )
        listed.append(entry)
    return {
        "schema": "prism.bundle.manifest.a3",
        "generator": GENERATOR,
        "revision_key": REVISION_KEY,
        "bundle_key": bundle_key(REVISION_KEY, GENERATOR),
        "config": config,
        "board_id": "main",
        "stages": {
            "parse": {"status": "complete", "warnings": [], "failed_members": []},
            "board": {"status": "pending", "warnings": [], "failed_members": []},
            "models": {"status": "pending", "warnings": [], "failed_members": []},
        },
        "read_set": {"probes": [], "listings": [], "gitlinks": []},
        "members": listed,
    }


def build_bundle(path: Path, members: dict[str, bytes], config: dict) -> None:
    manifest = manifest_for(members, config)
    bundle = stub.compact(manifest) + b"\n"
    entries = [("bundle.json", bundle)] + [(member["path"], members[member["path"]]) for member in manifest["members"]]
    path.write_bytes(stub.zip_bytes(entries))


def synthetic_bundle(root: Path, scenario: str, member_mb: int) -> OpenedRevision:
    """A stored-archive shape with one large source member, opened for real."""

    big_schematic = "board/Subsheets/big.kicad_sch"
    big_board = "board/demo.kicad_pcb"
    size = member_mb * 1024 * 1024
    members = {
        "sources/board/demo.kicad_pro": b'{"meta": {"filename": "demo.kicad_pro"}}\n',
        "sources/board/demo.kicad_sch": b'(kicad_sch (version 20260306) (generator "eeschema"))\n',
        "sources/board/demo.kicad_pcb": b"(kicad_pcb (version 20260206) (generator \"pcbnew\"))\n",
        "sources/board/Subsheets/small.kicad_sch": b"(kicad_sch (version 20260306))\n",
    }
    if scenario == "subsheets":
        members[f"sources/{big_schematic}"] = large_source(size)
    else:
        members[f"sources/{big_board}"] = large_source(size)
    members["projections/project.json"] = (json.dumps(project_document(big_schematic)) + "\n").encode()
    config = {
        "schema": "prism.revision_key.effective_config.a1",
        "project_file": "board/demo.kicad_pro",
        "root_schematic": "board/demo.kicad_sch",
        "board": big_board,
        "excluded_dirs": [],
    }
    archive_path = root / "bench.prism"
    build_bundle(archive_path, members, config)
    return OpenedRevision(PROJECT_ID, REVISION_KEY, REVISION_KEY, GENERATOR_DIGEST, None, open_archive(archive_path), False)


class Bench:
    def __init__(self, scenario: str, member_mb: int, root: Path) -> None:
        self.scenario = scenario
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        self.opened = synthetic_bundle(root, scenario, member_mb)
        self.project = project_service.Project(
            id=PROJECT_ID,
            name="demo",
            description="",
            path=str(root / "repo" / "board"),
            last_modified="",
            parent_repo_path=str(root / "repo"),
            project_file="demo.kicad_pro",
        )
        self.app = FastAPI()
        self.app.include_router(projects_api.router, prefix="/api/projects")
        self.app.include_router(viewer_sources.router, prefix="/api/projects")
        self.app.dependency_overrides[get_current_user] = lambda: USER

    def big_path(self) -> str:
        if self.scenario == "subsheets":
            return f"/api/projects/{PROJECT_ID}/schematic/subsheets?include=content"
        return f"/api/projects/{PROJECT_ID}/pcb"

    def reset_extract(self) -> None:
        """Make each ``/pcb`` run inflate and write the member again."""

        if self.scenario == "pcb":
            shutil.rmtree(self.root / "bundles" / PROJECT_ID, ignore_errors=True)

    async def measure(self, client: AsyncClient, small: int) -> tuple[list[float], float, float]:
        self.reset_extract()
        issued = time.perf_counter()
        big = asyncio.create_task(client.get(self.big_path()))
        latencies: list[float] = []

        async def one() -> None:
            response = await client.get(f"/api/projects/{PROJECT_ID}")
            assert response.status_code == 200, response.text[:200]
            latencies.append(time.perf_counter() - issued)

        smalls = [asyncio.create_task(one()) for _ in range(small)]
        response = await big
        assert response.status_code == 200, response.text[:200]
        big_seconds = time.perf_counter() - issued
        await asyncio.gather(*smalls)
        return latencies, big_seconds, time.perf_counter() - issued


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


async def run_bench(args: argparse.Namespace) -> dict:
    root = Path(tempfile.mkdtemp(prefix="prism-bench-"))
    try:
        return await _run_bench(args, root)
    finally:
        shutil.rmtree(root, ignore_errors=True)


async def _run_bench(args: argparse.Namespace, root: Path) -> dict:
    bench = Bench(args.scenario, args.member_mb, root)
    with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_ROOT", str(root / "bundles")), \
            mock.patch.object(projects_api, "get_project_for_role_or_404", return_value=bench.project), \
            mock.patch.object(viewer_sources, "get_project_for_role_or_404", return_value=bench.project), \
            mock.patch.object(reader, "open_revision", return_value=bench.opened):
        async with AsyncClient(
            transport=ASGITransport(app=bench.app), base_url="http://bench", timeout=None
        ) as client:
            # Warm the archive and the route's caches; the extract is reset per run.
            await client.get(bench.big_path())
            for _ in range(3):
                await client.get(f"/api/projects/{PROJECT_ID}")
            latencies: list[float] = []
            big_seconds: list[float] = []
            totals: list[float] = []
            for _ in range(args.runs):
                run_latencies, run_big, run_total = await bench.measure(client, args.small)
                latencies.extend(run_latencies)
                big_seconds.append(run_big)
                totals.append(run_total)
    peak_kib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return {
        "scenario": args.scenario,
        "member_mb": args.member_mb,
        "small_requests": args.small,
        "runs": args.runs,
        "small_p50_ms": statistics.median(latencies) * 1000,
        "small_p95_ms": percentile(latencies, 0.95) * 1000,
        "small_max_ms": max(latencies) * 1000,
        "big_ms": statistics.median(big_seconds) * 1000,
        "total_ms": statistics.median(totals) * 1000,
        "peak_rss_mb": peak_kib / (1024 * 1024),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=("subsheets", "pcb"), default="subsheets")
    parser.add_argument("--member-mb", type=int, default=60)
    parser.add_argument("--small", type=int, default=20, help="concurrent small requests per run")
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--json", type=Path, default=None)
    args = parser.parse_args()
    result = asyncio.run(run_bench(args))
    line = json.dumps(result, sort_keys=True)
    print(line)
    if args.json:
        args.json.write_text(line + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
