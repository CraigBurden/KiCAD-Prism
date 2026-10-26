"""Removing a folder of read-only copies."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from app.release_studio.removal import remove_tree


class RemoveTreeTests(unittest.TestCase):
    def test_removes_read_only_files(self) -> None:
        root = Path(tempfile.mkdtemp()) / "models"
        copy = root / "abc" / "part.step"
        copy.parent.mkdir(parents=True)
        copy.write_bytes(b"x")
        os.chmod(copy, 0o444)
        remove_tree(root)
        self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()
