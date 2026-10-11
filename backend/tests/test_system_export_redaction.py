"""Follow-up review findings 1 and 2: a hidden board behind an export hides its nets everywhere (P2 §5.4).

D2 (#494) redacted parent link rows and the assembly interface. Re-export
interfaces (live and frozen), source-change reviews and their audit events
still returned the hidden board's nets.

Bus = CNDH-A (the fixture system as an assembly; its export PWR_IN is OBC-A J6)
+ PDU, linked PDU J1 ↔ CNDH-A PWR_IN.
"""

from __future__ import annotations

import json
import unittest

from test_system_child_drift import ChildDriftCase
from test_system_publish import ADMIN
from test_system_snapshots import DESIGNER, VIEWER
from support.postgres import seed_folder


class HiddenExportSourceCase(ChildDriftCase):
    def hide_obc(self) -> None:
        """Move the project behind the export (the OBC boards inside the child) to a folder only admins see."""
        project = next(i["projectId"] for i in self.service.document(DESIGNER, self.sid).body["instances"]
                       if i["label"] == "OBC-A")
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = %s", (project,))
        self.conn.commit()


class ReExportInterfaceTest(HiddenExportSourceCase):
    def reexport(self, caller, snapshot_id=None) -> dict:
        body = self.service.export_interface(caller, self.bus, snapshot_id)
        [entry] = [e for e in body["exports"] if e["name"] == "BUS_PWR"]
        return entry

    def test_a_reexport_of_a_hidden_board_hides_its_nets_live_and_frozen(self) -> None:
        # An export that is a link end cannot be re-exported; this test needs the bus link gone.
        self.service.delete_link(DESIGNER, self.bus, self.bus_doc()["system"]["version"], self.link_id)
        self.service.create_export(DESIGNER, self.bus, self.bus_doc()["system"]["version"], name="BUS_PWR",
                                   description="", instance_id=self.cndh, port_key=None,
                                   child_export_id=self.export_id)
        seen = self.reexport(VIEWER)
        self.assertTrue(any(pin["nets"] for pin in seen["pins"]), "visible before the board is hidden")
        snapshot = self.service.create_snapshot(DESIGNER, self.bus, self.bus_doc()["system"]["version"],
                                                "S1", "").body
        self.hide_obc()

        for snapshot_id in (None, snapshot["id"]):
            with self.subTest(frozen=bool(snapshot_id)):
                entry = self.reexport(VIEWER, snapshot_id)
                self.assertTrue(entry["redacted"])
                self.assertIsNone(entry["reference"])
                self.assertEqual([p["pad"] for p in entry["pins"]], [p["pad"] for p in seen["pins"]])
                self.assertTrue(all(p["nets"] is None and p["pinNames"] is None for p in entry["pins"]))
                full = self.reexport(ADMIN, snapshot_id)
                self.assertTrue(any(pin["nets"] for pin in full["pins"]), "a reader who may see OBC keeps them")


class ChildReviewRedactionTest(HiddenExportSourceCase):
    def open_review(self) -> dict:
        # Move PWR_IN to OBC-B J5: same export ID, different pins' nets (pin 3 /PWR_GOOD → /AUX_A).
        self.service.update_export(DESIGNER, self.sid, self.version(), self.child_export()["id"],
                                   {"instanceId": self.instances["OBC-B"], "portKey": self.port_key("OBC-B", "J5")})
        v2 = self.publish_next("V2")
        self.assertEqual(self.advance(v2["revisionId"])["outcome"], "review_opened")
        [review] = [r for r in self.service.list_reviews(ADMIN, self.bus, "open") if r["kind"] == "child_update"]
        return review

    def test_a_child_update_review_hides_the_nets_of_a_hidden_source(self) -> None:
        full = self.open_review()
        self.assertTrue(any(item["expected"] or item["observed"] for item in full["items"]))
        self.hide_obc()

        [review] = [r for r in self.service.list_reviews(VIEWER, self.bus, "open") if r["id"] == full["id"]]
        self.assertFalse(review["redacted"], "the assembly stays visible, so does its review")
        self.assertIsNone(review["pendingChanges"])
        for item in review["items"]:
            self.assertTrue(item["redacted"])
            self.assertEqual((item["expected"], item["observed"], item["candidates"], item["pins"]),
                             (None, None, None, []))
        text = json.dumps(review)
        for net in ("/PWR_GOOD", "/AUX_A"):
            self.assertNotIn(net, text)

        [admin] = [r for r in self.service.list_reviews(ADMIN, self.bus, "open") if r["id"] == full["id"]]
        self.assertTrue(any(item["expected"] or item["observed"] for item in admin["items"]))
        self.assertFalse(any(item["redacted"] for item in admin["items"]))

    def test_audit_events_naming_a_hidden_export_end_are_withheld(self) -> None:
        # Decisions name the review and its assembly; row edits name only the link.
        review = self.open_review()
        for item in review["items"]:
            self.service.decide(DESIGNER, self.bus, self.bus_doc()["system"]["version"], review["id"], item["id"],
                                "accept", None)
        self.hide_obc()
        events = self.service.history(VIEWER, self.bus, cursor=None, limit=200)["events"]
        text = json.dumps([e["payload"] for e in events])
        for net in ("/PWR_GOOD", "/AUX_A"):
            self.assertNotIn(net, text)
        self.assertTrue(any(e["redacted"] for e in events))


if __name__ == "__main__":
    unittest.main()
