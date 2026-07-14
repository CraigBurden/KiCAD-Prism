from __future__ import annotations

import logging
import os
import signal
import socket
import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone

from app.core.config import settings
from app.services.catalog_job_service import catalog_jobs
from app.services.catalog_worker_tasks import KICAD_HEAVY_JOB_TYPES, execute_job
from app.services.component_catalog_service import catalog_service
from app.services.local_artifact_store import artifact_store


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("prism-catalog-worker")
stop = threading.Event()
heavy_gate = threading.Semaphore(1)


def _run(job: dict[str, object], worker_id: str) -> None:
    gate = heavy_gate if job.get("job_type") in KICAD_HEAVY_JOB_TYPES else None
    heartbeat_stop = threading.Event()

    def maintain_lease() -> None:
        interval = max(10.0, settings.CATALOG_JOB_LEASE_SECONDS / 3)
        while not heartbeat_stop.wait(interval):
            if not catalog_jobs.heartbeat(
                str(job["id"]), worker_id, lease_seconds=settings.CATALOG_JOB_LEASE_SECONDS
            ):
                return

    heartbeat = threading.Thread(target=maintain_lease, daemon=True)
    try:
        if gate:
            gate.acquire()
        heartbeat.start()
        execute_job(job, catalog_jobs, worker_id)
    except Exception as exc:
        logger.exception("Catalog job %s failed", job.get("id"))
        catalog_jobs.fail(job, worker_id, str(exc))
    finally:
        heartbeat_stop.set()
        if gate:
            gate.release()


def main() -> None:
    worker_id = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    catalog_service.initialize()
    catalog_jobs.initialize()
    artifact_store.initialize()
    futures: set[Future[None]] = set()
    maintenance_date = ""
    logger.info("Catalog worker %s started with concurrency=%s", worker_id, settings.CATALOG_WORKER_CONCURRENCY)
    with ThreadPoolExecutor(max_workers=settings.CATALOG_WORKER_CONCURRENCY) as executor:
        while not stop.is_set():
            today = datetime.now(timezone.utc).date().isoformat()
            if settings.CATALOG_RETENTION_ENABLED and maintenance_date != today:
                catalog_jobs.enqueue(
                    "artifact_maintenance",
                    {},
                    created_by="system:catalog-worker",
                    idempotency_key=f"artifact-maintenance:{today}",
                    max_attempts=3,
                )
                maintenance_date = today
            futures = {future for future in futures if not future.done()}
            while len(futures) < settings.CATALOG_WORKER_CONCURRENCY and not stop.is_set():
                job = catalog_jobs.claim(worker_id, lease_seconds=settings.CATALOG_JOB_LEASE_SECONDS)
                if not job:
                    break
                futures.add(executor.submit(_run, job, worker_id))
            stop.wait(settings.CATALOG_WORKER_POLL_SECONDS)
    logger.info("Catalog worker %s stopped", worker_id)


if __name__ == "__main__":
    main()
