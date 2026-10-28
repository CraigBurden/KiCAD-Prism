"""No-commit reads HEAD, and a dirty checkout is served with a notice (ADR §9.7 R1)."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services.design_bundle import jobs, reader, revision_key as rk
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit
from support.repo import commit_all, git, init_repo

FILES = {
    "board/demo.kicad_pro": '{"meta": {"filename": "demo.kicad_pro"}}\n',
    "board/demo.kicad_sch": '(kicad_sch (version 20260306))\n',
    "board/demo.kicad_pcb": '(kicad_pcb (version 20260206))\n',
    "README.md": "# demo\n",
}


class NoCommitReadsHeadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="bundle-reader-")))
        init_repo(self.root, FILES)
        self.row = {
            "path": str(self.root / "board"),
            "parent_repo_path": str(self.root),
            "relative_path": "board",
            "project_file_rel": "demo.kicad_pro",
            "path_settings": {},
        }

    def test_none_and_head_resolve_to_the_same_commit_and_key(self):
        implicit = jobs.project_key(self.row, None)
        explicit = jobs.project_key(self.row, "HEAD")
        self.assertEqual(implicit.commit, git(self.root, "rev-parse", "HEAD"))
        self.assertEqual(implicit.commit, explicit.commit)
        self.assertEqual(implicit.key.revision_key, explicit.key.revision_key)

    def test_a_modified_read_set_file_is_dirty(self):
        key = key_at_commit(self.root, ProjectRef.from_row(self.row), "HEAD")
        self.assertFalse(reader._working_tree_dirty(self.row, key))
        (self.root / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (edited))\n")
        self.assertTrue(reader._working_tree_dirty(self.row, key))

    def test_a_new_design_file_is_dirty(self):
        key = key_at_commit(self.root, ProjectRef.from_row(self.row), "HEAD")
        (self.root / "board/extra.kicad_sch").write_text("(kicad_sch (version 20260306))\n")
        self.assertTrue(reader._working_tree_dirty(self.row, key))

    def test_an_unrelated_change_is_not_dirty(self):
        key = key_at_commit(self.root, ProjectRef.from_row(self.row), "HEAD")
        (self.root / "README.md").write_text("# changed\n")
        commit_all(self.root, "readme")
        self.assertFalse(reader._working_tree_dirty(self.row, key))

    def test_worktree_changes_lists_modified_and_untracked_names(self):
        (self.root / "board/demo.kicad_pcb").write_text("(kicad_pcb (version 20260206) (edited))\n")
        (self.root / "todo.txt").write_text("x\n")
        changes = rk.worktree_changes(self.root)
        self.assertIn(b"board/demo.kicad_pcb", changes)
        self.assertIn(b"todo.txt", changes)

    def test_status_saves_the_refreshed_index(self):
        # A touched but unchanged file is stat-dirty until something writes the
        # index back; until then every status re-hashes it (seconds per read on
        # a repository of large boards).
        board = self.root / "board/demo.kicad_pcb"
        stamp = board.stat().st_mtime + 120
        os.utime(board, (stamp, stamp))
        self.assertIn("board/demo.kicad_pcb", git(self.root, "diff-files", "--name-only"))

        self.assertEqual(rk.worktree_changes(self.root), [])
        self.assertEqual(git(self.root, "diff-files", "--name-only"), "")

    def test_a_status_that_fails_still_serves_the_bundle(self):
        # The dirty check is a notice: an unreadable working tree logs and reads on.
        generator = SimpleNamespace(digest="d" * 64)
        with (
            mock.patch("app.services.workspace_service.workspace.get_project_by_id", return_value=self.row),
            mock.patch.object(reader, "_working_tree_dirty", side_effect=OSError("index.lock")),
            mock.patch.object(reader.cli, "generator", return_value=generator),
            mock.patch.object(reader, "_stored", return_value=("b" * 64, "r" * 64, False, None)),
            mock.patch.object(reader.rows, "get_bundle", return_value=None),
            self.assertLogs(reader.logger, "WARNING"),
        ):
            opened = reader.open_revision("prj")
        self.assertFalse(opened.working_tree_dirty)
        self.assertEqual(opened.commit, git(self.root, "rev-parse", "HEAD"))


if __name__ == "__main__":
    unittest.main()
