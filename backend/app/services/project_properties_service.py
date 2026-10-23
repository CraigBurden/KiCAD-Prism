"""The project card's document metadata, mapped from the design bundle.

``card_from_project_member`` maps ``projections/project.json``
(``prism.project.a0``, field-maps/project.md) to the two dicts the properties
panel renders: the root schematic's and the board's header fields and expanded
title block, spelled exactly as the pre-bundle card spelled them.

The API never parses a KiCad file for this (ADR §9.6 C8, §9.7 R1). Board
geometry is not in the member and is not derived here: it comes from
``kicad-cli`` through ``kicad_board_stats_service`` at import or sync time and
is passed in.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

__all__ = ["card_from_project_member"]


def _strip_project_directory(project_dir: str, path: str) -> str:
    """The document's path relative to the project directory, the card's spelling.

    The bundle member's paths are repository-relative (conventions §8); the card
    has always shown them relative to the project directory, so the anchor's
    directory has to come off here. A document outside the project directory is
    shown by its file name.
    """
    if not project_dir:
        return path
    prefix = project_dir.rstrip("/") + "/"
    return path[len(prefix):] if path.startswith(prefix) else path.rsplit("/", 1)[-1]


def _expanded_title_block(document: Mapping[str, Any]) -> Optional[dict]:
    """The two title-block fields the panel shows, from ``expandedTitleBlock``.

    The member drops a field whose expansion is empty (conventions §10) while
    the card keeps it as ``""``; defaulting to ``""`` gives back that value.
    ``expandedTitleBlock`` is present exactly when the file has a
    ``(title_block)``.
    """
    block = document.get("expandedTitleBlock")
    if block is None:
        return None
    return {"title": block.get("title", ""), "date": block.get("date", "")}


def _document_card(
    member: Mapping[str, Any],
    kind: str,
    board_facts: Optional[Mapping[str, Any]] = None,
) -> Optional[dict]:
    """One document of a ``prism.project.a0`` member as the card dict.

    ``None`` when the member has no document of ``kind`` -- a project without
    that file.
    """
    project_file = str(member.get("projectFile") or "")
    project_dir = project_file.rsplit("/", 1)[0] if "/" in project_file else ""
    for document in member.get("documents") or []:
        if document.get("kind") != kind:
            continue
        path = str(document.get("path") or "")
        card = {
            "path": _strip_project_directory(project_dir, path),
            "filename": path.rsplit("/", 1)[-1],
            "version": document.get("formatVersion"),
            "generator": document.get("generator"),
            "generator_version": document.get("generatorVersion"),
            "title_block": _expanded_title_block(document),
        }
        if kind == "board":
            facts = board_facts or {}
            card["dimensions_mm"] = facts.get("dimensions_mm")
            card["thickness_mm"] = facts.get("thickness_mm")
        return card
    return None


def card_from_project_member(
    member: Mapping[str, Any], board_facts: Optional[Mapping[str, Any]] = None
) -> dict[str, Optional[dict]]:
    """The card's ``schematic`` and ``pcb`` dicts from a ``prism.project.a0`` member.

    The field map's "Card" rule: the root schematic's and board's header fields
    and expanded title block. Board size and thickness come from ``kicad-cli``
    (ADR §2.1) and are passed in, not read from the member.
    """
    return {
        "schematic": _document_card(member, "root-schematic"),
        "pcb": _document_card(member, "board", board_facts),
    }
