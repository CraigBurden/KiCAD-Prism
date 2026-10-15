"""Rewrite stored KiCad files into the payloads desktop KiCad places.

Symbols gain the component's metadata properties, a footprint reference
that points at the remote library nickname and, for remote placement, a
hidden stamp naming the catalog component and revision; footprints have
their 3D model paths redirected to the remote provider destination, or
embedded in the footprint when a model reader is given. These rewrites are
byte-stable for identical inputs, which is what keeps manifest hashes and
inline bundles reproducible; embedding reuses each model's kept compressed
copy (``embedded_model_copies.py``) when the caller passes one, so a
``zstandard`` upgrade does not change them either.
"""

from __future__ import annotations

from collections import Counter, OrderedDict
import logging
from pathlib import Path
import re
import threading
from typing import Any, Callable

from app.core.config import settings
from app.services.catalog.asset_files import content_type_for_asset
from app.services.catalog.kicad_embedded_files import (
    EMBED_MAX_RAW_MODEL_BYTES,
    add_embedded_files,
    compress_model,
    embedded_file_form,
    embedded_model_name,
)
from app.services.catalog.metadata_descriptors import (
    SYMBOL_METADATA_FIELD_ORDER,
    SYMBOL_METADATA_LABEL_TO_KEY,
)
from app.services.catalog.metadata_normalization import PLACEMENT_STAMP_FIELDS, is_reserved_stamp_key
from app.services.catalog.normalization import sanitize_name, sha256_bytes


_TOP_LEVEL_PROPERTY_RE = re.compile(r'^([ \t]+)\(property "([^"]+)" ')
_MODEL_RE = re.compile(r'\(model\s+"([^"]+)"')
_MODEL_INDENT_RE = re.compile(r'^([ \t]*)\(model\s+"', re.MULTILINE)

logger = logging.getLogger(__name__)

Compress = Callable[[bytes], bytes]


def embed_max_compressed_bytes() -> int:
    """Compressed model bytes one footprint may embed (``REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES``)."""
    return int(settings.REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES)

# Embedded footprints by everything that decides their bytes, so a manifest
# and the download that follows it compress each model once per process.
_EMBEDDED_FOOTPRINT_CACHE_SIZE = 32
_embedded_footprint_cache: OrderedDict[tuple[Any, ...], tuple[bytes, tuple[int, ...]]] = OrderedDict()
_embedded_footprint_cache_lock = threading.Lock()


def placement_stamp_fields(component: dict[str, Any] | None) -> dict[str, str]:
    """Return the stamp in field order, or nothing without both catalog ids."""
    component_id = str((component or {}).get("id") or "").strip().lower()
    revision_id = str((component or {}).get("revision_id") or "").strip().lower()
    if not component_id or not revision_id:
        return {}
    return dict(zip(PLACEMENT_STAMP_FIELDS, (component_id, revision_id)))


def remote_library_nickname(library_name: str) -> str:
    prefix = sanitize_name(settings.REMOTE_PROVIDER_LIBRARY_PREFIX, "remote").lower()
    library = sanitize_name(library_name, "library").lower()
    return f"{prefix}_{library}"


def escape_symbol_property_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def symbol_property_block(name: str, value: str, *, indent: str = "    ", hidden: bool = True) -> str:
    hide = " hide" if hidden else ""
    child_indent = f"{indent}  "
    return (
        f'{indent}(property "{name}" "{escape_symbol_property_value(value)}" (at 0 0 0)\n'
        f"{child_indent}(effects (font (size 1.27 1.27)){hide})\n"
        f"{indent})\n"
    )


def symbol_metadata_fields(component: dict[str, Any] | None, *, stamp: bool = False) -> dict[str, str]:
    if not component:
        return {label: "" for label in SYMBOL_METADATA_FIELD_ORDER}
    fields = {label: str(component.get(key) or "") for label, key in SYMBOL_METADATA_LABEL_TO_KEY.items()}
    for key, value in sorted(dict(component.get("extra_fields") or {}).items()):
        normalized_key = str(key).strip()
        if (
            normalized_key
            and normalized_key not in fields
            and normalized_key not in {"Reference", "Footprint"}
            and not (stamp and is_reserved_stamp_key(normalized_key))
        ):
            fields[normalized_key] = str(value or "")
    return fields


