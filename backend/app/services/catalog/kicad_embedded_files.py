"""Encode 3D models as KiCad embedded files inside a footprint.

KiCad 10 resolves ``kicad-embed://<name>`` model paths from the footprint's own
``(embedded_files ...)`` block, and a board saves that data with the
footprint. Embedding a placed model therefore pins it in the project commit.

The format follows KiCad's ``common/embedded_files.cpp``: one-shot zstd at
level 15 with the content size in the frame and no frame checksum, base64 in
76-column lines between ``|`` markers, and KiCad's own MurmurHash3_x64_128
variant (seed ``0xABBA2345``) of the uncompressed data, written as 32
uppercase hex digits. KiCad verifies that checksum on load.

zstd output is deterministic for one library version only. Placement
therefore keeps the compressed copy of each model it embeds
(``embedded_model_copies.py``) and reuses it, so a ``zstandard`` upgrade does
not change the bytes of a footprint placed before.

``decode_embedded_files`` reads the forms back (project harvest uses it for a
board whose footprints reference ``kicad-embed://`` models).
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import PurePath
import re
import struct
from typing import Any

import zstandard

# Compressed model bytes one footprint may embed, by default. The setting
# REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES (issue #698, D2) is the live
# value; placement reads it per call. 16 MiB of zstd data is a STEP model of
# roughly 80-160 MiB, so with the raw ceiling below this cap only binds for
# models that compress poorly. The footprint grows by about 4/3 of it (base64
# in 76-column lines). KiCad charges every manifest asset against one
# aggregate max_download_bytes budget, so a footprint over that budget does
# not place; the raw model it replaces would not have either, because a model
# is only embedded when that makes the placement no larger.
DEFAULT_EMBED_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024

# Raw model bytes one footprint will read and compress while trying to embed.
# A cheap guard ahead of the cap above: a model past it costs a stat, not a
# read and a zstd pass. Generous, since STEP compresses about 5-10x. Kept at
# 64 MiB when the compressed cap went from about 3 MiB to 16 MiB: raising it
# would let one placement read and compress far more per request, and a STEP
# model of 64 MiB already compresses to about 6-13 MiB.
EMBED_MAX_RAW_MODEL_BYTES = 64 * 1024 * 1024

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


def embedded_file_form(
    name: str, data: bytes, compressed: bytes, indent: str, unit: str, *, checksum: str | None = None
) -> str:
    """Return one ``(file ...)`` form laid out as KiCad writes it.

    ``checksum`` overrides KiCad's checksum of ``data``; it is always 32 hex
    digits, so a placeholder gives the form's exact size without hashing.
    """
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
        f'{child}(checksum "{checksum if checksum is not None else kicad_mmh3_128(data)}")\n'
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


# Raw bytes one embedded file may decompress to when it is read back.
DECODE_MAX_RAW_BYTES = 256 * 1024 * 1024

_FILE_FORM_RE = re.compile(
    r'\(file\s+\(name\s+("(?:[^"\\]|\\.)*"|[^\s()]+)\s*\)\s*\(type\s+([^\s()]+)\s*\)'
    r"(?:\s*\(data\s*\|([^|]*)\|\s*\))?"
)
_EMBEDDED_SUFFIX_RE = re.compile(r"^(?P<stem>.+)-(?P<digest>[0-9a-f]{12})$")


def _unquote(token: str) -> str:
    if len(token) >= 2 and token.startswith('"') and token.endswith('"'):
        return re.sub(r"\\(.)", r"\1", token[1:-1])
    return token


def decompress_model(compressed: bytes) -> bytes:
    """Undo ``compress_model`` (or KiCad's ``ZSTD_compress``), refusing oversized output."""
    size = zstandard.frame_content_size(compressed)
    if size < 0 or size > DECODE_MAX_RAW_BYTES:
        raise ValueError("Embedded file has no or too large a content size")
    return zstandard.ZstdDecompressor().decompress(compressed)


def decode_embedded_files(text: str) -> dict[str, dict[str, Any]]:
    """Every ``(file ...)`` form that carries data, by name: ``{"type", "data"}``.

    Data is base64 of zstd as KiCad writes it. A form without data (a
    footprint inside a board names its files and the board holds the data) or
    one that does not decode is left out.
    """
    files: dict[str, dict[str, Any]] = {}
    for match in _FILE_FORM_RE.finditer(text):
        encoded = match.group(3)
        if encoded is None:
            continue
        try:
            data = decompress_model(base64.b64decode("".join(encoded.split()), validate=True))
        except (ValueError, zstandard.ZstdError):
            continue
        files.setdefault(_unquote(match.group(1)), {"type": match.group(2), "data": data})
    return files


def original_model_name(embedded_name: str, data: bytes) -> str:
    """Undo ``embedded_model_name``: drop the ``-<sha256[:12]>`` it added for ``data``."""
    path = PurePath(embedded_name)
    match = _EMBEDDED_SUFFIX_RE.match(path.stem)
    if match and match.group("digest") == hashlib.sha256(data).hexdigest()[:12]:
        return f"{match.group('stem')}{path.suffix}"
    return path.name


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
    "DEFAULT_EMBED_MAX_COMPRESSED_BYTES",
    "EMBED_MAX_RAW_MODEL_BYTES",
    "ZSTD_LEVEL",
    "add_embedded_files",
    "compress_model",
    "decode_embedded_files",
    "decompress_model",
    "embedded_file_form",
    "embedded_model_name",
    "kicad_mmh3_128",
    "original_model_name",
]
