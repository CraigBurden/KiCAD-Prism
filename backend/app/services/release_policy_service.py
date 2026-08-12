"""Administrative authoring for immutable organization release policies.

Drafts are editable. Publishing freezes the exact normalized document and its
content digest through the database guard installed with the schema. Project
overlays remain Git-owned and can only bind a published version by
``org:<policy_key>@<version>``.

Every authoring act is appended to a per-policy hash chain. Publishing a
version invalidates approvals across every project that binds it, so "who
changed this policy, and when" has to be answerable without trusting the row
that changed.
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


def append_policy_audit_event(
    conn: Any,
    *,
    policy_key: str,
    event_type: str,
    actor: str,
    subject_kind: str,
    subject_id: str,
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Append one policy-authoring event under the caller's transaction.

    Its own chain rather than a nullable ``project_id`` on the project chain:
    an org policy is not an event in any one project's history, and widening
    that table would weaken the sequence and genesis constraints that make it
    checkable.
    """

    row = conn.execute(
        """
        SELECT sequence, event_hash FROM ws_release_policy_audit_events
        WHERE policy_key = %s ORDER BY sequence DESC LIMIT 1
        """,
        (policy_key,),
    ).fetchone()
    sequence = (int(row["sequence"]) + 1) if row else 1
    previous_hash = str(row["event_hash"]) if row else None

    created_at_iso = store._now_iso()
    fields = {
        "policy_key": policy_key,
        "sequence": sequence,
        "event_type": event_type,
        "actor": actor,
        "subject_kind": subject_kind,
        "subject_id": subject_id,
        "details": dict(details or {}),
    }
    event_hash = store._event_hash(previous_hash, fields, created_at_iso)
    event_id = store._new_id("policyaudit")
    conn.execute(
        """
        INSERT INTO ws_release_policy_audit_events(
            id, policy_key, sequence, event_type, actor, subject_kind,
            subject_id, details, previous_hash, event_hash, created_at_iso
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            event_id, policy_key, sequence, event_type, actor, subject_kind,
            subject_id, json.dumps(fields["details"]), previous_hash, event_hash,
            created_at_iso,
        ),
    )
    return {**fields, "id": event_id, "event_hash": event_hash}


def list_policy_audit_events(policy_key: str, limit: int = 500) -> list[dict[str, Any]]:
    with store.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_policy_audit_events WHERE policy_key = %s "
            "ORDER BY sequence DESC LIMIT %s",
            (policy_key, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def verify_policy_audit_chain(policy_key: str) -> dict[str, Any]:
    """Check linkage, not merely row shape.

    A stream that satisfies the table's constraints is well-formed, not valid:
    validity is `previous_hash[n] == event_hash[n-1]` over a contiguous
    sequence from a single genesis, which only a full read can establish.
    """

    with store.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_policy_audit_events WHERE policy_key = %s "
            "ORDER BY sequence",
            (policy_key,),
        ).fetchall()

    problems: list[str] = []
    previous_hash: str | None = None
    for index, row in enumerate(rows, start=1):
        if int(row["sequence"]) != index:
            problems.append(
                f"sequence {row['sequence']} is out of order at position {index}"
            )
        if (row["previous_hash"] or None) != previous_hash:
            problems.append(f"broken link at sequence {row['sequence']}")
        fields = {
            "policy_key": row["policy_key"],
            "sequence": int(row["sequence"]),
            "event_type": row["event_type"],
            "actor": row["actor"],
            "subject_kind": row["subject_kind"],
            "subject_id": row["subject_id"],
            "details": row["details"] or {},
        }
        expected = store._event_hash(previous_hash, fields, row["created_at_iso"])
        if expected != row["event_hash"]:
            problems.append(f"event hash mismatch at sequence {row['sequence']}")
        previous_hash = str(row["event_hash"])
    return {"ok": not problems, "events": len(rows), "problems": problems}


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
        append_policy_audit_event(
            conn, policy_key=key, event_type="policy.created", actor=actor,
            subject_kind="policy", subject_id=policy_id,
            details={"title": title.strip()},
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
        append_policy_audit_event(
            conn, policy_key=policy_key, event_type="policy.version_created",
            actor=actor, subject_kind="policy_version", subject_id=version_id,
            details={"version": version, "content_digest": digest},
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
    actor: str = "",
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
        append_policy_audit_event(
            conn, policy_key=policy_key, event_type="policy.draft_updated",
            actor=actor, subject_kind="policy_version", subject_id=row["id"],
            details={
                "version": version,
                "content_digest": digest,
                "previous_content_digest": row["content_digest"],
            },
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
        # The event a reviewer is actually looking for: publishing a version
        # invalidates approvals in every project that binds this policy.
        append_policy_audit_event(
            conn, policy_key=policy_key, event_type="policy.published",
            actor=actor, subject_kind="policy_version", subject_id=row["id"],
            details={"version": version, "content_digest": row["content_digest"]},
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
        append_policy_audit_event(
            conn, policy_key=policy_key, event_type="policy.retired",
            actor=actor, subject_kind="policy_version", subject_id=row["id"],
            details={"version": version},
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
