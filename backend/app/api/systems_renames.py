"""System Builder net rename proposals (SB2-106, CONTRACTS_P2 §23): propose and withdraw in a system,
and the board page's view of the systems that use a project. Registered on ``systems.router``."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.api.systems import _caller, _expected_version, _no_content, _respond, _run, router, system_service
from app.core.security import AuthenticatedUser, require_designer, require_viewer


class RenameRequest(BaseModel):
    instanceId: str = Field(min_length=1, max_length=200)
    net: str = Field(min_length=1, max_length=500)
    name: str = Field(min_length=1, max_length=100)
    note: Optional[str] = Field(default=None, max_length=2000)


@router.get("/by-project/{project_id}")
async def systems_using_project(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """§23.5: the systems the reader can see that place this project, with their open proposals."""
    return await _run(lambda: system_service.service.systems_using_project(_caller(user), project_id))


@router.get("/by-project/{project_id}/renames.csv")
async def project_renames_csv(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    content = await _run(lambda: system_service.service.project_renames_csv(_caller(user), project_id))
    return PlainTextResponse(content, media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": 'attachment; filename="net-renames.csv"', "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store"})


@router.post("/{system_id}/renames", dependencies=[Depends(require_designer)], status_code=201)
async def propose_rename(
    system_id: str, body: RenameRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    version = _expected_version(request, system_id)
    result = await _run(lambda: system_service.service.propose_rename(
        _caller(user), system_id, version, instance_id=body.instanceId, net=body.net, name=body.name, note=body.note,
    ))
    return _respond(result, response, status_code=201)


@router.delete("/{system_id}/renames/{rename_id}", dependencies=[Depends(require_designer)])
async def withdraw_rename(system_id: str, rename_id: str, request: Request, user: AuthenticatedUser = Depends(require_viewer)):
    version = _expected_version(request, system_id)
    return _no_content(await _run(lambda: system_service.service.withdraw_rename(
        _caller(user), system_id, version, rename_id,
    )))
