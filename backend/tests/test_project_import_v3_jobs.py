from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import project_import_service
from app.services.git_remote_url import RemoteUrlError


class ProjectImportV3JobTests(unittest.TestCase):
    def test_cached_thumbnail_metadata_uses_content_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            thumbnail_dir = root / "assets" / "thumbnail"
            thumbnail_dir.mkdir(parents=True)
            thumbnail = thumbnail_dir / "thumbnail.abc.webp"
            thumbnail.write_bytes(b"webp-payload")
            resolved = SimpleNamespace(
                schematic=None,
                pcb=None,
                thumbnail_dir=str(thumbnail_dir),
                jobset_path=None,
                design_outputs_dir=None,
            )
            with mock.patch.object(
                project_import_service.path_config_service,
                "resolve_paths",
                return_value=resolved,
            ):
                cached = project_import_service.resolve_cached_paths(str(root))

        self.assertEqual(
            cached["thumbnail_digest"],
            hashlib.sha256(b"webp-payload").hexdigest(),
        )
        self.assertEqual(cached["thumbnail_media_type"], "image/webp")
        self.assertEqual(cached["thumbnail_size_bytes"], len(b"webp-payload"))
        self.assertEqual(
            cached["thumbnail_rel"],
            "assets/thumbnail/thumbnail.abc.webp",
        )

    def test_sync_enqueue_uses_repository_write_lock(self) -> None:
        with (
            mock.patch.object(
                project_import_service.workspace,
                "get_project_by_id",
                return_value={"id": "project-1", "repo_id": "repo-1"},
            ),
            mock.patch.object(
                project_import_service.v3_jobs,
                "enqueue",
                return_value={"job_id": "job-sync"},
            ) as enqueue,
        ):
            job_id = project_import_service.start_sync_job(
                "project-1",
                requested_by="designer@example.com",
            )

        self.assertEqual(job_id, "job-sync")
        call = enqueue.call_args
        self.assertEqual(call.args[0], "project_sync")
        self.assertEqual(
            call.kwargs["locks"],
            [{"key": "repository:repo-1", "mode": "write"}],
        )

    def test_import_enqueue_uses_import_slot_and_repository_write_lock(self) -> None:
        with mock.patch.object(
            project_import_service.v3_jobs,
            "enqueue",
            return_value={"job_id": "job-import"},
        ) as enqueue:
            job_id = project_import_service.start_import_job(
                "https://example.com/boards.git",
                "type2",
                ["boards/a", "boards/b"],
            )

        self.assertEqual(job_id, "job-import")
        call = enqueue.call_args
        self.assertEqual(call.args[0], "project_import")
        self.assertEqual(call.kwargs["resources"]["import"], 1)
        self.assertEqual(call.kwargs["locks"][0]["mode"], "write")
        self.assertEqual(call.kwargs["max_attempts"], 1)

    def test_analyze_handler_returns_legacy_compatible_result_shape(self) -> None:
        progress_updates: list[dict[str, object]] = []
        context = SimpleNamespace(
            payload={"repo_url": "https://example.com/boards.git"},
            check_cancelled=mock.Mock(),
            progress=lambda **values: progress_updates.append(values),
        )
        repository = mock.Mock()
        projects = [
            project_import_service.DiscoveredProject(
                name="board",
                relative_path=".",
                full_path="",
                has_schematic=True,
                has_pcb=True,
            )
        ]
        with (
            mock.patch.object(
                project_import_service.Repo,
                "clone_from",
                return_value=repository,
            ),
            mock.patch.object(
                project_import_service,
                "discover_projects_from_repo",
                return_value=projects,
            ),
        ):
            result = project_import_service.run_project_analyze_job_v3(context)

        self.assertEqual(result.details["result"]["import_type"], "type1")
        self.assertEqual(result.details["result"]["projects"][0]["name"], "board")
        self.assertEqual(progress_updates[-1]["stage"], "discover-projects")

    def test_import_handler_registers_type1_project_in_worker(self) -> None:
        progress_updates: list[dict[str, object]] = []
        with tempfile.TemporaryDirectory() as temporary:
            project_root = Path(temporary)
            context = SimpleNamespace(
                payload={
                    "repo_url": "https://example.com/boards.git",
                    "import_type": "type1",
                    "selected_paths": [],
                },
                check_cancelled=mock.Mock(),
                progress=lambda **values: progress_updates.append(values),
            )

            def clone(_url: str, target: str, **_kwargs: object) -> object:
                Path(target).mkdir(parents=True)
                return mock.Mock()

            discovered = [
                project_import_service.DiscoveredProject(
                    name="boards",
                    relative_path=".",
                    full_path="",
                    has_schematic=True,
                    has_pcb=True,
                )
            ]

            with (
                mock.patch.object(
                    project_import_service.project_service,
                    "PROJECTS_ROOT",
                    str(project_root),
                ),
                mock.patch.object(
                    project_import_service,
                    "find_existing_repository",
                    return_value=None,
                ),
                mock.patch.object(
                    project_import_service,
                    "discover_projects_from_repo",
                    return_value=discovered,
                ),
                mock.patch.object(
                    project_import_service.Repo,
                    "clone_from",
                    side_effect=clone,
                ),
                mock.patch.object(
                    project_import_service,
                    "generate_thumbnail_for_project",
                    return_value=False,
                ),
                mock.patch.object(
                    project_import_service,
                    "resolve_cached_paths",
                    return_value={"schematic_rel": "board.kicad_sch"},
                ),
                mock.patch.object(
                    project_import_service.workspace,
                    "register_repository",
                    return_value="repo-1",
                ) as register_repository,
                mock.patch.object(
                    project_import_service.workspace,
                    "register_project",
                    return_value="project-1",
                ) as register_project,
            ):
                result = project_import_service.run_project_import_job_v3(context)

        self.assertEqual(result.details["project_ids"], ["project-1"])
        register_repository.assert_called_once()
        register_project.assert_called_once()
        self.assertEqual(progress_updates[-1]["stage"], "register-projects")


