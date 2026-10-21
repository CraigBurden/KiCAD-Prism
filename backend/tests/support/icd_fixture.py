"""A hand-made system document and bundle for the ICD tests.

No real board, project or company names: a "Fixture rig" whose Alpha and Beta
boards are mated pin to pin, an export with interface pin names, a harness
with a direct wire, a splice and a loose end, and a third, restricted board
(Gamma). ``project_names`` is what the service resolves to display names.
"""

from __future__ import annotations

import copy

from app.system_builder.document import new_document
from app.system_builder.icd.model import IcdModel, build

SYSTEM = "Fixture rig"
VERSION = 2
BUNDLE_KEY = "c" * 64
HARNESS = "har_h"
LABEL = "H1"

VISIBLE_PROJECT = "prj_alpha"
OTHER_PROJECT = "prj_beta"
HIDDEN_PROJECT = "prj_gamma"

PROJECT_NAMES = {
    VISIBLE_PROJECT: "Alpha Board",
    OTHER_PROJECT: "Beta Board",
    HIDDEN_PROJECT: "Gamma Board",
}

COMMIT_A = "a" * 40
COMMIT_B = "b" * 40
COMMIT_C = "c" * 40

OCCURRENCES = (
    {
        "id": "occ_a", "label": "Alpha",
        "source": {"kind": "board", "projectId": VISIBLE_PROJECT,
                   "track": {"kind": "pinned", "commit": COMMIT_A}},
    },
    {
        "id": "occ_b", "label": "Beta",
        "source": {"kind": "board", "projectId": OTHER_PROJECT,
                   "track": {"kind": "followed", "branch": "main", "commit": COMMIT_B}},
    },
    {
        "id": "occ_c", "label": "Gamma",
        "source": {"kind": "board", "projectId": HIDDEN_PROJECT,
                   "track": {"kind": "pinned", "commit": COMMIT_C}},
    },
)

MATES = (
    {
        "id": "mate_ab",
        "a": {"occurrence": "occ_a", "connector": "J1"},
        "b": {"occurrence": "occ_b", "connector": "J1"},
        # The derived pair order is deliberately not side A's pad order.
        "rows": {"10": {"signal": "=ALERT()"}},
    },
    {
        "id": "mate_ac",
        "a": {"occurrence": "occ_a", "connector": "J2"},
        "b": {"occurrence": "occ_c", "connector": "J1"},
        "rows": {},
    },
)

EXPORTS = (
    {
        "id": "exp_a", "name": "Main interface",
        "site": {"occurrence": "occ_a", "connector": "J1"},
        "pinNames": {"1": "VIN", "2": "RET"},
    },
)

WIRES = (
    {
        "id": "wire_direct", "origin": "explicit",
        "from": {"kind": "contact", "end": "end_a", "cavity": "2", "pad": "2"},
        "to": {"kind": "contact", "end": "end_b", "cavity": "1", "pad": "1"},
        "gaugeAwg": "22", "colour": "red", "net": "net_gnd",
        "lengthNm": 45_000_000,
    },
    {
        "id": "wire_splice_a", "origin": "explicit",
        "from": {"kind": "contact", "end": "end_a", "cavity": "1", "pad": "1"},
        "to": {"kind": "splice", "splice": "sp_1"},
        "gaugeAwg": "24", "colour": "black", "net": "net_vbat",
        "lengthNm": 30_000_000,
    },
    {
        "id": "wire_splice_b", "origin": "explicit",
        "from": {"kind": "splice", "splice": "sp_1"},
        "to": {"kind": "contact", "end": "end_b", "cavity": "2", "pad": "2"},
        "gaugeAwg": "24", "colour": "black", "net": "net_vbat",
        "lengthNm": 35_000_000,
    },
    {
        "id": "wire_loose", "origin": "explicit",
        "from": {"kind": "contact", "end": "end_a", "cavity": "10", "pad": "10"},
        "to": {"kind": "loose", "looseEnd": "le_1"},
        "gaugeAwg": "26", "colour": "white", "net": "net_alert",
    },
)


def harness() -> dict:
    return {
        "id": HARNESS,
        "label": LABEL,
        "ends": [
            {"id": "end_a", "site": {"occurrence": "occ_a", "connector": "J1"}},
            {"id": "end_b", "site": {"occurrence": "occ_b", "connector": "J1"}},
        ],
        "wires": [copy.deepcopy(wire) for wire in WIRES],
        "splices": [{"id": "sp_1", "method": "crimp"}],
        "looseEnds": [{"id": "le_1", "kind": "pigtail", "label": "Pigtail"}],
        "links": [],
        "branchPoints": [],
        "segments": [],
        "coverings": [],
        "cables": [],
        "markers": [],
        "waypoints": [],
    }


def document(*, redacted: bool = False) -> dict:
    doc = new_document(SYSTEM)
    doc["occurrences"] = copy.deepcopy(list(OCCURRENCES))
    doc["mates"] = copy.deepcopy(list(MATES))
    doc["exports"] = copy.deepcopy(list(EXPORTS))
    doc["harnesses"] = [harness()]
    if redacted:
        doc["occurrences"][2]["source"] = {"kind": "redacted"}
        doc["mates"][1]["rows"] = {}
        doc["exports"] = [item for item in doc["exports"] if item["site"]["occurrence"] != "occ_c"]
    return doc


