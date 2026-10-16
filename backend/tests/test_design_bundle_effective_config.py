"""Effective-config resolution (revision-key.md §4.4) and working-tree keys (§9, cases wt1-wt6)."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unicodedata
import unittest
from pathlib import Path
from unittest import mock

from app.services.design_bundle import effective_config as ec
from app.services.design_bundle import revision_key as rk
from support.repo import git

USB_PD = Path("/Users/Swaroop/Personal-Projects/USB-PD-Trigger-Board")
FAKE_LFS_CLEAN = """import hashlib, sys
data = sys.stdin.buffer.read()
if data.startswith(b"version https://git-lfs.github.com/spec/v1\\n"):
    sys.stdout.buffer.write(data)
else:
    sys.stdout.buffer.write(b"version https://git-lfs.github.com/spec/v1\\noid sha256:%s\\nsize %d\\n"
                            % (hashlib.sha256(data).hexdigest().encode(), len(data)))
"""


def _repo(root: Path, files: dict[str, str | bytes]) -> Path:
    git(None, "init", "-q", "-b", "main", str(root))
    for rel, content in files.items():
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
    _commit(root, "init")
    return root


def _commit(root: Path, message: str) -> str:
    git(root, "add", "-A")
    git(root, "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", message)
    return git(root, "rev-parse", "HEAD")


def _ref(project_dir: str = "", anchor: str = "", stored: dict | None = None) -> ec.ProjectRef:
    return ec.ProjectRef(project_dir=project_dir, anchor=anchor, stored=stored or {})


class ResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))

    def test_two_projects_in_one_directory_each_get_their_own_sheet_and_board(self) -> None:
        """The test revision-key.md §13 requires of WP-K: default globs, anchor-only attribution."""

        repo = _repo(self.tmp / "r", {
            "fixture/top.kicad_pro": "{}", "fixture/top.kicad_sch": "(kicad_sch)", "fixture/top.kicad_pcb": "(kicad_pcb)",
            "fixture/base.kicad_pro": "{}", "fixture/base.kicad_sch": "(kicad_sch)", "fixture/base.kicad_pcb": "(kicad_pcb)",
            "fixture/.prism.json": json.dumps({"designOutputs": "out"}),
        })
        top = ec.key_at_commit(repo, _ref("fixture", "top.kicad_pro"), "HEAD")
        base = ec.key_at_commit(repo, _ref("fixture", "base.kicad_pro"), "HEAD")
        self.assertEqual(
            (top.config["root_schematic"], top.config["board"]), ("fixture/top.kicad_sch", "fixture/top.kicad_pcb")
        )
        self.assertEqual(
            (base.config["root_schematic"], base.config["board"]), ("fixture/base.kicad_sch", "fixture/base.kicad_pcb")
        )
        self.assertEqual(top.config["excluded_dirs"], ["fixture/Manufacturing-Outputs", "fixture/out"])
        self.assertEqual(top.key.entries, base.key.entries)  # one repository-wide source set
        self.assertNotEqual(top.key.revision_key, base.key.revision_key)

    def test_the_anchor_is_exact_with_no_directory_fallback(self) -> None:
        repo = _repo(self.tmp / "r", {"p/other.kicad_pro": "{}", "p/board.kicad_pcb": "(kicad_pcb)"})
        absent = ec.key_at_commit(repo, _ref("p", "gone.kicad_pro"), "HEAD")
        self.assertTrue(absent.absent)
        self.assertEqual(absent.absent_project_file, "p/gone.kicad_pro")
        # A board whose stem differs from the anchor's is not this project's ...
        other = ec.key_at_commit(repo, _ref("p", "other.kicad_pro"), "HEAD")
        self.assertNotIn("board", other.config)
        self.assertIn("board-unresolved", other.notes)
        # ... unless a setting names it.
        named = ec.key_at_commit(repo, _ref("p", "other.kicad_pro", {"pcb": "board.kicad_pcb"}), "HEAD")
        self.assertEqual(named.config["board"], "p/board.kicad_pcb")
        self.assertEqual(named.notes, ())
        # A legacy anchor that is not a .kicad_pro is absent too.
        self.assertTrue(ec.key_at_commit(repo, _ref("p", "board.kicad_pcb"), "HEAD").absent)

    def test_stored_settings_override_the_committed_file_at_commits(self) -> None:
        repo = _repo(self.tmp / "r", {
            "a.kicad_pro": "{}", "a.kicad_pcb": "(kicad_pcb)", "alt/b.kicad_pcb": "(kicad_pcb)",
            ".prism.json": json.dumps({"pcb": "alt/b.kicad_pcb", "projects": {"a.kicad_pro": {"designOutputs": "gen"}}}),
        })
        committed = ec.key_at_commit(repo, _ref("", "a.kicad_pro"), "HEAD")
        self.assertEqual(committed.config["board"], "alt/b.kicad_pcb")
        self.assertEqual(committed.config["excluded_dirs"], ["Manufacturing-Outputs", "gen"])
        stored = ec.key_at_commit(repo, _ref("", "a.kicad_pro", {"pcb": "a.kicad_pcb", "designOutputs": " "}), "HEAD")
        self.assertEqual(stored.config["board"], "a.kicad_pcb")
        self.assertEqual(stored.config["excluded_dirs"], ["Design-Outputs", "Manufacturing-Outputs"])  # blank is unset
        self.assertNotEqual(committed.key.revision_key, stored.key.revision_key)

    def test_zone_fills_comes_from_the_stored_setting_alone(self) -> None:
        repo = _repo(self.tmp / "r", {"a.kicad_pro": "{}", ".prism.json": json.dumps({"zone_fills": "saved"})})
        self.assertNotIn("zone_fills", ec.key_at_commit(repo, _ref("", "a.kicad_pro"), "HEAD").config)
        saved = ec.key_at_commit(repo, _ref("", "a.kicad_pro", {"zone_fills": "saved"}), "HEAD")
        self.assertEqual(saved.config["zone_fills"], "saved")
        self.assertNotIn("zone_fills", ec.key_at_commit(repo, _ref("", "a.kicad_pro", {"zone_fills": ""}), "HEAD").config)

    def test_excluded_dirs_drop_unusable_values(self) -> None:
        repo = _repo(self.tmp / "r", {"sub/a.kicad_pro": "{}", "sub/a.kicad_pcb": "(kicad_pcb)"})
        cases = {
            "": ["sub/Design-Outputs", "sub/y"],  # blank is unset: the default applies
            "/abs": ["sub/y"],  # absolute
            "../../up": ["sub/y"],  # leaves the repository
            "../up": ["sub/y", "up"],  # outside the project directory, inside the repository
            "out*": ["sub/y"],  # a glob
            ".": ["sub/y"],  # would contain the project file
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                settings = {"designOutputs": value, "manufacturingOutputs": "x/../y"}
                key = ec.key_at_commit(repo, _ref("sub", "a.kicad_pro", settings), "HEAD")
                self.assertEqual(key.config["excluded_dirs"], expected)
        nested = ec.key_at_commit(repo, _ref("sub", "a.kicad_pro", {"designOutputs": "o", "manufacturingOutputs": "o/m"}), "HEAD")
        self.assertEqual(nested.config["excluded_dirs"], ["sub/o"])

    def test_an_invalid_committed_settings_file_is_noted_not_fatal(self) -> None:
        repo = _repo(self.tmp / "r", {"a.kicad_pro": "{}", ".prism.json": "[1, 2]"})
        key = ec.key_at_commit(repo, _ref("", "a.kicad_pro"), "HEAD")
        self.assertIn("prism-json-invalid", key.notes)
        self.assertFalse(key.absent)

    def test_the_config_is_one_function_of_the_listing(self) -> None:
        repo = _repo(self.tmp / "r", {"a.kicad_pro": "{}", "a.kicad_sch": "(kicad_sch)"})
        commit = ec.key_at_commit(repo, _ref("", "a.kicad_pro"), "HEAD")
        worktree = ec.key_of_worktree(repo, _ref("", "a.kicad_pro"))
        self.assertEqual(commit.config, worktree.config)
        self.assertEqual(commit.key.revision_key, worktree.key.revision_key)


class StoredZoneFillsTests(unittest.TestCase):
    """K's settings API accepts only "saved" or unset (revision-key.md §4.4 step 5)."""

    def _save(self, value):
        from unittest import mock

        from app.services import path_config_service, project_settings_service

        stored: dict = {}
        fake = mock.Mock()
        fake.get_project_by_id.return_value = {"id": "p1", "path_settings": {"pcb": "x.kicad_pcb"}}
        fake.update_project.side_effect = lambda _id, path_settings: stored.update(path_settings.obj) or True
        with mock.patch("app.services.workspace_service.workspace", fake):
            project_settings_service.save({"id": "p1", "path": ""}, path_config_service.PathConfig(zone_fills=value))
        return stored

    def test_saved_and_unset_are_stored(self) -> None:
        self.assertEqual(self._save("saved")["zone_fills"], "saved")
        self.assertEqual(self._save(" ")["zone_fills"], "")
        self.assertEqual(self._save("saved")["pcb"], "x.kicad_pcb")

    def test_anything_else_is_refused(self) -> None:
        from app.core.errors import DomainError

        for value in ("refill", "SAVED", 1):
            with self.subTest(value=value):
                with self.assertRaises(DomainError) as caught:
                    self._save(value)
                self.assertEqual(caught.exception.status_code, 422)


