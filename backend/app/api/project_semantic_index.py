"""Semantic-index routes of /api/projects (split out of projects.py by WP-S1)."""
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.api._helpers import get_project_for_role_or_404
from app.core.errors import caller_errors, value_errors_as
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import project_service, semantic_index_service

router = APIRouter(dependencies=[Depends(require_viewer)])


@router.get("/{project_id}/semantic-index/status")
async def get_semantic_index_status(
    project_id: str,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)
    with value_errors_as(400):
        return await asyncio.to_thread(semantic_index_service.get_status, project, commit)


class SemanticIndexGenerateRequest(BaseModel):
    commit: Optional[str] = None
    force: bool = False


@router.post("/{project_id}/semantic-index/generate", dependencies=[Depends(require_designer)])
async def generate_semantic_index(
    project_id: str,
    request: SemanticIndexGenerateRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    _ = get_project_for_role_or_404(project_id, user.role)
    with caller_errors((ValueError, 400), (RuntimeError, 503)):
        job_id = await asyncio.to_thread(
            project_service.start_semantic_index_job,
            project_id,
            commit=request.commit,
            force=request.force,
            requested_by=user.email,
        )
        return {"job_id": job_id, "status": "started"}


@router.get("/{project_id}/semantic-index/identity")
async def get_semantic_index_identity(
    request: Request,
    project_id: str,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)
    with caller_errors((ValueError, 400), (RuntimeError, 503)):
        # The stored file goes out as is: parsing and re-serializing a large
        # board's index held tens of MB per request, and the process kept them.
        path, source_revision_key = await asyncio.to_thread(
            semantic_index_service.artifact_file,
            project,
            commit,
        )
        etag = f'"{source_revision_key}-{semantic_index_service.generator_cache_tag()}"'
        headers = {"Cache-Control": "private, max-age=300", "ETag": etag}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        return FileResponse(path, media_type="application/json", headers=headers)
