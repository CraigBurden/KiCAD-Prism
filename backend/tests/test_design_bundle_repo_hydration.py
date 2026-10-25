"""LFS hydration at import and sync (``repo_hydration.hydrate``)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.services.design_bundle import repo_hydration
from support.repo import git, init_repo


class LfsHydrationTests(unittest.TestCase):
    def test_lfs_objects_are_fetched_for_every_prebuild_commit(self) -> None:
        # Found on v5.0.1: `git lfs fetch --recent` skipped a branch not
        # updated in a week, so its bundle could not materialize a 3D model.
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            init_repo(repo, {"board/demo.kicad_pro": "{}\n"})
            git(repo, "checkout", "-q", "-b", "old-feature")
            (repo / "board/demo.kicad_pro").write_text('{"old": true}\n', encoding="utf-8")
            git(repo, "commit", "-qam", "old feature")
            old = git(repo, "rev-parse", "HEAD")
            git(repo, "checkout", "-q", "main")
            git(repo, "tag", "v1")
            head = git(repo, "rev-parse", "HEAD")
            calls: list[list[str]] = []

            def run(_repo, args, _env):
                calls.append(args)
                return True, ""

            with mock.patch.object(repo_hydration.shutil, "which", return_value="/usr/bin/git-lfs"), \
                    mock.patch.object(repo_hydration, "_run", side_effect=run):
                report = repo_hydration.hydrate(repo)
        self.assertEqual(report["lfs"], "fetched")
        self.assertEqual(calls[0], ["lfs", "pull"])
        self.assertEqual(calls[1][:3], ["lfs", "fetch", "origin"])
        self.assertEqual(sorted(calls[1][3:]), sorted([head, old]))
        self.assertNotIn("--recent", calls[1])
