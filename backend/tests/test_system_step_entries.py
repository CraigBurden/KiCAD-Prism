"""§18: a placed entry's contents feed the STEP assembly (boards and parts inside it)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.system_builder import members as member_view
from app.system_builder import step_models


def payload() -> dict:
    return {
        "document": {
            "occurrences": [
                {"id": "c_logic", "label": "Logic", "source": {"kind": "board", "projectId": "prj_9",
                                                               "track": {"kind": "pinned", "commit": "abc123"}}},
                {"id": "c_case", "label": "Case", "source": {"kind": "body", "componentId": "cmp_case",
                                                             "revisionId": "rev_1"}},
            ],
            "bodyConnectors": [{"occurrence": "c_case", "refdes": "J1", "part": {"componentId": "cmp_jack"}}],
        },
        "bundle": {"placement": {"occurrences": [
            {"occurrence": "c_logic", "bounds": {"min": {"xNm": 0, "yNm": 0, "zNm": -800000},
                                                 "max": {"xNm": 1, "yNm": 1, "zNm": 800000}}},
        ]}},
    }


class EntryTargetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "entry.json"
        path.write_text(json.dumps(payload()), encoding="utf-8")
        self.entry = SimpleNamespace(occurrence="occ_unit", state=member_view.READY, is_entry=True,
                                     entry_payload=path)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_an_entry_board_is_a_target_under_its_entry(self) -> None:
        targets = step_models.board_targets([self.entry], {"occ_unit": "Unit"})
        self.assertEqual(len(targets), 1)
        target = targets[0]
        self.assertEqual((target.key, target.project_id, target.commit), ("occ_unit/c_logic", "prj_9", "abc123"))
        self.assertEqual(target.label, "Unit · Logic")
        self.assertEqual(target.thickness_nm, 1_600_000)

    def test_an_entry_parts_are_referenced(self) -> None:
        refs = [ref for ref, _, _ in step_models.entry_references([self.entry])]
        self.assertEqual(refs, ["cmp_case@rev_1", "cmp_jack"])

    def test_a_missing_payload_contributes_nothing(self) -> None:
        gone = SimpleNamespace(occurrence="occ_x", state=member_view.READY, is_entry=True,
                               entry_payload=Path(self.tmp.name) / "nope.json")
        self.assertEqual(step_models.board_targets([gone], {}), [])
        self.assertEqual(step_models.entry_references([gone]), [])


if __name__ == "__main__":
    unittest.main()
