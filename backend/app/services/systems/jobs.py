"""Interface extraction as a job (§3, §8 ``202``).

One job per ``(project, commit, extractor version)``: the artifact key makes
concurrent requests share the active job, and ``system_interface_artifacts``
is the cache, so a finished extraction is never repeated.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Callable, ContextManager, Iterator

from app.services.job_kinds import JobKind, JobSubject, repository_lock
from app.services.systems.interface_extractor import EXTRACTOR_VERSION, extract_for_revision
from app.services.systems.store import SystemStore

logger = logging.getLogger(__name__)

EXTRACT_JOB_KIND = "system_interface_extract"


def artifact_key(project_id: str, commit: str) -> str:
    return f"system-interface:v{EXTRACTOR_VERSION}:{project_id}:{commit}"


@contextmanager
def workspace_connection() -> Iterator[Any]:
    from app.services.postgres_database import database

    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        yield conn


def enqueue_extraction(project_id: str, commit: str, *, requested_by: str = "") -> dict[str, Any]:
    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id) or {}
    return EXTRACT.enqueue(
        {"project_id": project_id, "commit": commit},
        subject=JobSubject.of_project(row, project_id),
        artifact_key=artifact_key(project_id, commit),
        requested_by=requested_by,
    )


def extract_and_store(
    project: Any, commit: str, connect: Callable[[], ContextManager[Any]] = workspace_connection
) -> dict[str, Any]:
    """Return the cached artifact, or extract it and cache it."""

    with connect() as conn:
        cached = SystemStore(conn).get_interface(str(project.id), commit, EXTRACTOR_VERSION)
    if cached is not None:
        return cached
    payload = extract_for_revision(project, commit)
    with connect() as conn:
        stored = SystemStore(conn).put_interface(payload)
        conn.commit()
    return stored


def run_system_interface_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult, PermanentJobError
    from app.services.project_service import _workspace_row_to_project
    from app.services.workspace_service import workspace

    project_id = str(context.payload["project_id"])
    commit = str(context.payload["commit"])
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise PermanentJobError("Project not found", code="project_missing")
    context.progress(stage="system-interface", message="Extracting board interface", percent=10, force=True)
    try:
        stored = extract_and_store(_workspace_row_to_project(row), commit)
    except ValueError as error:
        # Missing commit or project file at that commit: retrying cannot help.
        logger.info("System interface extraction failed for %s@%s: %s", project_id, commit, error)
        raise PermanentJobError("Source is not readable at this commit", code="source_unavailable") from error
    from app.services.systems.service import service as system_service

    system_service.refresh_counts_for_interface(project_id, commit)  # D12: the findings change at that baseline
    return JobResult(
        message="Board interface is ready",
        details={"digest": stored["digest"], "components": len(stored.get("components") or [])},
    )


EXTRACT = JobKind(
    EXTRACT_JOB_KIND,
    run_system_interface_job,
    resources={"prism_worker": 1, "semantic_compile": 1},
    lock=repository_lock("read"),
)
JOB_KINDS = (EXTRACT,)
