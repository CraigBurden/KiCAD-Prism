"""Structural validation (``docs/system-builder/CONTRACTS.md`` §7.2, §7.3).

``validate`` is a pure function over the live state at the current
baselines: instances, links with rows, each instance's baseline interface
(``None`` when not extracted), its port overrides, and open reviews. It
returns deterministic findings. A rule that cannot run for an instance is
reported under ``notEvaluated`` with a reason; it is never reported as
passing.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Collection, Mapping, Optional, Protocol, Sequence

from app.services.systems import exposure
from app.services.systems.drift import pad_sort_key

RULES = {
    "SYS-V01": ("row_duplicate", "error"),
    "SYS-V02": ("pin_fanout", "warning"),
    "SYS-V03": ("port_not_exposed", "error"),
    "SYS-V04": ("pin_absent", "error"),
    "SYS-V05": ("source_unavailable", "error"),
    "SYS-V06": ("pcb_out_of_sync", "warning"),
    "SYS-V07": ("pin_net_ambiguous", "warning"),
    "SYS-V08": ("open_review", "info"),
    # CONTRACTS_P2 §8.4. V09-V15 arrive with their tickets.
    "SYS-V09": ("net_name_mismatch", "warning"),
    "SYS-V10": ("power_meets_signal", "error"),
    "SYS-V11": ("mate_mismatch", "warning"),
    "SYS-V12": ("harness_collision", "warning"),
    "SYS-V13": ("length_mismatch", "warning"),
    "SYS-V14": ("child_revision_unreleased", "warning"),
    "SYS-V15": ("child_advance_blocked", "warning"),
    "SYS-V16": ("export_unresolved", "error"),
    "SYS-V17": ("mating_stale", "info"),
    "SYS-V18": ("mate_pair_unknown", "warning"),
    "SYS-V19": ("mate_pin_mismatch", "error"),
    "SYS-V20": ("harness_tight_bend", "info"),
    "SYS-V21": ("subport_pad_absent", "warning"),
    "SYS-V22": ("part_collision", "warning"),
    "SYS-V23": ("net_meets_no_net", "warning"),
}
# Rules a system may list in ``system_projects.optional_rules`` (CONTRACTS_P2 §8.4). Kept for
# compatibility: since D-P2-57 (§23.4) SYS-V09 runs on every system and the list has no effect.
OPTIONAL_RULES = frozenset({"SYS-V09"})
_SEVERITY_ORDER = {"error": 0, "warning": 1, "info": 2}
# Rules that need an instance's baseline interface.
_INTERFACE_RULES = ("SYS-V03", "SYS-V04", "SYS-V06", "SYS-V07")


def _finding(rule: str, *, instance_id: Optional[str] = None, link_id: Optional[str] = None,
             row_id: Optional[str] = None, end: Optional[str] = None, reference: Optional[str] = None,
             pin: Optional[str] = None, detail: Mapping[str, Any] | None = None) -> dict:
    name, severity = RULES[rule]
    return {"rule": rule, "name": name, "severity": severity, "instanceId": instance_id,
            "linkId": link_id, "rowId": row_id, "end": end, "reference": reference, "pin": pin,
            "detail": dict(detail or {})}


def _row_place(link: Mapping[str, Any], row: Mapping[str, Any]) -> dict:
    """A join finding's place (SB2-112): side A's board, connector and pin, with side B's in the detail.
    It keeps each row's finding apart in ``finding_key``, so a waiver covers one join, not the link."""
    ref = lambda end: (link.get(f"{end}_port") or {}).get("reference")  # noqa: E731
    return {"instance_id": link.get("a_instance_id"), "end": "a", "reference": ref("a"), "pin": row.get("pin_a"),
            "detail": {"pinB": row.get("pin_b"), "referenceB": ref("b")}}


def make_finding(rule: str, **fields: Any) -> dict:
    """``_finding`` for rule modules outside this file (harnesses, CONTRACTS_P2 §17.2)."""
    return _finding(rule, **fields)


def _sort_key(finding: Mapping[str, Any]) -> tuple:
    return (_SEVERITY_ORDER[finding["severity"]], finding["rule"], finding["linkId"] or "",
            finding["rowId"] or "", finding["end"] or "", finding["instanceId"] or "",
            pad_sort_key(finding["pin"] or ""))


