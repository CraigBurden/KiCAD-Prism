"""An in-memory job queue with the fenced protocol of ``JobService``.

Tests drive the real runner, supervisor and handlers against it, so cancel,
lease loss and crash can be staged step by step without PostgreSQL. It keeps
the rules that matter for those stories:

- every write presents ``(worker_id, fence)`` and is refused once the lease is
  gone, the fence moved on, or the status no longer allows it;
- ``claim`` reclaims an expired running lease with ``fence + 1``;
- a cancel on a running job only marks it ``cancel_requested``;
- completion runs the caller's ``settle(conn)`` in the same step, and a raise
  there leaves the job running, as a rolled-back transaction would.
"""

from __future__ import annotations

import copy
import uuid
from typing import Any, Callable, Mapping, Sequence

TERMINAL = frozenset({"completed", "failed", "cancelled"})


class InMemoryJobService:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.artifacts: list[dict[str, Any]] = []
        self.events: list[tuple[str, str]] = []
        self.settle_connection = object()
        self._completing: set[str] = set()
        self._deferred_cancels: list[str] = []

    # -- queue -------------------------------------------------------------

    def initialize(self) -> None:
        return None

    def enqueue(
        self,
        kind: str,
        payload: Mapping[str, Any] | None = None,
        *,
        worker_pool: str = "prism",
        artifact_key: str = "",
        project_id: str | None = None,
        repository_id: str | None = None,
        requested_by: str = "",
        priority: int = 100,
        max_attempts: int = 3,
        resources: Mapping[str, int] | None = None,
        locks: Sequence[Mapping[str, str]] | None = None,
    ) -> dict[str, Any]:
        if artifact_key:
            for row in self.rows.values():
                if (
                    row["kind"] == kind
                    and row["artifact_key"] == artifact_key
                    and row["status"] not in TERMINAL
                ):
                    return {**copy.deepcopy(row), "deduplicated": True}
        job_id = str(uuid.uuid4())
        self.rows[job_id] = {
            "job_id": job_id,
            "kind": kind,
            "worker_pool": worker_pool,
            "status": "queued",
            "payload": dict(payload or {}),
            "artifact_key": artifact_key,
            "project_id": project_id,
            "repository_id": repository_id,
            "requested_by": requested_by,
            "priority": priority,
            "max_attempts": max_attempts,
            "resource_requirements": dict(resources or {}),
            "lock_requirements": [dict(lock) for lock in locks or ()],
            "fence": 0,
            "attempt": 0,
            "lease_owner": "",
            "lease_live": False,
            "stage": "",
            "message": "Queued",
            "percent": 0.0,
            "result_path": None,
            "result_digest": None,
            "result_metadata": {},
            "error_code": None,
            "error_message": None,
        }
        return {**copy.deepcopy(self.rows[job_id]), "deduplicated": False}

    def claim(self, worker_id: str, *, worker_pool: str, lease_seconds: int = 30) -> dict[str, Any] | None:
        for row in self.rows.values():
            if row["worker_pool"] != worker_pool:
                continue
            reclaim = row["status"] == "running" and not row["lease_live"]
            if row["status"] in {"queued", "retry_wait"} or reclaim:
                row.update(
                    status="running",
                    fence=row["fence"] + 1,
                    attempt=row["attempt"] + 1,
                    lease_owner=worker_id,
                    lease_live=True,
                )
                return copy.deepcopy(row)
        return None

    def expire(self, job_id: str) -> None:
        """The lease ran out (the worker stopped heartbeating)."""

        self.rows[job_id]["lease_live"] = False

    def get(self, job_id: str) -> dict[str, Any] | None:
        row = self.rows.get(job_id)
        return copy.deepcopy(row) if row else None

    # -- fenced writes -----------------------------------------------------

    def _authoritative(
        self, job_id: str, worker_id: str, fence: int, statuses: Sequence[str] = ("running",)
    ) -> dict[str, Any] | None:
        row = self.rows.get(job_id)
        if (
            row is None
            or row["fence"] != fence
            or row["lease_owner"] != worker_id
            or not row["lease_live"]
            or row["status"] not in statuses
        ):
            return None
        return row

    def _end(self, row: dict[str, Any], status: str) -> None:
        row.update(status=status, lease_owner="", lease_live=False)
        self.events.append((row["job_id"], status))

    def heartbeat(self, job_id: str, worker_id: str, fence: int, *, lease_seconds: int = 30) -> bool:
        return self._authoritative(job_id, worker_id, fence, ("running", "cancel_requested")) is not None

    def set_log_path(self, job_id: str, worker_id: str, fence: int, log_path: str) -> bool:
        return self._authoritative(job_id, worker_id, fence) is not None

    def progress(self, job_id: str, worker_id: str, fence: int, **values: Any) -> bool:
        row = self._authoritative(job_id, worker_id, fence, ("running", "cancel_requested"))
        if row is None:
            return False
        updates = dict(values.pop("payload_updates", None) or {})
        row["payload"].update(copy.deepcopy(updates))
        row.update({key: value for key, value in values.items() if value is not None})
        return True

    def register_fenced_artifacts(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        artifacts: Sequence[Mapping[str, Any]],
        *,
        allowed_statuses: Sequence[str] = ("running",),
    ) -> list[str] | None:
        if self._authoritative(job_id, worker_id, fence, allowed_statuses) is None:
            return None
        ids = []
        for artifact in artifacts:
            self.artifacts.append({**dict(artifact), "job_id": job_id, "fence": fence})
            ids.append(f"artifact-{len(self.artifacts)}")
        return ids

    def publish_partial_artifact(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        artifact: Mapping[str, Any],
        *,
        stage: str,
        message: str,
        percent: float,
        details: Mapping[str, Any] | None = None,
    ) -> bool:
        row = self._authoritative(job_id, worker_id, fence)
        if row is None:
            return False
        self.artifacts.append({**dict(artifact), "job_id": job_id, "fence": fence})
        row.update(
            result_path=artifact["object_path"],
            result_digest=artifact["digest"],
            result_metadata=dict(details or {}),
            stage=stage,
            message=message,
            percent=percent,
        )
        return True

    def publish_ended_result(
        self,
        job_id: str,
        artifact: Mapping[str, Any],
        *,
        expected_digest: str,
        details: Mapping[str, Any],
    ) -> bool:
        row = self.rows.get(job_id)
        if row is None or row["status"] not in {"failed", "cancelled"} or row.get("result_digest") != expected_digest:
            return False
        self.artifacts.append({**dict(artifact), "job_id": job_id, "fence": row["fence"], "ended": True})
        row.update(
            result_path=artifact["object_path"],
            result_digest=artifact["digest"],
            result_metadata=dict(details),
        )
        return True

    def active_job_ids(self, kind: str, *, requested_by: str, exclude_job_id: str = "") -> list[str]:
        """Ids of the kind's queued, running or retry_wait jobs one requester asked for."""

        return [
            job_id
            for job_id, row in self.rows.items()
            if row["kind"] == kind
            and row["requested_by"] == requested_by
            and row["status"] in {"queued", "running", "retry_wait"}
            and job_id != exclude_job_id
        ]

    def ended_job_ids(self, kind: str, *, result_metadata: Mapping[str, Any], limit: int = 100) -> list[str]:
        return [
            job_id
            for job_id, row in self.rows.items()
            if row["kind"] == kind
            and row["status"] in {"failed", "cancelled"}
            and all((row.get("result_metadata") or {}).get(k) == v for k, v in result_metadata.items())
        ][:limit]

    def _complete(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        *,
        settle: Callable[[Any], Any] | None,
        values: Mapping[str, Any],
    ) -> bool:
        row = self._authoritative(job_id, worker_id, fence)
        if row is None:
            return False
        self._completing.add(job_id)
        try:
            if settle is not None:
                settle(self.settle_connection)
            row.update(values, error_code="", error_message="")
            self._end(row, "completed")
        finally:
            self._completing.discard(job_id)
            deferred, self._deferred_cancels = self._deferred_cancels, []
            for cancelled in deferred:
                self.request_cancel(cancelled)
        return True

    def complete(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        *,
        result_path: str | None = None,
        result_digest: str | None = None,
        message: str = "Completed",
        details: Mapping[str, Any] | None = None,
        settle: Callable[[Any], Any] | None = None,
    ) -> bool:
        return self._complete(
            job_id,
            worker_id,
            fence,
            settle=settle,
            values={
                "result_path": result_path,
                "result_digest": result_digest,
                "message": message,
                "result_metadata": dict(details or {}),
            },
        )

    def complete_artifact(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        artifact: Mapping[str, Any],
        *,
        extra_artifacts: Sequence[Mapping[str, Any]] = (),
        message: str = "Completed",
        details: Mapping[str, Any] | None = None,
        settle: Callable[[Any], Any] | None = None,
    ) -> bool:
        completed = self._complete(
            job_id,
            worker_id,
            fence,
            settle=settle,
            values={
                "result_path": artifact["object_path"],
                "result_digest": artifact["digest"],
                "message": message,
                "result_metadata": dict(details or {}),
            },
        )
        if completed:
            for item in (artifact, *extra_artifacts):
                self.artifacts.append({**dict(item), "job_id": job_id, "fence": fence})
        return completed

    def fail(
        self,
        job_id: str,
        worker_id: str,
        fence: int,
        *,
        error_code: str,
        error_message: str,
        transient: bool = False,
        retry_after_seconds: int = 5,
    ) -> str | None:
        row = self._authoritative(job_id, worker_id, fence, ("running", "cancel_requested"))
        if row is None:
            return None
        cancelling = row["status"] == "cancel_requested"
        retry = not cancelling and transient and row["attempt"] < row["max_attempts"]
        status = "cancelled" if cancelling else "retry_wait" if retry else "failed"
        row.update(error_code=error_code, error_message=error_message)
        self._end(row, status)
        return status

    def request_cancel(self, job_id: str, *, requested_by: str = "") -> str | None:
        if job_id in self._completing:
            # PostgreSQL blocks the cancel on the job row until the completing
            # transaction commits; it then finds a terminal job.
            self._deferred_cancels.append(job_id)
            return None
        row = self.rows.get(job_id)
        if row is None:
            return None
        if row["status"] in TERMINAL:
            return row["status"]
        if row["status"] in {"queued", "retry_wait"}:
            self._end(row, "cancelled")
            return "cancelled"
        row["status"] = "cancel_requested"
        return "cancel_requested"

    def finalize_cancel(self, job_id: str, worker_id: str, fence: int, *, message: str = "Cancelled") -> bool:
        row = self._authoritative(job_id, worker_id, fence, ("running", "cancel_requested"))
        if row is None:
            return False
        row["message"] = message
        self._end(row, "cancelled")
        return True


