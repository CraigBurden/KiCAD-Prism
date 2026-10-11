"""Connection CSV import (``docs/system-builder/CONTRACTS.md`` §9.3).

Three steps share this module:

* ``parse`` turns an upload into a header and data rows (upload);
* ``classify`` resolves every row against each instance's **baseline**
  interface and sorts it into the four buckets, first match wins
  (preview, and again under the lock at commit);
* ``apply_rows`` writes resolved rows into links, reusing a link with the
  same unordered port pair and harness or creating one (commit, and an
  ``import`` review once its accepted items are applied).

A row that names harness ends (``from_end``/``to_end``) is a harness wire
(CONTRACTS_P2 §17.4): its ``a_*``/``b_*`` columns name the connectors the
ends mate (empty for an unmated end) and ``from_end_pin``/``to_end_pin`` the
end pins. Wires find their harness by wire ID, else by name (``link_name``);
an unknown name creates a harness with Generic ends.

``classify`` is pure. ``apply_rows`` runs inside a caller's
``SystemStore.mutation``.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional, Sequence

from app.services.systems import exposure, harnesses as harnesses_module, links as link_rules, subports as subports_module
from app.services.systems.drift import pad_sort_key
from app.services.systems.store import MAX_HARNESS_ENDS, MAX_ROWS, Conflict, Invalid, Mutation, SystemStore

MAX_UPLOAD_BYTES = 5_000_000
SAMPLE_ROWS = 20
MAX_BOARD_VALUES = 100
DELIMITERS = (",", ";", "\t", "|")

ENDPOINT_TARGETS = ("from_board", "from_connector", "from_pin", "to_board", "to_connector", "to_pin")
WIRE_TARGETS = ("from_end", "from_end_pin", "to_end", "to_end_pin", "gauge_awg", "colour", "wire_label")
TARGETS = ENDPOINT_TARGETS + ("signal", "harness", "link_name", "row_id") + WIRE_TARGETS
SKIP = "skip"

BUCKETS = ("matched", "needsReview", "unresolved", "conflict")

# Header spellings suggested for each target; the §9.2 export columns first.
_ALIASES = {
    "from_board": ("a_board", "from_board", "board_a", "from"),
    "from_connector": ("a_connector", "from_connector", "connector_a", "a_ref", "from_ref", "from_reference"),
    "from_pin": ("a_pin", "from_pin", "pin_a"),
    "to_board": ("b_board", "to_board", "board_b", "to"),
    "to_connector": ("b_connector", "to_connector", "connector_b", "b_ref", "to_ref", "to_reference"),
    "to_pin": ("b_pin", "to_pin", "pin_b"),
    "signal": ("signal", "signal_name"),
    "harness": ("harness", "cable"),
    "link_name": ("link_name", "link"),
    "row_id": ("row_id",),
    "from_end": ("from_end",),
    "from_end_pin": ("from_end_pin",),
    "to_end": ("to_end",),
    "to_end_pin": ("to_end_pin",),
    "gauge_awg": ("gauge_awg", "awg", "gauge"),
    "colour": ("colour", "color", "wire_colour", "wire_color"),
    "wire_label": ("wire_label",),
}


# ---------------------------------------------------------------------------
# Upload


@dataclass(frozen=True)
class Parsed:
    delimiter: str
    columns: list[str]
    rows: list[tuple[int, dict[str, str]]]  # (source line, {column: value})


def _normalize_header(value: str) -> str:
    return re.sub(r"[\s\-]+", "_", value.strip().lower())


def decode(raw: bytes) -> str:
    if len(raw) > MAX_UPLOAD_BYTES:
        raise Invalid(f"limit import_bytes ({MAX_UPLOAD_BYTES})")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise Invalid("the CSV must be UTF-8") from None


def sniff_delimiter(text: str) -> str:
    header = text.split("\n", 1)[0]
    counts = {d: header.count(d) for d in DELIMITERS}
    best = max(DELIMITERS, key=lambda d: counts[d])
    return best if counts[best] else ","


def parse(text: str, delimiter: Optional[str] = None) -> Parsed:
    delimiter = delimiter or sniff_delimiter(text)
    if delimiter not in DELIMITERS:
        raise Invalid("delimiter must be one of , ; tab |")
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        raise Invalid("the CSV is empty") from None
    except csv.Error as error:
        raise Invalid(f"malformed CSV: {error}") from None
    columns = [name.strip() or f"column {i + 1}" for i, name in enumerate(header)]
    if len(set(columns)) != len(columns):
        raise Invalid("column names must be unique")
    rows = []
    try:
        for values in reader:
            if not any(v.strip() for v in values):
                continue
            if len(rows) >= MAX_ROWS:
                raise Invalid(f"limit import_rows ({MAX_ROWS})")
            values = (values + [""] * len(columns))[: len(columns)]
            rows.append((reader.line_num, {c: v.strip() for c, v in zip(columns, values)}))
    except csv.Error as error:
        raise Invalid(f"malformed CSV at line {reader.line_num}: {error}") from None
    return Parsed(delimiter, columns, rows)


def suggest_column_map(columns: Sequence[str]) -> dict[str, str]:
    by_name = {_normalize_header(c): c for c in columns}
    out = {}
    for target, aliases in _ALIASES.items():
        for alias in aliases:
            if alias in by_name:
                out[target] = by_name[alias]
                break
    return out


def summary(parsed: Parsed) -> dict:
    """What the upload response shows: columns, samples and per-column board candidates."""

    distinct: dict[str, set[str]] = {c: set() for c in parsed.columns}
    for _line, row in parsed.rows:
        for column, value in row.items():
            bucket = distinct[column]
            if value and len(bucket) <= MAX_BOARD_VALUES:
                bucket.add(value)
    return {
        "delimiter": parsed.delimiter,
        "rowCount": len(parsed.rows),
        "columns": list(parsed.columns),
        "sampleRows": [row for _line, row in parsed.rows[:SAMPLE_ROWS]],
        "suggestedColumnMap": suggest_column_map(parsed.columns),
        "boardValues": {c: sorted(v) for c, v in distinct.items() if v and len(v) <= MAX_BOARD_VALUES},
    }


def check_maps(parsed: Parsed, column_map: Mapping[str, str], board_map: Mapping[str, str],
               instance_ids: Iterable[str]) -> None:
    unknown = sorted(set(column_map) - set(TARGETS))
    if unknown:
        raise Invalid(f"unknown column map targets: {', '.join(unknown)}")
    missing = [t for t in ENDPOINT_TARGETS if not column_map.get(t)]
    if missing:
        raise Invalid(f"column map needs {', '.join(missing)}")
    absent = sorted({c for c in column_map.values() if c} - set(parsed.columns))
    if absent:
        raise Invalid(f"columns not in the upload: {', '.join(absent)}")
    known = set(instance_ids)
    bad = sorted({v for v in board_map.values() if v != SKIP and v not in known})
    if bad:
        raise Invalid(f"board map names instances not in this system: {', '.join(bad)}")


# ---------------------------------------------------------------------------
# Classification


def leaf(net: str) -> str:
    return net.rsplit("/", 1)[-1]


def _harness(value: Optional[str]) -> Optional[str]:
    return (value or "").strip() or None


def _port_matches(port: Mapping[str, Any], component: Mapping[str, Any]) -> bool:
    return bool(set(port.get("memberKeys") or [port["portKey"]]) & set(component.get("memberKeys") or []))


def find_link(links: Sequence[Mapping[str, Any]], ends: Sequence[tuple],
              harness: Optional[str]) -> Optional[tuple[dict, bool]]:
    """The link joining the two ``(instance_id, component-or-port[, subport_id])`` ends with ``harness``.

    Returns ``(link, swapped)``; ``swapped`` means the first end is the link's B end. On a split
    connector each sub-port and the remainder are ends of their own (P2 §22.2).
    """

    (ia, ca, sa), (ib, cb, sb) = ((*end, None)[:3] for end in ends)
    for link in sorted(links, key=lambda l: l["id"]):
        if _harness(link["harness"]) != harness:
            continue
        la = (link["a_instance_id"], link["a_port"], link.get("a_subport_id"))
        lb = (link["b_instance_id"], link["b_port"], link.get("b_subport_id"))
        if (la[0], la[2], lb[0], lb[2]) == (ia, sa, ib, sb) and _port_matches(la[1], ca) and _port_matches(lb[1], cb):
            return dict(link), False
        if (la[0], la[2], lb[0], lb[2]) == (ib, sb, ia, sa) and _port_matches(la[1], cb) and _port_matches(lb[1], ca):
            return dict(link), True
    return None


def _resolve_end(values: Mapping[str, str], side: str, board_map: Mapping[str, str],
                 instances: Mapping[str, Mapping[str, Any]], interfaces: Mapping[str, Optional[dict]],
                 overrides: Mapping[str, Mapping[str, str]],
                 subports: Sequence[Mapping[str, Any]] = ()) -> tuple[Optional[dict], Optional[str]]:
    board, reference, pad = (values.get(f"{side}_{k}", "") for k in ("board", "connector", "pin"))
    if not board or not reference or not pad:
        return None, "missing_value"
    target = board_map.get(board)
    if target is None:
        return None, "board_unmapped"
    if target == SKIP:
        return None, "board_skipped"
    interface = interfaces.get(target)
    if interface is None:
        return None, "interface_not_ready"
    connector, named = reference, None
    found = [c for c in interface.get("components") or [] if c.get("reference") == reference]
    if not found and "." in reference:  # "J6.PWR": a sub-port of J6 (P2 §22.5)
        connector, named = reference.rsplit(".", 1)
        found = [c for c in interface.get("components") or [] if c.get("reference") == connector]
    if not exposure.is_annotated(connector) or not found:
        return None, "connector_not_found"
    if len(found) > 1:
        return None, "connector_ambiguous"
    component = found[0]
    pins = exposure.pins_by_pad(component)
    if pad not in pins:
        return None, "pin_not_found"
    on = subports_module.on_connector(subports, target, component)
    subport_id = subports_module.owner(on, pad)  # "J6" names whichever end holds the pad
    if named is not None:
        wanted = next((sub for sub in on if sub["name"].casefold() == named.casefold()), None)
        if wanted is None:
            return None, "connector_not_found"
        if wanted["id"] != subport_id:
            return None, "pin_not_on_subport"
    override = (overrides.get(target) or {}).get(component["portKey"])
    return {
        "instanceId": target, "label": instances[target]["label"], "reference": reference,
        "subportId": subport_id,
        "portKey": component["portKey"], "port": exposure.port_baseline(component),
        "exposed": exposure.is_exposed(component, override), "pin": pad,
        "pinNames": pins[pad].get("pinNames"), "nets": sorted(set(pins[pad].get("nets") or [])),
    }, None


def classify(parsed: Parsed, column_map: Mapping[str, str], board_map: Mapping[str, str], *,
             instances: Mapping[str, Mapping[str, Any]], interfaces: Mapping[str, Optional[dict]],
             overrides: Mapping[str, Mapping[str, str]], links: Sequence[Mapping[str, Any]],
             harnesses: Sequence[Mapping[str, Any]] = (), subports: Sequence[Mapping[str, Any]] = ()) -> dict:
    """§9.3 buckets for every uploaded row, in upload order."""

    row_links = {row["id"]: link["id"] for link in links for row in link["rows"]}
    seen: set[tuple] = set()
    updated: set[str] = set()
    buckets: dict[str, list[dict]] = {b: [] for b in BUCKETS}
    wires = _WireState(harnesses, links, interfaces)

    for line, row in parsed.rows:
        values = {t: row.get(column_map[t], "") if column_map.get(t) else "" for t in TARGETS}
        if values["from_end"] or values["to_end"]:
            bucket, entry = wires.classify(line, values, board_map, instances, overrides)
            buckets[bucket].append(entry)
            continue
        entry: dict[str, Any] = {
            "line": line, "values": values, "reason": None, "from": None, "to": None,
            "signal": values["signal"], "harness": _harness(values["harness"]),
            "linkName": values["link_name"], "linkId": None, "rowId": None, "action": None,
        }

        def put(bucket: str, reason: Optional[str] = None) -> None:
            entry["reason"] = reason
            buckets[bucket].append(entry)

        ends = []
        reason = None
        for side in ("from", "to"):
            end, why = _resolve_end(values, side, board_map, instances, interfaces, overrides, subports)
            ends.append(end)
            reason = reason or why
        if reason:
            put("unresolved", reason)
            continue
        a, b = ends
        entry["from"], entry["to"] = a, b
        if link_rules.same_port(link_rules.End(a["instanceId"], a["portKey"]),
                                link_rules.End(b["instanceId"], b["portKey"])):
            put("conflict", "same_port")
            continue

        found = find_link(links, [(a["instanceId"], a["port"], a.get("subportId")),
                                  (b["instanceId"], b["port"], b.get("subportId"))], entry["harness"])
        ordered = sorted([(a["instanceId"], a["portKey"], a["pin"]), (b["instanceId"], b["portKey"], b["pin"])])
        key = (tuple(x[:2] for x in ordered), entry["harness"], tuple(x[2] for x in ordered))
        if found:
            link, swapped = found
            entry["linkId"] = link["id"]
            pin_a, pin_b = (b["pin"], a["pin"]) if swapped else (a["pin"], b["pin"])
            existing = {(r["pin_a"], r["pin_b"]): r["id"] for r in link["rows"]}
        else:
            pin_a = pin_b = None
            existing = {}

        row_id = values["row_id"] or None
        if row_id and row_id in row_links:
            if row_links[row_id] != entry["linkId"]:
                put("conflict", "row_in_other_link")
                continue
            taken = existing.get((pin_a, pin_b))
            if taken is not None and taken != row_id:
                put("conflict", "pin_pair_taken")
                continue
            if row_id in updated:
                put("conflict", "duplicate_upload")
                continue
            entry["rowId"], entry["action"] = row_id, "update"
        else:
            if (pin_a, pin_b) in existing:
                put("conflict", "duplicate_existing")
                continue
            entry["action"] = "create"
        if key in seen:
            put("conflict", "duplicate_upload")
            continue
        seen.add(key)
        if entry["rowId"]:
            updated.add(entry["rowId"])

        leaves = {leaf(n).casefold() for n in a["nets"] + b["nets"]}
        if not values["signal"]:
            entry["signal"] = leaf(a["nets"][0]) if a["nets"] else ""
            put("matched")
        elif values["signal"].casefold() in leaves:
            put("matched")
        else:
            put("needsReview", "signal_mismatch")
    return {"counts": {b: len(v) for b, v in buckets.items()}, **buckets}


# ---------------------------------------------------------------------------
# Application


def default_link_name(proposal: Mapping[str, Any]) -> str:
    a, b = proposal["from"], proposal["to"]
    return f"{a['label']}/{a['reference']} ↔ {b['label']}/{b['reference']}"


def baseline_interfaces(store: SystemStore, system_id: str) -> dict[str, Optional[dict]]:
    """Each instance's interface at its current baseline, or ``None`` while extracting."""

    from app.services.systems.interface_extractor import EXTRACTOR_VERSION

    return {i["id"]: store.get_interface(i["project_id"], i["baseline_commit"], EXTRACTOR_VERSION)
            for i in store.list_instances(system_id)}


