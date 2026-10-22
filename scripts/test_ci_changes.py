"""scripts/ci_changes.py: which Quality gate jobs a change needs."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ci_changes import JOBS, needed  # noqa: E402


def jobs(*files: str) -> set[str]:
    return {job for job, value in needed(list(files)).items() if value}


class CiChangesTest(unittest.TestCase):
    def test_a_guide_edit_needs_no_test_job(self) -> None:
        self.assertEqual(jobs("docs/system-builder/README.md", "README.md"), set())

    def test_a_frontend_change_runs_only_the_frontend(self) -> None:
        self.assertEqual(jobs("frontend/src/components/canvas/toolbar-button.tsx"), {"frontend"})

    def test_a_backend_change_runs_the_backend_and_the_live_image_but_not_the_frontend(self) -> None:
        self.assertEqual(jobs("backend/app/services/viewer_3d_bundle.py"), {"backend", "image_live"})

    def test_files_read_by_name_from_another_area_run_that_area_too(self) -> None:
        self.assertIn("backend", jobs("frontend/src/lib/catalog-field-rules.generated.ts"))  # test_catalog_field_rules
        self.assertIn("agent", jobs("backend/app/services/kicad_noise_service.py"))  # tools/tests/test_gitignore
        self.assertIn("backend", jobs("frontend/package.json"))  # test_release_studio_toolchain_pins

    def test_ci_itself_or_a_toolchain_pin_runs_everything(self) -> None:
        for path in (".github/workflows/dev-quality-gate.yml", ".node-version", "scripts/ci_changes.py"):
            with self.subTest(path=path):
                self.assertEqual(jobs(path), set(JOBS))

    def test_a_native_change_runs_the_native_workspace_and_the_image(self) -> None:
        self.assertEqual(jobs("native/src/rs/prism-kicad-core/src/lib.rs"), {"native", "image"})
        self.assertEqual(jobs("native/contracts/prism/conventions.md"), {"native", "image"})

    def test_the_agent_runs_alone_for_its_own_code(self) -> None:
        self.assertEqual(jobs("tools/prism_agent/tray.py"), {"agent"})


if __name__ == "__main__":
    unittest.main()
