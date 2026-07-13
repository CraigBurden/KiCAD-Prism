from __future__ import annotations

import hashlib
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from scripts.migrate_catalog_sqlite_to_postgres import (
    MIGRATION_MARKER_KEY,
    MIGRATION_SCHEMA,
    MIGRATION_TABLES,
    REQUIRED_SOURCE_TABLES,
    ColumnSpec,
    MigrationError,
    TargetNotEmptyError,
    VerificationError,
    build_legacy_release_records,
    build_table_plan,
    catalog_audit_event_hash,
    canonical_value,
    copy_table_rows,
    decide_missing_source_mode,
    decide_target_mode,
    deterministic_rows_hash,
    marker_matches,
    inventory_preview_tree,
    is_verified_migration_marker,
    legacy_catalog_evidence,
    live_sqlite_source_fingerprint,
    redact_database_url,
    revision_manifest_hash,
    snapshot_sqlite_database,
    sqlite_source_file_state,
    source_fingerprint,
    sqlite_columns,
    validate_source_tables,
    verify_asset_files,
    verify_catalog_audit_chains,
    verify_component_revision_pointers,
    verify_revision_manifests,
    verify_preview_version_files,
    verify_row_sets,
    verify_sqlite_database_integrity,
    target_row_verification_strategy,
)


