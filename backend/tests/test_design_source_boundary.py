"""The design-source boundary (ADR §9.7 X, wave 4).

No module under ``backend/app/`` may import a KiCad parser or carry KiCad
design text, outside the three places that own that work:

- the design-bundle builder and its KiCad steps (``app/services/design_bundle/``);
- the KiCad-output jobs (``app/release_studio/``, which runs ``kicad-cli`` and
  rewrites model references in the bundle's closure);
- the catalog library reader and the library-text writers it uses.

Two checks, both AST-based, so a function-local import is caught as surely as
a module-level one:

1. **Parser imports:** no import of ``kicad_monkey``, ``kicad_cruncher``,
   ``pcbnew``, ``sexpdata`` or the Python ``geometer`` package.
2. **KiCad design text:** no string literal contains an s-expression form
   opener — the regex below. Docstrings count. A module that only mentions a
   form in prose is reworded rather than allow-listed.

``KICAD_IMPORT_SITES`` is the allow-list: exact module -> the parsers it may
import, whether it may carry design text, and why. The second test fails when
an allowance is no longer used, so the list cannot rot. The failure report
names the module, line and matched text.

This test subsumes ``test_kicad_monkey_allow_list.py`` (R2) and
``test_release_studio_import_boundary.py`` (C3): it covers every module under
``backend/app``, every forbidden package those tests named, and both
module-level and function-local imports (plus ``__import__``). Release Studio
modules may carry closure text but import no parser (C3), and only
``catalog.mates`` imports ``kicad_monkey`` (R2).
"""

from __future__ import annotations

import ast
import re
import unittest
from dataclasses import dataclass
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"

#: Third-party KiCad parsers and the Python geometry/STEP package. The design
#: bundle's Rust parser replaces them for revision reads.
KICAD_PARSERS = ("kicad_monkey", "kicad_cruncher", "pcbnew", "sexpdata", "geometer")

#: An s-expression form opener for a KiCad design document, library or nested
#: record. Whitespace after ``(`` is legal, as is a plural variants form.
DESIGN_TEXT = re.compile(
    r"\(\s*(kicad_pcb|kicad_sch|kicad_symbol_lib|footprint|module|symbol|sheet|"
    r"property|pad|model|fp_lib_table|sym_lib_table|instances|variants?)\b"
)

@dataclass(frozen=True)
class Site:
    """What one allow-listed module may do, and why.

    ``parsers`` names the packages it may import (empty: none); ``text`` says
    whether it may carry KiCad design text. Anything else it does is a
    violation, so Release Studio, for example, stays parser-free (C3) and
    ``kicad_monkey`` stays in the catalog's mates reader (R2).
    """

    reason: str
    parsers: frozenset[str] = frozenset()
    text: bool = False


_LIBRARY_TEXT = "the catalog library reader and its writers"

#: Module -> what it may do and why. Exact modules, not packages.
KICAD_IMPORT_SITES: dict[str, Site] = {
    "app.services.design_bundle.kicad_steps": Site(
        "the design-bundle builder's KiCad steps: the seeded-upgrade step reads a "
        "file's sheet names to hand it to KiCad; the parse itself is prism-kicad's",
        text=True,
    ),
    "app.release_studio.closure": Site(
        "a KiCad-output job: rewrites the bundle closure's model references",
        text=True,
    ),
    "app.release_studio.closure_models": Site(
        "a KiCad-output job: the closure's model-reference forms in the bundle's sources",
        text=True,
    ),
    "app.services.catalog.mates": Site(
        f"{_LIBRARY_TEXT}: reads .kicad_sym/.kicad_mod text with kicad_monkey "
        "until the library ADR (R2)",
        parsers=frozenset({"kicad_monkey"}),
    ),
    "app.services.catalog.models": Site(
        f"{_LIBRARY_TEXT}: converts a catalog STEP model to GLB with Geometer",
        parsers=frozenset({"geometer"}),
    ),
    "app.services.catalog.dbl_export": Site(
        f"{_LIBRARY_TEXT}: writes library forms for a database-library export",
        text=True,
    ),
    "app.services.catalog.placement_payloads": Site(
        f"{_LIBRARY_TEXT}: writes the symbol and footprint forms a placement stamps",
        text=True,
    ),
    "app.services.catalog.placement_stamp": Site(
        f"{_LIBRARY_TEXT}: reads back the schematic stamp a placement wrote",
        text=True,
    ),
    "app.services.catalog.postgres_projections": Site(
        f"{_LIBRARY_TEXT}: projects stored library text into catalog rows",
        text=True,
    ),
    "app.services.kicad_footprint_normalizer": Site(
        "pcbnew runs in its own subprocess to flip a library footprint into the "
        "catalog asset store; the API process never loads it",
        parsers=frozenset({"pcbnew"}),
    ),
    "app.services.kicad_library_reader": Site(
        "the one catalog library-text reader: form ends, symbol blocks and "
        "properties, footprint names and model references",
        text=True,
    ),
    "app.services.project_component_asset_extractor": Site(
        "shared library-text helpers for the catalog's bundle-backed component index",
        text=True,
    ),
    "app.services.project_component_bundle_assets": Site(
        "the catalog's component asset index reads the bundle's sources and its "
        "own symbol/footprint library tables; it never parses a revision",
        text=True,
    ),
}


