"""Document-local rules the schema cannot state (docs/system-builder/CONTRACTS.md §1, §2, §7).

Run on the document a request produces, after its schema check. References
must resolve inside the document; whether a connector or pin exists on a
board is the system bundle's to report, never a refusal here.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Mapping, Optional

from app.system_builder.document import canonical_bytes, objects


@dataclass(frozen=True)
class Limits:
    """ADR open question 4, as settings (``PRISM_SYSTEM_*``)."""

    document_bytes: int = 4 * 1024 * 1024
    occurrences: int = 200
    connections: int = 2000
    harnesses: int = 200
    ends_per_harness: int = 64
    wires: int = 10000
    ops_per_request: int = 1000


class IntegrityError(ValueError):
    """The first broken rule, with a JSON pointer into the document."""

    def __init__(self, pointer: str, message: str) -> None:
        super().__init__(f"{pointer or '/'}: {message}")
        self.pointer = pointer
        self.message = message


def check(document: Mapping[str, Any], limits: Limits) -> None:
    """Raise :class:`IntegrityError` for the first rule the document breaks."""

    _ids(document)
    kinds = {item["id"]: collection for collection, _, item in objects(document)}
    occurrences = {item["id"]: item for item in document["occurrences"]}
    _sheets(document, kinds)
    _occurrences(document, kinds, occurrences)
    _sub_ports(document, occurrences)
    _body_connectors(document, occurrences)
    _body_sites(document, occurrences)
    _mates(document, occurrences)
    _harnesses(document, occurrences)
    for index, export in enumerate(document["exports"]):
        _endpoint(document, export["site"], occurrences, f"/exports/{index}/site")
    _layout(document, kinds)
    _limits(document, limits)


# Which layout fields each kind of object may carry (CONTRACTS.md §2.8).
_LAYOUT_FIELDS = {
    "occurrences": {"size", "ports", "interior"},
    "harnesses": {"size", "ports"},
    "sheets": {"size"},
    "mates": {"route"},
    "ends": {"route"},
}


def _layout(document: Mapping[str, Any], kinds: Mapping[str, str]) -> None:
    for key, placement in document["layout"].items():
        pointer = f"/layout/{_escape(key)}"
        allowed = _LAYOUT_FIELDS.get(kinds.get(key, ""))
        if allowed is None:
            raise IntegrityError(pointer, "names no occurrence, harness, sheet, mate or harness end")
        for field in ("size", "ports", "interior", "route"):
            if field in placement and field not in allowed:
                raise IntegrityError(f"{pointer}/{field}", f"a {kinds[key][:-1]} has no {field}")


def _escape(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def _ids(document: Mapping[str, Any]) -> None:
    counts = Counter(item["id"] for _, _, item in objects(document))
    repeated = sorted(object_id for object_id, count in counts.items() if count > 1)
    if repeated:
        raise IntegrityError("", f"id {repeated[0]!r} is used by more than one object")


def _need(kinds: Mapping[str, str], object_id: Optional[str], collection: str, pointer: str) -> None:
    if object_id is not None and kinds.get(object_id) != collection:
        raise IntegrityError(pointer, f"{object_id!r} is not in {collection}")


def _sheets(document: Mapping[str, Any], kinds: Mapping[str, str]) -> None:
    parents = {sheet["id"]: sheet.get("parent") for sheet in document["sheets"]}
    for index, sheet in enumerate(document["sheets"]):
        _need(kinds, sheet.get("parent"), "sheets", f"/sheets/{index}/parent")
        seen, current = {sheet["id"]}, sheet.get("parent")
        while current is not None:
            if current in seen:
                raise IntegrityError(f"/sheets/{index}/parent", "sheets form a cycle")
            seen.add(current)
            current = parents.get(current)
    for collection in ("occurrences", "harnesses"):
        for index, item in enumerate(document[collection]):
            _need(kinds, item.get("sheet"), "sheets", f"/{collection}/{index}/sheet")
    for key, placement in document["layout"].items():
        _need(kinds, placement.get("sheet"), "sheets", f"/layout/{_escape(key)}/sheet")


def _occurrences(document: Mapping[str, Any], kinds: Mapping[str, str], occurrences: Mapping[str, Any]) -> None:
    mates = {mate["id"]: mate for mate in document["mates"]}
    for index, occurrence in enumerate(document["occurrences"]):
        mate_id = occurrence.get("positioningMate")
        if mate_id is None:
            continue
        mate = mates.get(mate_id)
        if mate is None or occurrence["id"] not in (mate["a"]["occurrence"], mate["b"]["occurrence"]):
            raise IntegrityError(f"/occurrences/{index}/positioningMate", f"{mate_id!r} is not a mate of this occurrence")


def _occurrence(occurrences: Mapping[str, Any], occurrence_id: str, pointer: str) -> Mapping[str, Any]:
    occurrence = occurrences.get(occurrence_id)
    if occurrence is None:
        raise IntegrityError(pointer, f"no occurrence {occurrence_id!r}")
    return occurrence


def _endpoint(document: Mapping[str, Any], endpoint: Mapping[str, Any], occurrences: Mapping[str, Any], pointer: str) -> None:
    _occurrence(occurrences, endpoint["occurrence"], f"{pointer}/occurrence")
    ref = endpoint.get("subPort")
    if ref and ref["kind"] == "occurrence":
        sub_port = next((item for item in document["subPorts"] if item["id"] == ref["id"]), None)
        if sub_port is None:
            raise IntegrityError(f"{pointer}/subPort", f"no sub-port {ref['id']!r}")
        if (sub_port["occurrence"], sub_port["connector"]) != (endpoint["occurrence"], endpoint["connector"]):
            raise IntegrityError(f"{pointer}/subPort", "the sub-port belongs to another connector")


def _sub_ports(document: Mapping[str, Any], occurrences: Mapping[str, Any]) -> None:
    for index, sub_port in enumerate(document["subPorts"]):
        _occurrence(occurrences, sub_port["occurrence"], f"/subPorts/{index}/occurrence")
        if len(set(sub_port["pins"])) != len(sub_port["pins"]):
            raise IntegrityError(f"/subPorts/{index}/pins", "a pin is listed twice")
    for index, item in enumerate(document["dismissedSuggestions"]):
        _occurrence(occurrences, item["occurrence"], f"/dismissedSuggestions/{index}/occurrence")


def _body_connectors(document: Mapping[str, Any], occurrences: Mapping[str, Any]) -> None:
    seen: set[tuple[str, str]] = set()
    for index, connector in enumerate(document["bodyConnectors"]):
        occurrence = _occurrence(occurrences, connector["occurrence"], f"/bodyConnectors/{index}/occurrence")
        if occurrence["source"]["kind"] != "body":
            raise IntegrityError(f"/bodyConnectors/{index}/occurrence", "connectors are placed only on bodies")
        key = (connector["occurrence"], connector["refdes"])
        if key in seen:
            raise IntegrityError(f"/bodyConnectors/{index}/refdes", f"{connector['refdes']!r} is used twice on this body")
        seen.add(key)


def _body_sites(document: Mapping[str, Any], occurrences: Mapping[str, Any]) -> None:
    """A body's connectors are its body connectors, so every reference to one must resolve here."""

    placed = {(item["occurrence"], item["refdes"]) for item in document["bodyConnectors"]}

    def need(site: Mapping[str, Any] | None, pointer: str) -> None:
        if not site:
            return
        occurrence = occurrences.get(site["occurrence"])
        if occurrence is not None and occurrence["source"]["kind"] == "body" and (site["occurrence"], site["connector"]) not in placed:
            raise IntegrityError(pointer, f"the body has no connector {site['connector']!r}")

    for collection in ("subPorts", "dismissedSuggestions"):
        for index, item in enumerate(document[collection]):
            need(item, f"/{collection}/{index}/connector")
    for index, mate in enumerate(document["mates"]):
        need(mate["a"], f"/mates/{index}/a")
        need(mate["b"], f"/mates/{index}/b")
    for index, export in enumerate(document["exports"]):
        need(export["site"], f"/exports/{index}/site")
    for h, harness in enumerate(document["harnesses"]):
        for e, end in enumerate(harness["ends"]):
            need(end.get("site"), f"/harnesses/{h}/ends/{e}/site")
        for li, link in enumerate(harness["links"]):
            need(link["a"], f"/harnesses/{h}/links/{li}/a")
            need(link["b"], f"/harnesses/{h}/links/{li}/b")


