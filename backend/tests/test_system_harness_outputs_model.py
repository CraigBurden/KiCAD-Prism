"""The harness output model (docs/system-builder/CONTRACTS.md §16.7).

One model feeds the drawing, the CSVs and ``prism.harness.v1``: wires numbered
by their terminals, a typed length over a route length, ends, nodes, branch
points and the BOM.
"""

from __future__ import annotations

import unittest

from app.system_builder.harness_outputs.model import build
from support.harness_outputs_fixture import (
    BUNDLE_KEY,
    HARNESS,
    LABEL,
    SYSTEM,
    VERSION,
    bundle,
    document,
    lookup,
    model,
    unrouted,
)


class HarnessModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = model()

    def rows(self, kind: str):
        return [row for row in self.model.bom if row.kind == kind]

    def test_the_model_names_its_system_and_harness(self) -> None:
        self.assertEqual(
            (self.model.system, self.model.system_version, self.model.harness, self.model.label, self.model.bundle_key),
            (SYSTEM, VERSION, HARNESS, LABEL, BUNDLE_KEY),
        )

    def test_wires_are_numbered_by_their_terminals(self) -> None:
        self.assertEqual([wire.number for wire in self.model.wires], ["W1", "W2", "W3", "W4"])
        self.assertEqual(
            [wire.id for wire in self.model.wires], ["wire_a1", "wire_def", "wire_sp", "wire_le"]
        )
        self.assertEqual(
            [wire.origin for wire in self.model.wires], ["explicit", "default", "explicit", "explicit"]
        )

    def test_a_typed_length_wins_over_the_route_length(self) -> None:
        typed, routed, splice = self.model.wires[0], self.model.wires[1], self.model.wires[2]
        self.assertEqual((typed.length_nm, typed.typed_length), (45_000_000, True))
        self.assertEqual((routed.length_nm, routed.typed_length), (30_000_000, False))
        self.assertEqual((splice.length_nm, splice.typed_length), (None, False))

    def test_ends_carry_titles_connectors_signals_and_the_wires_landing_in_a_cavity(self) -> None:
        controller, sensor = self.model.ends
        self.assertEqual(controller.title, "J1 · Controller")
        self.assertEqual(sensor.title, "J1 · Sensor")
        self.assertEqual(controller.connector, "Conn 4P · MPN-A")
        self.assertEqual((controller.ways, len(controller.cavities)), (3, 3))
        self.assertEqual([cavity.signal for cavity in controller.cavities], ["VBAT", "GND", "LED"])
        self.assertEqual([cavity.net for cavity in controller.cavities], ["VBAT", "GND", "LED"])
        self.assertEqual(controller.cavities[1].wires, ("W2", "W3"))
        self.assertEqual(sensor.cavities[0].signal, "SECRET")
        self.assertEqual(sensor.cavities[0].wires, ("W1",))
        self.assertEqual(controller.housing.label, "H-4")
        self.assertEqual(controller.cavities[0].contact.label, "C-22")

    def test_a_splice_and_a_loose_end_are_named_and_carry_their_wires(self) -> None:
        self.assertEqual([node.name for node in self.model.nodes], ["SP1", "LE1"])
        splice, loose = self.model.nodes
        self.assertEqual((splice.kind, splice.detail, splice.wires), ("splice", "crimp", ("W3",)))
        self.assertEqual((loose.kind, loose.detail, loose.wires), ("pigtail", "Pigtail · 25 mm", ("W4",)))

    def test_branch_points_are_named_in_segment_order(self) -> None:
        self.assertEqual(self.model.node_names["bp_1"], "B1")
        self.assertEqual(self.model.node_names["auto"], "B2")
        self.assertEqual(self.model.node_names["end_a"], "J1 · Controller")
        self.assertTrue(self.model.routed)
        self.assertEqual([segment.id for segment in self.model.segments], ["seg_1", "seg_2", "seg_3"])
        self.assertEqual(self.model.segments[0].coverings, ("heat-shrink",))
        self.assertEqual(self.model.segments[1].wires, ("W1", "W2"))

    def test_cables_coverings_and_conductors_are_read_from_the_document(self) -> None:
        cable = self.model.cables[0]
        self.assertEqual((cable.id, cable.label, cable.part.label), ("cab_1", "Cable A", "CB-2"))
        self.assertEqual(
            [(conductor.name, conductor.wire, conductor.drain) for conductor in cable.conductors],
            [("1", "W1", False), ("drain", "", True)],
        )
        covering = self.model.coverings[0]
        self.assertEqual((covering.id, covering.segment, covering.kind, covering.part.label), ("cov_1", "seg_1", "heat-shrink", "S-6"))

    def test_the_bom_groups_housings_contacts_and_wire_rows(self) -> None:
        housing = self.rows("Housing")
        self.assertEqual(len(housing), 1)
        self.assertEqual((housing[0].part, housing[0].quantity), ("H-4", "2"))
        self.assertEqual(housing[0].where, "J1 · Controller, J1 · Sensor")

        contacts = self.rows("Contact")
        self.assertEqual(
            [(row.part, row.quantity) for row in contacts], [("C-22", "3"), ("not in the catalog", "1")]
        )
        self.assertEqual(contacts[1].where, "J1 · Controller")

        wires = {(row.part, row.quantity) for row in self.rows("Wire")}
        self.assertIn(("22 AWG · RD", "45 mm"), wires)
        self.assertIn(("24 AWG · BK", "30 mm"), wires)
        self.assertIn(("24 AWG · WH", "1 wires"), wires)
        self.assertIn(("gauge not set · no colour", "1 wires"), wires)

        self.assertEqual(self.rows("Cable")[0].where, "Cable A")
        self.assertEqual(self.rows("Covering")[0].where, "seg_1")
        self.assertEqual((self.rows("Splice")[0].part, self.rows("Splice")[0].where), ("crimp splice", "SP1"))
        self.assertEqual(self.rows("Marker")[0].quantity, "1")

    def test_an_unrouted_harness_has_no_segments(self) -> None:
        plain = unrouted()
        self.assertFalse(plain.routed)
        self.assertEqual(plain.segments, ())
        self.assertEqual([wire.number for wire in plain.wires], ["W1", "W2", "W3", "W4"])

    def test_a_harness_the_document_does_not_have_builds_nothing(self) -> None:
        self.assertIsNone(build(document(), bundle(), "har_nope", lookup))


if __name__ == "__main__":
    unittest.main()
