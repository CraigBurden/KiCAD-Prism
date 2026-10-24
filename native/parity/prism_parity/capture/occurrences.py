"""Golden for ``projections/occurrences.json`` (``prism.occurrences.a0``).

Field map ``occurrences.md``, "How a golden is produced from today's code":

1. today's outputs (``occurrences_checks.today_outputs``): ``ecad-diff.mjs`` on a
   copy of the case under ``ctx.scratch`` (``ECAD_INDEX_CACHE=0``), then Design
   Comparison's ``revision_components``/``bom_rows``, the semantic index's
   ``build_assembly_state`` and ``build_semantic_index``, System Builder's
   ``extract_interface``, the catalog's ``placed_symbols`` and Release Studio's
   ``project_variants``;
2. the golden (``build`` below): the W0 prototype producer, built from the same
   kicad_monkey 2026.9.7 model with today's helpers
   (``semantic_index_variants._build_schematic_graph``, ``_ancestor_sheet_flags``,
   ``_fold_sheet_flags``, ``_symbol_flags``; ``semantic_index_service._canonical_fields``
   called as Design Comparison calls it; ``release_studio.projections._footprint_reference``);
3. the field map's reading rules re-derive every consumer's output from the
   golden alone and compare it with step 1 (``Result.checks``).

Sources are upgraded to KiCad 10.0.6's format before this runs
(``kicad-seeded-upgrade-a0``), so footprint ids are the form's ``(uuid …)``
only: the prototype's KiCad 7 ``(tstamp …)`` fallback is gone (decisions.md,
Occurrences 1).
"""

from __future__ import annotations

import re
from pathlib import Path

from . import Context, NotCaptured, Result

MEMBER = "occurrences"
SCHEMA = "prism.occurrences.a0"

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# Canonical BOM label -> OccurrencesBomFields field (field map, "Canonical BOM labels").
BOM_FIELD_NAMES = {
    "Value": "value",
    "Description": "description",
    "Datasheet": "datasheet",
    "Manufacturer": "manufacturer",
    "Manufacturer Part Number": "manufacturerPartNumber",
    "Vendor": "vendor",
    "Vendor Part Number": "vendorPartNumber",
    "Footprint": "footprint",
    "Mass (g)": "mass",
    "RQjC (C/W)": "rqjc",
    "RQjC_top (C/W)": "rqjcTop",
    "Temp_max (C)": "tempMax",
    "Temp_min (C)": "tempMin",
    "Power Dissipation (W)": "powerDissipation",
    "Rate": "rate",
}

SHEET_FLAGS = ("dnp", "excludeFromBom", "excludeFromBoard", "excludeFromSim")


def empty_document() -> dict:
    return {"schema": SCHEMA, "sheets": [], "symbols": [], "footprints": [], "references": [], "variantDeclarations": []}


# ------------------------------------------------------------------ helpers


def _relative(root: Path, path) -> str:
    return Path(path).resolve().relative_to(root.resolve()).as_posix()


def _symbol_properties(symbol) -> dict[str, str]:
    """Properties as written; the last duplicate name wins (field map, ``properties``)."""

    out: dict[str, str] = {}
    for prop in getattr(symbol, "properties", []) or []:
        key = getattr(prop, "key", None) or getattr(prop, "name", "")
        if key:
            out[str(key)] = "" if getattr(prop, "value", None) is None else str(prop.value)
    return out


def _bom_fields(properties: dict[str, str]) -> dict[str, str]:
    """``_canonical_fields`` called as ``design_compare_occurrences._bom_fields`` calls it."""

    from app.services import semantic_index_service

    canonical = semantic_index_service._canonical_fields(
        {
            "parameters": dict(properties),
            "value": properties.get("Value"),
            "footprint": properties.get("Footprint"),
        }
    )
    return {BOM_FIELD_NAMES[label]: canonical[label] for label in BOM_FIELD_NAMES if canonical.get(label)}


