"""System Builder Git tracking routes (CONTRACTS_P2 §21): the repository link, snapshot commits,
manifest import reviews and publishing by commit. Registered on ``systems.router``."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.systems import (
    PublishRequest, _caller, _expected_version, _no_content, _respond, _run, router, system_service,
)
from app.core.security import AuthenticatedUser, require_designer, require_viewer


class GitLinkRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
    branch: Optional[str] = Field(default=None, max_length=200)


@router.get("/{system_id}/git")
async def get_git_link(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §21.5: the system's repository link, or null."""
    return await _run(lambda: system_service.service.git_link(_caller(user), system_id))


@router.put("/{system_id}/git", dependencies=[Depends(require_designer)])
async def put_git_link(
    system_id: str, body: GitLinkRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    version = _expected_version(request, system_id)
    result = await _run(lambda: system_service.service.set_git_link(
        _caller(user), system_id, version, body.url, body.branch,
    ))
    return _respond(result, response)


@router.delete("/{system_id}/git", dependencies=[Depends(require_designer)])
async def delete_git_link(system_id: str, request: Request, user: AuthenticatedUser = Depends(require_viewer)):
    version = _expected_version(request, system_id)
    return _no_content(await _run(lambda: system_service.service.remove_git_link(
        _caller(user), system_id, version,
    )))


@router.post("/{system_id}/git/fetch", dependencies=[Depends(require_designer)], status_code=202)
async def fetch_git(system_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    return await _run(lambda: system_service.service.fetch_git(_caller(user), system_id))


class ManifestImportDecision(BaseModel):
    decision: Literal["accept", "reject"]


@router.post("/{system_id}/reviews/{review_id}/manifest-import", dependencies=[Depends(require_designer)])
async def decide_manifest_import(
    system_id: str, review_id: str, body: ManifestImportDecision, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """P2 §21.3: accept or reject a manifest pushed outside Prism."""
    version = _expected_version(request, system_id)
    result = await _run(lambda: system_service.service.decide_manifest_import(
        _caller(user), system_id, version, review_id, body.decision,
    ))
    return _respond(result, response)


@router.post("/{system_id}/snapshots/{snapshot_id}/git-retry", dependencies=[Depends(require_designer)],
             status_code=202)
async def retry_snapshot_git(system_id: str, snapshot_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """P2 §21.2: queue a failed or refused snapshot commit again."""
    return await _run(lambda: system_service.service.retry_snapshot_git(_caller(user), system_id, snapshot_id))


@router.post("/{system_id}/git/commits/{commit}/publish", dependencies=[Depends(require_designer)])
async def publish_commit(
    system_id: str, commit: str, body: PublishRequest, user: AuthenticatedUser = Depends(require_viewer),
):
    """P2 §21.6: publish the snapshot Prism pushed as ``commit`` (D-P2-46)."""
    def publish():
        snapshot_id = system_service.service.snapshot_for_commit(_caller(user), system_id, commit)
        return system_service.service.publish_snapshot(
            _caller(user), system_id, snapshot_id, ipn=body.ipn, name=body.name,
            description=body.description, manufacturer=body.manufacturer,
        )

    created, publication = await _run(publish)
    return JSONResponse(status_code=201 if created else 200, content=publication)
