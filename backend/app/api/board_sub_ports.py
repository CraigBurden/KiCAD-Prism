"""Board-level sub-ports API (docs/system-builder/CONTRACTS.md §10.4).

Reads need ``read`` on the project, writes ``design``; both go through
``authorized_project``, so a project the caller cannot see is a 404. Writes are
guarded with ``If-Match: "board-sub-port:<id>:<version>"``. The id always
belongs to the project in the path; another project's id is a 404.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict

from app.api._helpers import authorized_project
from app.core import preconditions
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.system_builder.board_sub_ports import (
    ETAG_KIND,
    BoardSubPortNotFound,
    BoardSubPortStore,
    etag,
)

store = BoardSubPortStore()

router = APIRouter()


class CreateBoardSubPortRequest(BaseModel):
    """The caller chooses the id; the store validates its pattern and the rest."""

    model_config = ConfigDict(extra="forbid")

    id: str
    connector: str
    name: str
    pins: list[Any]


class UpdateBoardSubPortRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    pins: list[Any]


def _record(row: dict[str, Any]) -> dict[str, Any]:
    """The stored row in the API's camelCase shape; deletion fields only when deleted."""

    body: dict[str, Any] = {
        "id": row["sub_port_id"],
        "projectId": row["project_id"],
        "connector": row["connector"],
        "name": row["name"],
        "pins": row["pins"],
        "version": row["version"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedBy": row["updated_by"],
        "updatedAt": row["updated_at"],
    }
    if row["deleted_at"] is not None:
        body["deletedAt"] = row["deleted_at"]
        body["deletedBy"] = row["deleted_by"]
    return body


def _history(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "subPortId": row["sub_port_id"],
        "version": row["version"],
        "action": row["action"],
        "name": row["name"],
        "pins": row["pins"],
        "actor": row["actor"],
        "createdAt": row["created_at"],
    }


@router.get("/{project_id}/sub-ports")
def list_board_sub_ports(
    project_id: str,
    connector: Optional[str] = Query(default=None),
    deleted: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_viewer),
) -> list[dict[str, Any]]:
    authorized_project(user, project_id, "read")
    return [
        _record(row)
        for row in store.list(project_id, connector=connector, deleted=deleted)
    ]


@router.post("/{project_id}/sub-ports", status_code=201)
def create_board_sub_port(
    project_id: str, body: CreateBoardSubPortRequest, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    authorized_project(user, project_id, "design")
    record = store.create(
        project_id, body.id, body.connector, body.name, body.pins, actor=user.email,
    )
    response.headers["ETag"] = etag(record)
    return _record(record)


@router.get("/{project_id}/sub-ports/{sub_port_id}")
def read_board_sub_port(
    project_id: str, sub_port_id: str, response: Response,
    user: AuthenticatedUser = Depends(require_viewer),
) -> dict[str, Any]:
    authorized_project(user, project_id, "read")
    record = store.read(project_id, sub_port_id)
    if record is None:
        raise BoardSubPortNotFound()
    response.headers["ETag"] = etag(record)
    return _record(record)


@router.put("/{project_id}/sub-ports/{sub_port_id}")
def update_board_sub_port(
    project_id: str, sub_port_id: str, body: UpdateBoardSubPortRequest,
    request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    authorized_project(user, project_id, "design")
    expected = preconditions.int_version(
        preconditions.if_match(request, ETAG_KIND, sub_port_id)
    )
    record = store.update(
        project_id, sub_port_id, name=body.name, pins=body.pins,
        expected_version=expected, actor=user.email,
    )
    response.headers["ETag"] = etag(record)
    return _record(record)


@router.delete("/{project_id}/sub-ports/{sub_port_id}")
def delete_board_sub_port(
    project_id: str, sub_port_id: str, request: Request, response: Response,
    user: AuthenticatedUser = Depends(require_designer),
) -> dict[str, Any]:
    authorized_project(user, project_id, "design")
    expected = preconditions.int_version(
        preconditions.if_match(request, ETAG_KIND, sub_port_id)
    )
    record = store.delete(
        project_id, sub_port_id, expected_version=expected, actor=user.email,
    )
    response.headers["ETag"] = etag(record)
    return _record(record)


@router.get("/{project_id}/sub-ports/{sub_port_id}/history")
def read_board_sub_port_history(
    project_id: str, sub_port_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
) -> list[dict[str, Any]]:
    authorized_project(user, project_id, "read")
    rows = store.history(project_id, sub_port_id)
    if rows is None:
        raise BoardSubPortNotFound()
    return [_history(row) for row in rows]
