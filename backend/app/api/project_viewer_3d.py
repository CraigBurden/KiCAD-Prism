"""WebGPU 3D routes of /api/projects (split out of projects.py by WP-S1)."""
import asyncio
import mimetypes
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api._helpers import get_project_for_role_or_404
from app.core.errors import value_errors_as
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import project_service, semantic_visualizer_service
from app.services.job_service import jobs as v3_jobs

router = APIRouter(dependencies=[Depends(require_viewer)])


@router.get("/{project_id}/webgpu-3d/status")
async def get_webgpu_3d_status(
    project_id: str,
    commit: Optional[str] = Query(default=None),
    diagnostic: bool = Query(
        default=False,
        description="Perform full bundle validation instead of metadata-only readiness.",
    ),
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)
    with value_errors_as(400):
        status_reader = (
            semantic_visualizer_service.get_status
            if diagnostic
            else semantic_visualizer_service.get_status_fast
        )
        return await asyncio.to_thread(status_reader, project, commit)


class WebGpu3dGenerateRequest(BaseModel):
    commit: Optional[str] = None
    force: bool = False


@router.post("/{project_id}/webgpu-3d/generate", dependencies=[Depends(require_designer)])
async def generate_webgpu_3d(
    project_id: str,
    request: WebGpu3dGenerateRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    _ = get_project_for_role_or_404(project_id, user.role)
    job_id = await asyncio.to_thread(
        project_service.start_workflow_job,
        project_id,
        "webgpu_3d",
        user.email,
        force=request.force,
        commit=request.commit,
    )
    return {"job_id": job_id}


@router.get("/{project_id}/webgpu-3d/manifest")
async def get_webgpu_3d_manifest(
    project_id: str,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)
    status = await asyncio.to_thread(
        semantic_visualizer_service.get_status_fast,
        project,
        commit,
    )
    if not status.get("available"):
        raise HTTPException(status_code=404, detail="WebGPU 3D assets are not available for this revision")
    path = semantic_visualizer_service.bundle_path(
        project_id,
        status["source_fingerprint"],
        status["build_fingerprint"],
    )
    if not path.is_file():
        selector = str(status.get("status_selector") or "")
        if selector:
            await asyncio.to_thread(
                v3_jobs.invalidate_webgpu_ready,
                project_id,
                selector,
                str(status["build_fingerprint"]),
            )
        raise HTTPException(status_code=404, detail="WebGPU 3D assets are not available for this revision")
    return FileResponse(path, media_type="application/json", headers={"Cache-Control": "private, max-age=300"})


@router.get("/{project_id}/webgpu-3d/assets/{source_revision_key}/{generator_build}/{asset_path:path}")
async def get_webgpu_3d_asset(
    project_id: str,
    source_revision_key: str,
    generator_build: str,
    asset_path: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    _ = get_project_for_role_or_404(project_id, user.role)
    with value_errors_as(400):
        root = semantic_visualizer_service.bundle_dir(
            project_id,
            source_revision_key,
            generator_build,
        ).resolve()
    candidate = (root / asset_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise HTTPException(status_code=400, detail="Invalid WebGPU asset path")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="WebGPU asset not found")
    media_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
    return FileResponse(candidate, media_type=media_type, headers={"Cache-Control": "private, max-age=31536000, immutable"})
