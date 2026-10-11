from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

from app.services import catalog_worker_tasks
from app.services.catalog.conflicts import ASSET_REFERENCED_CODE, CatalogConflict
from app.services.catalog_job_service import CatalogJobService
from app.services.job_runtime import (
    CHECKPOINT_KEY,
    PARTIAL_RESULT_KEY,
    JobCancelled,
    LostJobLease,
    PermanentJobError,
    PreparedArtifact,
    RetryableJobError,
)
from tests.in_memory_jobs import InMemoryJobService, claimed_context


class CatalogV3JobTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.jobs = InMemoryJobService()

    def _context(self, kind: str, payload: dict[str, Any], *, artifact_key: str = "") -> Any:
        return claimed_context(
            self.jobs,
            kind,
            payload,
            state_root=self.root,
            worker_pool="catalog",
            artifact_key=artifact_key,
            requested_by="qa@example.com",
        )

    def _run(self, context: Any, handlers: dict[str, Any] | None = None) -> Any:
        with (
            mock.patch.dict(catalog_worker_tasks.HANDLERS, handlers or {}),
            mock.patch.object(catalog_worker_tasks.catalog_service, "initialize"),
            mock.patch.object(catalog_worker_tasks.artifact_store, "initialize"),
        ):
            return catalog_worker_tasks.run_catalog_job_v3(context)

    def test_catalog_enqueue_uses_the_catalog_pool_and_heavy_slot(self) -> None:
        with mock.patch("app.services.job_service.jobs", self.jobs):
            result = CatalogJobService().enqueue(
                "catalog_validation",
                {"component_ids": ["component-1"]},
                created_by="qa@example.com",
                idempotency_key="validation:component-1",
            )

        row = self.jobs.rows[result["id"]]
        self.assertEqual(row["worker_pool"], "catalog")
        self.assertEqual(row["resource_requirements"], {"catalog_worker": 1, "catalog_kicad": 1})
        self.assertEqual(row["artifact_key"], "validation:component-1")
        self.assertEqual(row["payload"], {"component_ids": ["component-1"]})
        self.assertEqual(result["payload"]["component_ids"], ["component-1"])
        self.assertEqual(result["created_by"], "qa@example.com")
        self.assertEqual((result["checkpoint"], result["result"]), ({}, {}))

    def test_light_catalog_kinds_take_only_the_catalog_slot(self) -> None:
        with mock.patch("app.services.job_service.jobs", self.jobs):
            result = CatalogJobService().enqueue("catalog_model_glb", {"componentId": "c"})
        self.assertEqual(self.jobs.rows[result["id"]]["resource_requirements"], {"catalog_worker": 1})

    def test_catalog_handler_persists_checkpoint_and_publishes_result(self) -> None:
        context = self._context("test_catalog_handler", {"value": 7}, artifact_key="catalog-key")
        prepared = PreparedArtifact(
            kind="test_catalog_handler",
            artifact_key="catalog-key",
            digest="digest",
            object_path="/objects/digest",
            size_bytes=12,
        )

        def handler(job_context: Any) -> dict:
            self.assertEqual(job_context.payload, {"value": 7})
            job_context.save_checkpoint(
                stage="catalog", percent=50, message="Halfway",
                checkpoint={"index": 1}, result={"processed": 1},
            )
            return {"processed": 2}

        with mock.patch.object(
            catalog_worker_tasks.job_artifacts, "prepare_json", return_value=prepared
        ) as prepare:
            result = self._run(context, {"test_catalog_handler": handler})

        self.assertEqual(result.artifact, prepared)
        self.assertEqual(result.details["processed"], 2)
        stored = self.jobs.rows[context.job_id]["payload"]
        self.assertEqual(stored[CHECKPOINT_KEY], {"index": 1})
        self.assertEqual(stored[PARTIAL_RESULT_KEY], {"processed": 1})
        prepare.assert_called_once()

        decoded = CatalogJobService()._decode(self.jobs.get(context.job_id))
        self.assertEqual(decoded["payload"], {"value": 7})
        self.assertEqual(decoded["checkpoint"], {"index": 1})
        self.assertEqual(decoded["result"]["processed"], 1)

    def test_a_job_queued_with_the_old_envelope_still_runs(self) -> None:
        context = self._context(
            "test_catalog_handler",
            {
                "catalog_payload": {"value": 7},
                "catalog_checkpoint": {"index": 3},
                "catalog_result": {"processed": 3},
                "created_by": "qa@example.com",
                "catalog_artifact_key": "",
            },
        )
        seen: dict[str, Any] = {}

        def handler(job_context: Any) -> dict:
            seen.update(payload=job_context.payload, checkpoint=job_context.checkpoint)
            return {}

        result = self._run(context, {"test_catalog_handler": handler})
        self.assertEqual(seen, {"payload": {"value": 7}, "checkpoint": {"index": 3}})
        self.assertEqual(result.details, {"processed": 3})
        decoded = CatalogJobService()._decode(self.jobs.get(context.job_id))
        self.assertEqual(decoded["payload"], {"value": 7})

    def test_catalog_handler_errors_remain_retryable(self) -> None:
        def fail(_context: Any) -> dict:
            raise RuntimeError("transient compiler failure")

        context = self._context("test_catalog_failure", {})
        with self.assertRaisesRegex(RetryableJobError, "transient compiler failure") as raised:
            self._run(context, {"test_catalog_failure": fail})
        self.assertEqual(raised.exception.code, "catalog_job_failed")

    def test_catalog_conflicts_fail_permanently_with_their_code(self) -> None:
        def fail(_context: Any) -> dict:
            raise CatalogConflict("still attached", code=ASSET_REFERENCED_CODE)

        context = self._context("test_catalog_conflict", {})
        with self.assertRaisesRegex(PermanentJobError, "still attached") as raised:
            self._run(context, {"test_catalog_conflict": fail})
        self.assertEqual(raised.exception.code, ASSET_REFERENCED_CODE)

    def test_metadata_input_errors_fail_permanently_without_retry(self) -> None:
        context = self._context("catalog_metadata_batch", {"batch_id": "batch-1", "item_ids": ["item-1"]})
        apply = mock.Mock(side_effect=ValueError("Metadata batch item is not valid"))
        with mock.patch.object(catalog_worker_tasks.catalog_service, "apply_metadata_batch", apply):
            with self.assertRaisesRegex(PermanentJobError, "Metadata batch item is not valid") as raised:
                self._run(context)
        self.assertEqual(raised.exception.code, "catalog_invalid_input")
        apply.assert_called_once()

    def test_cancellation_and_lost_leases_are_not_reclassified(self) -> None:
        for error in (JobCancelled("stop"), LostJobLease("gone")):
            with self.subTest(error=type(error).__name__):
                def fail(_context: Any, captured: Exception = error) -> dict:
                    raise captured

                context = self._context("test_catalog_control", {})
                with self.assertRaises(type(error)):
                    self._run(context, {"test_catalog_control": fail})

    def test_unsupported_catalog_job_fails_permanently(self) -> None:
        context = self._context("not-a-catalog-job", {})
        with self.assertRaisesRegex(PermanentJobError, "Unsupported catalog job type") as raised:
            catalog_worker_tasks.run_catalog_job_v3(context)
        self.assertEqual(raised.exception.code, "unsupported_catalog_job")


if __name__ == "__main__":
    unittest.main()
