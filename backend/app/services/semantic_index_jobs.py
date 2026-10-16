"""The semantic_index job kind (moved out of project_service.py by WP-S1)."""

import hashlib
import json

from app.services import semantic_index_service
from app.services.job_artifact_service import job_artifacts
from app.services.job_kinds import JobKind, JobSubject, repository_lock
from app.services.job_runtime import JobContext, JobResult
from app.services.project_service import _workspace_row_to_project
from app.services.workspace_service import workspace


def start_semantic_index_job(
    project_id: str,
    *,
    commit: str | None = None,
    force: bool = False,
    requested_by: str = "",
) -> str:
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError("Project not found")
    project_file_rel = str(row.get("project_file_rel") or "")
    source_selector = commit or f"workspace:{row.get('last_modified') or ''}"
    artifact_key = hashlib.sha256(
        json.dumps(
            {
                "project": project_id,
                "projectFileRel": project_file_rel,
                "source": source_selector,
                "generator": semantic_index_service.generator_cache_tag(),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    queued = SEMANTIC_INDEX.enqueue(
        {
            "project_id": project_id,
            "commit": commit,
            "force": bool(force),
            "artifact_key": artifact_key,
            "project_file_rel": project_file_rel,
        },
        subject=JobSubject.of_project(row, project_id),
        artifact_key="" if force else artifact_key,
        requested_by=requested_by,
    )
    return str(queued["job_id"])


def run_semantic_index_job_v3(context: JobContext) -> JobResult:
    payload = context.payload
    project_id = str(payload["project_id"])
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError("Project not found")
    expected_anchor = str(payload.get("project_file_rel") or "")
    current_anchor = str(row.get("project_file_rel") or "")
    if current_anchor != expected_anchor:
        raise RuntimeError(
            "Project anchor changed after semantic indexing was queued; retry the job"
        )
    project = _workspace_row_to_project(row)
    commit = payload.get("commit")
    context.progress(
        stage="semantic-compile",
        message="Generating semantic identity index",
        percent=10,
        force=True,
    )
    result = semantic_index_service.generate(
        project,
        str(commit) if commit else None,
        force=bool(payload.get("force")),
    )
    context.check_cancelled()
    artifact = job_artifacts.prepare_json(
        context,
        result,
        kind="semantic_index",
        artifact_key=str(payload["artifact_key"]),
        schema_version=str(result.get("schema") or ""),
        generator_version=semantic_index_service.generator_cache_tag(),
    )
    return JobResult(
        message="Semantic identity index is ready",
        artifact=artifact,
        details={
            "available": True,
            "sourceRevisionKey": result.get("sourceRevisionKey"),
            "generator": result.get("generator"),
        },
    )


SEMANTIC_INDEX = JobKind(
    "semantic_index",
    run_semantic_index_job_v3,
    resources={"prism_worker": 1, "semantic_compile": 1},
    lock=repository_lock("read"),
)
JOB_KINDS = (SEMANTIC_INDEX,)
