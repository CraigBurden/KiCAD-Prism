"""A page's design-data reads share the revision work instead of repeating it.

Opening EDA-04903's schematic read 42 sheets, and every read re-ran a full-tree
``ls-tree``, a ``git status`` and the archive's §9 checks: ~0.7 s each. The key
of a resolved commit is memoized (a commit never changes), concurrent readers
share one ``git status`` that started after they arrived, and a validated
archive is reused while its file is unchanged.
"""

from __future__ import annotations

import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

from app.core.config import settings
from app.services.design_bundle import effective_config, revision_key as rk, store
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit
from support.repo import commit_all, init_repo
from tests.test_design_bundle_store import RK, _manifest, _members, _write

FILES = {
    "board/demo.kicad_pro": '{"meta": {"filename": "demo.kicad_pro"}}\n',
    "board/demo.kicad_sch": "(kicad_sch (version 20260306))\n",
    "board/demo.kicad_pcb": "(kicad_pcb (version 20260206))\n",
}


class _CountingGit:
    def __init__(self) -> None:
        self.calls: list[tuple[str, ...]] = []
        self._real = rk.git
        self._lock = threading.Lock()

    def __call__(self, repo, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        with self._lock:
            self.calls.append(args)
        return self._real(repo, *args, **kwargs)

    def count(self, verb: str) -> int:
        return sum(1 for call in self.calls if call and call[0] == verb)


class RevisionKeyMemoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="read-caches-")))
        init_repo(self.root, FILES)
        self.ref = ProjectRef(project_dir="board", anchor="demo.kicad_pro")
        self.counting = _CountingGit()
        self.enterContext(mock.patch.object(rk, "git", self.counting))
        self.enterContext(mock.patch.object(effective_config, "_KEYS_AT_COMMIT", effective_config.OrderedDict()))

    def test_a_resolved_commit_is_listed_once(self) -> None:
        first = key_at_commit(self.root, self.ref, "HEAD")
        again = key_at_commit(self.root, self.ref, "HEAD")
        self.assertIs(first, again)
        self.assertEqual(self.counting.count("ls-tree"), 1)

    def test_a_new_head_is_a_new_key(self) -> None:
        first = key_at_commit(self.root, self.ref, "HEAD")
        (self.root / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (edited))\n")
        commit_all(self.root, "edit")
        second = key_at_commit(self.root, self.ref, "HEAD")
        self.assertNotEqual(first.commit, second.commit)
        self.assertNotEqual(first.key.revision_key, second.key.revision_key)
        self.assertEqual(self.counting.count("ls-tree"), 2)


class SharedWorktreeStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="read-caches-")))
        init_repo(self.root, FILES)

    def test_a_burst_of_readers_shares_a_status(self) -> None:
        calls: list[float] = []
        real = rk._read_worktree_changes

        def slow(repo):  # noqa: ANN001
            calls.append(time.monotonic())
            time.sleep(0.2)
            return real(repo)

        with mock.patch.object(rk, "_read_worktree_changes", slow):
            threads = [threading.Thread(target=rk.worktree_changes, args=(self.root,)) for _ in range(12)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertLessEqual(len(calls), 2, "twelve concurrent readers, at most two git status runs")

    def test_a_later_reader_sees_a_later_edit(self) -> None:
        self.assertEqual(rk.worktree_changes(self.root), [])
        (self.root / "board/demo.kicad_pcb").write_text("(kicad_pcb (version 20260206) (edited))\n")
        self.assertIn(b"board/demo.kicad_pcb", rk.worktree_changes(self.root))


class ArchiveReuseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.enterContext(mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_ROOT", str(self.tmp / "bundles")))
        self.enterContext(mock.patch.object(store, "_opened", store.OrderedDict()))
        self.members = _members()
        self.manifest = _manifest(self.members)
        self.digest = "c" * 64
        self.path = store.prepare("proj-1", RK, self.digest)
        _write(self.path, self.manifest, self.members)

    def _open(self):
        return store.open_bundle("proj-1", RK, self.digest, self.manifest["bundle_key"])

    def test_an_unchanged_archive_is_validated_once(self) -> None:
        with mock.patch.object(store, "open_archive", wraps=store.open_archive) as opened:
            self._open()
            self._open()
        self.assertEqual(opened.call_count, 1)

    def test_a_replaced_archive_is_validated_again(self) -> None:
        self._open()
        replacement = self.path.with_suffix(".new")
        _write(replacement, self.manifest, self.members)
        replacement.replace(self.path)
        with mock.patch.object(store, "open_archive", wraps=store.open_archive) as opened:
            self._open()
        self.assertEqual(opened.call_count, 1)

    def test_the_verified_flag_follows_the_marker_not_the_cache(self) -> None:
        archive = self._open()
        store.write_marker(archive, "proj-1", RK, self.digest)
        self.assertTrue(self._open().verified)
        store.marker_path("proj-1", RK, self.digest).unlink()
        self.assertFalse(self._open().verified)


if __name__ == "__main__":
    unittest.main()