def resolve_proposal(proposal: Mapping[str, Any], interfaces: Mapping[str, Optional[dict]]) -> list[dict]:
    """The two components a proposal names, re-read at the current baselines."""

    components = []
    for side in ("from", "to"):
        end = proposal[side]
        if end is None:  # an unmated harness end
            components.append(None)
            continue
        interface = interfaces.get(end["instanceId"])
        component = exposure.component_by_key(interface, end["portKey"]) if interface else None
        if component is None:
            raise Conflict(f"{end['label']}/{end['reference']} no longer resolves at its baseline")
        if end["pin"] not in exposure.pins_by_pad(component):
            raise Conflict(f"pad {end['pin']} no longer exists on {end['label']}/{end['reference']}")
        components.append(component)
    return components


def proposal(entry: Mapping[str, Any]) -> dict:
    """The part of a classified entry an ``import`` review item stores (``observed``)."""

    keys = ("line", "from", "to", "signal", "harness", "linkName", "linkId", "rowId", "action")
    if entry.get("kind") == "wire":
        keys += ("kind", "fromEnd", "fromPin", "toEnd", "toPin", "gaugeAwg", "colour", "wireLabel")
    return {k: entry[k] for k in keys}


def apply_rows(store: SystemStore, change: Mutation, proposals: Sequence[Mapping[str, Any]],
               interfaces: Mapping[str, Optional[dict]]) -> dict:
    """Write resolved rows (``classify`` entries or stored review proposals).

    Ports are re-read from each instance's **current** baseline interface, so a
    proposal whose pad has since disappeared is refused rather than written.
    A port that is not exposed is promoted, since creating a link needs it.
    """

    created, updated, unchanged, links_created = 0, 0, 0, []
    wire_report = apply_wires(store, change, [p for p in proposals if p.get("kind") == "wire"], interfaces)
    proposals = [p for p in proposals if p.get("kind") != "wire"]
    plans: dict[str, dict[str, Any]] = {}
    for proposal in proposals:
        components = resolve_proposal(proposal, interfaces)
        subports = store.list_subports(change.system_id)
        # The end holding each pad now (P2 §22.2): a sub-port carved since the preview takes its rows.
        ends = [(proposal[side]["instanceId"], component, subports_module.owner(
                    subports_module.on_connector(subports, proposal[side]["instanceId"], component),
                    proposal[side]["pin"]))
                for side, component in (("from", components[0]), ("to", components[1]))]
        harness = _harness(proposal.get("harness"))
        found = find_link(store.list_links(change.system_id), ends, harness)
        if found is None:
            for (instance_id, component, _subport) in ends:
                override = store.list_overrides(instance_id).get(component["portKey"])
                if not exposure.is_exposed(component, override):
                    store.set_override(change, instance_id, component["portKey"], "promoted")
            link = store.create_link(
                change, a_instance_id=ends[0][0], a_port=exposure.port_baseline(components[0]),
                b_instance_id=ends[1][0], b_port=exposure.port_baseline(components[1]),
                name=proposal.get("linkName") or default_link_name(proposal), harness=harness,
                a_subport_id=ends[0][2], b_subport_id=ends[1][2],
            )
            links_created.append(link["id"])
            swapped = False
        else:
            link, swapped = found
        plan = plans.setdefault(link["id"], {"updates": {}, "creates": []})
        a_side, b_side = (1, 0) if swapped else (0, 1)
        sides = (proposal["from"], proposal["to"])
        pins = [exposure.pins_by_pad(c) for c in components]
        row = {
            "pinA": sides[a_side]["pin"], "pinB": sides[b_side]["pin"], "signal": proposal["signal"],
            "netA": pins[a_side][sides[a_side]["pin"]].get("nets") or [],
            "netB": pins[b_side][sides[b_side]["pin"]].get("nets") or [],
            "source": "import",
        }
        if proposal.get("rowId"):
            plan["updates"][proposal["rowId"]] = row
        else:
            plan["creates"].append(row)

    for link_id, plan in plans.items():
        link = store.get_link(change.system_id, link_id)
        rows = []
        for current in link["rows"]:
            update = plan["updates"].pop(current["id"], None)
            same = update is not None and (update["pinA"], update["pinB"], update["signal"]) == (
                current["pin_a"], current["pin_b"], current["signal"])
            if update is not None and not same:
                rows.append({"id": current["id"], **update})
                updated += 1
            else:
                unchanged += int(same)
                rows.append({"id": current["id"], "pinA": current["pin_a"], "pinB": current["pin_b"],
                             "signal": current["signal"], "netA": current["net_a"], "netB": current["net_b"],
                             "source": current["source"]})
        if plan["updates"]:
            raise Conflict("a row this import updates no longer exists; re-run the preview")
        rows.extend(plan["creates"])
        created += len(plan["creates"])
        if not plan["creates"] and len(rows) == len(link["rows"]) and all(
                r["id"] == c["id"] and r["pinA"] == c["pin_a"] and r["pinB"] == c["pin_b"]
                and r["signal"] == c["signal"] for r, c in zip(rows, link["rows"])):
            continue  # nothing changes on this link: no write, no audit
        pairs = [(r["pinA"], r["pinB"]) for r in rows]
        if len(set(pairs)) != len(pairs):
            raise Conflict(f"link {link['name'] or link_id} would hold the same pin pair twice; re-run the preview")
        store.replace_rows(change, link_id, rows)
    return {"created": created + wire_report["created"], "updated": updated + wire_report["updated"],
            "unchanged": unchanged + wire_report["unchanged"], "linksCreated": links_created,
            "harnessesCreated": wire_report["harnessesCreated"]}


