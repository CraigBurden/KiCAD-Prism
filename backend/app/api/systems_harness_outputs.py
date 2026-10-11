"""System Builder harness coverings and manufacturing outputs (SB2-110, CONTRACTS_P2 §26).
Registered on ``systems.router``."""

from __future__ import annotations

from typing import List, Optional

from fastapi import Body, Depends, Request, Response
from pydantic import BaseModel, Field

from app.api.systems import _caller, _expected_version, _respond, _run, router, system_service
from app.core.security import AuthenticatedUser, require_designer, require_viewer


class CoveringRequest(BaseModel):
    segmentId: str = Field(min_length=1, max_length=400)
    componentId: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: str = Field(default="", max_length=200)


@router.put("/{system_id}/harnesses/{harness_id}/coverings", dependencies=[Depends(require_designer)])
async def set_coverings(system_id: str, harness_id: str, request: Request, response: Response,
                        body: List[CoveringRequest] = Body(max_length=64),
                        user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §26.1: replace the harness's coverings."""
    version = _expected_version(request, system_id)
    coverings = [c.model_dump() for c in body]
    result = await _run(lambda: system_service.service.set_coverings(
        _caller(user), system_id, version, harness_id, coverings))
    return _respond(result, response)


@router.get("/{system_id}/harnesses/{harness_id}/outputs/{name}")
async def harness_output(system_id: str, harness_id: str, name: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §26.2: a drawing (SVG/PDF), wiring list or BOM (CSV) or WireViz YAML of one harness."""
    content, media, filename = await _run(lambda: system_service.service.harness_output(
        _caller(user), system_id, harness_id, name))
    return Response(content, media_type=media, headers={
        "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store",
        "Content-Disposition": f'attachment; filename="{filename}"'})
