"""DBL export of 3D models: content-addressed paths, earlier releases, missing files."""

from __future__ import annotations

import hashlib
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog.dbl_export import CatalogDblExport  # noqa: E402
from app.services.catalog.placement_payloads import materialize_asset  # noqa: E402


SYMBOL = (
    '(kicad_symbol_lib (version 20231120) (generator "prism")\n'
    '  (symbol "R_Test"\n'
    '    (property "Reference" "R" (at 0 0 0)\n'
    "      (effects (font (size 1.27 1.27)))\n"
    "    )\n"
    "  )\n"
    ")\n"
)
FOOTPRINT = '(footprint "R_Test"\n  (model "${KICAD8_3DMODEL_DIR}/R.step" (offset (xyz 0 0 0)))\n)\n'


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class _Result:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def fetchall(self) -> list[dict]:
        return self._rows


class _Conn:
    """Answers the released-revision model query from a fixed row list."""

    def __init__(self, released_rows: list[dict]) -> None:
        self.released_rows = released_rows

    def execute(self, sql: str, params: tuple) -> _Result:
        assert "component_release_records" in sql
        return _Result([row for row in self.released_rows if row["component_id"] == params[0]])


class _Placement:
    def __init__(self, assets_by_revision: dict[str, list[dict]]) -> None:
        self.assets_by_revision = assets_by_revision

    def placement_assets(self, conn, revision_id, representation_id=""):
        return {}, self.assets_by_revision[revision_id]


class DblModelExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.store = self.root / "store"
        self.export_root = self.root / "export"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _file(self, relative: str, payload: bytes) -> Path:
        path = self.store / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return path

    def _asset(self, asset_id: str, asset_type: str, relative: str, payload: bytes, **extra) -> dict:
        path = self._file(relative, payload)
        return {
            "id": asset_id,
            "asset_type": asset_type,
            "canonical_path": str(path),
            "sha256": _sha(payload),
            "target_library": "Prism_Test",
            "target_name": "R_Test",
            **extra,
        }

    def _component(self, revision_id: str, symbol: dict, footprint: dict) -> dict:
        return {
            "id": "c1",
            "revision_id": revision_id,
            "category": "Resistors",
            "mpn": "PG-R-1",
            "value": "10k",
            "name": "R",
            "manufacturer": "Prism",
            "package_name": "",
            "workflow_stage": "released",
            "description": "",
            "datasheet_url": "",
            "extra_fields": {},
            "representations": [{"is_default": True, "symbol": symbol, "footprint": footprint}],
            "assets": [symbol, footprint],
        }

    def _export(self, assets_by_revision: dict, released_rows: list[dict], component: dict) -> dict:
        exporter = CatalogDblExport(_Placement(assets_by_revision))
        runtime = SimpleNamespace(export_root=self.export_root)
        return exporter.export_bundle(_Conn(released_rows), runtime, [component], [])

    def _revision(self, revision_id: str, step: bytes, step_relative: str) -> tuple[list[dict], dict]:
        symbol = self._asset(f"{revision_id}-sym", "symbol", "symbol/Prism_Test/R_Test.kicad_sym", SYMBOL.encode())
        footprint = self._asset(
            f"{revision_id}-fp", "footprint", "footprint/Prism_Test.pretty/R_Test.kicad_mod", FOOTPRINT.encode()
        )
        model = self._asset(f"{revision_id}-step", "3dmodel", step_relative, step)
        return [symbol, footprint, model], self._component(revision_id, symbol, footprint)

    def test_model_is_exported_under_its_content_path_and_referenced_by_the_footprint(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        result = self._export({"r1": assets}, [{"component_id": "c1", "revision_id": "r1", **assets[2]}], component)

        relpath = f"3DModels/{_sha(step)[:16]}/R_Test.step"
        self.assertEqual((self.export_root / relpath).read_bytes(), step)
        footprint = (self.export_root / "PcbLib/Prism_Test.pretty/R_Test.kicad_mod").read_text()
        self.assertIn(f'(model "${{PRISM_LIB_DIR}}/{relpath}" (offset', footprint)
        self.assertEqual(result["model_count"], 1)
        self.assertEqual(result["missing_models"], [])

    def test_models_of_every_released_revision_are_kept(self) -> None:
        step1 = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        step2 = b"ISO-10303-21;rev2;END-ISO-10303-21;"
        assets1, _ = self._revision("r1", step1, "3dmodel/Prism_Test/R_Test.step")
        assets2, component = self._revision("r2", step2, f"revisions/{_sha(step2)}/3dmodel/Prism_Test/R_Test.step")
        released = [
            {"component_id": "c1", "revision_id": "r1", **assets1[2]},
            {"component_id": "c1", "revision_id": "r2", **assets2[2]},
        ]
        result = self._export({"r2": assets2}, released, component)

        old = self.export_root / f"3DModels/{_sha(step1)[:16]}/R_Test.step"
        new = self.export_root / f"3DModels/{_sha(step2)[:16]}/R_Test.step"
        self.assertEqual(old.read_bytes(), step1)
        self.assertEqual(new.read_bytes(), step2)
        footprint = (self.export_root / "PcbLib/Prism_Test.pretty/R_Test.kicad_mod").read_text()
        self.assertIn(f"3DModels/{_sha(step2)[:16]}/R_Test.step", footprint)
        self.assertEqual(result["model_count"], 2)

    def test_missing_or_changed_model_is_reported_not_exported(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        Path(assets[2]["canonical_path"]).write_bytes(b"overwritten")
        old_step = {**assets[2], "id": "r0-step", "canonical_path": str(self.store / "gone.step")}
        released = [{"component_id": "c1", "revision_id": "r0", **old_step}]
        result = self._export({"r1": assets}, released, component)

        self.assertFalse((self.export_root / "3DModels").exists())
        self.assertEqual(result["model_count"], 0)
        self.assertEqual(
            result["missing_models"],
            [
                {"component_id": "c1", "revision_id": "r1", "asset_id": "r1-step", "reason": "sha256_mismatch"},
                {"component_id": "c1", "revision_id": "r0", "asset_id": "r0-step", "reason": "file_missing"},
            ],
        )

    def test_remote_provider_footprint_bytes_are_unchanged(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, _ = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "/RemoteLibrary"),
        ):
            payload = materialize_asset(assets[1], assets)["payload"]
        self.assertEqual(
            payload,
            b'(footprint "R_Test"\n'
            b'  (model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_Test.step" (offset (xyz 0 0 0)))\n)\n',
        )


if __name__ == "__main__":
    unittest.main()
