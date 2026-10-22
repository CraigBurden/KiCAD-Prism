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

``KICAD_IMPORT_SITES`` is the allow-list: module path prefix -> reason. The
second test fails when an entry no longer matches an import or literal, so the
list cannot rot. The failure report names the module, line and matched text.

This test subsumes ``test_kicad_monkey_allow_list.py`` (R2) and
``test_release_studio_import_boundary.py`` (C3): it covers every module under
``backend/app``, every forbidden package those tests named, and both
module-level and function-local imports (plus ``__import__``).
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

#: Module path prefix -> why it may import a parser or carry KiCad design text.
KICAD_IMPORT_SITES: dict[str, str] = {
    "app.services.design_bundle": (
        "the design-bundle builder and its KiCad steps: the board refill imports "
        "pcbnew in a subprocess, and the seeded-upgrade step reads a file's sheet "
        "names to hand it to KiCad; the parse itself is prism-kicad's"
    ),
    "app.release_studio": (
        "the KiCad-output jobs: kicad-cli steps over the bundle's refilled board "
        "and sources, the closure's model-reference forms, artwork and vendor "
        "outputs; no design model is parsed here"
    ),
    "app.services.catalog": (
        "the catalog library reader and its writers: mates reads .kicad_sym/"
        ".kicad_mod text with kicad_monkey, models converts a catalog STEP to GLB "
        "with Geometer, and the placement and export writers emit library and "
        "schematic forms; project revisions are read from bundles"
    ),
    "app.services.kicad_footprint_normalizer": (
        "pcbnew runs in its own subprocess to flip a library footprint into the "
        "catalog asset store; the API process never loads it"
    ),
    "app.services.kicad_library_reader": (
        "the one catalog library-text reader: form ends, symbol blocks and "
        "properties, footprint names and model references"
    ),
    "app.services.project_component_asset_extractor": (
        "shared library-text helpers for the catalog's bundle-backed component "
        "index; the checkout walk is gone with R1"
    ),
    "app.services.project_component_bundle_assets": (
        "the catalog's component asset index reads the bundle's sources and its "
        "own symbol/footprint library tables; it never parses a revision"
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


def scan() -> tuple[list[Violation], set[str]]:
    """Offenders outside the allow-list, and the allow-list entries that matched."""

    violations: list[Violation] = []
    matched: set[str] = set()
    for path in sorted(APP.rglob("*.py")):
        module = _module_name(path)
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        raw = [
            Violation(module, line, "parser import", name)
            for line, name in _imported_parser_names(tree)
        ] + [
            Violation(module, line, "KiCad design text", text)
            for line, text in _design_text_literals(tree)
        ]
        if not raw:
            continue
        covering = {prefix for prefix in KICAD_IMPORT_SITES if _covers(module, prefix)}
        if covering:
            matched.update(covering)
        else:
            violations.extend(raw)
    return violations, matched


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
        _, matched = scan()
        stale = sorted(set(KICAD_IMPORT_SITES) - matched)
        self.assertEqual(
            stale,
            [],
            "allow-list entries no longer match an import or design-text literal; "
            "delete a stale entry or fix the module it was hiding:\n  "
            + "\n  ".join(stale),
        )
        for prefix, reason in KICAD_IMPORT_SITES.items():
            with self.subTest(prefix=prefix):
                self.assertTrue(reason.strip(), "an allow-list entry needs a reason")

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