class WorkingTreeTests(unittest.TestCase):
    """revision-key.md §9, §13: working-tree key == temp-index ``git add -A`` key == commit key afterwards."""

    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))

    def _temp_index_key(self, repo: Path, config: dict) -> str:
        gitdir = Path(git(repo, "rev-parse", "--absolute-git-dir"))
        index = self.tmp / f"index-{repo.name}"
        if (gitdir / "index").exists():
            shutil.copyfile(gitdir / "index", index)
        with mock.patch.dict(os.environ, {"GIT_INDEX_FILE": str(index)}):
            git(repo, "add", "-A")
            tree = git(repo, "write-tree")
        listing = rk.parse_ls_tree(rk.git(repo, "ls-tree", "-r", "-z", "--full-tree", tree))
        return rk.compute(listing, config, rk.object_format_of(repo)).revision_key

    def _check(self, repo: Path, ref: ec.ProjectRef, *, equal_head: bool | None, commit_after: bool = True, temp_index: bool = True):
        worktree = ec.key_of_worktree(repo, ref)
        head = ec.key_at_commit(repo, ref, "HEAD")
        if temp_index:
            self.assertEqual(worktree.key.revision_key, self._temp_index_key(repo, worktree.config))
        if equal_head is not None:
            self.assertEqual(worktree.key.revision_key == head.key.revision_key, equal_head)
        if commit_after:
            _commit(repo, "after")
            self.assertEqual(ec.key_at_commit(repo, ref, "HEAD").key.revision_key, worktree.key.revision_key)
        return worktree

    def _usb_pd(self, name: str) -> Path:
        return _repo(self.tmp / name, {
            "USB-PD.kicad_pro": "{}\n", "USB-PD.kicad_sch": "(kicad_sch (version 20250114))\n",
            "USB-PD.kicad_pcb": "(kicad_pcb (version 20241229))\n", "Subsheets/Out.kicad_sch": "(kicad_sch)\n",
            "packages3D/a.STEP": "solid\n", "packages3D/b.stp": "solid b\n", "fp-lib-table": "(fp_lib_table)\n",
            "README.md": "readme\n", ".gitignore": "*.bak\n",
        })

    def test_wt1_a_clean_tree_has_the_key_of_head(self) -> None:
        repo = self._usb_pd("wt1")
        self._check(repo, _ref("", "USB-PD.kicad_pro"), equal_head=True)

    def test_wt2_a_crlf_checkout_keeps_its_key(self) -> None:
        repo = _repo(self.tmp / "wt2", {".gitattributes": "* text=auto\n", "e.kicad_pro": "{}\n", "e.kicad_sch": b"(kicad_sch\n)\n"})
        (repo / "e.kicad_sch").write_bytes(b"(kicad_sch\r\n)\r\n")
        self._check(repo, _ref("", "e.kicad_pro"), equal_head=True)

    def test_wt3_lfs_without_and_with_the_clean_filter(self) -> None:
        script = self.tmp / "fake_lfs_clean.py"
        script.write_text(FAKE_LFS_CLEAN, encoding="utf-8")
        repo = self.tmp / "wt3"
        git(None, "init", "-q", "-b", "main", str(repo))
        git(repo, "config", "filter.lfs.clean", f"{sys.executable} {script}")
        (repo / ".gitattributes").write_text("*.step filter=lfs\n", encoding="utf-8")
        (repo / "proj.kicad_pro").write_text("{}\n", encoding="utf-8")
        (repo / "models").mkdir()
        (repo / "models/big.step").write_bytes(b"hydrated model content\n" * 50)
        _commit(repo, "lfs")
        self.assertTrue(git(repo, "cat-file", "-p", "HEAD:models/big.step").startswith("version https://git-lfs"))
        ref = _ref("", "proj.kicad_pro")
        git(repo, "config", "--unset", "filter.lfs.clean")
        if shutil.which("git-lfs") is None:  # 3a: hashed hydrated, so it differs from HEAD, with one warning
            # (No temp-index check: the index's stat data still matches the pointer it staged.)
            without = self._check(repo, ref, equal_head=False, commit_after=False, temp_index=False)
            self.assertEqual([w["code"] for w in without.warnings], ["lfs-filter-unavailable"])
        git(repo, "config", "filter.lfs.clean", f"{sys.executable} {script}")
        with_filter = self._check(repo, ref, equal_head=True)  # 3b
        self.assertEqual(with_filter.warnings, ())

    def test_wt4_modified_untracked_deleted_ignored_chmod_symlink_and_embedded_repository(self) -> None:
        repo = self._usb_pd("wt4")
        (repo / ".gitignore").write_text("*.bak\nignored/\n", encoding="utf-8")
        (repo / "Subsheets/Out.kicad_sch").write_text("(kicad_sch (edited))\n", encoding="utf-8")
        (repo / "Subsheets/New.kicad_sch").write_text("(kicad_sch (new))\n", encoding="utf-8")
        (repo / "packages3D/b.stp").unlink()
        (repo / "ignored").mkdir()
        (repo / "ignored/foo.step").write_text("ignored\n", encoding="utf-8")
        os.chmod(repo / "fp-lib-table", 0o755)
        os.symlink("packages3D", repo / "models-link")
        embedded = _repo(repo / "vendor-emb", {"x.kicad_mod": "(footprint x)\n"})
        worktree = self._check(repo, _ref("", "USB-PD.kicad_pro"), equal_head=False)
        paths = {e["path"]: e for e in worktree.key.entries}
        self.assertEqual(paths["fp-lib-table"]["kind"], "executable")
        self.assertEqual(paths["models-link"]["kind"], "symlink")
        self.assertEqual(paths["vendor-emb"]["object_id"], git(embedded, "rev-parse", "HEAD"))
        self.assertNotIn("ignored/foo.step", paths)
        self.assertNotIn("packages3D/b.stp", paths)

    def test_wt5_an_nfd_name_with_precompose_true_and_false(self) -> None:
        for precompose in ("true", "false"):
            with self.subTest(precompose=precompose):
                repo = _repo(self.tmp / f"wt5-{precompose}", {"only.kicad_pro": "{}\n"})
                git(repo, "config", "core.precomposeunicode", precompose)
                name = unicodedata.normalize("NFD", "Résumé.kicad_sch").encode("utf-8")
                with open(os.path.join(os.fsencode(repo), name), "wb") as handle:
                    handle.write(b"(kicad_sch (nfd))\n")
                self._check(repo, _ref("", "only.kicad_pro"), equal_head=False)

    @unittest.skipUnless(USB_PD.is_dir(), "the developer's USB-PD-Trigger-Board checkout")
    def test_wt6_usb_pd_trigger_board_as_it_stands(self) -> None:
        repo = self.tmp / "wt6"
        shutil.copytree(USB_PD, repo, symlinks=True)
        self._check(repo, _ref("", "USB-PD-Trigger-Board.kicad_pro"), equal_head=None)


if __name__ == "__main__":
    unittest.main()
