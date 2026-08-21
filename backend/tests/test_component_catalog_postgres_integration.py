from __future__ import annotations

import os
import sys
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
import base64
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlsplit


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.catalog_schema_migrations import (  # noqa: E402
    MIGRATIONS,
    pending_catalog_migrations,
)
from app.services.component_catalog_service_postgres import (  # noqa: E402
    POSTGRES_SCHEMA_VERSION,
    ComponentCatalogPostgresService,
)


POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()
APPLICATION_POSTGRES_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


def _database_identity(url: str) -> tuple[str, str, int | None, str]:
    parsed = urlsplit(url)
    return (
        parsed.username or "",
        (parsed.hostname or "").lower(),
        parsed.port,
        parsed.path.lstrip("/"),
    )


SHARED_APPLICATION_DATABASE = bool(
    POSTGRES_URL
    and APPLICATION_POSTGRES_URL
    and _database_identity(POSTGRES_URL) == _database_identity(APPLICATION_POSTGRES_URL)
)


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for PostgreSQL integration tests")
@unittest.skipIf(
    SHARED_APPLICATION_DATABASE,
    "Component catalog integration tests require a dedicated PostgreSQL database; "
    "TEST_POSTGRES_URL must not target PRISM_DATABASE_URL",
)
class ComponentCatalogPostgresIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.component_ids: list[str] = []
        self.service = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components",
            database_url=POSTGRES_URL,
        )
        self.service.initialize()

    def tearDown(self) -> None:
        # The database is explicitly isolated from the application database.
        # Deactivation keeps the test database's own audit chain valid while the
        # test database remains disposable as a unit.
        for component_id in reversed(self.component_ids):
            self.assertTrue(
                self.service.deactivate_component(
                    component_id,
                    actor="integration-test@local",
                    reason="PostgreSQL integration-test cleanup",
                ),
                f"failed to deactivate integration fixture {component_id}",
            )
            component = self.service.get_component(component_id)
            self.assertIsNotNone(component)
            self.assertFalse(bool((component or {}).get("is_active")))
        self.service.close()
        self.tempdir.cleanup()

    def _component(self, suffix: str = "") -> dict:
        token = suffix or uuid.uuid4().hex[:10]
        component = self.service.create_manual_component(
            value="10k",
            description="PostgreSQL catalog integration component",
            datasheet="https://example.com/r.pdf",
            manufacturer="Prism Integration",
            manufacturer_part_number=f"PG-R-{token}",
            actor="author@example.com",
        )
        self.component_ids.append(str(component["id"]))
        return component

    def test_concurrent_creation_allows_one_manufacturer_mpn_identity(self) -> None:
        token = "identity-" + uuid.uuid4().hex[:8]

        def create() -> tuple[str, str]:
            try:
                component = self.service.create_manual_component(
                    value="part",
                    description="Concurrent identity fixture",
                    datasheet="https://example.com/identity.pdf",
                    manufacturer="Prism Identity",
                    manufacturer_part_number=token,
                    actor="author@example.com",
                )
                return "ok", str(component["id"])
            except ValueError as exc:
                return "duplicate", str(exc)

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: create(), range(2)))
        successful = [value for status, value in results if status == "ok"]
        self.assertEqual(len(successful), 1)
        self.component_ids.extend(successful)
        self.assertEqual([status for status, _ in results].count("duplicate"), 1)

    def test_cern_scoped_reset_preserves_non_cern_components(self) -> None:
        manual = self._component("reset-manual-" + uuid.uuid4().hex[:8])
        imported = self.service.create_manual_component(
            value="cern",
            description="CERN reset fixture",
            datasheet="https://example.com/cern.pdf",
            manufacturer="CERN Reset Fixture",
            manufacturer_part_number="CERN-" + uuid.uuid4().hex[:8],
            actor="system:import_database_library",
        )
        imported_id = str(imported["id"])
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            conn.execute(
                "UPDATE components SET source = 'import', external_source = %s, external_id = %s WHERE id = %s",
                ("cern-database-library", "cern:CERN", imported_id),
            )
            conn.commit()

        script = Path(__file__).resolve().parents[2] / "scripts" / "reset_prism_catalog.py"
        spec = importlib.util.spec_from_file_location("prism_catalog_reset", script)
        assert spec and spec.loader
        reset_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reset_module)

        with self.service._connect() as conn:  # type: ignore[attr-defined]
            component_count, _, _ = reset_module._delete_cern_imports(conn, dry_run=True)
            self.assertEqual(component_count, 1)
            component_count, orphan_count, _ = reset_module._delete_cern_imports(conn, dry_run=False)
            conn.commit()
        self.assertEqual(component_count, 1)
        self.assertEqual(orphan_count, 0)
        self.assertIsNone(self.service.get_component(imported_id))
        self.assertIsNotNone(self.service.get_component(str(manual["id"])))
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            with self.assertRaisesRegex(Exception, "immutable catalog evidence"):
                conn.execute("DELETE FROM components WHERE id = %s", (manual["id"],))
            conn.rollback()

    def test_provisional_identity_is_draft_only_and_can_be_corrected_to_mpn(self) -> None:
        token = uuid.uuid4().hex[:8]
        provisional = self.service.create_manual_component(
            name=f"IPN-{token}",
            value="provisional",
            description="Missing manufacturer MPN",
            datasheet="https://example.com/provisional.pdf",
            manufacturer="Prism Provisional",
            manufacturer_part_number="",
            identity_kind="provisional_ipn",
            identity_source="fixture",
            source_internal_part_number=f"IPN-{token}",
            actor="author@example.com",
        )
        self.component_ids.append(str(provisional["id"]))
        self.assertEqual(provisional["identity_kind"], "provisional_ipn")
        self.assertFalse(provisional["place_enabled"])
        self.service.set_release_status(provisional["id"], "in_progress", actor="author@example.com")
        review = self.service.set_release_status(provisional["id"], "qa_review", actor="author@example.com")
        with self.assertRaisesRegex(ValueError, "Provisional"):
            self.service.set_release_status(
                provisional["id"], "done", actor="qa@example.com",
                expected_revision_id=review["revision_id"],
                expected_manifest_hash=review["manifest_hash"],
            )
        corrected = self.service.update_component_metadata(
            provisional["id"],
            {"mpn": f"REAL-{token}"},
            actor="author@example.com",
            expected_revision_id=review["revision_id"],
        )
        assert corrected is not None
        self.assertEqual(corrected["identity_kind"], "mpn")
        self.assertEqual(corrected["mpn"], f"REAL-{token}")

    def test_inventory_distinguishes_unknown_zero_and_error(self) -> None:
        component = self._component("inventory-" + uuid.uuid4().hex[:8])
        self.assertFalse(component["stock_known"])
        result = self.service.import_inventory_csv(
            "component_id,manufacturer,mpn,quantity,uom,inventory_status\n"
            f"{component['id']},{component['manufacturer']},{component['mpn']},0,pcs,available\n"
        )
        self.assertEqual(result["updated"], 1)
        zero = self.service.get_component(component["id"])
        assert zero is not None
        self.assertTrue(zero["stock_known"])
        self.assertEqual(zero["stock_quantity"], 0)
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            conn.execute(
                "UPDATE inventory_levels SET fetch_status = 'error' WHERE component_id = %s",
                (component["id"],),
            )
            conn.commit()
        errored = self.service.get_component(component["id"])
        assert errored is not None
        self.assertEqual(errored["local_inventory"]["fetch_status"], "error")

    def test_mpn_correction_updates_identity_and_rejects_conflicts(self) -> None:
        first = self._component("correction-a-" + uuid.uuid4().hex[:8])
        second = self._component("correction-b-" + uuid.uuid4().hex[:8])
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.service.update_component_metadata(
                second["id"],
                {"manufacturer": first["manufacturer"], "mpn": first["mpn"]},
                actor="editor@example.com",
                expected_revision_id=second["revision_id"],
            )
        corrected_mpn = "corrected-" + uuid.uuid4().hex[:8]
        corrected = self.service.update_component_metadata(
            second["id"],
            {"mpn": corrected_mpn},
            actor="editor@example.com",
            expected_revision_id=second["revision_id"],
        )
        assert corrected is not None
        self.assertEqual(corrected["mpn"], corrected_mpn)

    def test_concurrent_edits_serialize_head_and_audit(self) -> None:
        component = self._component("concurrent-" + uuid.uuid4().hex[:8])
        expected_revision_id = component["revision_id"]

        def update(description: str) -> tuple[str, str]:
            try:
                updated = self.service.update_component_metadata(
                    component["id"],
                    {"description": description},
                    actor="editor@example.com",
                    change_summary=description,
                    expected_revision_id=expected_revision_id,
                )
                return ("ok", str(updated["revision_id"]))
            except ValueError as exc:
                return ("conflict", str(exc))

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(update, ("Concurrent edit A", "Concurrent edit B")))

        self.assertEqual([status for status, _ in results].count("ok"), 1)
        self.assertEqual([status for status, _ in results].count("conflict"), 1)
        self.assertEqual(len(self.service.list_component_revisions(component["id"])), 2)
        self.assertTrue(self.service.verify_component_audit_chain(component["id"])["valid"])

    def test_metadata_schema_and_qa_batch_round_trip(self) -> None:
        token = uuid.uuid4().hex[:10]
        component = self._component(f"metadata-{token}")
        field = self.service.create_metadata_field(
            {
                "key": f"voltage_rating_{token}",
                "label": "Voltage rating",
                "type": "number",
                "unit": "V",
            },
            actor="admin@example.com",
        )
        batch = self.service.stage_metadata_batch(
            [
                {
                    "component_id": component["id"],
                    "expected_revision_id": component["revision_id"],
                    "patch": {"value": "12k", field["key"]: "50"},
                }
            ],
            source="grid",
            actor="designer@example.com",
            change_summary="Correct metadata in PostgreSQL",
        )
        self.assertEqual(batch["valid_items"], 1)
        applied = self.service.apply_metadata_batch(batch["id"], actor="designer@example.com")
        self.assertEqual(applied["applied"], 1)
        updated = self.service.get_component(component["id"])
        assert updated is not None
        self.assertEqual(updated["workflow_stage"], "qa_review")
        self.assertEqual(updated["revision"], component["revision"] + 1)
        self.assertEqual(updated["extra_fields"][field["key"]], "50")
        self.assertEqual(updated["value"], "12k")

        # Initialization is a version lookup after the first successful v6 migration.
        self.service.initialize()
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            version = conn.execute(
                "SELECT 1 AS present FROM catalog_schema_migrations WHERE version = %s",
                (POSTGRES_SCHEMA_VERSION,),
            ).fetchone()
        self.assertIsNotNone(version)

    def test_component_head_projection_and_streaming_csv_follow_current_revision(self) -> None:
        component = self._component("head-" + uuid.uuid4().hex[:8])
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            head = conn.execute(
                "SELECT revision_id, value FROM component_heads WHERE component_id = %s",
                (component["id"],),
            ).fetchone()
        self.assertEqual(head["revision_id"], component["revision_id"])
        self.assertEqual(head["value"], "10k")

        updated = self.service.update_component_metadata(
            component["id"],
            {"value": "12k"},
            actor="editor@example.com",
            expected_revision_id=component["revision_id"],
        )
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            head = conn.execute(
                "SELECT revision_id, value FROM component_heads WHERE component_id = %s",
                (component["id"],),
            ).fetchone()
        self.assertEqual(head["revision_id"], updated["revision_id"])
        self.assertEqual(head["value"], "12k")
        exported = "".join(self.service.iter_metadata_csv(field_keys=["value", "package_name"]))
        self.assertIn(component["id"], exported)
        self.assertIn("12k", exported)

    def test_concurrent_qa_approval_creates_one_decision_and_transition(self) -> None:
        component = self._component("approval-" + uuid.uuid4().hex[:8])
        self.service.set_release_status(component["id"], "in_progress", actor="designer@example.com")
        review = self.service.set_release_status(component["id"], "qa_review", actor="designer@example.com")

        def approve(reviewer: str) -> str:
            approved = self.service.set_release_status(
                component["id"],
                "done",
                actor=reviewer,
                actor_role="qa",
                expected_revision_id=review["revision_id"],
                expected_manifest_hash=review["manifest_hash"],
            )
            return str(approved["workflow_stage"])

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(approve, ("qa-a@example.com", "qa-b@example.com")))

        self.assertEqual(results, ["done", "done"])
        approvals = [
            decision
            for decision in self.service.list_component_review_decisions(component["id"])
            if decision["decision"] == "approved"
        ]
        transitions_to_done = [
            event
            for event in self.service.list_component_audit_events(component["id"])
            if event["event_type"] == "workflow.transitioned" and event["details"].get("to") == "done"
        ]
        self.assertEqual(len(approvals), 1)
        self.assertEqual(len(transitions_to_done), 1)
        self.assertTrue(self.service.verify_component_audit_chain(component["id"])["valid"])

    def test_assets_release_evidence_and_diff_scope_round_trip(self) -> None:
        component = self._component("assets-" + uuid.uuid4().hex[:8])
        symbol_payload = b'''(kicad_symbol_lib (version 20231120) (generator "test")
          (symbol "R_Test"
            (property "Reference" "R" (at 0 0 0) (effects (font (size 1.27 1.27))))
            (property "Value" "10k" (at 0 0 0) (effects (font (size 1.27 1.27))))
          )
        )'''
        imported_symbol = self.service.import_symbol_library(
            component["id"],
            upload_name="R_Test.kicad_sym",
            payload=symbol_payload,
            target_library="Prism_Test",
            selected_symbol="R_Test",
            actor="designer@example.com",
        )["component"]
        imported_footprint = self.service.import_footprint(
            component["id"],
            upload_name="R_Test.kicad_mod",
            payload=b'(footprint "R_Test" (version 20240108) (generator "test"))',
            target_library="Prism_Test",
            selected_footprint="R_Test",
            actor="designer@example.com",
        )["component"]
        with_model = self.service.attach_auxiliary_asset(
            component["id"],
            asset_type="3dmodel",
            upload_name="R_Test.step",
            payload=b"ISO-10303-21;END-ISO-10303-21;",
            target_library="Prism_Test",
            actor="designer@example.com",
        )["component"]
        with_spice = self.service.attach_auxiliary_asset(
            component["id"],
            asset_type="spice",
            upload_name="R_Test.lib",
            payload=b".MODEL R_Test RES R=10k",
            target_library="Prism_Test",
            actor="designer@example.com",
        )["component"]

        diff = self.service.compare_component_revisions(
            component["id"],
            imported_footprint["revision_id"],
            with_spice["revision_id"],
        )
        self.assertEqual(diff["summary"]["assetChanges"], 0)
        self.assertTrue(
            all(
                change["before"]["assetType"] in {"symbol", "footprint"}
                for change in diff["assetChanges"]
                if change["before"]
            )
        )
        self.assertEqual(with_model["revision"] + 1, with_spice["revision"])

        self.service.set_release_status(component["id"], "in_progress", actor="designer@example.com")
        self.service.set_release_status(component["id"], "qa_review", actor="designer@example.com")
        approved = self.service.set_release_status(
            component["id"],
            "done",
            actor="qa@example.com",
            actor_role="qa",
            expected_revision_id=with_spice["revision_id"],
            expected_manifest_hash=with_spice["manifest_hash"],
        )
        released = self.service.set_release_status(
            component["id"],
            "released",
            actor="designer@example.com",
            actor_role="designer",
            expected_revision_id=approved["revision_id"],
            expected_manifest_hash=approved["manifest_hash"],
        )
        self.assertEqual(released["release_status"], "released")
        remote = self.service.list_remote_component_heads(
            query=released["mpn"],
            page=1,
            page_size=1,
            include_total=False,
        )
        self.assertEqual(remote["items"][0]["id"], component["id"])
        self.assertIsNone(remote["total"])
        self.assertFalse(remote["has_more"])
        self.assertTrue(remote["items"][0]["place_enabled"])
        self.assertEqual(remote["items"][0]["representation_count"], 1)
        self.assertTrue(remote["items"][0]["default_representation_id"])
        self.assertNotEqual(remote["projection_version"], "0")
        inline = self.service.build_inline_bundle(component["id"])
        assert inline is not None
        self.assertEqual(
            inline["representation_id"], released["default_representation_id"]
        )
        records = self.service.list_component_release_records(component["id"])
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["manifest_hash"], released["manifest_hash"])
        self.assertTrue(self.service.verify_component_audit_chain(component["id"])["valid"])

    def test_non_default_representation_drives_manifest_and_inline_pair(self) -> None:
        component = self._component("representations-" + uuid.uuid4().hex[:8])

        def symbol_payload(name: str) -> bytes:
            return f'''(kicad_symbol_lib (version 20231120) (generator "test")
              (symbol "{name}"
                (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
                (property "Value" "{name}" (at 0 0 0) (effects (font (size 1.27 1.27))))
              )
            )'''.encode()

        first_symbol = self.service.import_symbol_library(
            component["id"], upload_name="S1.kicad_sym", payload=symbol_payload("S1"),
            target_library="Representations", selected_symbol="S1", actor="designer@example.com",
        )["component"]
        first_footprint = self.service.import_footprint(
            component["id"], upload_name="F1.kicad_mod",
            payload=b'(footprint "F1" (version 20240108) (generator "test"))',
            target_library="Representations", selected_footprint="F1", actor="designer@example.com",
        )["component"]
        default_footprint_id = first_footprint["representations"][0]["footprint"]["id"]
        second_symbol = self.service.import_symbol_library(
            component["id"], upload_name="S2.kicad_sym", payload=symbol_payload("S2"),
            target_library="Representations", selected_symbol="S2",
            counterpart_asset_id=default_footprint_id, actor="designer@example.com",
        )["component"]
        stale_representation_id = next(
            item["id"] for item in second_symbol["representations"]
            if item["symbol"] and item["symbol"]["target_name"] == "S2"
        )
        second_symbol_id = next(
            item["symbol"]["id"] for item in second_symbol["representations"]
            if item["symbol"] and item["symbol"]["target_name"] == "S2"
        )
        second_footprint = self.service.import_footprint(
            component["id"], upload_name="F2.kicad_mod",
            payload=b'(footprint "F2" (version 20240108) (generator "test"))',
            target_library="Representations", selected_footprint="F2",
            counterpart_asset_id=second_symbol_id, actor="designer@example.com",
        )["component"]
        selected = next(
            item for item in second_footprint["representations"]
            if item["symbol"] and item["footprint"]
            and item["symbol"]["target_name"] == "S2"
            and item["footprint"]["target_name"] == "F2"
        )
        self.assertNotEqual(selected["id"], second_footprint["default_representation_id"])
        self.service.set_release_status(component["id"], "in_progress", actor="designer@example.com")
        self.service.set_release_status(component["id"], "qa_review", actor="designer@example.com")
        approved = self.service.set_release_status(
            component["id"], "done", actor="qa@example.com",
            expected_revision_id=second_footprint["revision_id"],
            expected_manifest_hash=second_footprint["manifest_hash"],
        )
        self.service.set_release_status(
            component["id"], "released", actor="designer@example.com",
            expected_revision_id=approved["revision_id"], expected_manifest_hash=approved["manifest_hash"],
        )

        bundle = self.service.build_inline_bundle(component["id"], selected["id"])
        assert bundle is not None
        entries = json.loads(base64.b64decode(bundle["data"]))
        self.assertEqual(
            {(entry["type"], entry["name"]) for entry in entries if entry["type"] in {"symbol", "footprint"}},
            {("symbol", "S2"), ("footprint", "F2")},
        )
        with self.assertRaisesRegex(ValueError, "not found"):
            self.service.build_inline_bundle(component["id"], stale_representation_id)

    def test_database_guards_and_widened_portable_types(self) -> None:
        component = self._component("guards-" + uuid.uuid4().hex[:8])
        with self.assertRaises(Exception):
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "UPDATE component_revisions SET description = %s WHERE id = %s",
                    ("tampered", component["revision_id"]),
                )
                conn.commit()

        transitioned = self.service.set_release_status(
            component["id"], "in_progress", actor="workflow@example.com"
        )
        self.assertEqual(transitioned["release_status"], "in_progress")

        attached = self.service.attach_auxiliary_asset(
            component["id"],
            asset_type="3dmodel",
            upload_name="guard.step",
            payload=b"ISO-10303-21;END-ISO-10303-21;",
            target_library="Guard",
            actor="author@example.com",
        )["component"]
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            asset = conn.execute(
                "SELECT asset_id FROM revision_assets WHERE revision_id = %s LIMIT 1",
                (attached["revision_id"],),
            ).fetchone()
        assert asset is not None
        with self.assertRaises(Exception):
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "DELETE FROM revision_assets WHERE revision_id = %s AND asset_id = %s",
                    (attached["revision_id"], asset["asset_id"]),
                )
                conn.commit()
        with self.assertRaises(Exception):
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute("UPDATE assets SET sha256 = %s WHERE id = %s", ("0" * 64, asset["asset_id"]))
                conn.commit()

        preview_id = str(uuid.uuid4())
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            conn.execute(
                """
                INSERT INTO asset_preview_versions (
                    id, asset_id, kind, status, content_type, file_path, sha256, size_bytes,
                    generator_name, generator_version, pipeline_version, generator_fingerprint,
                    generation_error, created_at
                ) VALUES (%s, %s, 'symbol', 'ready', 'image/svg+xml', '/tmp/guard.svg', %s, 6,
                          'test', '1', 'test', %s, '', CURRENT_TIMESTAMP::text)
                """,
                (preview_id, asset["asset_id"], "a" * 64, str(uuid.uuid4())),
            )
            conn.commit()
        with self.assertRaises(Exception):
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "UPDATE asset_preview_versions SET sha256 = %s WHERE id = %s",
                    ("b" * 64, preview_id),
                )
                conn.commit()
        with self.assertRaises(Exception):
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    """
                    INSERT INTO revision_previews (revision_id, asset_id, kind, preview_id, created_at)
                    VALUES (%s, %s, 'symbol', %s, CURRENT_TIMESTAMP::text)
                    """,
                    (attached["revision_id"], asset["asset_id"], preview_id),
                )
                conn.commit()

        with self.service._connect() as conn:  # type: ignore[attr-defined]
            types = {
                (str(row["table_name"]), str(row["column_name"])): str(row["data_type"])
                for row in conn.execute(
                    """
                    SELECT table_name, column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'catalog' AND (
                        (table_name = 'inventory_levels' AND column_name = 'quantity') OR
                        (table_name = 'assets' AND column_name = 'size_bytes') OR
                        (table_name = 'catalog_audit_events' AND column_name = 'sequence') OR
                        (table_name = 'oauth_auth_codes' AND column_name = 'exp') OR
                        (table_name = 'oauth_revoked_tokens' AND column_name = 'exp')
                    )
                    """
                ).fetchall()
            }
            component_stock_column = conn.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'catalog' AND table_name = 'components'
                  AND column_name = 'stock_quantity'
                """
            ).fetchone()
        self.assertIsNone(component_stock_column)
        self.assertEqual(types[("inventory_levels", "quantity")], "double precision")
        for key in (
            ("assets", "size_bytes"),
            ("catalog_audit_events", "sequence"),
            ("oauth_auth_codes", "exp"),
            ("oauth_revoked_tokens", "exp"),
        ):
            self.assertEqual(types[key], "bigint")

    def test_a_database_from_before_the_ladder_upgrades_with_its_data(self) -> None:
        """Starting a newer build against an older catalog must not cost data.

        Until this landed, a database whose ``catalog_schema_migrations`` row did
        not match the build's version string raised at startup and pointed the
        operator at a destructive reset. That made the first catalog schema
        change in any release equivalent to discarding the catalog.
        """
        component = self._component("upgrade-" + uuid.uuid4().hex[:8])

        with self.service._connect() as conn:  # type: ignore[attr-defined]
            conn.execute("DROP TABLE IF EXISTS catalog_schema_versions")
            conn.execute("DELETE FROM catalog_schema_migrations")
            conn.commit()

        upgraded = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components",
            database_url=POSTGRES_URL,
        )
        upgraded.initialize()

        with upgraded._connect() as conn:  # type: ignore[attr-defined]
            ledger = [
                (int(row["version"]), str(row["name"]))
                for row in conn.execute(
                    "SELECT version, name FROM catalog_schema_versions ORDER BY version"
                ).fetchall()
            ]
            self.assertEqual(ledger, [(version, name) for version, name, _ in MIGRATIONS])
            self.assertEqual(pending_catalog_migrations(conn), [])
            # An older Prism treats this row as a hard precondition, so the
            # newer build has to leave it in place for a rollback to work.
            legacy = conn.execute(
                "SELECT version FROM catalog_schema_migrations WHERE version = %s",
                (POSTGRES_SCHEMA_VERSION,),
            ).fetchone()
            self.assertIsNotNone(legacy)

        survivor = upgraded.get_component(component["id"])
        self.assertIsNotNone(survivor)
        self.assertEqual(survivor["slug"], component["slug"])

    def test_repeated_startup_does_not_rewrite_widened_columns(self) -> None:
        """Replaying the column widening rewrites whole tables for nothing."""
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            self.assertEqual(pending_catalog_migrations(conn), [])

        restarted = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components",
            database_url=POSTGRES_URL,
        )
        restarted.initialize()

        with restarted._connect() as conn:  # type: ignore[attr-defined]
            applied = conn.execute(
                "SELECT count(*) AS total FROM catalog_schema_versions"
            ).fetchone()
            self.assertEqual(int(applied["total"]), len(MIGRATIONS))

    def test_populated_pre_epoch_two_catalog_is_refused_with_reset_guidance(self) -> None:
        self._component("epoch-" + uuid.uuid4().hex[:8])
        with self.service._connect() as conn:  # type: ignore[attr-defined]
            conn.execute("DELETE FROM catalog_meta WHERE key = 'catalog_schema_epoch'")
            conn.commit()
        incompatible = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components",
            database_url=POSTGRES_URL,
        )
        try:
            with self.assertRaisesRegex(RuntimeError, "catalog-only reset"):
                incompatible.initialize()
        finally:
            with self.service._connect() as conn:  # type: ignore[attr-defined]
                conn.execute(
                    "INSERT INTO catalog_meta(key, value) VALUES ('catalog_schema_epoch', '2') "
                    "ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value"
                )
                conn.commit()


if __name__ == "__main__":
    unittest.main()
