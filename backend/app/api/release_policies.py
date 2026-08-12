"""Admin-only organization policy authoring API (Stage 3 S3-S5)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.security import AuthenticatedUser, require_admin
from app.release_studio.policy import PolicyError, catalogue_payload
from app.services import release_policy_service as policies

router = APIRouter(dependencies=[Depends(require_admin)])


class PolicyCreateRequest(BaseModel):
    policy_key: str = Field(..., min_length=1, max_length=120)
    title: str = Field("", max_length=240)


class PolicyVersionRequest(BaseModel):
    document: dict[str, Any]


class PolicyOverlayRequest(BaseModel):
    overlay: dict[str, Any]


@router.get("/catalogue")
async def rule_catalogue() -> dict[str, Any]:
    return {"rules": catalogue_payload()}


@router.get("")
async def list_policies() -> dict[str, Any]:
    return {"policies": policies.list_policies()}


@router.post("")
async def create_policy(
    request: PolicyCreateRequest,
    user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return _call(
        policies.create_policy,
        policy_key=request.policy_key,
        title=request.title,
        actor=user.email,
    )


@router.get("/{policy_key}")
async def get_policy(policy_key: str) -> dict[str, Any]:
    policy = policies.get_policy(policy_key)
    if policy is None:
        raise HTTPException(status_code=404, detail="Organization policy not found")
    return policy


@router.post("/{policy_key}/versions")
async def create_version(
    policy_key: str,
    request: PolicyVersionRequest,
    user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return _call(
        policies.create_version,
        policy_key,
        document=request.document,
        actor=user.email,
    )


@router.put("/{policy_key}/versions/{version}")
async def update_version(
    policy_key: str,
    version: int,
    request: PolicyVersionRequest,
    user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return _call(
        policies.update_draft,
        policy_key,
        version,
        document=request.document,
        actor=user.email,
    )


@router.post("/{policy_key}/versions/{version}/publish")
async def publish_version(
    policy_key: str,
    version: int,
    user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return _call(policies.publish, policy_key, version, actor=user.email)


@router.post("/{policy_key}/versions/{version}/retire")
async def retire_version(
    policy_key: str,
    version: int,
    user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, Any]:
    return _call(policies.retire, policy_key, version, actor=user.email)


@router.get("/{policy_key}/audit")
async def policy_audit(policy_key: str) -> dict[str, Any]:
    """Who changed this policy, and whether the record has been tampered with."""

    return {
        "events": policies.list_policy_audit_events(policy_key),
        "verification": policies.verify_policy_audit_chain(policy_key),
    }


@router.get("/{policy_key}/diff")
async def diff_versions(
    policy_key: str,
    from_version: int = Query(..., alias="from"),
    to_version: int = Query(..., alias="to"),
) -> dict[str, Any]:
    return _call(policies.version_diff, policy_key, from_version, to_version)


@router.post("/preview/inheritance")
async def inheritance_preview(request: PolicyOverlayRequest) -> dict[str, Any]:
    return _call(policies.inheritance_preview, request.overlay)


def _call(function, *args, **kwargs):
    try:
        return function(*args, **kwargs)
    except PolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


__all__ = ["router"]
