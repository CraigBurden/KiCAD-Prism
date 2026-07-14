from __future__ import annotations

import csv
import hashlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.component_catalog_service import ComponentCatalogService  # noqa: E402
from app.services.component_catalog_service_sqlite import (  # noqa: E402
    PREVIEW_STATUS_FAILED,
    PREVIEW_STATUS_READY,
    REVISION_MANIFEST_A0,
    REVISION_MANIFEST_A1,
    ComponentCatalogService as SqliteComponentCatalogService,
    _discover_symbol_names_in_text,
    _rewrite_footprint_payload,
    _rewrite_symbol_payload,
)


class DeterministicPreviewCatalogService(SqliteComponentCatalogService):
    preview_version = "generator-v1"
    symbol_preview = b"<svg>symbol-v1</svg>"
    footprint_preview = b"<svg>footprint-v1</svg>"
    fail_previews = False

    def _preview_generator_identity(self, kind: str) -> dict[str, str]:
        return {
            "generator_name": "test-renderer",
            "generator_version": self.preview_version,
            "pipeline_version": "test-pipeline",
            "generator_fingerprint": f"{kind}:{self.preview_version}",
        }

    def _generate_symbol_preview(self, asset: dict) -> tuple[str, bytes | str]:
        _ = asset
        if self.fail_previews:
            return PREVIEW_STATUS_FAILED, "symbol render failed"
        return PREVIEW_STATUS_READY, self.symbol_preview

    def _generate_footprint_preview(self, asset: dict) -> tuple[str, bytes | str]:
        _ = asset
        if self.fail_previews:
            return PREVIEW_STATUS_FAILED, "footprint render failed"
        return PREVIEW_STATUS_READY, self.footprint_preview


