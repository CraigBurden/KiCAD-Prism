"""Occurrences consumer checks: today's outputs and the field map's reading rules.

Field map ``occurrences.md``, "Reading rules" and "How a golden is produced",
steps 1 and 3 (the W0 scripts ``today.py`` and ``recompute.py``). Each shape is
today's output, re-derived from the golden alone and compared by JSON value.

Divergence ids are the rows of the field map's "Expected divergences" table,
numbered in table order (the field map gives them no ids):

- D1 stale instance record; D2 orphan ``.kicad_sch``; D3 multi-unit BOM field
  disagreement; D4 KiCad 7 board ids; D5 KiCad 7 schematic ``Datasheet`` in the
  index; D6 the index's library ``Description`` fallback; D7 project registry
  description ``""``; D8 fork core instance fallbacks; D9 repository-relative
  paths; D10 fork core lacks variant records.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from collections import defaultdict
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

from .. import jsonvalue
from . import Context

LABELS = {
    "value": "Value",
    "description": "Description",
    "datasheet": "Datasheet",
    "manufacturer": "Manufacturer",
    "manufacturerPartNumber": "Manufacturer Part Number",
    "vendor": "Vendor",
    "vendorPartNumber": "Vendor Part Number",
    "footprint": "Footprint",
    "mass": "Mass (g)",
    "rqjc": "RQjC (C/W)",
    "rqjcTop": "RQjC_top (C/W)",
    "tempMax": "Temp_max (C)",
    "tempMin": "Temp_min (C)",
    "powerDissipation": "Power Dissipation (W)",
    "rate": "Rate",
}
# _canonical_fields' order: Value, DNP, In BOM, Description, ...
CANONICAL_ORDER = ["Value", "DNP", "In BOM"] + [label for key, label in LABELS.items() if key != "value"]
REQUIRED = set(CANONICAL_ORDER)
FLAGS = ("dnp", "excludeFromBom", "excludeFromBoard", "excludeFromSim", "excludeFromPosFiles")


def _jsonable(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


# ------------------------------------------------------------ comparison


def _detail(diffs: list, limit: int) -> list[str]:
    out = [d.describe() for d in diffs[:limit]]
    if len(diffs) > limit:
        out.append(f"... {len(diffs)} differences in all")
    return out


def compare(shape: str, today: Any, rederived: Any, explain: Callable[[Any, Any], tuple[Any, list[str]]] | None = None) -> dict:
    """One ``Result.checks`` entry. ``explain`` rewrites today's value by documented divergences."""

    diffs = list(jsonvalue.diff(today, rederived))
    if not diffs:
        return {"shape": shape, "result": "equal"}
    if explain is not None:
        adjusted, ids = explain(today, rederived)
        if ids and jsonvalue.equal(adjusted, rederived):
            return {
                "shape": shape,
                "result": "divergence",
                "divergences": sorted(set(ids)),
                "detail": _detail(diffs, 10),
            }
    return {"shape": shape, "result": "differs", "detail": _detail(diffs, 20)}


# ------------------------------------------------------------ today's outputs


