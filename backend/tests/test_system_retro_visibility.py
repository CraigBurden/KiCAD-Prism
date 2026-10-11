"""Retrospective D1/D2 (RETRO-M0-M3): parent snapshots with assemblies, and redaction through exports.

Bus = CNDH-A (the fixture system published as an assembly; its export PWR_IN is OBC-A J6) plus PDU,
linked PDU J1 ↔ CNDH-A PWR_IN.
"""

from __future__ import annotations

import unittest

from test_system_assemblies import AssemblyCase
from test_system_publish import ADMIN
from test_system_snapshots import DESIGNER, VIEWER

from app.services.systems.store import Conflict, NotFound
from support.postgres import seed_folder


class ParentWithAssemblyCase(AssemblyCase):
    def setUp(self) -> None:
        super().setUp()
        publication = self.child()
        self.bus, version = self.parent()
        added = self.add(self.bus, version, "CNDH-A", publication["componentId"])
        self.assembly_id = added.body["id"]
        pdu = self.service.add_instance(DESIGNER, self.bus, added.version, project_id="prj_pwr", label="PDU",
                                        baseline_commit=self.commits["mini_power"]["F0"], tracked_ref=None, pinned=False)
        doc = self.service.document(DESIGNER, self.bus).body
        self.export_id = next(i for i in doc["instances"] if i["id"] == self.assembly_id)["ports"][0]["portKey"]
        j1 = next(p["portKey"] for i in doc["instances"] if i["id"] == pdu.body["id"] for p in i["ports"] if p["reference"] == "J1")
        self.link = self.service.create_link(DESIGNER, self.bus, doc["system"]["version"],
                                             a={"instanceId": pdu.body["id"], "portKey": j1},
                                             b={"instanceId": self.assembly_id, "portKey": self.export_id},
                                             name="Bus power", harness=None).body
        self.service.replace_rows(DESIGNER, self.bus, self.version_of(self.bus), self.link["id"],
                                  [{"pinA": "1", "pinB": "1", "signal": "VIN"}])

    def version_of(self, system_id: str) -> int:
        return self.service.document(DESIGNER, system_id).body["system"]["version"]

    def hide_obc_a(self) -> None:
        """Move the project behind the export (OBC-A, inside the child) to a folder only admins see."""
        project = next(i["projectId"] for i in self.service.document(DESIGNER, self.sid).body["instances"]
                       if i["label"] == "OBC-A")
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = %s", (project,))
        self.conn.commit()

    def bus_row(self, document: dict) -> dict:
        [link] = [link for link in document["links"] if link["id"] == self.link["id"]]
        [row] = link["rows"]
        return row


class ParentSnapshotTest(ParentWithAssemblyCase):
    def test_a_parent_snapshot_with_an_assembly_reads_and_renders(self) -> None:
        snapshot = self.service.create_snapshot(DESIGNER, self.bus, self.version_of(self.bus), "P1", "").body
        for caller in (DESIGNER, VIEWER):
            read = self.service.get_snapshot(caller, self.bus, snapshot["id"])
            self.assertTrue(any(i.get("kind") == "assembly" for i in read["document"]["instances"]))
            self.service.snapshot_manifest(caller, self.bus, snapshot["id"])
            content, _name, _version = self.service.icd(caller, self.bus, "csv", snapshot["id"])
            self.assertIn("Bus power", content)


class ExportRedactionTest(ParentWithAssemblyCase):
    def test_a_hidden_board_behind_an_export_hides_its_nets_in_the_parent(self) -> None:
        seen = self.bus_row(self.service.document(VIEWER, self.bus).body)
        self.assertTrue(seen["netB"], "visible before the board is hidden")
        self.hide_obc_a()

        admin = self.bus_row(self.service.document(ADMIN, self.bus).body)
        self.assertTrue(admin["netB"], "a reader who may see OBC-A keeps its nets")
        document = self.service.document(VIEWER, self.bus).body
        row = self.bus_row(document)
        self.assertIsNone(row["netB"])
        self.assertIsNone(row["observedB"])
        self.assertEqual(row["redactedEnds"], ["b"])
        self.assertTrue(row["netA"], "the parent's own board keeps its nets")
        # The assembly itself stays: its label, its export and the pin numbers.
        [assembly] = [i for i in document["instances"] if i["id"] == self.assembly_id]
        self.assertFalse(assembly["restricted"])
        self.assertEqual([p["reference"] for p in assembly["ports"]], ["PWR_IN"])
        self.assertEqual(row["pinB"], "1")

        # The assembly's interface keeps the export's pads but not their nets.
        _state, interface = self.service.interface(VIEWER, self.bus, self.assembly_id, None)
        [export] = [c for c in interface["components"] if c["portKey"] == self.export_id]
        self.assertTrue(export["redacted"])
        self.assertTrue(export["pins"])
        self.assertTrue(all(pin["nets"] is None for pin in export["pins"]))
        _state, full = self.service.interface(ADMIN, self.bus, self.assembly_id, None)
        self.assertTrue(any(pin["nets"] for c in full["components"] for pin in c["pins"]))

        # A snapshot taken now redacts the same way when a viewer reads it.
        snapshot = self.service.create_snapshot(DESIGNER, self.bus, self.version_of(self.bus), "P2", "").body
        frozen = self.bus_row(self.service.get_snapshot(VIEWER, self.bus, snapshot["id"])["document"])
        self.assertIsNone(frozen["netB"])
        self.assertTrue(self.bus_row(self.service.get_snapshot(ADMIN, self.bus, snapshot["id"])["document"])["netB"])

        # The ICD a viewer downloads carries no net of the hidden side.
        hidden_nets = set(admin["netB"])
        for snapshot_id in (None, snapshot["id"]):
            content, _name, _version = self.service.icd(VIEWER, self.bus, "csv", snapshot_id)
            line = next(text for text in content.splitlines() if "Bus power" in text)
            self.assertFalse(hidden_nets & set(line.split(",")), line)


