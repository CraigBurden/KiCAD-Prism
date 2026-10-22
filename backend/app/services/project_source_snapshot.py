"""Resolve the identity of a project revision from its configured anchor (VAR-07).

A comment anchor must agree with the semantic index on what "this revision"
means, including for a project whose anchor is a board or schematic rather than
a ``.kicad_pro`` (PCB-only projects). The helpers wrap
``semantic_index_service``'s cache-identity rules with that anchor rule.

The variant catalog used to materialize a source snapshot through this module;
it now reads the design bundle (WP-X), so the checkout machinery is gone and
what remains is the identity seam ``comment_anchor_service`` uses. It reads Git
listings and names, never KiCad design text.
"""

from __future__ import annotations

import re
from functools import lru_cache
from types import SimpleNamespace
from pathlib import Path, PurePosixPath
from typing import Any, Optional

from app.services import (
    path_config_service,
    project_revision,
    semantic_index_service,
)

PROJECT_SUFFIXES = (".kicad_pro", ".kicad_pcb", ".kicad_sch")


def _anchor_source(project: Any, *, require_file: bool = True) -> Optional[Path]:
    """The anchor itself when it is a board or schematic rather than a project.

    PCB-only projects have no ``.kicad_pro``; the anchor that selected them is
    the board (or a lone schematic). ``find_kicad_project`` would raise for
    them, so the identity keys the same tree to the anchor that exists.
    """

    anchor = path_config_service.anchor_for_project(project)
    if not anchor or anchor.endswith(".kicad_pro"):
        return None
    if not anchor.endswith(PROJECT_SUFFIXES):
        return None
    candidate = (Path(project.path) / anchor).resolve()
    if not candidate.is_relative_to(Path(project.path).resolve()):
        raise ValueError("Configured source is outside the project")
    if require_file and not candidate.is_file():
        raise ValueError(f"Configured source not found at the anchor: {anchor}")
    return candidate


def project_revision_identity(
    project: Any, commit: Optional[str] = None
) -> tuple[str, Optional[str]]:
    """The index's own ``(sourceRevisionKey, resolved commit)`` for a revision.

    Wrapping ``semantic_index_service._revision_identity`` keeps the anchor and
    the semantic index agreeing on what "this revision" means; the two must
    cache under the same key or a selection would pair mismatched data. For a
    board/schematic anchor the same primitives are applied with that anchor,
    which is the identity rule the index uses for ``project_file_rel``.
    """

    if commit and re.fullmatch(r"[0-9a-fA-F]{40}", commit):
        return _immutable_revision_identity(
            str(project.path), path_config_service.anchor_for_project(project), commit.lower()
        )
    return _revision_identity_uncached(project, commit)


@lru_cache(maxsize=512)
def _immutable_revision_identity(path: str, anchor: str | None, commit: str) -> tuple[str, Optional[str]]:
    # A full object ID names immutable content; branches and working trees must
    # still resolve/hash on every request. Cache no authorization decisions.
    return _revision_identity_uncached(SimpleNamespace(path=path, project_file=anchor), commit)


def _revision_identity_uncached(project: Any, commit: Optional[str]) -> tuple[str, Optional[str]]:
    anchor = path_config_service.anchor_for_project(project) or ""
    source = _anchor_source(project, require_file=not commit)
    if source is None:
        return semantic_index_service._revision_identity(project, commit)

    if not commit:
        entries = semantic_index_service._source_entries_on_disk(source.parent)
        key = semantic_index_service._revision_key(entries, project_file_rel=anchor)
        return key, None

    location = project_revision.locate(project)
    repo_root = location.repo_root
    resolved_commit = project_revision.resolve_commit(location, commit)
    try:
        source_rel = source.relative_to(repo_root).as_posix()
    except ValueError as error:
        raise ValueError(
            f"Configured source is not inside the repository: {anchor}"
        ) from error
    project_dir = PurePosixPath(source_rel).parent.as_posix()
    if project_dir == ".":
        project_dir = ""
    entries = semantic_index_service._source_entries_in_commit(
        repo_root, resolved_commit, project_dir
    )
    key = semantic_index_service._revision_key(entries, project_file_rel=anchor)
    return key, resolved_commit
