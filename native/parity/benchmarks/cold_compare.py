"""Cold Design Comparison benchmark (amendment C2r §5): today's path vs the bundle path, to every tab filled.

usage: python cold_compare.py <repo> <anchor> <base> <head> <workdir> legacy|new

Run once per path, each in its own throwaway container from the worker image, with the backend
on PYTHONPATH and PRISM_DESIGN_BUNDLE_CLI_PATH set to a Linux prism-kicad. Nothing is cached: fresh
cache and work directories, no Node index cache, no bundles (the new path reads both revisions
from their source trees, as for a commit pushed a moment ago). Fabrication is real (kicad-cli
Gerbers and the image diff) on both paths. Only what needs the database is replaced: the
project's anchor, the cache directory, and the bundle lookup (never a bundle). The README records
the runs.
"""

import os
import resource
import shutil
import sys
import time
import types
from pathlib import Path
from unittest import mock

repo, anchor, base, head, workdir, which = sys.argv[1:7]
WORK = Path(workdir) / which
os.environ["ECAD_INDEX_CACHE"] = "0"

# The dev worker image has no jsonschema; as in the C2r §1.2 run, the schema
# module is a stand-in (reads are validate-at-store; nothing here is stored).
try:
    import jsonschema  # noqa: F401
except ModuleNotFoundError:
    import types

    _schemas = types.ModuleType("app.services.design_bundle.schemas")
    _schemas.SchemaInvalid = type("SchemaInvalid", (ValueError,), {})
    _schemas.validate = lambda *_a, **_k: None
    _schemas.known = lambda *_a, **_k: True
    sys.modules["app.services.design_bundle.schemas"] = _schemas

from app.services import design_compare_bundle_path as bp  # noqa: E402
from app.services import design_compare_service as svc  # noqa: E402
from app.services.design_bundle import cli  # noqa: E402
from app.services.design_bundle import jobs as bundle_jobs  # noqa: E402
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit  # noqa: E402
from app.services.design_compare_benchmark import DesignCompareBenchmark  # noqa: E402


def cache_dir(_project, commit):
    path = WORK / "cache" / commit
    path.mkdir(parents=True, exist_ok=True)
    return path


# Started at import, so the legacy path's revision worker processes (spawned,
# re-importing this module) run with the same stand-ins as the parent.
for _patch in (
    mock.patch.object(svc, "_cache_dir", side_effect=cache_dir),
    mock.patch.object(svc, "_project_anchor", return_value=anchor),
    mock.patch.object(bp, "fabrication_root", return_value=WORK / "fabrication-by-bundle-key"),
):
    _patch.start()


class FirstResult:
    def __init__(self, started):
        self.started, self.first = started, None

    def publish_partial(self, *args, **kwargs):
        if self.first is None:
            self.first = time.perf_counter() - self.started


class SourceTreeStages(bp.BundlePathStages):
    """The job's stages without the database: every side is a source tree, as with no bundles yet."""

    def side(self, inputs, name, commit, work, cancel):
        generator = cli.generator()
        key = key_at_commit(inputs.repo_path, ProjectRef(project_dir="", anchor=anchor), commit)
        prepared = bundle_jobs.prepare_sources(
            inputs.repo_path, key, generator, work / name, cancel=cancel, upgrade_cache=getattr(self, "upgrades", None)
        )
        revision_key = key.key.revision_key
        return bp.Side(name, commit, revision_key, generator.bundle_key(revision_key), dict(key.config or {}), prepared=prepared)


def spans(bench):
    events = sorted((e for e in bench.drain_events() if e.get("elapsedMs")), key=lambda e: -e["elapsedMs"])[:8]
    return ", ".join(f"{e.get('phase') or e.get('name')}={e['elapsedMs'] / 1000:.1f}s" for e in events)


def main():
    # Only here: the legacy path's spawned workers re-import this module, and
    # must not clear what the parent has built.
    shutil.rmtree(WORK, ignore_errors=True)
    WORK.mkdir(parents=True)
    bench = DesignCompareBenchmark(job_id="cold7")
    started = time.perf_counter()
    publisher = FirstResult(started)
    if which == "legacy":
        request = svc.ComparisonRequest(project_id="bench", repo_path=Path(repo), relative_path=None, base=base, head=head)
        result = svc.run_comparison(request, publisher, stages=svc.ComparisonStages(), benchmark=bench, render_dir=WORK / "render")
    else:
        inputs = bp.ComparisonInputs(project_id="bench", repo_path=Path(repo), base=base, head=head, include_unchanged=False)
        (WORK / "work").mkdir()
        outcome = bp.run_comparison(inputs, publisher, work=WORK / "work", benchmark=bench, stages=SourceTreeStages(), render_dir=WORK / "render")
        result = outcome.result
        run = outcome.compare_run
        print(f"compare: {run.elapsed_ms / 1000:.1f}s, peak RSS {run.peak_rss_bytes / 2**20:.0f} MB" if run else "compare: no run facts")
    total = time.perf_counter() - started
    fab = result.get("fabrication") or {}
    print(f"{which}: first result {publisher.first or total:6.1f}s, every tab {total:6.1f}s, "
          f"fabrication layers {len(fab.get('layers') or [])}, readiness {(result.get('readiness') or {}).get('stage')}")
    print(f"   top spans: {spans(bench)}")
    children = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024
    own = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(f"   peak RSS: worker python {own:.0f} MB, largest child {children:.0f} MB")


if __name__ == "__main__":
    main()
