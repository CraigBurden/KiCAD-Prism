"""WebGPU 3D routes of /api/projects (split out of projects.py by WP-S1).

With ``PRISM_DESIGN_SOURCE_VIEWER_3D=bundle`` the routes serve the analytic
model from the design bundle (``viewer_3d_bundle.py``, ADR amendment V2):
status and generate go through the bundle and its ``design_bundle`` job,
``/webgpu-3d/analytic`` is the viewer's bundle document, and the asset route
serves its members under ``design-bundle/``. ``legacy`` keeps the mesh path,
which System Builder's scene also reads through the asset route, until V2b
deletes it (amendment V2 §2.3).
"""

import asyncio
import mimetypes
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from app.api._helpers import get_project_for_role_or_404
from app.core.errors import caller_errors, value_errors_as
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import project_service, semantic_visualizer_service, viewer_3d_bundle
from app.services.design_bundle import consumer, regenerate
from app.services.design_bundle import jobs as bundle_jobs
from app.services.design_bundle.cli import CliUnavailable
from app.services.job_service import jobs as v3_jobs

router = APIRouter(dependencies=[Depends(require_viewer)])


def _from_bundle() -> bool:
    return consumer.source("VIEWER_3D") == "bundle"


def _bundle_errors():
    """A missing project or ``prism-kicad`` as the caller's status (design_bundles.py maps them so)."""

    return caller_errors((LookupError, 404), (CliUnavailable, 503))


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
    if _from_bundle():
        with value_errors_as(400), _bundle_errors():
            return await asyncio.to_thread(viewer_3d_bundle.status, project_id, commit, requested_by=user.email)
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
    if _from_bundle():
        # The bundle services refuse with exceptions written for the caller (as design_bundles.py maps them).
        with caller_errors(
            (regenerate.RegenerateConflict, 409),
            (regenerate.RegenerateNotApplicable, 422),
            (LookupError, 404),
            (CliUnavailable, 503),
        ):
            return await asyncio.to_thread(_generate_bundle, project_id, request, user.email)
    job_id = await asyncio.to_thread(
        project_service.start_workflow_job,
        project_id,
        "webgpu_3d",
        user.email,
        force=request.force,
        commit=request.commit,
    )
    return {"job_id": job_id}


def _generate_bundle(project_id: str, request: WebGpu3dGenerateRequest, requested_by: str) -> dict:
    """Queue the commit's design bundle; ``force`` rebuilds it without reuse (K2b)."""

    if not request.force:
        return {"job_id": bundle_jobs.start_design_bundle_job(project_id, commit=request.commit, requested_by=requested_by)}
    return {"job_id": regenerate.regenerate(project_id, commit=request.commit, requested_by=requested_by).job_id}


@router.get("/{project_id}/webgpu-3d/analytic")
async def get_webgpu_3d_analytic(
    project_id: str,
    commit: Optional[str] = Query(default=None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    """The viewer's ``prism.viewer_3d.analytic.a0`` document (bundle mode only)."""

    _ = get_project_for_role_or_404(project_id, user.role)
    if not _from_bundle():
        raise HTTPException(status_code=404, detail="The 3D tab reads meshes; no analytic model is served")
    with value_errors_as(400), _bundle_errors():
        document = await asyncio.to_thread(viewer_3d_bundle.document, project_id, commit)
    if document is None:
        raise HTTPException(status_code=404, detail="The board's analytic model is not stored yet")
    # Staged: the parts join when stage models stores them, so no long caching.
    return JSONResponse(document, headers={"Cache-Control": "no-store"})


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
    if asset_path.startswith(viewer_3d_bundle.ASSET_PREFIX):
        if not _from_bundle():
            raise HTTPException(status_code=404, detail="WebGPU asset not found")
        with value_errors_as(400), _bundle_errors():
            found = await asyncio.to_thread(
                viewer_3d_bundle.member,
                project_id,
                source_revision_key,
                generator_build,
                asset_path[len(viewer_3d_bundle.ASSET_PREFIX):],
            )
        if found is None:
            raise HTTPException(status_code=404, detail="WebGPU asset not found")
        data, media_type = found
        # A revision key and generator name these bytes for good.
        return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=31536000, immutable"})
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