def _connectors() -> list[dict]:
    return [
        {
            "occurrence": "occ_a", "state": "ready",
            "connectors": [
                {
                    "refdes": "J1", "value": "Conn 3P", "mpn": "MPN-A",
                    "pins": [
                        {"pad": "1", "net": "/PWR/VBAT", "pinName": "VBAT_IN"},
                        {"pad": "2", "net": "/PWR/GND", "pinName": "GND"},
                        {"pad": "10", "net": "/SIG/ALERT", "pinName": "ALERT"},
                    ],
                },
                {
                    "refdes": "J2", "value": "Conn 1P", "mpn": "MPN-A2",
                    "pins": [{"pad": "1", "net": "/PWR/GND", "pinName": "GND"}],
                },
            ],
        },
        {
            "occurrence": "occ_b", "state": "ready",
            "connectors": [{
                "refdes": "J1", "value": "Conn 3P", "mpn": "MPN-B",
                "pins": [
                    {"pad": "1", "net": "/PWR/GND", "pinName": "GND"},
                    {"pad": "2", "net": "/PWR/VBAT", "pinName": "VBAT"},
                    {"pad": "10", "net": "/SIG/ALERT_B", "pinName": "ALERT_B"},
                ],
            }],
        },
        {
            "occurrence": "occ_c", "state": "ready",
            "connectors": [{
                "refdes": "J1", "value": "Conn 1P", "mpn": "MPN-C",
                "pins": [{"pad": "1", "net": "/Secret/SECRET", "pinName": "SECRET"}],
            }],
        },
    ]


def _nets() -> list[dict]:
    return [
        {
            "id": "net_vbat", "name": "VBAT",
            "boardNets": [
                {"occurrence": "occ_a", "net": "/PWR/VBAT"},
                {"occurrence": "occ_b", "net": "/PWR/VBAT"},
            ],
            "pins": [
                {"occurrence": "occ_a", "connector": "J1", "pad": "1"},
                {"occurrence": "occ_b", "connector": "J1", "pad": "2"},
            ],
        },
        {
            "id": "net_gnd", "name": "GND",
            "boardNets": [
                {"occurrence": "occ_a", "net": "/PWR/GND"},
                {"occurrence": "occ_b", "net": "/PWR/GND"},
            ],
            "pins": [
                {"occurrence": "occ_a", "connector": "J1", "pad": "2"},
                {"occurrence": "occ_b", "connector": "J1", "pad": "1"},
            ],
        },
        {
            "id": "net_alert", "name": "ALERT",
            "boardNets": [{"occurrence": "occ_a", "net": "/SIG/ALERT"}],
            "pins": [{"occurrence": "occ_a", "connector": "J1", "pad": "10"}],
        },
        {
            "id": "net_secret", "name": "SECRET",
            "boardNets": [{"occurrence": "occ_c", "net": "/Secret/SECRET"}],
            "pins": [{"occurrence": "occ_c", "connector": "J1", "pad": "1"}],
        },
    ]


def bundle(*, redacted: bool = False) -> dict:
    connectors = _connectors()
    if redacted:
        connectors[2] = {"occurrence": "occ_c", "state": "redacted", "connectors": []}
    mates = (
        {"mate": "mate_ab", "pairs": [{"a": "10", "b": "10"}, {"a": "2", "b": "1"}]},
        {"mate": "mate_ac", "pairs": [{"a": "1", "b": "1"}]},
    )
    return {
        "schema": "prism.system_bundle.a0",
        "occurrences": connectors,
        "nets": _nets(),
        "mates": list(mates),
        "links": [],
        "harnesses": [{
            "harness": HARNESS,
            "ends": [
                {
                    "end": "end_a", "site": {"occurrence": "occ_a", "connector": "J1"},
                    "cavities": [
                        {"cavity": "1", "pad": "1", "net": "net_vbat"},
                        {"cavity": "2", "pad": "2", "net": "net_gnd"},
                        {"cavity": "10", "pad": "10", "net": "net_alert"},
                    ],
                },
                {
                    "end": "end_b", "site": {"occurrence": "occ_b", "connector": "J1"},
                    "cavities": [
                        {"cavity": "1", "pad": "1", "net": "net_gnd"},
                        {"cavity": "2", "pad": "2", "net": "net_vbat"},
                    ],
                },
            ],
            "wires": [copy.deepcopy(wire) for wire in WIRES],
        }],
        "suggestions": [],
        "findings": [],
    }


def model(
    *,
    redacted: bool = False,
    project_names: dict[str, str] | None = None,
) -> IcdModel:
    return build(
        document(redacted=redacted),
        bundle(redacted=redacted),
        system=SYSTEM,
        version=VERSION,
        bundle_key=BUNDLE_KEY,
        project_names=PROJECT_NAMES if project_names is None else project_names,
    )


def many_connections(count: int = 300) -> IcdModel:
    """The fixture with ``count`` contact-to-contact harness wires."""

    document_data = document()
    bundle_data = bundle()
    wires = [
        {
            "id": f"wire_{index:04d}", "origin": "explicit",
            "from": {"kind": "contact", "end": "end_a", "cavity": str(index), "pad": str(index)},
            "to": {"kind": "contact", "end": "end_b", "cavity": str(index), "pad": str(index)},
            "gaugeAwg": "24", "colour": "black", "net": "net_gnd",
        }
        for index in range(1, count + 1)
    ]
    document_data["harnesses"][0]["wires"] = copy.deepcopy(wires)
    bundle_data["harnesses"][0]["wires"] = wires
    return build(
        document_data, bundle_data,
        system=SYSTEM, version=VERSION, bundle_key=BUNDLE_KEY,
        project_names=PROJECT_NAMES,
    )


def project_for_role(project_id: str, role: str) -> dict | None:
    """A project row as the workspace lookup returns it, for the API tests."""

    name = PROJECT_NAMES.get(project_id)
    if name is None:
        return None
    return {"id": project_id, "name": project_id, "display_name": name}
