"""Memory-aware admission over the real fenced claim path (item A).

The "memory" resource reserves a job's measured peak as units of
``MEMORY_UNIT_MIB``; the slot table's capacity is the worker's budget. These
tests use the real PostgreSQL claim code (``JobService.claim``) because the
question is whether two heavy jobs can be admitted into one wave, not whether a
helper computes a sum.
"""

from __future__ import annotations

import os
import unittest
import uuid

from app.core.worker_memory import MEMORY_UNIT_MIB
from app.services.job_service import JobService
from app.services.postgres_database import database

#: The default 4 GiB budget at 256 MiB per unit. Set explicitly so the test
#: does not depend on the host's memory.
BUDGET_UNITS = 16


@unittest.skipUnless(
    os.environ.get("PRISM_DATABASE_URL"),
    "PRISM_DATABASE_URL is required for PostgreSQL job integration tests",
)
class MemoryAdmissionPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = JobService()
        self.service.initialize()
        self.service.configure_resource_slots(
            {"memory": BUDGET_UNITS, "prism_worker": 4}
        )
        self.suffix = uuid.uuid4().hex
        self.pool = f"memory-admission-{self.suffix}"
        self.job_ids: list[str] = []

    def tearDown(self) -> None:
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            if self.job_ids:
                conn.execute(
                    """
                    UPDATE ws_job_resource_slots
                    SET job_id = NULL, fence = NULL, lease_owner = '',
                        lease_expires_at = NULL, updated_at = NOW()
                    WHERE job_id = ANY(%s)
                    """,
                    (self.job_ids,),
                )
                conn.execute("DELETE FROM ws_jobs WHERE id = ANY(%s)", (self.job_ids,))
            conn.commit()

    def enqueue(self, label: str, units: int, priority: int) -> str:
        job = self.service.enqueue(
            f"memory-test-{self.suffix}",
            {"label": label},
            worker_pool=self.pool,
            resources={"memory": units},
            priority=priority,
        )
        job_id = str(job["job_id"])
        self.job_ids.append(job_id)
        return job_id

    def claim(self):
        return self.service.claim(
            f"worker-{uuid.uuid4().hex}", worker_pool=self.pool, lease_seconds=3600
        )

    def test_a_wave_cannot_sum_past_the_budget_and_a_lone_job_is_immediate(self) -> None:
        self.assertEqual(BUDGET_UNITS * MEMORY_UNIT_MIB, 4096)
        nine = self.enqueue("nine-a", 9, priority=10)
        thirteen = self.enqueue("thirteen", 13, priority=20)
        four = self.enqueue("four", 4, priority=30)
        another_nine = self.enqueue("nine-b", 9, priority=40)

        # 9 + 4 = 13 units fit; the next 13-unit job needs more than the 3
        # units left, and so does the other 9-unit job.
        first = self.claim()
        second = self.claim()
        third = self.claim()
        self.assertIsNotNone(first)
        self.assertIsNotNone(second)
        self.assertIsNone(third)
        self.assertEqual({first["job_id"], second["job_id"]}, {nine, four})

        # A kind really holds several units of one resource, and completion
        # returns exactly those units.
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            held = conn.execute(
                "SELECT COUNT(*) AS held FROM ws_job_resource_slots WHERE job_id = %s",
                (nine,),
            ).fetchone()["held"]
        self.assertEqual(int(held), 9)

        # Freeing the first wave admits the waiting 13-unit job, then the
        # other 9-unit job once the 13-unit job ends: no job is lost.
        self.assertTrue(
            self.service.complete(nine, str(first["lease_owner"]), int(first["fence"]))
        )
        self.assertTrue(
            self.service.complete(
                four, str(second["lease_owner"]), int(second["fence"])
            )
        )
        next_claim = self.claim()
        self.assertIsNotNone(next_claim)
        self.assertEqual(next_claim["job_id"], thirteen)
        self.assertIsNone(self.claim())  # 3 units left, not enough for 9

        self.assertTrue(
            self.service.complete(
                thirteen,
                str(next_claim["lease_owner"]),
                int(next_claim["fence"]),
            )
        )
        last = self.claim()
        self.assertIsNotNone(last)
        self.assertEqual(last["job_id"], another_nine)


if __name__ == "__main__":
    unittest.main()
