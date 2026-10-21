"""The Release Studio import boundary (ADR amendment C3 §4 "Boundary").

No module under ``backend/app/release_studio/`` or matching
``backend/app/services/release_studio*.py`` may import ``kicad_monkey``,
``kicad_cruncher`` or ``geometer`` -- at module level or inside a function.
Release Studio reads its design from a design bundle; the Python KiCad parsers
and Cruncher belong to no part of it.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PACKAGE = REPO / "backend" / "app" / "release_studio"
SERVICE_MODULES = REPO / "backend" / "app" / "services"

FORBIDDEN = ("kicad_monkey", "kicad_cruncher", "geometer")


def _covered_modules() -> list[Path]:
    modules = sorted(PACKAGE.rglob("*.py"))
    modules += sorted(SERVICE_MODULES.glob("release_studio*.py"))
    return modules


def _imported_top_levels(tree: ast.AST) -> list[tuple[str, int]]:
    """Every imported top-level module name and the line it appears on."""

    found: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.extend((alias.name.split(".")[0], node.lineno) for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                found.append((node.module.split(".")[0], node.lineno))
    return found


class ImportBoundaryTests(unittest.TestCase):
    def test_no_release_studio_module_imports_the_legacy_parsers(self) -> None:
        modules = _covered_modules()
        self.assertTrue(modules, "the boundary walk found no modules")
        violations: list[str] = []
        for module in modules:
            tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
            for name, line in _imported_top_levels(tree):
                if name in FORBIDDEN:
                    violations.append(f"{module.relative_to(REPO)}:{line}: {name}")
        self.assertEqual(violations, [], "forbidden imports:\n" + "\n".join(violations))


if __name__ == "__main__":
    unittest.main()
