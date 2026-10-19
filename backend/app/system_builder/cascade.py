"""What a removal takes with it (docs/system-builder/CONTRACTS.md §3.2, "Cascade on remove").

Each function removes one object from the document, in place, and then what
depended on it, recursively. Nothing here validates: the operation already
found the object, and the integrity check runs on the final document.
"""

from __future__ import annotations

from typing import Any, Callable, Mapping, Optional

from app.system_builder.document import find

Document = dict[str, Any]


def _drop(items: list[dict[str, Any]], keep: Callable[[Mapping[str, Any]], bool]) -> list[dict[str, Any]]:
    """Remove the items ``keep`` rejects, in place; return them."""

    gone = [item for item in items if not keep(item)]
    items[:] = [item for item in items if keep(item)]
    return gone


def _on(endpoint: Optional[Mapping[str, Any]], occurrence: str, connector: Optional[str] = None) -> bool:
    if not endpoint or endpoint.get("occurrence") != occurrence:
        return False
    return connector is None or endpoint.get("connector") == connector


def _uses_sub_port(endpoint: Mapping[str, Any], sub_port_id: str) -> bool:
    ref = endpoint.get("subPort")
    return bool(ref) and ref.get("kind") == "occurrence" and ref.get("id") == sub_port_id


# ------------------------------------------------------------------ top level


def remove_sheet(document: Document, sheet_id: str) -> None:
    sheet = find(document, "sheets", sheet_id)
    parent = sheet.get("parent") if sheet else None
    _drop(document["sheets"], lambda item: item["id"] != sheet_id)

    def move(item: dict[str, Any], key: str) -> None:
        if item.get(key) == sheet_id:
            if parent:
                item[key] = parent
            else:
                item.pop(key, None)

    for child in document["sheets"]:
        move(child, "parent")
    for item in document["occurrences"] + document["harnesses"]:
        move(item, "sheet")
    for placement in document["layout"].values():
        move(placement, "sheet")
    document["layout"].pop(sheet_id, None)


def remove_occurrence(document: Document, occurrence_id: str) -> None:
    _drop(document["occurrences"], lambda item: item["id"] != occurrence_id)
    for sub_port in _drop(document["subPorts"], lambda item: item["occurrence"] != occurrence_id):
        _unname_sub_port(document, sub_port["id"])
    _drop(document["dismissedSuggestions"], lambda item: item["occurrence"] != occurrence_id)
    _drop(document["bodyConnectors"], lambda item: item["occurrence"] != occurrence_id)
    _remove_site_users(document, occurrence_id, None)
    document["layout"].pop(occurrence_id, None)


def remove_sub_port(document: Document, sub_port_id: str) -> None:
    _drop(document["subPorts"], lambda item: item["id"] != sub_port_id)
    _unname_sub_port(document, sub_port_id)


def _unname_sub_port(document: Document, sub_port_id: str) -> None:
    """Endpoints that named the sub-port fall back to the whole connector."""

    endpoints = [export["site"] for export in document["exports"]]
    for harness in document["harnesses"]:
        for link in harness["links"]:
            endpoints += [link["a"], link["b"]]
    for endpoint in endpoints:
        if _uses_sub_port(endpoint, sub_port_id):
            endpoint.pop("subPort")


def remove_body_connector(document: Document, body_connector_id: str) -> None:
    gone = _drop(document["bodyConnectors"], lambda item: item["id"] != body_connector_id)
    for connector in gone:
        occurrence, refdes = connector["occurrence"], connector["refdes"]
        for sub_port in _drop(
            document["subPorts"], lambda item: not (item["occurrence"] == occurrence and item["connector"] == refdes)
        ):
            _unname_sub_port(document, sub_port["id"])
        _drop(
            document["dismissedSuggestions"],
            lambda item: not (item["occurrence"] == occurrence and item["connector"] == refdes),
        )
        _remove_site_users(document, occurrence, refdes)


def _remove_site_users(document: Document, occurrence: str, connector: Optional[str]) -> None:
    """Mates, links and exports on the occurrence (or one of its connectors); ends there lose their site."""

    for mate in _drop(
        document["mates"], lambda item: not (_on(item["a"], occurrence, connector) or _on(item["b"], occurrence, connector))
    ):
        _forget_mate(document, mate["id"])
    _drop(document["exports"], lambda item: not _on(item["site"], occurrence, connector))
    for harness in document["harnesses"]:
        for link in list(harness["links"]):
            if _on(link["a"], occurrence, connector) or _on(link["b"], occurrence, connector):
                remove_harness_item(document, harness["id"], "links", link["id"])
        for end in harness["ends"]:
            if _on(end.get("site"), occurrence, connector):
                end.pop("site")


