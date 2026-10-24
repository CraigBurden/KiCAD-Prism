"""Fabrication viewer for committed output files.

Handlers are called directly with the project lookup and the git reads patched.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException  # noqa: E402

from app.services.file_service import CommitFile, FileItem  # noqa: E402
from tests.test_fabrication_view_service import package_files  # noqa: E402


@dataclass
class _User:
    email: str = "viewer"
    role: str = "viewer"


class _Config:
    manufacturingOutputs = "Manufacturing-Outputs"
    designOutputs = "Design-Outputs"


def _item(name: str, size: int, *, is_dir: bool = False, path: str | None = None) -> FileItem:
    return FileItem(
        name=name, path=path or name, size=size, modified_date="", type="gbr", is_dir=is_dir
    )


class OutputFabricationViewTests(unittest.TestCase):
    def setUp(self) -> None:
        from app.api import fabrication_view as api

        self.api = api
        api._cache.clear()
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        gerbers = self.root / "gerbers"
        gerbers.mkdir()
        for name, data in package_files().items():
            (gerbers / name).write_bytes(data)
        (gerbers / "notes.pdf").write_bytes(b"%PDF")
        (gerbers / "logo.gif").write_bytes(b"GIF89a")
        (self.root / "readme.txt").write_text("hi")
        self.reads = 0

    def _patches(self):
        return (
            patch.object(self.api, "get_project_for_role_or_404", lambda *_a: object()),
            patch.object(self.api.projects_api, "_resolve_output_dir", lambda *_a: str(self.root)),
        )

    def _view(self, folder="gerbers", commit=None, type="manufacturing"):
        p1, p2 = self._patches()
        with p1, p2:
            return self.api.get_output_fabrication_view("p1", type, folder, commit, _User())

    def _layer(self, layer_id, folder="gerbers", commit=None):
        p1, p2 = self._patches()
        with p1, p2:
            return self.api.get_output_fabrication_layer("p1", layer_id, "manufacturing", folder, commit, _User())

    def test_a_folder_of_gerbers_becomes_a_view(self) -> None:
        view = self._view()
        self.assertEqual(view["size"], {"width": 20.0, "height": 10.0})
        self.assertEqual(view["drill"]["holes"], 4)
        self.assertIn("f.cu", [layer["id"] for layer in view["layers"]])

    def test_non_layer_files_are_ignored(self) -> None:
        names = [layer["file"] for layer in self._view()["layers"]]
        self.assertNotIn("notes.pdf", names)
        self.assertNotIn("logo.gif", names)

    def test_layer_svg_is_served_sandboxed_and_not_cached_forever(self) -> None:
        response = self._layer("f.cu")
        self.assertEqual(response.media_type, "image/svg+xml")
        self.assertIn(b"<svg", response.body)
        self.assertIn("sandbox", response.headers["Content-Security-Policy"])
        self.assertEqual(response.headers["Cache-Control"], "private, no-cache")

    def test_a_folder_without_gerbers_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._view(folder="")
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_missing_folder_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._view(folder="nope")
        self.assertEqual(caught.exception.status_code, 404)

    def test_escaping_the_outputs_folder_is_rejected(self) -> None:
        for folder in ("..", "../x", "/etc", "gerbers/../../x"):
            with self.subTest(folder), self.assertRaises(HTTPException) as caught:
                self._view(folder=folder)
            self.assertIn(caught.exception.status_code, (400, 404))

    def test_an_unknown_output_type_is_400(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._view(type="secrets")
        self.assertEqual(caught.exception.status_code, 400)

    def test_unknown_layer_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._layer("nope")
        self.assertEqual(caught.exception.status_code, 404)

    def test_the_package_is_parsed_once_until_a_file_changes(self) -> None:
        self._view()
        self._layer("f.cu")
        self.assertEqual(len(self.api._cache), 1)

        (self.root / "gerbers" / "board-F_Cu.gtl").write_bytes(package_files()["board-F_Cu.gtl"] + b"G04 edit*\n")
        self._view()
        self.assertEqual(len(self.api._cache), 2)

    def test_a_folder_that_is_too_big_in_total_is_refused(self) -> None:
        # Each file is within its own limit; together they are not.
        with patch.object(self.api, "_MAX_TOTAL_BYTES", 100), self.assertRaises(HTTPException) as caught:
            self._view()
        self.assertEqual(caught.exception.status_code, 413)
        self.assertIn("too large", caught.exception.detail)

    def test_oversized_and_overfull_folders_are_refused(self) -> None:
        with patch.object(self.api, "_MAX_FILES", 3), self.assertRaises(HTTPException) as caught:
            self._view()
        self.assertEqual(caught.exception.status_code, 413)
        with patch.object(self.api, "_MAX_FILE_BYTES", 10), self.assertRaises(HTTPException) as caught:
            self._view()
        self.assertEqual(caught.exception.status_code, 413)


class CommitFabricationViewTests(unittest.TestCase):
    def setUp(self) -> None:
        from app.api import fabrication_view as api

        self.api = api
        api._cache.clear()
        self.files = package_files()
        self.read_calls: list[str] = []

    def _view(self, folder="gerbers", commit="a" * 40):
        listing = [_item(name, len(data)) for name, data in self.files.items()]
        listing += [_item("sub", 0, is_dir=True), _item("deep.gbr", 5, path="sub/deep.gbr")]

        def read(_project, _commit, name, *, relative_prefix, not_found_detail):
            self.read_calls.append(f"{relative_prefix}/{name}")
            return CommitFile(name=name, path=name, content=self.files[name])

        with (
            patch.object(self.api, "get_project_for_role_or_404", lambda *_a: object()),
            patch.object(self.api.projects_api, "_path_config_from_commit", lambda *_a: _Config()),
            patch.object(self.api.projects_api, "_files_from_commit", lambda *_a: listing),
            patch.object(self.api.projects_api, "_read_commit_file", read),
        ):
            return self.api.get_output_fabrication_view("p1", "manufacturing", folder, commit, _User())

    def test_reads_the_folder_at_the_commit(self) -> None:
        view = self._view()
        self.assertEqual(view["size"], {"width": 20.0, "height": 10.0})
        self.assertTrue(all(call.startswith("Manufacturing-Outputs/gerbers/") for call in self.read_calls))

    def test_only_direct_children_are_read(self) -> None:
        self._view()
        self.assertFalse(any("deep.gbr" in call for call in self.read_calls))

    def test_a_second_request_for_the_same_commit_does_not_read_git_again(self) -> None:
        self._view()
        first = len(self.read_calls)
        self._view()
        self.assertEqual(len(self.read_calls), first)

    def test_a_branch_name_is_never_a_cache_key(self) -> None:
        # A branch can move without any file in the folder changing size.
        self._view(commit="main")
        first = len(self.read_calls)
        self._view(commit="main")
        self.assertGreater(len(self.read_calls), first)
        self.assertEqual(len(self.api._cache), 0)

    def test_a_different_commit_is_a_different_package(self) -> None:
        self._view(commit="a" * 40)
        self._view(commit="b" * 40)
        self.assertEqual(len(self.api._cache), 2)


if __name__ == "__main__":
    unittest.main()


class OutputPlacementTests(unittest.TestCase):
    """The position file and BOM are found by content, whatever they are called."""

    def setUp(self) -> None:
        from app.api import fabrication_view as api
        from tests.test_placement_service import JLC_BOM, JLC_CPL, KICAD_BOM, KICAD_POS

        self.api = api
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.texts = (KICAD_POS, KICAD_BOM, JLC_CPL, JLC_BOM)

    def _folder(self, name: str, files: dict[str, str]) -> None:
        folder = self.root / name
        folder.mkdir()
        for filename, text in files.items():
            (folder / filename).write_text(text, encoding="utf-8")

    def _view(self, folder: str):
        with (
            patch.object(self.api, "get_project_for_role_or_404", lambda *_a: object()),
            patch.object(self.api.projects_api, "_resolve_output_dir", lambda *_a: str(self.root)),
        ):
            return self.api.get_output_placement("p1", "manufacturing", folder, None, _User())

    def test_kicad_files_by_content(self) -> None:
        pos, bom, _, _ = self.texts
        self._folder("kicad", {"board-pos.csv": pos, "board.csv": bom, "notes.csv": "a,b\n1,2\n"})
        view = self._view("kicad")
        self.assertEqual(view["files"], {"positions": "board-pos.csv", "bom": "board.csv"})
        self.assertEqual(view["counts"]["placed"], 4)
        self.assertEqual([item["ref"] for item in view["missing"]], ["R5"])

    def test_jlcpcb_files_where_the_bom_also_has_a_designator_column(self) -> None:
        _, _, cpl, bom = self.texts
        self._folder("jlc", {"CPL-board.csv": cpl, "BOM-board.csv": bom})
        view = self._view("jlc")
        self.assertEqual(view["files"], {"positions": "CPL-board.csv", "bom": "BOM-board.csv"})
        self.assertEqual(view["counts"]["notInBom"], 0)

    def test_positions_alone_are_enough(self) -> None:
        self._folder("alone", {"positions.csv": self.texts[0]})
        view = self._view("alone")
        self.assertFalse(view["hasBom"])

    def test_no_position_file_is_404(self) -> None:
        self._folder("none", {"bom.csv": self.texts[1]})
        with self.assertRaises(HTTPException) as caught:
            self._view("none")
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_folder_without_csv_is_404_and_traversal_is_refused(self) -> None:
        self._folder("empty", {"readme.txt": "x"})
        with self.assertRaises(HTTPException) as caught:
            self._view("empty")
        self.assertEqual(caught.exception.status_code, 404)
        with self.assertRaises(HTTPException) as caught:
            self._view("../x")
        self.assertIn(caught.exception.status_code, (400, 404))
