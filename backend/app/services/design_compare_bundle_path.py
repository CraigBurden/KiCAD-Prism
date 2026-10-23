"""Design Comparison's one path: ``prism-kicad compare``, passed through (ADR amendment C2r).

The ``design_compare`` job runs here (C2r §2 items 4-7, §9 step 5):

```text
1. sides        both revisions at once, each from its stored bundle (the five
                members compare reads are ready), else from its source tree,
                materialized as the design_bundle job does, sharing one upgrade
                cache; the bundle build is queued either way
2. compare      prism-kicad compare -> DesignCompareResultA1, every tab except
                fabrication; meanwhile kicad-cli plots each side's Gerbers,
                once per bundle key and cached by it
3. publish      the result as the job's partial artifact (fabrication still building)
4. fabrication  today's image diff of the two plots
5. publish      the v2 manifest: one sidecar per tab, fabrication and its layer renders
```

There is no fallback to the legacy result: a side without a ready bundle is
compared from its source tree, and a ``compare`` failure fails the job, so the
C2r gate sees every failure (decision F1). The legacy staged pipeline was
deleted in R1.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
import time
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional

from app.services import project_revision
from app.services.design_bundle import cli, consumer, jobs as bundle_jobs, kicad_steps
from app.services.design_compare_artifacts import _diff_fabrication, _manifest_entry
from app.services.design_compare_benchmark import DesignCompareBenchmark
from app.services.job_artifact_service import job_artifacts
from app.services.job_runtime import JobContext, JobResult, PermanentJobError, RetryableJobError, job_state_root
from app.services.job_service import jobs as v3_jobs
from app.services.workspace_service import workspace

logger = logging.getLogger(__name__)

#: The value of a queued comparison's ``pipeline`` payload field for this path.
PIPELINE = "compare-cli"
#: The members ``compare`` reads from a bundle (cli-spec.md §5.6).
MEMBERS = (
    "projections/board-objects.json",
    "projections/semantic-index.json",
    "projections/occurrences.json",
    "projections/stackup.json",
    "projections/route-metrics.json",
)
RESULT_SCHEMA = "prism.design_compare.result.a1"
MANIFEST_SCHEMA = "prism.design_compare_bundle_v2"
#: The result's tabs, each served as its own sidecar under the same name.
TABS = ("files", "schematic", "pcb", "bom", "stackup", "routeMetrics", "projectDiff")
_DOMAINS = ("schematic", "bom", "pcb", "stackup")


#: The revision cache's directory of per-bundle-key Gerber packages. The cache's
#: size cap (``PRISM_DESIGN_COMPARE_CACHE_MAX_BYTES``) counts and evicts them like commits.
FABRICATION_NAMESPACE = "fabrication-by-bundle-key"


def fabrication_root() -> Path:
    """Per-bundle-key Gerber packages, shared by every comparison of that bundle key."""

    from app.services.design_compare_service import _CACHE_ROOT

    return _CACHE_ROOT / FABRICATION_NAMESPACE


# ------------------------------------------------------------------ sides


@dataclass
class Side:
    """One revision of the comparison, and how ``compare`` reads it."""

    name: str
    commit: str
    revision_key: str
    bundle_key: str
    config: Dict[str, Any]
    #: Bundle mode: the stored archive and its reader.
    read: Optional[consumer.BundleRead] = None
    #: Source-tree mode: the materialized revision.
    prepared: Optional[bundle_jobs.PreparedSources] = None

    @property
    def mode(self) -> str:
        return "bundle" if self.read is not None else "source-tree"

    def compare_args(self) -> List[str]:
        """This side's ``compare`` arguments (cli-spec.md §5.6).

        Both modes pass the revision key: a bundle may serve several, so
        ``compare`` takes the side's identity from the request, not the archive.
        """

        identity = [f"--{self.name}-revision-key", self.revision_key]
        if self.read is not None:
            archive = self.read.opened.archive
            assert archive is not None
            return [f"--{self.name}", str(archive.path), *identity]
        assert self.prepared is not None
        args = [
            f"--{self.name}-src", str(self.prepared.src / self.config["project_file"]),
            f"--{self.name}-source-root", str(self.prepared.src),
            f"--{self.name}-config", str(self.prepared.effective),
            *identity,
        ]
        for item in self.prepared.upgraded:
            args += [f"--{self.name}-upgraded", f"{item['path']}={int(item['upgraded_from_version'])}"]
        return args

    def board_dir(self, work: Path) -> Optional[Path]:
        """A directory holding the committed board with its project and rules files, or ``None`` without a board."""

        board = self.config.get("board")
        if not board:
            return None
        if self.prepared is not None:
            return self.prepared.src
        assert self.read is not None
        project = str(self.config["project_file"])
        wanted = [f"sources/{board}", f"sources/{project}"]
        rules = f"sources/{project[: -len('.kicad_pro')]}.kicad_dru"
        archive = self.read.opened.archive
        if archive is not None and archive.member(rules):
            wanted.append(rules)
        return self.read.extract(wanted) / "sources"


@dataclass(frozen=True)
class ComparisonInputs:
    project_id: str
    repo_path: Path
    base: str
    head: str
    include_unchanged: bool
    requested_by: str = ""


class BundlePathStages:
    """The bundle path's side effects, one method each; tests replace them."""

    def __init__(self) -> None:
        # One comparison's two source sets upgrade a file they share once.
        self.upgrades = kicad_steps.UpgradeCache()

    def side(self, inputs: ComparisonInputs, name: str, commit: str, work: Path, cancel: Callable[[], None]) -> Side:
        row = workspace.get_project_by_id(inputs.project_id)
        if not row:
            raise PermanentJobError(f"Project '{inputs.project_id}' not found", code="project-not-found")
        generator = cli.generator()
        read = consumer.bundle_read_if_ready(
            "DESIGN_COMPARISON", inputs.project_id, commit, MEMBERS, requested_by=inputs.requested_by
        )
        if read is not None and read.opened.archive is not None:
            opened = read.opened
            assert opened.revision_key is not None and opened.bundle_key is not None
            return Side(
                name, commit, opened.revision_key, opened.bundle_key,
                dict(opened.archive.manifest["config"]), read=read,
            )
        # No ready bundle: compare the source tree. bundle_read_if_ready has
        # already queued the bundle build for this commit.
        key = bundle_jobs.project_key(row, commit)
        if key.absent:
            raise PermanentJobError(
                f"The project is not present at {commit[:7]} ({key.absent_project_file} is not in the tree)",
                code="project-absent",
            )
        assert key.key is not None
        prepared = bundle_jobs.prepare_sources(
            inputs.repo_path, key, generator, work / name, cancel=cancel, upgrade_cache=self.upgrades
        )
        revision_key = key.key.revision_key
        return Side(
            name, commit, revision_key, generator.bundle_key(revision_key), dict(key.config or {}), prepared=prepared,
        )

    def compare(self, args: List[str], *, source_tree: bool, cancel: Callable[[], None]) -> cli.CliRun:
        stage_limits = cli.limits("parse") if source_tree else []
        return cli.run(
            ["compare", *args, *stage_limits],
            timeout_seconds=cli.outer_timeout("parse"),
            expect="prism.cli.compare_result.a1",
            cancel=cancel,
        )

    def fabrication(self, side: Side, work: Path, logs: List[str]) -> Dict[str, Any]:
        from app.services.design_compare_service import _plot_fabrication, _touch_cache_entry

        board_dir = side.board_dir(work)
        if board_dir is None:
            return {"present": False, "reason": "no board file in this revision"}
        board = board_dir / str(side.config["board"])
        if not board.is_file():
            return {"present": False, "reason": "no board file in this revision"}
        root = fabrication_root() / side.bundle_key
        root.mkdir(parents=True, exist_ok=True)
        # One revision-cache entry per bundle key: stamped on use, so the size cap evicts least recently used.
        _touch_cache_entry(FABRICATION_NAMESPACE, side.bundle_key)
        # A staging directory of its own: two comparisons may plot one bundle key at once.
        staging = Path(tempfile.mkdtemp(prefix="fabrication.staging.", dir=root))
        try:
            return _plot_fabrication(board, root / "fabrication", staging, side.commit[:7], logs)
        finally:
            shutil.rmtree(staging, ignore_errors=True)


