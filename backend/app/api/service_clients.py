from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.roles import Role
from app.core.security import AuthenticatedUser, require_admin
from app.services import service_client_service

router = APIRouter(prefix="/api/admin/service-clients", tags=["service-clients"])


class CreateServiceClientRequest(BaseModel):
    name: str = Field(default="", max_length=120)
    role: Role = "viewer"
    scopes: list[str] = Field(default_factory=lambda: ["api:read"])


class SetServiceClientEnabledRequest(BaseModel):
    enabled: bool


@router.get("")
async def list_service_clients(user: AuthenticatedUser = Depends(require_admin)):
    _ = user
    return {"items": service_client_service.list_service_clients()}


@router.post("")
async def create_service_client(
    payload: CreateServiceClientRequest,
    user: AuthenticatedUser = Depends(require_admin),
):
    _ = user
    return service_client_service.create_service_client(
        name=payload.name,
        role=payload.role,
        scopes=payload.scopes,
    )


@router.post("/{client_id}/rotate-secret")
async def rotate_service_client_secret(client_id: str, user: AuthenticatedUser = Depends(require_admin)):
    _ = user
    return service_client_service.rotate_service_client_secret(client_id)


@router.patch("/{client_id}")
async def set_service_client_enabled(
    client_id: str,
    payload: SetServiceClientEnabledRequest,
    user: AuthenticatedUser = Depends(require_admin),
):
    _ = user
    return service_client_service.set_service_client_enabled(client_id, payload.enabled)


@router.delete("/{client_id}")
async def delete_service_client(client_id: str, user: AuthenticatedUser = Depends(require_admin)):
    _ = user
    if not service_client_service.delete_service_client(client_id):
        raise HTTPException(status_code=404, detail="Service client not found")
    return {"ok": True}