# -- driving the real runner and supervisor ---------------------------------


class ProcessKilled(BaseException):
    """Stands in for SIGTERM/SIGKILL: no ``except Exception`` in the child sees it."""


class _ExitedProcess:
    def __init__(self, returncode: int) -> None:
        self.returncode = returncode
        self.pid = 0

    def poll(self) -> int:
        return self.returncode


def run_attempt(
    service: InMemoryJobService,
    job_id: str,
    worker_id: str,
    handler: Callable[[Any], Any],
    *,
    state_root: Any,
) -> int:
    """Run one claimed attempt through ``app.job_runner.execute``.

    Returns the runner's exit code, or ``-15`` when the handler was killed
    (``ProcessKilled``) and no cleanup in the child ran.
    """

    from unittest import mock

    from app import job_runner
    from app.services import job_runtime

    fence = int(service.rows[job_id]["fence"])
    real_context = job_runtime.JobContext

    def context(job: Mapping[str, Any], **kwargs: Any) -> Any:
        kwargs["service"] = service
        return real_context(job, **kwargs)

    with (
        mock.patch.object(job_runner, "jobs", service),
        mock.patch.object(job_runner, "JobContext", context),
        mock.patch.object(job_runner, "get_job_handler", return_value=handler),
        mock.patch.object(job_runner, "load_builtin_job_handlers"),
        mock.patch("app.services.trackers.composition.initialize_tracker_composition"),
        mock.patch.object(job_runtime, "job_state_root", return_value=state_root),
    ):
        try:
            return job_runner.execute(job_id, fence, worker_id)
        except ProcessKilled:
            return -15


