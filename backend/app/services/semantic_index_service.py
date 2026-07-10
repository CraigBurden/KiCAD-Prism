from __future__ import annotations

import contextlib
import datetime
import hashlib
import importlib.metadata
import json
import os
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, Iterator

from app.core.config import settings
from app.services import semantic_visualizer_service


SCHEMA = "prism.semantic_index_a0"
GENERATOR_NAME = "kicad-prism-semantic-index"
GENERATOR_VERSION = "0.1.0"
_GENERATOR_INPUTS = ("semantic-index", SCHEMA, GENERATOR_VERSION)
GENERATOR_BUILD = hashlib.sha256(
    b"\0".join(
        (
            "|".join(_GENERATOR_INPUTS).encode("utf-8"),
            Path(__file__).read_bytes(),
        )
    )
).hexdigest()[:12]

_LOCKS: dict[str, threading.Lock] = {}
_LOCKS_GUARD = threading.Lock()
SEMANTIC_SOURCE_SUFFIXES = {".kicad_pro", ".kicad_sch", ".kicad_pcb", ".kicad_sym", ".kicad_mod"}

REQUIRED_BOM_FIELDS = (
    "Value",
    "DNP",
    "Description",
    "Datasheet",
    "Manufacturer",
    "Manufacturer Part Number",
    "Vendor",
    "Vendor Part Number",
    "Footprint",
    "Mass (g)",
    "RQjC (C/W)",
    "RQjC_top (C/W)",
    "Temp_max (C)",
    "Temp_min (C)",
    "Power Dissipation (W)",
    "Rate",
)


def semantic_index_root() -> Path:
    root = Path(settings.KICAD_PROJECTS_ROOT) / ".kicad-prism" / "semantic-index"
    root.mkdir(parents=True, exist_ok=True)
    return root


def artifact_dir(project_id: str, source_revision_key: str) -> Path:
    return semantic_index_root() / project_id / source_revision_key / generator_cache_tag()


def artifact_path(project_id: str, source_revision_key: str) -> Path:
    return artifact_dir(project_id, source_revision_key) / "semantic-index.json"


def source_revision_key_for_project_file(project_file: Path) -> str:
    root = project_file.resolve().parent
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".git" in path.parts or path.suffix.lower() not in SEMANTIC_SOURCE_SUFFIXES:
            continue
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:32]


def _lock(project_id: str, source_revision_key: str) -> threading.Lock:
    key = f"{project_id}:{source_revision_key}:{GENERATOR_BUILD}"
    with _LOCKS_GUARD:
        return _LOCKS.setdefault(key, threading.Lock())


def _add_kicad_monkey_import_paths() -> None:
    explicit = os.environ.get("KICAD_MONKEY_PYTHONPATH", "").strip()
    candidates = [Path(explicit).expanduser()] if explicit else []
    for parent in Path(__file__).resolve().parents:
        candidates.extend(
            (
                parent / "kicad-monkey" / "src" / "py",
                parent / "kicad_monkey" / "src" / "py",
            )
        )
    candidates.extend((Path("/opt/kicad-monkey/src/py"), Path("/opt/kicad_monkey/src/py")))
    for candidate in candidates:
        if candidate.is_dir() and str(candidate.resolve()) not in sys.path:
            sys.path.insert(0, str(candidate.resolve()))


def _kicad_monkey_version() -> str:
    try:
        return importlib.metadata.version("kicad-monkey")
    except importlib.metadata.PackageNotFoundError:
        return "workspace"


def generator_cache_tag() -> str:
    dependency = _kicad_monkey_version().replace("/", "-").replace(" ", "-")
    return f"{GENERATOR_VERSION}-{GENERATOR_BUILD}-kicad-monkey-{dependency}"


@contextlib.contextmanager
def _project_file_for_revision(project: Any, commit: str | None) -> Iterator[tuple[Path, str | None]]:
    if not commit:
        yield semantic_visualizer_service.find_kicad_project(project.path), None
        return

    repo_root = semantic_visualizer_service._repo_root(Path(project.path))
    resolved_commit = semantic_visualizer_service._resolve_commit(repo_root, commit)
    project_rel = semantic_visualizer_service._project_relative_path(repo_root, Path(project.path))
    with tempfile.TemporaryDirectory(prefix="semantic-index-commit-") as tmp:
        checkout = Path(tmp) / "checkout"
        semantic_visualizer_service._archive_checkout(repo_root, resolved_commit, checkout)
        project_file = checkout / project_rel
        if not project_file.is_file():
            raise ValueError(f"KiCad project file not found in commit {resolved_commit}: {project_rel}")
        yield project_file, resolved_commit


