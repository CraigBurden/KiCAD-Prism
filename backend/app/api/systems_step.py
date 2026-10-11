"""System Builder STEP export (SB2-109, CONTRACTS_P2 §25). Registered on ``systems.router``."""

from __future__ import annotations

from fastapi import Depends
from fastapi.responses import FileResponse

from app.api.systems import _caller, _run, router, system_service
from app.core.security import AuthenticatedUser, require_viewer


@router.post("/{system_id}/step", status_code=202)
async def request_step_export(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §25: queue a STEP export of the placed system (or join the one running); 202 ``{jobId}``."""
    return await _run(lambda: system_service.service.request_step_export(_caller(user), system_id))


@router.get("/{system_id}/step")
async def step_export(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §25: the latest export's state."""
    return await _run(lambda: system_service.service.step_export(_caller(user), system_id))


@router.get("/{system_id}/step/file")
async def step_export_file(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §25: the ready export, when the reader can see every board it holds."""
    path, name = await _run(lambda: system_service.service.step_export_file(_caller(user), system_id))
    return FileResponse(path, media_type="model/step", filename=name,
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})
