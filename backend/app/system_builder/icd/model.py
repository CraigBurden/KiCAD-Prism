"""The interface control document's model (CONTRACTS.md §17): what the ICD outputs read.

One pure function of the document and the viewer's (redacted) system bundle, so
the PDF, the HTML and the CSV cannot disagree. Three sections:

- **interfaces**: the system's exports, each pin with its interface name and net;
- **connections**: every pin-to-pin connection, a B2B mate's pairs and each
  harness wire end to end (a splice joins its contacts, a loose end ends one);
- **system nets**: the nets that join pins on more than one occurrence.

A restricted board keeps its label; the bundle it came from already carries no
pins or nets for it (§6), so its rows read "restricted".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.system_builder.harness_outputs import model as harness_model

RESTRICTED = "restricted"


@dataclass(frozen=True)
class Occurrence:
    id: str
    label: str
    kind: str  # "board" | "entry" | "body" | "redacted"
    #: Where it comes from: the project and commit, a catalog part, or "restricted".
    source: str


@dataclass(frozen=True)
class Pin:
    """One side of a connection."""

    occurrence: str  # label
    connector: str
    pad: str
    name: str = ""  # the pin's name (export pin name, board pin name)
    net: str = ""  # the board net on that side, or the system net


@dataclass(frozen=True)
class InterfacePin:
    pad: str
    name: str
    net: str


@dataclass(frozen=True)
class Interface:
    name: str
    site: str  # "<connector> · <occurrence label>" (· sub-port)
    pins: tuple[InterfacePin, ...]


@dataclass(frozen=True)
class Connection:
    """A pin-to-pin row; ``via`` names what carries it."""

    group: str  # the mate or harness it belongs to, as a heading
    kind: str  # "b2b" | "harness"
    a: Pin
    b: Pin
    via: str = ""  # "W3", "W3 · SP1 · W5", "mated"
    detail: str = ""  # gauge · colour · length for a harness wire
    note: str = ""  # "names differ", "open end (pigtail)"


@dataclass(frozen=True)
class SystemNet:
    name: str
    board_nets: tuple[str, ...]  # "<occurrence label>: <net>"
    pins: tuple[str, ...]  # "<occurrence label> <connector>.<pad>"


@dataclass(frozen=True)
class IcdModel:
    system: str
    version: int
    bundle_key: str
    occurrences: tuple[Occurrence, ...]
    interfaces: tuple[Interface, ...]
    connections: tuple[Connection, ...]
    nets: tuple[SystemNet, ...]
    #: Nets left out because they stay on one occurrence.
    local_nets: int


# ------------------------------------------------------------------ helpers


def _source(item: Mapping[str, Any], project_names: Mapping[str, str], lookup: harness_model.PartLookup) -> tuple[str, str]:
    source = item.get("source") or {}
    kind = str(source.get("kind") or "board")
    if kind == "board":
        track = source.get("track") or {}
        commit = str(track.get("commit") or "")[:10]
        project = project_names.get(str(source.get("projectId") or ""), str(source.get("projectId") or ""))
        how = f"follows {track.get('branch')}" if track.get("kind") == "followed" else "pinned"
        return kind, f"{project} @ {commit} ({how})"
    if kind in ("entry", "body"):
        reference = str(source.get("componentId") or "")
        if source.get("revisionId"):
            reference += f"@{source['revisionId']}"
        part = lookup(reference)
        return kind, f"catalog {part.label}" + (f" · {part.name}" if part.name != part.label else "") if part else f"catalog {reference[:8]}"
    return "redacted", RESTRICTED


def _pins(bundle: Mapping[str, Any]) -> dict[tuple[str, str], dict[str, Mapping[str, Any]]]:
    """(occurrence id, refdes) → pad → pin, from the bundle's connectors."""

    out: dict[tuple[str, str], dict[str, Mapping[str, Any]]] = {}
    for occurrence in bundle.get("occurrences") or []:
        for connector in occurrence.get("connectors") or []:
            out[(occurrence["occurrence"], connector["refdes"])] = {
                str(pin["pad"]): pin for pin in connector.get("pins") or []
            }
    return out


