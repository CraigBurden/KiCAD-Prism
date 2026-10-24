from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import job_service
from app.services import kicad_jobset_service, project_service
from app.services.kicad_tools import ToolResult
from tests.kicad_tool_fakes import FakeTool


class ProjectServiceV3JobTests(unittest.TestCase):
    def test_thumbnail_url_is_content_versioned_when_digest_is_available(self) -> None:
        self.assertEqual(
            project_service.thumbnail_url_for_row(
                {
                    "id": "project 1",
                    "thumbnail_rel": "assets/thumbnail/thumb.webp",
                    "thumbnail_digest": "digest-a",
                }
            ),
            "/api/projects/project%201/thumbnail/digest-a",
        )
        self.assertEqual(
            project_service.thumbnail_url_for_row(
                {
                    "id": "project-1",
                    "thumbnail_rel": "assets/thumbnail/legacy.png",
                }
            ),
            "/api/projects/project-1/thumbnail",
        )

    def test_kicad_workflow_enqueue_uses_global_slot_and_repository_write_lock(
        self,
    ) -> None:
        with (
            mock.patch.object(
                project_service.workspace,
                "get_project_by_id",
                return_value={"id": "project-1", "repo_id": "repo-1"},
            ),
            mock.patch.object(
                job_service.jobs,
                "enqueue",
                return_value={"job_id": "job-workflow"},
            ) as enqueue,
        ):
            job_id = project_service.start_workflow_job(
                "project-1",
                "manufacturing",
                "designer@example.com",
            )

        self.assertEqual(job_id, "job-workflow")
        call = enqueue.call_args
        self.assertEqual(call.args[0], "kicad_workflow")
        self.assertEqual(call.args[1]["workflow_type"], "manufacturing")
        self.assertEqual(call.kwargs["resources"]["workflow"], 1)
        self.assertEqual(
            call.kwargs["locks"],
            [{"key": "repository:repo-1", "mode": "write"}],
        )
        self.assertEqual(call.kwargs["max_attempts"], 1)

    def test_kicad_workflow_handler_executes_jobset_without_api_thread(self) -> None:
        progress_updates: list[dict[str, object]] = []
        with tempfile.TemporaryDirectory() as temporary:
            project_root = Path(temporary)
            (project_root / "board.kicad_pro").write_text("", encoding="utf-8")
            jobset = project_root / "Outputs.kicad_jobset"
            jobset.write_text("{}", encoding="utf-8")
            context = SimpleNamespace(
                payload={
                    "project_id": "project-1",
                    "workflow_type": "design",
                    "author": "designer@example.com",
                },
                check_cancelled=mock.Mock(),
                progress=lambda **values: progress_updates.append(values),
            )
            project = SimpleNamespace(path=str(project_root))
            tool = FakeTool(lambda args, **_: ToolResult(0, "first line\nsecond line\n"))
            repository = mock.Mock()
            repository.is_dirty.return_value = False

            with (
                mock.patch.object(
                    project_service.workspace,
                    "get_project_by_id",
                    return_value={"id": "project-1"},
                ),
                mock.patch.object(
                    project_service,
                    "_workspace_row_to_project",
                    return_value=project,
                ),
                mock.patch.object(
                    project_service.path_config_service,
                    "get_path_config",
                    return_value=SimpleNamespace(jobset="Outputs.kicad_jobset"),
                ),
                mock.patch.object(
                    project_service.path_config_service,
                    "resolve_paths",
                    return_value=SimpleNamespace(jobset_path=str(jobset)),
                ),
                mock.patch.object(kicad_jobset_service, "kicad_cli", return_value=tool),
                mock.patch.object(project_service, "Repo", return_value=repository),
            ):
                result = project_service.run_kicad_workflow_job_v3(context)

        self.assertEqual(result.message, "Workflow completed successfully")
        self.assertEqual(result.details["workflow_type"], "design")
        self.assertEqual(progress_updates[-1]["stage"], "git-sync")
        command = tool.calls[0]["args"]
        self.assertEqual(command[0:2], ["jobset", "run"])
        self.assertIn("28dab1d3-7bf2-4d8a-9723-bcdd14e1d814", command)
        repository.git.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
