"""Catalog asset-type vocabulary shared by domain operations."""

from __future__ import annotations


SYSTEM_ENTRY_ASSET_TYPE = "system_entry"

SUPPORTED_ASSET_TYPES: tuple[str, ...] = (
    "symbol", "footprint", "3dmodel", "spice", SYSTEM_ENTRY_ASSET_TYPE,
)
PLACE_REQUIRED_ASSET_TYPES: tuple[str, ...] = ("symbol", "footprint")
AUXILIARY_ASSET_TYPES: frozenset[str] = frozenset({"3dmodel", "spice"})
#: Assets a ``system`` revision carries; they never place, preview or pass KLC.
SYSTEM_ASSET_TYPES: frozenset[str] = frozenset({SYSTEM_ENTRY_ASSET_TYPE})

PREVIEW_KIND_SYMBOL = "symbol"
PREVIEW_KIND_FOOTPRINT = "footprint"


def preview_kind_for_asset_type(asset_type: str) -> str:
    """Map a placement asset type to its base preview kind."""
    return PREVIEW_KIND_SYMBOL if str(asset_type) == "symbol" else PREVIEW_KIND_FOOTPRINT


__all__ = [
    "AUXILIARY_ASSET_TYPES",
    "PLACE_REQUIRED_ASSET_TYPES",
    "PREVIEW_KIND_FOOTPRINT",
    "PREVIEW_KIND_SYMBOL",
    "SUPPORTED_ASSET_TYPES",
    "SYSTEM_ASSET_TYPES",
    "SYSTEM_ENTRY_ASSET_TYPE",
    "preview_kind_for_asset_type",
]
