from __future__ import annotations

import json
import tempfile
from pathlib import Path
import sys
import unittest

# CI runs this module with `python -m unittest backend.tests.<name>` from the repository
# root, where backend/tests is not on sys.path (pytest adds it).
sys.path.insert(0, str(Path(__file__).resolve().parent))
from support.repo import commit_all, init_repo  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[1].parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import check_module_size as size_gate  # noqa: E402


def _write_lines(path: Path, count: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join("pass" for _ in range(count)) + "\n", encoding="utf-8")


class ModuleSizeTests(unittest.TestCase):
    def test_new_oversized_module_fails_and_grandfathered_shrink_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            module = root / "backend" / "app" / "services" / "new_service.py"
            _write_lines(module, size_gate.MAX_PRODUCTION_MODULE_LINES + 1)
            failures = size_gate.module_size_failures(root)
            self.assertTrue(any("production-module limit" in failure for failure in failures))

            ceilings = {"backend/app/services/new_service.py": 1201}
            self.assertEqual(size_gate.module_size_failures(root, ceilings), [])
            _write_lines(module, 1200)
            self.assertEqual(size_gate.module_size_failures(root, ceilings), [])
            _write_lines(module, 1202)
            self.assertTrue(any("grandfather ceiling" in failure for failure in size_gate.module_size_failures(root, ceilings)))

    def test_scripts_count_but_tests_and_vendored_files_do_not(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _write_lines(root / "scripts" / "big_tool.py", size_gate.MAX_PRODUCTION_MODULE_LINES + 1)
            _write_lines(root / "scripts" / "test_big_tool.py", size_gate.MAX_PRODUCTION_MODULE_LINES + 1)
            _write_lines(root / "backend" / "app" / "vendor" / "lib.py", size_gate.MAX_PRODUCTION_MODULE_LINES + 1)
            self.assertEqual(
                [failure.split(":")[0] for failure in size_gate.module_size_failures(root)],
                ["scripts/big_tool.py"],
            )

    def test_catalog_facade_limit_is_stricter_than_general_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            module = root / "backend" / "app" / "services" / "catalog" / "component_facade.py"
            _write_lines(module, size_gate.MAX_CATALOG_FACADE_LINES + 1)
            failures = size_gate.module_size_failures(root)
            self.assertTrue(any("facade/composition/orchestrator" in failure for failure in failures))
            _write_lines(module, size_gate.MAX_CATALOG_FACADE_LINES)
            self.assertEqual(size_gate.module_size_failures(root), [])

    def test_update_rejects_new_or_growing_oversized_modules(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            new_module = root / "backend" / "app" / "services" / "new_service.py"
            _write_lines(new_module, size_gate.MAX_PRODUCTION_MODULE_LINES + 1)
            self.assertTrue(
                any(
                    "new oversized modules" in failure
                    for failure in size_gate.module_size_update_failures(root, {})
                )
            )

            grandfathered = {
                "backend/app/services/new_service.py": size_gate.MAX_PRODUCTION_MODULE_LINES + 1
            }
            _write_lines(new_module, size_gate.MAX_PRODUCTION_MODULE_LINES + 2)
            self.assertTrue(
                any(
                    "grandfather ceiling" in failure
                    for failure in size_gate.module_size_update_failures(root, grandfathered)
                )
            )

    def test_update_lowers_existing_ceilings_and_removes_finished_or_missing(self) -> None:
        baseline = {
            "backend/app/services/shrinking.py": 1400,
            "backend/app/services/finished.py": 1201,
            "backend/app/services/removed.py": 1300,
        }
        line_counts = {
            "backend/app/services/shrinking.py": 1300,
            "backend/app/services/finished.py": size_gate.MAX_PRODUCTION_MODULE_LINES,
        }

        self.assertEqual(
            size_gate.update_module_ceilings(line_counts, baseline),
            {"backend/app/services/shrinking.py": 1300},
        )

    def test_update_lowers_ceilings_and_keeps_the_private_use_ratchet(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _write_lines(root / "backend" / "app" / "services" / "big.py", 1250)
            baseline_path = root / "scripts" / size_gate.BASELINE_FILENAME
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
            private = [{"path": "consumer.py", "symbol": "_connect", "count": 2}]
            baseline_path.write_text(json.dumps({
                "version": 1,
                "private_catalog_uses": private,
                "module_line_ceilings": {"backend/app/services/big.py": 1300},
            }), encoding="utf-8")

            self.assertEqual(size_gate.main(["--repo-root", str(root), "--update-baseline"]), 0)

            payload = json.loads(baseline_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["module_line_ceilings"], {"backend/app/services/big.py": 1250})
            self.assertEqual(payload["private_catalog_uses"], private)

    def test_git_base_baseline_rejects_added_or_raised_ceilings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            baseline_path = root / "scripts" / size_gate.BASELINE_FILENAME
            baseline_path.parent.mkdir(parents=True)
            baseline_path.write_text(json.dumps({
                "version": 1,
                "private_catalog_uses": [],
                "module_line_ceilings": {"service.py": 1300, "old.py": 1400},
            }), encoding="utf-8")
            init_repo(root)
            commit_all(root, "base")
            _private, base_ceilings = size_gate.load_baseline_at_ref(root, "HEAD", baseline_path) or ({}, {})

            self.assertEqual(
                size_gate.baseline_monotonic_failures({"service.py": 1301, "new_service.py": 1300}, base_ceilings),
                [
                    "baseline adds module-line ceiling new_service.py "
                    "(head ceiling 1300, base ref has no ceiling)",
                    "baseline increases module-line ceiling service.py: base 1300, head 1301",
                ],
            )
            self.assertEqual(size_gate.baseline_monotonic_failures({"service.py": 1200}, base_ceilings), [])


if __name__ == "__main__":
    unittest.main()
