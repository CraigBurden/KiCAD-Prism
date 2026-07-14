from __future__ import annotations

import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from app.services.postgres_database import database


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _loads(value: Any, default: Any) -> Any:
    if value is None or value == "":
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except (TypeError, ValueError):
        return default


class CatalogJobService:
    """Small PostgreSQL queue with leases, checkpoints, and an event trail.

    PostgreSQL is deliberately both the queue and status store. The expected
    local-team load does not justify a separate broker, and `SKIP LOCKED` lets a
    replacement worker safely reclaim work after lease expiry.
    """

    def __init__(self) -> None:
        self._initialized = False

    @contextmanager
    def _connect(self):
        with database.connection() as connection:
            connection.execute("SET search_path TO operations, catalog, public")
            yield connection

    def initialize(self) -> None:
        if self._initialized:
            return
        with self._connect() as conn:
            conn.execute("CREATE SCHEMA IF NOT EXISTS operations")
            conn.execute("SET search_path TO operations, catalog, public")
            conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("prism-catalog-jobs-schema",))
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS catalog_jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    progress DOUBLE PRECISION NOT NULL DEFAULT 0,
                    message TEXT NOT NULL DEFAULT '',
                    error_message TEXT NOT NULL DEFAULT '',
                    created_by TEXT NOT NULL DEFAULT '',
                    idempotency_key TEXT,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 3,
                    lease_owner TEXT NOT NULL DEFAULT '',
                    lease_expires_at TIMESTAMPTZ,
                    heartbeat_at TIMESTAMPTZ,
                    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    UNIQUE(job_type, idempotency_key)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS catalog_job_events (
                    id BIGSERIAL PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES catalog_jobs(id) ON DELETE CASCADE,
                    event_type TEXT NOT NULL,
                    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_catalog_jobs_claim "
                "ON catalog_jobs(status, run_after, created_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_catalog_job_events_job "
                "ON catalog_job_events(job_id, id)"
            )
            conn.commit()
        self._initialized = True

    def enqueue(
        self,
        job_type: str,
        payload: dict[str, Any] | None = None,
        *,
        created_by: str = "",
        idempotency_key: str = "",
        max_attempts: int = 3,
    ) -> dict[str, Any]:
        self.initialize()
        job_id = str(uuid.uuid4())
        key = idempotency_key.strip() or None
        with self._connect() as conn:
            row = conn.execute(
                """
                INSERT INTO catalog_jobs (
                    id, job_type, status, payload_json, created_by,
                    idempotency_key, max_attempts
                ) VALUES (%s, %s, 'queued', %s::jsonb, %s, %s, %s)
                ON CONFLICT (job_type, idempotency_key) DO UPDATE SET
                    status = CASE
                        WHEN catalog_jobs.status IN ('failed', 'cancelled') THEN 'queued'
                        ELSE catalog_jobs.status END,
                    attempts = CASE
                        WHEN catalog_jobs.status IN ('failed', 'cancelled') THEN 0
                        ELSE catalog_jobs.attempts END,
                    error_message = CASE
                        WHEN catalog_jobs.status IN ('failed', 'cancelled') THEN ''
                        ELSE catalog_jobs.error_message END,
                    completed_at = CASE
                        WHEN catalog_jobs.status IN ('failed', 'cancelled') THEN NULL
                        ELSE catalog_jobs.completed_at END,
                    run_after = CASE
                        WHEN catalog_jobs.status IN ('failed', 'cancelled') THEN NOW()
                        ELSE catalog_jobs.run_after END,
                    updated_at = NOW()
                RETURNING *
                """,
                (job_id, job_type, _json(payload or {}), created_by, key, max_attempts),
            ).fetchone()
            if str(row["id"]) == job_id:
                event_type = "queued"
            elif str(row["status"]) == "queued":
                event_type = "requeued"
            else:
                event_type = "enqueue_deduplicated"
            self._event(conn, str(row["id"]), event_type, {"job_type": job_type})
            conn.commit()
        return self._decode(row)

    def claim(self, worker_id: str, *, lease_seconds: int) -> dict[str, Any] | None:
        self.initialize()
        with self._connect() as conn:
            row = conn.execute(
                """
                WITH candidate AS (
                    SELECT id
                    FROM catalog_jobs
                    WHERE run_after <= NOW()
                      AND (
                        status = 'queued'
                        OR (status = 'running' AND lease_expires_at < NOW())
                      )
                    ORDER BY created_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                UPDATE catalog_jobs job
                SET status = 'running',
                    lease_owner = %s,
                    lease_expires_at = NOW() + (%s * INTERVAL '1 second'),
                    heartbeat_at = NOW(),
                    started_at = COALESCE(started_at, NOW()),
                    attempts = attempts + 1,
                    updated_at = NOW()
                FROM candidate
                WHERE job.id = candidate.id
                RETURNING job.*
                """,
                (worker_id, lease_seconds),
            ).fetchone()
            if row:
                self._event(conn, str(row["id"]), "claimed", {"worker_id": worker_id})
            conn.commit()
        return self._decode(row) if row else None

    def progress(
        self,
        job_id: str,
        worker_id: str,
        *,
        progress: float | None = None,
        message: str | None = None,
        checkpoint: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        lease_seconds: int,
    ) -> bool:
        fields = [
            "heartbeat_at = NOW()",
            "lease_expires_at = NOW() + (%s * INTERVAL '1 second')",
            "updated_at = NOW()",
        ]
        params: list[Any] = [lease_seconds]
        if progress is not None:
            fields.append("progress = %s")
            params.append(max(0.0, min(100.0, float(progress))))
        if message is not None:
            fields.append("message = %s")
            params.append(message)
        if checkpoint is not None:
            fields.append("checkpoint_json = %s::jsonb")
            params.append(_json(checkpoint))
        if result is not None:
            fields.append("result_json = result_json || %s::jsonb")
            params.append(_json(result))
        params.extend([job_id, worker_id])
        with self._connect() as conn:
            cursor = conn.execute(
                f"UPDATE catalog_jobs SET {', '.join(fields)} "
                "WHERE id = %s AND status = 'running' AND lease_owner = %s",
                tuple(params),
            )
            conn.commit()
            return cursor.rowcount == 1

    def heartbeat(self, job_id: str, worker_id: str, *, lease_seconds: int) -> bool:
        return self.progress(job_id, worker_id, lease_seconds=lease_seconds)

    def complete(self, job_id: str, worker_id: str, result: dict[str, Any] | None = None) -> None:
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE catalog_jobs SET status = 'completed', progress = 100,
                    result_json = result_json || %s::jsonb, message = CASE
                        WHEN message = '' THEN 'Completed' ELSE message END,
                    lease_owner = '', lease_expires_at = NULL, heartbeat_at = NOW(),
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = %s AND status = 'running' AND lease_owner = %s
                """,
                (_json(result or {}), job_id, worker_id),
            )
            if cursor.rowcount == 1:
                self._event(conn, job_id, "completed", result or {})
            conn.commit()

    def fail(self, job: dict[str, Any], worker_id: str, error: str) -> None:
        retry = int(job.get("attempts") or 0) < int(job.get("max_attempts") or 1)
        status = "queued" if retry else "failed"
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE catalog_jobs SET status = %s, error_message = %s,
                    message = %s, lease_owner = '', lease_expires_at = NULL,
                    run_after = CASE WHEN %s THEN NOW() + INTERVAL '5 seconds' ELSE run_after END,
                    completed_at = CASE WHEN %s THEN NULL ELSE NOW() END,
                    updated_at = NOW()
                WHERE id = %s AND status = 'running' AND lease_owner = %s
                """,
                (status, error, "Retry queued" if retry else "Failed", retry, retry, job["id"], worker_id),
            )
            if cursor.rowcount == 1:
                self._event(conn, str(job["id"]), "retry" if retry else "failed", {"error": error})
            conn.commit()

    def get(self, job_id: str, job_type: str = "") -> dict[str, Any] | None:
        self.initialize()
        with self._connect() as conn:
            if job_type:
                row = conn.execute(
                    "SELECT * FROM catalog_jobs WHERE id = %s AND job_type = %s",
                    (job_id, job_type),
                ).fetchone()
            else:
                row = conn.execute("SELECT * FROM catalog_jobs WHERE id = %s", (job_id,)).fetchone()
        return self._decode(row) if row else None

    def events(self, job_id: str) -> list[dict[str, Any]]:
        self.initialize()
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT event_type, details_json, created_at FROM catalog_job_events "
                "WHERE job_id = %s ORDER BY id",
                (job_id,),
            ).fetchall()
        return [
            {
                "event_type": row["event_type"],
                "details": _loads(row["details_json"], {}),
                "created_at": self._time(row["created_at"]),
            }
            for row in rows
        ]

    @staticmethod
    def _event(conn: Any, job_id: str, event_type: str, details: dict[str, Any]) -> None:
        conn.execute(
            "INSERT INTO catalog_job_events (job_id, event_type, details_json) "
            "VALUES (%s, %s, %s::jsonb)",
            (job_id, event_type, _json(details)),
        )

    @staticmethod
    def _time(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat()
        return str(value)

    def _decode(self, row: Any) -> dict[str, Any]:
        payload = dict(row)
        payload["payload"] = _loads(payload.pop("payload_json", {}), {})
        payload["result"] = _loads(payload.pop("result_json", {}), {})
        payload["checkpoint"] = _loads(payload.pop("checkpoint_json", {}), {})
        payload["percent"] = float(payload.pop("progress", 0) or 0)
        for key in (
            "lease_expires_at",
            "heartbeat_at",
            "run_after",
            "created_at",
            "updated_at",
            "started_at",
            "completed_at",
        ):
            payload[key] = self._time(payload.get(key))
        # Preserve the existing polling contract while exposing structured data.
        return {**payload, **payload["result"], "job_id": payload["id"]}


catalog_jobs = CatalogJobService()
