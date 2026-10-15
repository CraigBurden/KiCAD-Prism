"""DBL export: 3D models (content-addressed paths, earlier releases, missing files),
atomic rebuild, stable keys and the exported library tables."""

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
from app.services.catalog.dbl_export import CatalogDblExport, dbl_part_numbers  # noqa: E402
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

    def fetchone(self) -> dict | None:
        return self._rows[0] if self._rows else None


class _Conn:
    """Answers the released-revision model query from a fixed row list and records advisory locks."""

    def __init__(self, released_rows: list[dict]) -> None:
        self.released_rows = released_rows
        self.locks: list[str] = []

    def execute(self, sql: str, params: tuple = ()) -> _Result:
        if "pg_advisory_xact_lock" in sql:
            self.locks.append(params[0])
            return _Result([{}])
        assert "component_release_records" in sql
        return _Result(self.released_rows)


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

    def _export(self, assets_by_revision: dict, released_rows: list[dict], component: dict | None) -> dict:
        exporter = CatalogDblExport(_Placement(assets_by_revision))
        runtime = SimpleNamespace(export_root=self.export_root)
        self.conn = _Conn(released_rows)
        return exporter.export_bundle(self.conn, runtime, [component] if component else [], [])

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

    def test_models_of_a_component_that_is_no_longer_exported_are_kept(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        released = [{"component_id": "c1", "revision_id": "r1", **assets[2]}]
        self._export({"r1": assets}, released, component)
        # Deactivated: the component drops out of the export, its release record stays.
        result = self._export({}, released, None)

        self.assertEqual((self.export_root / f"3DModels/{_sha(step)[:16]}/R_Test.step").read_bytes(), step)
        self.assertFalse((self.export_root / "PcbLib/Prism_Test.pretty").exists())
        self.assertEqual((result["model_count"], result["missing_models"]), (1, []))

    def test_missing_or_changed_model_is_reported_not_exported(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        Path(assets[2]["canonical_path"]).write_bytes(b"overwritten")
        old_step = {**assets[2], "id": "r0-step", "canonical_path": str(self.store / "gone.step")}
        # r1 is also seen through its own release record; it is reported once.
        released = [
            {"component_id": "c1", "revision_id": "r0", **old_step},
            {"component_id": "c1", "revision_id": "r1", **assets[2]},
        ]
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

    def test_a_missing_model_shared_by_many_releases_is_reported_once(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        Path(assets[2]["canonical_path"]).unlink()
        released = [{"component_id": "c1", "revision_id": f"r{index}", **assets[2]} for index in range(1, 6)]
        result = self._export({"r1": assets}, released, component)

        self.assertEqual(
            result["missing_models"],
            [{"component_id": "c1", "revision_id": "r1", "asset_id": "r1-step", "reason": "file_missing"}],
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

    def test_a_failed_export_leaves_the_previous_bundle_intact(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        released = [{"component_id": "c1", "revision_id": "r1", **assets[2]}]
        self._export({"r1": assets}, released, component)
        before = {
            path.relative_to(self.export_root): path.read_bytes()
            for path in sorted(self.export_root.rglob("*"))
            if path.is_file()
        }

        broken = {**component, "revision_id": "r-missing"}
        with self.assertRaises(KeyError):
            self._export({"r1": assets}, released, broken)

        after = {
            path.relative_to(self.export_root): path.read_bytes()
            for path in sorted(self.export_root.rglob("*"))
            if path.is_file()
        }
        self.assertEqual(after, before)
        self.assertEqual(sorted(path.name for path in self.root.iterdir()), ["export", "store"])

    def test_a_successful_export_replaces_the_bundle_and_leaves_no_siblings(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        self.export_root.mkdir(parents=True)
        (self.export_root / "stale.txt").write_text("from an older export")

        result = self._export({"r1": assets}, [], component)

        self.assertEqual(result["export_root"], str(self.export_root))
        self.assertFalse((self.export_root / "stale.txt").exists())
        self.assertTrue((self.export_root / "Prism.sqlite").is_file())
        self.assertEqual(sorted(path.name for path in self.root.iterdir()), ["export", "store"])

    def test_fp_lib_table_lists_only_exported_footprint_libraries(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        # A non-default representation's footprint is on the component but never exported.
        alternate = {**assets[1], "id": "r1-fp-alt", "target_library": "Prism_Alternate"}
        component["assets"] = [*component["assets"], alternate]
        self._export({"r1": assets}, [], component)

        fp_lib_table = (self.export_root / "fp-lib-table").read_text()
        self.assertIn('(name "Prism_Test")', fp_lib_table)
        self.assertNotIn("Prism_Alternate", fp_lib_table)

    def test_exports_are_serialized_and_sweep_every_leftover_of_an_interrupted_export(self) -> None:
        step = b"ISO-10303-21;rev1;END-ISO-10303-21;"
        assets, component = self._revision("r1", step, "3dmodel/Prism_Test/R_Test.step")
        leftovers = [self.root / ".export.build-crashed", self.root / ".export.old-crashed"]
        unrelated = self.root / ".other.build-crashed"
        for path in (*leftovers, unrelated):
            (path / "SchLib").mkdir(parents=True)

        self._export({"r1": assets}, [], component)

        self.assertEqual(self.conn.locks, [f"prism-catalog-dbl-export:{self.export_root}"])
        self.assertEqual(
            sorted(path.name for path in self.root.iterdir()), [".other.build-crashed", "export", "store"]
        )


class DblPartNumberTests(unittest.TestCase):
    @staticmethod
    def _part(component_id: str, mpn: str, created_at: str, value: str = "") -> dict:
        return {"id": component_id, "mpn": mpn, "value": value, "component_created_at": created_at}

    def test_keys_do_not_depend_on_component_order(self) -> None:
        parts = [
            self._part("bbbbbbbb-2", "LM:358", "2026-02-01"),
            self._part("aaaaaaaa-1", "LM 358", "2026-01-01"),
            self._part("cccccccc-3", "LM358", "2026-03-01"),
        ]
        expected = {"aaaaaaaa-1": "LM_358", "bbbbbbbb-2": "LM_358_bbbbbbbb", "cccccccc-3": "LM358"}
        self.assertEqual(dbl_part_numbers(parts), expected)
        self.assertEqual(dbl_part_numbers(list(reversed(parts))), expected)

    def test_a_newer_look_alike_never_renames_an_existing_key(self) -> None:
        older = self._part("ffffffff-old", "", "2026-01-01", value="10k")
        newer = self._part("00000000-new", "", "2026-05-01", value="10k")
        self.assertEqual(dbl_part_numbers([older]), {"ffffffff-old": "10k"})
        self.assertEqual(
            dbl_part_numbers([newer, older]), {"ffffffff-old": "10k", "00000000-new": "10k_00000000"}
        )

    def test_suffixed_keys_that_still_collide_use_the_whole_id(self) -> None:
        parts = [
            self._part("p0", "X", "2026-01-01"),
            self._part("abcdefgh-1", "X", "2026-02-01"),
            self._part("abcdefgh-2", "X", "2026-03-01"),
        ]
        keys = dbl_part_numbers(parts)
        self.assertEqual(keys, {"p0": "X", "abcdefgh-1": "X_abcdefgh-1", "abcdefgh-2": "X_abcdefgh-2"})
        self.assertEqual(len(set(keys.values())), 3)


if __name__ == "__main__":
    unittest.main()
