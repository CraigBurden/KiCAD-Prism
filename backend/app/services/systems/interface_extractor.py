"""Extract the ``prism.system_interface.v1`` artifact from one KiCad project.

Contract: ``docs/system-builder/CONTRACTS.md`` §2–§4. The artifact lists every
placed component with pins, keyed by occurrence (``KIID_PATH``), with the
schematic nets of each pad and, when the commit has a board, the pad nets for
the PCB-sync warning.

Sources, all from the pinned kicad-monkey:

* identity (occurrence keys, unit numbers, ``lib_id``) from the native
  schematic symbols and their per-instance records;
* nets, pin names and pin types from the compiled **schematic** netlist, so no
  PCB overlay can leak in (the semantic index overwrites terminal nets with pad
  nets; this extractor does not use it);
* DNP from the design-variant resolver's default assembly state;
* ``pcbNets`` from board pad nets, matched by reference and pad number;
* v6 ``geometry`` (CONTRACTS_P2 §14.6) from the board footprint with that
  reference: pose, pads and courtyard in the board frame (§14.2), and the
  first 3D model reference, unresolved;
* v8 ``boardOutlineMm`` (CONTRACTS_P2 §14.6) from the board's Edge.Cuts
  graphics, or the extent of all board items when there are none.

With ``PRISM_DESIGN_SOURCE_SYSTEM_BUILDER=bundle`` the artifact of a resolved
commit is instead mapped from the bundle member ``projections/system-interface.json``
(``prism.system_interface.v1``), which the bundle key already serves every commit
with those sources; everything else keeps this extractor (see
``interface_from_bundle``).
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import logging
import math
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping

from app.services import semantic_index_variants
from app.services.systems import connector_detection

logger = logging.getLogger(__name__)

SCHEMA = "prism.system_interface.v1"
EXTRACTOR_VERSION = "8"
_UNCONNECTED_PREFIX = "unconnected-("


def canonical_digest(value: Any) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalized_nets(names: Iterable[str]) -> list[str]:
    """Sorted schematic net set with KiCad's unconnected placeholders removed."""
    return sorted({name for name in names if name and not name.startswith(_UNCONNECTED_PREFIX)})


_NOT_DIGESTED = frozenset({"digest", "extractor", "projectId", "commit"})


def interface_digest(payload: Mapping[str, Any]) -> str:
    """§3: digest over the interface facts only.

    Identity and provenance (project, commit, extractor) are excluded, so two
    commits with the same schematic interface share a digest.
    """
    body = {key: value for key, value in payload.items() if key not in _NOT_DIGESTED}
    return canonical_digest(body)


def connected_interface_digest(
    lib_id: str, footprint: str, pins: Mapping[str, Iterable[str]]
) -> str:
    """§3: the per-end digest the drift engine compares; ``pins`` is pad → nets."""
    return canonical_digest(
        {
            "libId": lib_id,
            "footprint": footprint,
            "pins": [[pad, sorted(set(nets))] for pad, nets in sorted(pins.items())],
        }
    )


def _kicad_monkey_version() -> str:
    try:
        return importlib.metadata.version("kicad-monkey")
    except importlib.metadata.PackageNotFoundError:
        return "workspace"


def _string(value: object) -> str:
    return "" if value is None else str(value)


def _natural(pad: str) -> tuple:
    head = pad.rstrip("0123456789")
    tail = pad[len(head):]
    return (head, int(tail) if tail else -1, pad)


