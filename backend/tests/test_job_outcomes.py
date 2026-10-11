"""How a job's end settles the feature rows that track it.

Design comparisons and release builds keep their own state next to the job
row. These tests stage failures through the real runner
(``tests.in_memory_jobs``) and check that the feature rows end where the job
ended.
"""

from __future__ import annotations

import copy
import json
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from typing import Any
from unittest import mock

from app.services.job_artifact_service import JobArtifactService
from tests.in_memory_jobs import InMemoryJobService, run_attempt

WORKER_A = "prism:host-a:1:aaaa"


class DesignCompareOutcomeTests(unittest.TestCase):
    INITIAL = {
        "schema": "prism.design_compare_v3",
        "readiness": {
            "stage": "initial-ready",
            "domains": {
                "schematic": "ready",
                "bom": "ready",
                "pcb": "building",
                "stackup": "building",
                "fabrication": "building",
            },
        },
        "schematic": {"changes": [{"id": "schematic-change"}]},
        "pcb": {"changes": []},
        "bom": {"changes": [{"ref": "R1"}]},
    }

    def test_a_pcb_stage_failure_marks_the_late_domains_failed(self) -> None:
        from app.services import design_compare_service as service
        from app.services import project_revision

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        jobs = InMemoryJobService()
        job_id = jobs.enqueue(
            "design_compare",
            {"project_id": "project", "base": "base", "head": "head", "artifact_key": "k"},
        )["job_id"]
        jobs.claim(WORKER_A, worker_pool="prism")
        with (
            mock.patch.object(service, "job_artifacts", JobArtifactService(root=root / "jobs")),
            mock.patch.object(service, "job_state_root", return_value=root / "jobs"),
            mock.patch.object(service, "v3_jobs", jobs),
            mock.patch.object(service, "_project_anchor", return_value=""),
            mock.patch.object(
                service.project_revision,
                "locate_id",
                return_value=project_revision.ProjectLocation(Path("/repo"), ""),
            ),
            mock.patch.object(service, "_resolve_revision", side_effect=lambda _repo, rev: rev),
            mock.patch.object(service, "_prepare_comparison_snapshots"),
            mock.patch.object(
                service,
                "_build_initial_revisions",
                return_value=({"base": {}, "head": {}}, {"base": [], "head": []}),
            ),
            mock.patch.object(
                service,
                "_run_ecad_object_delta",
                return_value={"changes": [], "base": {}, "head": {}},
            ),
            mock.patch.object(
                service,
                "_assemble_initial_comparison",
                return_value=(copy.deepcopy(self.INITIAL), {"schematic_changes": []}),
            ),
            mock.patch.object(
                service, "_build_pcb_revisions", side_effect=RuntimeError("PCB worker failed")
            ),
        ):
            run_attempt(jobs, job_id, WORKER_A, service.run_design_compare_job_v3, state_root=root / "jobs")

        row = jobs.rows[job_id]
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["result_metadata"]["result_version"], 2)
        published = json.loads(Path(row["result_path"]).read_text(encoding="utf-8"))
        self.assertEqual(published["readiness"]["stage"], "background-failed")
        self.assertEqual(
            published["readiness"]["domains"],
            {
                "schematic": "ready",
                "bom": "ready",
                "pcb": "failed",
                "stackup": "failed",
                "fabrication": "failed",
            },
        )
        self.assertEqual(published["schematic"], self.INITIAL["schematic"])


@unittest.skipUnless(os.environ.get("PRISM_DATABASE_URL"), "PRISM_DATABASE_URL is required")
class ReleaseBuildRowFencingTests(unittest.TestCase):
    """A stale attempt must not move the candidate a newer attempt is building."""

    def setUp(self) -> None:
        from app.services import release_studio_service as store
        from app.services.job_service import jobs
        from app.services.postgres_database import database

        jobs.initialize()
        store.initialize()
        self.store = store
        self.database = database
        suffix = uuid.uuid4().hex[:12]
        self.project_id = f"prj_{suffix}"
        self.repo_id = f"repo_{suffix}"
        with database.connection() as conn:
            conn.execute("SET search_path TO workspace, public")
            conn.execute(
                "INSERT INTO ws_repositories (id, name, url, clone_path, cloned_at)"
                " VALUES (%s, %s, %s, %s, NOW())",
                (self.repo_id, self.repo_id, f"https://example.invalid/{self.repo_id}.git", f"/nonexistent/{self.repo_id}"),
            )
            conn.execute(
                "INSERT INTO ws_projects (id, repo_id, name, registered_at, last_modified)"
                " VALUES (%s, %s, %s, NOW(), NOW())",
                (self.project_id, self.repo_id, self.project_id),
            )
            conn.commit()
        # Rows stay: the audit chain is append-only, and each xdist worker has its own database.

    def _candidate_status(self, candidate_id: str) -> str:
        return str(self.store.get_candidate(candidate_id)["status"])

    def _two_attempts(self) -> tuple[dict[str, Any], dict[str, Any]]:
        first = self.store.record_prepare_failure(
            project_id=self.project_id,
            repository_id=self.repo_id,
            config_key="release",
            commit_sha="a" * 40,
            variant="",
            job_id=None,
            fence=1,
            author="a@example.com",
            error="",
        )
        second = self.store.start_build(first["candidate_id"], job_id=None, fence=2)
        return first, second

    def test_a_stale_attempt_failing_leaves_the_candidate_building(self) -> None:
        first, second = self._two_attempts()
        self.store.fail_build(first["id"], error_code="build_failed", error_message="lease lost")
        self.assertEqual(self.store.get_build(first["id"])["status"], "failed")
        self.assertEqual(self._candidate_status(first["candidate_id"]), "building")

    def test_a_stale_attempt_cancelling_leaves_the_candidate_building(self) -> None:
        first, second = self._two_attempts()
        self.store.cancel_build(first["id"], message="Cancelled")
        self.assertEqual(self._candidate_status(first["candidate_id"]), "building")

    def test_the_latest_attempt_still_settles_the_candidate(self) -> None:
        first, second = self._two_attempts()
        self.store.fail_build(second["id"], error_code="build_failed", error_message="boom")
        self.assertEqual(self._candidate_status(first["candidate_id"]), "failed")


if __name__ == "__main__":
    unittest.main()
