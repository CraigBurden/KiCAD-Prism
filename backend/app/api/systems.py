"""System Builder v2: the systems API (docs/system-builder/CONTRACTS.md §5).

Reads need a viewer, writes and deletes a designer; a delete is further limited
to the system's owner or an admin. Writes are guarded with
``If-Match: "system:<id>:<version>"``. Every document response is redacted for
boards the caller cannot see (§6).
"""

from __future__ import annotations

import json
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.api._helpers import authorized_project
from app.core import errors, policy, preconditions
from app.core.security import (
    AuthenticatedUser,
    require_catalog_reader,
    require_catalog_writer,
    require_designer,
    require_viewer,
)
from app.services.workspace_service import workspace
from app.system_builder.service import Caller, ETAG_KIND, SystemService, etag
from app.system_builder.settings import limits
from app.system_builder.store import SystemStore

store = SystemStore()
service = SystemService(store, limits)

router = APIRouter()


class CreateSystemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    folderId: Optional[str] = None


class SystemOpsRequest(BaseModel):
    """The envelope the engine validates; each operation stays free-form."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    schema_id: Literal["prism.system.ops.a0"] = Field(alias="schema")
    ops: list[dict[str, Any]]


class UndoSystemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int = Field(ge=1)


class CreateSnapshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    note: Optional[str] = None


class GitLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projectId: str = Field(min_length=1)
    branch: str = Field(min_length=1, max_length=255)
    path: Optional[str] = Field(default=None, max_length=1024)


class GitCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)


class PublishSystemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshotId: Optional[str] = Field(default=None, max_length=128)
    identity: Optional[Literal["in-house", "bought-out"]] = None
    ipn: Optional[str] = Field(default=None, max_length=128)
    manufacturer: Optional[str] = Field(default=None, max_length=128)
    mpn: Optional[str] = Field(default=None, max_length=128)
    changeSummary: str = Field(min_length=1, max_length=2000)


def _caller(user: AuthenticatedUser) -> Caller:
    return Caller(
        email=user.email,
        name=user.name,
        role=user.role,
        can_see_project=lambda project_id: workspace.get_project_for_role(project_id, user.role) is not None,
    )


def _system(viewed: dict[str, Any]) -> dict[str, Any]:
    """A viewed record in the API's camelCase shape."""

    return {
        "systemId": viewed["system_id"],
        "name": viewed["name"],
        "folderId": viewed["folder_id"],
        "version": viewed["version"],
        "document": viewed["document"],
        "redacted": viewed["redacted"],
        "createdBy": viewed["created_by"],
        "createdAt": viewed["created_at"],
        "updatedAt": viewed["updated_at"],
    }


