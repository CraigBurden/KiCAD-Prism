"""The one-off cleanup of the on-disk stores the design bundle superseded (WP-R4)."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.core.config import settings
from app.services.superseded_store_cleanup import (
    MARKER_NAME,
    SCHEMA,
    cleanup_superseded_stores,
)


class SupersededStoreCleanupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temporary, True)
        self.root = self.temporary / "projects"
        self.state = self.root / ".kicad-prism"
        self.state.mkdir(parents=True)
        self.patch = mock.patch.object(settings, "KICAD_PROJECTS_ROOT", str(self.root))
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def _write(self, relative: str, size: int) -> Path:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"x" * size)
        return path

    def test_removes_the_retired_directories_and_reports_their_bytes(self) -> None:
        self._write(".kicad-prism/semantic-index/prj/a.json", 100)
        self._write(".kicad-prism/semantic-index/prj/b.json", 40)
        # The old 3D commit index lived inside semantic-visualizer.
        self._write(".kicad-prism/semantic-visualizer/prj/commit-index.json", 60)
        self._write(".kicad-prism/semantic-visualizer/prj/.cache/scene.json", 10)
        bundle = self._write(".kicad-prism/bundles/prj/key/generator.prism", 30)
        artifact = self._write(".kicad-prism/artifacts/objects/aa", 20)
        project = self._write("type1/prj/prj.kicad_pro", 5)

        result = cleanup_superseded_stores()

        self.assertTrue(result["ran"])
        self.assertEqual(result["bytes"], 210)
        self.assertEqual(result["refused"], [])
        with self.assertLogs("app.services.superseded_store_cleanup", level="INFO") as logs:
            # A second root proves the log line, without reusing the marker above.
            other = self.temporary / "logged"
            (other / ".kicad-prism" / "semantic-index").mkdir(parents=True)
            (other / ".kicad-prism" / "semantic-index" / "a").write_bytes(b"x" * 3)
            logged = cleanup_superseded_stores(root=other)
        self.assertTrue(logged["ran"])
        self.assertIn("reclaimed 3 bytes", "\n".join(logs.output))
        self.assertEqual(
            sorted(Path(item["path"]).name for item in result["removed"]),
            ["semantic-index", "semantic-visualizer"],
        )
        self.assertFalse((self.state / "semantic-index").exists())
        self.assertFalse((self.state / "semantic-visualizer").exists())
        # Everything else under the data root is untouched.
        self.assertEqual(bundle.read_bytes(), b"x" * 30)
        self.assertEqual(artifact.read_bytes(), b"x" * 20)
        self.assertEqual(project.read_bytes(), b"x" * 5)

        marker = json.loads((self.state / MARKER_NAME).read_text(encoding="utf-8"))
        self.assertEqual(marker["schema"], SCHEMA)
        self.assertEqual(marker["bytes"], 210)
        self.assertEqual(len(marker["removed"]), 2)

    def test_runs_once_even_if_a_retired_directory_reappears(self) -> None:
        self._write(".kicad-prism/semantic-index/prj/a.json", 10)
        first = cleanup_superseded_stores()
        self.assertTrue(first["ran"])
        self.assertEqual(first["bytes"], 10)

        reappeared = self._write(".kicad-prism/semantic-index/prj/new.json", 7)
        second = cleanup_superseded_stores()

        self.assertFalse(second["ran"])
        self.assertEqual(second["bytes"], 0)
        self.assertEqual(second["removed"], [])
        self.assertTrue(reappeared.is_file(), "the marker records the one run; later starts do nothing")

    def test_a_store_another_process_is_removing_counts_as_removed(self) -> None:
        # Each uvicorn worker runs the cleanup at startup; the first to delete a
        # directory leaves the other's rmtree finding it gone.
        self._write(".kicad-prism/semantic-index/prj/key/a.json", 10)
        real_rmdir = os.rmdir
        calls = []

        def rmdir_raced(path, *args, **kwargs):
            real_rmdir(path, *args, **kwargs)
            calls.append(path)
            if len(calls) == 1:
                raise FileNotFoundError(2, "No such file or directory", path)

        with mock.patch("os.rmdir", side_effect=rmdir_raced):
            result = cleanup_superseded_stores()

        self.assertTrue(result["ran"])
        self.assertEqual(result["refused"], [])
        self.assertEqual(len(result["removed"]), 1)
        self.assertFalse((self.state / "semantic-index").exists())

    def test_refuses_a_symlinked_store_instead_of_following_it(self) -> None:
        outside = self.temporary / "outside"
        target = outside / "keep.json"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"do not delete")
        (self.state / "semantic-index").symlink_to(outside, target_is_directory=True)
        self._write(".kicad-prism/semantic-visualizer/prj/commit-index.json", 11)

        result = cleanup_superseded_stores()

        self.assertTrue(result["ran"])
        self.assertEqual(result["bytes"], 11)
        self.assertTrue(target.is_file(), "a symlink must never lead to a delete outside the data root")
        self.assertTrue((self.state / "semantic-index").is_symlink())
        self.assertEqual([Path(item["path"]).name for item in result["refused"]], ["semantic-index"])
        self.assertFalse((self.state / "semantic-visualizer").exists())

    def test_refuses_a_state_directory_symlinked_outside_the_data_root(self) -> None:
        outside = self.temporary / "elsewhere" / ".kicad-prism"
        (outside / "semantic-index").mkdir(parents=True)
        (outside / "semantic-index" / "keep.json").write_bytes(b"keep")
        self.state.rmdir()
        self.state.symlink_to(outside, target_is_directory=True)

        result = cleanup_superseded_stores()

        self.assertFalse(result["ran"])
        self.assertEqual(result["bytes"], 0)
        self.assertTrue((outside / "semantic-index" / "keep.json").is_file())
        self.assertFalse((outside / MARKER_NAME).exists(), "no marker may be written outside the data root")

    def test_does_not_create_a_data_root_that_does_not_exist(self) -> None:
        shutil.rmtree(self.root)

        result = cleanup_superseded_stores()

        self.assertFalse(result["ran"])
        self.assertFalse(self.root.exists())
        self.assertFalse((self.root / ".kicad-prism" / MARKER_NAME).exists())


if __name__ == "__main__":
    unittest.main()
