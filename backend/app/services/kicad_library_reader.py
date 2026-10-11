"""Read KiCad library text without parsing geometry.

One reader for the parts of a ``.kicad_sym`` / ``.kicad_mod`` (and the
``(symbol …)`` / ``(footprint …)`` forms embedded in schematics and boards)
that Prism needs: where a form ends, the top-level symbols of a library and
their properties, a footprint's name in both the current ``(footprint …)`` and
the KiCad 5 ``(module …)`` form, the 3D models it references, and which files
in a folder a referenced path can mean.

Catalog uploads, folder discovery and import, project component extraction and
the semantic index all read KiCad text through this module, so a file is
named, split and linked the same way whichever path it arrives by.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator, Literal, Mapping, Sequence


# ---------------------------------------------------------------------------
# S-expression structure
# ---------------------------------------------------------------------------

# Only quotes and parentheses can change the nesting state of an
# S-expression. A complete quoted string is its own alternative, and comes
# first, so the scan swallows it whole and never sees the parentheses inside
# a value like "Resistor (SMD)". A bare quote therefore only ever matches
# when the string is unterminated.
_SEXPR_SCAN = re.compile(r'"(?:[^"\\]|\\.)*"|["()]')


def form_end(text: str, start: int) -> int | None:
    """The offset just past the form opening at ``start``, or ``None``.

    Boards run to tens of megabytes and this is called once per candidate
    form, so the walk stays inside the regex engine: it steps between
    structural characters instead of over every character.
    """

    depth = 0
    for match in _SEXPR_SCAN.finditer(text, start):
        token = match.group()
        if token == "(":
            depth += 1
        elif token == ")":
            depth -= 1
            if depth == 0:
                return match.end()
            if depth < 0:  # started past the opening paren
                return None
        elif token == '"':  # unterminated string; nothing sane left to scan
            return None
    return None


def form_starts(head: str) -> re.Pattern[str]:
    """A pattern matching the opening of every ``(head …)`` form."""

    return re.compile(rf"\({re.escape(head)}(?=\s|\))")


def iter_forms(text: str, head: str) -> Iterator[str]:
    """Every complete ``(head …)`` form in ``text``, at any depth, in order."""

    for match in form_starts(head).finditer(text):
        end = form_end(text, match.start())
        if end is not None:
            yield text[match.start():end]


def _unescape(value: str) -> str:
    return value.replace(r'\"', '"').replace(r"\\", "\\")


# ---------------------------------------------------------------------------
# Symbol libraries
# ---------------------------------------------------------------------------

_UNIT_SUFFIX = re.compile(r"_\d+_\d+$")
_PROPERTY = re.compile(r'\(property\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"')


def top_level_symbol_blocks(text: str) -> list[tuple[str, str]]:
    """``(name, block)`` for each ``(symbol …)`` directly inside the library.

    Unit and body-style sub-symbols nested inside a definition are part of
    that definition's block. Top-level unit blocks, which some exporters write
    beside their parent, are returned as their own entries; see
    :func:`is_unit_of_listed_symbol`.
    """

    blocks: list[tuple[str, str]] = []
    depth = 0
    start: int | None = None
    name = ""
    in_string = False
    escape = False
    index = 0
    while index < len(text):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
        elif char == "(":
            if depth == 1 and text.startswith("(symbol", index):
                start = index
                cursor = index + len("(symbol")
                while cursor < len(text) and text[cursor].isspace():
                    cursor += 1
                if cursor < len(text) and text[cursor] == '"':
                    cursor += 1
                    chars: list[str] = []
                    escaped = False
                    while cursor < len(text):
                        current = text[cursor]
                        if escaped:
                            chars.append(current)
                            escaped = False
                        elif current == "\\":
                            escaped = True
                        elif current == '"':
                            break
                        else:
                            chars.append(current)
                        cursor += 1
                    name = "".join(chars)
            depth += 1
        elif char == ")":
            depth -= 1
            if start is not None and depth == 1:
                blocks.append((name, text[start : index + 1]))
                start = None
                name = ""
        index += 1
    return blocks


def is_unit_of_listed_symbol(name: str, names: set[str] | frozenset[str]) -> bool:
    """Whether ``name`` is a ``<symbol>_<unit>_<style>`` block of a symbol in ``names``."""

    base = _UNIT_SUFFIX.sub("", name)
    return base != name and base in names


def library_symbols(text: str) -> list[tuple[str, str]]:
    """The library's symbols, without the unit blocks of symbols it also lists."""

    blocks = top_level_symbol_blocks(text)
    names = {name for name, _ in blocks}
    return [(name, block) for name, block in blocks if not is_unit_of_listed_symbol(name, names)]


