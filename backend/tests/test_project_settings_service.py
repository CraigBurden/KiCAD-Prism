"""Prism-side project settings live in the workspace database, not the checkout."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.config import settings
from app.services import path_config_service, project_service, project_settings_service
from app.services.workspace_service import workspace

DATABASE_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(cwd), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def _repository(root: Path, prism_json: dict | None) -> Path:
    root.mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    for key, value in (("user.name", "Test"), ("user.email", "test@example.invalid")):
        _git(root, "config", key, value)
    for name in ("top.kicad_pro", "top.kicad_pcb", "base.kicad_pro", "base.kicad_pcb", "alt.kicad_pcb"):
        (root / name).write_text("{}" if name.endswith("_pro") else "(kicad_pcb)", encoding="utf-8")
    if prism_json is not None:
        (root / ".prism.json").write_text(json.dumps(prism_json), encoding="utf-8")
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", "seed")
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
        self.assertEqual(_git(self.checkout, "status", "--porcelain"), "")

    def test_saves_merge_into_what_is_already_stored(self) -> None:
        top = self._project(self.top_id)
        project_service.save_path_config_for(top, path_config_service.PathConfig(pcb="alt.kicad_pcb"))
        project_service.save_path_config_for(top, path_config_service.PathConfig(description="Plate"))
        stored = project_settings_service.stored_settings(str(self.checkout), "top.kicad_pro")
        self.assertEqual(stored, {"pcb": "alt.kicad_pcb", "description": "Plate"})

    def test_a_directory_outside_the_projects_root_has_no_stored_settings(self) -> None:
        with patch.object(project_settings_service, "_load_index", side_effect=AssertionError("no DB read")):
            self.assertIsNone(project_settings_service.stored_settings(tempfile.gettempdir(), None))

    def test_upgrade_imports_a_prism_written_file_once_and_leaves_it(self) -> None:
        (self.checkout / ".prism.json").write_text(
            json.dumps(
                {
                    "paths": {"pcb": "top.kicad_pcb"},
                    "projects": {"top.kicad_pro": {"paths": {"designOutputs": "Out"}}},
                }
            ),
            encoding="utf-8",
        )
        written = (self.checkout / ".prism.json").read_bytes()
        with workspace._connect() as conn:
            conn.execute(
                "UPDATE ws_projects SET path_settings_checked=FALSE WHERE repo_id=%s", (self.repo_id,)
            )
            imported = project_settings_service.import_working_tree_settings(conn, workspace._abs_clone_path)
            again = project_settings_service.import_working_tree_settings(conn, workspace._abs_clone_path)
            conn.commit()
        self.assertGreaterEqual(imported, 1)
        self.assertEqual(again, 0)
        project_settings_service.invalidate()
        self.assertEqual(
            project_settings_service.stored_settings(str(self.checkout), "top.kicad_pro"),
            {"designOutputs": "Out"},
        )
        self.assertIsNone(project_settings_service.stored_settings(str(self.checkout), "base.kicad_pro"))
        self.assertEqual((self.checkout / ".prism.json").read_bytes(), written)


if __name__ == "__main__":
    unittest.main()
