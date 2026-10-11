"""System Builder batch exports (SB2-121, CONTRACTS_P2 §4): several ports exported in one version.
Registered on ``systems.router``."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request, Response
from pydantic import BaseModel, Field

from app.api.systems import _caller, _expected_version, _respond, _run, router, system_service
from app.core.security import AuthenticatedUser, require_designer, require_viewer


class BatchExportItem(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    instanceId: str = Field(min_length=1, max_length=200)
    portKey: str = Field(min_length=1, max_length=2000)
    subportId: Optional[str] = Field(default=None, min_length=1, max_length=100)


class BatchExportRequest(BaseModel):
    exports: list[BatchExportItem] = Field(min_length=1, max_length=200)


@router.post("/{system_id}/exports/batch", dependencies=[Depends(require_designer)], status_code=201)
async def create_exports(
    system_id: str, body: BatchExportRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    version = _expected_version(request, system_id)
    items = [item.model_dump() for item in body.exports]
    result = await _run(lambda: system_service.service.create_exports(_caller(user), system_id, version, items))
    return _respond(result, response, status_code=201)
