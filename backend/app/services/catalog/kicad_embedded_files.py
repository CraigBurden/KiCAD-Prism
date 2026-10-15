"""Encode 3D models as KiCad embedded files inside a footprint.

KiCad 10 resolves ``kicad-embed://<name>`` model paths from the footprint's own
``(embedded_files ...)`` block, and a board saves that data with the
footprint. Embedding a placed model therefore pins it in the project commit.

The format follows KiCad's ``common/embedded_files.cpp``: one-shot zstd at
level 15 with the content size in the frame and no frame checksum, base64 in
76-column lines between ``|`` markers, and KiCad's own MurmurHash3_x64_128
variant (seed ``0xABBA2345``) of the uncompressed data, written as 32
uppercase hex digits. KiCad verifies that checksum on load.

zstd output is deterministic for one library version, so output stays
byte-stable as long as ``zstandard`` (and the libzstd it bundles) is pinned.
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import PurePath
import re
import struct

import zstandard

# Raw model bytes one footprint may embed, checked before a model is hashed
# or compressed so an oversized STEP costs a stat, not a zstd pass. KiCad
# charges every manifest asset against one aggregate max_download_bytes budget
# (16 MiB advertised by Prism). An embedded model is not shipped as a separate
# 3dmodel asset, and a model is embedded only when its form is no larger than
# its raw file, so the footprint grows by this much at most: it leaves most of
# the budget to the symbol, SPICE model and any model that falls back, and
# bounds the board-file growth per part. The inline bundle base64-encodes the
# footprint twice more, so an embedded model costs about 2.37x its compressed
# size there, plus line wrapping and JSON.
EMBED_MAX_FOOTPRINT_BYTES = 4 * 1024 * 1024

ZSTD_LEVEL = 15
MURMUR3_SEED = 0xABBA2345
BASE64_LINE_LENGTH = 76

_MASK64 = (1 << 64) - 1
_UNSAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]")
_HEAD_RE = re.compile(r"[^\s()\"]+")


def embedded_model_name(file_name: str, data: bytes) -> str:
    """Return ``<stem>-<sha256[:12]><ext>``, unique per content.

    KiCad identifies embedded files by name only, so two revisions with the
    same file name and different bytes must not share a name.
    """
    path = PurePath(file_name)
    stem = _UNSAFE_NAME_RE.sub("_", path.stem) or "model"
    suffix = _UNSAFE_NAME_RE.sub("_", path.suffix)
    return f"{stem}-{hashlib.sha256(data).hexdigest()[:12]}{suffix}"


def _rotl64(value: int, shift: int) -> int:
    return ((value << shift) | (value >> (64 - shift))) & _MASK64


def _fmix64(value: int) -> int:
    value ^= value >> 33
    value = (value * 0xFF51AFD7ED558CCD) & _MASK64
    value ^= value >> 33
    value = (value * 0xC4CEB9FE1A85EC53) & _MASK64
    return value ^ (value >> 33)


def kicad_mmh3_128(data: bytes) -> str:
    """Return KiCad's embedded-file checksum for ``data``.

    A literal port of ``MMH3_HASH(0xABBA2345).add(data).digest()`` from KiCad
    10.0.4 ``libs/kimath/include/mmh3_hash.h``, which differs from standard
    MurmurHash3_x64_128 at the tail: ``addData`` pads a non-empty tail with
    1-4 zero bytes (always at least one), counts the padding in the length,
    and ``hashTail`` mixes only ``len & 15`` bytes, so a tail padded to 16
    bytes is dropped.
    """
    c1, c2 = 0x87C37B91114253D5, 0x4CF5AD432745937F
    h1 = h2 = MURMUR3_SEED
    body_length = len(data) - len(data) % 16
    for k1, k2 in struct.iter_unpack("<QQ", data[:body_length]):
        h1 ^= (_rotl64((k1 * c1) & _MASK64, 31) * c2) & _MASK64
        h1 = (_rotl64(h1, 27) + h2) & _MASK64
        h1 = (h1 * 5 + 0x52DCE729) & _MASK64
        h2 ^= (_rotl64((k2 * c2) & _MASK64, 33) * c1) & _MASK64
        h2 = (_rotl64(h2, 31) + h1) & _MASK64
        h2 = (h2 * 5 + 0x38495AB5) & _MASK64
    length = body_length
    remaining = len(data) - body_length
    tail = data[body_length:]
    if remaining:
        padding = 4 - (remaining + 4) % 4
        tail += b"\0" * padding
        length += remaining + padding
    tail = tail[: length & 15]
    if len(tail) > 8:
        h2 ^= (_rotl64((int.from_bytes(tail[8:], "little") * c2) & _MASK64, 33) * c1) & _MASK64
    if tail:
        h1 ^= (_rotl64((int.from_bytes(tail[:8], "little") * c1) & _MASK64, 31) * c2) & _MASK64
    length &= 0xFFFFFFFF
    h1 ^= length
    h2 ^= length
    h1 = (h1 + h2) & _MASK64
    h2 = (h2 + h1) & _MASK64
    h1 = _fmix64(h1)
    h2 = _fmix64(h2)
    h1 = (h1 + h2) & _MASK64
    h2 = (h2 + h1) & _MASK64
    return f"{h1:016X}{h2:016X}"


def compress_model(data: bytes) -> bytes:
    """Compress ``data`` the way KiCad's ``ZSTD_compress`` call does."""
    compressor = zstandard.ZstdCompressor(level=ZSTD_LEVEL, write_content_size=True, write_checksum=False)
    return compressor.compress(data)


