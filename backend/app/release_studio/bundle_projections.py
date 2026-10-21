"""Release Studio's board projections, rebuilt from design-bundle members.

With ``PRISM_DESIGN_SOURCE_RELEASE_STUDIO=bundle`` and a resolved commit, the
five read-only board projections of :mod:`app.release_studio.projections` come
from the bundle instead of Python ``kicad_monkey``:

- ``stackup`` from ``projections/stackup.json`` (``prism.stackup.a0``);
- ``population``, ``testpoints`` and ``designators`` from
  ``projections/placements.json`` (``prism.placements.a1``);
- ``variants`` from ``projections/occurrences.json``
  (``prism.occurrences.a0``).

The rules are the field maps' "derivations of today's values": ``stackup.md``
("RS", C3), ``placements.md`` ("Release Studio (C3)") and ``occurrences.md``
("Release Studio variant declarations", C3).  Each function here is a pure
function of the parsed member document with no file access, so it can be
unit-tested against the committed goldens without a bundle.

The functions reuse the pure presentation helpers of the legacy module
(``_layer_kind``, ``_empty_stackup``, the variant merge and comparison) so the
two shapes cannot drift.  Only :func:`board_projections_from_bundle` talks to
the bundle reader; it is the one seam a caller needs.
"""

from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)

#: The members these projections need.  ``project.json`` is named here because
#: ADR §8's switch is per consumer: a revision is read as one bundle even though
#: no projection below consumes the project document yet (the closure adapter
#: does, in a later chunk).
MEMBERS = (
    "projections/stackup.json",
    "projections/placements.json",
    "projections/occurrences.json",
    "projections/project.json",
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

    sides: dict[str, dict[str, int]] = {
        "top": {"components": 0, "dnp": 0, "fitted": 0, "absent_from_position_file": 0},
        "bottom": {"components": 0, "dnp": 0, "fitted": 0, "absent_from_position_file": 0},
    }
    for footprint in _board_footprints(member):
        if not footprint.get("reference"):
            continue
        counts = sides["bottom" if footprint.get("side") == "back" else "top"]
        counts["components"] += 1
        if footprint.get("dnp"):
            counts["dnp"] += 1
        else:
            counts["fitted"] += 1
        if footprint.get("excludeFromPosFiles"):
            counts["absent_from_position_file"] += 1
    return {"source": "board.footprints", "sides": sides}


def testpoints(
    member: Mapping[str, Any], *, prefix: str = TESTPOINT_PREFIX
) -> dict[str, Any]:
    """``project_testpoints`` from ``projections/placements.json``."""

    marker = prefix.strip().upper()
    found: list[dict[str, Any]] = []
    for footprint in _board_footprints(member):
        reference = str(footprint.get("reference") or "")
        if not reference.strip().upper().startswith(marker):
            continue
        position = footprint.get("positionNm") or {}
        rotation = footprint.get("rotationDeg") or 0
        x_nm = position.get("xNm") or 0
        y_nm = position.get("yNm") or 0
        found.append(
            {
                "ref": reference,
                "side": "bottom" if footprint.get("side") == "back" else "top",
                "x": (x_nm / 1e6) if x_nm else None,
                "y": (y_nm / 1e6) if y_nm else None,
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


def build(documents: Mapping[str, Any]) -> dict[str, Any]:
    """Every projection from the parsed member documents, by member path."""

    placements = documents["projections/placements.json"]
    return {
        "stackup": stackup(documents["projections/stackup.json"]),
        "variants": variants(documents["projections/occurrences.json"]),
        "testpoints": testpoints(placements),
        "population": population(placements),
        "designators": designators(placements),
    }


def board_projections_from_bundle(
    project_id: str, commit: str | None, *, requested_by: str = ""
) -> dict[str, Any] | None:
    """The five projections the bundle holds for a resolved commit, or ``None``.

    ``bundle_read`` owns the switch and the rollout fallback: it answers ``None``
    for the ``legacy`` switch, a member that is not ready yet (it queues the
    build) and a member that failed, and this function then serves the legacy
    path.  A member that is final but not ``ready`` (``skipped``,
    ``not-applicable``) is no projection either, so it falls back too.  A
    working tree — no resolved commit, which the bundle key cannot name — can
    hold uncommitted changes a committed bundle does not carry, so it is never
    read here.

    Any read fault (an unreadable or malformed member) falls back to the legacy
    projections rather than failing the build.
    """

    if not commit or not project_id:
        return None
    from app.services.design_bundle.consumer import bundle_read

    read = bundle_read(
        "RELEASE_STUDIO", project_id, commit, MEMBERS, requested_by=requested_by
    )
    if read is None or not all(read.ready(path) for path in MEMBERS):
        return None
    try:
        documents = {path: read.json(path) for path in MEMBERS}
        return build(documents)
    except Exception as error:  # noqa: BLE001 - a bundle-side fault must not break the legacy path
        logger.warning(
            "design bundle: the Release Studio board members of %s@%s are "
            "unreadable: %s",
            project_id,
            commit,
            error,
        )
        return None


__all__ = [
    "MEMBERS",
    "board_projections_from_bundle",
    "build",
    "designators",
    "population",
    "stackup",
    "testpoints",
    "variants",
]
