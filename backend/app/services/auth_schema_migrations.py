"""Numbered steps for the auth tables in the ``workspace`` schema.

Users, roles, local password credentials, browser sessions and the shared login
rate limit. Before the single ledger each owning service ran this DDL on every
start; every step is safe on a database those services already built, so an
existing installation runs them once and records them in
``auth_schema_migrations``. The tables share the ``workspace`` schema and its
advisory lock, but keep their own ledger so a lazily initialised auth service
does not have to bring the whole workspace schema to head first.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.services.schema_ledger import Ledger, Step


def _normalize_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("Invalid email")
    return normalized


def _users_and_roles(connection: Any) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL DEFAULT '',
            picture TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_roles (
            email TEXT PRIMARY KEY,
            role TEXT NOT NULL CHECK (role IN ('admin', 'designer', 'viewer', 'qa')),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by TEXT NOT NULL
        )
        """
    )
    _migrate_legacy_roles(connection)
    _migrate_roles_to_user_id(connection)


def _migrate_legacy_roles(connection: object) -> None:
    """Map archived catalog-only roles onto the current four-role model."""

    connection.execute(  # type: ignore[attr-defined]
        "ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check"
    )
    connection.execute(  # type: ignore[attr-defined]
        "UPDATE user_roles SET role = 'designer' WHERE role = 'component_designer'"
    )
    connection.execute(  # type: ignore[attr-defined]
        "UPDATE user_roles SET role = 'qa' WHERE role = 'component_qa'"
    )
    connection.execute(  # type: ignore[attr-defined]
        """
        ALTER TABLE user_roles
        ADD CONSTRAINT user_roles_role_check
        CHECK (role IN ('admin', 'designer', 'viewer', 'qa'))
        """
    )


def _table_columns(connection: object, table: str) -> set[str]:
    rows = connection.execute(  # type: ignore[attr-defined]
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = %s
        """,
        (table,),
    ).fetchall()
    return {str(row["column_name"]) for row in rows}


def _migrate_roles_to_user_id(connection: object) -> None:
    """Point user_roles at users.user_id while keeping email as a unique attribute."""
    columns = _table_columns(connection, "user_roles")
    if "user_id" not in columns:
        connection.execute("ALTER TABLE user_roles ADD COLUMN user_id TEXT")  # type: ignore[attr-defined]

    role_rows = connection.execute(  # type: ignore[attr-defined]
        "SELECT email, user_id FROM user_roles"
    ).fetchall()
    for row in role_rows:
        email = _normalize_email(str(row["email"]))
        existing = connection.execute(  # type: ignore[attr-defined]
            "SELECT user_id FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        user_id = str(existing["user_id"]) if existing else uuid.uuid4().hex
        if existing is None:
            connection.execute(  # type: ignore[attr-defined]
                """
                INSERT INTO users (user_id, email, name)
                VALUES (%s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                """,
                (user_id, email, email.split("@")[0]),
            )
            existing = connection.execute(  # type: ignore[attr-defined]
                "SELECT user_id FROM users WHERE email = %s",
                (email,),
            ).fetchone()
            user_id = str(existing["user_id"])
        if not row["user_id"]:
            connection.execute(  # type: ignore[attr-defined]
                "UPDATE user_roles SET user_id = %s WHERE email = %s",
                (user_id, email),
            )

    connection.execute(  # type: ignore[attr-defined]
        "ALTER TABLE user_roles ALTER COLUMN user_id SET NOT NULL"
    )
    connection.execute(  # type: ignore[attr-defined]
        "CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_uidx ON user_roles (user_id)"
    )


def _user_credentials(connection: Any) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_credentials (
            user_id TEXT PRIMARY KEY REFERENCES workspace.users (user_id) ON DELETE CASCADE,
            password_hash TEXT NOT NULL,
            must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by TEXT NOT NULL
        )
        """
    )


def _user_sessions(connection: Any) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_digest TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            picture TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            revoked_reason TEXT NOT NULL DEFAULT '',
            user_agent TEXT NOT NULL DEFAULT '',
            client_ip TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS user_sessions_email_idx ON user_sessions (email)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions (expires_at)"
    )
    connection.execute(
        "ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id)"
    )


def _auth_rate_limit(connection: Any) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_rate_limit (
            id BIGSERIAL PRIMARY KEY,
            bucket TEXT NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS auth_rate_limit_bucket_idx "
        "ON auth_rate_limit (bucket, occurred_at)"
    )


AUTH_LEDGER = Ledger(
    name="auth",
    schema="workspace",
    table="auth_schema_migrations",
    steps=(
        Step(1, "users_and_roles", _users_and_roles),
        Step(2, "user_credentials", _user_credentials),
        Step(3, "user_sessions", _user_sessions),
        Step(4, "auth_rate_limit", _auth_rate_limit),
    ),
)
