"""Link ends (CONTRACTS §5, §8.1; CONTRACTS_P2 §6.1, §16.2, §17.2, §22.2): the rules and the harness-end view.

Pure rules on a link's two ends. Each raises the store's typed error with the message the API has
always answered, or answers a question about rows the caller already read:

* ``request_problem`` — a create request names exactly one of ``portKey``/``exportId`` per end, and
  not one port twice (the API checks this before any row is read);
* ``same_port`` / ``check_distinct`` — both ends on one port of one instance;
* ``check_type`` — the link type and the b2b-only stack height;
* ``check_subport`` — a ``subportId`` is a sub-port of the end's connector;
* ``check_whole_connector`` — a b2b link never mates part of a connector exported from a subsystem;
* ``exported`` / ``refuse_exported`` — the export whose target is a port (a linked port cannot be
  exported, an exported port cannot be linked);
* ``linked`` — a link end uses a port;
* ``end_pads`` — the pads a link end may use on a split connector.

Harness ends seen as links. Drift, reviews, renames and reconcile treat a mated harness end like a
link end (P2 §17.2). The store hands them a link-shaped view (``end_as_link``) whose ID is the end's
own ID; ``is_harness_end`` is the only place that tells the two apart, and only the store's link
methods (``store_links``) call it.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, NamedTuple, Optional, Sequence

from app.services.systems.store_base import HARNESS_END_PREFIX, Conflict, Invalid

TYPES = ("unspecified", "b2b")

ONE_KEY = "each link end takes exactly one of portKey or exportId"
SAME_PORT = "both link ends are the same port"
NOT_A_SUBPORT = "subportId is not a sub-port of this connector"
EXPORTED = "export_port_linked: this port is exported; delete or retarget the export first"
SPLIT_EXPORT = ("port_split: this export is part of a connector in its subsystem; a board-to-board link mates "
                "a whole connector")


class End(NamedTuple):
    """One end of a link: an instance, a port key (a board port, or an export of an assembly) and the
    sub-port it uses on a split connector (None for a whole connector or the remainder)."""

    instance_id: str
    port_key: str
    subport_id: Optional[str] = None


# ---------------------------------------------------------------------------
# End rules


def same_port(a: End, b: End) -> bool:
    """Both ends name one port of one instance. Sub-ports are not compared: two ends of one split
    connector on one instance count as the same port (today's rule in the API, the store and CSV)."""
    return a.instance_id == b.instance_id and a.port_key == b.port_key


def check_distinct(a: End, b: End) -> None:
    if same_port(a, b):
        raise Invalid(SAME_PORT)


def request_problem(ends: Sequence[Mapping[str, Any]]) -> Optional[str]:
    """What is wrong with a create request's ``[{instanceId, portKey?, exportId?}, …]`` ends, or None."""
    for end in ends:
        if (end.get("portKey") is None) == (end.get("exportId") is None):
            return ONE_KEY
    a, b = (End(end["instanceId"], end.get("portKey") or end.get("exportId") or "") for end in ends)
    return SAME_PORT if same_port(a, b) else None


def check_type(link_type: str, stack_height_mm: Optional[float]) -> None:
    """§16.2: the type is known; only a b2b link has a stack height, between 0 and 1000 mm."""
    if link_type not in TYPES:
        raise Invalid(f"type must be one of {', '.join(TYPES)}")
    if stack_height_mm is not None:
        if link_type != "b2b":
            raise Invalid("stackHeightMm applies to board-to-board links only")
        if not (0 < float(stack_height_mm) < 1000):
            raise Invalid("stackHeightMm must be between 0 and 1000 mm")


def check_subport(subports: Iterable[Mapping[str, Any]], instance_id: str, port: Mapping[str, Any],
                  subport_id: Optional[str]) -> None:
    """P2 §22.2: an end (or an export) on a sub-port names one of its connector's sub-ports."""
    from app.services.systems import subports as subports_module  # the store imports this module

    if subport_id is not None and subport_id not in {
            s["id"] for s in subports_module.on_connector(subports, instance_id, port)}:
        raise Invalid(NOT_A_SUBPORT)


def check_whole_connector(component: Optional[Mapping[str, Any]]) -> None:
    """P2 §22.2: a b2b link never mates an export that is part of a split connector in its subsystem."""
    if component and (component.get("export") or {}).get("subport"):
        raise Conflict(SPLIT_EXPORT)


def exported(exports: Iterable[Mapping[str, Any]], end: End) -> Optional[dict]:
    """The export whose target is this end's port: a board port by portKey, or a child export (re-export).
    On a split connector each sub-port and the remainder (``subport_id`` None) count apart (P2 §22.2)."""
    for export in exports:
        if export["target_instance_id"] != end.instance_id or export.get("target_subport_id") != end.subport_id:
            continue
        port = export["target_port"]
        if (port and port["portKey"] == end.port_key) or export["target_export_id"] == end.port_key:
            return dict(export)
    return None


def refuse_exported(export: Optional[Mapping[str, Any]]) -> None:
    """P2 §4.1 rule 8: an exported port cannot be an end of a link or a harness end."""
    if export is not None:
        raise Conflict(EXPORTED)


def linked(links: Iterable[Mapping[str, Any]], end: End) -> bool:
    """A link end uses this port (and, on a split connector, this sub-port or the remainder)."""
    return any(
        link[f"{side}_instance_id"] == end.instance_id and link[f"{side}_port"]["portKey"] == end.port_key
        and link.get(f"{side}_subport_id") == end.subport_id
        for link in links for side in ("a", "b")
    )


def end_pads(link: Mapping[str, Any], side: str, pins: Mapping[str, Any],
             subports: Iterable[Mapping[str, Any]]) -> set[str]:
    """The pads a link end may use (§22.2): its sub-port's, the remainder's, or every pad."""
    from app.services.systems import subports as subports_module

    found = subports_module.on_connector(subports, link[f"{side}_instance_id"], link[f"{side}_port"])
    return subports_module.end_pads(pins, found, link.get(f"{side}_subport_id")) if found else set(pins)


# ---------------------------------------------------------------------------
# Harness ends as links (§17.2 drift)


def is_harness_end(link_id: str) -> bool:
    """The ID is a harness end's, standing in for a link in drift and review plumbing."""
    return link_id.startswith(HARNESS_END_PREFIX)


def end_pad(end: Mapping[str, Any], pin: str) -> str:
    """The mated connector pad a harness end pin maps to (``pinMap`` null = identity)."""
    return str((end.get("pin_map") or {}).get(pin, pin))


def end_as_link(harness: Mapping[str, Any], end: Mapping[str, Any]) -> dict:
    """A mated harness end as a one-ended link: its wires are the rows, the end's pads their A pins."""
    rows = []
    for wire in harness["wires"]:
        for side in ("from", "to"):
            if wire[f"{side}_end"] == end["id"]:
                rows.append({"id": wire["id"], "pin_a": end_pad(end, wire[f"{side}_pin"]), "pin_b": "",
                             "net_a": list(wire[f"net_{side}"]), "net_b": [], "signal": wire["signal"],
                             "source": "manual"})
    return {"id": end["id"], "system_id": harness["system_id"], "name": f"{harness['name']} end {end['ordinal'] + 1}",
            "harness": harness["label"], "type": "harness_end", "stack_height_mm": None,
            "a_instance_id": end["mates_instance_id"], "a_port": end["mates_port"],
            "b_instance_id": None, "b_port": None, "rows": rows, "updated_at": harness["updated_at"]}