def supervise_exit(
    service: InMemoryJobService,
    job_id: str,
    worker_id: str,
    returncode: int,
    *,
    fence: int | None = None,
) -> None:
    """One supervisor pass that finds the attempt's child process exited."""

    import io
    import time
    from unittest import mock

    from app import prism_worker

    worker = prism_worker.PrismWorker()
    worker.worker_id = worker_id
    worker.running[job_id] = prism_worker.RunningJob(
        job_id=job_id,
        fence=int(service.rows[job_id]["fence"] if fence is None else fence),
        attempt=int(service.rows[job_id]["attempt"]),
        process=_ExitedProcess(returncode),  # type: ignore[arg-type]
        log_handle=io.BytesIO(),
        last_heartbeat=time.monotonic(),
    )
    with mock.patch.object(prism_worker, "jobs", service):
        worker.supervise()


def claimed_context(
    service: InMemoryJobService,
    kind: str,
    payload: Mapping[str, Any],
    *,
    state_root: Any,
    worker_pool: str = "prism",
    artifact_key: str = "",
    requested_by: str = "",
) -> Any:
    """Queue and claim one job, and return the ``JobContext`` its handler gets."""

    from unittest import mock

    from app.services import job_runtime

    queued = service.enqueue(
        kind, payload, worker_pool=worker_pool, artifact_key=artifact_key, requested_by=requested_by
    )
    claimed = service.claim("test-worker", worker_pool=worker_pool)
    assert claimed is not None and claimed["job_id"] == queued["job_id"]
    with mock.patch.object(job_runtime, "job_state_root", return_value=state_root):
        return job_runtime.JobContext(claimed, worker_id="test-worker", service=service)