def _occurrences(native: Any) -> dict[str, list[tuple[int, str, Any]]]:
    """``reference -> [(unit, occurrence_key, symbol)]`` for placed symbols.

    Grouping by reference is what makes the units of a multi-unit symbol one
    port. Unannotated symbols that share a reference such as ``J?`` are grouped
    too; they can never be ports (CONTRACTS.md §2.3), and the netlist cannot
    tell their pins apart either, so only the diagnostic is affected.
    """
    result: dict[str, list[tuple[int, str, Any]]] = defaultdict(list)
    for instance in native.schematic_instances() or ():
        sheet_path = _string(getattr(instance, "sheet_instance_path", "")) or "/"
        schematic = getattr(instance, "schematic", None)
        for symbol in getattr(schematic, "symbols", ()) or ():
            if not _string(getattr(symbol, "lib_id", "")):
                continue
            record = next(
                (
                    entry
                    for entry in getattr(symbol, "instances", ()) or ()
                    if _string(getattr(entry, "path", "")) == sheet_path
                ),
                None,
            )
            reference = _string(getattr(record, "reference", "")) if record else ""
            if not reference or reference.startswith("#"):
                continue  # power flags and other virtual symbols
            unit = getattr(record, "unit", None) or getattr(symbol, "unit", None) or 1
            key = f"{sheet_path.rstrip('/')}/{_string(symbol.uuid)}"
            result[reference].append((int(unit), key, symbol))
    return result


def _schematic_pins(netlist: Any) -> dict[str, dict[str, dict[str, set[str]]]]:
    """``reference -> pad -> {nets, names, types}`` from the schematic netlist."""
    pins: dict[str, dict[str, dict[str, set[str]]]] = defaultdict(
        lambda: defaultdict(lambda: {"nets": set(), "names": set(), "types": set()})
    )
    for net in getattr(netlist, "nets", ()) or ():
        name = _string(getattr(net, "name", ""))
        for terminal in getattr(net, "terminals", ()) or ():
            reference = _string(getattr(terminal, "designator", ""))
            pad = _string(getattr(terminal, "pin", ""))
            if not reference or not pad:
                continue
            entry = pins[reference][pad]
            entry["nets"].add(name)
            if _string(getattr(terminal, "pin_name", "")):
                entry["names"].add(_string(terminal.pin_name))
            if _string(getattr(terminal, "pin_type", "")):
                entry["types"].add(_string(terminal.pin_type))
    return pins


def _board_pad_nets(board: Any) -> dict[str, dict[str, set[str]]]:
    """``reference -> pad -> {net names}`` from the board, if any."""
    result: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for footprint in getattr(board, "footprints", ()) or ():
        reference = ""
        for prop in getattr(footprint, "properties", ()) or ():
            if _string(getattr(prop, "name", "")) == "Reference":
                reference = _string(getattr(prop, "value", ""))
        if not reference:
            continue
        for pad in getattr(footprint, "pads", ()) or ():
            number = _string(getattr(pad, "number", ""))
            if not number:
                continue
            net = getattr(pad, "net", None)
            name = _string(getattr(net, "name", "")) if net is not None else ""
            result[reference][number].add(name)
    return result


def _round(value: float) -> float:
    """§14.6: 1e-4 mm, with -0.0 folded to 0.0 so digests are stable."""
    return round(float(value), 4) + 0.0


def _reference(footprint: Any) -> str:
    for prop in getattr(footprint, "properties", ()) or ():
        if _string(getattr(prop, "name", "")) == "Reference":
            return _string(getattr(prop, "value", ""))
    return ""


def _courtyard_points(footprint: Any) -> list[tuple[float, float]]:
    """Footprint-local points (KiCad y down) of the F/B.CrtYd graphics."""
    points: list[tuple[float, float]] = []
    for item in getattr(footprint, "iter_objects", lambda: ())():
        if "CrtYd" not in _string(getattr(item, "layer", "")):
            continue
        kind = type(item).__name__
        if kind in ("FpLine", "FpRect"):
            points += [(item.start_x, item.start_y), (item.end_x, item.end_y)]
        elif kind == "FpCircle":
            radius = math.hypot(item.end_x - item.center_x, item.end_y - item.center_y)
            points += [(item.center_x - radius, item.center_y - radius), (item.center_x + radius, item.center_y + radius)]
        elif kind == "FpArc":
            points += [(item.start_x, item.start_y), (item.mid_x, item.mid_y), (item.end_x, item.end_y)]
        elif kind == "FpPoly":
            points += [(x, y) for x, y in getattr(item, "points", ()) or ()]
    return points


def _model(footprint: Any) -> dict[str, Any] | None:
    for model in getattr(footprint, "models", ()) or ():
        sexp = model.to_sexp() if hasattr(model, "to_sexp") else []
        if any(isinstance(part, list) and part[:1] == ["hide"] and part[1:2] != ["no"] for part in sexp):
            continue
        return {
            "path": _string(model.path),
            "offsetMm": [_round(v) for v in model.offset],
            "rotationDeg": [_round(v) for v in model.rotate],
            "scale": [_round(v) for v in model.scale],
        }
    return None


