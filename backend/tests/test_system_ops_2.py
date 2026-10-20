"""Stage 2's schematic layout (CONTRACTS.md §2.8): sheet sizes, port placements, connection
routes (mates and harness ends) and board-sheet interiors, which objects may carry them, and their cascade on removal."""

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


def a_sited_end(document: dict) -> tuple[str, str, dict]:
    """A harness end with a site: (harness id, end id, site)."""
    harness = next(h for h in document["harnesses"] if any(end.get("site") for end in h["ends"]))
    end = next(end for end in harness["ends"] if end.get("site"))
    return harness["id"], end["id"], end["site"]


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

    def test_mates_and_harness_ends_take_a_route(self) -> None:
        document = rich_document()
        _, end, _ = a_sited_end(document)
        applied = apply(document, [set_layout(a_mate_id(document), route=ROUTE), set_layout(end, route=ROUTE)])
        self.assertEqual(applied.document["layout"][end]["route"], ROUTE)

    def test_a_field_on_the_wrong_kind_is_refused(self) -> None:
        document = rich_document()
        occurrence = document["occurrences"][0]["id"]
        harness = next(h for h in document["harnesses"] if h["links"])
        cases = [
            set_layout(occurrence, route=ROUTE),
            set_layout(a_mate_id(document), ports={"J1": PORT}),
            set_layout(a_sited_end(document)[1], size={"widthNm": 1, "heightNm": 1}),
            set_layout(harness["links"][0]["id"], route=ROUTE),
        ]
        for op in cases:
            with self.subTest(op=op), self.assertRaises(ops.OpRefused):
                apply(document, [op])

    def test_a_route_needs_two_points(self) -> None:
        document = rich_document()
        with self.assertRaises(ops.OpRefused):
            apply(document, [set_layout(a_mate_id(document), route=ROUTE[:1])])

    def test_removing_a_mate_or_end_removes_its_route_and_undo_restores_it(self) -> None:
        document = rich_document()
        mate = a_mate_id(document)
        harness, end, _ = a_sited_end(document)
        routed = apply(document, [set_layout(mate, route=ROUTE), set_layout(end, route=ROUTE)]).document
        removed = apply(routed, [{"kind": "remove-mate", "id": mate},
                                 {"kind": "remove-end", "harness": harness, "id": end}])
        self.assertNotIn(mate, removed.document["layout"])
        self.assertNotIn(end, removed.document["layout"])
        restored = apply(removed.document, removed.inverse, undo=True).document
        self.assertEqual(restored, routed)

    def test_an_end_that_loses_its_site_loses_its_route(self) -> None:
        document = rich_document()
        _, end, site = a_sited_end(document)
        routed = apply(document, [set_layout(end, route=ROUTE)]).document
        removed = apply(routed, [{"kind": "remove-occurrence", "id": site["occurrence"]}])
        self.assertNotIn(end, removed.document["layout"])
        self.assertEqual(apply(removed.document, removed.inverse, undo=True).document, routed)

    def test_removing_a_harness_removes_its_ends_routes(self) -> None:
        document = rich_document()
        harness, end, _ = a_sited_end(document)
        routed = apply(document, [set_layout(end, route=ROUTE)]).document
        removed = apply(routed, [{"kind": "remove-harness", "id": harness}])
        self.assertNotIn(end, removed.document["layout"])
        self.assertEqual(apply(removed.document, removed.inverse, undo=True).document, routed)


if __name__ == "__main__":
    unittest.main()