def _mates(document: Mapping[str, Any], occurrences: Mapping[str, Any]) -> None:
    for index, mate in enumerate(document["mates"]):
        for side in ("a", "b"):
            _occurrence(occurrences, mate[side]["occurrence"], f"/mates/{index}/{side}/occurrence")
        if mate["a"]["occurrence"] == mate["b"]["occurrence"]:
            raise IntegrityError(f"/mates/{index}", "a mate joins two occurrences")
        pairs = mate.get("manualMap")
        if pairs is not None:
            for side in ("a", "b"):
                pads = [pair[side] for pair in pairs]
                if len(set(pads)) != len(pads):
                    raise IntegrityError(f"/mates/{index}/manualMap", f"a pad on side {side} is mapped twice")


def _harnesses(document: Mapping[str, Any], occurrences: Mapping[str, Any]) -> None:
    owner: dict[tuple[str, str], str] = {}
    for h, harness in enumerate(document["harnesses"]):
        base = f"/harnesses/{h}"
        local = {
            collection: {item["id"] for item in harness[collection]}
            for collection in ("ends", "links", "wires", "splices", "branchPoints", "segments", "looseEnds")
        }
        sites: dict[tuple[str, str], str] = {}
        for e, end in enumerate(harness["ends"]):
            site = end.get("site")
            if not site:
                continue
            _occurrence(occurrences, site["occurrence"], f"{base}/ends/{e}/site/occurrence")
            key = (site["occurrence"], site["connector"])
            if key in sites:
                raise IntegrityError(f"{base}/ends/{e}/site", "one mating site is one end")
            if key in owner and owner[key] != harness["id"]:
                raise IntegrityError(f"{base}/ends/{e}/site", f"the connector already belongs to harness {owner[key]!r}")
            sites[key] = end["id"]
            owner[key] = harness["id"]
        for li, link in enumerate(harness["links"]):
            for side in ("a", "b"):
                pointer = f"{base}/links/{li}/{side}"
                _endpoint(document, link[side], occurrences, pointer)
                if (link[side]["occurrence"], link[side]["connector"]) not in sites:
                    raise IntegrityError(pointer, "the connector is not an end of this harness")
        for w, wire in enumerate(harness["wires"]):
            for side in ("from", "to"):
                terminal, pointer = wire[side], f"{base}/wires/{w}/{side}"
                target = {"contact": ("ends", "end"), "splice": ("splices", "splice"), "loose": ("looseEnds", "looseEnd")}
                collection, key = target[terminal["kind"]]
                if terminal[key] not in local[collection]:
                    raise IntegrityError(pointer, f"no {key} {terminal[key]!r} in this harness")
            if "link" in wire and wire["link"] not in local["links"]:
                raise IntegrityError(f"{base}/wires/{w}/link", f"no link {wire['link']!r} in this harness")
            for r, segment_id in enumerate(wire["route"]):
                if segment_id not in local["segments"]:
                    raise IntegrityError(f"{base}/wires/{w}/route/{r}", f"no segment {segment_id!r} in this harness")
        for s, segment in enumerate(harness["segments"]):
            for side in ("from", "to"):
                node = segment[side]
                collection, key = ("ends", "end") if node["kind"] == "end" else ("branchPoints", "branchPoint")
                if node[key] not in local[collection]:
                    raise IntegrityError(f"{base}/segments/{s}/{side}", f"no {key} {node[key]!r} in this harness")
        for collection, field, target in (("coverings", "segment", "segments"), ("waypoints", "segment", "segments"), ("markers", "wire", "wires")):
            for i, item in enumerate(harness[collection]):
                if item[field] not in local[target]:
                    raise IntegrityError(f"{base}/{collection}/{i}/{field}", f"no {field} {item[field]!r} in this harness")
        for c, cable in enumerate(harness["cables"]):
            for k, conductor in enumerate(cable["conductors"]):
                if "wire" in conductor and conductor["wire"] not in local["wires"]:
                    raise IntegrityError(f"{base}/cables/{c}/conductors/{k}/wire", f"no wire {conductor['wire']!r} in this harness")


def _limits(document: Mapping[str, Any], limits: Limits) -> None:
    size = len(canonical_bytes(document))
    if size > limits.document_bytes:
        raise IntegrityError("", f"the document is {size} bytes; the limit is {limits.document_bytes}")
    counts = {
        "occurrences": (len(document["occurrences"]), limits.occurrences),
        "mates and links": (len(document["mates"]) + sum(len(h["links"]) for h in document["harnesses"]), limits.connections),
        "harnesses": (len(document["harnesses"]), limits.harnesses),
        "wires": (sum(len(h["wires"]) for h in document["harnesses"]), limits.wires),
    }
    for what, (count, limit) in counts.items():
        if count > limit:
            raise IntegrityError("", f"{count} {what}; the limit is {limit}")
    for h, harness in enumerate(document["harnesses"]):
        if len(harness["ends"]) > limits.ends_per_harness:
            raise IntegrityError(f"/harnesses/{h}/ends", f"{len(harness['ends'])} ends; the limit is {limits.ends_per_harness}")
