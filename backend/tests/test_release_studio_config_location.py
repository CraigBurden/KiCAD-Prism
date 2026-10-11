"""AC-32: one place for a monorepo subproject's Release Studio configurations.

Settings saves a subproject's configuration under the subproject
(``<sub>/.prism/release-studio/configurations``) with paths relative to the
subproject. Reading at a commit (candidates, builds, the at-commit listing)
must find it there, and hand builds repository paths, because the closure is
the whole repository.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.release_studio.config import (
    ConfigLoadError,
    list_configuration_keys,
    parse_configuration_yaml,
    technical_config_digest,
)
from app.services import release_studio_config_service as config_service
from app.services.project_revision import ProjectLocation
from support.repo import git, set_identity  # noqa: E402


def _config(title: str, board: str = "board.kicad_pcb", schematic: str = "board.kicad_sch") -> str:
    return (
        "schema: prism.release-studio.configuration/1\n"
        f"title: {title}\n"
        f"board: {board}\n"
        f"schematic: {schematic}\n"
        "default_variant: default\n"
    )


def _write(root: Path, relative: str, text: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


CONFIG_DIR = ".prism/release-studio/configurations"


class MonorepoConfigurationLocationTests(unittest.TestCase):
    """Two subprojects in one repository, each with its own configuration."""

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.remote = self.root / "remote.git"
        self.repo = self.root / "repo"
        git(self.root, "init", "--bare", "--initial-branch=main", str(self.remote))
        git(self.root, "clone", str(self.remote), str(self.repo))
        set_identity(self.repo)
        for sub in ("alpha", "beta"):
            _write(self.repo, f"{sub}/board.kicad_pcb", f"{sub} board\n")
            _write(self.repo, f"{sub}/board.kicad_sch", f"{sub} schematic\n")
            _write(self.repo, f"{sub}/{CONFIG_DIR}/release.yaml", _config(f"{sub} release"))
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "two subprojects")
        git(self.repo, "push", "-u", "origin", "main")
        self.commit = git(self.repo, "rev-parse", "HEAD")

    def _located(self, sub: str):
        location = ProjectLocation(self.repo.resolve(), sub)
        row = {"id": f"project-{sub}", "path": str(location.checkout)}
        return (
            patch("app.services.project_revision.locate_id", return_value=location),
            patch("app.services.project_revision.locate", return_value=location),
            patch("app.services.workspace_service.workspace.get_project_by_id", return_value=row),
        )

    def _listing(self, sub: str, commit: str) -> dict[str, dict]:
        first, second, third = self._located(sub)
        with first, second, third:
            rows = config_service.list_configurations_at_commit(f"project-{sub}", commit)
        return {row["config_key"]: row for row in rows}

    def test_each_subproject_reads_its_own_configuration_at_a_commit(self) -> None:
        for sub in ("alpha", "beta"):
            with self.subTest(sub=sub):
                rows = self._listing(sub, self.commit)
                self.assertEqual(sorted(rows), ["release"])
                self.assertEqual(rows["release"]["title"], f"{sub} release")
                # Builds join these to the closure, which is the whole repository.
                self.assertEqual(rows["release"]["board_rel"], f"{sub}/board.kicad_pcb")
                self.assertEqual(rows["release"]["schematic_rel"], f"{sub}/board.kicad_sch")

    def test_a_candidate_without_a_snapshot_reads_its_subproject_configuration(self) -> None:
        expected = parse_configuration_yaml(
            _config("beta release", "beta/board.kicad_pcb", "beta/board.kicad_sch")
        )
        candidate = {
            "config_key": "release",
            "commit_sha": self.commit,
            "technical_config_digest": technical_config_digest(expected),
        }
        first, second, third = self._located("beta")
        with first, second, third:
            config = config_service.configuration_for_candidate("project-beta", candidate)
        self.assertEqual(config["title"], "beta release")
        self.assertEqual(config["board"], "beta/board.kicad_pcb")

    def test_a_saved_configuration_is_read_back_from_where_it_was_written(self) -> None:
        document = parse_configuration_yaml(_config("alpha production"))
        first, second, third = self._located("alpha")
        with first, second, third, patch.object(config_service, "sync_configurations", return_value=[
            {"config_key": "production"}
        ]):
            saved = config_service.save_configuration(
                "project-alpha", "production", document, author_email="designer@example.com"
            )
        self.assertEqual(saved["path"], f"alpha/{CONFIG_DIR}/production.yaml")

        alpha = self._listing("alpha", saved["commit_sha"])
        beta = self._listing("beta", saved["commit_sha"])
        self.assertEqual(sorted(alpha), ["production", "release"])
        self.assertEqual(alpha["production"]["board_rel"], "alpha/board.kicad_pcb")
        self.assertEqual(sorted(beta), ["release"])

    def test_a_subproject_does_not_read_configurations_at_the_repository_root(self) -> None:
        """D30/D31: no repository-root fallback; registry and at-commit listing agree."""

        _write(self.repo, f"{CONFIG_DIR}/legacy.yaml", _config("root legacy", "alpha/board.kicad_pcb", "alpha/board.kicad_sch"))
        _write(self.repo, f"{CONFIG_DIR}/release.yaml", _config("root release", "beta/board.kicad_pcb", "beta/board.kicad_sch"))
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "root configurations")
        commit = git(self.repo, "rev-parse", "HEAD")

        alpha = self._listing("alpha", commit)
        self.assertEqual(sorted(alpha), ["release"])
        self.assertEqual(alpha["release"]["title"], "alpha release")

        candidate = {"config_key": "legacy", "commit_sha": commit, "technical_config_digest": "x"}
        first, second, third = self._located("alpha")
        with first, second, third, self.assertRaises(ConfigLoadError):
            config_service.configuration_for_candidate("project-alpha", candidate)

        # The Settings registry is built from the subproject checkout's own files.
        registry = list_configuration_keys(self.repo / "alpha")
        self.assertEqual(registry, sorted(alpha))


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
