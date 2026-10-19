"""The recorded inverse and touched ids (CONTRACTS.md §3.3).

For a request ``R`` applied to ``D`` giving ``D'``, applying ``R``'s inverse to
``D'`` with ``undo=True`` must give exactly ``D``.
"""

from __future__ import annotations

import copy
import random
import unittest

from app.system_builder import integrity, ops
from app.system_builder.document import canonical, empty_harness, new_document

LIMITS = integrity.Limits()


def pose(x: int = 0, y: int = 0, z: int = 0) -> dict:
    return {"translation": {"xNm": x, "yNm": y, "zNm": z}, "rotation": {"x": 0, "y": 0, "z": 0, "w": 1}}


def commit(number: int) -> str:
    return f"{number:040x}"


def occurrence(occurrence_id: str, label: str = "O", *, kind: str = "board",
               followed: bool = False, number: int = 1) -> dict:
    if kind == "body":
        source = {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_1"}
    elif followed:
        source = {"kind": "board", "projectId": "prj_00000000000a",
                  "track": {"kind": "followed", "branch": "main", "commit": commit(number),
                            "reviewedCommit": commit(number + 1)}}
    else:
        source = {"kind": "board", "projectId": "prj_000000000002",
                  "track": {"kind": "pinned", "commit": commit(number)}}
    return {"id": occurrence_id, "label": label, "source": source}


def end(end_id: str, occurrence_id: str | None = None, connector: str = "J1") -> dict:
    item = {"id": end_id, "contacts": {}, "pinMap": []}
    if occurrence_id:
        item["site"] = {"occurrence": occurrence_id, "connector": connector}
    return item


def wire(wire_id: str, start: str, finish: str, *, link: str | None = None,
         route: list[str] | None = None) -> dict:
    item = {"id": wire_id,
            "from": {"kind": "contact", "end": start, "cavity": "1"},
            "to": {"kind": "contact", "end": finish, "cavity": "2"},
            "route": list(route or [])}
    if link:
        item["link"] = link
    return item


def rich_document() -> dict:
    document = new_document("Rich", "A description")
    document["sheets"] = [
        {"id": "sh_root", "name": "Root"},
        {"id": "sh_child", "name": "Child", "parent": "sh_root"},
    ]
    document["occurrences"] = [
        occurrence("occ_a", "A", number=1),
        occurrence("occ_b", "B", number=2),
        occurrence("occ_follow", "F", followed=True, number=3),
        occurrence("occ_body", "Body", kind="body"),
        occurrence("occ_body2", "Body2", kind="body"),
    ]
    document["occurrences"][0]["sheet"] = "sh_child"
    document["occurrences"][0]["positioningMate"] = "mate_a"
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
    document["harnesses"] = [{
        "id": "har_1", "label": "H1", "sheet": "sh_child",
        "ends": [end("end_a", "occ_a", "J2"), end("end_b", "occ_b", "J1"), end("end_body", "occ_body", "J9")],
        "links": [
            {"id": "link_1", "a": {"occurrence": "occ_a", "connector": "J2",
                                   "subPort": {"kind": "occurrence", "id": "sub_a"}},
             "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": ["3"]},
        ],
        "wires": [wire("wire_1", "end_a", "end_b", link="link_1", route=["seg_1"]),
                  {"id": "wire_splice", "from": {"kind": "splice", "splice": "spl_1"},
                   "to": {"kind": "contact", "end": "end_b", "cavity": "2"}, "route": []},
                  {"id": "wire_loose", "from": {"kind": "loose", "looseEnd": "loose_1"},
                   "to": {"kind": "contact", "end": "end_b", "cavity": "3"}, "route": []}],
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
    ]
    document["waivers"] = [{"id": "wav_1", "code": "net-unconnected", "subject": "x", "reason": "y"}]
    document["layout"] = {
        "occ_a": {"sheet": "sh_child", "xNm": 1, "yNm": 2, "rotationDeg": 0, "mirror": False},
        "har_1": {"xNm": 3, "yNm": 4, "rotationDeg": 90, "mirror": True},
    }
    return canonical(document)


def item_in(document: dict, collection: str, object_id: str) -> dict | None:
    return next((item for item in document[collection] if item["id"] == object_id), None)


class InverseTest(unittest.TestCase):
    def round_trip(self, document: dict, request: list[dict]) -> ops.Applied:
        applied = ops.apply(document, request, seen_ids=frozenset(), limits=LIMITS)
        back = ops.apply(applied.document, applied.inverse, seen_ids=applied.seen_ids,
                         limits=LIMITS, undo=True)
        self.assertEqual(back.document, document)
        return applied

    def test_every_op_kind_round_trips(self) -> None:
        base = rich_document()
        harness = base["harnesses"][0]

        def cloned(collection: str, object_id: str) -> dict:
            return copy.deepcopy(item_in(base, collection, object_id))

        def cloned_harness(collection: str, object_id: str) -> dict:
            return copy.deepcopy(next(item for item in harness[collection] if item["id"] == object_id))

        sheet = cloned("sheets", "sh_child")
        sheet["name"] = "Child renamed"
        occurrence_copy = cloned("occurrences", "occ_b")
        occurrence_copy["label"] = "B renamed"
        sub_port = cloned("subPorts", "sub_a")
        sub_port["name"] = "CAN renamed"
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

        requests = [
            ("add-sheet", [{"kind": "add-sheet", "sheet": {"id": "sh_new", "name": "New"}}]),
            ("add-occurrence", [{"kind": "add-occurrence", "occurrence": occurrence("occ_new")}]),
            ("add-sub-port", [{"kind": "add-sub-port", "subPort": {
                "id": "sub_new", "occurrence": "occ_b", "connector": "J1", "name": "P",
                "pins": ["1", "2"]}}]),
            ("add-body-connector", [{"kind": "add-body-connector", "bodyConnector": {
                "id": "bc_new", "occurrence": "occ_body2", "refdes": "J8",
                "part": {"componentId": "cmp_conn"}, "frame": pose(), "quarterTurns": 0}}]),
            ("add-mate", [{"kind": "add-mate", "mate": {
                "id": "mate_new", "a": {"occurrence": "occ_a", "connector": "J1"},
                "b": {"occurrence": "occ_b", "connector": "J1"},
                "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}}}]),
            ("add-harness", [{"kind": "add-harness", "harness": empty_harness("har_new", "H new")}]),
            ("add-export", [{"kind": "add-export", "export": {
                "id": "exp_new", "name": "E new", "site": {"occurrence": "occ_b", "connector": "J1"},
                "pinNames": {"1": "A"}}}]),
            ("add-waiver", [{"kind": "add-waiver", "waiver": {
                "id": "wav_new", "code": "net-unconnected", "subject": "s", "reason": "r"}}]),
            ("add-end", [{"kind": "add-end", "harness": "har_1", "end": end("end_new")}]),
            ("add-link", [{"kind": "add-link", "harness": "har_1", "link": {
                "id": "link_new", "a": {"occurrence": "occ_a", "connector": "J2"},
                "b": {"occurrence": "occ_b", "connector": "J1"}, "unmapped": []}}]),
            ("add-wire", [{"kind": "add-wire", "harness": "har_1",
                           "wire": wire("wire_new", "end_a", "end_b")}]),
            ("add-splice", [{"kind": "add-splice", "harness": "har_1",
                             "splice": {"id": "spl_new", "method": "solder", "confirmed": True}}]),
            ("add-branch-point", [{"kind": "add-branch-point", "harness": "har_1",
                                   "branchPoint": {"id": "bp_new"}}]),
            ("add-segment", [{"kind": "add-segment", "harness": "har_1", "segment": {
                "id": "seg_new", "from": {"kind": "end", "end": "end_a"},
                "to": {"kind": "end", "end": "end_b"}}}]),
            ("add-covering", [{"kind": "add-covering", "harness": "har_1",
                               "covering": {"id": "cov_new", "segment": "seg_1", "kind": "tape"}}]),
            ("add-cable", [{"kind": "add-cable", "harness": "har_1",
                            "cable": {"id": "cab_new", "conductors": [{"name": "1", "drain": False}]}}]),
            ("add-loose-end", [{"kind": "add-loose-end", "harness": "har_1",
                                "looseEnd": {"id": "loose_new", "kind": "open"}}]),
            ("add-marker", [{"kind": "add-marker", "harness": "har_1",
                             "marker": {"id": "mark_new", "wire": "wire_1", "kind": "label",
                                        "text": "M"}}]),
            ("add-waypoint", [{"kind": "add-waypoint", "harness": "har_1", "waypoint": {
                "id": "wp_new", "segment": "seg_1", "position": {"xNm": 1, "yNm": 2, "zNm": 0},
                "order": 1}}]),
            ("replace-sheet", [{"kind": "replace-sheet", "sheet": sheet}]),
            ("replace-occurrence", [{"kind": "replace-occurrence", "occurrence": occurrence_copy}]),
            ("replace-sub-port", [{"kind": "replace-sub-port", "subPort": sub_port}]),
            ("replace-body-connector", [{"kind": "replace-body-connector",
                                         "bodyConnector": body_connector}]),
            ("replace-mate", [{"kind": "replace-mate", "mate": mate}]),
            ("replace-harness", [{"kind": "replace-harness", "harness": {
                "id": "har_1", "label": "H renamed", "sheet": "sh_root"}}]),
            ("replace-export", [{"kind": "replace-export", "export": export}]),
            ("replace-end", [{"kind": "replace-end", "harness": "har_1", "end": harness_end}]),
            ("replace-link", [{"kind": "replace-link", "harness": "har_1", "link": link}]),
            ("replace-wire", [{"kind": "replace-wire", "harness": "har_1", "wire": harness_wire}]),
            ("replace-splice", [{"kind": "replace-splice", "harness": "har_1", "splice": splice}]),
            ("replace-branch-point", [{"kind": "replace-branch-point", "harness": "har_1",
                                       "branchPoint": branch}]),
            ("replace-segment", [{"kind": "replace-segment", "harness": "har_1", "segment": segment}]),
            ("replace-covering", [{"kind": "replace-covering", "harness": "har_1",
                                   "covering": covering}]),
            ("replace-cable", [{"kind": "replace-cable", "harness": "har_1", "cable": cable}]),
            ("replace-loose-end", [{"kind": "replace-loose-end", "harness": "har_1",
                                    "looseEnd": loose}]),
            ("replace-marker", [{"kind": "replace-marker", "harness": "har_1", "marker": marker}]),
            ("replace-waypoint", [{"kind": "replace-waypoint", "harness": "har_1",
                                   "waypoint": waypoint}]),
            ("remove-sheet", [{"kind": "remove-sheet", "id": "sh_child"}]),
            ("remove-occurrence", [{"kind": "remove-occurrence", "id": "occ_a"}]),
            ("remove-sub-port", [{"kind": "remove-sub-port", "id": "sub_a"}]),
            ("remove-body-connector", [{"kind": "remove-body-connector", "id": "bc_1"}]),
            ("remove-mate", [{"kind": "remove-mate", "id": "mate_a"}]),
            ("remove-harness", [{"kind": "remove-harness", "id": "har_1"}]),
            ("remove-export", [{"kind": "remove-export", "id": "exp_1"}]),
            ("remove-waiver", [{"kind": "remove-waiver", "id": "wav_1"}]),
            ("remove-end", [{"kind": "remove-end", "harness": "har_1", "id": "end_a"}]),
            ("remove-link", [{"kind": "remove-link", "harness": "har_1", "id": "link_1"}]),
            ("remove-wire", [{"kind": "remove-wire", "harness": "har_1", "id": "wire_1"}]),
            ("remove-splice", [{"kind": "remove-splice", "harness": "har_1", "id": "spl_1"}]),
            ("remove-branch-point", [{"kind": "remove-branch-point", "harness": "har_1", "id": "bp_1"}]),
            ("remove-segment", [{"kind": "remove-segment", "harness": "har_1", "id": "seg_1"}]),
            ("remove-covering", [{"kind": "remove-covering", "harness": "har_1", "id": "cov_1"}]),
            ("remove-cable", [{"kind": "remove-cable", "harness": "har_1", "id": "cab_1"}]),
            ("remove-loose-end", [{"kind": "remove-loose-end", "harness": "har_1",
                                   "id": "loose_1"}]),
            ("remove-marker", [{"kind": "remove-marker", "harness": "har_1", "id": "mark_1"}]),
            ("remove-waypoint", [{"kind": "remove-waypoint", "harness": "har_1", "id": "wp_1"}]),
            ("set-system-info", [{"kind": "set-system-info", "name": "Renamed",
                                  "description": None}]),
            ("connect-harness", [{"kind": "connect-harness",
                                  "newHarness": {"id": "har_new", "label": "H new"},
                                  "newEnds": {"a": "end_new_a", "b": "end_new_b"},
                                  "link": {"id": "link_new",
                                           "a": {"occurrence": "occ_a", "connector": "J7"},
                                           "b": {"occurrence": "occ_b", "connector": "J8"},
                                           "unmapped": []}}]),
            ("dismiss-suggestion", [{"kind": "dismiss-suggestion", "suggestion": {
                "occurrence": "occ_b", "connector": "J1", "key": "unit:2"}}]),
            ("restore-suggestion", [{"kind": "restore-suggestion", "suggestion": {
                "occurrence": "occ_a", "connector": "J2", "key": "power"}}]),
            ("set-layout", [{"kind": "set-layout", "item": "occ_b", "placement": {
                "xNm": 9, "yNm": 9, "rotationDeg": 0, "mirror": False}}]),
            ("remove-layout", [{"kind": "remove-layout", "item": "occ_a"}]),
            ("advance-occurrence", [{"kind": "advance-occurrence", "occurrence": "occ_follow",
                                     "commit": "c" * 40}]),
            ("acknowledge-changes", [{"kind": "acknowledge-changes", "occurrence": "occ_follow"}]),
        ]
        for label, request in requests:
            with self.subTest(kind=label):
                self.round_trip(rich_document(), request)

    def test_a_multi_op_request_round_trips(self) -> None:
        request = [
            {"kind": "add-sheet", "sheet": {"id": "sh_new", "name": "New"}},
            {"kind": "add-occurrence", "occurrence": occurrence("occ_new")},
            {"kind": "add-sub-port", "subPort": {"id": "sub_new", "occurrence": "occ_new",
                                                 "connector": "J1", "name": "P", "pins": ["1"]}},
            {"kind": "connect-harness", "newHarness": {"id": "har_new", "label": "H new"},
             "newEnds": {"a": "end_new_a", "b": "end_new_b"},
             "link": {"id": "link_new", "a": {"occurrence": "occ_new", "connector": "J1",
                                              "subPort": {"kind": "occurrence", "id": "sub_new"}},
                      "b": {"occurrence": "occ_b", "connector": "J8"}, "unmapped": []}},
            {"kind": "set-layout", "item": "occ_new", "placement": {
                "xNm": 5, "yNm": 6, "rotationDeg": 0, "mirror": False}},
            {"kind": "dismiss-suggestion", "suggestion": {"occurrence": "occ_b", "connector": "J1",
                                                          "key": "unit:2"}},
            {"kind": "replace-wire", "harness": "har_1", "wire": dict(
                rich_document()["harnesses"][0]["wires"][0], label="Renamed")},
            {"kind": "remove-marker", "harness": "har_1", "id": "mark_1"},
            {"kind": "set-system-info", "name": "Renamed", "description": "Changed"},
        ]
        self.round_trip(rich_document(), request)

    def test_a_seeded_generator_round_trips_after_every_step(self) -> None:
        generator = RandomOperations(20261020)
        document = generator.start()
        seen: frozenset[str] = frozenset()
        for step in range(350):
            request_op = generator.next(document)
            self.assertIsNotNone(request_op, f"no op at step {step}")
            try:
                applied = ops.apply(document, [request_op], seen_ids=seen, limits=LIMITS)
            except ops.OpRefused as error:  # pragma: no cover - a generator bug, not an engine one
                self.fail(f"step {step}: generated op was refused: {error}\n{request_op}")
            self.assertNotEqual(applied.inverse, [], f"step {step} produced a no-op: {request_op}")
            back = ops.apply(applied.document, applied.inverse, seen_ids=applied.seen_ids,
                             limits=LIMITS, undo=True)
            self.assertEqual(back.document, document, f"step {step}: {request_op}")
            document, seen = applied.document, applied.seen_ids

    def test_touched_ids_for_two_wires_are_disjoint_and_omit_the_harness(self) -> None:
        base = rich_document()
        first = copy.deepcopy(base["harnesses"][0]["wires"][0])
        second = copy.deepcopy(base["harnesses"][0]["wires"][1])
        first["label"] = "First"
        second["label"] = "Second"
        left = ops.apply(base, [{"kind": "replace-wire", "harness": "har_1", "wire": first}],
                         seen_ids=frozenset(), limits=LIMITS)
        right = ops.apply(base, [{"kind": "replace-wire", "harness": "har_1", "wire": second}],
                          seen_ids=frozenset(), limits=LIMITS)
        self.assertEqual(left.touched, frozenset({first["id"]}))
        self.assertEqual(right.touched, frozenset({second["id"]}))
        self.assertFalse(left.touched & right.touched)
        self.assertNotIn("har_1", left.touched | right.touched)

    def test_touched_ids_for_relabelling_a_harness_include_the_harness(self) -> None:
        applied = ops.apply(rich_document(), [{"kind": "replace-harness",
                                               "harness": {"id": "har_1", "label": "H2"}}],
                            seen_ids=frozenset(), limits=LIMITS)
        self.assertEqual(applied.touched, frozenset({"har_1"}))

    def test_touched_ids_for_a_removed_occurrence_include_every_cascaded_object(self) -> None:
        applied = ops.apply(rich_document(), [{"kind": "remove-occurrence", "id": "occ_a"}],
                            seen_ids=frozenset(), limits=LIMITS)
        self.assertEqual(applied.touched, frozenset({
            "occ_a", "sub_a", "mate_a", "exp_1", "link_1", "wire_1", "end_a",
            "mark_1", "cab_1", "dismissed:occ_a|J2|power", "layout:occ_a",
        }))


class EdgeInverseTest(unittest.TestCase):
    """Inverses that once failed: an empty request, cascades over suggestions, body connectors."""

    def test_a_no_op_request_has_an_empty_inverse_and_touches_nothing(self) -> None:
        document = rich_document()
        applied = ops.apply(document, [{"kind": "set-system-info", "name": document["name"]}],
                            seen_ids=frozenset(), limits=LIMITS)
        self.assertEqual((applied.inverse, applied.touched), ([], frozenset()))

    def test_inverse_of_adding_an_occurrence_with_a_dismissed_suggestion(self) -> None:
        document = rich_document()
        request = [
            {"kind": "add-occurrence", "occurrence": occurrence("occ_new")},
            {"kind": "dismiss-suggestion", "suggestion": {"occurrence": "occ_new",
                                                          "connector": "J1", "key": "power"}},
        ]
        applied = ops.apply(document, request, seen_ids=frozenset(), limits=LIMITS)
        back = ops.apply(applied.document, applied.inverse, seen_ids=applied.seen_ids,
                         limits=LIMITS, undo=True)
        self.assertEqual(back.document, document)

    def test_nothing_names_a_body_connector_before_it_is_placed(self) -> None:
        # So removing a body connector, as the inverse of adding it, never cascades into older objects.
        request = [{"kind": "add-mate", "mate": {
            "id": "mate_new", "a": {"occurrence": "occ_a", "connector": "J7"},
            "b": {"occurrence": "occ_body2", "connector": "J7"},
            "orientation": {"quarterTurns": 0, "flip": False}, "rows": {}}}]
        with self.assertRaises(ops.OpRefused) as refused:
            ops.apply(rich_document(), request, seen_ids=frozenset(), limits=LIMITS)
        self.assertIn("the body has no connector 'J7'", refused.exception.message)


class RandomOperations:
    """One valid operation at a time, chosen from the current document's ids."""

    def __init__(self, seed: int) -> None:
        self.rng = random.Random(seed)
        self.n = 0

    def start(self) -> dict:
        return canonical({
            "schema": "prism.system.v2", "name": "Random",
            "sheets": [{"id": "sh_root", "name": "R"}],
            "occurrences": [occurrence("occ_a", number=1), occurrence("occ_b", number=2),
                            occurrence("occ_follow", "F", followed=True, number=3),
                            occurrence("occ_body", "B", kind="body")],
            "subPorts": [], "dismissedSuggestions": [], "bodyConnectors": [], "mates": [],
            "harnesses": [empty_harness("har_1", "H1")],
            "exports": [], "waivers": [], "layout": {},
        })

    # ---------------------------------------------------------------- ids

    def fresh(self, prefix: str) -> str:
        self.n += 1
        return f"{prefix}_{self.n}"

    def unum(self) -> int:
        self.n += 1
        return self.n

    def ids(self, document: dict, collection: str) -> list[str]:
        return [item["id"] for item in document[collection]]

    def harness(self, document: dict) -> dict | None:
        return self.rng.choice(document["harnesses"]) if document["harnesses"] else None

    def choose_harness_item(self, document: dict, collection: str):
        harnesses = [item for item in document["harnesses"] if item[collection]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        return harness, self.rng.choice(harness[collection])

    def followed(self, document: dict) -> list[str]:
        return [item["id"] for item in document["occurrences"]
                if item["source"]["kind"] == "board" and item["source"]["track"]["kind"] == "followed"]

    def boards(self, document: dict) -> list[str]:
        """Occurrences any connector name is valid on: a body's connectors must be placed first."""
        return [item["id"] for item in document["occurrences"] if item["source"]["kind"] == "board"]

    def bodies(self, document: dict) -> list[str]:
        return [item["id"] for item in document["occurrences"] if item["source"]["kind"] == "body"]

    # ----------------------------------------------------------- dispatch

    def next(self, document: dict) -> dict | None:
        builders = [
            self.add_sheet, self.remove_sheet, self.replace_sheet,
            self.add_occurrence, self.remove_occurrence, self.replace_occurrence,
            self.add_sub_port, self.remove_sub_port, self.replace_sub_port,
            self.add_body_connector, self.remove_body_connector, self.replace_body_connector,
            self.add_mate, self.remove_mate, self.replace_mate,
            self.add_harness, self.remove_harness, self.replace_harness,
            self.add_end, self.remove_end, self.replace_end,
            self.add_link, self.remove_link, self.replace_link,
            self.add_wire, self.remove_wire, self.replace_wire,
            self.add_splice, self.remove_splice, self.replace_splice,
            self.add_branch_point, self.remove_branch_point, self.replace_branch_point,
            self.add_segment, self.remove_segment, self.replace_segment,
            self.add_covering, self.remove_covering, self.replace_covering,
            self.add_cable, self.remove_cable, self.replace_cable,
            self.add_loose_end, self.remove_loose_end, self.replace_loose_end,
            self.add_marker, self.remove_marker, self.replace_marker,
            self.add_waypoint, self.remove_waypoint, self.replace_waypoint,
            self.add_export, self.remove_export, self.replace_export,
            self.add_waiver, self.remove_waiver,
            self.connect_harness, self.dismiss, self.restore,
            self.set_info, self.set_layout, self.remove_layout,
            self.advance, self.acknowledge,
        ]
        for _ in range(200):
            op = self.rng.choice(builders)(document)
            if op is not None:
                return op
        return None

    # -------------------------------------------------------- top level

    def add_sheet(self, document: dict) -> dict:
        return {"kind": "add-sheet", "sheet": {"id": self.fresh("sh"), "name": "S"}}

    def remove_sheet(self, document: dict) -> dict | None:
        return self._remove(document, "sheets", "sheet")

    def replace_sheet(self, document: dict) -> dict | None:
        return self._replace(document, "sheets", "sheet", lambda item: item.__setitem__("name", self.fresh("n")))

    def add_occurrence(self, document: dict) -> dict:
        kind = self.rng.choice(["board", "board", "body", "followed"])
        return {"kind": "add-occurrence", "occurrence": occurrence(
            self.fresh("occ"), "O", kind="body" if kind == "body" else "board",
            followed=kind == "followed", number=self.unum())}

    def remove_occurrence(self, document: dict) -> dict | None:
        return self._remove(document, "occurrences", "occurrence")

    def replace_occurrence(self, document: dict) -> dict | None:
        return self._replace(document, "occurrences", "occurrence",
                             lambda item: item.__setitem__("label", self.fresh("l")))

    def add_sub_port(self, document: dict) -> dict | None:
        occurrences = self.boards(document)
        if not occurrences:
            return None
        return {"kind": "add-sub-port", "subPort": {
            "id": self.fresh("sub"), "occurrence": self.rng.choice(occurrences),
            "connector": "J1", "name": "P", "pins": ["1", "2"]}}

    def _remove(self, document: dict, collection: str, noun: str) -> dict | None:
        values = self.ids(document, collection)
        if not values:
            return None
        return {"kind": f"remove-{noun}", "id": self.rng.choice(values)}

    def _replace(self, document: dict, collection: str, noun: str, mutate) -> dict | None:
        values = document[collection]
        if not values:
            return None
        item = copy.deepcopy(self.rng.choice(values))
        mutate(item)
        head, *rest = noun.split("-")
        payload = head + "".join(part.capitalize() for part in rest)
        return {"kind": f"replace-{noun}", payload: item}

    def remove_sub_port(self, document: dict) -> dict | None:
        return self._remove(document, "subPorts", "sub-port")

    def replace_sub_port(self, document: dict) -> dict | None:
        return self._replace(document, "subPorts", "sub-port",
                             lambda item: item.__setitem__("name", self.fresh("n")))

    def add_body_connector(self, document: dict) -> dict | None:
        bodies = self.bodies(document)
        if not bodies:
            return None
        occurrence = self.rng.choice(bodies)
        referenced = {item["refdes"] for item in document["bodyConnectors"]
                      if item["occurrence"] == occurrence}
        for mate in document["mates"]:
            for side in ("a", "b"):
                if mate[side]["occurrence"] == occurrence:
                    referenced.add(mate[side]["connector"])
        for item in document["subPorts"]:
            if item["occurrence"] == occurrence:
                referenced.add(item["connector"])
        for item in document["dismissedSuggestions"]:
            if item["occurrence"] == occurrence:
                referenced.add(item["connector"])
        for item in document["exports"]:
            if item["site"]["occurrence"] == occurrence:
                referenced.add(item["site"]["connector"])
        for harness in document["harnesses"]:
            for harness_end in harness["ends"]:
                site = harness_end.get("site")
                if site and site["occurrence"] == occurrence:
                    referenced.add(site["connector"])
            for link in harness["links"]:
                for side in ("a", "b"):
                    if link[side]["occurrence"] == occurrence:
                        referenced.add(link[side]["connector"])
        refdes = next((f"J{number}" for number in range(1, 30) if f"J{number}" not in referenced), None)
        if refdes is None:
            return None
        return {"kind": "add-body-connector", "bodyConnector": {
            "id": self.fresh("bc"), "occurrence": occurrence, "refdes": refdes,
            "part": {"componentId": "cmp_conn"}, "frame": pose(), "quarterTurns": 0}}

    def remove_body_connector(self, document: dict) -> dict | None:
        return self._remove(document, "bodyConnectors", "body-connector")

    def replace_body_connector(self, document: dict) -> dict | None:
        return self._replace(document, "bodyConnectors", "body-connector",
                             lambda item: item.__setitem__("part", {"componentId": self.fresh("cmp")}))

    def add_mate(self, document: dict) -> dict | None:
        occurrences = self.boards(document)
        if len(occurrences) < 2:
            return None
        a, b = self.rng.sample(occurrences, 2)
        return {"kind": "add-mate", "mate": {
            "id": self.fresh("mate"),
            "a": {"occurrence": a, "connector": "J1"}, "b": {"occurrence": b, "connector": "J1"},
            "orientation": {"quarterTurns": self.rng.randrange(4), "flip": False}, "rows": {}}}

    def remove_mate(self, document: dict) -> dict | None:
        return self._remove(document, "mates", "mate")

    def replace_mate(self, document: dict) -> dict | None:
        return self._replace(document, "mates", "mate",
                             lambda item: item.__setitem__("rows", {"1": {"signal": self.fresh("s")}}))

    def add_harness(self, document: dict) -> dict:
        return {"kind": "add-harness", "harness": empty_harness(self.fresh("har"), "H")}

    def remove_harness(self, document: dict) -> dict | None:
        return self._remove(document, "harnesses", "harness")

    def replace_harness(self, document: dict) -> dict | None:
        if not document["harnesses"]:
            return None
        harness = self.rng.choice(document["harnesses"])
        return {"kind": "replace-harness", "harness": {"id": harness["id"], "label": self.fresh("h")}}

    # ---------------------------------------------------- harness contents

    def _add_simple(self, document: dict, noun: str, payload: str, item: dict) -> dict | None:
        harness = self.harness(document)
        if harness is None:
            return None
        item = dict(item)
        item["id"] = self.fresh({"branchPoint": "bp", "looseEnd": "loose"}.get(payload, payload))
        return {"kind": f"add-{noun}", "harness": harness["id"], payload: item}

    def _remove_item(self, document: dict, collection: str, noun: str) -> dict | None:
        chosen = self.choose_harness_item(document, collection)
        if chosen is None:
            return None
        harness, item = chosen
        return {"kind": f"remove-{noun}", "harness": harness["id"], "id": item["id"]}

    def _replace_item(self, document: dict, collection: str, noun: str, payload: str, mutate) -> dict | None:
        chosen = self.choose_harness_item(document, collection)
        if chosen is None:
            return None
        harness, item = chosen
        replacement = copy.deepcopy(item)
        mutate(replacement)
        return {"kind": f"replace-{noun}", "harness": harness["id"], payload: replacement}

    def add_end(self, document: dict) -> dict | None:
        harness = self.harness(document)
        if harness is None:
            return None
        item = {"id": self.fresh("end"), "contacts": {}, "pinMap": []}
        if self.rng.random() < 0.6:
            occurrences = self.boards(document)
            if occurrences:
                owners = {(site["occurrence"], site["connector"])
                          for other in document["harnesses"] for harness_end in other["ends"]
                          if (site := harness_end.get("site"))}
                options = [(occurrence, f"J{number}") for occurrence in occurrences
                           for number in range(1, 5) if (occurrence, f"J{number}") not in owners]
                if options:
                    occurrence, connector = self.rng.choice(options)
                    item["site"] = {"occurrence": occurrence, "connector": connector}
        return {"kind": "add-end", "harness": harness["id"], "end": item}

    def remove_end(self, document: dict) -> dict | None:
        return self._remove_item(document, "ends", "end")

    def replace_end(self, document: dict) -> dict | None:
        return self._replace_item(document, "ends", "end", "end",
                                  lambda item: item.__setitem__("bootLengthNm", self.unum()))

    def add_link(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"]
                     if any(harness_end.get("site") for harness_end in item["ends"])]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        sites = [harness_end["site"] for harness_end in harness["ends"] if harness_end.get("site")]
        a, b = self.rng.choice(sites), self.rng.choice(sites)
        return {"kind": "add-link", "harness": harness["id"], "link": {
            "id": self.fresh("link"),
            "a": {"occurrence": a["occurrence"], "connector": a["connector"]},
            "b": {"occurrence": b["occurrence"], "connector": b["connector"]},
            "unmapped": []}}

    def remove_link(self, document: dict) -> dict | None:
        return self._remove_item(document, "links", "link")

    def replace_link(self, document: dict) -> dict | None:
        return self._replace_item(document, "links", "link", "link",
                                  lambda item: item.__setitem__("unmapped", [str(self.unum())]))

    def add_wire(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"] if item["ends"]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        ends = [item["id"] for item in harness["ends"]]
        item = {"id": self.fresh("wire"),
                "from": {"kind": "contact", "end": self.rng.choice(ends), "cavity": "1"},
                "to": {"kind": "contact", "end": self.rng.choice(ends), "cavity": "2"},
                "route": []}
        if harness["links"] and self.rng.random() < 0.5:
            item["link"] = self.rng.choice(harness["links"])["id"]
        if harness["segments"] and self.rng.random() < 0.4:
            item["route"] = [self.rng.choice(harness["segments"])["id"]]
        return {"kind": "add-wire", "harness": harness["id"], "wire": item}

    def remove_wire(self, document: dict) -> dict | None:
        return self._remove_item(document, "wires", "wire")

    def replace_wire(self, document: dict) -> dict | None:
        return self._replace_item(document, "wires", "wire", "wire",
                                  lambda item: item.__setitem__("label", self.fresh("w")))

    def add_splice(self, document: dict) -> dict | None:
        return self._add_simple(document, "splice", "splice",
                                {"method": "crimp", "confirmed": False})

    def remove_splice(self, document: dict) -> dict | None:
        return self._remove_item(document, "splices", "splice")

    def replace_splice(self, document: dict) -> dict | None:
        return self._replace_item(document, "splices", "splice", "splice",
                                  lambda item: item.__setitem__("confirmed", not item["confirmed"]))

    def add_branch_point(self, document: dict) -> dict | None:
        return self._add_simple(document, "branch-point", "branchPoint", {})

    def remove_branch_point(self, document: dict) -> dict | None:
        return self._remove_item(document, "branchPoints", "branch-point")

    def replace_branch_point(self, document: dict) -> dict | None:
        return self._replace_item(document, "branchPoints", "branch-point", "branchPoint",
                                  lambda item: item.__setitem__("position",
                                                                {"xNm": self.unum(), "yNm": 2, "zNm": 3}))

    def add_segment(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"]
                     if item["ends"] or item["branchPoints"]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        nodes = [("end", item["id"]) for item in harness["ends"]]
        nodes += [("branch-point", item["id"]) for item in harness["branchPoints"]]
        kind_a, a = self.rng.choice(nodes)
        kind_b, b = self.rng.choice(nodes)
        return {"kind": "add-segment", "harness": harness["id"], "segment": {
            "id": self.fresh("seg"),
            "from": {"kind": kind_a, ("end" if kind_a == "end" else "branchPoint"): a},
            "to": {"kind": kind_b, ("end" if kind_b == "end" else "branchPoint"): b}}}

    def remove_segment(self, document: dict) -> dict | None:
        return self._remove_item(document, "segments", "segment")

    def replace_segment(self, document: dict) -> dict | None:
        chosen = self.choose_harness_item(document, "segments")
        if chosen is None:
            return None
        harness, item = chosen
        nodes = [("end", harness_end["id"]) for harness_end in harness["ends"]]
        nodes += [("branch-point", branch["id"]) for branch in harness["branchPoints"]]
        current = (item["from"]["kind"], item["from"].get("end") or item["from"].get("branchPoint"))
        options = [node for node in nodes if node != current]
        if not options:
            return None
        kind_a, a = self.rng.choice(options)
        kind_b, b = self.rng.choice(nodes)
        segment = copy.deepcopy(item)
        segment["from"] = {"kind": kind_a, ("end" if kind_a == "end" else "branchPoint"): a}
        segment["to"] = {"kind": kind_b, ("end" if kind_b == "end" else "branchPoint"): b}
        return {"kind": "replace-segment", "harness": harness["id"], "segment": segment}

    def add_covering(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"] if item["segments"]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        return {"kind": "add-covering", "harness": harness["id"], "covering": {
            "id": self.fresh("cov"), "segment": self.rng.choice(harness["segments"])["id"],
            "kind": "sleeve"}}

    def remove_covering(self, document: dict) -> dict | None:
        return self._remove_item(document, "coverings", "covering")

    def replace_covering(self, document: dict) -> dict | None:
        return self._replace_item(document, "coverings", "covering", "covering",
                                  lambda item: item.__setitem__(
                                      "kind", "tape" if item["kind"] != "tape" else "sleeve"))

    def add_cable(self, document: dict) -> dict | None:
        harness = self.harness(document)
        if harness is None:
            return None
        conductor = {"name": "1", "drain": False}
        if harness["wires"] and self.rng.random() < 0.5:
            conductor["wire"] = self.rng.choice(harness["wires"])["id"]
        return {"kind": "add-cable", "harness": harness["id"], "cable": {
            "id": self.fresh("cab"), "conductors": [conductor]}}

    def remove_cable(self, document: dict) -> dict | None:
        return self._remove_item(document, "cables", "cable")

    def replace_cable(self, document: dict) -> dict | None:
        return self._replace_item(document, "cables", "cable", "cable",
                                  lambda item: item.__setitem__("label", self.fresh("c")))

    def add_loose_end(self, document: dict) -> dict | None:
        return self._add_simple(document, "loose-end", "looseEnd", {"kind": "pigtail"})

    def remove_loose_end(self, document: dict) -> dict | None:
        return self._remove_item(document, "looseEnds", "loose-end")

    def replace_loose_end(self, document: dict) -> dict | None:
        return self._replace_item(document, "looseEnds", "loose-end", "looseEnd",
                                  lambda item: item.__setitem__("label", self.fresh("l")))

    def add_marker(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"] if item["wires"]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        return {"kind": "add-marker", "harness": harness["id"], "marker": {
            "id": self.fresh("mark"), "wire": self.rng.choice(harness["wires"])["id"],
            "kind": "label", "text": "T"}}

    def remove_marker(self, document: dict) -> dict | None:
        return self._remove_item(document, "markers", "marker")

    def replace_marker(self, document: dict) -> dict | None:
        return self._replace_item(document, "markers", "marker", "marker",
                                  lambda item: item.__setitem__("text", self.fresh("t")))

    def add_waypoint(self, document: dict) -> dict | None:
        harnesses = [item for item in document["harnesses"] if item["segments"]]
        if not harnesses:
            return None
        harness = self.rng.choice(harnesses)
        return {"kind": "add-waypoint", "harness": harness["id"], "waypoint": {
            "id": self.fresh("wp"), "segment": self.rng.choice(harness["segments"])["id"],
            "position": {"xNm": self.unum(), "yNm": 2, "zNm": 3},
            "order": self.rng.randrange(4)}}

    def remove_waypoint(self, document: dict) -> dict | None:
        return self._remove_item(document, "waypoints", "waypoint")

    def replace_waypoint(self, document: dict) -> dict | None:
        return self._replace_item(document, "waypoints", "waypoint", "waypoint",
                                  lambda item: item.__setitem__("order", item["order"] + 1))

    # ----------------------------------------------------- exports, etc.

    def add_export(self, document: dict) -> dict | None:
        occurrences = self.boards(document)
        if not occurrences:
            return None
        return {"kind": "add-export", "export": {
            "id": self.fresh("exp"), "name": "E",
            "site": {"occurrence": self.rng.choice(occurrences), "connector": "J1"},
            "pinNames": {}}}

    def remove_export(self, document: dict) -> dict | None:
        return self._remove(document, "exports", "export")

    def replace_export(self, document: dict) -> dict | None:
        return self._replace(document, "exports", "export",
                             lambda item: item.__setitem__("name", self.fresh("e")))

    def add_waiver(self, document: dict) -> dict:
        return {"kind": "add-waiver", "waiver": {
            "id": self.fresh("wav"), "code": "net-unconnected", "subject": "s", "reason": "r"}}

    def remove_waiver(self, document: dict) -> dict | None:
        return self._remove(document, "waivers", "waiver")

    # ------------------------------------------------------------- gesture

    def connect_harness(self, document: dict) -> dict | None:
        occurrences = self.boards(document)
        if not occurrences:
            return None
        a, b = self.rng.choice(occurrences), self.rng.choice(occurrences)
        connector_a, connector_b = f"J{self.rng.randrange(1, 5)}", f"J{self.rng.randrange(1, 5)}"

        def owner(occurrence: str, connector: str) -> str | None:
            for harness in document["harnesses"]:
                for harness_end in harness["ends"]:
                    site = harness_end.get("site")
                    if site and (site["occurrence"], site["connector"]) == (occurrence, connector):
                        return harness["id"]
            return None

        owners = {item for item in (owner(a, connector_a), owner(b, connector_b)) if item}
        if len(owners) > 1:
            return None
        return {"kind": "connect-harness",
                "newHarness": {"id": self.fresh("har"), "label": "H"},
                "newEnds": {"a": self.fresh("end"), "b": self.fresh("end")},
                "link": {"id": self.fresh("link"),
                         "a": {"occurrence": a, "connector": connector_a},
                         "b": {"occurrence": b, "connector": connector_b}, "unmapped": []}}

    def dismiss(self, document: dict) -> dict | None:
        occurrences = self.boards(document)
        if not occurrences:
            return None
        return {"kind": "dismiss-suggestion", "suggestion": {
            "occurrence": self.rng.choice(occurrences), "connector": "J1",
            "key": self.fresh("k")}}

    def restore(self, document: dict) -> dict | None:
        if not document["dismissedSuggestions"]:
            return None
        return {"kind": "restore-suggestion",
                "suggestion": copy.deepcopy(self.rng.choice(document["dismissedSuggestions"]))}

    def set_info(self, document: dict) -> dict:
        if self.rng.random() < 0.5:
            return {"kind": "set-system-info", "name": self.fresh("n")}
        if "description" in document and self.rng.random() < 0.5:
            return {"kind": "set-system-info", "description": None}
        return {"kind": "set-system-info", "description": self.fresh("d")}

    def set_layout(self, document: dict) -> dict | None:
        items = self.ids(document, "occurrences") + self.ids(document, "harnesses") + self.ids(document, "sheets")
        if not items:
            return None
        return {"kind": "set-layout", "item": self.rng.choice(items),
                "placement": {"xNm": self.unum(), "yNm": self.unum(), "rotationDeg": 0,
                              "mirror": False}}

    def remove_layout(self, document: dict) -> dict | None:
        if not document["layout"]:
            return None
        return {"kind": "remove-layout", "item": self.rng.choice(sorted(document["layout"]))}

    def advance(self, document: dict) -> dict | None:
        followed = self.followed(document)
        if not followed:
            return None
        return {"kind": "advance-occurrence", "occurrence": self.rng.choice(followed),
                "commit": commit(10000 + self.unum())}

    def acknowledge(self, document: dict) -> dict | None:
        followed = self.followed(document)
        if not followed:
            return None
        occurrence_id = self.rng.choice(followed)
        track = next(item for item in document["occurrences"]
                     if item["id"] == occurrence_id)["source"]["track"]
        if track.get("reviewedCommit") == track["commit"]:
            return None
        return {"kind": "acknowledge-changes", "occurrence": occurrence_id}


if __name__ == "__main__":
    unittest.main()