# ------------------------------------------------------------------ result


def _readiness(fabrication: str) -> Dict[str, Any]:
    domains: Dict[str, str] = {domain: "ready" for domain in _DOMAINS}
    domains["fabrication"] = fabrication
    stage = "complete" if fabrication == "ready" else "background-fabrication"
    return {"stage": stage, "domains": domains}


def _cli_error(failure: cli.CliFailure) -> Exception:
    message = f"prism-kicad compare: {failure}"
    if failure.retryable:
        return RetryableJobError(message, code=failure.code)
    return PermanentJobError(message, code=failure.code)


@dataclass
class Outcome:
    result: Dict[str, Any]
    modes: Dict[str, str]
    compare_run: Optional[cli.CliRun] = None
    logs: List[str] = field(default_factory=list)


class Publisher:
    """Publishes the bundle path's partial result and builds its complete manifest."""

    def __init__(self, context: JobContext, artifact_key: str, generator_digest: str) -> None:
        self.context = context
        self.artifact_key = artifact_key
        self.generator_digest = generator_digest

    def publish_partial(self, result: Dict[str, Any], details: Dict[str, Any]) -> None:
        artifact = job_artifacts.prepare_json(
            self.context, result, kind="design_compare", artifact_key=self.artifact_key,
            schema_version=RESULT_SCHEMA, generator_version=self.generator_digest, readiness="partial",
        )
        if not v3_jobs.publish_partial_artifact(
            self.context.job_id, self.context.worker_id, self.context.fence, artifact.__dict__,
            stage="background-fabrication",
            message="Design comparison ready; plotting fabrication in background…",
            percent=70, details=details,
        ):
            raise RuntimeError("Fenced partial comparison publication was rejected")

    def prepare_complete(
        self, result: Dict[str, Any], modes: Mapping[str, str], *, base: str, head: str
    ) -> tuple[Any, tuple[Any, ...]]:
        """The v2 manifest and its sidecars: one per tab, fabrication, and the layer renders."""

        from app.services.design_compare_service import _prepare_render_sidecars

        fabrication = result.get("fabrication") or {}
        render_artifacts, manifest_sidecars = _prepare_render_sidecars(
            self.context, fabrication, artifact_key=self.artifact_key, generator_version=self.generator_digest,
        )
        sidecars = list(render_artifacts)
        payloads: Dict[str, Any] = {
            "core": {key: result.get(key) for key in ("schema", "base", "head", "readiness")},
            **{tab: result.get(tab) for tab in TABS},
            "fabrication": fabrication,
        }
        for name, payload in payloads.items():
            prepared = job_artifacts.prepare_json(
                self.context, payload, kind="design_compare_sidecar",
                artifact_key=f"{self.artifact_key}:sidecar:{name}", schema_version=RESULT_SCHEMA,
                generator_version=self.generator_digest, readiness="sidecar",
            )
            sidecars.append(prepared)
            manifest_sidecars[name] = _manifest_entry(prepared)
        manifest = {
            "schema": MANIFEST_SCHEMA,
            "resultSchema": RESULT_SCHEMA,
            "base": base,
            "head": head,
            "revisions": {"base": result["base"], "head": result["head"]},
            "readiness": result.get("readiness"),
            "counts": result.get("counts"),
            "modes": dict(modes),
            "sidecars": manifest_sidecars,
        }
        primary = job_artifacts.prepare_json(
            self.context, manifest, kind="design_compare", artifact_key=self.artifact_key,
            schema_version=MANIFEST_SCHEMA, generator_version=self.generator_digest, readiness="ready",
        )
        return primary, tuple(sidecars)


