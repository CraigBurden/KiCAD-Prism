"""Document-local integrity rules (CONTRACTS.md §1, §2, §7)."""

from __future__ import annotations

import unittest

from app.system_builder import integrity
from app.system_builder.document import new_document

LIMITS = integrity.Limits()


def pose() -> dict:
    return {"translation": {"xNm": 0, "yNm": 0, "zNm": 0}, "rotation": {"x": 0, "y": 0, "z": 0, "w": 1}}


def occurrence(occurrence_id: str = "occ_a", *, kind: str = "board") -> dict:
    if kind == "body":
        source = {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_1"}
    else:
        source = {"kind": "board", "projectId": "prj_000000000002",
                  "track": {"kind": "pinned", "commit": "b" * 40}}
    return {"id": occurrence_id, "label": "O", "source": source}


def end(end_id: str, occurrence_id: str | None = None) -> dict:
    item = {"id": end_id, "contacts": {}, "pinMap": []}
    if occurrence_id:
        item["site"] = {"occurrence": occurrence_id, "connector": "J1"}
    return item


def wire(wire_id: str, start: str, finish: str, *, link: str | None = None,
         route: list[str] | None = None) -> dict:
    item = {"id": wire_id, "from": {"kind": "contact", "end": start, "cavity": "1"},
            "to": {"kind": "contact", "end": finish, "cavity": "2"}, "route": list(route or [])}
    if link:
        item["link"] = link
    return item


def harness(harness_id: str = "har_1", **contents) -> dict:
    item = {"id": harness_id, "label": "H", "ends": [], "links": [], "wires": [], "splices": [],
            "branchPoints": [], "segments": [], "coverings": [], "cables": [], "looseEnds": [],
            "markers": [], "waypoints": []}
    item.update(contents)
    return item


def mate(mate_id: str = "mate_a", a: str = "occ_a", b: str = "occ_b") -> dict:
    return {"id": mate_id, "a": {"occurrence": a, "connector": "J1"},
            "b": {"occurrence": b, "connector": "J1"},
            "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}}


class IntegrityRuleTest(unittest.TestCase):
    def assert_breaks(self, document: dict, pointer: str = "", message: str | None = None,
                      limits: integrity.Limits = LIMITS) -> None:
        with self.assertRaises(integrity.IntegrityError) as caught:
            integrity.check(document, limits)
        self.assertEqual(caught.exception.pointer, pointer)
        if message is not None:
            self.assertIn(message, caught.exception.message)

    def test_duplicate_id_across_collections(self) -> None:
        document = new_document("X")
        document["sheets"] = [{"id": "dup", "name": "S"}]
        document["occurrences"] = [occurrence("dup")]
        self.assert_breaks(document, message="used by more than one object")

    def test_duplicate_id_inside_a_harness(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(ends=[end("dup"), end("dup")])]
        self.assert_breaks(document, message="used by more than one object")

    def test_sheet_parent_must_be_a_sheet(self) -> None:
        document = new_document("X")
        document["sheets"] = [{"id": "sh_a", "name": "A", "parent": "gone"}]
        self.assert_breaks(document, pointer="/sheets/0/parent", message="is not in sheets")

    def test_sheets_must_not_form_a_cycle(self) -> None:
        document = new_document("X")
        document["sheets"] = [{"id": "sh_a", "name": "A", "parent": "sh_b"},
                              {"id": "sh_b", "name": "B", "parent": "sh_a"}]
        self.assert_breaks(document, pointer="/sheets/0/parent", message="cycle")

    def test_positioning_mate_must_exist(self) -> None:
        document = new_document("X")
        document["occurrences"] = [dict(occurrence(), positioningMate="mate_gone")]
        self.assert_breaks(document, pointer="/occurrences/0/positioningMate",
                           message="not a mate of this occurrence")

    def test_positioning_mate_must_join_that_occurrence(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence("occ_a"), occurrence("occ_b"),
                                   dict(occurrence("occ_c"), positioningMate="mate_a")]
        document["mates"] = [mate("mate_a", "occ_a", "occ_b")]
        self.assert_breaks(document, pointer="/occurrences/2/positioningMate",
                           message="not a mate of this occurrence")

    def test_sub_port_pins_must_be_unique(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["subPorts"] = [{"id": "sub_a", "occurrence": "occ_a", "connector": "J1",
                                 "name": "P", "pins": ["1", "1"]}]
        self.assert_breaks(document, pointer="/subPorts/0/pins", message="listed twice")

    def test_endpoint_must_not_name_another_connectors_sub_port(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["subPorts"] = [{"id": "sub_a", "occurrence": "occ_a", "connector": "J2",
                                 "name": "P", "pins": ["1"]}]
        document["exports"] = [{"id": "exp_a", "name": "E",
                                "site": {"occurrence": "occ_a", "connector": "J1",
                                         "subPort": {"kind": "occurrence", "id": "sub_a"}},
                                "pinNames": {}}]
        self.assert_breaks(document, pointer="/exports/0/site/subPort",
                           message="belongs to another connector")

    def test_body_connectors_belong_on_body_occurrences(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["bodyConnectors"] = [{"id": "bc_a", "occurrence": "occ_a", "refdes": "J1",
                                       "part": {"componentId": "cmp"}, "frame": pose(),
                                       "quarterTurns": 0}]
        self.assert_breaks(document, pointer="/bodyConnectors/0/occurrence",
                           message="placed only on bodies")

    def test_body_connector_refdes_is_unique_on_its_occurrence(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence(kind="body")]
        document["bodyConnectors"] = [
            {"id": "bc_a", "occurrence": "occ_a", "refdes": "J1", "part": {"componentId": "cmp"},
             "frame": pose(), "quarterTurns": 0},
            {"id": "bc_b", "occurrence": "occ_a", "refdes": "J1", "part": {"componentId": "cmp"},
             "frame": pose(), "quarterTurns": 0},
        ]
        self.assert_breaks(document, pointer="/bodyConnectors/1/refdes", message="used twice")

    def test_a_mate_joins_two_occurrences(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["mates"] = [mate("mate_a", "occ_a", "occ_a")]
        self.assert_breaks(document, pointer="/mates/0", message="joins two occurrences")

    def test_manual_map_pads_are_unique_per_side(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence("occ_a"), occurrence("occ_b")]
        document["mates"] = [dict(mate(), manualMap=[{"a": "1", "b": "1"},
                                                     {"a": "1", "b": "2"}])]
        self.assert_breaks(document, pointer="/mates/0/manualMap", message="mapped twice")

    def test_two_ends_cannot_share_one_site(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["harnesses"] = [harness(ends=[end("end_1", "occ_a"), end("end_2", "occ_a")])]
        self.assert_breaks(document, pointer="/harnesses/0/ends/1/site",
                           message="one mating site is one end")

    def test_a_connector_is_an_end_of_one_harness(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        document["harnesses"] = [harness("har_1", ends=[end("end_1", "occ_a")]),
                                 harness("har_2", ends=[end("end_2", "occ_a")])]
        self.assert_breaks(document, pointer="/harnesses/1/ends/0/site",
                           message="already belongs to harness")

    def test_a_link_side_must_be_an_end_of_its_harness(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence("occ_a"), occurrence("occ_b")]
        document["harnesses"] = [harness(ends=[end("end_1", "occ_a")], links=[
            {"id": "link_1", "a": {"occurrence": "occ_a", "connector": "J1"},
             "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": []},
        ])]
        self.assert_breaks(document, pointer="/harnesses/0/links/0/b",
                           message="not an end of this harness")

    def test_wire_terminals_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(wires=[wire("wire_1", "gone", "gone")])]
        self.assert_breaks(document, pointer="/harnesses/0/wires/0/from", message="in this harness")

    def test_wire_link_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(ends=[end("end_1")],
                                         wires=[wire("wire_1", "end_1", "end_1", link="gone")])]
        self.assert_breaks(document, pointer="/harnesses/0/wires/0/link", message="in this harness")

    def test_wire_route_segments_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(ends=[end("end_1")],
                                         wires=[wire("wire_1", "end_1", "end_1", route=["gone"])])]
        self.assert_breaks(document, pointer="/harnesses/0/wires/0/route/0", message="in this harness")

    def test_segment_nodes_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(segments=[
            {"id": "seg_1", "from": {"kind": "end", "end": "gone"},
             "to": {"kind": "branch-point", "branchPoint": "gone"}},
        ])]
        self.assert_breaks(document, pointer="/harnesses/0/segments/0/from", message="in this harness")

    def test_covering_segments_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(coverings=[{"id": "cov_1", "segment": "gone",
                                                     "kind": "sleeve"}])]
        self.assert_breaks(document, pointer="/harnesses/0/coverings/0/segment",
                           message="in this harness")

    def test_waypoint_segments_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(waypoints=[
            {"id": "wp_1", "segment": "gone", "position": {"xNm": 0, "yNm": 0, "zNm": 0}, "order": 0},
        ])]
        self.assert_breaks(document, pointer="/harnesses/0/waypoints/0/segment",
                           message="in this harness")

    def test_marker_wires_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(markers=[{"id": "mark_1", "wire": "gone",
                                                   "kind": "label", "text": "X"}])]
        self.assert_breaks(document, pointer="/harnesses/0/markers/0/wire", message="in this harness")

    def test_cable_conductor_wires_must_resolve(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(cables=[
            {"id": "cab_1", "conductors": [{"name": "1", "wire": "gone", "drain": False}]},
        ])]
        self.assert_breaks(document, pointer="/harnesses/0/cables/0/conductors/0/wire",
                           message="in this harness")

    def test_layout_keys_must_name_an_object(self) -> None:
        document = new_document("X")
        document["layout"] = {"gone": {"xNm": 0, "yNm": 0, "rotationDeg": 0, "mirror": False}}
        self.assert_breaks(document, pointer="/layout/gone", message="names no occurrence")

    def test_harness_nodes_take_a_canvas_placement_and_boards_do_not(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(splices=[{"id": "spl_1", "method": "crimp", "confirmed": True}])]
        placed = {"xNm": 0, "yNm": 0, "rotationDeg": 0, "mirror": False, "canvas": {"xNm": 1, "yNm": 2}}
        document["layout"] = {"spl_1": placed}
        integrity.check(document, LIMITS)
        document["harnesses"] = []
        document["occurrences"] = [occurrence("occ_a")]
        document["layout"] = {"occ_a": placed}
        self.assert_breaks(document, pointer="/layout/occ_a/canvas", message="has no canvas")


class LimitsTest(unittest.TestCase):
    def assert_breaks(self, document: dict, limits: integrity.Limits, pointer: str = "") -> None:
        with self.assertRaises(integrity.IntegrityError) as caught:
            integrity.check(document, limits)
        self.assertEqual(caught.exception.pointer, pointer)

    def test_document_bytes(self) -> None:
        self.assert_breaks(new_document("X"), integrity.Limits(document_bytes=10))

    def test_occurrences(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence()]
        self.assert_breaks(document, integrity.Limits(occurrences=0))

    def test_mates_and_links(self) -> None:
        document = new_document("X")
        document["occurrences"] = [occurrence("occ_a"), occurrence("occ_b")]
        document["mates"] = [mate()]
        self.assert_breaks(document, integrity.Limits(connections=0))

    def test_harnesses(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness()]
        self.assert_breaks(document, integrity.Limits(harnesses=0))

    def test_ends_per_harness(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(ends=[end("end_1")])]
        self.assert_breaks(document, integrity.Limits(ends_per_harness=0),
                           pointer="/harnesses/0/ends")

    def test_wires(self) -> None:
        document = new_document("X")
        document["harnesses"] = [harness(ends=[end("end_1")],
                                         wires=[wire("wire_1", "end_1", "end_1")])]
        self.assert_breaks(document, integrity.Limits(wires=0))


if __name__ == "__main__":
    unittest.main()
