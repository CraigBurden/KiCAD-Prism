"""project_revision against a real `git init` repository."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.services import project_revision
from support.repo import git, init_repo  # noqa: E402


class ProjectRevisionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.base = Path(self._tmp.name).resolve()
        self.repo = self.base / "mono"
        self.repo.mkdir()
        init_repo(self.repo)
        for key, value in (("maintenance.auto", "false"), ("gc.auto", "0"), ("core.symlinks", "true")):
            git(self.repo, "config", key, value)
        board = self.repo / "boards" / "a"
        board.mkdir(parents=True)
        (board / "a.kicad_pro").write_text("{}", encoding="utf-8")
        (board / "a.kicad_sch").write_text("(kicad_sch)", encoding="utf-8")
        (board / "a.kicad_pcb").write_text("(kicad_pcb)", encoding="utf-8")
        (board / "fp-lib-table").write_text("(fp_lib_table)", encoding="utf-8")
        (board / ".prism.json").write_text(
            json.dumps({"projects": {"a.kicad_pro": {"paths": {"designOutputs": "Out"}}}}),
            encoding="utf-8",
        )
        (board / "Manufacturing-Outputs").mkdir()
        (board / "Manufacturing-Outputs" / "a.kicad_pcb").write_text("(gerber copy)", encoding="utf-8")
        (board / "model.step").write_bytes(b"step")
        (board / "run.sh").write_text("#!/bin/sh\n", encoding="utf-8")
        os.chmod(board / "run.sh", 0o755)
        (board / "ignored.kicad_wks").write_text("(kicad_wks)", encoding="utf-8")
        (board / "subst.txt").write_text("$Format:%H$", encoding="utf-8")
        (self.repo / ".gitattributes").write_text(
            "boards/a/ignored.kicad_wks export-ignore\nboards/a/subst.txt export-subst\n",
            encoding="utf-8",
        )
        shared = self.repo / "shared"
        shared.mkdir()
        (shared / "lib.kicad_sym").write_text("(kicad_symbol_lib)", encoding="utf-8")
        os.symlink("../../shared/lib.kicad_sym", board / "lib.kicad_sym")
        os.symlink("/etc/hosts", board / "escape.kicad_sch")
        os.symlink("../../../outside.kicad_sch", board / "climb.kicad_sch")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "fixture")
        self.commit = git(self.repo, "rev-parse", "HEAD")
        self.row = {
            "id": "prj_a",
            "path": str(board),
            "parent_repo_path": str(self.repo),
            "relative_path": "boards/a",
            "project_file_rel": "a.kicad_pro",
        }

    def tearDown(self) -> None:
        self._tmp.cleanup()

    # -- location ----------------------------------------------------------

    def test_a_workspace_row_and_a_bare_path_locate_the_same_subproject(self) -> None:
        from_row = project_revision.locate(self.row)
        from_git = project_revision.locate(SimpleNamespace(path=self.row["path"], project_file="a.kicad_pro"))
        for location in (from_row, from_git):
            self.assertEqual(location.repo_root, self.repo)
            self.assertEqual(location.relative_path, "boards/a")
            self.assertEqual(location.sub_path, "boards/a")
            self.assertEqual(location.checkout, self.repo / "boards" / "a")
            self.assertEqual(location.anchor, "a.kicad_pro")
        self.assertEqual(from_row.repo_path("a.kicad_pcb"), "boards/a/a.kicad_pcb")

    def test_a_repository_root_project_has_no_sub_path(self) -> None:
        location = project_revision.locate({"path": str(self.repo), "parent_repo_path": str(self.repo)})
        self.assertEqual(location.relative_path, "")
        self.assertIsNone(location.sub_path)
        self.assertEqual(location.repo_path(".prism.json"), ".prism.json")

    def test_a_path_outside_any_repository_is_refused(self) -> None:
        outside = self.base / "plain"
        outside.mkdir()
        with self.assertRaises(project_revision.ProjectNotInRepository):
            project_revision.locate(SimpleNamespace(path=str(outside)))
        with self.assertRaises(project_revision.ProjectNotInRepository):
            project_revision.locate({"path": str(outside), "parent_repo_path": str(self.repo)})

    def test_project_paths_cannot_climb_out_of_the_project(self) -> None:
        location = project_revision.locate(self.row)
        with self.assertRaises(ValueError):
            location.repo_path("../b/b.kicad_pro")

    def test_project_file_rel_follows_the_anchor(self) -> None:
        self.assertEqual(
            project_revision.project_file_rel(project_revision.locate(self.row)),
            "boards/a/a.kicad_pro",
        )

    # -- commits -----------------------------------------------------------

    def test_refs_resolve_to_full_commit_ids(self) -> None:
        location = project_revision.locate(self.row)
        self.assertEqual(project_revision.resolve_commit(location, "HEAD"), self.commit)
        self.assertEqual(project_revision.resolve_commit(self.repo, self.commit[:10]), self.commit)
        for bad in ("no-such-ref", "--all", ""):
            with self.assertRaises(project_revision.RevisionNotFound):
                project_revision.resolve_commit(location, bad)

    # -- materialization ---------------------------------------------------

    def test_full_tree_reads_objects_not_an_export_archive(self) -> None:
        location = project_revision.locate(self.row)
        with project_revision.checkout(location, "HEAD") as revision:
            root = revision.root
            project = revision.project_dir
            self.assertEqual(revision.commit, self.commit)
            self.assertEqual(project, root / "boards" / "a")
            # export-ignore and export-subst are archive attributes, not content.
            self.assertTrue((project / "ignored.kicad_wks").is_file())
            self.assertEqual((project / "subst.txt").read_text(encoding="utf-8"), "$Format:%H$")
            self.assertTrue(os.access(project / "run.sh", os.X_OK))
            self.assertFalse(os.access(project / "a.kicad_pro", os.X_OK))
            # A link inside the tree is kept; links that leave it are dropped.
            self.assertEqual(
                (project / "lib.kicad_sym").read_text(encoding="utf-8"), "(kicad_symbol_lib)"
            )
            self.assertFalse(os.path.lexists(project / "escape.kicad_sch"))
            self.assertFalse(os.path.lexists(project / "climb.kicad_sch"))
        self.assertFalse(root.exists())

    def test_materialize_reports_dropped_links(self) -> None:
        destination = self.base / "out"
        result = project_revision.materialize(self.repo, self.commit, destination)
        self.assertEqual(
            sorted(result.dropped_symlinks),
            ["boards/a/climb.kicad_sch", "boards/a/escape.kicad_sch"],
        )
        self.assertEqual(result.symlinks, 1)

    def test_compare_inputs_flatten_the_project_and_skip_output_bulk(self) -> None:
        destination = self.base / "compare"
        result = project_revision.materialize(
            self.repo,
            self.commit,
            destination,
            source_set=project_revision.COMPARE_INPUTS,
            scope="boards/a",
            strip_scope=True,
        )
        written = sorted(
            path.relative_to(destination).as_posix()
            for path in destination.rglob("*")
            if path.is_file() or path.is_symlink()
        )
        self.assertEqual(
            written,
            [
                ".prism.json",
                "a.kicad_pcb",
                "a.kicad_pro",
                "a.kicad_sch",
                "fp-lib-table",
                "ignored.kicad_wks",
            ],
        )
        self.assertEqual(result.files, 6)

    def test_kicad_sources_keep_repository_paths_inside_the_scope(self) -> None:
        location = project_revision.locate(self.row)
        with project_revision.checkout(
            location, self.commit, source_set=project_revision.KICAD_SOURCES, scope="boards/a"
        ) as revision:
            written = sorted(
                path.relative_to(revision.root).as_posix()
                for path in revision.root.rglob("*")
                if path.is_file()
            )
        self.assertEqual(
            written,
            [
                "boards/a/.prism.json",
                "boards/a/Manufacturing-Outputs/a.kicad_pcb",
                "boards/a/a.kicad_pcb",
                "boards/a/a.kicad_pro",
                "boards/a/a.kicad_sch",
            ],
        )

    # -- single files ------------------------------------------------------

    def test_read_file_is_project_relative_and_none_when_absent(self) -> None:
        location = project_revision.locate(self.row)
        self.assertEqual(project_revision.read_file(location, "HEAD", "a.kicad_sch"), b"(kicad_sch)")
        self.assertIsNone(project_revision.read_file(location, "HEAD", "missing.kicad_sch"))
        with self.assertRaises(project_revision.RevisionNotFound):
            project_revision.read_file(location, "no-such-ref", "a.kicad_sch")

    def test_path_config_at_merges_the_anchor_namespace(self) -> None:
        location = project_revision.locate(self.row)
        config = project_revision.path_config_at(location, "HEAD")
        self.assertEqual(config.designOutputs, "Out")
        sibling = project_revision.locate({**self.row, "project_file_rel": "b.kicad_pro"})
        self.assertNotEqual(project_revision.path_config_at(sibling, "HEAD").designOutputs, "Out")

    def test_path_config_at_defaults_without_a_file_and_rejects_bad_json(self) -> None:
        root_project = project_revision.locate({"path": str(self.repo), "parent_repo_path": str(self.repo)})
        defaults = project_revision.path_config_at(root_project, "HEAD")
        self.assertEqual(defaults.designOutputs, project_revision.path_config_service.DEFAULT_PATHS["designOutputs"])
        (self.repo / ".prism.json").write_text("{not json", encoding="utf-8")
        git(self.repo, "add", ".prism.json")
        git(self.repo, "commit", "-qm", "broken")
        with self.assertRaises(ValueError):
            project_revision.path_config_at(root_project, "HEAD")


class SourceSetRuleTests(unittest.TestCase):
    """``is_generated`` is the one rule every source reader applies."""

    def test_kicad_generated_files_are_not_design_sources(self) -> None:
        for path in (
            "_autosave-board.kicad_sch",
            "sheets/~autosave-power.kicad_sch",
            "board.kicad_pcb-bak",
            "~board.kicad_pcb.lck",
            "board-backups/board-2026-01-01.zip",
            "fp-info-cache",
            "board-cache.lib",
            "RemoteLibrary/symbols/remote.kicad_sym",
            "autosave/board.kicad_pcb",
            "backup/board.kicad_sch",
            "board-backup-2026.kicad_sch",
            "._board.kicad_sch",
        ):
            with self.subTest(path=path):
                self.assertTrue(project_revision.is_generated(path))

    def test_design_files_and_prism_settings_are_sources(self) -> None:
        for path in (
            "board.kicad_sch",
            "sheets/power.kicad_sch",
            ".prism.json",
            "fp-lib-table",
            "libs/Project.pretty/R.kicad_mod",
        ):
            with self.subTest(path=path):
                self.assertFalse(project_revision.is_generated(path))

    def test_source_sets_that_read_text_leave_generated_files_out(self) -> None:
        for source_set in (
            project_revision.KICAD_SOURCES,
            project_revision.COMPARE_INPUTS,
            project_revision.SEMANTIC_SOURCES,
        ):
            with self.subTest(source_set=source_set.name):
                self.assertTrue(source_set.includes("board.kicad_sch"))
                self.assertTrue(source_set.includes(".prism.json"))
                self.assertFalse(source_set.includes("_autosave-board.kicad_sch"))
        self.assertTrue(project_revision.FULL_TREE.includes("RemoteLibrary/symbols/remote.kicad_sym"))


if __name__ == "__main__":
    unittest.main()