def today_outputs(ctx: Context) -> tuple[dict, list[str]]:
    """Step 1 of the field map, on the prepared copy (and an ecad copy under ``ctx.scratch``)."""

    from kicad_monkey import KiCadDesign

    out: dict[str, Any] = {}
    errors: list[str] = []
    src = ctx.src.resolve()
    pro = ctx.project_file.resolve()

    def attempt(label: str, fn: Callable[[], Any]) -> None:
        try:
            out[label] = _jsonable(fn())
        except Exception as error:  # noqa: BLE001 - recorded, the shape is skipped
            errors.append(f"today {label} raised {type(error).__name__}: {error}")

    # Design Comparison: ecad-diff writes its index cache into the snapshot root,
    # so it reads a copy under the member's scratch, never ctx.src.
    def design_compare():
        from app.services import design_compare_occurrences as occ

        copy = ctx.scratch / "ecad-snapshot"
        if copy.exists():
            shutil.rmtree(copy)
        shutil.copytree(src, copy, symlinks=True)
        report = ctx.scratch / "ecad.json"
        ctx.run_node(ctx.today / "backend" / "design-compare-parser" / "ecad-diff.mjs", str(copy), str(copy), "--out", str(report))
        ecad = json.loads(report.read_text(encoding="utf-8"))
        side = dict(ecad["base"])
        side["root"] = str(copy)
        components = occ.revision_components(side)
        return {"components": components, "bomRows": occ.bom_rows(components)}

    attempt("designCompare", design_compare)

    def catalog():
        from app.services import project_revision
        from app.services.catalog.placement_stamp import placed_symbols

        rows = []
        for path in sorted(src.rglob("*.kicad_sch")):
            rel = path.relative_to(src).as_posix()
            if project_revision.is_generated(rel):
                continue
            for symbol in placed_symbols(path.read_text(encoding="utf-8", errors="ignore"), rel):
                rows.append(
                    {
                        "schematic": symbol.schematic,
                        "symbolUuid": symbol.symbol_uuid,
                        "libId": symbol.lib_id,
                        "references": list(symbol.references),
                        "properties": dict(symbol.properties),
                    }
                )
        return rows

    attempt("catalog", catalog)

    from app.services import semantic_index_service, semantic_index_variants, variant_catalog_service
    from app.services.project_source_snapshot import ProjectSourceSnapshot

    def assembly():
        design = KiCadDesign.from_project_file(pro)
        catalog_result = variant_catalog_service.discover_snapshot_catalog(
            ProjectSourceSnapshot(root=src, project_file=pro, commit=None)
        )
        return semantic_index_variants.build_assembly_state(design, project_file=pro, catalog=catalog_result.get("variants", ()))

    attempt("assembly", assembly)

    def semantic():
        index = semantic_index_service.build_semantic_index(pro, source_revision_key="x")
        return {"components": index["components"], "sheetInstances": index["sheetInstances"]}

    attempt("semantic", semantic)

    board = pro.with_suffix(".kicad_pcb")
    if board.is_file():
        from app.release_studio.projections import project_variants
        from app.services.systems import interface_extractor

        def interface():
            snapshot = SimpleNamespace(root=src, project_file=pro, commit=None)
            design = interface_extractor.load_configured_design(snapshot)
            return interface_extractor.extract_interface(pro, project_id="p", commit=None, design=design)

        attempt("interface", interface)
        schematic = pro.with_suffix(".kicad_sch")
        attempt("releaseVariants", lambda: project_variants(board, pro, schematic if schematic.is_file() else None))
        attempt("releaseVariantsProduction", lambda: project_variants(board, pro, None))
    return out, errors


# ------------------------------------------------------------ reading rules


def stable_uid(prefix: str, *parts: Any) -> str:
    identity = "\x1f".join(str(part or "") for part in parts)
    return f"{prefix}:{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:20]}"


def canonical_row(symbol: dict) -> dict:
    fields = {label: "" for label in CANONICAL_ORDER}
    for key, label in LABELS.items():
        fields[label] = symbol["bomFields"].get(key, "")
    fields["DNP"] = "Yes" if symbol["dnp"] else "No"
    fields["In BOM"] = "No" if symbol["excludeFromBom"] else "Yes"
    for name, value in symbol["properties"].items():
        if name not in REQUIRED:
            fields[name] = value
    return fields


def design_compare_components(occ: dict) -> list[dict]:
    footprints_by_ref = {}
    for reference in occ["references"]:
        if reference["footprints"]:
            footprints_by_ref[reference["reference"]] = reference["footprints"][-1]  # today's dict keeps the last
    out = []
    for symbol in occ["symbols"]:
        if symbol["libId"].casefold().startswith("power:"):
            continue
        reference = symbol.get("reference")
        if not reference:
            continue
        uuid = footprints_by_ref.get(reference)
        out.append(
            {
                "componentUid": stable_uid("cmp", reference),
                "reference": reference,
                "value": symbol["properties"].get("Value", ""),
                "footprint": symbol["properties"].get("Footprint", ""),
                "fields": canonical_row(symbol),
                "schematicRefs": [
                    {"sheetInstancePath": symbol["sheetPath"], "page": symbol["documentPath"], "symbolUuid": symbol["symbolUuid"]}
                ],
                "pcbRefs": [{"footprintUuid": uuid}] if uuid else [],
            }
        )
    return out


