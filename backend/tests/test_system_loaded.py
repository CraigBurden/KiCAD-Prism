"""AC-16: a loaded system built from in-memory rows (no database).

``LoadedSystem`` reads each kind of row once and computes the tree, the net level, the placement and
each caller's restricted set once, on first use. These tests give it a row source with the store's
read methods over plain lists and a resolver stub, and count what it asks for.
"""

from __future__ import annotations

import unittest
from collections import Counter
from typing import Any, Optional
from unittest import mock

from app.services.systems import hierarchy, validation
from app.services.systems.jobs import artifact_key
from app.services.systems.loaded import LoadedSystem
from app.services.systems.store import Invalid

COMMIT = "a" * 40


class MemoryRows:
    """``SystemStore``'s read surface over in-memory rows, counting each read."""

    def __init__(self, instances: list[dict], **rows: Any) -> None:
        self.instances = instances
        self.rows = rows
        self.reads: Counter = Counter()

    def _read(self, name: str, default: Any = ()) -> Any:
        self.reads[name] += 1
        return self.rows.get(name, default)

    def list_instances(self, system_id: str, *, kinds=("board",)) -> list[dict]:
        self.reads[f"list_instances:{','.join(kinds)}"] += 1
        return sorted((dict(i) for i in self.instances if i["kind"] in kinds),
                      key=lambda i: (i["label"].lower(), i["id"]))

    def list_links(self, system_id: str) -> list[dict]:
        return list(self._read("links"))

    def list_exports(self, system_id: str) -> list[dict]:
        return list(self._read("exports"))

    def list_harnesses(self, system_id: str) -> list[dict]:
        return list(self._read("harnesses"))

    def list_subports(self, system_id: str) -> list[dict]:
        return list(self._read("subports"))

    def list_reviews(self, system_id: str, *, status: Optional[str] = None) -> list[dict]:
        return [r for r in self._read("reviews") if status is None or r["status"] == status]

    def list_renames(self, system_id: str, states=("open",)) -> list[dict]:
        return list(self._read("renames"))

    def list_waivers(self, system_id: str) -> list[dict]:
        return list(self._read("waivers"))

    def list_poses(self, system_id: str) -> dict:
        return dict(self._read("poses", {}))

    def list_driving_mates(self, system_id: str) -> dict:
        return dict(self._read("driving", {}))

    def get_collision_check(self, system_id: str) -> Optional[dict]:
        return self._read("collision_check", None)

    def overrides_of(self, ids: list[str]) -> dict:
        self.reads["overrides_of"] += 1
        return {iid: dict(self.rows.get("overrides", {}).get(iid, {})) for iid in ids}

    def mating_of(self, ids: list[str]) -> dict:
        self.reads["mating_of"] += 1
        return {iid: dict(self.rows.get("mating", {}).get(iid, {})) for iid in ids}

    def get_interface(self, project_id: str, commit: str, version: int) -> Optional[dict]:
        self.reads["get_interface"] += 1
        return self.rows.get("artifacts", {}).get(project_id)

    def get_interface_extent(self, project_id: str, commit: str, version: int) -> Optional[dict]:
        self.reads["get_interface_extent"] += 1
        return None

    def latest_jobs(self, kind: str, keys: list[str]) -> dict:
        self.reads["latest_jobs"] += 1
        jobs = self.rows.get("jobs", {})
        return {key: jobs[key] for key in keys if key in jobs}

    def get_source_check(self, instance_id: str) -> Optional[dict]:
        return self.rows.get("source_checks", {}).get(instance_id)


class StubResolver:
    """The service's catalog-backed hooks, recorded."""

    def __init__(self, modules: Optional[dict] = None, broken: bool = False) -> None:
        self.modules = modules or {}
        self.broken = broken
        self.calls: Counter = Counter()

    def _instance_interface(self, rows: Any, instance: dict) -> Optional[dict]:
        self.calls["interface"] += 1
        if instance["kind"] == "board":
            return rows.get_interface(instance["project_id"], instance["baseline_commit"], 0)
        return self.modules.get(instance["catalog_revision_id"])

    def _child_loader(self, rows: Any) -> Any:
        self.calls["child_loader"] += 1
        return lambda revision_id: None

    def _occurrence_lookups(self, rows: Any, extents: dict) -> tuple:
        self.calls["lookups"] += 1
        return (lambda occurrence: None), (lambda occurrence, key: None)

    def _catalog_instance_doc(self, instance: dict, rows: Any = None) -> dict:
        self.calls["catalog_doc"] += 1
        return {"id": instance["id"], "catalog": {"releaseStatus": "released", "openReviewCount": 0}}

    def _visibility(self, rows: Any, system_id: str, caller: Any, instances: list, tree: Any = ...) -> frozenset:
        self.calls["visibility"] += 1
        self.seen_tree = tree
        return frozenset() if caller.role == "admin" else frozenset({"b2"})

    def _harness_checks(self, loaded: LoadedSystem) -> dict:
        self.calls["harness_checks"] += 1
        return {}


class Caller:
    def __init__(self, role: str) -> None:
        self.role = role


def board(iid: str, label: str, project: str) -> dict:
    return {"id": iid, "kind": "board", "label": label, "project_id": project, "baseline_commit": COMMIT,
            "resolution": "resolved", "catalog_revision_id": None, "catalog_component_id": None}


def module(iid: str, label: str, revision: str) -> dict:
    return {"id": iid, "kind": "module", "label": label, "project_id": None, "baseline_commit": None,
            "resolution": "resolved", "catalog_revision_id": revision, "catalog_component_id": "c1"}