def validate(
    instances: Sequence[Mapping[str, Any]],
    links: Sequence[Mapping[str, Any]],
    interfaces: Mapping[str, Optional[Mapping[str, Any]]],
    overrides: Mapping[str, Mapping[str, str]],
    open_reviews: Sequence[Mapping[str, Any]] = (),
    *,
    unavailable: Mapping[str, str] | None = None,
    exports: Sequence[Mapping[str, Any]] = (),
    optional_rules: Collection[str] = (),
) -> dict:
    """Findings for one system.

    ``optional_rules`` names the opt-in rules (``OPTIONAL_RULES``) this system
    enabled; the others in that set do not run.
    ``interfaces[instance_id]`` is the artifact at that instance's baseline or
    ``None``; ``unavailable[instance_id]`` gives a reason the source cannot be
    read (unresolved project, failed extraction). Pending extraction is
    neither: it only makes the interface rules ``not_evaluated``.
    """

    unavailable = dict(unavailable or {})
    findings: list[dict] = []
    not_evaluated: list[dict] = []
    exempt: list[dict] = []
    by_id = {i["id"]: i for i in instances}

    # SYS-V05, and which instances the interface rules can run on.
    evaluable: dict[str, Mapping[str, Any]] = {}
    for instance in instances:
        iid = instance["id"]
        reason = unavailable.get(iid)
        if instance.get("resolution") == "unresolved":
            reason = reason or "instance is unresolved"
        if reason:
            findings.append(_finding("SYS-V05", instance_id=iid, detail={"reason": reason}))
        interface = interfaces.get(iid)
        if interface is None:
            for rule in _INTERFACE_RULES:
                not_evaluated.append({"rule": rule, "instanceId": iid,
                                      "reason": reason or "interface not extracted yet"})
            continue
        evaluable[iid] = interface
        if not interface.get("hasPcb"):
            not_evaluated.append({"rule": "SYS-V06", "instanceId": iid, "reason": "hasPcb false"})

    # SYS-V01: duplicates that bypassed the write-time check (legacy imports).
    for link in links:
        seen: dict[tuple[str, str], str] = {}
        for row in sorted(link["rows"], key=lambda r: r["id"]):
            key = (row["pin_a"], row["pin_b"])
            if key in seen:
                place = _row_place(link, row)
                findings.append(_finding("SYS-V01", link_id=link["id"], row_id=row["id"],
                                         **{**place, "detail": {**place["detail"], "duplicateOf": seen[key]}}))
            else:
                seen[key] = row["id"]

    # SYS-V02: one (instance, port, pin) used by rows of several links.
    uses: dict[tuple[str, str, str], list[tuple[str, Optional[str], str, str]]] = defaultdict(list)
    references: dict[tuple[str, str], str] = {}
    for link in links:
        for end in ("a", "b"):
            port = link[f"{end}_port"]
            references[(link[f"{end}_instance_id"], port["portKey"])] = port.get("reference")
            for row in link["rows"]:
                uses[(link[f"{end}_instance_id"], port["portKey"], row[f"pin_{end}"])].append(
                    (link["id"], link.get("harness"), row["id"], end))
    for (iid, port_key, pin), entries in sorted(uses.items()):
        link_ids = sorted({e[0] for e in entries})
        if len(link_ids) < 2:
            continue
        reference = references[(iid, port_key)]
        harnesses = {e[1] for e in entries}
        record = {"instanceId": iid, "portKey": port_key, "reference": reference, "pin": pin,
                  "links": link_ids}
        if len(harnesses) == 1 and None not in harnesses:
            exempt.append({"rule": "SYS-V02", **record, "harness": next(iter(harnesses))})
            continue
        for link_id, _harness, row_id, end in sorted(entries):
            findings.append(_finding("SYS-V02", instance_id=iid, link_id=link_id, row_id=row_id,
                                     end=end, reference=reference, pin=pin,
                                     detail={"links": link_ids}))

    # SYS-V03, V04, V06, V07: per link end against the baseline interface.
    for link in links:
        for end in ("a", "b"):
            iid = link[f"{end}_instance_id"]
            interface = evaluable.get(iid)
            if interface is None:
                continue
            port = link[f"{end}_port"]
            component = exposure.component_by_key(interface, port["portKey"])
            if component is None or not exposure.is_exposed(
                component, (overrides.get(iid) or {}).get(component["portKey"])
            ):
                findings.append(_finding("SYS-V03", instance_id=iid, link_id=link["id"], end=end,
                                         reference=port.get("reference"),
                                         detail={"portKey": port["portKey"],
                                                 "present": component is not None}))
            pins = exposure.pins_by_pad(component) if component else {}
            for row in link["rows"]:
                pad = row[f"pin_{end}"]
                common = {"instance_id": iid, "link_id": link["id"], "row_id": row["id"], "end": end,
                          "reference": port.get("reference"), "pin": pad}
                if component is not None and pad not in pins:
                    findings.append(_finding("SYS-V04", **common))
                    continue
                pin = pins.get(pad)
                if pin is None:
                    continue
                nets = sorted(pin.get("nets") or [])
                if len(nets) > 1:
                    findings.append(_finding("SYS-V07", **common, detail={"nets": nets}))
                if interface.get("hasPcb"):
                    pcb = pin.get("pcbNets")
                    if pcb is None or sorted(pcb) != nets:
                        findings.append(_finding("SYS-V06", **common,
                                                 detail={"schematic": nets, "pcb": pcb}))

    # SYS-V09 / V10 / V23: each join (row) of this system's own links (CONTRACTS_P2 §8.4).
    from app.services.systems import system_nets

    for link in links:
        pins = {}
        for end in ("a", "b"):
            interface = interfaces.get(link[f"{end}_instance_id"])
            port_key = (link.get(f"{end}_port") or {}).get("portKey")
            component = exposure.component_by_key(interface, port_key) if interface and port_key else None
            pins[end] = exposure.pins_by_pad(component) if component else None
        for row in link.get("rows") or []:
            net_a, net_b = list(row.get("net_a") or []), list(row.get("net_b") or [])
            place = _row_place(link, row)
            if system_nets.name_mismatch(net_a, net_b):  # every system since D-P2-57
                findings.append(_finding("SYS-V09", link_id=link["id"], row_id=row["id"],
                                         **{**place, "detail": {**place["detail"], "netA": net_a, "netB": net_b}}))
            if pins["a"] is None or pins["b"] is None:
                continue
            named_side = system_nets.net_meets_none(net_a, net_b)
            if named_side:
                findings.append(_finding("SYS-V23", link_id=link["id"], row_id=row["id"],
                                         **{**place, "detail": {**place["detail"], "namedSide": named_side,
                                                                "netA": net_a, "netB": net_b}}))
            power_a = (pins["a"].get(str(row["pin_a"])) or {}).get("powerNet")
            power_b = (pins["b"].get(str(row["pin_b"])) or {}).get("powerNet")
            if system_nets.power_meets_signal(power_a, net_a, power_b, net_b):
                findings.append(_finding("SYS-V10", link_id=link["id"], row_id=row["id"],
                                         **{**place, "detail": {**place["detail"], "powerSide": "a" if power_a else "b",
                                                                "netA": net_a, "netB": net_b}}))

    # SYS-V16: exports that no longer resolve or are no longer exposed.
    from app.services.systems import exports as exports_module

    unevaluated = {iid for iid in by_id if iid not in evaluable}
    for problem in exports_module.findings(exports, interfaces, overrides, unevaluated):
        findings.append(_finding("SYS-V16", instance_id=problem["instanceId"], reference=problem["reference"],
                                 detail={"exportId": problem["exportId"], "name": problem["name"],
                                         "reason": problem["reason"]}))

    # SYS-V08.
    for review in open_reviews:
        if review.get("instance_id") in by_id:
            findings.append(_finding("SYS-V08", instance_id=review["instance_id"],
                                     detail={"reviewId": review["id"], "kind": review["kind"]}))

    findings.sort(key=_sort_key)
    not_evaluated.sort(key=lambda n: (n["rule"], n["instanceId"]))
    exempt.sort(key=lambda e: (e["rule"], e["instanceId"], pad_sort_key(e["pin"])))
    counts = {"error": 0, "warning": 0, "info": 0}
    for finding in findings:
        counts[finding["severity"]] += 1
    counts["notEvaluated"] = len(not_evaluated)
    return {"findings": findings, "notEvaluated": not_evaluated, "exempt": exempt, "counts": counts}


