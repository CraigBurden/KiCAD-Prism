"""
Comments API for KiCAD-Prism Collaboration Feature.

Comment CRUD is backed by the PostgreSQL ``comments`` schema. Visualizer markers
are published via ecad-viewer overlay scenes (never written into KiCad sources).
"""

import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api._helpers import get_project_for_role_or_404
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import access_service
from app.services.comments_store_service import (
    COMMENT_CLASSES,
    COMMENT_SEVERITIES,
    DEFAULT_COMMENT_CLASS,
    DEFAULT_COMMENT_SEVERITY,
    comments_store,
)

router = APIRouter(dependencies=[Depends(require_viewer)])


# ============================================================
# PYDANTIC MODELS
# ============================================================

class CommentLocation(BaseModel):
    x: float
    y: float
    layer: str = ""
    page: str = ""
    bounds: Optional[List[float]] = None  # [x, y, w, h] for area comments


class CreateCommentRequest(BaseModel):
    context: str  # "PCB" or "SCH"
    location: CommentLocation
    content: str
    author: Optional[str] = "anonymous"
    elementId: Optional[str] = None
    elementRef: Optional[str] = None
    elementType: Optional[str] = None
    commentClass: Optional[str] = DEFAULT_COMMENT_CLASS
    severity: Optional[str] = DEFAULT_COMMENT_SEVERITY
    mentions: Optional[List[str]] = None


class CreateReplyRequest(BaseModel):
    content: str
    author: Optional[str] = "anonymous"


class UpdateCommentRequest(BaseModel):
    status: Optional[str] = None  # "OPEN" or "RESOLVED"


class CommentReply(BaseModel):
    author: str
    timestamp: str
    content: str


class Comment(BaseModel):
    id: str
    author: str
    timestamp: str
    status: str
    context: str
    location: CommentLocation
    content: str
    replies: List[CommentReply] = Field(default_factory=list)
    elementId: Optional[str] = None
    elementRef: Optional[str] = None
    elementType: Optional[str] = None
    commentClass: str = DEFAULT_COMMENT_CLASS
    severity: str = DEFAULT_COMMENT_SEVERITY
    mentions: List[str] = Field(default_factory=list)
    # Reserved for future forge Issues sync (null/omitted until enabled).
    forgeProvider: Optional[str] = None
    forgeIssueId: Optional[str] = None
    forgeIssueUrl: Optional[str] = None
    forgeSyncState: Optional[str] = None


class CommentsMeta(BaseModel):
    version: str = "1.0"
    generator: str = "KiCad-Prism-Web"


class CommentsFile(BaseModel):
    meta: CommentsMeta = Field(default_factory=CommentsMeta)
    comments: List[Comment] = Field(default_factory=list)


class MentionCandidate(BaseModel):
    email: str
    role: str


def _normalize_author(author: Optional[str]) -> str:
    return (author or "anonymous").strip() or "anonymous"


def _normalize_context(context: str) -> str:
    normalized = context.upper().strip()
    if normalized not in {"PCB", "SCH"}:
        raise HTTPException(status_code=400, detail="Context must be 'PCB' or 'SCH'")
    return normalized


def _normalize_content(content: str, *, field: str = "content") -> str:
    normalized = content.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{field.capitalize()} cannot be empty")
    return normalized


def _normalize_bounds(bounds: Optional[List[float]]) -> Optional[List[float]]:
    if bounds is None:
        return None
    if len(bounds) != 4:
        raise HTTPException(status_code=400, detail="location.bounds must be [x, y, w, h]")
    try:
        x, y, w, h = (float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3]))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="location.bounds must be numeric")
    if w <= 0 or h <= 0:
        raise HTTPException(status_code=400, detail="location.bounds width/height must be > 0")
    return [x, y, w, h]


def _normalize_comment_class(value: Optional[str]) -> str:
    normalized = (value or DEFAULT_COMMENT_CLASS).strip().lower()
    if normalized not in COMMENT_CLASSES:
        raise HTTPException(
            status_code=400,
            detail=f"commentClass must be one of: {', '.join(COMMENT_CLASSES)}",
        )
    return normalized


