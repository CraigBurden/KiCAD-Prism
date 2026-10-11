"""Harness rules that need no database (CONTRACTS_P2 §17).

An end's *pins* are the harness-side names of its mating block. While the
block is Generic they are the mated connector's pads; ``pinMap`` sends an end
pin to a different pad (null = identity). Wires join end pins; their net
baselines are the nets of the pads those pins map to, captured like row nets.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import exposure, system_nets
from app.services.systems.drift import pad_sort_key
from app.services.systems.store import Invalid, SystemStore

Component = Optional[Mapping[str, Any]]


PART_SUMMARY = ("name", "mpn", "manufacturer")


def part_ref(end: Mapping[str, Any]) -> Optional[dict]:
    """The end's block part as documents and manifests show it: IDs plus the summary kept at assignment."""
    if not end["catalog_component_id"]:
        return None
    summary = end.get("part_summary") or {}
    return {"componentId": end["catalog_component_id"], "revisionId": end["catalog_revision_id"],
            **{k: summary.get(k) for k in PART_SUMMARY}}


def contact_ref(end: Mapping[str, Any]) -> Optional[dict]:
    """The end's contact part (§26.1), shaped like ``part_ref``."""
    if not end.get("contact_component_id"):
        return None
    summary = end.get("contact_summary") or {}
    return {"componentId": end["contact_component_id"], "revisionId": end["contact_revision_id"],
            **{k: summary.get(k) for k in PART_SUMMARY}}


def covering_docs(harness: Mapping[str, Any]) -> list[dict]:
    """The harness's coverings (§26.1) as documents show them."""
    return [{"segmentId": c["segmentId"], "part": c.get("part"), "description": c.get("description") or ""}
            for c in harness.get("coverings") or []]


def end_pins(end: Mapping[str, Any], component: Component) -> list[str]:
    """The end's pin names, natural order: the assigned part's pins (SB2-18), else the connector's pads."""
    if end.get("part_pins") is not None:
        return sorted({str(p) for p in end["part_pins"]}, key=pad_sort_key)
    if component is None:
        names = {str(n) for n in range(1, int(end["pin_count"]) + 1)}
    else:
        names = set(exposure.pins_by_pad(component))
    names |= set((end.get("pin_map") or {}).keys())
    return sorted(names, key=pad_sort_key)


def pin_facts(end: Mapping[str, Any], component: Component, *, include_missing: bool = False) -> dict[str, dict]:
    """``end pin -> facts of the pad it maps to`` (nets, names); empty facts while unmated.

    A pin that lands on a pad the connector does not have is left out, or with ``include_missing``
    kept with no nets and ``missing: True`` (a part's extra pin before it is remapped, SYS-V19).
    """
    pads = exposure.pins_by_pad(component) if component is not None else {}
    out = {}
    for pin in end_pins(end, component):
        pad = SystemStore.end_pad(end, pin)
        if component is not None and pad not in pads:
            if include_missing:
                out[pin] = {"pad": pad, "nets": [], "missing": True}
            continue
        out[pin] = dict(pads.get(pad) or {"pad": pad, "nets": []})
    return out


def capture(wires: Sequence[Mapping[str, Any]], ends: Mapping[str, Mapping[str, Any]],
            components: Mapping[str, Component]) -> list[dict]:
    """Validate end pins and capture ``netFrom``/``netTo`` at the mated baselines (§17.2)."""
    facts = {end_id: pin_facts(end, components.get(end_id), include_missing=True) for end_id, end in ends.items()}
    out = []
    for wire in wires:
        item = dict(wire)
        for side, column in (("from", "netFrom"), ("to", "netTo")):
            point = wire.get(side) or {}
            end_id, pin = point.get("end"), str(point.get("pin") or "")
            if end_id not in ends:
                raise Invalid("every wire joins two ends of this harness")
            if pin not in facts[end_id]:
                raise Invalid(f"pin {pin} does not exist on end {ends[end_id]['ordinal'] + 1}")
            item[column] = sorted(set(facts[end_id][pin].get("nets") or []))
        out.append(item)
    return out


def wires_from_rows(link: Mapping[str, Any], end_a: str, end_b: str) -> list[dict]:
    """A link's rows as wires between two ends with identity pin maps (row ID kept in ``label``)."""
    return [{"from": {"end": end_a, "pin": row["pin_a"]}, "to": {"end": end_b, "pin": row["pin_b"]},
             "signal": row["signal"], "label": row["id"], "netFrom": list(row["net_a"]), "netTo": list(row["net_b"])}
            for row in sorted(link["rows"], key=lambda r: (pad_sort_key(r["pin_a"]), pad_sort_key(r["pin_b"])))]


def is_linkable(harness: Mapping[str, Any]) -> bool:
    """§16.1: two ends, identity pin maps, and no end pin carrying two wires."""
    if len(harness["ends"]) != 2 or any(end.get("pin_map") for end in harness["ends"]):
        return False
    used = [(w[f"{side}_end"], w[f"{side}_pin"]) for w in harness["wires"] for side in ("from", "to")]
    return len(used) == len(set(used))