def run_comparison(
    inputs: ComparisonInputs,
    publisher: Any,
    *,
    work: Path,
    benchmark: DesignCompareBenchmark,
    stages: Optional[BundlePathStages] = None,
    heartbeat: Callable[..., None] = lambda message, percent=None: None,
    check_cancelled: Callable[[], None] = lambda: None,
    render_dir: Optional[Path] = None,
) -> Outcome:
    """Compare, publish every tab but fabrication, then add fabrication; return the complete result.

    The two sides are read at once, and their Gerbers are plotted while
    ``compare`` runs, so fabrication is not on the first result's path.
    """

    stages = stages or BundlePathStages()
    heartbeat("Reading both revisions…", 5)
    commits = {"base": inputs.base, "head": inputs.head}

    def read_side(name: str) -> Side:
        with benchmark.span(f"side-{name}"):
            return stages.side(inputs, name, commits[name], work, check_cancelled)

    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="compare-side") as pool:
        futures = {name: pool.submit(read_side, name) for name in commits}
        sides: Dict[str, Side] = {name: future.result() for name, future in futures.items()}
    modes = {name: side.mode for name, side in sides.items()}
    check_cancelled()

    logs: Dict[str, List[str]] = {name: [] for name in sides}
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="compare-fabrication") as plotting:
        plots = _start_fabrication(plotting, stages, sides, work, logs, benchmark)
        heartbeat("Comparing revisions…", 30)
        output = work / "result.json"
        args = [*sides["base"].compare_args(), *sides["head"].compare_args(), "-o", str(output)]
        if inputs.include_unchanged:
            args.append("--include-unchanged")
        try:
            with benchmark.span("compare-cli"):
                run = stages.compare(args, source_tree="source-tree" in modes.values(), cancel=check_cancelled)
        except cli.CliFailure as failure:
            raise _cli_error(failure) from failure
        result = json.loads(output.read_text(encoding="utf-8"))
        if result.get("schema") != RESULT_SCHEMA:
            raise PermanentJobError(f"prism-kicad compare wrote {result.get('schema')!r}", code="result-schema")
        result["readiness"] = _readiness("building")
        publisher.publish_partial(result, _details(result, inputs, modes, version=1))

        check_cancelled()
        heartbeat("Plotting fabrication output…", 75)
        with benchmark.span("fabrication"):
            try:
                exports = {name: {"fabrication": plots[name].result()} for name in sides}
                fabrication = _diff_fabrication(exports["base"], exports["head"], render_dir)
                state = "ready"
            except Exception:  # noqa: BLE001 - fabrication degrades its own domain only, as on the legacy path
                logger.exception("Fabrication comparison failed")
                fabrication, state = None, "failed"
    plotted = [message for name in sides for message in logs[name]]
    for message in plotted:
        print(f"[fabrication] {message}", flush=True)
    complete = {**result, "readiness": _readiness(state)}
    if fabrication is not None:
        complete["fabrication"] = fabrication
    return Outcome(complete, modes, run, plotted)


