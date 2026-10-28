"""Where a repository's git origin is, and who owns it.

**`origin_owner` must be derived from git, not from `url`.** The stored `url` holds a
real remote for a cloned repo but a plain filesystem path for a local import, and the
two are indistinguishable to a client. Only git actually knows.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api._helpers import _row_to_project  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.workspace_service import WorkspaceService, _git_origin  # noqa: E402
from support.repo import git  # noqa: E402

DATABASE_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


class TempDirTestCase(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name)


class GitOriginTests(TempDirTestCase):
    """Reading the real origin."""

    def test_a_repo_with_a_remote_reports_it(self) -> None:
        repo = self.tmp / "with-remote"
        repo.mkdir()
        git(repo, "init")
        git(repo, "remote", "add", "origin", "https://github.com/x/y.git")
        self.assertEqual(_git_origin(str(repo)), "https://github.com/x/y.git")

    def test_a_repo_with_no_remote_reports_nothing(self) -> None:
        repo = self.tmp / "no-remote"
        repo.mkdir()
        git(repo, "init")
        self.assertEqual(_git_origin(str(repo)), "")

    def test_a_plain_directory_reports_nothing(self) -> None:
        """The real CIAA_ACC case: a registered project that is not a git repo at all.
        Legitimate, not an error."""
        plain = self.tmp / "not-a-repo"
        plain.mkdir()
        self.assertEqual(_git_origin(str(plain)), "")

    def test_a_missing_directory_reports_nothing(self) -> None:
        self.assertEqual(_git_origin(str(self.tmp / "gone")), "")


@unittest.skipUnless(DATABASE_URL, "PRISM_DATABASE_URL is required for workspace origin tests")
class RepositoryOriginTests(TempDirTestCase):
    """Classifying a repository, and what reaches a client.

    These run against the configured PostgreSQL, which on a developer machine is the
    real workspace. Without cleanup they left rows behind, so a second run collided on
    the unique `url` ("Key (url)=(u) already exists") and the suite only passed once
    per database. Every repository registered here is dropped again, which also keeps
    the tests from accumulating junk projects in a live workspace.
    """

    def setUp(self) -> None:
        super().setUp()
        environment = patch.object(settings, "KICAD_PROJECTS_ROOT", str(self.tmp))
        environment.start()
        self.addCleanup(environment.stop)

        self.ws = WorkspaceService()
        self.ws.initialize()

        registered: list[str] = []
        original = self.ws.register_repository

        def tracking_register(*args, **kwargs):
            repo_id = original(*args, **kwargs)
            registered.append(repo_id)
            return repo_id

        self.ws.register_repository = tracking_register  # type: ignore[method-assign]

        def remove_registered() -> None:
            with self.ws._connect() as conn:
                for repo_id in registered:
                    # Projects reference the repository, so they go first.
                    conn.execute("DELETE FROM ws_projects WHERE repo_id=%s", (repo_id,))
                    conn.execute("DELETE FROM ws_repositories WHERE id=%s", (repo_id,))
                conn.commit()

        self.addCleanup(remove_registered)

    def test_a_cloned_repo_is_external(self) -> None:
        repo = self.tmp / "cloned"
        repo.mkdir()
        git(repo, "init")
        git(repo, "remote", "add", "origin", "https://gitlab.com/a/b")

        rid = self.ws.register_repository(
            name="cloned", url="https://gitlab.com/a/b", clone_path_abs=str(repo)
        )
        row = self.ws.get_repository(rid)
        self.assertEqual(row["origin_owner"], "external")
        self.assertEqual(row["origin_url"], "https://gitlab.com/a/b")

    def test_a_local_import_with_no_git_is_none_not_external(self) -> None:
        """The `url` here is a FILESYSTEM PATH the user picked, not a remote. Trusting it
        would tell a client to `git clone C:\\Users\\...`, which is nonsense off-machine.
        Saying "none" is the honest answer."""
        plain = self.tmp / "desktop-project"
        plain.mkdir()

        rid = self.ws.register_repository(
            name="desktop-project", url=str(plain), clone_path_abs=str(plain)
        )
        row = self.ws.get_repository(rid)
        self.assertEqual(row["origin_owner"], "none")
        self.assertFalse(row["origin_url"])

    def test_a_caller_that_knows_the_owner_is_believed(self) -> None:
        """Phase 5 hosts the origin itself, so it does not need us to guess."""
        repo = self.tmp / "prism-hosted"
        repo.mkdir()

        rid = self.ws.register_repository(
            name="prism-hosted",
            url="x",
            clone_path_abs=str(repo),
            origin_url="https://prism.example.com/git/prj_abc.git",
            origin_owner="prism",
        )
        row = self.ws.get_repository(rid)
        self.assertEqual(row["origin_owner"], "prism")

    def test_the_origin_does_reach_a_client(self) -> None:
        repo = self.tmp / "proj"
        repo.mkdir()
        git(repo, "init")
        git(repo, "remote", "add", "origin", "https://github.com/x/y")
        rid = self.ws.register_repository(name="proj", url="u", clone_path_abs=str(repo))
        self.ws.register_project(repo_id=rid, name="proj", relative_path=".")
        # The project this call just made, not whatever sorts first in the workspace.
        # Indexing [0] read someone else's project on a database with real content.
        row = next(p for p in self.ws.get_all_projects() if p["repo_id"] == rid)
        payload = json.loads(_row_to_project(row).model_dump_json())

        self.assertEqual(payload["origin_url"], "https://github.com/x/y")
        self.assertEqual(payload["origin_owner"], "external")


if __name__ == "__main__":
    unittest.main()
