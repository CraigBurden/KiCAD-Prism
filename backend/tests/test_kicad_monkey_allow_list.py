"""No revision parse imports Python ``kicad_monkey`` (ADR §9.7 R2).

The only importers left are the component catalog's library-file readers, which
stay until a later ADR ports them onto Prism's parser (decisions.md, Ownership
map item 2). This walks every module under ``backend/app/`` — function-local
imports included — so a new import fails here rather than at runtime.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


APP = Path(__file__).resolve().parents[1] / "app"

#: Module -> why it may still import ``kicad_monkey``.
ALLOWED = {
    "app.services.catalog.mates": (
        "catalog library-file mates: reads a .kicad_sym/.kicad_mod with the "
        "pinned kicad_monkey helpers; allow-listed by WP-R2 until the library ADR"
    ),
}


def _module_name(path: Path) -> str:
    relative = path.relative_to(APP.parent).with_suffix("")
    parts = list(relative.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _kicad_monkey_imports(tree: ast.AST) -> list[str]:
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "kicad_monkey" or alias.name.startswith("kicad_monkey."):
                    found.append(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            if node.module == "kicad_monkey" or node.module.startswith("kicad_monkey."):
                found.append(node.module)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "__import__":
            if node.args and isinstance(node.args[0], ast.Constant):
                name = node.args[0].value
                if isinstance(name, str) and (
                    name == "kicad_monkey" or name.startswith("kicad_monkey.")
                ):
                    found.append(name)
    return found


class KiCadMonkeyImportAllowListTests(unittest.TestCase):
    def test_only_allow_listed_modules_import_kicad_monkey(self) -> None:
        offenders: dict[str, list[str]] = {}
        for path in sorted(APP.rglob("*.py")):
            module = _module_name(path)
            imports = _kicad_monkey_imports(ast.parse(path.read_text(encoding="utf-8")))
            if imports and module not in ALLOWED:
                offenders[module] = imports

        self.assertEqual(
            offenders,
            {},
            "modules outside the WP-R2 allow-list import kicad_monkey: "
            + "; ".join(f"{module} ({', '.join(imports)})" for module, imports in offenders.items()),
        )

    def test_the_allow_list_is_the_importers_that_remain(self) -> None:
        importers = {
            _module_name(path)
            for path in sorted(APP.rglob("*.py"))
            if _kicad_monkey_imports(ast.parse(path.read_text(encoding="utf-8")))
        }
        self.assertEqual(
            importers,
            set(ALLOWED),
            "the allow-list drifted from the modules that still import kicad_monkey; "
            "remove a stale entry or document the new one with its reason",
        )
        for module, reason in ALLOWED.items():
            with self.subTest(module=module):
                self.assertTrue(reason.strip())


if __name__ == "__main__":
    unittest.main()
