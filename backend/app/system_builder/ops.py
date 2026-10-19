"""Applying ``prism.system.ops.a0`` requests (docs/system-builder/CONTRACTS.md §3).

:func:`apply` runs a request's operations in order on a copy of the document,
then checks the result as a whole: its schema, the document-local integrity
rules and the limits. Nothing is stored here; the store wraps this in its
transaction. The result carries the request's recorded inverse and the ids it
touched, which is what undo needs (§3.3).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from app.services.design_bundle import schemas
from app.system_builder import cascade, integrity
from app.system_builder.document import (
    HARNESS_COLLECTIONS,
    HARNESS_NOUNS,
    HARNESS_OWN_FIELDS,
    NOUNS,
    all_ids,
    camel,
    canonical,
    clone,
    empty_harness,
    find,
)
from app.system_builder.inverse import inverse_of

OPS_SCHEMA = "prism.system.ops.a0"
DOCUMENT_SCHEMA = "prism.system.v2"


class OpRefused(ValueError):
    """An operation that cannot apply, or a result that breaks a rule. ``pointer`` locates it."""

    def __init__(self, pointer: str, message: str) -> None:
        super().__init__(f"{pointer or '/'}: {message}")
        self.pointer = pointer
        self.message = message


@dataclass(frozen=True)
class Applied:
    document: dict[str, Any]
    inverse: list[dict[str, Any]]
    touched: frozenset[str]
    seen_ids: frozenset[str]


def apply(
    document: Mapping[str, Any],
    ops: Sequence[Mapping[str, Any]],
    *,
    seen_ids: Iterable[str],
    limits: integrity.Limits,
    undo: bool = False,
) -> Applied:
    """Apply ``ops`` to ``document`` as one transaction.

    ``seen_ids`` are every id the document has ever held; a new object may not
    reuse one unless ``undo`` (restoring under the old id, §3.3).
    """

    try:
        schemas.validate({"schema": OPS_SCHEMA, "ops": list(ops)}, OPS_SCHEMA)
    except schemas.SchemaInvalid as error:
        raise OpRefused(error.pointer, str(error)) from None
    if len(ops) > limits.ops_per_request:
        raise OpRefused("/ops", f"{len(ops)} operations; the limit is {limits.ops_per_request}")

    before = clone(document)
    after = clone(document)
    seen = set(seen_ids) | all_ids(before)
    for index, op in enumerate(ops):
        try:
            _apply_one(after, copy.deepcopy(dict(op)), seen=seen, undo=undo)
        except OpRefused as error:
            raise OpRefused(f"/ops/{index}{error.pointer}", error.message) from None
        seen |= all_ids(after)
    canonical(after)
    try:
        schemas.validate(after, DOCUMENT_SCHEMA)
        integrity.check(after, limits)
    except schemas.SchemaInvalid as error:
        raise OpRefused(f"/document{error.pointer}", str(error)) from None
    except integrity.IntegrityError as error:
        raise OpRefused(f"/document{error.pointer}", error.message) from None
    inverse, touched = inverse_of(before, after)
    return Applied(after, inverse, frozenset(touched), frozenset(seen))


# ------------------------------------------------------------------ one op


def _apply_one(document: dict[str, Any], op: dict[str, Any], *, seen: set[str], undo: bool) -> None:
    kind: str = op["kind"]
    verb, _, noun = kind.partition("-")
    if verb in ("add", "replace", "remove") and noun in NOUNS:
        _collection_op(document, verb, noun, op, seen=seen, undo=undo)
    elif verb in ("add", "replace", "remove") and noun in HARNESS_NOUNS:
        _harness_op(document, verb, noun, op, seen=seen, undo=undo)
    else:
        SEMANTIC[kind](document, op, seen=seen, undo=undo)


def _require_new_id(object_id: str, document: Mapping[str, Any], seen: set[str], undo: bool) -> None:
    if object_id in all_ids(document):
        raise OpRefused("", f"id {object_id!r} is already in use")
    if object_id in seen and not undo:
        raise OpRefused("", f"id {object_id!r} was used before; ids are never reused")


def _collection_op(document: dict[str, Any], verb: str, noun: str, op: dict[str, Any], *, seen: set[str], undo: bool) -> None:
    collection = NOUNS[noun]
    if verb == "add":
        item = op[camel(noun)]
        _require_new_id(item["id"], document, seen, undo)
        if noun == "harness":
            for contents in HARNESS_COLLECTIONS:
                for child in item[contents]:
                    _require_new_id(child["id"], document, seen, undo)
        document[collection].append(item)
        return
    object_id = op["id"] if verb == "remove" else op[camel(noun)]["id"]
    current = find(document, collection, object_id)
    if current is None:
        raise OpRefused("", f"no {noun} {object_id!r}")
    if verb == "remove":
        cascade.TOP_LEVEL[collection](document, object_id)
    elif noun == "harness":
        for key in HARNESS_OWN_FIELDS:
            current.pop(key, None)
        current.update(op["harness"])
    else:
        document[collection][document[collection].index(current)] = op[camel(noun)]


def _harness_op(document: dict[str, Any], verb: str, noun: str, op: dict[str, Any], *, seen: set[str], undo: bool) -> None:
    harness = find(document, "harnesses", op["harness"])
    if harness is None:
        raise OpRefused("/harness", f"no harness {op['harness']!r}")
    collection = HARNESS_NOUNS[noun]
    if verb == "add":
        item = op[camel(noun)]
        _require_new_id(item["id"], document, seen, undo)
        harness[collection].append(item)
        return
    object_id = op["id"] if verb == "remove" else op[camel(noun)]["id"]
    current = find(harness, collection, object_id)
    if current is None:
        raise OpRefused("", f"no {noun} {object_id!r} in harness {harness['id']!r}")
    if verb == "remove":
        cascade.remove_harness_item(document, harness["id"], collection, object_id)
    else:
        harness[collection][harness[collection].index(current)] = op[camel(noun)]


# ------------------------------------------------------------- semantic ops


def _set_system_info(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    if "name" in op:
        document["name"] = op["name"]
    if "description" in op:
        if op["description"] is None:
            document.pop("description", None)
        else:
            document["description"] = op["description"]


def _site_owner(document: Mapping[str, Any], occurrence: str, connector: str) -> str | None:
    for harness in document["harnesses"]:
        for end in harness["ends"]:
            site = end.get("site")
            if site and (site["occurrence"], site["connector"]) == (occurrence, connector):
                return harness["id"]
    return None


def _connect_harness(document: dict[str, Any], op: dict[str, Any], *, seen: set[str], undo: bool) -> None:
    link = op["link"]
    sides = {side: (link[side]["occurrence"], link[side]["connector"]) for side in ("a", "b")}
    owners = {side: _site_owner(document, *sides[side]) for side in sides}
    named = op.get("harness")
    existing = {owner for owner in owners.values() if owner}
    if len(existing) > 1:
        raise OpRefused("/link", "the two connectors already belong to different harness blocks")
    if named and existing and named not in existing:
        raise OpRefused("/harness", f"a connector already belongs to harness {existing.pop()!r}")
    harness_id = named or (existing.pop() if existing else None)
    if harness_id is None:
        new = op.get("newHarness")
        if not new:
            raise OpRefused("/newHarness", "no harness block applies; name one to create")
        _require_new_id(new["id"], document, seen, undo)
        document["harnesses"].append(empty_harness(new["id"], new["label"]))
        harness_id = new["id"]
    harness = find(document, "harnesses", harness_id)
    if harness is None:
        raise OpRefused("/harness", f"no harness {harness_id!r}")
    for side, (occurrence, connector) in sides.items():
        if _site_owner(document, occurrence, connector) == harness_id:
            continue
        end_id = op["newEnds"].get(side)
        if not end_id:
            raise OpRefused(f"/newEnds/{side}", "this side needs a new end; give its id")
        _require_new_id(end_id, document, seen, undo)
        harness["ends"].append({"id": end_id, "site": {"occurrence": occurrence, "connector": connector}, "contacts": {}, "pinMap": []})
    _require_new_id(link["id"], document, seen, undo)
    harness["links"].append(link)


def _suggestion_index(document: Mapping[str, Any], suggestion: Mapping[str, Any]) -> int | None:
    for index, item in enumerate(document["dismissedSuggestions"]):
        if (item["occurrence"], item["connector"], item["key"]) == (suggestion["occurrence"], suggestion["connector"], suggestion["key"]):
            return index
    return None


def _dismiss_suggestion(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    if _suggestion_index(document, op["suggestion"]) is not None:
        raise OpRefused("/suggestion", "already dismissed")
    document["dismissedSuggestions"].append(op["suggestion"])


def _restore_suggestion(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    index = _suggestion_index(document, op["suggestion"])
    if index is None:
        raise OpRefused("/suggestion", "not dismissed")
    del document["dismissedSuggestions"][index]


def _set_layout(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    document["layout"][op["item"]] = op["placement"]


def _remove_layout(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    if document["layout"].pop(op["item"], None) is None:
        raise OpRefused("/item", f"{op['item']!r} has no placement")


def _followed(document: Mapping[str, Any], occurrence_id: str) -> dict[str, Any]:
    occurrence = find(document, "occurrences", occurrence_id)
    if occurrence is None:
        raise OpRefused("/occurrence", f"no occurrence {occurrence_id!r}")
    source = occurrence["source"]
    if source["kind"] != "board" or source["track"]["kind"] != "followed":
        raise OpRefused("/occurrence", "the occurrence does not follow a branch")
    return source["track"]


def _advance_occurrence(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    _followed(document, op["occurrence"])["commit"] = op["commit"]


def _acknowledge_changes(document: dict[str, Any], op: dict[str, Any], **_: Any) -> None:
    track = _followed(document, op["occurrence"])
    track["reviewedCommit"] = track["commit"]


SEMANTIC = {
    "set-system-info": _set_system_info,
    "connect-harness": _connect_harness,
    "dismiss-suggestion": _dismiss_suggestion,
    "restore-suggestion": _restore_suggestion,
    "set-layout": _set_layout,
    "remove-layout": _remove_layout,
    "advance-occurrence": _advance_occurrence,
    "acknowledge-changes": _acknowledge_changes,
}
