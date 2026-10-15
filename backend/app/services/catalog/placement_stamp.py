"""Read the catalog revision stamp placed symbols carry (issue #698, #695).

Remote placement writes two hidden properties into every symbol it serves,
``Prism_Component`` and ``Prism_Revision`` (``placement_payloads``). KiCad
copies them onto the placed instance, so a committed schematic records which
catalog revision each part came from. This module reads them back out of
schematic text, without parsing geometry and without a database.

Names match the way the writer reserves them (custom-field key
canonicalization: ``Prism Revision`` and ``prism-revision`` count). A value
that is not a UUID is no stamp.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Mapping

from app.services import kicad_library_reader
from app.services.catalog.metadata_normalization import PLACEMENT_STAMP_FIELDS, custom_field_key


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_LIB_ID_RE = re.compile(r'\(lib_id\s+"((?:\\.|[^"\\])*)"\)')
_UUID_FORM_RE = re.compile(r'\(uuid\s+"?([^")\s]+)"?\s*\)')
_REFERENCE_FORM_RE = re.compile(r'\(reference\s+"((?:\\.|[^"\\])*)"')
_COMPONENT_KEY, _REVISION_KEY = (custom_field_key(name) for name in PLACEMENT_STAMP_FIELDS)


@dataclass(frozen=True)
class Stamp:
    component_id: str
    revision_id: str


@dataclass(frozen=True)
class PlacedSymbol:
    """One symbol instance in a schematic, as far as the catalog cares."""

    schematic: str
    symbol_uuid: str
    lib_id: str
    references: tuple[str, ...]
    properties: Mapping[str, str] = field(default_factory=dict)
    stamp: Stamp | None = None

    @property
    def library_nickname(self) -> str:
        return self.lib_id.split(":", 1)[0] if ":" in self.lib_id else ""

    @property
    def symbol_name(self) -> str:
        return self.lib_id.split(":", 1)[-1]


def read_stamp(fields: Mapping[str, str]) -> Stamp | None:
    """The stamp in ``fields``, or ``None`` unless both ids are present and are UUIDs."""
    values: dict[str, str] = {}
    for name, value in fields.items():
        key = custom_field_key(name)
        if key in (_COMPONENT_KEY, _REVISION_KEY):
            values.setdefault(key, str(value or "").strip().lower())
    component_id, revision_id = values.get(_COMPONENT_KEY, ""), values.get(_REVISION_KEY, "")
    if not _UUID_RE.match(component_id) or not _UUID_RE.match(revision_id):
        return None
    return Stamp(component_id, revision_id)


def is_power_or_virtual(symbol: PlacedSymbol) -> bool:
    """Power flags and other ``#``-referenced symbols are never catalog parts."""
    return symbol.lib_id.startswith("power:") or all(ref.startswith("#") for ref in symbol.references or ("#",))


def placed_symbols(text: str, schematic: str) -> list[PlacedSymbol]:
    """Every symbol instance in a ``.kicad_sch`` text, in file order.

    References come from the instance's ``(instances …)`` paths, so a symbol
    in a sheet used twice lists both; without them, the ``Reference`` property.
    Library definitions (``lib_symbols``) carry no ``lib_id`` and are skipped.
    """
    symbols: list[PlacedSymbol] = []
    for block in kicad_library_reader.iter_forms(text, "symbol"):
        lib_id_match = _LIB_ID_RE.search(block)
        if not lib_id_match:
            continue
        properties = kicad_library_reader.symbol_properties(block)
        references = tuple(dict.fromkeys(_REFERENCE_FORM_RE.findall(block))) or tuple(
            value for value in (properties.get("Reference", ""),) if value
        )
        uuid_match = _UUID_FORM_RE.search(block)
        symbols.append(
            PlacedSymbol(
                schematic=schematic,
                symbol_uuid=uuid_match.group(1) if uuid_match else "",
                lib_id=lib_id_match.group(1),
                references=references,
                properties=properties,
                stamp=read_stamp(properties),
            )
        )
    return symbols


__all__ = ["PlacedSymbol", "Stamp", "is_power_or_virtual", "placed_symbols", "read_stamp"]
