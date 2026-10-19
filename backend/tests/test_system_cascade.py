"""Cascades of removals (CONTRACTS.md §3.2, "Cascade on remove")."""

from __future__ import annotations

import unittest

from app.system_builder import integrity, ops
from app.system_builder.document import all_ids, canonical, new_document

LIMITS = integrity.Limits()


def pose() -> dict:
    return {"translation": {"xNm": 0, "yNm": 0, "zNm": 0}, "rotation": {"x": 0, "y": 0, "z": 0, "w": 1}}


def occurrence(occurrence_id: str, label: str, *, kind: str = "board", sheet: str | None = None) -> dict:
    if kind == "body":
        source = {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_1"}
    else:
        source = {"kind": "board", "projectId": "prj_000000000002",
                  "track": {"kind": "pinned", "commit": "b" * 40}}
    item = {"id": occurrence_id, "label": label, "source": source}
    if sheet:
        item["sheet"] = sheet
    return item


def end(end_id: str, occurrence_id: str, connector: str) -> dict:
    return {"id": end_id, "site": {"occurrence": occurrence_id, "connector": connector},
            "contacts": {}, "pinMap": []}


def terminal(kind: str, **fields) -> dict:
    return {"kind": kind, **fields}


def workspace_document() -> dict:
    document = new_document("Workspace")
    document["sheets"] = [
        {"id": "sh_root", "name": "Root"},
        {"id": "sh_child", "name": "Child", "parent": "sh_root"},
        {"id": "sh_grand", "name": "Grand", "parent": "sh_child"},
    ]
    document["occurrences"] = [
        occurrence("occ_a", "A", sheet="sh_child"),
        occurrence("occ_b", "B"),
        occurrence("occ_root", "Root", sheet="sh_root"),
        occurrence("occ_body", "Body", kind="body"),
        occurrence("occ_body2", "Body2", kind="body"),
    ]
    document["occurrences"][1]["positioningMate"] = "mate_a"
    document["occurrences"][4]["positioningMate"] = "mate_body"
    document["subPorts"] = [
        {"id": "sub_a", "occurrence": "occ_a", "connector": "J2", "name": "CAN", "pins": ["3", "4"]},
        {"id": "sub_body", "occurrence": "occ_body", "connector": "J9", "name": "P", "pins": ["1"]},
    ]
    document["dismissedSuggestions"] = [
        {"occurrence": "occ_a", "connector": "J2", "key": "power"},
        {"occurrence": "occ_body", "connector": "J9", "key": "unit:2"},
    ]
    document["bodyConnectors"] = [
        {"id": "bc_1", "occurrence": "occ_body", "refdes": "J9", "part": {"componentId": "cmp_conn"},
         "frame": pose(), "quarterTurns": 0},
        {"id": "bc_2", "occurrence": "occ_body2", "refdes": "J9", "part": {"componentId": "cmp_conn"},
         "frame": pose(), "quarterTurns": 0},
    ]
    document["mates"] = [
        {"id": "mate_a", "a": {"occurrence": "occ_a", "connector": "J1"},
         "b": {"occurrence": "occ_b", "connector": "J1"},
         "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}},
        {"id": "mate_body", "a": {"occurrence": "occ_body", "connector": "J9"},
         "b": {"occurrence": "occ_body2", "connector": "J9"},
         "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}},
    ]
    document["harnesses"] = [{
        "id": "har_1", "label": "H1", "sheet": "sh_child",
        "ends": [
            end("end_a", "occ_a", "J2"),
            end("end_b", "occ_b", "J1"),
            end("end_body", "occ_body", "J9"),
            end("end_body2", "occ_body2", "J9"),
        ],
        "links": [
            {"id": "link_1", "a": {"occurrence": "occ_a", "connector": "J2",
                                   "subPort": {"kind": "occurrence", "id": "sub_a"}},
             "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": ["3"]},
            {"id": "link_sub_b", "a": {"occurrence": "occ_b", "connector": "J1"},
             "b": {"occurrence": "occ_a", "connector": "J2",
                  "subPort": {"kind": "occurrence", "id": "sub_a"}}, "unmapped": []},
            {"id": "link_body", "a": {"occurrence": "occ_body", "connector": "J9"},
             "b": {"occurrence": "occ_body2", "connector": "J9"}, "unmapped": []},
        ],
        "wires": [
            {"id": "wire_1", "from": terminal("contact", end="end_a", cavity="3"),
             "to": terminal("contact", end="end_b", cavity="1"), "link": "link_1",
             "route": ["seg_1"]},
            {"id": "wire_splice", "from": terminal("splice", splice="spl_1"),
             "to": terminal("contact", end="end_b", cavity="2"), "route": []},
            {"id": "wire_loose", "from": terminal("loose", looseEnd="loose_1"),
             "to": terminal("contact", end="end_b", cavity="3"), "route": []},
        ],
        "splices": [{"id": "spl_1", "method": "crimp", "confirmed": True}],
        "branchPoints": [{"id": "bp_1"}],
        "segments": [
            {"id": "seg_1", "from": {"kind": "end", "end": "end_a"},
             "to": {"kind": "end", "end": "end_b"}},
            {"id": "seg_2", "from": {"kind": "branch-point", "branchPoint": "bp_1"},
             "to": {"kind": "end", "end": "end_b"}},
        ],
        "coverings": [{"id": "cov_1", "segment": "seg_1", "kind": "sleeve"}],
        "cables": [{"id": "cab_1", "conductors": [{"name": "1", "wire": "wire_1", "drain": False}]}],
        "looseEnds": [{"id": "loose_1", "kind": "pigtail"}],
        "markers": [{"id": "mark_1", "wire": "wire_1", "kind": "label", "text": "H1-1"}],
        "waypoints": [{"id": "wp_1", "segment": "seg_1",
                       "position": {"xNm": 1, "yNm": 2, "zNm": 0}, "order": 0}],
    }]
    document["exports"] = [
        {"id": "exp_1", "name": "E1",
         "site": {"occurrence": "occ_a", "connector": "J2",
                  "subPort": {"kind": "occurrence", "id": "sub_a"}},
         "pinNames": {"3": "CAN_H"}},
        {"id": "exp_body", "name": "EB",
         "site": {"occurrence": "occ_body", "connector": "J9"}, "pinNames": {}},
    ]
    document["waivers"] = [{"id": "wav_1", "code": "net-unconnected", "subject": "x", "reason": "y"}]
    document["layout"] = {
        "occ_a": {"sheet": "sh_child", "xNm": 1, "yNm": 2, "rotationDeg": 0, "mirror": False},
        "har_1": {"sheet": "sh_child", "xNm": 3, "yNm": 4, "rotationDeg": 90, "mirror": True},
        "sh_child": {"sheet": "sh_root", "xNm": 5, "yNm": 6, "rotationDeg": 0, "mirror": False},
        "occ_root": {"sheet": "sh_root", "xNm": 7, "yNm": 8, "rotationDeg": 0, "mirror": False},
    }
    return canonical(document)


def apply(document: dict, op: dict) -> dict:
    return ops.apply(document, [op], seen_ids=frozenset(), limits=LIMITS).document


def item_in(document: dict, collection: str, object_id: str) -> dict | None:
    return next((item for item in document[collection] if item["id"] == object_id), None)


def harness_item(document: dict, collection: str, object_id: str) -> dict | None:
    harness = item_in(document, "harnesses", "har_1")
    if harness is None:
        return None
    return next((item for item in harness[collection] if item["id"] == object_id), None)


class SheetCascadeTest(unittest.TestCase):
    def test_children_objects_and_placements_move_to_the_parent(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-sheet", "id": "sh_child"})
        self.assertIsNone(item_in(document, "sheets", "sh_child"))
        self.assertEqual(item_in(document, "sheets", "sh_grand")["parent"], "sh_root")
        self.assertEqual(item_in(document, "occurrences", "occ_a")["sheet"], "sh_root")
        self.assertEqual(item_in(document, "harnesses", "har_1")["sheet"], "sh_root")
        self.assertEqual(document["layout"]["occ_a"]["sheet"], "sh_root")
        self.assertEqual(document["layout"]["har_1"]["sheet"], "sh_root")
        self.assertNotIn("sh_child", document["layout"])

    def test_children_of_a_root_sheet_move_to_the_root(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-sheet", "id": "sh_root"})
        self.assertIsNone(item_in(document, "sheets", "sh_root"))
        self.assertNotIn("parent", item_in(document, "sheets", "sh_child"))
        self.assertNotIn("sheet", item_in(document, "occurrences", "occ_root"))
        self.assertNotIn("sheet", document["layout"]["occ_root"])
        # The child sheet's own placement loses the sheet it pointed at.
        self.assertNotIn("sheet", document["layout"]["sh_child"])


class OccurrenceCascadeTest(unittest.TestCase):
    def test_removal_takes_its_sub_ports_suggestions_mates_exports_links_and_placement(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-occurrence", "id": "occ_a"})
        self.assertIsNone(item_in(document, "occurrences", "occ_a"))
        self.assertIsNone(item_in(document, "subPorts", "sub_a"))
        self.assertNotIn({"occurrence": "occ_a", "connector": "J2", "key": "power"},
                         document["dismissedSuggestions"])
        self.assertIsNone(item_in(document, "mates", "mate_a"))
        self.assertIsNone(item_in(document, "exports", "exp_1"))
        self.assertNotIn("occ_a", document["layout"])
        self.assertIsNone(harness_item(document, "links", "link_1"))
        self.assertIsNone(harness_item(document, "links", "link_sub_b"))
        self.assertIsNone(harness_item(document, "wires", "wire_1"))
        self.assertIsNone(harness_item(document, "markers", "mark_1"))
        self.assertNotIn("wire", harness_item(document, "cables", "cab_1")["conductors"][0])
        self.assertEqual(document["layout"]["har_1"], {"sheet": "sh_child", "xNm": 3, "yNm": 4,
                                                       "rotationDeg": 90, "mirror": True})

    def test_ends_sited_on_the_occurrence_lose_their_site(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-occurrence", "id": "occ_a"})
        remaining = harness_item(document, "ends", "end_a")
        self.assertIsNotNone(remaining)
        self.assertNotIn("site", remaining)
        # The other ends keep their sites.
        self.assertEqual(harness_item(document, "ends", "end_b")["site"],
                         {"occurrence": "occ_b", "connector": "J1"})

    def test_positioning_mate_on_another_occurrence_is_cleared(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-occurrence", "id": "occ_a"})
        self.assertNotIn("positioningMate", item_in(document, "occurrences", "occ_b"))

    def test_a_body_occurrence_takes_its_body_connector_and_mate(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-occurrence", "id": "occ_body"})
        self.assertIsNone(item_in(document, "bodyConnectors", "bc_1"))
        self.assertIsNone(item_in(document, "mates", "mate_body"))
        self.assertNotIn("positioningMate", item_in(document, "occurrences", "occ_body2"))
        self.assertIsNone(harness_item(document, "links", "link_body"))
        self.assertNotIn("site", harness_item(document, "ends", "end_body"))
        self.assertEqual(harness_item(document, "ends", "end_body2")["site"],
                         {"occurrence": "occ_body2", "connector": "J9"})


class SubPortCascadeTest(unittest.TestCase):
    def test_links_and_exports_naming_it_fall_back_to_the_whole_connector(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-sub-port", "id": "sub_a"})
        self.assertIsNone(item_in(document, "subPorts", "sub_a"))
        for side in ("a", "b"):
            self.assertNotIn("subPort", harness_item(document, "links", "link_1")[side])
        self.assertNotIn("subPort", harness_item(document, "links", "link_sub_b")["b"])
        self.assertNotIn("subPort", item_in(document, "exports", "exp_1")["site"])
        # The endpoint keeps naming its occurrence and connector.
        self.assertEqual(harness_item(document, "links", "link_1")["a"],
                         {"occurrence": "occ_a", "connector": "J2"})


class BodyConnectorCascadeTest(unittest.TestCase):
    def test_removal_takes_mates_links_exports_sub_ports_and_suggestions(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-body-connector", "id": "bc_1"})
        self.assertIsNone(item_in(document, "bodyConnectors", "bc_1"))
        self.assertIsNone(item_in(document, "subPorts", "sub_body"))
        self.assertNotIn({"occurrence": "occ_body", "connector": "J9", "key": "unit:2"},
                         document["dismissedSuggestions"])
        self.assertIsNone(item_in(document, "mates", "mate_body"))
        self.assertIsNone(item_in(document, "exports", "exp_body"))
        self.assertIsNone(harness_item(document, "links", "link_body"))
        self.assertNotIn("site", harness_item(document, "ends", "end_body"))
        self.assertEqual(harness_item(document, "ends", "end_body2")["site"],
                         {"occurrence": "occ_body2", "connector": "J9"})


class MateAndHarnessCascadeTest(unittest.TestCase):
    def test_removing_a_mate_clears_positioning_mate(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-mate", "id": "mate_a"})
        self.assertIsNone(item_in(document, "mates", "mate_a"))
        self.assertNotIn("positioningMate", item_in(document, "occurrences", "occ_b"))

    def test_removing_a_harness_takes_its_contents_and_placement(self) -> None:
        before = workspace_document()
        contents = {item["id"] for name in ("ends", "links", "wires", "splices", "branchPoints",
                                            "segments", "coverings", "cables", "looseEnds",
                                            "markers", "waypoints")
                    for item in before["harnesses"][0][name]}
        document = apply(before, {"kind": "remove-harness", "id": "har_1"})
        self.assertIsNone(item_in(document, "harnesses", "har_1"))
        self.assertNotIn("har_1", document["layout"])
        self.assertEqual(contents & all_ids(document), set())


class HarnessContentCascadeTest(unittest.TestCase):
    def test_removing_an_end_takes_links_wires_segments_and_their_dependents(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-end", "harness": "har_1", "id": "end_a"})
        self.assertIsNone(harness_item(document, "ends", "end_a"))
        self.assertIsNone(harness_item(document, "links", "link_1"))
        self.assertIsNone(harness_item(document, "links", "link_sub_b"))
        self.assertIsNone(harness_item(document, "wires", "wire_1"))
        self.assertIsNone(harness_item(document, "markers", "mark_1"))
        self.assertIsNone(harness_item(document, "segments", "seg_1"))
        self.assertIsNone(harness_item(document, "coverings", "cov_1"))
        self.assertIsNone(harness_item(document, "waypoints", "wp_1"))
        self.assertNotIn("wire", harness_item(document, "cables", "cab_1")["conductors"][0])
        # Contents on the other end survive.
        self.assertIsNotNone(harness_item(document, "wires", "wire_splice"))
        self.assertIsNotNone(harness_item(document, "wires", "wire_loose"))

    def test_removing_a_link_takes_the_wires_that_replace_it(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-link", "harness": "har_1", "id": "link_1"})
        self.assertIsNone(harness_item(document, "links", "link_1"))
        self.assertIsNone(harness_item(document, "wires", "wire_1"))
        self.assertIsNone(harness_item(document, "markers", "mark_1"))
        self.assertNotIn("wire", harness_item(document, "cables", "cab_1")["conductors"][0])
        self.assertIsNotNone(harness_item(document, "links", "link_sub_b"))

    def test_removing_a_wire_takes_its_markers_and_cable_binding(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-wire", "harness": "har_1", "id": "wire_1"})
        self.assertIsNone(harness_item(document, "wires", "wire_1"))
        self.assertIsNone(harness_item(document, "markers", "mark_1"))
        self.assertNotIn("wire", harness_item(document, "cables", "cab_1")["conductors"][0])

    def test_removing_a_splice_takes_its_wires(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-splice", "harness": "har_1", "id": "spl_1"})
        self.assertIsNone(harness_item(document, "splices", "spl_1"))
        self.assertIsNone(harness_item(document, "wires", "wire_splice"))
        self.assertIsNotNone(harness_item(document, "wires", "wire_loose"))

    def test_removing_a_loose_end_takes_its_wires(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-loose-end", "harness": "har_1",
                                                "id": "loose_1"})
        self.assertIsNone(harness_item(document, "looseEnds", "loose_1"))
        self.assertIsNone(harness_item(document, "wires", "wire_loose"))
        self.assertIsNotNone(harness_item(document, "wires", "wire_splice"))

    def test_removing_a_branch_point_takes_its_segments(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-branch-point", "harness": "har_1",
                                                "id": "bp_1"})
        self.assertIsNone(harness_item(document, "branchPoints", "bp_1"))
        self.assertIsNone(harness_item(document, "segments", "seg_2"))
        self.assertIsNotNone(harness_item(document, "segments", "seg_1"))

    def test_removing_a_segment_takes_coverings_waypoints_and_routes_through_it(self) -> None:
        document = apply(workspace_document(), {"kind": "remove-segment", "harness": "har_1",
                                                "id": "seg_1"})
        self.assertIsNone(harness_item(document, "segments", "seg_1"))
        self.assertIsNone(harness_item(document, "coverings", "cov_1"))
        self.assertIsNone(harness_item(document, "waypoints", "wp_1"))
        self.assertEqual(harness_item(document, "wires", "wire_1")["route"], [])
        self.assertIsNotNone(harness_item(document, "wires", "wire_1"))


if __name__ == "__main__":
    unittest.main()