def extract_top_level_symbol_properties(header: str) -> tuple[str, list[tuple[str, str]], str, str]:
    """Split a symbol header into prefix, property blocks, trailing text, indent."""
    lines = header.splitlines(keepends=True)
    prefix_parts: list[str] = []
    property_blocks: list[tuple[str, str]] = []
    trailing = ""
    first_indent = ""
    index = 0

    while index < len(lines):
        line = lines[index]
        match = _TOP_LEVEL_PROPERTY_RE.match(line)
        if not match:
            if property_blocks:
                trailing = "".join(lines[index:])
                break
            prefix_parts.append(line)
            index += 1
            continue

        indent = match.group(1)
        if not first_indent:
            first_indent = indent
        name = match.group(2)
        depth = line.count("(") - line.count(")")
        block_lines = [line]
        index += 1

        while depth > 0 and index < len(lines):
            block_line = lines[index]
            block_lines.append(block_line)
            depth += block_line.count("(") - block_line.count(")")
            index += 1

        property_blocks.append((name, "".join(block_lines)))

    return "".join(prefix_parts), property_blocks, trailing, first_indent or "    "


def rewrite_symbol_payload(
    payload: bytes,
    footprint_ref: str | None,
    component: dict[str, Any] | None = None,
    *,
    stamp: bool = False,
) -> bytes:
    text = payload.decode("utf-8")
    first_symbol_index = text.find('(symbol "')
    marker_index = text.find('(symbol "', first_symbol_index + 1) if first_symbol_index != -1 else -1
    if marker_index <= 0:
        header = text
        suffix = ""
    else:
        header = text[:marker_index]
        suffix = text[marker_index:]

    prefix, extracted_blocks, trailing, indent = extract_top_level_symbol_properties(header)
    if not extracted_blocks:
        return payload

    if stamp:
        extracted_blocks = [(name, block) for name, block in extracted_blocks if not is_reserved_stamp_key(name)]
    existing_blocks = {name: block for name, block in extracted_blocks}
    ordered_names = [name for name, _ in extracted_blocks]
    metadata_fields = symbol_metadata_fields(component, stamp=stamp)
    custom_blocks = {
        label: symbol_property_block(label, value, indent=indent, hidden=label != "Value")
        for label, value in metadata_fields.items()
    }
    if footprint_ref is not None:
        custom_blocks["Footprint"] = symbol_property_block("Footprint", footprint_ref, indent=indent)
    elif "Footprint" in existing_blocks:
        custom_blocks["Footprint"] = existing_blocks["Footprint"]

    for property_name in SYMBOL_METADATA_FIELD_ORDER:
        if property_name not in ordered_names:
            ordered_names.append(property_name)
    for property_name in sorted(set(metadata_fields) - set(SYMBOL_METADATA_FIELD_ORDER)):
        if property_name not in ordered_names:
            ordered_names.append(property_name)
    if "Footprint" not in ordered_names:
        ordered_names.append("Footprint")
    if stamp:
        for property_name, value in placement_stamp_fields(component).items():
            custom_blocks[property_name] = symbol_property_block(property_name, value, indent=indent)
            ordered_names.append(property_name)

    rebuilt_blocks = [
        custom_blocks.get(property_name, existing_blocks.get(property_name, ""))
        for property_name in ordered_names
    ]
    return (prefix + "".join(rebuilt_blocks) + trailing + suffix).encode("utf-8")


def rewrite_footprint_payload(
    payload: bytes,
    asset: dict[str, Any],
    model_assets: list[dict[str, Any]] | None = None,
    read_model: Callable[[dict[str, Any]], bytes | None] | None = None,
    *,
    model_path: Callable[[dict[str, Any]], str] | None = None,
    compress: Compress | None = None,
) -> bytes:
    """Point each matched ``(model ...)`` at its placed model.

    With ``read_model``, models are embedded in the footprint under a
    content-unique ``kicad-embed://`` name, so the board that receives the
    footprint pins the model, when the footprint grows by no more than the
    model's raw size (the embedded model is no longer shipped, so the
    placement never grows) and the compressed data stays within
    ``embed_max_compressed_bytes()`` (models are taken in node order); models
    read past ``EMBED_MAX_RAW_MODEL_BYTES`` are not compressed at all. Other
    models, models the reader returns ``None`` for, and every model without
    a reader keep an external path: ``model_path`` maps a model asset to it,
    and by default it is the remote provider's
    ``<destination>/<prefix>_3d/<basename>``.
    """
    return _rewrite_footprint(payload, list(model_assets or []), read_model, model_path, compress)[0]


