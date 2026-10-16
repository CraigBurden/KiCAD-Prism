from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

# Importing project_service first breaks the project_service <-> semantic_index_jobs
# import cycle: project_service re-exports these names only once it is fully defined.
from app.services import project_service  # noqa: F401  (import-order anchor)
from app.services import job_service, semantic_index_jobs
from app.services.job_runtime import PreparedArtifact


class ProjectServiceV3JobTests(unittest.TestCase):
    def test_semantic_index_enqueue_uses_compile_slot_and_read_lock(self) -> None:
        with (
            mock.patch.object(
                semantic_index_jobs.workspace,
                "get_project_by_id",
                return_value={
                    "id": "project-1",
                    "repo_id": "repo-1",
                    "last_modified": "revision",
                },
            ),
            mock.patch.object(
                job_service.jobs,
                "enqueue",
                return_value={"job_id": "job-semantic"},
            ) as enqueue,
        ):
            job_id = semantic_index_jobs.start_semantic_index_job(
                "project-1",
                commit="abc123",
                requested_by="designer@example.com",
            )

        self.assertEqual(job_id, "job-semantic")
        call = enqueue.call_args
        self.assertEqual(call.args[0], "semantic_index")
        self.assertEqual(call.kwargs["resources"]["semantic_compile"], 1)
        self.assertEqual(
            call.kwargs["locks"],
            [{"key": "repository:repo-1", "mode": "read"}],
        )

    def test_semantic_index_handler_publishes_immutable_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            context = SimpleNamespace(
                payload={
                    "project_id": "project-1",
                    "commit": "abc123",
                    "force": False,
                    "artifact_key": "semantic-key",
                },
                staging_dir=Path(temporary),
                check_cancelled=mock.Mock(),
                progress=mock.Mock(),
            )
            project = SimpleNamespace(id="project-1")
            prepared = PreparedArtifact(
                kind="semantic_index",
                artifact_key="semantic-key",
                digest="digest",
                object_path="/objects/digest",
                size_bytes=10,
            )
            with (
                mock.patch.object(
                    semantic_index_jobs.workspace,
                    "get_project_by_id",
                    return_value={"id": "project-1"},
                ),
                mock.patch.object(
                    semantic_index_jobs,
                    "_workspace_row_to_project",
                    return_value=project,
                ),
                mock.patch.object(
                    semantic_index_jobs.semantic_index_service,
                    "generate",
                    return_value={
                        "schema": "semantic-a0",
                        "sourceRevisionKey": "source",
                        "generator": {"build": "build"},
                    },
                ),
                mock.patch.object(
                    semantic_index_jobs.job_artifacts,
                    "prepare_json",
                    return_value=prepared,
                ) as prepare,
            ):
                result = semantic_index_jobs.run_semantic_index_job_v3(context)

        self.assertEqual(result.artifact, prepared)
        self.assertTrue(result.details["available"])
        prepare.assert_called_once()

    def test_semantic_handler_rejects_an_anchor_changed_after_enqueue(self) -> None:
        context = SimpleNamespace(
            payload={
                "project_id": "project-1",
                "project_file_rel": "top.kicad_pro",
                "artifact_key": "semantic-key",
            }
        )
        with mock.patch.object(
            semantic_index_jobs.workspace,
            "get_project_by_id",
            return_value={
                "id": "project-1",
                "project_file_rel": "base.kicad_pro",
            },
        ):
            with self.assertRaisesRegex(RuntimeError, "anchor changed"):
                semantic_index_jobs.run_semantic_index_job_v3(context)


if __name__ == "__main__":
    unittest.main()
