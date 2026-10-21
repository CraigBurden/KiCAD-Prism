"""The harness output model (CONTRACTS.md §16.7): what every harness output reads.

One pure function of the document, the viewer's (redacted) system bundle and a
catalog part lookup, so the drawing, the CSVs and ``prism.harness.v1`` cannot
disagree. Wires are numbered ``W1…`` in wire-list order sorted by their
terminals; a wire's length is its typed ``lengthNm`` when set, else its 3D route
length (§16.6), else unknown.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence

#: IEC 60757 colour codes by the names people type (WireViz's set).
COLOUR_CODES: dict[str, str] = {
    "black": "BK", "brown": "BN", "red": "RD", "orange": "OG", "yellow": "YE", "green": "GN",
    "blue": "BU", "violet": "VT", "purple": "VT", "grey": "GY", "gray": "GY", "white": "WH",
    "pink": "PK", "turquoise": "TQ", "gold": "GD", "silver": "SR",
}


@dataclass(frozen=True)
class Part:
    """A catalog part as the outputs name it."""

    reference: str
    name: str
    mpn: str = ""
    manufacturer: str = ""
    description: str = ""

    @property
    def label(self) -> str:
        return self.mpn or self.name


PartLookup = Callable[[str], "Part | None"]


@dataclass(frozen=True)
class Cavity:
    cavity: str
    pad: str
    signal: str
    net: str = ""
    contact: Part | None = None
    #: Numbers of the wires landing in this cavity.
    wires: tuple[str, ...] = ()
    #: The reference the contact was read by, kept even when the catalog cannot resolve it.
    contact_reference: str = ""


@dataclass(frozen=True)
class End:
    id: str
    #: ``<refdes> · <occurrence label>``, or the id when the end has no site.
    title: str
    #: The board connector's value and MPN.
    connector: str
    housing: Part | None
    housing_reference: str
    ways: int
    cavities: tuple[Cavity, ...]


@dataclass(frozen=True)
class Terminal:
    kind: str  # "contact" | "splice" | "loose"
    node: str  # the end, splice or loose end id
    cavity: str = ""
    pad: str = ""


@dataclass(frozen=True)
class Wire:
    number: str
    id: str
    origin: str
    source: Terminal
    target: Terminal
    gauge_awg: str = ""
    colour: str = ""
    label: str = ""
    net: str = ""
    cable: str = ""
    conductor: str = ""
    length_nm: int | None = None
    typed_length: bool = False


@dataclass(frozen=True)
class Segment:
    id: str
    source: str  # route node: an end id, a branch point id or ``auto``
    target: str
    wires: tuple[str, ...]  # wire numbers
    length_nm: int
    diameter_nm: int
    coverings: tuple[str, ...] = ()


@dataclass(frozen=True)
class Node:
    """A splice or loose end, drawn as a leaf of the bundle."""

    id: str
    kind: str  # "splice" | "pigtail" | "test-point" | "open"
    name: str  # SP1… / LE1…
    detail: str
    wires: tuple[str, ...]


@dataclass(frozen=True)
class Conductor:
    name: str
    wire: str = ""  # its wire's number
    drain: bool = False


@dataclass(frozen=True)
class Cable:
    id: str
    label: str
    part: Part | None
    part_reference: str
    conductors: tuple[Conductor, ...]


@dataclass(frozen=True)
class Covering:
    id: str
    segment: str
    kind: str
    part: Part | None
    part_reference: str


@dataclass(frozen=True)
class BomRow:
    item: int
    kind: str
    part: str
    manufacturer: str
    description: str
    quantity: str
    where: str


@dataclass(frozen=True)
class HarnessModel:
    system: str
    system_version: int
    harness: str
    label: str
    ends: tuple[End, ...]
    wires: tuple[Wire, ...]
    nodes: tuple[Node, ...]
    #: The route's segments, empty when the harness has no route.
    segments: tuple[Segment, ...]
    #: Route node id → display name (ends by title, branch points ``B1…``).
    node_names: Mapping[str, str]
    bom: tuple[BomRow, ...]
    routed: bool
    bundle_key: str = ""
    findings: tuple[str, ...] = field(default=())
    cables: tuple[Cable, ...] = ()
    coverings: tuple[Covering, ...] = ()


# ------------------------------------------------------------------ helpers


def natural_key(value: str) -> tuple[Any, ...]:
    """``2`` before ``10``; ``A2`` before ``A10``."""

    return tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", str(value)) if part != "")


def leaf(net: str) -> str:
    return net[net.rfind("/") + 1:] if net else ""


def colour_codes(colour: str) -> list[str]:
    """``red/white`` → ``["RD", "WH"]``; empty when any part is not a known name."""

    parts = [part for part in re.split(r"[/\-\s]+", colour.strip().lower()) if part]
    codes = [COLOUR_CODES.get(part) for part in parts]
    return [code for code in codes if code] if parts and all(codes) else []


def colour_text(colour: str) -> str:
    codes = colour_codes(colour)
    return "".join(codes) if codes else colour


def _reference(value: Mapping[str, Any] | str | None) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    component = str(value.get("componentId") or "")
    revision = value.get("revisionId")
    return f"{component}@{revision}" if revision else component


def _mm(nm: int) -> str:
    return f"{nm / 1e6:.0f} mm"


# -------------------------------------------------------------------- build


def build(
    document: Mapping[str, Any],
    bundle: Mapping[str, Any],
    harness_id: str,
    lookup: PartLookup,
    *,
    system: str = "",
    version: int = 0,
    bundle_key: str = "",
) -> HarnessModel | None:
    """The model of one harness, or None when the document has no such harness."""

    harness = next((item for item in document.get("harnesses") or [] if item.get("id") == harness_id), None)
    if harness is None:
        return None
    built = next((item for item in bundle.get("harnesses") or [] if item.get("harness") == harness_id), None) or {}
    parts: dict[str, Part | None] = {}

    def part(reference: str) -> Part | None:
        if not reference:
            return None
        if reference not in parts:
            parts[reference] = lookup(reference)
        return parts[reference]

    labels = {item["id"]: item.get("label") or item["id"] for item in document.get("occurrences") or []}
    net_names = {net["id"]: net.get("name") or net["id"] for net in bundle.get("nets") or []}
    connectors = {
        (occurrence["occurrence"], connector["refdes"]): connector
        for occurrence in bundle.get("occurrences") or []
        for connector in occurrence.get("connectors") or []
    }
    own_wires = {wire["id"]: wire for wire in harness.get("wires") or []}
    route = built.get("route") or None
    route_lengths = {item["wire"]: item.get("lengthNm") for item in (route or {}).get("wires") or []}

    wires = _wires(harness, built, own_wires, route_lengths, net_names)
    numbers = {wire.id: wire.number for wire in wires}
    ends = _ends(harness, built, labels, connectors, net_names, wires, part)
    nodes = _nodes(harness, wires)
    segments, names = _segments(harness, route, numbers, ends)
    bom = _bom(harness, ends, wires, nodes, part)
    findings = tuple(
        f"{finding.get('severity', '')}: {finding.get('message', '')}"
        for finding in bundle.get("findings") or []
        if harness_id in (finding.get("objects") or [])
    )
    return HarnessModel(
        system=system or str(document.get("name") or ""),
        system_version=version,
        harness=harness_id,
        label=str(harness.get("label") or harness_id),
        ends=ends,
        wires=wires,
        nodes=nodes,
        segments=segments,
        node_names=names,
        bom=bom,
        routed=bool(segments),
        bundle_key=bundle_key,
        findings=findings,
        cables=tuple(
            Cable(
                id=str(cable["id"]),
                label=str(cable.get("label") or cable["id"]),
                part=part(_reference(cable.get("part"))),
                part_reference=_reference(cable.get("part")),
                conductors=tuple(
                    Conductor(str(item.get("name") or ""), numbers.get(str(item.get("wire") or ""), ""), bool(item.get("drain")))
                    for item in cable.get("conductors") or []
                ),
            )
            for cable in harness.get("cables") or []
        ),
        coverings=tuple(
            Covering(
                id=str(covering["id"]),
                segment=str(covering.get("segment") or ""),
                kind=str(covering.get("kind") or ""),
                part=part(_reference(covering.get("part"))),
                part_reference=_reference(covering.get("part")),
            )
            for covering in harness.get("coverings") or []
        ),
    )


def _terminal(raw: Mapping[str, Any]) -> Terminal:
    kind = str(raw.get("kind") or "contact")
    if kind == "splice":
        return Terminal("splice", str(raw.get("splice") or ""))
    if kind == "loose":
        return Terminal("loose", str(raw.get("looseEnd") or ""))
    return Terminal("contact", str(raw.get("end") or ""), str(raw.get("cavity") or ""), str(raw.get("pad") or ""))


def _wires(
    harness: Mapping[str, Any],
    built: Mapping[str, Any],
    own_wires: Mapping[str, Mapping[str, Any]],
    route_lengths: Mapping[str, int | None],
    net_names: Mapping[str, str],
) -> tuple[Wire, ...]:
    listed = built.get("wires")
    if listed is None:  # no wire list yet: the document's explicit wires
        listed = [{**wire, "origin": "explicit"} for wire in harness.get("wires") or []]
    end_order = {end["id"]: index for index, end in enumerate(harness.get("ends") or [])}
    node_order = {
        item["id"]: index
        for index, item in enumerate([*(harness.get("splices") or []), *(harness.get("looseEnds") or [])])
    }

    def key(raw: Mapping[str, Any]) -> tuple[Any, ...]:
        def side(terminal: Terminal) -> tuple[Any, ...]:
            if terminal.kind == "contact":
                return (0, end_order.get(terminal.node, 999), natural_key(terminal.cavity))
            return (1, node_order.get(terminal.node, 999), ())

        return (*side(_terminal(raw["from"])), *side(_terminal(raw["to"])))

    out = []
    for index, raw in enumerate(sorted(listed, key=key), 1):
        own = own_wires.get(raw["id"]) or {}
        typed = own.get("lengthNm")
        routed = raw.get("routeLengthNm", route_lengths.get(raw["id"]))
        length = typed if typed is not None else routed
        out.append(
            Wire(
                number=f"W{index}",
                id=str(raw["id"]),
                origin=str(raw.get("origin") or "explicit"),
                source=_terminal(raw["from"]),
                target=_terminal(raw["to"]),
                gauge_awg=str(raw.get("gaugeAwg") or ""),
                colour=str(raw.get("colour") or ""),
                label=str(raw.get("label") or ""),
                net=net_names.get(str(raw.get("net") or ""), str(raw.get("net") or "")),
                cable=str(raw.get("cable") or ""),
                conductor=str(raw.get("conductor") or ""),
                length_nm=int(length) if length is not None else None,
                typed_length=typed is not None,
            )
        )
    return tuple(out)


def _ends(
    harness: Mapping[str, Any],
    built: Mapping[str, Any],
    labels: Mapping[str, str],
    connectors: Mapping[tuple[str, str], Mapping[str, Any]],
    net_names: Mapping[str, str],
    wires: Sequence[Wire],
    part: Callable[[str], Part | None],
) -> tuple[End, ...]:
    resolved = {item["end"]: item for item in built.get("ends") or []}
    landing: dict[tuple[str, str], list[str]] = {}
    for wire in wires:
        for terminal in (wire.source, wire.target):
            if terminal.kind == "contact":
                landing.setdefault((terminal.node, terminal.cavity), []).append(wire.number)
    out = []
    for end in harness.get("ends") or []:
        site = end.get("site") or {}
        info = resolved.get(end["id"]) or {}
        connector = connectors.get((site.get("occurrence", ""), site.get("connector", ""))) or {}
        pins = {pin["pad"]: pin for pin in connector.get("pins") or []}
        housing_reference = str(info.get("housing") or _reference(end.get("housing")))
        cavities = []
        used = info.get("cavities")
        if used is None:  # no wire list yet: the cavities wires reach
            used = [
                {"cavity": cavity, "pad": cavity}
                for (node, cavity) in landing
                if node == end["id"]
            ]
        for item in sorted(used, key=lambda value: natural_key(str(value["cavity"]))):
            pad = str(item.get("pad") or item["cavity"])
            pin = pins.get(pad) or {}
            net = net_names.get(str(item.get("net") or ""), "")
            signal = leaf(str(pin.get("net") or "")) or leaf(net) or str(pin.get("pinName") or "")
            contact_reference = str(item.get("contact") or _reference((end.get("contacts") or {}).get(item["cavity"])))
            cavities.append(
                Cavity(
                    cavity=str(item["cavity"]),
                    pad=pad,
                    signal=signal,
                    net=net,
                    contact=part(contact_reference),
                    wires=tuple(landing.get((end["id"], str(item["cavity"])), ())),
                    contact_reference=contact_reference,
                )
            )
        value = str(connector.get("value") or "")
        mpn = str(connector.get("mpn") or "")
        out.append(
            End(
                id=str(end["id"]),
                title=f"{site['connector']} · {labels.get(site['occurrence'], site['occurrence'])}" if site else str(end["id"]),
                connector=" · ".join(item for item in (value, mpn if mpn != value else "") if item),
                housing=part(housing_reference),
                housing_reference=housing_reference,
                ways=len(pins),
                cavities=tuple(cavities),
            )
        )
    return tuple(out)


def _nodes(harness: Mapping[str, Any], wires: Sequence[Wire]) -> tuple[Node, ...]:
    def landing(kind: str, node: str) -> tuple[str, ...]:
        return tuple(
            wire.number for wire in wires
            if any(t.kind == kind and t.node == node for t in (wire.source, wire.target))
        )

    out = []
    for index, splice in enumerate(harness.get("splices") or [], 1):
        out.append(Node(splice["id"], "splice", f"SP{index}", str(splice.get("method") or "crimp"), landing("splice", splice["id"])))
    for index, loose in enumerate(harness.get("looseEnds") or [], 1):
        detail = str(loose.get("label") or "")
        if loose.get("lengthNm") is not None:
            detail = " · ".join(item for item in (detail, _mm(int(loose["lengthNm"]))) if item)
        out.append(Node(loose["id"], str(loose.get("kind") or "open"), f"LE{index}", detail, landing("loose", loose["id"])))
    return tuple(out)


def _segments(
    harness: Mapping[str, Any],
    route: Mapping[str, Any] | None,
    numbers: Mapping[str, str],
    ends: Sequence[End],
) -> tuple[tuple[Segment, ...], dict[str, str]]:
    names = {end.id: end.title for end in ends}
    if not route:
        return (), names
    covered: dict[str, list[str]] = {}
    for covering in harness.get("coverings") or []:
        covered.setdefault(str(covering.get("segment")), []).append(str(covering.get("kind") or "covering"))
    breakouts = 0
    out = []
    for raw in route.get("segments") or []:
        for node in (raw["from"], raw["to"]):
            if node not in names:
                breakouts += 1
                names[node] = f"B{breakouts}"
        out.append(
            Segment(
                id=str(raw["id"]),
                source=str(raw["from"]),
                target=str(raw["to"]),
                wires=tuple(numbers[wire] for wire in raw.get("wires") or [] if wire in numbers),
                length_nm=int(raw.get("lengthNm") or 0),
                diameter_nm=int(raw.get("diameterNm") or 0),
                coverings=tuple(covered.get(str(raw["id"]), ())),
            )
        )
    return tuple(out), names


def _bom(
    harness: Mapping[str, Any],
    ends: Sequence[End],
    wires: Sequence[Wire],
    nodes: Sequence[Node],
    part: Callable[[str], Part | None],
) -> tuple[BomRow, ...]:
    rows: list[tuple[str, str, str, str, str, str]] = []

    def grouped(kind: str, items: Sequence[tuple[str, Part | None, str]], unit: str = "") -> None:
        """``(reference, part, where)`` grouped by reference, in first-seen order."""

        order: list[str] = []
        where: dict[str, list[str]] = {}
        found: dict[str, Part | None] = {}
        for reference, resolved, place in items:
            if reference not in where:
                order.append(reference)
                where[reference] = []
                found[reference] = resolved
            where[reference].append(place)
        for reference in order:
            resolved = found[reference]
            places = where[reference]
            rows.append((
                kind,
                resolved.label if resolved else "not in the catalog" if reference else "not chosen",
                resolved.manufacturer if resolved else "",
                (resolved.description or resolved.name) if resolved else "",
                f"{len(places)}{unit}",
                ", ".join(dict.fromkeys(places)),
            ))

    grouped("Housing", [(end.housing_reference, end.housing, end.title) for end in ends if end.housing_reference])
    grouped(
        "Contact",
        [
            (cavity.contact_reference, cavity.contact, end.title)
            for end in ends for cavity in end.cavities if cavity.contact_reference
        ],
    )
    by_kind: dict[tuple[str, str], list[Wire]] = {}
    for wire in wires:
        by_kind.setdefault((wire.gauge_awg, wire.colour), []).append(wire)
    for (gauge, colour), group in by_kind.items():
        known = [wire.length_nm for wire in group if wire.length_nm is not None]
        quantity = (
            f"{sum(known) / 1e6:,.0f} mm".replace(",", " ")
            if len(known) == len(group) else f"{len(group)} wires"
        )
        rows.append((
            "Wire",
            " · ".join((f"{gauge} AWG" if gauge else "gauge not set", colour_text(colour) or "no colour")),
            "",
            "",
            quantity,
            " ".join(wire.number for wire in group),
        ))
    for cable in harness.get("cables") or []:
        reference = _reference(cable.get("part"))
        grouped("Cable", [(reference, part(reference), str(cable.get("label") or cable["id"]))])
    grouped(
        "Covering",
        [
            (_reference(covering.get("part")) or str(covering.get("kind")), part(_reference(covering.get("part"))), str(covering.get("segment")))
            for covering in harness.get("coverings") or []
        ],
    )
    splices = [node for node in nodes if node.kind == "splice"]
    for method in dict.fromkeys(node.detail for node in splices):
        group = [node for node in splices if node.detail == method]
        rows.append(("Splice", f"{method} splice", "", "", str(len(group)), " ".join(node.name for node in group)))
    markers = harness.get("markers") or []
    if markers:
        rows.append(("Marker", "wire label", "", "", str(len(markers)), ""))
    return tuple(BomRow(index, *row) for index, row in enumerate(rows, 1))
