"""The catalog import CLIs write what the catalog expects (PostgreSQL integration).

``scripts/import_database_library.py`` and ``scripts/import_footprint_library.py``
are run end to end against ``TEST_POSTGRES_URL`` with a small library, and the
rows they leave behind are read back: components, revisions, assets,
representations, release records and audit events.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import sqlite3
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService  # noqa: E402


POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(f"prism_{name}_under_test", REPO_ROOT / "scripts" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _run(module, argv: list[str]) -> tuple[int, dict]:
    output = io.StringIO()
    with patch.object(sys, "argv", ["importer", *argv]), contextlib.redirect_stdout(output):
        code = module.main()
    text = output.getvalue()
    report = json.loads(text[text.index("\n{") + 1:] if not text.startswith("{") else text)
    return code, report


SYMBOL_LIBRARY = """(kicad_symbol_lib (version 20231120) (generator "test")
  (symbol "{name}" (property "Reference" "U" (at 0 0 0)) (property "Value" "{name}" (at 0 0 0))
    (symbol "{name}_0_1" (rectangle (start -1 1) (end 1 -1)))
  )
)
"""

FOOTPRINT = """(footprint "{name}" (version 20240108) (generator "test") (layer "F.Cu")
  (descr "SOIC, 8-Leads, test body")
  (property "Reference" "REF**" (at 0 0 0) (layer "F.SilkS"))
  (property "Datasheet" "https://example.test/acme.pdf" (at 0 0 0) (layer "F.Fab"))
  (pad "1" smd rect (at 0 0) (size 1 1) (layers "F.Cu"))
)
"""


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for PostgreSQL integration tests")
class CatalogImportScriptTests(unittest.TestCase):
    maxDiff = None

    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.token = uuid.uuid4().hex[:8]
        self.store = self.root / "store"
        self.service = ComponentCatalogPostgresService(store_root=self.store, database_url=POSTGRES_URL)
        self.service.initialize()
        self.field_ids = {str(field["id"]) for field in self.service.list_metadata_fields()}

    def tearDown(self) -> None:
        # The imports label their extra fields; a field left active changes other suites' exports.
        for field in self.service.list_metadata_fields():
            if str(field["id"]) not in self.field_ids:
                self.service.set_metadata_field_archived(str(field["id"]), True, actor="integration-test@local")
        # Database-library imports are CERN imports; other suites in this database count
        # those, so they are removed the way an operator would (reset_prism_catalog.py).
        with self.service.connection() as conn:
            _load_script("reset_prism_catalog")._delete_cern_imports(conn, dry_run=False)
            conn.commit()
        with self.service.connection() as conn:
            ids = [str(row["id"]) for row in conn.execute(
                "SELECT c.id FROM components c JOIN component_revisions r ON r.component_id = c.id "
                "WHERE r.name LIKE %s OR r.mpn LIKE %s",
                (f"%{self.token}%", f"%{self.token}%"),
            ).fetchall()]
        for component_id in dict.fromkeys(ids):
            self.service.deactivate_component(component_id, actor="integration-test@local", reason="import script test cleanup")
        self.service.close()
        self.tempdir.cleanup()

    def _rows(self, sql: str, *params: object) -> list[dict]:
        with self.service.connection() as conn:
            return [dict(row) for row in conn.execute(sql, params).fetchall()]

    def _components(self) -> list[dict]:
        return self._rows(
            "SELECT c.id, c.slug, c.identity_kind, c.identity_source, c.normalized_manufacturer, "
            "c.normalized_part_number, c.source, c.external_source, c.external_id, c.is_active, "
            "c.current_revision_id, c.released_revision_id, r.version, r.parent_revision_id, r.change_kind, "
            "r.change_summary, r.created_by, r.manifest_hash, r.manifest_schema, r.release_status, r.name, "
            "r.value, r.manufacturer, r.mpn, r.mpn_source, r.package_name, r.category, r.extra_fields, "
            "r.keywords, r.search_document "
            "FROM components c JOIN component_revisions r ON r.id = c.current_revision_id "
            "WHERE r.name LIKE %s OR r.mpn LIKE %s ORDER BY r.name",
            f"%{self.token}%", f"%{self.token}%",
        )

    def _revision_children(self, revision_id: str) -> dict:
        return {
            "assets": self._rows(
                "SELECT ra.asset_type, ra.required, a.target_library, a.target_name FROM revision_assets ra "
                "JOIN assets a ON a.id = ra.asset_id WHERE ra.revision_id = %s ORDER BY ra.asset_type",
                revision_id,
            ),
            "representations": self._rows(
                "SELECT label, symbol_asset_id IS NOT NULL AS has_symbol, footprint_asset_id IS NOT NULL AS has_footprint, "
                "is_default, display_order, source_internal_part_number, provenance_json "
                "FROM revision_representations WHERE revision_id = %s ORDER BY display_order",
                revision_id,
            ),
            "releases": self._rows(
                "SELECT release_label, released_by, approval_decision_id, validation_json, policy_json, "
                "manifest_hash FROM component_release_records WHERE revision_id = %s",
                revision_id,
            ),
            "audit": self._rows(
                "SELECT event_type, actor, details_json FROM catalog_audit_events WHERE revision_id = %s ORDER BY sequence",
                revision_id,
            ),
        }

    def _database_library(self) -> Path:
        source = self.root / "dbl"
        (source / "SchLib").mkdir(parents=True)
        (source / "PcbLib" / "TestFootprints.pretty").mkdir(parents=True)
        symbol = f"Sensor_{self.token}"
        footprint = f"SOIC8_{self.token}"
        (source / "SchLib" / "TestSymbols.kicad_sym").write_text(SYMBOL_LIBRARY.format(name=symbol), encoding="utf-8")
        (source / "PcbLib" / "TestFootprints.pretty" / f"{footprint}.kicad_mod").write_text(
            FOOTPRINT.format(name=footprint), encoding="utf-8"
        )
        database = sqlite3.connect(source / "library.sqlite")
        database.execute(
            'CREATE TABLE "Sensors" ("Part Number" TEXT, "LibSymbol" TEXT, "LibFootprint" TEXT, '
            '"Manufacturer" TEXT, "Manufacturer Part Number" TEXT, "Value" TEXT, "Part Description" TEXT, '
            '"PackageDescription" TEXT, "Tolerance" TEXT)'
        )
        database.executemany(
            'INSERT INTO "Sensors" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (f"IPN-{self.token}-1", f"TestSymbols:{symbol}", f"TestFootprints:{footprint}",
                 "Acme", f"ACME-{self.token}", "Sensor", "Temperature sensor", "SOIC-8", "1%"),
                (f"IPN-{self.token}-2", f"TestSymbols:{symbol}", f"TestFootprints:{footprint}",
                 "Acme", "", "Sensor", "Provisional sensor", "SOIC-8", ""),
            ],
        )
        database.commit()
        database.close()
        return source

    def test_database_library_import_writes_released_and_provisional_components(self) -> None:
        module = _load_script("import_database_library")
        source = self._database_library()

        code, report = _run(module, [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["components_released"]), (2, 1))
        components = self._components()
        self.assertEqual(len(components), 2)
        released, provisional = sorted(components, key=lambda row: row["identity_kind"])
        namespace = "cern:library"
        self.assertEqual(
            {key: released[key] for key in (
                "slug", "identity_kind", "identity_source", "normalized_manufacturer", "normalized_part_number",
                "source", "external_source", "external_id", "is_active", "version", "parent_revision_id",
                "change_kind", "change_summary", "created_by", "manifest_schema", "release_status", "name",
                "manufacturer", "mpn", "mpn_source", "package_name", "category",
            )},
            {
                "slug": f"acme-{self.token}", "identity_kind": "mpn", "identity_source": "",
                "normalized_manufacturer": "acme", "normalized_part_number": f"ACME-{self.token}".casefold(),
                "source": "import", "external_source": "cern-database-library", "external_id": namespace,
                "is_active": 1, "version": 1, "parent_revision_id": "", "change_kind": "import",
                "change_summary": "Imported from database library", "created_by": "system:import_database_library",
                "manifest_schema": "prism.revision_manifest_a3", "release_status": "released",
                "name": f"IPN-{self.token}-1", "manufacturer": "Acme", "mpn": f"ACME-{self.token}",
                "mpn_source": "manufacturer", "package_name": "SOIC-8", "category": "Sensors",
            },
        )
        self.assertEqual(released["released_revision_id"], released["current_revision_id"])
        self.assertTrue(released["manifest_hash"])
        self.assertEqual(json.loads(released["extra_fields"])["Tolerance"], "1%")
        self.assertEqual(
            (provisional["identity_kind"], provisional["identity_source"], provisional["normalized_manufacturer"],
             provisional["release_status"], provisional["released_revision_id"], provisional["mpn"],
             provisional["slug"]),
            ("provisional_ipn", namespace, "", "open", "", "", f"ipn-{self.token}-2"),
        )
        self.assertTrue(provisional["manifest_hash"])

        children = self._revision_children(released["current_revision_id"])
        self.assertEqual(
            [(row["asset_type"], row["required"], row["target_library"]) for row in children["assets"]],
            [("footprint", 1, "TestFootprints"), ("symbol", 1, "TestSymbols")],
        )
        self.assertEqual(len(children["representations"]), 1)
        representation = children["representations"][0]
        self.assertEqual(
            (representation["has_symbol"], representation["has_footprint"], representation["is_default"],
             representation["display_order"], representation["source_internal_part_number"]),
            (True, True, 1, 0, f"IPN-{self.token}-1"),
        )
        self.assertEqual(json.loads(representation["provenance_json"])["source_ipns"], [f"IPN-{self.token}-1"])
        self.assertEqual(
            [(row["release_label"], row["released_by"], row["approval_decision_id"], json.loads(row["policy_json"]),
              row["manifest_hash"] == released["manifest_hash"]) for row in children["releases"]],
            [("database-library-import", "system:import_database_library", "", {"trusted_import": True}, True)],
        )
        self.assertEqual(
            [(row["event_type"], row["actor"], json.loads(row["details_json"]).get("change_kind")) for row in children["audit"]],
            [("component.created", "system:import_database_library", "import"),
             ("component.released", "system:import_database_library", None)],
        )
        provisional_children = self._revision_children(provisional["current_revision_id"])
        self.assertEqual(provisional_children["releases"], [])
        self.assertEqual([row["event_type"] for row in provisional_children["audit"]], ["component.created"])

    def test_footprint_library_import_writes_draft_footprint_only_components(self) -> None:
        module = _load_script("import_footprint_library")
        source = self.root / "fpl"
        library = source / "Footprints" / "Pixxel_Sensors.pretty"
        library.mkdir(parents=True)
        name = f"ACME{self.token}"
        (library / f"{name}.kicad_mod").write_text(FOOTPRINT.format(name=name), encoding="utf-8")

        code, report = _run(module, [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
            "--mpn-mode", "full", "--manufacturer", "Acme", "--no-previews", "--models-dir", "",
        ])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["errors"]), (1, []))
        [component] = self._components()
        self.assertEqual(
            {key: component[key] for key in (
                "slug", "identity_kind", "identity_source", "normalized_manufacturer", "source", "external_source",
                "external_id", "change_kind", "change_summary", "created_by", "release_status",
                "released_revision_id", "name", "mpn", "manufacturer", "package_name", "category",
            )},
            {
                "slug": f"acme{self.token}-soic-8", "identity_kind": "mpn", "identity_source": "",
                "normalized_manufacturer": "acme", "source": "import", "external_source": "", "external_id": "",
                "change_kind": "import", "change_summary": "Imported from footprint library",
                "created_by": "system:import_footprint_library", "release_status": "open",
                "released_revision_id": "", "name": name, "mpn": name, "manufacturer": "Acme",
                "package_name": "SOIC-8", "category": "Sensors",
            },
        )
        self.assertTrue(component["manifest_hash"])
        children = self._revision_children(component["current_revision_id"])
        self.assertEqual([(row["asset_type"], row["required"]) for row in children["assets"]], [("footprint", 1)])
        self.assertEqual(
            [(row["label"], row["has_symbol"], row["has_footprint"], row["is_default"], row["source_internal_part_number"],
              json.loads(row["provenance_json"])) for row in children["representations"]],
            [(name, False, True, 1, name, {"source": f"Pixxel_Sensors.pretty/{name}.kicad_mod"})],
        )
        self.assertEqual(children["releases"], [])
        self.assertEqual(
            [(row["event_type"], row["actor"], json.loads(row["details_json"])["change_summary"]) for row in children["audit"]],
            [("component.created", "system:import_footprint_library", "Imported incomplete footprint-only representation")],
        )


if __name__ == "__main__":
    unittest.main()
