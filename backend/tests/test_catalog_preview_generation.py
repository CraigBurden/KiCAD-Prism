from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.services.catalog.collaborators import build_catalog_collaborators
from app.services.catalog.locking import NoopCatalogLocks
from app.services.kicad_tools import ToolResult
from tests.kicad_tool_fakes import FakeTool


class CatalogPreviewGenerationTests(unittest.TestCase):
    """The preview pipeline the catalog worker runs, with kicad-cli faked."""

    def test_footprint_export_uses_sanitized_isolated_filename(self) -> None:
        def export(args: list[str], **_kwargs) -> ToolResult:
            selector = args[args.index("--footprint") + 1]
            self.assertEqual(selector, "BAT_VARTA_V_364_MF")
            output = Path(args[args.index("--output") + 1]) / f"{selector}.svg"
            output.write_bytes(b"<svg/>")
            return ToolResult(0)

        tool = FakeTool(export)
        pipeline = build_catalog_collaborators(
            catalog_locks=NoopCatalogLocks(), kicad=tool
        ).preview_pipeline
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.kicad_mod"
            source.write_text("(footprint \"BAT_VARTA_V 364 MF\")", encoding="utf-8")
            status, payload = pipeline.render_footprint(
                {"canonical_path": str(source), "target_name": "BAT_VARTA_V 364 MF"}
            )

        self.assertEqual(status, "ready")
        self.assertEqual(payload, b"<svg/>")
        self.assertEqual(tool.calls[0]["args"][:3], ["fp", "export", "svg"])

    def test_a_failed_export_is_a_failed_preview_with_the_tool_message(self) -> None:
        pipeline = build_catalog_collaborators(
            catalog_locks=NoopCatalogLocks(),
            kicad=FakeTool(lambda args, **_: ToolResult(2, "", "bad footprint\n")),
        ).preview_pipeline
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "a.kicad_mod"
            source.write_text("(footprint \"A\")", encoding="utf-8")
            status, payload = pipeline.render_footprint(
                {"canonical_path": str(source), "target_name": "A"}
            )
        self.assertEqual((status, payload), ("failed", "bad footprint"))

    def test_the_generator_identity_names_the_tool_version(self) -> None:
        pipeline = build_catalog_collaborators(
            catalog_locks=NoopCatalogLocks(), kicad=FakeTool(version="10.0.4")
        ).preview_pipeline
        self.assertEqual(pipeline.generator_identity("footprint")["generator_version"], "10.0.4")


if __name__ == "__main__":
    unittest.main()
