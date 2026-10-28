"""Read-only, deterministic projections of authoritative KiCad facts.

KiCad owns the board-statistics schema.  This module normalizes that typed
document into the stable Release Studio projection schema; the board
projections themselves come from the design bundle
(:mod:`app.release_studio.bundle_projections`).  No function starts KiCad,
opens a source file for writing, or updates a fixture/check-out.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from app.release_studio.canonical import canonicalize_board_stats_json
from app.release_studio.canonical.json import canonical_json_bytes

PathLike = str | Path
JsonValue = Any

PROJECTION_SCHEMA = "prism.release_studio.board_projections.a0"
BOARD_STATS_SOURCE = "kicad-cli pcb export stats --format json"
_SOURCE_NAMES = ("board", "project", "schematic")
_VIA_TYPES = ("through", "blind", "buried", "micro")


def _read_text(path: PathLike) -> str:
    """Read one source file without exposing a write-capable file handle."""

    return Path(path).read_text(encoding="utf-8", errors="replace")


def _read_json_source(source: Any) -> Mapping[str, Any]:
    if isinstance(source, Mapping):
        return source
    if isinstance(source, bytes):
        payload = json.loads(source.decode("utf-8"))
    elif isinstance(source, Path):
        payload = json.loads(_read_text(source))
    elif isinstance(source, str):
        # JSON text is common at this boundary.  Parse an object-shaped string
        # before treating it as a possible path so long input cannot leak the
        # platform's filename-too-long OSError from Path.is_file().
        if source.lstrip().startswith("{"):
            payload = json.loads(source)
        else:
            try:
                candidate = Path(source)
                source_is_file = candidate.is_file()
            except (OSError, ValueError):
                source_is_file = False
            if source_is_file:
                payload = json.loads(_read_text(candidate))
            else:
                payload = json.loads(source)
    else:
        raise TypeError("JSON source must be a mapping, path, text, or bytes")
    if not isinstance(payload, Mapping):
        raise ValueError("JSON projection source must be an object")
    return payload


def _canonicalize_board_stats_object(value: Mapping[str, Any]) -> dict[str, Any]:
    """Reuse R4's one-object board-stats canonicalization boundary."""

    canonical = canonicalize_board_stats_json(canonical_json_bytes(value))
    normalized = json.loads(canonical.decode("utf-8"))
    if not isinstance(normalized, dict):
        raise AssertionError("canonical board stats object was not a mapping")
    return normalized


def project_board_stats(source: Mapping[str, Any] | PathLike | bytes) -> dict[str, Any]:
    """Return a timestamp-free copy of KiCad's board statistics JSON.

    The projection does not derive or rename board facts.  It preserves the
    KiCad 10.0.4 payload as emitted by ``pcb export stats --format json`` and
    removes the volatile root ``metadata.date`` field.  When a caller supplies
    the known R4-style wrapper, its nested ``stats`` object is canonicalized as
    the raw KiCad payload too; unrelated nested objects are left untouched.
    """

    payload = _read_json_source(source)
    projected = _canonicalize_board_stats_object(payload)
    nested_stats = projected.get("stats")
    if isinstance(nested_stats, Mapping):
        projected["stats"] = _canonicalize_board_stats_object(nested_stats)
    return projected


def project_board_stats_file(path: PathLike) -> dict[str, Any]:
    """Read and project a KiCad board-statistics JSON file."""

    return project_board_stats(Path(path))


def _layer_kind(name: str, layer_type: str | None) -> str:
    type_text = (layer_type or "").casefold().replace("_", " ")
    name_text = name.casefold()
    if "copper" in type_text or name_text.endswith(".cu"):
        return "copper"
    if type_text in {"prepreg", "core"} or "dielectric" in type_text:
        return "dielectric"
    if "mask" in type_text or "mask" in name_text:
        return "mask"
    if "paste" in type_text or "paste" in name_text:
        return "paste"
    if "silk" in type_text or "silk" in name_text:
        return "silkscreen"
    return "other"


def _empty_stackup() -> dict[str, Any]:
    return {
        "schema": "prism.release_studio.stackup.a0",
        "present": False,
        "source": "none",
        "units": "mm",
        "layers": [],
        "copper_layers": [],
        "dielectric_layers": [],
        "copper_layer_count": 0,
        "dielectric_layer_count": 0,
        "board_thickness": None,
        "total_thickness": None,
        "total_thickness_status": "unsupported",
        "total_thickness_source": None,
        "settings": {
            "copper_finish": None,
            "dielectric_constraints": None,
            "edge_connector": None,
            "edge_plating": None,
        },
        "via_count": 0,
        "via_type_counts": {via_type: 0 for via_type in _VIA_TYPES},
        "via_spans": [],
    }


def _variant_declaration(
    name: str,
    description: str | None,
    is_default: bool | None,
    assignments: Mapping[str, bool] | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "is_default": name == "default" if is_default is None else is_default,
        "assignments": {
            reference: bool(value)
            for reference, value in sorted((assignments or {}).items())
        },
    }


def _merge_declaration_names(
    declarations: list[dict[str, Any]],
    names: Mapping[str, Mapping[str, bool]],
) -> list[dict[str, Any]]:
    by_name = {declaration["name"]: declaration for declaration in declarations}
    for name, assignments in names.items():
        if name not in by_name:
            by_name[name] = _variant_declaration(name, None, None, assignments)
        elif assignments:
            merged = dict(by_name[name]["assignments"])
            merged.update(assignments)
            by_name[name]["assignments"] = {
                reference: merged[reference] for reference in sorted(merged)
            }
    return [by_name[name] for name in by_name]


#: Reference-designator prefix that marks a testpoint.
#:
#: KiCad has no testpoint *type*, so the designator is the convention -- and it
#: is the same string the artwork configuration selects on, which is what keeps
#: the drawing and its schedule talking about the same set of parts.
TESTPOINT_PREFIX = "TP"


def _declaration_map(declarations: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        declaration["name"]: {
            "description": declaration["description"],
            "is_default": declaration["is_default"],
            "assignments": declaration["assignments"],
        }
        for declaration in declarations
    }


def _compare_variant_sources(
    left_name: str,
    left: list[dict[str, Any]],
    right_name: str,
    right: list[dict[str, Any]],
) -> dict[str, Any] | None:
    left_map = _declaration_map(left)
    right_map = _declaration_map(right)
    left_names = set(left_map)
    right_names = set(right_map)
    changed = sorted(
        name
        for name in left_names & right_names
        if (
            (
                left_map[name]["description"] is not None
                and right_map[name]["description"] is not None
                and left_map[name]["description"] != right_map[name]["description"]
            )
            or left_map[name]["is_default"] != right_map[name]["is_default"]
            or (
                left_map[name]["assignments"]
                and right_map[name]["assignments"]
                and left_map[name]["assignments"] != right_map[name]["assignments"]
            )
        )
    )
    missing_left = sorted(right_names - left_names)
    missing_right = sorted(left_names - right_names)
    if not changed and not missing_left and not missing_right:
        return None
    return {
        "left": left_name,
        "right": right_name,
        "missing_in_left": missing_left,
        "missing_in_right": missing_right,
        "changed": changed,
    }


__all__ = [
    "BOARD_STATS_SOURCE",
    "PROJECTION_SCHEMA",
    "project_board_stats",
    "project_board_stats_file",
]