# ---------------------------------------------------------------------------
# Harness wires (CONTRACTS_P2 §17.4)


_END_LABEL = re.compile(r"^\s*end\s*(\d{1,2})\s*$", re.IGNORECASE)


def end_ordinal(label: str) -> Optional[int]:
    """``"End 3"`` → 2 (the ICD and CSV name ends by position)."""
    match = _END_LABEL.match(label or "")
    ordinal = int(match.group(1)) - 1 if match else -1
    return ordinal if 0 <= ordinal < MAX_HARNESS_ENDS else None


def _gauge(value: str) -> tuple[Optional[int], bool]:
    if not value:
        return None, True
    try:
        gauge = int(value)
    except ValueError:
        return None, False
    return gauge, 0 <= gauge <= 40


class _WireState:
    """What wire classification needs across rows: existing harnesses, and ends of harnesses the
    upload creates (the first row naming an end fixes its mate; the rows fix its pin map)."""

    def __init__(self, harnesses: Sequence[Mapping[str, Any]], links: Sequence[Mapping[str, Any]],
                 interfaces: Mapping[str, Optional[dict]]) -> None:
        self.harnesses = list(harnesses)
        self.by_wire = {w["id"]: h for h in self.harnesses for w in h["wires"]}
        self.interfaces = interfaces
        # Ports already mated by a harness end or a b2b link: (instance, portKey) -> harness ID or "b2b".
        self.mated: dict[tuple[str, str], str] = {}
        for harness in self.harnesses:
            for end in harness["ends"]:
                if end["mates_instance_id"] and end["mates_port"]:
                    self.mated[(end["mates_instance_id"], end["mates_port"]["portKey"])] = harness["id"]
        for link in links:
            if link.get("type") == "b2b":
                for side in ("a", "b"):
                    self.mated[(link[f"{side}_instance_id"], link[f"{side}_port"]["portKey"])] = "b2b"
        self.new_ends: dict[tuple[str, int], dict] = {}  # (harness name, ordinal) -> {mate, pins}
        self.seen: set[tuple] = set()
        self.updated: set[str] = set()

    def _harness(self, name: str, row_id: Optional[str]) -> tuple[Optional[dict], Optional[str]]:
        """``(existing harness or None to create, conflict reason)``."""
        if row_id and row_id in self.by_wire:
            harness = self.by_wire[row_id]
            if name and name != harness["name"]:
                return None, "wire_in_other_harness"
            return harness, None
        found = [h for h in self.harnesses if h["name"] == name]
        if len(found) > 1:
            return None, "harness_ambiguous"
        return (found[0] if found else None), None

    def _component(self, end: Mapping[str, Any]) -> Optional[dict]:
        interface = self.interfaces.get(end["mates_instance_id"]) if end["mates_instance_id"] else None
        return exposure.component_by_key(interface, end["mates_port"]["portKey"]) if interface else None

    def _existing_end(self, harness: Mapping[str, Any], ordinal: int, mate: Optional[dict],
                      pin: str) -> tuple[Optional[dict], Optional[tuple[str, str]]]:
        """The harness's end at ``ordinal``, checked against the row: ``(end, (bucket, reason))``."""
        end = next((e for e in harness["ends"] if e["ordinal"] == ordinal), None)
        if end is None:
            return None, ("conflict", "end_not_found")
        mated = end["mates_instance_id"] and end["mates_port"]
        if bool(mated) != (mate is not None) or (mate is not None and (
                end["mates_instance_id"] != mate["instanceId"]
                or not _port_matches(end["mates_port"], {"memberKeys": [mate["portKey"]]}))):
            return None, ("conflict", "end_mate_mismatch")
        if pin not in harnesses_module.end_pins(end, self._component(end) if mated else None):
            return None, ("unresolved", "pin_not_found")
        if mate is not None and link_rules.end_pad(end, pin) != mate["pin"]:
            return None, ("conflict", "pin_map_mismatch")
        return end, None

    def _new_end(self, name: str, ordinal: int, mate: Optional[dict], pin: str) -> Optional[tuple[str, str]]:
        """Record an end of a harness the upload creates; the reason when the row contradicts earlier rows."""
        key = (mate["instanceId"], mate["portKey"]) if mate else None
        if key is not None and key in self.mated:
            return "conflict", "port_already_mated"
        state = self.new_ends.setdefault((name, ordinal), {"mate": key, "pins": {}})
        if state["mate"] != key:
            return "conflict", "end_mate_mismatch"
        pad = mate["pin"] if mate else pin
        if mate is None and not (pin.isdigit() and int(pin) >= 1):
            return "unresolved", "pin_not_found"  # an unmated end's pins are 1…pinCount
        if mate is not None:
            interface = self.interfaces.get(mate["instanceId"]) or {}
            if pin not in exposure.pins_by_pad(exposure.component_by_key(interface, mate["portKey"]) or {}):
                return "unresolved", "pin_not_found"  # a Generic end's pins are the connector's pads
        if state["pins"].get(pin, pad) != pad or (pad in state["pins"].values() and state["pins"].get(pin) != pad):
            return "conflict", "pin_map_mismatch"
        state["pins"][pin] = pad
        return None

    def classify(self, line: int, values: Mapping[str, str], board_map: Mapping[str, str],
                 instances: Mapping[str, Mapping[str, Any]],
                 overrides: Mapping[str, Mapping[str, str]]) -> tuple[str, dict]:
        name = values["link_name"]
        entry: dict[str, Any] = {
            "line": line, "values": dict(values), "reason": None, "from": None, "to": None, "kind": "wire",
            "signal": values["signal"], "harness": _harness(values["harness"]), "linkName": name,
            "linkId": None, "rowId": None, "action": None,
            "fromEnd": end_ordinal(values["from_end"]), "fromPin": values["from_end_pin"],
            "toEnd": end_ordinal(values["to_end"]), "toPin": values["to_end_pin"],
            "gaugeAwg": None, "colour": values["colour"] or None, "wireLabel": values["wire_label"] or None,
        }

        def put(bucket: str, reason: Optional[str] = None) -> tuple[str, dict]:
            entry["reason"] = reason
            return bucket, entry

        if not name or not values["from_end_pin"] or not values["to_end_pin"]:
            return put("unresolved", "missing_value")
        if entry["fromEnd"] is None or entry["toEnd"] is None:
            return put("unresolved", "end_label_invalid")
        entry["gaugeAwg"], valid = _gauge(values["gauge_awg"])
        if not valid:
            return put("unresolved", "gauge_invalid")
        if entry["fromEnd"] == entry["toEnd"]:
            return put("conflict", "same_end")
        for side in ("from", "to"):
            if not any(values[f"{side}_{k}"] for k in ("board", "connector", "pin")):
                continue  # an unmated end
            mate, why = _resolve_end(values, side, board_map, instances, self.interfaces, overrides)
            if why:
                return put("unresolved", why)
            entry[side] = mate

        harness, why = self._harness(name, values["row_id"] or None)
        if why:
            return put("conflict", why)
        points = []
        for side, key in (("from", "fromEnd"), ("to", "toEnd")):
            pin = entry[f"{side}Pin"]
            if harness is not None:
                end, problem = self._existing_end(harness, entry[key], entry[side], pin)
                if problem:
                    return put(*problem)
                points.append((end["id"], pin))
            else:
                problem = self._new_end(name, entry[key], entry[side], pin)
                if problem:
                    return put(*problem)
                points.append((entry[key], pin))

        key = (harness["id"] if harness else f"new:{name}", frozenset(points))
        if harness is not None:
            entry["linkId"] = harness["id"]
            existing = {frozenset({(w["from_end"], w["from_pin"]), (w["to_end"], w["to_pin"])}): w["id"]
                        for w in harness["wires"]}
            row_id = values["row_id"] or None
            if row_id and row_id in self.by_wire:
                taken = existing.get(frozenset(points))
                if taken is not None and taken != row_id:
                    return put("conflict", "pin_pair_taken")
                if row_id in self.updated:
                    return put("conflict", "duplicate_upload")
                entry["rowId"], entry["action"] = row_id, "update"
            elif frozenset(points) in existing:
                return put("conflict", "duplicate_existing")
        if entry["action"] is None:
            entry["action"] = "create"
        if key in self.seen:
            return put("conflict", "duplicate_upload")
        self.seen.add(key)
        if entry["rowId"]:
            self.updated.add(entry["rowId"])

        nets = [n for side in ("from", "to") for n in ((entry[side] or {}).get("nets") or [])]
        if not values["signal"]:
            entry["signal"] = leaf(nets[0]) if nets else ""
            return put("matched")
        if not nets or values["signal"].casefold() in {leaf(n).casefold() for n in nets}:
            return put("matched")
        return put("needsReview", "signal_mismatch")


