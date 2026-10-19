"""The ``prism.system.v2`` document as plain data (docs/system-builder/CONTRACTS.md §1–§2).

The committed JSON Schema (``native/contracts/generated/schema/SystemV2.json``)
is the authority on shape. This module knows the document's collections, so
the operations, the integrity check and the inverse can walk every object
without a model class per kind.
"""

from __future__ import annotations

import copy
import json
import secrets
from typing import Any, Iterator, Mapping, Optional

SCHEMA = "prism.system.v2"

#: Top-level collections of objects with an ``id``, in document order.
COLLECTIONS: tuple[str, ...] = (
    "sheets",
    "occurrences",
    "subPorts",
    "bodyConnectors",
    "mates",
    "harnesses",
    "exports",
    "waivers",
)

#: Harness contents, each a list of objects with an ``id``.
HARNESS_COLLECTIONS: tuple[str, ...] = (
    "ends",
    "links",
    "wires",
    "splices",
    "branchPoints",
    "segments",
    "coverings",
    "cables",
    "looseEnds",
    "markers",
    "waypoints",
)

#: A harness block's own fields: everything that is not contents.
HARNESS_OWN_FIELDS: tuple[str, ...] = ("id", "label", "sheet")

#: Op noun (kebab-case) → top-level collection.
NOUNS: dict[str, str] = {
    "sheet": "sheets",
    "occurrence": "occurrences",
    "sub-port": "subPorts",
    "body-connector": "bodyConnectors",
    "mate": "mates",
    "harness": "harnesses",
    "export": "exports",
    "waiver": "waivers",
}

#: Op noun (kebab-case) → harness collection.
HARNESS_NOUNS: dict[str, str] = {
    "end": "ends",
    "link": "links",
    "wire": "wires",
    "splice": "splices",
    "branch-point": "branchPoints",
    "segment": "segments",
    "covering": "coverings",
    "cable": "cables",
    "loose-end": "looseEnds",
    "marker": "markers",
    "waypoint": "waypoints",
}


def camel(noun: str) -> str:
    """``body-connector`` → ``bodyConnector``: the op's payload field."""

    head, *rest = noun.split("-")
    return head + "".join(part.capitalize() for part in rest)


_BASE32 = "abcdefghijklmnopqrstuvwxyz234567"


def new_id(prefix: str) -> str:
    """``<prefix>_<10 base32>``, the form the UI and scripts use for object ids."""

    return f"{prefix}_" + "".join(secrets.choice(_BASE32) for _ in range(10))


def new_document(name: str, description: Optional[str] = None) -> dict[str, Any]:
    """An empty system."""

    document: dict[str, Any] = {"schema": SCHEMA, "name": name}
    if description:
        document["description"] = description
    for collection in COLLECTIONS:
        document[collection] = []
    document["dismissedSuggestions"] = []
    document["layout"] = {}
    return canonical(document)


def empty_harness(harness_id: str, label: str, sheet: Optional[str] = None) -> dict[str, Any]:
    harness: dict[str, Any] = {"id": harness_id, "label": label}
    if sheet:
        harness["sheet"] = sheet
    for collection in HARNESS_COLLECTIONS:
        harness[collection] = []
    return harness


def _suggestion_key(item: Mapping[str, Any]) -> tuple[str, str, str]:
    return (item["occurrence"], item["connector"], item["key"])


def canonical(document: dict[str, Any]) -> dict[str, Any]:
    """Sort every collection the contract orders (by ``id``, code point order), in place."""

    for collection in COLLECTIONS:
        document[collection].sort(key=lambda item: item["id"])
    for harness in document["harnesses"]:
        for collection in HARNESS_COLLECTIONS:
            harness[collection].sort(key=lambda item: item["id"])
    document["dismissedSuggestions"].sort(key=_suggestion_key)
    document["layout"] = dict(sorted(document["layout"].items()))
    return document


def canonical_bytes(document: Mapping[str, Any]) -> bytes:
    """The document's size-limit form: compact JSON, keys as stored."""

    return json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def objects(document: Mapping[str, Any]) -> Iterator[tuple[str, Optional[str], Mapping[str, Any]]]:
    """Every object with an id: ``(collection, harness id or None, object)``."""

    for collection in COLLECTIONS:
        for item in document[collection]:
            yield collection, None, item
    for harness in document["harnesses"]:
        for collection in HARNESS_COLLECTIONS:
            for item in harness[collection]:
                yield collection, harness["id"], item


def sub_port_endpoints(document: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Every endpoint that may name a sub-port: export sites and both sides of each link."""

    endpoints = [export["site"] for export in document["exports"]]
    for harness in document["harnesses"]:
        for link in harness["links"]:
            endpoints += [link["a"], link["b"]]
    return endpoints


def all_ids(document: Mapping[str, Any]) -> set[str]:
    return {item["id"] for _, _, item in objects(document)}


def find(document: Mapping[str, Any], collection: str, object_id: str) -> Optional[dict[str, Any]]:
    for item in document[collection]:
        if item["id"] == object_id:
            return item
    return None


def harness_info(harness: Mapping[str, Any]) -> dict[str, Any]:
    return {key: harness[key] for key in HARNESS_OWN_FIELDS if key in harness}


def clone(document: Mapping[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(dict(document))
