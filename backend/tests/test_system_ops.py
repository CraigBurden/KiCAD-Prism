"""``prism.system.ops.a0`` applied to ``prism.system.v2`` (CONTRACTS.md §3.2)."""

from __future__ import annotations

import copy
import unittest

from app.system_builder import integrity, ops
from app.system_builder.document import canonical, empty_harness, new_document

LIMITS = integrity.Limits()


def pose(x: int = 0, y: int = 0, z: int = 0) -> dict:
    return {"translation": {"xNm": x, "yNm": y, "zNm": z}, "rotation": {"x": 0, "y": 0, "z": 0, "w": 1}}


def occurrence(occurrence_id: str, label: str = "O", *, kind: str = "board", sheet: str | None = None,
               followed: bool = False) -> dict:
    if kind == "body":
        source = {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_1"}
    elif followed:
        source = {"kind": "board", "projectId": "prj_00000000000a",
                  "track": {"kind": "followed", "branch": "main", "commit": "a" * 40, "reviewedCommit": "d" * 40}}
    else:
        source = {"kind": "board", "projectId": "prj_000000000002",
                  "track": {"kind": "pinned", "commit": "b" * 40}}
    item = {"id": occurrence_id, "label": label, "source": source}
    if sheet:
        item["sheet"] = sheet
    return item


def end(end_id: str, occurrence_id: str | None = None, connector: str = "J1") -> dict:
    item = {"id": end_id, "contacts": {}, "pinMap": []}
    if occurrence_id:
        item["site"] = {"occurrence": occurrence_id, "connector": connector}
    return item


def wire(wire_id: str, start: str, finish: str, *, link: str | None = None, route: list[str] | None = None,
         first: str = "1", second: str = "2") -> dict:
    item = {"id": wire_id,
            "from": {"kind": "contact", "end": start, "cavity": first},
            "to": {"kind": "contact", "end": finish, "cavity": second},
            "route": list(route or [])}
    if link:
        item["link"] = link
    return item


def rich_document() -> dict:
    """A document holding every object kind and one of each harness content."""

    document = new_document("Rich", "A description")
    document["sheets"] = [
        {"id": "sh_root", "name": "Root"},
        {"id": "sh_child", "name": "Child", "parent": "sh_root"},
    ]
    document["occurrences"] = [
        occurrence("occ_a", "A", sheet="sh_child"),
        occurrence("occ_b", "B"),
        occurrence("occ_follow", "F", followed=True),
        occurrence("occ_body", "Body", kind="body"),
        occurrence("occ_body2", "Body2", kind="body"),
    ]
    document["subPorts"] = [
        {"id": "sub_a", "occurrence": "occ_a", "connector": "J2", "name": "CAN",
         "pins": ["3", "4"], "suggestion": "bus:CAN"},
    ]
    document["dismissedSuggestions"] = [{"occurrence": "occ_a", "connector": "J2", "key": "power"}]
    document["bodyConnectors"] = [
        {"id": "bc_1", "occurrence": "occ_body", "refdes": "J9", "part": {"componentId": "cmp_conn"},
         "frame": pose(), "quarterTurns": 0},
        {"id": "bc_2", "occurrence": "occ_body2", "refdes": "J9", "part": {"componentId": "cmp_conn"},
         "frame": pose(), "quarterTurns": 0},
    ]
    document["mates"] = [
        {"id": "mate_a", "a": {"occurrence": "occ_a", "connector": "J1"},
         "b": {"occurrence": "occ_b", "connector": "J1"},
         "orientation": {"quarterTurns": 0, "flip": False}, "rows": {"1": {"signal": "VBAT"}}},
        {"id": "mate_body", "a": {"occurrence": "occ_body", "connector": "J9"},
         "b": {"occurrence": "occ_body2", "connector": "J9"},
         "orientation": {"quarterTurns": 1, "flip": True}, "rows": {}},
    ]
    document["occurrences"][0]["positioningMate"] = "mate_a"
    document["harnesses"] = [{
        "id": "har_1", "label": "H1", "sheet": "sh_child",
        "ends": [end("end_a", "occ_a", "J2"), end("end_b", "occ_b", "J1"), end("end_body", "occ_body", "J9")],
        "links": [
            {"id": "link_1", "a": {"occurrence": "occ_a", "connector": "J2",
                                   "subPort": {"kind": "occurrence", "id": "sub_a"}},
             "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": ["3"]},
        ],
        "wires": [
            wire("wire_1", "end_a", "end_b", link="link_1", route=["seg_1"]),
            {"id": "wire_splice", "from": {"kind": "splice", "splice": "spl_1"},
             "to": {"kind": "contact", "end": "end_b", "cavity": "2"}, "route": []},
            {"id": "wire_loose", "from": {"kind": "loose", "looseEnd": "loose_1"},
             "to": {"kind": "contact", "end": "end_b", "cavity": "3"}, "route": []},
        ],
        "splices": [{"id": "spl_1", "method": "crimp", "confirmed": True}],
        "branchPoints": [{"id": "bp_1"}],
        "segments": [
            {"id": "seg_1", "from": {"kind": "end", "end": "end_a"}, "to": {"kind": "end", "end": "end_b"}},
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
    ]
    document["waivers"] = [{"id": "wav_1", "code": "net-unconnected", "subject": "x", "reason": "y"}]
    document["layout"] = {
        "occ_a": {"sheet": "sh_child", "xNm": 1, "yNm": 2, "rotationDeg": 0, "mirror": False},
        "har_1": {"xNm": 3, "yNm": 4, "rotationDeg": 90, "mirror": True},
    }
    return canonical(document)


def apply(document: dict, request: list[dict], *, seen_ids=(), limits=LIMITS, undo: bool = False) -> ops.Applied:
    return ops.apply(document, request, seen_ids=seen_ids, limits=limits, undo=undo)


def item_in(document: dict, collection: str, object_id: str) -> dict | None:
    return next((item for item in document[collection] if item["id"] == object_id), None)


def harness_item(document: dict, harness_id: str, collection: str, object_id: str) -> dict | None:
    harness = item_in(document, "harnesses", harness_id)
    if harness is None:
        return None
    return next((item for item in harness[collection] if item["id"] == object_id), None)


class ApplyOpKindsTest(unittest.TestCase):
    """Every op kind in the schema changes the document as CONTRACTS.md §3.2 says."""

    def test_add_ops_add_each_kind(self) -> None:
        link = {"id": "link_add", "a": {"occurrence": "occ_a", "connector": "J2"},
                "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": []}
        cases = [
            ("sheet", {"kind": "add-sheet", "sheet": {"id": "sh_add", "name": "New"}},
             lambda d: item_in(d, "sheets", "sh_add")),
            ("occurrence", {"kind": "add-occurrence", "occurrence": occurrence("occ_add")},
             lambda d: item_in(d, "occurrences", "occ_add")),
            ("sub-port", {"kind": "add-sub-port", "subPort": {
                "id": "sub_add", "occurrence": "occ_b", "connector": "J1", "name": "P", "pins": ["1", "2"]}},
             lambda d: item_in(d, "subPorts", "sub_add")),
            ("body-connector", {"kind": "add-body-connector", "bodyConnector": {
                "id": "bc_add", "occurrence": "occ_body", "refdes": "J7",
                "part": {"componentId": "cmp_conn"}, "frame": pose(), "quarterTurns": 2}},
             lambda d: item_in(d, "bodyConnectors", "bc_add")),
            ("mate", {"kind": "add-mate", "mate": {
                "id": "mate_add", "a": {"occurrence": "occ_a", "connector": "J1"},
                "b": {"occurrence": "occ_b", "connector": "J1"},
                "orientation": {"quarterTurns": 3, "flip": False}, "rows": {}}},
             lambda d: item_in(d, "mates", "mate_add")),
            ("harness", {"kind": "add-harness", "harness": empty_harness("har_add", "H2")},
             lambda d: item_in(d, "harnesses", "har_add")),
            ("export", {"kind": "add-export", "export": {
                "id": "exp_add", "name": "E2", "site": {"occurrence": "occ_b", "connector": "J1"},
                "pinNames": {"1": "A"}}},
             lambda d: item_in(d, "exports", "exp_add")),
            ("waiver", {"kind": "add-waiver", "waiver": {
                "id": "wav_add", "code": "net-unconnected", "subject": "s", "reason": "r"}},
             lambda d: item_in(d, "waivers", "wav_add")),
            ("end", {"kind": "add-end", "harness": "har_1", "end": end("end_add")},
             lambda d: harness_item(d, "har_1", "ends", "end_add")),
            ("link", {"kind": "add-link", "harness": "har_1", "link": link},
             lambda d: harness_item(d, "har_1", "links", "link_add")),
            ("wire", {"kind": "add-wire", "harness": "har_1", "wire": wire("wire_add", "end_a", "end_b")},
             lambda d: harness_item(d, "har_1", "wires", "wire_add")),
            ("splice", {"kind": "add-splice", "harness": "har_1",
                        "splice": {"id": "spl_add", "method": "solder", "confirmed": True}},
             lambda d: harness_item(d, "har_1", "splices", "spl_add")),
            ("branch-point", {"kind": "add-branch-point", "harness": "har_1",
                              "branchPoint": {"id": "bp_add", "position": {"xNm": 3, "yNm": 4, "zNm": 0}}},
             lambda d: harness_item(d, "har_1", "branchPoints", "bp_add")),
            ("segment", {"kind": "add-segment", "harness": "har_1", "segment": {
                "id": "seg_add", "from": {"kind": "end", "end": "end_a"},
                "to": {"kind": "end", "end": "end_b"}}},
             lambda d: harness_item(d, "har_1", "segments", "seg_add")),
            ("covering", {"kind": "add-covering", "harness": "har_1",
                          "covering": {"id": "cov_add", "segment": "seg_1", "kind": "tape"}},
             lambda d: harness_item(d, "har_1", "coverings", "cov_add")),
            ("cable", {"kind": "add-cable", "harness": "har_1",
                       "cable": {"id": "cab_add", "conductors": [{"name": "1", "drain": False}]}},
             lambda d: harness_item(d, "har_1", "cables", "cab_add")),
            ("loose-end", {"kind": "add-loose-end", "harness": "har_1",
                           "looseEnd": {"id": "loose_add", "kind": "open"}},
             lambda d: harness_item(d, "har_1", "looseEnds", "loose_add")),
            ("marker", {"kind": "add-marker", "harness": "har_1",
                        "marker": {"id": "mark_add", "wire": "wire_1", "kind": "heat-shrink-marker",
                                   "text": "M"}},
             lambda d: harness_item(d, "har_1", "markers", "mark_add")),
            ("waypoint", {"kind": "add-waypoint", "harness": "har_1", "waypoint": {
                "id": "wp_add", "segment": "seg_1", "position": {"xNm": 5, "yNm": 6, "zNm": 0},
                "order": 1}},
             lambda d: harness_item(d, "har_1", "waypoints", "wp_add")),
        ]
        for label, request, locate in cases:
            with self.subTest(kind=label):
                applied = apply(rich_document(), [request])
                self.assertIsNotNone(locate(applied.document))
                self.assertEqual(locate(applied.document), request[list(request)[-1]])

    def test_replace_ops_replace_each_kind(self) -> None:
        base = rich_document()
        harness = base["harnesses"][0]

        def cloned(collection: str, object_id: str) -> dict:
            return copy.deepcopy(item_in(base, collection, object_id))

        def cloned_harness(collection: str, object_id: str) -> dict:
            return copy.deepcopy(harness_item(base, "har_1", collection, object_id))

        sheet = cloned("sheets", "sh_child")
        sheet["name"] = "Child renamed"
        occ = cloned("occurrences", "occ_b")
        occ["label"] = "B renamed"
        sub = cloned("subPorts", "sub_a")
        sub["name"] = "CAN renamed"
        body_connector = cloned("bodyConnectors", "bc_1")
        body_connector["quarterTurns"] = 3
        mate = cloned("mates", "mate_a")
        mate["orientation"] = {"quarterTurns": 2, "flip": True}
        export = cloned("exports", "exp_1")
        export["name"] = "E renamed"
        harness_end = cloned_harness("ends", "end_a")
        harness_end["bootLengthNm"] = 1000000
        link = cloned_harness("links", "link_1")
        link["unmapped"] = ["4"]
        harness_wire = cloned_harness("wires", "wire_1")
        harness_wire["label"] = "CAN_L"
        splice = cloned_harness("splices", "spl_1")
        splice["confirmed"] = False
        branch = cloned_harness("branchPoints", "bp_1")
        branch["position"] = {"xNm": 7, "yNm": 8, "zNm": 0}
        segment = cloned_harness("segments", "seg_1")
        segment["from"], segment["to"] = segment["to"], segment["from"]
        covering = cloned_harness("coverings", "cov_1")
        covering["kind"] = "tape"
        cable = cloned_harness("cables", "cab_1")
        cable["label"] = "Cable"
        loose = cloned_harness("looseEnds", "loose_1")
        loose["label"] = "Pigtail"
        marker = cloned_harness("markers", "mark_1")
        marker["text"] = "Renamed"
        waypoint = cloned_harness("waypoints", "wp_1")
        waypoint["order"] = 2

        cases = [
            ("sheet", {"kind": "replace-sheet", "sheet": sheet}, "sheets", "sh_child", sheet),
            ("occurrence", {"kind": "replace-occurrence", "occurrence": occ}, "occurrences", "occ_b", occ),
            ("sub-port", {"kind": "replace-sub-port", "subPort": sub}, "subPorts", "sub_a", sub),
            ("body-connector", {"kind": "replace-body-connector", "bodyConnector": body_connector},
             "bodyConnectors", "bc_1", body_connector),
            ("mate", {"kind": "replace-mate", "mate": mate}, "mates", "mate_a", mate),
            ("export", {"kind": "replace-export", "export": export}, "exports", "exp_1", export),
            ("end", {"kind": "replace-end", "harness": "har_1", "end": harness_end},
             "ends", "end_a", harness_end),
            ("link", {"kind": "replace-link", "harness": "har_1", "link": link},
             "links", "link_1", link),
            ("wire", {"kind": "replace-wire", "harness": "har_1", "wire": harness_wire},
             "wires", "wire_1", harness_wire),
            ("splice", {"kind": "replace-splice", "harness": "har_1", "splice": splice},
             "splices", "spl_1", splice),
            ("branch-point", {"kind": "replace-branch-point", "harness": "har_1", "branchPoint": branch},
             "branchPoints", "bp_1", branch),
            ("segment", {"kind": "replace-segment", "harness": "har_1", "segment": segment},
             "segments", "seg_1", segment),
            ("covering", {"kind": "replace-covering", "harness": "har_1", "covering": covering},
             "coverings", "cov_1", covering),
            ("cable", {"kind": "replace-cable", "harness": "har_1", "cable": cable},
             "cables", "cab_1", cable),
            ("loose-end", {"kind": "replace-loose-end", "harness": "har_1", "looseEnd": loose},
             "looseEnds", "loose_1", loose),
            ("marker", {"kind": "replace-marker", "harness": "har_1", "marker": marker},
             "markers", "mark_1", marker),
            ("waypoint", {"kind": "replace-waypoint", "harness": "har_1", "waypoint": waypoint},
             "waypoints", "wp_1", waypoint),
        ]
        for label, request, collection, object_id, expected in cases:
            with self.subTest(kind=label):
                applied = apply(rich_document(), [request])
                if collection in ("ends", "links", "wires", "splices", "branchPoints", "segments",
                                  "coverings", "cables", "looseEnds", "markers", "waypoints"):
                    actual = harness_item(applied.document, "har_1", collection, object_id)
                else:
                    actual = item_in(applied.document, collection, object_id)
                self.assertEqual(actual, expected)

    def test_replace_harness_changes_only_own_fields_and_keeps_contents(self) -> None:
        before = rich_document()
        applied = apply(before, [{"kind": "replace-harness",
                                  "harness": {"id": "har_1", "label": "H1 renamed", "sheet": "sh_root"}}])
        harness = item_in(applied.document, "harnesses", "har_1")
        self.assertEqual(harness["label"], "H1 renamed")
        self.assertEqual(harness["sheet"], "sh_root")
        for collection in ("ends", "links", "wires", "splices", "branchPoints", "segments",
                           "coverings", "cables", "looseEnds", "markers", "waypoints"):
            self.assertEqual(harness[collection], item_in(before, "harnesses", "har_1")[collection])
        # Contents are not part of replace-harness's payload.
        with self.assertRaises(ops.OpRefused) as caught:
            apply(before, [{"kind": "replace-harness",
                            "harness": {"id": "har_1", "label": "H", "ends": []}}])
        self.assertTrue(caught.exception.pointer.startswith("/ops/0"))

    def test_remove_ops_remove_each_kind(self) -> None:
        cases = [
            ("sheet", {"kind": "remove-sheet", "id": "sh_child"}, lambda d: item_in(d, "sheets", "sh_child")),
            ("occurrence", {"kind": "remove-occurrence", "id": "occ_b"},
             lambda d: item_in(d, "occurrences", "occ_b")),
            ("sub-port", {"kind": "remove-sub-port", "id": "sub_a"}, lambda d: item_in(d, "subPorts", "sub_a")),
            ("body-connector", {"kind": "remove-body-connector", "id": "bc_1"},
             lambda d: item_in(d, "bodyConnectors", "bc_1")),
            ("mate", {"kind": "remove-mate", "id": "mate_a"}, lambda d: item_in(d, "mates", "mate_a")),
            ("harness", {"kind": "remove-harness", "id": "har_1"},
             lambda d: item_in(d, "harnesses", "har_1")),
            ("export", {"kind": "remove-export", "id": "exp_1"}, lambda d: item_in(d, "exports", "exp_1")),
            ("waiver", {"kind": "remove-waiver", "id": "wav_1"}, lambda d: item_in(d, "waivers", "wav_1")),
            ("end", {"kind": "remove-end", "harness": "har_1", "id": "end_a"},
             lambda d: harness_item(d, "har_1", "ends", "end_a")),
            ("link", {"kind": "remove-link", "harness": "har_1", "id": "link_1"},
             lambda d: harness_item(d, "har_1", "links", "link_1")),
            ("wire", {"kind": "remove-wire", "harness": "har_1", "id": "wire_1"},
             lambda d: harness_item(d, "har_1", "wires", "wire_1")),
            ("splice", {"kind": "remove-splice", "harness": "har_1", "id": "spl_1"},
             lambda d: harness_item(d, "har_1", "splices", "spl_1")),
            ("branch-point", {"kind": "remove-branch-point", "harness": "har_1", "id": "bp_1"},
             lambda d: harness_item(d, "har_1", "branchPoints", "bp_1")),
            ("segment", {"kind": "remove-segment", "harness": "har_1", "id": "seg_1"},
             lambda d: harness_item(d, "har_1", "segments", "seg_1")),
            ("covering", {"kind": "remove-covering", "harness": "har_1", "id": "cov_1"},
             lambda d: harness_item(d, "har_1", "coverings", "cov_1")),
            ("cable", {"kind": "remove-cable", "harness": "har_1", "id": "cab_1"},
             lambda d: harness_item(d, "har_1", "cables", "cab_1")),
            ("loose-end", {"kind": "remove-loose-end", "harness": "har_1", "id": "loose_1"},
             lambda d: harness_item(d, "har_1", "looseEnds", "loose_1")),
            ("marker", {"kind": "remove-marker", "harness": "har_1", "id": "mark_1"},
             lambda d: harness_item(d, "har_1", "markers", "mark_1")),
            ("waypoint", {"kind": "remove-waypoint", "harness": "har_1", "id": "wp_1"},
             lambda d: harness_item(d, "har_1", "waypoints", "wp_1")),
        ]
        for label, request, locate in cases:
            with self.subTest(kind=label):
                applied = apply(rich_document(), [request])
                self.assertIsNone(locate(applied.document))

    def test_set_system_info_changes_and_clears_description(self) -> None:
        applied = apply(rich_document(), [{"kind": "set-system-info", "name": "Renamed",
                                           "description": None}])
        self.assertEqual(applied.document["name"], "Renamed")
        self.assertNotIn("description", applied.document)

    def test_set_layout_and_remove_layout(self) -> None:
        placement = {"sheet": "sh_root", "xNm": 10, "yNm": 20, "rotationDeg": 45, "mirror": True}
        applied = apply(rich_document(), [{"kind": "set-layout", "item": "occ_b", "placement": placement}])
        self.assertEqual(applied.document["layout"]["occ_b"], placement)
        removed = apply(applied.document, [{"kind": "remove-layout", "item": "occ_b"}])
        self.assertNotIn("occ_b", removed.document["layout"])

    def test_dismiss_and_restore_suggestion(self) -> None:
        suggestion = {"occurrence": "occ_b", "connector": "J1", "key": "unit:2"}
        applied = apply(rich_document(), [{"kind": "dismiss-suggestion", "suggestion": suggestion}])
        self.assertIn(suggestion, applied.document["dismissedSuggestions"])
        restored = apply(applied.document, [{"kind": "restore-suggestion", "suggestion": suggestion}])
        self.assertNotIn(suggestion, restored.document["dismissedSuggestions"])

    def test_advance_and_acknowledge_changes(self) -> None:
        advanced = apply(rich_document(), [{"kind": "advance-occurrence", "occurrence": "occ_follow",
                                            "commit": "c" * 40}])
        track = item_in(advanced.document, "occurrences", "occ_follow")["source"]["track"]
        self.assertEqual(track["commit"], "c" * 40)
        self.assertEqual(track["reviewedCommit"], "d" * 40)
        acknowledged = apply(advanced.document, [{"kind": "acknowledge-changes", "occurrence": "occ_follow"}])
        track = item_in(acknowledged.document, "occurrences", "occ_follow")["source"]["track"]
        self.assertEqual(track["reviewedCommit"], track["commit"])


class RefusalTest(unittest.TestCase):
    """The refusal cases CONTRACTS.md §3 and the schema imply."""

    def refuse(self, document: dict, request: list[dict], *, pointer: str = "/ops/0",
               message: str | None = None, **kwargs) -> ops.OpRefused:
        with self.assertRaises(ops.OpRefused) as caught:
            apply(document, request, **kwargs)
        self.assertTrue(caught.exception.pointer.startswith(pointer),
                        f"{caught.exception.pointer!r} does not start with {pointer!r}")
        if message is not None:
            self.assertIn(message, caught.exception.message)
        return caught.exception

    def test_add_with_an_id_in_use_is_refused(self) -> None:
        self.refuse(rich_document(), [{"kind": "add-sheet", "sheet": {"id": "sh_root", "name": "New"}}],
                    message="already in use")
        # One id space: a harness content id is just as much in use.
        self.refuse(rich_document(), [{"kind": "add-occurrence", "occurrence": occurrence("wire_1")}],
                    message="already in use")

    def test_a_removed_id_is_refused_for_a_new_add_but_allowed_for_undo(self) -> None:
        removed = apply(rich_document(), [{"kind": "remove-sheet", "id": "sh_child"}])
        request = [{"kind": "add-sheet", "sheet": {"id": "sh_child", "name": "Child", "parent": "sh_root"}}]
        self.refuse(removed.document, request, seen_ids=removed.seen_ids, message="ids are never reused")
        restored = apply(removed.document, request, seen_ids=removed.seen_ids, undo=True)
        self.assertIsNotNone(item_in(restored.document, "sheets", "sh_child"))

    def test_replace_and_remove_of_a_missing_object_are_refused(self) -> None:
        cases = [
            ({"kind": "replace-sheet", "sheet": {"id": "gone", "name": "X"}}, "no sheet"),
            ({"kind": "replace-occurrence", "occurrence": occurrence("gone")}, "no occurrence"),
            ({"kind": "replace-sub-port", "subPort": {"id": "gone", "occurrence": "occ_a",
                                                      "connector": "J1", "name": "P", "pins": ["1"]}},
             "no sub-port"),
            ({"kind": "replace-body-connector", "bodyConnector": {
                "id": "gone", "occurrence": "occ_body", "refdes": "J1",
                "part": {"componentId": "cmp"}, "frame": pose(), "quarterTurns": 0}}, "no body-connector"),
            ({"kind": "replace-mate", "mate": {
                "id": "gone", "a": {"occurrence": "occ_a", "connector": "J1"},
                "b": {"occurrence": "occ_b", "connector": "J1"},
                "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}}}, "no mate"),
            ({"kind": "replace-export", "export": {
                "id": "gone", "name": "E", "site": {"occurrence": "occ_a", "connector": "J1"},
                "pinNames": {}}}, "no export"),
            ({"kind": "remove-sheet", "id": "gone"}, "no sheet"),
            ({"kind": "remove-occurrence", "id": "gone"}, "no occurrence"),
            ({"kind": "remove-sub-port", "id": "gone"}, "no sub-port"),
            ({"kind": "remove-body-connector", "id": "gone"}, "no body-connector"),
            ({"kind": "remove-mate", "id": "gone"}, "no mate"),
            ({"kind": "remove-harness", "id": "gone"}, "no harness"),
            ({"kind": "remove-export", "id": "gone"}, "no export"),
            ({"kind": "remove-waiver", "id": "gone"}, "no waiver"),
            ({"kind": "remove-end", "harness": "har_1", "id": "gone"}, "no end"),
            ({"kind": "remove-link", "harness": "har_1", "id": "gone"}, "no link"),
            ({"kind": "remove-wire", "harness": "har_1", "id": "gone"}, "no wire"),
            ({"kind": "remove-splice", "harness": "har_1", "id": "gone"}, "no splice"),
            ({"kind": "remove-branch-point", "harness": "har_1", "id": "gone"}, "no branch-point"),
            ({"kind": "remove-segment", "harness": "har_1", "id": "gone"}, "no segment"),
            ({"kind": "remove-covering", "harness": "har_1", "id": "gone"}, "no covering"),
            ({"kind": "remove-cable", "harness": "har_1", "id": "gone"}, "no cable"),
            ({"kind": "remove-loose-end", "harness": "har_1", "id": "gone"}, "no loose-end"),
            ({"kind": "remove-marker", "harness": "har_1", "id": "gone"}, "no marker"),
            ({"kind": "remove-waypoint", "harness": "har_1", "id": "gone"}, "no waypoint"),
        ]
        for request, message in cases:
            with self.subTest(kind=request["kind"]):
                self.refuse(rich_document(), [request], message=message)

    def test_nested_ops_on_a_missing_harness_are_refused(self) -> None:
        for request in (
            {"kind": "add-wire", "harness": "gone", "wire": wire("wire_x", "end_a", "end_b")},
            {"kind": "remove-wire", "harness": "gone", "id": "wire_1"},
            {"kind": "replace-end", "harness": "gone", "end": end("end_x")},
        ):
            with self.subTest(kind=request["kind"]):
                self.refuse(rich_document(), [request], pointer="/ops/0/harness", message="no harness")

    def test_malformed_ops_point_at_their_index(self) -> None:
        self.refuse(rich_document(), [{"kind": "explode"}], pointer="/ops/0")
        self.refuse(rich_document(), [{"kind": "add-sheet"}], pointer="/ops/0")
        self.refuse(rich_document(), [
            {"kind": "add-sheet", "sheet": {"id": "sh_ok", "name": "OK"}},
            {"kind": "add-sheet"},
        ], pointer="/ops/1")

    def test_more_ops_than_the_limit_are_refused(self) -> None:
        limits = integrity.Limits(ops_per_request=1)
        self.refuse(rich_document(), [
            {"kind": "set-system-info", "name": "One"},
            {"kind": "set-system-info", "name": "Two"},
        ], pointer="/ops", limits=limits, message="the limit is 1")

    def test_dismissing_a_suggestion_twice_is_refused(self) -> None:
        suggestion = {"occurrence": "occ_a", "connector": "J2", "key": "power"}
        self.refuse(rich_document(), [{"kind": "dismiss-suggestion", "suggestion": suggestion}],
                    pointer="/ops/0/suggestion", message="already dismissed")

    def test_restoring_a_suggestion_that_is_not_dismissed_is_refused(self) -> None:
        suggestion = {"occurrence": "occ_b", "connector": "J1", "key": "unit:2"}
        self.refuse(rich_document(), [{"kind": "restore-suggestion", "suggestion": suggestion}],
                    pointer="/ops/0/suggestion", message="not dismissed")

    def test_removing_an_absent_layout_entry_is_refused(self) -> None:
        self.refuse(rich_document(), [{"kind": "remove-layout", "item": "occ_b"}],
                    pointer="/ops/0/item", message="has no placement")

    def test_tracking_ops_require_a_followed_board(self) -> None:
        for verb in ("advance-occurrence", "acknowledge-changes"):
            for occurrence_id, why in (("occ_b", "pinned"), ("occ_body", "body")):
                request = {"kind": verb, "occurrence": occurrence_id}
                if verb == "advance-occurrence":
                    request["commit"] = "c" * 40
                with self.subTest(kind=verb, occurrence=why):
                    self.refuse(rich_document(), [request], pointer="/ops/0/occurrence",
                                message="does not follow a branch")

    def test_advancing_a_missing_occurrence_is_refused(self) -> None:
        self.refuse(rich_document(), [{"kind": "advance-occurrence", "occurrence": "gone",
                                       "commit": "c" * 40}],
                    pointer="/ops/0/occurrence", message="no occurrence")


class ConnectHarnessTest(unittest.TestCase):
    """``connect-harness`` is the schematic gesture (CONTRACTS.md §3.2)."""

    def connect(self, document: dict, *, link_id: str, a: dict, b: dict,
                harness: str | None = None, new_harness: dict | None = None,
                new_ends: dict | None = None) -> dict:
        request: dict = {
            "kind": "connect-harness",
            "newEnds": new_ends if new_ends is not None else {"a": f"{link_id}_a", "b": f"{link_id}_b"},
            "link": {"id": link_id, "a": a, "b": b, "unmapped": []},
        }
        if harness is not None:
            request["harness"] = harness
        if new_harness is not None:
            request["newHarness"] = new_harness
        return apply(document, [request]).document

    def test_creates_a_block_with_new_harness(self) -> None:
        document = self.connect(
            rich_document(), link_id="link_new",
            a={"occurrence": "occ_a", "connector": "J7"},
            b={"occurrence": "occ_b", "connector": "J8"},
            new_harness={"id": "har_new", "label": "H new"},
        )
        harness = item_in(document, "harnesses", "har_new")
        self.assertIsNotNone(harness)
        self.assertEqual(harness["label"], "H new")
        self.assertEqual([item["site"] for item in harness["ends"]],
                         [{"occurrence": "occ_a", "connector": "J7"},
                          {"occurrence": "occ_b", "connector": "J8"}])
        self.assertEqual([item["id"] for item in harness["links"]], ["link_new"])

    def test_joins_the_block_a_connector_already_belongs_to(self) -> None:
        document = self.connect(
            rich_document(), link_id="link_join",
            a={"occurrence": "occ_a", "connector": "J2"},
            b={"occurrence": "occ_b", "connector": "J3"},
            new_harness={"id": "har_unused", "label": "Unused"},
            new_ends={"a": "end_unused", "b": "end_b3"},
        )
        self.assertIsNone(item_in(document, "harnesses", "har_unused"))
        harness = item_in(document, "harnesses", "har_1")
        self.assertIn("link_join", [item["id"] for item in harness["links"]])
        end_ids = [item["id"] for item in harness["ends"]]
        self.assertIn("end_b3", end_ids)
        self.assertNotIn("end_unused", end_ids)
        self.assertEqual(harness_item(document, "har_1", "ends", "end_b3")["site"],
                         {"occurrence": "occ_b", "connector": "J3"})

    def test_joins_a_named_empty_block_and_adds_both_ends(self) -> None:
        before = rich_document()
        before["harnesses"].append(empty_harness("har_2", "H2"))
        canonical(before)
        document = self.connect(
            before, link_id="link_named_empty",
            a={"occurrence": "occ_a", "connector": "J7"},
            b={"occurrence": "occ_b", "connector": "J8"},
            harness="har_2",
        )
        harness = item_in(document, "harnesses", "har_2")
        self.assertEqual([item["site"] for item in harness["ends"]],
                         [{"occurrence": "occ_a", "connector": "J7"},
                          {"occurrence": "occ_b", "connector": "J8"}])
        self.assertEqual([item["id"] for item in harness["links"]], ["link_named_empty"])

    def test_refuses_a_named_block_that_does_not_exist(self) -> None:
        with self.assertRaises(ops.OpRefused) as caught:
            self.connect(rich_document(), link_id="link_gone",
                         a={"occurrence": "occ_a", "connector": "J7"},
                         b={"occurrence": "occ_b", "connector": "J8"},
                         harness="har_gone")
        self.assertTrue(caught.exception.pointer.startswith("/ops/0/harness"))
        self.assertIn("no harness", caught.exception.message)

    def test_refuses_connectors_in_different_blocks(self) -> None:
        document = rich_document()
        document["harnesses"].append(empty_harness("har_2", "H2"))
        document["harnesses"][1]["ends"].append(end("end_other", "occ_body2", "J1"))
        canonical(document)
        with self.assertRaises(ops.OpRefused) as caught:
            self.connect(document, link_id="link_blocks",
                         a={"occurrence": "occ_a", "connector": "J2"},
                         b={"occurrence": "occ_body2", "connector": "J1"})
        self.assertTrue(caught.exception.pointer.startswith("/ops/0/link"))
        self.assertIn("different harness blocks", caught.exception.message)

    def test_refuses_naming_a_block_other_than_the_connectors(self) -> None:
        document = rich_document()
        document["harnesses"].append(empty_harness("har_2", "H2"))
        canonical(document)
        with self.assertRaises(ops.OpRefused) as caught:
            self.connect(document, link_id="link_named",
                         a={"occurrence": "occ_a", "connector": "J2"},
                         b={"occurrence": "occ_b", "connector": "J1"},
                         harness="har_2")
        self.assertTrue(caught.exception.pointer.startswith("/ops/0/harness"))
        self.assertIn("already belongs to harness", caught.exception.message)

    def test_refuses_a_missing_new_ends_side(self) -> None:
        with self.assertRaises(ops.OpRefused) as caught:
            self.connect(rich_document(), link_id="link_short",
                         a={"occurrence": "occ_a", "connector": "J7"},
                         b={"occurrence": "occ_b", "connector": "J8"},
                         new_harness={"id": "har_new", "label": "H new"},
                         new_ends={"a": "end_only"})
        self.assertTrue(caught.exception.pointer.startswith("/ops/0/newEnds/b"))
        self.assertIn("needs a new end", caught.exception.message)

    def test_does_not_add_an_end_for_a_connector_already_in_the_block(self) -> None:
        before = rich_document()
        document = self.connect(
            before, link_id="link_existing",
            a={"occurrence": "occ_a", "connector": "J2"},
            b={"occurrence": "occ_b", "connector": "J1"},
            harness="har_1", new_ends={},
        )
        self.assertEqual([item["id"] for item in document["harnesses"][0]["ends"]],
                         [item["id"] for item in before["harnesses"][0]["ends"]])
        self.assertIn("link_existing", [item["id"] for item in document["harnesses"][0]["links"]])


if __name__ == "__main__":
    unittest.main()