def child_findings(children: Sequence[Mapping[str, Any]]) -> list[dict]:
    """SYS-V14 and V15 for assembly/module instances (CONTRACTS_P2 §8.4).

    Each child is ``{instanceId, releaseStatus, openReviewCount, blocked}``.
    """

    out = []
    for child in children:
        if child.get("releaseStatus") not in (None, "released"):
            out.append(_finding("SYS-V14", instance_id=child["instanceId"],
                                detail={"reason": "unreleased", "releaseStatus": child["releaseStatus"]}))
        elif int(child.get("openReviewCount") or 0) > 0:
            out.append(_finding("SYS-V14", instance_id=child["instanceId"],
                                detail={"reason": "open_reviews", "openReviewCount": child["openReviewCount"]}))
        if child.get("blocked"):
            out.append(_finding("SYS-V15", instance_id=child["instanceId"], detail={}))
    return out


def with_findings(report: Mapping[str, Any], extra: Sequence[Mapping[str, Any]]) -> dict:
    """``report`` with ``extra`` findings merged, sorted and counted."""
    findings = sorted([*report["findings"], *extra], key=_sort_key)
    counts = {"error": 0, "warning": 0, "info": 0}
    for finding in findings:
        counts[finding["severity"]] += 1
    counts["notEvaluated"] = report["counts"]["notEvaluated"]
    return {**report, "findings": findings, "counts": counts}


