"""A request's recorded inverse and touched ids (docs/system-builder/CONTRACTS.md §3.3).

The inverse is computed from the document before and after the request, at
object granularity, so it covers everything a cascade removed. Applied as a
request on the "after" document, it gives back the "before" one:

1. ``replace-``/``set-`` ops first, so restored objects stop referring to
   objects the inverse is about to remove;
2. then ``remove-`` ops for what the request added, dependents first
   (:data:`_REMOVE_ORDER`), so no cascade removes an object a later op names;
3. then ``add-`` ops, under the old ids, for what the request removed;
4. then dismissed suggestions and layout entries.

Touched ids are what undo intersects with later requests: every object id
added, removed or changed, plus ``#info``, ``layout:<id>`` and
``dismissed:<occurrence>|<connector>|<key>`` for the non-object parts. A
harness block's own id is touched only when the block itself is added,
removed or relabelled, so editing two wires of one harness never conflicts.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.system_builder.document import (
    COLLECTIONS,
    HARNESS_COLLECTIONS,
    HARNESS_NOUNS,
    NOUNS,
    camel,
    harness_info,
)

_NOUN_OF = {collection: noun for noun, collection in NOUNS.items()}
_HARNESS_NOUN_OF = {collection: noun for noun, collection in HARNESS_NOUNS.items()}


#: Removal order for the inverse: an object before anything its removal cascades from.
_REMOVE_ORDER = (
    "markers", "waypoints", "coverings", "wires", "links", "cables", "segments",
    "ends", "splices", "looseEnds", "branchPoints",
    "exports", "waivers", "mates", "subPorts", "bodyConnectors", "harnesses", "occurrences", "sheets",
)


def _removal_rank(op: Mapping[str, Any]) -> int:
    noun = op["kind"].removeprefix("remove-")
    collection = NOUNS.get(noun) or HARNESS_NOUNS[noun]
    return _REMOVE_ORDER.index(collection)


def _by_id(items: list[Mapping[str, Any]]) -> dict[str, Mapping[str, Any]]:
    return {item["id"]: item for item in items}


def _diff(before: list, after: list) -> tuple[list, list, list]:
    """(changed old objects, added ids, removed old objects), each in id order."""

    old, new = _by_id(before), _by_id(after)
    changed = [old[i] for i in sorted(old.keys() & new.keys()) if old[i] != new[i]]
    added = sorted(new.keys() - old.keys())
    removed = [old[i] for i in sorted(old.keys() - new.keys())]
    return changed, added, removed


def _contents_ids(harness: Mapping[str, Any]) -> set[str]:
    return {item["id"] for collection in HARNESS_COLLECTIONS for item in harness[collection]}


def _suggestion_key(item: Mapping[str, Any]) -> str:
    return f"dismissed:{item['occurrence']}|{item['connector']}|{item['key']}"


def inverse_of(before: Mapping[str, Any], after: Mapping[str, Any]) -> tuple[list[dict[str, Any]], set[str]]:
    replaces: list[dict[str, Any]] = []
    removes: list[dict[str, Any]] = []
    adds: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    touched: set[str] = set()

    if before["name"] != after["name"] or before.get("description") != after.get("description"):
        replaces.append({"kind": "set-system-info", "name": before["name"], "description": before.get("description")})
        touched.add("#info")

    for collection in COLLECTIONS:
        if collection == "harnesses":
            continue
        noun = _NOUN_OF[collection]
        changed, added, removed = _diff(before[collection], after[collection])
        replaces += [{"kind": f"replace-{noun}", camel(noun): item} for item in changed]
        removes += [{"kind": f"remove-{noun}", "id": object_id} for object_id in added]
        adds += [{"kind": f"add-{noun}", camel(noun): item} for item in removed]
        touched |= {item["id"] for item in changed + removed} | set(added)

    old_harnesses, new_harnesses = _by_id(before["harnesses"]), _by_id(after["harnesses"])
    for harness_id in sorted(new_harnesses.keys() - old_harnesses.keys()):
        removes.append({"kind": "remove-harness", "id": harness_id})
        touched |= {harness_id} | _contents_ids(new_harnesses[harness_id])
    for harness_id in sorted(old_harnesses.keys() - new_harnesses.keys()):
        adds.append({"kind": "add-harness", "harness": old_harnesses[harness_id]})
        touched |= {harness_id} | _contents_ids(old_harnesses[harness_id])
    for harness_id in sorted(old_harnesses.keys() & new_harnesses.keys()):
        old, new = old_harnesses[harness_id], new_harnesses[harness_id]
        if harness_info(old) != harness_info(new):
            replaces.append({"kind": "replace-harness", "harness": harness_info(old)})
            touched.add(harness_id)
        for collection in HARNESS_COLLECTIONS:
            noun = _HARNESS_NOUN_OF[collection]
            changed, added, removed = _diff(old[collection], new[collection])
            replaces += [{"kind": f"replace-{noun}", "harness": harness_id, camel(noun): item} for item in changed]
            removes += [{"kind": f"remove-{noun}", "harness": harness_id, "id": object_id} for object_id in added]
            adds += [{"kind": f"add-{noun}", "harness": harness_id, camel(noun): item} for item in removed]
            touched |= {item["id"] for item in changed + removed} | set(added)

    old_dismissed = {_suggestion_key(item): item for item in before["dismissedSuggestions"]}
    new_dismissed = {_suggestion_key(item): item for item in after["dismissedSuggestions"]}
    # A suggestion on an occurrence or body connector the inverse removes goes with its cascade.
    removed_ids = {op["id"] for op in removes}
    cascaded = {(item["id"], None) for item in after["occurrences"] if item["id"] in removed_ids}
    cascaded |= {(item["occurrence"], item["refdes"]) for item in after["bodyConnectors"] if item["id"] in removed_ids}
    rest += [
        {"kind": "restore-suggestion", "suggestion": new_dismissed[key]}
        for key in sorted(new_dismissed.keys() - old_dismissed.keys())
        if (new_dismissed[key]["occurrence"], None) not in cascaded
        and (new_dismissed[key]["occurrence"], new_dismissed[key]["connector"]) not in cascaded
    ]
    rest += [{"kind": "dismiss-suggestion", "suggestion": old_dismissed[key]} for key in sorted(old_dismissed.keys() - new_dismissed.keys())]
    touched |= old_dismissed.keys() ^ new_dismissed.keys()

    old_layout, new_layout = before["layout"], after["layout"]
    for item in sorted(old_layout.keys() | new_layout.keys()):
        if old_layout.get(item) == new_layout.get(item):
            continue
        touched.add(f"layout:{item}")
        if item not in old_layout:
            # A removed object's entry goes with it; only remove what is still there.
            if item not in removed_ids:
                rest.append({"kind": "remove-layout", "item": item})
        else:
            rest.append({"kind": "set-layout", "item": item, "placement": old_layout[item]})

    removes.sort(key=_removal_rank)
    return replaces + removes + adds + rest, touched