def _summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "systemId": row["system_id"],
        "name": row["name"],
        "folderId": row["folder_id"],
        "version": row["version"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _history_entry(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": row["version"],
        "kind": row["kind"],
        "actor": row["actor"],
        "undoes": row["undoes"],
        "touched": row["touched"],
        "createdAt": row["created_at"],
    }


def _snapshot(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshotId": row["snapshot_id"],
        "systemId": row["system_id"],
        "version": row["version"],
        "name": row["name"],
        "note": row["note"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
    }


def _snapshot_view(row: dict[str, Any], caller: Caller) -> dict[str, Any]:
    viewed = service.view(row, caller)
    answer = {**_snapshot(viewed), "document": viewed["document"], "redacted": viewed["redacted"]}
    copied = row.get("boardSubPorts")
    if copied is not None:
        # The copy is redacted like the document: definitions on a project the caller cannot see are withheld.
        answer["boardSubPorts"] = {
            **copied,
            "subPorts": [item for item in copied.get("subPorts", []) if caller.can_see_project(item["projectId"])],
        }
    if viewed.get("git_commit_job_id"):
        answer["gitCommitJobId"] = viewed["git_commit_job_id"]
    return answer


def _link_view(row: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    return {
        "projectId": row["project_id"],
        "branch": row["branch"],
        "path": row["path"],
        "lastCommit": row["last_commit"],
        "lastBlob": row["last_blob"],
        "lastVersion": row["last_version"],
        "linkedBy": row["linked_by"],
        "linkedAt": row["linked_at"],
    }


def _job_view(row: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """One commit job in the shape the link screen reads, divergence blob included."""

    if row is None:
        return None
    payload = row.get("payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = {}
    return {
        "jobId": row.get("job_id") or row.get("id"),
        "status": row["status"],
        "errorCode": row.get("error_code"),
        "errorMessage": row.get("error_message"),
        "blob": (payload or {}).get("diverged_blob"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _git_answer(answer: dict[str, Any]) -> dict[str, Any]:
    return {
        "systemId": answer["systemId"],
        "link": _link_view(answer["link"]),
        "lastJob": _job_view(answer["job"]),
    }


def _bundle(answer: dict[str, Any]) -> dict[str, Any]:
    """The service's bundle answer in the API's camelCase shape."""

    body: dict[str, Any] = {
        "state": answer["state"],
        "key": answer["key"],
        "pending": answer["pending"],
        "documentVersion": answer["documentVersion"],
    }
    if "bundle" in answer:
        body["bundle"] = answer["bundle"]
    if "error" in answer:
        body["error"] = answer["error"]
    return body


@router.get("/systems")
def list_systems(user: AuthenticatedUser = Depends(require_viewer)) -> list[dict[str, Any]]:
    return [_summary(row) for row in store.list(role=user.role)]


@router.post("/systems", status_code=201)
def create_system(
    body: CreateSystemRequest, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    viewed = service.create(
        _caller(user), role=user.role, name=body.name,
        description=body.description, folder_id=body.folderId,
    )
    response.headers["ETag"] = etag(viewed)
    return _system(viewed)


@router.get("/systems/{system_id}")
def read_system(
    system_id: str, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    viewed = service.read(system_id, _caller(user), role=user.role)
    response.headers["ETag"] = etag(viewed)
    return _system(viewed)


@router.get("/systems/{system_id}/bundle")
def read_bundle(
    system_id: str, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    viewed = service.read(system_id, _caller(user), role=user.role)
    answer = service.bundle(system_id, _caller(user), role=user.role)
    response.headers["ETag"] = etag(viewed)
    return _bundle(answer)


@router.post("/systems/{system_id}/ops")
def apply_ops(
    system_id: str, body: SystemOpsRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    expected = preconditions.if_match(request, ETAG_KIND, system_id)
    viewed = service.apply(
        system_id, _caller(user), role=user.role,
        expected=expected, request_ops=body.ops,
    )
    response.headers["ETag"] = etag(viewed)
    return _system(viewed)


@router.post("/systems/{system_id}/undo")
def undo_system(
    system_id: str, body: UndoSystemRequest, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    expected = preconditions.if_match(request, ETAG_KIND, system_id)
    viewed = service.undo(
        system_id, _caller(user), role=user.role,
        expected=expected, version=body.version,
    )
    response.headers["ETag"] = etag(viewed)
    return _system(viewed)


@router.get("/systems/{system_id}/history")
def read_history(
    system_id: str,
    before: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    user: AuthenticatedUser = Depends(require_viewer),
) -> list[dict[str, Any]]:
    service.read(system_id, _caller(user), role=user.role)
    return [_history_entry(row) for row in store.history(system_id, before=before, limit=limit)]


@router.get("/systems/{system_id}/snapshots")
def list_snapshots(
    system_id: str, user: AuthenticatedUser = Depends(require_viewer),
) -> list[dict[str, Any]]:
    service.read(system_id, _caller(user), role=user.role)
    return [_snapshot(row) for row in store.list_snapshots(system_id)]


@router.post("/systems/{system_id}/snapshots", status_code=201)
def create_snapshot(
    system_id: str, body: CreateSnapshotRequest,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    created = service.snapshot(
        system_id, _caller(user), role=user.role, name=body.name, note=body.note,
    )
    return _snapshot_view(created, _caller(user))


@router.get("/systems/{system_id}/snapshots/{snapshot_id}")
def read_snapshot(
    system_id: str, snapshot_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    service.read(system_id, _caller(user), role=user.role)
    snapshot = store.read_snapshot(system_id, snapshot_id)
    if snapshot is None:
        raise errors.NotFound("Snapshot not found")
    return _snapshot_view(snapshot, _caller(user))


@router.get("/systems/{system_id}/git")
def read_system_git(
    system_id: str, user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    return _git_answer(service.git(system_id, _caller(user), role=user.role))


@router.put("/systems/{system_id}/git")
def link_system_git(
    system_id: str, body: GitLinkRequest,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    project = authorized_project(user, body.projectId, "design")
    return _git_answer(
        service.link_git(
            system_id, _caller(user), role=user.role, project=project,
            branch=body.branch, path=body.path,
        )
    )


@router.delete("/systems/{system_id}/git", status_code=204)
def unlink_system_git(
    system_id: str, user: AuthenticatedUser = Depends(require_designer),
) -> Response:
    service.unlink_git(system_id, _caller(user), role=user.role)
    return Response(status_code=204)


@router.post("/systems/{system_id}/git/commit", status_code=202)
def commit_system_git(
    system_id: str, body: GitCommitRequest, request: Request,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    expected = preconditions.if_match(request, ETAG_KIND, system_id)
    link = service.link_record(system_id, _caller(user), role=user.role)
    project = authorized_project(user, str(link["project_id"]), "design")
    return _git_answer(
        service.commit_git(
            system_id, _caller(user), role=user.role, project=project,
            message=body.message, expected=expected,
        )
    )


@router.post("/systems/{system_id}/git/import")
def import_system_git(
    system_id: str, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    expected = preconditions.if_match(request, ETAG_KIND, system_id)
    link = service.link_record(system_id, _caller(user), role=user.role)
    project = authorized_project(user, str(link["project_id"]), "design")
    viewed = service.import_git(
        system_id, _caller(user), role=user.role, project=project, expected=expected,
    )
    response.headers["ETag"] = etag(viewed)
    return _system(viewed)


@router.post("/systems/{system_id}/publish")
def publish_system(
    system_id: str, body: PublishSystemRequest, request: Request,
    user: AuthenticatedUser = Depends(require_designer),
    _catalog_writer: AuthenticatedUser = Depends(require_catalog_writer),
) -> dict[str, Any]:
    expected = preconditions.if_match(request, ETAG_KIND, system_id)
    return service.publish(
        system_id, _caller(user), role=user.role,
        expected=expected, snapshot_id=body.snapshotId, ipn=body.ipn,
        identity=body.identity, manufacturer=body.manufacturer, mpn=body.mpn,
        change_summary=body.changeSummary,
    )


@router.get("/catalog/system-entries/{revision_id}")
def read_system_entry(
    revision_id: str,
    user: AuthenticatedUser = Depends(require_catalog_reader),
) -> dict[str, Any]:
    return service.entry_view(revision_id, _caller(user), role=user.role)


@router.delete("/systems/{system_id}", status_code=204)
def delete_system(
    system_id: str, user: AuthenticatedUser = Depends(require_designer),
) -> Response:
    record = service.read(system_id, _caller(user), role=user.role)
    policy.require_owner_or_admin(
        user, record["created_by"], detail="Only the system's owner or an admin can delete it",
    )
    if not store.soft_delete(system_id):
        raise errors.NotFound("System not found")
    return Response(status_code=204)
