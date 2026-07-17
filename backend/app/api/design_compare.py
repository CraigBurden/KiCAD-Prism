"""Design Comparison API."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api._helpers import get_project_for_role_or_404
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import design_compare_service

router = APIRouter(dependencies=[Depends(require_viewer)])


class DesignCompareRequest(BaseModel):
    base: str = Field(..., description="Older commit SHA")
    head: str = Field(..., description="Newer commit SHA")


@router.post("/{project_id}/design-compare", dependencies=[Depends(require_designer)])
async def start_design_compare(
    project_id: str,
    request: DesignCompareRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    try:
        job_id = design_compare_service.start_design_compare_job(
            project_id, request.base, request.head
        )
        return {"job_id": job_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{project_id}/design-compare/{job_id}/status")
async def design_compare_status(
    project_id: str, job_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    status = design_compare_service.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@router.get("/{project_id}/design-compare/{job_id}")
async def design_compare_result(
    project_id: str, job_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    status = design_compare_service.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    if status.get("status") != "completed":
        raise HTTPException(status_code=409, detail=f"Job status: {status.get('status')}")
    result = design_compare_service.get_job_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@router.delete(
    "/{project_id}/design-compare/{job_id}", dependencies=[Depends(require_designer)]
)
async def delete_design_compare(
    project_id: str, job_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    design_compare_service.delete_job(job_id)
    return {"status": "deleted"}