def _rewrite_footprint(
    payload: bytes,
    models: list[dict[str, Any]],
    read_model: Callable[[dict[str, Any]], bytes | None] | None,
    model_path: Callable[[dict[str, Any]], str] | None = None,
    compress: Compress | None = None,
) -> tuple[bytes, list[dict[str, Any]], bool]:
    """Rewrite model paths; also return the embedded model assets and
    whether every model the reader was asked for could be read."""
    text = payload.decode("utf-8")
    if not models or "(model " not in text:
        return payload, [], True
    prefix = sanitize_name(settings.REMOTE_PROVIDER_LIBRARY_PREFIX, "remote").lower()
    destination = settings.REMOTE_PROVIDER_DESTINATION_DIR.rstrip("/")
    if destination in {"/RemoteLibrary", "$/RemoteLibrary"}:
        destination = "${KIPRJMOD}/RemoteLibrary"
    model_names = [
        Path(str(model.get("canonical_path") or model.get("name") or "model.step")).name for model in models
    ]
    node_names = [re.split(r"[/\\]", match.group(1))[-1] for match in _MODEL_RE.finditer(text)]
    # Assets arrive sorted by library, name and hash, not in node order, so
    # each node first looks for the one asset its file name identifies: exact
    # name, upload-sanitized name, then both case-insensitively, then the
    # stem alone so a footprint naming foo.wrl finds the catalog's foo.step.
    # A tier only claims when exactly one asset matches. Assets no node names
    # then fill the unmatched nodes in order. A single asset keeps the
    # positional pick so its output never changes.
    assigned: dict[int, int] = {}
    if len(models) > 1:
        tiers = (
            str,
            lambda name: sanitize_name(name, ""),
            str.casefold,
            lambda name: sanitize_name(name, "").casefold(),
            lambda name: Path(sanitize_name(name, "").casefold()).stem,
        )
        for node_index, node_name in enumerate(node_names):
            for key in tiers:
                node_key = key(node_name)
                candidates = [index for index, name in enumerate(model_names) if node_key and key(name) == node_key]
                if len(candidates) == 1:
                    assigned[node_index] = candidates[0]
                    break
    unclaimed = iter([index for index in range(len(models)) if index not in assigned.values()])
    for node_index in range(len(node_names)):
        if node_index not in assigned:
            model_index = next(unclaimed, None)
            if model_index is not None:
                assigned[node_index] = model_index
    node_counter = 0
    node_counts = Counter(assigned.values())
    placed_path = _ModelPathBuilder(
        text, models, model_names, node_counts, f"{destination}/{prefix}_3d", read_model, model_path, compress
    )

    def replace_model(match: re.Match[str]) -> str:
        nonlocal node_counter
        model_index = assigned.get(node_counter)
        node_counter += 1
        if model_index is None:
            return match.group(0)
        model_path = placed_path(model_index)
        return f'(model "{model_path}"'

    text = _MODEL_RE.sub(replace_model, text)
    return placed_path.finish(text).encode("utf-8"), placed_path.embedded_models, placed_path.complete