def run_catalog_task(
    task: Callable[[Any], Any],
    job: Mapping[str, Any],
    progress: Callable[..., Any] | None = None,
    *,
    kind: str = "catalog_task",
) -> Any:
    """Run one catalog task the way the catalog pool does, from a job-shaped dict.

    ``job`` gives ``payload`` and optionally the saved ``checkpoint`` and
    ``result`` a retried attempt resumes from. ``progress`` sees every update
    that reached the job row as ``progress=, message=, checkpoint=, result=``.
    """

    import tempfile
    from pathlib import Path

    from app.services.job_runtime import CHECKPOINT_KEY, PARTIAL_RESULT_KEY

    service = InMemoryJobService()
    payload = dict(job.get("payload") or {})
    if job.get("checkpoint"):
        payload[CHECKPOINT_KEY] = dict(job["checkpoint"])
    if job.get("result"):
        payload[PARTIAL_RESULT_KEY] = dict(job["result"])
    real_progress = service.progress

    def recorded(job_id: str, worker_id: str, fence: int, **values: Any) -> bool:
        updates = dict(values.get("payload_updates") or {})
        if progress is not None:
            progress(
                progress=values.get("percent"),
                message=values.get("message"),
                checkpoint=updates.get(CHECKPOINT_KEY),
                result=updates.get(PARTIAL_RESULT_KEY),
            )
        return real_progress(job_id, worker_id, fence, **values)

    service.progress = recorded  # type: ignore[method-assign]
    with tempfile.TemporaryDirectory() as root:
        context = claimed_context(
            service, kind, payload, state_root=Path(root), worker_pool="catalog",
            requested_by=str(job.get("created_by") or ""),
        )
        return task(context)