@dataclass(frozen=True)
class Violation:
    """One import or design-text literal outside the allow-list."""

    module: str
    line: int
    kind: str
    text: str

    def describe(self) -> str:
        return f"{self.module}:{self.line}: {self.kind}: {self.text}"


def _module_name(path: Path) -> str:
    relative = path.relative_to(APP.parent).with_suffix("")
    parts = list(relative.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _covers(module: str, prefix: str) -> bool:
    return module == prefix or module.startswith(prefix + ".")


def _imported_parser_names(tree: ast.AST) -> list[tuple[int, str]]:
    """Every KiCad-parser import and its line, module-level or local."""

    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] in KICAD_PARSERS:
                    found.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            if node.module.split(".")[0] in KICAD_PARSERS:
                found.append((node.lineno, node.module))
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "__import__"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            name = node.args[0].value
            if name.split(".")[0] in KICAD_PARSERS:
                found.append((node.lineno, name))
    return found


def _design_text_literals(tree: ast.AST) -> list[tuple[int, str]]:
    """Every string literal (docstrings included) with an s-expression opener."""

    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            for match in DESIGN_TEXT.finditer(node.value):
                found.append((node.lineno, match.group(0)))
    return found


def scan() -> tuple[list[Violation], set[tuple[str, str]]]:
    """Offenders outside the allow-list, and the allowances that were used.

    A used allowance is ``(module, parser)`` or ``(module, "text")``.
    """

    violations: list[Violation] = []
    used: set[tuple[str, str]] = set()
    for path in sorted(APP.rglob("*.py")):
        module = _module_name(path)
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        site = KICAD_IMPORT_SITES.get(module, Site(""))
        for line, name in _imported_parser_names(tree):
            parser = name.split(".")[0]
            if parser in site.parsers:
                used.add((module, parser))
            else:
                violations.append(Violation(module, line, "parser import", name))
        for line, text in _design_text_literals(tree):
            if site.text:
                used.add((module, "text"))
            else:
                violations.append(Violation(module, line, "KiCad design text", text))
    return violations, used


def _allowances() -> set[tuple[str, str]]:
    allowed: set[tuple[str, str]] = set()
    for module, site in KICAD_IMPORT_SITES.items():
        allowed.update((module, parser) for parser in site.parsers)
        if site.text:
            allowed.add((module, "text"))
    return allowed


class DesignSourceBoundaryTests(unittest.TestCase):
    def test_nothing_outside_the_allow_list_imports_a_parser_or_design_text(self) -> None:
        violations, _ = scan()
        if violations:
            self.fail(
                "modules under backend/app import a KiCad parser or carry KiCad "
                "design text outside the design bundle, the KiCad-output jobs and "
                "the catalog library reader:\n"
                + "\n".join(f"  {violation.describe()}" for violation in violations)
            )

    def test_the_allow_list_has_no_stale_entries(self) -> None:
        _, used = scan()
        stale = sorted(_allowances() - used)
        self.assertEqual(
            stale,
            [],
            "allow-list allowances no longer used; narrow or delete the entry:\n  "
            + "\n  ".join(f"{module}: {what}" for module, what in stale),
        )
        for module, site in KICAD_IMPORT_SITES.items():
            with self.subTest(module=module):
                self.assertTrue(site.reason.strip(), "an allow-list entry needs a reason")
                self.assertTrue(site.parsers or site.text, "an entry must allow something")

    def test_the_report_names_the_module_line_and_matched_text(self) -> None:
        violation = Violation(
            "app.services.example", 12, "parser import", "kicad_monkey.kicad_pcb"
        )
        self.assertEqual(
            violation.describe(),
            "app.services.example:12: parser import: kicad_monkey.kicad_pcb",
        )


if __name__ == "__main__":
    unittest.main()
