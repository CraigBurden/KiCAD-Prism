"""Path references in a release closure's design files.

A bundle's ``prism.project.a0`` names the design's documents and the
path-bearing nodes in them; :mod:`app.release_studio.closure` resolves what
:class:`ProjectReferences` carries.  ``is_path_reference`` is the one filter
that decides whether a substituted value names a filesystem path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping

VARIABLE_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
# Variables the executor binds at run time rather than the project supplying.
# `JOBSET_OUTPUT_WORK_PATH` is KiCad's temporary output directory for a
# `special_execute` job (pinned source `common/jobs/job_special_execute.h:26`);
# it names an output, never an input, so it cannot resolve into the closure.
_TOOL_PROVIDED_VARIABLES = frozenset({"JOBSET_OUTPUT_WORK_PATH"})


@dataclass(frozen=True)
class ProjectReferences:
    """One revision's design documents and path references, from ``prism.project.a0``.

    ``documents`` are the board, root schematic and every reachable sheet (paths
    relative to the project anchor), and ``references`` are the parser's
    resolved path-bearing nodes. A plain data record, so
    :mod:`app.release_studio.closure` never imports the bundle package.
    """

    documents: tuple[str, ...] = ()
    references: tuple[Mapping[str, Any], ...] = ()


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


__all__ = [
    "ProjectReferences",
    "VARIABLE_RE",
    "is_path_reference",
]
