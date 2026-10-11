"""Admin tracker connector HTTP API (TR-19)."""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Optional, TypeVar

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core import errors
from app.core.security import AuthenticatedUser, require_admin
from app.services.trackers.connector_service import (
    ConnectorNotFound,
    ConnectorService,
)
from app.services.trackers.errors import ProviderError
from app.services.trackers.secrets import SecretStoreLocked

_CONNECTOR_PREFIX = "/api/admin/trackers/connectors"

router = APIRouter(
    prefix=_CONNECTOR_PREFIX,
    tags=["tracker-connectors"],
    dependencies=[Depends(require_admin)],
)
service = ConnectorService()

T = TypeVar("T")


class ConnectorCredentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appId: str = ""
    installationId: str = ""
    privateKey: str = ""
    webhookSecret: str = ""
    oauthClientId: str = ""
    oauthClientSecret: str = ""


class CreateConnectorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = None
    provider: str = "github"
    instanceKind: str = "github.com"
    displayName: str = ""
    baseUrl: str = ""
    credentials: Optional[ConnectorCredentials] = None


class UpdateConnectorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    displayName: Optional[str] = None
    baseUrl: Optional[str] = None
    instanceKind: Optional[str] = None
    credentials: Optional[ConnectorCredentials] = None


def _actor(user: AuthenticatedUser) -> str:
    return user.user_id or user.email


def _http_error(exc: Exception) -> errors.DomainError:
    if isinstance(exc, ConnectorNotFound):
        return errors.NotFound("Connector not found", code="connector_not_found")
    if isinstance(exc, SecretStoreLocked):
        return errors.Unavailable("Tracker credential encryption is locked", code="secret_store_locked")
    if isinstance(exc, ProviderError):
        status = 403 if exc.class_ in {"forbidden", "capability_missing"} else 400
        return exc.refusal(409 if exc.class_ == "auth_lost" else status)
    raise exc


async def _run_service(call: Callable[[], T]) -> T:
    try:
        return await asyncio.to_thread(call)
    except Exception as exc:
        raise _http_error(exc) from exc


@router.get("")
async def list_connectors(_admin: AuthenticatedUser = Depends(require_admin)) -> list[dict[str, Any]]:
    return await _run_service(service.list_connectors)


@router.post("")
async def create_connector(
    body: CreateConnectorRequest,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(
        lambda: service.create(
            actor_user_id=_actor(admin),
            provider=body.provider,
            instance_kind=body.instanceKind,
            display_name=body.displayName,
            base_url=body.baseUrl,
            credentials=body.credentials.model_dump() if body.credentials else None,
            connector_id=body.id,
        )
    )


@router.get("/{connector_id}/health")
async def connector_health(
    connector_id: str,
    _admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.health(connector_id))


@router.get("/{connector_id}")
async def get_connector(
    connector_id: str,
    _admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.get(connector_id))


@router.patch("/{connector_id}")
async def update_connector(
    connector_id: str,
    body: UpdateConnectorRequest,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(
        lambda: service.update(
            connector_id,
            actor_user_id=_actor(admin),
            display_name=body.displayName,
            base_url=body.baseUrl,
            instance_kind=body.instanceKind,
            credentials=body.credentials.model_dump() if body.credentials else None,
        )
    )


@router.post("/{connector_id}/pause")
async def pause_connector(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.pause(connector_id, actor_user_id=_actor(admin)))


@router.post("/{connector_id}/resume")
async def resume_connector(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.resume(connector_id, actor_user_id=_actor(admin)))


@router.post("/{connector_id}/revoke")
async def revoke_connector(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.revoke(connector_id, actor_user_id=_actor(admin)))


@router.delete("/{connector_id}")
async def delete_connector(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(lambda: service.delete(connector_id, actor_user_id=_actor(admin)))


@router.get("/{connector_id}/repositories")
async def list_connector_repositories(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> list[dict[str, Any]]:
    """Repositories the installation can reach; feeds the destination picker."""

    del admin
    return await _run_service(lambda: service.list_repositories(connector_id))


@router.post("/{connector_id}/test")
async def test_connector(
    connector_id: str,
    admin: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return await _run_service(
        lambda: service.test_connection(connector_id, actor_user_id=_actor(admin))
    )