def _footprint_geometry(footprint: Any) -> dict[str, Any]:
    """§14.6 for one placed footprint; positions in the board frame (y up)."""

    angle = float(getattr(footprint, "at_angle", 0.0) or 0.0)
    cos_a, sin_a = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    fx, fy = float(footprint.at_x), float(footprint.at_y)

    def board(lx: float, ly: float) -> list[float]:
        # KiCad rotates counter-clockwise on screen with y down; the board frame flips y.
        x = fx + lx * cos_a + ly * sin_a
        y = fy - lx * sin_a + ly * cos_a
        return [_round(x), _round(-y)]

    pads = []
    for pad in getattr(footprint, "pads", ()) or ():
        pad_type = _string(getattr(getattr(pad, "pad_type", None), "name", getattr(pad, "pad_type", ""))).lower()
        pads.append({
            "pad": _string(getattr(pad, "number", "")),
            "positionMm": board(float(pad.at_x), float(pad.at_y)),
            "sizeMm": [_round(pad.size_x or 0.0), _round(pad.size_y or 0.0)],
            "shape": _string(getattr(getattr(pad, "shape", None), "name", getattr(pad, "shape", ""))).lower(),
            "tht": pad_type in ("thru_hole", "np_thru_hole"),
        })
    pads.sort(key=lambda item: _natural(item["pad"]))
    points = _courtyard_points(footprint)
    courtyard = None
    if points:
        xs = [x for x, _y in points]
        ys = [-y for _x, y in points]  # footprint frame, y up
        courtyard = {"minMm": [_round(min(xs)), _round(min(ys))], "maxMm": [_round(max(xs)), _round(max(ys))]}
    layer = _string(getattr(footprint, "layer", ""))
    return {
        "side": "bottom" if layer.startswith("B.") else "top",
        "positionMm": [_round(fx), _round(-fy)],
        "rotationDeg": _round(angle),
        "footprintName": _string(getattr(footprint, "library_link", "")).split(":")[-1],
        "pads": pads,
        "courtyard": courtyard,
        "model": _model(footprint),
    }


def _board_geometry(board: Any) -> dict[str, dict[str, Any]]:
    """``reference -> geometry`` for every placed footprint; the first wins on a repeated reference."""
    result: dict[str, dict[str, Any]] = {}
    for footprint in getattr(board, "footprints", ()) or ():
        reference = _reference(footprint)
        if reference and reference not in result:
            result[reference] = _footprint_geometry(footprint)
    return result


def _arc_points(item: Any) -> list[tuple[float, float]]:
    """The ends of a three-point arc plus every axis extreme it sweeps through."""
    (ax, ay), (mx, my), (bx, by) = (item.start_x, item.start_y), (item.mid_x, item.mid_y), (item.end_x, item.end_y)
    points = [(ax, ay), (mx, my), (bx, by)]
    d = 2.0 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my))
    if abs(d) < 1e-12:
        return points  # collinear: a straight segment
    ux = ((ax * ax + ay * ay) * (my - by) + (mx * mx + my * my) * (by - ay) + (bx * bx + by * by) * (ay - my)) / d
    uy = ((ax * ax + ay * ay) * (bx - mx) + (mx * mx + my * my) * (ax - bx) + (bx * bx + by * by) * (mx - ax)) / d
    radius = math.hypot(ax - ux, ay - uy)

    def angle(x: float, y: float) -> float:
        return math.atan2(y - uy, x - ux) % math.tau

    start, mid, end = angle(ax, ay), angle(mx, my), angle(bx, by)
    sweep = (end - start) % math.tau
    if (mid - start) % math.tau > sweep:  # the arc runs the other way round
        start, sweep = end, math.tau - sweep
    for quarter in range(4):
        theta = quarter * math.pi / 2.0
        if (theta - start) % math.tau <= sweep:
            points.append((ux + radius * math.cos(theta), uy + radius * math.sin(theta)))
    return points


