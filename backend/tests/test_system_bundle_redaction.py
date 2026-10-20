"""The system bundle key and bundle redaction, without PostgreSQL
(docs/system-builder/CONTRACTS.md §6, §8.1)."""

from __future__ import annotations

import copy
import hashlib
import json
import unittest

from app.system_builder.members import (
    ABSENT,
    PENDING,
    READY,
    UNSUPPORTED,
    Member,
    document_sha256,
    system_bundle_key,
)
from app.system_builder.redaction import REDACTED_MESSAGE, redact_bundle

DOCUMENT = {
    "schema": "prism.system.v2",
    "name": "Flight stack",
    "occurrences": [
        {
            "id": "occ_a",
            "label": "OBC",
            "source": {"kind": "board", "projectId": "p1", "track": {"kind": "pinned", "commit": "a" * 40}},
        },
        {
            "id": "occ_b",
            "label": "Payload",
            "source": {"kind": "board", "projectId": "p2", "track": {"kind": "pinned", "commit": "b" * 40}},
        },
        {"id": "occ_c", "label": "Entry", "source": {"kind": "entry", "componentId": "c1", "revisionId": "r1"}},
    ],
    "mates": [
        {
            "id": "mate_x", "a": {"occurrence": "occ_a", "connector": "J1"},
            "b": {"occurrence": "occ_b", "connector": "J1"},
            "orientation": {"quarterTurns": 0, "flip": False}, "rows": {},
        },
        {
            "id": "mate_y", "a": {"occurrence": "occ_a", "connector": "J2"},
            "b": {"occurrence": "occ_c", "connector": "J1"},
            "orientation": {"quarterTurns": 0, "flip": False}, "rows": {},
        },
    ],
    "subPorts": [],
    "bodyConnectors": [],
    "exports": [],
    "dismissedSuggestions": [],
    "harnesses": [
        {
            "id": "har_h", "label": "H", "ends": [], "wires": [], "splices": [], "branchPoints": [],
            "segments": [], "coverings": [], "cables": [], "looseEnds": [], "markers": [], "waypoints": [],
            "links": [
                {
                    "id": "link_x",
                    "a": {"occurrence": "occ_a", "connector": "J2"},
                    "b": {"occurrence": "occ_b", "connector": "J1"},
                    "unmapped": [],
                },
                {
                    "id": "link_y",
                    "a": {"occurrence": "occ_a", "connector": "J2"},
                    "b": {"occurrence": "occ_c", "connector": "J1"},
                    "unmapped": [],
                },
            ],
        }
    ],
}

BUNDLE = {
    "schema": "prism.system_bundle.a0",
    "documentSha256": "a" * 64,
    "occurrences": [
        {"occurrence": "occ_a", "state": "ready", "revisionKey": "b" * 64, "bundleKey": "c" * 64, "connectors": []},
        {"occurrence": "occ_b", "state": "ready", "revisionKey": "d" * 64, "bundleKey": "e" * 64, "connectors": []},
        {"occurrence": "occ_c", "state": "pending", "connectors": []},
    ],
    "nets": [
        {
            "id": "net-1111111111111111", "name": "VBAT", "names": ["VBAT"],
            "boardNets": [{"occurrence": "occ_a", "net": "VBAT"}, {"occurrence": "occ_b", "net": "VBAT"}],
            "pins": [
                {"occurrence": "occ_a", "connector": "J1", "pad": "1"},
                {"occurrence": "occ_b", "connector": "J1", "pad": "1"},
            ],
        },
        {
            "id": "net-2222222222222222", "name": "SECRET", "names": ["SECRET"],
            "boardNets": [{"occurrence": "occ_b", "net": "SECRET"}],
            "pins": [{"occurrence": "occ_b", "connector": "J1", "pad": "2"}],
        },
    ],
    "mates": [
        {"mate": "mate_x", "source": "geometry", "pairs": [{"a": "1", "b": "1"}], "unmappedA": [], "unmappedB": ["2"]},
        {"mate": "mate_y", "source": "geometry", "pairs": [{"a": "1", "b": "1"}], "unmappedA": [], "unmappedB": []},
    ],
    "links": [
        {"harness": "har_h", "link": "link_x", "wires": [{"a": "1", "b": "1", "rule": "net-name", "suggested": False}],
         "unmappedA": [], "unmappedB": ["2"]},
        {"harness": "har_h", "link": "link_y", "wires": [{"a": "1", "b": "1", "rule": "explicit", "suggested": False}],
         "unmappedA": [], "unmappedB": []},
    ],
    "splices": [],
    "suggestions": [
        {"occurrence": "occ_a", "connector": "J2", "key": "power", "name": "Power", "source": "power", "pins": ["1", "2"]},
        {"occurrence": "occ_b", "connector": "J1", "key": "power", "name": "Power", "source": "power", "pins": ["1", "2"]},
        {"occurrence": "occ_c", "connector": "J1", "key": "power", "name": "Power", "source": "power", "pins": ["1", "2"]},
    ],
    "findings": [
        {"code": "connector-missing", "severity": "error", "subject": "connector:occ_b/J9",
         "message": "J9 is missing", "objects": ["occ_b"], "waived": False},
        {"code": "mate-pins-unmapped", "severity": "warning", "subject": "mate:mate_x",
         "message": "one pin is unmapped", "objects": ["mate_x"], "waived": False},
        {"code": "occurrence-unsupported", "severity": "info", "subject": "occurrence:occ_c",
         "message": "not read yet", "objects": ["occ_c"], "waived": False},
    ],
}

