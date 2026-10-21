"""Tests for scripts/fetch_sim_engines.py: pinning, checksums and the optional path."""

from __future__ import annotations

import hashlib
import io
import json
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fetch_sim_engines as fetch  # noqa: E402


def _archive(name: str = "prism-sim-v0.1.0-linux-x64") -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as bundle:
        for member, body in ((f"{name}/bin/sim-worker", b"#!/bin/sh\n"), (f"{name}/engines.json", b"[]")):
            info = tarfile.TarInfo(member)
            info.size = len(body)
            bundle.addfile(info, io.BytesIO(body))
    return buffer.getvalue()


class FetchSimEnginesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.payload = _archive()
        self.lock = self.tmp / "lock.json"
        self.lock.write_text(json.dumps({
            "schema": "prism.sim.engines.lock.a0",
            "repository": "owner/engines",
            "tag": "v0.1.0",
            "assets": {"linux-x64": {"archive": "prism-sim-v0.1.0-linux-x64.tar.gz",
                                     "sha256": hashlib.sha256(self.payload).hexdigest()}},
        }))

    def run_main(self, *argv: str, env: dict[str, str] | None = None) -> int:
        with mock.patch.object(sys, "argv", ["fetch", "--lock", str(self.lock), *argv]), \
                mock.patch.dict("os.environ", env or {}, clear=True):
            return fetch.main()

    def test_installs_the_pinned_archive(self) -> None:
        dest = self.tmp / "bin"
        with mock.patch.object(fetch, "download_asset", return_value=self.payload) as download:
            code = self.run_main("--platform", "linux-x64", "--dest", str(dest), env={"GH_TOKEN": "t"})
        self.assertEqual(code, 0)
        download.assert_called_once_with("owner/engines", "v0.1.0", "prism-sim-v0.1.0-linux-x64.tar.gz", "t")
        self.assertTrue((dest / "sim-worker").is_file())
        self.assertTrue((dest / "sim-worker").stat().st_mode & 0o111)
        self.assertTrue((dest / "engines.json").is_file())

    def test_refuses_a_checksum_mismatch(self) -> None:
        dest = self.tmp / "bin"
        with mock.patch.object(fetch, "download_asset", return_value=self.payload + b"x"):
            code = self.run_main("--platform", "linux-x64", "--dest", str(dest), env={"GH_TOKEN": "t"})
        self.assertEqual(code, 1)
        self.assertFalse(dest.exists())

    def test_without_a_token_optional_installs_nothing_and_required_fails(self) -> None:
        dest = self.tmp / "bin"
        with mock.patch.object(fetch, "download_asset") as download:
            self.assertEqual(self.run_main("--platform", "linux-x64", "--dest", str(dest), "--optional"), 0)
            self.assertEqual(self.run_main("--platform", "linux-x64", "--dest", str(dest)), 1)
        download.assert_not_called()

    def test_a_token_file_wins_and_an_empty_one_falls_back_to_the_environment(self) -> None:
        token_file = self.tmp / "token"
        token_file.write_text("from-file\n")
        self.assertEqual(fetch.read_token(str(token_file)), "from-file")
        token_file.write_text("")
        with mock.patch.dict("os.environ", {"PRISM_SIM_RELEASE_TOKEN": "from-env"}, clear=True):
            self.assertEqual(fetch.read_token(str(token_file)), "from-env")

    def test_an_unpinned_platform_fails(self) -> None:
        self.assertEqual(self.run_main("--platform", "windows-x64", "--dest", str(self.tmp / "bin"), env={"GH_TOKEN": "t"}), 1)


if __name__ == "__main__":
    unittest.main()
