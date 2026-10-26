"""Existing checkouts made with core.autocrlf=true are converted to the committed bytes."""

from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.services.checkout_line_endings import CLONE_ARGS, convert_existing


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "-C", str(repo), *args],
        capture_output=True, text=True, check=True,
    )
    return done.stdout


class ConvertExistingTests(unittest.TestCase):
    def _crlf_checkout(self) -> Path:
        source = Path(self.enterContext(tempfile.TemporaryDirectory())) / "src"
        source.mkdir()
        git(source, "init", "-q")
        (source / "a.kicad_sch").write_bytes(b"(kicad_sch)\n")
        git(source, "add", "-A")
        git(source, "commit", "-q", "-m", "x")
        clone = source.parent / "clone"
        subprocess.run(["git", "clone", "-q", "-c", "core.autocrlf=true", str(source), str(clone)], check=True)
        return clone

    def test_converts_a_clean_crlf_checkout(self) -> None:
        clone = self._crlf_checkout()
        self.assertEqual((clone / "a.kicad_sch").read_bytes(), b"(kicad_sch)\r\n")
        self.assertTrue(convert_existing(clone))
        self.assertEqual((clone / "a.kicad_sch").read_bytes(), b"(kicad_sch)\n")
        self.assertEqual(git(clone, "status", "--porcelain").strip(), "")
        self.assertFalse(convert_existing(clone))

    def test_leaves_a_tree_with_local_edits_alone(self) -> None:
        clone = self._crlf_checkout()
        (clone / "a.kicad_sch").write_bytes(b"(kicad_sch (edited))\r\n")
        self.assertFalse(convert_existing(clone))
        self.assertEqual((clone / "a.kicad_sch").read_bytes(), b"(kicad_sch (edited))\r\n")

    def test_clone_args_keep_lf(self) -> None:
        source = Path(self.enterContext(tempfile.TemporaryDirectory())) / "src"
        source.mkdir()
        git(source, "init", "-q")
        (source / "a.txt").write_bytes(b"x\n")
        git(source, "add", "-A")
        git(source, "commit", "-q", "-m", "x")
        clone = source.parent / "clone"
        system = source.parent / "system.gitconfig"
        system.write_text("[core]\n\tautocrlf = true\n")
        env = {key: value for key, value in os.environ.items() if key != "GIT_CONFIG_NOSYSTEM"}
        env["GIT_CONFIG_SYSTEM"] = str(system)
        subprocess.run(["git", "clone", "-q", *CLONE_ARGS, str(source), str(clone)], check=True, env=env)
        self.assertEqual((clone / "a.txt").read_bytes(), b"x\n")


if __name__ == "__main__":
    unittest.main()
