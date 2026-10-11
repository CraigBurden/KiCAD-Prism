"""Caller policy: who may do what to which resource.

Plain functions over the authenticated caller. Nothing here touches the
database or the request; routes and services ask, and the ``require_*``
dependencies in ``app.core.security`` are thin adapters over it.
"""

from __future__ import annotations

from typing import Protocol

from fastapi import HTTPException

from app.core.roles import Role


class Caller(Protocol):
    email: str
    role: Role
    auth_type: str
    scopes: list[str]


def normalize_identity(value: object) -> str:
    """The one comparison form for an account email or ``created_by`` value."""
    return str(value or "").strip().casefold()


def is_owner(caller: Caller, owner: object) -> bool:
    """Whether ``owner`` names the caller. An empty owner names nobody."""
    normalized = normalize_identity(owner)
    return bool(normalized) and normalized == normalize_identity(caller.email)


def owner_or_admin(caller: Caller, owner: object) -> bool:
    return caller.role == "admin" or is_owner(caller, owner)


def require_owner_or_admin(caller: Caller, owner: object, *, detail: str) -> None:
    if not owner_or_admin(caller, owner):
        raise HTTPException(status_code=403, detail=detail)