class _ModelPathBuilder:
    """Build the path for the model asset the matcher assigned to a node.

    Nodes may share an asset, so each asset is read and encoded once.
    Embedded models are collected once per content-unique name and added to
    the footprint by ``finish``.
    """

    def __init__(
        self,
        text: str,
        models: list[dict[str, Any]],
        model_names: list[str],
        node_counts: Counter[int],
        external_dir: str,
        read_model: Callable[[dict[str, Any]], bytes | None] | None,
        model_path: Callable[[dict[str, Any]], str] | None = None,
        compress: Compress | None = None,
    ) -> None:
        self._models = models
        # Looked up at call time so tests that patch ``compress_model`` see it.
        self._compress = compress or (lambda data: compress_model(data))
        self._max_compressed_bytes = embed_max_compressed_bytes()
        self._model_path = model_path
        self._model_names = model_names
        self._node_counts = node_counts
        self._external_dir = external_dir
        self._read_model = read_model
        indent_match = _MODEL_INDENT_RE.search(text)
        self._indent = indent_match.group(1) if indent_match else "  "
        self._unit = "\t" if self._indent.startswith("\t") else "  "
        # Upper bound for what opening or extending the block adds besides forms.
        self._block_bytes = len(f"{self._indent}(embedded_files\n{self._indent})\n\n{self._indent}".encode("utf-8"))
        self._forms: dict[str, str] = {}
        self._paths: dict[int, str] = {}
        self._embedded_compressed_bytes = 0
        self._compressed_raw_bytes = 0
        self.embedded_models: list[dict[str, Any]] = []
        # False once the reader skipped a model (missing or over the ceiling);
        # such output is not cached, so a restored file is picked up.
        self.complete = True

    def __call__(self, model_index: int) -> str:
        if model_index not in self._paths:
            self._paths[model_index] = self._place(model_index)
        return self._paths[model_index]

    def _place(self, model_index: int) -> str:
        model_name = self._model_names[model_index]
        if self._model_path is not None:
            external_path = self._model_path(self._models[model_index])
        else:
            external_path = f"{self._external_dir}/{model_name}"
        if self._read_model is None:
            return external_path
        data = self._read_model(self._models[model_index])
        if data is None:
            self.complete = False
            return external_path
        embedded_name = embedded_model_name(model_name, data)
        embedded_path = f"kicad-embed://{embedded_name}"
        form_bytes = 0
        compressed = b""
        if embedded_name not in self._forms:
            # Compress at most EMBED_MAX_RAW_MODEL_BYTES per footprint, and
            # size the form from the compressed data so KiCad's slow checksum
            # only runs on a model that fits the cap.
            if self._compressed_raw_bytes + len(data) > EMBED_MAX_RAW_MODEL_BYTES:
                return external_path
            self._compressed_raw_bytes += len(data)
            compressed = self._compress(data)
            form_bytes = len(
                embedded_file_form(
                    embedded_name, data, compressed, self._indent + self._unit, self._unit, checksum="0" * 32
                ).encode("utf-8")
            )
        # An embedded model is not shipped, so embed only when the footprint
        # grows by no more than the raw file it replaces: a placement that fits
        # KiCad's aggregate download budget without embedding still fits.
        growth = (form_bytes + self._block_bytes if form_bytes else 0) + self._node_counts[model_index] * (
            len(embedded_path.encode("utf-8")) - len(external_path.encode("utf-8"))
        )
        if growth > len(data) or self._embedded_compressed_bytes + len(compressed) > self._max_compressed_bytes:
            return external_path
        if form_bytes:
            self._forms[embedded_name] = embedded_file_form(
                embedded_name, data, compressed, self._indent + self._unit, self._unit
            )
            self._embedded_compressed_bytes += len(compressed)
        self.embedded_models.append(self._models[model_index])
        return embedded_path

    def finish(self, text: str) -> str:
        return add_embedded_files(text, list(self._forms.values()), self._indent, self._unit)


def _read_canonical_bytes(asset: dict[str, Any]) -> bytes | None:
    """Read a model to embed, or ``None`` to keep it external.

    A model over the raw ceiling is skipped from its size alone. A
    missing file (artifact maintenance may purge one) is not embedded, so the
    footprint still places and the model's own download reports the loss.
    """
    path = Path(str(asset["canonical_path"]))
    try:
        if path.stat().st_size > EMBED_MAX_RAW_MODEL_BYTES:
            return None
        return path.read_bytes()
    except FileNotFoundError:
        logger.warning("3D model %s has no file; keeping it external", asset.get("id") or path.name)
        return None


def _embedded_footprint_key(footprint: dict[str, Any], models: list[dict[str, Any]]) -> tuple[Any, ...] | None:
    """Everything that decides an embedded footprint's bytes, or ``None``."""
    hashes = [footprint.get("sha256"), *(model.get("sha256") for model in models)]
    if not all(hashes):
        return None
    return (
        tuple(str(value) for value in hashes),
        tuple(str(model.get("canonical_path") or model.get("name") or "") for model in models),
        settings.REMOTE_PROVIDER_LIBRARY_PREFIX,
        settings.REMOTE_PROVIDER_DESTINATION_DIR,
        embed_max_compressed_bytes(),
        EMBED_MAX_RAW_MODEL_BYTES,
    )


def clear_embedded_footprint_cache() -> None:
    """Forget every cached embedded footprint."""
    with _embedded_footprint_cache_lock:
        _embedded_footprint_cache.clear()


