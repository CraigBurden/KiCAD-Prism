"""Extract catalog assets from a project's design bundle (CATALOG_IMPORT, C7b).

The project component import reads one revision's parse projections instead
of walking a checkout:

- ``projections/occurrences.json`` joins a semantic-index component, by
  reference, to its symbol and footprint occurrences and to the board
  designator map;
- ``projections/placements.json`` holds a footprint's library link, its side
  and its 3D models;
- ``projections/project.json`` names the project's own library tables and
  resolves every 3D model it references.

The symbol and footprint come from the project's ``sym-lib-table`` and
``fp-lib-table`` libraries when those are in the repository, and the models from
the project member's resolved references. Nothing here walks a directory, reads
the server environment or searches by file name, so a sibling project's board
can never supply a part and a model never resolves to the wrong file. The
legacy scanner in ``project_component_asset_extractor`` keeps its behaviour; the
two share the same ``extract_component_assets`` contract.
"""

from __future__ import annotations

import logging
import re
from pathlib import PurePosixPath
from typing import TYPE_CHECKING, Any

from app.services import kicad_footprint_normalizer
from app.services.catalog.kicad_embedded_files import (
    decode_embedded_files,
    original_model_name,
)
from app.services.kicad_library_reader import (
    iter_forms,
    library_header,
    top_level_symbol_blocks,
)
from app.services.project_component_asset_extractor import (
    ContentAddressedAssetStager,
    _direct_children,
    _find_symbol_definition,
    _replace_quoted,
    _symbol_library_payload,
    _write_staged_asset,
    footprint_land_pattern,
    footprint_normalization_findings,
    sanitize_board_footprint,
)

if TYPE_CHECKING:
    from app.services.design_bundle.consumer import BundleRead

logger = logging.getLogger(__name__)

OCCURRENCES_PATH = "projections/occurrences.json"
PLACEMENTS_PATH = "projections/placements.json"
PROJECT_PATH = "projections/project.json"

#: The members this consumer needs, in the order it asks for them.
BUNDLE_MEMBER_PATHS = (OCCURRENCES_PATH, PLACEMENTS_PATH, PROJECT_PATH)

_EXTENDS = re.compile(r'\(extends\s+"((?:\\.|[^"\\])*)"\)')


def _unescape(value: str) -> str:
    return value.replace('\\"', '"').replace("\\\\", "\\")


def _extends_target(block: str) -> str:
    match = _EXTENDS.search(block)
    return _unescape(match.group(1)) if match else ""


def _child_key(head: str, raw: str) -> tuple[str, str]:
    """A merge key for one direct child of a symbol definition.

    Properties merge by name, so a derived symbol's ``Value`` replaces its
    parent's rather than sitting beside it; every other child merges by head.
    """

    if head == "property":
        match = re.match(r'\(property\s+"((?:\\.|[^"\\])*)"', raw)
        return ("property", match.group(1) if match else raw)
    return (head, "")


def flatten_symbol_definition(text: str, name: str) -> str | None:
    """Return ``name``'s definition with its ``extends`` parents inlined.

    KiCad resolves an ``extends`` chain inside one library and caches the
    derived symbol carrying the parent's geometry, renamed to the derived
    symbol; a schematic's ``lib_symbols`` copy is already flattened that way.
    Reproducing it here lets an asset extracted from a project's own library
    load standalone. Returns ``None`` when the symbol, or one of its parents,
    is not in ``text`` or the chain is cyclic.
    """

    blocks = top_level_symbol_blocks(text)
    by_name: dict[str, str] = {}
    for block_name, block in blocks:
        by_name.setdefault(block_name, block)
    if name not in by_name:
        return None
    chain = [name]
    cursor = _extends_target(by_name[name])
    while cursor:
        if cursor not in by_name or cursor in chain:
            return None
        chain.append(cursor)
        cursor = _extends_target(by_name[cursor])
    if len(chain) == 1:
        return by_name[name]

    units: dict[str, str] = {}
    for symbol_name in reversed(chain):  # a derived symbol's unit overrides its parent's
        for head, _start, _end, raw in _direct_children(by_name[symbol_name]):
            if head != "symbol":
                continue
            match = re.match(r'\(symbol\s+"((?:\\.|[^"\\])*)"', raw)
            if match:
                _collect_unit(units, _unescape(match.group(1)), raw, symbol_name, name)
        for block_name, block in blocks:  # units written beside their parent
            _collect_unit(units, block_name, block, symbol_name, name)

    merged: dict[tuple[str, str], str] = {}
    for symbol_name in reversed(chain):  # a derived symbol's child overrides its parent's
        for head, _start, _end, raw in _direct_children(by_name[symbol_name]):
            if head in {"symbol", "extends"}:
                continue
            merged[_child_key(head, raw)] = raw

    body = list(merged.values()) + list(units.values())
    return f'(symbol "{_replace_quoted(name)}"\n  ' + "\n  ".join(body) + "\n)"