def remove_mate(document: Document, mate_id: str) -> None:
    _drop(document["mates"], lambda item: item["id"] != mate_id)
    _forget_mate(document, mate_id)


def _forget_mate(document: Document, mate_id: str) -> None:
    for occurrence in document["occurrences"]:
        if occurrence.get("positioningMate") == mate_id:
            occurrence.pop("positioningMate")


def remove_harness(document: Document, harness_id: str) -> None:
    _drop(document["harnesses"], lambda item: item["id"] != harness_id)
    document["layout"].pop(harness_id, None)


def remove_simple(document: Document, collection: str, object_id: str) -> None:
    """Exports and waivers: nothing depends on them."""

    _drop(document[collection], lambda item: item["id"] != object_id)
    document["layout"].pop(object_id, None)


TOP_LEVEL: dict[str, Callable[[Document, str], None]] = {
    "sheets": remove_sheet,
    "occurrences": remove_occurrence,
    "subPorts": remove_sub_port,
    "bodyConnectors": remove_body_connector,
    "mates": remove_mate,
    "harnesses": remove_harness,
    "exports": lambda document, object_id: remove_simple(document, "exports", object_id),
    "waivers": lambda document, object_id: remove_simple(document, "waivers", object_id),
}


# ------------------------------------------------------------ harness contents


def _harness(document: Document, harness_id: str) -> dict[str, Any]:
    harness = find(document, "harnesses", harness_id)
    if harness is None:
        raise LookupError(harness_id)
    return harness


def _terminal_is(terminal: Mapping[str, Any], kind: str, key: str, object_id: str) -> bool:
    return terminal.get("kind") == kind and terminal.get(key) == object_id


def _node_is(node: Mapping[str, Any], kind: str, key: str, object_id: str) -> bool:
    return node.get("kind") == kind and node.get(key) == object_id


def remove_harness_item(document: Document, harness_id: str, collection: str, object_id: str) -> None:
    harness = _harness(document, harness_id)
    gone = _drop(harness[collection], lambda item: item["id"] != object_id)
    if not gone:
        return
    item = gone[0]

    def remove(kind: str, ids: list[str]) -> None:
        for dependent in ids:
            remove_harness_item(document, harness_id, kind, dependent)

    if collection == "ends":
        site = item.get("site")
        if site:
            remove("links", [
                link["id"] for link in harness["links"]
                if _on(link["a"], site["occurrence"], site["connector"]) or _on(link["b"], site["occurrence"], site["connector"])
            ])
        remove("wires", [
            wire["id"] for wire in harness["wires"]
            if _terminal_is(wire["from"], "contact", "end", object_id) or _terminal_is(wire["to"], "contact", "end", object_id)
        ])
        remove("segments", [
            segment["id"] for segment in harness["segments"]
            if _node_is(segment["from"], "end", "end", object_id) or _node_is(segment["to"], "end", "end", object_id)
        ])
    elif collection == "links":
        remove("wires", [wire["id"] for wire in harness["wires"] if wire.get("link") == object_id])
    elif collection == "wires":
        remove("markers", [marker["id"] for marker in harness["markers"] if marker["wire"] == object_id])
        for cable in harness["cables"]:
            for conductor in cable["conductors"]:
                if conductor.get("wire") == object_id:
                    conductor.pop("wire")
    elif collection == "splices":
        remove("wires", [
            wire["id"] for wire in harness["wires"]
            if _terminal_is(wire["from"], "splice", "splice", object_id) or _terminal_is(wire["to"], "splice", "splice", object_id)
        ])
    elif collection == "looseEnds":
        remove("wires", [
            wire["id"] for wire in harness["wires"]
            if _terminal_is(wire["from"], "loose", "looseEnd", object_id) or _terminal_is(wire["to"], "loose", "looseEnd", object_id)
        ])
    elif collection == "branchPoints":
        remove("segments", [
            segment["id"] for segment in harness["segments"]
            if _node_is(segment["from"], "branch-point", "branchPoint", object_id)
            or _node_is(segment["to"], "branch-point", "branchPoint", object_id)
        ])
    elif collection == "segments":
        remove("coverings", [covering["id"] for covering in harness["coverings"] if covering["segment"] == object_id])
        remove("waypoints", [waypoint["id"] for waypoint in harness["waypoints"] if waypoint["segment"] == object_id])
        for wire in harness["wires"]:
            if object_id in wire["route"]:
                wire["route"] = []

