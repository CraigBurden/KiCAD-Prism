"""Release Studio's board projections, rebuilt from design-bundle members.

A build with a resolved commit reads the five read-only board projections of
:mod:`app.release_studio.projections` from the bundle instead of Python
``kicad_monkey``:

- ``stackup`` from ``projections/stackup.json`` (``prism.stackup.a0``);
- ``population``, ``testpoints`` and ``designators`` from
  ``projections/placements.json`` (``prism.placements.a1``);
- ``testpoints`` also reads each probe target's first pad net from
  ``projections/board-objects.json`` (``prism.board_objects.a0``);
- ``variants`` from ``projections/occurrences.json``
  (``prism.occurrences.a0``).

The rules are the field maps' "derivations of today's values": ``stackup.md``
("RS", C3), ``placements.md`` ("Release Studio (C3)") and ``occurrences.md``
("Release Studio variant declarations", C3).  Each function here is a pure
function of the parsed member document with no file access, so it can be
unit-tested against the committed goldens without a bundle.

The functions reuse the pure presentation helpers of the legacy module
(``_layer_kind``, ``_empty_stackup``, the variant merge and comparison) so the
two shapes cannot drift.  Only :func:`board_projections_from_design` talks to
the bundle reader; it is the one seam a caller needs.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.release_studio.projections import (
    _SOURCE_NAMES,
    _VIA_TYPES,
    TESTPOINT_PREFIX,
    _compare_variant_sources,
    _declaration_map,
    _empty_stackup,
    _layer_kind,
    _merge_declaration_names,
    _variant_declaration,
)
from app.release_studio.semantic import semantic_scope_projections

#: The members these projections need.  ``project.json`` is named here so a
#: revision is read as one bundle even though no projection below consumes the
#: project document (the closure adapter does).
MEMBERS = (
    "projections/stackup.json",
    "projections/placements.json",
    "projections/occurrences.json",
    "projections/board-objects.json",
    "projections/project.json",
)

#: The a1+ semantic index, reduced to the a0 view the scope fingerprint hashes
#: (ADR amendment C3 §5).
SEMANTIC_MEMBER = "projections/semantic-index.json"
SEMANTIC_A0_SCHEMA = "prism.semantic_index_a0"

#: Fields `prism.semantic_index.a1`/`a2` adds to the a0 document.  They appear
#: on terminals; the walk is recursive so a future nesting cannot reintroduce
#: them into the fingerprint.
SEMANTIC_A1_FIELDS = frozenset(
    {"pinName", "pinType", "libraryRef", "schematicNetName"}
)

STACKUP_SCHEMA = "prism.release_studio.stackup.a0"
VARIANTS_SCHEMA = "prism.release_studio.variants.a0"

#: Row kinds that carry a physical thickness (`projections.py` sums these).
_PHYSICAL_KINDS = frozenset({"copper", "dielectric", "mask"})


def _fold_forms(
    entries: list[Mapping[str, Any]],
) -> list[list[Mapping[str, Any]]]:
    """Fold the member's per-sub-layer entries into stackup ``(layer …)`` forms.

    ``stackup.md`` "Fold to forms": a form's own values are the group's first
    entry (``sublayer: 0``); each later entry is one ``addsublayer`` after it.
    Today's readers see one row per form, so every field below is the first
    value written across the group (kicad_monkey reads the first match in the
    form's text).
    """

    if not entries:
        return []
    groups: list[list[Mapping[str, Any]]] = [[entries[0]]]
    for entry in entries[1:]:
        if entry.get("sublayer", 0) == 0:
            groups.append([entry])
        else:
            groups[-1].append(entry)
    return groups


def _first(group: list[Mapping[str, Any]], key: str) -> Any:
    for entry in group:
        if key in entry:
            return entry[key]
    return None


def stackup(member: Mapping[str, Any]) -> dict[str, Any]:
    """``project_stackup`` from ``projections/stackup.json`` (stackup.md, RS)."""

    present = bool(member.get("present"))
    # stackup.md "RS": present -> board.setup.stackup, else board.layers, and
    # D5 — the bundle has no kicad_monkey targeted-fallback source tag.
    model_source = "board.setup.stackup" if present else "board.layers"

    layers: list[dict[str, Any]] = []
    if present:
        for order, group in enumerate(_fold_forms(list(member.get("layers") or []))):
            name = _first(group, "name") or ""
            type_name = _first(group, "type")
            thickness_nm = _first(group, "thicknessNm")
            layers.append(
                {
                    "order": order,
                    "layer_id": None,
                    "name": name,
                    "type": type_name if type_name else None,
                    "material": _first(group, "material") or "",
                    "thickness": None if thickness_nm is None else thickness_nm / 1e6,
                    "epsilon_r": _first(group, "epsilonR") or None,
                    "loss_tangent": _first(group, "lossTangent") or None,
                    "color": _first(group, "color") or "",
                    "user_name": None,
                    "kind": _layer_kind(name, type_name or ""),
                }
            )
    else:
        for order, board_layer in enumerate(member.get("boardLayers") or []):
            name = str(board_layer.get("name") or "")
            type_name = board_layer.get("type")
            layers.append(
                {
                    "order": order,
                    "layer_id": int(board_layer["ordinal"]),
                    "name": name,
                    "type": type_name if type_name else "user",
                    "material": None,
                    "thickness": None,
                    "epsilon_r": None,
                    "loss_tangent": None,
                    "color": None,
                    "user_name": board_layer.get("userName") or None,
                    "kind": _layer_kind(name, type_name or "user"),
                }
            )
    if not layers:
        return _empty_stackup()

    copper_layers = [layer["name"] for layer in layers if layer["kind"] == "copper"]
    dielectric_layers = [
        layer["name"] for layer in layers if layer["kind"] == "dielectric"
    ]
    physical_layers = [
        layer for layer in layers if layer["kind"] in _PHYSICAL_KINDS
    ]
    thickness_values = [
        float(layer["thickness"])
        for layer in physical_layers
        if layer["thickness"] is not None
    ]
    thickness_complete = bool(physical_layers) and all(
        layer["thickness"] is not None for layer in physical_layers
    )
    total_thickness = float(sum(thickness_values)) if thickness_complete else None

    settings_member = member.get("settings") or {}
    if present:
        setting = settings_member
        edge_connector = setting.get("edgeConnector")
        settings = {
            "copper_finish": setting.get("copperFinish") or "",
            "dielectric_constraints": bool(setting.get("dielectricConstraints", False)),
            "edge_connector": (
                None if edge_connector in (None, "", "none") else str(edge_connector)
            ),
            "edge_plating": bool(setting.get("edgePlating", False)),
        }
    else:
        settings = {
            "copper_finish": None,
            "dielectric_constraints": None,
            "edge_connector": None,
            "edge_plating": None,
        }

    via_type_counts = {via_type: 0 for via_type in _VIA_TYPES}
    via_spans: list[dict[str, Any]] = []
    for span in member.get("viaSpans") or []:
        via_type = span["viaType"]
        if via_type in via_type_counts:
            via_type_counts[via_type] += span["count"]
        span_layers = list(span.get("spanLayers") or [])
        via_spans.append(
            {
                "via_type": via_type,
                "start_layer": span.get("startLayer"),
                "stop_layer": span.get("stopLayer"),
                "span_layers": span_layers or None,
                "span_layer_count": len(span_layers) if span_layers else None,
                "backdrill": _drill(span.get("backdrill")),
                "tertiary_drill": _drill(span.get("tertiaryDrill")),
                "count": span["count"],
            }
        )

    board_thickness_nm = member.get("boardThicknessNm")
    return {
        "schema": STACKUP_SCHEMA,
        "present": present,
        "source": model_source,
        "source_detail": model_source,
        "fallback_reason": None,
        "units": "mm",
        "layers": layers,
        "copper_layers": copper_layers,
        "dielectric_layers": dielectric_layers,
        "copper_layer_count": len(copper_layers),
        "dielectric_layer_count": len(dielectric_layers),
        "board_thickness": (
            (board_thickness_nm / 1e6) if board_thickness_nm else None
        ),
        "total_thickness": total_thickness,
        "total_thickness_status": (
            "available"
            if thickness_complete
            else "partial"
            if thickness_values
            else "unsupported"
        ),
        "total_thickness_source": (
            "board.setup.stackup.layer.thickness" if thickness_complete else None
        ),
        "settings": settings,
        "via_count": sum(via_type_counts.values()),
        "via_type_counts": via_type_counts,
        "via_spans": via_spans,
    }


def _drill(drill: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """RS ``_drill_span`` from a ``StackupViaDrill`` (nm -> mm)."""

    if not drill:
        return None
    size_nm = drill.get("sizeNm")
    return {
        "size": None if size_nm is None else size_nm / 1e6,
        "start_layer": drill.get("startLayer") or None,
        "stop_layer": drill.get("stopLayer") or None,
    }


def _board_footprints(member: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return list(member.get("footprints") or [])


def population(member: Mapping[str, Any]) -> dict[str, Any]:
    """``project_population`` from ``projections/placements.json``."""

    sides: dict[str, dict[str, Any]] = {
        "top": {
            "components": 0,
            "dnp": 0,
            "fitted": 0,
            "absent_from_position_file": 0,
            "dnp_refs": [],
        },
        "bottom": {
            "components": 0,
            "dnp": 0,
            "fitted": 0,
            "absent_from_position_file": 0,
            "dnp_refs": [],
        },
    }
    for footprint in _board_footprints(member):
        if not footprint.get("reference"):
            continue
        counts = sides["bottom" if footprint.get("side") == "back" else "top"]
        counts["components"] += 1
        if footprint.get("dnp"):
            counts["dnp"] += 1
            counts["dnp_refs"].append(str(footprint.get("reference")))
        else:
            counts["fitted"] += 1
        if footprint.get("excludeFromPosFiles"):
            counts["absent_from_position_file"] += 1
    for counts in sides.values():
        counts["dnp_refs"] = sorted(counts["dnp_refs"])
    return {"source": "board.footprints", "sides": sides}


def _first_pad_nets(
    board_objects: Mapping[str, Any] | None,
) -> dict[str, str]:
    """Each footprint's first pad's net, by designator.

    ``projections/board-objects.json`` lists footprints and pads as sibling
    objects in document order; a pad's ``net`` is the net it is connected to
    and a pad with none is unconnected.  The first pad decides, because a
    testpoint probe target is that pad -- reading a later pad would name a net
    the probe never touches.
    """

    if not board_objects:
        return {}
    references: dict[str, str] = {}
    for document in board_objects.get("documents") or []:
        for item in document.get("objects") or []:
            if item.get("kind") == "footprint" and item.get("uuid"):
                references[str(item["uuid"])] = str(item.get("refdes") or "").strip()

    nets: dict[str, str] = {}
    for document in board_objects.get("documents") or []:
        for item in document.get("objects") or []:
            if item.get("kind") != "pad":
                continue
            reference = str(item.get("refdes") or "").strip()
            if not reference:
                reference = references.get(str(item.get("parentUuid") or ""), "")
            if not reference or reference in nets:
                continue
            net = item.get("net")
            nets[reference] = str(net).strip() if net not in (None, "") else "—"
    return nets


def testpoints(
    member: Mapping[str, Any],
    *,
    prefix: str = TESTPOINT_PREFIX,
    board_objects: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """``project_testpoints`` from ``projections/placements.json``.

    The net comes from the pad itself in ``projections/board-objects.json``;
    without that member (or for a testpoint whose first pad is unconnected) it
    is stated as ``—`` rather than guessed.
    """

    marker = prefix.strip().upper()
    nets = _first_pad_nets(board_objects)
    found: list[dict[str, Any]] = []
    for footprint in _board_footprints(member):
        reference = str(footprint.get("reference") or "")
        if not reference.strip().upper().startswith(marker):
            continue
        position = footprint.get("positionNm") or {}
        rotation = footprint.get("rotationDeg") or 0
        # A coordinate of exactly 0 is a position, not a missing one.
        x_nm = position.get("xNm")
        y_nm = position.get("yNm")
        found.append(
            {
                "ref": reference,
                "net": nets.get(reference.strip(), "—"),
                "side": "bottom" if footprint.get("side") == "back" else "top",
                "x": (x_nm / 1e6) if x_nm is not None else None,
                "y": (y_nm / 1e6) if y_nm is not None else None,
                # placements.md D1: 0 is "no rotation"; today writes 0.0 only
                # for a hand-written `(at x y 0)`, which KiCad never emits.
                "rotation": None if rotation == 0 else float(rotation),
                "excluded_from_position_file": bool(
                    footprint.get("excludeFromPosFiles")
                ),
            }
        )
    return {"source": "board.footprints", "prefix": prefix, "testpoints": found}


def designators(member: Mapping[str, Any]) -> tuple[str, ...]:
    """``board_designators`` from ``projections/placements.json``."""

    # placements.md D6: today trims the reference; the member keeps it as
    # written, so C3 trims when deriving.
    return tuple(
        sorted({str(reference).strip() for reference in member.get("designators") or [] if str(reference).strip()})
    )


def variants(member: Mapping[str, Any]) -> dict[str, Any]:
    """``project_variants`` from ``projections/occurrences.json``.

    Production passes no schematic path (``document_pipeline.py``), so the
    schematic source is always empty here (occurrences.md, C3 reading rules).
    """

    board_declarations = _board_declarations(member)
    project_declarations = _project_declarations(member)
    schematic_declarations: list[dict[str, Any]] = []
    declarations_by_source = {
        "board": board_declarations,
        "project": project_declarations,
        "schematic": schematic_declarations,
    }

    ordered_names: list[str] = []
    for source_name in _SOURCE_NAMES:
        for declaration in declarations_by_source[source_name]:
            name = declaration["name"]
            if name not in ordered_names:
                ordered_names.append(name)

    divergence_reasons: list[dict[str, Any]] = []
    present_sources = [
        source_name
        for source_name in _SOURCE_NAMES
        if declarations_by_source[source_name]
    ]
    for index, left_name in enumerate(present_sources):
        for right_name in present_sources[index + 1 :]:
            difference = _compare_variant_sources(
                left_name,
                declarations_by_source[left_name],
                right_name,
                declarations_by_source[right_name],
            )
            if difference is not None:
                divergence_reasons.append(difference)

    declarations_by_name = {
        source_name: _declaration_map(declarations_by_source[source_name])
        for source_name in _SOURCE_NAMES
    }
    variant_rows: list[dict[str, Any]] = []
    for name in ordered_names:
        source_membership = {
            source_name: name in declarations_by_name[source_name]
            for source_name in _SOURCE_NAMES
        }
        sources = [
            source_name
            for source_name in _SOURCE_NAMES
            if source_membership[source_name]
        ]
        variant_rows.append(
            {
                "name": name,
                "is_default": name == "default"
                or any(
                    declarations_by_name[source_name].get(name, {}).get("is_default")
                    is True
                    for source_name in sources
                ),
                "sources": sources,
                "source_membership": source_membership,
                "declarations": {
                    source_name: declarations_by_name[source_name][name]
                    for source_name in sources
                },
            }
        )

    default_names = [row["name"] for row in variant_rows if row["is_default"]]
    default_name = default_names[0] if default_names else None
    default_sources = [
        source_name
        for source_name in _SOURCE_NAMES
        if default_name is not None
        and default_name in declarations_by_name[source_name]
    ]
    return {
        "schema": VARIANTS_SCHEMA,
        "diverged": bool(divergence_reasons),
        "sources": present_sources,
        "source_membership": {
            source_name: bool(declarations_by_source[source_name])
            for source_name in _SOURCE_NAMES
        },
        "ordering": ordered_names,
        "default": {"name": default_name, "sources": default_sources},
        "declarations": {
            source_name: declarations_by_source[source_name]
            for source_name in _SOURCE_NAMES
        },
        "variants": variant_rows,
        "divergence_reasons": divergence_reasons,
    }


def _board_declarations(member: Mapping[str, Any]) -> list[dict[str, Any]]:
    """``_board_variant_declarations`` from the occurrences member.

    Board header declarations are the member's ``pcb`` records; the assignments
    are the ``dnp`` records of ``/footprints/*/variants`` (occurrences.md, C3
    reading rules).  ``_merge_declaration_names`` owns the union order and the
    reference-sorted assignment maps.
    """

    declarations = [
        _variant_declaration(record["name"], record.get("description"), None)
        for record in member.get("variantDeclarations") or []
        if record.get("source") == "pcb" and record.get("name")
    ]
    assignments: dict[str, dict[str, bool]] = {}
    for footprint in _board_footprints(member):
        reference = footprint.get("reference")
        if not reference:
            continue
        for override in footprint.get("variants") or []:
            name = override.get("name")
            dnp = override.get("dnp")
            if name and dnp is not None:
                assignments.setdefault(name, {})[reference] = bool(dnp)
    return _merge_declaration_names(declarations, assignments)


def _project_declarations(member: Mapping[str, Any]) -> list[dict[str, Any]]:
    """``_project_variant_declarations`` from the occurrences member."""

    return [
        _variant_declaration(record["name"], record.get("description"), None)
        for record in member.get("variantDeclarations") or []
        if record.get("source") == "project" and record.get("name")
    ]


def _without_a1_fields(value: Any) -> Any:
    """``value`` with the a1 additions removed, at every depth."""

    if isinstance(value, Mapping):
        return {
            key: _without_a1_fields(child)
            for key, child in value.items()
            if key not in SEMANTIC_A1_FIELDS
        }
    if isinstance(value, list):
        return [_without_a1_fields(child) for child in value]
    return value


def semantic_index_a0(member: Mapping[str, Any]) -> dict[str, Any]:
    """The a0-compatible view of a bundle semantic index (ADR amendment §5).

    P1's parity contract is "a1 equals the a0 golden plus those additions", so
    removing them and naming the a0 schema makes the technical-scope
    fingerprint equal to today's for the same revision.  The walk is recursive:
    the four fields are documented on terminals, but the reduction must not
    depend on where a later schema puts them.
    """

    reduced = _without_a1_fields(member)
    reduced["schema"] = SEMANTIC_A0_SCHEMA
    return dict(reduced)


def build(documents: Mapping[str, Any]) -> dict[str, Any]:
    """Every projection from the parsed member documents, by member path."""

    placements = documents["projections/placements.json"]
    return {
        "stackup": stackup(documents["projections/stackup.json"]),
        "variants": variants(documents["projections/occurrences.json"]),
        "testpoints": testpoints(
            placements, board_objects=documents["projections/board-objects.json"]
        ),
        "population": population(placements),
        "designators": designators(placements),
    }


def board_projections_from_design(design: Any) -> dict[str, Any]:
    """The five projections from an already-checked :class:`bundle_design.BundleDesign`.

    The build's readiness answer already opened and verified the archive, so
    this reads the members directly instead of re-opening the revision.  A read
    fault propagates: there is no legacy parse to fall back to.
    """

    documents = {path: design.opened.read_json(path) for path in MEMBERS}
    return build(documents)


def semantic_scope_from_design(design: Any) -> dict[str, dict[str, Any]]:
    """The a0-compatible scope projections of a checked design (C3b)."""

    return semantic_scope_projections(
        semantic_index_a0(design.opened.read_json(SEMANTIC_MEMBER))
    )


__all__ = [
    "MEMBERS",
    "SEMANTIC_A1_FIELDS",
    "SEMANTIC_A0_SCHEMA",
    "SEMANTIC_MEMBER",
    "board_projections_from_design",
    "build",
    "designators",
    "population",
    "semantic_index_a0",
    "semantic_scope_from_design",
    "stackup",
    "testpoints",
    "variants",
]
