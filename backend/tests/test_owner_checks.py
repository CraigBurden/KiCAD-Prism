"""Owner-or-admin checks compare the caller's identity one way.

Catalog sessions, snapshots and jobs compared ``created_by`` to the caller's
email exactly, metadata batches with ``casefold`` and agent tokens with
``lower``; a job with no requester was readable by every viewer. The
benchmark-metrics route skipped the admin dependency's scope check.
"""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.api import agent, catalog_admin, jobs
from app.core.security import AuthenticatedUser, require_admin


DESIGNER = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
OTHER = AuthenticatedUser(email="other@example.com", name="Other", role="designer")
VIEWER = AuthenticatedUser(email="viewer@example.com", name="Viewer", role="viewer")
ADMIN = AuthenticatedUser(email="admin@example.com", name="Admin", role="admin")


class CatalogOwnerTests(unittest.TestCase):
    def test_owner_match_ignores_email_case(self) -> None:
        job = {"id": "job-1", "created_by": "Designer@Example.COM"}
        session = {"id": "session-1", "created_by": "Designer@Example.COM"}
        with patch.object(catalog_admin.catalog_jobs, "get", return_value=job), patch.object(
            catalog_admin.catalog_jobs, "events", return_value=[]
        ), patch.object(catalog_admin.catalog_service, "get_project_import_session", return_value=session):
            self.assertEqual(catalog_admin.get_catalog_job("job-1", DESIGNER)["id"], "job-1")
            self.assertEqual(catalog_admin.get_project_import_session("session-1", DESIGNER)["id"], "session-1")

    def test_other_users_are_refused_and_admin_is_not(self) -> None:
        job = {"id": "job-1", "created_by": "designer@example.com"}
        with patch.object(catalog_admin.catalog_jobs, "get", return_value=job), patch.object(
            catalog_admin.catalog_jobs, "events", return_value=[]
        ):
            with self.assertRaises(HTTPException) as ctx:
                catalog_admin.get_catalog_job("job-1", OTHER)
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertEqual(catalog_admin.get_catalog_job("job-1", ADMIN)["id"], "job-1")

    def test_ownerless_record_belongs_to_nobody(self) -> None:
        job = {"id": "job-1", "created_by": ""}
        with patch.object(catalog_admin.catalog_jobs, "get", return_value=job), patch.object(
            catalog_admin.catalog_jobs, "events", return_value=[]
        ):
            with self.assertRaises(HTTPException):
                catalog_admin.get_catalog_job("job-1", DESIGNER)


class AgentTokenOwnerTests(unittest.TestCase):
    def test_owner_revokes_own_token_whatever_the_case(self) -> None:
        user = AuthenticatedUser(email="Designer@Example.com", name="D", role="designer")
        with patch.object(
            agent.agent_auth_service, "get_agent_token", return_value={"email": "designer@example.com"}
        ), patch.object(agent.agent_auth_service, "revoke_agent_token_by_jti") as revoke:
            asyncio.run(agent.revoke_token("jti-1", user))
        revoke.assert_called_once_with("jti-1")


class JobRequesterTests(unittest.TestCase):
    def _get(self, job: dict, user: AuthenticatedUser):
        with patch.object(jobs.jobs, "get", return_value=job):
            return asyncio.run(jobs.get_job(job["job_id"], user))

    def test_job_without_requester_is_admin_only(self) -> None:
        job = {"job_id": "job-1", "worker_pool": "prism", "project_id": None, "requested_by": ""}
        with self.assertRaises(HTTPException) as ctx:
            self._get(job, DESIGNER)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(self._get(job, ADMIN)["job_id"], "job-1")

    def test_requester_match_ignores_email_case(self) -> None:
        job = {"job_id": "job-1", "worker_pool": "prism", "project_id": None, "requested_by": "DESIGNER@example.com"}
        self.assertEqual(self._get(job, DESIGNER)["job_id"], "job-1")

    def test_a_deduplicated_import_is_readable_by_a_second_designer(self) -> None:
        # D6: enqueue hands a second requester the first requester's job id.
        for kind in ("project_import", "project_analyze"):
            job = {"job_id": "job-1", "kind": kind, "worker_pool": "prism", "project_id": None,
                   "requested_by": "designer@example.com", "payload": {}}
            self.assertEqual(self._get(job, OTHER)["job_id"], "job-1")

    def test_an_import_stays_closed_to_roles_that_cannot_import(self) -> None:
        job = {"job_id": "job-1", "kind": "project_import", "worker_pool": "prism", "project_id": None,
               "requested_by": "designer@example.com", "payload": {}}
        with self.assertRaises(HTTPException) as ctx:
            self._get(job, VIEWER)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_benchmark_metrics_uses_the_admin_dependency(self) -> None:
        route = next(r for r in jobs.router.routes if getattr(r, "path", "") == "/benchmark-metrics")
        calls = [dependency.call for dependency in route.dependant.dependencies]
        self.assertIn(require_admin, calls)


if __name__ == "__main__":
    unittest.main()