SYSTEM = {"id": "sys_1", "version": 7, "optionalRules": None, "openReviewCount": 0}


class LoadedSystemTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = MemoryRows(
            [board("b1", "OBC", "prj_obc"), board("b2", "PWR", "prj_pwr"), module("m1", "IMU", "rev_imu")],
            artifacts={"prj_obc": {"hasPcb": True, "components": []}},
            jobs={artifact_key("prj_pwr", COMMIT): {"id": "j1", "status": "failed", "error_code": "kicad_failed"}},
            reviews=[{"id": "r1", "status": "open", "instance_id": "b1", "kind": "source_update", "items": []},
                     {"id": "r2", "status": "applied", "instance_id": "b1", "items": []}],
        )
        self.resolver = StubResolver(modules={"rev_imu": {"hasPcb": False, "components": []}})
        self.loaded = LoadedSystem(self.rows, SYSTEM, self.resolver)

    def test_rows_and_interfaces_from_memory(self) -> None:
        loaded = self.loaded
        self.assertEqual([i["id"] for i in loaded.boards], ["b1", "b2"])
        self.assertEqual([i["id"] for i in loaded.children], ["m1"])
        self.assertEqual([i["id"] for i in loaded.all_instances], ["m1", "b1", "b2"])  # by label
        self.assertEqual(set(loaded.interfaces), {"b1", "m1"})
        self.assertEqual([r["id"] for r in loaded.open_reviews], ["r1"])
        self.assertEqual((loaded.version, loaded.optional_rules), (7, ()))

    def test_a_failed_extraction_makes_the_source_unavailable(self) -> None:
        self.assertEqual(self.loaded.unavailable, {"b2": "kicad_failed"})
        self.assertEqual(self.rows.reads["latest_jobs"], 1)

    def test_each_row_kind_is_read_once(self) -> None:
        loaded = self.loaded
        for _ in range(2):
            loaded.interfaces, loaded.unavailable, loaded.level, loaded.placement, loaded.child_states
            loaded.restricted(Caller("viewer")), loaded.overrides, loaded.mating
        self.assertEqual(self.rows.reads["list_instances:board,assembly,module,part"], 1)
        self.assertEqual(self.rows.reads["list_instances:board"], 1)
        self.assertEqual(self.rows.reads["links"], 1)
        self.assertEqual(self.rows.reads["get_interface"], 2)  # one per board
        self.assertEqual(self.resolver.calls["catalog_doc"], 1)
        self.assertEqual(self.resolver.calls["lookups"], 1)

    def test_the_tree_is_resolved_once_for_every_use(self) -> None:
        with mock.patch.object(hierarchy, "resolve", side_effect=hierarchy.resolve) as resolve:
            loaded = self.loaded
            self.assertEqual(len(loaded.tree.boards), 2)
            loaded.level, loaded.placement, loaded.extents
            loaded.restricted(Caller("viewer"))
            loaded.restricted(Caller("admin"))
        self.assertEqual(resolve.call_count, 1)
        self.assertIs(self.resolver.seen_tree, loaded.tree)

    def test_restricted_is_kept_per_role(self) -> None:
        self.assertEqual(self.loaded.restricted(Caller("viewer")), frozenset({"b2"}))
        self.assertEqual(self.loaded.restricted(Caller("viewer")), frozenset({"b2"}))
        self.assertEqual(self.loaded.restricted(Caller("admin")), frozenset())
        self.assertEqual(self.resolver.calls["visibility"], 2)

    def test_the_level_carries_mating_and_driving_without_being_changed_later(self) -> None:
        self.rows.rows.update(mating={"b1": {"/k1": {"mode": "confirmed"}}}, driving={"b2": "slk_1"})
        level = self.loaded.level
        self.assertEqual(level.mating, {"b1": {"/k1": {"mode": "confirmed"}}, "b2": {}, "m1": {}})
        self.assertEqual(level.driving, {"b2": "slk_1"})
        placement = self.loaded.placement
        self.assertIs(self.loaded.level, level)
        self.assertEqual(set(placement["placed"]), {"/b1", "/b2", "/m1"})

    def test_one_interface_without_reading_the_others(self) -> None:
        self.assertEqual(self.loaded.interface("m1"), {"hasPcb": False, "components": []})
        self.assertEqual(self.resolver.calls["interface"], 1)
        self.assertIsNone(self.loaded.interface("missing"))

    def test_a_broken_hierarchy_raises_only_where_the_tree_is_needed(self) -> None:
        with mock.patch.object(hierarchy, "resolve", side_effect=hierarchy.HierarchyError("depth_exceeded", "x")):
            loaded = LoadedSystem(self.rows, SYSTEM, self.resolver)
            with self.assertRaises(Invalid):
                loaded.tree
            self.assertIsNone(loaded.tree_or_none)
            loaded.restricted(Caller("viewer"))
        self.assertIsNone(self.resolver.seen_tree)

    def test_no_b2b_link_solves_no_placement_for_v11(self) -> None:
        self.assertIsNone(self.loaded.mate_mismatches)
        self.assertEqual(self.resolver.calls["lookups"], 0)

    def test_it_feeds_the_validation_report(self) -> None:
        report = validation.report(self.loaded, mates=None, scene_key="k")
        self.assertEqual([(f["rule"], f["instanceId"]) for f in report["findings"]],
                         [("SYS-V05", "b2"), ("SYS-V08", "b1")])
        self.assertEqual(self.resolver.calls["harness_checks"], 0, "no harnesses, no routing")


if __name__ == "__main__":
    unittest.main()
