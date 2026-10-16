from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.config import environment_value
from app.services import kicad_footprint_normalizer
from app.services.catalog.kicad_embedded_files import decode_embedded_files, original_model_name
from app.services.kicad_library_reader import form_end, form_starts, iter_forms, model_references


def _direct_children(block: str) -> list[tuple[str, int, int, str]]:
    children: list[tuple[str, int, int, str]] = []
    depth = 0
    in_string = False
    escaped = False
    child_start: int | None = None
    for index, char in enumerate(block):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            continue
        if char == "(":
            if depth == 1:
                child_start = index
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 1 and child_start is not None:
                raw = block[child_start:index + 1]
                head_match = re.match(r"\(([A-Za-z0-9_\-]+)", raw)
                children.append((head_match.group(1) if head_match else "", child_start, index + 1, raw))
                child_start = None
    return children


def _remove_direct_children(block: str, heads: set[str]) -> str:
    spans = [(start, end) for head, start, end, _ in _direct_children(block) if head in heads]
    for start, end in reversed(spans):
        block = block[:start] + block[end:]
    return block


def _replace_quoted(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _find_symbol_definition(schematic_text: str, symbol_uuid: str) -> tuple[str, str] | None:
    uuid_marker = f'(uuid "{_replace_quoted(symbol_uuid)}")'
    instance = next(
        (block for block in iter_forms(schematic_text, "symbol") if "(lib_id " in block and uuid_marker in block),
        None,
    )
    if not instance:
        return None
    lib_id_match = re.search(r'\(lib_id\s+"([^"]+)"\)', instance)
    if not lib_id_match:
        return None
    lib_id = lib_id_match.group(1)
    definition_prefix = f'(symbol "{lib_id}"'
    definition = next(
        (block for block in iter_forms(schematic_text, "symbol") if block.startswith(definition_prefix)),
        None,
    )
    return (lib_id, definition) if definition else None


def _symbol_library_payload(
    lib_id: str,
    definition: str,
    *,
    version: str = "20231120",
    generator: str = '"kicad-prism"',
) -> tuple[str, bytes]:
    """A one-symbol library for ``definition``, named for ``lib_id``.

    ``version`` and ``generator`` come from the file the definition was read
    from, so a library extracted from a project's own ``.kicad_sym`` (or a
    schematic's cache copy) keeps that file's format instead of a hard-coded
    one. A schematic's cached definition is named ``lib_id`` (``Lib:Name``) and
    is renamed to the bare symbol name; a library definition is already bare.
    """
    symbol_name = lib_id.rsplit(":", 1)[-1]
    renamed = definition.replace(f'(symbol "{lib_id}"', f'(symbol "{_replace_quoted(symbol_name)}"', 1)
    payload = (
        f"(kicad_symbol_lib (version {version}) (generator {generator})\n"
        f"  {renamed}\n"
        ")\n"
    ).encode("utf-8")
    return symbol_name, payload


EMBED_PREFIX = "kicad-embed://"

#: Pad children a board adds and a library copy must not carry. A library
#: footprint has no net, uuid, pinfunction, pintype or teardrops.
PAD_LIBRARY_CHILDREN = frozenset({"net", "uuid"})
PAD_BOARD_CHILDREN = frozenset({"net", "uuid", "pinfunction", "pintype", "teardrops"})

#: Footprint properties a board adds to a placed part's copy.
BOARD_ONLY_FOOTPRINT_PROPERTIES = frozenset({"Sheetname", "Sheetfile"})


def _sanitize_pad(block: str, drop: frozenset[str] = PAD_LIBRARY_CHILDREN) -> str:
    return _remove_direct_children(block, set(drop))


def _remove_named_properties(block: str, names: frozenset[str]) -> str:
    """Drop direct ``(property "Name" …)`` children whose name is in ``names``."""

    spans: list[tuple[int, int]] = []
    for head, start, end, raw in _direct_children(block):
        if head != "property":
            continue
        match = re.match(r'\(property\s+"((?:\\.|[^"\\])*)"', raw)
        if match and match.group(1) in names:
            spans.append((start, end))
    for start, end in reversed(spans):
        block = block[:start] + block[end:]
    return block


def _render_library_footprint(
    block: str,
    footprint_ref: str,
    *,
    version: str,
    generator: str = '"kicad-prism"',
    pad_drop: frozenset[str] = PAD_LIBRARY_CHILDREN,
    strip_properties: frozenset[str] = frozenset(),
) -> tuple[str, bytes, list[str]]:
    """Turn a footprint form into a standalone library footprint.

    ``version`` and ``generator`` are the header the payload is written with;
    callers pass the source board's or library file's own values so the bytes
    never carry a hard-coded format. ``pad_drop`` and ``strip_properties`` name
    the board-only data to remove.
    """

    target_name = footprint_ref.rsplit(":", 1)[-1] or "ImportedFootprint"
    model_paths = model_references(block)
    # A footprint inside a board names its embedded files and the board holds
    # their data; the models come back as catalog assets instead.
    sanitized = _remove_direct_children(block, {"at", "uuid", "path", "locked", "tstamp", "embedded_files"})
    if strip_properties:
        sanitized = _remove_named_properties(sanitized, strip_properties)
    sanitized = re.sub(
        r'(\(property\s+"Reference"\s+")[^"]*(")',
        r'\1REF**\2',
        sanitized,
        count=1,
    )
    pad_spans = []
    for match in form_starts("pad").finditer(sanitized):
        end = form_end(sanitized, match.start())
        if end is not None:
            pad_spans.append((match.start(), end, sanitized[match.start():end]))
    for start, end, pad in reversed(pad_spans):
        sanitized = sanitized[:start] + _sanitize_pad(pad, pad_drop) + sanitized[end:]
    first_line_end = sanitized.find("\n")
    header = f'\n\t(version {version})\n\t(generator {generator})'
    if first_line_end >= 0:
        sanitized = sanitized[:first_line_end] + header + sanitized[first_line_end:]
    else:
        sanitized = sanitized[:-1] + header + "\n)"
    sanitized = re.sub(r'^\(footprint\s+"[^"]+"', f'(footprint "{_replace_quoted(target_name)}"', sanitized, count=1)
    return target_name, (sanitized.rstrip() + "\n").encode("utf-8"), model_paths


def _sanitize_footprint(block: str, footprint_ref: str) -> tuple[str, bytes, list[str]]:
    return _render_library_footprint(block, footprint_ref, version="20240108")


def sanitize_board_footprint(
    block: str,
    footprint_ref: str,
    *,
    version: str,
) -> tuple[str, bytes, list[str]]:
    """Sanitize a footprint read from a board into a library footprint.

    This is the bundle path's board fallback: it removes the board-only data a
    placed footprint carries (net, uuid, pinfunction, pintype, teardrops and
    the Sheetname/Sheetfile properties) and writes the board file's own format
    version, where the legacy path kept only net and uuid and a fixed version.
    """

    return _render_library_footprint(
        block,
        footprint_ref,
        version=version,
        pad_drop=PAD_BOARD_CHILDREN,
        strip_properties=BOARD_ONLY_FOOTPRINT_PROPERTIES,
    )


_PAD_HEAD = re.compile(r'\(pad\s+(?:"((?:\\.|[^"\\])*)"|([^\s()]+))\s+([^\s()]+)\s+([^\s()]+)')
_PAD_AT = re.compile(r"\(at\s+([^)]*)\)")
_PAD_SIZE = re.compile(r"\(size\s+([^)]*)\)")
_PAD_LAYERS = re.compile(r"\(layers\s+([^)]*)\)")
_PAD_DRILL = re.compile(r"\(drill\s+([^)]*)\)")
_LAYER_TOKEN = re.compile(r'"((?:\\.|[^"\\])*)"|([^\s()]+)')


def _normalized_number(token: str) -> str:
    try:
        return format(float(token), ".10g")
    except ValueError:
        return token


def _normalized_tokens(value: str) -> tuple[str, ...]:
    return tuple(_normalized_number(token) for token in value.split())


def footprint_land_pattern(payload: bytes) -> tuple[tuple[object, ...], ...]:
    """A canonical, order-independent signature of a footprint's copper pads.

    Each pad contributes its number, type, shape, layers, position, size,
    drill and angle, all normalized; the pads are returned sorted. Two copies
    of one part may differ in silk, courtyard, fabrication, text, a 3D model or
    the file's format version without their pads differing, so this signature
    lets the importer block a real land-pattern change while treating a
    cosmetic-only difference as a variant.
    """

    text = payload.decode("utf-8", errors="ignore")
    pads: list[tuple[object, ...]] = []
    for match in form_starts("pad").finditer(text):
        end = form_end(text, match.start())
        if end is None:
            continue
        block = text[match.start():end]
        head = _PAD_HEAD.match(block)
        if head is None:
            continue
        number = head.group(1) if head.group(1) is not None else head.group(2)
        at = _PAD_AT.search(block)
        size = _PAD_SIZE.search(block)
        layers = _PAD_LAYERS.search(block)
        drill = _PAD_DRILL.search(block)
        pads.append(
            (
                number,
                head.group(3),
                head.group(4),
                tuple(sorted(
                    match.group(1) if match.group(1) is not None else match.group(2)
                    for match in _LAYER_TOKEN.finditer(layers.group(1))
                )) if layers else (),
                _normalized_tokens(at.group(1)) if at else (),
                _normalized_tokens(size.group(1)) if size else (),
                _normalized_tokens(drill.group(1)) if drill else (),
            )
        )
    return tuple(sorted(pads, key=repr))


def _write_staged_asset(
    stager: "ContentAddressedAssetStager",
    *,
    asset_type: str,
    filename: str,
    payload: bytes,
    target_library: str,
    target_name: str,
    source_path: str,
) -> dict[str, Any]:
    digest = hashlib.sha256(payload).hexdigest()
    destination = stager.stage(filename=filename, payload=payload, digest=digest)
    return {
        "asset_type": asset_type,
        "filename": filename,
        "staged_path": str(destination),
        "sha256": digest,
        "size_bytes": len(payload),
        "target_library": target_library,
        "target_name": target_name,
        "source_path": source_path,
    }


@dataclass
class ContentAddressedAssetStager:
    """Stage immutable import bytes once per digest while retaining logical names.

    KiCad 3D asset admission currently derives the destination filename from the
    staged path. Therefore aliases with different logical filenames remain distinct
    directory entries, but are hard-linked to the first digest object whenever the
    filesystem supports it. Repeated digest+filename assets share the exact path.
    """

    root: Path
    _objects_by_digest: dict[str, Path] = field(default_factory=dict)

    def stage(self, *, filename: str, payload: bytes, digest: str | None = None) -> Path:
        digest = digest or hashlib.sha256(payload).hexdigest()
        safe_filename = Path(filename).name or "asset"
        destination = self.root / "sha256" / digest[:2] / digest / safe_filename
        cached = self._objects_by_digest.get(digest)
        if cached == destination and destination.is_file():
            return destination
        if destination.is_file():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                destination.write_bytes(payload)
            self._objects_by_digest.setdefault(digest, destination)
            return destination

        destination.parent.mkdir(parents=True, exist_ok=True)
        if cached and cached.is_file():
            try:
                os.link(cached, destination)
            except OSError:
                destination.write_bytes(payload)
        else:
            destination.write_bytes(payload)
        self._objects_by_digest.setdefault(digest, destination)
        return destination


def _resolve_model_path(
    raw_path: str,
    *,
    project_root: Path,
    pcb_path: Path,
    files_by_name: dict[str, tuple[Path, ...]] | None = None,
) -> Path | None:
    expanded = raw_path
    expanded = expanded.replace("${KIPRJMOD}", str(project_root))
    variable = re.match(r"^\$\{([^}]+)\}(.*)$", expanded)
    if variable:
        root = environment_value(variable.group(1))
        if root:
            expanded = str(Path(root) / variable.group(2).lstrip("/\\"))
    candidate = Path(expanded).expanduser()
    candidates = [candidate] if candidate.is_absolute() else [pcb_path.parent / candidate, project_root / candidate]
    for item in candidates:
        if item.is_file():
            return item.resolve()
    basename = Path(raw_path).name
    if basename:
        indexed = (files_by_name or {}).get(basename, ())
        local = indexed[0] if indexed else None
        if local is None and files_by_name is None:
            local = next((path for path in project_root.rglob(basename) if path.is_file()), None)
        if local:
            return local.resolve()
    return None


@dataclass(frozen=True)
class _IndexedSymbol:
    lib_id: str
    symbol_name: str
    payload: bytes
    source_path: Path


@dataclass(frozen=True)
class _IndexedFootprint:
    block: str
    source_path: Path


class ProjectAssetSnapshotIndex:
    """Reusable asset lookup for one immutable project snapshot.

    Construction performs one recursive project walk and reads every schematic and
    PCB source at most once. Component extraction afterwards is dictionary lookup
    plus payload sanitization, making a whole-project import linear in project files
    and semantic components instead of multiplying both dimensions.
    """

    def __init__(
        self,
        project_root: Path,
        *,
        stager: ContentAddressedAssetStager,
    ) -> None:
        self.project_root = project_root.resolve()
        self.stager = stager
        self.symbols_by_uuid: dict[str, _IndexedSymbol] = {}
        self.symbols_by_reference: dict[str, _IndexedSymbol] = {}
        self.footprints_by_uuid: dict[str, _IndexedFootprint] = {}
        self.footprints_by_reference: dict[str, _IndexedFootprint] = {}
        self.files_by_name: dict[str, tuple[Path, ...]] = {}
        self._model_path_cache: dict[tuple[str, Path], Path | None] = {}
        self._payload_cache: dict[Path, bytes] = {}
        self._board_embedded: dict[Path, dict[str, dict[str, Any]]] = {}
        self._build()

    @staticmethod
    def _reference_from_block(block: str) -> str:
        match = re.search(r'\(property\s+"Reference"\s+"([^"]*)"', block)
        return match.group(1) if match else ""

    def _build(self) -> None:
        project_files = sorted(path for path in self.project_root.rglob("*") if path.is_file())
        by_name: dict[str, list[Path]] = {}
        for path in project_files:
            by_name.setdefault(path.name, []).append(path)
        self.files_by_name = {name: tuple(paths) for name, paths in by_name.items()}

        for schematic_path in (path for path in project_files if path.suffix == ".kicad_sch"):
            text = schematic_path.read_text(encoding="utf-8", errors="ignore")
            definitions: dict[str, str] = {}
            instances: list[str] = []
            for block in iter_forms(text, "symbol"):
                lib_id_match = re.search(r'\(lib_id\s+"([^"]+)"\)', block)
                if lib_id_match:
                    instances.append(block)
                    continue
                definition_match = re.match(r'\(symbol\s+"([^"]+)"', block)
                if definition_match:
                    definitions.setdefault(definition_match.group(1), block)
            for instance in instances:
                lib_id_match = re.search(r'\(lib_id\s+"([^"]+)"\)', instance)
                uuid_match = re.search(r'\(uuid\s+"([^"]+)"\)', instance)
                if not lib_id_match:
                    continue
                lib_id = lib_id_match.group(1)
                definition = definitions.get(lib_id)
                if not definition:
                    continue
                symbol_name, payload = _symbol_library_payload(lib_id, definition)
                indexed = _IndexedSymbol(lib_id, symbol_name, payload, schematic_path)
                if uuid_match:
                    self.symbols_by_uuid.setdefault(uuid_match.group(1), indexed)
                reference = self._reference_from_block(instance)
                if reference:
                    self.symbols_by_reference.setdefault(reference, indexed)

        for pcb_path in (path for path in project_files if path.suffix == ".kicad_pcb"):
            text = pcb_path.read_text(encoding="utf-8", errors="ignore")
            for block in iter_forms(text, "footprint"):
                indexed = _IndexedFootprint(block, pcb_path)
                for footprint_uuid in re.findall(r'\(uuid\s+"([^"]+)"\)', block):
                    # Matching any UUID preserves the previous marker-in-block lookup.
                    self.footprints_by_uuid.setdefault(footprint_uuid, indexed)
                reference = self._reference_from_block(block)
                if reference:
                    self.footprints_by_reference.setdefault(reference, indexed)

    def _model_path(self, raw_path: str, pcb_path: Path) -> Path | None:
        key = (raw_path, pcb_path)
        if key not in self._model_path_cache:
            self._model_path_cache[key] = _resolve_model_path(
                raw_path,
                project_root=self.project_root,
                pcb_path=pcb_path,
                files_by_name=self.files_by_name,
            )
        return self._model_path_cache[key]

    def _embedded_model(self, name: str, block: str, pcb_path: Path) -> bytes | None:
        """A ``kicad-embed://`` model's bytes: from the footprint itself, else from its board.

        A board decodes its embedded files once, on the first footprint that needs them.
        """
        own = decode_embedded_files(block) if "(data" in block else {}
        if name in own:
            return own[name]["data"]
        if pcb_path not in self._board_embedded:
            self._board_embedded[pcb_path] = decode_embedded_files(
                pcb_path.read_text(encoding="utf-8", errors="ignore")
            )
        entry = self._board_embedded[pcb_path].get(name)
        return entry["data"] if entry else None

    def _payload(self, path: Path) -> bytes:
        resolved = path.resolve()
        if resolved not in self._payload_cache:
            self._payload_cache[resolved] = resolved.read_bytes()
        return self._payload_cache[resolved]

    def extract_component_assets(
        self,
        component: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, str]], dict[str, str]]:
        assets: list[dict[str, Any]] = []
        findings: list[dict[str, str]] = []
        resolved: dict[str, str] = {}
        reference = str(component.get("reference") or "")
        schematic_refs = list(component.get("schematicRefs") or [])
        symbol_uuid = next(
            (str(item.get("symbolUuid") or "") for item in schematic_refs if item.get("symbolUuid")),
            "",
        )
        symbol_result = self.symbols_by_uuid.get(symbol_uuid) if symbol_uuid else None
        if symbol_result is None and reference:
            symbol_result = self.symbols_by_reference.get(reference)

        if symbol_result:
            lib_id = symbol_result.lib_id
            symbol_name = symbol_result.symbol_name
            library_name = lib_id.rsplit(":", 1)[0] if ":" in lib_id else "Prism_Project_Symbols"
            assets.append(
                _write_staged_asset(
                    self.stager,
                    asset_type="symbol",
                    filename=f"{symbol_name}.kicad_sym",
                    payload=symbol_result.payload,
                    target_library=library_name,
                    target_name=symbol_name,
                    source_path=str(symbol_result.source_path.relative_to(self.project_root)),
                )
            )
            resolved["symbol_lib_id"] = lib_id
        else:
            findings.append(
                {
                    "code": "symbol_not_resolved",
                    "severity": "error",
                    "message": f"Embedded symbol for {reference} was not found.",
                }
            )

        footprint_uuid = next(
            (
                str(item.get("footprintUuid") or "")
                for item in component.get("pcbRefs") or []
                if item.get("footprintUuid")
            ),
            "",
        )
        footprint_ref = str(component.get("footprint") or "")
        footprint_result = self.footprints_by_uuid.get(footprint_uuid) if footprint_uuid else None
        if footprint_result is None and reference:
            footprint_result = self.footprints_by_reference.get(reference)
        if footprint_result:
            target_name, payload, model_paths = _sanitize_footprint(footprint_result.block, footprint_ref)
            pcb_path = footprint_result.source_path
            embedded_models: dict[str, tuple[str, bytes]] = {}
            for model_path in model_paths:
                if not model_path.startswith(EMBED_PREFIX) or model_path in embedded_models:
                    continue
                data = self._embedded_model(model_path[len(EMBED_PREFIX):], footprint_result.block, pcb_path)
                if data is not None:
                    embedded_models[model_path] = (original_model_name(model_path[len(EMBED_PREFIX):], data), data)
            if embedded_models:
                # Name the model file again, as a library footprint does; placement re-embeds it.
                text = payload.decode("utf-8")
                for model_path, (file_name, _data) in embedded_models.items():
                    text = text.replace(f'(model "{model_path}"', f'(model "{_replace_quoted(file_name)}"')
                payload = text.encode("utf-8")

            # A part placed on the back of the board is stored mirrored. Library
            # footprints are front-side by convention, so undo the placement flip
            # before the bytes become an immutable catalog asset.
            normalized = kicad_footprint_normalizer.normalize_to_front(payload, target_name)
            if normalized.changed:
                payload = normalized.payload
                findings.append(
                    {
                        "code": "footprint_side_normalized",
                        "severity": "warning",
                        "message": (
                            f"{reference} is placed on the back of the board. Its footprint was "
                            "flipped to the front so the library copy matches KiCad convention."
                        ),
                    }
                )
            elif normalized.error:
                findings.append(
                    {
                        "code": "footprint_side_normalization_failed",
                        "severity": "warning",
                        "message": (
                            f"{reference} is placed on the back of the board and its footprint could "
                            f"not be flipped to the front ({normalized.error}). It will import mirrored."
                        ),
                    }
                )

            library_name = (
                footprint_ref.rsplit(":", 1)[0] if ":" in footprint_ref else "Prism_Project_Footprints"
            )
            assets.append(
                _write_staged_asset(
                    self.stager,
                    asset_type="footprint",
                    filename=f"{target_name}.kicad_mod",
                    payload=payload,
                    target_library=library_name,
                    target_name=target_name,
                    source_path=str(pcb_path.relative_to(self.project_root)),
                )
            )
            resolved["footprint_lib_id"] = footprint_ref
            for model_path in model_paths:
                if model_path in embedded_models:
                    file_name, data = embedded_models[model_path]
                    assets.append(
                        _write_staged_asset(
                            self.stager,
                            asset_type="3dmodel",
                            filename=file_name,
                            payload=data,
                            target_library=library_name,
                            target_name=file_name,
                            source_path=model_path,
                        )
                    )
                    continue
                source = self._model_path(model_path, pcb_path)
                if not source:
                    findings.append(
                        {
                            "code": "model_not_resolved",
                            "severity": "warning",
                            "message": f"3D model could not be resolved: {model_path}",
                        }
                    )
                    continue
                assets.append(
                    _write_staged_asset(
                        self.stager,
                        asset_type="3dmodel",
                        filename=source.name,
                        payload=self._payload(source),
                        target_library=library_name,
                        target_name=source.name,
                        source_path=model_path,
                    )
                )
        elif footprint_ref:
            findings.append(
                {
                    "code": "footprint_not_resolved",
                    "severity": "error",
                    "message": f"Embedded footprint for {reference} was not found.",
                }
            )

        return assets, findings, resolved


def build_project_asset_index(
    project_root: Path,
    *,
    staging_dir: Path | None = None,
    stager: ContentAddressedAssetStager | None = None,
) -> ProjectAssetSnapshotIndex:
    if stager is None:
        if staging_dir is None:
            raise ValueError("staging_dir or stager is required")
        stager = ContentAddressedAssetStager(staging_dir)
    return ProjectAssetSnapshotIndex(project_root, stager=stager)


def extract_component_assets(
    project_root: Path,
    component: dict[str, Any],
    *,
    staging_dir: Path,
) -> tuple[list[dict[str, Any]], list[dict[str, str]], dict[str, str]]:
    """Compatibility wrapper for callers extracting a single component."""

    return build_project_asset_index(project_root, staging_dir=staging_dir).extract_component_assets(component)
