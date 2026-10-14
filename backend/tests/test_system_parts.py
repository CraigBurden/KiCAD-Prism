"""SB2-108 (CONTRACTS_P2 §24.1, D-P2-58): mechanical parts, catalog parts with a model, placed like a board."""

from __future__ import annotations

import uuid
from unittest import mock

from test_catalog_modules import STEP
from test_system_publish import PublishCase
from test_system_snapshots import DESIGNER

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

    def test_a_pinned_revision_without_a_glb_is_queued_for_conversion_then_drawn(self) -> None:
        part = self.add()
        pinned = str(self.catalog.get_component(self.part_id)["current_revision_id"])
        self.catalog.detach_asset(self.part_id, "3dmodel", actor="author@example.com")
        self.catalog.attach_auxiliary_asset(self.part_id, asset_type="3dmodel", upload_name=OTHER_STEP.name,
                                            payload=OTHER_STEP.read_bytes(), target_library="Test",
                                            actor="author@example.com")
        converter = f"test-{uuid.uuid4().hex}"  # a new converter: no GLB of any revision exists for it
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch("app.services.systems.service_base.latest_job", return_value={"status": "failed"}), \
                mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue:
            self.service.scene(DESIGNER, self.sid)
            enqueue.assert_not_called()  # a read never retries a failed conversion
        with mock.patch.object(catalog_models, "converter_id", return_value=converter), \
                mock.patch("app.services.systems.service_base.latest_job", return_value=None), \
                mock.patch("app.services.catalog_job_service.catalog_jobs.enqueue") as enqueue:
            scene = self.service.scene(DESIGNER, self.sid)
            [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
            self.assertIsNone(occurrence.get("model"))
            enqueue.assert_called_with("catalog_model_glb", {"componentId": self.part_id, "revisionId": pinned},
                                       created_by="system-builder",
                                       idempotency_key=f"catalog_model_glb:{self.part_id}@{pinned}")
            with mock.patch.object(catalog_worker_tasks, "catalog_service", self.catalog):
                catalog_worker_tasks.run_model_glb(mock.Mock(payload=enqueue.call_args.args[1]))
            scene = self.service.scene(DESIGNER, self.sid)
        [occurrence] = [o for o in scene["occurrences"] if o["instanceId"] == part["id"]]
        self.assertEqual(occurrence["model"]["glbKey"], catalog_models.glb_key(self.model["stepSha256"], converter))

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
