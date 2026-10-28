"""A project's commit history in a repository it shares (issue #681).

Two projects in one directory, the second added later, and a third in a
subdirectory. Each project's history lists its own commits only, from the
commit that added its project file.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.git_service import get_commits_list_filtered  # noqa: E402
from app.services.project_history_scope import ProjectHistory, project_history  # noqa: E402
from support.repo import commit_all, init_repo, write_files  # noqa: E402


def _commit(repo: Path, message: str, files: dict[str, str]) -> None:
    write_files(repo, files)
    commit_all(repo, message)


class ProjectHistoryScopeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.repo = Path(self.tempdir.name) / "repo"
        init_repo(self.repo)
        _commit(self.repo, "add base", {
            "boards/base.kicad_pro": "{}", "boards/base.kicad_sch": "s1", "boards/base.kicad_pcb": "p1",
            "boards/fp-lib-table": "t1",
        })
        _commit(self.repo, "base: board", {"boards/base.kicad_pcb": "p2"})
        _commit(self.repo, "add top", {
            "boards/top.kicad_pro": "{}", "boards/top.kicad_sch": "s1", "boards/top.kicad_pcb": "p1",
        })
        _commit(self.repo, "top: board", {"boards/top.kicad_pcb": "p2"})
        _commit(self.repo, "shared library table", {"boards/fp-lib-table": "t2"})
        _commit(self.repo, "add panel", {"boards/panel/panel.kicad_pro": "{}", "boards/panel/panel.kicad_pcb": "p1"})
        _commit(self.repo, "base: board again", {"boards/base.kicad_pcb": "p3"})

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def _messages(self, history: ProjectHistory) -> list[str]:
        page = get_commits_list_filtered(str(self.repo), None, 50, history=history)
        self.assertEqual(page["total"], len(page["commits"]))
        return [commit["message"] for commit in page["commits"]]

    def test_a_project_lists_only_its_own_commits_and_shared_files(self) -> None:
        self.assertEqual(
            self._messages(ProjectHistory("boards", "base.kicad_pro", ("boards/panel",))),
            ["base: board again", "shared library table", "base: board", "add base"],
        )

    def test_history_starts_at_the_commit_that_added_the_project(self) -> None:
        self.assertEqual(
            self._messages(ProjectHistory("boards", "top.kicad_pro", ("boards/panel",))),
            ["shared library table", "top: board", "add top"],
        )

    def test_a_project_in_a_subdirectory_keeps_its_own_history(self) -> None:
        self.assertEqual(self._messages(ProjectHistory("boards/panel", "panel.kicad_pro")), ["add panel"])

    def test_without_an_anchor_the_directory_decides_as_before(self) -> None:
        self.assertEqual(len(self._messages(ProjectHistory("boards"))), 7)

    def test_the_card_change_counts_leave_out_a_neighbours_files(self) -> None:
        page = get_commits_list_filtered(
            str(self.repo), None, 50, history=ProjectHistory("boards", "top.kicad_pro", ("boards/panel",))
        )
        added = page["commits"][-1]
        self.assertEqual(added["message"], "add top")
        self.assertEqual(added["kicad_changes"], {"sch": 1, "pcb": 1, "pro": 1, "other": 0})

    def test_nested_projects_come_from_the_repository_rows(self) -> None:
        rows = [
            {"id": "base", "relative_path": "boards"},
            {"id": "top", "relative_path": "boards"},
            {"id": "panel", "relative_path": "boards/panel"},
            {"id": "elsewhere", "relative_path": "other"},
            {"id": "root", "relative_path": "."},
        ]
        self.assertEqual(
            project_history("boards", "top.kicad_pro", "top", rows),
            ProjectHistory("boards", "top.kicad_pro", ("boards/panel",)),
        )
        self.assertEqual(
            project_history("", "root.kicad_pro", "root", rows).nested,
            ("boards", "boards/panel", "other"),
        )


if __name__ == "__main__":
    unittest.main()