def end_components(harness: Mapping[str, Any], interfaces: Mapping[str, Any]) -> dict[str, Component]:
    """``end ID -> mated component`` (None when it no longer resolves) from ``interfaces`` by instance.
    Ends whose interface is missing (not extracted yet), and unmated ends, are left out."""
    out: dict[str, Component] = {}
    for end in harness["ends"]:
        if not end["mates_instance_id"] or not end["mates_port"]:
            continue
        interface = interfaces.get(end["mates_instance_id"])
        if interface is None:
            continue
        out[end["id"]] = exposure.component_by_key(interface, end["mates_port"]["portKey"])
    return out


def findings(harness: Mapping[str, Any], components: Mapping[str, Component],
             overrides: Mapping[str, Mapping[str, str]], optional_rules: Sequence[str],
             finding) -> list[dict]:
    """§17.2 validation for one harness: V01, V03, V04 per end and wire, V09 (opt-in) and V10 per wire.

    ``finding`` is ``validation._finding``; harness findings carry ``harnessId``/``endId``/``wireId``
    in ``detail`` and the wire ID as ``rowId`` so the UI can place them.
    """
    out: list[dict] = []
    ends = {end["id"]: end for end in harness["ends"]}
    for end in harness["ends"]:
        if not end["mates_instance_id"] or end["id"] not in components:
            continue  # unmated, or its board's interface is not extracted yet (not evaluated)
        component = components[end["id"]]
        common = {"instance_id": end["mates_instance_id"], "reference": (end["mates_port"] or {}).get("reference"),
                  "detail": {"harnessId": harness["id"], "endId": end["id"]}}
        override = (overrides.get(end["mates_instance_id"]) or {}).get((component or {}).get("portKey"))
        if component is None or not exposure.is_exposed(component, override):
            out.append(finding("SYS-V03", **common))
            continue
        pads = exposure.pins_by_pad(component)
        for pin, pad in sorted((end.get("pin_map") or {}).items()):
            if pad not in pads:
                out.append(finding("SYS-V04", **{**common, "pin": pad}))
        if end.get("part_pins") is not None and len(end["part_pins"]) != len(pads):
            mapped = set((end.get("pin_map") or {}).keys())
            wired = {w[f"{side}_pin"] for w in harness["wires"] for side in ("from", "to") if w[f"{side}_end"] == end["id"]}
            unmapped = sorted(wired - mapped, key=pad_sort_key)
            if unmapped:  # SYS-V19 (§18.1): the part and the connector differ and wired pins are not remapped
                out.append(finding("SYS-V19", **{**common, "detail": {**common["detail"], "partPins": len(end["part_pins"]),
                                                                       "connectorPins": len(pads), "unmapped": unmapped}}))
    seen: dict[frozenset, str] = {}
    for wire in harness["wires"]:
        key = frozenset({(wire["from_end"], wire["from_pin"]), (wire["to_end"], wire["to_pin"])})
        # SB2-112: the wire's place, so each wire's finding keeps its own key (a waiver covers one wire).
        side = lambda end_id: ends[end_id].get("mates_port") or {}  # noqa: E731
        place = {"instance_id": ends[wire["from_end"]]["mates_instance_id"], "reference": side(wire["from_end"]).get("reference"),
                 "pin": wire["from_pin"]}
        detail = {"harnessId": harness["id"], "wireId": wire["id"], "pinB": wire["to_pin"],
                  "referenceB": side(wire["to_end"]).get("reference")}
        if key in seen:
            out.append(finding("SYS-V01", row_id=wire["id"], **place, detail={**detail, "duplicateOf": seen[key]}))
        seen.setdefault(key, wire["id"])
        net_from, net_to = list(wire["net_from"]), list(wire["net_to"])
        if system_nets.name_mismatch(net_from, net_to):  # every system since D-P2-57
            out.append(finding("SYS-V09", row_id=wire["id"], **place, detail={**detail, "netA": net_from, "netB": net_to}))
        power = []
        for side in ("from", "to"):
            end, component = ends[wire[f"{side}_end"]], components.get(wire[f"{side}_end"])
            pad = SystemStore.end_pad(end, wire[f"{side}_pin"])
            power.append((exposure.pins_by_pad(component).get(pad) or {}).get("powerNet") if component else None)
        known = all(components.get(wire[f"{side}_end"]) for side in ("from", "to"))
        named_side = system_nets.net_meets_none(net_from, net_to) if known else None
        if named_side:  # SYS-V23 only where both ends' interfaces are known
            out.append(finding("SYS-V23", row_id=wire["id"], **place,
                               detail={**detail, "namedSide": "from" if named_side == "a" else "to",
                                       "netA": net_from, "netB": net_to}))
        if system_nets.power_meets_signal(power[0], net_from, power[1], net_to):
            out.append(finding("SYS-V10", row_id=wire["id"], **place,
                               detail={**detail, "powerSide": "from" if power[0] else "to", "netA": net_from, "netB": net_to}))
    return out
