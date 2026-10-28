"""The Release Studio cover render cache: keys, hits, and retention."""

from __future__ import annotations

import io
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from app.release_studio.documents import artwork, render_cache
from tests.kicad_tool_fakes import FakeTool


def _png(colour: tuple[int, int, int, int] = (10, 20, 30, 255)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (8, 6), colour).save(buffer, format="PNG")
    return buffer.getvalue()


class CoverRenderCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self._temporary.cleanup)
        self.root = Path(self._temporary.name)
        self.cache = self.root / "projects" / ".kicad-prism" / "render-cache"
        patcher = mock.patch.object(render_cache, "cache_root", return_value=self.cache)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.board_dir = self.root / "refilled"
        self.board_dir.mkdir()
        self.board = self.board_dir / "demo.kicad_pcb"
        self.board.write_text("(kicad_pcb (version 20260206))\n", encoding="utf-8")
        # Every run writes a different picture, so a hit is visible in the bytes.
        self.pictures: list[bytes] = []

    def _tool(self, version: str = "10.0.7") -> FakeTool:
        def render(args, **_kwargs):  # noqa: ANN001
            self.pictures.append(_png((len(self.pictures), 40, 60, 255)))
            Path(args[args.index("-o") + 1]).write_bytes(self.pictures[-1])
            return None

        return FakeTool(render, version=version)

    def _render(self, tool: FakeTool, *, workdir: str = "w", width: int = 1200):
        return artwork.acquire_board_render(
            tool, self.board, self.root / workdir, width=width
        )

    def test_a_second_render_of_the_same_board_is_a_hit(self) -> None:
        tool = self._tool()
        first = self._render(tool, workdir="first")
        second = self._render(tool, workdir="second")

        self.assertEqual(len(tool.calls), 1)
        self.assertEqual(first, second)
        self.assertEqual(first.png_bytes, self.pictures[0])
        self.assertEqual(first.digest, second.digest)
        self.assertEqual((first.width_px, first.height_px), (8, 6))
        self.assertEqual([path.suffix for path in self.cache.iterdir()], [".png"])

    def test_changing_the_board_bytes_misses(self) -> None:
        tool = self._tool()
        self._render(tool)
        self.board.write_text("(kicad_pcb (version 20260206) (title changed))\n", encoding="utf-8")
        self._render(tool)

        self.assertEqual(len(tool.calls), 2)
        self.assertNotEqual(self.pictures[0], self.pictures[1])

    def test_changing_a_model_beside_the_board_misses(self) -> None:
        models = self.board_dir / "packages3D"
        models.mkdir()
        model = models / "part.step"
        model.write_bytes(b"first model")
        tool = self._tool()
        self._render(tool)
        model.write_bytes(b"second model")
        self._render(tool)

        self.assertEqual(len(tool.calls), 2)

    def test_changing_the_project_file_beside_the_board_misses(self) -> None:
        project = self.board_dir / "demo.kicad_pro"
        project.write_text('{"board": {}}', encoding="utf-8")
        tool = self._tool()
        self._render(tool)
        project.write_text('{"board": {"thickness": 2}}', encoding="utf-8")
        self._render(tool)

        self.assertEqual(len(tool.calls), 2)

    def test_changing_the_cli_version_misses(self) -> None:
        self._render(self._tool("10.0.7"))
        self._render(self._tool("10.0.8"))

        self.assertEqual(len(self.pictures), 2)

    def test_changing_the_render_size_misses(self) -> None:
        tool = self._tool()
        self._render(tool, width=1200)
        self._render(tool, width=800)

        self.assertEqual(len(tool.calls), 2)

    def test_changing_a_model_directory_binding_misses(self) -> None:
        tool = self._tool()
        with mock.patch.dict(os.environ, {"KICAD9_3DMODEL_DIR": "/models/one"}):
            self._render(tool)
        with mock.patch.dict(os.environ, {"KICAD9_3DMODEL_DIR": "/models/two"}):
            self._render(tool)

        self.assertEqual(len(tool.calls), 2)

    def test_an_unreadable_entry_is_rendered_again_and_replaced(self) -> None:
        tool = self._tool()
        key = render_cache.cache_key(
            board=self.board,
            render_args=[
                "pcb", "render", "--quality", "high", "--floor", "--perspective",
                "--rotate", "-45,0,45", "--width", "1200", "--height", "900",
                "-o", "<output>", "<board>",
            ],
            cli_version="10.0.7",
            environ=os.environ,
        )
        self.cache.mkdir(parents=True)
        (self.cache / f"{key}.png").write_bytes(b"not a png")

        render = self._render(tool)

        self.assertEqual(len(tool.calls), 1)
        self.assertEqual(render.png_bytes, self.pictures[0])
        self.assertEqual((self.cache / f"{key}.png").read_bytes(), self.pictures[0])

    def test_prune_keeps_recent_entries_and_sweeps_dead_parts(self) -> None:
        self.cache.mkdir(parents=True)
        past = time.time() - 60 * 86400
        old = self.cache / ("a" * 64 + ".png")
        part = self.cache / ("b" * 64 + ".png.1.part")
        fresh = self.cache / ("c" * 64 + ".png")
        for path in (old, part):
            path.write_bytes(b"old")
            os.utime(path, (past, past))
        fresh.write_bytes(b"new")

        report = render_cache.prune(unused_before=time.time() - 86400, now=time.time())

        self.assertEqual(report, {"removed": 1, "bytes": 3})
        self.assertEqual(sorted(path.name for path in self.cache.iterdir()), [fresh.name])


if __name__ == "__main__":
    unittest.main()
