"""Artifact maintenance must not delete the STEP bytes of a released revision.

``purge_superseded_step_files`` keeps only the models of
``components.current_revision_id``. Opening a draft moves that pointer at once,
while ``released_revision_id`` moves only on release, so a draft that replaces
the 3D model must not let maintenance delete the model placement still serves.

A model it may remove, an abandoned draft's, first moves to quarantine and is
deleted only after the grace period; each step is recorded in the append-only
purge ledger, so audit verification and asset reads can tell the intended
purge from a lost file.
"""

from __future__ import annotations

import sys
import tempfile
import threading
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.errors import NotFound  # noqa: E402
from app.services import catalog_worker_tasks  # noqa: E402
from app.services.catalog.asset_files import lock_and_check_asset_bytes  # noqa: E402
from app.services.catalog.asset_links import CatalogAssetLinks  # noqa: E402
from app.services.catalog.conflicts import CatalogConflict  # noqa: E402
from app.services.catalog.step_quarantine import StepQuarantine  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from support.postgres import CATALOG_URL, requires_scratch_postgres  # noqa: E402


ACTOR = "designer@example.com"


@requires_scratch_postgres("catalog STEP purge tests")
class SupersededStepPurgeTests(unittest.TestCase):
    def setUp(self) -> None:
        for target, value in (
            ("app.core.config.settings.CATALOG_KLC_ENABLED", False),
            ("app.core.config.settings.CATALOG_KLC_RELEASE_GATE", "warn"),
        ):
            patcher = patch(target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.service = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components",
            database_url=CATALOG_URL,
        )
        self.service.initialize()
        self.addCleanup(self.service.close)
        self.token = uuid.uuid4().hex[:10]

    def _purge(self, pinned_revision_ids: tuple[str, ...] = (), *, grace_days: int = 30) -> dict:
        """Run the maintenance purge, which commits its ledger rows, against this service."""
        with (
            patch.object(catalog_worker_tasks, "catalog_service", self.service),
            patch("app.core.config.settings.CATALOG_DRAFT_MODEL_QUARANTINE_DAYS", grace_days),
        ):
            return catalog_worker_tasks.purge_superseded_step_files(
                job_id=f"job-{self.token}", pinned_revision_ids=pinned_revision_ids
            )

    def _released_part_with_model(self) -> tuple[dict, dict]:
        """A released part whose revision carries one STEP model."""

        released = self._release(self._part_with_model())
        [model] = [asset for asset in released["assets"] if asset["asset_type"] == "3dmodel"]
        return released, model

    def _part_with_model(self, part: str = "", model: str = "rev1") -> dict:
        """An unreleased part whose head revision carries one STEP model."""

        created = self.service.create_manual_component(
            value="10k",
            description="STEP purge component",
            datasheet="https://example.com/r.pdf",
            manufacturer="Prism Purge",
            manufacturer_part_number=f"PURGE-{self.token}{part}",
            actor=ACTOR,
        )
        component_id = str(created["id"])
        self.addCleanup(
            self.service.deactivate_component, component_id, actor="purge-test@local", reason="STEP purge test cleanup"
        )
        # Each run writes distinct bytes so asset rows from earlier runs, whose
        # backing files are gone, are never reused.
        symbol = f'''(kicad_symbol_lib (version 20231120) (generator "test")
          (symbol "R_Purge"
            (property "Reference" "R" (at 0 0 0) (effects (font (size 1.27 1.27))))
            (property "Value" "{self.token}" (at 0 0 0) (effects (font (size 1.27 1.27))))
          )
        )'''.encode()
        self.service.import_symbol_library(
            component_id, upload_name="R_Purge.kicad_sym", payload=symbol, target_library="Prism_Purge",
            selected_symbol="R_Purge", actor=ACTOR,
        )
        self.service.import_footprint(
            component_id, upload_name="R_Purge.kicad_mod",
            payload=f'(footprint "R_Purge" (version 20240108) (generator "test") (descr "{self.token}"))'.encode(),
            target_library="Prism_Purge", selected_footprint="R_Purge", actor=ACTOR,
        )
        return self._attach_model(component_id, model)

    def _release(self, draft: dict) -> dict:
        """Walk the head revision through QA approval to release."""

        component_id = str(draft["id"])
        self.service.set_release_status(component_id, "in_progress", actor=ACTOR)
        self.service.set_release_status(component_id, "qa_review", actor=ACTOR)
        approved = self.service.set_release_status(
            component_id, "done", actor="qa@example.com", actor_role="qa",
            expected_revision_id=draft["revision_id"], expected_manifest_hash=draft["manifest_hash"],
        )
        released = self.service.set_release_status(
            component_id, "released", actor=ACTOR, actor_role="designer",
            expected_revision_id=approved["revision_id"], expected_manifest_hash=approved["manifest_hash"],
        )
        self.assertEqual(released["release_status"], "released")
        return released

    def _attach_model(self, component_id: str, label: str) -> dict:
        return self.service.attach_auxiliary_asset(
            component_id, asset_type="3dmodel", upload_name="R_Purge.step",
            payload=f"ISO-10303-21;/* {label} {self.token} */END-ISO-10303-21;".encode(),
            target_library="Prism_Purge", actor=ACTOR,
        )["component"]

    def _detach(self, component: dict, asset_id: str) -> dict:
        return self.service.detach_asset_by_id(
            str(component["id"]), asset_id, expected_revision_id=component["revision_id"], actor=ACTOR,
        )["component"]

    def _replace_model_in_draft(self, released: dict, old_model: dict) -> dict:
        """Draft: attach a new STEP, then detach the released one."""

        drafted = self._attach_model(str(released["id"]), "rev2")
        return self._detach(drafted, str(old_model["id"]))

    @staticmethod
    def _model_ids(component: dict) -> list[str]:
        return [str(asset["id"]) for asset in component["assets"] if asset["asset_type"] == "3dmodel"]

    def _step_path(self, asset_id: str) -> Path:
        with self.service.connection() as conn:
            row = conn.execute("SELECT canonical_path FROM assets WHERE id = %s", (asset_id,)).fetchone()
        return Path(str(row["canonical_path"]))

    def test_draft_with_a_new_model_keeps_the_released_step(self) -> None:
        released, old_model = self._released_part_with_model()
        old_path = self._step_path(str(old_model["id"]))
        self.assertTrue(old_path.is_file())

        draft = self._replace_model_in_draft(released, old_model)
        self.assertNotEqual(draft["revision_id"], released["revision_id"])
        self.assertNotIn(str(old_model["id"]), [str(asset["id"]) for asset in draft["assets"]])
        placed = self.service.get_component(str(released["id"]), released_only=True)
        self.assertEqual(placed["revision_id"], released["revision_id"], "placement still serves the released revision")

        result = self._purge()

        self.assertNotIn(str(old_model["id"]), result["asset_ids"])
        self.assertTrue(old_path.is_file(), "the released revision's STEP was purged")
        bundle = self.service.build_inline_bundle(str(released["id"]))
        self.assertIsNotNone(bundle)

    def test_new_release_keeps_the_earlier_released_step(self) -> None:
        first, old_model = self._released_part_with_model()
        old_path = self._step_path(str(old_model["id"]))

        second = self._release(self._replace_model_in_draft(first, old_model))
        self.assertNotEqual(second["revision_id"], first["revision_id"])
        self.assertNotIn(str(old_model["id"]), self._model_ids(second))

        result = self._purge()

        self.assertNotIn(str(old_model["id"]), result["asset_ids"])
        self.assertTrue(old_path.is_file(), "an earlier released revision's STEP was purged")
        self.assertTrue(self.service.verify_component_audit_chain(str(first["id"]))["valid"])

    def test_never_released_draft_step_is_still_purged(self) -> None:
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        scratch_path = self._step_path(scratch_id)
        head = self._detach(with_scratch, scratch_id)
        self.assertNotIn(scratch_id, self._model_ids(head))

        result = self._purge()

        self.assertIn(scratch_id, result["asset_ids"])
        self.assertFalse(scratch_path.exists())
        self.assertTrue(self._step_path(str(old_model["id"])).is_file())

    def test_draft_step_pinned_outside_the_catalog_is_kept(self) -> None:
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        scratch_path = self._step_path(scratch_id)
        self._detach(with_scratch, scratch_id)

        result = self._purge(pinned_revision_ids=(with_scratch["revision_id"],))

        self.assertNotIn(scratch_id, result["asset_ids"])
        self.assertTrue(scratch_path.is_file(), "a draft STEP pinned by a System Builder system was purged")

    def _archived_release_with_model(self) -> tuple[dict, dict]:
        """A released revision archived in place: released_revision_id is cleared."""

        released, model = self._released_part_with_model()
        archived = self.service.set_release_status(
            str(released["id"]), "archived", actor=ACTOR, expected_revision_id=released["revision_id"],
        )
        self.assertEqual(archived["revision_id"], released["revision_id"])
        self.assertEqual(self._released_revision_id(str(released["id"])), "")
        return archived, model

    def _released_revision_id(self, component_id: str) -> str:
        with self.service.connection() as conn:
            row = conn.execute("SELECT released_revision_id FROM components WHERE id = %s", (component_id,)).fetchone()
        return str(row["released_revision_id"])

    def test_archived_release_keeps_its_step_through_the_release_record(self) -> None:
        archived, old_model = self._archived_release_with_model()
        old_path = self._step_path(str(old_model["id"]))
        draft = self._replace_model_in_draft(archived, old_model)
        self.assertNotIn(str(old_model["id"]), self._model_ids(draft))
        self.assertTrue(self.service.list_component_release_records(str(archived["id"])))

        result = self._purge()

        self.assertNotIn(str(old_model["id"]), result["asset_ids"])
        self.assertTrue(old_path.is_file(), "an archived release's STEP was purged")

    def test_step_shared_with_another_components_archived_release_is_kept(self) -> None:
        archived, shared_model = self._archived_release_with_model()
        self._replace_model_in_draft(archived, shared_model)
        # Same bytes, so the second part links the same asset row.
        other = self._part_with_model("-B")
        self.assertEqual(self._model_ids(other), [str(shared_model["id"])])
        shared_path = self._step_path(str(shared_model["id"]))
        other_draft = self._replace_model_in_draft(other, shared_model)
        self.assertNotIn(str(shared_model["id"]), self._model_ids(other_draft))

        result = self._purge()

        self.assertNotIn(str(shared_model["id"]), result["asset_ids"])
        self.assertTrue(shared_path.is_file(), "a STEP shared with another component's archived release was purged")

    def test_legacy_released_revision_without_record_keeps_its_step(self) -> None:
        part = self._part_with_model()
        [model_id] = self._model_ids(part)
        model_path = self._step_path(model_id)
        draft = self._replace_model_in_draft(part, {"id": model_id})
        # No public API marks a revision released without writing a release
        # record and moving released_revision_id, so set up the legacy state here.
        with self.service.connection() as conn:
            conn.execute(
                "UPDATE component_revisions SET release_status = 'released' WHERE id = %s", (part["revision_id"],)
            )
            conn.commit()
        self.assertFalse(self.service.list_component_release_records(str(part["id"])))
        self.assertEqual(self._released_revision_id(str(part["id"])), "")
        self.assertNotEqual(draft["revision_id"], part["revision_id"])

        result = self._purge()

        self.assertNotIn(model_id, result["asset_ids"])
        self.assertTrue(model_path.is_file(), "a legacy released revision's STEP was purged")

    def _purged_draft_model(self) -> tuple[dict, dict, str]:
        """A released part whose head draft dropped a scratch STEP that maintenance purged."""
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        self._detach(with_scratch, scratch_id)
        self.assertIn(scratch_id, self._purge()["asset_ids"])
        return released, old_model, scratch_id

    def test_purged_draft_model_keeps_the_audit_chain_valid(self) -> None:
        released, _old_model, scratch_id = self._purged_draft_model()

        audit = self.service.verify_component_audit_chain(str(released["id"]))

        self.assertTrue(audit["valid"], audit)
        self.assertEqual(audit["purged_asset_ids"], [scratch_id])
        with self.service.connection() as conn:
            row = conn.execute(
                "SELECT job_id, reason FROM catalog_asset_file_purges WHERE asset_id = %s", (scratch_id,)
            ).fetchone()
        self.assertEqual((row["job_id"], row["reason"]), (f"job-{self.token}", "superseded_draft_step"))

    def test_reading_a_quarantined_model_is_a_typed_not_found(self) -> None:
        _released, _old_model, scratch_id = self._purged_draft_model()

        for read in (self.service.get_asset_by_id, self.service.catalog_asset_source):
            with self.subTest(read=read.__name__), self.assertRaises(NotFound) as raised:
                read(scratch_id)
            self.assertEqual(raised.exception.code, "asset_quarantined")
            self.assertEqual(raised.exception.status_code, 404)

        self._purge(grace_days=0)

        for read in (self.service.get_asset_by_id, self.service.catalog_asset_source):
            with self.subTest(read=read.__name__, after="grace period"), self.assertRaises(NotFound) as raised:
                read(scratch_id)
            self.assertEqual(raised.exception.code, "asset_purged")

    def test_missing_file_without_a_ledger_row_is_still_invalid(self) -> None:
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        self._detach(with_scratch, scratch_id)
        self._step_path(scratch_id).unlink()

        audit = self.service.verify_component_audit_chain(str(released["id"]))

        self.assertFalse(audit["valid"])
        self.assertEqual(audit["reason"], "asset_content_mismatch")
        self.assertEqual(audit["first_invalid_asset_id"], scratch_id)

    def test_a_ledger_row_never_excuses_a_released_model(self) -> None:
        released, model = self._released_part_with_model()
        path = self._step_path(str(model["id"]))
        with self.service.connection() as conn:
            conn.execute(
                """
                INSERT INTO catalog_asset_file_purges (id, asset_id, sha256, canonical_path, reason, purged_at)
                SELECT %s, id, sha256, canonical_path, 'test', '2026-01-01T00:00:00+00:00' FROM assets WHERE id = %s
                """,
                (uuid.uuid4().hex, str(model["id"])),
            )
            conn.commit()
        path.unlink()

        audit = self.service.verify_component_audit_chain(str(released["id"]))

        self.assertFalse(audit["valid"])
        self.assertEqual(audit["first_invalid_asset_id"], str(model["id"]))

    def _relink_purged_model(self, released: dict, scratch_id: str) -> dict:
        """Upload the purged bytes again: the asset row is reused and its file restored."""
        relinked = self._attach_model(str(released["id"]), "scratch")
        self.assertIn(scratch_id, self._model_ids(relinked))
        self.assertTrue(self._step_path(scratch_id).is_file())
        return relinked

    def _assert_invalid_at(self, component_id: str, asset_id: str) -> None:
        audit = self.service.verify_component_audit_chain(component_id)
        self.assertFalse(audit["valid"], audit)
        self.assertEqual(audit["reason"], "asset_content_mismatch")
        self.assertEqual(audit["first_invalid_asset_id"], asset_id)

    def test_an_old_ledger_row_does_not_excuse_a_relinked_model(self) -> None:
        released, _old_model, scratch_id = self._purged_draft_model()
        self._relink_purged_model(released, scratch_id)
        self._step_path(scratch_id).unlink()

        self._assert_invalid_at(str(released["id"]), scratch_id)
        with self.assertRaises(FileNotFoundError):
            self.service.get_asset_by_id(scratch_id)

    def test_a_relinked_model_abandoned_again_needs_a_new_ledger_row(self) -> None:
        released, _old_model, scratch_id = self._purged_draft_model()
        relinked = self._relink_purged_model(released, scratch_id)
        self._detach(relinked, scratch_id)
        path = self._step_path(scratch_id)
        payload = path.read_bytes()
        path.unlink()

        self._assert_invalid_at(str(released["id"]), scratch_id)

        path.write_bytes(payload)
        self.assertIn(scratch_id, self._purge()["asset_ids"])
        audit = self.service.verify_component_audit_chain(str(released["id"]))
        self.assertTrue(audit["valid"], audit)
        self.assertEqual(audit["purged_asset_ids"], [scratch_id])

    def _abandoned_scratch_model(self) -> tuple[dict, str]:
        """A released part whose draft head dropped a scratch STEP the purge may delete."""
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        self._detach(with_scratch, scratch_id)
        return released, scratch_id

    def _link_on_new_draft(self, conn, component_id: str, asset_id: str) -> None:
        """Link an existing asset to a new draft head, as a project import does; the caller commits."""
        revision = self.service.revisions.clone_revision(
            conn, component_id, actor=ACTOR, change_kind="asset", change_summary="Link the scratch model again",
        )
        asset = dict(conn.execute("SELECT * FROM assets WHERE id = %s", (asset_id,)).fetchone())
        CatalogAssetLinks.link_asset_to_revision(conn, str(revision["id"]), asset, required=False)

    def test_purge_skips_a_model_whose_link_is_not_committed_yet(self) -> None:
        released, scratch_id = self._abandoned_scratch_model()

        with self.service.connection() as linker:
            self._link_on_new_draft(linker, str(released["id"]), scratch_id)
            self.assertNotIn(scratch_id, self._purge()["asset_ids"])
            linker.commit()

        self.assertTrue(self._step_path(scratch_id).is_file())
        # The committed draft head now protects the model on later runs too.
        self.assertNotIn(scratch_id, self._purge()["asset_ids"])
        self.assertTrue(self._step_path(scratch_id).is_file())

    def test_purge_rechecks_a_candidate_linked_after_its_snapshot(self) -> None:
        released, scratch_id = self._abandoned_scratch_model()
        test = self

        class LinkAfterCandidates:
            """Commit a link on another connection right after the purge picks its candidates."""

            def __init__(self, conn) -> None:
                self._conn = conn

            def __getattr__(self, name):
                return getattr(self._conn, name)

            def execute(self, sql, params=()):
                cursor = self._conn.execute(sql, params)
                if "superseded_models" in sql:
                    with test.service.connection() as linker:
                        test._link_on_new_draft(linker, str(released["id"]), scratch_id)
                        linker.commit()
                return cursor

        with self.service.connection() as conn:
            result = StepQuarantine.purge_superseded_step_files(
                LinkAfterCandidates(conn), self.service.runtime, job_id=f"job-{self.token}"
            )
            conn.commit()

        self.assertNotIn(scratch_id, result["asset_ids"])
        self.assertTrue(self._step_path(scratch_id).is_file())

    def test_a_linker_waits_for_a_purge_in_progress_then_is_refused(self) -> None:
        released, scratch_id = self._abandoned_scratch_model()
        outcome: list[BaseException] = []
        unlinking, release_unlink = threading.Event(), threading.Event()
        real_rename = Path.rename

        def slow_rename(path: Path, *args, **kwargs):
            unlinking.set()
            release_unlink.wait(30)
            return real_rename(path, *args, **kwargs)

        def link() -> None:
            with self.service.connection() as linker:
                try:
                    self._link_on_new_draft(linker, str(released["id"]), scratch_id)
                    linker.commit()
                except BaseException as exc:  # noqa: BLE001 - reported to the test thread
                    outcome.append(exc)
                    linker.rollback()

        results: list[dict] = []
        with patch.object(Path, "rename", autospec=True, side_effect=slow_rename):
            purge = threading.Thread(target=lambda: results.append(self._purge()))
            purge.start()
            self.assertTrue(unlinking.wait(30), "the purge never reached the move")
            # The ledger row is committed and the file is still there: the purge holds the asset lock.
            linker = threading.Thread(target=link)
            linker.start()
            linker.join(timeout=1.0)
            self.assertTrue(linker.is_alive(), "the linker did not wait for the purge's asset lock")
            release_unlink.set()
            purge.join(timeout=30)
        linker.join(timeout=30)

        self.assertFalse(linker.is_alive())
        self.assertIn(scratch_id, results[0]["asset_ids"])
        [error] = outcome
        self.assertIsInstance(error, CatalogConflict)
        self.assertEqual(error.code, "asset_bytes_missing")

    def test_linking_a_purged_model_is_refused_until_it_is_uploaded_again(self) -> None:
        released, _old_model, scratch_id = self._purged_draft_model()

        with self.service.connection() as linker:
            with self.assertRaises(CatalogConflict) as raised:
                self._link_on_new_draft(linker, str(released["id"]), scratch_id)
            linker.rollback()
        self.assertEqual(raised.exception.code, "asset_bytes_missing")
        self.assertEqual(raised.exception.status_code, 409)

        self._relink_purged_model(released, scratch_id)

    def _abandoned_draft_models(self, count: int) -> tuple[dict, list[str]]:
        """A released part whose head draft dropped ``count`` scratch STEPs, all purge-eligible."""
        released, old_model = self._released_part_with_model()
        head = self._replace_model_in_draft(released, old_model)
        scratch_ids: list[str] = []
        for index in range(count):
            with_scratch = self._attach_model(str(released["id"]), f"scratch-{index}")
            [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(head))
            head = self._detach(with_scratch, scratch_id)
            scratch_ids.append(scratch_id)
        return released, scratch_ids

    def _ledger_rows(self, asset_id: str) -> list[dict]:
        with self.service.connection() as conn:
            return [dict(row) for row in conn.execute(
                "SELECT purged_at, event FROM catalog_asset_file_purges WHERE asset_id = %s ORDER BY purged_at",
                (asset_id,),
            ).fetchall()]

    def test_a_crash_mid_purge_keeps_the_ledger_row_of_every_moved_file(self) -> None:
        released, scratch_ids = self._abandoned_draft_models(2)
        paths = {asset_id: self._step_path(asset_id) for asset_id in scratch_ids}
        real_rename = Path.rename
        calls: list[Path] = []

        def rename_then_crash(path: Path, *args, **kwargs):
            if calls:
                raise SystemExit("worker killed mid-purge")
            calls.append(path)
            return real_rename(path, *args, **kwargs)

        with patch.object(Path, "rename", autospec=True, side_effect=rename_then_crash):
            with self.assertRaises(SystemExit):
                self._purge()

        deleted = [asset_id for asset_id, path in paths.items() if not path.exists()]
        self.assertEqual(len(deleted), 1)
        self.assertEqual(len(self._ledger_rows(deleted[0])), 1, "a moved STEP lost its purge-ledger row")
        self.assertTrue(self.service.verify_component_audit_chain(str(released["id"]))["valid"])

    def test_a_failed_move_keeps_the_file_and_the_next_run_quarantines_it(self) -> None:
        released, [scratch_id] = self._abandoned_draft_models(1)
        path = self._step_path(scratch_id)

        with patch.object(Path, "rename", autospec=True, side_effect=PermissionError("read-only store")):
            first = self._purge()

        self.assertNotIn(scratch_id, first["asset_ids"])
        self.assertTrue(path.is_file())
        self.assertTrue(self.service.verify_component_audit_chain(str(released["id"]))["valid"])
        self.assertIsNotNone(self.service.get_asset_by_id(scratch_id), "a present file reads normally")

        second = self._purge()

        self.assertIn(scratch_id, second["asset_ids"])
        self.assertFalse(path.exists())
        rows = self._ledger_rows(scratch_id)
        self.assertEqual([row["event"] for row in rows], ["quarantined", "quarantine_failed", "quarantined"])
        for row in rows:
            self.assertRegex(row["purged_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}\+00:00$")
        self.assertTrue(self.service.verify_component_audit_chain(str(released["id"]))["valid"])

    def test_linkers_taking_two_models_in_opposite_orders_do_not_deadlock(self) -> None:
        _released, [first, second] = self._abandoned_draft_models(2)

        with self.service.connection() as one, self.service.connection() as two:
            for conn in (one, two):
                conn.execute("SET lock_timeout = '2s'")
            lock_and_check_asset_bytes(one, first)
            lock_and_check_asset_bytes(two, second)
            # Exclusive linker locks would make each wait for the other here.
            lock_and_check_asset_bytes(one, second)
            lock_and_check_asset_bytes(two, first)
            # A purge still skips both while either linker is open.
            self.assertEqual(self._purge()["asset_ids"], [])
            one.rollback()
            two.rollback()

        self.assertEqual(sorted(self._purge()["asset_ids"]), sorted([first, second]))

    def test_the_link_byte_check_streams_the_file(self) -> None:
        _released, [scratch_id] = self._abandoned_draft_models(1)

        with self.service.connection() as conn:
            with patch.object(Path, "read_bytes", autospec=True, side_effect=AssertionError("read whole file")):
                lock_and_check_asset_bytes(conn, scratch_id)
            conn.rollback()

    # -- quarantine (issue #698, D1) -------------------------------------------

    def _events(self, asset_id: str) -> list[dict]:
        with self.service.connection() as conn:
            return [dict(row) for row in conn.execute(
                "SELECT id, event, reason, quarantine_path, quarantine_id FROM catalog_asset_file_purges "
                "WHERE asset_id = %s ORDER BY purged_at::timestamptz",
                (asset_id,),
            ).fetchall()]

    def test_purge_moves_the_file_to_quarantine_and_keeps_it_for_the_grace_period(self) -> None:
        released, [scratch_id] = self._abandoned_draft_models(1)
        path = self._step_path(scratch_id)
        payload = path.read_bytes()

        self.assertIn(scratch_id, self._purge()["asset_ids"])

        self.assertFalse(path.exists())
        [entry] = self._events(scratch_id)
        self.assertEqual((entry["event"], entry["reason"]), ("quarantined", "superseded_draft_step"))
        quarantined = Path(entry["quarantine_path"])
        self.assertEqual(quarantined.parent.parent, self.service.runtime.store_root / "quarantine")
        self.assertEqual(quarantined.read_bytes(), payload)

        later = self._purge()
        self.assertEqual(later["expired"]["deleted"], 0)
        self.assertTrue(quarantined.is_file(), "a quarantined STEP was deleted inside its grace period")
        self.assertTrue(self.service.verify_component_audit_chain(str(released["id"]))["valid"])

    def test_after_the_grace_period_the_quarantined_copy_is_deleted_and_recorded(self) -> None:
        released, [scratch_id] = self._abandoned_draft_models(1)
        self._purge()
        [entry] = self._events(scratch_id)

        result = self._purge(grace_days=0)

        self.assertEqual(result["expired"]["deleted_asset_ids"], [scratch_id])
        self.assertFalse(Path(entry["quarantine_path"]).exists())
        self.assertFalse(Path(entry["quarantine_path"]).parent.exists())
        events = self._events(scratch_id)
        self.assertEqual([row["event"] for row in events], ["quarantined", "deleted"])
        self.assertEqual(events[1]["quarantine_id"], entry["id"])
        audit = self.service.verify_component_audit_chain(str(released["id"]))
        self.assertTrue(audit["valid"], audit)
        self.assertEqual(audit["purged_asset_ids"], [scratch_id])
        self.assertEqual(self._purge(grace_days=0)["expired"]["deleted"], 0, "a closed entry was handled twice")

    def test_a_quarantined_file_can_be_restored_and_is_not_quarantined_again(self) -> None:
        released, [scratch_id] = self._abandoned_draft_models(1)
        path = self._step_path(scratch_id)
        payload = path.read_bytes()
        self._purge()

        with self.service.connection() as conn:
            restored = StepQuarantine.restore(conn, self.service.runtime, scratch_id, job_id="operator")

        self.assertEqual(restored["outcome"], "restored")
        self.assertEqual(path.read_bytes(), payload)
        self.assertEqual([row["event"] for row in self._events(scratch_id)], ["quarantined", "restored"])
        self.assertIsNotNone(self.service.get_asset_by_id(scratch_id))
        self.assertTrue(self.service.verify_component_audit_chain(str(released["id"]))["valid"])

        self.assertNotIn(scratch_id, self._purge(grace_days=0)["asset_ids"])
        self.assertTrue(path.is_file(), "a restored STEP was quarantined again before it was linked again")
        with self.service.connection() as conn, self.assertRaises(NotFound) as raised:
            StepQuarantine.restore(conn, self.service.runtime, scratch_id)
        self.assertEqual(raised.exception.code, "quarantine_entry_not_found")

        relinked = self._attach_model(str(released["id"]), "scratch-0")
        self.assertIn(scratch_id, self._model_ids(relinked))
        self._detach(relinked, scratch_id)
        self.assertIn(scratch_id, self._purge()["asset_ids"], "a relinked then abandoned STEP is purged again")

    def test_a_quarantined_file_pinned_again_is_restored_instead_of_deleted(self) -> None:
        released, old_model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, old_model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        path = self._step_path(scratch_id)
        self._detach(with_scratch, scratch_id)
        self._purge()
        self.assertFalse(path.exists())

        result = self._purge((with_scratch["revision_id"],), grace_days=0)

        self.assertEqual(result["expired"]["restored_asset_ids"], [scratch_id])
        self.assertTrue(path.is_file(), "a quarantined STEP a System Builder pin needs was deleted")
        self.assertEqual(self._events(scratch_id)[-1]["reason"], "protected_again")

    def test_record_legacy_accounts_for_draft_files_lost_before_the_ledger(self) -> None:
        released, model = self._released_part_with_model()
        draft = self._replace_model_in_draft(released, model)
        with_scratch = self._attach_model(str(released["id"]), "scratch")
        [scratch_id] = set(self._model_ids(with_scratch)) - set(self._model_ids(draft))
        self._detach(with_scratch, scratch_id)
        # The pre-ledger purge deleted the file and wrote nothing; it also deleted released models.
        self._step_path(scratch_id).unlink()
        self._step_path(str(model["id"])).unlink()
        self.assertFalse(self.service.verify_component_audit_chain(str(released["id"]))["valid"])

        with self.service.connection() as conn:
            losses = {str(row["id"]) for row in StepQuarantine.legacy_losses(conn)}
            conn.rollback()
        self.assertIn(scratch_id, losses)
        self.assertNotIn(str(model["id"]), losses, "a released model's loss must be restored, not recorded")
        with self.service.connection() as conn:
            StepQuarantine.record_legacy_losses(conn, job_id=f"legacy-{self.token}")
        with self.service.connection() as conn:
            self.assertNotIn(scratch_id, {str(row["id"]) for row in StepQuarantine.legacy_losses(conn)})
            conn.rollback()

        [entry] = self._events(scratch_id)
        self.assertEqual((entry["event"], entry["reason"]), ("purged", "legacy_pre_ledger"))
        # Only the released model is still unaccounted for.
        self._assert_invalid_at(str(released["id"]), str(model["id"]))

    def test_quarantine_events_are_migrated(self) -> None:
        with self.service.connection() as conn:
            step = conn.execute("SELECT name FROM catalog_schema_versions WHERE version = 11").fetchone()
            conn.rollback()
        self.assertEqual(step["name"], "asset_file_purge_events")

    def test_purge_ledger_is_migrated_and_append_only(self) -> None:
        _released, _old_model, scratch_id = self._purged_draft_model()
        with self.service.connection() as conn:
            step = conn.execute("SELECT name FROM catalog_schema_versions WHERE version = 9").fetchone()
            self.assertEqual(step["name"], "asset_file_purges")
            conn.rollback()
            # A rollback also drops the connection's search_path, so qualify the table.
            for statement in (
                "DELETE FROM catalog.catalog_asset_file_purges WHERE asset_id = %s",
                "UPDATE catalog.catalog_asset_file_purges SET reason = 'edited' WHERE asset_id = %s",
            ):
                with self.subTest(statement=statement.split()[0]):
                    with self.assertRaisesRegex(Exception, "immutable catalog evidence"):
                        conn.execute(statement, (scratch_id,))
                    conn.rollback()


if __name__ == "__main__":
    unittest.main()
