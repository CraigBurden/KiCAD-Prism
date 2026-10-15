"""``scripts/check_catalog_asset_files.py`` grouping and sha256-verified restore (PostgreSQL)."""

from __future__ import annotations

import contextlib
import gzip
import hashlib
import importlib.util
import io
import json
import stat
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit, urlunsplit

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.catalog.asset_imports import CatalogAssetImports  # noqa: E402
from app.services.catalog.asset_registry import CatalogAssetRegistry  # noqa: E402
from app.services.catalog.preview_pipeline import CatalogPreviewPipeline  # noqa: E402
from app.services.catalog.step_quarantine import StepQuarantine  # noqa: E402
from app.services.catalog.preview_renderer import CatalogPreviewRenderer, PREVIEW_STATUS_READY  # noqa: E402
from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService  # noqa: E402
from app.services.local_artifact_store import LocalArtifactStore  # noqa: E402
from app.services.postgres_database import database  # noqa: E402
from support.postgres import CATALOG_URL, psycopg, requires_scratch_postgres  # noqa: E402

SVG = b'<svg xmlns="http://www.w3.org/2000/svg"/>'

spec = importlib.util.spec_from_file_location(
    "prism_check_catalog_asset_files_under_test", REPO_ROOT / "scripts" / "check_catalog_asset_files.py"
)
assert spec and spec.loader
check_script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_script)