def _record(record, *, holder: str, version=None) -> dict:
    """One raw ``(variant …)`` record as ``OccurrencesVariantRecord``."""

    from app.services.semantic_index_variants import _legacy_in_bom

    out: dict = {"name": str(record.name)}
    if getattr(record, "dnp", None) is not None:
        out["dnp"] = bool(record.dnp)
    fields: dict[str, str] = {}
    if holder == "footprint":
        if getattr(record, "exclude_from_bom", None) is not None:
            out["excludeFromBom"] = bool(record.exclude_from_bom)
        if getattr(record, "exclude_from_pos_files", None) is not None:
            out["excludeFromPosFiles"] = bool(record.exclude_from_pos_files)
        for item in getattr(record, "fields", None) or []:
            fields[str(item.name)] = str(item.value)
    else:
        in_bom = getattr(record, "in_bom", None)
        if in_bom is not None:
            # The record's in_bom is read by the version of the file holding it (siv:145-153).
            out["excludeFromBom"] = bool(in_bom) if _legacy_in_bom(version) else not bool(in_bom)
        if getattr(record, "on_board", None) is not None:
            out["excludeFromBoard"] = not bool(record.on_board)
        if getattr(record, "exclude_from_sim", None) is not None:
            out["excludeFromSim"] = bool(record.exclude_from_sim)
        if holder == "symbol" and getattr(record, "in_pos_files", None) is not None:
            out["excludeFromPosFiles"] = not bool(record.in_pos_files)
        for item in getattr(record, "fields", None) or []:
            if isinstance(item, (tuple, list)):
                fields[str(item[0])] = str(item[1])
            else:
                fields[str(item.name)] = str(item.value)
    out["fields"] = dict(sorted(fields.items()))
    return out


def _matched_instance(symbol, sheet_path: str, project_stem: str):
    """The instance record whose path is the sheet path; the project named after the anchor wins.

    No suffix matching and no first-instance fallback (field map, "Instance record").
    """

    matches = [inst for inst in getattr(symbol, "instances", []) or [] if getattr(inst, "path", None) == sheet_path]
    if not matches:
        return None
    for inst in matches:
        if getattr(inst, "project", None) == project_stem:
            return inst
    return matches[0]


# -------------------------------------------------------------------- build