# ---------------------------------------------------------------------------
# Waivers (SB2-100, D-P2-56)

# How the rules read to people (the ICD, reports); the Findings tray's twin is findings-ui.tsx RULE_TEXT.
RULE_LABELS = {
    "row_duplicate": "Duplicate row", "pin_fanout": "Pin used by several links",
    "port_not_exposed": "Connector is not a port", "pin_absent": "Pad does not exist",
    "source_unavailable": "Board source unavailable", "pcb_out_of_sync": "PCB net differs from the schematic",
    "pin_net_ambiguous": "Pin carries several nets", "open_review": "Open review",
    "net_name_mismatch": "Joined nets share no name", "power_meets_signal": "Power net meets a signal net",
    "mate_mismatch": "Mated connectors do not line up", "harness_collision": "Harness runs through a board",
    "length_mismatch": "Cut length differs from the estimate",
    "child_revision_unreleased": "Subsystem revision is not released",
    "child_advance_blocked": "Subsystem update blocked by hierarchy limits",
    "export_unresolved": "Export does not resolve",
    "mating_stale": "Connector moved since its mating frame was confirmed",
    "mate_pair_unknown": "Catalog does not list these parts as mating",
    "mate_pin_mismatch": "Harness part pins do not land on connector pads",
    "harness_tight_bend": "Harness bends tighter than its minimum radius",
    "subport_pad_absent": "Sub-port names a pad the connector no longer has",
    "part_collision": "Bodies intersect in 3D",
    "net_meets_no_net": "Named net meets a pin on no net",
}


def rule_label(name: str) -> str:
    return RULE_LABELS.get(name, name.replace("_", " "))


WAIVABLE_SEVERITIES = frozenset({"warning", "info"})


def finding_key(finding: Mapping[str, Any]) -> str:
    """A finding's identity across re-reads: rule, instance, link, harness, end, reference and pin.
    Not the row ID, which a row save may replace."""
    harness = (finding.get("detail") or {}).get("harnessId") or ""
    return "|".join(str(part or "") for part in (finding["rule"], finding.get("instanceId"), finding.get("linkId"),
                                                 harness, finding.get("end"), finding.get("reference"),
                                                 finding.get("pin")))


