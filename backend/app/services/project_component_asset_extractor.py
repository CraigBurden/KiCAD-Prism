from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.services import kicad_footprint_normalizer
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


def _cut(block: str, spans: list[tuple[int, int]]) -> str:
    """Remove ``spans`` from ``block``; a span alone on its line takes the line."""

    for start, end in sorted(spans, reverse=True):
        line_start = block.rfind("\n", 0, start) + 1
        line_end = block.find("\n", end)
        if (
            line_start > 0
            and not block[line_start:start].strip()
            and line_end >= 0
            and not block[end:line_end].strip()
        ):
            start, end = line_start - 1, line_end
        block = block[:start] + block[end:]
    return block


def _remove_direct_children(block: str, heads: set[str]) -> str:
    return _cut(block, [(start, end) for head, start, end, _ in _direct_children(block) if head in heads])


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


def _placement_angle(at_raw: str) -> tuple[float, str]:
    """The degrees and the original token of a footprint's ``(at x y angle)``.

    A footprint at orientation 0 has no angle token, so both are empty/zero.
    """
    tokens = at_raw[1:-1].split()
    if len(tokens) < 4:
        return 0.0, ""
    try:
        return float(tokens[3]), tokens[3]
    except ValueError:
        return 0.0, ""


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
    return _cut(block, spans)


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
    placement = next(
        ((start, end, raw) for head, start, end, raw in _direct_children(block) if head == "at"),
        None,
    )
    angle, angle_token = _placement_angle(placement[2]) if placement else (0.0, "")
    # A footprint inside a board names its embedded files and the board holds
    # their data; the models come back as catalog assets instead.
    sanitized = _remove_direct_children(block, {"uuid", "path", "locked", "tstamp", "embedded_files"})
    # The placement angle is kept (position dropped) so the normalizer can return
    # the footprint to orientation 0: KiCad stores each pad's and text's angle
    # including the placement angle, so dropping it silently rotates the pads.
    at_child = next(
        ((start, end) for head, start, end, _ in _direct_children(sanitized) if head == "at"),
        None,
    )
    if at_child and angle != 0:
        sanitized = sanitized[:at_child[0]] + f"(at 0 0 {angle_token})" + sanitized[at_child[1]:]
    elif at_child:
        sanitized = _cut(sanitized, [at_child])
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


def footprint_normalization_findings(
    reference: str, normalized: kicad_footprint_normalizer.NormalizedFootprint
) -> list[dict[str, str]]:
    """The findings for one footprint's return to front side, orientation 0.

    Shared by the checkout scan and the bundle path, so both report a flip, a
    rotation and a normaliser that could not run in the same words.
    """

    if normalized.changed:
        findings = []
        if normalized.flipped:
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
        if normalized.rotated:
            findings.append(
                {
                    "code": "footprint_rotation_normalized",
                    "severity": "warning",
                    "message": (
                        f"{reference} is placed rotated by "
                        f"{normalized.rotation_degrees:g}\u00b0; its footprint was returned "
                        "to 0\u00b0 for the library copy."
                    ),
                }
            )
        return findings
    if normalized.error and normalized.flipped:
        return [
            {
                "code": "footprint_side_normalization_failed",
                "severity": "warning",
                "message": (
                    f"{reference} is placed on the back of the board and its footprint could "
                    f"not be normalised for the library ({normalized.error}). It will import "
                    "as placed."
                ),
            }
        ]
    if normalized.error and normalized.rotated:
        return [
            {
                "code": "footprint_rotation_normalization_failed",
                "severity": "warning",
                "message": (
                    f"{reference} is placed rotated and its footprint could not be returned "
                    f"to 0\u00b0 ({normalized.error}). It will import at its placed angle."
                ),
            }
        ]
    return []


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
