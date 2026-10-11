"""SB2-05: assembly instances and the system-of-systems hierarchy (CONTRACTS_P2 §5)."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_publish import ADMIN, PublishCase
from test_system_snapshots import DESIGNER, VIEWER

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import manifest as manifest_io
from app.services.systems import service as service_module
from app.services.systems.manifest_schema import digests
from app.services.systems.store import Conflict, Invalid


class AssemblyCase(PublishCase):
    """The fixture system (OBC-A, OBC-B, PAY, PWR) is published as the child assembly "CNDH". No tests."""

    def release(self, component_id: str) -> None:
        for stage, actor, role in (("in_progress", "designer@example.com", "designer"),
                                   ("qa_review", "designer@example.com", "designer"),
                                   ("done", "qa@example.com", "qa"), ("released", "qa@example.com", "admin")):
            self.catalog.set_release_status(component_id, stage, actor=actor, actor_role=role)

    def child(self, *, release: bool = True) -> dict:
        self.export("PWR_IN", "OBC-A", "J6")
        _, publication = self.publish(self.snapshot("CDR")["id"], ipn=self.ipn, name="CNDH")
        if release:
            self.release(publication["componentId"])
        return publication

    def parent(self, name: str = "Bus") -> tuple[str, int]:
        body = self.service.create_system(DESIGNER, name=name, description="", folder_id=None).body
        return body["id"], body["version"]

    def add(self, system_id: str, version: int, label: str, component_id: str, **kw):
        return self.service.add_catalog_instance(DESIGNER, system_id, version, kind="assembly", label=label,
                                                 component_id=component_id, revision_id=kw.get("revision_id"),
                                                 follow=kw.get("follow", "latest_released"))

    def tearDown(self) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM system_projects WHERE name IN ('Bus', 'Loop')")
            conn.commit()
        super().tearDown()



class AssemblyTest(AssemblyCase):
    def test_a_parent_holds_two_copies_of_a_released_assembly(self) -> None:
        publication = self.child()
        bus, version = self.parent()
        a = self.add(bus, version, "CNDH-A", publication["componentId"])
        b = self.add(bus, a.version, "CNDH-B", publication["componentId"], follow="pinned")
        self.assertEqual((a.body["kind"], a.body["catalogRevisionId"], a.body["follow"]),
                         ("assembly", publication["revisionId"], "latest_released"))
        tree = self.service.hierarchy(VIEWER, bus)
        boards = sorted(o["displayPath"] for o in tree["occurrences"] if o["kind"] == "board")
        self.assertEqual(boards, sorted(f"{copy} ▸ {label}" for copy in ("CNDH-A", "CNDH-B")
                                        for label in ("OBC-A", "OBC-B", "PAY", "PWR")))
        self.assertEqual(tree["boardCount"], 8)
        paths = {o["path"] for o in tree["occurrences"] if o["kind"] == "board"}
        self.assertEqual(len(paths), 8, "each copy's boards have distinct occurrence paths")

        document = self.service.document(VIEWER, bus).body
        [doc_a] = [i for i in document["instances"] if i["id"] == a.body["id"]]
        self.assertEqual((doc_a["kind"], doc_a["projectName"], doc_a["catalog"]["version"], doc_a["catalog"]["releaseStatus"]),
                         ("assembly", "CNDH", 1, "released"))
        self.assertEqual([(p["reference"], p["pinCount"]) for p in doc_a["ports"]], [("PWR_IN", 4)])
        self.assertTrue(any(i["id"] == b.body["id"] and i["pinned"] for i in document["instances"]))

    def test_follow_latest_released_needs_a_released_revision(self) -> None:
        publication = self.child(release=False)
        bus, version = self.parent()
        with self.assertRaisesRegex(Conflict, "no_released_revision"):
            self.add(bus, version, "CNDH-A", publication["componentId"])
        pinned = self.add(bus, version, "CNDH-A", publication["componentId"], revision_id=publication["revisionId"],
                          follow="pinned")
        self.assertEqual(pinned.body["catalogRevisionId"], publication["revisionId"])

    def test_a_system_cannot_contain_itself(self) -> None:
        publication = self.child()
        with self.assertRaisesRegex(Invalid, "hierarchy_cycle"):
            self.add(self.sid, self.version(), "SELF", publication["componentId"])
        self.assertEqual([i["kind"] for i in self.store.list_instances(self.sid, kinds=("assembly",))], [],
                         "a refused add leaves nothing behind")

    def test_hidden_boards_and_hidden_child_systems_are_redacted_at_depth(self) -> None:
        publication = self.child()
        bus, version = self.parent()
        self.add(bus, version, "CNDH-A", publication["componentId"])
        self.hide_pay()
        tree = self.service.hierarchy(VIEWER, bus)
        [pay] = [o for o in tree["occurrences"] if o["displayPath"] == "CNDH-A ▸ PAY"]
        self.assertEqual((pay["restricted"], pay["projectId"], pay["baselineCommit"]), (True, None, None))
        [obc] = [o for o in tree["occurrences"] if o["displayPath"] == "CNDH-A ▸ OBC-A"]
        self.assertFalse(obc["restricted"])

        # Hide the child system itself: its internals disappear for the reader.
        self.conn.execute("UPDATE system_projects SET folder_id = 'fld_admins' WHERE id = %s", (self.sid,))
        self.conn.commit()
        tree = self.service.hierarchy(VIEWER, bus)
        self.assertEqual([(o["displayPath"], o["restricted"]) for o in tree["occurrences"]], [("CNDH-A", True)])
        self.assertEqual(len(self.service.hierarchy(ADMIN, bus)["occurrences"]), 5)

    def test_relabel_follow_and_remove(self) -> None:
        publication = self.child()
        bus, version = self.parent()
        added = self.add(bus, version, "CNDH-A", publication["componentId"])
        iid = added.body["id"]
        updated = self.service.update_instance(DESIGNER, bus, added.version, iid, {"label": "CNDH-P", "follow": "pinned"})
        self.assertEqual((updated.body["label"], updated.body["follow"]), ("CNDH-P", "pinned"))
        with self.assertRaisesRegex(Invalid, "follow catalog revisions"):
            self.service.update_instance(DESIGNER, bus, updated.version, iid, {"trackedRef": "main"})
        self.service.remove_instance(DESIGNER, bus, updated.version, iid, cascade=False)
        self.assertEqual(self.service.hierarchy(DESIGNER, bus)["occurrences"], [])

    def test_manifest_round_trip_and_parent_publish_facts(self) -> None:
        publication = self.child()
        bus, version = self.parent()
        self.add(bus, version, "CNDH-A", publication["componentId"])
        with self.connect() as conn:
            from app.services.systems.store import SystemStore

            store = SystemStore(conn)
            refs = self.service._catalog_refs(store, bus)
            before = manifest_io.build(store, bus, created_by="t", created_at="2026-09-30T00:00:00Z", catalog_refs=refs)
            [instance] = before.instances
            self.assertEqual((instance.kind, instance.catalog.revisionVersion, instance.catalog.identity),
                             ("assembly", 1, self.ipn))
            store.delete_system(bus)
            manifest_io.import_manifest(store, before, actor="user:t")
            after = manifest_io.build(store, bus, created_by="t", created_at="2026-09-30T00:00:00Z", catalog_refs=refs)
            conn.commit()
        self.assertEqual(digests(after), digests(before))

        # The parent can export nothing yet (re-exports arrive in SB2-06), so read its facts directly.
        snapshot = self.service.create_snapshot(DESIGNER, bus, self.service.document(DESIGNER, bus).body["system"]["version"],
                                                "BUS-1", "").body
        with self.connect() as conn:
            from app.services.systems.store import SystemStore

            row = SystemStore(conn).get_snapshot(bus, snapshot["id"])
        facts = self.service._hierarchy_facts(bus, row["manifest"])
        self.assertEqual(facts, {"hierarchyValid": True,
                                 "children": [{"componentId": publication["componentId"],
                                               "revisionId": publication["revisionId"]}]})

    def test_api(self) -> None:
        publication = self.child()
        bus, version = self.parent()
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        etag = f'"sys:{bus}:{version}"'
        with mock.patch.object(service_module, "service", self.service):
            wrong = _request(app, "POST", f"/api/systems/{bus}/instances", headers={"If-Match": etag},
                             body={"kind": "assembly", "label": "X", "projectId": "prj_obc"})
            added = _request(app, "POST", f"/api/systems/{bus}/instances", headers={"If-Match": etag},
                             body={"kind": "assembly", "label": "CNDH-A", "componentId": publication["componentId"]})
            tree = _request(app, "GET", f"/api/systems/{bus}/hierarchy", user="viewer")
        self.assertEqual(wrong.status, 422)
        self.assertEqual(added.status, 201, added.text)
        self.assertEqual(tree.json["boardCount"], 4)


if __name__ == "__main__":
    unittest.main()
