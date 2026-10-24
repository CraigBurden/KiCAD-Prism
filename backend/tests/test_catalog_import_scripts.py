"""The catalog import CLIs write what the catalog expects (PostgreSQL integration).

``scripts/import_database_library.py`` and ``scripts/import_footprint_library.py``
are run end to end against ``TEST_POSTGRES_URL`` with a small library, and the
rows they leave behind are read back: components, revisions, assets,
representations, release records and audit events.
"""

from __future__ import annotations

import contextlib
import hashlib
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

    def _linked_assets(self, revision_id: str) -> dict[str, dict]:
        rows = self._rows(
            "SELECT a.id, a.asset_type, a.canonical_path, a.sha256 FROM revision_assets ra "
            "JOIN assets a ON a.id = ra.asset_id WHERE ra.revision_id = %s",
            revision_id,
        )
        return {row["asset_type"]: row for row in rows}

    def _assert_files_match_hashes(self, assets: dict[str, dict], original: dict[str, bytes]) -> None:
        for asset_type, row in assets.items():
            payload = Path(row["canonical_path"]).read_bytes()
            self.assertEqual(payload, original[asset_type], asset_type)
            self.assertEqual(hashlib.sha256(payload).hexdigest(), row["sha256"], asset_type)

    def _assert_immutable_copy(self, asset: dict, previous: dict, payload: bytes, relative: str) -> None:
        digest = hashlib.sha256(payload).hexdigest()
        self.assertNotEqual(asset["id"], previous["id"])
        self.assertEqual(asset["sha256"], digest)
        self.assertEqual(Path(asset["canonical_path"]).resolve(), (self.store / "revisions" / digest / relative).resolve())
        self.assertEqual(Path(asset["canonical_path"]).read_bytes(), payload)

    def test_reimport_with_changed_assets_keeps_released_revision_files(self) -> None:
        # --overwrite-assets stores changed bytes at an immutable path; the files a
        # released revision links keep the bytes its recorded hashes describe, and a
        # new part imported in the same run links the changed bytes.
        module = _load_script("import_database_library")
        source = self._database_library()
        argv = [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL]
        code, report = _run(module, argv)
        self.assertEqual(code, 0, report["errors"])
        released = next(row for row in self._components() if row["release_status"] == "released")
        before = self._linked_assets(released["current_revision_id"])
        original = {asset_type: Path(row["canonical_path"]).read_bytes() for asset_type, row in before.items()}
        footprint = f"SOIC8_{self.token}"
        footprint_file = source / "PcbLib" / "TestFootprints.pretty" / f"{footprint}.kicad_mod"
        footprint_file.write_text(footprint_file.read_text(encoding="utf-8").replace("test body", "changed body"), encoding="utf-8")
        # A follow-up import of one new part that uses the same, now changed, footprint.
        database = sqlite3.connect(source / "library.sqlite")
        database.execute('DELETE FROM "Sensors"')
        database.execute(
            'INSERT INTO "Sensors" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (f"IPN-{self.token}-3", f"TestSymbols:Sensor_{self.token}", f"TestFootprints:{footprint}",
             "Acme", f"ACME-{self.token}-NEW", "Sensor", "New sensor", "SOIC-8", ""),
        )
        database.commit()
        database.close()

        code, report = _run(module, [*argv, "--overwrite-assets"])

        self.assertEqual((code, report["components_created"]), (0, 1), report["errors"])
        self.assertEqual(self._linked_assets(released["current_revision_id"]), before)
        self._assert_files_match_hashes(before, original)
        self.assertTrue(self.service.verify_component_audit_chain(released["id"])["valid"])
        [new_part] = [row for row in self._components() if row["name"] == f"IPN-{self.token}-3"]
        linked = self._linked_assets(new_part["current_revision_id"])
        self.assertEqual(linked["symbol"], before["symbol"])
        self._assert_immutable_copy(
            linked["footprint"], before["footprint"], footprint_file.read_bytes(),
            f"footprints/TestFootprints.pretty/{footprint}.kicad_mod",
        )

    def test_footprint_reimport_with_changed_model_keeps_earlier_revision_files(self) -> None:
        # A new footprint sharing a changed 3D model links an immutable copy; the
        # footprint imported first keeps the model bytes its revision recorded.
        module = _load_script("import_footprint_library")
        source = self.root / "fpl"
        library = source / "Footprints" / "Pixxel_Sensors.pretty"
        library.mkdir(parents=True)
        (source / "3D").mkdir()
        model_name = f"Shared_{self.token}.step"
        model_file = source / "3D" / model_name
        model_file.write_bytes(b"ISO-10303-21; original\n")
        model_ref = f'  (model "${{KIPRJMOD}}/{model_name}")\n)\n'

        def write_footprint(name: str) -> None:
            body = FOOTPRINT.format(name=name).removesuffix(")\n") + model_ref
            (library / f"{name}.kicad_mod").write_text(body, encoding="utf-8")

        write_footprint(f"ACME{self.token}")
        argv = [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
            "--mpn-mode", "full", "--manufacturer", "Acme", "--no-previews",
        ]
        code, report = _run(module, argv)
        self.assertEqual((code, report["components_created"]), (0, 1), report["errors"])
        [first] = self._components()
        before = self._linked_assets(first["current_revision_id"])
        self.assertEqual(sorted(before), ["3dmodel", "footprint"])
        original = {asset_type: Path(row["canonical_path"]).read_bytes() for asset_type, row in before.items()}
        model_file.write_bytes(b"ISO-10303-21; changed\n")
        write_footprint(f"ACME{self.token}NEW")

        code, report = _run(module, [*argv, "--overwrite-assets"])

        self.assertEqual((code, report["components_created"], report["components_skipped_existing"]), (0, 1, 1), report["errors"])
        self.assertEqual(self._linked_assets(first["current_revision_id"]), before)
        self._assert_files_match_hashes(before, original)
        self.assertTrue(self.service.verify_component_audit_chain(first["id"])["valid"])
        [new_part] = [row for row in self._components() if row["name"] == f"ACME{self.token}NEW"]
        self._assert_immutable_copy(
            self._linked_assets(new_part["current_revision_id"])["3dmodel"], before["3dmodel"],
            model_file.read_bytes(), f"3dmodels/Pixxel_Sensors/{model_name}",
        )

    def test_kicad_library_assets_overwrite_keeps_existing_canonical_files(self) -> None:
        # --overwrite stores changed symbol, footprint and model bytes as new immutable
        # files; the files the earlier asset rows point at are left as they were.
        module = _load_script("import_kicad_library_assets")
        source = self.root / "kicad"
        (source / "symbols").mkdir(parents=True)
        (source / "footprints" / "TestFootprints.pretty").mkdir(parents=True)
        (source / "3D" / "TestModels").mkdir(parents=True)
        symbol, footprint = f"Sensor_{self.token}", f"SOIC8_{self.token}"
        symbol_file = source / "symbols" / "TestSymbols.kicad_sym"
        footprint_file = source / "footprints" / "TestFootprints.pretty" / f"{footprint}.kicad_mod"
        model_file = source / "3D" / "TestModels" / f"Model_{self.token}.step"
        symbol_file.write_text(SYMBOL_LIBRARY.format(name=symbol), encoding="utf-8")
        footprint_file.write_text(FOOTPRINT.format(name=footprint), encoding="utf-8")
        model_file.write_bytes(b"ISO-10303-21; original\n")
        argv = [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
                "--no-previews", "--skip-symbol-upgrade"]
        assets_sql = (
            "SELECT id, asset_type, canonical_path, sha256 FROM assets "
            "WHERE target_name IN (%s, %s, %s) ORDER BY created_at, id"
        )
        names = (symbol, footprint, model_file.name)
        code, report = _run(module, argv)
        self.assertEqual(code, 0, report["errors"])
        before = {row["asset_type"]: row for row in self._rows(assets_sql, *names)}
        self.assertEqual(sorted(before), ["3dmodel", "footprint", "symbol"])
        original = {asset_type: Path(row["canonical_path"]).read_bytes() for asset_type, row in before.items()}
        symbol_file.write_text(SYMBOL_LIBRARY.format(name=symbol).replace("(end 1 -1)", "(end 2 -2)"), encoding="utf-8")
        footprint_file.write_text(FOOTPRINT.format(name=footprint).replace("test body", "changed body"), encoding="utf-8")
        model_file.write_bytes(b"ISO-10303-21; changed\n")

        code, report = _run(module, [*argv, "--overwrite"])

        self.assertEqual((code, report["errors"]), (0, []))
        self._assert_files_match_hashes(before, original)
        after = [row for row in self._rows(assets_sql, *names) if row["id"] not in {r["id"] for r in before.values()}]
        added = {row["asset_type"]: row for row in after}
        self.assertEqual(sorted(added), ["3dmodel", "footprint", "symbol"])
        self._assert_immutable_copy(
            added["footprint"], before["footprint"], footprint_file.read_bytes(),
            f"footprints/TestFootprints.pretty/{footprint}.kicad_mod",
        )
        self._assert_immutable_copy(
            added["3dmodel"], before["3dmodel"], model_file.read_bytes(), f"3dmodels/TestModels/{model_file.name}",
        )
        self.assertNotEqual(added["symbol"]["sha256"], before["symbol"]["sha256"])
        self.assertEqual(
            Path(added["symbol"]["canonical_path"]).resolve(),
            (self.store / "revisions" / added["symbol"]["sha256"] / f"symbols/TestSymbols/{symbol}.kicad_sym").resolve(),
        )

    def test_kicad_library_assets_dry_run_writes_no_files_or_rows(self) -> None:
        # --dry-run reports what an import would do; it creates no store directory,
        # asset file or asset row, for a fresh store and for changed content in an
        # existing one.
        module = _load_script("import_kicad_library_assets")
        source = self.root / "kicad"
        (source / "symbols").mkdir(parents=True)
        (source / "footprints" / "TestFootprints.pretty").mkdir(parents=True)
        (source / "3D" / "TestModels").mkdir(parents=True)
        (source / "spice").mkdir(parents=True)
        symbol, footprint = f"Sensor_{self.token}", f"SOIC8_{self.token}"
        symbol_file = source / "symbols" / "TestSymbols.kicad_sym"
        footprint_file = source / "footprints" / "TestFootprints.pretty" / f"{footprint}.kicad_mod"
        model_file = source / "3D" / "TestModels" / f"Model_{self.token}.step"
        spice_file = source / "spice" / f"Model_{self.token}.lib"
        symbol_file.write_text(SYMBOL_LIBRARY.format(name=symbol), encoding="utf-8")
        footprint_file.write_text(FOOTPRINT.format(name=footprint), encoding="utf-8")
        model_file.write_bytes(b"ISO-10303-21; original\n")
        spice_file.write_text(".model D1 D\n", encoding="utf-8")
        names = (symbol, footprint, model_file.name, spice_file.name)
        assets_sql = "SELECT id FROM assets WHERE target_name IN (%s, %s, %s, %s) ORDER BY id"
        options = ["--database-url", POSTGRES_URL, "--no-previews", "--skip-symbol-upgrade"]

        fresh_store = self.root / "dry-run-store"
        code, report = _run(module, [str(source), "--store-root", str(fresh_store), *options, "--dry-run"])

        self.assertEqual((code, report["errors"]), (0, []))
        self.assertEqual(
            {key: report[key] for key in ("symbols_written", "footprints_written", "models_written", "spice_written")},
            {"symbols_written": 1, "footprints_written": 1, "models_written": 1, "spice_written": 1},
        )
        self.assertEqual((report["assets_indexed"], report["indexed_db"]), (0, False))
        self.assertFalse(fresh_store.exists())
        self.assertEqual(self._rows(assets_sql, *names), [])

        code, report = _run(module, [str(source), "--store-root", str(self.store), *options])
        self.assertEqual((code, report["errors"]), (0, []))
        rows_before = self._rows(assets_sql, *names)
        files_before = {path: path.read_bytes() for path in self.store.rglob("*") if path.is_file()}
        dirs_before = {path for path in self.store.rglob("*") if path.is_dir()}
        symbol_file.write_text(SYMBOL_LIBRARY.format(name=symbol).replace("(end 1 -1)", "(end 2 -2)"), encoding="utf-8")
        footprint_file.write_text(FOOTPRINT.format(name=footprint).replace("test body", "changed body"), encoding="utf-8")
        model_file.write_bytes(b"ISO-10303-21; changed\n")

        code, report = _run(module, [str(source), "--store-root", str(self.store), *options, "--dry-run", "--overwrite"])

        self.assertEqual((code, report["errors"]), (0, []))
        self.assertEqual({path: path.read_bytes() for path in self.store.rglob("*") if path.is_file()}, files_before)
        self.assertEqual({path for path in self.store.rglob("*") if path.is_dir()}, dirs_before)
        self.assertEqual(self._rows(assets_sql, *names), rows_before)

    def test_database_library_import_takes_its_slug_through_the_component_writer(self) -> None:
        # AC-28 writer row: slugs are allocated under the writer's lock against the catalog,
        # not only against the import's own batch.
        module = _load_script("import_database_library")
        source = self._database_library()
        holder = self.service.create_manual_component(
            actor="designer@example.com", value="Sensor", description="Slug holder",
            datasheet="https://example.test/holder.pdf", manufacturer="Other",
            manufacturer_part_number=f"ACME {self.token}",
        )
        self.assertEqual(holder["slug"], f"acme-{self.token}")

        code, report = _run(module, [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual(report["components_created"], 2)
        imported = [row for row in self._components() if row["source"] == "import"]
        self.assertIn(f"acme-{self.token}-2", [row["slug"] for row in imported])

    def test_database_library_release_goes_through_the_release_workflow_gates(self) -> None:
        # AC-28 writer row: a trusted import is released by the release workflow, so its
        # KLC release gate applies (unvalidated assets block under "block").
        module = _load_script("import_database_library")
        source = self._database_library()
        from app.services.catalog import klc_validation

        with patch.object(klc_validation.settings, "CATALOG_KLC_RELEASE_GATE", "block"):
            code, report = _run(module, [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["components_released"]), (2, 0))
        self.assertEqual(len(report["release_refused"]), 1)
        self.assertIn("KLC validation", report["release_refused"][0]["reason"])
        self.assertEqual({row["release_status"] for row in self._components()}, {"open"})

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

    def test_footprint_import_links_its_model_under_a_remapped_runtime_root(self) -> None:
        """The row records the service's path; the byte check before linking reads the local file."""
        module = _load_script("import_footprint_library")
        source = self.root / "fpl"
        library = source / "Footprints" / "Pixxel_Sensors.pretty"
        library.mkdir(parents=True)
        (source / "3D").mkdir()
        name = f"ACME{self.token}"
        (source / "3D" / f"{name}.step").write_bytes(f"ISO-10303-21;/* {self.token} */END-ISO-10303-21;".encode())
        footprint = FOOTPRINT.format(name=name).replace(
            '(pad "1"', f'(model "C:/Authoring/3D/{name}.step") (pad "1"'
        )
        (library / f"{name}.kicad_mod").write_text(footprint, encoding="utf-8")
        runtime_root = "/app/projects/.kicad-prism/components"

        code, report = _run(module, [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
            "--mpn-mode", "full", "--manufacturer", "Acme", "--no-previews",
            "--runtime-store-root", runtime_root,
        ])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["errors"]), (1, []))
        [component] = self._components()
        [model] = self._rows(
            "SELECT a.canonical_path FROM revision_assets ra JOIN assets a ON a.id = ra.asset_id "
            "WHERE ra.revision_id = %s AND ra.asset_type = '3dmodel'",
            component["current_revision_id"],
        )
        self.assertTrue(str(model["canonical_path"]).startswith(f"{runtime_root}/3dmodels/"), model)

    def test_footprint_missing_a_required_field_is_skipped_and_listed(self) -> None:
        # AC-28 footprints row: no placeholders; the footprint is skipped and named in the summary.
        module = _load_script("import_footprint_library")
        source = self.root / "fpl"
        library = source / "Footprints" / "Pixxel_Sensors.pretty"
        library.mkdir(parents=True)
        name = f"ACME{self.token}"
        body = FOOTPRINT.format(name=name).replace(
            '  (property "Datasheet" "https://example.test/acme.pdf" (at 0 0 0) (layer "F.Fab"))\n', ""
        )
        (library / f"{name}.kicad_mod").write_text(body, encoding="utf-8")

        code, report = _run(module, [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
            "--mpn-mode", "full", "--manufacturer", "Acme", "--no-previews", "--models-dir", "",
        ])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual(report["components_created"], 0)
        self.assertEqual(
            report["skipped_missing_fields"],
            [{"footprint": f"Pixxel_Sensors.pretty/{name}.kicad_mod", "missing": ["Datasheet"]}],
        )
        self.assertEqual(self._components(), [])

    def _required_custom_field(self) -> dict:
        field = self.service.create_metadata_field(
            {"key": f"approval_ref_{self.token}", "label": "Approval Ref", "type": "text", "required": True},
            actor="admin@example.com",
        )
        # Archiving in tearDown would do, but a required field must never outlive its test.
        self.addCleanup(self._drop_field, str(field["id"]))
        return field

    def _drop_field(self, field_id: str) -> None:
        with self.service.connection() as conn:
            conn.execute("DELETE FROM catalog_field_definition_events WHERE field_id = %s", (field_id,))
            conn.execute("DELETE FROM catalog_field_definitions WHERE id = %s", (field_id,))
            conn.commit()

    def test_database_library_rows_missing_a_custom_required_field_are_skipped_and_listed(self) -> None:
        # D44: the bulk scripts enforce custom required fields as acceptance does.
        module = _load_script("import_database_library")
        source = self._database_library()
        self._required_custom_field()

        code, report = _run(module, [str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["errors"]), (0, []))
        self.assertEqual(
            sorted(entry["missing"] for entry in report["skipped_missing_fields"]),
            [["Approval Ref"], ["Approval Ref"]],
        )
        self.assertEqual(self._components(), [])
        strict_code, strict = _run(module, [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL, "--strict",
        ])
        self.assertEqual((strict_code, strict["components_created"]), (1, 0))

    def test_footprint_missing_a_custom_required_field_is_skipped_and_listed(self) -> None:
        # D44: a custom required field the footprint cannot supply skips it, like a built-in one.
        module = _load_script("import_footprint_library")
        source = self.root / "fpl"
        library = source / "Footprints" / "Pixxel_Sensors.pretty"
        library.mkdir(parents=True)
        name = f"ACME{self.token}"
        (library / f"{name}.kicad_mod").write_text(FOOTPRINT.format(name=name), encoding="utf-8")
        self._required_custom_field()

        code, report = _run(module, [
            str(source), "--store-root", str(self.store), "--database-url", POSTGRES_URL,
            "--mpn-mode", "full", "--manufacturer", "Acme", "--no-previews", "--models-dir", "",
        ])

        self.assertEqual(code, 0, report["errors"])
        self.assertEqual((report["components_created"], report["errors"]), (0, []))
        self.assertEqual(
            report["skipped_missing_fields"],
            [{"footprint": f"Pixxel_Sensors.pretty/{name}.kicad_mod", "missing": ["Approval Ref"]}],
        )
        self.assertEqual(self._components(), [])


if __name__ == "__main__":
    unittest.main()