def apply_waivers(report: Mapping[str, Any], waivers: Sequence[Mapping[str, Any]]) -> dict:
    """``report`` with every finding keyed, waived warnings and info marked and left out of the
    counts (``counts.waived`` says how many), and ``waivers`` listing each with ``active``: whether
    its finding still occurs. An error is never waived, even if a waiver names it."""
    by_key = {waiver["finding_key"]: waiver for waiver in waivers}
    matched: set[str] = set()
    findings = []
    counts = {"error": 0, "warning": 0, "info": 0}
    for finding in report["findings"]:
        key = finding_key(finding)
        waiver = by_key.get(key)
        if waiver is not None and finding["severity"] in WAIVABLE_SEVERITIES:
            matched.add(key)
            findings.append({**finding, "key": key, "waived": waiver_doc(waiver)})
        else:
            counts[finding["severity"]] += 1
            findings.append({**finding, "key": key, "waived": None})
    counts["notEvaluated"] = report["counts"]["notEvaluated"]
    counts["waived"] = len(matched)
    return {**report, "findings": findings, "counts": counts,
            "waivers": [{**waiver_doc(waiver), "findingKey": waiver["finding_key"], "rule": waiver["rule"],
                         "active": waiver["finding_key"] in matched}
                        for waiver in sorted(waivers, key=lambda w: (w["rule"], w["finding_key"]))]}


def waiver_doc(waiver: Mapping[str, Any]) -> dict:
    created = waiver["created_at"]
    return {"id": waiver["id"], "note": waiver["note"], "by": waiver["created_by"],
            "at": created.isoformat() if hasattr(created, "isoformat") else created}


def mate_mismatch_findings(mismatches: Sequence[Mapping[str, Any]]) -> list[dict]:
    """SYS-V11 (CONTRACTS_P2 §14.9): a B2B mate that does not line up where the driving mates put its boards."""
    return [_finding("SYS-V11", link_id=item["linkId"],
                     detail={k: item[k] for k in ("offsetMm", "lateralMm", "axialMm", "angleDeg")})
            for item in mismatches]


def harness_route_findings(checked: Mapping[str, Mapping[str, Any]], cut_lengths: Mapping[str, Optional[float]],
                           tolerance: float) -> list[dict]:
    """SYS-V12, V13 and V20 (CONTRACTS_P2 §17.10) from each routed harness's checks:
    a segment through a board, a cut length off the estimate, a bend tighter than the minimum."""
    out = []
    for harness_id, found in checked.items():
        for hit in found["collisions"]:
            out.append(_finding("SYS-V12", detail={
                "harnessId": harness_id, "segmentId": hit["segmentId"], "occurrence": hit["board"],
                "distanceMm": round(hit["distanceMm"], 3), "radiusMm": round(hit["radiusMm"], 3),
                "atMm": [round(v, 3) for v in hit["atMm"]]}))
        lengths, cut = found["lengths"], cut_lengths.get(harness_id)
        if cut and lengths["complete"] and lengths["estimatedMm"] > 0:
            off = (cut - lengths["estimatedMm"]) / lengths["estimatedMm"]
            if abs(off) > tolerance:
                out.append(_finding("SYS-V13", detail={
                    "harnessId": harness_id, "cutLengthMm": cut, "estimatedMm": round(lengths["estimatedMm"], 1),
                    "differencePct": round(off * 100.0, 1)}))
        for bend in found["tightBends"]:
            out.append(_finding("SYS-V20", detail={"harnessId": harness_id, **bend}))
    return out


def mating_findings(stale: Sequence[Mapping[str, Any]]) -> list[dict]:
    """SYS-V17 (CONTRACTS_P2 §15.2): a stored frame whose port geometry changed since it was confirmed."""
    return [_finding("SYS-V17", instance_id=item["instanceId"], reference=item["reference"],
                     detail={"portKey": item["portKey"], "mode": item["mode"]}) for item in stale]


def subport_findings(subports: Sequence[Mapping[str, Any]], interfaces: Mapping[str, Mapping[str, Any]]) -> list[dict]:
    """SYS-V21 (CONTRACTS_P2 §22.4): a sub-port naming a pad its connector, or its subsystem export,
    no longer has. A connector that no longer resolves is SYS-V03/V16 on its ends, not this."""
    out = []
    for subport in subports:
        interface = interfaces.get(subport["instance_id"])
        component = exposure.component_by_key(interface, subport["port_key"]) if interface else None
        if component is None:
            continue
        pads = exposure.pins_by_pad(component)
        missing = sorted((pad for pad in subport["pads"] if pad not in pads), key=pad_sort_key)
        if missing:
            # The sub-port's own label as the reference: the tray names it, and each sub-port keys apart.
            out.append(_finding("SYS-V21", instance_id=subport["instance_id"],
                                reference=f"{component['reference']}.{subport['name']}",
                                detail={"subportId": subport["id"], "name": subport["name"], "pads": missing}))
    return out


