"""Catalog jobs as the catalog API shows them.

Catalog work runs on the shared fenced queue under the kinds declared in
``catalog_worker_tasks``. This adapter queues by job type and presents a job
row in the catalog API's shape: ``id``, ``job_type``, the queued ``payload``,
the ``checkpoint``, the accumulated ``result`` (also spread at the top level),
``created_by``, ``attempts`` and ``progress``.
"""

from __future__ import annotations

from typing import Any

from app.services.job_runtime import CHECKPOINT_KEY, PARTIAL_RESULT_KEY
from app.services.job_service import jobs


def _stored_parts(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """(queued payload, checkpoint, partial result) of a stored payload."""

    if "catalog_payload" in payload:  # queued before the envelope was removed
        return (
            dict(payload.get("catalog_payload") or {}),
            dict(payload.get("catalog_checkpoint") or {}),
            dict(payload.get("catalog_result") or {}),
        )
    queued = {
        key: value
        for key, value in payload.items()
        if key not in {CHECKPOINT_KEY, PARTIAL_RESULT_KEY}
    }
    return (
        queued,
        dict(payload.get(CHECKPOINT_KEY) or {}),
        dict(payload.get(PARTIAL_RESULT_KEY) or {}),
    )


class CatalogJobService:
    def initialize(self) -> None:
        jobs.initialize()

    def enqueue(
        self,
        job_type: str,
        payload: dict[str, Any] | None = None,
        *,
        created_by: str = "",
        idempotency_key: str = "",
    ) -> dict[str, Any]:
        from app.services.catalog_worker_tasks import CATALOG_JOB_KINDS

        queued = CATALOG_JOB_KINDS[job_type].enqueue(
            dict(payload or {}),
            artifact_key=idempotency_key.strip(),
            requested_by=created_by,
        )
        return self._decode(queued)

    def get(self, job_id: str, job_type: str = "") -> dict[str, Any] | None:
        row = jobs.get(job_id)
        if not row or row.get("worker_pool") != "catalog":
            return None
        if job_type and row.get("kind") != job_type:
            return None
        return self._decode(row)

    def events(self, job_id: str) -> list[dict[str, Any]]:
        return jobs.events(job_id, limit=1000)

    def request_cancel(self, job_id: str, *, requested_by: str = "") -> str | None:
        return jobs.request_cancel(job_id, requested_by=requested_by)

    @staticmethod
    def _decode(row: dict[str, Any]) -> dict[str, Any]:
        queued, checkpoint, result = _stored_parts(dict(row.get("payload") or {}))
        if row.get("status") == "completed":
            result.update(dict(row.get("result_metadata") or {}))
        decoded = {
            **row,
            "id": row["job_id"],
            "job_type": row["kind"],
            "payload": queued,
            "result": result,
            "checkpoint": checkpoint,
            "created_by": str(row.get("requested_by") or ""),
            "attempts": int(row.get("attempt") or 0),
            "progress": float(row.get("percent") or 0),
        }
        return {**decoded, **result}


catalog_jobs = CatalogJobService()
