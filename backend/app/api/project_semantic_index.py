"""Semantic-index routes of /api/projects (split out of projects.py by WP-S1)."""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.api._helpers import get_project_for_role_or_404
from app.core.errors import caller_errors, value_errors_as
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import semantic_index_service

router = APIRouter(dependencies=[Depends(require_viewer)])


@router.get("/{project_id}/semantic-index/status")
async def get_semantic_index_status(
    project_id: str,
    response: Response,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)
    with value_errors_as(400):
        status, headers = await asyncio.to_thread(semantic_index_service.get_status, project, commit)
    for name, value in headers.items():
        response.headers[name] = value
    return status


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
    with caller_errors((ValueError, 400), (RuntimeError, 503), (LookupError, 404)):
        result = await asyncio.to_thread(
            semantic_index_service.start_generate_job,
            project_id,
            commit=request.commit,
            force=request.force,
            requested_by=user.email,
        )
        return result


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
        artifact = await asyncio.to_thread(
            semantic_index_service.artifact_file,
            project,
            commit,
        )
        path, source_revision_key = artifact
        # ADR G9: a bundle-served file is identified by the design revision key
        # and the bundle's generator digest.
        etag = f'"{source_revision_key}-{artifact.generator}"'
        headers = {"Cache-Control": "private, max-age=300", "ETag": etag, **artifact.headers}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        return FileResponse(path, media_type="application/json", headers=headers)