def bom_rows(components: list[dict]) -> list[dict]:
    rows = []
    for component in components:
        fields = dict(component["fields"])
        if fields.get("In BOM", "Yes").strip().casefold() == "no":
            continue
        rows.append(
            {
                **fields,
                "Reference": component["reference"],
                "Value": component["value"] or fields.get("Value", ""),
                "Footprint": component["footprint"] or fields.get("Footprint", ""),
            }
        )
    return sorted(rows, key=lambda row: row["Reference"])


def _component_key(component: dict) -> tuple:
    ref = component["schematicRefs"][0]
    return (component["reference"], ref["sheetInstancePath"], ref["page"] or "", ref["symbolUuid"])


def _components_view(components: list[dict]) -> list[dict]:
    """Order-insensitive: today lists files sorted by path, the golden lists the hierarchy."""

    return sorted(components, key=_component_key)


def _bom_view(rows: list[dict]) -> dict:
    """What ``diff_boms`` consumes: rows keyed by reference, the last row wins."""

    return {row["Reference"]: row for row in rows}


def valid(reference: str | None) -> bool:
    return bool(reference) and not reference.startswith("#") and not reference.endswith("?")


def components_default(occ: dict) -> dict:
    """Default flags per reference: equal values agree, otherwise the representative unit."""

    order = {sheet["sheetPath"]: index for index, sheet in enumerate(occ["sheets"])}
    grouped: dict[str, list] = defaultdict(list)
    for symbol in occ["symbols"]:
        if valid(symbol.get("reference")):
            grouped[symbol["reference"]].append(symbol)
    out = {}
    for reference, members in grouped.items():
        first = min(order[m["sheetPath"]] for m in members)
        rep = min((m for m in members if order[m["sheetPath"]] == first), key=lambda m: m["symbolUuid"])
        flags = {}
        for flag in FLAGS:
            values = {m[flag] for m in members}
            flags[flag] = next(iter(values)) if len(values) == 1 else rep[flag]
        out[reference] = flags
    return out


def assembly_default(occ: dict) -> dict:
    occurrences = {}
    for symbol in occ["symbols"]:
        if not valid(symbol.get("reference")):
            continue
        entry = {"reference": symbol["reference"], **{flag: True for flag in FLAGS if symbol[flag]}}
        if len(entry) > 1:
            occurrences[symbol["kiidPath"]] = entry
    components = {ref: {f: True for f in FLAGS if flags[f]} for ref, flags in components_default(occ).items()}
    components = {ref: value for ref, value in components.items() if value}
    footprints = {}
    for footprint in occ["footprints"]:
        entry = {"reference": footprint.get("reference", "")}
        for flag in ("dnp", "excludeFromBom", "excludeFromPosFiles"):
            if footprint[flag]:
                entry[flag] = True
        if len(entry) > 1:
            footprints[footprint["uuid"]] = entry
    inventory = [{"uuid": f["uuid"], "reference": f.get("reference", "")} for f in occ["footprints"]]
    return {"occurrences": occurrences, "components": components, "footprints": footprints, "footprintInventory": inventory}


def _today_assembly(assembly: dict) -> dict:
    default = assembly["default"]
    out = {
        section: {key: {k: v for k, v in value.items() if k != "componentUid"} for key, value in default[section].items()}
        for section in ("occurrences", "components", "footprints")
    }
    out["footprintInventory"] = assembly["footprintInventory"]
    return out


def natural(value: str) -> tuple:
    head = value.rstrip("0123456789")
    tail = value[len(head):]
    return (head, int(tail) if tail else -1, value)


def interface_identity(occ: dict) -> dict:
    grouped: dict[str, list] = defaultdict(list)
    for symbol in occ["symbols"]:
        reference = symbol.get("reference") or ""
        if not symbol["instanceMatched"] or not reference or reference.startswith("#"):
            continue
        grouped[reference].append(symbol)
    defaults = components_default(occ)
    out = {}
    for reference in sorted(grouped, key=natural):
        units = sorted(grouped[reference], key=lambda s: (s["unit"], s["kiidPath"]))
        first = units[0]
        out[reference] = {
            "portKey": first["kiidPath"],
            "memberKeys": sorted(s["kiidPath"] for s in units),
            "reference": reference,
            "libId": first["libId"],
            "dnp": bool((defaults.get(reference) or {}).get("dnp", False)),
            "value": first["properties"].get("Value", ""),
            "footprint": first["properties"].get("Footprint", ""),
        }
    return out