def collision_findings(collisions: Sequence[Mapping[str, Any]]) -> list[dict]:
    """SYS-V22 (CONTRACTS_P2 §24.2): one per colliding occurrence pair of the stored check. The
    instance is the first occurrence's root instance; the reference names the colliding part."""
    out = []
    for collision in collisions:
        a, b = collision["a"], collision["b"]
        instance_id = a["occurrence"].strip("/").split("/")[0] or None
        out.append(_finding("SYS-V22", instance_id=instance_id,
                            reference=f"{a['label']} {a['reference'] or ''} ↔ {b['label']} {b['reference'] or ''}".replace("  ", " ").strip(),
                            detail={"a": dict(a), "b": dict(b), "atMm": list(collision["atMm"]),
                                    "pairs": list(collision.get("pairs") or [])}))
    return out


# ---------------------------------------------------------------------------
# SYS-V18 (CONTRACTS_P2 §18): catalog mates, given as input


@dataclass(frozen=True)
class MateCatalog:
    """What the catalog says about the connector parts of a system: ``parts`` by lower-cased MPN
    (``{componentId, …}``) and ``pairs``, the ``(min, max)`` component ID pairs related by mates-with."""

    parts: Mapping[str, Mapping[str, Any]]
    pairs: Collection[tuple[str, str]]


def _mate_candidates(links: Sequence[Mapping[str, Any]], harnesses: Sequence[Mapping[str, Any]],
                     interfaces: Mapping[str, Any]) -> tuple[list, list]:
    def connector(instance_id: Optional[str], port: Optional[Mapping[str, Any]]) -> Optional[dict]:
        interface = interfaces.get(instance_id) if instance_id else None
        return exposure.component_by_key(interface, port["portKey"]) if interface and port else None

    b2b = [(link, [connector(link[f"{e}_instance_id"], link[f"{e}_port"]) for e in ("a", "b")])
           for link in links if link.get("type") == "b2b"]
    ends = [(harness, end, connector(end["mates_instance_id"], end["mates_port"]))
            for harness in harnesses for end in harness["ends"]
            if end["catalog_component_id"] and end["mates_instance_id"]]
    return b2b, ends


def _part_of(parts: Mapping[str, Mapping[str, Any]], component: Optional[Mapping[str, Any]]) -> Optional[str]:
    if not component or not component.get("mpn"):
        return None
    return (parts.get(component["mpn"].strip().lower()) or {}).get("componentId")


def mate_mpns(links: Sequence[Mapping[str, Any]], harnesses: Sequence[Mapping[str, Any]],
              interfaces: Mapping[str, Any]) -> list[str]:
    """The MPNs of the b2b connectors and the board connectors harness ends mate, to look up in the catalog."""
    b2b, ends = _mate_candidates(links, harnesses, interfaces)
    return [c["mpn"] for _link, pair in b2b for c in pair if c and c.get("mpn")] + \
           [c["mpn"] for _h, _e, c in ends if c and c.get("mpn")]


def mate_parts(links: Sequence[Mapping[str, Any]], harnesses: Sequence[Mapping[str, Any]],
               interfaces: Mapping[str, Any], parts: Mapping[str, Mapping[str, Any]]) -> list[str]:
    """The catalog component IDs whose mates-with pairs SYS-V18 needs, sorted."""
    b2b, ends = _mate_candidates(links, harnesses, interfaces)
    known = {p for _link, pair in b2b for p in (_part_of(parts, c) for c in pair) if p} | \
            {p for _h, e, c in ends for p in (_part_of(parts, c), e["catalog_component_id"]) if p}
    return sorted(known)


