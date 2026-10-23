"""V2a step 1: the analytic 3D path's cold cost, the three bundle stages for one commit.

usage: v2a_bundle_build.py <repo> <anchor> <commit> <workdir> <out.json>
Reproduces design_bundle/jobs.py's parse, board (zone refill + materializer) and
models (kicad-cli GLB) steps with nothing cached. Runs in a throwaway
worker-image container with the feature branch's backend and a Linux prism-kicad.
"""
import json
import resource
import sys
import time
import types
from pathlib import Path

repo, anchor, commit, workdir, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4]), Path(sys.argv[5])
try:
    import jsonschema  # noqa: F401
except ModuleNotFoundError:
    stub = types.ModuleType("app.services.design_bundle.schemas")
    stub.SchemaInvalid = type("SchemaInvalid", (ValueError,), {})
    stub.validate = lambda *_a, **_k: None
    stub.known = lambda *_a, **_k: True
    sys.modules["app.services.design_bundle.schemas"] = stub

from app.core.config import settings  # noqa: E402
from app.services.design_bundle import cli, kicad_steps, stage_models  # noqa: E402
from app.services.design_bundle import jobs as bundle_jobs  # noqa: E402
from app.services.design_bundle.archive import open_archive  # noqa: E402
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit  # noqa: E402


def cancel():
    return None


times, start = {}, time.perf_counter()


def mark(name, since):
    times[name] = round(time.perf_counter() - since, 2)


t = time.perf_counter()
generator = cli.generator()
key = key_at_commit(repo, ProjectRef(project_dir="", anchor=anchor), commit)
prepared = bundle_jobs.prepare_sources(repo, key, generator, workdir, cancel=cancel)
mark("materialize_and_upgrade", t)
config = dict(key.config or {})
archive = workdir / "bundle.prism"
rk = key.key.revision_key
src = prepared.src

t = time.perf_counter()
cli.run(["bundle", "build", str(src / config["project_file"]), "--stage", "parse", "--source-root", str(src), "-o", str(archive),
         "--revision-key", rk, "--key-record", str(prepared.key_record), "--config", str(prepared.effective),
         *cli.upgraded_args(prepared.upgraded), *cli.limits("parse"), "--threads", str(settings.PRISM_DESIGN_BUNDLE_THREADS)],
        timeout_seconds=cli.outer_timeout("parse"), expect="prism.cli.build_result.a0", cancel=cancel)
mark("stage_parse", t)

t = time.perf_counter()
args = ["bundle", "build", "--stage", "board", "--in", str(archive), "-o", str(archive), "--revision-key", rk, *cli.limits("board")]
if config.get("zone_fills") != "saved":
    t2 = time.perf_counter()
    refilled = kicad_steps.refill_board(src, config, workdir / "refill", cancel=cancel)
    mark("zone_refill", t2)
    args += ["--refilled-board", str(refilled), "--refill-tool", kicad_steps.worker_kicad_version()]
t2 = time.perf_counter()
cli.run(args, timeout_seconds=cli.outer_timeout("board"), expect="prism.cli.build_result.a0", cancel=cancel)
mark("materializer_cli", t2)
mark("stage_board", t)
board_done = round(time.perf_counter() - start, 2)

t = time.perf_counter()
t2 = time.perf_counter()
glb, _hit = stage_models.export_components_glb(src, key.record(), generator, workdir, cancel=cancel)
mark("kicad_cli_glb", t2)
cli.run(["bundle", "build", "--stage", "models", "--in", str(archive), "-o", str(archive), "--models-glb", str(glb),
         "--models-tool", kicad_steps.worker_kicad_version(), "--revision-key", rk, *cli.limits("models")],
        timeout_seconds=cli.outer_timeout("models"), expect="prism.cli.build_result.a0", cancel=cancel)
mark("stage_models", t)
total = round(time.perf_counter() - start, 2)

manifest = open_archive(archive).manifest
members = {m["path"]: m["bytes"] for m in manifest["members"]}
peak_kb = max(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss)
doc = {"anchor": anchor, "commit": commit, "times_s": times, "board_ready_s": board_done, "total_s": total,
       "peak_rss_mb": round(peak_kb / 1024), "archive_bytes": archive.stat().st_size,
       "pack_bytes": members.get("materialization/board.kmpack"), "glb_bytes": members.get("viewer/models/components.glb"),
       "stages": {k: v.get("status") for k, v in manifest["stages"].items()}}
out.write_text(json.dumps(doc, indent=1))
print(json.dumps(doc))
