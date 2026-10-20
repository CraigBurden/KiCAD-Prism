"""The published interface of §11.1: pins, names, nets and signals."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.system_builder.document import canonical, new_document  # noqa: E402
from app.system_builder.publishing import compute_interface  # noqa: E402


def document() -> dict:
    document = new_document("Interface")
    document["occurrences"] = [
        {
            "id": "occ_board",
            "label": "OBC",
            "source": {
                "kind": "board",
                "projectId": "prj_000000000001",
                "track": {"kind": "pinned", "commit": "a" * 40},
            },
        }
    ]
    document["subPorts"] = [
        {
            "id": "sub_can",
            "occurrence": "occ_board",
            "connector": "J2",
            "name": "CAN",
            "pins": ["4", "3"],
        }
    ]
    document["exports"] = [
        {
            "id": "exp_whole",
            "name": "OBC connector",
            "site": {"occurrence": "occ_board", "connector": "J2"},
            "pinNames": {"1": "VBUS", "5": ""},
        },
        {
            "id": "exp_can",
            "name": "CAN",
            "site": {
                "occurrence": "occ_board",
                "connector": "J2",
                "subPort": {"kind": "occurrence", "id": "sub_can"},
            },
            "pinNames": {"3": "CAN_H"},
        },
        {
            "id": "exp_board",
            "name": "Power",
            "site": {
                "occurrence": "occ_board",
                "connector": "J1",
                "subPort": {"kind": "board", "id": "bsp_power", "version": 2},
            },
            "pinNames": {},
        },
    ]
    return canonical(document)


def bundle() -> dict:
    return {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [
            {
                "occurrence": "occ_board",
                "state": "ready",
                "connectors": [
                    {
                        "refdes": "J1",
                        "value": "Power",
                        "candidate": True,
                        "pins": [
                            {"pad": "1", "nets": ["GND"], "pinName": "GND", "power": True},
                            {"pad": "2", "nets": ["VBUS"], "pinName": "VBUS", "power": True},
                        ],
                    },
                    {
                        "refdes": "J2",
                        "value": "CAN",
                        "candidate": True,
                        "pins": [
                            {"pad": "1", "nets": ["VBUS"], "pinName": "VCC", "power": True},
                            {"pad": "3", "nets": ["CAN_H"], "pinName": "CAN_P", "power": False},
                            {"pad": "4", "nets": ["CAN_L"], "pinName": "CAN_N", "power": False},
                            {"pad": "5", "nets": ["SHIELD"], "power": False},
                            {"pad": "6", "nets": ["SPARE"], "pinName": "Spare", "power": False},
                        ],
                    },
                ],
            }
        ],
        "nets": [
            {
                "id": "net-1111111111111111",
                "name": "VBUS",
                "names": ["VBUS"],
                "boardNets": [{"occurrence": "occ_board", "net": "VBUS"}],
                "pins": [{"occurrence": "occ_board", "connector": "J2", "pad": "1"}],
            },
            {
                "id": "net-2222222222222222",
                "name": "CAN_H",
                "names": ["CAN_H"],
                "boardNets": [{"occurrence": "occ_board", "net": "CAN_H"}],
                "pins": [{"occurrence": "occ_board", "connector": "J2", "pad": "3"}],
            },
            {
                "id": "net-3333333333333333",
                "name": "CAN_L",
                "names": ["CAN_L"],
                "boardNets": [{"occurrence": "occ_board", "net": "CAN_L"}],
                "pins": [{"occurrence": "occ_board", "connector": "J2", "pad": "4"}],
            },
            {
                "id": "net-4444444444444444",
                "name": "SHIELD",
                "names": ["SHIELD"],
                "boardNets": [{"occurrence": "occ_board", "net": "SHIELD"}],
                "pins": [{"occurrence": "occ_board", "connector": "J2", "pad": "5"}],
            },
            {
                "id": "net-5555555555555555",
                "name": "SPARE",
                "names": ["SPARE"],
                "boardNets": [{"occurrence": "occ_board", "net": "SPARE"}],
                "pins": [{"occurrence": "occ_board", "connector": "J2", "pad": "6"}],
            },
            {
                "id": "net-6666666666666666",
                "name": "GND",
                "names": ["GND"],
                "boardNets": [{"occurrence": "occ_board", "net": "GND"}],
                "pins": [{"occurrence": "occ_board", "connector": "J1", "pad": "1"}],
            },
            {
                "id": "net-7777777777777777",
                "name": "VBUS",
                "names": ["VBUS"],
                "boardNets": [{"occurrence": "occ_board", "net": "VBUS"}],
                "pins": [{"occurrence": "occ_board", "connector": "J1", "pad": "2"}],
            },
        ],
        "mates": [],
        "links": [],
        "splices": [],
        "suggestions": [],
        "findings": [],
        "placement": {
            "occurrences": [
                {
                    "occurrence": "occ_board",
                    "pose": {
                        "translation": {"xNm": 0, "yNm": 0, "zNm": 0},
                        "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
                    },
                    "source": "default",
                    "root": True,
                }
            ],
            "mates": [],
        },
    }


BOARD_SUB_PORTS = {
    "schema": "prism.board_sub_ports.a0",
    "subPorts": [
        {
            "id": "bsp_power",
            "projectId": "prj_000000000001",
            "connector": "J1",
            "name": "Power",
            "pins": ["2", "1"],
            "version": 2,
            "deleted": False,
            "previous": [],
        }
    ],
}


class InterfaceTests(unittest.TestCase):
    def test_exports_are_in_id_order_with_the_site_pin_order(self) -> None:
        interface = compute_interface(document(), bundle(), BOARD_SUB_PORTS)
        self.assertEqual(
            [export["id"] for export in interface["exports"]],
            ["exp_board", "exp_can", "exp_whole"],
        )
        exports = {export["id"]: export for export in interface["exports"]}
        # A whole connector keeps the board's natural pad order.
        self.assertEqual(
            [pin["pad"] for pin in exports["exp_whole"]["pins"]],
            ["1", "3", "4", "5", "6"],
        )
        # A sub-port keeps the user's order.
        self.assertEqual(
            [pin["pad"] for pin in exports["exp_can"]["pins"]], ["4", "3"]
        )
        self.assertEqual(
            [pin["pad"] for pin in exports["exp_board"]["pins"]], ["2", "1"]
        )

    def test_names_come_from_pin_names_then_the_board_then_the_pad(self) -> None:
        exports = {
            export["id"]: export
            for export in compute_interface(document(), bundle(), BOARD_SUB_PORTS)["exports"]
        }
        whole = {pin["pad"]: pin for pin in exports["exp_whole"]["pins"]}
        self.assertEqual(whole["1"]["name"], "VBUS")  # pinNames wins
        self.assertEqual(whole["3"]["name"], "CAN_P")  # the board's pin name
        self.assertEqual(whole["5"]["name"], "5")  # empty pinNames, no board name
        can = {pin["pad"]: pin for pin in exports["exp_can"]["pins"]}
        self.assertEqual(can["3"]["name"], "CAN_H")  # pinNames on a sub-port export
        self.assertEqual(can["4"]["name"], "CAN_N")

    def test_each_pin_carries_its_system_net_and_signal(self) -> None:
        exports = {
            export["id"]: export
            for export in compute_interface(document(), bundle(), BOARD_SUB_PORTS)["exports"]
        }
        whole = {pin["pad"]: pin for pin in exports["exp_whole"]["pins"]}
        self.assertEqual(whole["3"]["net"], "net-2222222222222222")
        self.assertEqual(whole["3"]["signal"], "CAN_H")
        self.assertEqual(whole["5"]["signal"], "SHIELD")
        self.assertEqual(exports["exp_whole"]["connector"], "J2")
        self.assertEqual(exports["exp_whole"]["occurrence"], "occ_board")

    def test_the_site_sub_port_is_carried_into_the_interface(self) -> None:
        exports = {
            export["id"]: export
            for export in compute_interface(document(), bundle(), BOARD_SUB_PORTS)["exports"]
        }
        self.assertEqual(exports["exp_can"]["subPort"], {"kind": "occurrence", "id": "sub_can"})
        self.assertEqual(
            exports["exp_board"]["subPort"],
            {"kind": "board", "id": "bsp_power", "version": 2},
        )
        self.assertNotIn("subPort", exports["exp_whole"])


if __name__ == "__main__":
    unittest.main()
