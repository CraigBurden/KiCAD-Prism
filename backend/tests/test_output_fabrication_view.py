"""Fabrication viewer for committed output files.

Handlers are called directly with the project lookup and the git reads patched.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException  # noqa: E402

from app.core import errors  # noqa: E402
from app.services.file_service import FileItem  # noqa: E402
from tests.test_fabrication_view_service import package_files  # noqa: E402


#: A router's HTTPException or a service's typed error; the client sees the same body.
REFUSED = (HTTPException, errors.DomainError)


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
            patch.object(self.api.project_outputs, "output_dir", lambda *_a: str(self.root)),
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
        (self.root / "docs").mkdir()
        (self.root / "docs" / "readme.txt").write_text("hi")
        with self.assertRaises(REFUSED) as caught:
            self._view(folder="docs")
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_package_reaches_into_its_subfolders(self) -> None:
        # CAM exports keep the drill files in a folder of their own.
        gerbers = self.root / "gerbers"
        drills = gerbers / "drill-data"
        drills.mkdir()
        (gerbers / "board.drl").rename(drills / "board.drl")
        self.assertEqual(self._view()["drill"]["holes"], 4)
        # The output folder itself is the whole package.
        self.assertEqual(self._view(folder="")["drill"]["holes"], 4)

    def test_subfolders_deeper_than_the_limit_and_hidden_ones_are_not_read(self) -> None:
        gerbers = self.root / "gerbers"
        deep = gerbers / "a" / "b" / "c" / "d"
        deep.mkdir(parents=True)
        (gerbers / "board.drl").rename(deep / "board.drl")
        self.assertEqual(self._view()["drill"]["holes"], 0)
        hidden = gerbers / ".cache"
        hidden.mkdir()
        (deep / "board.drl").rename(hidden / "board.drl")
        self.assertEqual(self._view()["drill"]["holes"], 0)

    def test_a_second_export_is_left_out_of_the_package(self) -> None:
        # A vendor pack beside the plots: the same board under other names.
        vendor = self.root / "gerbers" / "vendors" / "jlcpcb"
        vendor.mkdir(parents=True)
        for name in ("CuTop.gbr", "CuBottom.gbr", "EdgeCuts.gbr"):
            (vendor / name).write_bytes((self.root / "gerbers" / "board-F_Cu.gtl").read_bytes())
        files = [layer["file"] for layer in self._view()["layers"]]
        self.assertNotIn("CuTop.gbr", files)
        self.assertIn("board-F_Cu.gtl", files)
        # The vendor export still opens on its own.
        self.assertIn("CuTop.gbr", [layer["file"] for layer in self._view(folder="gerbers/vendors/jlcpcb")["layers"]])

    def test_limits_measure_the_export_shown_not_the_whole_tree(self) -> None:
        archive = self.root / "archive" / "rev-a"
        archive.mkdir(parents=True)
        for index in range(5):
            (archive / f"old-{index}.gbr").write_bytes(b"G04 old*\nM02*\n")
        # The output folder holds 13 layer files; the export shown holds 8.
        with patch.object(self.api, "_MAX_FILES", 9):
            self.assertIn("f.cu", [layer["id"] for layer in self._view(folder="")["layers"]])

    def test_a_missing_folder_is_404(self) -> None:
        with self.assertRaises(REFUSED) as caught:
            self._view(folder="nope")
        self.assertEqual(caught.exception.status_code, 404)

    def test_escaping_the_outputs_folder_is_rejected(self) -> None:
        for folder in ("..", "../x", "/etc", "gerbers/../../x"):
            with self.subTest(folder), self.assertRaises(REFUSED) as caught:
                self._view(folder=folder)
            self.assertIn(caught.exception.status_code, (400, 404))

    def test_an_unknown_output_type_is_400(self) -> None:
        with self.assertRaises(REFUSED) as caught:
            self._view(type="secrets")
        self.assertEqual(caught.exception.status_code, 400)

    def test_unknown_layer_is_404(self) -> None:
        with self.assertRaises(REFUSED) as caught:
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
        with patch.object(self.api, "_MAX_TOTAL_BYTES", 100), self.assertRaises(REFUSED) as caught:
            self._view()
        self.assertEqual(caught.exception.status_code, 413)
        self.assertIn("too large", caught.exception.detail)

    def test_oversized_and_overfull_folders_are_refused(self) -> None:
        with patch.object(self.api, "_MAX_FILES", 3), self.assertRaises(REFUSED) as caught:
            self._view()
        self.assertEqual(caught.exception.status_code, 413)
        with patch.object(self.api, "_MAX_FILE_BYTES", 10), self.assertRaises(REFUSED) as caught:
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
        # Drill files one folder down are part of the package; four down is not.
        placed = {
            name: "drill-data/board.drl" if name == "board.drl" else name for name in self.files
        }
        placed["board-F_Fab.gbr"] = "a/b/c/d/board-F_Fab.gbr"
        listing = [_item(name, len(self.files[name]), path=path) for name, path in placed.items()]
        listing += [_item("drill-data", 0, is_dir=True)]
        by_path = {path: self.files[name] for name, path in placed.items()}

        def read(_project, _commit, path, *, relative_prefix, not_found_detail):
            self.read_calls.append(f"{relative_prefix}/{path}")
            # CommitFile reads its blob from git lazily; the route only needs `content`.
            data = by_path[path]
            return SimpleNamespace(name=path.rsplit("/", 1)[-1], path=path, size=len(data), content=data)

        with (
            patch.object(self.api, "get_project_for_role_or_404", lambda *_a: object()),
            patch.object(self.api.project_outputs, "path_config_at", lambda *_a: _Config()),
            patch.object(self.api.project_outputs, "list_commit_files", lambda *_a: listing),
            patch.object(self.api.project_outputs, "read_commit_file", read),
        ):
            return self.api.get_output_fabrication_view("p1", "manufacturing", folder, commit, _User())

    def test_reads_the_folder_at_the_commit(self) -> None:
        view = self._view()
        self.assertEqual(view["size"], {"width": 20.0, "height": 10.0})
        self.assertTrue(all(call.startswith("Manufacturing-Outputs/gerbers/") for call in self.read_calls))

    def test_subfolders_are_read_to_the_depth_limit(self) -> None:
        view = self._view()
        self.assertEqual(view["drill"]["holes"], 4)
        self.assertIn("Manufacturing-Outputs/gerbers/drill-data/board.drl", self.read_calls)
        self.assertFalse(any("F_Fab" in call for call in self.read_calls))

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
            patch.object(self.api.project_outputs, "output_dir", lambda *_a: str(self.root)),
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
        with self.assertRaises(REFUSED) as caught:
            self._view("none")
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_folder_without_csv_is_404_and_traversal_is_refused(self) -> None:
        self._folder("empty", {"readme.txt": "x"})
        with self.assertRaises(REFUSED) as caught:
            self._view("empty")
        self.assertEqual(caught.exception.status_code, 404)
        with self.assertRaises(REFUSED) as caught:
            self._view("../x")
        self.assertIn(caught.exception.status_code, (400, 404))

    def test_a_top_and_a_bottom_file_are_read_together(self) -> None:
        header = "Ref,Val,Package,PosX,PosY,Rot,Side\n"
        self._folder("split", {
            "board-top-pos.csv": header + "C1,1u,C_0402,1,-1,0,top\n",
            "board-bottom-pos.csv": header + "R1,1k,R_0402,2,-2,0,bottom\n",
        })
        view = self._view("split")
        self.assertEqual(view["counts"]["placed"], 2)
        self.assertEqual((view["counts"]["top"], view["counts"]["bottom"]), (1, 1))

    def test_a_second_export_of_the_same_board_is_not_added_twice(self) -> None:
        pos, _, cpl, _ = self.texts
        # KiCad's positions and the JLCPCB CPL both hold C1.
        self._folder("both", {"board-pos.csv": pos, "CPL-board.csv": cpl})
        view = self._view("both")
        self.assertEqual(view["files"]["positions"], "board-pos.csv")
        self.assertEqual(view["counts"]["placed"], 4)

    def test_positions_and_bom_in_sibling_folders_of_the_output_folder(self) -> None:
        pos, bom, _, _ = self.texts
        # KiCad's `-pos` export with no extension, and a header-only bottom file.
        self._folder("XY-Data", {"-top-pos": pos, "-bottom-pos": "Ref,Val,Package,PosX,PosY,Rot,Side\n"})
        self._folder("BOM", {"board-BoM.csv": bom})
        view = self._view("")
        self.assertEqual(view["files"], {"positions": "XY-Data/-top-pos", "bom": "BOM/board-BoM.csv"})
        self.assertEqual(view["counts"]["placed"], 4)


if __name__ == "__main__":
    unittest.main()
