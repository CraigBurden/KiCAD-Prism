from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from git import Actor, Repo


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import git_service  # noqa: E402


AUTHOR = Actor("Prism Test", "prism@example.com")


def _commit_all(repo: Repo, message: str):
    repo.git.add(A=True)
    return repo.index.commit(message, author=AUTHOR, committer=AUTHOR)


class GitCommitSummaryTests(unittest.TestCase):
    def test_root_commit_lists_files_without_an_invented_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            source = root / "design.kicad_sch"
            source.write_text("root\n", encoding="utf-8")
            commit = _commit_all(repo, "root")

            summary = git_service.get_commit_file_summary(str(root), commit.hexsha)

            self.assertIsNone(summary["base_commit"])
            self.assertEqual(summary["comparison_basis"], "root")
            self.assertEqual(summary["files"][0]["path"], "design.kicad_sch")
            self.assertEqual(summary["files"][0]["additions"], 1)

    def test_returns_first_parent_pair_and_real_line_stats(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            source = root / "design.kicad_sch"
            source.write_text("duplicate\nduplicate\nold\n", encoding="utf-8")
            parent = _commit_all(repo, "base")
            source.write_text("duplicate\nnew\n", encoding="utf-8")
            commit = _commit_all(repo, "change C102")

            summary = git_service.get_commit_file_summary(str(root), commit.hexsha)

            self.assertEqual(summary["base_commit"], parent.hexsha)
            self.assertEqual(summary["compare_commit"], commit.hexsha)
            self.assertEqual(summary["comparison_basis"], "first-parent")
            self.assertEqual(summary["parent_count"], 1)
            self.assertEqual(summary["files"][0]["additions"], 1)
            self.assertEqual(summary["files"][0]["deletions"], 2)
            self.assertNotIn("semantic_buckets", summary["files"][0])

    def test_type_two_scope_uses_path_boundaries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            intended = root / "boards" / "demo" / "main.kicad_sch"
            sibling = root / "boards" / "demo-copy" / "main.kicad_sch"
            intended.parent.mkdir(parents=True)
            sibling.parent.mkdir(parents=True)
            intended.write_text("base", encoding="utf-8")
            sibling.write_text("base", encoding="utf-8")
            _commit_all(repo, "base")
            intended.write_text("changed", encoding="utf-8")
            sibling.write_text("also changed", encoding="utf-8")
            commit = _commit_all(repo, "change both")

            summary = git_service.get_commit_file_summary(
                str(root),
                commit.hexsha,
                "boards/demo",
            )

            self.assertEqual(
                [file["path"] for file in summary["files"]],
                ["boards/demo/main.kicad_sch"],
            )

    def test_large_text_files_keep_git_line_stats(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            source = root / "large.kicad_sch"
            source.write_text(f"{'a' * 600_000}\n", encoding="utf-8")
            _commit_all(repo, "base")
            source.write_text(f"{'b' * 600_000}\n", encoding="utf-8")
            commit = _commit_all(repo, "large change")

            summary = git_service.get_commit_file_summary(str(root), commit.hexsha)

            self.assertEqual(summary["files"][0]["additions"], 1)
            self.assertEqual(summary["files"][0]["deletions"], 1)

    def test_merge_summary_explicitly_uses_first_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            source = root / "design.kicad_sch"
            source.write_text("base\n", encoding="utf-8")
            base = _commit_all(repo, "base")
            main_branch = repo.active_branch.name

            repo.create_head("feature", base)
            repo.git.checkout("feature")
            source.write_text("feature\n", encoding="utf-8")
            _commit_all(repo, "feature")

            repo.git.checkout(main_branch)
            other = root / "README.md"
            other.write_text("main\n", encoding="utf-8")
            first_parent = _commit_all(repo, "main")
            repo.git.merge("feature", "--no-ff", "-m", "merge feature")
            merge = repo.head.commit

            summary = git_service.get_commit_file_summary(str(root), merge.hexsha)

            self.assertEqual(summary["base_commit"], first_parent.hexsha)
            self.assertEqual(summary["parent_count"], 2)
            self.assertEqual(summary["comparison_basis"], "first-parent")


if __name__ == "__main__":
    unittest.main()