def symbol_names(text: str) -> list[str]:
    """Symbol names in a ``.kicad_sym`` payload, unit blocks excluded.

    A tolerant scan for upload validation: it reads every ``(symbol "…")``
    head, so a truncated file still names what it holds.
    """

    matches = re.findall(r'\(symbol\s+"([^"]+)"', text)
    filtered = [name for name in matches if not _UNIT_SUFFIX.search(name)]
    return list(dict.fromkeys(filtered or matches))


def library_header(text: str) -> tuple[str, str]:
    """``(version, generator)`` of a symbol library, with Prism's defaults."""

    version_match = re.search(r"\(version\s+([^)]+)\)", text)
    version = version_match.group(1) if version_match else "20211014"
    generator_match = re.search(r"\(generator\s+([^)]+)\)", text)
    generator = generator_match.group(1) if generator_match else '"KiCAD Prism"'
    return version, generator


def single_symbol_library(
    text: str,
    symbol_name: str,
    blocks: Sequence[tuple[str, str]] | None = None,
) -> bytes:
    """A one-symbol library holding ``symbol_name`` and its top-level unit blocks.

    Pass ``blocks`` (from :func:`top_level_symbol_blocks`) when splitting many
    symbols out of the same text, so it is scanned once.
    """

    parsed = list(blocks) if blocks is not None else top_level_symbol_blocks(text)
    base_block = dict(parsed).get(symbol_name)
    if not base_block:
        raise ValueError("Selected symbol was not found in the library")
    unit_pattern = re.compile(rf"^{re.escape(symbol_name)}_\d+_\d+$")
    unit_blocks = [block for name, block in parsed if unit_pattern.match(name)]
    body = "\n  ".join([base_block, *unit_blocks])
    version, generator = library_header(text)
    return f"(kicad_symbol_lib (version {version}) (generator {generator})\n  {body}\n)\n".encode("utf-8")


def symbol_properties(block: str) -> dict[str, str]:
    """Every ``(property "Name" "Value")`` in a symbol block, unescaped."""

    return {
        _unescape(key): _unescape(value)
        for key, value in _PROPERTY.findall(block)
        if key
    }


def _field_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.casefold())


def property_value(properties: Mapping[str, str], *names: str) -> str:
    """The first non-empty property among ``names``, ignoring case and punctuation."""

    normalized = {_field_key(key): value for key, value in properties.items()}
    for name in names:
        value = normalized.get(_field_key(name), "").strip()
        if value:
            return value
    return ""


# ---------------------------------------------------------------------------
# Footprints
# ---------------------------------------------------------------------------

_FOOTPRINT_NAME = re.compile(r'\((?:footprint|module)\s+(?:"((?:\\.|[^"])*)"|([^\s()]+))')
_MODEL_REFERENCE = re.compile(r'\(model\s+(?:"((?:\\.|[^"\\])*)"|([^\s()"]+))')


def footprint_name(text: str) -> str:
    """The name a footprint declares, from ``(footprint …)`` or legacy ``(module …)``.

    Returns ``""`` when the text declares none; callers fall back to the
    filename.
    """

    match = _FOOTPRINT_NAME.search(text)
    return ((match.group(1) or match.group(2)) if match else "").strip()