def build(src: Path, project_file: Path, design) -> tuple[dict, list[str]]:
    """The W0 prototype producer (``proto_occurrences.py``), on the prepared copy."""

    from kicad_monkey.kicad_project import KiCadProject
    from kicad_monkey.kicad_variants import resolve_symbol

    from app.release_studio.projections import _footprint_reference
    from app.services import semantic_index_variants as siv

    notes: list[str] = []
    project_stem = project_file.stem
    sheets: list[dict] = []
    symbols: list[dict] = []

    if design.top_schematic is not None:
        graph = siv._build_schematic_graph(design, project_file)
        for instance in graph.instances:
            sheet_path = instance.sheet_instance_path
            ancestors = siv._ancestor_sheet_flags(instance, graph, None)
            folded = siv._fold_sheet_flags({flag: False for flag in SHEET_FLAGS}, ancestors)
            sheet_variants: list[dict] = []
            sheet_symbol = getattr(instance, "sheet_symbol", None)
            parent_path = getattr(instance, "parent_sheet_instance_path", None)
            if sheet_symbol is not None:
                parent = graph.by_path.get(parent_path)
                version = getattr(parent.schematic, "version", graph.version) if parent else graph.version
                for inst in getattr(sheet_symbol, "instances", []) or []:
                    if getattr(inst, "path", None) == parent_path:
                        sheet_variants = [_record(r, holder="sheet", version=version) for r in inst.variants or []]
                        break
            sheets.append({"sheetPath": sheet_path, **folded, "variants": sheet_variants})

            schematic = instance.schematic
            version = getattr(schematic, "version", graph.version)
            document_path = _relative(src, instance.source_path)
            for symbol in getattr(schematic, "symbols", []) or []:
                if not getattr(symbol, "lib_id", None):
                    continue
                if not UUID.match(str(getattr(symbol, "uuid", "") or "")):
                    notes.append(f"occurrences-symbol-without-uuid: {document_path} {symbol.lib_id}")
                    continue
                properties = _symbol_properties(symbol)
                matched = _matched_instance(symbol, sheet_path, project_stem)
                if matched is not None:
                    reference = str(getattr(matched, "reference", "") or "")
                    unit = int(getattr(matched, "unit", None) or getattr(symbol, "unit", None) or 1)
                    records = [_record(r, holder="symbol", version=version) for r in matched.variants or []]
                else:
                    reference = properties.get("Reference", "")
                    unit = int(getattr(symbol, "unit", None) or 1)
                    records = []
                if unit < 1:
                    notes.append(f"occurrences-unit-invalid: {sheet_path}/{symbol.uuid}")
                    continue
                own = siv._symbol_flags(resolve_symbol(symbol, None, sheet_path), None, version)
                flags = siv._fold_sheet_flags(own, ancestors)
                entry = {
                    "kiidPath": f"{sheet_path}/{symbol.uuid}",
                    "sheetPath": sheet_path,
                    "symbolUuid": str(symbol.uuid),
                    "documentPath": document_path,
                    "libId": str(symbol.lib_id),
                }
                if reference:
                    entry["reference"] = reference
                entry.update(
                    {
                        "instanceMatched": matched is not None,
                        "unit": unit,
                        "dnp": flags["dnp"],
                        "excludeFromBom": flags["excludeFromBom"],
                        "excludeFromBoard": flags["excludeFromBoard"],
                        "excludeFromSim": flags["excludeFromSim"],
                        "excludeFromPosFiles": flags["excludeFromPosFiles"],
                        "properties": dict(sorted(properties.items())),
                        "bomFields": _bom_fields(properties),
                        "variants": records,
                    }
                )
                symbols.append(entry)

    footprints: list[dict] = []
    pcb = design.pcb if design.pcb_path and Path(design.pcb_path).is_file() else None
    if pcb is not None:
        board_rel = _relative(src, design.pcb_path)
        for footprint in pcb.footprints or []:
            footprint_id = str(getattr(footprint, "uuid", "") or "")
            if not UUID.match(footprint_id):
                notes.append(f"occurrences-footprint-without-uuid: {board_rel} {footprint_id!r}")
                continue
            entry = {"uuid": footprint_id, "documentPath": board_rel}
            reference = _footprint_reference(footprint)
            if reference:
                entry["reference"] = reference
            entry.update(
                {
                    "dnp": bool(footprint.is_dnp),
                    "excludeFromBom": bool(footprint.is_excluded_from_bom),
                    "excludeFromPosFiles": bool(footprint.is_excluded_from_pos_files),
                    "variants": [_record(r, holder="footprint") for r in footprint.variants or []],
                }
            )
            footprints.append(entry)

    by_reference: dict[str, dict] = {}
    for symbol in symbols:
        if "reference" in symbol:
            by_reference.setdefault(symbol["reference"], {"reference": symbol["reference"], "symbols": [], "footprints": []})[
                "symbols"
            ].append(symbol["kiidPath"])
    for footprint in footprints:
        if "reference" in footprint:
            by_reference.setdefault(
                footprint["reference"], {"reference": footprint["reference"], "symbols": [], "footprints": []}
            )["footprints"].append(footprint["uuid"])
    references = [by_reference[key] for key in sorted(by_reference)]

    declarations: list[dict] = []
    project = KiCadProject.from_file(project_file)
    for variant in project.variants:
        if variant.name:
            item = {"source": "project", "name": variant.name}
            if variant.description:
                item["description"] = variant.description
            declarations.append(item)
    if pcb is not None:
        for variant in getattr(pcb, "variants", []) or []:
            if variant.name:
                item = {"source": "pcb", "name": variant.name}
                if variant.description:
                    item["description"] = variant.description
                declarations.append(item)

    return {
        "schema": SCHEMA,
        "sheets": sheets,
        "symbols": symbols,
        "footprints": footprints,
        "references": references,
        "variantDeclarations": declarations,
    }, notes


def capture(ctx: Context) -> Result:
    from kicad_monkey import KiCadDesign

    from .occurrences_checks import run_checks

    pro = ctx.project_file.resolve()
    src = ctx.src.resolve()
    try:
        design = KiCadDesign.from_project_file(pro)
        # Touch both documents so a malformed file fails here, as stage parse does.
        _ = design.top_schematic, (design.pcb if design.pcb_path and Path(design.pcb_path).is_file() else None)
    except Exception as error:  # noqa: BLE001 - today's failure is the recorded outcome
        raise NotCaptured(f"KiCadDesign.from_project_file raised {type(error).__name__}: {error}") from error
    try:
        document, notes = build(src, pro, design)
    except Exception as error:  # noqa: BLE001
        raise NotCaptured(f"occurrences producer raised {type(error).__name__}: {error}") from error
    if not document["sheets"]:
        notes.append("no schematic: sheets and symbols in the empty form")
    if not (design.pcb_path and Path(design.pcb_path).is_file()):
        notes.append("no board: footprints in the empty form")
    checks, check_notes = run_checks(ctx, document)
    return Result(document=document, checks=checks, notes=notes + check_notes)
