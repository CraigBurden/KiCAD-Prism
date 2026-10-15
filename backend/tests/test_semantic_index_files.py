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
        self.path = self.root / "semantic-index.json"
        self.project = SimpleNamespace(id="prj")
        for patcher in (
            mock.patch.object(semantic_index_service, "_revision_identity", return_value=("key", None)),
            mock.patch.object(semantic_index_service, "artifact_path", return_value=self.path),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_builds_only_when_missing_and_never_parses(self) -> None:
        def build(project, commit, key, path):
            semantic_index_service._write_artifact(path, INDEX)

        with mock.patch.object(semantic_index_service, "_build_and_store", side_effect=build) as builder:
            self.assertEqual(semantic_index_service.artifact_file(self.project), (self.path, "key"))
            self.assertEqual(semantic_index_service.artifact_file(self.project), (self.path, "key"))
        builder.assert_called_once()
        # Stored compact: the identity endpoint sends the file as is.
        self.assertNotIn("\n", self.path.read_text())
        self.assertEqual(json.loads(self.path.read_text()), INDEX)


if __name__ == "__main__":
    unittest.main()
