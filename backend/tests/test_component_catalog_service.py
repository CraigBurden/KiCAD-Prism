from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.component_catalog_service import ComponentCatalogService  # noqa: E402
from app.services.component_catalog_service_sqlite import (  # noqa: E402
    _discover_symbol_names_in_text,
    _rewrite_footprint_payload,
    _rewrite_symbol_payload,
)


class ComponentCatalogServiceHelperTests(unittest.TestCase):
    def _create_released_component(
        self,
        service: ComponentCatalogService,
        *,
        value: str,
        mpn: str,
        category: str = "Resistors SMD",
        package_name: str = "0603",
    ) -> dict:
        component = service.create_manual_component(
            value=value,
            description=f"{value} precision resistor",
            datasheet="https://example.com/r.pdf",
            manufacturer="Acme",
            manufacturer_part_number=mpn,
            category=category,
            package_name=package_name,
        )
        symbol = f"SYM_{mpn.replace(':', '_').replace('-', '_')}"
        symbol_path = service.store_root / "symbols" / "SharedSymbols" / f"{symbol}.kicad_sym"
        symbol_path.parent.mkdir(parents=True, exist_ok=True)
        symbol_path.write_text(
            f'(kicad_symbol_lib (version 20211014) (generator "test")\n'
            f'  (symbol "{symbol}"\n'
            f'    (property "Reference" "R" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
            f'    (property "Value" "{value}" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
            f"  )\n"
            f")\n",
            encoding="utf-8",
        )
        footprint_path = service.store_root / "footprints" / "SharedFootprints.pretty" / f"{symbol}.kicad_mod"
        footprint_path.parent.mkdir(parents=True, exist_ok=True)
        footprint_path.write_text(f'(footprint "{symbol}")\n', encoding="utf-8")
        with service._connect() as conn:  # type: ignore[attr-defined]
            revision_id = component["revision_id"]
            symbol_asset = service._register_asset(  # type: ignore[attr-defined]
                conn,
                asset_type="symbol",
                canonical_path=symbol_path,
                target_library="SharedSymbols",
                target_name=symbol,
            )
            footprint_asset = service._register_asset(  # type: ignore[attr-defined]
                conn,
                asset_type="footprint",
                canonical_path=footprint_path,
                target_library="SharedFootprints",
                target_name=symbol,
            )
            service._link_asset_to_revision(conn, revision_id, symbol_asset, required=True)  # type: ignore[attr-defined]
            service._link_asset_to_revision(conn, revision_id, footprint_asset, required=True)  # type: ignore[attr-defined]
            conn.commit()
        service.set_release_status(component["id"], "in_progress")
        service.set_release_status(component["id"], "qa_review")
        service.set_release_status(component["id"], "done")
        return service.set_release_status(component["id"], "released")

    def test_symbol_name_discovery_ignores_pin_unit_suffixes(self) -> None:
        text = """
        (kicad_symbol_lib
          (version 20211014)
          (generator "KiCAD Prism")
          (symbol "R"
            (property "Reference" "R" (at 0 0 0) (effects (font (size 1.27 1.27))))
          )
          (symbol "R_1_1"
            (pin passive line (at 0 0 0) (length 2.54))
          )
        )
        """
        self.assertEqual(_discover_symbol_names_in_text(text), ["R"])

    def test_symbol_rewrite_injects_metadata_and_footprint(self) -> None:
        payload = b"""(kicad_symbol_lib (version 20211014) (generator \"KiCAD Prism\")\n  (symbol \"R\"\n    (property \"Reference\" \"R\" (at 0 0 0)\n      (effects (font (size 1.27 1.27)))\n    )\n    (property \"Value\" \"OLD\" (at 0 0 0)\n      (effects (font (size 1.27 1.27)))\n    )\n  )\n)\n"""
        component = {
            "value": "10k",
            "description": "General purpose resistor",
            "datasheet_url": "https://example.com/r.pdf",
            "manufacturer": "Acme",
            "mpn": "ACME-R-10K",
            "vendor": "",
            "vendor_part_number": "",
            "mass_g": "",
            "rqjc_c_w": "",
            "rqjc_top_c_w": "",
            "temp_max_c": "",
            "temp_min_c": "",
            "power_dissipation_w": "",
            "rate": "",
            "sap_code": "",
        }
        rendered = _rewrite_symbol_payload(payload, "remote_prism_smd:R_0603_1608Metric", component).decode("utf-8")
        self.assertIn('(property "Value" "10k"', rendered)
        self.assertIn('(property "Manufacturer" "Acme"', rendered)
        self.assertIn('(property "Footprint" "remote_prism_smd:R_0603_1608Metric"', rendered)
        self.assertIn('(property "SAP Code" ""', rendered)

    def test_footprint_rewrite_points_model_into_remote_library(self) -> None:
        payload = b"""(footprint \"R_0603_1608Metric\"\n  (model \"old/path/to/model.step\")\n)\n"""
        asset = {
            "target_name": "R_0603_1608Metric",
            "name": "R_0603_1608Metric.kicad_mod",
        }
        rendered = _rewrite_footprint_payload(payload, asset).decode("utf-8")
        self.assertIn('${KIPRJMOD}/RemoteLibrary/remote_3d/R_0603_1608Metric.step', rendered)

    def test_csv_required_columns_match_manual_mandatory_fields(self) -> None:
        service = ComponentCatalogService()
        normalized = service._normalize_csv_row(  # type: ignore[attr-defined]
            {
                "Value": "10k",
                "Datasheet": "https://example.com/r.pdf",
                "Description": "General purpose resistor",
                "Manufacturer": "Acme",
                "Manufacturer Part Number": "ACME-R-10K",
            },
            2,
        )
        self.assertEqual(normalized["value"], "10k")
        self.assertEqual(normalized["manufacturer_part_number"], "ACME-R-10K")

        with self.assertRaises(ValueError):
            service._normalize_csv_row(  # type: ignore[attr-defined]
                {
                    "Value": "10k",
                    "Datasheet": "",
                    "Description": "General purpose resistor",
                    "Manufacturer": "Acme",
                    "Manufacturer Part Number": "ACME-R-10K",
                },
                3,
            )

    def test_dbl_export_uses_one_symbol_library_file_per_part(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            service.initialize()

            for value, mpn, symbol in (
                ("10k", "ACME:R:10K", "R_10K"),
                ("1k", "ACME:R:1K", "R_1K"),
            ):
                component = service.create_manual_component(
                    value=value,
                    description=f"{value} resistor",
                    datasheet="https://example.com/r.pdf",
                    manufacturer="Acme",
                    manufacturer_part_number=mpn,
                    category="Resistors SMD",
                    package_name="0603",
                )
                symbol_path = service.store_root / "symbols" / "SharedSymbols" / f"{symbol}.kicad_sym"
                symbol_path.parent.mkdir(parents=True, exist_ok=True)
                symbol_path.write_text(
                    f'(kicad_symbol_lib (version 20211014) (generator "test")\n'
                    f'  (symbol "{symbol}"\n'
                    f'    (property "Reference" "R" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
                    f'    (property "Value" "{value}" (at 0 0 0) (effects (font (size 1.27 1.27))))\n'
                    f"  )\n"
                    f")\n",
                    encoding="utf-8",
                )
                footprint_path = service.store_root / "footprints" / "SharedFootprints.pretty" / f"{symbol}.kicad_mod"
                footprint_path.parent.mkdir(parents=True, exist_ok=True)
                footprint_path.write_text(f'(footprint "{symbol}")\n', encoding="utf-8")
                with service._connect() as conn:  # type: ignore[attr-defined]
                    revision_id = component["revision_id"]
                    symbol_asset = service._register_asset(  # type: ignore[attr-defined]
                        conn,
                        asset_type="symbol",
                        canonical_path=symbol_path,
                        target_library="SharedSymbols",
                        target_name=symbol,
                    )
                    footprint_asset = service._register_asset(  # type: ignore[attr-defined]
                        conn,
                        asset_type="footprint",
                        canonical_path=footprint_path,
                        target_library="SharedFootprints",
                        target_name=symbol,
                    )
                    service._link_asset_to_revision(conn, revision_id, symbol_asset, required=True)  # type: ignore[attr-defined]
                    service._link_asset_to_revision(conn, revision_id, footprint_asset, required=True)  # type: ignore[attr-defined]
                    conn.commit()
                service.set_release_status(component["id"], "in_progress")
                service.set_release_status(component["id"], "qa_review")
                service.set_release_status(component["id"], "done")
                service.set_release_status(component["id"], "released")

            result = service.export_kicad_dbl_bundle()
            export_root = Path(result["export_root"])
            symbol_files = sorted((export_root / "SchLib").glob("*.kicad_sym"))
            self.assertEqual(len(symbol_files), 2)
            self.assertNotEqual(symbol_files[0].name, symbol_files[1].name)

            dbl_text = (export_root / "Prism_Linux.kicad_dbl").read_text(encoding="utf-8")
            self.assertIn('"key": "Part Number Nocolon"', dbl_text)
            self.assertIn('"symbols": "LibSymbol"', dbl_text)

            import sqlite3

            with sqlite3.connect(result["sqlite_path"]) as conn:
                rows = conn.execute('SELECT LibSymbol FROM "Resistors SMD" ORDER BY LibSymbol').fetchall()
            self.assertEqual(len(rows), 2)
            self.assertTrue(all(row[0].startswith("Prism_ACME_R_") for row in rows))

    def test_remote_search_uses_lightweight_payload_and_full_detail_stays_available(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            service.initialize()
            released = self._create_released_component(service, value="10k", mpn="ACME-R-10K")
            self.assertTrue(service._fts_available)  # type: ignore[attr-defined]

            search_result = service.search_components("ACME 10K", page=1, page_size=20)
            self.assertEqual(search_result["total"], 1)
            summary = search_result["items"][0]
            self.assertEqual(summary["id"], released["id"])
            self.assertEqual(summary["assets"], [])
            self.assertEqual(summary["previews"], [])
            self.assertTrue(summary["place_enabled"])

            detail = service.get_component(released["id"], include_inactive=False, released_only=True)
            self.assertIsNotNone(detail)
            self.assertEqual(len(detail["assets"]), 2)


if __name__ == "__main__":
    unittest.main()
