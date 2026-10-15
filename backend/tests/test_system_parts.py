"""SB2-108 (CONTRACTS_P2 §24.1, D-P2-58): mechanical parts, catalog parts with a model, placed like a board."""

from __future__ import annotations

import asyncio
import unittest
import uuid
from pathlib import Path
from typing import Optional
from unittest import mock
from unittest.mock import patch

from fastapi import HTTPException

from test_catalog_modules import STEP
from test_system_publish import PublishCase
from test_system_snapshots import DESIGNER

from app.api import catalog_system_items as catalog_system_items_api, systems as systems_api
from app.core.security import AuthenticatedUser
from app.services import catalog_worker_tasks
from app.services.catalog import models as catalog_models
from app.services.systems import manifest as manifest_io
from app.services.systems.manifest_schema import full_view
from app.services.systems.store import Invalid

OTHER_STEP = STEP.parent / "CYPD3177-24LQXQT.stp"


class PartCase(PublishCase):
    def setUp(self) -> None:
        super().setUp()
        self.made: list[str] = []
        created = self.catalog.create_manual_component(
            value="ENCLOSURE", description="Made-up enclosure", datasheet="https://example.com/e.pdf",
            manufacturer="Test", manufacturer_part_number=f"ENC-{uuid.uuid4().hex[:8]}", actor="author@example.com")
        self.part_id = str(created["id"])
        self.made.append(self.part_id)
        self.catalog.attach_auxiliary_asset(self.part_id, asset_type="3dmodel", upload_name=STEP.name,
                                            payload=STEP.read_bytes(), target_library="Test", actor="author@example.com")
        [self.model] = self.catalog.system_items.convert_models(self.part_id)

    def tearDown(self) -> None:
        for component_id in self.made:
            self.catalog.deactivate_component(component_id, actor="t@local", reason="SB2-108 test cleanup")
        super().tearDown()

    def add(self, label: str = "Enclosure") -> dict:
        revision = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        return self.service.add_catalog_instance(DESIGNER, self.sid, self.version(), kind="part", label=label,
                                                 component_id=self.part_id, revision_id=revision, follow="pinned").body


