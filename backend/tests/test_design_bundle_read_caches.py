"""A page's design-data reads share the revision work instead of repeating it.

Opening EDA-04903's schematic read 42 sheets, and every read re-ran a full-tree
``ls-tree``, a ``git status`` and the archive's §9 checks: ~0.7 s each. The key
of a resolved commit is memoized (a commit never changes), concurrent readers
share one ``git status`` that started after they arrived, and a validated
archive is reused while its file is unchanged.

The memo is bounded by count *and* by estimated bytes: one monorepo key retains
thousands of source-entry dictionaries, so 512 of them is hundreds of megabytes.
Commits of an unchanged project share one entries list, and a burst of cold
readers of one commit computes it once.
"""

from __future__ import annotations

import tempfile
import threading
import time
import unittest
import weakref
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


class BoundedRevisionKeyCacheTests(unittest.TestCase):
    """The memo pays for what it keeps, shares an unchanged project, and
    computes one key once when a burst of readers arrives."""

    def setUp(self) -> None:
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="key-bounds-")))
        init_repo(self.root, FILES)
        self.ref = ProjectRef(project_dir="board", anchor="demo.kicad_pro")
        self.enterContext(mock.patch.object(effective_config, "_KEYS_AT_COMMIT", effective_config.OrderedDict()))
        self.enterContext(mock.patch.object(effective_config, "_INFLIGHT", {}))
        self.enterContext(
            mock.patch.object(
                effective_config, "_SHARED_REVISION_KEYS", weakref.WeakValueDictionary()
            )
        )

    def _board_edit(self) -> str:
        with (self.root / "board/demo.kicad_sch").open("a", encoding="utf-8") as handle:
            handle.write("; edit\n")
        return commit_all(self.root, "board edit")

    def _unrelated_edit(self) -> str:
        with (self.root / "notes.md").open("a", encoding="utf-8") as handle:
            handle.write("note\n")
        return commit_all(self.root, "unrelated edit")

    def test_the_byte_budget_evicts_before_the_entry_limit(self) -> None:
        key_at_commit(self.root, self.ref, "HEAD")
        one_key = effective_config._keys_cache_bytes()
        self.assertGreater(one_key, 0)
        budget = one_key * 5 // 2
        with mock.patch.object(effective_config, "_KEYS_AT_COMMIT_MAX_BYTES", budget):
            for _ in range(6):
                key_at_commit(self.root, self.ref, self._board_edit())
            self.assertEqual(len(effective_config._KEYS_AT_COMMIT), 2)
            self.assertLessEqual(effective_config._keys_cache_bytes(), budget)
            newest = effective_config._KEYS_AT_COMMIT[next(reversed(effective_config._KEYS_AT_COMMIT))]
            self.assertEqual(newest.key.commit, rk.resolve_commit(self.root, "HEAD"))

    def test_the_entry_limit_still_applies(self) -> None:
        with mock.patch.object(effective_config, "_KEYS_AT_COMMIT_MAX", 2):
            for _ in range(4):
                key_at_commit(self.root, self.ref, self._board_edit())
            self.assertEqual(len(effective_config._KEYS_AT_COMMIT), 2)

    def test_a_key_over_the_whole_budget_is_still_kept(self) -> None:
        with mock.patch.object(effective_config, "_KEYS_AT_COMMIT_MAX_BYTES", 1):
            first = key_at_commit(self.root, self.ref, "HEAD")
            second = key_at_commit(self.root, self.ref, self._board_edit())
            self.assertEqual(len(effective_config._KEYS_AT_COMMIT), 1)
            kept = effective_config._KEYS_AT_COMMIT[next(reversed(effective_config._KEYS_AT_COMMIT))].key
            self.assertIs(kept, second)
            self.assertNotEqual(first.key.revision_key, second.key.revision_key)

    def test_an_unchanged_project_shares_one_revision_key(self) -> None:
        edited = key_at_commit(self.root, self.ref, self._board_edit())
        unchanged = key_at_commit(self.root, self.ref, self._unrelated_edit())
        self.assertIsNot(edited, unchanged)
        self.assertNotEqual(edited.commit, unchanged.commit)
        self.assertIs(edited.key, unchanged.key)

    def test_twenty_concurrent_misses_compute_one_key(self) -> None:
        computed: list[int] = []
        real = effective_config._keyed
        lock = threading.Lock()

        def slow(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
            with lock:
                computed.append(1)
            time.sleep(0.1)
            return real(*args, **kwargs)

        results: list[object] = [None] * 20
        gate = threading.Barrier(20)

        def request(slot: int) -> None:
            gate.wait()
            results[slot] = key_at_commit(self.root, self.ref, "HEAD")

        with mock.patch.object(effective_config, "_keyed", slow):
            threads = [threading.Thread(target=request, args=(slot,)) for slot in range(20)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertEqual(len(computed), 1, "one computation for twenty concurrent cold readers")
        self.assertTrue(all(isinstance(result, effective_config.ProjectKey) for result in results))
        self.assertEqual(len({id(result) for result in results}), 1)
        self.assertEqual(len({result.key.revision_key for result in results}), 1)

    def test_an_error_reaches_every_waiter_and_is_not_cached(self) -> None:
        computed: list[int] = []
        real = effective_config._keyed
        lock = threading.Lock()

        def fail_once(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
            with lock:
                computed.append(1)
                first = len(computed) == 1
            time.sleep(0.1)
            if first:
                raise rk.RevisionKeyError("git-failed", "boom")
            return real(*args, **kwargs)

        failures: list[BaseException] = []
        gate = threading.Barrier(8)

        def request() -> None:
            gate.wait()
            try:
                key_at_commit(self.root, self.ref, "HEAD")
            except BaseException as error:  # noqa: BLE001 - the test owns the outcome
                failures.append(error)

        with mock.patch.object(effective_config, "_keyed", fail_once):
            threads = [threading.Thread(target=request) for _ in range(8)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            self.assertEqual(len(computed), 1)
            self.assertEqual(len(failures), 8)
            self.assertTrue(all(failure is failures[0] for failure in failures))
            self.assertIsInstance(failures[0], rk.RevisionKeyError)
            self.assertEqual(failures[0].code, "git-failed")
            self.assertFalse(effective_config._KEYS_AT_COMMIT, "a failure is not cached")

            key = key_at_commit(self.root, self.ref, "HEAD")
            self.assertEqual(len(computed), 2, "the next call computes again")
            self.assertIsNotNone(key.key)


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
