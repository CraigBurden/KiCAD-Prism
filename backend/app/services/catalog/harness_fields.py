"""Harness attributes of catalog parts (System Builder CONTRACTS.md §16.1).

Housings, contacts, cables and coverings are ordinary ``part`` components.
Their harness attributes are metadata fields in the ``harness`` group, stored in
a revision's ``extra_fields`` and seeded as built-in definitions by catalog
migration 15, so they are versioned and reviewed with the revision. All are
optional; :func:`harness_facts` reads them the way a system build does.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Mapping

GROUP = "harness"
ROLES = ("housing", "contact", "cable", "sleeve", "heat-shrink", "tape", "zip-ties", "label", "marker")


@dataclass(frozen=True)
class HarnessField:
    """One seeded field definition and the key a system build reads it as."""

    key: str
    label: str
    field_type: str
    fact: str
    unit: str = ""
    enum_values: tuple[str, ...] = ()


HARNESS_FIELDS: tuple[HarnessField, ...] = (
    HarnessField("harness_role", "Harness role", "enum", "role", enum_values=ROLES),
    HarnessField("harness_cavities", "Cavities", "number", "cavities"),
    HarnessField("harness_contact_family", "Contact family", "text", "contactFamily"),
    HarnessField("harness_gauge_min_awg", "Gauge min (AWG)", "text", "gaugeMinAwg"),
    HarnessField("harness_gauge_max_awg", "Gauge max (AWG)", "text", "gaugeMaxAwg"),
    HarnessField("harness_conductors", "Conductors", "number", "conductors"),
    HarnessField("harness_shielded", "Shielded", "boolean", "shielded"),
    HarnessField("harness_od_mm", "Outer diameter", "number", "odMm", unit="mm"),
    HarnessField("harness_diameter_min_mm", "Fits diameter min", "number", "diameterMinMm", unit="mm"),
    HarnessField("harness_diameter_max_mm", "Fits diameter max", "number", "diameterMaxMm", unit="mm"),
    HarnessField("harness_shrink_ratio", "Shrink ratio", "number", "shrinkRatio"),
)

_COUNTS = {"cavities", "conductors"}
_TRUE = {"1", "true", "yes", "y"}
_FALSE = {"0", "false", "no", "n"}


def _number(text: str) -> float | None:
    try:
        value = float(text)
    except ValueError:
        return None
    return value if math.isfinite(value) and value >= 0 else None


def _fact(field: HarnessField, raw: Any) -> Any:
    text = str(raw).strip() if raw is not None else ""
    if not text:
        return None
    if field.field_type == "enum":
        return text if text in field.enum_values else None
    if field.field_type == "boolean":
        lowered = text.casefold()
        return True if lowered in _TRUE else False if lowered in _FALSE else None
    if field.field_type == "number":
        value = _number(text)
        if value is None:
            return None
        if field.fact in _COUNTS:
            return int(value) if value.is_integer() and value >= 1 else None
        return value if value > 0 else None
    return text


def harness_facts(extra_fields: Mapping[str, Any]) -> dict[str, Any] | None:
    """The ``harness`` block of a part (§16.2), or None without a valid role.

    Blank or unparseable values are left out: a count must be a whole number of
    at least one, a measure positive, a role one of :data:`ROLES`.
    """

    facts: dict[str, Any] = {}
    for field in HARNESS_FIELDS:
        value = _fact(field, extra_fields.get(field.key))
        if value is not None:
            facts[field.fact] = value
    return facts if "role" in facts else None
