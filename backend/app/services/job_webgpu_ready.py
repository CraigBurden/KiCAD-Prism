"""``ws_webgpu_ready``: WebGPU bundle readiness published by fenced jobs.

Every function runs on the caller's connection (search_path already set to
the workspace schema) inside the caller's transaction; none commits.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from app.services.job_rows import loads as _loads, to_json as _json


def upsert_webgpu_ready(
    conn: Any,
    *,
    job_id: str,
    fence: int,
    details: Mapping[str, Any],
) -> None:
    project_id = str(details.get("project_id") or "")
    selector_key = str(details.get("status_selector") or "")
    generator_build = str(details.get("build_fingerprint") or "")
    source_revision_key = str(
        details.get("sourceRevisionKey")
        or details.get("source_fingerprint")
        or ""
    )
    bundle_url = str(details.get("bundle_url") or "")
    if not all(
        (
            project_id,
            selector_key,
            generator_build,
            source_revision_key,
            bundle_url,
        )
    ):
        return
    status_keys = (
        "schema",
        "project_id",
        "source_fingerprint",
        "sourceRevisionKey",
        "build_fingerprint",
        "generator",
        "artifactScope",
        "status",
        "available",
        "bundle_url",
        "readiness",
        "generated_at",
        "capabilities",
        "commit",
        "project_path",
        "source_tree_fingerprint",
    )
    status_payload = {
        key: details[key]
        for key in status_keys
        if key in details
    }
    status_payload["status_selector"] = selector_key
    conn.execute(
        """
        INSERT INTO ws_webgpu_ready(
            project_id, selector_key, generator_build,
            source_revision_key, bundle_url, status_payload,
            source_job_id, source_fence
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
        ON CONFLICT(project_id, selector_key, generator_build)
        DO UPDATE SET
            source_revision_key = EXCLUDED.source_revision_key,
            bundle_url = EXCLUDED.bundle_url,
            status_payload = EXCLUDED.status_payload,
            source_job_id = EXCLUDED.source_job_id,
            source_fence = EXCLUDED.source_fence,
            created_at = NOW(),
            last_accessed_at = NOW(),
            invalidated_at = NULL
        WHERE (
                (
                    EXCLUDED.source_job_id = ws_webgpu_ready.source_job_id
                    AND EXCLUDED.source_fence >= ws_webgpu_ready.source_fence
                )
                OR (
                    SELECT created_at
                    FROM ws_jobs
                    WHERE id = EXCLUDED.source_job_id
                ) > (
                    SELECT created_at
                    FROM ws_jobs
                    WHERE id = ws_webgpu_ready.source_job_id
                )
              )
          AND (
                ws_webgpu_ready.invalidated_at IS NULL
                OR (
                    SELECT created_at
                    FROM ws_jobs
                    WHERE id = EXCLUDED.source_job_id
                ) > ws_webgpu_ready.invalidated_at
              )
        """,
        (
            project_id,
            selector_key,
            generator_build,
            source_revision_key,
            bundle_url,
            _json(status_payload),
            job_id,
            fence,
        ),
    )


def get_webgpu_ready(
    conn: Any,
    project_id: str,
    selector_key: str,
    generator_build: str,
) -> dict[str, Any] | None:
    """Read WebGPU readiness from PostgreSQL without touching bundle files."""

    row = conn.execute(
        """
        UPDATE ws_webgpu_ready
        SET last_accessed_at = NOW()
        WHERE project_id = %s
          AND selector_key = %s
          AND generator_build = %s
          AND invalidated_at IS NULL
        RETURNING status_payload
        """,
        (project_id, selector_key, generator_build),
    ).fetchone()
    if not row:
        return None
    return _loads(row["status_payload"], {})


def normalize_commit_prefix(commit_prefix: str) -> str | None:
    """The lower-case abbreviated SHA, or ``None`` when it is not one."""

    normalized = commit_prefix.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{7,40}", normalized):
        return None
    return normalized


def find_webgpu_ready_by_commit_prefix(
    conn: Any,
    project_id: str,
    generator_build: str,
    normalized: str,
    *,
    selector_suffix: str = "",
) -> dict[str, Any] | None:
    """Resolve readiness for an abbreviated SHA without calling git.

    ``normalized`` comes from :func:`normalize_commit_prefix`.
    """

    row = conn.execute(
        """
        UPDATE ws_webgpu_ready
        SET last_accessed_at = NOW()
        WHERE (project_id, selector_key, generator_build) = (
            SELECT project_id, selector_key, generator_build
            FROM ws_webgpu_ready
            WHERE project_id = %s
              AND generator_build = %s
              AND invalidated_at IS NULL
              AND (%s = '' OR selector_key LIKE %s)
              AND (
                selector_key = %s
                OR lower(COALESCE(status_payload->>'commit', '')) LIKE %s
              )
            ORDER BY
                CASE WHEN selector_key = %s THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 1
            FOR UPDATE
        )
        RETURNING status_payload
        """,
        (
            project_id,
            generator_build,
            selector_suffix,
            f"%{selector_suffix}",
            f"commit:{normalized}{selector_suffix}",
            f"{normalized}%",
            f"commit:{normalized}{selector_suffix}",
        ),
    ).fetchone()
    if not row:
        return None
    return _loads(row["status_payload"], {})


def invalidate_webgpu_ready(
    conn: Any,
    project_id: str,
    selector_key: str,
    generator_build: str,
) -> bool:
    cursor = conn.execute(
        """
        UPDATE ws_webgpu_ready
        SET invalidated_at = COALESCE(invalidated_at, NOW())
        WHERE project_id = %s
          AND selector_key = %s
          AND generator_build = %s
          AND invalidated_at IS NULL
        """,
        (project_id, selector_key, generator_build),
    )
    return cursor.rowcount == 1