@requires_scratch_postgres("catalog asset file check tests")
class CatalogAssetFileCheckTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.token = uuid.uuid4().hex[:8]
        for owner, target, replacement in (
            # Each run owns a temporary store; do not reuse rows whose files a past run removed.
            (CatalogAssetRegistry, "asset_by_signature", lambda *_args, **_kwargs: None),
            (CatalogAssetImports, "normalize_symbol_upload", lambda _kicad, _name, payload: payload),
            (CatalogPreviewRenderer, "generate_symbol_preview_units",
             lambda _asset, _run: (PREVIEW_STATUS_READY, [(1, SVG)])),
            (CatalogPreviewRenderer, "generate_footprint_preview", lambda _asset, _run: (PREVIEW_STATUS_READY, SVG)),
            (CatalogPreviewPipeline, "generator_identity",
             lambda kind: {"generator_name": "kicad-cli", "generator_version": "fixture", "kind": kind}),
        ):
            patcher = patch.object(owner, target, staticmethod(replacement))
            patcher.start()
            self.addCleanup(patcher.stop)
        for target, value in (
            ("app.core.config.settings.CATALOG_KLC_ENABLED", False),
            ("app.core.config.settings.CATALOG_KLC_RELEASE_GATE", "warn"),
        ):
            patcher = patch(target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.service = ComponentCatalogPostgresService(store_root=self.root / "components", database_url=CATALOG_URL)
        self.service.initialize()
        self.addCleanup(self.service.close)
        self.artifacts = LocalArtifactStore(self.root / "artifacts")
        self.artifacts.initialize()

    def _step(self, label: str) -> bytes:
        return f"ISO-10303-21;/* {label} {self.token} */END-ISO-10303-21;".encode()

    def _release(self, component_id: str) -> None:
        self.service.set_release_status(component_id, "in_progress", actor="designer@example.com")
        review = self.service.set_release_status(component_id, "qa_review", actor="designer@example.com")
        approved = self.service.set_release_status(
            component_id, "done", actor="qa@example.com", actor_role="qa",
            expected_revision_id=review["revision_id"], expected_manifest_hash=review["manifest_hash"],
        )
        self.service.set_release_status(
            component_id, "released", actor="designer@example.com", actor_role="designer",
            expected_revision_id=approved["revision_id"], expected_manifest_hash=approved["manifest_hash"],
        )

    def _attach_model(self, component_id: str, label: str) -> dict:
        component = self.service.attach_auxiliary_asset(
            component_id, asset_type="3dmodel", upload_name=f"{label}.step", payload=self._step(label),
            target_library=f"Check_{self.token}", actor="designer@example.com",
        )["component"]
        with self.service.connection() as conn:
            row = conn.execute(
                "SELECT a.id, a.canonical_path FROM revision_assets ra JOIN assets a ON a.id = ra.asset_id "
                "WHERE ra.revision_id = %s AND ra.asset_type = '3dmodel'",
                (component["revision_id"],),
            ).fetchone()
            conn.rollback()
        return {"id": str(row["id"]), "path": Path(str(row["canonical_path"]))}

    def _fixture(self) -> dict[str, dict]:
        """Model ``old`` is release history, ``live`` is placed, ``draft`` was never released."""

        component = self.service.create_manual_component(
            value="10k", description="asset file check", datasheet="https://example.com/r.pdf",
            manufacturer="Prism Check", manufacturer_part_number=f"CHK-{self.token}", actor="author@example.com",
        )
        self.addCleanup(
            self.service.deactivate_component, component["id"], actor="integration-test@local", reason="cleanup"
        )
        component_id = str(component["id"])
        self.component_id = component_id
        self.service.import_symbol_library(
            component_id, upload_name="R_Check.kicad_sym",
            payload=b'(kicad_symbol_lib (version 20231120) (generator "test") (symbol "R_Check"'
                    b' (property "Reference" "R" (at 0 0 0)) (property "Value" "10k" (at 0 0 0))))',
            target_library=f"Check_{self.token}", selected_symbol="R_Check", actor="designer@example.com",
        )
        self.service.import_footprint(
            component_id, upload_name="R_Check.kicad_mod",
            payload=b'(footprint "R_Check" (version 20240108) (generator "test"))',
            target_library=f"Check_{self.token}", selected_footprint="R_Check", actor="designer@example.com",
        )
        models = {"old": self._attach_model(component_id, "old")}
        self._release(component_id)
        self.service.detach_asset(component_id, "3dmodel", actor="designer@example.com")
        models["live"] = self._attach_model(component_id, "live")
        self._release(component_id)
        self.service.detach_asset(component_id, "3dmodel", actor="designer@example.com")
        models["draft"] = self._attach_model(component_id, "draft")
        return models

    def _run(self, *argv: str) -> tuple[int, dict]:
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = check_script.main(list(argv), service=self.service, artifact_store=self.artifacts)
        return code, json.loads(output.getvalue())

    @staticmethod
    def _groups(report: dict, ids: set[str]) -> dict[str, list[str]]:
        # Other suites share this catalog database; only this test's assets are compared.
        return {group: sorted(item["asset_id"] for item in report[group] if item["asset_id"] in ids)
                for group in check_script.GROUPS}

    def test_reports_missing_and_changed_files_by_impact(self) -> None:
        models = self._fixture()
        ids = {model["id"] for model in models.values()}
        code, report = self._run()
        self.assertEqual(self._groups(report, ids), {"placement_broken": [], "history_broken": [], "draft_only": []})

        for model in models.values():
            model["path"].unlink()
        code, report = self._run()
        self.assertEqual(code, 1)
        self.assertEqual(self._groups(report, ids), {
            "placement_broken": [models["live"]["id"]],
            "history_broken": [models["old"]["id"]],
            "draft_only": [models["draft"]["id"]],
        })

        models["live"]["path"].write_bytes(b"other bytes")
        _code, report = self._run()
        live = next(item for item in report["placement_broken"] if item["asset_id"] == models["live"]["id"])
        self.assertEqual(live["problem"], "sha256_mismatch")

    def _supersede_draft(self, models: dict[str, dict]) -> None:
        """Replace the never-released ``draft`` model, so the purge may take it."""
        self.service.detach_asset(self.component_id, "3dmodel", actor="designer@example.com")
        models["next"] = self._attach_model(self.component_id, "next")

    def test_a_quarantined_draft_is_reported_and_moved_back_by_restore(self) -> None:
        models = self._fixture()
        self._supersede_draft(models)
        draft = models["draft"]
        with self.service.connection() as conn:
            purged = StepQuarantine.purge_superseded_step_files(conn, self.service.runtime, job_id="check-test")
        self.assertIn(draft["id"], purged["asset_ids"])

        _code, report = self._run()
        [item] = [item for item in report["draft_only"] if item["asset_id"] == draft["id"]]
        self.assertEqual(item["ledger"], "quarantined")
        self.assertIn(draft["id"], [entry["asset_id"] for entry in report["quarantine"]])

        _code, report = self._run("--restore")
        self.assertIn(draft["id"], [item["asset_id"] for item in report["restore"]["unquarantined"]["restored"]])
        self.assertFalse(draft["path"].exists(), "a dry run moved a file")

        _code, report = self._run("--restore", "--apply")
        [restored] = [item for item in report["restore"]["unquarantined"]["restored"]
                      if item["asset_id"] == draft["id"]]
        self.assertEqual(restored["outcome"], "restored")
        self.assertEqual(draft["path"].read_bytes(), self._step("draft"))
        self.assertNotIn(draft["id"], [entry["asset_id"] for entry in self._run()[1]["quarantine"]])

    def test_record_legacy_records_lost_draft_files_only_with_apply(self) -> None:
        models = self._fixture()
        self._supersede_draft(models)
        models["draft"]["path"].unlink()
        models["old"]["path"].unlink()

        _code, report = self._run("--record-legacy")
        listed = [item["asset_id"] for item in report["record_legacy"]["assets"]]
        self.assertIn(models["draft"]["id"], listed)
        self.assertNotIn(models["old"]["id"], listed, "released history must be restored, not recorded")
        self.assertFalse(report["record_legacy"]["applied"])
        [item] = [item for item in report["draft_only"] if item["asset_id"] == models["draft"]["id"]]
        self.assertEqual(item["ledger"], "")

        _code, report = self._run("--record-legacy", "--apply")
        self.assertIn(models["draft"]["id"], [item["asset_id"] for item in report["record_legacy"]["assets"]])
        _code, report = self._run()
        [item] = [item for item in report["draft_only"] if item["asset_id"] == models["draft"]["id"]]
        self.assertEqual(item["ledger"], "purged")
        [old] = [item for item in report["history_broken"] if item["asset_id"] == models["old"]["id"]]
        self.assertEqual(old["ledger"], "")

    def test_restore_writes_only_exact_sha256_copies(self) -> None:
        models = self._fixture()
        ids = {model["id"] for model in models.values()}
        for model in models.values():
            model["path"].unlink()
        # ``live`` is in the object store; ``old`` is in a search directory, behind a same-size decoy.
        self.artifacts.put_stream(io.BytesIO(self._step("live")))
        decoys, backups = self.root / "decoys", self.root / "backups"
        decoys.mkdir()
        backups.mkdir()
        (decoys / "old.step").write_bytes(self._step("old").replace(b"old", b"odd"))
        (backups / "old.step").write_bytes(self._step("old"))
        # ``draft`` exists with other bytes: it must never be overwritten.
        models["draft"]["path"].write_bytes(self._step("draft").replace(b"draft", b"drift"))
        argv = ("--restore", "--search", str(decoys), "--search", str(backups))

        code, report = self._run(*argv)
        self.assertEqual(code, 1)
        self.assertFalse(models["live"]["path"].exists())
        self.assertFalse(models["old"]["path"].exists())
        restored = {item["asset_id"]: item["origin"] for item in report["restore"]["restored"] if item["asset_id"] in ids}
        self.assertEqual(restored, {models["live"]["id"]: "object_store", models["old"]["id"]: "search"})

        code, report = self._run(*argv, "--apply")
        for label in ("live", "old"):
            self.assertEqual(models[label]["path"].read_bytes(), self._step(label))
        self.assertEqual(models["draft"]["path"].read_bytes(), self._step("draft").replace(b"draft", b"drift"))
        unresolved = [item["asset_id"] for item in report["restore"]["unresolved"] if item["asset_id"] in ids]
        self.assertEqual(unresolved, [models["draft"]["id"]])

        _code, report = self._run()
        self.assertEqual(self._groups(report, ids), {
            "placement_broken": [], "history_broken": [], "draft_only": [models["draft"]["id"]],
        })

    def test_a_deactivated_part_is_release_history_not_placement(self) -> None:
        models = self._fixture()
        live = models["live"]
        live["path"].unlink()
        component_id = next(item for item in self._run()[1]["placement_broken"]
                            if item["asset_id"] == live["id"])["component_ids"][0]
        self.service.deactivate_component(component_id, actor="integration-test@local", reason="retired")

        code, report = self._run()
        self.assertEqual(self._groups(report, {live["id"]}), {
            "placement_broken": [], "history_broken": [live["id"]], "draft_only": [],
        })
        # Other suites share this database; the exit status follows placement_broken alone.
        self.assertEqual(code, 1 if report["placement_broken"] else 0)

    def test_database_url_also_selects_the_object_store_ledger(self) -> None:
        live = self._fixture()["live"]
        live["path"].unlink()

        class RecordingStore:
            def __init__(self) -> None:
                self.databases: list[str | None] = []

            def locate(self, _sha256: str, *, conn=None) -> None:
                name = conn.execute("SELECT current_database() AS name").fetchone()["name"] if conn else None
                self.databases.append(name)
                return None

        expected = urlsplit(CATALOG_URL).path.lstrip("/")
        for argv, databases in ((["--restore"], {None}), (["--restore", "--database-url", CATALOG_URL], {expected})):
            store = RecordingStore()
            with contextlib.redirect_stdout(io.StringIO()):
                check_script.main(argv, service=self.service, artifact_store=store)
            with self.subTest(argv=argv):
                self.assertTrue(store.databases)
                self.assertEqual(set(store.databases), databases)

    def test_dry_run_reads_an_archived_object_without_restoring_it(self) -> None:
        models = self._fixture()
        live = models["live"]
        live["path"].unlink()
        payload = self._step("live")
        sha256 = hashlib.sha256(payload).hexdigest()
        stored = self.artifacts.put_stream(io.BytesIO(payload))
        archived = self.artifacts.archive / sha256[:2] / f"{sha256}.gz"
        archived.parent.mkdir(parents=True)
        archived.write_bytes(gzip.compress(payload))
        stored.path.unlink()
        with database.connection() as conn:
            conn.execute("SET search_path TO operations, catalog, public")
            conn.execute(
                "UPDATE catalog_artifacts SET storage_state = 'archived', archived_path = %s, object_path = '' "
                "WHERE sha256 = %s",
                (str(archived), sha256),
            )
            conn.commit()
        before = self.artifacts.locate(sha256)

        _code, report = self._run("--restore")
        restored = [item for item in report["restore"]["restored"] if item["asset_id"] == live["id"]]
        self.assertEqual([(item["origin"], item["source"]) for item in restored], [("object_store", str(archived))])
        self.assertFalse(live["path"].exists())
        self.assertFalse(stored.path.exists())
        self.assertEqual(self.artifacts.locate(sha256), before)

        self._run("--restore", "--apply")
        self.assertEqual(live["path"].read_bytes(), payload)
        self.assertFalse(stored.path.exists())
        self.assertEqual(self.artifacts.locate(sha256), before)


def _schema_state(url: str) -> list[tuple]:
    with psycopg.connect(url) as conn:
        tables = conn.execute(
            "SELECT table_schema, table_name FROM information_schema.tables "
            "WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2"
        ).fetchall()
        versions = []
        if conn.execute("SELECT to_regclass('catalog.catalog_schema_versions')").fetchone()[0]:
            versions = conn.execute("SELECT version FROM catalog.catalog_schema_versions ORDER BY 1").fetchall()
        return tables + versions


@requires_scratch_postgres("catalog asset file check CLI tests")
class CatalogAssetFileCheckCliTests(unittest.TestCase):
    """The real entry point neither initializes the catalog nor creates directories."""

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.projects = Path(temporary.name) / "projects"
        patcher = patch("app.core.config.settings.KICAD_PROJECTS_ROOT", str(self.projects))
        patcher.start()
        self.addCleanup(patcher.stop)

    def _main(self, url: str) -> tuple[int, str, str]:
        output, errors = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            code = check_script.main(["--database-url", url, "--restore"])
        return code, output.getvalue(), errors.getvalue()

    def test_dry_run_on_a_migrated_catalog_changes_nothing(self) -> None:
        ComponentCatalogPostgresService(
            store_root=Path(tempfile.mkdtemp(dir=self.projects.parent)) / "components", database_url=CATALOG_URL
        ).initialize()
        before = _schema_state(CATALOG_URL)
        code, output, _errors = self._main(CATALOG_URL)
        self.assertIn(code, (0, 1))
        self.assertEqual(json.loads(output)["store_root"], str((self.projects / ".kicad-prism" / "components").resolve()))
        self.assertEqual(_schema_state(CATALOG_URL), before)
        self.assertFalse(self.projects.exists())

    def test_an_unmigrated_database_is_refused_without_creating_anything(self) -> None:
        name = f"asset_check_empty_{uuid.uuid4().hex[:8]}"
        server = urlunsplit(urlsplit(CATALOG_URL)._replace(path="/postgres"))
        with psycopg.connect(server, autocommit=True) as conn:
            conn.execute(f'CREATE DATABASE "{name}"')
        self.addCleanup(self._drop_database, server, name)
        url = urlunsplit(urlsplit(CATALOG_URL)._replace(path=f"/{name}"))
        before = _schema_state(url)

        code, output, errors = self._main(url)
        self.assertEqual((code, output), (2, ""))
        self.assertIn("not at head", errors)
        self.assertEqual(_schema_state(url), before)
        self.assertEqual(before, [])
        self.assertFalse(self.projects.exists())

    @staticmethod
    def _drop_database(server: str, name: str) -> None:
        with psycopg.connect(server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


class NoObjectStore:
    def locate(self, _sha256: str) -> None:
        return None


class CatalogAssetRestoreDestinationTests(unittest.TestCase):
    """Restore writes only inside the store, never through a symlink or over an entry."""

    PAYLOAD = b"ISO-10303-21;END-ISO-10303-21;"

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.store = self.root / "store"
        self.outside = self.root / "outside"
        self.backups = self.root / "backups"
        for directory in (self.store / "3dmodels", self.outside, self.backups):
            directory.mkdir(parents=True)
        (self.backups / "model.step").write_bytes(self.PAYLOAD)

    def _restore(self, *paths: str) -> dict:
        items = [{
            "asset_id": f"asset-{index}", "asset_type": "3dmodel", "canonical_path": path,
            "sha256": hashlib.sha256(self.PAYLOAD).hexdigest(), "size_bytes": len(self.PAYLOAD),
            "problem": "missing", "component_ids": [],
        } for index, path in enumerate(paths)]
        return check_script.restore_missing(
            {"placement_broken": items, "history_broken": [], "draft_only": []},
            store_root=self.store, artifact_store=NoObjectStore(),
            search=check_script.SearchIndex([self.backups]), apply=True,
        )

    def test_destinations_outside_the_store_or_behind_a_symlink_are_refused(self) -> None:
        (self.store / "3dmodels" / "linked").symlink_to(self.outside, target_is_directory=True)
        (self.store / "3dmodels" / "dangling.step").symlink_to(self.outside / "target.step")
        result = self._restore(
            str(self.outside / "absolute.step"),
            "3dmodels/../../outside/dotdot.step",
            str(self.store / "3dmodels" / "linked" / "model.step"),
            str(self.store / "3dmodels" / "dangling.step"),
            str(self.store / "3dmodels" / "Lib" / "model.step"),
        )
        self.assertEqual(
            [(item["asset_id"], item["reason"]) for item in result["refused"]],
            [
                ("asset-0", "outside the catalog store"),
                ("asset-1", "outside the catalog store"),
                ("asset-2", "symlink inside the catalog store"),
                ("asset-3", "symlink inside the catalog store"),
            ],
        )
        self.assertEqual([item["asset_id"] for item in result["restored"]], ["asset-4"])
        self.assertEqual(list(self.outside.iterdir()), [])
        self.assertEqual((self.store / "3dmodels" / "Lib" / "model.step").read_bytes(), self.PAYLOAD)

    def test_a_store_reached_through_a_symlink_restores_paths_spelled_either_way(self) -> None:
        linked = self.root / "linked-store"
        linked.symlink_to(self.store, target_is_directory=True)
        result = check_script.restore_missing(
            {"placement_broken": [{
                "asset_id": f"asset-{index}", "asset_type": "3dmodel", "canonical_path": str(path),
                "sha256": hashlib.sha256(self.PAYLOAD).hexdigest(), "size_bytes": len(self.PAYLOAD),
                "problem": "missing", "component_ids": [],
            } for index, path in enumerate((
                linked / "3dmodels" / "as-given.step",
                self.store.resolve() / "3dmodels" / "resolved.step",
                linked / "3dmodels" / ".." / ".." / "outside" / "escape.step",
            ))], "history_broken": [], "draft_only": []},
            store_root=linked, artifact_store=NoObjectStore(),
            search=check_script.SearchIndex([self.backups]), apply=True,
        )
        self.assertEqual([item["asset_id"] for item in result["restored"]], ["asset-0", "asset-1"])
        self.assertEqual([(item["asset_id"], item["reason"]) for item in result["refused"]],
                         [("asset-2", "outside the catalog store")])
        for name in ("as-given.step", "resolved.step"):
            self.assertEqual((self.store / "3dmodels" / name).read_bytes(), self.PAYLOAD)
        self.assertEqual(list(self.outside.iterdir()), [])

    def test_a_restored_file_gets_the_mode_of_the_store_files(self) -> None:
        sibling = self.store / "3dmodels" / "sibling.step"
        sibling.write_bytes(self.PAYLOAD)  # how the catalog writes its files
        destination = self.store / "3dmodels" / "model.step"
        self.assertEqual([item["asset_id"] for item in self._restore(str(destination))["restored"]], ["asset-0"])
        self.assertEqual(stat.S_IMODE(destination.stat().st_mode), stat.S_IMODE(sibling.stat().st_mode))

    def test_a_corrupt_archive_falls_back_to_a_search_copy(self) -> None:
        corrupt = self.root / "corrupt.gz"
        corrupt.write_bytes(gzip.compress(self.PAYLOAD)[:10] + b"\x07" * 32)  # zlib.error: invalid block type

        class ArchivedStore:
            def locate(self, _sha256: str) -> dict[str, str]:
                return {"storage_state": "archived", "object_path": "", "archived_path": str(corrupt)}

        destination = self.store / "3dmodels" / "model.step"
        result = check_script.restore_missing(
            {"placement_broken": [{
                "asset_id": "asset-0", "asset_type": "3dmodel", "canonical_path": str(destination),
                "sha256": hashlib.sha256(self.PAYLOAD).hexdigest(), "size_bytes": len(self.PAYLOAD),
                "problem": "missing", "component_ids": [],
            }], "history_broken": [], "draft_only": []},
            store_root=self.store, artifact_store=ArchivedStore(),
            search=check_script.SearchIndex([self.backups]), apply=True,
        )
        self.assertEqual([item["origin"] for item in result["restored"]], ["search"])
        self.assertEqual(destination.read_bytes(), self.PAYLOAD)

    def test_an_entry_created_during_the_write_is_kept(self) -> None:
        destination = self.store / "3dmodels" / "model.step"
        real_link = check_script.os.link

        def racing_link(source: str, target: Path) -> None:
            target.symlink_to(self.outside / "late.step")  # a dangling entry appears first
            real_link(source, target)

        with patch.object(check_script.os, "link", racing_link):
            result = self._restore(str(destination))
        self.assertEqual([item["reason"] for item in result["skipped"]], ["appeared concurrently"])
        self.assertEqual(result["restored"], [])
        self.assertTrue(destination.is_symlink())
        self.assertEqual(list(self.outside.iterdir()), [])
        self.assertEqual([path.name for path in destination.parent.iterdir()], ["model.step"])


if __name__ == "__main__":
    unittest.main()
