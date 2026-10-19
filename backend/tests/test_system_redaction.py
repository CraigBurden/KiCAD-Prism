"""Read-time redaction and protected ids (CONTRACTS.md §6)."""

from __future__ import annotations

import copy
import unittest

from app.system_builder import redaction
from app.system_builder.document import new_document

HIDDEN_PROJECT = "prj_0000000000aa"
VISIBLE_PROJECT = "prj_0000000000bb"


def pose() -> dict:
    return {"translation": {"xNm": 0, "yNm": 0, "zNm": 0}, "rotation": {"x": 0, "y": 0, "z": 0, "w": 1}}


def occurrence(occurrence_id: str, label: str, *, project: str | None = None) -> dict:
    if project is None:
        source = {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_1"}
    else:
        source = {"kind": "board", "projectId": project,
                  "track": {"kind": "pinned", "commit": "b" * 40}}
    return {"id": occurrence_id, "label": label, "source": source}


def end(end_id: str, occurrence_id: str) -> dict:
    return {"id": end_id, "site": {"occurrence": occurrence_id, "connector": "J2"},
            "contacts": {"1": {"componentId": "cmp_contact"}},
            "pinMap": [{"cavity": "1", "pad": "1"}]}


def document() -> dict:
    document = new_document("Redaction")
    document["occurrences"] = [
        occurrence("occ_hidden", "Hidden", project=HIDDEN_PROJECT),
        occurrence("occ_visible", "Visible", project=VISIBLE_PROJECT),
        occurrence("occ_body", "Body"),
    ]
    document["subPorts"] = [
        {"id": "sub_hidden", "occurrence": "occ_hidden", "connector": "J1", "name": "H",
         "pins": ["1", "2"], "suggestion": "bus:CAN"},
        {"id": "sub_visible", "occurrence": "occ_visible", "connector": "J1", "name": "V",
         "pins": ["1"], "suggestion": "power"},
    ]
    document["dismissedSuggestions"] = [
        {"occurrence": "occ_hidden", "connector": "J1", "key": "power"},
        {"occurrence": "occ_visible", "connector": "J1", "key": "unit:2"},
    ]
    document["bodyConnectors"] = [
        {"id": "bc_body", "occurrence": "occ_body", "refdes": "J9",
         "part": {"componentId": "cmp_conn"}, "frame": pose(), "quarterTurns": 0},
    ]
    document["mates"] = [
        {"id": "mate_hidden", "a": {"occurrence": "occ_hidden", "connector": "J1"},
         "b": {"occurrence": "occ_visible", "connector": "J1"},
         "orientation": {"quarterTurns": 0, "flip": False},
         "rows": {"1": {"signal": "S"}}, "manualMap": [{"a": "1", "b": "1"}]},
        {"id": "mate_visible", "a": {"occurrence": "occ_visible", "connector": "J1"},
         "b": {"occurrence": "occ_body", "connector": "J9"},
         "orientation": {"quarterTurns": 0, "flip": False},
         "rows": {"1": {"signal": "V"}}, "manualMap": [{"a": "1", "b": "1"}]},
    ]
    document["harnesses"] = [{
        "id": "har_1", "label": "H1",
        "ends": [end("end_hidden", "occ_hidden"), end("end_visible", "occ_visible")],
        "links": [
            {"id": "link_hidden_a", "a": {"occurrence": "occ_hidden", "connector": "J2"},
             "b": {"occurrence": "occ_visible", "connector": "J2"}, "unmapped": ["1"]},
            {"id": "link_hidden_b", "a": {"occurrence": "occ_visible", "connector": "J2"},
             "b": {"occurrence": "occ_hidden", "connector": "J2"}, "unmapped": ["9"]},
            {"id": "link_visible", "a": {"occurrence": "occ_visible", "connector": "J2"},
             "b": {"occurrence": "occ_visible", "connector": "J2"}, "unmapped": ["2"]},
        ],
        "wires": [
            {"id": "wire_mixed", "from": {"kind": "contact", "end": "end_hidden", "cavity": "1"},
             "to": {"kind": "contact", "end": "end_visible", "cavity": "2"}, "route": []},
            {"id": "wire_visible", "from": {"kind": "contact", "end": "end_visible", "cavity": "1"},
             "to": {"kind": "contact", "end": "end_visible", "cavity": "2"}, "route": []},
        ],
        "splices": [], "branchPoints": [], "segments": [], "coverings": [], "cables": [],
        "looseEnds": [], "markers": [
            {"id": "mark_hidden", "wire": "wire_mixed", "kind": "label", "text": "H"},
            {"id": "mark_visible", "wire": "wire_visible", "kind": "label", "text": "V"},
        ], "waypoints": [],
    }]
    document["exports"] = [
        {"id": "exp_hidden", "name": "H", "site": {"occurrence": "occ_hidden", "connector": "J1"},
         "pinNames": {"1": "A"}},
        {"id": "exp_visible", "name": "V", "site": {"occurrence": "occ_visible", "connector": "J1"},
         "pinNames": {"1": "B"}},
    ]
    document["waivers"] = []
    document["layout"] = {
        "occ_hidden": {"xNm": 1, "yNm": 2, "rotationDeg": 0, "mirror": False},
        "occ_visible": {"xNm": 3, "yNm": 4, "rotationDeg": 0, "mirror": False},
    }
    return document


def hidden_only() -> frozenset[str]:
    return frozenset({"occ_hidden"})


class HiddenOccurrencesTest(unittest.TestCase):
    def test_hidden_occurrences_are_board_occurrences_in_an_unseen_project(self) -> None:
        seen = {HIDDEN_PROJECT: False, VISIBLE_PROJECT: True}
        self.assertEqual(redaction.hidden_occurrences(document(), seen.__getitem__),
                         frozenset({"occ_hidden"}))

    def test_the_visibility_test_runs_once_per_project(self) -> None:
        content = new_document("X")
        content["occurrences"] = [
            occurrence("occ_1", "One", project=HIDDEN_PROJECT),
            occurrence("occ_2", "Two", project=HIDDEN_PROJECT),
            occurrence("occ_3", "Three", project=VISIBLE_PROJECT),
        ]
        calls: list[str] = []

        def can_see(project: str) -> bool:
            calls.append(project)
            return project != HIDDEN_PROJECT

        self.assertEqual(redaction.hidden_occurrences(content, can_see),
                         frozenset({"occ_1", "occ_2"}))
        self.assertEqual(calls, [HIDDEN_PROJECT, VISIBLE_PROJECT])


class RedactTest(unittest.TestCase):
    def setUp(self) -> None:
        self.document = document()
        self.before = copy.deepcopy(self.document)
        self.view = redaction.redact(self.document, hidden_only())

    def item(self, collection: str, object_id: str) -> dict:
        return next(item for item in self.view[collection] if item["id"] == object_id)

    def test_hidden_source_becomes_redacted_and_others_are_untouched(self) -> None:
        self.assertEqual(self.item("occurrences", "occ_hidden")["source"], {"kind": "redacted"})
        self.assertEqual(self.item("occurrences", "occ_hidden")["label"], "Hidden")
        visible = next(item for item in self.before["occurrences"] if item["id"] == "occ_visible")
        self.assertEqual(self.item("occurrences", "occ_visible"), visible)
        body = next(item for item in self.before["occurrences"] if item["id"] == "occ_body")
        self.assertEqual(self.item("occurrences", "occ_body"), body)

    def test_pins_and_suggestions_on_hidden_sub_ports_are_emptied(self) -> None:
        hidden = self.item("subPorts", "sub_hidden")
        self.assertEqual(hidden["pins"], [])
        self.assertNotIn("suggestion", hidden)
        visible = next(item for item in self.before["subPorts"] if item["id"] == "sub_visible")
        self.assertEqual(self.item("subPorts", "sub_visible"), visible)

    def test_dismissed_suggestions_for_hidden_occurrences_are_dropped(self) -> None:
        self.assertEqual(self.view["dismissedSuggestions"],
                         [{"occurrence": "occ_visible", "connector": "J1", "key": "unit:2"}])

    def test_mate_rows_and_manual_map_on_a_hidden_side_are_emptied(self) -> None:
        hidden = self.item("mates", "mate_hidden")
        self.assertEqual(hidden["rows"], {})
        self.assertNotIn("manualMap", hidden)
        visible = next(item for item in self.before["mates"] if item["id"] == "mate_visible")
        self.assertEqual(self.item("mates", "mate_visible"), visible)

    def test_export_pin_names_on_a_hidden_site_are_emptied(self) -> None:
        self.assertEqual(self.item("exports", "exp_hidden")["pinNames"], {})
        visible = next(item for item in self.before["exports"] if item["id"] == "exp_visible")
        self.assertEqual(self.item("exports", "exp_visible"), visible)

    def test_hidden_ends_lose_pin_maps_and_contacts(self) -> None:
        harness = self.view["harnesses"][0]
        hidden = next(item for item in harness["ends"] if item["id"] == "end_hidden")
        self.assertEqual(hidden["pinMap"], [])
        self.assertEqual(hidden["contacts"], {})
        before_harness = self.before["harnesses"][0]
        visible = next(item for item in before_harness["ends"] if item["id"] == "end_visible")
        self.assertEqual(next(item for item in harness["ends"] if item["id"] == "end_visible"), visible)

    def test_link_unmapped_is_emptied_only_when_side_a_is_hidden(self) -> None:
        harness = self.view["harnesses"][0]
        links = {item["id"]: item for item in harness["links"]}
        self.assertEqual(links["link_hidden_a"]["unmapped"], [])
        self.assertEqual(links["link_hidden_b"]["unmapped"], ["9"])
        self.assertEqual(links["link_visible"]["unmapped"], ["2"])

    def test_wire_cavities_on_hidden_ends_are_emptied(self) -> None:
        harness = self.view["harnesses"][0]
        wires = {item["id"]: item for item in harness["wires"]}
        self.assertEqual(wires["wire_mixed"]["from"], {"kind": "contact", "end": "end_hidden",
                                                       "cavity": ""})
        self.assertEqual(wires["wire_mixed"]["to"], {"kind": "contact", "end": "end_visible",
                                                     "cavity": "2"})
        visible = next(item for item in self.before["harnesses"][0]["wires"]
                       if item["id"] == "wire_visible")
        self.assertEqual(wires["wire_visible"], visible)

    def test_the_input_document_is_not_mutated(self) -> None:
        self.assertEqual(self.document, self.before)

    def test_no_hidden_occurrences_returns_an_equal_copy(self) -> None:
        view = redaction.redact(self.document, frozenset())
        self.assertEqual(view, self.document)
        self.assertIsNot(view, self.document)


class ProtectedIdsTest(unittest.TestCase):
    def test_everything_that_names_a_hidden_occurrence_is_protected(self) -> None:
        protected = redaction.protected_ids(document(), hidden_only())
        self.assertEqual(protected, frozenset({
            "occ_hidden",
            "layout:occ_hidden",
            "sub_hidden",
            "mate_hidden",
            "exp_hidden",
            "dismissed:occ_hidden|J1|power",
            "end_hidden",
            "link_hidden_a",
            "link_hidden_b",
            "wire_mixed",
            "mark_hidden",
        }))

    def test_visible_objects_and_the_harness_itself_are_not_protected(self) -> None:
        protected = redaction.protected_ids(document(), hidden_only())
        for object_id in ("occ_visible", "occ_body", "sub_visible", "mate_visible", "exp_visible",
                          "end_visible", "link_visible", "wire_visible",
                          "mark_visible", "har_1", "bc_body"):
            with self.subTest(object_id=object_id):
                self.assertNotIn(object_id, protected)

    def test_body_connectors_on_a_hidden_occurrence_are_protected(self) -> None:
        protected = redaction.protected_ids(document(), frozenset({"occ_body"}))
        self.assertIn("bc_body", protected)
        self.assertIn("occ_body", protected)


if __name__ == "__main__":
    unittest.main()