def _outline_points(item: Any) -> list[tuple[float, float]]:
    kind = type(item).__name__
    if kind in ("GrLine", "GrRect"):
        return [(item.start_x, item.start_y), (item.end_x, item.end_y)]
    if kind == "GrCircle":
        radius = math.hypot(item.end_x - item.center_x, item.end_y - item.center_y)
        return [(item.center_x - radius, item.center_y - radius), (item.center_x + radius, item.center_y + radius)]
    if kind == "GrArc":
        return _arc_points(item)
    if kind in ("GrPoly", "GrCurve"):  # a Bézier lies inside its control points' hull
        return [(float(x), float(y)) for x, y in getattr(item, "points", ()) or ()]
    return []


def _board_outline(board: Any) -> dict[str, Any] | None:
    """v8 ``boardOutlineMm``: bounds of the board-level Edge.Cuts graphics in the board frame (§14.2).

    Line centres, not stroke edges. A board without them falls back to the
    extent of all its items (KiCad's own fallback), marked ``source: "items"``.
    """
    points: list[tuple[float, float]] = []
    for carrier in board.board_outline_carriers() if hasattr(board, "board_outline_carriers") else ():
        if carrier.owner_kind == "board":
            points += _outline_points(carrier.item)
    source = "edge_cuts"
    if not points:
        bounds = board.get_bounds() if hasattr(board, "get_bounds") else None
        if bounds is None or bounds.max_x < bounds.min_x:
            return None
        points, source = [(bounds.min_x, bounds.min_y), (bounds.max_x, bounds.max_y)], "items"
    xs, ys = [x for x, _ in points], [-y for _, y in points]  # KiCad y points down; the board frame's up
    return {"minMm": [_round(min(xs)), _round(min(ys))], "maxMm": [_round(max(xs)), _round(max(ys))], "source": source}


def _power_net_names(design: Any) -> set[str]:
    """Names of nets set by power symbols (lib symbol ``power`` flag): the symbol's value is the net."""

    names: set[str] = set()
    for top in getattr(design, "schematics", None) or []:
        for symbol, _path, sheet in top.walk_symbols():
            lib = sheet.get_lib_symbol_for_symbol(symbol)
            if lib is None or not getattr(lib, "power", False):
                continue
            value = next((p.value for p in getattr(symbol, "properties", []) if p.key == "Value"), "")
            if value:
                names.add(_string(value))
    return names


_MPN_FIELDS = ("mpn", "manufacturer_part_number", "manufacturer part number", "mfr_pn", "mfr. no.", "mfr no")


def _mpn(fields: Mapping[str, str]) -> str | None:
    """The first non-empty MPN-style field (case-insensitive name), else None."""
    by_name = {name.strip().lower(): value.strip() for name, value in fields.items()}
    return next((by_name[name] for name in _MPN_FIELDS if by_name.get(name)), None)


def _field_map(component: Any) -> dict[str, str]:
    fields = getattr(component, "fields", None) or {}
    return {str(key): _string(value) for key, value in dict(fields).items()}