class MultiUnitPreviewCatalogService(DeterministicPreviewCatalogService):
    symbol_units = [b"<svg>unit-a-v1</svg>", b"<svg>unit-b-v1</svg>"]

    def _generate_symbol_preview_units(self, asset: dict) -> tuple[str, list[tuple[int, bytes]] | str]:
        _ = asset
        return PREVIEW_STATUS_READY, list(enumerate(self.symbol_units, start=1))


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
            "extra_fields": {"voltage_rating": "50V"},
        }
        rendered = _rewrite_symbol_payload(payload, "remote_prism_smd:R_0603_1608Metric", component).decode("utf-8")
        self.assertIn('(property "Value" "10k"', rendered)
        self.assertIn('(property "Manufacturer" "Acme"', rendered)
        self.assertIn('(property "Footprint" "remote_prism_smd:R_0603_1608Metric"', rendered)
        self.assertIn('(property "SAP Code" ""', rendered)
        self.assertIn('(property "voltage_rating" "50V"', rendered)

    def test_footprint_rewrite_points_model_into_remote_library(self) -> None:
        payload = b"""(footprint \"R_0603_1608Metric\"\n  (model \"old/path/to/model.step\")\n)\n"""
        asset = {
            "target_name": "R_0603_1608Metric",
            "name": "R_0603_1608Metric.kicad_mod",
        }
        rendered = _rewrite_footprint_payload(
            payload,
            asset,
            [{"canonical_path": "/catalog/3dmodels/Resistor_Body.wrl"}],
        ).decode("utf-8")
        self.assertIn('${KIPRJMOD}/RemoteLibrary/remote_3d/Resistor_Body.wrl', rendered)

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

    def test_release_queue_is_multi_stage_searchable_and_summarized_server_side(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            awaiting_qa = service.create_manual_component(
                value="Queue A",
                description="Awaiting independent QA",
                datasheet="https://example.com/a.pdf",
                manufacturer="Acme",
                manufacturer_part_number="QUEUE-A",
                actor="queue-author@example.com",
            )
            ready = service.create_manual_component(
                value="Queue B",
                description="Approved for publication",
                datasheet="https://example.com/b.pdf",
                manufacturer="Acme",
                manufacturer_part_number="QUEUE-B",
                actor="different-author@example.com",
            )
            for component in (awaiting_qa, ready):
                service.set_release_status(component["id"], "in_progress", actor="designer@example.com")
                service.set_release_status(component["id"], "qa_review", actor="designer@example.com")
            service.set_release_status(
                ready["id"],
                "done",
                actor="queue-reviewer@example.com",
                actor_role="component_qa",
            )

            result = service.list_components(
                workflow_stage="qa_review,done",
                page=1,
                page_size=10,
                sort_by="updated_at",
                sort_dir="desc",
            )
            self.assertEqual(result["total"], 2)
            self.assertEqual(
                {component["workflow_stage"] for component in result["items"]},
                {"qa_review", "done"},
            )
            author_result = service.list_components(
                query="queue-author@example.com",
                workflow_stage="qa_review,done",
                page=1,
                page_size=10,
            )
            self.assertEqual([component["id"] for component in author_result["items"]], [awaiting_qa["id"]])
            self.assertEqual(
                service.release_queue_summary(),
                {"qa_review": 1, "done": 1, "blocked": 2},
            )

    def test_klc_junit_report_is_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            junit_path = root / "report.junit.xml"
            junit_path.write_text(
                """<?xml version='1.0' encoding='utf-8'?>
<testsuites>
  <testsuite name="Footprint KLC Checks" id="klc-fp" tests="2" failures="2">
    <testcase classname="Footprint KLC Checks" name="BadFootprint - Errors" type="Errors">
      <failure message="F5.1: Silkscreen layer requirements" type="FAILURE">F5.1: Silkscreen layer requirements
    https://klc.kicad.org/footprint/f5/f5.1/
    Some silkscreen lines have incorrect width
       - Line on F.SilkS has width 0.16</failure>
    </testcase>
    <testcase classname="Footprint KLC Checks" name="BadFootprint - Warnings" type="Warnings">
      <failure message="F6.3: Pad requirements for SMD footprints" type="WARNING">F6.3: Pad requirements for SMD footprints
    https://klc.kicad.org/footprint/f6/f6.3/
    Pad(s) potentially missing layers</failure>
    </testcase>
  </testsuite>
</testsuites>
""",
                encoding="utf-8",
            )
            findings = service._parse_klc_junit(junit_path)  # type: ignore[attr-defined]
            self.assertEqual(len(findings), 2)
            self.assertEqual(findings[0]["severity"], "error")
            self.assertEqual(findings[0]["rule_code"], "F5.1")
            self.assertEqual(findings[0]["rule_url"], "https://klc.kicad.org/footprint/f5/f5.1/")
            self.assertEqual(findings[1]["severity"], "warning")

    def test_klc_block_gate_rejects_unvalidated_release(self) -> None:
        old_gate = settings.CATALOG_KLC_RELEASE_GATE
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                service = ComponentCatalogService(
                    store_root=root / "components",
                    database_url=str(root / "prism.sqlite3"),
                )
                service.initialize()
                component = service.create_manual_component(
                    value="10k",
                    description="10k resistor",
                    datasheet="https://example.com/r.pdf",
                    manufacturer="Acme",
                    manufacturer_part_number="ACME-R-10K",
                    category="Resistors SMD",
                    package_name="0603",
                )
                symbol_path = service.store_root / "symbols" / "SharedSymbols" / "R_10K.kicad_sym"
                symbol_path.parent.mkdir(parents=True, exist_ok=True)
                symbol_path.write_text('(kicad_symbol_lib (version 20211014) (symbol "R_10K"))', encoding="utf-8")
                footprint_path = service.store_root / "footprints" / "SharedFootprints.pretty" / "R_10K.kicad_mod"
                footprint_path.parent.mkdir(parents=True, exist_ok=True)
                footprint_path.write_text('(footprint "R_10K")', encoding="utf-8")
                with service._connect() as conn:  # type: ignore[attr-defined]
                    symbol_asset = service._register_asset(  # type: ignore[attr-defined]
                        conn,
                        asset_type="symbol",
                        canonical_path=symbol_path,
                        target_library="SharedSymbols",
                        target_name="R_10K",
                    )
                    footprint_asset = service._register_asset(  # type: ignore[attr-defined]
                        conn,
                        asset_type="footprint",
                        canonical_path=footprint_path,
                        target_library="SharedFootprints",
                        target_name="R_10K",
                    )
                    service._link_asset_to_revision(conn, component["revision_id"], symbol_asset, required=True)  # type: ignore[attr-defined]
                    service._link_asset_to_revision(conn, component["revision_id"], footprint_asset, required=True)  # type: ignore[attr-defined]
                    conn.commit()
                service.set_release_status(component["id"], "in_progress")
                service.set_release_status(component["id"], "qa_review")
                service.set_release_status(component["id"], "done")
                settings.CATALOG_KLC_RELEASE_GATE = "block"
                with self.assertRaises(ValueError):
                    service.set_release_status(component["id"], "released")
        finally:
            settings.CATALOG_KLC_RELEASE_GATE = old_gate

    def test_list_components_filters_by_validation_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            service.initialize()
            passed = self._create_released_component(service, value="10k", mpn="ACME-R-10K")
            failed = self._create_released_component(service, value="1k", mpn="ACME-R-1K")
            not_run = service.create_manual_component(
                value="100nF",
                description="Bypass capacitor",
                datasheet="https://example.com/c.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-C-100N",
                category="Capacitors SMD",
                package_name="0603",
            )

            report_dir = root / "reports"
            report_dir.mkdir()

            def record_runs(component_id: str, statuses: dict[str, str]) -> None:
                component = service.get_component(component_id)
                self.assertIsNotNone(component)
                assert component is not None
                with service._connect() as conn:  # type: ignore[attr-defined]
                    for asset in component["assets"]:
                        status = statuses[str(asset["asset_type"])]
                        run_id = f"run-{component_id}-{asset['asset_type']}"
                        findings = []
                        if status == "failed":
                            findings = [
                                {
                                    "severity": "error",
                                    "rule_code": "S1.1",
                                    "rule_url": "https://klc.kicad.org/symbol/s1/s1.1/",
                                    "message": "Reference designator missing",
                                    "details": [],
                                    "object_name": asset["target_name"],
                                }
                            ]
                        service._store_validation_run(  # type: ignore[attr-defined]
                            conn,
                            run_id=run_id,
                            component_id=component_id,
                            revision_id=component["revision_id"],
                            asset=asset,
                            status=status,
                            findings=findings,
                            exit_code=1 if status == "failed" else 0,
                            report_dir=report_dir,
                            stdout_path=report_dir / f"{run_id}.stdout",
                            stderr_path=report_dir / f"{run_id}.stderr",
                            junit_path=report_dir / f"{run_id}.xml",
                            json_path=report_dir / f"{run_id}.json",
                            raw_output="",
                            tool_version="test",
                            created_at="2026-01-01T00:00:00Z",
                            finished_at="2026-01-01T00:00:01Z",
                        )
                    conn.commit()

            record_runs(passed["id"], {"symbol": "passed", "footprint": "passed"})
            record_runs(failed["id"], {"symbol": "passed", "footprint": "failed"})

            failed_result = service.list_components(validation_status="failed", page=1, page_size=10)
            self.assertEqual(failed_result["total"], 1)
            self.assertEqual(failed_result["items"][0]["id"], failed["id"])

            passed_result = service.list_components(validation_status="passed", page=1, page_size=10)
            self.assertEqual(passed_result["total"], 1)
            self.assertEqual(passed_result["items"][0]["id"], passed["id"])

            not_run_result = service.list_components(validation_status="not_run", page=1, page_size=10)
            self.assertEqual(not_run_result["total"], 1)
            self.assertEqual(not_run_result["items"][0]["id"], not_run["id"])

    def test_catalog_health_counts_all_pages(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            calls: list[int] = []

            def fake_list_components(**kwargs: object) -> dict:
                page = int(kwargs["page"])
                calls.append(page)
                if page == 1:
                    items = [
                        {
                            "validation": {"status": "passed"},
                            "availability_state": "place_ready",
                            "release_status": "released",
                            "previews": [],
                        }
                        for _ in range(10000)
                    ]
                else:
                    items = [
                        {
                            "validation": {"status": "failed"},
                            "availability_state": "files_partial",
                            "release_status": "open",
                            "previews": [{"status": "failed"}],
                        }
                    ]
                return {"items": items, "total": 10001, "page": page, "page_size": 10000, "pages": 2}

            service.list_components = fake_list_components  # type: ignore[method-assign]

            health = service.catalog_health()

            self.assertEqual(calls, [1, 2])
            self.assertEqual(health["total_components"], 10001)
            self.assertEqual(health["place_ready"], 10000)
            self.assertEqual(health["missing_files"], 1)
            self.assertEqual(health["preview_failed"], 1)
            self.assertEqual(health["validation"]["passed"], 10000)
            self.assertEqual(health["validation"]["failed"], 1)

    def test_metadata_saves_create_immutable_audited_revisions_and_skip_noops(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-10K",
                actor="author@example.com",
                extra_fields={"Tolerance": "1%", "Voltage Rating": "50V"},
            )
            first_revision_id = component["revision_id"]

            updated = service.update_component_metadata(
                component["id"],
                {"value": "12k"},
                actor="author@example.com",
                change_summary="Change resistance",
                expected_revision_id=first_revision_id,
            )
            self.assertIsNotNone(updated)
            assert updated is not None
            self.assertEqual(updated["revision"], 2)
            self.assertEqual(updated["extra_fields"]["Tolerance"], "1%")
            self.assertEqual(updated["parent_revision_id"], first_revision_id)
            self.assertNotEqual(updated["manifest_hash"], component["manifest_hash"])

            no_op = service.update_component_metadata(
                component["id"],
                {"value": "12k"},
                actor="author@example.com",
                expected_revision_id=updated["revision_id"],
            )
            self.assertEqual(no_op["revision_id"], updated["revision_id"])

            history = service.list_component_revisions(component["id"])
            self.assertEqual([row["version"] for row in history], [2, 1])
            comparison = service.compare_component_revisions(component["id"], first_revision_id, updated["revision_id"])
            value_change = next(change for change in comparison["metadataChanges"] if change["field"] == "value")
            self.assertEqual(value_change, {"field": "value", "before": "10k", "after": "12k", "status": "modified"})
            self.assertEqual(comparison["summary"]["metadataChanges"], 1)
            audit = list(reversed(service.list_component_audit_events(component["id"])))
            self.assertEqual([event["event_type"] for event in audit], ["component.created", "revision.created"])
            self.assertEqual(audit[1]["previous_hash"], audit[0]["event_hash"])
            self.assertTrue(service.verify_component_audit_chain(component["id"])["valid"])

            with self.assertRaisesRegex(ValueError, "revision conflict"):
                service.update_component_metadata(
                    component["id"],
                    {"value": "15k"},
                    actor="author@example.com",
                    expected_revision_id=first_revision_id,
                )

    def test_bulk_metadata_fields_csv_and_qa_revision_workflow(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="Bulk editable resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-BULK-10K",
                actor="author@example.com",
                extra_fields={"Tolerance": "1%"},
            )
            discovered = next(field for field in service.list_metadata_fields() if field["storage_key"] == "Tolerance")
            self.assertEqual(discovered["key"], "tolerance")
            self.assertEqual(discovered["group"], "custom")
            voltage = service.create_metadata_field(
                {"key": "voltage_rating", "label": "Voltage Rating", "type": "number", "unit": "V"},
                actor="admin@example.com",
            )
            self.assertFalse(voltage["built_in"])
            batch = service.stage_metadata_batch(
                [{
                    "component_id": component["id"],
                    "expected_revision_id": component["revision_id"],
                    "patch": {"value": "12k", "voltage_rating": "50"},
                }],
                source="grid",
                actor="author@example.com",
                change_summary="Correct resistance and rating",
            )
            self.assertEqual(batch["valid_items"], 1)
            result = service.apply_metadata_batch(batch["id"], actor="author@example.com")
            self.assertEqual(result["applied"], 1)
            updated = service.get_component(component["id"])
            assert updated is not None
            self.assertEqual(updated["revision"], 2)
            self.assertEqual(updated["workflow_stage"], "qa_review")
            self.assertEqual(updated["value"], "12k")
            self.assertEqual(updated["extra_fields"]["voltage_rating"], "50")
            self.assertEqual(updated["change_kind"], "metadata_bulk")

            exported = service.export_metadata_csv()
            self.assertIn("custom:voltage_rating", exported.splitlines()[0])
            self.assertIn(component["id"], exported)
            service.set_metadata_field_archived(voltage["id"], True, actor="admin@example.com")
            self.assertNotIn("custom:voltage_rating", service.export_metadata_csv().splitlines()[0])
            self.assertEqual(service.get_component(component["id"])["extra_fields"]["voltage_rating"], "50")

    def test_metadata_csv_preview_skips_unchanged_rows_before_validation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            changed = service.create_manual_component(
                value="10k", description="Changed resistor", datasheet="https://example.com/a.pdf",
                manufacturer="Acme", manufacturer_part_number="ACME-CSV-A", actor="author@example.com",
                package_name="0207", extra_fields={"kicad_dnp": "false"},
            )
            service.create_manual_component(
                value="20k", description="Unchanged resistor", datasheet="https://example.com/b.pdf",
                manufacturer="Acme", manufacturer_part_number="ACME-CSV-B", actor="author@example.com",
            )
            reader = csv.DictReader(io.StringIO(service.export_metadata_csv()))
            rows = list(reader)
            fieldnames = [*(reader.fieldnames or []), "custom:unused_import_column"]
            for row in rows:
                row["custom:unused_import_column"] = ""
                if row["component_id"] == changed["id"]:
                    self.assertEqual(row["package_name"], "\u200b0207")
                    row["value"] = "12k"
                    row["custom:kicad_dnp"] = "FALSE"
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

            with patch.object(service, "_lock_component_identity") as identity_lock:
                batch = service.preview_metadata_csv(
                    output.getvalue(), actor="designer@example.com", change_summary="Edit one CSV row",
                )

            identity_lock.assert_not_called()
            self.assertEqual(batch["source_rows"], 2)
            self.assertEqual(batch["skipped_unchanged_rows"], 1)
            self.assertEqual(batch["total_items"], 1)
            self.assertEqual(batch["valid_items"], 1)
            self.assertEqual(batch["unknown_fields"], [])
            self.assertEqual(batch["items"][0]["component_id"], changed["id"])
            self.assertEqual(batch["items"][0]["patch"], {"value": "12k"})

            scoped = service.export_metadata_csv(field_keys=["value", "package_name"])
            self.assertEqual(
                next(csv.reader(io.StringIO(scoped))),
                [
                    "_prism_schema_version", "component_id", "expected_revision_id",
                    "revision", "workflow_stage", "value", "package_name",
                ],
            )

            unchanged = service.preview_metadata_csv(
                service.export_metadata_csv(), actor="designer@example.com", change_summary="No changes",
            )
            self.assertEqual(unchanged["source_rows"], 2)
            self.assertEqual(unchanged["skipped_unchanged_rows"], 2)
            self.assertEqual(unchanged["total_items"], 0)
            self.assertEqual(unchanged["items"], [])

    def test_bulk_metadata_rejects_duplicate_batch_identity_and_invalid_required_schema(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            first = service.create_manual_component(
                value="10k", description="First resistor", datasheet="https://example.com/a.pdf",
                manufacturer="Acme", manufacturer_part_number="ACME-A", actor="author@example.com",
            )
            second = service.create_manual_component(
                value="20k", description="Second resistor", datasheet="https://example.com/b.pdf",
                manufacturer="Acme", manufacturer_part_number="ACME-B", actor="author@example.com",
            )
            batch = service.stage_metadata_batch(
                [
                    {"component_id": first["id"], "expected_revision_id": first["revision_id"], "patch": {"mpn": "ACME-C"}},
                    {"component_id": second["id"], "expected_revision_id": second["revision_id"], "patch": {"mpn": "ACME-C"}},
                ],
                source="grid", actor="author@example.com", change_summary="Normalize duplicate identity",
            )
            self.assertEqual(batch["valid_items"], 0)
            self.assertTrue(all(item["validation_status"] == "invalid" for item in batch["items"]))

            field = service.create_metadata_field(
                {"key": "internal_note", "label": "Internal note", "type": "text"},
                actor="admin@example.com",
            )
            with self.assertRaisesRegex(ValueError, "invalidate 2 current component"):
                service.update_metadata_field(field["id"], {"required": True}, actor="admin@example.com")

    def test_bulk_metadata_inherits_klc_evidence_and_keeps_released_revision(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            released = self._create_released_component(service, value="10k", mpn="ACME-KLC-10K")
            parent_revision_id = released["revision_id"]
            parent_assets = {asset["id"]: asset["sha256"] for asset in released["assets"]}
            report_dir = root / "reports"
            report_dir.mkdir()
            with service._connect() as conn:  # type: ignore[attr-defined]
                for asset in released["assets"]:
                    run_id = f"run-{asset['id']}"
                    service._store_validation_run(  # type: ignore[attr-defined]
                        conn,
                        run_id=run_id,
                        component_id=released["id"],
                        revision_id=parent_revision_id,
                        asset=asset,
                        status="passed",
                        findings=[],
                        exit_code=0,
                        report_dir=report_dir,
                        stdout_path=report_dir / f"{run_id}.stdout",
                        stderr_path=report_dir / f"{run_id}.stderr",
                        junit_path=report_dir / f"{run_id}.xml",
                        json_path=report_dir / f"{run_id}.json",
                        raw_output="",
                        tool_version="test",
                        created_at="2026-01-01T00:00:00Z",
                        finished_at="2026-01-01T00:00:01Z",
                    )
                conn.commit()

            batch = service.stage_metadata_batch(
                [{
                    "component_id": released["id"],
                    "expected_revision_id": parent_revision_id,
                    "patch": {"description": "Updated metadata only"},
                }],
                source="grid",
                actor="designer@example.com",
                change_summary="Correct description",
            )
            service.apply_metadata_batch(batch["id"], actor="designer@example.com")
            updated = service.get_component(released["id"])
            assert updated is not None
            self.assertEqual(updated["workflow_stage"], "qa_review")
            self.assertEqual({asset["id"]: asset["sha256"] for asset in updated["assets"]}, parent_assets)
            self.assertEqual(
                service.get_component(released["id"], released_only=True)["revision_id"],
                parent_revision_id,
            )
            comparison = service.compare_component_revisions(
                released["id"], parent_revision_id, updated["revision_id"],
            )
            self.assertEqual(comparison["summary"]["assetChanges"], 0)
            validation = service.get_component_validation(released["id"])
            self.assertEqual(validation["summary"]["status"], "passed")
            self.assertTrue(validation["runs"])
            self.assertTrue(all(run["inherited"] for run in validation["runs"]))
            self.assertTrue(
                all(run["inherited_from_revision_id"] == parent_revision_id for run in validation["runs"])
            )

    def test_preview_regeneration_updates_derived_outputs_without_a_revision(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = DeterministicPreviewCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="Preview versioning resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-PREVIEW-1",
                actor="author@example.com",
            )
            symbol_path = service.store_root / "symbols" / "Test" / "R.kicad_sym"
            footprint_path = service.store_root / "footprints" / "Test.pretty" / "R.kicad_mod"
            symbol_path.parent.mkdir(parents=True, exist_ok=True)
            footprint_path.parent.mkdir(parents=True, exist_ok=True)
            symbol_path.write_text('(kicad_symbol_lib (symbol "R"))', encoding="utf-8")
            footprint_path.write_text('(footprint "R")', encoding="utf-8")
            with service._connect() as conn:  # type: ignore[attr-defined]
                for asset_type, path in (("symbol", symbol_path), ("footprint", footprint_path)):
                    asset = service._register_asset(  # type: ignore[attr-defined]
                        conn,
                        asset_type=asset_type,
                        canonical_path=path,
                        target_library="Test",
                        target_name="R",
                    )
                    service._ensure_asset_preview(conn, asset)  # type: ignore[attr-defined]
                    service._attach_asset_revision(  # type: ignore[attr-defined]
                        conn,
                        component_id=component["id"],
                        asset=asset,
                        required=True,
                        actor="author@example.com",
                        change_summary=f"Attach {asset_type}",
                    )
                conn.commit()

            baseline = service.get_component(component["id"])
            assert baseline is not None
            self.assertEqual(len(baseline["previews"]), 2)
            baseline_revision_id = baseline["revision_id"]
            baseline_preview_ids = {preview["kind"]: preview["id"] for preview in baseline["previews"]}
            baseline_paths = {
                preview["id"]: Path(service.catalog_preview_path(preview["id"])[0])
                for preview in baseline["previews"]
            }

            unchanged = service.regenerate_component_previews(component["id"], actor="renderer@example.com")
            self.assertEqual(unchanged["revision_id"], baseline_revision_id)

            service.symbol_preview = b"<svg>symbol-v2</svg>"
            service.footprint_preview = b"<svg>footprint-v2</svg>"
            changed = service.regenerate_component_previews(component["id"], actor="renderer@example.com")
            self.assertEqual(changed["revision_id"], baseline_revision_id)
            self.assertEqual(changed["revision"], baseline["revision"])
            self.assertEqual(changed["manifest_hash"], baseline["manifest_hash"])
            self.assertEqual({preview["kind"] for preview in changed["previews"]}, {"symbol", "footprint"})
            self.assertNotEqual({preview["kind"]: preview["id"] for preview in changed["previews"]}, baseline_preview_ids)
            self.assertTrue(all(path.is_file() for path in baseline_paths.values()))

            service.preview_version = "generator-v2"
            generator_changed = service.regenerate_component_previews(
                component["id"], actor="renderer@example.com"
            )
            self.assertEqual(generator_changed["revision_id"], baseline_revision_id)
            self.assertEqual(generator_changed["manifest_hash"], baseline["manifest_hash"])

            service.fail_previews = True
            failed = service.regenerate_component_previews(component["id"], actor="renderer@example.com")
            self.assertEqual(failed["revision_id"], baseline_revision_id)
            self.assertEqual(service.list_component_revisions(component["id"])[0]["id"], baseline_revision_id)
            self.assertTrue(service.verify_component_audit_chain(component["id"])["valid"])

    def test_multi_unit_symbol_previews_are_revision_bound_and_diffable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = MultiUnitPreviewCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="LM358",
                description="Dual operational amplifier",
                datasheet="https://example.com/lm358.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-LM358",
                actor="author@example.com",
            )
            symbol_path = service.store_root / "symbols" / "Test" / "LM358.kicad_sym"
            symbol_path.parent.mkdir(parents=True, exist_ok=True)
            symbol_path.write_text('(kicad_symbol_lib (symbol "LM358"))', encoding="utf-8")
            with service._connect() as conn:  # type: ignore[attr-defined]
                asset = service._register_asset(  # type: ignore[attr-defined]
                    conn,
                    asset_type="symbol",
                    canonical_path=symbol_path,
                    target_library="Test",
                    target_name="LM358",
                )
                service._ensure_asset_previews(conn, asset)  # type: ignore[attr-defined]
                service._attach_asset_revision(  # type: ignore[attr-defined]
                    conn,
                    component_id=component["id"],
                    asset=asset,
                    required=True,
                    actor="author@example.com",
                    change_summary="Attach multi-unit symbol",
                )
                conn.commit()

            baseline = service.get_component(component["id"])
            assert baseline is not None
            self.assertEqual([preview["unit"] for preview in baseline["previews"]], [1, 2])
            self.assertEqual([preview["unit_label"] for preview in baseline["previews"]], ["Unit A", "Unit B"])
            self.assertEqual([preview["preview_key"] for preview in baseline["previews"]], ["symbol", "symbol:unit2"])

            service.symbol_units = [b"<svg>unit-a-v1</svg>", b"<svg>unit-b-v2</svg>"]
            changed = service.update_component_metadata(
                component["id"],
                {"description": "Dual operational amplifier, revised"},
                actor="author@example.com",
                expected_revision_id=baseline["revision_id"],
            )
            comparison = service.compare_component_revisions(component["id"], baseline["revision_id"], changed["revision_id"])
            symbol_change = comparison["assetChanges"][0]
            self.assertEqual(symbol_change["status"], "modified")
            self.assertEqual([preview["unit"] for preview in symbol_change["before"]["previews"]], [1, 2])
            self.assertEqual([preview["unit"] for preview in symbol_change["after"]["previews"]], [1, 2])

    def test_manifest_a0_remains_stable_while_a1_hashes_preview_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = DeterministicPreviewCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="1uF",
                description="Manifest compatibility capacitor",
                datasheet="https://example.com/c.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-MANIFEST-A0",
            )
            with service._connect() as conn:  # type: ignore[attr-defined]
                revision_id = component["revision_id"]
                conn.execute(
                    "UPDATE component_revisions SET manifest_schema = ? WHERE id = ?",
                    (REVISION_MANIFEST_A0, revision_id),
                )
                a0 = service._revision_manifest_hash(conn, revision_id)  # type: ignore[attr-defined]
                conn.execute(
                    "UPDATE component_revisions SET manifest_hash = ? WHERE id = ?",
                    (a0, revision_id),
                )
                conn.execute(
                    "UPDATE component_revisions SET manifest_schema = ? WHERE id = ?",
                    (REVISION_MANIFEST_A1, revision_id),
                )
                a1 = service._revision_manifest_hash(conn, revision_id)  # type: ignore[attr-defined]
            self.assertNotEqual(a0, a1)
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "UPDATE component_revisions SET manifest_schema = ?, manifest_hash = ? WHERE id = ?",
                    (REVISION_MANIFEST_A0, a0, component["revision_id"]),
                )
                conn.commit()
            service.close()
            service.initialize()
            migrated = service.get_component(component["id"])
            assert migrated is not None
            self.assertEqual(migrated["manifest_hash"], a0)

            with self.assertRaisesRegex(ValueError, "expected_revision_id is required"):
                service.update_component_metadata(
                    component["id"],
                    {"value": "18k"},
                    actor="author@example.com",
                )

    def test_existing_component_without_audit_events_is_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-AUDIT",
            )
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute("DELETE FROM catalog_audit_events WHERE component_id = ?", (component["id"],))
                conn.execute("DELETE FROM catalog_meta WHERE key = ?", (f"audit_head:{component['id']}",))
                conn.commit()

            verification = service.verify_component_audit_chain(component["id"])

            self.assertFalse(verification["valid"])
            self.assertEqual(verification["coverage"], "missing")
            self.assertEqual(verification["reason"], "missing_audit_events")

    def test_changed_asset_uses_content_addressed_revision_without_mutating_original(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="MCU",
                description="Controller",
                datasheet="https://example.com/mcu.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-MCU",
                actor="author@example.com",
            )
            first = service.attach_auxiliary_asset(
                component["id"],
                asset_type="3dmodel",
                upload_name="mcu.step",
                payload=b"model-v1",
                target_library="Prism_3D",
                actor="author@example.com",
            )["component"]
            second = service.attach_auxiliary_asset(
                component["id"],
                asset_type="3dmodel",
                upload_name="mcu.step",
                payload=b"model-v2",
                target_library="Prism_3D",
                actor="author@example.com",
            )["component"]

            self.assertEqual(first["revision"], 2)
            self.assertEqual(second["revision"], 3)
            with service._connect() as conn:  # type: ignore[attr-defined]
                first_asset = service._load_assets_for_revision(conn, first["revision_id"])[0]  # type: ignore[attr-defined]
                second_assets = service._load_assets_for_revision(conn, second["revision_id"])  # type: ignore[attr-defined]
            self.assertEqual(Path(first_asset["canonical_path"]).read_bytes(), b"model-v1")
            self.assertEqual(
                {Path(asset["canonical_path"]).read_bytes() for asset in second_assets},
                {b"model-v1", b"model-v2"},
            )
            self.assertEqual(len({asset["canonical_path"] for asset in second_assets}), 2)

    def test_changed_canonical_file_is_registered_as_a_new_immutable_asset(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="MCU",
                description="Controller",
                datasheet="https://example.com/mcu.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-MCU-MUTATED",
            )
            first = service.attach_auxiliary_asset(
                component["id"],
                asset_type="3dmodel",
                upload_name="mcu.step",
                payload=b"model-v1",
                target_library="Prism_3D",
            )["component"]
            with service._connect() as conn:  # type: ignore[attr-defined]
                first_asset = service._load_assets_for_revision(conn, first["revision_id"])[0]  # type: ignore[attr-defined]
            mutable_path = Path(first_asset["canonical_path"])
            mutable_path.write_bytes(b"externally-edited-model-v2")

            linked = service.link_library_asset(
                component["id"],
                "3dmodel",
                str(mutable_path.relative_to(service.store_root / "3dmodels")),
                "Prism_3D",
                "mcu.step",
            )["component"]

            expected_hash = hashlib.sha256(b"externally-edited-model-v2").hexdigest()
            with service._connect() as conn:  # type: ignore[attr-defined]
                historical = conn.execute("SELECT * FROM assets WHERE id = ?", (first_asset["id"],)).fetchone()
                current_assets = service._load_assets_for_revision(conn, linked["revision_id"])  # type: ignore[attr-defined]
            new_asset = next(asset for asset in current_assets if asset["sha256"] == expected_hash)
            self.assertEqual(str(historical["sha256"]), str(first_asset["sha256"]))
            self.assertNotEqual(new_asset["id"], first_asset["id"])
            self.assertIn(f"/revisions/{expected_hash}/", str(new_asset["canonical_path"]))
            self.assertEqual(Path(new_asset["canonical_path"]).read_bytes(), b"externally-edited-model-v2")

    def test_project_component_import_session_is_durable_and_commit_pinned(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            session = service.create_project_import_session(
                scope="component",
                project_id="project-1",
                project_ids=["project-1"],
                project_revisions={"project-1": "abc123"},
                source_revision="abc123",
                selection={"reference": "U12", "schematic_uuid": "symbol-uuid"},
                actor="author@example.com",
            )
            service.close()
            reopened = service.get_project_import_session(session["id"])
            self.assertIsNotNone(reopened)
            assert reopened is not None
            self.assertEqual(reopened["status"], "queued")
            self.assertEqual(reopened["source_revision"], "abc123")
            self.assertEqual(reopened["project_revisions"], {"project-1": "abc123"})
            self.assertEqual(reopened["selection"]["reference"], "U12")
            service.stage_project_import_proposals(
                session["id"],
                [
                    {
                        "dedupe_key": "part-key",
                        "component_uid": "cmp-u12",
                        "reference": "U12",
                        "metadata": {"value": "Controller"},
                        "provenance": [{"projectId": "project-1", "sourceRevision": "abc123"}],
                        "findings": [],
                    }
                ],
            )
            staged = service.get_project_import_session(session["id"])
            self.assertEqual(staged["status"], "staged")
            self.assertEqual(staged["proposal_count"], 1)
            proposals = service.list_project_import_proposals(session["id"])
            self.assertEqual(proposals[0]["metadata"]["value"], "Controller")

    def test_initialize_backfills_manifest_and_audit_for_existing_catalog(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-10K",
            )
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute("UPDATE component_revisions SET manifest_hash = '' WHERE id = ?", (component["revision_id"],))
                conn.execute("DELETE FROM catalog_audit_events WHERE component_id = ?", (component["id"],))
                conn.commit()
            service.close()
            service.initialize()

            migrated = service.get_component(component["id"])
            self.assertTrue(migrated["manifest_hash"])
            audit = service.list_component_audit_events(component["id"])
            self.assertEqual(audit[0]["event_type"], "audit.migrated")

    def test_initialize_migrates_legacy_single_asset_type_links(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            service.initialize()
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.executescript(
                    """
                    DROP TABLE revision_assets;
                    CREATE TABLE revision_assets (
                        revision_id TEXT NOT NULL REFERENCES component_revisions(id) ON DELETE CASCADE,
                        asset_type TEXT NOT NULL,
                        asset_id TEXT NOT NULL REFERENCES assets(id),
                        required INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        PRIMARY KEY(revision_id, asset_type)
                    );
                    """
                )
                conn.commit()
            service.close()
            service.initialize()
            with service._connect() as conn:  # type: ignore[attr-defined]
                primary_key = [
                    row["name"]
                    for row in sorted(conn.execute("PRAGMA table_info(revision_assets)").fetchall(), key=lambda row: row["pk"])
                    if row["pk"]
                ]
            self.assertEqual(primary_key, ["revision_id", "asset_id"])

    def test_revision_author_cannot_self_approve_without_audited_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-10K",
                actor="author@example.com",
            )
            service.set_release_status(component["id"], "in_progress", actor="author@example.com")
            service.set_release_status(component["id"], "qa_review", actor="author@example.com")
            with self.assertRaisesRegex(ValueError, "Two-person approval"):
                service.set_release_status(component["id"], "done", actor="author@example.com")
            approved = service.set_release_status(
                component["id"],
                "done",
                actor="author@example.com",
                self_approval_override_reason="Emergency prototype release",
            )
            self.assertEqual(approved["workflow_stage"], "done")
            latest_event = service.list_component_audit_events(component["id"])[0]
            self.assertEqual(latest_event["details"]["self_approval_override_reason"], "Emergency prototype release")
            decisions = service.list_component_review_decisions(component["id"])
            self.assertEqual(decisions[0]["decision"], "emergency_override")
            self.assertEqual(decisions[0]["note"], "Emergency prototype release")

    def test_accept_project_proposal_creates_one_atomic_revision_with_assets_and_extra_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            session = service.create_project_import_session(
                scope="component",
                project_id="project-1",
                project_ids=["project-1"],
                project_revisions={"project-1": "abc123"},
                source_revision="abc123",
                selection={"reference": "U12"},
                actor="author@example.com",
            )
            staging = service.store_root / "imports" / session["id"] / "candidate"
            staging.mkdir(parents=True)
            symbol_path = staging / "Controller.kicad_sym"
            symbol_path.write_text('(kicad_symbol_lib (version 20231120) (generator "test") (symbol "Controller"))', encoding="utf-8")
            footprint_path = staging / "Controller.kicad_mod"
            footprint_path.write_text('(footprint "Controller" (version 20240108) (generator "test"))', encoding="utf-8")
            model_top_path = staging / "Controller-top.step"
            model_top_path.write_bytes(b"top-model")
            model_bottom_path = staging / "Controller-bottom.step"
            model_bottom_path.write_bytes(b"bottom-model")

            def asset(path: Path, asset_type: str) -> dict:
                import hashlib

                payload = path.read_bytes()
                return {
                    "asset_type": asset_type,
                    "filename": path.name,
                    "staged_path": str(path),
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "size_bytes": len(payload),
                    "target_library": "Acme",
                    "target_name": path.stem,
                    "source_path": path.name,
                }

            service.stage_project_import_proposals(
                session["id"],
                [
                    {
                        "dedupe_key": "controller-key",
                        "component_uid": "cmp-u12",
                        "reference": "U12",
                        "metadata": {
                            "value": "Controller",
                            "footprint": "Acme:Controller",
                            "manufacturer": "Acme",
                            "manufacturer_part_number": "ACME-CTRL",
                            "description": "Project controller",
                            "datasheet": "https://example.com/controller.pdf",
                            "fields": {"Voltage Rating": "5V"},
                        },
                        "assets": [
                            asset(symbol_path, "symbol"),
                            asset(footprint_path, "footprint"),
                            asset(model_top_path, "3dmodel"),
                            asset(model_bottom_path, "3dmodel"),
                        ],
                        "provenance": [{"projectId": "project-1", "sourceRevision": "abc123", "reference": "U12"}],
                        "findings": [],
                    }
                ],
            )
            proposal = service.list_project_import_proposals(session["id"])[0]
            accepted = service.accept_project_import_proposal(
                proposal["id"],
                actor="author@example.com",
            )
            component = accepted["component"]
            self.assertEqual(component["revision"], 1)
            self.assertEqual(component["source"], "external")
            self.assertEqual(component["external_source"], "project")
            self.assertEqual(component["extra_fields"]["Voltage Rating"], "5V")
            self.assertEqual(len([item for item in component["assets"] if item["asset_type"] == "3dmodel"]), 2)
            self.assertEqual({item["asset_type"] for item in component["assets"]}, {"symbol", "footprint", "3dmodel"})
            self.assertEqual(accepted["proposal"]["status"], "accepted")
            self.assertEqual(accepted["proposal"]["accepted_component_id"], component["id"])
            self.assertEqual(service.list_component_audit_events(component["id"])[0]["event_type"], "component.imported")
            usage = service.list_component_usage(component["id"])
            self.assertEqual(usage[0]["project_id"], "project-1")
            self.assertEqual(usage[0]["references"], ["U12"])

            second_session = service.create_project_import_session(
                scope="component",
                project_id="project-2",
                project_ids=["project-2"],
                project_revisions={"project-2": "def456"},
                source_revision="def456",
                selection={"reference": "U3"},
                actor="author@example.com",
            )
            second_staging = service.store_root / "imports" / second_session["id"] / "candidate"
            second_staging.mkdir(parents=True)
            second_symbol_path = second_staging / symbol_path.name
            second_symbol_path.write_bytes(symbol_path.read_bytes())
            second_footprint_path = second_staging / footprint_path.name
            second_footprint_path.write_bytes(footprint_path.read_bytes())
            service.stage_project_import_proposals(
                second_session["id"],
                [
                    {
                        "dedupe_key": "controller-key",
                        "component_uid": "cmp-u3",
                        "reference": "U3",
                        "metadata": {
                            "value": "Controller Rev B",
                            "footprint": "Acme:Controller",
                            "manufacturer": "Acme",
                            "manufacturer_part_number": "ACME-CTRL",
                            "description": "Updated project controller",
                            "datasheet": "https://example.com/controller.pdf",
                            "fields": {"Voltage Rating": "5V"},
                        },
                        "assets": [asset(second_symbol_path, "symbol"), asset(second_footprint_path, "footprint")],
                        "provenance": [{"projectId": "project-2", "sourceRevision": "def456", "reference": "U3"}],
                        "findings": [],
                    }
                ],
            )
            second_proposal = service.list_project_import_proposals(second_session["id"])[0]
            revised = service.accept_project_import_proposal(second_proposal["id"], actor="author@example.com")["component"]
            self.assertEqual(revised["id"], component["id"])
            self.assertEqual(revised["revision"], 2)
            self.assertEqual(service.list_components(page=1, page_size=10)["total"], 1)
            self.assertEqual({item["project_id"] for item in service.list_component_usage(component["id"])}, {"project-1", "project-2"})

            third_session = service.create_project_import_session(
                scope="component",
                project_id="project-3",
                project_ids=["project-3"],
                project_revisions={"project-3": "ghi789"},
                source_revision="ghi789",
                selection={"reference": "U9"},
                actor="author@example.com",
            )
            third_staging = service.store_root / "imports" / third_session["id"] / "candidate"
            third_staging.mkdir(parents=True)
            third_symbol_path = third_staging / symbol_path.name
            third_symbol_path.write_bytes(symbol_path.read_bytes())
            third_footprint_path = third_staging / footprint_path.name
            third_footprint_path.write_bytes(footprint_path.read_bytes())
            service.stage_project_import_proposals(
                third_session["id"],
                [
                    {
                        "dedupe_key": "controller-key",
                        "component_uid": "cmp-u9",
                        "reference": "U9",
                        "metadata": {
                            "value": "Controller Rev B",
                            "footprint": "Acme:Controller",
                            "manufacturer": "Acme",
                            "manufacturer_part_number": "ACME-CTRL",
                            "description": "Updated project controller",
                            "datasheet": "https://example.com/controller.pdf",
                            "fields": {"Voltage Rating": "5V"},
                        },
                        "assets": [asset(third_symbol_path, "symbol"), asset(third_footprint_path, "footprint")],
                        "provenance": [{"projectId": "project-3", "sourceRevision": "ghi789", "reference": "U9"}],
                        "findings": [],
                    }
                ],
            )
            third_proposal = service.list_project_import_proposals(third_session["id"])[0]
            repeated = service.accept_project_import_proposal(third_proposal["id"], actor="author@example.com")["component"]
            self.assertEqual(repeated["revision"], 2)
            self.assertEqual(len(service.list_component_revisions(component["id"])), 2)
            self.assertEqual(
                {item["project_id"] for item in service.list_component_usage(component["id"])},
                {"project-1", "project-2", "project-3"},
            )

    def test_audit_verification_detects_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-10K",
            )
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "UPDATE catalog_audit_events SET details_json = '{\"tampered\":true}' WHERE component_id = ?",
                    (component["id"],),
                )
                conn.commit()
            verification = service.verify_component_audit_chain(component["id"])
            self.assertFalse(verification["valid"])
            self.assertTrue(verification["first_invalid_event_id"])

    def test_audit_verification_detects_truncated_head(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-10K",
            )
            service.set_release_status(component["id"], "in_progress")
            with service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "DELETE FROM catalog_audit_events WHERE component_id = ? AND sequence = 2",
                    (component["id"],),
                )
                conn.commit()
            verification = service.verify_component_audit_chain(component["id"])
            self.assertFalse(verification["valid"])
            self.assertEqual(verification["reason"], "audit_head_mismatch")

    def test_released_component_creates_finalized_draft_and_preserves_release_when_draft_archived(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            released = self._create_released_component(service, value="10k", mpn="ACME-R-DRAFT")
            released_revision_id = released["revision_id"]
            draft = service.set_release_status(released["id"], "open", actor="designer@example.com")
            self.assertNotEqual(draft["revision_id"], released_revision_id)
            self.assertTrue(draft["manifest_hash"])
            self.assertEqual(draft["parent_revision_id"], released_revision_id)
            self.assertEqual(service.list_component_audit_events(released["id"])[0]["event_type"], "revision.created")

            archived = service.set_release_status(draft["id"], "archived", actor="designer@example.com")
            self.assertEqual(archived["released_revision_id"], released_revision_id)
            released_view = service.get_component(released["id"], released_only=True)
            self.assertIsNotNone(released_view)
            self.assertEqual(released_view["revision_id"], released_revision_id)
            self.assertEqual(len(service.list_component_release_records(released["id"])), 1)

    def test_delete_is_an_audited_tombstone(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="10k",
                description="10k resistor",
                datasheet="https://example.com/r.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-R-RETIRE",
            )
            self.assertTrue(service.delete_component(component["id"], actor="librarian@example.com"))
            retired = service.get_component(component["id"])
            self.assertIsNotNone(retired)
            self.assertFalse(retired["is_active"])
            self.assertEqual(service.list_component_audit_events(component["id"])[0]["event_type"], "component.retired")
            self.assertTrue(service.verify_component_audit_chain(component["id"])["valid"])

    def test_component_identity_rejects_duplicate_manufacturer_part_number(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            service.create_manual_component(
                value="Controller",
                description="Controller A",
                datasheet="https://example.com/a.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-DUPLICATE",
            )
            with self.assertRaisesRegex(ValueError, "already exists"):
                service.create_manual_component(
                    value="Controller alias",
                    description="Duplicate identity",
                    datasheet="https://example.com/b.pdf",
                    manufacturer=" acme ",
                    manufacturer_part_number="acme-duplicate",
                )

    def test_semantic_scan_indexes_current_and_historical_usage_before_import_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            component = service.create_manual_component(
                value="Controller",
                description="Project controller",
                datasheet="https://example.com/controller.pdf",
                manufacturer="Acme",
                manufacturer_part_number="ACME-USAGE",
            )

            def proposal(commit: str, reference: str) -> dict:
                return {
                    "metadata": {
                        "manufacturer": "Acme",
                        "manufacturer_part_number": "ACME-USAGE",
                    },
                    "provenance": [
                        {
                            "projectId": "project-1",
                            "sourceRevision": commit,
                            "reference": reference,
                            "componentUid": "cmp:controller",
                            "page": "power.kicad_sch",
                            "schematicUuid": "sch-uuid",
                            "pcbFootprintUuid": "pcb-uuid",
                        }
                    ],
                }

            first = service.index_project_component_usage([proposal("commit-a", "U1")])
            second = service.index_project_component_usage([proposal("commit-b", "U2")])
            self.assertEqual(first, {"matched_components": 1, "observations": 1})
            self.assertEqual(second, {"matched_components": 1, "observations": 1})

            current = service.list_component_usage(component["id"])
            self.assertEqual(len(current), 1)
            self.assertEqual(current[0]["source_revision"], "commit-b")
            self.assertEqual(current[0]["references"], ["U2"])
            self.assertEqual(current[0]["details"][0]["schematicUuid"], "sch-uuid")

            history = service.list_component_usage(component["id"], include_history=True)
            self.assertEqual({item["source_revision"] for item in history}, {"commit-a", "commit-b"})
            self.assertEqual(sum(bool(item["is_current"]) for item in history), 1)

    def test_project_import_acceptance_remediates_metadata_and_selects_conflicting_primary_asset(self) -> None:
        import hashlib

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = ComponentCatalogService(
                store_root=root / "components",
                database_url=str(root / "prism.sqlite3"),
            )
            session = service.create_project_import_session(
                scope="component",
                project_id="project-1",
                project_ids=["project-1"],
                project_revisions={"project-1": "abc123"},
                selection={"reference": "U1"},
            )
            staging = service.store_root / "imports" / session["id"]
            staging.mkdir(parents=True)

            def staged_asset(filename: str, payload: bytes, asset_type: str, target_name: str) -> dict:
                path = staging / filename
                path.write_bytes(payload)
                return {
                    "asset_type": asset_type,
                    "filename": filename,
                    "staged_path": str(path),
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "size_bytes": len(payload),
                    "target_library": "Acme",
                    "target_name": target_name,
                    "source_path": filename,
                }

            symbol_a = staged_asset("Controller-A.kicad_sym", b"symbol-a", "symbol", "Controller")
            symbol_b = staged_asset("Controller-B.kicad_sym", b"symbol-b", "symbol", "Controller")
            footprint = staged_asset("Controller.kicad_mod", b"footprint", "footprint", "Controller")
            model = staged_asset("Controller.step", b"model", "3dmodel", "Controller")
            service.stage_project_import_proposals(
                session["id"],
                [
                    {
                        "dedupe_key": "controller",
                        "reference": "U1",
                        "metadata": {"value": "Controller", "footprint": "Acme:Controller", "fields": {}},
                        "assets": [symbol_a, symbol_b, footprint, model],
                        "provenance": [{"projectId": "project-1", "sourceRevision": "abc123"}],
                        "findings": [
                            {"code": "missing_metadata_description", "severity": "error", "message": "Missing description"},
                            {"code": "conflicting_symbol_assets", "severity": "error", "message": "Choose a symbol"},
                        ],
                    }
                ],
            )
            proposal = service.list_project_import_proposals(session["id"])[0]
            overrides = {
                "description": "Controller",
                "datasheet": "https://example.com/controller.pdf",
                "manufacturer": "Acme",
                "manufacturer_part_number": "ACME-CTRL",
            }
            with self.assertRaisesRegex(ValueError, "exactly one symbol"):
                service.accept_project_import_proposal(proposal["id"], metadata_overrides=overrides)

            accepted = service.accept_project_import_proposal(
                proposal["id"],
                metadata_overrides=overrides,
                asset_selections={
                    "symbol": [symbol_b["sha256"]],
                    "footprint": [footprint["sha256"]],
                    "3dmodel": [],
                },
            )["component"]
            symbol_assets = [asset for asset in accepted["assets"] if asset["asset_type"] == "symbol"]
            self.assertEqual(len(symbol_assets), 1)
            self.assertFalse(any(asset["asset_type"] == "3dmodel" for asset in accepted["assets"]))
            with service._connect() as conn:  # type: ignore[attr-defined]
                linked = service._load_assets_for_revision(conn, accepted["revision_id"])  # type: ignore[attr-defined]
            selected_symbol = next(asset for asset in linked if asset["asset_type"] == "symbol")
            self.assertEqual(selected_symbol["sha256"], symbol_b["sha256"])


if __name__ == "__main__":
    unittest.main()
