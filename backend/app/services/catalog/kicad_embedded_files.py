"""Encode 3D models as KiCad embedded files inside a footprint.

KiCad 10 resolves ``kicad-embed://<name>`` model paths from the footprint's own
``(embedded_files ...)`` block, and a board saves that data with the
footprint. Embedding a placed model therefore pins it in the project commit.

The format follows KiCad's ``common/embedded_files.cpp``: one-shot zstd at
level 15 with the content size in the frame and no frame checksum, base64 in
76-column lines between ``|`` markers, and a checksum that is
MurmurHash3_x64_128 (seed ``0xABBA2345``) over the uncompressed data
zero-padded to a multiple of 4 bytes, written as 32 uppercase hex digits.

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

# Models whose compressed form exceeds this keep an external path. The model
# is base64 inside the footprint and base64 again inside the inline bundle,
# about 1.8x the compressed size, and the raw model file is still shipped next
# to it. 2 MiB compressed (a STEP file of roughly 8-16 MiB) adds at most about
# 3.6 MiB to a bundle, well inside the 16 MiB max_download_bytes the provider
# advertises, and about 2.7 MiB to the board file per distinct model.
EMBED_MAX_COMPRESSED_BYTES = 2 * 1024 * 1024

ZSTD_LEVEL = 15
MURMUR3_SEED = 0xABBA2345
BASE64_LINE_LENGTH = 76

_MASK64 = (1 << 64) - 1
_UNSAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]")
_EMBEDDED_FILES_RE = re.compile(r"\(embedded_files\b")


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
    """Return KiCad's embedded-file checksum for ``data``."""
    padded = data + b"\0" * (-len(data) % 4)
    c1, c2 = 0x87C37B91114253D5, 0x4CF5AD432745937F
    h1 = h2 = MURMUR3_SEED
    body_length = len(padded) - len(padded) % 16
    for k1, k2 in struct.iter_unpack("<QQ", padded[:body_length]):
        h1 ^= (_rotl64((k1 * c1) & _MASK64, 31) * c2) & _MASK64
        h1 = (_rotl64(h1, 27) + h2) & _MASK64
        h1 = (h1 * 5 + 0x52DCE729) & _MASK64
        h2 ^= (_rotl64((k2 * c2) & _MASK64, 33) * c1) & _MASK64
        h2 = (_rotl64(h2, 31) + h1) & _MASK64
        h2 = (h2 * 5 + 0x38495AB5) & _MASK64
    tail = padded[body_length:]
    if len(tail) > 8:
        h2 ^= (_rotl64((int.from_bytes(tail[8:], "little") * c2) & _MASK64, 33) * c1) & _MASK64
    if tail:
        h1 ^= (_rotl64((int.from_bytes(tail[:8], "little") * c1) & _MASK64, 31) * c2) & _MASK64
    length = len(padded) & 0xFFFFFFFF
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


def _closing_paren(text: str, open_index: int) -> int:
    depth = 0
    index = open_index
    while index < len(text):
        char = text[index]
        if char == '"':
            index += 1
            while index < len(text) and text[index] != '"':
                index += 2 if text[index] == "\\" else 1
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    raise ValueError("Unbalanced footprint s-expression")


def add_embedded_files(text: str, forms: list[str], indent: str, unit: str) -> str:
    """Add ``(file ...)`` forms to the footprint's ``embedded_files`` block.

    An existing block is extended in place; otherwise a new block is inserted
    before the footprint's closing parenthesis.
    """
    if not forms:
        return text
    existing = _EMBEDDED_FILES_RE.search(text)
    if existing:
        close = _closing_paren(text, existing.start())
        line_start = text.rfind("\n", 0, close) + 1
        if text[line_start:close].strip():
            return text[:close] + "\n" + "".join(forms) + indent + text[close:]
        return text[:line_start] + "".join(forms) + text[line_start:]
    close = text.rstrip().rfind(")")
    if close <= 0:
        raise ValueError("Footprint payload has no closing parenthesis")
    block = f"{indent}(embedded_files\n{''.join(forms)}{indent})\n"
    line_start = text.rfind("\n", 0, close) + 1
    if text[line_start:close].strip():
        return text[:close] + "\n" + block + text[close:]
    return text[:line_start] + block + text[line_start:]


__all__ = [
    "EMBED_MAX_COMPRESSED_BYTES",
    "add_embedded_files",
    "compress_model",
    "embedded_file_form",
    "embedded_model_name",
    "kicad_mmh3_128",
]
