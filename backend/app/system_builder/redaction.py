"""Restricted boards, by today's rule (docs/system-builder/CONTRACTS.md §6).

A caller who cannot see a board occurrence's project sees the occurrence by
its label only. :func:`redact` returns the document as that caller reads it;
:func:`protected_ids` names every object a request from that caller may not
touch. The stored document is never redacted.
"""

from __future__ import annotations

from typing import Any, Callable, Mapping

from app.system_builder.document import clone

REDACTED_SOURCE = {"kind": "redacted"}


def hidden_occurrences(document: Mapping[str, Any], can_see_project: Callable[[str], bool]) -> frozenset[str]:
    """Board occurrences whose project the caller cannot see."""

    seen: dict[str, bool] = {}
    hidden = set()
    for occurrence in document["occurrences"]:
        source = occurrence["source"]
        if source["kind"] != "board":
            continue
        project_id = source["projectId"]
        if project_id not in seen:
            seen[project_id] = can_see_project(project_id)
        if not seen[project_id]:
            hidden.add(occurrence["id"])
    return frozenset(hidden)


def _on_hidden(endpoint: Mapping[str, Any] | None, hidden: frozenset[str]) -> bool:
    return bool(endpoint) and endpoint.get("occurrence") in hidden


def _hidden_ends(harness: Mapping[str, Any], hidden: frozenset[str]) -> set[str]:
    return {end["id"] for end in harness["ends"] if _on_hidden(end.get("site"), hidden)}


def _on_hidden_end(terminal: Mapping[str, Any], ends: set[str]) -> bool:
    return terminal.get("kind") == "contact" and terminal.get("end") in ends


def protected_ids(document: Mapping[str, Any], hidden: frozenset[str]) -> frozenset[str]:
    """Ids (and touched keys) a caller with these hidden occurrences may not change."""

    ids: set[str] = set(hidden)
    ids |= {f"layout:{occurrence}" for occurrence in hidden}
    ids |= {item["id"] for item in document["subPorts"] + document["bodyConnectors"] if item["occurrence"] in hidden}
    ids |= {mate["id"] for mate in document["mates"] if _on_hidden(mate["a"], hidden) or _on_hidden(mate["b"], hidden)}
    ids |= {export["id"] for export in document["exports"] if _on_hidden(export["site"], hidden)}
    ids |= {
        f"dismissed:{item['occurrence']}|{item['connector']}|{item['key']}"
        for item in document["dismissedSuggestions"]
        if item["occurrence"] in hidden
    }
    for harness in document["harnesses"]:
        ends = _hidden_ends(harness, hidden)
        ids |= ends
        ids |= {link["id"] for link in harness["links"] if _on_hidden(link["a"], hidden) or _on_hidden(link["b"], hidden)}
        wires = {wire["id"] for wire in harness["wires"] if _on_hidden_end(wire["from"], ends) or _on_hidden_end(wire["to"], ends)}
        ids |= wires
        ids |= {marker["id"] for marker in harness["markers"] if marker["wire"] in wires}
    return frozenset(ids)


def redact(document: Mapping[str, Any], hidden: frozenset[str]) -> dict[str, Any]:
    """The document as a caller who cannot see ``hidden`` reads it."""

    if not hidden:
        return clone(document)
    view = clone(document)
    for occurrence in view["occurrences"]:
        if occurrence["id"] in hidden:
            occurrence["source"] = dict(REDACTED_SOURCE)
    for sub_port in view["subPorts"]:
        if sub_port["occurrence"] in hidden:
            sub_port["pins"] = []
            sub_port.pop("suggestion", None)
    view["dismissedSuggestions"] = [item for item in view["dismissedSuggestions"] if item["occurrence"] not in hidden]
    for mate in view["mates"]:
        if _on_hidden(mate["a"], hidden) or _on_hidden(mate["b"], hidden):
            mate["rows"] = {}
            mate.pop("manualMap", None)
    for export in view["exports"]:
        if _on_hidden(export["site"], hidden):
            export["pinNames"] = {}
    for harness in view["harnesses"]:
        ends = _hidden_ends(harness, hidden)
        for end in harness["ends"]:
            if end["id"] in ends:
                end["pinMap"] = []
                end["contacts"] = {}
        for link in harness["links"]:
            if _on_hidden(link["a"], hidden):
                link["unmapped"] = []
        for wire in harness["wires"]:
            for side in ("from", "to"):
                if _on_hidden_end(wire[side], ends):
                    wire[side] = {"kind": "contact", "end": wire[side]["end"], "cavity": ""}
    return view
