"""A hand-made system document and bundle for the harness output tests.

No real board, project or company names: a "Demo rig" with a Controller and a
Sensor, two ends, explicit and default wires, a splice, a loose end, a cable, a
covering and a routed tree through ``bp_1``. The parts are a fake catalog
(``PARTS``); ``cmp_missing@rev_x`` is deliberately absent.
"""

from __future__ import annotations

from app.system_builder.harness_outputs.model import HarnessModel, Part, build

SYSTEM = "Demo rig"
VERSION = 3
BUNDLE_KEY = "a" * 64
HARNESS = "har_h"
LABEL = "H1"
VISIBLE_PROJECT = "prj_demo_controller"
HIDDEN_PROJECT = "prj_demo_sensor"

OCCURRENCES = (
    {"id": "occ_a", "label": "Controller", "source": {"kind": "board", "projectId": VISIBLE_PROJECT}},
    {"id": "occ_b", "label": "Sensor", "source": {"kind": "board", "projectId": HIDDEN_PROJECT}},
)

PARTS: dict[str, Part] = {
    "cmp_housing@rev_h": Part("cmp_housing@rev_h", "Housing 4-way", "H-4", "Demo Components", "4-way housing"),
    "cmp_contact@rev_c": Part("cmp_contact@rev_c", "Contact 22-28", "C-22", "Demo Components", "Crimp contact"),
    "cmp_cable@rev_cab": Part("cmp_cable@rev_cab", "Cable 2-core", "CB-2", "Demo Components", "Shielded cable"),
    "cmp_sleeve@rev_s": Part("cmp_sleeve@rev_s", "Sleeve 6 mm", "S-6", "Boreal", "Heat-shrink sleeve"),
}

MISSING = "cmp_missing@rev_x"


def lookup(reference: str) -> Part | None:
    return PARTS.get(reference)


def document() -> dict:
    harness = {
        "id": HARNESS,
        "label": LABEL,
        "ends": [
            {
                "id": "end_a",
                "site": {"occurrence": "occ_a", "connector": "J1"},
                "housing": {"componentId": "cmp_housing", "revisionId": "rev_h"},
                "contacts": {
                    "1": {"componentId": "cmp_contact", "revisionId": "rev_c"},
                    "2": {"componentId": "cmp_contact", "revisionId": "rev_c"},
                    "10": {"componentId": "cmp_missing", "revisionId": "rev_x"},
                },
            },
            {
                "id": "end_b",
                "site": {"occurrence": "occ_b", "connector": "J1"},
                "housing": {"componentId": "cmp_housing", "revisionId": "rev_h"},
                "contacts": {"1": {"componentId": "cmp_contact", "revisionId": "rev_c"}},
            },
        ],
        "wires": [
            {
                "id": "wire_a1", "origin": "explicit",
                "from": {"kind": "contact", "end": "end_a", "cavity": "1", "pad": "1"},
                "to": {"kind": "contact", "end": "end_b", "cavity": "1", "pad": "1"},
                "lengthNm": 45_000_000,
            },
            {
                "id": "wire_sp", "origin": "explicit",
                "from": {"kind": "contact", "end": "end_a", "cavity": "2", "pad": "2"},
                "to": {"kind": "splice", "splice": "sp_1"},
                "label": "=EVIL()",
            },
            {
                "id": "wire_le", "origin": "explicit",
                "from": {"kind": "contact", "end": "end_a", "cavity": "10", "pad": "10"},
                "to": {"kind": "loose", "looseEnd": "le_1"},
                "label": "@LED",
            },
        ],
        "splices": [{"id": "sp_1", "method": "crimp"}],
        "looseEnds": [{"id": "le_1", "kind": "pigtail", "label": "Pigtail", "lengthNm": 25_000_000}],
        "cables": [
            {
                "id": "cab_1", "label": "Cable A",
                "part": {"componentId": "cmp_cable", "revisionId": "rev_cab"},
                "conductors": [{"name": "1", "wire": "wire_a1"}, {"name": "drain", "drain": True}],
            }
        ],
        "coverings": [
            {
                "id": "cov_1", "segment": "seg_1", "kind": "heat-shrink",
                "part": {"componentId": "cmp_sleeve", "revisionId": "rev_s"},
            }
        ],
        "branchPoints": [{"id": "bp_1", "position": {"xNm": 10_000_000, "yNm": 0, "zNm": 0}}],
        "segments": [],
        "markers": [{"id": "mk_1", "kind": "label", "wire": "wire_a1", "text": "PWR"}],
        "waypoints": [],
        "links": [],
    }
    return {"schema": "prism.system.v2", "name": SYSTEM, "occurrences": list(OCCURRENCES), "harnesses": [harness]}