def get_or_build(project: Any, commit: str | None = None) -> dict[str, Any]:
    with _project_file_for_revision(project, commit) as (project_file, resolved_commit):
        source_revision_key = source_revision_key_for_project_file(project_file)
        path = artifact_path(str(project.id), source_revision_key)
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))

        with _lock(str(project.id), source_revision_key):
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
            payload = build_semantic_index(
                project_file,
                source_revision_key=source_revision_key,
                commit=resolved_commit,
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".json.tmp")
            temporary.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
            temporary.replace(path)
            return payload


def get_status(project: Any, commit: str | None = None) -> dict[str, Any]:
    with _project_file_for_revision(project, commit) as (project_file, resolved_commit):
        source_revision_key = source_revision_key_for_project_file(project_file)
        path = artifact_path(str(project.id), source_revision_key)
        return {
            "schema": "prism.semantic_index_status_a0",
            "projectId": str(project.id),
            "sourceRevisionKey": source_revision_key,
            "commit": resolved_commit,
            "available": path.is_file(),
            "generator": {
                "name": GENERATOR_NAME,
                "version": GENERATOR_VERSION,
                "build": GENERATOR_BUILD,
                "cacheTag": generator_cache_tag(),
                "kicadMonkeyVersion": _kicad_monkey_version(),
            },
        }


def _stable_uid(prefix: str, *parts: object) -> str:
    identity = "\x1f".join(str(part or "") for part in parts)
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"{prefix}:{digest}"


