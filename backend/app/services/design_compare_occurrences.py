"""Component occurrences of one revision, as design comparison reads them.

A component occurrence is one placed symbol at one sheet-instance path: its
designator, fields, DNP and BOM flags, and the schematic symbol and PCB
footprint that carry it. The parser reports the symbol's own flags; KiCad also
lets a hierarchical sheet mark everything inside it DNP or excluded from the
BOM, and those sheet flags are folded on here, along the occurrence's path, the
way the project semantic index folds them (``semantic_index_variants``).

The BOM diff, net matching (a terminal's parent part) and the review rows'
component identity all read this module, so they see one answer.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional

from app.services import project_revision, semantic_index_service, kicad_library_reader


def component_uid(reference: str) -> str:
    """A designator's identity across revisions (one review row per part)."""

    return semantic_index_service._stable_uid("cmp", str(reference))


def is_power_symbol(item: Mapping[str, Any]) -> bool:
    """Power ports and PWR_FLAG markers are connectivity, never components."""

    return (
        str(item.get("kind") or "") == "symbol"
        and str(item.get("libId") or "").casefold().startswith("power:")
    )


# Only quotes and parentheses change the nesting depth; a quoted string is
# swallowed whole so a value like "Sheet (A)" cannot unbalance the walk.
_SEXPR_TOKENS = re.compile(r'"(?:[^"\\]|\\.)*"|[()]')
_SHEET_FLAG = re.compile(r"\((dnp|in_bom)\s+(yes|no)\)")
_SHEET_UUID = re.compile(r'\(uuid\s+"((?:\\.|[^"\\])*)"\)')


def _sheet_attributes(block: str) -> Dict[str, Any]:
    """The sheet's own ``uuid``/``dnp``/``in_bom``, never a nested record's.

    A sheet's ``instances`` hold per-variant ``(variant … (dnp yes))`` records;
    only the sheet form's direct children are its default state.
    """

    attributes: Dict[str, Any] = {}
    depth = 0
    for token in _SEXPR_TOKENS.finditer(block):
        if token.group() == "(":
            depth += 1
            if depth != 2:
                continue
            flag = _SHEET_FLAG.match(block, token.start())
            if flag:
                attributes[flag.group(1)] = flag.group(2) == "yes"
                continue
            uuid = _SHEET_UUID.match(block, token.start())
            if uuid:
                attributes["uuid"] = uuid.group(1)
        elif token.group() == ")":
            depth -= 1
    return attributes


def sheet_flags(snapshot: Optional[Path]) -> Dict[str, Dict[str, bool]]:
    """``{sheet symbol uuid: {"dnp", "excludeFromBom"}}`` for flagged sheets."""

    if snapshot is None or not snapshot.is_dir():
        return {}
    flags: Dict[str, Dict[str, bool]] = {}
    for path in sorted(snapshot.rglob("*.kicad_sch")):
        if project_revision.is_generated(path.relative_to(snapshot).as_posix()):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for block in kicad_library_reader.iter_forms(text, "sheet"):
            attributes = _sheet_attributes(block)
            uuid = attributes.get("uuid")
            dnp = bool(attributes.get("dnp", False))
            excluded = attributes.get("in_bom") is False
            if uuid and (dnp or excluded):
                flags[str(uuid)] = {"dnp": dnp, "excludeFromBom": excluded}
    return flags


def _ancestor_flags(
    path: str, symbol_uuid: str, sheets: Mapping[str, Mapping[str, bool]]
) -> Iterable[Mapping[str, bool]]:
    segments = [segment for segment in path.split("/") if segment]
    if segments and segments[-1] == symbol_uuid:
        segments = segments[:-1]
    return [sheets[segment] for segment in segments if segment in sheets]


def revision_components(side: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """One component per symbol occurrence of a parsed revision.

    ``side`` is one revision of the parser's object delta: its
    ``componentObjects``, and its ``root``, the snapshot directory the parser
    read, which is scanned for sheet-level DNP / exclude-from-BOM. A side
    without a root keeps the symbols' own flags.
    """

    root = side.get("root")
    sheets = sheet_flags(Path(str(root)) if root else None)
    footprints = {
        str(item.get("refdes")): item
        for item in side.get("componentObjects") or []
        if item.get("kind") == "footprint" and item.get("refdes")
    }
    components: List[Dict[str, Any]] = []
    for item in side.get("componentObjects") or []:
        if item.get("kind") != "symbol" or is_power_symbol(item):
            continue
        symbol_uuid = str(item["uuid"])
        properties = {
            str(prop.get("name")): prop.get("value")
            for prop in item.get("properties") or []
            if prop.get("name")
        }
        instances = item.get("instances") or [{"reference": item.get("refdes")}]
        for instance in instances:
            reference = str(instance.get("reference") or item.get("refdes") or "")
            if not reference:
                continue
            path = str(instance.get("path") or "")
            sheet_path = (
                path[: -(len(symbol_uuid) + 1)] or "/"
                if path.endswith(f"/{symbol_uuid}")
                else "/"
            )
            ancestors = _ancestor_flags(path, symbol_uuid, sheets)
            dnp = bool(item.get("dnp")) or any(sheet["dnp"] for sheet in ancestors)
            in_bom = item.get("inBom") is not False and not any(
                sheet["excludeFromBom"] for sheet in ancestors
            )
            footprint = footprints.get(reference)
            fields = {
                key: "" if value is None else str(value)
                for key, value in properties.items()
            }
            fields["kicad_in_bom"] = "true" if in_bom else "false"
            fields["kicad_dnp"] = "true" if dnp else "false"
            components.append(
                {
                    "componentUid": component_uid(reference),
                    "reference": reference,
                    "value": str(properties.get("Value") or ""),
                    "footprint": str(properties.get("Footprint") or ""),
                    "fields": fields,
                    "schematicRefs": [
                        {
                            "sheetInstancePath": sheet_path,
                            "page": item.get("documentPath"),
                            "symbolUuid": item["uuid"],
                        }
                    ],
                    "pcbRefs": (
                        [{"footprintUuid": footprint["uuid"]}]
                        if footprint is not None
                        else []
                    ),
                }
            )
    return components


def bom_rows(components: Iterable[Mapping[str, Any]]) -> List[Dict[str, str]]:
    """BOM rows for the components KiCad puts in the BOM, by designator.

    Every field the occurrence carries becomes a column, so the BOM diff can
    offer each one without another export.
    """

    rows: List[Dict[str, str]] = []
    for component in components:
        reference = str(component.get("reference") or "").strip()
        if not reference:
            continue
        fields = {
            str(key): "" if value is None else str(value)
            for key, value in (component.get("fields") or {}).items()
            if str(key)
        }
        if fields.get("kicad_in_bom", "true").strip().casefold() == "false":
            continue
        rows.append(
            {
                **fields,
                "Reference": reference,
                "Value": str(component.get("value") or fields.get("Value") or ""),
                "Footprint": str(
                    component.get("footprint") or fields.get("Footprint") or ""
                ),
            }
        )
    return sorted(rows, key=lambda row: row["Reference"])