class ImportHandlerReDerivesClientClaims(unittest.TestCase):
    """The import job trusts the repository, not the request body."""

    def _run(self, payload: dict[str, object], discovered: list[object]) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            context = SimpleNamespace(
                payload=payload,
                check_cancelled=mock.Mock(),
                progress=lambda **values: None,
            )

            def clone(_url: str, target: str, **_kwargs: object) -> object:
                Path(target).mkdir(parents=True, exist_ok=True)
                return mock.Mock()

            with (
                mock.patch.object(
                    project_import_service.project_service,
                    "PROJECTS_ROOT",
                    temporary,
                ),
                mock.patch.object(
                    project_import_service,
                    "find_existing_repository",
                    return_value=None,
                ),
                mock.patch.object(
                    project_import_service,
                    "discover_projects_from_repo",
                    return_value=discovered,
                ),
                mock.patch.object(
                    project_import_service.Repo, "clone_from", side_effect=clone
                ),
            ):
                project_import_service.run_project_import_job_v3(context)

    def test_rejects_selected_paths_that_are_not_discovered_projects(self) -> None:
        # A crafted request must not be able to register a directory outside the
        # checkout, or any directory that is not actually a KiCad project.
        discovered = [
            project_import_service.DiscoveredProject(
                name="board-a",
                relative_path="hardware/board-a",
                full_path="",
                has_schematic=True,
                has_pcb=True,
            ),
            project_import_service.DiscoveredProject(
                name="board-b",
                relative_path="hardware/board-b",
                full_path="",
                has_schematic=True,
                has_pcb=True,
            ),
        ]
        with self.assertRaises(ValueError) as caught:
            self._run(
                {
                    "repo_url": "https://example.com/boards.git",
                    "import_type": "type2",
                    "selected_paths": ["../../../etc"],
                },
                discovered,
            )
        self.assertIn("not KiCad projects", str(caught.exception))

    def test_rejects_a_repository_with_no_kicad_projects(self) -> None:
        with self.assertRaises(ValueError) as caught:
            self._run(
                {
                    "repo_url": "https://example.com/boards.git",
                    "import_type": "type1",
                    "selected_paths": [],
                },
                [],
            )
        self.assertIn("No KiCad projects found", str(caught.exception))

    def test_rejects_a_clone_url_that_would_reach_a_remote_helper(self) -> None:
        # Defence in depth: the payload is re-validated in the worker, not only
        # at the point the job was enqueued.
        with self.assertRaises(RemoteUrlError):
            self._run(
                {
                    "repo_url": "ext::sh -c 'id'",
                    "import_type": "type1",
                    "selected_paths": [],
                },
                [],
            )


class EnqueueValidatesRemoteUrls(unittest.TestCase):
    def test_analyze_rejects_a_dangerous_url_before_queueing(self) -> None:
        with mock.patch.object(project_import_service.v3_jobs, "enqueue") as enqueue:
            with self.assertRaises(RemoteUrlError):
                project_import_service.start_analyze_job("ext::sh -c 'id'")
        enqueue.assert_not_called()

    def test_import_rejects_a_dangerous_url_before_queueing(self) -> None:
        with mock.patch.object(project_import_service.v3_jobs, "enqueue") as enqueue:
            with self.assertRaises(RemoteUrlError):
                project_import_service.start_import_job(
                    "file:///etc", "type1", None
                )
        enqueue.assert_not_called()

    def test_equivalent_urls_take_the_same_repository_lock(self) -> None:
        # Otherwise two spellings of one remote could clone concurrently into
        # the same target directory.
        with mock.patch.object(
            project_import_service.v3_jobs,
            "enqueue",
            return_value={"job_id": "job-1"},
        ) as enqueue:
            project_import_service.start_analyze_job("git@github.com:org/repo.git")
            project_import_service.start_analyze_job("https://github.com/org/repo")

        first, second = enqueue.call_args_list
        self.assertEqual(
            first.kwargs["locks"][0]["key"], second.kwargs["locks"][0]["key"]
        )


if __name__ == "__main__":
    unittest.main()