def _collect_unit(
    units: dict[str, str], unit_name: str, block: str, symbol_name: str, name: str
) -> None:
    match = re.fullmatch(rf"{re.escape(symbol_name)}(_\d+_\d+)", unit_name)
    if match:
        units[match.group(1)] = block.replace(
            f'(symbol "{unit_name}"', f'(symbol "{_replace_quoted(name + match.group(1))}"', 1
        )


class ProjectBundleAssetIndex:
    """Asset extraction over one revision's stored design bundle.

    Construction parses the three parse projections once and builds the joins
    the per-component extraction reads: symbols and footprints by UUID and by
    reference, placements by footprint UUID, the project's two library tables
    by nickname and its resolved 3D-model references by (board, path). Every
    source byte comes from ``sources/<RepoPath>``; a file that is not a member
    does not exist for this index.
    """

    def __init__(self, read: BundleRead, *, stager: ContentAddressedAssetStager) -> None:
        self.read = read
        self.stager = stager
        self._archive = read.opened.archive
        self._source_cache: dict[str, bytes | None] = {}
        self._board_embedded_cache: dict[str, dict[str, dict[str, Any]]] = {}

        occurrences = read.json(OCCURRENCES_PATH)
        placements = read.json(PLACEMENTS_PATH)
        project = read.json(PROJECT_PATH)

        self._symbols_by_uuid: dict[str, dict[str, Any]] = {}
        self._symbols_by_reference: dict[str, dict[str, Any]] = {}
        for symbol in occurrences.get("symbols") or []:
            if not isinstance(symbol, dict):
                continue
            uuid = str(symbol.get("symbolUuid") or "")
            if uuid:
                self._symbols_by_uuid.setdefault(uuid, symbol)
            reference = str(symbol.get("reference") or "")
            if reference:
                self._symbols_by_reference.setdefault(reference, symbol)

        self._footprints_by_uuid: dict[str, dict[str, Any]] = {}
        self._footprints_by_reference: dict[str, dict[str, Any]] = {}
        for footprint in occurrences.get("footprints") or []:
            if not isinstance(footprint, dict):
                continue
            uuid = str(footprint.get("uuid") or "")
            if uuid:
                self._footprints_by_uuid.setdefault(uuid, footprint)
            reference = str(footprint.get("reference") or "")
            if reference:
                self._footprints_by_reference.setdefault(reference, footprint)

        self._placements_by_uuid: dict[str, dict[str, Any]] = {}
        for placement in placements.get("footprints") or []:
            if isinstance(placement, dict):
                uuid = str(placement.get("uuid") or "")
                if uuid:
                    self._placements_by_uuid.setdefault(uuid, placement)

        self._symbol_libraries: dict[str, dict[str, Any]] = {}
        self._footprint_libraries: dict[str, dict[str, Any]] = {}
        self._model_references: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for reference in project.get("references") or []:
            if not isinstance(reference, dict):
                continue
            kind = str(reference.get("kind") or "")
            if kind == "symbol-library":
                self._symbol_libraries.setdefault(str(reference.get("libraryName") or ""), reference)
            elif kind == "footprint-library":
                self._footprint_libraries.setdefault(str(reference.get("libraryName") or ""), reference)
            elif kind == "model-3d":
                key = (str(reference.get("documentPath") or ""), str(reference.get("raw") or ""))
                self._model_references.setdefault(key, []).append(reference)

    # ------------------------------------------------------------------ sources

    def _source_bytes(self, repo_path: str) -> bytes | None:
        """A source member's bytes, or ``None`` when the file is not in ``sources/``."""

        if not repo_path:
            return None
        member = f"sources/{repo_path}"
        if member not in self._source_cache:
            member_entry = self._archive.member(member) if self._archive is not None else None
            self._source_cache[member] = self.read.bytes(member) if member_entry is not None else None
        return self._source_cache[member]

    def _repository_library_source(self, library: Any) -> bytes | None:
        if not isinstance(library, dict):
            return None
        target = library.get("target") or {}
        if target.get("kind") != "repository" or not target.get("inSources"):
            return None
        return self._source_bytes(str(target.get("path") or ""))

    # ------------------------------------------------------------------- joins

    def _symbol_occurrence(self, component: dict[str, Any], reference: str) -> dict[str, Any] | None:
        for schematic_ref in component.get("schematicRefs") or []:
            uuid = str((schematic_ref or {}).get("symbolUuid") or "")
            if uuid and uuid in self._symbols_by_uuid:
                return self._symbols_by_uuid[uuid]
        return self._symbols_by_reference.get(reference) if reference else None

    def _footprint_occurrence(self, component: dict[str, Any], reference: str) -> dict[str, Any] | None:
        for pcb_ref in component.get("pcbRefs") or []:
            uuid = str((pcb_ref or {}).get("footprintUuid") or "")
            if uuid and uuid in self._footprints_by_uuid:
                return self._footprints_by_uuid[uuid]
        return self._footprints_by_reference.get(reference) if reference else None

    def _board_footprint(
        self, document_path: str, footprint_uuid: str, placement: dict[str, Any] | None
    ) -> tuple[str | None, str | None]:
        """The placed footprint's form and its board's text, from ``sources/``.

        The placements member gives the form's byte span in the board, so the
        board is not scanned; a span that does not name the footprint falls back
        to the board's own ``(footprint …)`` forms.
        """

        board_bytes = self._source_bytes(document_path)
        if board_bytes is None:
            return None, None
        text = board_bytes.decode("utf-8", errors="ignore")
        block: str | None = None
        span = (placement or {}).get("sourceSpan") or {}
        offset, length = span.get("offsetBytes"), span.get("lengthBytes")
        if isinstance(offset, int) and isinstance(length, int) and offset >= 0 and length > 0:
            candidate = board_bytes[offset:offset + length].decode("utf-8", errors="ignore")
            if "(footprint" in candidate and (not footprint_uuid or footprint_uuid in candidate):
                block = candidate
        if block is None and footprint_uuid:
            marker = f'(uuid "{_replace_quoted(footprint_uuid)}")'
            block = next((form for form in iter_forms(text, "footprint") if marker in form), None)
        return block, text

    def _embedded_model(self, name: str, document_path: str, board_text: str | None, footprint_block: str | None) -> bytes | None:
        """An embedded file's bytes: the footprint's own copy first, then its board's."""

        if not name:
            return None
        if footprint_block and "(embedded_files" in footprint_block:
            own = decode_embedded_files(footprint_block)
            if name in own:
                return own[name]["data"]
        if board_text is not None:
            if document_path not in self._board_embedded_cache:
                self._board_embedded_cache[document_path] = decode_embedded_files(board_text)
            entry = self._board_embedded_cache[document_path].get(name)
            if entry:
                return entry["data"]
        return None

    def _model_reference(
        self, document_path: str, raw_path: str, footprint_uuid: str
    ) -> dict[str, Any] | None:
        """The project member's ``model-3d`` entry for one placement model.

        An embedded target may have one entry per footprint that holds the file
        plus one for the board's copy (project.md, "Placements"); the footprint's
        own entry wins, then the board's.
        """

        references = self._model_references.get((document_path, raw_path)) or []
        if not references:
            return None
        if len(references) == 1:
            return references[0]
        embedded = [item for item in references if (item.get("target") or {}).get("kind") == "embedded"]
        if embedded:
            match = next(
                (item for item in embedded if (item.get("target") or {}).get("footprintUuid") == footprint_uuid),
                None,
            )
            if match is None:
                match = next(
                    (item for item in embedded if not (item.get("target") or {}).get("footprintUuid")),
                    None,
                )
            if match is not None:
                return match
        return references[0]

    # --------------------------------------------------------------- extraction

    def _symbol_asset(
        self, occurrence: dict[str, Any], findings: list[dict[str, str]]
    ) -> dict[str, Any] | None:
        lib_id = str(occurrence.get("libId") or "")
        if not lib_id:
            return None
        nickname, _, symbol_name = lib_id.partition(":")
        library = self._symbol_libraries.get(nickname)
        source = self._repository_library_source(library)
        if source is not None:
            text = source.decode("utf-8", errors="ignore")
            definition = flatten_symbol_definition(text, symbol_name)
            if definition is not None:
                version, generator = library_header(text)
                name, payload = _symbol_library_payload(lib_id, definition, version=version, generator=generator)
                return _write_staged_asset(
                    self.stager,
                    asset_type="symbol",
                    filename=f"{name}.kicad_sym",
                    payload=payload,
                    target_library=nickname or "Prism_Project_Symbols",
                    target_name=name,
                    source_path=str((library.get("target") or {}).get("path") or ""),
                )
        return self._cached_symbol_asset(occurrence, lib_id, findings)

    def _cached_symbol_asset(
        self, occurrence: dict[str, Any], lib_id: str, findings: list[dict[str, str]]
    ) -> dict[str, Any] | None:
        document_path = str(occurrence.get("documentPath") or "")
        source = self._source_bytes(document_path)
        if source is None:
            return None
        text = source.decode("utf-8", errors="ignore")
        found = _find_symbol_definition(text, str(occurrence.get("symbolUuid") or ""))
        if found is None:
            return None
        cached_lib_id, definition = found
        version, generator = library_header(text)
        name, payload = _symbol_library_payload(cached_lib_id, definition, version=version, generator=generator)
        findings.append(
            {
                "code": "symbol_library_not_in_repository",
                "severity": "warning",
                "message": (
                    f"The symbol library for {lib_id} is not in the repository; "
                    "the schematic's cached symbol was used."
                ),
            }
        )
        return _write_staged_asset(
            self.stager,
            asset_type="symbol",
            filename=f"{name}.kicad_sym",
            payload=payload,
            target_library=lib_id.rsplit(":", 1)[0] if ":" in lib_id else "Prism_Project_Symbols",
            target_name=name,
            source_path=document_path,
        )

    def _footprint_and_models(
        self,
        component: dict[str, Any],
        occurrence: dict[str, Any],
        findings: list[dict[str, str]],
        assets: list[dict[str, Any]],
        resolved: dict[str, str],
    ) -> None:
        reference = str(component.get("reference") or "")
        footprint_uuid = str(occurrence.get("uuid") or "")
        document_path = str(occurrence.get("documentPath") or "")
        placement = self._placements_by_uuid.get(footprint_uuid)
        lib_id = str((placement or {}).get("libId") or component.get("footprint") or "")
        if not lib_id:
            findings.append(
                {
                    "code": "footprint_not_resolved",
                    "severity": "error",
                    "message": f"Embedded footprint for {reference} was not found.",
                }
            )
            return
        nickname, _, footprint_name = lib_id.partition(":")

        board_block, board_text = self._board_footprint(document_path, footprint_uuid, placement)
        board_payload: bytes | None = None
        if board_block is not None:
            board_version = library_header(board_text)[0] if board_text else "20240108"
            _, board_payload, _model_paths = sanitize_board_footprint(board_block, lib_id, version=board_version)
            normalized = kicad_footprint_normalizer.normalize_footprint(board_payload, footprint_name)
            if normalized.changed:
                board_payload = normalized.payload
            findings.extend(footprint_normalization_findings(reference, normalized))

        library = self._footprint_libraries.get(nickname)
        library_path = ""
        library_bytes: bytes | None = None
        target = (library or {}).get("target") or {}
        if target.get("kind") == "repository" and target.get("inSources"):
            directory = str(target.get("path") or "").rstrip("/")
            library_path = f"{directory}/{footprint_name}.kicad_mod" if directory else f"{footprint_name}.kicad_mod"
            library_bytes = self._source_bytes(library_path)

        if (
            library_bytes is not None
            and board_payload is not None
            and footprint_land_pattern(library_bytes) != footprint_land_pattern(board_payload)
        ):
            findings.append(
                {
                    "code": "footprint_modified_on_board",
                    "severity": "warning",
                    "message": (
                        f"{reference}'s board copy differs from its library footprint "
                        f"({lib_id}) in its copper land pattern."
                    ),
                }
            )

        if library_bytes is not None:
            payload, source_path = library_bytes, library_path
        elif board_payload is not None:
            payload, source_path = board_payload, document_path
            findings.append(
                {
                    "code": "footprint_library_not_in_repository",
                    "severity": "warning",
                    "message": (
                        f"The footprint library for {lib_id} is not in the repository; "
                        "the board's placed copy was sanitized instead."
                    ),
                }
            )
        else:
            findings.append(
                {
                    "code": "footprint_not_resolved",
                    "severity": "error",
                    "message": f"Embedded footprint for {reference} was not found.",
                }
            )
            return

        assets.append(
            _write_staged_asset(
                self.stager,
                asset_type="footprint",
                filename=f"{footprint_name}.kicad_mod",
                payload=payload,
                target_library=nickname or "Prism_Project_Footprints",
                target_name=footprint_name,
                source_path=source_path,
            )
        )
        resolved["footprint_lib_id"] = lib_id
        self._model_assets(placement, document_path, board_text, board_block, footprint_uuid, nickname, findings, assets)

    def _model_assets(
        self,
        placement: dict[str, Any] | None,
        document_path: str,
        board_text: str | None,
        footprint_block: str | None,
        footprint_uuid: str,
        library_name: str,
        findings: list[dict[str, str]],
        assets: list[dict[str, Any]],
    ) -> None:
        for model in (placement or {}).get("models") or []:
            raw_path = str((model or {}).get("path") or "") if isinstance(model, dict) else ""
            if not raw_path:
                continue
            reference = self._model_reference(document_path, raw_path, footprint_uuid)
            target = (reference or {}).get("target") or {}
            kind = target.get("kind")
            if kind == "repository" and target.get("inSources"):
                repository_path = str(target.get("path") or "")
                payload = self._source_bytes(repository_path)
                if payload is None:
                    findings.append(self._model_not_resolved(raw_path))
                    continue
                file_name = PurePosixPath(repository_path).name
                assets.append(
                    _write_staged_asset(
                        self.stager,
                        asset_type="3dmodel",
                        filename=file_name,
                        payload=payload,
                        target_library=library_name,
                        target_name=file_name,
                        source_path=repository_path,
                    )
                )
                continue
            if kind == "embedded":
                name = str(target.get("name") or "")
                data = self._embedded_model(name, document_path, board_text, footprint_block)
                if data is None:
                    findings.append(self._model_not_resolved(raw_path))
                    continue
                file_name = original_model_name(name, data)
                assets.append(
                    _write_staged_asset(
                        self.stager,
                        asset_type="3dmodel",
                        filename=file_name,
                        payload=data,
                        target_library=library_name,
                        target_name=file_name,
                        source_path=raw_path,
                    )
                )
                continue
            findings.append(self._model_not_resolved(raw_path))

    @staticmethod
    def _model_not_resolved(raw_path: str) -> dict[str, str]:
        return {
            "code": "model_not_resolved",
            "severity": "warning",
            "message": f"3D model could not be resolved: {raw_path}",
        }

    def extract_component_assets(
        self,
        component: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, str]], dict[str, str]]:
        assets: list[dict[str, Any]] = []
        findings: list[dict[str, str]] = []
        resolved: dict[str, str] = {}
        reference = str(component.get("reference") or "")

        symbol_occurrence = self._symbol_occurrence(component, reference)
        symbol_asset = self._symbol_asset(symbol_occurrence, findings) if symbol_occurrence else None
        if symbol_asset is not None:
            assets.append(symbol_asset)
            resolved["symbol_lib_id"] = str(symbol_occurrence.get("libId") or "")
        else:
            findings.append(
                {
                    "code": "symbol_not_resolved",
                    "severity": "error",
                    "message": f"Embedded symbol for {reference} was not found.",
                }
            )

        footprint_occurrence = self._footprint_occurrence(component, reference)
        if footprint_occurrence is not None:
            self._footprint_and_models(component, footprint_occurrence, findings, assets, resolved)
        elif str(component.get("footprint") or ""):
            findings.append(
                {
                    "code": "footprint_not_resolved",
                    "severity": "error",
                    "message": f"Embedded footprint for {reference} was not found.",
                }
            )

        return assets, findings, resolved


__all__ = [
    "BUNDLE_MEMBER_PATHS",
    "OCCURRENCES_PATH",
    "PLACEMENTS_PATH",
    "PROJECT_PATH",
    "ProjectBundleAssetIndex",
    "flatten_symbol_definition",
]