def _embed_footprint(
    asset: dict[str, Any], payload: bytes, models: list[dict[str, Any]], compress: Compress | None = None
) -> tuple[bytes, list[dict[str, Any]]]:
    """Embed the footprint's models, reusing a recent identical result.

    A footprint the embedder cannot rewrite falls back to the external model
    paths instead of failing the whole placement.
    """
    key = _embedded_footprint_key(asset, models)
    if key is not None:
        with _embedded_footprint_cache_lock:
            cached = _embedded_footprint_cache.get(key)
            if cached is not None:
                _embedded_footprint_cache.move_to_end(key)
        if cached is not None:
            return cached[0], [models[index] for index in cached[1]]
    try:
        rewritten, embedded, complete = _rewrite_footprint(
            payload, models, _read_canonical_bytes, compress=compress
        )
    except ValueError:
        logger.warning(
            "Footprint %s could not embed its 3D models; keeping them external", asset.get("id"), exc_info=True
        )
        return _rewrite_footprint(payload, models, None)[:2]
    if key is not None and complete:
        indexes = tuple(next(i for i, model in enumerate(models) if model is chosen) for chosen in embedded)
        with _embedded_footprint_cache_lock:
            _embedded_footprint_cache[key] = (rewritten, indexes)
            _embedded_footprint_cache.move_to_end(key)
            while len(_embedded_footprint_cache) > _EMBEDDED_FOOTPRINT_CACHE_SIZE:
                _embedded_footprint_cache.popitem(last=False)
    return rewritten, embedded


def materialize_asset(
    asset: dict[str, Any],
    assets_for_revision: list[dict[str, Any]],
    component: dict[str, Any] | None = None,
    *,
    footprint_ref: str | None = None,
    stamp: bool = False,
    embed_models: bool = False,
    model_path: Callable[[dict[str, Any]], str] | None = None,
    compress: Compress | None = None,
) -> dict[str, Any]:
    """Read one stored asset and return it with its placement payload attached.

    ``footprint_ref`` overrides the symbol's ``Footprint`` value (``""`` clears
    it); by default it is the remote provider's ``remote_<library>:<name>``.
    ``stamp`` adds the catalog revision stamp to symbols, and ``embed_models``
    embeds the footprint's 3D models (see ``rewrite_footprint_payload``) and
    lists them in ``embedded_model_ids``. Remote provider placement sets both;
    the DBL export sets neither, keeping its file contract.
    ``model_path`` maps a model asset to its external path in the footprint
    (see ``rewrite_footprint_payload``); the DBL export passes its own.
    ``compress`` compresses a model to embed; placement passes
    ``CompressedModelCopies.compress`` so each model keeps one compressed copy.
    """
    path = Path(str(asset["canonical_path"]))
    payload = path.read_bytes()
    extra: dict[str, Any] = {}
    if asset["asset_type"] == "symbol":
        footprint_asset = next(
            (candidate for candidate in assets_for_revision if candidate["asset_type"] == "footprint"), None
        )
        if footprint_ref is None and footprint_asset:
            footprint_ref = (
                f"{remote_library_nickname(str(footprint_asset['target_library']))}:{footprint_asset['target_name']}"
            )
        payload = rewrite_symbol_payload(payload, footprint_ref, component, stamp=stamp)
    elif asset["asset_type"] == "footprint":
        models = [candidate for candidate in assets_for_revision if candidate["asset_type"] == "3dmodel"]
        if embed_models:
            payload, embedded_models = _embed_footprint(asset, payload, models, compress)
            extra["embedded_model_ids"] = [str(model["id"]) for model in embedded_models]
        else:
            payload = _rewrite_footprint(payload, models, None, model_path)[0]
    return {
        **asset,
        **extra,
        "payload": payload,
        "content_type": content_type_for_asset(str(asset["asset_type"]), path),
        "size_bytes": len(payload),
        "sha256": sha256_bytes(payload),
        "name": path.name,
    }


__all__ = [
    "SYMBOL_METADATA_FIELD_ORDER",
    "clear_embedded_footprint_cache",
    "embed_max_compressed_bytes",
    "escape_symbol_property_value",
    "extract_top_level_symbol_properties",
    "materialize_asset",
    "placement_stamp_fields",
    "remote_library_nickname",
    "rewrite_footprint_payload",
    "rewrite_symbol_payload",
    "symbol_metadata_fields",
    "symbol_property_block",
]
