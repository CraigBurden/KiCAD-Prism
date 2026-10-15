"""``/api/projects/{id}/catalog-usage`` authorization and error mapping (issue #698)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import project_catalog_usage as api  # noqa: E402
from app.core.errors import NotFound  # noqa: E402
from app.core.security import AuthenticatedUser  # noqa: E402
from app.services import project_revision  # noqa: E402

DESIGNER = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
VIEWER = AuthenticatedUser(email="viewer@example.com", name="Viewer", role="viewer")


class CatalogUsageApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_viewer_reads_but_may_not_queue_a_scan(self) -> None:
        with (
            patch("app.api._helpers.workspace.get_project_for_role", return_value={"id": "p1"}),
            patch.object(api.project_catalog_usage_service, "report", return_value={"items": []}) as report,
            patch.object(api.project_catalog_usage_service, "start_scan") as start,
        ):
            self.assertEqual(await api.get_catalog_usage("p1", commit=None, user=VIEWER), {"items": []})
            with self.assertRaises(HTTPException) as refused:
                await api.scan_catalog_usage("p1", None, user=VIEWER)
        self.assertEqual(refused.exception.status_code, 403)
        report.assert_called_once_with("p1", "")
        start.assert_not_called()

    async def test_a_designer_queues_a_forced_scan_as_themselves(self) -> None:
        with (
            patch("app.api._helpers.workspace.get_project_for_role", return_value={"id": "p1"}),
            patch.object(api.project_catalog_usage_service, "start_scan",
                         return_value={"job_id": "job-1", "status": "queued"}) as start,
        ):
            result = await api.scan_catalog_usage("p1", api.ScanRequest(commit="abc"), user=DESIGNER)
        self.assertEqual(result, {"job_id": "job-1", "status": "queued"})
        start.assert_called_once_with("p1", "abc", requested_by="designer@example.com", force=True)

    async def test_a_hidden_project_is_not_found_and_an_unknown_commit_is_typed(self) -> None:
        with patch("app.api._helpers.workspace.get_project_for_role", return_value=None):
            with self.assertRaises(HTTPException) as hidden:
                await api.get_catalog_usage("p1", commit=None, user=DESIGNER)
        self.assertEqual(hidden.exception.status_code, 404)
        with (
            patch("app.api._helpers.workspace.get_project_for_role", return_value={"id": "p1"}),
            patch.object(api.project_catalog_usage_service, "report",
                         side_effect=project_revision.RevisionNotFound("nope")),
        ):
            with self.assertRaises(NotFound) as missing:
                await api.get_catalog_usage("p1", commit="nope", user=DESIGNER)
        self.assertEqual(missing.exception.code, "commit_not_found")


if __name__ == "__main__":
    unittest.main()
