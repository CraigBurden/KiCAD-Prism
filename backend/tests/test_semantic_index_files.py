import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import semantic_index_service

INDEX = {
    "components": [{"reference": "R1", "pcbRefs": ["R1"], "value": "10k"}],
    "nets": [{"name": "VCC"}],
    "terminals": [{"reference": "R1", "pin": "1", "pcbPadUuid": "p1", "netName": "VCC"}],
}


class ArtifactFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(self.root, ignore_errors=True))
        self.project = SimpleNamespace(id="prj")
        for patcher in (
            mock.patch.object(semantic_index_service, "_revision_identity", return_value=("key", None)),
            mock.patch.object(semantic_index_service, "semantic_index_root", return_value=self.root),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.path = semantic_index_service.artifact_path("prj", "key")

    def test_builds_only_when_missing_and_never_parses(self) -> None:
        stale = self.root / "prj" / "key" / "0.1.0-old-build"
        stale.mkdir(parents=True)
        neighbour = self.root / "prj" / "other-revision" / "0.1.0-old-build"
        neighbour.mkdir(parents=True)

        with mock.patch.object(semantic_index_service, "build_semantic_index", return_value=INDEX) as builder, \
                mock.patch.object(semantic_index_service, "_project_file_for_revision") as source:
            source.return_value.__enter__.return_value = (Path("b.kicad_pro"), None)
            self.assertEqual(semantic_index_service.artifact_file(self.project), (self.path, "key"))
            self.assertEqual(semantic_index_service.artifact_file(self.project), (self.path, "key"))
        builder.assert_called_once()
        # Older builds of this revision go; other revisions are left alone.
        self.assertFalse(stale.exists())
        self.assertTrue(neighbour.exists())
        # Stored compact: the identity endpoint sends the file as is.
        self.assertNotIn("\n", self.path.read_text())
        self.assertEqual(json.loads(self.path.read_text()), INDEX)


if __name__ == "__main__":
    unittest.main()
