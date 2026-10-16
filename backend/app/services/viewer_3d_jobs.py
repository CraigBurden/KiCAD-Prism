"""The webgpu_3d job kind (moved out of project_service.py by WP-S1)."""

import hashlib
import json
import shutil
from typing import Any

from app.services import semantic_index_service
from app.services.job_artifact_service import job_artifacts
from app.services.job_kinds import JobKind, repository_lock
from app.services.job_runtime import JobContext, JobResult
from app.services.workspace_service import workspace


def _workspace_row_to_project(row: dict):
    # Looked up in project_service at call time: no import cycle whichever module is imported
    # first, and a patch of project_service._workspace_row_to_project still reaches this job.
    from app.services import project_service

    return project_service._workspace_row_to_project(row)


def webgpu_artifact_key(row: dict, commit: str | None, *, force: bool = False) -> str:
    """The ``webgpu_3d`` job key for a project row at ``commit`` (or its workspace).

    It names the 3D generator build, so a completed job from an older viewer or
    pipeline build never stands in for a bundle the current build cannot read.
    """
    from app.services import semantic_visualizer_service

    source_selector = commit or f"workspace:{row.get('last_modified') or ''}"
    return hashlib.sha256(
        json.dumps(
            {
                "project": str(row.get("id") or ""),
                "projectFileRel": str(row.get("project_file_rel") or ""),
                "source": source_selector,
                "force": bool(force),
                "generator": semantic_index_service.generator_cache_tag(),
                "webgpuBuild": semantic_visualizer_service.BUILD_FINGERPRINT,
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()


def run_webgpu_3d_job_v3(context: JobContext) -> JobResult:
    from app.services import semantic_visualizer_service

    payload = context.payload
    project_id = str(payload["project_id"])
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError("Project not found")
    expected_anchor = str(payload.get("project_file_rel") or "")
    current_anchor = str(row.get("project_file_rel") or "")
    if current_anchor != expected_anchor:
        raise RuntimeError(
            "Project anchor changed after WebGPU generation was queued; retry the job"
        )
    project = _workspace_row_to_project(row)
    commit = payload.get("commit")
    force = bool(payload.get("force"))
    artifact_key = str(payload["artifact_key"])
    status_selector = semantic_visualizer_service.status_selector_for_project(
        project,
        commit=str(commit) if commit else None,
        last_modified=row.get("last_modified") or "",
    )
    state: dict[str, Any] = {
        "job_id": context.job_id,
        "status": "running",
        "stage": "starting",
        "message": "Generating WebGPU 3D assets...",
        "percent": 0,
        "project_id": project_id,
        "status_selector": status_selector,
        "logs": [],
        "performance": [],
    }
    if commit:
        state["commit"] = commit
    emitted_logs = 0
    last_readiness_stage: dict[str, str | None] = {"value": None}

    def persist() -> None:
        nonlocal emitted_logs
        logs = list(state.get("logs") or [])
        for line in logs[emitted_logs:]:
            print(str(line), flush=True)
        emitted_logs = len(logs)
        readiness_stage = state.get("readiness_stage")
        milestone = (
            isinstance(readiness_stage, str)
            and readiness_stage
            and readiness_stage != last_readiness_stage["value"]
        )
        if milestone:
            last_readiness_stage["value"] = str(readiness_stage)
        payload_updates: dict[str, Any] = {}
        for key in (
            "bundle_url",
            "readiness",
            "readiness_stage",
            "sourceRevisionKey",
            "source_fingerprint",
            "status_selector",
            "commit",
        ):
            if key in state and state[key] is not None:
                payload_updates[key] = state[key]
        if logs:
            payload_updates["logs"] = logs[-80:]
        if state.get("bundle_url") and state.get("readiness"):
            semantic_visualizer_service.sync_staged_webgpu_status(
                job_id=context.job_id,
                fence=context.fence,
                project=project,
                state=state,
            )
        context.progress(
            stage=str(state.get("stage") or "building"),
            message=str(state.get("message") or "Generating WebGPU 3D assets..."),
            percent=float(state.get("percent") or 0),
            payload_updates=payload_updates or None,
            force=bool(milestone),
        )

    context.check_cancelled()
    if commit:
        status = semantic_visualizer_service.build_visualizer_bundle_for_commit(
            project,
            str(commit),
            state,
            persist,
            force=force,
        )
    else:
        status = semantic_visualizer_service.build_visualizer_bundle(
            project,
            state,
            persist,
            force=force,
        )
    context.check_cancelled()
    source_fingerprint = str(status["source_fingerprint"])
    build_fingerprint = str(status["build_fingerprint"])
    bundle_path = semantic_visualizer_service.bundle_path(
        project_id,
        source_fingerprint,
        build_fingerprint,
    )
    staged_manifest = context.staging_dir / "bundle.json"
    shutil.copy2(bundle_path, staged_manifest)
    artifact = job_artifacts.prepare_file(
        context,
        staged_manifest,
        kind="webgpu_3d",
        artifact_key=artifact_key,
        media_type="application/json",
        schema_version=str(status.get("schema") or ""),
        generator_version=build_fingerprint,
        readiness="ready",
    )
    status_selector = semantic_visualizer_service.status_selector_for_project(
        project,
        commit=str(status.get("commit") or commit) if commit else None,
        last_modified=row.get("last_modified") or "",
    )
    return JobResult(
        message="WebGPU 3D assets are ready",
        artifact=artifact,
        details={
            **status,
            "project_id": project_id,
            "status_selector": status_selector,
            "performance": state.get("performance") or [],
        },
    )


WEBGPU_3D = JobKind(
    "webgpu_3d",
    run_webgpu_3d_job_v3,
    resources={"prism_worker": 1, "webgpu": 1, "semantic_compile": 1},
    lock=repository_lock("read"),
)
JOB_KINDS = (WEBGPU_3D,)
