"""Caller policy: may this caller do this action (to this owned resource)?

One table answers it for every route. A rule names the roles that may act, the
scope a bearer token needs, and whether a KiCad remote-provider token may act
at all; checks run in that order (provider token, scope, role) and the first
refusal wins. Session callers carry no scopes, so the scope check only applies
to bearer tokens.

Everything here is pure: no database, no request. The ``require_*``
dependencies in ``app.core.security`` are thin adapters over ``authorize``;
``app.api._helpers.authorized_project`` adds the project lookup. The folder
visibility rule lives here once and generates the SQL predicate the workspace
and System Builder queries use. ``role_matrix_contract`` is the frontend's
role matrix (``scripts/export_role_matrix.py`` writes it to
``frontend/src/lib/role-matrix.generated.ts``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from fastapi import HTTPException

from app.core.roles import (
    CATALOG_BROWSE_ROLES,
    CATALOG_QA_ROLES,
    CATALOG_READ_ROLES,
    CATALOG_WRITE_ROLES,
    PROJECT_RELEASE_ACTOR_ROLES,
    PROJECT_VIEW_ROLES,
    ROLE_ORDER,
    Role,
)


class Caller(Protocol):
    email: str
    role: Role
    auth_type: str
    scopes: list[str]


Action = Literal[
    "read",
    "comment",
    "design",
    "release",
    "admin",
    "catalog_browse",
    "catalog_read",
    "catalog_write",
    "catalog_qa",
    "catalog_admin",
    "remote_symbols",
]

PROVIDER_AUTH_TYPE = "kicad_provider"
ALL_ROLES: frozenset[Role] = frozenset(ROLE_ORDER)

_PROVIDER_READ = "KiCad remote-provider tokens can only read remote symbols"
_PROVIDER_MODIFY = "KiCad remote-provider tokens cannot modify Prism resources"
_PROVIDER_CATALOG = "KiCad remote-provider tokens cannot modify catalog resources"
_PROVIDER_ADMIN = "KiCad remote-provider tokens cannot access admin APIs"


@dataclass(frozen=True)
class Rule:
    roles: frozenset[Role]
    role_detail: str = ""
    # A bearer caller needs one of these ("*" always counts). Empty: no scope check.
    scopes: tuple[str, ...] = ()
    # None: KiCad remote-provider tokens may act. Otherwise the refusal detail.
    provider_refusal: str | None = _PROVIDER_READ


RULES: dict[Action, Rule] = {
    # Project, comment, system and release reads, Git clone, the live comment stream.
    "read": Rule(ALL_ROLES, scopes=("api:read",)),
    "comment": Rule(ALL_ROLES, scopes=("api:write",), provider_refusal=_PROVIDER_MODIFY),
    "design": Rule(
        frozenset({"designer", "admin"}),
        "Designer role required",
        ("api:write",),
        _PROVIDER_MODIFY,
    ),
    # Approve or publish a project release. QA ranks below designer, so this is a set, not a minimum.
    "release": Rule(
        PROJECT_RELEASE_ACTOR_ROLES,
        "Designer, QA, or Admin role required",
        ("api:write",),
        _PROVIDER_MODIFY,
    ),
    "admin": Rule(frozenset({"admin"}), "Admin role required", ("api:write",), _PROVIDER_ADMIN),
    "catalog_browse": Rule(CATALOG_BROWSE_ROLES, "Catalog read access required", ("api:read",)),
    "catalog_read": Rule(CATALOG_READ_ROLES, "Catalog read access required", ("api:read",)),
    "catalog_write": Rule(CATALOG_WRITE_ROLES, "Catalog write access required", ("api:write",), _PROVIDER_CATALOG),
    "catalog_qa": Rule(CATALOG_QA_ROLES, "Catalog QA access required", ("api:write",), _PROVIDER_CATALOG),
    # Metadata field definitions, artifact maintenance, the same-person approval override.
    "catalog_admin": Rule(frozenset({"admin"}), "Administrator access required", ("api:write",), _PROVIDER_CATALOG),
    "remote_symbols": Rule(ALL_ROLES, scopes=("remote_symbols.read", "api:read"), provider_refusal=None),
}


# A held scope that grants others: a client allowed to write may always read.
IMPLIED_SCOPES: dict[str, tuple[str, ...]] = {"api:write": ("api:read",)}


def effective_scopes(scopes: list[str]) -> set[str]:
    held = set(scopes)
    for scope in list(held):
        held.update(IMPLIED_SCOPES.get(scope, ()))
    return held


def has_scope(caller: Caller, *scopes: str) -> bool:
    """Whether a bearer caller holds one of ``scopes``; "*" holds every scope."""
    held = effective_scopes(caller.scopes)
    return "*" in held or any(scope in held for scope in scopes)


def refusal(caller: Caller, action: Action) -> str | None:
    """Why ``caller`` may not do ``action``, or None when it may."""
    rule = RULES[action]
    if caller.auth_type == PROVIDER_AUTH_TYPE and rule.provider_refusal is not None:
        return rule.provider_refusal
    if rule.scopes and caller.auth_type != "session" and not has_scope(caller, *rule.scopes):
        return f"{' or '.join(rule.scopes)} scope required"
    if caller.role not in rule.roles:
        return rule.role_detail
    return None


def allows(caller: Caller, action: Action) -> bool:
    return refusal(caller, action) is None


def role_allows(role: Role, action: Action) -> bool:
    """The role half of a rule, for checks that already passed authentication."""
    return role in RULES[action].roles


def authorize(caller: Caller, action: Action) -> Any:
    """Return ``caller`` when it may do ``action``; raise 403 otherwise."""
    detail = refusal(caller, action)
    if detail is not None:
        raise HTTPException(status_code=403, detail=detail)
    return caller


# ── Ownership ────────────────────────────────────────────────────────────


def normalize_identity(value: object) -> str:
    """The one comparison form for an account email or ``created_by`` value."""
    return str(value or "").strip().casefold()


def is_owner(caller: Caller, owner: object) -> bool:
    """Whether ``owner`` names the caller. An empty owner names nobody."""
    normalized = normalize_identity(owner)
    return bool(normalized) and normalized == normalize_identity(caller.email)


def owner_or_admin(caller: Caller, owner: object) -> bool:
    return role_allows(caller.role, "admin") or is_owner(caller, owner)


def require_owner_or_admin(caller: Caller, owner: object, *, detail: str) -> None:
    if not owner_or_admin(caller, owner):
        raise HTTPException(status_code=403, detail=detail)


# ── Folder visibility ────────────────────────────────────────────────────
#
# A folder in "roles" mode with a non-empty allow-list shows its projects and
# systems only to the listed roles. Viewer and QA both hold project view
# access, so a folder open to "viewer" is open to QA too.


def folder_roles_matching(role: Role) -> tuple[str, ...]:
    """The allow-list entries that admit ``role``."""
    if role in PROJECT_VIEW_ROLES and role != "viewer":
        return (role, "viewer")
    return (role,)


def folder_visible(role: Role | None, visibility_mode: object, allowed_roles: list[str] | None) -> bool:
    if role is None or visibility_mode != "roles" or not allowed_roles:
        return True
    return any(entry in allowed_roles for entry in folder_roles_matching(role))


def folder_visible_sql(alias: str = "f") -> str:
    """``folder_visible`` as SQL over a (LEFT JOINed) ``ws_folders`` row.

    Bind ``folder_visibility_params(role)``.
    """
    allowed = f"COALESCE({alias}.allowed_roles, '[]'::jsonb)"
    return (
        f"({alias}.id IS NULL"
        f" OR {alias}.visibility_mode IS DISTINCT FROM 'roles'"
        f" OR jsonb_array_length({allowed}) = 0"
        f" OR {allowed} ?| %(folder_roles)s::text[])"
    )


def folder_visibility_params(role: Role) -> dict[str, Any]:
    return {"folder_roles": list(folder_roles_matching(role))}


# ── Frontend role matrix ─────────────────────────────────────────────────

# Each authority the UI shows (frontend/src/lib/roles.ts) and the action whose
# roles it offers. The server still authorizes every request.
ROLE_AUTHORITIES: dict[str, Action] = {
    "view_projects": "read",
    "manage_projects": "design",
    "comment_on_projects": "comment",
    "inspect_release_studio": "read",
    "start_release_builds": "design",
    "approve_project_releases": "release",
    "publish_project_releases": "release",
    "view_catalog": "catalog_browse",
    "edit_catalog": "catalog_write",
    "review_catalog_qa": "catalog_qa",
    "administer_catalog": "catalog_admin",
    "administer_workspace": "admin",
}

MATRIX_ROLE_ORDER: tuple[Role, ...] = ("viewer", "designer", "qa", "admin")


def role_matrix_contract() -> dict[str, Any]:
    return {
        "roles": list(MATRIX_ROLE_ORDER),
        "authorities": {
            key: [role for role in MATRIX_ROLE_ORDER if role_allows(role, action)]
            for key, action in ROLE_AUTHORITIES.items()
        },
    }