def mate_pair_findings(links: Sequence[Mapping[str, Any]], harnesses: Sequence[Mapping[str, Any]],
                       interfaces: Mapping[str, Any], mates: Optional[MateCatalog]) -> list[dict]:
    """SYS-V18: a b2b pair, or a harness end's part and its board connector, whose two catalog parts are
    both known and not related by mates-with. Unknown parts, or no catalog answer (``mates`` None): none."""
    if mates is None:
        return []
    b2b, ends = _mate_candidates(links, harnesses, interfaces)

    def related(x: str, y: str) -> bool:
        return (min(x, y), max(x, y)) in mates.pairs

    out = []
    for link, pair in b2b:
        ids = [_part_of(mates.parts, c) for c in pair]
        if all(ids) and ids[0] != ids[1] and not related(*ids):
            out.append(_finding("SYS-V18", link_id=link["id"], detail={"partA": ids[0], "partB": ids[1]}))
    for harness, end, component in ends:
        board_part = _part_of(mates.parts, component)
        if board_part and not related(board_part, end["catalog_component_id"]):
            out.append(_finding(
                "SYS-V18", instance_id=end["mates_instance_id"], reference=(end["mates_port"] or {}).get("reference"),
                detail={"harnessId": harness["id"], "endId": end["id"], "part": end["catalog_component_id"],
                        "connectorPart": board_part}))
    return out


def stale_mating(boards: Sequence[Mapping[str, Any]], mating: Mapping[str, Mapping[str, Mapping[str, Any]]],
                 interfaces: Mapping[str, Any]) -> list[dict]:
    """The stored mating frames whose port geometry changed since confirmation (SYS-V17's input)."""
    from app.services.systems import mating as mating_module

    stale = []
    for instance in boards:
        stored = mating.get(instance["id"])
        if not stored or instance["id"] not in interfaces:
            continue
        for port_key, record in sorted(stored.items()):
            component = exposure.component_by_key(interfaces[instance["id"]], port_key)
            if mating_module.is_stale(component, record):
                stale.append({"instanceId": instance["id"], "portKey": port_key, "mode": record["mode"],
                              "reference": (component or {}).get("reference")})
    return stale


def collision_report(report: Mapping[str, Any], check: Optional[Mapping[str, Any]], scene_key: str) -> dict:
    """SYS-V22 (P2 §24.2): the stored check's collisions while it was made for ``scene_key``.
    ``collisionCheck`` says whether it is ``current``, ``stale`` or ``not_checked``, and lists the
    occurrences it could not check (no 3D bundle or model): never a pass."""
    if check is None or check["scene_key"] != scene_key:
        state = {"state": "not_checked" if check is None else "stale", "checkedAt": _iso(check["checked_at"]) if check else None,
                 "notEvaluated": []}
        return {**report, "collisionCheck": state}
    result = check["result"]
    report = with_findings(report, collision_findings(result.get("collisions") or []))
    return {**report, "collisionCheck": {"state": "current", "checkedAt": _iso(check["checked_at"]),
                                         "notEvaluated": list(result.get("notEvaluated") or [])}}


def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


# ---------------------------------------------------------------------------
# The whole report (AC-16)


class SystemFacts(Protocol):
    """What ``report`` reads: ``loaded.LoadedSystem`` provides it from rows; tests may pass any object
    with these attributes."""

    boards: Sequence[Mapping[str, Any]]  # board instance rows
    links: Sequence[Mapping[str, Any]]
    exports: Sequence[Mapping[str, Any]]
    harnesses: Sequence[Mapping[str, Any]]
    subports: Sequence[Mapping[str, Any]]
    open_reviews: Sequence[Mapping[str, Any]]
    open_renames: Sequence[Mapping[str, Any]]
    waivers: Sequence[Mapping[str, Any]]
    interfaces: Mapping[str, Any]  # every instance's interface; missing = not extracted / unreadable
    overrides: Mapping[str, Mapping[str, str]]  # every board's port overrides
    mating: Mapping[str, Mapping[str, Mapping[str, Any]]]  # every board's stored mating frames
    unavailable: Mapping[str, str]  # boards whose source can't be read, with the reason
    optional_rules: Sequence[str]
    child_states: Sequence[Mapping[str, Any]]  # see child_findings
    end_components: Mapping[str, Mapping[str, Any]]  # harness ID -> end ID -> mated component
    mate_mismatches: Optional[Sequence[Mapping[str, Any]]]  # the root solve's B2B mismatches, None if none solved
    harness_checks: Mapping[str, Mapping[str, Any]]  # routed root harnesses: {lengths, collisions, tightBends}
    collision_check: Optional[Mapping[str, Any]]  # the last stored collision check


