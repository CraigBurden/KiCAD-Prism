"""Catalog "mates with" and 3D model alignment (CONTRACTS_P2 §18, §18.2).

Routes under ``/api/catalog`` beside ``catalog_admin``, served by the catalog's
``system_items`` facade.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from app.core.errors import caller_errors
from app.core.security import AuthenticatedUser, require_catalog_browser, require_catalog_writer
from app.services.catalog_job_service import catalog_jobs
from app.services.component_catalog_service import catalog_service

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


class MateRequest(BaseModel):
    componentId: str = Field(min_length=1, max_length=200)


def _mates_call(action):
    with caller_errors((LookupError, 404), (ValueError, 422)):
        return {"items": action()}


@router.get("/components/{component_id}/mates-with")
def list_mates_with(component_id: str, user: AuthenticatedUser = Depends(require_catalog_browser)):
    """CONTRACTS_P2 §18: the parts this part mates with."""
    return _mates_call(lambda: catalog_service.system_items.list_mates_with(component_id))


@router.post("/components/{component_id}/mates-with")
def add_mate(component_id: str, body: MateRequest, user: AuthenticatedUser = Depends(require_catalog_writer)):
    return _mates_call(lambda: catalog_service.system_items.set_mate(component_id, body.componentId, mates=True, actor=user.email))


@router.delete("/components/{component_id}/mates-with/{other_id}")
def remove_mate(component_id: str, other_id: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    return _mates_call(lambda: catalog_service.system_items.set_mate(component_id, other_id, mates=False, actor=user.email))


class ModuleConnectorRequest(BaseModel):
    partId: str = Field(min_length=1, max_length=200)
    originMm: list[float] = Field(min_length=3, max_length=3)
    normal: list[float] = Field(min_length=3, max_length=3)
    quarterTurns: int = Field(default=0, ge=0, le=3)
    axis: str | None = Field(default=None, max_length=8)


def _connectors_call(action):
    with caller_errors((LookupError, 404), (ValueError, 422)):
        return action()


@router.get("/components/{component_id}/module-connectors")
def list_module_connectors(component_id: str, user: AuthenticatedUser = Depends(require_catalog_browser)):
    """CONTRACTS_P2 §3.6: each unit of a module's symbol with the connector part placed on its model."""
    return _connectors_call(lambda: catalog_service.system_items.module_connectors(component_id))


@router.get("/components/{component_id}/connector-geometry")
def connector_geometry(component_id: str, user: AuthenticatedUser = Depends(require_catalog_browser)):
    """CONTRACTS_P2 §3.6: a part's footprint geometry at the origin and its model, for placing it on a module."""
    return _connectors_call(lambda: catalog_service.system_items.connector_geometry(component_id))


@router.put("/components/{component_id}/module-connectors/{unit_key}")
def place_module_connector(component_id: str, unit_key: str, body: ModuleConnectorRequest,
                           user: AuthenticatedUser = Depends(require_catalog_writer)):
    placement = body.model_dump(exclude={"partId"})
    return _connectors_call(lambda: catalog_service.system_items.set_module_connector(
        component_id, unit_key, body.partId, placement, actor=user.email))


@router.delete("/components/{component_id}/module-connectors/{unit_key}")
def remove_module_connector(component_id: str, unit_key: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    return _connectors_call(lambda: catalog_service.system_items.remove_module_connector(
        component_id, unit_key, actor=user.email))


class AlignmentRequest(BaseModel):
    offsetMm: list[float] = Field(min_length=3, max_length=3)
    rotationDeg: list[float] = Field(min_length=3, max_length=3)
    scale: float = Field(default=1.0, gt=0, le=100)


def _triple(text: str | None, name: str) -> list[float] | None:
    if text is None:
        return None
    try:
        values = [float(part) for part in text.split(",")]
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{name} takes three comma-separated numbers") from None
    if len(values) != 3:
        raise HTTPException(status_code=422, detail=f"{name} takes three comma-separated numbers")
    return values


@router.get("/components/{component_id}/models")
def list_models(component_id: str, user: AuthenticatedUser = Depends(require_catalog_browser)):
    """CONTRACTS_P2 §18.2: STEP models with their GLB and alignment."""
    return _mates_call(lambda: catalog_service.system_items.list_models(component_id))


@router.post("/components/{component_id}/models/convert")
def convert_models(component_id: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    _mates_call(lambda: catalog_service.system_items.list_models(component_id))  # 404/422 before queueing
    job = catalog_jobs.enqueue("catalog_model_glb", {"componentId": component_id}, created_by=user.email,
                               idempotency_key=f"catalog_model_glb:{component_id}")
    return {"jobId": job.get("id"), "status": job.get("status")}


@router.put("/components/{component_id}/models/{asset_id}/alignment")
def set_model_alignment(component_id: str, asset_id: str, body: AlignmentRequest,
                        user: AuthenticatedUser = Depends(require_catalog_writer)):
    return _mates_call(lambda: catalog_service.system_items.set_model_alignment(component_id, asset_id, body.model_dump(),
                                                                   actor=user.email))


@router.get("/components/{component_id}/models/{asset_id}/preview.svg")
def model_preview(
    component_id: str, asset_id: str,
    view: str = Query(default="front", pattern="^(front|side|top)$"),
    offset: str | None = Query(default=None, max_length=100), rotation: str | None = Query(default=None, max_length=100),
    scale: float | None = Query(default=None, gt=0, le=100), partner: str | None = Query(default=None, max_length=200),
    user: AuthenticatedUser = Depends(require_catalog_browser),
):
    """An orthographic SVG of the model under a (possibly unsaved) alignment, optionally mated to ``partner``."""
    alignment = None
    if offset is not None or rotation is not None or scale is not None:
        alignment = {"offsetMm": _triple(offset, "offset") or [0.0, 0.0, 0.0],
                     "rotationDeg": _triple(rotation, "rotation") or [0.0, 0.0, 0.0], "scale": scale or 1.0}
    with caller_errors((LookupError, 404), (ValueError, 422)):
        svg = catalog_service.system_items.model_preview(component_id, asset_id, view=view, alignment=alignment, partner_id=partner)
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=60"})


@router.get("/models/{key}.glb")
def model_glb(key: str, user: AuthenticatedUser = Depends(require_catalog_browser)):
    if not key.isalnum() or len(key) != 64:
        raise HTTPException(status_code=404, detail="Model not found")
    path = catalog_service.system_items.model_glb_path(key)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Model not found")
    # Content-addressed: the key names the STEP and the converter, so the bytes never change.
    return FileResponse(path, media_type="model/gltf-binary", headers={"Cache-Control": "private, max-age=31536000, immutable"})
