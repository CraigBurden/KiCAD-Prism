"""Build waves and structured build progress for the Release Studio UI.

``run_build_waves`` orders a build's tool work: checks, positions, BOM, the
assembly Cruncher, vendor packs, then artwork. The waves are sequential on
purpose (see the comments in it); documents and packaging follow in
``execute_build``.

The worker already reports a single ``stage`` / ``message`` / ``percent``
triple. That is enough for a spinner and not enough for a GitHub Actions-style
jobs list. ``PipelineTracker`` owns the jobs/steps tree that is written into the
job payload as ``pipeline`` and never into a fingerprint or the manifest.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from app.release_studio.steps import (
    CATALOGUE_WAVE_ARTWORK,
    CATALOGUE_WAVE_BOM,
    CATALOGUE_WAVE_CHECKS,
    CATALOGUE_WAVE_POSITIONS,
    STEP_CATALOGUE,
    StepOutput,
    run_step_catalogue,
)
from app.release_studio.vendors import generate_vendor_outputs, resolve_vendor_ids
from app.services.kicad_tools import KicadTool, KicadTools

logger = logging.getLogger(__name__)

ProgressFn = Callable[..., None]


@dataclass(frozen=True, slots=True)
class PipelineStepSpec:
    id: str
    name: str


@dataclass(frozen=True, slots=True)
class PipelineJobSpec:
    id: str
    name: str
    steps: tuple[PipelineStepSpec, ...]


def pipeline_skeleton(
    *,
    vendor_ids: Sequence[str] = (),
    include_schematic: bool = True,
) -> dict[str, Any]:
    """Return the queued jobs/steps graph the UI can render before work starts."""

    jobs = [_job_payload(spec) for spec in _job_specs(vendor_ids, include_schematic)]
    return {"jobs": jobs}


def _job_specs(
    vendor_ids: Sequence[str],
    include_schematic: bool,
) -> tuple[PipelineJobSpec, ...]:
    vendor_steps = tuple(
        PipelineStepSpec(id=f"vendor-{vendor_id}", name=f"Vendor {vendor_id}")
        for vendor_id in vendor_ids
    )
    artwork_steps = [
        PipelineStepSpec("gerbers", "Gerbers"),
        PipelineStepSpec("drill", "Drill"),
    ]
    if include_schematic:
        artwork_steps.append(PipelineStepSpec("schematic_pdf", "Schematic PDF"))
    return (
        PipelineJobSpec(
            "closure",
            "Closure",
            (PipelineStepSpec("closure", "Materialize input closure"),),
        ),
        PipelineJobSpec(
            "checks",
            "Checks",
            (
                PipelineStepSpec("drc", "DRC"),
                PipelineStepSpec("erc", "ERC"),
                PipelineStepSpec("board_stats", "Board stats"),
            ),
        ),
        PipelineJobSpec(
            "assembly",
            "Assembly",
            (
                PipelineStepSpec("positions", "Positions"),
                PipelineStepSpec("bom", "Bill of materials"),
                PipelineStepSpec("cruncher-assembly", "Assembly views"),
                *vendor_steps,
            ),
        ),
        PipelineJobSpec("artwork", "Artwork", tuple(artwork_steps)),
        PipelineJobSpec(
            "documents",
            "Documents",
            (
                PipelineStepSpec("documents-cover", "Cover page"),
                PipelineStepSpec("documents-fabrication", "Fabrication drawings"),
                PipelineStepSpec("documents-impedance", "Controlled impedance table"),
                PipelineStepSpec("documents-stackup", "Append manufacturer stackup"),
                PipelineStepSpec("documents-assembly", "Assembly drawings"),
                PipelineStepSpec("documents-testpoint", "Testpoint drawings"),
                PipelineStepSpec("documents-drill", "Drill drawing"),
                PipelineStepSpec("documents-bom", "Bill of materials PDF"),
                PipelineStepSpec("documents", "Finish documentation"),
            ),
        ),
        PipelineJobSpec(
            "package",
            "Package",
            (PipelineStepSpec("package", "Canonicalize, fingerprint, record"),),
        ),
    )


def _job_payload(spec: PipelineJobSpec) -> dict[str, Any]:
    return {
        "id": spec.id,
        "name": spec.name,
        "status": "queued",
        "steps": [
            {"id": step.id, "name": step.name, "status": "queued"}
            for step in spec.steps
        ],
    }


class PipelineTracker:
    """Mutate a pipeline tree and push it to the job payload on every flip."""

    def __init__(
        self,
        progress: ProgressFn | None,
        *,
        vendor_ids: Sequence[str] = (),
        include_schematic: bool = True,
    ) -> None:
        self._progress = progress
        self._pipeline = pipeline_skeleton(
            vendor_ids=vendor_ids,
            include_schematic=include_schematic,
        )
        self._step_index = {
            step["id"]: (job, step)
            for job in self._pipeline["jobs"]
            for step in job["steps"]
        }

    @property
    def snapshot(self) -> dict[str, Any]:
        return self._pipeline

    def seed(self, *, percent: float = 0, message: str = "Queued") -> None:
        self._emit(stage="queued", message=message, percent=percent)

    def start(self, step_id: str, *, message: str | None = None, percent: float | None = None) -> None:
        self._set_step(step_id, "in_progress")
        self._emit(
            stage=step_id,
            message=message or f"Running {self._step_name(step_id)}",
            percent=percent,
        )

    def succeed(
        self,
        step_id: str,
        *,
        elapsed_ms: int | None = None,
        log: str = "",
        message: str | None = None,
        percent: float | None = None,
    ) -> None:
        extra: dict[str, Any] = {}
        if elapsed_ms is not None:
            extra["elapsed_ms"] = elapsed_ms
        if log:
            extra["log"] = log[-4000:]
        self._set_step(step_id, "success", **extra)
        self._emit(
            stage=step_id,
            message=message or f"Finished {self._step_name(step_id)}",
            percent=percent,
        )

    def fail(
        self,
        step_id: str,
        *,
        message: str,
        log: str = "",
        elapsed_ms: int | None = None,
        percent: float | None = None,
    ) -> None:
        extra: dict[str, Any] = {"message": message}
        if elapsed_ms is not None:
            extra["elapsed_ms"] = elapsed_ms
        if log:
            extra["log"] = log[-4000:]
        self._set_step(step_id, "failure", **extra)
        self._emit(stage=step_id, message=message, percent=percent)

    def skip(self, step_id: str, *, reason: str = "") -> None:
        extra = {"message": reason} if reason else {}
        self._set_step(step_id, "skipped", **extra)
        self._emit(stage=step_id, message=reason or f"Skipped {self._step_name(step_id)}")

    def catalogue_event(
        self,
        step_id: str,
        status: str,
        *,
        elapsed_ms: int | None = None,
        log: str = "",
        message: str = "",
        percent: float | None = None,
    ) -> None:
        if status == "in_progress":
            self.start(step_id, message=message or None, percent=percent)
            return
        if status == "success":
            self.succeed(
                step_id,
                elapsed_ms=elapsed_ms,
                log=log,
                message=message or None,
                percent=percent,
            )
            return
        if status == "skipped":
            self.skip(step_id, reason=message)
            return
        self.fail(
            step_id,
            message=message or f"{step_id} failed",
            log=log,
            elapsed_ms=elapsed_ms,
            percent=percent,
        )

    def _step_name(self, step_id: str) -> str:
        pair = self._step_index.get(step_id)
        if pair is None:
            return step_id
        return str(pair[1].get("name") or step_id)

    def _set_step(self, step_id: str, status: str, **extra: Any) -> None:
        pair = self._step_index.get(step_id)
        if pair is None:
            return
        job, step = pair
        step["status"] = status
        step.update(extra)
        job["status"] = _job_status(job["steps"])

    def _emit(
        self,
        *,
        stage: str,
        message: str,
        percent: float | None = None,
    ) -> None:
        if self._progress is None:
            return
        kwargs: dict[str, Any] = {
            "stage": stage,
            "message": message,
            "payload_updates": {"pipeline": self._pipeline},
            "force": True,
        }
        if percent is not None:
            kwargs["percent"] = percent
        line = f"[{stage}] {message}"
        if percent is not None:
            line = f"{line} ({percent:.0f}%)"
        print(line, flush=True)
        self._progress(**kwargs)


def _job_status(steps: Sequence[Mapping[str, Any]]) -> str:
    statuses = [str(step.get("status") or "queued") for step in steps]
    if any(status == "failure" for status in statuses):
        return "failure"
    if all(status in {"success", "skipped"} for status in statuses):
        return "success"
    if any(status == "in_progress" for status in statuses):
        return "in_progress"
    if any(status == "success" for status in statuses):
        return "in_progress"
    return "queued"


@dataclass(frozen=True)
class WaveOutputs:
    """What the tool waves produced, before documents and packaging."""

    #: Catalogue outputs in ``STEP_CATALOGUE`` order.
    outputs: tuple[StepOutput, ...]
    by_step: Mapping[str, StepOutput]
    assembly_views: dict[str, Any] | None
    assembly_error: BaseException | None
    vendor_outputs: tuple[StepOutput, ...]
    extra_evidence: dict[str, bytes]


def run_build_waves(
    tracker: PipelineTracker,
    *,
    progress: ProgressFn,
    tools: KicadTools,
    closure_root: Path,
    output_root: Path,
    artwork_root: Path,
    config: Mapping[str, Any],
    variant: str,
    timings: list[dict[str, Any]],
) -> WaveOutputs:
    """Run the catalogue waves, the assembly Cruncher and the vendor packs, in order.

    Each wave appends its wall time to ``timings`` (evidence, never hashed).
    """

    def _timed(name: str, fn):
        started = time.perf_counter()
        try:
            return fn()
        finally:
            timings.append(
                {
                    "name": name,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            )

    board_rel = str(config.get("board") or "")
    board_path = closure_root / board_rel if board_rel else None
    schematic_rel = str(config.get("schematic") or "") or None
    bom_preset = str(config.get("bom_preset") or "")
    assembly_views: dict[str, Any] | None = None
    assembly_error: BaseException | None = None
    cruncher_pool: ThreadPoolExecutor | None = None

    def _catalogue(timing_name: str, only: tuple[str, ...], *, with_bom_preset: bool = False):
        return _timed(
            timing_name,
            lambda: run_step_catalogue(
                closure_root=closure_root,
                board_rel=board_rel,
                schematic_rel=schematic_rel,
                output_root=output_root,
                variant=variant,
                tool=tools.cli,
                only=only,
                progress=lambda **kwargs: progress(**kwargs),
                on_step=tracker.catalogue_event,
                bom_preset=bom_preset if with_bom_preset else "",
            ),
        )

    try:
        # Checks first. Positions, then BOM, then Cruncher: each of those
        # used to share the worker with DRC/ERC and with each other, and
        # BOM died with std::bad_alloc.
        outputs_checks = _catalogue("catalogue-wave-checks", CATALOGUE_WAVE_CHECKS)
        outputs_positions = _catalogue("catalogue-wave-positions", CATALOGUE_WAVE_POSITIONS)
        outputs_bom = _catalogue(
            "catalogue-wave-bom",
            CATALOGUE_WAVE_BOM,
            with_bom_preset=True,
        )
        tracker.start("cruncher-assembly", message="Rendering assembly views")
        cruncher = tools.cruncher
        if cruncher is not None and board_path is not None and board_path.is_file():
            from app.release_studio.documents.artwork import acquire_board_views

            cruncher_pool = ThreadPoolExecutor(
                max_workers=1, thread_name_prefix="rs-cruncher"
            )
            cruncher_future = cruncher_pool.submit(
                lambda: _timed(
                    "cruncher-assembly",
                    lambda: acquire_board_views(cruncher, board_path, artwork_root),
                )
            )
        else:
            cruncher_future = None
            tracker.skip(
                "cruncher-assembly",
                reason="kicad-cruncher is not available"
                if cruncher is None
                else "no board in the closure",
            )
        if cruncher_future is not None:
            try:
                assembly_views = cruncher_future.result()
                tracker.succeed("cruncher-assembly")
            except Exception as exc:  # noqa: BLE001 - compose records the miss
                assembly_error = exc
                logger.warning(
                    "Release Studio assembly views unavailable: %s", exc
                )
                tracker.fail("cruncher-assembly", message=str(exc))
        # Vendor generators also load the board; run them after the
        # assembly Cruncher so the two parses are not overlapped.
        #
        # Measured, because it looks like free parallelism and is not:
        # overlapping the two on JTYU-OBC took 147.9s against 155.7s
        # serial -- 8s saved -- while peak worker RSS went from 1.68 GiB
        # to 6.41 GiB. Both are Cruncher board loads and both are CPU
        # bound, so concurrency splits the same cores and buys nothing
        # except an OOM risk on a host with less memory than this one.
        vendor_outputs, extra_evidence = _timed(
            "vendors",
            lambda: _run_vendors(
                config=config,
                closure_root=closure_root,
                output_root=output_root,
                variant=variant,
                cruncher=cruncher,
                tracker=tracker,
            ),
        )
        outputs_artwork = _catalogue("catalogue-wave-artwork", CATALOGUE_WAVE_ARTWORK)
    finally:
        if cruncher_pool is not None:
            cruncher_pool.shutdown(wait=True)

    combined = {
        output.step_id: output
        for output in (*outputs_checks, *outputs_positions, *outputs_bom, *outputs_artwork)
    }
    return WaveOutputs(
        outputs=tuple(
            combined[spec.step_id] for spec in STEP_CATALOGUE if spec.step_id in combined
        ),
        by_step=combined,
        assembly_views=assembly_views,
        assembly_error=assembly_error,
        vendor_outputs=vendor_outputs,
        extra_evidence=extra_evidence,
    )





def _run_vendors(
    *,
    config: Mapping[str, Any],
    closure_root: Path,
    output_root: Path,
    variant: str,
    cruncher: KicadTool | None,
    tracker: PipelineTracker,
) -> tuple[tuple[StepOutput, ...], dict[str, bytes]]:
    """Generate configured vendor packs after the assembly Cruncher load."""

    vendor_ids = resolve_vendor_ids(config)
    if not vendor_ids:
        return (), {}
    for vendor_id in vendor_ids:
        tracker.start(f"vendor-{vendor_id}", message=f"Generating {vendor_id} pack")
    outputs, extra_evidence = generate_vendor_outputs(
        config=config,
        closure_root=closure_root,
        output_root=output_root,
        variant=variant,
        cruncher=cruncher,
    )
    by_id = {output.step_id: output for output in outputs}
    for vendor_id in vendor_ids:
        step_id = f"vendor-{vendor_id}"
        output = by_id.get(step_id)
        if output is None:
            tracker.skip(step_id, reason="vendor generator produced no output")
            continue
        log = "\n".join(part for part in (output.stdout, output.stderr) if part)
        if output.skipped_reason:
            tracker.skip(step_id, reason=output.skipped_reason)
        elif output.returncode != 0:
            tracker.fail(
                step_id,
                message=output.stderr or output.skipped_reason or f"{vendor_id} failed",
                log=log,
                elapsed_ms=output.elapsed_ms,
            )
        else:
            tracker.succeed(step_id, elapsed_ms=output.elapsed_ms, log=log)
    return outputs, extra_evidence


__all__ = [
    "PipelineJobSpec",
    "PipelineStepSpec",
    "PipelineTracker",
    "WaveOutputs",
    "pipeline_skeleton",
    "run_build_waves",
]
