"""The worker's memory budget default (item A)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.core import worker_memory


class WorkerMemoryBudgetTests(unittest.TestCase):
    def test_the_default_is_a_whole_number_of_units_inside_the_bounds(self) -> None:
        budget = worker_memory.default_worker_memory_budget_mib()
        self.assertGreaterEqual(budget, worker_memory.MIN_BUDGET_MIB)
        self.assertLessEqual(budget, worker_memory.MAX_BUDGET_MIB)
        self.assertEqual(budget % worker_memory.MEMORY_UNIT_MIB, 0)

    def test_a_small_container_is_lifted_to_the_floor(self) -> None:
        # 7.75 GiB is the live deployment: half of it would be below the floor.
        with mock.patch.object(
            worker_memory,
            "memory_limit_bytes",
            return_value=7936 * 1024 * 1024,
        ):
            self.assertEqual(
                worker_memory.default_worker_memory_budget_mib(), 4096
            )

    def test_a_large_host_is_capped(self) -> None:
        with mock.patch.object(
            worker_memory,
            "memory_limit_bytes",
            return_value=64 * 1024**3,
        ):
            self.assertEqual(
                worker_memory.default_worker_memory_budget_mib(),
                worker_memory.MAX_BUDGET_MIB,
            )

    def test_no_limit_falls_back_to_a_fixed_budget(self) -> None:
        with mock.patch.object(worker_memory, "memory_limit_bytes", return_value=None):
            self.assertEqual(
                worker_memory.default_worker_memory_budget_mib(),
                worker_memory.FALLBACK_BUDGET_MIB,
            )

    def test_a_cgroup_file_is_read_only_when_it_is_a_real_limit(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as handle:
            self.addCleanup(Path(handle.name).unlink)
            path = Path(handle.name)
            for text, expected in (
                ("max", None),
                ("0", None),
                (str(1 << 62), None),  # cgroup v1's "unlimited" sentinel
                (str(2 * 1024**3), 2 * 1024**3),
            ):
                with self.subTest(text=text):
                    handle.seek(0)
                    handle.truncate()
                    handle.write(text)
                    handle.flush()
                    self.assertEqual(worker_memory._positive_limit(path), expected)


if __name__ == "__main__":
    unittest.main()