def _system_nets(bundle: Mapping[str, Any]) -> dict[tuple[str, str, str], str]:
    """(occurrence id, refdes, pad) → system net name."""

    out: dict[tuple[str, str, str], str] = {}
    for net in bundle.get("nets") or []:
        for pin in net.get("pins") or []:
            out[(pin["occurrence"], pin["connector"], str(pin["pad"]))] = str(net.get("name") or net["id"])
    return out


# -------------------------------------------------------------------- build


def build(
    document: Mapping[str, Any],
    bundle: Mapping[str, Any],
    *,
    system: str = "",
    version: int = 0,
    bundle_key: str = "",
    project_names: Mapping[str, str] | None = None,
    lookup: harness_model.PartLookup = lambda _: None,
) -> IcdModel:
    project_names = project_names or {}
    labels = {item["id"]: str(item.get("label") or item["id"]) for item in document.get("occurrences") or []}
    occurrences = []
    for item in document.get("occurrences") or []:
        kind, source = _source(item, project_names, lookup)
        occurrences.append(Occurrence(item["id"], labels[item["id"]], kind, source))
    pins = _pins(bundle)
    nets = _system_nets(bundle)

    redacted = {item.id for item in occurrences if item.kind == "redacted"}

    def pin(occurrence: str, connector: str, pad: str, name: str = "") -> Pin:
        board_pin = pins.get((occurrence, connector), {}).get(pad)
        label = labels.get(occurrence, occurrence)
        if occurrence in redacted:
            return Pin(label, connector, pad, RESTRICTED, "")
        return Pin(
            label,
            connector,
            pad,
            name or str((board_pin or {}).get("pinName") or ""),
            str((board_pin or {}).get("net") or nets.get((occurrence, connector, pad), "")),
        )

    return IcdModel(
        system=system or str(document.get("name") or ""),
        version=version,
        bundle_key=bundle_key,
        occurrences=tuple(occurrences),
        interfaces=_interfaces(document, labels, pins, nets),
        connections=(*_mated(document, bundle, labels, pin), *_harnessed(document, bundle, pin)),
        nets=tuple(
            SystemNet(
                name=str(net.get("name") or net["id"]),
                board_nets=tuple(
                    f"{labels.get(item['occurrence'], item['occurrence'])}: {item['net']}"
                    for item in net.get("boardNets") or []
                ),
                pins=tuple(
                    f"{labels.get(item['occurrence'], item['occurrence'])} {item['connector']}.{item['pad']}"
                    for item in net.get("pins") or []
                ),
            )
            for net in _crossing(bundle)
        ),
        local_nets=len(bundle.get("nets") or []) - len(_crossing(bundle)),
    )


