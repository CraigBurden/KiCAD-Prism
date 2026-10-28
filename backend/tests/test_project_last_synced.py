"""Projects report when their repository was last synced (#404)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api._helpers import _row_to_project  # noqa: E402
from app.services import project_service  # noqa: E402


ROW = {
    "id": "prj_1",
    "name": "board",
    "path": "/projects/board",
    "relative_path": ".",
    "registered_at": "2026-09-11T08:34:47+00:00",
    "last_modified": "2026-09-11T08:34:47+00:00",
    "repo_last_synced": "2026-09-25T21:20:28+00:00",
}


class ProjectLastSyncedTests(unittest.TestCase):
    def test_api_project_carries_repository_sync_time(self) -> None:
        project = _row_to_project(ROW)
        self.assertEqual(project.last_synced_at, "2026-09-25T21:20:28+00:00")
        # last_modified keys workspace caches, so syncing must not rewrite it.
        self.assertEqual(project.last_modified, "2026-09-11T08:34:47+00:00")

    def test_service_project_carries_repository_sync_time(self) -> None:
        project = project_service._workspace_row_to_project(ROW)
        self.assertEqual(project.last_synced_at, "2026-09-25T21:20:28+00:00")

    def test_never_synced_repository_has_no_sync_time(self) -> None:
        row = {key: value for key, value in ROW.items() if key != "repo_last_synced"}
        self.assertIsNone(_row_to_project(row).last_synced_at)


if __name__ == "__main__":
    unittest.main()
