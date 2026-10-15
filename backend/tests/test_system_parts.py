"""SB2-108 (CONTRACTS_P2 §24.1, D-P2-58): mechanical parts, catalog parts with a model, placed like a board."""

from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import patch

from test_catalog_modules import STEP
from test_system_publish import PublishCase
from test_system_snapshots import DESIGNER

from app.services.systems import manifest as manifest_io
from app.services.systems.manifest_schema import full_view
from app.services.systems.store import Invalid


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
        return self.catalog.purge_superseded_step_files(pinned_revision_ids=pins)

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