class PartTest(PartCase):
    def test_a_part_is_an_instance_with_no_ports(self) -> None:
        part = self.add()
        doc = self.service.document(DESIGNER, self.sid).body
        [entry] = [i for i in doc["instances"] if i["id"] == part["id"]]
        self.assertEqual((entry["kind"], entry["ports"], entry["catalog"]["componentId"]), ("part", [], self.part_id))
        [event] = [e for e in self.events("instance_added") if e["payload"].get("kind") == "part"]
        self.assertEqual(event["payload"]["componentId"], self.part_id)

    def test_the_scene_draws_its_model_at_its_pose(self) -> None:
        part = self.add()
        self.service.set_pose(DESIGNER, self.sid, self.version(), part["id"],
                              {"translationMm": [10.0, 20.0, 30.0], "rotation": [0.0, 0.0, 0.0, 1.0]})
        scene = self.service.scene(DESIGNER, self.sid)
        [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
        self.assertEqual(occurrence["kind"], "part")
        self.assertEqual(occurrence["model"]["glbKey"], self.model["glb"]["key"])
        self.assertEqual(occurrence["pose"]["translationMm"], [10.0, 20.0, 30.0])
        self.assertIsNotNone(occurrence["boundsMm"])

    def test_a_pinned_part_keeps_its_revision_model_after_the_head_moves(self) -> None:
        part = self.add()
        self.catalog.detach_asset(self.part_id, "3dmodel", actor="author@example.com")
        self.catalog.attach_auxiliary_asset(self.part_id, asset_type="3dmodel", upload_name=OTHER_STEP.name,
                                            payload=OTHER_STEP.read_bytes(), target_library="Test",
                                            actor="author@example.com")
        [head] = self.catalog.system_items.convert_models(self.part_id)
        self.assertNotEqual(head["glb"]["key"], self.model["glb"]["key"])
        scene = self.service.scene(DESIGNER, self.sid)
        [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
        self.assertEqual(occurrence["model"]["glbKey"], self.model["glb"]["key"], "the pinned revision's model")

    def pin_then_move_the_head(self) -> tuple[dict, str]:
        """A part instance pinned at the current revision, then a new head with another model."""
        part = self.add()
        pinned = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        self.catalog.detach_asset(self.part_id, "3dmodel", actor="author@example.com")
        self.catalog.attach_auxiliary_asset(self.part_id, asset_type="3dmodel", upload_name=OTHER_STEP.name,
                                            payload=OTHER_STEP.read_bytes(), target_library="Test",
                                            actor="author@example.com")
        return part, pinned

    def read_and_convert(self, part: dict, converter: str, *, last_job: Optional[dict] = None) -> mock.Mock:
        """A designer's scene read under ``converter``, which must queue the pinned revision's conversion
        and draw nothing yet; the queued job is then run as the catalog worker would."""
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch("app.services.systems.service_base.latest_job", return_value=last_job), \
                mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue:
            scene = self.service.scene(DESIGNER, self.sid, may_convert_models=True)
            [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
            self.assertIsNone(occurrence.get("model"))
            enqueue.assert_called_once()
            with mock.patch.object(catalog_worker_tasks, "catalog_service", self.catalog):
                catalog_worker_tasks.run_model_glb(mock.Mock(payload=enqueue.call_args.args[1]))
        return enqueue

    def drawn_key(self, part: dict, converter: str) -> Optional[str]:
        with mock.patch.object(catalog_models, "converter_id", return_value=converter):
            scene = self.service.scene(DESIGNER, self.sid)
        [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
        return (occurrence.get("model") or {}).get("glbKey")

    def test_a_pinned_revision_without_a_glb_is_queued_for_conversion_then_drawn(self) -> None:
        part, pinned = self.pin_then_move_the_head()
        converter = f"test-{uuid.uuid4().hex}"  # a new converter: no GLB of any revision exists for it
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue:
            self.service.scene(DESIGNER, self.sid)  # a reader without catalog_write
            with mock.patch("app.services.systems.service_base.latest_job", return_value={"status": "failed"}):
                self.service.scene(DESIGNER, self.sid, may_convert_models=True)  # a read never retries a failure
            enqueue.assert_not_called()
        enqueue = self.read_and_convert(part, converter)
        enqueue.assert_called_once_with("catalog_model_glb", {"componentId": self.part_id, "revisionId": pinned},
                                        created_by=DESIGNER.email,
                                        idempotency_key=f"catalog_model_glb:{self.part_id}@{pinned}:{converter}")
        self.assertEqual(self.drawn_key(part, converter), catalog_models.glb_key(self.model["stepSha256"], converter))

    def test_a_converter_upgrade_queues_the_pinned_revision_again(self) -> None:
        part, _pinned = self.pin_then_move_the_head()
        old, new = f"test-{uuid.uuid4().hex}", f"test-{uuid.uuid4().hex}"
        first = self.read_and_convert(part, old)
        self.assertIsNone(self.drawn_key(part, new), "the old converter's GLB is not the new one's")
        second = self.read_and_convert(part, new)  # the new converter's key has no job yet
        self.assertNotEqual(second.call_args.kwargs["idempotency_key"], first.call_args.kwargs["idempotency_key"])
        self.assertEqual(self.drawn_key(part, new), catalog_models.glb_key(self.model["stepSha256"], new))

    def test_a_read_queues_a_pinned_revision_once_on_the_real_queue(self) -> None:
        """Reads while the job is queued join it; once it has completed without a GLB, reads queue nothing."""
        from app.services.job_service import jobs
        from app.services.systems.jobs import workspace_connection

        jobs.initialize()
        _part, pinned = self.pin_then_move_the_head()
        converter = f"test-{uuid.uuid4().hex}"

        def queued(key: str) -> list[str]:
            with workspace_connection() as conn:
                rows = conn.execute("SELECT id FROM ws_jobs WHERE kind = 'catalog_model_glb' AND artifact_key = %s",
                                    (key,)).fetchall()
            return [str(r["id"]) for r in rows]

        with mock.patch.object(catalog_models, "converter_id", return_value=converter):
            key = catalog_models.conversion_job_key(self.part_id, pinned)
            self.service.scene(DESIGNER, self.sid, may_convert_models=True)
            self.service.scene(DESIGNER, self.sid, may_convert_models=True)
            [job] = queued(key)
            with workspace_connection() as conn:
                conn.execute("UPDATE ws_jobs SET status = 'completed' WHERE id = %s", (job,))
                conn.commit()
            self.service.scene(DESIGNER, self.sid, may_convert_models=True)
            self.assertEqual(queued(key), [job], "a completed job that left no GLB is not queued again")

    def test_a_pinned_component_without_models_is_skipped_without_a_traceback(self) -> None:
        for refused in (LookupError("Component not found"), ValueError("only parts and modules carry models")):
            with self.subTest(refused=type(refused).__name__), mock.patch.object(self.service, "_catalog") as catalog, \
                    mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue, \
                    self.assertLogs("app.services.systems.service", level="DEBUG") as logs:
                catalog.return_value.list_models.side_effect = refused
                self.service._queue_pinned_conversions([(self.part_id, "rev")], DESIGNER)
            enqueue.assert_not_called()
            self.assertEqual([(r.levelname, r.exc_info) for r in logs.records], [("DEBUG", None)])

    def test_convert_takes_only_a_revision_of_that_component(self) -> None:
        other = self.catalog.create_manual_component(
            value="OTHER", description="Another part", datasheet="https://example.com/o.pdf", manufacturer="Test",
            manufacturer_part_number=f"OTH-{uuid.uuid4().hex[:8]}", actor="author@example.com")
        self.made.append(str(other["id"]))
        writer = AuthenticatedUser(email="w@example.com", name="w", role="designer")
        own = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        with mock.patch.object(catalog_system_items_api, "catalog_service", self.catalog), \
                mock.patch.object(catalog_system_items_api.catalog_jobs, "enqueue",
                                  return_value={"id": "j", "status": "queued"}) as enqueue:
            for revision in ("no-such-revision", str(other["current_revision_id"])):
                with self.subTest(revision=revision), self.assertRaises(HTTPException) as refused:
                    catalog_system_items_api.convert_models(self.part_id, revision_id=revision, user=writer)
                self.assertEqual(refused.exception.status_code, 404)
            enqueue.assert_not_called()
            catalog_system_items_api.convert_models(self.part_id, revision_id=own, user=writer)
        self.assertEqual(enqueue.call_args.args[1], {"componentId": self.part_id, "revisionId": own})


    def test_a_part_round_trips_through_the_manifest(self) -> None:
        part = self.add()
        refs = self.service._catalog_refs(self.store, self.sid)
        before = manifest_io.build(self.store, self.sid, created_by="t", created_at="2026-10-09T00:00:00+00:00",
                                   catalog_refs=refs)
        self.conn.commit()
        self.assertEqual([i.kind for i in before.instances if i.id == part["id"]], ["part"])
        self.store.delete_system(self.sid)
        self.conn.commit()
        manifest_io.import_manifest(self.store, before, actor="user:importer")
        self.conn.commit()
        after = manifest_io.build(self.store, self.sid, created_by="t", created_at="2026-10-09T00:00:00+00:00",
                                  catalog_refs=refs)
        self.assertEqual(full_view(after), full_view(before))

    def test_the_icd_names_the_part_and_its_diagram_leaves_it_out(self) -> None:
        self.add("Enclosure")
        html = self.service.icd(DESIGNER, self.sid, "html")[0]
        self.assertIn("Enclosure", html)
        self.assertNotIn('aria-label="Block diagram"></svg>', html)

    def test_only_a_catalog_part_is_added_as_one(self) -> None:
        revision = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        with self.assertRaisesRegex(Invalid, "is a part, not a module"):
            self.service.add_catalog_instance(DESIGNER, self.sid, self.version(), kind="module", label="X",
                                              component_id=self.part_id, revision_id=revision, follow="pinned")

    def test_a_part_is_never_a_link_end(self) -> None:
        part = self.add()
        obc = self.service.document(DESIGNER, self.sid).body["links"][0]["a"]
        with self.assertRaises(Invalid):
            self.service.create_link(DESIGNER, self.sid, self.version(),
                                     a={"instanceId": part["id"], "portKey": "anything"},
                                     b={"instanceId": obc["instanceId"], "portKey": obc["port"]["portKey"]},
                                     name="nope", harness=None)

    def test_head_jobs_under_the_legacy_key_block_nothing(self) -> None:
        """Jobs queued before conversion keys carried the converter: one completed, one still queued. The
        head's Convert queues a job of its own under the new key, it completes, and the model is drawn."""
        from app.services.catalog_job_service import catalog_jobs
        from app.services.job_service import jobs
        from app.services.systems.jobs import workspace_connection

        jobs.initialize()
        part = self.add()
        legacy = f"catalog_model_glb:{self.part_id}"
        completed = catalog_jobs.enqueue("catalog_model_glb", {"componentId": self.part_id}, idempotency_key=legacy)
        with workspace_connection() as conn:
            conn.execute("UPDATE ws_jobs SET status = 'completed' WHERE id = %s", (completed["id"],))
            conn.commit()
        queued = catalog_jobs.enqueue("catalog_model_glb", {"componentId": self.part_id}, idempotency_key=legacy)
        self.assertNotEqual(queued["id"], completed["id"])
        writer = AuthenticatedUser(email="w@example.com", name="w", role="designer")
        converter = f"test-{uuid.uuid4().hex}"
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch.object(catalog_system_items_api, "catalog_service", self.catalog):
            self.assertIsNone(self.drawn_key(part, converter))
            started = catalog_system_items_api.convert_models(self.part_id, revision_id=None, user=writer)
            self.assertNotIn(started["jobId"], (completed["id"], queued["id"]))
            job = catalog_jobs.get(started["jobId"])
            self.assertEqual(job["artifact_key"], f"{legacy}:{converter}")
            with mock.patch.object(catalog_worker_tasks, "catalog_service", self.catalog):
                catalog_worker_tasks.run_model_glb(mock.Mock(payload=job["payload"]))
        with workspace_connection() as conn:
            conn.execute("UPDATE ws_jobs SET status = 'completed' WHERE id = %s", (started["jobId"],))
            conn.commit()
        self.assertEqual(catalog_jobs.get(queued["id"])["status"], "queued", "the legacy job is left to run once")
        self.assertEqual(self.drawn_key(part, converter), catalog_models.glb_key(self.model["stepSha256"], converter))


class SceneConvertPermissionTest(unittest.TestCase):
    """Only a reader who may write the catalog (role and bearer scope) lets a scene read queue conversions."""

    def test_the_scene_route_passes_catalog_write(self) -> None:
        cases = [
            (AuthenticatedUser(email="v@example.com", name="v", role="viewer"), False),
            (AuthenticatedUser(email="q@example.com", name="q", role="qa"), False),
            (AuthenticatedUser(email="d@example.com", name="d", role="designer"), True),
            (AuthenticatedUser(email="a@example.com", name="a", role="designer", auth_type="agent",
                               scopes=["api:read"]), False),
        ]
        for user, expected in cases:
            with self.subTest(role=user.role, auth=user.auth_type), \
                    mock.patch.object(systems_api.system_service, "service") as service:
                asyncio.run(systems_api.get_scene("sys", user))
                self.assertIs(service.scene.call_args.kwargs["may_convert_models"], expected)


class PinnedHousingTest(PartCase):
    """A harness end's housing is drawn from the part revision the end pins (§17.3), like an instance (#698)."""

    def end_with_part(self) -> tuple[str, str]:
        """An unmated two-pin end whose block pins the part's current revision; returns ``(end ID, revision)``."""
        revision = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            harness = self.store.create_harness(change, name="W1")
            self.store.add_harness_end(change, harness["id"], pin_count=2)
            harness = self.store.add_harness_end(change, harness["id"], pin_count=2,
                                                 catalog_component_id=self.part_id, catalog_revision_id=revision)
        self.conn.commit()
        [end] = [e for e in harness["ends"] if e["catalog_component_id"]]
        return end["id"], revision

    def move_the_head(self) -> dict:
        self.catalog.detach_asset(self.part_id, "3dmodel", actor="author@example.com")
        self.catalog.attach_auxiliary_asset(self.part_id, asset_type="3dmodel", upload_name=OTHER_STEP.name,
                                            payload=OTHER_STEP.read_bytes(), target_library="Test",
                                            actor="author@example.com")
        [head] = self.catalog.system_items.convert_models(self.part_id)
        return head

    def housing(self, end_id: str, **kwargs) -> Optional[dict]:
        scene = self.service.scene(DESIGNER, self.sid, **kwargs)
        [end] = [e for h in scene["harnesses"] for e in h["ends"] if e["id"] == end_id]
        return end["housing"]

    def test_the_housing_keeps_its_revision_model_after_the_head_moves(self) -> None:
        end_id, revision = self.end_with_part()
        head = self.move_the_head()
        self.assertNotEqual(head["glb"]["key"], self.model["glb"]["key"])
        scene = self.service.scene(DESIGNER, self.sid)
        [end] = [e for h in scene["harnesses"] for e in h["ends"] if e["id"] == end_id]
        self.assertEqual((end["partRevisionId"], end["housing"]["glbKey"]), (revision, self.model["glb"]["key"]))

    def test_a_pinned_housing_without_a_glb_is_queued_then_drawn(self) -> None:
        end_id, revision = self.end_with_part()
        self.move_the_head()
        converter = f"test-{uuid.uuid4().hex}"
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch("app.services.systems.service_base.latest_job", return_value=None), \
                mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue:
            self.assertIsNone(self.housing(end_id))
            enqueue.assert_not_called()
            self.assertIsNone(self.housing(end_id, may_convert_models=True))
            self.assertEqual(self.service.scene(DESIGNER, self.sid, may_convert_models=True)["modelsConverting"], 1,
                             "the writer's scene polls until the conversion settles")
            enqueue.assert_called_with("catalog_model_glb", {"componentId": self.part_id, "revisionId": revision},
                                            created_by=DESIGNER.email,
                                            idempotency_key=f"catalog_model_glb:{self.part_id}@{revision}:{converter}")
            with mock.patch.object(catalog_worker_tasks, "catalog_service", self.catalog):
                catalog_worker_tasks.run_model_glb(mock.Mock(payload=enqueue.call_args.args[1]))
            self.assertEqual(self.housing(end_id)["glbKey"], catalog_models.glb_key(self.model["stepSha256"], converter))
            self.assertEqual(self.service.scene(DESIGNER, self.sid, may_convert_models=True)["modelsConverting"], 0)

    def test_the_models_route_lists_a_pinned_revision(self) -> None:
        _end_id, revision = self.end_with_part()
        self.move_the_head()
        reader = AuthenticatedUser(email="r@example.com", name="r", role="viewer")
        with mock.patch.object(catalog_system_items_api, "catalog_service", self.catalog):
            [pinned] = catalog_system_items_api.list_models(self.part_id, revision_id=revision, user=reader)["items"]
            [head] = catalog_system_items_api.list_models(self.part_id, revision_id=None, user=reader)["items"]
            with self.assertRaises(HTTPException) as refused:
                catalog_system_items_api.list_models(self.part_id, revision_id="no-such-revision", user=reader)
        self.assertEqual(pinned["glb"]["key"], self.model["glb"]["key"])
        self.assertNotEqual(head["glb"]["key"], pinned["glb"]["key"])
        self.assertEqual(refused.exception.status_code, 404)


class PinnedDraftStepTest(PartCase):
    """Artifact maintenance keeps the STEP of a draft revision a system pins (#684 review)."""

    def attach_model(self) -> tuple[str, Path]:
        """A STEP with bytes no other test links, so no other component protects its asset."""
        before = self.model_ids()
        self.catalog.attach_auxiliary_asset(
            self.part_id, asset_type="3dmodel", upload_name=f"Pinned-{uuid.uuid4().hex[:8]}.step",
            payload=f"ISO-10303-21;/* {uuid.uuid4().hex} */END-ISO-10303-21;".encode(),
            target_library="Test", actor="author@example.com")
        [asset_id] = self.model_ids() - before
        with self.catalog.connection() as conn:
            row = conn.execute("SELECT canonical_path FROM assets WHERE id = %s", (asset_id,)).fetchone()
        return asset_id, Path(str(row["canonical_path"]))

    def model_ids(self) -> set[str]:
        return {str(a["id"]) for a in self.catalog.get_component(self.part_id)["assets"] if a["asset_type"] == "3dmodel"}

    def supersede(self, asset_id: str) -> None:
        """A newer draft replaces the STEP; the pinned revision keeps the old one."""
        self.attach_model()
        head = self.catalog.get_component(self.part_id)
        self.catalog.detach_asset_by_id(self.part_id, asset_id, expected_revision_id=head["revision_id"],
                                        actor="author@example.com")
        self.assertNotIn(asset_id, self.model_ids())

    def purge(self) -> dict:
        from app.services import catalog_worker_tasks

        with patch("app.services.systems.jobs.workspace_connection", self.connect):
            pins = catalog_worker_tasks.system_pinned_catalog_revisions()
        with patch.object(catalog_worker_tasks, "catalog_service", self.catalog):
            return catalog_worker_tasks.purge_superseded_step_files(pinned_revision_ids=pins)

    def test_a_part_instance_pin_keeps_its_draft_step(self) -> None:
        old_id, old_step = self.attach_model()
        pinned = self.add()
        self.supersede(old_id)

        self.purge()

        self.assertTrue(old_step.is_file(), "the STEP of a revision a part instance pins was purged")
        self.service.remove_instance(DESIGNER, self.sid, self.version(), pinned["id"], cascade=False)
        self.purge()
        self.assertFalse(old_step.exists(), "an unpinned superseded draft STEP is purged")

    def test_harness_end_connector_and_contact_pins_are_read(self) -> None:
        old_id, old_step = self.attach_model()
        revision = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            harness = self.store.create_harness(change, name="W1")
            self.store.add_harness_end(change, harness["id"], pin_count=2, catalog_component_id=self.part_id,
                                       catalog_revision_id=revision)
            self.store.add_harness_end(change, harness["id"], pin_count=2, contact_component_id=self.part_id,
                                       contact_revision_id=f"{revision}-contact")
        self.conn.commit()
        self.assertEqual(self.store.pinned_catalog_revisions(), sorted([revision, f"{revision}-contact"]))
        self.supersede(old_id)

        self.purge()

        self.assertTrue(old_step.is_file(), "the STEP of a revision a harness end pins was purged")