IDENTITY_KEYS = ("portKey", "memberKeys", "reference", "libId", "dnp", "value", "footprint")


def catalog_rows(occ: dict) -> dict:
    rows: dict[str, dict] = {}
    for symbol in occ["symbols"]:
        key = f"{symbol['documentPath']}#{symbol['symbolUuid']}"
        row = rows.setdefault(
            key,
            {"schematic": symbol["documentPath"], "symbolUuid": symbol["symbolUuid"], "libId": symbol["libId"],
             "references": [], "properties": symbol["properties"]},
        )
        if symbol.get("reference") and symbol["reference"] not in row["references"]:
            row["references"].append(symbol["reference"])
    for row in rows.values():
        row["references"] = sorted(row["references"])
    return rows


def _today_catalog(rows: list[dict]) -> dict:
    out = {}
    for row in rows:
        out[f"{row['schematic']}#{row['symbolUuid']}"] = {**row, "references": sorted(row["references"])}
    return out


def release_declarations(occ: dict, *, with_schematic: bool) -> list[dict]:
    def decl(name, description, assignments=None):
        return {"name": name, "description": description, "is_default": name == "default",
                "assignments": dict(sorted((assignments or {}).items()))}

    def merge(declarations, names):
        by_name = {d["name"]: d for d in declarations}
        for name, assignments in names.items():
            if name not in by_name:
                by_name[name] = decl(name, None, assignments)
            elif assignments:
                merged = dict(by_name[name]["assignments"])
                merged.update(assignments)
                by_name[name]["assignments"] = dict(sorted(merged.items()))
        return list(by_name.values())

    board = [decl(d["name"], d.get("description")) for d in occ["variantDeclarations"] if d["source"] == "pcb"]
    assignments: dict[str, dict] = {}
    for footprint in occ["footprints"]:
        if not footprint.get("reference"):
            continue
        for record in footprint["variants"]:
            if "dnp" in record:
                assignments.setdefault(record["name"], {})[footprint["reference"]] = record["dnp"]
    board = merge(board, assignments)
    project = [decl(d["name"], d.get("description")) for d in occ["variantDeclarations"] if d["source"] == "project"]
    schematic = []
    if with_schematic and occ["sheets"]:
        root_path = occ["sheets"][0]["sheetPath"]
        tops = [s["documentPath"] for s in occ["symbols"] if s["sheetPath"] == root_path]
        top = tops[0] if tops else None
        names, sch_assign = [], {}
        for symbol in (s for s in occ["symbols"] if top and s["documentPath"] == top):
            for record in symbol["variants"]:
                if record["name"] not in names:
                    names.append(record["name"])
                if "dnp" in record:
                    sch_assign.setdefault(record["name"], {})[symbol["properties"].get("Reference", "")] = record["dnp"]
        for sheet in occ["sheets"]:
            for record in sheet["variants"]:
                if record["name"] not in names:
                    names.append(record["name"])
        schematic = [decl(n, None, sch_assign.get(n)) for n in names]
    return {"board": board, "project": project, "schematic": schematic}


def _registry_description_explain(today: Any, rederived: Any) -> tuple[Any, list[str]]:
    """D7: a project registry description ``""`` is absent in the member (``None`` re-derived)."""

    adjusted = json.loads(json.dumps(today))
    ids = []
    for item in adjusted.get("project", []):
        if item.get("description") == "":
            item["description"] = None
            ids.append("D7")
    return adjusted, ids


# ------------------------------------------------------------------ driver


