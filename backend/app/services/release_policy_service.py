"""Administrative authoring for immutable organization release policies.

Drafts are editable. Publishing freezes the exact normalized document and its
content digest through the database guard installed by migration 9. Project
overlays remain Git-owned and can only bind a published version by
``org:<policy_key>@<version>``.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from app.release_studio.policy import (
    POLICY_SCHEMA,
    PolicyError,
    content_digest,
    resolve_policy,
)
from app.services import release_studio_service as store


def _normalize_document(document: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(document, Mapping):
        raise PolicyError("policy document must be an object")
    unknown = sorted(
        set(document) - {"schema", "title", "rules", "required_approvals"}
    )
    if unknown:
        raise PolicyError(f"unknown organization policy fields: {unknown}")
    schema = str(document.get("schema") or POLICY_SCHEMA)
    if schema != POLICY_SCHEMA:
        raise PolicyError(f"policy schema must be {POLICY_SCHEMA!r}")
    normalized = {
        "schema": POLICY_SCHEMA,
        "title": str(document.get("title") or ""),
        "rules": [dict(item) if isinstance(item, Mapping) else item for item in document.get("rules") or ()],
        "required_approvals": [
            dict(item) if isinstance(item, Mapping) else item
            for item in document.get("required_approvals") or ()
        ],
    }
    # The resolver is the single validation boundary for rule ids, severities,
    # typed params, approval roles and governed domains.
    resolve_policy(normalized)
    return normalized


def list_policies() -> list[dict[str, Any]]:
    with store.connect() as conn:
        rows = conn.execute(
            """
            SELECT p.*, COALESCE(MAX(v.version), 0) AS latest_version,
                   COUNT(v.id) AS version_count
            FROM ws_release_policies p
            LEFT JOIN ws_release_policy_versions v ON v.policy_id = p.id
            GROUP BY p.id ORDER BY p.policy_key
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_policy(policy_key: str) -> dict[str, Any] | None:
    with store.connect() as conn:
        policy = conn.execute(
            "SELECT * FROM ws_release_policies WHERE policy_key = %s",
            (policy_key,),
        ).fetchone()
        if policy is None:
            return None
        versions = conn.execute(
            """
            SELECT * FROM ws_release_policy_versions
            WHERE policy_id = %s ORDER BY version DESC
            """,
            (policy["id"],),
        ).fetchall()
    result = dict(policy)
    result["versions"] = [dict(row) for row in versions]
    return result


def create_policy(*, policy_key: str, title: str, actor: str) -> dict[str, Any]:
    key = policy_key.strip()
    if not key or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789._-" for ch in key):
        raise PolicyError("policy_key must use lowercase letters, numbers, '.', '_' or '-'")
    with store.connect() as conn:
        policy_id = store._new_id("policy")
        conn.execute(
            """
            INSERT INTO ws_release_policies(id, policy_key, title, created_by)
            VALUES (%s,%s,%s,%s)
            """,
            (policy_id, key, title.strip(), actor),
        )
        conn.commit()
    return get_policy(key) or {}


def create_version(
    policy_key: str,
    *,
    document: Mapping[str, Any],
    actor: str,
) -> dict[str, Any]:
    normalized = _normalize_document(document)
    digest = content_digest(normalized)
    with store.connect() as conn:
        policy = conn.execute(
            "SELECT * FROM ws_release_policies WHERE policy_key = %s FOR UPDATE",
            (policy_key,),
        ).fetchone()
        if policy is None:
            raise PolicyError("organization policy not found")
        latest = conn.execute(
            "SELECT COALESCE(MAX(version), 0) AS version FROM ws_release_policy_versions WHERE policy_id = %s",
            (policy["id"],),
        ).fetchone()
        version = int(latest["version"]) + 1
        version_id = store._new_id("policyv")
        conn.execute(
            """
            INSERT INTO ws_release_policy_versions(
                id, policy_id, version, status, rules, content_digest, created_by
            ) VALUES (%s,%s,%s,'draft',%s,%s,%s)
            """,
            (version_id, policy["id"], version, json.dumps(normalized), digest, actor),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_policy_versions WHERE id = %s", (version_id,)
        ).fetchone()
    return dict(row)


def update_draft(
    policy_key: str,
    version: int,
    *,
    document: Mapping[str, Any],
) -> dict[str, Any]:
    normalized = _normalize_document(document)
    digest = content_digest(normalized)
    with store.connect() as conn:
        row = _version_for_update(conn, policy_key, version)
        if row["status"] != "draft":
            raise PolicyError("only draft policy versions can be edited")
        conn.execute(
            "UPDATE ws_release_policy_versions SET rules=%s, content_digest=%s WHERE id=%s",
            (json.dumps(normalized), digest, row["id"]),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM ws_release_policy_versions WHERE id=%s", (row["id"],)
        ).fetchone()
    return dict(updated)


def publish(policy_key: str, version: int, *, actor: str) -> dict[str, Any]:
    with store.connect() as conn:
        row = _version_for_update(conn, policy_key, version)
        if row["status"] != "draft":
            raise PolicyError("only a draft policy version can be published")
        # Validate the stored bytes immediately before freezing them.
        normalized = _normalize_document(row["rules"] or {})
        digest = content_digest(normalized)
        if digest != row["content_digest"]:
            raise PolicyError("draft content digest does not match its policy document")
        conn.execute(
            """
            UPDATE ws_release_policy_versions
            SET status='published', published_at=NOW(), published_by=%s
            WHERE id=%s
            """,
            (actor, row["id"]),
        )
        conn.commit()
        published = conn.execute(
            "SELECT * FROM ws_release_policy_versions WHERE id=%s", (row["id"],)
        ).fetchone()
    return dict(published)


