"""The stage 1c operations: promotion and acknowledgement of board-level
sub-ports (CONTRACTS.md §10.5) and the Git import (§13.3)."""

from __future__ import annotations

import copy
import unittest

from app.system_builder import ops
from app.system_builder.document import canonical
from tests.test_system_ops import LIMITS, apply, harness_item, item_in, rich_document

BOARD_REF = {"kind": "board", "id": "bsp_can", "version": 1}


def promoted() -> dict:
    return apply(rich_document(), [{"kind": "promote-sub-port", "subPort": "sub_a", "boardSubPort": "bsp_can"}]).document


class PromoteSubPortTest(unittest.TestCase):
    def test_promotion_marks_the_sub_port_and_repoints_its_endpoints(self) -> None:
        document = promoted()
        self.assertEqual(item_in(document, "subPorts", "sub_a")["promotedTo"], "bsp_can")
        self.assertEqual(harness_item(document, "har_1", "links", "link_1")["a"]["subPort"], BOARD_REF)
        self.assertEqual(item_in(document, "exports", "exp_1")["site"]["subPort"], BOARD_REF)

    def test_undo_restores_the_occurrence_level_references(self) -> None:
        before = rich_document()
        applied = apply(before, [{"kind": "promote-sub-port", "subPort": "sub_a", "boardSubPort": "bsp_can"}])
        self.assertIn("sub_a", applied.touched)
        restored = apply(applied.document, applied.inverse, undo=True).document
        self.assertEqual(restored, before)

    def test_a_promoted_or_missing_sub_port_is_refused(self) -> None:
        with self.assertRaises(ops.OpRefused) as caught:
            apply(promoted(), [{"kind": "promote-sub-port", "subPort": "sub_a", "boardSubPort": "bsp_other"}])
        self.assertIn("already promoted", caught.exception.message)
        with self.assertRaises(ops.OpRefused) as caught:
            apply(rich_document(), [{"kind": "promote-sub-port", "subPort": "sub_none", "boardSubPort": "bsp_x"}])
        self.assertEqual(caught.exception.pointer, "/ops/0/subPort")


class AcknowledgeSubPortTest(unittest.TestCase):
    def test_acknowledgement_sets_the_version_on_every_endpoint(self) -> None:
        document = apply(promoted(), [{"kind": "acknowledge-sub-port", "subPort": "bsp_can", "version": 3}]).document
        self.assertEqual(harness_item(document, "har_1", "links", "link_1")["a"]["subPort"]["version"], 3)
        self.assertEqual(item_in(document, "exports", "exp_1")["site"]["subPort"]["version"], 3)

    def test_a_board_sub_port_no_endpoint_names_is_refused(self) -> None:
        with self.assertRaises(ops.OpRefused) as caught:
            apply(promoted(), [{"kind": "acknowledge-sub-port", "subPort": "bsp_other", "version": 2}])
        self.assertEqual(caught.exception.pointer, "/ops/0/subPort")

    def test_version_zero_fails_the_schema(self) -> None:
        with self.assertRaises(ops.OpRefused):
            apply(promoted(), [{"kind": "acknowledge-sub-port", "subPort": "bsp_can", "version": 0}])


def imported_document() -> dict:
    document = copy.deepcopy(rich_document())
    document["name"] = "From Git"
    document["waivers"] = []
    document["exports"].append({"id": "exp_2", "name": "E2", "site": {"occurrence": "occ_b", "connector": "J1"},
                                "pinNames": {}})
    return canonical(document)


class ImportDocumentTest(unittest.TestCase):
    def test_import_is_refused_outside_the_import_route(self) -> None:
        with self.assertRaises(ops.OpRefused) as caught:
            apply(rich_document(), [{"kind": "import-document", "document": imported_document()}])
        self.assertEqual(caught.exception.pointer, "/ops/0/kind")

    def test_import_replaces_the_document_and_undoes_exactly(self) -> None:
        before = rich_document()
        applied = ops.apply(before, [{"kind": "import-document", "document": imported_document()}],
                            seen_ids=(), limits=LIMITS, importing=True)
        self.assertEqual(applied.document, imported_document())
        self.assertIn("exp_2", applied.seen_ids)
        self.assertEqual({"#info", "exp_2", "wav_1"} - applied.touched, set())
        restored = apply(applied.document, applied.inverse, undo=True).document
        self.assertEqual(restored, before)

    def test_an_import_is_exactly_one_operation(self) -> None:
        request = [{"kind": "import-document", "document": imported_document()},
                   {"kind": "set-system-info", "name": "X"}]
        with self.assertRaises(ops.OpRefused) as caught:
            ops.apply(rich_document(), request, seen_ids=(), limits=LIMITS, importing=True)
        self.assertEqual(caught.exception.pointer, "/ops")

    def test_an_invalid_document_is_refused(self) -> None:
        broken = imported_document()
        broken["exports"][0]["site"]["subPort"]["id"] = "sub_missing"
        with self.assertRaises(ops.OpRefused):
            ops.apply(rich_document(), [{"kind": "import-document", "document": broken}],
                      seen_ids=(), limits=LIMITS, importing=True)


if __name__ == "__main__":
    unittest.main()
