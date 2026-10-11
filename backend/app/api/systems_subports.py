"""System Builder sub-ports (SB2-105, CONTRACTS_P2 §22): carve named pad sets out of a connector,
edit and remove them; each answers the row moves it makes, or would make with ``?preview=true``.
Registered on ``systems.router``."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Query, Request, Response
from pydantic import BaseModel, Field

from app.api.systems import _caller, _expected_version, _respond, _run, router, system_service
from app.core.security import AuthenticatedUser, require_designer, require_viewer


class CreateSubportRequest(BaseModel):
    portKey: str = Field(min_length=1, max_length=2000)
    name: str = Field(min_length=1, max_length=32)
    pads: list[str] = Field(min_length=1, max_length=1000)


class UpdateSubportRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=32)
    pads: Optional[list[str]] = Field(default=None, min_length=1, max_length=1000)


def _version(request: Request, system_id: str, preview: bool) -> int:
    """A preview writes nothing, so it needs no ``If-Match``."""
    return 0 if preview else _expected_version(request, system_id)


@router.post("/{system_id}/instances/{instance_id}/subports", dependencies=[Depends(require_designer)])
async def create_subport(
    system_id: str, instance_id: str, body: CreateSubportRequest, request: Request, response: Response,
    preview: bool = Query(default=False), user: AuthenticatedUser = Depends(require_viewer),
):
    version = _version(request, system_id, preview)
    result = await _run(lambda: system_service.service.create_subport(
        _caller(user), system_id, version, instance_id, port_key=body.portKey, name=body.name, pads=body.pads,
        preview=preview,
    ))
    return _respond(result, response, 200 if preview else 201)


@router.patch("/{system_id}/instances/{instance_id}/subports/{subport_id}", dependencies=[Depends(require_designer)])
async def update_subport(
    system_id: str, instance_id: str, subport_id: str, body: UpdateSubportRequest, request: Request,
    response: Response, preview: bool = Query(default=False), user: AuthenticatedUser = Depends(require_viewer),
):
    version = _version(request, system_id, preview)
    result = await _run(lambda: system_service.service.update_subport(
        _caller(user), system_id, version, instance_id, subport_id, name=body.name, pads=body.pads, preview=preview,
    ))
    return _respond(result, response)


@router.delete("/{system_id}/instances/{instance_id}/subports/{subport_id}", dependencies=[Depends(require_designer)])
async def delete_subport(
    system_id: str, instance_id: str, subport_id: str, request: Request, response: Response,
    preview: bool = Query(default=False), user: AuthenticatedUser = Depends(require_viewer),
):
    version = _version(request, system_id, preview)
    result = await _run(lambda: system_service.service.delete_subport(
        _caller(user), system_id, version, instance_id, subport_id, preview=preview,
    ))
    return _respond(result, response)
