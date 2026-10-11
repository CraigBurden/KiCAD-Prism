"""SB2-04: publish a system snapshot as a catalog ``assembly`` revision (CONTRACTS_P2 §3.3)."""

from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_exports import ExportCase
from test_system_snapshots import DESIGNER, VIEWER

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import service as service_module
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Conflict, Forbidden, Invalid

QA = Caller(role="qa", email="qa@example.com")
ADMIN = Caller(role="admin", email="admin@example.com")


class PublishCase(ExportCase):
    """A fixture system plus a real catalog service; no tests of its own."""

    def setUp(self) -> None:
        super().setUp()
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

        from support.postgres import CATALOG_URL

        self.tempdir = tempfile.TemporaryDirectory()
        self.catalog = ComponentCatalogPostgresService(store_root=Path(self.tempdir.name) / "c",
                                                       database_url=CATALOG_URL)
        self.catalog.initialize()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"},
                                     catalog=lambda: self.catalog.system_items)
        self.ipn = f"IPN-{uuid.uuid4().hex[:8]}"

    def tearDown(self) -> None:
        component_id = self.store.get_system(self.sid).get("catalog_component_id") if self.sid else None
        for cid in {component_id, self.catalog.system_items.find_system_component(self.sid)} - {None}:
            self.catalog.deactivate_component(cid, actor="t@local", reason="SB2-04 test cleanup")
        self.catalog.close()
        self.tempdir.cleanup()
        super().tearDown()

    def publish(self, snapshot_id: str, caller: Caller = DESIGNER, **fields):
        return self.service.publish_snapshot(caller, self.sid, snapshot_id, ipn=fields.get("ipn"),
                                             name=fields.get("name"), description=fields.get("description"),
                                             manufacturer=fields.get("manufacturer"))



