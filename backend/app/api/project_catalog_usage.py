"""Library usage of a project commit: placed catalog revisions and available updates (issue #698).

``GET /api/projects/{project_id}/catalog-usage?commit=`` reports what the
commit (the checkout's ``HEAD`` by default) placed, as the last scan of that
commit recorded it, against the catalog now. ``POST …/catalog-usage/scan``
queues a scan (designer right, like sync). Both resolve the project for the
caller's role. Part names are included: every role may browse the catalog.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api._helpers import authorized_project
from app.core.errors import Conflict, NotFound
from app.core.security import AuthenticatedUser, require_viewer
from app.services import project_catalog_usage_service, project_revision

router = APIRouter(dependencies=[Depends(require_viewer)])

class ScanRequest(BaseModel):
    commit: Optional[str] = None
    force: bool = True


def _translate(error: Exception) -> Exception:
    if isinstance(error, project_revision.RevisionNotFound):
        return NotFound("Commit not found", code="commit_not_found")
    if isinstance(error, project_revision.ProjectNotInRepository):
        return Conflict("The project has no Git checkout", code="project_not_in_repository")
    return error


@router.get("/{project_id}/catalog-usage")
async def get_catalog_usage(
    project_id: str,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    await asyncio.to_thread(authorized_project, user, project_id, "read")
    try:
        report = await asyncio.to_thread(project_catalog_usage_service.report, project_id, commit or "")
    except (project_revision.RevisionNotFound, project_revision.ProjectNotInRepository) as error:
        raise _translate(error) from error
    return report


@router.post("/{project_id}/catalog-usage/scan")
async def scan_catalog_usage(
    project_id: str,
    request: ScanRequest | None = None,
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    await asyncio.to_thread(authorized_project, user, project_id, "design")
    body = request or ScanRequest()
    try:
        job = await asyncio.to_thread(
            project_catalog_usage_service.start_scan, project_id, body.commit or "",
            requested_by=user.email, force=body.force,
        )
    except (project_revision.RevisionNotFound, project_revision.ProjectNotInRepository) as error:
        raise _translate(error) from error
    return {"job_id": str(job.get("job_id") or job.get("id") or ""), "status": str(job.get("status") or "queued")}