def embedded_file_form(name: str, data: bytes, compressed: bytes, indent: str, unit: str) -> str:
    """Return one ``(file ...)`` form laid out as KiCad writes it."""
    encoded = base64.b64encode(compressed).decode("ascii")
    lines = [encoded[start : start + BASE64_LINE_LENGTH] for start in range(0, len(encoded), BASE64_LINE_LENGTH)]
    child = indent + unit
    data_lines = f"\n{child}{unit}".join(lines)
    return (
        f"{indent}(file\n"
        f'{child}(name "{name}")\n'
        f"{child}(type model)\n"
        f"{child}(data |{data_lines}|\n"
        f"{child})\n"
        f'{child}(checksum "{kicad_mmh3_128(data)}")\n'
        f"{indent})\n"
    )


def _sexpr_lists(text: str, start: int = 0):
    """Yield ``(depth, open, close)`` for every list in ``text`` from ``start``.

    Quoted strings, with backslash escapes, are skipped, so parentheses in a
    description or property never count. Lists are yielded when they close.
    """
    stack: list[int] = []
    index = start
    while index < len(text):
        char = text[index]
        if char == '"':
            index += 1
            while index < len(text) and text[index] != '"':
                index += 2 if text[index] == "\\" else 1
        elif char == "(":
            stack.append(index)
        elif char == ")":
            if not stack:
                raise ValueError("Unbalanced footprint s-expression")
            open_index = stack.pop()
            yield len(stack), open_index, index
            if not stack:
                return
        index += 1
    raise ValueError("Unbalanced footprint s-expression")


def _list_head(text: str, open_index: int) -> str:
    match = _HEAD_RE.match(text, open_index + 1)
    return match.group(0) if match else ""


def add_embedded_files(text: str, forms: list[str], indent: str, unit: str) -> str:
    """Add ``(file ...)`` forms to the footprint's ``embedded_files`` block.

    The block is the footprint's direct child; an existing one is extended in
    place, otherwise a new block is inserted before the footprint's closing
    parenthesis.
    """
    if not forms:
        return text
    footprint_open = text.find("(")
    if footprint_open < 0:
        raise ValueError("Footprint payload has no s-expression")
    footprint_close = -1
    existing_close = -1
    for depth, open_index, close_index in _sexpr_lists(text, footprint_open):
        if depth == 1 and existing_close < 0 and _list_head(text, open_index) == "embedded_files":
            existing_close = close_index
        elif depth == 0:
            footprint_close = close_index
    if existing_close >= 0:
        line_start = text.rfind("\n", 0, existing_close) + 1
        if text[line_start:existing_close].strip():
            return text[:existing_close] + "\n" + "".join(forms) + indent + text[existing_close:]
        return text[:line_start] + "".join(forms) + text[line_start:]
    block = f"{indent}(embedded_files\n{''.join(forms)}{indent})\n"
    line_start = text.rfind("\n", 0, footprint_close) + 1
    if text[line_start:footprint_close].strip():
        return text[:footprint_close] + "\n" + block + text[footprint_close:]
    return text[:line_start] + block + text[line_start:]


__all__ = [
    "EMBED_MAX_FOOTPRINT_BYTES",
    "add_embedded_files",
    "compress_model",
    "embedded_file_form",
    "embedded_model_name",
    "kicad_mmh3_128",
]