class PublishTest(PublishCase):
    def test_first_publish_creates_the_assembly_and_binds_the_system(self) -> None:
        bare = self.snapshot("EMPTY")
        with self.assertRaisesRegex(Invalid, "at least one export"):
            self.publish(bare["id"], ipn=self.ipn)
        self.export("PWR_IN", "OBC-A", "J6")
        cdr = self.snapshot("CDR")
        with self.assertRaisesRegex(Invalid, "needs an IPN"):
            self.publish(cdr["id"])
        created, publication = self.publish(cdr["id"], ipn=self.ipn, name="CNDH Stack")
        self.assertTrue(created)
        self.assertEqual((publication["version"], publication["releaseStatus"]), (1, "open"))
        component = self.catalog.get_component(publication["componentId"])
        self.assertEqual((component["kind"], component["name"], component["value"]), ("assembly", "CNDH Stack", self.ipn))
        self.assertEqual([e["name"] for e in component["interface"]["exports"]], ["PWR_IN"])
        self.assertEqual(component["source_ref"]["snapshotId"], cdr["id"])
        self.assertEqual(component["source_ref"]["connectivityDigest"], cdr["connectivityDigest"])
        self.assertEqual(self.store.get_system(self.sid)["catalog_component_id"], publication["componentId"])
        self.assertEqual(len(self.events("snapshot_published")), 1)
        listed = {s["id"]: s["publication"] for s in self.service.list_snapshots(VIEWER, self.sid)}
        self.assertEqual(listed[cdr["id"]]["revisionId"], publication["revisionId"])
        self.assertIsNone(listed[bare["id"]])

    def test_publishing_is_idempotent_and_later_snapshots_add_revisions(self) -> None:
        self.export()
        cdr = self.snapshot("CDR")
        _, first = self.publish(cdr["id"], ipn=self.ipn)
        again_created, again = self.publish(cdr["id"])
        self.assertFalse(again_created)
        self.assertEqual(again["revisionId"], first["revisionId"])
        self.service.update_export(DESIGNER, self.sid, self.version(), self.document()["exports"][0]["id"],
                                   {"description": "changed"})
        qual = self.snapshot("QUAL")
        created, second = self.publish(qual["id"])
        self.assertTrue(created)
        self.assertEqual((second["componentId"], second["version"]), (first["componentId"], 2))
        self.assertEqual(len(self.events("snapshot_published")), 2)

    def test_who_may_publish(self) -> None:
        self.export()
        cdr = self.snapshot("CDR")
        with self.assertRaises(Forbidden):
            self.publish(cdr["id"], caller=QA, ipn=self.ipn)
        self.hide_pay()
        with self.assertRaisesRegex(Forbidden, "boards you cannot see"):
            self.publish(cdr["id"], caller=DESIGNER, ipn=self.ipn)
        created, _ = self.publish(cdr["id"], caller=ADMIN, ipn=self.ipn)
        self.assertTrue(created)

    def test_an_unbound_first_publish_is_recovered_not_duplicated(self) -> None:
        self.export()
        cdr = self.snapshot("CDR")
        # A publish that died after writing the catalog but before binding the system.
        orphan = self.catalog.system_items.create_system_item(
            kind="assembly", ipn=self.ipn, name="CNDH", description="d", manufacturer="In-house",
            datasheet_url=f"/systems/{self.sid}", interface={"exports": [{"id": "x"}]},
            source_ref={"kind": "system_snapshot", "systemId": self.sid, "snapshotId": cdr["id"]},
        )
        created, publication = self.publish(cdr["id"])
        self.assertFalse(created)
        self.assertEqual((publication["componentId"], publication["revisionId"]),
                         (orphan["componentId"], orphan["revisionId"]))
        self.assertEqual(self.store.get_system(self.sid)["catalog_component_id"], orphan["componentId"])

    def test_unresolved_exports_and_legacy_snapshots_are_refused(self) -> None:
        created = self.export()
        self.service.set_override(DESIGNER, self.sid, self.version(), self.instances["OBC-A"],
                                  created["portKey"], "hidden")
        broken = self.snapshot("BROKEN")
        with self.assertRaisesRegex(Invalid, "do not resolve"):
            self.publish(broken["id"], ipn=self.ipn)
        with self.store.mutation(self.sid, expected_version=None, actor="user:t", bump=False) as change:
            legacy = self.store.create_snapshot(change, name="old", note="", document={"system": {}, "instances": []},
                                                digest="sha256:l", open_review_count=0, renderer_version="1")
        self.conn.commit()
        with self.assertRaisesRegex(Invalid, "predates manifests"):
            self.publish(legacy["id"], ipn=self.ipn)

    def test_a_published_snapshot_releases_through_the_catalog_workflow(self) -> None:
        self.export()
        _, publication = self.publish(self.snapshot("CDR")["id"], ipn=self.ipn)
        for stage, actor, role in (("in_progress", "designer@example.com", "designer"),
                                   ("qa_review", "designer@example.com", "designer"),
                                   ("done", "qa@example.com", "qa"), ("released", "qa@example.com", "admin")):
            self.catalog.set_release_status(publication["componentId"], stage, actor=actor, actor_role=role)
        [listed] = [s["publication"] for s in self.service.list_snapshots(DESIGNER, self.sid) if s["publication"]]
        self.assertEqual(listed["releaseStatus"], "released")

    def test_http_status_is_201_then_200(self) -> None:
        self.export()
        cdr = self.snapshot("CDR")
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        with mock.patch.object(service_module, "service", self.service):
            first = _request(app, "POST", f"/api/systems/{self.sid}/snapshots/{cdr['id']}/publish",
                             body={"ipn": self.ipn})
            again = _request(app, "POST", f"/api/systems/{self.sid}/snapshots/{cdr['id']}/publish", body={})
            viewer = _request(app, "POST", f"/api/systems/{self.sid}/snapshots/{cdr['id']}/publish", body={},
                              user="viewer")
        self.assertEqual((first.status, again.status, viewer.status), (201, 200, 403), first.text)
        self.assertEqual(first.json["revisionId"], again.json["revisionId"])


if __name__ == "__main__":
    unittest.main()
