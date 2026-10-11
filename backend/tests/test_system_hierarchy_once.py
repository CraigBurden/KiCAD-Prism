"""SB2-95: a request resolves its hierarchy once, and a warm resolve reads no child from the database."""

from __future__ import annotations

import unittest
from unittest import mock

from test_system_assemblies import AssemblyCase
from test_system_snapshots import VIEWER

from app.services.systems import hierarchy, visibility
from support.postgres import seed_folder


class HierarchyOnceTest(AssemblyCase):
    def bus_with_two_copies(self) -> str:
        publication = self.child()
        bus, version = self.parent()
        a = self.add(bus, version, "CNDH-A", publication["componentId"])
        self.add(bus, a.version, "CNDH-B", publication["componentId"], follow="pinned")
        return bus

    def resolves(self, call) -> int:
        with mock.patch.object(hierarchy, "resolve", side_effect=hierarchy.resolve) as resolve:
            call()
        return resolve.call_count

    def test_hierarchy_and_nets_resolve_once(self) -> None:
        bus = self.bus_with_two_copies()
        self.assertEqual(self.resolves(lambda: self.service.hierarchy(VIEWER, bus)), 1)
        self.assertEqual(self.resolves(lambda: self.service.nets(VIEWER, bus)), 1)

    def test_a_warm_resolve_reads_no_child_revision_or_snapshot(self) -> None:
        bus = self.bus_with_two_copies()
        self.service.hierarchy(VIEWER, bus)  # warms the revision and manifest caches
        with mock.patch.object(type(self.service), "_catalog_revision") as revision, \
                mock.patch("app.services.systems.store.SystemStore.get_snapshot") as snapshot:
            tree = self.service.hierarchy(VIEWER, bus)
        revision.assert_not_called()
        snapshot.assert_not_called()
        self.assertEqual(tree["boardCount"], 8)

    def test_child_visibility_is_one_query_for_any_number_of_copies(self) -> None:
        bus = self.bus_with_two_copies()
        with mock.patch.object(visibility, "visible_systems", side_effect=visibility.visible_systems) as each, \
                mock.patch.object(visibility, "hidden_systems", side_effect=visibility.hidden_systems) as batched:
            self.service.hierarchy(VIEWER, bus)
        self.assertEqual(batched.call_count, 1)
        self.assertEqual(each.call_count, 1)  # only the root system's own visibility check

    def test_hidden_systems_names_the_ones_the_role_cannot_see(self) -> None:
        bus = self.bus_with_two_copies()
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE system_projects SET folder_id = 'fld_admins' WHERE id = %s", (self.sid,))
        self.conn.commit()
        self.assertEqual(visibility.hidden_systems(self.conn, "viewer", {self.sid, bus, "sys_missing"}),
                         {self.sid, "sys_missing"})
        self.assertEqual(visibility.hidden_systems(self.conn, "admin", {self.sid, bus}), set())
        self.assertEqual(visibility.hidden_systems(self.conn, "viewer", set()), set())


if __name__ == "__main__":
    unittest.main()