def run_checks(ctx: Context, occ: dict) -> tuple[list[dict], list[str]]:
    today, notes = today_outputs(ctx)
    checks: list[dict] = []
    reached = {s["documentPath"] for s in occ["symbols"]}
    hierarchy_paths = {s["sheetPath"] for s in occ["sheets"]}

    dc = today.get("designCompare")
    if dc is not None:
        mine = design_compare_components(occ)

        def explain_components(t, m):
            # D1 (records for sheet paths no instance has) and D2 (files no sheet reaches).
            ids, kept = [], []
            for component in t:
                ref = component["schematicRefs"][0]
                if ref["page"] not in reached:
                    ids.append("D2")
                elif ref["sheetInstancePath"] not in hierarchy_paths:
                    ids.append("D1")
                else:
                    kept.append(component)
            return kept, ids

        checks.append(compare("designCompare.components", _components_view(dc["components"]), _components_view(mine), explain_components))

        def explain_bom(t, m):
            kept, ids = explain_components(dc["components"], None)
            return _bom_view(bom_rows(kept)), ids

        checks.append(compare("designCompare.bomRows", _bom_view(dc["bomRows"]), _bom_view(bom_rows(mine)), explain_bom))

    assembly = today.get("assembly")
    if assembly is not None:
        checks.append(compare("semanticIndex.assembly.default", _today_assembly(assembly), assembly_default(occ)))

    semantic = today.get("semantic")
    if semantic is not None:
        by_ref: dict[str, list] = defaultdict(list)
        for symbol in occ["symbols"]:
            if valid(symbol.get("reference")):
                by_ref[symbol["reference"]].append(symbol)
        today_fields, mine_fields, explained = {}, {}, {}
        for component in semantic["components"]:
            members = by_ref.get(component["reference"], [])
            if len(members) != 1:
                continue  # single-occurrence references only (field map, "Relation")
            row = canonical_row(members[0])
            reference = component["reference"]
            today_fields[reference] = {c: component["fields"].get(c, "") for c in CANONICAL_ORDER}
            mine_fields[reference] = {c: row.get(c, "") for c in CANONICAL_ORDER}
            adjusted = dict(today_fields[reference])
            # D6: the index's Description is the netlist's library description when it has
            # one (sis:497, ``component["description"] or pick("Description")``), and only
            # otherwise the placed symbol's; occurrences follows the placed symbol.
            if adjusted["Description"] and adjusted["Description"] != mine_fields[reference]["Description"]:
                adjusted["Description"] = mine_fields[reference]["Description"]
            explained[reference] = adjusted

        def explain_fields(t, m):
            ids = ["D6"] if any(explained[r] != t[r] for r in t) else []
            return explained, ids

        checks.append(compare("semanticIndex.components.fields", today_fields, mine_fields, explain_fields))
        pcb = {c["reference"]: sorted(r["footprintUuid"] for r in c["pcbRefs"]) for c in semantic["components"]}
        refs = {r["reference"]: sorted(r["footprints"]) for r in occ["references"]}
        checks.append(compare("semanticIndex.components.pcbRefs", pcb, {ref: refs.get(ref, []) for ref in pcb}))
        checks.append(
            compare(
                "semanticIndex.sheetInstances",
                sorted(s["sheetInstancePath"] for s in semantic["sheetInstances"]),
                sorted(s["sheetPath"] for s in occ["sheets"]),
            )
        )

    interface = today.get("interface")
    if interface is not None:
        mine = interface_identity(occ)
        theirs = {c["reference"]: {k: c[k] for k in IDENTITY_KEYS} for c in interface["components"]}
        # The netlist pin filter (ie:394) stays with P5: compare today's references only.
        extra = [ref for ref in mine if ref not in theirs]
        if extra:
            notes.append(f"systemBuilder.interface: {len(extra)} member-only references (netlist pin filter, P5): {extra[:10]}")
        checks.append(compare("systemBuilder.interface.identity", theirs, {ref: mine[ref] for ref in theirs if ref in mine} | {ref: None for ref in theirs if ref not in mine}))

    catalog = today.get("catalog")
    if catalog is not None:
        theirs = _today_catalog(catalog)

        def explain_catalog(t, m):
            ids, adjusted = [], {}
            for key, row in t.items():
                if row["schematic"] not in reached:
                    ids.append("D2")
                    continue
                if key in m and row["references"] != m[key]["references"]:
                    ids.append("D1")
                    row = {**row, "references": m[key]["references"]}
                adjusted[key] = row
            return adjusted, ids

        checks.append(compare("catalog.placedSymbols", theirs, catalog_rows(occ), explain_catalog))

    for key, with_schematic in (("releaseVariantsProduction", False), ("releaseVariants", True)):
        rv = today.get(key)
        if rv is None:
            continue
        checks.append(
            compare(
                f"releaseStudio.{key}.declarations",
                rv["declarations"],
                release_declarations(occ, with_schematic=with_schematic),
                _registry_description_explain,
            )
        )
    return checks, notes