class CatalogSqlitePostgresMigrationTests(unittest.TestCase):
    def test_sqlite_source_integrity_runs_native_and_foreign_key_checks(self) -> None:
        with sqlite3.connect(":memory:") as conn:
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute("CREATE TABLE parent (id TEXT PRIMARY KEY)")
            conn.execute(
                "CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id))"
            )
            conn.execute("INSERT INTO parent VALUES ('parent:1')")
            conn.execute("INSERT INTO child VALUES ('child:1', 'parent:1')")
            valid = verify_sqlite_database_integrity(conn)
            conn.execute("INSERT INTO child VALUES ('child:orphan', 'parent:missing')")
            invalid = verify_sqlite_database_integrity(conn)

        self.assertTrue(valid["passed"])
        self.assertEqual(valid["integrity_check"]["failure_count"], 0)
        self.assertEqual(valid["foreign_key_check"]["violation_count"], 0)
        self.assertFalse(invalid["passed"])
        self.assertEqual(invalid["foreign_key_check"]["violation_count"], 1)
        self.assertEqual(invalid["foreign_key_check"]["violations"][0]["table"], "child")

    def test_component_revision_pointers_must_exist_and_be_owned(self) -> None:
        revisions = [
            {"id": "rev:1", "component_id": "cmp:1"},
            {"id": "rev:2", "component_id": "cmp:2"},
        ]
        valid = verify_component_revision_pointers(
            [
                {
                    "id": "cmp:1",
                    "current_revision_id": "rev:1",
                    "released_revision_id": "rev:1",
                },
                {
                    "id": "cmp:2",
                    "current_revision_id": "rev:2",
                    "released_revision_id": "",
                },
            ],
            revisions,
        )
        invalid = verify_component_revision_pointers(
            [
                {
                    "id": "cmp:1",
                    "current_revision_id": "rev:2",
                    "released_revision_id": "rev:missing",
                },
                {
                    "id": "cmp:2",
                    "current_revision_id": "",
                    "released_revision_id": "",
                },
            ],
            revisions,
        )

        self.assertTrue(valid["passed"])
        self.assertEqual(valid["pointer_count"], 3)
        self.assertFalse(invalid["passed"])
        self.assertEqual(invalid["failure_count"], 3)
        self.assertEqual(
            {failure["reason"] for failure in invalid["failures"]},
            {
                "revision_owned_by_another_component",
                "missing_revision",
                "missing_pointer",
            },
        )

    def test_revision_manifest_verifier_matches_live_canonicalization_and_asset_order(self) -> None:
        revision = {
            "id": "rev:1",
            "component_id": "cmp:1",
            "version": 4,
            "parent_revision_id": "rev:0",
            "change_kind": "edit",
            "change_summary": "excluded",
            "created_by": "author",
            "release_status": "qa_review",
            "manifest_hash": "",
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-02T00:00:00+00:00",
            "name": "Precision µAmp",
            "value": "OPA189",
            "extra_fields_json": '{"Tolerance":"0.01%"}',
        }
        assets = [
            {
                "id": "asset:footprint",
                "asset_type": "footprint",
                "target_library": "Package_SO",
                "target_name": "SOIC-8",
                "sha256": "b" * 64,
            },
            {
                "id": "asset:symbol",
                "asset_type": "symbol",
                "target_library": "Prism",
                "target_name": "OPA189",
                "sha256": "a" * 64,
            },
        ]
        joined_assets = [
            {**assets[0], "required": 1},
            {**assets[1], "required": 1},
        ]
        expected_payload = {
            "metadata": {
                "extra_fields_json": '{"Tolerance":"0.01%"}',
                "name": "Precision µAmp",
                "value": "OPA189",
            },
            "assets": [
                {
                    "asset_type": "symbol",
                    "sha256": "a" * 64,
                    "target_library": "Prism",
                    "target_name": "OPA189",
                    "required": True,
                },
                {
                    "asset_type": "footprint",
                    "sha256": "b" * 64,
                    "target_library": "Package_SO",
                    "target_name": "SOIC-8",
                    "required": True,
                },
            ],
        }
        expected_hash = hashlib.sha256(
            json.dumps(
                expected_payload,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        self.assertEqual(revision_manifest_hash(revision, joined_assets), expected_hash)

        revision["manifest_hash"] = expected_hash
        links = [
            {
                "revision_id": "rev:1",
                "asset_id": "asset:footprint",
                "asset_type": "footprint",
                "required": 1,
            },
            {
                "revision_id": "rev:1",
                "asset_id": "asset:symbol",
                "asset_type": "symbol",
                "required": 1,
            },
        ]
        valid = verify_revision_manifests([revision], links, list(reversed(assets)))
        tampered_revision = {**revision, "value": "OPA188"}
        invalid = verify_revision_manifests([tampered_revision], links, assets)

        self.assertTrue(valid["passed"])
        self.assertEqual(valid["verified_revision_count"], 1)
        self.assertFalse(invalid["passed"])
        self.assertEqual(invalid["failures"][0]["reason"], "revision_manifest_mismatch")

    def test_a1_manifest_hashes_preview_bytes_and_generator_identity(self) -> None:
        revision = {
            "id": "rev:a1",
            "component_id": "cmp:1",
            "manifest_schema": "prism.revision_manifest_a1",
            "manifest_hash": "",
            "release_status": "open",
            "version": 2,
            "name": "R",
        }
        preview = {
            "id": "preview:1",
            "asset_id": "asset:1",
            "kind": "symbol",
            "status": "ready",
            "sha256": "a" * 64,
            "generator_fingerprint": "generator-v1",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        first = revision_manifest_hash(revision, [], [preview])
        changed_bytes = revision_manifest_hash(revision, [], [{**preview, "sha256": "b" * 64}])
        changed_generator = revision_manifest_hash(
            revision, [], [{**preview, "generator_fingerprint": "generator-v2"}]
        )
        moved_file = revision_manifest_hash(
            revision, [], [{**preview, "file_path": "/different/storage/path.svg"}]
        )
        self.assertNotEqual(first, changed_bytes)
        self.assertNotEqual(first, changed_generator)
        self.assertEqual(first, moved_file)

    def test_catalog_audit_verifier_checks_hash_links_sequences_heads_and_coverage(self) -> None:
        component = {"id": "cmp:1"}
        migrated = {
            "id": "event:1",
            "component_id": "cmp:1",
            "sequence": 1,
            "revision_id": "rev:1",
            "event_type": "audit.migrated",
            "actor": "migration",
            "details_json": '{"reason":"legacy"}',
            "previous_hash": "",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        migrated["event_hash"] = catalog_audit_event_hash(migrated)
        edited = {
            "id": "event:2",
            "component_id": "cmp:1",
            "sequence": 2,
            "revision_id": "rev:2",
            "event_type": "revision.created",
            "actor": "engineer@example.com",
            "details_json": '{"manifest_hash":"abc"}',
            "previous_hash": migrated["event_hash"],
            "created_at": "2026-01-02T00:00:00+00:00",
        }
        edited["event_hash"] = catalog_audit_event_hash(edited)
        meta = [{"key": "audit_head:cmp:1", "value": edited["event_hash"]}]

        valid = verify_catalog_audit_chains([component], [edited, migrated], meta)
        bad_sequence = verify_catalog_audit_chains(
            [component],
            [migrated, {**edited, "sequence": 3}],
            meta,
        )
        bad_link = verify_catalog_audit_chains(
            [component],
            [migrated, {**edited, "previous_hash": "0" * 64}],
            meta,
        )
        bad_head = verify_catalog_audit_chains(
            [component],
            [migrated, edited],
            [{"key": "audit_head:cmp:1", "value": "f" * 64}],
        )
        bad_details = verify_catalog_audit_chains(
            [component],
            [migrated, {**edited, "details_json": "not-json"}],
            meta,
        )

        self.assertTrue(valid["passed"])
        self.assertEqual(valid["verified_event_count"], 2)
        self.assertEqual(valid["coverage"], {"complete": 0, "legacy_snapshot": 1, "missing": 0})
        self.assertEqual(valid["legacy_snapshot_component_ids"], ["cmp:1"])
        self.assertFalse(bad_sequence["passed"])
        self.assertIn("audit_sequence_gap", {failure["reason"] for failure in bad_sequence["failures"]})
        self.assertFalse(bad_link["passed"])
        self.assertIn("audit_link_mismatch", {failure["reason"] for failure in bad_link["failures"]})
        self.assertFalse(bad_head["passed"])
        self.assertIn("audit_head_mismatch", {failure["reason"] for failure in bad_head["failures"]})
        self.assertFalse(bad_details["passed"])
        self.assertIn(
            "invalid_audit_details_json",
            {failure["reason"] for failure in bad_details["failures"]},
        )

    def test_legacy_release_records_are_deterministic_and_only_fill_gaps(self) -> None:
        components = [
            {"id": "cmp:1", "released_revision_id": "rev:1"},
            {"id": "cmp:2", "released_revision_id": "rev:2"},
            {"id": "cmp:draft", "released_revision_id": ""},
        ]
        revisions = [
            {
                "id": "rev:1",
                "component_id": "cmp:1",
                "version": 7,
                "manifest_hash": "a" * 64,
                "created_at": "2025-01-01T00:00:00+00:00",
                "updated_at": "2025-02-01T00:00:00+00:00",
            },
            {
                "id": "rev:2",
                "component_id": "cmp:2",
                "version": 3,
                "manifest_hash": "b" * 64,
                "created_at": "2025-03-01T00:00:00+00:00",
                "updated_at": "2025-04-01T00:00:00+00:00",
            },
        ]
        existing = [{"component_id": "cmp:2", "revision_id": "rev:2"}]

        first, stats = build_legacy_release_records(components, revisions, existing)
        second, _ = build_legacy_release_records(components, revisions, existing)

        self.assertEqual(first, second)
        self.assertEqual(len(first), 1)
        self.assertEqual(stats["released_component_count"], 2)
        self.assertEqual(stats["existing_source_record_count"], 1)
        self.assertEqual(stats["eligible_legacy_record_count"], 1)
        self.assertEqual(first[0]["component_id"], "cmp:1")
        self.assertEqual(first[0]["revision_id"], "rev:1")
        self.assertEqual(first[0]["release_label"], "r7")
        self.assertEqual(first[0]["manifest_hash"], "a" * 64)
        self.assertEqual(first[0]["released_by"], "legacy-migration")
        self.assertEqual(first[0]["policy_json"], '{"coverage":"legacy_snapshot"}')
        self.assertEqual(first[0]["created_at"], "2025-02-01T00:00:00+00:00")

    def test_legacy_release_synthesis_refuses_missing_manifest(self) -> None:
        with self.assertRaises(VerificationError):
            build_legacy_release_records(
                [{"id": "cmp:1", "released_revision_id": "rev:1"}],
                [
                    {
                        "id": "rev:1",
                        "component_id": "cmp:1",
                        "version": 1,
                        "manifest_hash": "",
                        "created_at": "2025-01-01T00:00:00+00:00",
                    }
                ],
                [],
            )

    def test_preview_inventory_keeps_unindexed_files_and_checks_ready_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "previews"
            indexed = root / "symbols" / "indexed.svg"
            unindexed = root / "legacy" / "unindexed.svg"
            indexed.parent.mkdir(parents=True)
            unindexed.parent.mkdir(parents=True)
            indexed.write_text("indexed", encoding="utf-8")
            unindexed.write_text("unindexed", encoding="utf-8")
            report = inventory_preview_tree(
                root,
                [
                    {
                        "id": "preview:1",
                        "status": "ready",
                        "file_path": str(indexed),
                    }
                ],
            )
            self.assertTrue(report["passed"])
            self.assertEqual(report["file_count"], 2)
            self.assertEqual(report["indexed_file_count"], 1)
            self.assertEqual(report["unindexed_file_count"], 1)
            self.assertEqual(unindexed.read_text(encoding="utf-8"), "unindexed")

            missing_report = inventory_preview_tree(
                root,
                [
                    {
                        "id": "preview:missing",
                        "status": "ready",
                        "file_path": str(root / "missing.svg"),
                    }
                ],
            )
            self.assertFalse(missing_report["passed"])
            self.assertEqual(len(missing_report["missing_ready_previews"]), 1)

    def test_source_must_be_a_real_catalog(self) -> None:
        validate_source_tables(set(REQUIRED_SOURCE_TABLES))
        with self.assertRaises(MigrationError):
            validate_source_tables({"components", "assets"})

    def test_copy_uses_id_preserving_conflict_safe_insert(self) -> None:
        class Cursor:
            def __init__(self) -> None:
                self.calls: list[tuple[str, list[tuple[object, ...]]]] = []

            def executemany(self, sql: str, values: list[tuple[object, ...]]) -> None:
                self.calls.append((sql, values))

        class Connection:
            def __init__(self) -> None:
                self.created_cursor = Cursor()

            def cursor(self) -> Cursor:
                return self.created_cursor

        connection = Connection()
        plan = build_table_plan(
            "components",
            [ColumnSpec("id", "text", 0, 1), ColumnSpec("slug", "text", 1)],
            [ColumnSpec("id", "text", 1, 1), ColumnSpec("slug", "text", 2)],
        )

        count = copy_table_rows(
            connection,
            "public",
            plan,
            [{"id": "cmp:original-id", "slug": "op-amp"}],
        )

        self.assertEqual(count, 1)
        sql, values = connection.created_cursor.calls[0]
        self.assertIn("ON CONFLICT DO NOTHING", sql)
        self.assertEqual(values, [("cmp:original-id", "op-amp")])

    def test_table_order_is_foreign_key_safe_and_complete(self) -> None:
        position = {table: index for index, table in enumerate(MIGRATION_TABLES)}
        expected = {
            "components",
            "component_revisions",
            "project_component_import_sessions",
            "project_component_import_proposals",
            "assets",
            "revision_assets",
            "asset_previews",
            "asset_preview_versions",
            "revision_previews",
            "revision_preview_outputs",
            "asset_validation_runs",
            "asset_validation_findings",
            "component_usage",
            "component_review_decisions",
            "component_release_records",
            "catalog_audit_events",
            "oauth_auth_codes",
            "oauth_revoked_tokens",
            "oauth_service_clients",
            "catalog_meta",
        }
        self.assertEqual(set(MIGRATION_TABLES), expected)
        self.assertLess(position["components"], position["component_revisions"])
        self.assertLess(position["component_revisions"], position["revision_assets"])
        self.assertLess(position["assets"], position["revision_assets"])
        self.assertLess(position["asset_validation_runs"], position["asset_validation_findings"])
        self.assertLess(position["asset_preview_versions"], position["revision_previews"])
        self.assertLess(position["asset_preview_versions"], position["revision_preview_outputs"])
        self.assertLess(position["project_component_import_sessions"], position["project_component_import_proposals"])

    def test_snapshot_uses_backup_without_modifying_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "source.sqlite3"
            snapshot_path = Path(temp_dir) / "snapshot.sqlite3"
            with sqlite3.connect(source_path) as conn:
                conn.execute("PRAGMA journal_mode = WAL")
                conn.execute("CREATE TABLE components (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
                conn.execute("INSERT INTO components VALUES ('cmp:1', 'Op amp')")
                conn.commit()
            before = source_path.stat().st_mtime_ns

            report = snapshot_sqlite_database(source_path, snapshot_path)

            self.assertEqual(report["method"], "sqlite_backup_api")
            self.assertEqual(report["snapshot_sha256"], hashlib.sha256(snapshot_path.read_bytes()).hexdigest())
            self.assertEqual(source_path.stat().st_mtime_ns, before)
            with sqlite3.connect(snapshot_path) as conn:
                self.assertEqual(conn.execute("SELECT * FROM components").fetchone(), ("cmp:1", "Op amp"))

    def test_snapshot_refuses_to_create_a_missing_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(MigrationError):
                snapshot_sqlite_database(
                    Path(temp_dir) / "missing.sqlite3",
                    Path(temp_dir) / "snapshot.sqlite3",
                )

    def test_build_plan_uses_column_intersection_and_exact_primary_key(self) -> None:
        source = [
            ColumnSpec("revision_id", "text", 0, 1),
            ColumnSpec("asset_id", "text", 1, 2),
            ColumnSpec("legacy_only", "text", 2, 0),
        ]
        target = [
            ColumnSpec("revision_id", "text", 1, 1),
            ColumnSpec("asset_id", "text", 2, 2),
            ColumnSpec("target_default", "text", 3, 0),
        ]

        plan = build_table_plan("revision_assets", source, target)

        self.assertEqual(plan.columns, ("revision_id", "asset_id"))
        self.assertEqual(plan.primary_key, ("revision_id", "asset_id"))
        self.assertEqual(plan.source_only_columns, ("legacy_only",))
        self.assertEqual(plan.target_only_columns, ("target_default",))

    def test_build_plan_refuses_primary_key_drift(self) -> None:
        source = [ColumnSpec("id", "text", 0, 1)]
        target = [ColumnSpec("id", "text", 1, 0)]
        with self.assertRaises(MigrationError):
            build_table_plan("components", source, target)

    def test_sqlite_column_discovery_preserves_composite_key_order(self) -> None:
        with sqlite3.connect(":memory:") as conn:
            conn.execute(
                "CREATE TABLE revision_assets (revision_id TEXT, asset_id TEXT, required INTEGER, "
                "PRIMARY KEY(revision_id, asset_id))"
            )
            columns = sqlite_columns(conn, "revision_assets")
        self.assertEqual(
            [(column.name, column.primary_key_position) for column in columns],
            [("revision_id", 1), ("asset_id", 2), ("required", 0)],
        )

    def test_hash_is_order_independent_and_normalizes_adapter_types(self) -> None:
        source = [
            {"id": "2", "payload": '{"b":2,"a":1}', "enabled": 0, "quantity": 1.25},
            {"id": "1", "payload": "[1,2]", "enabled": 1, "quantity": 2},
        ]
        target = [
            {"id": "1", "payload": [1, 2], "enabled": True, "quantity": Decimal("2")},
            {"id": "2", "payload": {"a": 1, "b": 2}, "enabled": False, "quantity": Decimal("1.25")},
        ]
        types = {"payload": "jsonb", "enabled": "boolean", "quantity": "numeric"}
        columns = ("id", "payload", "enabled", "quantity")
        self.assertEqual(
            deterministic_rows_hash(source, columns, ("id",), types),
            deterministic_rows_hash(target, columns, ("id",), types),
        )
        self.assertEqual(
            canonical_value("2026-07-13T01:02:03Z", "timestamp with time zone"),
            datetime(2026, 7, 13, 1, 2, 3, tzinfo=timezone.utc).isoformat(),
        )

    def test_row_verification_checks_all_source_keys_and_hashes(self) -> None:
        source = [{"id": "a", "value": "one"}, {"id": "b", "value": "two"}]
        target = [
            {"id": "extra", "value": "allowed only after explicit merge"},
            {"id": "b", "value": "two"},
            {"id": "a", "value": "one"},
        ]

        report = verify_row_sets(
            table="components",
            source_rows=source,
            target_rows=target,
            columns=("id", "value"),
            primary_key=("id",),
        )

        self.assertTrue(report["passed"])
        self.assertEqual(report["source_row_count"], 2)
        self.assertEqual(report["target_total_row_count"], 3)
        self.assertEqual(report["target_matched_row_count"], 2)
        self.assertEqual(report["source_rows_hash"], report["target_rows_hash"])
        self.assertEqual(report["source_key_hash"], report["target_key_hash"])

    def test_row_verification_reports_missing_and_changed_rows(self) -> None:
        source = [{"id": "a", "value": "one"}, {"id": "b", "value": "two"}]
        target = [{"id": "a", "value": "changed"}]
        report = verify_row_sets(
            table="components",
            source_rows=source,
            target_rows=target,
            columns=("id", "value"),
            primary_key=("id",),
        )
        self.assertFalse(report["passed"])
        self.assertEqual(report["target_matched_row_count"], 1)
        self.assertEqual(len(report["missing_keys"]), 1)
        self.assertEqual(len(report["mismatched_keys"]), 1)

    def test_asset_verification_checks_existence_hash_and_size(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            valid = Path(temp_dir) / "valid.kicad_sym"
            valid.write_bytes(b"symbol bytes")
            wrong = Path(temp_dir) / "wrong.step"
            wrong.write_bytes(b"changed bytes")
            rows = [
                {
                    "id": "asset:valid",
                    "canonical_path": str(valid),
                    "sha256": hashlib.sha256(valid.read_bytes()).hexdigest(),
                    "size_bytes": valid.stat().st_size,
                },
                {
                    "id": "asset:wrong",
                    "canonical_path": str(wrong),
                    "sha256": "0" * 64,
                    "size_bytes": wrong.stat().st_size,
                },
                {
                    "id": "asset:missing",
                    "canonical_path": str(Path(temp_dir) / "missing.kicad_mod"),
                    "sha256": "1" * 64,
                    "size_bytes": 10,
                },
            ]

            report = verify_asset_files(rows)

        self.assertFalse(report["passed"])
        self.assertEqual(report["asset_count"], 3)
        self.assertEqual(report["failure_count"], 2)
        self.assertEqual(
            {failure["reason"] for failure in report["failures"]},
            {"sha256_mismatch", "missing"},
        )

    def test_preview_version_verification_checks_immutable_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = Path(temp_dir) / "preview.svg"
            preview.write_bytes(b"<svg/>")
            row = {
                "id": "preview:1",
                "status": "ready",
                "file_path": str(preview),
                "sha256": hashlib.sha256(preview.read_bytes()).hexdigest(),
                "size_bytes": preview.stat().st_size,
            }
            self.assertTrue(verify_preview_version_files([row])["passed"])
            preview.write_bytes(b"changed")
            self.assertFalse(verify_preview_version_files([row])["passed"])

    def test_source_fingerprint_changes_with_any_common_row(self) -> None:
        plan = build_table_plan(
            "components",
            [ColumnSpec("id", "text", 0, 1), ColumnSpec("name", "text", 1)],
            [ColumnSpec("id", "text", 1, 1), ColumnSpec("name", "text", 2)],
        )
        first, first_tables = source_fingerprint(
            {"components": [{"id": "cmp:1", "name": "first"}]},
            [plan],
        )
        second, _ = source_fingerprint(
            {"components": [{"id": "cmp:1", "name": "second"}]},
            [plan],
        )
        self.assertNotEqual(first, second)
        self.assertEqual(first_tables[0]["row_count"], 1)

    def test_nonempty_target_requires_marker_or_explicit_override(self) -> None:
        with self.assertRaises(TargetNotEmptyError):
            decide_target_mode(
                target_row_count=1,
                marker_value=None,
                fingerprint="abc",
                allow_nonempty=False,
                if_needed=False,
            )
        self.assertEqual(
            decide_target_mode(
                target_row_count=1,
                marker_value=None,
                fingerprint="abc",
                allow_nonempty=True,
                if_needed=False,
            ),
            "migrate",
        )

    def test_matching_verified_marker_supports_if_needed(self) -> None:
        marker = (
            '{"schema":"'
            + MIGRATION_SCHEMA
            + '","source_fingerprint":"abc","verified":true}'
        )
        self.assertTrue(marker_matches(marker, "abc"))
        self.assertEqual(
            decide_target_mode(
                target_row_count=99,
                marker_value=marker,
                fingerprint="abc",
                allow_nonempty=False,
                if_needed=True,
            ),
            "already_migrated",
        )
        self.assertFalse(marker_matches(marker, "different"))
        self.assertTrue(is_verified_migration_marker(marker))
        self.assertEqual(MIGRATION_MARKER_KEY, "migration:catalog:sqlite-to-postgres:a0")

    def test_matching_marker_accepts_legitimately_evolved_postgres_rows(self) -> None:
        source = [
            {
                "id": "cmp:1",
                "current_revision_id": "rev:sqlite",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
        ]
        evolved_target = [
            {
                "id": "cmp:1",
                "current_revision_id": "rev:postgres-next",
                "updated_at": "2026-07-13T00:00:00+00:00",
            }
        ]
        exact_verification = verify_row_sets(
            table="components",
            source_rows=source,
            target_rows=evolved_target,
            columns=("id", "current_revision_id", "updated_at"),
            primary_key=("id",),
        )

        self.assertFalse(exact_verification["passed"])
        self.assertEqual(
            target_row_verification_strategy("already_migrated"),
            "matching_verified_marker",
        )
        self.assertEqual(target_row_verification_strategy("migrate"), "exact_source_rows")

    def test_live_source_fence_detects_catalog_and_file_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "source.sqlite3"
            with sqlite3.connect(source_path) as conn:
                conn.execute("CREATE TABLE components (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
                conn.execute("INSERT INTO components VALUES ('cmp:1', 'Original')")
                conn.commit()
            plan = build_table_plan(
                "components",
                [ColumnSpec("id", "text", 0, 1), ColumnSpec("name", "text", 1)],
                [ColumnSpec("id", "text", 1, 1), ColumnSpec("name", "text", 2)],
            )
            before_fingerprint, _ = live_sqlite_source_fingerprint(source_path, [plan])
            before_state = sqlite_source_file_state(source_path)

            with sqlite3.connect(source_path) as conn:
                conn.execute("UPDATE components SET name = 'Changed' WHERE id = 'cmp:1'")
                conn.commit()

            after_fingerprint, _ = live_sqlite_source_fingerprint(source_path, [plan])
            after_state = sqlite_source_file_state(source_path)
            self.assertNotEqual(before_fingerprint, after_fingerprint)
            self.assertNotEqual(before_state, after_state)

    def test_missing_source_requires_explicit_safe_empty_initialization(self) -> None:
        marker = json.dumps(
            {
                "schema": MIGRATION_SCHEMA,
                "source_fingerprint": "frozen",
                "verified": True,
            }
        )
        self.assertEqual(
            decide_missing_source_mode(
                target_row_count=100,
                marker_value=marker,
                initialize_empty=False,
                legacy_evidence=[],
            ),
            "already_migrated_without_source",
        )
        with self.assertRaises(MigrationError):
            decide_missing_source_mode(
                target_row_count=0,
                marker_value=None,
                initialize_empty=False,
                legacy_evidence=[],
            )
        with self.assertRaises(MigrationError):
            decide_missing_source_mode(
                target_row_count=0,
                marker_value=None,
                initialize_empty=True,
                legacy_evidence=["legacy/components/symbol.kicad_sym"],
            )
        self.assertEqual(
            decide_missing_source_mode(
                target_row_count=0,
                marker_value=None,
                initialize_empty=True,
                legacy_evidence=[],
            ),
            "initialized_empty",
        )

    def test_legacy_catalog_evidence_finds_component_files_and_backups(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            sqlite_path = Path(temp_dir) / "prism.sqlite3"
            symbol = Path(temp_dir) / "components" / "symbols" / "legacy.kicad_sym"
            symbol.parent.mkdir(parents=True)
            symbol.write_text("legacy", encoding="utf-8")
            evidence = legacy_catalog_evidence(sqlite_path)
            self.assertIn(str(symbol.resolve()), evidence)

    def test_database_url_redaction_never_leaks_password_or_query(self) -> None:
        redacted = redact_database_url(
            "postgresql+psycopg://catalog:super-secret@db.internal:5432/prism?sslmode=require"
        )
        self.assertEqual(redacted, "postgresql://catalog@db.internal:5432/prism")
        self.assertNotIn("super-secret", redacted)
        self.assertNotIn("sslmode", redacted)


if __name__ == "__main__":
    unittest.main()
