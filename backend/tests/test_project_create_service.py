"""Creating and adopting Prism-hosted projects (model B).

The invariant that has to hold across all of this: **one id**. The bare repo is named
prj_abc.git, the workspace row is prj_abc, and the .prism.json marker says prj_abc. If
those ever diverge, every lookup by id misses and the project becomes unreachable, in a
way that looks like it worked.

Runs against PostgreSQL, so it is skipped without PRISM_DATABASE_URL. Every repository a
test registers is removed again, which keeps a developer's real workspace clean and lets
the suite run more than once per database.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services import git_host_service, project_create_service  # noqa: E402
from app.services.project_create_service import CreateError  # noqa: E402
from support.repo import git, init_repo  # noqa: E402

DATABASE_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


def make_tree(path: Path) -> Path:
    path.mkdir(parents=True)
    init_repo(path, {"board.kicad_pro": "{}"}, message="first")
    return path


@unittest.skipUnless(DATABASE_URL, "PRISM_DATABASE_URL is required for project creation tests")
class ProjectCreateTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name)

        for patcher in (
            patch.object(settings, "KICAD_PROJECTS_ROOT", str(self.tmp)),
            patch.object(settings, "PUBLIC_BASE_URL", "https://prism.example.com"),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

        # The module-level `workspace` singleton resolved its paths at import time.
        from app.services.workspace_service import WorkspaceService

        self.workspace = WorkspaceService()
        self.workspace.initialize()
        self._track_registrations(self.workspace)
        workspace_patch = patch.object(project_create_service, "workspace", self.workspace)
        workspace_patch.start()
        self.addCleanup(workspace_patch.stop)

    def _track_registrations(self, service) -> None:
        registered: list[str] = []
        original = service.register_repository

        def tracking_register(*args, **kwargs):
            repo_id = original(*args, **kwargs)
            registered.append(repo_id)
            return repo_id

        service.register_repository = tracking_register  # type: ignore[method-assign]

        def remove_registered() -> None:
            with service._connect() as conn:
                for repo_id in registered:
                    # Projects reference the repository, so they go first.
                    conn.execute("DELETE FROM ws_projects WHERE repo_id=%s", (repo_id,))
                    conn.execute("DELETE FROM ws_repositories WHERE id=%s", (repo_id,))
                conn.commit()

        self.addCleanup(remove_registered)

    # -- create ------------------------------------------------------------

    def test_create_makes_a_cloneable_seeded_project(self) -> None:
        result = project_create_service.create("Widget", "a board")

        self.assertEqual(result["origin_owner"], "prism")
        self.assertTrue(result["origin_url"].endswith(f"/git/{result['id']}.git"))

        # The bare repo exists and is NOT empty: an empty origin is a bad starting point
        # (clone warns, no branch to track, the user's first act would be creating the
        # files we already know they need).
        self.assertTrue(git_host_service.exists(result["id"]))
        self.assertFalse(git_host_service.is_empty(result["id"]))

    def test_a_created_project_can_actually_be_cloned(self) -> None:
        result = project_create_service.create("Widget")
        bare = git_host_service.repo_path(result["id"])

        dest = self.tmp / "clone"
        git(self.tmp, "clone", str(bare), str(dest))

        self.assertTrue((dest / "Widget.kicad_pro").is_file())
        self.assertTrue((dest / ".gitignore").is_file())
        # A client clone is a working tree, never bare.
        self.assertTrue((dest / ".git").is_dir())

    def test_the_seeded_gitignore_hides_kicad_noise(self) -> None:
        result = project_create_service.create("Widget")
        bare = git_host_service.repo_path(result["id"])
        dest = self.tmp / "clone"
        git(self.tmp, "clone", str(bare), str(dest))

        ignored = (dest / ".gitignore").read_text()
        for noise in ("*-backups/", "*.kicad_prl", "*.lck", "RemoteLibrary/"):
            self.assertIn(noise, ignored)

    def test_a_nameless_project_is_refused(self) -> None:
        with self.assertRaisesRegex(CreateError, "name is required"):
            project_create_service.create("   ")

    # -- adopt -------------------------------------------------------------

    def test_adopt_leaves_the_users_tree_exactly_where_it_was(self) -> None:
        tree = make_tree(self.tmp / "mine")

        result = project_create_service.adopt(str(tree))

        self.assertEqual(result["origin_owner"], "prism")
        # Still there, still a working tree, contents untouched.
        self.assertTrue((tree / "board.kicad_pro").is_file())
        self.assertEqual(
            git(tree, "rev-parse", "--is-bare-repository"), "false"
        )
        # It gained a remote pointing at the repo Prism now hosts.
        self.assertEqual(
            git(tree, "remote", "get-url", "origin"),
            str(git_host_service.repo_path(result["id"])),
        )

    def test_adopt_takes_its_name_from_the_folder_by_default(self) -> None:
        tree = make_tree(self.tmp / "CIAA_ACC")
        self.assertEqual(project_create_service.adopt(str(tree))["name"], "CIAA_ACC")

    def test_adopting_a_folder_that_is_not_a_repo_is_refused(self) -> None:
        """The real CIAA_ACC case. Turning a pile of files into a repo is deliberately a
        separate, explicit act: a `git add -A` on someone's project folder is how you commit
        3 GB of build output and a private key."""
        plain = self.tmp / "just-files"
        plain.mkdir()
        (plain / "board.kicad_pcb").write_text("")

        with self.assertRaisesRegex(CreateError, "not a git repository"):
            project_create_service.adopt(str(plain))

    def test_adopting_a_missing_folder_is_refused(self) -> None:
        with self.assertRaisesRegex(CreateError, "not a folder"):
            project_create_service.adopt(str(self.tmp / "nope"))

    def test_a_failed_adoption_leaves_no_orphaned_repo(self) -> None:
        plain = self.tmp / "just-files"
        plain.mkdir()

        with self.assertRaises(CreateError):
            project_create_service.adopt(str(plain))

        # Nothing half-made left behind for the user to trip over.
        repos = list(git_host_service.repos_root().glob("*.git"))
        self.assertTrue(all(not git_host_service.is_empty(p.stem) for p in repos))


if __name__ == "__main__":
    unittest.main()
