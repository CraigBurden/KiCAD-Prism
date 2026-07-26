"""Tests for the derived asset store and the guarantee that it keeps the
user's Git checkout untouched."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.services import derived_assets


class ThumbnailStorageStaysOutsideTheCheckout(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.root = Path(self._temporary.name)
        # KICAD_PROJECTS_ROOT is a computed property on the settings model, so
        # the store's own root function is the patch point.
        patcher = mock.patch.object(
            derived_assets, "derived_root", return_value=self.root / "derived"
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._temporary.cleanup)
        self.checkout = self.root / "projects" / "type1" / "board"
        self.checkout.mkdir(parents=True)

    def _write_render(self, content: bytes = b"render-bytes") -> Path:
        staging = derived_assets.thumbnail_dir(self.checkout)
        staging.mkdir(parents=True, exist_ok=True)
        source = staging / ".encode-tmp.webp"
        source.write_bytes(content)
        return source

    def test_stored_thumbnail_is_not_written_into_the_checkout(self) -> None:
        derived_assets.store_thumbnail(self.checkout, self._write_render())
        # The whole point: nothing lands in the working tree.
        self.assertEqual(list(self.checkout.iterdir()), [])

    def test_stored_thumbnail_can_be_found_again(self) -> None:
        stored, digest, size = derived_assets.store_thumbnail(
            self.checkout, self._write_render()
        )
        found = derived_assets.find_thumbnail(self.checkout)
        self.assertEqual(found, stored)
        self.assertEqual(size, len(b"render-bytes"))
        self.assertTrue(digest)

    def test_regenerating_replaces_rather_than_accumulates(self) -> None:
        derived_assets.store_thumbnail(self.checkout, self._write_render(b"first"))
        derived_assets.store_thumbnail(self.checkout, self._write_render(b"second"))
        directory = derived_assets.thumbnail_dir(self.checkout)
        self.assertEqual(len(list(directory.glob("thumbnail.*.webp"))), 1)
        found = derived_assets.find_thumbnail(self.checkout)
        assert found is not None
        self.assertEqual(found.read_bytes(), b"second")

    def test_two_projects_do_not_share_a_thumbnail(self) -> None:
        other = self.root / "projects" / "type2" / "repo" / "board-b"
        other.mkdir(parents=True)
        derived_assets.store_thumbnail(self.checkout, self._write_render(b"a"))
        self.assertIsNone(derived_assets.find_thumbnail(other))

    def test_missing_thumbnail_reads_as_none(self) -> None:
        self.assertIsNone(derived_assets.find_thumbnail(self.checkout))

    def test_discard_removes_the_stored_thumbnail(self) -> None:
        derived_assets.store_thumbnail(self.checkout, self._write_render())
        derived_assets.discard(self.checkout)
        self.assertIsNone(derived_assets.find_thumbnail(self.checkout))


class LegacyInTreeThumbnailCleanup(unittest.TestCase):
    """Checkouts made by an older Prism carry generated thumbnails in-tree."""

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.checkout = Path(self._temporary.name)
        self.addCleanup(self._temporary.cleanup)
        self.thumbnails = self.checkout / "assets" / "thumbnail"
        self.thumbnails.mkdir(parents=True)

    def _repo(self, tracked: list[str]) -> mock.Mock:
        repo = mock.Mock()
        repo.working_tree_dir = str(self.checkout)
        repo.git.ls_files.return_value = "\n".join(tracked)
        return repo

    def test_untracked_generated_thumbnail_is_removed(self) -> None:
        stale = self.thumbnails / "thumbnail.0123456789abcdef.webp"
        stale.write_bytes(b"x")
        removed = derived_assets.purge_legacy_in_tree_thumbnails(
            self.checkout, self._repo([])
        )
        self.assertEqual(removed, [stale.name])
        self.assertFalse(stale.exists())

    def test_committed_thumbnail_is_left_alone(self) -> None:
        # Someone deliberately committed this; it is the team's own asset and
        # removing it would be data loss.
        committed = self.thumbnails / "thumbnail.0123456789abcdef.webp"
        committed.write_bytes(b"x")
        removed = derived_assets.purge_legacy_in_tree_thumbnails(
            self.checkout,
            self._repo(["assets/thumbnail/thumbnail.0123456789abcdef.webp"]),
        )
        self.assertEqual(removed, [])
        self.assertTrue(committed.exists())

    def test_unrelated_images_are_left_alone(self) -> None:
        other = self.thumbnails / "board-photo.png"
        other.write_bytes(b"x")
        removed = derived_assets.purge_legacy_in_tree_thumbnails(
            self.checkout, self._repo([])
        )
        self.assertEqual(removed, [])
        self.assertTrue(other.exists())

    def test_checkout_without_the_directory_is_a_no_op(self) -> None:
        bare = Path(self._temporary.name) / "elsewhere"
        bare.mkdir()
        self.assertEqual(
            derived_assets.purge_legacy_in_tree_thumbnails(bare, self._repo([])), []
        )

    def test_unreadable_git_index_leaves_the_checkout_untouched(self) -> None:
        # Without a trustworthy tracked-file list there is no safe deletion.
        stale = self.thumbnails / "thumbnail.0123456789abcdef.webp"
        stale.write_bytes(b"x")
        repo = self._repo([])
        repo.git.ls_files.side_effect = RuntimeError("not a git repository")
        self.assertEqual(
            derived_assets.purge_legacy_in_tree_thumbnails(self.checkout, repo), []
        )
        self.assertTrue(stale.exists())


if __name__ == "__main__":
    unittest.main()