def apply_wires(store: SystemStore, change: Mutation, proposals: Sequence[Mapping[str, Any]],
                interfaces: Mapping[str, Optional[dict]]) -> dict:
    """Write wire proposals: new harnesses first (Generic ends, pin maps from the rows), then each
    touched harness's whole wire list with nets captured at the current baselines."""

    report = {"created": 0, "updated": 0, "unchanged": 0, "harnessesCreated": []}
    if not proposals:
        return report
    by_name: dict[str, list[Mapping[str, Any]]] = {}
    for proposal in proposals:
        resolve_proposal(proposal, interfaces)
        by_name.setdefault(proposal["linkName"], []).append(proposal)

    for name, group in by_name.items():
        harnesses = store.list_harnesses(change.system_id)
        harness = next((h for h in harnesses if h["id"] == group[0].get("linkId")), None) \
            or next((h for h in harnesses if h["name"] == name), None)
        if harness is None:
            harness = _create_harness(store, change, name, group, interfaces)
            report["harnessesCreated"].append(harness["id"])
        ends = {end["ordinal"]: end for end in harness["ends"]}
        wires = {w["id"]: {"id": w["id"], "from": {"end": w["from_end"], "pin": w["from_pin"]},
                           "to": {"end": w["to_end"], "pin": w["to_pin"]}, "signal": w["signal"],
                           "gaugeAwg": w["gauge_awg"], "colour": w["colour"], "label": w["label"]}
                 for w in harness["wires"]}
        creates, changed = [], False
        for proposal in group:
            if proposal["fromEnd"] not in ends or proposal["toEnd"] not in ends:
                raise Conflict(f"harness {name} no longer has the ends this import names; re-run the preview")
            wire = {"from": {"end": ends[proposal["fromEnd"]]["id"], "pin": proposal["fromPin"]},
                    "to": {"end": ends[proposal["toEnd"]]["id"], "pin": proposal["toPin"]},
                    "signal": proposal["signal"], "gaugeAwg": proposal.get("gaugeAwg"),
                    "colour": proposal.get("colour"), "label": proposal.get("wireLabel")}
            if proposal.get("rowId"):
                current = wires.get(proposal["rowId"])
                if current is None:
                    raise Conflict("a wire this import updates no longer exists; re-run the preview")
                if {**current, "id": None} == {**wire, "id": None}:
                    report["unchanged"] += 1
                    continue
                wires[proposal["rowId"]] = {"id": proposal["rowId"], **wire}
                report["updated"] += 1
                changed = True
            else:
                creates.append(wire)
                report["created"] += 1
                changed = True
        if not changed:
            continue  # nothing changes on this harness: no write, no audit
        rows = list(wires.values()) + creates
        pairs = [frozenset({(w["from"]["end"], w["from"]["pin"]), (w["to"]["end"], w["to"]["pin"])}) for w in rows]
        if len(set(pairs)) != len(pairs):
            raise Conflict(f"harness {name} would hold the same wire twice; re-run the preview")
        harness = store.get_harness(change.system_id, harness["id"])
        components = {end["id"]: _end_component(end, interfaces) for end in harness["ends"] if end["mates_instance_id"]}
        store.replace_wires(change, harness["id"], harnesses_module.capture(
            rows, {end["id"]: end for end in harness["ends"]}, components))
    return report


