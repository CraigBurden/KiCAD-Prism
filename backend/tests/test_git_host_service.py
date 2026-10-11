"""Phase 5: Prism hosts git.

The claim being tested is not "we made a directory called foo.git". It is that a real
`git clone` works against it, and that a client can push and another client sees the
push. So most of this drives actual git, not mocks.

The rule that must never break: **bare is only ever the server's side.** A client clone
is always a working tree, because KiCad opens files off the disk. Nothing is converted.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services import git_host_service  # noqa: E402
from app.services.git_host_service import GitHostError  # noqa: E402
from support.repo import git, init_repo  # noqa: E402


def make_tree(path: Path, filename="board.kicad_pro") -> Path:
    path.mkdir(parents=True, exist_ok=True)
    init_repo(path, {filename: "{}"}, message="first")
    return path


class GitHostTestCase(unittest.TestCase):
    """Every test gets its own projects root, so repos never land in a real one."""

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name)
        environment = patch.object(settings, "KICAD_PROJECTS_ROOT", str(self.tmp))
        environment.start()
        self.addCleanup(environment.stop)


class RepoPathTests(GitHostTestCase):
    """A project id can never escape the repos root."""

    def test_a_bad_project_id_cannot_escape_the_repos_root(self) -> None:
        """repo_path builds a filesystem path. Ids are minted by us, but a component that
        could walk out of the root would be a serious bug, so it is checked anyway."""
        for bad in ["../../etc", "a/b", "a\\b", "..", "", "prj_../../../x"]:
            with self.subTest(bad=bad), self.assertRaises(GitHostError):
                git_host_service.repo_path(bad)

    def test_a_real_id_resolves_inside_the_root(self) -> None:
        path = git_host_service.repo_path("prj_abc123")
        self.assertEqual(path.name, "prj_abc123.git")
        self.assertIn(git_host_service.repos_root(), path.parents)


class BareRepoTests(GitHostTestCase):
    def test_creates_a_genuinely_bare_repo(self) -> None:
        path = git_host_service.create("prj_abc")
        # Bare means no working tree. That is the whole point for an origin: there is no
        # checked-out copy for two people pushing to corrupt.
        self.assertTrue((path / "HEAD").is_file())
        self.assertFalse((path / ".git").exists())
        out = git(path, "rev-parse", "--is-bare-repository")
        self.assertEqual(out, "true")

    def test_create_is_idempotent(self) -> None:
        first = git_host_service.create("prj_abc")
        second = git_host_service.create("prj_abc")
        self.assertEqual(first, second)

    def test_a_fresh_repo_is_empty_and_says_so(self) -> None:
        git_host_service.create("prj_abc")
        self.assertTrue(git_host_service.is_empty("prj_abc"))

    def test_smart_http_is_enabled_on_a_new_repo(self) -> None:
        """Without http.receivepack, a self-hosted git-over-HTTP setup silently 403s on
        push. It is the single most common way this is got wrong."""
        path = git_host_service.create("prj_abc")
        self.assertEqual(git(path, "config", "http.receivepack"), "true")

    def test_delete_removes_it(self) -> None:
        git_host_service.create("prj_abc")
        self.assertIs(git_host_service.delete("prj_abc"), True)
        self.assertFalse(git_host_service.exists("prj_abc"))


class ClientTests(GitHostTestCase):
    def test_a_client_can_clone_push_and_another_client_sees_it(self) -> None:
        """The actual feature, end to end, with real git: two working trees sharing a
        Prism-hosted origin."""
        bare = git_host_service.create("prj_abc")

        alice = make_tree(self.tmp / "alice")
        git(alice, "remote", "add", "origin", str(bare))
        git(alice, "push", "-u", "origin", "main")

        # Bob clones what Alice pushed.
        bob = self.tmp / "bob"
        git(self.tmp, "clone", str(bare), str(bob))
        self.assertTrue((bob / "board.kicad_pro").is_file())

        # A CLIENT clone is a working tree, never bare. KiCad opens files off the disk.
        self.assertTrue((bob / ".git").is_dir())
        self.assertEqual(
            git(bob, "rev-parse", "--is-bare-repository"), "false"
        )

        # Bob pushes; Alice sees it.
        (bob / "notes.md").write_text("hi")
        git(bob, "add", "-A")
        git(bob, "commit", "-m", "bob's change")
        git(bob, "push")

        git(alice, "pull")
        self.assertTrue((alice / "notes.md").is_file())


class AdoptionTests(GitHostTestCase):
    """Adoption never touches the user's tree."""

    def test_adopt_pushes_the_history_and_leaves_the_tree_where_it_is(self) -> None:
        tree = make_tree(self.tmp / "mine")
        before = sorted(p.name for p in tree.iterdir())

        git_host_service.adopt("prj_abc", tree)

        # Still exactly where it was, still a working tree, NOT converted to bare.
        self.assertTrue(tree.is_dir())
        self.assertTrue((tree / "board.kicad_pro").is_file())
        self.assertEqual(
            git(tree, "rev-parse", "--is-bare-repository"), "false"
        )
        self.assertEqual(sorted(p.name for p in tree.iterdir()), before)

        # It gained a remote, and the history is really in the bare repo.
        origin = git(tree, "remote", "get-url", "origin")
        self.assertEqual(origin, str(git_host_service.repo_path("prj_abc")))
        self.assertFalse(git_host_service.is_empty("prj_abc"))

    def test_adopting_a_folder_that_is_not_a_repo_is_refused(self) -> None:
        plain = self.tmp / "just-files"
        plain.mkdir()
        (plain / "board.kicad_pcb").write_text("")
        with self.assertRaisesRegex(GitHostError, "not a git repository"):
            git_host_service.adopt("prj_abc", plain)

    def test_adopting_a_repo_with_no_commits_is_refused(self) -> None:
        empty = self.tmp / "empty"
        empty.mkdir()
        git(empty, "init")
        with self.assertRaisesRegex(GitHostError, "no commits"):
            git_host_service.adopt("prj_abc", empty)

    def test_adopting_a_repo_that_already_has_an_origin_is_refused(self) -> None:
        """Silently replacing someone's existing remote would disconnect them from the
        upstream they actually push to. Refuse and say why."""
        tree = make_tree(self.tmp / "mine")
        git(tree, "remote", "add", "origin", "https://github.com/x/y")
        with self.assertRaisesRegex(GitHostError, "already has an origin"):
            git_host_service.adopt("prj_abc", tree)

        # And the user's remote is untouched.
        self.assertEqual(
            git(tree, "remote", "get-url", "origin"),
            "https://github.com/x/y",
        )

    def test_a_refused_adoption_leaves_no_orphaned_repo(self) -> None:
        """Creating the bare repo before validating would strand an empty prj_x.git on disk
        every time an adoption was refused."""
        cases = {
            "not-a-repo": lambda p: p.mkdir(),
            "no-commits": lambda p: (p.mkdir(), git(p, "init")),
        }
        for name, make_bad in cases.items():
            with self.subTest(name):
                bad = self.tmp / f"bad-{name}"
                make_bad(bad)

                with self.assertRaises(GitHostError):
                    git_host_service.adopt("prj_abc", bad)

                self.assertFalse(git_host_service.exists("prj_abc"))


class OriginUrlTests(unittest.TestCase):
    """The URL handed to clients."""

    def test_origin_url_is_empty_when_the_server_has_no_public_url(self) -> None:
        """Better to say nothing than to hand out http://127.0.0.1:8000/git/..., which
        works only on the server's own machine."""
        with patch.object(settings, "PUBLIC_BASE_URL", ""):
            self.assertEqual(git_host_service.origin_url("prj_abc"), "")

    def test_origin_url_is_cloneable_when_configured(self) -> None:
        with patch.object(settings, "PUBLIC_BASE_URL", "https://prism.example.com/"):
            self.assertEqual(
                git_host_service.origin_url("prj_abc"),
                "https://prism.example.com/git/prj_abc.git",
            )


if __name__ == "__main__":
    unittest.main()