def _normalize_severity(value: Optional[str]) -> str:
    normalized = (value or DEFAULT_COMMENT_SEVERITY).strip().lower()
    if normalized not in COMMENT_SEVERITIES:
        raise HTTPException(
            status_code=400,
            detail=f"severity must be one of: {', '.join(COMMENT_SEVERITIES)}",
        )
    return normalized


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("/{project_id}/comments/mention-candidates", response_model=List[MentionCandidate])
async def list_mention_candidates(
    project_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Workspace-scoped users available for @mentions in comments.
    Requires project access; list itself is instance-wide role assignments.
    """
    get_project_for_role_or_404(project_id, user.role)
    return [
        MentionCandidate(email=item["email"], role=item["role"])
        for item in access_service.list_role_assignments()
    ]


@router.get("/{project_id}/comments")
async def get_comments(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """
    Get all comments for a project from DB snapshot.
    """
    project = get_project_for_role_or_404(project_id, user.role)
    return comments_store.get_comments_file(project.id, project.path)


@router.post("/{project_id}/comments", dependencies=[Depends(require_designer)])
async def create_comment(
    project_id: str,
    request: CreateCommentRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Create a new comment on the design.
    """
    project = get_project_for_role_or_404(project_id, user.role)

    context = _normalize_context(request.context)
    content = _normalize_content(request.content)
    location = request.location.model_dump()
    location["bounds"] = _normalize_bounds(request.location.bounds)

    return comments_store.create_comment(
        project_id=project.id,
        project_path=project.path,
        context=context,
        location=location,
        content=content,
        author=_normalize_author(request.author),
        element_id=request.elementId,
        element_ref=request.elementRef,
        element_type=request.elementType,
        comment_class=_normalize_comment_class(request.commentClass),
        severity=_normalize_severity(request.severity),
        mentions=request.mentions,
    )


@router.patch("/{project_id}/comments/{comment_id}", dependencies=[Depends(require_designer)])
async def update_comment(
    project_id: str,
    comment_id: str,
    request: UpdateCommentRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Update a comment's status (e.g., resolve it).
    """
    project = get_project_for_role_or_404(project_id, user.role)

    if request.status is None:
        raise HTTPException(status_code=400, detail="No update fields provided")

    status = request.status.upper()
    if status not in {"OPEN", "RESOLVED"}:
        raise HTTPException(status_code=400, detail="Status must be 'OPEN' or 'RESOLVED'")

    updated_comment = comments_store.update_comment_status(
        project_id=project.id,
        project_path=project.path,
        comment_id=comment_id,
        status=status,
    )

    if not updated_comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return updated_comment


@router.post("/{project_id}/comments/{comment_id}/replies", dependencies=[Depends(require_designer)])
async def add_reply(
    project_id: str,
    comment_id: str,
    request: CreateReplyRequest,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Add a reply to an existing comment.
    """
    project = get_project_for_role_or_404(project_id, user.role)

    result = comments_store.add_reply(
        project_id=project.id,
        project_path=project.path,
        comment_id=comment_id,
        content=_normalize_content(request.content),
        author=_normalize_author(request.author),
    )

    if not result:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment, reply = result
    return {"comment": comment, "reply": reply}


@router.delete("/{project_id}/comments/{comment_id}", dependencies=[Depends(require_designer)])
async def delete_comment(
    project_id: str,
    comment_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Delete a comment.
    """
    project = get_project_for_role_or_404(project_id, user.role)

    deleted = comments_store.delete_comment(
        project_id=project.id,
        project_path=project.path,
        comment_id=comment_id,
    )

    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found")

    return {"deleted": comment_id}


# ============================================================
# EXPORT ENDPOINT
# ============================================================

@router.post("/{project_id}/comments/push", dependencies=[Depends(require_designer)])
async def push_comments(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    """
    Export DB snapshot to comments.json artifact only.
    Git commit/push is intentionally left to the user workflow.
    """
    project = get_project_for_role_or_404(project_id, user.role)

    try:
        comments_path = comments_store.export_comments_json(project.id, project.path)
        comments_rel_path = os.path.relpath(comments_path, project.path)

        return {
            "success": True,
            "message": "Generated comments artifact from DB snapshot.",
            "comments_path": comments_rel_path,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