def _crossing(bundle: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return [
        net for net in bundle.get("nets") or []
        if len({item["occurrence"] for item in net.get("pins") or []}) > 1
    ]


def _site(labels: Mapping[str, str], endpoint: Mapping[str, Any], sub_ports: Mapping[str, str]) -> str:
    site = f"{endpoint.get('connector')} · {labels.get(endpoint.get('occurrence', ''), endpoint.get('occurrence', ''))}"
    sub = endpoint.get("subPort") or {}
    if sub.get("id") and sub_ports.get(str(sub["id"])):
        site += f" · {sub_ports[str(sub['id'])]}"
    return site


def _interfaces(
    document: Mapping[str, Any],
    labels: Mapping[str, str],
    pins: Mapping[tuple[str, str], Mapping[str, Mapping[str, Any]]],
    nets: Mapping[tuple[str, str, str], str],
) -> tuple[Interface, ...]:
    sub_ports = {item["id"]: str(item.get("name") or item["id"]) for item in document.get("subPorts") or []}
    sub_pins = {item["id"]: [str(pad) for pad in item.get("pins") or []] for item in document.get("subPorts") or []}
    out = []
    for export in document.get("exports") or []:
        site = export.get("site") or {}
        key = (str(site.get("occurrence") or ""), str(site.get("connector") or ""))
        board = pins.get(key, {})
        sub = (site.get("subPort") or {}).get("id")
        pads = sub_pins.get(str(sub), []) if sub else sorted(board, key=harness_model.natural_key)
        names = export.get("pinNames") or {}
        out.append(
            Interface(
                name=str(export.get("name") or export["id"]),
                site=_site(labels, site, sub_ports),
                pins=tuple(
                    InterfacePin(
                        pad,
                        str(names.get(pad) or (board.get(pad) or {}).get("pinName") or ""),
                        nets.get((key[0], key[1], pad), str((board.get(pad) or {}).get("net") or "")),
                    )
                    for pad in pads
                ),
            )
        )
    return tuple(out)


def _differ(a: Pin, b: Pin) -> str:
    """A note when both sides have a net and their leaf names differ."""

    return "net names differ" if a.net and b.net and harness_model.leaf(a.net) != harness_model.leaf(b.net) else ""


def _mated(
    document: Mapping[str, Any],
    bundle: Mapping[str, Any],
    labels: Mapping[str, str],
    pin: Any,
) -> list[Connection]:
    derived = {item["mate"]: item for item in bundle.get("mates") or []}
    out = []
    for mate in document.get("mates") or []:
        a, b = mate.get("a") or {}, mate.get("b") or {}
        group = f"{a.get('connector')} · {labels.get(a.get('occurrence', ''), '')} ↔ {b.get('connector')} · {labels.get(b.get('occurrence', ''), '')}"
        pairs = (derived.get(mate["id"]) or {}).get("pairs") or mate.get("manualMap") or []
        rows = mate.get("rows") or {}
        for pair in sorted(pairs, key=lambda item: harness_model.natural_key(str(item["a"]))):
            left = pin(a.get("occurrence", ""), a.get("connector", ""), str(pair["a"]))
            right = pin(b.get("occurrence", ""), b.get("connector", ""), str(pair["b"]))
            signal = str((rows.get(str(pair["a"])) or {}).get("signal") or "")
            out.append(Connection(group, "b2b", left, right, "mated", signal, _differ(left, right)))
    return out


def _harnessed(document: Mapping[str, Any], bundle: Mapping[str, Any], pin: Any) -> list[Connection]:
    out: list[Connection] = []
    sites = {
        end["id"]: end.get("site") or {}
        for harness in document.get("harnesses") or [] for end in harness.get("ends") or []
    }
    for harness in document.get("harnesses") or []:
        model = harness_model.build(document, bundle, harness["id"], lambda _: None)
        if model is None:
            continue
        group = f"Harness {model.label}"

        def side(terminal: harness_model.Terminal) -> Pin:
            site = sites.get(terminal.node) or {}
            pad = terminal.pad or terminal.cavity
            return pin(site.get("occurrence", ""), site.get("connector", ""), pad)

        def detail(wires: Sequence[harness_model.Wire]) -> str:
            parts = []
            for wire in wires:
                bits = [f"{wire.gauge_awg} AWG" if wire.gauge_awg else "", harness_model.colour_text(wire.colour),
                        f"{wire.length_nm / 1e6:.0f} mm" if wire.length_nm is not None else ""]
                parts.append(" ".join(bit for bit in bits if bit))
            return " / ".join(part for part in parts if part)

        # Contact-to-contact wires are one row each.
        for wire in model.wires:
            if wire.source.kind == "contact" and wire.target.kind == "contact":
                left, right = side(wire.source), side(wire.target)
                out.append(Connection(group, "harness", left, right, wire.number, detail([wire]), _differ(left, right)))
        # A splice joins its contacts: the first to each of the others, through it.
        for node in model.nodes:
            reaching = [
                (wire, wire.source if wire.target.kind != "contact" else wire.target)
                for wire in model.wires
                if wire.number in node.wires and "contact" in (wire.source.kind, wire.target.kind)
            ]
            if node.kind == "splice":
                for (first, first_end), (other, other_end) in ((reaching[0], item) for item in reaching[1:]):
                    left, right = side(first_end), side(other_end)
                    out.append(Connection(group, "harness", left, right, f"{first.number} · {node.name} · {other.number}",
                                          detail([first, other]), _differ(left, right)))
            else:
                for wire, end in reaching:
                    loose = Pin(node.name, "", "", node.kind, "")
                    out.append(Connection(group, "harness", side(end), loose, wire.number, detail([wire]),
                                          f"open end ({node.kind})"))
    return out