def bundle() -> dict:
    return {
        "schema": "prism.system_bundle.a0",
        "occurrences": [
            {
                "occurrence": "occ_a", "state": "ready",
                "connectors": [{
                    "refdes": "J1", "value": "Conn 4P", "mpn": "MPN-A",
                    "pins": [
                        {"pad": "1", "net": "/Power/VBAT", "pinName": "1"},
                        {"pad": "2", "net": "/Power/GND", "pinName": "2"},
                        {"pad": "10", "net": "/Status/LED", "pinName": "10"},
                    ],
                }],
            },
            {
                "occurrence": "occ_b", "state": "ready",
                "connectors": [{
                    "refdes": "J1", "value": "Conn 4P", "mpn": "MPN-B",
                    "pins": [
                        {"pad": "1", "net": "/Private/SECRET", "pinName": "1"},
                        {"pad": "2", "net": "/Power/GND", "pinName": "2"},
                    ],
                }],
            },
        ],
        "nets": [
            {"id": "net_vbat", "name": "VBAT", "boardNets": [], "pins": [{"occurrence": "occ_a", "connector": "J1", "pad": "1"}]},
            {"id": "net_gnd", "name": "GND", "boardNets": [], "pins": [
                {"occurrence": "occ_a", "connector": "J1", "pad": "2"},
                {"occurrence": "occ_b", "connector": "J1", "pad": "2"},
            ]},
            {"id": "net_led", "name": "LED", "boardNets": [], "pins": [{"occurrence": "occ_a", "connector": "J1", "pad": "10"}]},
            {"id": "net_secret", "name": "SECRET", "boardNets": [], "pins": [{"occurrence": "occ_b", "connector": "J1", "pad": "1"}]},
        ],
        "harnesses": [{
            "harness": HARNESS,
            "ends": [
                {
                    "end": "end_a", "site": {"occurrence": "occ_a", "connector": "J1"},
                    "housing": "cmp_housing@rev_h",
                    "cavities": [
                        {"cavity": "1", "pad": "1", "net": "net_vbat", "contact": "cmp_contact@rev_c"},
                        {"cavity": "2", "pad": "2", "net": "net_gnd", "contact": "cmp_contact@rev_c"},
                        {"cavity": "10", "pad": "10", "net": "net_led", "contact": MISSING},
                    ],
                },
                {
                    "end": "end_b", "site": {"occurrence": "occ_b", "connector": "J1"},
                    "housing": "cmp_housing@rev_h",
                    "cavities": [
                        {"cavity": "1", "pad": "1", "net": "net_secret", "contact": "cmp_contact@rev_c"},
                        {"cavity": "2", "pad": "2", "net": "net_gnd", "contact": None},
                    ],
                },
            ],
            "wires": [
                {
                    "id": "wire_a1", "origin": "explicit",
                    "from": {"kind": "contact", "end": "end_a", "cavity": "1", "pad": "1"},
                    "to": {"kind": "contact", "end": "end_b", "cavity": "1", "pad": "1"},
                    "gaugeAwg": "22", "colour": "red", "net": "net_vbat",
                    "cable": "cab_1", "conductor": "1", "label": "PWR",
                    "routeLengthNm": 50_000_000,
                },
                {
                    "id": "wire_def", "origin": "default",
                    "from": {"kind": "contact", "end": "end_a", "cavity": "2", "pad": "2"},
                    "to": {"kind": "contact", "end": "end_b", "cavity": "2", "pad": "2"},
                    "gaugeAwg": "24", "colour": "black", "net": "net_gnd",
                    "label": "-12",
                    "routeLengthNm": 30_000_000,
                },
                {
                    "id": "wire_sp", "origin": "explicit",
                    "from": {"kind": "contact", "end": "end_a", "cavity": "2", "pad": "2"},
                    "to": {"kind": "splice", "splice": "sp_1"},
                    "gaugeAwg": "24", "colour": "white", "net": "net_gnd",
                    "label": "=EVIL()",
                },
                {
                    "id": "wire_le", "origin": "explicit",
                    "from": {"kind": "contact", "end": "end_a", "cavity": "10", "pad": "10"},
                    "to": {"kind": "loose", "looseEnd": "le_1"},
                    "net": "net_led",
                    "label": "@LED",
                },
            ],
            "route": {
                "derived": True,
                "segments": [
                    {"id": "seg_1", "from": "end_a", "to": "bp_1", "wires": ["wire_a1"],
                     "diameterNm": 3_000_000, "lengthNm": 120_000_000},
                    {"id": "seg_2", "from": "bp_1", "to": "end_b", "wires": ["wire_a1", "wire_def"],
                     "diameterNm": 4_000_000, "lengthNm": 80_000_000},
                    {"id": "seg_3", "from": "bp_1", "to": "auto", "wires": [],
                     "diameterNm": 2_000_000, "lengthNm": 20_000_000},
                ],
                "wires": [
                    {"wire": "wire_a1", "lengthNm": 50_000_000},
                    {"wire": "wire_def", "lengthNm": 30_000_000},
                ],
            },
        }],
    }


