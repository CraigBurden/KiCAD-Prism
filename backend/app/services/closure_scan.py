"""Find the path references in a KiCad checkout's design files.

Release Studio no longer uses this: it reads a design bundle's
``prism.project.a0`` instead (ADR amendment C3, C3d).  System Builder's
``system_board_step`` job still materializes a closure from a checkout with no
bundle, so the scan lives here, outside the Release Studio boundary that must
not import ``kicad_monkey`` (ADR amendment C3 §4).

``closure.py`` resolves what this module finds.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from app.release_studio.closure_models import EMBEDDED_PREFIX, is_model_reference

VARIABLE_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")

# `.kicad_jobset` is deliberately absent.  A jobset's variables name *outputs*
# and a `special_execute` job carries an arbitrary command line whose paths are
# that command's own concern, not project inputs -- the reference jobset invokes
# a plugin via `${KICAD9_3RD_PARTY}`, which is neither a project library nor
# something the closure could contain.  Scraping it here would fail a build that
# is hermetic: jobset hermeticity is judged by R1 over each output's *selected*
# closure, which is where an executed command is correctly classified.
_PATH_INPUT_SUFFIXES = {
    ".kicad_pcb",
    ".kicad_pro",
    ".kicad_sch",
    ".kicad_wks",
    ".yaml",
    ".yml",
}


def structured_path_references(
    path: str,
    text: str,
    *,
    library_table: bool = False,
) -> tuple[list[str], list[str]]:
    """Read path-bearing values through format owners, never delimiters."""

    suffix = Path(path).suffix.casefold()
    name = Path(path).name.casefold()
    uri_values: list[str] = []
    scalar_values: list[str] = []
    models: list[str] = []
    try:
        if name in {"fp-lib-table", "sym-lib-table"} or suffix in {
            ".kicad_pcb",
            ".kicad_sch",
            ".kicad_wks",
        }:
            from kicad_monkey import parse_sexp

            tree = parse_sexp(text)
            for form in _walk_structured_values(tree):
                if isinstance(form, list) and form:
                    if (
                        library_table
                        and str(form[0]).casefold() == "uri"
                        and len(form) > 1
                    ):
                        uri_values.append(str(form[1]))
                    elif (
                        suffix == ".kicad_pcb"
                        and str(form[0]).casefold() == "model"
                        and len(form) > 1
                        and _is_model_path(str(form[1]))
                    ):
                        # Absolute, relative, `:alias:` and `$(VAR)` forms
                        # carry no `${VAR}`, so the generic scan below skips
                        # them, but the tools still open them.
                        models.append(str(form[1]))
                elif isinstance(form, str):
                    scalar_values.append(str(form))
        elif suffix == ".kicad_pro":
            payload = json.loads(text)
            scalar_values.extend(
                str(value)
                for value in _walk_structured_values(payload)
                if isinstance(value, str)
            )
        elif suffix in {".yaml", ".yml"}:
            import yaml

            payload = yaml.safe_load(text)
            scalar_values.extend(
                str(value)
                for value in _walk_structured_values(payload)
                if isinstance(value, str)
            )
    except Exception as exc:
        from app.release_studio.closure import ClosureError

        raise ClosureError(f"cannot parse closure input {path}: {exc}") from exc

    variable_values = [value for value in scalar_values if is_path_reference(value)]
    return uri_values, variable_values + models


def is_path_reference(value: str) -> bool:
    """Does this substituted value name a filesystem path?

    A bare ``${VAR}`` is not enough.  KiCad substitutes built-in *text*
    variables into ordinary field and drawing-sheet content -- ``${DNP}``,
    ``${REFERENCE}``, ``${VALUE}``, ``${ISSUE_DATE}`` and friends -- and
    treating those as library paths fails a build closed on a board that is
    perfectly hermetic.  A real path either carries a separator
    (``${KIPRJMOD}/../common``) or names a path variable outright.
    """

    if not VARIABLE_RE.search(value):
        return False
    if any(
        match.group(1).upper() in _TOOL_PROVIDED_VARIABLES
        for match in VARIABLE_RE.finditer(value)
    ):
        return False
    if "/" in value or "\\" in value:
        return True
    match = VARIABLE_RE.fullmatch(value.strip())
    return match is not None and _is_path_variable(match.group(1))


# Variables the executor binds at run time rather than the project supplying.
_TOOL_PROVIDED_VARIABLES = frozenset({"JOBSET_OUTPUT_WORK_PATH"})


def _is_path_variable(name: str) -> bool:
    upper = name.upper()
    return upper == "KIPRJMOD" or upper.endswith("_DIR") or upper.endswith("_PATH")


def _is_model_path(value: str) -> bool:
    """A ``(model ...)`` value the tools open from disk.

    A ``kicad-embed://`` model is read out of the board, which the closure
    already pins.  An absolute path is kept whatever its suffix, as before.
    """

    if value.startswith(EMBEDDED_PREFIX):
        return False
    return value.startswith("/") or is_model_reference(value)


def _walk_structured_values(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, Mapping):
        for child in value.values():
            yield from _walk_structured_values(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from _walk_structured_values(child)


def is_path_input(path: str) -> bool:
    suffix = Path(path).suffix.casefold()
    return suffix in _PATH_INPUT_SUFFIXES or Path(path).name.casefold() in {
        "fp-lib-table",
        "sym-lib-table",
    }


def design_inputs(
    destination: Path,
    repository_inputs: Sequence[Any],
    project_rel: str,
) -> set[str]:
    """The files whose path references belong to *this* design.

    A repository holds more KiCad files than a release is made of.  Scanning all
    of them made an archived revision's stale library paths look like defects in
    the release under construction -- most of the hermeticity findings on a real
    project came from boards that are not in it.

    The design is therefore delimited structurally: the board, project and root
    schematics in the project directory; every schematic reachable from those
    roots through ``Sheetfile``, at any depth; every schematic sitting in a
    directory a root sheet points into; library tables wherever they sit; and
    this project's own ``.prism`` configuration.
    """

    prefix = "" if project_rel in ("", ".") else f"{project_rel.rstrip('/')}/"
    by_path = {item.path: item for item in repository_inputs if item.type == "regular_file"}

    def in_project(path: str) -> bool:
        return path.startswith(prefix)

    def local(path: str) -> str:
        return path[len(prefix):]

    def at_root(path: str) -> bool:
        return in_project(path) and "/" not in local(path)

    selected: set[str] = set()
    roots: list[str] = []
    for path in by_path:
        name = path.rsplit("/", 1)[-1].casefold()
        suffix = Path(path).suffix.casefold()
        if name in {"fp-lib-table", "sym-lib-table"}:
            selected.add(path)
        elif suffix in {".yaml", ".yml"} and in_project(path) and local(path).startswith(".prism/"):
            selected.add(path)
        elif at_root(path) and suffix in {".kicad_pcb", ".kicad_pro", ".kicad_wks"}:
            selected.add(path)
        elif at_root(path) and suffix == ".kicad_sch":
            selected.add(path)
            roots.append(path)

    sibling_dirs: set[str] = set()
    pending = list(roots)
    seen = set(roots)
    while pending:
        current = pending.pop()
        for child in sheet_references(destination, current):
            if child in by_path and child not in seen:
                seen.add(child)
                selected.add(child)
                pending.append(child)
            if current in roots:
                sibling_dirs.add(child.rsplit("/", 1)[0] if "/" in child else "")

    for path in by_path:
        if Path(path).suffix.casefold() != ".kicad_sch":
            continue
        directory = path.rsplit("/", 1)[0] if "/" in path else ""
        if directory in sibling_dirs:
            selected.add(path)

    return selected


def sheet_references(destination: Path, schematic: str) -> list[str]:
    """Repository-relative paths of the sheets *schematic* instantiates."""

    try:
        text = read_materialized_text(destination, schematic)
    except OSError:
        return []
    try:
        from kicad_monkey import find_all_elements, parse_sexp, unquote_string

        root = parse_sexp(text)
    except Exception as exc:
        from app.release_studio.closure import ClosureError

        raise ClosureError(
            f"cannot parse schematic hierarchy with kicad-monkey: {schematic}: {exc}"
        ) from exc
    base = schematic.rsplit("/", 1)[0] if "/" in schematic else ""
    children: list[str] = []
    for sheet in find_all_elements(root, "sheet"):
        for prop in find_all_elements(sheet, "property"):
            if len(prop) < 3 or str(unquote_string(prop[1])).casefold() not in {
                "sheetfile",
                "sheet file",
            }:
                continue
            reference = str(unquote_string(prop[2]) or "").strip()
            if not reference or reference.startswith("${") or "://" in reference:
                continue
            resolved = join_relative(base, reference)
            if resolved is not None:
                children.append(resolved)
    return children


def join_relative(base: str, reference: str) -> str | None:
    """Resolve *reference* against *base*, or ``None`` if it leaves the tree.

    A monorepo sheet may legitimately be reached as ``../common/Power.kicad_sch``,
    so ``..`` is collapsed rather than rejected -- but a reference that climbs
    past the repository root names nothing in the closure and is dropped.
    """

    reference = reference.replace("\\", "/")
    if reference.startswith("/"):
        return None
    parts = (base.split("/") if base else []) + reference.split("/")
    stack: list[str] = []
    for part in parts:
        if part in {"", "."}:
            continue
        if part == "..":
            if not stack:
                return None
            stack.pop()
            continue
        stack.append(part)
    return "/".join(stack) or None


def read_materialized_text(destination: Path, relative_path: str) -> str:
    from app.release_studio.closure import _materialized_path

    path = _materialized_path(destination, relative_path)
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Binary inputs cannot contain a meaningful KiCad path reference.
        return ""


__all__ = [
    "VARIABLE_RE",
    "design_inputs",
    "is_path_input",
    "is_path_reference",
    "join_relative",
    "read_materialized_text",
    "sheet_references",
    "structured_path_references",
]