def _start_fabrication(
    pool: ThreadPoolExecutor,
    stages: BundlePathStages,
    sides: Mapping[str, Side],
    work: Path,
    logs: Mapping[str, List[str]],
    benchmark: DesignCompareBenchmark,
) -> Dict[str, Future]:
    """Plot each side's Gerbers in the background, once per bundle key (two plots of one key would race)."""

    by_key: Dict[str, Future] = {}
    plots: Dict[str, Future] = {}
    for name, side in sides.items():
        if side.bundle_key not in by_key:

            def plot(name: str = name, side: Side = side) -> Dict[str, Any]:
                with benchmark.span(f"fabrication-{name}"):
                    return stages.fabrication(side, work, logs[name])

            by_key[side.bundle_key] = pool.submit(plot)
        plots[name] = by_key[side.bundle_key]
    return plots


def _details(result: Mapping[str, Any], inputs: ComparisonInputs, modes: Mapping[str, str], *, version: int) -> Dict[str, Any]:
    domains = result["readiness"]["domains"]
    return {
        "result_version": version,
        "ready_domains": [domain for domain, status in domains.items() if status == "ready"],
        "readiness": result["readiness"],
        "base": inputs.base,
        "head": inputs.head,
        "pipeline": PIPELINE,
        "modes": dict(modes),
    }


def run_job(context: JobContext, *, base: str, head: str) -> JobResult:
    """The ``design_compare`` job for a comparison queued on this path (``payload.pipeline``)."""

    payload = context.payload
    project_id = str(payload["project_id"])
    location = project_revision.locate_id(project_id)
    inputs = ComparisonInputs(
        project_id=project_id, repo_path=location.repo_root, base=base, head=head,
        include_unchanged=bool(payload.get("include_unchanged")), requested_by=str(payload.get("requested_by") or ""),
    )
    generator = cli.generator()
    started = time.perf_counter()
    benchmark = DesignCompareBenchmark(
        job_id=context.job_id,
        metadata={
            "projectId": project_id, "base": base, "compare": head, "pipeline": PIPELINE,
            "generatorDigest": generator.digest, "fence": context.fence,
        },
    )
    benchmark_path = job_state_root() / "jobs" / context.job_id / f"benchmark-fence-{context.fence}.json"

    def heartbeat(message: str, percent: Optional[float] = None) -> None:
        print(message, flush=True)
        context.progress(stage="building", message=message, percent=percent)

    publisher = Publisher(context, str(payload["artifact_key"]), generator.digest)
    work = context.staging_dir / "compare"
    work.mkdir(parents=True, exist_ok=True)
    try:
        outcome = run_comparison(
            inputs, publisher, work=work, benchmark=benchmark, heartbeat=heartbeat,
            check_cancelled=context.check_cancelled, render_dir=context.staging_dir / "fabrication-render",
        )
    except Exception:
        try:
            benchmark.write(benchmark_path)
        except Exception:
            logger.exception("Could not publish the failed comparison benchmark")
        raise
    run = outcome.compare_run
    benchmark.update_metadata(
        totalReadyMs=round((time.perf_counter() - started) * 1000, 3),
        modes=outcome.modes,
        compareElapsedMs=run.elapsed_ms if run else None,
        comparePeakRssBytes=run.peak_rss_bytes if run else None,
        schematicChanges=len(outcome.result["schematic"]["changes"]),
        pcbChanges=len(outcome.result["pcb"]["changes"]),
        bomChanges=len((outcome.result.get("bom") or {}).get("changes") or []),
    )
    benchmark.write(benchmark_path)
    complete, sidecars = publisher.prepare_complete(outcome.result, outcome.modes, base=base, head=head)
    from app.services.design_compare_service import _prune_revision_cache

    _prune_revision_cache()
    return JobResult(
        message="Design comparison ready",
        artifact=complete,
        sidecar_artifacts=sidecars,
        details={
            **_details(outcome.result, inputs, outcome.modes, version=2),
            "benchmark_path": str(benchmark_path),
            "sidecar_count": len(sidecars),
        },
    )
