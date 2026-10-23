"""The revision key and the source-revision key (WP-R2 keeps the live readers).

The semantic index itself is a design-bundle member; ``test_semantic_index_bundle``
covers the readers. This file covers the cache-identity helpers the catalog,
comment anchors and Sim Studio call.
"""

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.services import project_revision, semantic_index_service
from support.repo import commit_all, init_repo  # noqa: E402


class SourceRevisionKeyTests(unittest.TestCase):
    def test_source_revision_key_ignores_heavy_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / "board.kicad_pro"
            schematic = root / "board.kicad_sch"
            model = root / "board.glb"
            project.write_text("project-a", encoding="utf-8")
            schematic.write_text("schematic-a", encoding="utf-8")
            model.write_bytes(b"model-a")

            initial = semantic_index_service.source_revision_key_for_project_file(project)
            model.write_bytes(b"model-b")
            self.assertEqual(semantic_index_service.source_revision_key_for_project_file(project), initial)

            schematic.write_text("schematic-b", encoding="utf-8")
            self.assertNotEqual(semantic_index_service.source_revision_key_for_project_file(project), initial)

    def test_source_revision_key_ignores_kicad_generated_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / "board.kicad_pro"
            project.write_text("project-a", encoding="utf-8")
            (root / "board.kicad_sch").write_text("schematic-a", encoding="utf-8")
            autosave = root / "_autosave-board.kicad_sch"
            remote = root / "RemoteLibrary" / "symbols" / "remote.kicad_sym"
            remote.parent.mkdir(parents=True)
            autosave.write_text("autosave-a", encoding="utf-8")
            remote.write_text("remote-a", encoding="utf-8")

            initial = semantic_index_service.source_revision_key_for_project_file(project)
            autosave.write_text("autosave-b", encoding="utf-8")
            remote.write_text("remote-b", encoding="utf-8")
            self.assertEqual(semantic_index_service.source_revision_key_for_project_file(project), initial)


class RevisionIdentityTests(unittest.TestCase):
    """A revision has to be identifiable without materializing it.

    Resolving a commit means extracting the whole repository into a temporary
    directory. Doing that before checking the cache made every hit pay for a
    miss, which on a large repository is most of the cost of a comparison.
    """

    def _repository(self, root: Path, project_dir: str) -> Path:
        board = root / project_dir if project_dir else root
        board.mkdir(parents=True, exist_ok=True)
        (board / "board.kicad_pro").write_text("{}", encoding="utf-8")
        (board / "board.kicad_sch").write_text("(kicad_sch)", encoding="utf-8")
        (board / "notes.md").write_text("not a semantic source", encoding="utf-8")
        init_repo(root)
        commit_all(root, "board")
        return board

    def test_a_commit_and_the_working_tree_agree_on_the_key(self) -> None:
        """Otherwise the two paths cache the same content under two names."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            board = self._repository(root, "boards/main")
            project = SimpleNamespace(id="p1", path=str(board))

            from_disk, _ = semantic_index_service._revision_identity(project, None)
            from_commit, resolved = semantic_index_service._revision_identity(
                project, "HEAD"
            )

            self.assertEqual(from_disk, from_commit)
            self.assertEqual(len(resolved), 40)

    def test_a_project_at_the_repository_root_resolves(self) -> None:
        """The listing takes no pathspec in this case; it is easy to get wrong."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            board = self._repository(root, "")
            project = SimpleNamespace(id="p1", path=str(board))

            from_disk, _ = semantic_index_service._revision_identity(project, None)
            from_commit, _ = semantic_index_service._revision_identity(project, "HEAD")

            self.assertEqual(from_disk, from_commit)

    def test_a_non_semantic_file_does_not_change_the_key(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            board = self._repository(root, "boards/main")
            project = SimpleNamespace(id="p1", path=str(board))
            before, _ = semantic_index_service._revision_identity(project, None)

            (board / "notes.md").write_text("edited", encoding="utf-8")
            (board / "fab.zip").write_bytes(b"\x00\x01")

            after, _ = semantic_index_service._revision_identity(project, None)
            self.assertEqual(before, after)

    def test_editing_a_schematic_does_change_the_key(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            board = self._repository(root, "boards/main")
            project = SimpleNamespace(id="p1", path=str(board))
            before, _ = semantic_index_service._revision_identity(project, None)

            (board / "board.kicad_sch").write_text("(kicad_sch (symbol))", encoding="utf-8")

            after, _ = semantic_index_service._revision_identity(project, None)
            self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