def footprint_identity(relative_path: str) -> tuple[str, str]:
    """``(library, filename stem)`` for a footprint file; the library is its ``.pretty``."""

    path = Path(relative_path)
    library = next(
        (parent.name.removesuffix(".pretty") for parent in path.parents if parent.suffix.casefold() == ".pretty"),
        path.parent.name or "Prism_Imported",
    )
    return library, path.stem


def model_references(text: str) -> list[str]:
    """The 3D model paths a footprint references, quoted or bare, in order."""

    return [_unescape(quoted) if quoted else bare for quoted, bare in _MODEL_REFERENCE.findall(text)]


# ---------------------------------------------------------------------------
# Linked files
# ---------------------------------------------------------------------------

LinkStatus = Literal["resolved", "missing", "ambiguous"]


@dataclass(frozen=True)
class LinkResolution:
    """Which files a referenced path can mean.

    ``resolved`` has exactly one candidate. ``ambiguous`` has several and
    nothing decides between them, so no caller may pick one silently.
    """

    status: LinkStatus
    candidates: list[dict[str, Any]] = field(default_factory=list)

    @property
    def selected(self) -> dict[str, Any] | None:
        return self.candidates[0] if self.status == "resolved" else None


class FolderInventory:
    """The files of a folder, indexed for resolving the paths libraries reference.

    Items are mappings with a ``relative_path`` (forward slashes); lookups are
    case-insensitive, as KiCad's are on the platforms most libraries come from.
    """

    def __init__(self, items: Sequence[Mapping[str, Any]]) -> None:
        self._by_path: dict[str, Mapping[str, Any]] = {}
        self._by_name: dict[str, list[Mapping[str, Any]]] = {}
        for item in items:
            relative_path = str(item["relative_path"])
            self._by_path[relative_path.casefold()] = item
            self._by_name.setdefault(Path(relative_path).name.casefold(), []).append(item)

    def get(self, relative_path: str) -> Mapping[str, Any] | None:
        return self._by_path.get(relative_path.casefold())

    def resolve(
        self,
        raw_path: str,
        *,
        owner_relative_path: str,
        suffixes: frozenset[str] | set[str] | None = None,
    ) -> LinkResolution:
        """Resolve a path referenced from the file at ``owner_relative_path``.

        A leading ``${VAR}`` is dropped, since the folder carries no variable
        definitions. The remainder is tried against the folder root and next to
        the owner; if neither exists, any file with the same name counts.
        """

        expanded = re.sub(r"^\$\{[^}]+\}/?", "", raw_path).replace("\\", "/")
        relative = (Path(owner_relative_path).parent / expanded).as_posix()
        candidates: list[Mapping[str, Any]] = []
        for path in (expanded.lstrip("/"), relative):
            found = self._by_path.get(path.casefold())
            if found is not None and all(found is not item for item in candidates):
                candidates.append(found)
        if not candidates:
            candidates = list(self._by_name.get(Path(raw_path.replace("\\", "/")).name.casefold(), []))
        if suffixes is not None:
            candidates = [item for item in candidates if Path(str(item["relative_path"])).suffix.casefold() in suffixes]
        status: LinkStatus = "resolved" if len(candidates) == 1 else "missing" if not candidates else "ambiguous"
        return LinkResolution(status, [dict(item) for item in candidates])


__all__ = [
    "FolderInventory",
    "LinkResolution",
    "footprint_identity",
    "footprint_name",
    "form_end",
    "form_starts",
    "is_unit_of_listed_symbol",
    "iter_forms",
    "library_header",
    "library_symbols",
    "model_references",
    "property_value",
    "single_symbol_library",
    "symbol_names",
    "symbol_properties",
    "top_level_symbol_blocks",
]
