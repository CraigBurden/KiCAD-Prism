from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from git import Actor, Repo
from git.exc import BadName


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import git_service  # noqa: E402


AUTHOR = Actor("Prism Test", "prism@example.com")


def _commit_all(repo: Repo, message: str):
    repo.git.add(A=True)
    return repo.index.commit(message, author=AUTHOR, committer=AUTHOR)


class GitBranchViewingTests(unittest.TestCase):
    def test_lists_only_branches_containing_the_subproject_without_switching_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            (root / "README.md").write_text("root", encoding="utf-8")
            initial = _commit_all(repo, "initial")
            repo.create_head("without-project", initial)

            project_file = root / "boards" / "demo" / "README.md"
            project_file.parent.mkdir(parents=True)
            project_file.write_text("project", encoding="utf-8")
            project_commit = _commit_all(repo, "add project")
            repo.create_head("feature/project", project_commit)

            original_head = repo.head.commit.hexsha
            branches = git_service.get_branches(str(root), "boards/demo")

            self.assertEqual(repo.head.commit.hexsha, original_head)
            self.assertEqual(
                {branch["ref"] for branch in branches["branches"]},
                {repo.active_branch.name, "feature/project"},
            )
            self.assertEqual(branches["default_ref"], repo.active_branch.name)

    def test_head_is_the_checkout_even_when_the_subproject_list_omits_it(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            project_file = root / "boards" / "demo" / "README.md"
            project_file.parent.mkdir(parents=True)
            project_file.write_text("project", encoding="utf-8")
            project_commit = _commit_all(repo, "add project")
            (root / "README.md").write_text("elsewhere", encoding="utf-8")
            head = _commit_all(repo, "outside the subproject")

            listed = git_service.get_commits_list_filtered(str(root), "boards/demo", 1, None, 0, False)

            self.assertEqual(listed["commits"][0]["full_hash"], project_commit.hexsha)
            self.assertEqual(git_service.get_head_commit(str(root)), head.hexsha)
            self.assertIsNone(git_service.get_head_commit(str(root / "missing")))

    def test_lists_fetched_remote_branches(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_path = root / "source"
            source = Repo.init(source_path)
            (source_path / "README.md").write_text("initial", encoding="utf-8")
            initial = _commit_all(source, "initial")
            source.create_head("remote-feature", initial)

            remote_path = root / "remote.git"
            source.clone(str(remote_path), bare=True)
            checkout_path = root / "checkout"
            checkout = Repo.clone_from(str(remote_path), checkout_path)
            checkout.remotes.origin.fetch()

            branches = git_service.get_branches(str(checkout_path))

            self.assertIn("origin/remote-feature", {branch["ref"] for branch in branches["branches"]})
            self.assertNotIn(checkout.active_branch.name, {branch["ref"] for branch in branches["branches"]})
            self.assertEqual(branches["default_ref"], f"origin/{checkout.active_branch.name}")

            (source_path / "README.md").write_text("updated", encoding="utf-8")
            latest = _commit_all(source, "update main")
            source.git.push(str(remote_path), source.active_branch.name)
            checkout.remotes.origin.fetch()
            refreshed = git_service.get_branches(str(checkout_path))
            current = next(branch for branch in refreshed["branches"] if branch["is_current"])
            self.assertEqual(current["commit"], latest.hexsha)
            self.assertEqual(checkout.head.commit.hexsha, initial.hexsha)

    def test_scopes_history_and_distance_to_the_selected_ref(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            (root / "README.md").write_text("initial", encoding="utf-8")
            initial = _commit_all(repo, "initial")
            repo.create_head("feature/project", initial)
            repo.git.checkout("feature/project")
            (root / "README.md").write_text("feature", encoding="utf-8")
            feature_commit = _commit_all(repo, "feature work")
            repo.git.checkout(repo.heads[0].name)

            commits = git_service.get_commits_list(str(root), ref="feature/project")
            page = commits["commits"] if isinstance(commits, dict) else commits

            self.assertEqual(page[0]["full_hash"], feature_commit.hexsha)
            self.assertEqual(
                git_service.get_commit_distance(str(root), initial.hexsha, ref="feature/project"),
                1,
            )

            first_page = git_service.get_commits_list(
                str(root),
                limit=1,
                ref="feature/project",
                include_total=False,
            )
            self.assertIsNone(first_page["total"])
            self.assertTrue(first_page["has_more"])
            self.assertEqual(first_page["resolved_ref_sha"], feature_commit.hexsha)

    def test_release_pagination_can_skip_total_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = Repo.init(root)
            (root / "README.md").write_text("one", encoding="utf-8")
            first = _commit_all(repo, "one")
            repo.create_tag("v1", ref=first)
            (root / "README.md").write_text("two", encoding="utf-8")
            second = _commit_all(repo, "two")
            repo.create_tag("v2", ref=second)

            page = git_service.get_releases(
                str(root),
                limit=1,
                include_total=False,
            )

            self.assertEqual(len(page["releases"]), 1)
            self.assertIsNone(page["total"])
            self.assertTrue(page["has_more"])
            self.assertEqual(page["resolved_ref_sha"], second.hexsha)


class RemoteOnlyBranchTests(unittest.TestCase):
    """Prism's own clone never checks branches out, so a branch somebody pushed exists
    in it only as `origin/<name>`.

    Callers name branches the way their user does ("test", not "origin/test"), because
    that is what their own checkout calls it. Resolving only local heads made every one
    of those a 404 against a branch the clone demonstrably had.

    Driven through a stand-in rather than a real clone: the real thing needs three
    repositories, and GitPython holds Windows file handles open on all of them, which
    already breaks cleanup for other tests in this file. What is worth pinning is the
    fallback, not git's ability to clone.
    """

    class _FakeRemote:
        def __init__(self, name: str) -> None:
            self.name = name

    class _FakeRepo:
        """Resolves only the refs it was given, raising BadName as a real repo does."""

        def __init__(self, refs: dict, remotes: list) -> None:
            self._refs = refs
            self.remotes = remotes

        def commit(self, ref: str):
            if ref in self._refs:
                return self._refs[ref]
            raise BadName(ref)

    def _repo(self):
        return self._FakeRepo(
            {"main": "sha-main", "origin/pushed-only": "sha-pushed"},
            [self._FakeRemote("origin")],
        )

    def test_a_branch_that_exists_only_on_the_remote_still_resolves(self) -> None:
        self.assertEqual(
            git_service._resolve_commit(self._repo(), "pushed-only"), "sha-pushed"
        )

    def test_a_local_branch_is_unaffected(self) -> None:
        self.assertEqual(git_service._resolve_commit(self._repo(), "main"), "sha-main")

    def test_an_unknown_ref_is_still_a_404(self) -> None:
        with self.assertRaises(Exception) as caught:
            git_service._resolve_commit(self._repo(), "no-such-branch")
        self.assertEqual(getattr(caught.exception, "status_code", None), 404)


if __name__ == "__main__":
    unittest.main()