def extract_interface(
    project_file: Path,
    *,
    project_id: str,
    commit: str | None,
    design: Any = None,
) -> dict[str, Any]:
    """Build the interface artifact for the project at ``project_file``.

    ``design`` lets a caller pass an already-loaded ``KiCadDesign``.
    """

    project_file = Path(project_file)
    if design is None:
        from kicad_monkey import KiCadDesign

        design = KiCadDesign.from_project_file(project_file)

    netlist = design.to_netlist()
    components_by_reference = {
        _string(getattr(component, "reference", "")): component
        for component in getattr(netlist, "components", ()) or ()
    }
    schematic_pins = _schematic_pins(netlist)
    power_nets = _power_net_names(design)
    occurrences = _occurrences(design)

    pcb_path = getattr(design, "pcb_path", None)
    has_pcb = bool(pcb_path) and Path(pcb_path).is_file()
    board = design.pcb if has_pcb else None
    board_pads = _board_pad_nets(board) if board is not None else {}
    geometry = _board_geometry(board) if board is not None else {}

    assembly = semantic_index_variants.build_assembly_state(design, project_file=project_file)
    default_components = (assembly.get("default") or {}).get("components") or {}

    components: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for reference in sorted(occurrences, key=_natural):
        units = sorted(occurrences[reference], key=lambda item: (item[0], item[1]))
        pads = schematic_pins.get(reference, {})
        if not pads:
            continue  # no electrical pins: graphics, mounting-only symbols
        _unit, port_key, first_symbol = units[0]
        netlist_component = components_by_reference.get(reference)
        lib_id = _string(getattr(first_symbol, "lib_id", ""))
        footprint = _string(getattr(netlist_component, "footprint", "")) if netlist_component else ""
        fields = _field_map(netlist_component) if netlist_component else {}
        candidate, reason = connector_detection.classify(reference, lib_id, footprint, fields)
        annotated = "?" not in reference
        if not annotated:
            diagnostics.append(
                {"code": "unannotated_connector", "portKey": port_key, "pad": None,
                 "detail": f"{reference} is not annotated"}
                if candidate
                else {"code": "unannotated_component", "portKey": port_key, "pad": None,
                      "detail": f"{reference} is not annotated"}
            )

        pins = []
        for pad in sorted(pads, key=_natural):
            entry = pads[pad]
            nets = normalized_nets(entry["nets"])
            if len(nets) > 1:
                diagnostics.append(
                    {"code": "pin_net_ambiguous", "portKey": port_key, "pad": pad,
                     "detail": f"{reference}.{pad} carries {len(nets)} schematic nets"}
                )
            board_nets = board_pads.get(reference, {}).get(pad) if board is not None else None
            pins.append(
                {
                    "pad": pad,
                    "nets": nets,
                    "pcbNets": normalized_nets(board_nets) if board_nets is not None else None,
                    "pinNames": sorted(entry["names"]) or None,
                    "pinTypes": sorted(entry["types"]) or None,
                    # CONTRACTS_P2 §8.4 (v5): the pin's net is driven by a power symbol.
                    "powerNet": any(net in power_nets for net in nets),
                }
            )

        components.append(
            {
                "portKey": port_key,
                "memberKeys": sorted(key for _unit, key, _symbol in units),
                "reference": reference,
                "libId": lib_id,
                "footprint": footprint,
                "value": _string(getattr(netlist_component, "value", "")) if netlist_component else "",
                # v7 (CONTRACTS_P2 §18): matches the connector to a catalog part.
                "mpn": _mpn(fields),
                "dnp": bool((default_components.get(reference) or {}).get("dnp", False)),
                "candidate": candidate,
                "candidateReason": reason,
                "pins": pins,
                "geometry": geometry.get(reference),
            }
        )

    payload: dict[str, Any] = {
        "schema": SCHEMA,
        "projectId": project_id,
        "commit": commit,
        "extractor": {"version": EXTRACTOR_VERSION, "kicadMonkeyVersion": _kicad_monkey_version()},
        "hasPcb": board is not None,
        "boardThicknessMm": _round(board.thickness) if board is not None and getattr(board, "thickness", None) else None,
        "boardOutlineMm": _board_outline(board) if board is not None else None,
        "components": components,
        "diagnostics": sorted(
            diagnostics, key=lambda d: (d["code"], d["portKey"] or "", d["pad"] or "")
        ),
    }
    payload["digest"] = interface_digest(payload)
    return payload


def extract_for_revision(project: Any, commit: str) -> dict[str, Any]:
    """Materialize ``project`` at ``commit`` and extract its interface.

    With the ``SYSTEM_BUILDER`` switch on and a ready
    ``projections/system-interface.json`` member for the resolved commit, the
    artifact is mapped from the bundle (``interface_from_bundle``); every other
    case — a member not ready, a bundle the switch leaves alone, a working tree —
    keeps today's extractor on the materialized sources.
    """

    from app.services.project_source_snapshot import project_source_snapshot

    with project_source_snapshot(project, commit) as snapshot:
        from_bundle = interface_from_bundle(str(project.id), snapshot.commit)
        if from_bundle is not None:
            return from_bundle
        return extract_interface(
            snapshot.project_file,
            project_id=str(project.id),
            commit=snapshot.commit or commit,
            design=load_configured_design(snapshot),
        )


