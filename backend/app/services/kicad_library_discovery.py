from __future__ import annotations

import hashlib
import copy
import re
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

from app.services.kicad_library_reader import (
    FolderInventory,
    footprint_identity,
    footprint_name,
    library_symbols,
    model_references,
    property_value,
    symbol_properties,
)


DISCOVERY_SUFFIXES = {".kicad_sym", ".kicad_mod"}
MODEL_SUFFIXES = frozenset({".step", ".stp", ".wrl"})
SPICE_SUFFIXES = {".lib", ".mod", ".mdl", ".cir", ".sub", ".subckt", ".spice"}
_DISCOVERY_CACHE_LIMIT = 8
_discovery_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
_discovery_cache_lock = threading.Lock()


def identity_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def common_prefix_length(left: str, right: str) -> int:
    count = 0
    for left_char, right_char in zip(left, right):
        if left_char != right_char:
            break
        count += 1
    return count


def normalize_inventory(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in items:
        relative_path = str(raw.get("relative_path") or "").replace("\\", "/").strip().lstrip("/")
        path = Path(relative_path)
        if not relative_path or path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
            raise ValueError(f"Invalid inventory path: {relative_path or '<empty>'}")
        key = relative_path.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append({
            "relative_path": path.as_posix(),
            "size_bytes": max(0, int(raw.get("size_bytes") or 0)),
            "suffix": path.suffix.casefold(),
        })
    return normalized


def discover_library(
    source_files: list[dict[str, Any]],
    inventory_items: list[dict[str, Any]],
    footprint_resolutions: dict[str, str] | None = None,
) -> dict[str, Any]:
    inventory = normalize_inventory(inventory_items)
    signature_payload = "\n".join([
        *(f"source:{item.get('relative_path', '')}:{item.get('sha256', '')}:{item.get('size_bytes', '')}" for item in source_files),
        *(f"inventory:{item['relative_path']}:{item['size_bytes']}" for item in inventory),
        *(f"resolution:{key}:{value}" for key, value in sorted((footprint_resolutions or {}).items())),
    ])
    directory_signature = hashlib.sha256(signature_payload.encode("utf-8")).hexdigest()
    with _discovery_cache_lock:
        cached = _discovery_cache.get(directory_signature)
        if cached is not None:
            _discovery_cache.move_to_end(directory_signature)
            return copy.deepcopy(cached)
    folder = FolderInventory(inventory)

    footprints_by_identity: dict[str, list[dict[str, Any]]] = {}
    all_footprints: list[dict[str, Any]] = []
    source_by_path = {str(item["relative_path"]).casefold(): item for item in source_files}
    for source in source_files:
        relative_path = str(source["relative_path"])
        if Path(relative_path).suffix.casefold() != ".kicad_mod":
            continue
        library, filename_name = footprint_identity(relative_path)
        text = Path(str(source["object_path"])).read_text(encoding="utf-8", errors="replace")
        name = footprint_name(text) or filename_name
        footprint = {"relative_path": relative_path, "library": library, "name": name, "filename_name": filename_name}
        all_footprints.append(footprint)
        footprints_by_identity.setdefault(f"{library}:{name}".casefold(), []).append(footprint)
        footprints_by_identity.setdefault(name.casefold(), []).append(footprint)
        if filename_name.casefold() != name.casefold():
            footprints_by_identity.setdefault(f"{library}:{filename_name}".casefold(), []).append(footprint)
            footprints_by_identity.setdefault(filename_name.casefold(), []).append(footprint)

    components: list[dict[str, Any]] = []
    required_paths: set[str] = set()
    for source in source_files:
        source_path = str(source["relative_path"])
        if Path(source_path).suffix.casefold() != ".kicad_sym":
            continue
        text = Path(str(source["object_path"])).read_text(encoding="utf-8", errors="replace")
        library = Path(source_path).stem or "Prism_Imported"
        required_paths.add(source_path)
        for symbol_name, symbol_block in library_symbols(text):
            properties = symbol_properties(symbol_block)
            component_id = hashlib.sha256(f"{source_path}\0{symbol_name}".encode()).hexdigest()
            footprint_ref = property_value(properties, "Footprint")
            footprint_matches = []
            suggested_matches = False
            if footprint_ref:
                footprint_matches = footprints_by_identity.get(footprint_ref.casefold(), [])
                if not footprint_matches:
                    footprint_matches = footprints_by_identity.get(footprint_ref.rsplit(":", 1)[-1].casefold(), [])
                if not footprint_matches:
                    ref_library, separator, ref_name = footprint_ref.rpartition(":")
                    if not separator:
                        ref_name = footprint_ref
                    normalized_name = identity_key(ref_name)
                    normalized_library = identity_key(ref_library)
                    for candidate in all_footprints:
                        candidate_names = (str(candidate["name"]), str(candidate["filename_name"]))
                        if any(
                            identity_key(candidate_name) == normalized_name
                            or (
                                len(normalized_name) >= 4
                                and identity_key(candidate_name).endswith(normalized_name)
                                and (not normalized_library or identity_key(candidate_name).startswith(normalized_library))
                            )
                            for candidate_name in candidate_names
                        ):
                            footprint_matches.append(candidate)
                if not footprint_matches:
                    symbol_key = identity_key(symbol_name)
                    symbol_library_key = identity_key(library)
                    footprint_matches = [
                        candidate for candidate in all_footprints
                        if identity_key(str(candidate["library"])) == symbol_library_key
                        and max(
                            common_prefix_length(symbol_key, identity_key(str(candidate["name"]))),
                            common_prefix_length(symbol_key, identity_key(str(candidate["filename_name"]))),
                        ) >= 4
                    ]
                    suggested_matches = bool(footprint_matches)
            # The same footprint is indexed by both qualified and bare names.
            footprint_matches = list({item["relative_path"]: item for item in footprint_matches}.values())
            findings: list[dict[str, str]] = []
            selected_path = str((footprint_resolutions or {}).get(component_id) or "").casefold()
            selected_footprint = next(
                (item for item in all_footprints if str(item["relative_path"]).casefold() == selected_path),
                footprint_matches[0] if len(footprint_matches) == 1 and not suggested_matches else None,
            )
            if selected_footprint and all(
                str(item["relative_path"]).casefold() != str(selected_footprint["relative_path"]).casefold()
                for item in footprint_matches
            ):
                footprint_matches.append(selected_footprint)
            if not footprint_ref:
                findings.append({"code": "missing_footprint_property", "severity": "error", "message": "Symbol does not declare a footprint."})
            elif not footprint_matches:
                findings.append({"code": "missing_footprint_mapping", "severity": "error", "message": f"Footprint {footprint_ref} was not found in the selected directory."})
            elif selected_footprint is None:
                findings.append({
                    "code": "ambiguous_footprint_mapping",
                    "severity": "error",
                    "message": (
                        f"Footprint {footprint_ref} has no exact match; choose from {len(footprint_matches)} same-library suggestion"
                        f"{'s' if len(footprint_matches) != 1 else ''}."
                        if suggested_matches
                        else f"Footprint {footprint_ref} resolves to {len(footprint_matches)} files."
                    ),
                })

            models: list[dict[str, Any]] = []
            if selected_footprint:
                required_paths.add(selected_footprint["relative_path"])
                footprint_source = source_by_path.get(selected_footprint["relative_path"].casefold())
                if footprint_source:
                    footprint_text = Path(str(footprint_source["object_path"])).read_text(encoding="utf-8", errors="replace")
                    for model_ref in model_references(footprint_text):
                        link = folder.resolve(
                            model_ref,
                            owner_relative_path=selected_footprint["relative_path"],
                            suffixes=MODEL_SUFFIXES,
                        )
                        if link.selected is not None:
                            required_paths.add(link.selected["relative_path"])
                        else:
                            findings.append({
                                "code": f"{link.status}_3d_model",
                                "severity": "warning" if link.status == "missing" else "error",
                                "message": f"3D model reference {model_ref} is {link.status}.",
                            })
                        models.append({"reference": model_ref, "status": link.status, "candidates": link.candidates})

            metadata = {
                "value": property_value(properties, "Value") or symbol_name,
                "description": property_value(properties, "Description"),
                "datasheet": property_value(properties, "Datasheet", "Data Sheet"),
                "manufacturer": property_value(properties, "Manufacturer", "Manufacturer Name", "MFR"),
                "manufacturer_part_number": property_value(properties, "Manufacturer Part Number", "MPN", "Part Number"),
                "fields": properties,
            }
            for field in ("description", "datasheet", "manufacturer", "manufacturer_part_number"):
                if not metadata[field]:
                    findings.append({"code": f"missing_metadata_{field}", "severity": "warning", "message": f"Metadata is missing: {field.replace('_', ' ')}."})
            components.append({
                "id": component_id,
                "symbol_name": symbol_name,
                "library": library,
                "metadata": metadata,
                "symbol": {"relative_path": source_path},
                "footprint_reference": footprint_ref,
                "footprint": {
                    "status": (
                        "resolved" if selected_footprint
                        else "suggested" if suggested_matches and len(footprint_matches) == 1
                        else "ambiguous" if footprint_matches
                        else "missing"
                    ),
                    "selected": selected_footprint,
                    "candidates": footprint_matches,
                },
                "models": models,
                "findings": findings,
            })

    result = {
        "components": components,
        "required_paths": sorted(required_paths),
        "inventory_file_count": len(inventory),
        "discovery_file_count": len(source_files),
        "directory_signature": directory_signature,
    }
    with _discovery_cache_lock:
        _discovery_cache[directory_signature] = copy.deepcopy(result)
        _discovery_cache.move_to_end(directory_signature)
        while len(_discovery_cache) > _DISCOVERY_CACHE_LIMIT:
            _discovery_cache.popitem(last=False)
    return result
