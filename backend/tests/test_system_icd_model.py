"""The ICD model (docs/system-builder/CONTRACTS.md §17).

Occurrences and their sources, interfaces with the export's pin names, mate
pairs in natural order, harness rows (direct, through a splice, open), the
crossing system nets with the local count, and a restricted occurrence's pins.
"""

from __future__ import annotations

import unittest

from support import icd_fixture as fixture


class IcdModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = fixture.model()

    def test_occurrences_name_their_source_and_a_restricted_board_says_so(self) -> None:
        self.assertEqual(
            [(item.label, item.kind) for item in self.model.occurrences],
            [("Alpha", "board"), ("Beta", "board"), ("Gamma", "board")],
        )
        self.assertEqual(
            [item.source for item in self.model.occurrences],
            [
                f"Alpha Board @ {'a' * 10} (pinned)",
                f"Beta Board @ {'b' * 10} (follows main)",
                f"Gamma Board @ {'c' * 10} (pinned)",
            ],
        )
        restricted = fixture.model(redacted=True).occurrences[2]
        self.assertEqual((restricted.label, restricted.kind, restricted.source),
                         ("Gamma", "redacted", "restricted"))

    def test_interfaces_take_the_exports_pin_names_then_the_board_pin_name(self) -> None:
        interface = self.model.interfaces[0]
        self.assertEqual((interface.name, interface.site), ("Main interface", "J1 · Alpha"))
        self.assertEqual(
            [(pin.pad, pin.name, pin.net) for pin in interface.pins],
            [("1", "VIN", "VBAT"), ("2", "RET", "GND"), ("10", "ALERT", "ALERT")],
        )

    def test_mate_pairs_are_in_side_as_natural_pad_order(self) -> None:
        mated = [row for row in self.model.connections if row.kind == "b2b"]
        self.assertEqual(
            [(row.a.pad, row.b.pad) for row in mated[:2]], [("2", "1"), ("10", "10")]
        )
        first, second = mated[:2]
        self.assertEqual(first.group, "J1 · Alpha ↔ J1 · Beta")
        self.assertEqual(first.via, "mated")
        self.assertEqual((first.a.name, first.a.net), ("GND", "/PWR/GND"))
        self.assertEqual((first.b.name, first.b.net), ("GND", "/PWR/GND"))
        self.assertEqual(first.note, "")
        self.assertEqual(second.detail, "=ALERT()")
        self.assertEqual(second.note, "net names differ")

    def test_harness_rows_cover_a_direct_wire_a_splice_and_an_open_end(self) -> None:
        rows = [row for row in self.model.connections if row.kind == "harness"]
        self.assertEqual([row.group for row in rows], ["Harness H1"] * 3)
        self.assertEqual([row.via for row in rows], ["W2", "W1 · SP1 · W4", "W3"])

        direct, spliced, loose = rows
        self.assertEqual((direct.a.occurrence, direct.a.pad, direct.b.occurrence, direct.b.pad),
                         ("Alpha", "2", "Beta", "1"))
        self.assertEqual(direct.detail, "22 AWG RD 45 mm")
        self.assertEqual(
            spliced.detail, "24 AWG BK 30 mm / 24 AWG BK 35 mm"
        )
        self.assertEqual((loose.a.occurrence, loose.b.occurrence), ("Alpha", "LE1"))
        self.assertEqual((loose.b.name, loose.b.net), ("pigtail", ""))
        self.assertEqual(loose.note, "open end (pigtail)")

    def test_only_crossing_nets_are_listed_and_the_rest_are_counted(self) -> None:
        self.assertEqual([net.name for net in self.model.nets], ["VBAT", "GND"])
        self.assertEqual(self.model.nets[0].board_nets, ("Alpha: /PWR/VBAT", "Beta: /PWR/VBAT"))
        self.assertEqual(self.model.nets[0].pins, ("Alpha J1.1", "Beta J1.2"))
        self.assertEqual(self.model.nets[1].pins, ("Alpha J1.2", "Beta J1.1"))
        self.assertEqual(self.model.local_nets, 2)
        self.assertFalse(any(net.name == "ALERT" for net in self.model.nets))

    def test_a_restricted_occurrences_pins_read_restricted(self) -> None:
        model = fixture.model(redacted=True)
        row = next(item for item in model.connections if item.group.startswith("J2 · Alpha"))
        self.assertEqual(row.b.occurrence, "Gamma")
        self.assertEqual(row.b.name, "restricted")
        self.assertEqual(row.b.net, "")
        self.assertNotIn("SECRET", repr(model))
        self.assertNotIn("/Secret/SECRET", repr(model))


if __name__ == "__main__":
    unittest.main()