def retire(policy_key: str, version: int, *, actor: str) -> dict[str, Any]:
    with store.connect() as conn:
        row = _version_for_update(conn, policy_key, version)
        if row["status"] != "published":
            raise PolicyError("only a published policy version can be retired")
        conn.execute(
            """
            UPDATE ws_release_policy_versions
            SET status='retired', retired_at=NOW(), retired_by=%s WHERE id=%s
            """,
            (actor, row["id"]),
        )
        conn.commit()
        retired = conn.execute(
            "SELECT * FROM ws_release_policy_versions WHERE id=%s", (row["id"],)
        ).fetchone()
    return dict(retired)


def load_published(policy_key: str, version: int) -> dict[str, Any] | None:
    """Load a version eligible for a newly authored policy binding."""

    return _load_version(policy_key, version, statuses=("published",))


def load_bound_version(policy_key: str, version: int) -> dict[str, Any] | None:
    """Load an immutable version already pinned by a historical candidate.

    Retirement prevents new bindings; it must not make an existing build or
    release impossible to re-evaluate.
    """

    return _load_version(policy_key, version, statuses=("published", "retired"))


def _load_version(
    policy_key: str,
    version: int,
    *,
    statuses: tuple[str, ...],
) -> dict[str, Any] | None:
    with store.connect() as conn:
        row = conn.execute(
            """
            SELECT v.* FROM ws_release_policy_versions v
            JOIN ws_release_policies p ON p.id = v.policy_id
            WHERE p.policy_key=%s AND v.version=%s AND v.status = ANY(%s)
            """,
            (policy_key, version, list(statuses)),
        ).fetchone()
    if row is None:
        return None
    document = dict(row["rules"] or {})
    document["content_digest"] = row["content_digest"]
    return document


def inheritance_preview(overlay: Mapping[str, Any]) -> dict[str, Any]:
    resolved = resolve_policy(overlay, org_policy_loader=load_published)
    return {**resolved.binding, "policy_binding_digest": resolved.binding_digest}


def version_diff(policy_key: str, left: int, right: int) -> dict[str, Any]:
    with store.connect() as conn:
        rows = conn.execute(
            """
            SELECT v.version, v.rules FROM ws_release_policy_versions v
            JOIN ws_release_policies p ON p.id=v.policy_id
            WHERE p.policy_key=%s AND v.version IN (%s,%s)
            """,
            (policy_key, left, right),
        ).fetchall()
    by_version = {int(row["version"]): dict(row["rules"] or {}) for row in rows}
    if left not in by_version or right not in by_version:
        raise PolicyError("one or both policy versions were not found")
    return {
        "from": left,
        "to": right,
        "changes": _json_diff(by_version[left], by_version[right]),
    }


def _json_diff(left: Any, right: Any, path: str = "$") -> list[dict[str, Any]]:
    if left == right:
        return []
    if isinstance(left, Mapping) and isinstance(right, Mapping):
        changes: list[dict[str, Any]] = []
        for key in sorted(set(left) | set(right)):
            child = f"{path}.{key}"
            if key not in left:
                changes.append({"path": child, "change": "added", "after": right[key]})
            elif key not in right:
                changes.append({"path": child, "change": "removed", "before": left[key]})
            else:
                changes.extend(_json_diff(left[key], right[key], child))
        return changes
    if isinstance(left, list) and isinstance(right, list):
        identity = {
            "$.rules": "id",
            "$.required_approvals": "role",
        }.get(path)
        if identity and all(isinstance(item, Mapping) for item in (*left, *right)):
            left_by_key = {str(item.get(identity) or ""): item for item in left}
            right_by_key = {str(item.get(identity) or ""): item for item in right}
            if "" not in left_by_key and "" not in right_by_key:
                changes: list[dict[str, Any]] = []
                for key in sorted(set(left_by_key) | set(right_by_key)):
                    child = f"{path}[{key}]"
                    if key not in left_by_key:
                        changes.append(
                            {"path": child, "change": "added", "after": right_by_key[key]}
                        )
                    elif key not in right_by_key:
                        changes.append(
                            {"path": child, "change": "removed", "before": left_by_key[key]}
                        )
                    else:
                        changes.extend(
                            _json_diff(left_by_key[key], right_by_key[key], child)
                        )
                return changes
    return [{"path": path, "change": "changed", "before": left, "after": right}]


def _version_for_update(conn: Any, policy_key: str, version: int) -> Any:
    row = conn.execute(
        """
        SELECT v.* FROM ws_release_policy_versions v
        JOIN ws_release_policies p ON p.id=v.policy_id
        WHERE p.policy_key=%s AND v.version=%s FOR UPDATE OF v
        """,
        (policy_key, version),
    ).fetchone()
    if row is None:
        raise PolicyError("organization policy version not found")
    return row


__all__ = [
    "create_policy",
    "create_version",
    "get_policy",
    "inheritance_preview",
    "list_policies",
    "load_bound_version",
    "load_published",
    "publish",
    "retire",
    "update_draft",
    "version_diff",
]