def _string(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _canonical_fields(component: dict[str, Any]) -> dict[str, str]:
    parameters = {
        str(key): _string(value)
        for key, value in (component.get("parameters") or {}).items()
        if str(key)
    }
    casefolded = {key.casefold(): value for key, value in parameters.items()}

    def pick(name: str, *aliases: str) -> str:
        for candidate in (name, *aliases):
            value = casefolded.get(candidate.casefold())
            if value is not None:
                return value
        return ""

    dnp_source = pick("DNP", "kicad_dnp", "Do Not Populate", "Do Not Fit")
    dnp = "Yes" if dnp_source.strip().casefold() in {"1", "true", "yes", "y", "dnp"} else "No"
    required = {
        "Value": _string(component.get("value")) or pick("Value"),
        "DNP": dnp,
        "Description": _string(component.get("description")) or pick("Description"),
        "Datasheet": pick("Datasheet", "Data Sheet"),
        "Manufacturer": pick("Manufacturer", "MFR", "Mfr"),
        "Manufacturer Part Number": pick("Manufacturer Part Number", "MPN", "Mfr Part", "Mfr Part Number"),
        "Vendor": pick("Vendor", "Supplier"),
        "Vendor Part Number": pick("Vendor Part Number", "VPN", "Supplier Part Number", "Supplier PN"),
        "Footprint": _string(component.get("footprint")) or pick("Footprint"),
        "Mass (g)": pick("Mass (g)", "Mass", "Weight (g)"),
        "RQjC (C/W)": pick("RQjC (C/W)", "RθJC (C/W)", "RthJC"),
        "RQjC_top (C/W)": pick("RQjC_top (C/W)", "RθJC_top (C/W)", "RthJC Top"),
        "Temp_max (C)": pick("Temp_max (C)", "Max Temperature", "Tj Max"),
        "Temp_min (C)": pick("Temp_min (C)", "Min Temperature", "Tj Min"),
        "Power Dissipation (W)": pick("Power Dissipation (W)", "Power Dissipation", "Pd (W)"),
        "Rate": pick("Rate", "Rating"),
    }
    extras = {key: value for key, value in parameters.items() if key not in required}
    return {**required, **extras}


def _property_map(footprint: object) -> dict[str, str]:
    result: dict[str, str] = {}
    for prop in getattr(footprint, "properties", ()) or ():
        name = _string(getattr(prop, "name", ""))
        if name:
            result[name] = _string(getattr(prop, "value", ""))
    return result


def _net_name(pcb: object, item: object) -> str:
    resolver = getattr(pcb, "resolve_net_name", None)
    if callable(resolver):
        return _string(resolver(getattr(item, "net", None)))
    return _string(getattr(getattr(item, "net", None), "name", ""))


def _net_code(item: object) -> int | None:
    ordinal = getattr(getattr(item, "net", None), "ordinal", None)
    return int(ordinal) if isinstance(ordinal, int) else None


def build_semantic_index(
    project_file: Path,
    *,
    source_revision_key: str,
    commit: str | None = None,
) -> dict[str, Any]:
    _add_kicad_monkey_import_paths()
    try:
        from kicad_monkey import KiCadDesign
    except ImportError as exc:
        raise RuntimeError(
            "kicad-monkey is required to generate semantic-index.json; configure "
            "KICAD_MONKEY_PYTHONPATH or install the package in the backend runtime"
        ) from exc

    design = KiCadDesign.from_project_file(project_file)
    design_payload = design.to_json(include_indexes=True)

    components: list[dict[str, Any]] = []
    nets: list[dict[str, Any]] = []
    terminals: list[dict[str, Any]] = []
    indexes: dict[str, dict[str, int]] = {
        "componentByReference": {},
        "componentBySchematicUuid": {},
        "componentByPcbFootprintUuid": {},
        "terminalBySchematicPinUuid": {},
        "terminalByPcbPadUuid": {},
        "terminalByReferencePin": {},
        "netByName": {},
        "netByNetCode": {},
        "netBySchematicUuid": {},
        "netByPcbUuid": {},
    }

    component_by_reference: dict[str, dict[str, Any]] = {}
    for raw in design_payload.get("components", ()):
        reference = _string(raw.get("designator") or raw.get("reference"))
        if not reference:
            continue
        symbol_uuid = _string(raw.get("svg_id"))
        hierarchy = raw.get("hierarchy") or {}
        entry = {
            "componentUid": _stable_uid("cmp", reference, symbol_uuid),
            "reference": reference,
            "value": _string(raw.get("value")),
            "footprint": _string(raw.get("footprint")),
            "fields": _canonical_fields(raw),
            "schematicRefs": [
                {
                    "sheetInstancePath": _string(hierarchy.get("sheet_path")) or "/",
                    "page": _string(hierarchy.get("sheet")),
                    "symbolUuid": symbol_uuid,
                }
            ] if symbol_uuid else [],
            "pcbRefs": [],
            "webgpuRefs": [],
        }
        component_index = len(components)
        components.append(entry)
        component_by_reference[reference] = entry
        indexes["componentByReference"][reference] = component_index
        if symbol_uuid:
            indexes["componentBySchematicUuid"][symbol_uuid] = component_index

    net_by_name: dict[str, dict[str, Any]] = {}
    net_index_by_name: dict[str, int] = {}
    terminal_by_pair: dict[str, dict[str, Any]] = {}
    terminal_index_by_pair: dict[str, int] = {}

    for raw in design_payload.get("nets", ()):
        name = _string(raw.get("name"))
        if not name:
            continue
        graphical = raw.get("graphical") or {}
        schematic_ref = {
            "wireUuids": list(graphical.get("wires") or ()),
            "labelUuids": list(graphical.get("labels") or ()) + list(graphical.get("ports") or ()) + list(graphical.get("power_ports") or ()),
            "junctionUuids": list(graphical.get("junctions") or ()) + list(graphical.get("sheet_entries") or ()),
            "pinUuids": [],
        }
        net_entry = {
            "netUid": _stable_uid("net", name),
            "name": name,
            "netClass": _string(raw.get("net_class")),
            "schematicRefs": [schematic_ref],
            "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
            "webgpuRefs": [],
        }
        net_index = len(nets)
        nets.append(net_entry)
        net_by_name[name] = net_entry
        net_index_by_name[name] = net_index
        indexes["netByName"][name] = net_index
        for bucket in ("wireUuids", "labelUuids", "junctionUuids"):
            for source_uuid in schematic_ref[bucket]:
                indexes["netBySchematicUuid"][_string(source_uuid)] = net_index

        pins_by_pair: dict[str, dict[str, Any]] = {}
        for pin in graphical.get("pins") or ():
            pair = f"{_string(pin.get('designator'))}:{_string(pin.get('pin'))}"
            pins_by_pair[pair] = pin
        for raw_terminal in raw.get("terminals") or ():
            reference = _string(raw_terminal.get("designator"))
            pin_number = _string(raw_terminal.get("pin"))
            if not reference or not pin_number:
                continue
            pair = f"{reference}:{pin_number}"
            pin_graphic = pins_by_pair.get(pair, {})
            pin_uuid = _string(pin_graphic.get("source_pin_id") or pin_graphic.get("svg_id"))
            terminal = {
                "terminalUid": _stable_uid("term", reference, pin_number),
                "componentUid": component_by_reference.get(reference, {}).get("componentUid", _stable_uid("cmp", reference)),
                "reference": reference,
                "pin": pin_number,
                "netUid": net_entry["netUid"],
                "netName": name,
                "schematicPinUuid": pin_uuid,
            }
            terminal_index = len(terminals)
            terminals.append(terminal)
            terminal_by_pair[pair] = terminal
            terminal_index_by_pair[pair] = terminal_index
            indexes["terminalByReferencePin"][pair] = terminal_index
            if pin_uuid:
                schematic_ref["pinUuids"].append(pin_uuid)
                indexes["terminalBySchematicPinUuid"][pin_uuid] = terminal_index
                indexes["netBySchematicUuid"][pin_uuid] = net_index

    pcb = design.pcb
    if pcb is not None:
        def ensure_pcb_net(name: str, code: int | None) -> tuple[dict[str, Any], int] | tuple[None, None]:
            if not name:
                return None, None
            entry = net_by_name.get(name)
            index = net_index_by_name.get(name)
            if entry is None or index is None:
                entry = {
                    "netUid": _stable_uid("net", name),
                    "name": name,
                    "netCode": code,
                    "netClass": "",
                    "schematicRefs": [],
                    "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
                    "webgpuRefs": [],
                }
                index = len(nets)
                nets.append(entry)
                net_by_name[name] = entry
                net_index_by_name[name] = index
                indexes["netByName"][name] = index
            if code is not None:
                entry["netCode"] = code
                indexes["netByNetCode"][str(code)] = index
            return entry, index

        for footprint in getattr(pcb, "footprints", ()) or ():
            properties = _property_map(footprint)
            reference = properties.get("Reference", "")
            footprint_uuid = _string(getattr(footprint, "uuid", ""))
            component = component_by_reference.get(reference)
            if component is not None:
                component["pcbRefs"].append({"footprintUuid": footprint_uuid})
                component_index = indexes["componentByReference"].get(reference)
                if footprint_uuid and component_index is not None:
                    indexes["componentByPcbFootprintUuid"][footprint_uuid] = component_index
            for pad in getattr(footprint, "pads", ()) or ():
                pad_uuid = _string(getattr(pad, "uuid", ""))
                pin_number = _string(getattr(pad, "number", ""))
                name = _net_name(pcb, pad)
                code = _net_code(pad)
                net_entry, net_index = ensure_pcb_net(name, code)
                if net_entry is not None and net_index is not None and pad_uuid:
                    net_entry["pcbRefs"][0]["padUuids"].append(pad_uuid)
                    indexes["netByPcbUuid"][pad_uuid] = net_index
                pair = f"{reference}:{pin_number}"
                terminal = terminal_by_pair.get(pair)
                terminal_index = terminal_index_by_pair.get(pair)
                if terminal is None and reference and pin_number:
                    terminal = {
                        "terminalUid": _stable_uid("term", reference, pin_number),
                        "componentUid": component_by_reference.get(reference, {}).get("componentUid", _stable_uid("cmp", reference)),
                        "reference": reference,
                        "pin": pin_number,
                        "netUid": net_entry.get("netUid") if net_entry else None,
                        "netName": name or None,
                        "pcbPadUuid": pad_uuid,
                    }
                    terminal_index = len(terminals)
                    terminals.append(terminal)
                    terminal_by_pair[pair] = terminal
                    terminal_index_by_pair[pair] = terminal_index
                    indexes["terminalByReferencePin"][pair] = terminal_index
                elif terminal is not None:
                    terminal["pcbPadUuid"] = pad_uuid
                    if net_entry is not None:
                        terminal["netUid"] = net_entry["netUid"]
                        terminal["netName"] = name
                if pad_uuid and terminal_index is not None:
                    indexes["terminalByPcbPadUuid"][pad_uuid] = terminal_index

        for collection_name, target_key in (
            ("segments", "trackUuids"),
            ("arcs", "arcUuids"),
            ("vias", "viaUuids"),
            ("zones", "zoneUuids"),
        ):
            for item in getattr(pcb, collection_name, ()) or ():
                source_uuid = _string(getattr(item, "uuid", ""))
                name = _net_name(pcb, item)
                code = _net_code(item)
                net_entry, net_index = ensure_pcb_net(name, code)
                if net_entry is None or net_index is None or not source_uuid:
                    continue
                net_entry["pcbRefs"][0][target_key].append(source_uuid)
                indexes["netByPcbUuid"][source_uuid] = net_index

    return {
        "schema": SCHEMA,
        "sourceRevisionKey": source_revision_key,
        "commit": commit,
        "generator": {
            "name": GENERATOR_NAME,
            "version": GENERATOR_VERSION,
            "build": GENERATOR_BUILD,
            "cacheTag": generator_cache_tag(),
            "kicadMonkeyVersion": _kicad_monkey_version(),
        },
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "components": components,
        "nets": nets,
        "terminals": terminals,
        "indexes": indexes,
    }
