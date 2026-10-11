"""System Builder findings: waive a warning or info finding with a note, or take a waiver back
(SB2-100, D-P2-56); the reviews and findings report (SB2-107). Registered on ``systems.router``."""

from __future__ import annotations

from typing import Literal

from fastapi import Depends, Request, Response
from pydantic import BaseModel, Field

from app.api.systems import _UNSAFE_FILENAME, _caller, _expected_version, _no_content, _respond, _run, router, system_service
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services.systems.visibility import etag

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/{system_id}/collisions", status_code=202)
async def request_collision_check(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §24.2: queue a collision check of the placed system; 202 ``{jobId}``."""
    return await _run(lambda: system_service.service.request_collision_check(_caller(user), system_id))


@router.get("/{system_id}/collisions")
async def collision_check(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §24.2: the last check, whether it is current, and its SYS-V22 findings."""
    return await _run(lambda: system_service.service.collision_check(_caller(user), system_id))


class WaiverRequest(BaseModel):
    findingKey: str = Field(min_length=1, max_length=2000)
    note: str = Field(min_length=1, max_length=2000)


@router.post("/{system_id}/waivers", dependencies=[Depends(require_designer)], status_code=201)
async def waive_finding(
    system_id: str, body: WaiverRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    version = _expected_version(request, system_id)
    result = await _run(lambda: system_service.service.waive_finding(
        _caller(user), system_id, version, body.findingKey, body.note,
    ))
    return _respond(result, response, status_code=201)


class BatchWaiverRequest(BaseModel):
    findingKeys: list[str] = Field(min_length=1, max_length=1000)
    note: str = Field(min_length=1, max_length=2000)


@router.post("/{system_id}/waivers/batch", dependencies=[Depends(require_designer)], status_code=201)
async def waive_findings(
    system_id: str, body: BatchWaiverRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """SB2-113: several findings waived with one note, in one version."""
    version = _expected_version(request, system_id)
    result = await _run(lambda: system_service.service.waive_findings(
        _caller(user), system_id, version, body.findingKeys, body.note,
    ))
    return _respond(result, response, status_code=201)


@router.delete("/{system_id}/waivers/{waiver_id}", dependencies=[Depends(require_designer)])
async def unwaive_finding(system_id: str, waiver_id: str, request: Request, user: AuthenticatedUser = Depends(require_viewer)):
    version = _expected_version(request, system_id)
    return _no_content(await _run(lambda: system_service.service.unwaive_finding(
        _caller(user), system_id, version, waiver_id,
    )))


@router.get("/{system_id}/report.{fmt}")
async def findings_report(system_id: str, fmt: Literal["xlsx", "csv"], user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §8.6: open reviews and findings, one sheet per section (``csv``: one titled block each)."""
    content, name, version = await _run(lambda: system_service.service.report(_caller(user), system_id, fmt))
    stem = _UNSAFE_FILENAME.sub("-", name).strip("-.") or "system"
    headers = {"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "ETag": etag(system_id, version),
               "Content-Disposition": f'attachment; filename="{stem}-report.{fmt}"'}
    media = XLSX if fmt == "xlsx" else "text/csv; charset=utf-8"
    return Response(content, media_type=media, headers=headers)
