"""Promoting a sub-port to the board through ``/ops`` (CONTRACTS.md §10.5)."""

from __future__ import annotations

import unittest

from app.system_builder.board_sub_ports import BoardSubPortStore
from support.postgres import requires_scratch_postgres
import test_system_api as base
from test_system_api import DESIGNER_HIDDEN, PROJECT, VIEWER_HIDDEN, _edit_ops, _occurrence

PROMOTE = {"kind": "promote-sub-port", "subPort": "sub_can", "boardSubPort": "bsp_can"}


@requires_scratch_postgres("System Builder promotion tests")
class PromoteApiTest(unittest.TestCase):
    setUp = base.SystemApiTest.setUp
    call = base.SystemApiTest.call
    create = base.SystemApiTest.create

    def ops(self, system_id: str, version: int, request: list[dict], **kwargs):
        return self.call(
            "POST", f"/api/systems/{system_id}/ops", body={"schema": "prism.system.ops.a0", "ops": request},
            headers={"If-Match": f'"system:{system_id}:{version}"'}, **kwargs,
        )

    def board_sub_ports(self) -> BoardSubPortStore:
        return BoardSubPortStore(self.store._connect)

    def test_promotion_creates_the_board_record_with_the_request(self) -> None:
        system_id = self.create()["systemId"]
        self.assertEqual(self.ops(system_id, 1, _edit_ops()).status, 200)
        promoted = self.ops(system_id, 2, [PROMOTE])
        self.assertEqual(promoted.status, 200, promoted.text)
        link = promoted.json["document"]["harnesses"][0]["links"][0]
        self.assertEqual(link["a"]["subPort"], {"kind": "board", "id": "bsp_can", "version": 1})
        self.assertEqual(promoted.json["document"]["subPorts"][0]["promotedTo"], "bsp_can")
        record = self.board_sub_ports().read(PROJECT, "bsp_can")
        self.assertEqual((record["connector"], record["name"], record["pins"], record["version"]),
                         ("J2", "CAN", ["3", "4"], 1))

        undone = self.call("POST", f"/api/systems/{system_id}/undo", body={"version": 3},
                           headers={"If-Match": promoted.headers["etag"]})
        self.assertEqual(undone.status, 200, undone.text)
        restored = undone.json["document"]["harnesses"][0]["links"][0]["a"]["subPort"]
        self.assertEqual(restored, {"kind": "occurrence", "id": "sub_can"})
        self.assertIsNotNone(self.board_sub_ports().read(PROJECT, "bsp_can"), "other systems may use it")

    def test_a_taken_name_refuses_the_whole_request(self) -> None:
        first = self.create("First")["systemId"]
        self.ops(first, 1, _edit_ops())
        self.assertEqual(self.ops(first, 2, [PROMOTE]).status, 200)
        second = self.create("Second")["systemId"]
        self.ops(second, 1, _edit_ops())
        refused = self.ops(second, 2, [{**PROMOTE, "boardSubPort": "bsp_other"}])
        self.assertEqual((refused.status, refused.json["code"]), (409, "board_sub_port_name_taken"), refused.text)
        current = self.call("GET", f"/api/systems/{second}")
        self.assertEqual(current.json["version"], 2)
        self.assertIsNone(self.board_sub_ports().read(PROJECT, "bsp_other"))

    def test_a_used_id_is_refused(self) -> None:
        first = self.create("First")["systemId"]
        self.ops(first, 1, _edit_ops())
        self.assertEqual(self.ops(first, 2, [PROMOTE]).status, 200)
        second = self.create("Second")["systemId"]
        self.ops(second, 1, [
            *_edit_ops()[:1],
            {"kind": "add-sub-port", "subPort": {"id": "sub_can", "occurrence": "occ_obc", "connector": "J3",
                                                 "name": "Other", "pins": ["1"]}},
        ])
        refused = self.ops(second, 2, [PROMOTE])
        self.assertEqual((refused.status, refused.json["code"]), (409, "board_sub_port_exists"), refused.text)

    def test_a_board_the_caller_cannot_see_is_refused(self) -> None:
        system_id = self.create()["systemId"]
        refused = self.ops(system_id, 1, [
            {"kind": "add-occurrence", "occurrence": _occurrence("occ_hidden", "Hidden", DESIGNER_HIDDEN)},
            {"kind": "add-sub-port", "subPort": {"id": "sub_x", "occurrence": "occ_hidden", "connector": "J1",
                                                 "name": "X", "pins": ["1"]}},
            {**PROMOTE, "subPort": "sub_x", "boardSubPort": "bsp_x"},
        ])
        self.assertEqual(refused.status, 403, refused.text)
        self.assertIsNone(self.board_sub_ports().read(DESIGNER_HIDDEN, "bsp_x"))

    def test_a_snapshot_returns_its_copied_definitions_redacted(self) -> None:
        system_id = self.create()["systemId"]
        request = [
            {"kind": "add-occurrence", "occurrence": _occurrence("occ_v", "V", VIEWER_HIDDEN)},
            {"kind": "add-sub-port", "subPort": {"id": "sub_v", "occurrence": "occ_v", "connector": "J1",
                                                 "name": "V", "pins": ["1", "2"]}},
            {"kind": "add-export", "export": {"id": "exp_v", "name": "V",
                                              "site": {"occurrence": "occ_v", "connector": "J1",
                                                       "subPort": {"kind": "occurrence", "id": "sub_v"}},
                                              "pinNames": {}}},
            {**PROMOTE, "subPort": "sub_v", "boardSubPort": "bsp_v"},
        ]
        self.assertEqual(self.ops(system_id, 1, request).status, 200)
        taken = self.call("POST", f"/api/systems/{system_id}/snapshots", body={"name": "S"})
        self.assertEqual(taken.status, 201, taken.text)
        self.assertEqual([item["id"] for item in taken.json["boardSubPorts"]["subPorts"]], ["bsp_v"])
        path = f"/api/systems/{system_id}/snapshots/{taken.json['snapshotId']}"
        viewer = self.call("GET", path, user="viewer")
        self.assertEqual(viewer.status, 200, viewer.text)
        self.assertEqual(viewer.json["boardSubPorts"]["subPorts"], [])


if __name__ == "__main__":
    unittest.main()
