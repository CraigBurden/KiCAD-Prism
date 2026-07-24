from __future__ import annotations

import os
import uuid
import unittest

from app.services.job_service import JobService
from app.services.postgres_database import database


@unittest.skipUnless(
    os.environ.get("PRISM_DATABASE_URL"),
    "PRISM_DATABASE_URL is required for PostgreSQL job integration tests",
)
class JobServicePostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = JobService()
        self.service.initialize()
        self.suffix = uuid.uuid4().hex
        self.pool = f"test-{self.suffix}"
        self.kind = f"test-kind-{self.suffix}"
        self.resource = f"test-resource-{self.suffix}"
        self.job_ids: list[str] = []

    def tearDown(self) -> None:
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            conn.execute(
                "DELETE FROM ws_artifacts WHERE kind = %s OR source_job_id = ANY(%s)",
                (self.kind, self.job_ids),
            )
            conn.execute(
                "DELETE FROM ws_jobs WHERE id = ANY(%s)",
                (self.job_ids,),
            )
            conn.execute(
                "DELETE FROM ws_job_resource_slots WHERE resource_name = %s",
                (self.resource,),
            )
            conn.commit()

    def enqueue(self, artifact_key: str, **kwargs):
        job = self.service.enqueue(
            self.kind,
            {"test": True},
            worker_pool=self.pool,
            artifact_key=artifact_key,
            **kwargs,
        )
        job_id = str(job["job_id"])
        if job_id not in self.job_ids:
            self.job_ids.append(job_id)
        return job

    def expire(self, job_id: str) -> None:
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            conn.execute(
                """
                UPDATE ws_jobs
                SET lease_expires_at = NOW() - INTERVAL '1 second'
                WHERE id = %s
                """,
                (job_id,),
            )
            conn.execute(
                """
                UPDATE ws_job_resource_slots
                SET lease_expires_at = NOW() - INTERVAL '1 second'
                WHERE job_id = %s
                """,
                (job_id,),
            )
            conn.execute(
                """
                UPDATE ws_job_locks
                SET lease_expires_at = NOW() - INTERVAL '1 second'
                WHERE job_id = %s
                """,
                (job_id,),
            )
            conn.commit()

    def test_active_dedup_includes_cancellation(self) -> None:
        first = self.enqueue("same-artifact")
        duplicate = self.enqueue("same-artifact")
        self.assertTrue(duplicate["deduplicated"])
        self.assertEqual(first["job_id"], duplicate["job_id"])

        claimed = self.service.claim("worker-a", worker_pool=self.pool)
        self.assertIsNotNone(claimed)
        self.assertEqual(
            self.service.request_cancel(first["job_id"], requested_by="test"),
            "cancel_requested",
        )
        cancelling_duplicate = self.enqueue("same-artifact")
        self.assertEqual(first["job_id"], cancelling_duplicate["job_id"])

        self.assertTrue(
            self.service.finalize_cancel(
                first["job_id"],
                "worker-a",
                int(claimed["fence"]),
            )
        )
        replacement = self.enqueue("same-artifact")
        self.assertNotEqual(first["job_id"], replacement["job_id"])

    def test_resource_slots_and_reclaim_reject_stale_fence(self) -> None:
        self.service.configure_resource_slots({self.resource: 1})
        first = self.enqueue("first", resources={self.resource: 1})
        second = self.enqueue("second", resources={self.resource: 1})
        claim_a = self.service.claim("worker-a", worker_pool=self.pool)
        self.assertEqual(first["job_id"], claim_a["job_id"])
        self.assertIsNone(self.service.claim("worker-b", worker_pool=self.pool))

        self.expire(first["job_id"])
        claim_b = self.service.claim("worker-b", worker_pool=self.pool)
        self.assertEqual(first["job_id"], claim_b["job_id"])
        self.assertGreater(int(claim_b["fence"]), int(claim_a["fence"]))
        self.assertFalse(
            self.service.progress(
                first["job_id"],
                "worker-a",
                int(claim_a["fence"]),
                stage="stale",
            )
        )
        self.assertTrue(
            self.service.complete(
                first["job_id"],
                "worker-b",
                int(claim_b["fence"]),
            )
        )
        claim_second = self.service.claim("worker-c", worker_pool=self.pool)
        self.assertEqual(second["job_id"], claim_second["job_id"])

    def test_repository_readers_coexist_and_writer_waits(self) -> None:
        lock_key = f"repo:{self.suffix}"
        reader_one = self.enqueue(
            "reader-one",
            locks=[{"key": lock_key, "mode": "read"}],
        )
        reader_two = self.enqueue(
            "reader-two",
            locks=[{"key": lock_key, "mode": "read"}],
        )
        writer = self.enqueue(
            "writer",
            locks=[{"key": lock_key, "mode": "write"}],
        )

        first_claim = self.service.claim("reader-a", worker_pool=self.pool)
        second_claim = self.service.claim("reader-b", worker_pool=self.pool)
        self.assertEqual(reader_one["job_id"], first_claim["job_id"])
        self.assertEqual(reader_two["job_id"], second_claim["job_id"])
        self.assertIsNone(self.service.claim("writer-a", worker_pool=self.pool))

        self.service.complete(
            reader_one["job_id"],
            "reader-a",
            int(first_claim["fence"]),
        )
        self.assertIsNone(self.service.claim("writer-a", worker_pool=self.pool))
        self.service.complete(
            reader_two["job_id"],
            "reader-b",
            int(second_claim["fence"]),
        )
        writer_claim = self.service.claim("writer-a", worker_pool=self.pool)
        self.assertEqual(writer["job_id"], writer_claim["job_id"])

    def test_completed_artifact_short_circuits_enqueue_without_filesystem_io(self) -> None:
        first = self.enqueue("cached-artifact")
        claim = self.service.claim("worker-a", worker_pool=self.pool)
        artifact = {
            "kind": self.kind,
            "artifact_key": "cached-artifact",
            "digest": "a" * 64,
            "object_path": "/not-read-by-enqueue/result.json",
            "media_type": "application/json",
            "size_bytes": 42,
            "schema_version": "test-v1",
            "generator_version": "test",
            "readiness": "ready",
        }
        self.assertTrue(
            self.service.complete_artifact(
                first["job_id"],
                "worker-a",
                int(claim["fence"]),
                artifact,
            )
        )
        cached = self.enqueue("cached-artifact")
        self.assertTrue(cached["cache_hit"])
        self.assertEqual(first["job_id"], cached["job_id"])
        resolved = self.service.get_artifact_for_job(first["job_id"], touch=False)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved["digest"], "a" * 64)

    def test_cache_hit_updates_artifact_access_time(self) -> None:
        first = self.enqueue("cache-touch")
        claim = self.service.claim("worker-a", worker_pool=self.pool)
        artifact = {
            "kind": self.kind,
            "artifact_key": "cache-touch",
            "digest": "b" * 64,
            "object_path": "/not-read-by-enqueue/touch.json",
            "media_type": "application/json",
            "size_bytes": 1,
            "schema_version": "test-v1",
            "generator_version": "test",
            "readiness": "ready",
        }
        self.assertTrue(
            self.service.complete_artifact(
                first["job_id"],
                "worker-a",
                int(claim["fence"]),
                artifact,
            )
        )
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            conn.execute(
                """
                UPDATE ws_artifacts
                SET last_accessed_at = NOW() - INTERVAL '1 day'
                WHERE kind = %s AND artifact_key = %s
                """,
                (self.kind, "cache-touch"),
            )
            before = conn.execute(
                """
                SELECT last_accessed_at FROM ws_artifacts
                WHERE kind = %s AND artifact_key = %s
                """,
                (self.kind, "cache-touch"),
            ).fetchone()["last_accessed_at"]
            conn.commit()

        cached = self.enqueue("cache-touch")
        self.assertTrue(cached["cache_hit"])
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            after = conn.execute(
                """
                SELECT last_accessed_at FROM ws_artifacts
                WHERE kind = %s AND artifact_key = %s
                """,
                (self.kind, "cache-touch"),
            ).fetchone()["last_accessed_at"]
        self.assertGreater(after, before)

    def test_completed_sidecars_share_the_authoritative_fence(self) -> None:
        queued = self.enqueue("sidecar-bundle")
        claim = self.service.claim("worker-a", worker_pool=self.pool)
        primary = {
            "kind": self.kind,
            "artifact_key": "sidecar-bundle",
            "digest": "d" * 64,
            "object_path": "/not-read-by-test/manifest.json",
            "media_type": "application/json",
            "size_bytes": 2,
            "schema_version": "bundle-v1",
            "generator_version": "test",
            "readiness": "ready",
        }
        sidecar = {
            "kind": "design_compare_sidecar",
            "artifact_key": "sidecar-bundle:sidecar:schematic",
            "digest": "e" * 64,
            "object_path": "/not-read-by-test/schematic.json",
            "media_type": "application/json",
            "size_bytes": 4,
            "schema_version": "result-v3",
            "generator_version": "test",
            "readiness": "sidecar",
        }

        self.assertTrue(
            self.service.complete_artifact(
                queued["job_id"],
                "worker-a",
                int(claim["fence"]),
                primary,
                extra_artifacts=[sidecar],
            )
        )
        resolved_primary = self.service.get_artifact_for_job(
            queued["job_id"],
            touch=False,
        )
        resolved_sidecar = self.service.get_artifact_for_job_digest(
            queued["job_id"],
            "e" * 64,
            touch=False,
        )
        self.assertEqual(resolved_primary["digest"], "d" * 64)
        self.assertEqual(resolved_sidecar["kind"], "design_compare_sidecar")

    def test_webgpu_completion_publishes_o1_readiness_metadata(self) -> None:
        selector = f"commit:{self.suffix}"
        project_id = f"project-{self.suffix}"
        queued = self.service.enqueue(
            "webgpu_3d",
            {"test": True},
            worker_pool=self.pool,
            artifact_key=f"webgpu-{self.suffix}",
        )
        self.job_ids.append(str(queued["job_id"]))
        claim = self.service.claim("worker-a", worker_pool=self.pool)
        details = {
            "schema": "prism.webgpu_3d_status_a0",
            "project_id": project_id,
            "status_selector": selector,
            "source_fingerprint": "source-a",
            "sourceRevisionKey": "source-a",
            "build_fingerprint": "build-a",
            "bundle_url": "/bundle.json",
            "status": "ready",
            "available": True,
        }
        artifact = {
            "kind": "webgpu_3d",
            "artifact_key": f"webgpu-{self.suffix}",
            "digest": "c" * 64,
            "object_path": "/not-read-by-status/bundle.json",
            "media_type": "application/json",
            "size_bytes": 1,
            "schema_version": "test-v1",
            "generator_version": "build-a",
            "readiness": "ready",
        }

        self.assertTrue(
            self.service.complete_artifact(
                queued["job_id"],
                "worker-a",
                int(claim["fence"]),
                artifact,
                details=details,
            )
        )
        ready = self.service.get_webgpu_ready(project_id, selector, "build-a")
        self.assertEqual(ready["sourceRevisionKey"], "source-a")
        self.assertTrue(ready["available"])


if __name__ == "__main__":
    unittest.main()
