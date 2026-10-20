"""Stage 2's schematic layout (CONTRACTS.md §2.8): sheet sizes, port placements, connection
routes and board-sheet interiors, which objects may carry them, and their cascade on removal."""

from __future__ import annotations

import unittest

from app.system_builder import ops
from tests.test_system_ops import apply, rich_document

PORT = {"edge": "left", "offsetNm": 7_620_000}
ROUTE = [{"xNm": 0, "yNm": 0}, {"xNm": 5_080_000, "yNm": 0}, {"xNm": 5_080_000, "yNm": 2_540_000}]


def placement(**fields) -> dict:
    return {"xNm": 0, "yNm": 0, "rotationDeg": 0, "mirror": False, **fields}


def set_layout(item: str, **fields) -> dict:
    return {"kind": "set-layout", "item": item, "placement": placement(**fields)}


def a_mate_id(document: dict) -> str:
    return document["mates"][0]["id"]


def a_link_id(document: dict) -> tuple[str, str]:
    harness = next(h for h in document["harnesses"] if h["links"])
    return harness["id"], harness["links"][0]["id"]


class SchematicLayoutTest(unittest.TestCase):
    def test_a_board_sheet_takes_a_size_ports_and_an_interior(self) -> None:
        document = rich_document()
        occurrence = document["occurrences"][0]["id"]
        interior = {
            "symbol": {"xNm": 0, "yNm": 0, "widthNm": 50_800_000, "heightNm": 50_800_000},
            "pins": {"J1": {"edge": "top", "offsetNm": 10_160_000}},
            "labels": {"J1": {"xNm": 0, "yNm": -15_240_000, "rotationDeg": 90}},
        }
        applied = apply(document, [set_layout(occurrence, size={"widthNm": 50_800_000, "heightNm": 40_640_000},
                                              ports={"J1": PORT, "J_GONE": PORT}, interior=interior)])
        stored = applied.document["layout"][occurrence]
        self.assertEqual(stored["ports"]["J_GONE"], PORT, "a key the bundle lacks is kept, not refused")
        self.assertEqual(stored["interior"], interior)

    def test_mates_and_links_take_a_route(self) -> None:
        document = rich_document()
        _, link = a_link_id(document)
        applied = apply(document, [set_layout(a_mate_id(document), route=ROUTE), set_layout(link, route=ROUTE)])
        self.assertEqual(applied.document["layout"][link]["route"], ROUTE)

    def test_a_field_on_the_wrong_kind_is_refused(self) -> None:
        document = rich_document()
        occurrence = document["occurrences"][0]["id"]
        cases = [
            set_layout(occurrence, route=ROUTE),
            set_layout(a_mate_id(document), ports={"J1": PORT}),
            set_layout(a_link_id(document)[1], size={"widthNm": 1, "heightNm": 1}),
        ]
        for op in cases:
            with self.subTest(op=op), self.assertRaises(ops.OpRefused):
                apply(document, [op])

    def test_a_route_needs_two_points(self) -> None:
        document = rich_document()
        with self.assertRaises(ops.OpRefused):
            apply(document, [set_layout(a_mate_id(document), route=ROUTE[:1])])

    def test_removing_a_mate_or_link_removes_its_route_and_undo_restores_it(self) -> None:
        document = rich_document()
        mate = a_mate_id(document)
        harness, link = a_link_id(document)
        routed = apply(document, [set_layout(mate, route=ROUTE), set_layout(link, route=ROUTE)]).document
        removed = apply(routed, [{"kind": "remove-mate", "id": mate},
                                 {"kind": "remove-link", "harness": harness, "id": link}])
        self.assertNotIn(mate, removed.document["layout"])
        self.assertNotIn(link, removed.document["layout"])
        restored = apply(removed.document, removed.inverse, undo=True).document
        self.assertEqual(restored, routed)

    def test_removing_a_harness_removes_its_links_routes(self) -> None:
        document = rich_document()
        harness, link = a_link_id(document)
        routed = apply(document, [set_layout(link, route=ROUTE)]).document
        removed = apply(routed, [{"kind": "remove-harness", "id": harness}])
        self.assertNotIn(link, removed.document["layout"])
        self.assertEqual(apply(removed.document, removed.inverse, undo=True).document, routed)


if __name__ == "__main__":
    unittest.main()