ALL_MEMBERS = (
    Member("occ_a", READY, "p1", "a" * 40, "1" * 64, "2" * 64),
    Member("occ_b", PENDING, "p2", "b" * 40),
    Member("occ_c", UNSUPPORTED),
)


class SystemBundleKeyTest(unittest.TestCase):
    def _expected(self, members: dict[str, str], absent: list[str], pending: list[str]) -> str:
        preimage = {
            "documentSha256": hashlib.sha256(
                json.dumps(DOCUMENT, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            ).hexdigest(),
            "generator": "f" * 64,
            "members": members,
            "absent": absent,
            "pending": pending,
            "boardSubPorts": {},
            "entries": {},
        }
        return hashlib.sha256(
            json.dumps(preimage, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        ).hexdigest()

    def test_the_document_digest_is_sorted_compact_utf8(self) -> None:
        expected = hashlib.sha256(
            json.dumps(DOCUMENT, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        self.assertEqual(document_sha256(DOCUMENT), expected)

    def test_layout_is_left_out_of_the_document_digest(self) -> None:
        laid_out = {**DOCUMENT, "layout": {"occ_a": {"xNm": 1270000, "yNm": 0, "rotationDeg": 0, "mirror": False}}}
        self.assertEqual(document_sha256(laid_out), document_sha256(DOCUMENT))
        self.assertEqual(
            system_bundle_key(laid_out, "f" * 64, ALL_MEMBERS),
            system_bundle_key(DOCUMENT, "f" * 64, ALL_MEMBERS),
        )
        self.assertNotEqual(document_sha256({**DOCUMENT, "name": "other"}), document_sha256(DOCUMENT))

    def test_the_key_is_the_contract_s_preimage(self) -> None:
        self.assertEqual(
            system_bundle_key(DOCUMENT, "f" * 64, ALL_MEMBERS),
            self._expected({"occ_a": "2" * 64}, [], ["occ_b"]),
        )

    def test_unsupported_occurrences_are_in_neither_list(self) -> None:
        members = (Member("occ_c", UNSUPPORTED),)
        self.assertEqual(
            system_bundle_key(DOCUMENT, "f" * 64, members),
            self._expected({}, [], []),
        )

    def test_absent_and_pending_are_sorted_by_code_point(self) -> None:
        members = (
            Member("occ_z", ABSENT),
            Member("occ_a", ABSENT),
            Member("occ_y", PENDING),
            Member("occ_b", PENDING),
        )
        self.assertEqual(
            system_bundle_key(DOCUMENT, "f" * 64, members),
            self._expected({}, ["occ_a", "occ_z"], ["occ_b", "occ_y"]),
        )


class BundleRedactionTest(unittest.TestCase):
    def test_a_hidden_occurrence_keeps_only_its_id_and_a_redacted_state(self) -> None:
        view = redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        hidden = next(item for item in view["occurrences"] if item["occurrence"] == "occ_b")
        self.assertEqual(hidden, {"occurrence": "occ_b", "state": "redacted", "connectors": []})
        visible = next(item for item in view["occurrences"] if item["occurrence"] == "occ_a")
        self.assertEqual(visible["bundleKey"], "c" * 64)

    def test_nets_lose_hidden_pins_and_a_net_without_visible_pins(self) -> None:
        view = redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        self.assertEqual(len(view["nets"]), 1)
        net = view["nets"][0]
        self.assertEqual([pin["occurrence"] for pin in net["pins"]], ["occ_a"])
        self.assertEqual([board_net["occurrence"] for board_net in net["boardNets"]], ["occ_a"])

    def test_mates_and_links_touching_a_hidden_endpoint_keep_only_their_ids(self) -> None:
        view = redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        hidden_mate = next(mate for mate in view["mates"] if mate["mate"] == "mate_x")
        self.assertEqual((hidden_mate["pairs"], hidden_mate["unmappedA"], hidden_mate["unmappedB"]), ([], [], []))
        visible_mate = next(mate for mate in view["mates"] if mate["mate"] == "mate_y")
        self.assertEqual(len(visible_mate["pairs"]), 1)
        hidden_link = next(link for link in view["links"] if link["link"] == "link_x")
        self.assertEqual((hidden_link["wires"], hidden_link["unmappedA"], hidden_link["unmappedB"]), ([], [], []))
        visible_link = next(link for link in view["links"] if link["link"] == "link_y")
        self.assertEqual(len(visible_link["wires"]), 1)

    def test_suggestions_on_hidden_occurrences_are_dropped(self) -> None:
        view = redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        self.assertEqual([item["occurrence"] for item in view["suggestions"]], ["occ_a", "occ_c"])

    def test_findings_naming_a_hidden_object_keep_their_identity_but_not_their_detail(self) -> None:
        view = redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        redacted = [finding for finding in view["findings"] if finding["objects"] == []]
        self.assertEqual(len(redacted), 2)  # the occurrence itself and the mate it is on
        for finding in redacted:
            self.assertEqual(finding["message"], REDACTED_MESSAGE)
        self.assertEqual(
            {finding["code"] for finding in redacted}, {"connector-missing", "mate-pins-unmapped"}
        )
        untouched = next(finding for finding in view["findings"] if finding["code"] == "occurrence-unsupported")
        self.assertEqual(untouched["objects"], ["occ_c"])

    def test_the_stored_bundle_is_never_changed(self) -> None:
        before = copy.deepcopy(BUNDLE)
        redact_bundle(BUNDLE, frozenset({"occ_b"}), document=DOCUMENT)
        self.assertEqual(BUNDLE, before)


if __name__ == "__main__":
    unittest.main()
