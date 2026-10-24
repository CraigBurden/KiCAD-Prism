from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.core.roles import Role, normalize_role
from app.services.auth_schema_migrations import AUTH_LEDGER
from app.services.postgres_database import database


_init_lock = threading.Lock()
_initialized = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("Invalid email")
    return normalized


def _bootstrap_admin_set() -> set[str]:
    return {email.strip().lower() for email in settings.BOOTSTRAP_ADMIN_USERS if email.strip()}


def _default_viewer_domain_set() -> set[str]:
    return {domain.strip().lower() for domain in settings.DEFAULT_VIEWER_DOMAINS if domain.strip()}


def initialize_role_store() -> None:
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        AUTH_LEDGER.migrate(database.connection, after=(_ensure_bootstrap_user_rows,))
        _initialized = True


def _ensure_bootstrap_user_rows(connection: object) -> None:
    """Give bootstrap admins a users row so a password can be set before first login."""
    for email in _bootstrap_admin_set():
        existing = connection.execute(  # type: ignore[attr-defined]
            "SELECT user_id FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if existing is not None:
            continue
        connection.execute(  # type: ignore[attr-defined]
            """
            INSERT INTO users (user_id, email, name)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (uuid.uuid4().hex, email, email.split("@")[0]),
        )


def get_user_by_email(email: str) -> dict[str, str] | None:
    initialize_role_store()
    try:
        normalized = _normalize_email(email)
    except ValueError:
        return None
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        row = connection.execute(
            "SELECT user_id, email, name, picture FROM users WHERE email = %s",
            (normalized,),
        ).fetchone()
    if row is None:
        return None
    return {
        "user_id": str(row["user_id"]),
        "email": str(row["email"]),
        "name": str(row["name"] or ""),
        "picture": str(row["picture"] or ""),
    }


def get_user_by_id(user_id: str) -> dict[str, str] | None:
    initialize_role_store()
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        row = connection.execute(
            "SELECT user_id, email, name, picture FROM users WHERE user_id = %s",
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "user_id": str(row["user_id"]),
        "email": str(row["email"]),
        "name": str(row["name"] or ""),
        "picture": str(row["picture"] or ""),
    }


def upsert_user(*, email: str, name: str = "", picture: str = "") -> dict[str, str]:
    """Create or update the durable person row. Email stays unique."""
    initialize_role_store()
    normalized = _normalize_email(email)
    display_name = (name or "").strip() or normalized.split("@")[0]
    picture_value = (picture or "").strip()
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        existing = connection.execute(
            "SELECT user_id, name, picture FROM users WHERE email = %s",
            (normalized,),
        ).fetchone()
        if existing is None:
            user_id = uuid.uuid4().hex
            connection.execute(
                """
                INSERT INTO users (user_id, email, name, picture)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, normalized, display_name, picture_value),
            )
        else:
            user_id = str(existing["user_id"])
            next_name = display_name if name.strip() else str(existing["name"] or display_name)
            next_picture = picture_value if picture_value else str(existing["picture"] or "")
            connection.execute(
                """
                UPDATE users
                SET name = %s, picture = %s, updated_at = NOW()
                WHERE user_id = %s
                """,
                (next_name, next_picture, user_id),
            )
            display_name = next_name
            picture_value = next_picture
        connection.commit()
    return {
        "user_id": user_id,
        "email": normalized,
        "name": display_name,
        "picture": picture_value,
    }


def _load_explicit_user_role(normalized_email: str) -> Role | None:
    initialize_role_store()
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        row = connection.execute(
            "SELECT role FROM user_roles WHERE email = %s", (normalized_email,)
        ).fetchone()
    return normalize_role(row["role"]) if row else None


def resolve_user_role(email: str) -> Role | None:
    normalized_email = _normalize_email(email)
    if normalized_email in _bootstrap_admin_set():
        return "admin"
    explicit_role = _load_explicit_user_role(normalized_email)
    if explicit_role:
        return explicit_role
    domain = normalized_email.split("@", 1)[-1]
    return "viewer" if domain in _default_viewer_domain_set() else None


def ensure_default_viewer_assignment(email: str) -> dict[str, str] | None:
    normalized_email = _normalize_email(email)
    if normalized_email in _bootstrap_admin_set():
        return {"email": normalized_email, "role": "admin", "source": "bootstrap"}
    explicit_role = _load_explicit_user_role(normalized_email)
    if explicit_role:
        return {"email": normalized_email, "role": explicit_role, "source": "store"}
    if normalized_email.split("@", 1)[-1] not in _default_viewer_domain_set():
        return None
    return upsert_user_role(normalized_email, "viewer", "system@local")


def list_role_assignments() -> list[dict[str, str]]:
    initialize_role_store()
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        rows = connection.execute("SELECT email, role FROM user_roles ORDER BY email").fetchall()
    assignments = [
        {"email": str(row["email"]), "role": str(row["role"]), "source": "store"}
        for row in rows
    ]
    indexed = {item["email"]: item for item in assignments}
    for email in _bootstrap_admin_set():
        indexed[email] = {"email": email, "role": "admin", "source": "bootstrap"}
    return sorted(indexed.values(), key=lambda item: item["email"])


def upsert_user_role(email: str, role: Role, updated_by: str) -> dict[str, str]:
    normalized_email = _normalize_email(email)
    if normalized_email in _bootstrap_admin_set():
        if role != "admin":
            raise ValueError("Cannot override bootstrap admin role assignment")
        return {"email": normalized_email, "role": "admin", "source": "bootstrap"}
    user = upsert_user(email=normalized_email)
    initialize_role_store()
    actor = _normalize_email(updated_by)
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        connection.execute(
            """
            INSERT INTO user_roles (email, role, updated_at, updated_by, user_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO UPDATE SET
                role = EXCLUDED.role,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by,
                user_id = EXCLUDED.user_id
            """,
            (normalized_email, role, _now_iso(), actor, user["user_id"]),
        )
        connection.commit()
    return {"email": normalized_email, "role": role, "source": "store"}


def delete_user_role(email: str, updated_by: str) -> bool:
    del updated_by
    normalized_email = _normalize_email(email)
    if normalized_email in _bootstrap_admin_set():
        raise ValueError("Cannot delete bootstrap admin role assignment")
    initialize_role_store()
    with database.connection() as connection:
        connection.execute("SET search_path TO workspace, public")
        cursor = connection.execute("DELETE FROM user_roles WHERE email = %s", (normalized_email,))
        connection.commit()
    return cursor.rowcount > 0
