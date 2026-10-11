from __future__ import annotations

import logging
from typing import Any, Callable, Iterable, Mapping

from app.services.job_runtime import JobHandler

logger = logging.getLogger(__name__)

_HANDLERS: dict[str, JobHandler] = {}
# kind -> (settle(job row), orphans() -> job ids)
_ON_END: dict[str, tuple[Callable[[Mapping[str, Any]], Any], Callable[[], Iterable[str]]]] = {}


def register_job_handler(kind: str, handler: JobHandler) -> None:
    normalized = kind.strip()
    if not normalized:
        raise ValueError("Job handler kind cannot be empty")
    if normalized in _HANDLERS and _HANDLERS[normalized] is not handler:
        raise RuntimeError(f"Job handler already registered: {normalized}")
    _HANDLERS[normalized] = handler


def register_job_end(
    kind: str,
    settle: Callable[[Mapping[str, Any]], Any],
    orphans: Callable[[], Iterable[str]],
) -> None:
    """Let a kind settle its own rows from the job's end state.

    ``settle(job)`` must be idempotent and leave rows of a still-executing
    attempt alone; ``orphans()`` lists jobs whose rows were left behind.
    """

    _ON_END[kind] = (settle, orphans)


def settle_job_end(job_id: str, service: Any) -> None:
    """Run the kind's end hook for ``job_id``; failures are logged, never raised."""

    try:
        load_builtin_job_handlers()
        job = service.get(job_id)
        hook = _ON_END.get(str((job or {}).get("kind") or ""))
        if job is not None and hook is not None:
            hook[0](job)
    except Exception:
        logger.exception("Could not settle the end of job %s", job_id)


def sweep_job_ends(service: Any) -> None:
    """Settle rows whose job ended without its process settling them."""

    load_builtin_job_handlers()
    for kind, (_settle, orphans) in sorted(_ON_END.items()):
        try:
            job_ids = list(orphans())
        except Exception:
            logger.exception("Could not list unsettled %s jobs", kind)
            continue
        for job_id in job_ids:
            settle_job_end(job_id, service)


def get_job_handler(kind: str) -> JobHandler | None:
    return _HANDLERS.get(kind)


def registered_job_kinds() -> tuple[str, ...]:
    return tuple(sorted(_HANDLERS))


def load_builtin_job_handlers() -> None:
    from app.services.catalog_worker_tasks import (
        HANDLERS as catalog_handlers,
        run_catalog_job_v3,
    )
    from app.services.design_compare_service import run_design_compare_job_v3
    from app.services.release_studio_build_service import (
        run_release_studio_build_job,
        run_release_studio_configuration_publish_job,
    )
    from app.services.project_import_service import (
        run_project_analyze_job_v3,
        run_project_import_job_v3,
        run_project_metadata_job_v3,
        run_project_sync_job_v3,
        run_project_thumbnail_job_v3,
    )
    from app.services.project_service import (
        run_kicad_workflow_job_v3,
        run_semantic_index_job_v3,
        run_webgpu_3d_job_v3,
    )

    register_job_handler("design_compare", run_design_compare_job_v3)
    register_job_handler("release_studio_build", run_release_studio_build_job)
    from app.services import release_build_attempts

    register_job_end(
        "release_studio_build",
        release_build_attempts.settle_build_job,
        release_build_attempts.orphaned_jobs,
    )
    register_job_handler(
        "release_studio_configuration_publish",
        run_release_studio_configuration_publish_job,
    )
    register_job_handler("webgpu_3d", run_webgpu_3d_job_v3)
    register_job_handler("kicad_workflow", run_kicad_workflow_job_v3)
    register_job_handler("semantic_index", run_semantic_index_job_v3)
    register_job_handler("project_analyze", run_project_analyze_job_v3)
    register_job_handler("project_import", run_project_import_job_v3)
    register_job_handler("project_sync", run_project_sync_job_v3)
    register_job_handler("project_metadata", run_project_metadata_job_v3)
    register_job_handler("project_thumbnail", run_project_thumbnail_job_v3)
    for job_type in catalog_handlers:
        register_job_handler(job_type, run_catalog_job_v3)
    from app.services.systems.jobs import EXTRACT_JOB_KIND, run_system_interface_job

    register_job_handler(EXTRACT_JOB_KIND, run_system_interface_job)
    from app.services.systems.detection import SOURCE_CHECK_JOB_KIND, run_source_check_job

    register_job_handler(SOURCE_CHECK_JOB_KIND, run_source_check_job)
    from app.services.systems.child_drift import CHILD_CHECK_JOB_KIND, run_child_check_job

    register_job_handler(CHILD_CHECK_JOB_KIND, run_child_check_job)
    from app.services.systems import git_tracking

    register_job_handler(git_tracking.SYNC_JOB_KIND, git_tracking.run_sync_job)
    register_job_handler(git_tracking.COMMIT_JOB_KIND, git_tracking.run_commit_job)
    from app.services.systems.service_collisions import COLLISION_JOB_KIND, run_collision_job

    register_job_handler(COLLISION_JOB_KIND, run_collision_job)
    from app.services.systems.service_step_export import STEP_JOB_KIND, run_step_job

    register_job_handler(STEP_JOB_KIND, run_step_job)
    from app.services.trackers.jobs import register_tracker_job_handlers

    register_tracker_job_handlers(register_job_handler)