def model(
    document_data: dict | None = None,
    bundle_data: dict | None = None,
    *,
    system: str = SYSTEM,
    version: int = VERSION,
    bundle_key: str = BUNDLE_KEY,
) -> HarnessModel:
    built = build(
        document_data if document_data is not None else document(),
        bundle_data if bundle_data is not None else bundle(),
        HARNESS,
        lookup,
        system=system,
        version=version,
        bundle_key=bundle_key,
    )
    assert built is not None
    return built


def unrouted() -> HarnessModel:
    """The fixture with no route: nothing is routed, so ``segments`` is empty."""

    bundle_data = bundle()
    harness = bundle_data["harnesses"][0]
    harness.pop("route")
    for wire in harness["wires"]:
        wire.pop("routeLengthNm", None)
    return model(bundle_data=bundle_data)


def many_wires(count: int = 120) -> HarnessModel:
    """The fixture with ``count`` wires between the two ends and no route.

    Enough rows to push the wiring table past one sheet.
    """

    bundle_data = bundle()
    document_data = document()
    harness = bundle_data["harnesses"][0]
    harness.pop("route")
    document_data["harnesses"][0]["wires"] = []
    cavities_a = ("1", "2", "10")
    cavities_b = ("1", "2")
    harness["wires"] = [
        {
            "id": f"wire_{index:03d}",
            "origin": "explicit",
            "from": {"kind": "contact", "end": "end_a", "cavity": cavities_a[index % 3], "pad": cavities_a[index % 3]},
            "to": {"kind": "contact", "end": "end_b", "cavity": cavities_b[index % 2], "pad": cavities_b[index % 2]},
            "gaugeAwg": "24" if index % 2 else "26",
            "colour": "red" if index % 2 else "black",
            "net": "net_gnd",
        }
        for index in range(count)
    ]
    return model(document_data=document_data, bundle_data=bundle_data)
