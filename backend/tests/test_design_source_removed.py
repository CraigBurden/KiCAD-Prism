"""R1: the four consumers' legacy modules and switches are gone (ADR §9.7)."""

from __future__ import annotations

import importlib
import unittest

from app.core.config import settings
from app.services.design_bundle import consumer


class RemovedModulesTests(unittest.TestCase):
    def test_the_legacy_design_compare_modules_do_not_import(self) -> None:
        for name in (
            "app.services.design_compare_nodes",
            "app.services.design_compare_occurrences",
            "app.services.design_compare_semantics",
            "app.services.design_compare_net_pairing",
            "app.services.design_compare_sources",
            "app.services.document_diff_service",
            "app.services.bom_diff_service",
            "app.services.semantic_index_jobs",
        ):
            with self.subTest(module=name), self.assertRaises(ModuleNotFoundError):
                importlib.import_module(name)

    def test_the_four_switches_are_gone_from_settings(self) -> None:
        for name in (
            "PRISM_DESIGN_SOURCE_SEMANTIC_INDEX",
            "PRISM_DESIGN_SOURCE_PROJECT_METADATA",
            "PRISM_DESIGN_SOURCE_CATALOG_IMPORT",
            "PRISM_DESIGN_SOURCE_DESIGN_COMPARISON",
        ):
            with self.subTest(setting=name):
                self.assertFalse(hasattr(settings, name))

    def test_the_release_studio_switch_is_gone_too(self) -> None:
        self.assertFalse(hasattr(settings, "PRISM_DESIGN_SOURCE_RELEASE_STUDIO"))
        self.assertFalse(hasattr(consumer, "source"))


if __name__ == "__main__":
    unittest.main()