def _end_component(end: Mapping[str, Any], interfaces: Mapping[str, Optional[dict]]) -> Optional[dict]:
    interface = interfaces.get(end["mates_instance_id"])
    if interface is None:
        raise Conflict("interface_not_ready: a mated board's interface is still being extracted")
    return exposure.component_by_key(interface, end["mates_port"]["portKey"])


def _create_harness(store: SystemStore, change: Mutation, name: str, group: Sequence[Mapping[str, Any]],
                    interfaces: Mapping[str, Optional[dict]]) -> dict:
    """A harness the upload names but the system lacks: Generic ends in ordinal order, each mating the
    connector its rows name, with a pin map wherever an end pin lands on another pad."""

    first = group[0]
    ends: dict[int, dict] = {}
    for proposal in group:
        for side, key, pin in (("from", "fromEnd", "fromPin"), ("to", "toEnd", "toPin")):
            state = ends.setdefault(proposal[key], {"mate": proposal[side], "pins": {}})
            mate = proposal[side]
            state["pins"][proposal[pin]] = mate["pin"] if mate else proposal[pin]
    harness = store.create_harness(change, name=name, label=first.get("harness"), audit={"fromImport": True})
    for ordinal in sorted(ends):
        state = ends[ordinal]
        mate = state["mate"]
        if mate is None:
            count = max(int(p) for p in state["pins"])
            harness = store.add_harness_end(change, harness["id"], pin_count=count, ordinal=ordinal)
            continue
        interface = interfaces.get(mate["instanceId"])
        component = exposure.component_by_key(interface, mate["portKey"]) if interface else None
        if component is None:
            raise Conflict(f"{mate['label']}/{mate['reference']} no longer resolves at its baseline")
        override = store.list_overrides(mate["instanceId"]).get(component["portKey"])
        if not exposure.is_exposed(component, override):
            store.set_override(change, mate["instanceId"], component["portKey"], "promoted")
        pin_map = {pin: pad for pin, pad in sorted(state["pins"].items(), key=lambda p: pad_sort_key(p[0]))
                   if pin != pad} or None
        harness = store.add_harness_end(change, harness["id"], mates_instance_id=mate["instanceId"],
                                        mates_port=exposure.port_baseline(component), pin_map=pin_map,
                                        pin_count=max(1, len(exposure.pins_by_pad(component))), ordinal=ordinal)
    return harness