def _structural(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V01..V08, V09, V10, V16, V23 over boards, links and exports (P1 §7.2, P2 §8.4)."""
    # The full interface map: board rules read boards only; re-export checks need assemblies (P2 §4).
    return validate(system.boards, system.links, dict(system.interfaces), system.overrides, system.open_reviews,
                    unavailable=system.unavailable, exports=system.exports, optional_rules=system.optional_rules)


def _children(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V14, V15: catalog instances' revisions."""
    return with_findings(report, child_findings(system.child_states))


def _mating_stale(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V17: stored mating frames whose port moved."""
    return with_findings(report, mating_findings(stale_mating(system.boards, system.mating, system.interfaces)))


def _mate_mismatch(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V11: the root level's B2B mates, solved as the System 3D view places them (§14.9)."""
    mismatches = system.mate_mismatches
    return report if mismatches is None else with_findings(report, mate_mismatch_findings(mismatches))


def _harness_routes(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V12, V13, V20: routed where the System 3D view draws them (§17.10)."""
    from app.services.systems.placement import harness_spec

    return with_findings(report, harness_route_findings(
        system.harness_checks, {h["id"]: h["cut_length_mm"] for h in system.harnesses},
        harness_spec.LENGTH_MISMATCH_TOLERANCE))


def _harness_rules(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """§17.2 per harness, in harness order: V01, V03, V04, V09, V10, V19, V23 on ends and wires."""
    from app.services.systems import harnesses as harnesses_module

    for harness in system.harnesses:
        report = with_findings(report, harnesses_module.findings(
            harness, system.end_components.get(harness["id"]) or {}, system.overrides, system.optional_rules,
            make_finding))
    return report


def _mate_pairs(report: dict, system: SystemFacts, mates: Optional[MateCatalog], _scene_key: str) -> dict:
    """SYS-V18 from the catalog's mates-with pairs (an input)."""
    return with_findings(report, mate_pair_findings(system.links, system.harnesses, system.interfaces, mates))


def _subports(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SYS-V21 (P2 §22.4)."""
    return with_findings(report, subport_findings(system.subports, system.interfaces))


def _renames(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SB2-106 (P2 §23.4): a SYS-V09 finding on a net with an open rename proposal says so."""
    from app.services.systems import renames as renames_module

    return {**report, "findings": renames_module.annotate(report["findings"], system.links, system.open_renames)}


def _collisions(report: dict, system: SystemFacts, _mates: Any, scene_key: str) -> dict:
    """SYS-V22 from the last check while it matches this placement (P2 §24.2)."""
    return collision_report(report, system.collision_check, scene_key)


def _waivers(report: dict, system: SystemFacts, _mates: Any, _scene_key: str) -> dict:
    """SB2-100 (D-P2-56): waivers last, over every finding above."""
    return apply_waivers(report, system.waivers)


# The report is these stages in this order. Each stage merges its findings (re-sorted), so the order
# only shows where it changes data: rename notes cover the findings before them, the collision state
# is added after them, and waivers see every finding.
STAGES = (
    ("structural", _structural),
    ("children", _children),
    ("mating_stale", _mating_stale),
    ("mate_mismatch", _mate_mismatch),
    ("harness_routes", _harness_routes),
    ("harness_rules", _harness_rules),
    ("mate_pairs", _mate_pairs),
    ("subports", _subports),
    ("renames", _renames),
    ("collisions", _collisions),
    ("waivers", _waivers),
)


def report(system: SystemFacts, *, mates: Optional[MateCatalog], scene_key: str) -> dict:
    """The whole validation report of one system, waivers included (CONTRACTS_P2 §8.4, §8.5):
    ``{findings, notEvaluated, exempt, counts, collisionCheck, waivers}``. ``mates`` is the catalog's
    answer for SYS-V18 (None when the catalog could not be read or no part has an MPN); ``scene_key``
    is the placement the stored collision check must match."""
    out: dict = {}
    for _name, stage in STAGES:
        out = stage(out, system, mates, scene_key)
    return out
