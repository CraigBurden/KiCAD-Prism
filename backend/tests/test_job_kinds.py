"""Every job kind is declared once, and the declaration matches the workers."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

from app.prism_worker import PrismWorker
from app.services import catalog_worker_tasks
from app.services.job_handlers import (
    get_job_handler,
    get_job_kind,
    load_builtin_job_handlers,
    registered_job_kinds,
)
from app.services.job_kinds import (
    POOLS,
    RESOURCES,
    JobKind,
    JobSubject,
    repository_lock,
    subject_lock,
)
from tests.in_memory_jobs import InMemoryJobService

APP = Path(__file__).resolve().parents[1] / "app"


class JobKindRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        load_builtin_job_handlers()

    def test_every_kind_has_a_pool_known_slots_and_a_handler(self) -> None:
        capacities = PrismWorker.resource_capacities()
        self.assertEqual(set(capacities), set(RESOURCES))
        kinds = registered_job_kinds()
        self.assertGreaterEqual(len(kinds), 22)
        for name in kinds:
            with self.subTest(kind=name):
                kind = get_job_kind(name)
                self.assertIsInstance(kind, JobKind)
                self.assertEqual(kind.name, name)
                self.assertIn(kind.pool, POOLS)
                self.assertTrue(kind.resources)
                for slot, count in kind.resources.items():
                    self.assertIn(slot, RESOURCES)
                    self.assertGreaterEqual(capacities[slot], count, f"{name} can never get {count} {slot}")
                self.assertTrue(callable(kind.handler))
                self.assertIs(get_job_handler(name), kind.handler)
                self.assertGreaterEqual(kind.max_attempts, 1)

    def test_the_design_bundle_kind_holds_its_slot_and_a_legacy_unit(self) -> None:
        """cli-spec.md §7.4: one design_bundle slot (memory-bounded), plus one semantic_compile unit
        while legacy consumers still run, under the repository read lock."""

        kind = get_job_kind("design_bundle")
        self.assertEqual(
            dict(kind.resources),
            {
                "prism_worker": 1,
                "design_bundle": 1,
                "semantic_compile": 1,
                "memory": 9,  # 2304 MiB / 256
            },
        )
        self.assertEqual(PrismWorker.resource_capacities()["design_bundle"], 1)
        self.assertEqual(kind.lock(JobSubject(project_id="p", repository_id="r")), [{"key": "repository:r", "mode": "read"}])
        self.assertIsNotNone(kind.settle)

    def test_heavy_kinds_reserve_their_peak_in_memory_units(self) -> None:
        """A wave is admitted by summed peak, not by a slot per kind (item A)."""

        expected = {
            "design_bundle": 9,        # 2304 MiB: prism-kicad parse 2.0-2.1 GiB
            "release_studio_build": 13,  # 3328 MiB: 6.4 GiB two builds
            "design_compare": 12,      # 3072 MiB: two parsers plus a plot
            "sim_run": 4,              # 1024 MiB: estimate for the engine child
            "kicad_workflow": 5,       # 1280 MiB: DRC 1.1 GiB
        }
        capacity = PrismWorker.resource_capacities()["memory"]
        for name, units in expected.items():
            with self.subTest(kind=name):
                kind = get_job_kind(name)
                self.assertEqual(kind.resources.get("memory"), units)
                self.assertLessEqual(units, capacity, f"{name} could never run alone")

    def test_a_budget_below_the_heaviest_kind_is_refused(self) -> None:
        from app.services.job_kinds import validate_memory_capacity

        kinds = [get_job_kind(name) for name in registered_job_kinds()]
        heavy = JobKind("too-heavy", lambda context: None, resources={"memory": 4096})
        with self.assertRaises(ValueError):
            validate_memory_capacity([*kinds, heavy])

    def test_catalog_kinds_run_on_the_catalog_pool_and_nothing_else_does(self) -> None:
        for name in registered_job_kinds():
            kind = get_job_kind(name)
            catalog = name in catalog_worker_tasks.HANDLERS
            with self.subTest(kind=name):
                self.assertEqual(kind.pool == "catalog", catalog)
                self.assertEqual("catalog_worker" in kind.resources, catalog)

    def test_only_job_kinds_enqueue_on_the_job_queue(self) -> None:
        queue_names = {"jobs", "v3_jobs", "default_jobs", "context_jobs"}
        offenders = []
        for path in sorted(APP.rglob("*.py")):
            if path.name in {"job_kinds.py", "job_service.py"}:
                continue
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr == "enqueue"
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id in queue_names
                ):
                    offenders.append(f"{path.relative_to(APP)}:{node.lineno}")
        self.assertEqual(offenders, [], "queue jobs through their JobKind")

    def test_kind_validation_refuses_unknown_pools_and_slots(self) -> None:
        def handler(_context: object) -> None:
            return None

        with self.assertRaises(ValueError):
            JobKind("bad", handler, pool="gpu")
        with self.assertRaises(ValueError):
            JobKind("bad", handler, resources={"gpu": 1})
        with self.assertRaises(ValueError):
            JobKind("bad", handler, settle=lambda job: None)


class JobKindEnqueueTests(unittest.TestCase):
    def _kind(self, **kwargs: object) -> JobKind:
        return JobKind("test_kind", lambda context: None, **kwargs)  # type: ignore[arg-type]

    def test_enqueue_applies_the_declared_policy(self) -> None:
        service = InMemoryJobService()
        kind = self._kind(
            resources={"prism_worker": 1, "import": 1}, lock=repository_lock("write"),
            max_attempts=2, priority=150,
        )
        row = kind.enqueue(
            {"x": 1},
            subject=JobSubject(project_id="p1", repository_id="r1"),
            artifact_key="k",
            requested_by="a@example.com",
            service=service,
        )
        stored = service.rows[row["job_id"]]
        self.assertEqual(stored["worker_pool"], "prism")
        self.assertEqual(stored["resource_requirements"], {"prism_worker": 1, "import": 1})
        self.assertEqual(stored["lock_requirements"], [{"key": "repository:r1", "mode": "write"}])
        self.assertEqual((stored["max_attempts"], stored["priority"]), (2, 150))
        self.assertEqual((stored["project_id"], stored["repository_id"]), ("p1", "r1"))
        self.assertEqual(stored["artifact_key"], "k")

    def test_lock_shapes(self) -> None:
        project_only = JobSubject(project_id="p1")
        self.assertEqual(repository_lock("read")(project_only), [{"key": "project:p1", "mode": "read"}])
        self.assertEqual(repository_lock("read", project_fallback=False)(project_only), [])
        self.assertEqual(
            subject_lock("write")(JobSubject(lock_key="system-git:s1")),
            [{"key": "system-git:s1", "mode": "write"}],
        )
        with self.assertRaises(ValueError):
            subject_lock("write")(project_only)

    def test_subject_of_a_project_row(self) -> None:
        self.assertEqual(
            JobSubject.of_project({"id": "p1", "repo_id": "r1"}),
            JobSubject(project_id="p1", repository_id="r1"),
        )
        self.assertEqual(JobSubject.of_project({"repo_id": ""}, "p2"), JobSubject(project_id="p2"))


if __name__ == "__main__":
    unittest.main()
