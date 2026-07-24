from __future__ import annotations

import argparse
import logging
import os
import signal
import socket
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import IO

from app.core.config import settings
from app.services.job_runtime import job_state_root
from app.services.job_service import jobs


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("prism-worker")


@dataclass
class RunningJob:
    job_id: str
    fence: int
    attempt: int
    process: subprocess.Popen[bytes]
    log_handle: IO[bytes]
    last_heartbeat: float
    termination_started: float | None = None
    termination_reason: str = ""


class PrismWorker:
    def __init__(self, worker_pool: str = "prism") -> None:
        if worker_pool not in {"prism", "catalog"}:
            raise ValueError(f"Unsupported worker pool: {worker_pool}")
        self.worker_pool = worker_pool
        self.concurrency = (
            settings.CATALOG_WORKER_CONCURRENCY
            if worker_pool == "catalog"
            else settings.PRISM_WORKER_CONCURRENCY
        )
        self.poll_seconds = (
            settings.CATALOG_WORKER_POLL_SECONDS
            if worker_pool == "catalog"
            else settings.PRISM_WORKER_POLL_SECONDS
        )
        self.lease_seconds = (
            settings.CATALOG_JOB_LEASE_SECONDS
            if worker_pool == "catalog"
            else settings.PRISM_JOB_LEASE_SECONDS
        )
        self.heartbeat_seconds = min(
            settings.PRISM_JOB_HEARTBEAT_SECONDS,
            max(1.0, self.lease_seconds / 3),
        )
        self.worker_id = (
            f"{worker_pool}:{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
        )
        self.running: dict[str, RunningJob] = {}
        self.stopping = False
        self._last_database_error_log = 0.0
        self._catalog_maintenance_date = ""

    @staticmethod
    def resource_capacities() -> dict[str, int]:
        return {
            "prism_worker": settings.PRISM_WORKER_CONCURRENCY,
            "webgpu": settings.PRISM_WEBGPU_CONCURRENCY,
            "design_compare": settings.PRISM_DESIGN_COMPARE_CONCURRENCY,
            "workflow": settings.PRISM_WORKFLOW_CONCURRENCY,
            "import": settings.PRISM_IMPORT_CONCURRENCY,
            "semantic_compile": settings.PRISM_SEMANTIC_COMPILE_SLOTS,
            "catalog_worker": settings.CATALOG_WORKER_CONCURRENCY,
            "catalog_kicad": settings.CATALOG_KICAD_CONCURRENCY,
        }

    def request_stop(self, *_args: object) -> None:
        self.stopping = True

    def _log_database_error(self, operation: str) -> None:
        now = time.monotonic()
        if now - self._last_database_error_log >= 10:
            logger.exception("Database operation failed while trying to %s", operation)
            self._last_database_error_log = now

    def _get_job(self, job_id: str) -> tuple[dict[str, object] | None, bool]:
        try:
            return jobs.get(job_id), True
        except Exception:
            self._log_database_error(f"read job {job_id}")
            return None, False

    def launch(self, job: dict[str, object]) -> None:
        job_id = str(job["job_id"])
        fence = int(job["fence"])
        attempt = int(job.get("attempt") or 1)
        log_dir = job_state_root() / "jobs" / job_id
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"attempt-{attempt}-fence-{fence}.log"
        log_handle = log_path.open("ab", buffering=0)
        try:
            log_path_recorded = jobs.set_log_path(
                job_id,
                self.worker_id,
                fence,
                str(log_path),
            )
        except Exception:
            self._log_database_error(f"record the log path for job {job_id}")
            log_path_recorded = False
        if not log_path_recorded:
            log_handle.close()
            current, database_available = self._get_job(job_id)
            if (
                database_available
                and current is not None
                and current.get("status") == "cancel_requested"
                and int(current.get("fence") or -1) == fence
                and current.get("lease_owner") == self.worker_id
            ):
                try:
                    jobs.finalize_cancel(
                        job_id,
                        self.worker_id,
                        fence,
                        message="Cancelled before the job process started",
                    )
                except Exception:
                    self._log_database_error(f"finalize cancellation for job {job_id}")
            logger.warning("Lease disappeared before job %s could start", job_id)
            return
        command = [
            sys.executable,
            "-m",
            "app.job_runner",
            "--job-id",
            job_id,
            "--fence",
            str(fence),
            "--worker-id",
            self.worker_id,
        ]
        try:
            process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                cwd=str(Path(__file__).resolve().parents[1]),
                start_new_session=True,
            )
        except Exception as error:
            log_handle.close()
            try:
                jobs.fail(
                    job_id,
                    self.worker_id,
                    fence,
                    error_code="child_start_failed",
                    error_message=str(error),
                    transient=True,
                    retry_after_seconds=5,
                )
            except Exception:
                self._log_database_error(f"schedule retry for job {job_id}")
            logger.exception("Could not start job %s", job_id)
            return
        now = time.monotonic()
        self.running[job_id] = RunningJob(
            job_id=job_id,
            fence=fence,
            attempt=attempt,
            process=process,
            log_handle=log_handle,
            last_heartbeat=now,
        )
        logger.info(
            "Started job=%s fence=%s attempt=%s pid=%s",
            job_id,
            fence,
            attempt,
            process.pid,
        )

    @staticmethod
    def _signal_group(process: subprocess.Popen[bytes], sig: signal.Signals) -> None:
        if process.poll() is not None:
            return
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            return

    def begin_termination(self, running: RunningJob, reason: str) -> None:
        if running.termination_started is not None:
            return
        running.termination_started = time.monotonic()
        running.termination_reason = reason
        self._signal_group(running.process, signal.SIGTERM)
        logger.warning(
            "Terminating job=%s fence=%s reason=%s",
            running.job_id,
            running.fence,
            reason,
        )

    def supervise(self) -> None:
        now = time.monotonic()
        finished: list[str] = []
        for job_id, running in tuple(self.running.items()):
            return_code = running.process.poll()
            if return_code is not None:
                running.log_handle.close()
                current, database_available = self._get_job(job_id)
                authoritative = (
                    database_available
                    and current is not None
                    and int(current.get("fence") or -1) == running.fence
                    and current.get("lease_owner") == self.worker_id
                )
                if authoritative and current.get("status") in {"running", "cancel_requested"}:
                    try:
                        if current.get("status") == "cancel_requested":
                            jobs.finalize_cancel(
                                job_id,
                                self.worker_id,
                                running.fence,
                                message="Cancelled",
                            )
                        elif self.stopping:
                            jobs.fail(
                                job_id,
                                self.worker_id,
                                running.fence,
                                error_code="worker_shutdown",
                                error_message="Worker restarted while the job was running",
                                transient=True,
                                retry_after_seconds=0,
                            )
                        else:
                            jobs.fail(
                                job_id,
                                self.worker_id,
                                running.fence,
                                error_code="runner_exited",
                                error_message=f"Job runner exited with code {return_code}",
                            )
                    except Exception:
                        self._log_database_error(f"finalize exited job {job_id}")
                logger.info(
                    "Job=%s fence=%s exited code=%s",
                    job_id,
                    running.fence,
                    return_code,
                )
                finished.append(job_id)
                continue

            current, database_available = self._get_job(job_id)
            if (
                database_available
                and current is not None
                and int(current.get("fence") or -1) == running.fence
                and current.get("status") == "cancel_requested"
            ):
                self.begin_termination(running, "cancel_requested")
            elif database_available and (
                current is None
                or int(current.get("fence") or -1) != running.fence
                or current.get("lease_owner") != self.worker_id
                or current.get("status") not in {"running", "cancel_requested"}
            ):
                self.begin_termination(running, "lease_lost")

            if (
                running.termination_started is not None
                and now - running.termination_started
                >= settings.PRISM_JOB_CANCEL_GRACE_SECONDS
            ):
                self._signal_group(running.process, signal.SIGKILL)
                continue

            if now - running.last_heartbeat < self.heartbeat_seconds:
                continue
            try:
                renewed = jobs.heartbeat(
                    job_id,
                    self.worker_id,
                    running.fence,
                    lease_seconds=self.lease_seconds,
                )
            except Exception:
                logger.exception("Heartbeat failed for job=%s", job_id)
                renewed = False
            if renewed:
                running.last_heartbeat = now
            elif (
                now - running.last_heartbeat
                >= self.lease_seconds - 2
            ):
                self.begin_termination(running, "lease_lost")

        for job_id in finished:
            self.running.pop(job_id, None)

    def schedule_catalog_maintenance(self) -> None:
        if self.worker_pool != "catalog" or not settings.CATALOG_RETENTION_ENABLED:
            return
        today = datetime.now(timezone.utc).date().isoformat()
        if self._catalog_maintenance_date == today:
            return
        from app.services.catalog_job_service import catalog_jobs

        catalog_jobs.enqueue(
            "artifact_maintenance",
            {},
            created_by="system:catalog-worker",
            idempotency_key=f"artifact-maintenance:{today}",
            max_attempts=3,
        )
        self._catalog_maintenance_date = today

    def run(self) -> None:
        while not self.stopping:
            try:
                jobs.initialize()
                jobs.configure_resource_slots(self.resource_capacities())
                break
            except Exception:
                self._log_database_error("initialize the worker")
                time.sleep(min(1.0, self.poll_seconds))
        if self.stopping:
            return
        logger.info(
            "Worker %s started pool=%s concurrency=%s",
            self.worker_id,
            self.worker_pool,
            self.concurrency,
        )
        while not self.stopping:
            try:
                self.schedule_catalog_maintenance()
            except Exception:
                self._log_database_error("schedule catalog maintenance")
            self.supervise()
            while len(self.running) < self.concurrency:
                try:
                    claimed = jobs.claim(
                        self.worker_id,
                        worker_pool=self.worker_pool,
                        lease_seconds=self.lease_seconds,
                    )
                except Exception:
                    self._log_database_error("claim the next job")
                    break
                if not claimed:
                    break
                self.launch(claimed)
            time.sleep(self.poll_seconds)

        for running in self.running.values():
            self.begin_termination(running, "worker_shutdown")
        shutdown_deadline = time.monotonic() + settings.PRISM_JOB_CANCEL_GRACE_SECONDS + 2
        while self.running and time.monotonic() < shutdown_deadline:
            self.supervise()
            time.sleep(0.1)
        for running in self.running.values():
            self._signal_group(running.process, signal.SIGKILL)
        self.supervise()
        logger.info("Worker %s stopped", self.worker_id)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a supervised Prism worker pool")
    parser.add_argument("--pool", choices=("prism", "catalog"), default="prism")
    args = parser.parse_args()
    worker = PrismWorker(args.pool)
    signal.signal(signal.SIGTERM, worker.request_stop)
    signal.signal(signal.SIGINT, worker.request_stop)
    worker.run()


if __name__ == "__main__":
    main()
