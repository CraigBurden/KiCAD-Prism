from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

# Importing project_service first breaks the project_service <-> viewer_3d_jobs
# import cycle: project_service re-exports these names only once it is fully defined.
from app.services import project_service  # noqa: F401  (import-order anchor)
from app.services import semantic_visualizer_service, viewer_3d_jobs
from app.services.job_runtime import PreparedArtifact


class ProjectServiceV3JobTests(unittest.TestCase):
    def test_webgpu_adapter_uses_list_for_legacy_performance_events(self) -> None:
        progress_updates: list[dict[str, object]] = []
        with tempfile.TemporaryDirectory() as temporary:
            staging_dir = Path(temporary)
            context = SimpleNamespace(
                job_id="job-webgpu",
                fence=1,
                payload={
                    "project_id": "project-1",
                    "commit": "abc123",
                    "force": False,
                    "artifact_key": "artifact-key",
                },
                staging_dir=staging_dir,
                check_cancelled=mock.Mock(),
                progress=lambda **values: progress_updates.append(values),
            )
            project = SimpleNamespace(id="project-1")

            def build_for_commit(
                _project: object,
                _commit: str,
                state: dict[str, object],
                persist: object,
                *,
                force: bool,
            ) -> dict[str, object]:
                self.assertIsInstance(state["performance"], list)
                performance = state["performance"]
                assert isinstance(performance, list)
                performance.append({"stage": "compiler.subprocess", "elapsed_ms": 12.5})
                state["stage"] = "compile-assets"
                state["message"] = "Compiling"
                state["percent"] = 55
                state["bundle_url"] = "/api/projects/project-1/webgpu-3d/manifest/source/build"
                state["readiness"] = {
                    "schema": "prism.visualizer_readiness.a0",
                    "stage": "board-ready",
                    "progress": 35,
                    "available_assets": ["board"],
                    "revision": "rev-board",
                }
                state["readiness_stage"] = "board-ready"
                state["sourceRevisionKey"] = "source"
                state["source_fingerprint"] = "source"
                assert callable(persist)
                persist()
                return {
                    "source_fingerprint": "source",
                    "build_fingerprint": "build",
                    "schema": "schema-a0",
                }

            bundle_path = staging_dir / "source-bundle.json"
            bundle_path.write_text('{"schema":"bundle"}', encoding="utf-8")
            prepared = PreparedArtifact(
                kind="webgpu_3d",
                artifact_key="artifact-key",
                digest="digest",
                object_path="/objects/digest",
                size_bytes=bundle_path.stat().st_size,
            )

            with (
                mock.patch.object(
                    viewer_3d_jobs.workspace,
                    "get_project_by_id",
                    return_value={"id": "project-1", "last_modified": "rev-1"},
                ),
                mock.patch.object(
                    viewer_3d_jobs,
                    "_workspace_row_to_project",
                    return_value=project,
                ),
                mock.patch.object(
                    semantic_visualizer_service,
                    "build_visualizer_bundle_for_commit",
                    side_effect=build_for_commit,
                ),
                mock.patch.object(
                    semantic_visualizer_service,
                    "bundle_path",
                    return_value=bundle_path,
                ),
                mock.patch.object(
                    viewer_3d_jobs.job_artifacts,
                    "prepare_file",
                    return_value=prepared,
                ),
                mock.patch.object(
                    semantic_visualizer_service,
                    "sync_staged_webgpu_status",
                    mock.Mock(),
                ) as sync_staged,
            ):
                result = viewer_3d_jobs.run_webgpu_3d_job_v3(context)

        sync_staged.assert_called()
        payload_update = progress_updates[-1].get("payload_updates") or {}
        self.assertIn("bundle_url", payload_update)
        self.assertEqual(payload_update.get("readiness_stage"), "board-ready")

        self.assertEqual(
            result.details["performance"],
            [{"stage": "compiler.subprocess", "elapsed_ms": 12.5}],
        )
        self.assertEqual(result.artifact, prepared)
        self.assertEqual(progress_updates[-1]["stage"], "compile-assets")
        self.assertEqual(progress_updates[-1]["percent"], 55.0)


if __name__ == "__main__":
    unittest.main()
