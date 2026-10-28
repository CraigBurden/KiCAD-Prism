"""Registry of issued KiCad agent sign-in tokens.

The token value is never stored. Each row records a token's jti (the handle the
revocation list keys on), who it belongs to, its label and scopes, and its
lifecycle timestamps, so a user or an admin can list and revoke tokens from the
web console. Lives in the catalog database next to the other OAuth tables.
"""

from __future__ import annotations

import json
from typing import Any


class CatalogAgentTokens:
    """List, record, touch, and revoke agent-token registry rows."""

    @staticmethod
    def record(
        conn: Any,
        *,
        jti: str,
        email: str,
        label: str,
        scopes: list[str],
        created_at: str,
        expires_at: int,
    ) -> None:
        conn.execute(
            """
            INSERT INTO agent_tokens (jti, email, label, scopes, created_at, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (jti) DO NOTHING
            """,
            (jti, email.strip().lower(), label, json.dumps(scopes, separators=(",", ":")), created_at, expires_at),
        )

    @staticmethod
    def touch(conn: Any, *, jti: str, when: str) -> None:
        conn.execute(
            "UPDATE agent_tokens SET last_used_at = %s WHERE jti = %s AND revoked_at IS NULL",
            (when, jti),
        )

    @staticmethod
    def mark_revoked(conn: Any, *, jti: str, when: str) -> None:
        conn.execute(
            "UPDATE agent_tokens SET revoked_at = %s WHERE jti = %s AND revoked_at IS NULL",
            (when, jti),
        )

    @staticmethod
    def get(conn: Any, *, jti: str) -> dict[str, Any] | None:
        row = conn.execute(
            "SELECT * FROM agent_tokens WHERE jti = %s", (jti,)
        ).fetchone()
        return _public_row(row) if row else None

    @staticmethod
    def list_for(conn: Any, *, email: str | None, now: int) -> list[dict[str, Any]]:
        """Active (non-revoked, non-expired) tokens, for one user or everyone.

        Expired rows are swept here so the list a user sees is the set that can
        still authenticate. ``email is None`` returns every user's tokens, for
        the admin view.
        """
        conn.execute(
            "DELETE FROM agent_tokens WHERE revoked_at IS NULL AND expires_at <= %s",
            (now,),
        )
        if email is None:
            rows = conn.execute(
                "SELECT * FROM agent_tokens WHERE revoked_at IS NULL ORDER BY created_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM agent_tokens WHERE revoked_at IS NULL AND email = %s "
                "ORDER BY created_at DESC",
                (email.strip().lower(),),
            ).fetchall()
        return [_public_row(row) for row in rows]


def _public_row(row: Any) -> dict[str, Any]:
    data = dict(row)
    scopes = data.get("scopes") or "[]"
    if isinstance(scopes, str):
        try:
            scopes = json.loads(scopes)
        except (ValueError, TypeError):
            scopes = []
    return {
        "jti": data["jti"],
        "email": data["email"],
        "label": data.get("label") or "",
        "scopes": list(scopes),
        "created_at": data.get("created_at"),
        "expires_at": int(data.get("expires_at") or 0),
        "last_used_at": data.get("last_used_at"),
    }


__all__ = ["CatalogAgentTokens"]
