"""Find the path references in a release closure's design files.

A board, schematic, drawing sheet, library table, project file or Release
Studio YAML names other files through ``${VAR}`` paths, library-table URIs and
3D model paths.  ``closure.py`` resolves what this module finds.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable, Mapping

from app.release_studio.closure_models import EMBEDDED_PREFIX, is_model_reference

VARIABLE_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
# Variables the executor binds at run time rather than the project supplying.
# `JOBSET_OUTPUT_WORK_PATH` is KiCad's temporary output directory for a
# `special_execute` job (pinned source `common/jobs/job_special_execute.h:26`);
# it names an output, never an input, so it cannot resolve into the closure.
_TOOL_PROVIDED_VARIABLES = frozenset({"JOBSET_OUTPUT_WORK_PATH"})


def is_path_reference(value: str) -> bool:
    """Does this substituted value name a filesystem path?

    A bare ``${VAR}`` is not enough.  KiCad substitutes built-in *text*
    variables into ordinary field and drawing-sheet content -- ``${DNP}``,
    ``${REFERENCE}``, ``${VALUE}``, ``${ISSUE_DATE}`` and friends -- and
    treating those as library paths fails a build closed on a board that is
    perfectly hermetic.  A real path either carries a separator
    (``${KIPRJMOD}/../common``) or names a path variable outright.

    Library-table ``(uri ...)`` values do not come through here; they are
    already known to be paths and are resolved unconditionally.
    """

    if not VARIABLE_RE.search(value):
        return False
    if any(
        match.group(1).upper() in _TOOL_PROVIDED_VARIABLES
        for match in VARIABLE_RE.finditer(value)
    ):
        # KiCad binds these itself at run time and they name *outputs*, so they
        # are not closure inputs and must not fail resolution.
        return False
    if "/" in value or "\\" in value:
        return True
    match = VARIABLE_RE.fullmatch(value.strip())
    return match is not None and _is_path_variable(match.group(1))


def _is_path_variable(name: str) -> bool:
    """KiCad's path variables are ``KIPRJMOD`` and the ``*_DIR`` family."""

    upper = name.upper()
    return upper == "KIPRJMOD" or upper.endswith("_DIR") or upper.endswith("_PATH")


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
        # Imported here: closure.py imports this module.
        from app.release_studio.closure import ClosureError

        raise ClosureError(f"cannot parse closure input {path}: {exc}") from exc

    variable_values = [value for value in scalar_values if is_path_reference(value)]
    return uri_values, variable_values + models


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
