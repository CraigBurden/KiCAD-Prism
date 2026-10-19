"""System Builder v2's PostgreSQL store: records, log, snapshots and visibility."""

from __future__ import annotations

import unittest

from app.core.errors import NotFound
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from app.system_builder import ops
from app.system_builder.document import new_document
from app.system_builder.integrity import Limits
from app.system_builder.store import SystemStore
from support.postgres import (
    requires_scratch_postgres,
    scratch_schema,
    seed_folder,
)

LIMITS = Limits()
ROLE = "designer"


def _document(name: str = "Flight stack") -> dict:
    return new_document(name)


@requires_scratch_postgres("System Builder store tests")
class SystemStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        scratch = scratch_schema(self, "sysstore", ledgers=(WORKSPACE_LEDGER,))
        seed_folder(
            scratch.conn, "fld_designers", visibility_mode="roles", allowed_roles=["designer"],
        )
        scratch.conn.commit()
        self.conn = scratch.conn
        self.store = SystemStore(scratch.connection)

    def create(self, system_id: str = "sys_a", name: str = "Flight stack", **kwargs):
        return self.store.create(
            system_id, _document(name), folder_id=kwargs.get("folder_id"),
            created_by=kwargs.get("created_by", "owner@example.com"),
            role=kwargs.get("role", ROLE),
        )

    def rename(self, system_id: str, name: str) -> dict:
        record = self.store.read(system_id, role=ROLE)
        assert record is not None
        request = [{"kind": "set-system-info", "name": name}]
        applied = ops.apply(
            record["document"], request, seen_ids=record["seen_ids"], limits=LIMITS,
        )
        with self.store.transaction(system_id, role=ROLE) as tx:
            return tx.write(
                applied, actor="editor@example.com", kind="edit", ops=request,
            )

    def test_create_read_and_list(self) -> None:
        first = self.create("sys_a", "A")
        self.assertEqual((first["system_id"], first["version"], first["name"]), ("sys_a", 1, "A"))
        self.assertEqual(first["seen_ids"], frozenset())
        self.assertEqual(first["document"]["schema"], "prism.system.v2")

        self.create("sys_b", "B")
        read = self.store.read("sys_a", role="viewer")
        self.assertIsNotNone(read)
        assert read is not None
        self.assertEqual(read["document"], first["document"])

        listed = self.store.list(role="viewer")
        self.assertEqual([row["system_id"] for row in listed], ["sys_b", "sys_a"])
        self.assertNotIn("document", listed[0])
        self.assertNotIn("seen_ids", listed[0])
        self.assertEqual(listed[0]["name"], "B")

    def test_folder_visibility_hides_a_system_from_a_role(self) -> None:
        created = self.create("sys_hidden", folder_id="fld_designers")
        self.assertEqual(created["folder_id"], "fld_designers")

        self.assertIsNone(self.store.read("sys_hidden", role="viewer"))
        self.assertEqual(self.store.list(role="viewer"), [])
        shown = self.store.read("sys_hidden", role="designer")
        self.assertIsNotNone(shown)
        with self.store.transaction("sys_hidden", role="viewer") as tx:
            self.assertIsNone(tx.record)

        with self.assertRaises(NotFound):
            self.create("sys_refused", folder_id="fld_designers", role="viewer")
        with self.assertRaises(NotFound):
            self.create("sys_missing_folder", folder_id="fld_missing", role="designer")

    def test_transaction_write_bumps_the_version_and_logs_the_request(self) -> None:
        self.create()
        updated = self.rename("sys_a", "Renamed")
        self.assertEqual((updated["version"], updated["name"]), (2, "Renamed"))

        read = self.store.read("sys_a", role=ROLE)
        assert read is not None
        self.assertEqual((read["version"], read["name"]), (2, "Renamed"))
        # A rename does not introduce ids, but the document's ids stay seen.
        self.assertEqual(read["seen_ids"], frozenset())

        entry = self.store.history("sys_a")[0]
        self.assertEqual(
            (entry["version"], entry["kind"], entry["actor"], entry["undoes"]),
            (2, "edit", "editor@example.com", None),
        )
        self.assertEqual(entry["ops"], [{"kind": "set-system-info", "name": "Renamed"}])
        self.assertEqual(entry["touched"], ["#info"])

    def test_a_failed_transaction_leaves_no_change(self) -> None:
        self.create()
        record = self.store.read("sys_a", role=ROLE)
        assert record is not None
        applied = ops.apply(
            record["document"], [{"kind": "set-system-info", "name": "Doomed"}],
            seen_ids=record["seen_ids"], limits=LIMITS,
        )
        with self.assertRaises(RuntimeError):
            with self.store.transaction("sys_a", role=ROLE) as tx:
                tx.write(
                    applied, actor="editor@example.com", kind="edit",
                    ops=[{"kind": "set-system-info", "name": "Doomed"}],
                )
                raise RuntimeError("abort")

        after = self.store.read("sys_a", role=ROLE)
        assert after is not None
        self.assertEqual((after["version"], after["name"]), (1, "Flight stack"))
        self.assertEqual(self.store.history("sys_a"), [])

    def test_history_is_newest_first_and_pages_before_a_version(self) -> None:
        self.create()
        self.rename("sys_a", "Two")
        self.rename("sys_a", "Three")
        self.rename("sys_a", "Four")

        self.assertEqual(
            [row["version"] for row in self.store.history("sys_a")], [4, 3, 2],
        )
        self.assertEqual(
            [row["version"] for row in self.store.history("sys_a", before=4)], [3, 2],
        )
        self.assertEqual(
            [row["version"] for row in self.store.history("sys_a", limit=1)], [4],
        )
        self.assertEqual(len(self.store.history("sys_a", limit=500)), 3)

    def test_snapshots_copy_the_document_at_their_version(self) -> None:
        self.create()
        self.rename("sys_a", "Snapshotted")

        snapshot = self.store.create_snapshot(
            "sys_a", name="Before wiring", note="start here", created_by="owner@example.com",
        )
        self.assertEqual(snapshot["snapshot_id"][:5], "snap_")
        self.assertEqual(len(snapshot["snapshot_id"]), len("snap_") + 10)
        self.assertTrue(set(snapshot["snapshot_id"][5:]) <= set("abcdefghijklmnopqrstuvwxyz234567"))
        self.assertEqual((snapshot["version"], snapshot["name"]), (2, "Before wiring"))
        self.assertEqual(snapshot["document"]["name"], "Snapshotted")

        summaries = self.store.list_snapshots("sys_a")
        self.assertEqual([row["snapshot_id"] for row in summaries], [snapshot["snapshot_id"]])
        self.assertNotIn("document", summaries[0])

        read = self.store.read_snapshot("sys_a", snapshot["snapshot_id"])
        self.assertIsNotNone(read)
        assert read is not None
        self.assertEqual(read["document"]["name"], "Snapshotted")
        self.assertIsNone(self.store.read_snapshot("sys_other", snapshot["snapshot_id"]))

    def test_soft_delete_hides_the_system(self) -> None:
        self.create()
        self.assertTrue(self.store.soft_delete("sys_a"))
        self.assertFalse(self.store.soft_delete("sys_a"))
        self.assertIsNone(self.store.read("sys_a", role=ROLE))
        self.assertEqual(self.store.list(role=ROLE), [])


if __name__ == "__main__":
    unittest.main()
