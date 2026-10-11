"""KICAD_CLI_PATH names the kicad-cli every KiCad caller runs.

Release builds and board statistics honoured it while jobsets, catalog
previews and the system STEP export each looked kicad-cli up their own way
and ignored it, so a deployment that pinned the CLI ran two different tools.
"""

from __future__ import annotations

import os
import unittest
from unittest import mock

from app.services import kicad_jobset_service
from app.services.catalog.kicad_cli import KicadCliRunner
from app.services.catalog.runtime import CatalogRuntime
from app.services.systems import service_step_export


CONFIGURED = "/opt/pinned-kicad/bin/kicad-cli"


class KicadCliPathOverrideTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = mock.patch.dict(os.environ, {"KICAD_CLI_PATH": CONFIGURED})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_jobsets_run_the_configured_cli(self) -> None:
        self.assertEqual(kicad_jobset_service.find_kicad_cli_path(), CONFIGURED)

    def test_catalog_previews_run_the_configured_cli(self) -> None:
        self.assertEqual(KicadCliRunner.resolve(CatalogRuntime()), CONFIGURED)

    def test_the_system_step_export_runs_the_configured_cli(self) -> None:
        self.assertEqual(service_step_export._cli(), CONFIGURED)


if __name__ == "__main__":
    unittest.main()
