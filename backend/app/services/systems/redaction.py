"""O1 redaction of a system document (``docs/system-builder/CONTRACTS.md`` §8.2).

Documents are built unredacted and redacted for the reader last. That is what
lets a snapshot store the full document once and redact it on every read,
for whoever reads it then (§9.1).
"""

from __future__ import annotations

import copy
from typing import Any, Collection, Iterable, Mapping


class Restricted(frozenset):
    """What a reader may not see (P2 §5.4): restricted instance IDs, plus ``hidden_ports``, the
    ``(assembly instance, export)`` ends whose source board inside the child is hidden. Such an end
    keeps its pins but not their nets. Truthy when either is non-empty; ``|`` merges both."""

    hidden_ports: frozenset = frozenset()

    def __new__(cls, instances: Iterable[str] = (), hidden_ports: Iterable[tuple[str, str]] = ()):
        made = super().__new__(cls, instances)
        made.hidden_ports = frozenset(hidden_ports)
        return made

    def __bool__(self) -> bool:
        return bool(len(self) or self.hidden_ports)

    def __or__(self, other: Collection[str]) -> "Restricted":
        return Restricted(frozenset(self) | frozenset(other), self.hidden_ports | hidden_ports(other))

    __ror__ = __or__


def hidden_ports(restricted: Collection[str]) -> frozenset:
    return getattr(restricted, "hidden_ports", frozenset())


def _hides_nets(end: Mapping[str, Any], ports: frozenset) -> bool:
    port = end.get("port") or {}
    return (end.get("instanceId"), port.get("portKey")) in ports


def redact_instance(instance: Mapping[str, Any]) -> dict:
    return {
        "id": instance["id"], "label": instance["label"], "restricted": True, "redacted": True,
        "projectId": None, "projectName": None, "baselineCommit": None, "trackedRef": None,
        "pinned": instance["pinned"], "resolution": instance["resolution"],
        "projectDeleted": instance.get("projectDeleted", False),
        "tipCommit": None, "tipCheckedAt": None, "updateAvailable": None,
        "interface": None, "ports": None,
        # P2 §22.5: sub-port names stay (links name them); the connector and pads do not.
        "subports": [{"id": sub["id"], "portKey": None, "name": sub["name"], "pads": None}
                     for sub in instance.get("subports") or []],
    }


def redact_export(export: Mapping[str, Any], restricted: Collection[str]) -> Mapping[str, Any]:
    """An export entry as the reader sees it: one on a hidden board keeps its name, not its port."""
    if export["instanceId"] in restricted:
        return {**export, "portKey": None, "port": None, "resolved": None, "redacted": True}
    return export


def redact_link(link: Mapping[str, Any], restricted: Collection[str]) -> dict:
    out = copy.deepcopy(dict(link))
    hidden = [end for end in ("a", "b") if out[end]["instanceId"] in restricted]
    # An end on an export whose board is hidden keeps the export and pins, not the nets (P2 §5.4).
    netless = [end for end in ("a", "b") if end not in hidden and _hides_nets(out[end], hidden_ports(restricted))]
    for end in hidden:
        out[end] = {"instanceId": out[end]["instanceId"], "redacted": True, "port": None,
                    "resolved": None, "exposed": None, "subport": out[end].get("subport")}
    for end in netless:
        out[end]["export"] = None
    for row in out["rows"]:
        for end in netless:
            column = end.upper()
            row[f"net{column}"] = row[f"observed{column}"] = None
        hidden_or_netless = hidden + netless
        for end in hidden:
            column = end.upper()
            row[f"pin{column}"] = row[f"net{column}"] = row[f"observed{column}"] = None
        row["redactedEnds"] = sorted(set(row.get("redactedEnds") or []) | set(hidden_or_netless))
        row["redacted"] = bool(row["redactedEnds"])
    return out


def redact_harness(harness: Mapping[str, Any], restricted: Collection[str]) -> dict:
    """CONTRACTS_P2 §17: an end on a hidden board keeps its place but not its connector or nets."""
    out = copy.deepcopy(dict(harness))
    if not restricted:
        return out
    hidden = {end["id"] for end in out["ends"] if end["mates"] and end["mates"]["instanceId"] in restricted}
    ports = hidden_ports(restricted)
    netless = {end["id"] for end in out["ends"] if end["mates"] and end["id"] not in hidden
               and (end["mates"]["instanceId"], end["mates"].get("portKey")) in ports}
    for end in out["ends"]:
        if end["id"] in hidden:
            end["mates"] = {"instanceId": end["mates"]["instanceId"], "portKey": None, "port": None,
                            "redacted": True, "resolved": None}
            end["pins"] = []
    for wire in out["wires"]:
        sides = [side for side in ("from", "to") if wire[side]["end"] in hidden | netless]
        for side in sides:
            wire["netFrom" if side == "from" else "netTo"] = None
        wire["redactedEnds"] = sorted(set(wire.get("redactedEnds") or []) | set(sides))
    return out


def redact_findings(report: Mapping[str, Any], restricted: Collection[str]) -> dict:
    out = copy.deepcopy(dict(report))
    ports = hidden_ports(restricted)
    hidden_keys: set[str] = set()
    for finding in out.get("findings") or []:
        if (finding.get("instanceId"), finding.get("portKey")) in ports:
            finding.update(detail=None, redacted=True)
        elif finding["instanceId"] in restricted:
            hidden_keys.add(finding.get("key") or "")
            # The key (SB2-100) names the reference and pin too.
            finding.update(reference=None, pin=None, detail=None, key=None, redacted=True)
        else:
            finding.setdefault("redacted", False)
    for entry in out.get("exempt") or []:
        if entry["instanceId"] in restricted:
            entry.update(reference=None, pin=None, portKey=None, redacted=True)
    # SB2-100: a waiver on a finding the reader can't see keeps neither its note nor its key (which
    # names a reference and pin); its instance is the key's second part.
    for finding in out.get("findings") or []:
        if finding.get("redacted") and finding.get("waived"):
            finding["waived"] = {**finding["waived"], "note": None}
    for waiver in out.get("waivers") or []:
        key = waiver.get("findingKey") or ""
        if key in hidden_keys or (key.split("|") + ["", ""])[1] in restricted:
            waiver.update(findingKey=None, note=None, redacted=True)
        else:
            waiver.setdefault("redacted", False)
    return out


def redact_document(document: Mapping[str, Any], restricted: Collection[str]) -> dict:
    """A copy of ``document`` as a reader who cannot see ``restricted`` instances sees it."""

    if not restricted:
        # SB2-93: nothing changes, and the document is built per request, so no copy is needed.
        return dict(document)
    out = copy.deepcopy(dict(document))
    out["instances"] = [redact_instance(i) if i["id"] in restricted else i for i in out["instances"]]
    out["exports"] = [redact_export(e, restricted) for e in out.get("exports") or []]
    out["links"] = [redact_link(link, restricted) for link in out["links"]]
    out["harnesses"] = [redact_harness(h, restricted) for h in out.get("harnesses") or []]
    # P2 §23: a proposal for a board the reader cannot see names none of its nets.
    out["renames"] = [{**r, "net": None, "name": None, "note": None, "rows": None, "redacted": True}
                      if r["instanceId"] in restricted else r for r in out.get("renames") or []]
    if out.get("validation") is not None:
        out["validation"] = redact_findings(out["validation"], restricted)
    return out