def interface_from_bundle(
    project_id: str, commit: str | None, *, requested_by: str = ""
) -> dict[str, Any] | None:
    """The artifact the bundle holds for a resolved commit, or ``None`` to use the extractor.

    ``bundle_read`` owns the switch and the rollout fallback: it answers ``None``
    for the ``legacy`` switch, a member that is not ready yet (it queues the
    build) and a member that failed, and this function then serves the legacy
    path. A member that is final but not ``ready`` (``skipped``,
    ``not-applicable``) is no interface either, so it takes the legacy path too.
    A working tree — no resolved commit, which the bundle key cannot name — can
    hold uncommitted changes a committed bundle does not carry, so it is never
    read here.
    """

    if not commit:
        return None
    from app.services.design_bundle.consumer import bundle_read

    read = bundle_read(
        "SYSTEM_BUILDER", project_id, commit, ["projections/system-interface.json"], requested_by=requested_by
    )
    if read is None or not read.ready("projections/system-interface.json"):
        return None
    try:
        member = read.json("projections/system-interface.json")
    except Exception as error:  # noqa: BLE001 - a bundle-side fault must not break the legacy path
        logger.warning(
            "design bundle: the system interface member of %s@%s is unreadable: %s", project_id, commit, error
        )
        return None
    return interface_from_member(
        member,
        project_id=project_id,
        commit=commit,
        kicad_monkey_version=_bundle_kicad_monkey_version(read),
    )


def interface_from_member(
    member: Mapping[str, Any], *, project_id: str, commit: str | None, kicad_monkey_version: str
) -> dict[str, Any]:
    """The stored artifact from the bundle member: the member plus today's envelope.

    The member carries no ``projectId``, ``commit`` or ``extractor`` — a
    projection knows neither the project nor the commit (field map, "Expected
    divergences"). They are outside the digest, so the member's ``digest`` is
    today's; it is carried through, in ``extract_interface``'s key order, with
    the envelope first.
    """

    return {
        "schema": member["schema"],
        "projectId": project_id,
        "commit": commit,
        "extractor": {"version": EXTRACTOR_VERSION, "kicadMonkeyVersion": kicad_monkey_version},
        "hasPcb": member["hasPcb"],
        "boardThicknessMm": member["boardThicknessMm"],
        "boardOutlineMm": member["boardOutlineMm"],
        "components": member["components"],
        "diagnostics": member["diagnostics"],
        "digest": member["digest"],
    }


def _bundle_kicad_monkey_version(read: Any) -> str:
    """The bundle generator's ``engine_version``: the parser behind the member.

    The generator id (``CliVersionA0``, ``bundle.json``'s ``generator``) records
    ``engine_version``, ``kicad_monkey_core``'s ``ENGINE_VERSION`` — the bundle's
    form of the Python distribution version ``_kicad_monkey_version`` returns.
    Informational: no reader consumes it (field map).
    """

    archive = getattr(read.opened, "archive", None)
    generator = archive.manifest.get("generator") if archive is not None else None
    version = generator.get("engine_version") if isinstance(generator, Mapping) else None
    return str(version) if version else _kicad_monkey_version()


def load_configured_design(snapshot: Any) -> Any:
    """The design at the snapshot's configured sources (``.prism.json`` at that commit).

    ``KiCadDesign.from_project_file`` only finds sources named after the
    project file, so a project whose configuration points elsewhere would read
    as empty or as the wrong board.
    """

    from kicad_monkey import KiCadDesign
    from kicad_monkey.kicad_project import KiCadProject
    from kicad_monkey.kicad_schematic import KiCadSchematic

    from app.services.project_source_snapshot import source_files

    pcb, schematic = source_files(snapshot)
    project_file = Path(snapshot.project_file)
    project = KiCadProject.from_file(project_file) if project_file.suffix == ".kicad_pro" else None
    return KiCadDesign(
        project=project,
        schematics=[KiCadSchematic(schematic)] if schematic is not None and schematic.is_file() else [],
        pcb_path=pcb if pcb is not None and pcb.is_file() else None,
        project_path=project_file,
    )