class DeletePublishedSystemTest(AssemblyCase):
    """Retro D3 and follow-up review finding 3 (D-P2-29, D-P2-31): a system whose snapshots back catalog
    revisions, live or frozen in a parent snapshot, is archived instead of deleted."""

    def delete_child(self) -> dict:
        return self.service.delete_system(DESIGNER, self.sid, self.version())

    def listed(self) -> bool:
        return any(s["id"] == self.sid for s in self.service.list_systems(DESIGNER))

    def child_rows(self, bus: str, snapshot_id: str) -> int:
        """Rows of the child's level in the parent snapshot's flattened ICD."""
        content, _name, _version = self.service.icd(ADMIN, bus, "csv", snapshot_id, depth="all")
        return sum(1 for line in content.splitlines() if line.startswith("CNDH-A,"))

    def test_a_system_a_parent_snapshot_froze_is_archived_not_deleted(self) -> None:
        # The review's reproduction: publish, add to a parent, snapshot the parent, remove the
        # live instance, retire the child component, then delete the child's source system.
        publication = self.child()
        bus, version = self.parent()
        added = self.add(bus, version, "CNDH-A", publication["componentId"])
        frozen = self.service.create_snapshot(DESIGNER, bus, added.version, "P1", "").body
        before = self.child_rows(bus, frozen["id"])
        self.assertGreater(before, 0)
        self.service.remove_instance(DESIGNER, bus, self.service.document(DESIGNER, bus).body["system"]["version"],
                                     added.body["id"], cascade=True)
        self.catalog.deactivate_component(publication["componentId"], actor="t@local", reason="review finding 3")

        outcome = self.delete_child()
        self.assertEqual((outcome["deleted"], outcome["archived"]), (False, True))
        self.assertEqual(outcome["references"]["parentSnapshots"], 1)
        self.assertEqual(self.child_rows(bus, frozen["id"]), before, "the frozen parent keeps its child's connectivity")
        self.assertFalse(self.listed())
        document = self.service.document(DESIGNER, self.sid).body
        self.assertIsNotNone(document["system"]["archivedAt"])
        with self.assertRaisesRegex(Conflict, "system_archived"):
            self.service.update_system(DESIGNER, self.sid, self.version(), {"description": "edit"})

    def test_references_archive_and_nothing_left_deletes(self) -> None:
        publication = self.child()
        archived = self.delete_child()  # the catalog component is active
        self.assertTrue(archived["archived"])
        self.assertTrue(archived["references"]["activeCatalogComponent"])
        bus, version = self.parent()
        with self.assertRaisesRegex(Conflict, "system_archived"):
            self.service.create_snapshot(DESIGNER, self.sid, self.version(), "X", "")
        # A parent can still use the released revision: the catalog component is independent.
        added = self.add(bus, version, "CNDH-A", publication["componentId"])
        self.catalog.deactivate_component(publication["componentId"], actor="t@local", reason="retro D3 test")
        self.assertEqual(self.delete_child()["references"]["parentInstances"], 1)
        self.service.remove_instance(DESIGNER, bus, added.version, added.body["id"], cascade=True)
        gone = self.delete_child()
        self.assertEqual((gone["deleted"], gone["archived"]), (True, False))
        with self.assertRaises(NotFound):
            self.service.document(DESIGNER, self.sid)
        self.sid = None  # deleted: nothing for tearDown to unbind

    def test_an_unreferenced_system_is_deleted(self) -> None:
        bus, version = self.parent()
        outcome = self.service.delete_system(DESIGNER, bus, version)
        self.assertEqual((outcome["deleted"], outcome["archived"]), (True, False))


if __name__ == "__main__":
    unittest.main()
