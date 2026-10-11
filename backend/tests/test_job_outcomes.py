"""How a job's end settles the feature rows that track it."""

from __future__ import annotations

import os
import unittest
import uuid
from typing import Any


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
