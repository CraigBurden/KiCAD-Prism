"""Prism-side project settings live in the workspace database, not the checkout."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.config import settings
from app.services import path_config_service, project_service, project_settings_service
from app.services.workspace_service import workspace
from support.repo import git, init_repo  # noqa: E402

DATABASE_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


def _repository(root: Path, prism_json: dict | None) -> Path:
    init_repo(root)
    for name in ("top.kicad_pro", "top.kicad_pcb", "base.kicad_pro", "base.kicad_pcb", "alt.kicad_pcb"):
        (root / name).write_text("{}" if name.endswith("_pro") else "(kicad_pcb)", encoding="utf-8")
    if prism_json is not None:
        (root / ".prism.json").write_text(json.dumps(prism_json), encoding="utf-8")
    git(root, "add", "-A")
    git(root, "commit", "-qm", "seed")
    return root


class PrismWrittenSettingsTests(unittest.TestCase):
    """Which `.prism.json` values a Prism edit wrote (imported once on upgrade)."""

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name)

    def test_a_clean_committed_file_is_the_repositorys_own(self) -> None:
        repo = _repository(self.tmp / "clean", {"paths": {"pcb": "alt.kicad_pcb"}})
        self.assertEqual(project_settings_service.prism_written_settings(repo, "top.kicad_pro"), {})

    def test_only_keys_changed_against_head_are_prism_written(self) -> None:
        repo = _repository(
            self.tmp / "edited",
            {"paths": {"pcb": "alt.kicad_pcb", "designOutputs": "Design-Outputs"}},
        )
        (repo / ".prism.json").write_text(
            json.dumps(
                {
                    "paths": {"pcb": "alt.kicad_pcb", "designOutputs": "Design-Outputs"},
                    "projects": {"top.kicad_pro": {"paths": {"designOutputs": "Out"}, "project_name": "Top"}},
                }
            ),
            encoding="utf-8",
        )
        self.assertEqual(
            project_settings_service.prism_written_settings(repo, "top.kicad_pro"),
            {"designOutputs": "Out", "project_name": "Top"},
        )
        self.assertEqual(project_settings_service.prism_written_settings(repo, "base.kicad_pro"), {})

    def test_an_untracked_file_is_entirely_prism_written(self) -> None:
        repo = _repository(self.tmp / "untracked", None)
        (repo / ".prism.json").write_text(json.dumps({"description": "Fixture"}), encoding="utf-8")
        self.assertEqual(
            project_settings_service.prism_written_settings(repo, None), {"description": "Fixture"}
        )


class UnavailableStoreTests(unittest.TestCase):
    def test_path_resolution_survives_a_workspace_without_the_store(self) -> None:
        # Test suites stand in a minimal workspace; a process may lack the schema.
        class _Workspace:
            def get_project_by_id(self, project_id):
                return None

        project_settings_service.invalidate()
        self.addCleanup(project_settings_service.invalidate)
        with tempfile.TemporaryDirectory() as checkout, patch(
            "app.services.workspace_service.workspace", _Workspace()
        ):
            self.assertIsNone(project_settings_service.stored_settings(checkout, None))
            path_config_service.clear_config_cache()
            self.assertEqual(
                path_config_service.get_path_config(checkout, use_cache=False).designOutputs,
                path_config_service.DEFAULT_PATHS["designOutputs"],
            )


@unittest.skipUnless(DATABASE_URL, "PRISM_DATABASE_URL is required for stored settings tests")
class StoredSettingsTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name).resolve()
        root = patch.object(settings, "KICAD_PROJECTS_ROOT", str(self.tmp))
        root.start()
        self.addCleanup(root.stop)
        workspace.initialize()
        project_settings_service.invalidate()
        path_config_service.clear_config_cache()
        self.addCleanup(project_settings_service.invalidate)
        self.addCleanup(path_config_service.clear_config_cache)

        self.checkout = _repository(self.tmp / "type1" / "board", {"paths": {"pcb": "top.kicad_pcb"}})
        self.repo_id = workspace.register_repository(
            name="board", url=str(self.checkout), clone_path_abs=str(self.checkout)
        )
        self.top_id = workspace.register_project(
            repo_id=self.repo_id, name="top", relative_path=".", project_file_rel="top.kicad_pro"
        )
        self.base_id = workspace.register_project(
            repo_id=self.repo_id, name="base", relative_path=".", project_file_rel="base.kicad_pro"
        )

        def remove() -> None:
            with workspace._connect() as conn:
                conn.execute("DELETE FROM ws_projects WHERE repo_id=%s", (self.repo_id,))
                conn.execute("DELETE FROM ws_repositories WHERE id=%s", (self.repo_id,))
                conn.commit()

        self.addCleanup(remove)

    def _project(self, project_id: str):
        return project_service.get_project_by_id(project_id)

    def test_stored_settings_win_over_the_committed_file_and_never_touch_the_checkout(self) -> None:
        top = self._project(self.top_id)
        self.assertEqual(project_service.path_config_for(top).pcb, "top.kicad_pcb")
        before = (self.checkout / ".prism.json").read_bytes()

        config = project_service.path_config_for(top)
        config.pcb = "alt.kicad_pcb"
        config.project_name = "Top plate"
        project_service.save_path_config_for(top, config)

        self.assertEqual(project_service.path_config_for(top).pcb, "alt.kicad_pcb")
        self.assertEqual(project_service.path_config_for(top).project_name, "Top plate")
        # A path-only reader (a worker) resolves the same settings.
        self.assertEqual(
            path_config_service.get_path_config(str(self.checkout), anchor="top.kicad_pro").pcb,
            "alt.kicad_pcb",
        )
        # The sibling sharing the directory keeps the committed configuration.
        self.assertEqual(project_service.path_config_for(self._project(self.base_id)).pcb, "top.kicad_pcb")
        self.assertEqual((self.checkout / ".prism.json").read_bytes(), before)
        self.assertEqual(git(self.checkout, "status", "--porcelain"), "")

    def test_saves_merge_into_what_is_already_stored(self) -> None:
        top = self._project(self.top_id)
        project_service.save_path_config_for(top, path_config_service.PathConfig(pcb="alt.kicad_pcb"))
        project_service.save_path_config_for(top, path_config_service.PathConfig(description="Plate"))
        stored = project_settings_service.stored_settings(str(self.checkout), "top.kicad_pro")
        self.assertEqual(stored, {"pcb": "alt.kicad_pcb", "description": "Plate"})

    def test_a_revision_snapshot_directory_has_no_stored_settings(self) -> None:
        top = self._project(self.top_id)
        project_service.save_path_config_for(top, path_config_service.PathConfig(pcb="alt.kicad_pcb"))
        with tempfile.TemporaryDirectory() as snapshot:
            self.assertIsNone(project_settings_service.stored_settings(snapshot, "top.kicad_pro"))

    def test_an_adopted_checkout_outside_the_projects_root_keeps_its_settings(self) -> None:
        with tempfile.TemporaryDirectory() as elsewhere:
            adopted = _repository(Path(elsewhere).resolve() / "adopted", None)
            repo_id = workspace.register_repository(
                name="adopted", url=str(adopted), clone_path_abs=str(adopted)
            )
            try:
                project_id = workspace.register_project(
                    repo_id=repo_id, name="adopted", relative_path=".", project_file_rel="top.kicad_pro"
                )
                project = self._project(project_id)
                project_service.save_path_config_for(project, path_config_service.PathConfig(pcb="alt.kicad_pcb"))
                self.assertEqual(project_service.path_config_for(project).pcb, "alt.kicad_pcb")
                self.assertFalse((adopted / ".prism.json").exists())
            finally:
                with workspace._connect() as conn:
                    conn.execute("DELETE FROM ws_projects WHERE repo_id=%s", (repo_id,))
                    conn.execute("DELETE FROM ws_repositories WHERE id=%s", (repo_id,))
                    conn.commit()

    def _import_twice(self) -> tuple[int, int]:
        with workspace._connect() as conn:
            conn.execute(
                "UPDATE ws_projects SET path_settings_checked=FALSE WHERE repo_id=%s", (self.repo_id,)
            )
            dirtied: list = []
            imported = project_settings_service.import_working_tree_settings(
                conn, workspace._abs_clone_path, dirtied
            )
            again = project_settings_service.import_working_tree_settings(conn, workspace._abs_clone_path, dirtied)
            conn.commit()
        self.assertEqual(len(dirtied), 1 if imported else 0)  # one shared file, listed once
        project_settings_service.restore_committed_prism_json(dirtied)
        project_settings_service.invalidate()
        return imported, again

    def test_upgrade_imports_a_prism_written_file_once_and_restores_the_committed_one(self) -> None:
        # D3: the dirtied tracked file blocked Sync until someone restored it by hand.
        committed = (self.checkout / ".prism.json").read_bytes()
        (self.checkout / ".prism.json").write_text(
            json.dumps(
                {
                    "paths": {"pcb": "top.kicad_pcb"},
                    "projects": {
                        "top.kicad_pro": {"paths": {"designOutputs": "Out"}},
                        "base.kicad_pro": {"project_name": "Base"},
                    },
                }
            ),
            encoding="utf-8",
        )
        imported, again = self._import_twice()
        self.assertEqual((imported, again), (2, 0))
        self.assertEqual(
            project_settings_service.stored_settings(str(self.checkout), "top.kicad_pro"),
            {"designOutputs": "Out"},
        )
        self.assertEqual(
            project_settings_service.stored_settings(str(self.checkout), "base.kicad_pro"),
            {"project_name": "Base"},
        )
        self.assertEqual((self.checkout / ".prism.json").read_bytes(), committed)
        self.assertEqual(git(self.checkout, "status", "--porcelain"), "")

    def test_upgrade_leaves_a_file_it_imported_nothing_from(self) -> None:
        # Only other projects' namespaces changed: not this workspace's writes.
        edited = json.dumps({"paths": {"pcb": "top.kicad_pcb"}, "projects": {"other.kicad_pro": {"x": 1}}})
        (self.checkout / ".prism.json").write_text(edited, encoding="utf-8")
        self.assertEqual(self._import_twice(), (0, 0))
        self.assertEqual((self.checkout / ".prism.json").read_text(encoding="utf-8"), edited)

    def test_upgrade_imports_an_untracked_file_and_leaves_it(self) -> None:
        # An untracked file never blocks a fast-forward (Sync ignores untracked files).
        git(self.checkout, "rm", "-q", "--cached", ".prism.json")
        git(self.checkout, "commit", "-qm", "untrack")
        written = json.dumps({"description": "Fixture"})
        (self.checkout / ".prism.json").write_text(written, encoding="utf-8")
        self.assertEqual(self._import_twice(), (2, 0))
        self.assertEqual(
            project_settings_service.stored_settings(str(self.checkout), "top.kicad_pro"),
            {"description": "Fixture"},
        )
        self.assertEqual((self.checkout / ".prism.json").read_text(encoding="utf-8"), written)

if __name__ == "__main__":
    unittest.main()
