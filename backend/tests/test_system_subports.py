"""SB2-105 (CONTRACTS_P2 §22, D-P2-55): sub-ports carved out of a connector, and the rows they move."""

from __future__ import annotations

import json
import unittest

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_snapshots import DESIGNER, SnapshotCase

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import interface_cache, service as service_module, subports
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.store import Conflict, Invalid
from app.services.systems.visibility import etag


class SubportCase(SnapshotCase):
    def document(self) -> dict:
        return self.service.document(DESIGNER, self.sid, include_validation=True).body

    def link(self, name: str) -> dict:
        return next(link for link in self.document()["links"] if link["id"] == self.links[name])

    def j7(self) -> dict:
        """OBC-A J7: L-J7J4 has 18 rows on it, pads 1–18."""
        return self.link("L-J7J4")["a"]

    def carve(self, name: str, pads: list[str], *, preview: bool = False, port: dict | None = None) -> dict:
        end = port or self.j7()
        return self.service.create_subport(DESIGNER, self.sid, self.version(), end["instanceId"],
                                           port_key=end["port"]["portKey"], name=name, pads=pads,
                                           preview=preview).body


class CarveTest(SubportCase):
    def test_a_preview_lists_the_moves_and_writes_nothing(self) -> None:
        before = self.version()
        body = self.carve("PWR", ["1", "2", "3"], preview=True)
        self.assertEqual(self.version(), before)
        self.assertEqual(body["subport"]["label"], "J7.PWR")
        [move] = body["moves"]
        self.assertEqual((move["linkId"], move["action"], move["newLinkName"]), (self.links["L-J7J4"], "split", "L-J7J4 · PWR"))
        self.assertEqual(len(move["rowIds"]), 3)
        self.assertEqual(self.store.list_subports(self.sid), [])

    def test_carving_moves_the_rows_on_its_pads_to_a_new_link(self) -> None:
        rows = {r["pinA"]: r["id"] for r in self.link("L-J7J4")["rows"]}
        body = self.carve("PWR", ["3", "1", "2"])
        self.assertEqual(body["subport"]["pads"], ["1", "2", "3"])
        [move] = body["moves"]
        document = self.document()
        old = next(link for link in document["links"] if link["id"] == self.links["L-J7J4"])
        new = next(link for link in document["links"] if link["id"] == move["newLinkId"])
        self.assertEqual(sorted(r["pinA"] for r in new["rows"]), ["1", "2", "3"])
        self.assertEqual({r["id"] for r in new["rows"]}, {rows["1"], rows["2"], rows["3"]}, "rows keep their IDs")
        self.assertEqual(len(old["rows"]), 15)
        self.assertEqual(new["a"]["subport"], {"id": body["subport"]["id"], "name": "PWR"})
        self.assertIsNone(old["a"]["subport"])
        self.assertEqual(new["b"]["port"]["reference"], old["b"]["port"]["reference"])
        [obc] = [i for i in document["instances"] if i["id"] == self.instances["OBC-A"]]
        self.assertEqual([(s["name"], s["pads"]) for s in obc["subports"]], [("PWR", ["1", "2", "3"])])
        [event] = self.events("subport_created")
        self.assertEqual(event["payload"]["moves"][0]["rowIds"], move["rowIds"])
        self.assertFalse([f for f in document["validation"]["findings"] if f["rule"] == "SYS-V02"])

    def test_a_link_whose_rows_all_move_is_retargeted(self) -> None:
        pins = [r["pinA"] for r in self.link("L-J7J4")["rows"]]
        if len(pins) >= self.j7()["port"]["pinCount"]:
            self.skipTest("the fixture link uses every pad of J7")
        body = self.carve("SIG", pins)
        [move] = body["moves"]
        self.assertEqual((move["action"], move["toSubportId"]), ("retarget", body["subport"]["id"]))
        self.assertEqual(self.link("L-J7J4")["a"]["subport"]["name"], "SIG")

    def test_rows_stay_on_their_own_end(self) -> None:
        self.carve("PWR", ["1", "2", "3"])
        link = self.link("L-J7J4")
        rows = [{"pinA": r["pinA"], "pinB": r["pinB"], "signal": r["signal"]} for r in link["rows"]]
        with self.assertRaisesRegex(Invalid, "pin_not_on_subport"):
            self.service.replace_rows(DESIGNER, self.sid, self.version(), link["id"],
                                      rows + [{"pinA": "1", "pinB": "1", "signal": "x"}])

    def test_bad_definitions_are_refused(self) -> None:
        count = self.j7()["port"]["pinCount"]
        for name, pads, code in (("P W R", ["1"], "invalid_name"), ("PWR", ["99"], "pin_not_found"),
                                 ("PWR", [], "subport_empty"),
                                 ("ALL", [str(n) for n in range(1, count + 1)], "subport_overlap")):
            with self.subTest(code=code), self.assertRaisesRegex(Invalid, code):
                self.carve(name, pads)
        self.carve("PWR", ["1", "2"])
        with self.assertRaisesRegex(Invalid, "subport_overlap"):
            self.carve("GND", ["2", "3"])
        with self.assertRaisesRegex(Invalid, "subport_name_taken"):
            self.carve("pwr", ["4"])

    def test_a_board_to_board_connector_is_never_split(self) -> None:
        link = self.link("L-J2J1")
        self.service.update_link(DESIGNER, self.sid, self.version(), link["id"], {"type": "b2b"})
        with self.assertRaisesRegex(Conflict, "port_b2b_mated"):
            self.carve("PWR", ["1"], port=link["a"])
        self.service.update_link(DESIGNER, self.sid, self.version(), link["id"], {"type": "unspecified"})
        self.carve("PWR", ["1"], port=link["a"])
        with self.assertRaisesRegex(Conflict, "port_split"):
            self.service.update_link(DESIGNER, self.sid, self.version(), link["id"], {"type": "b2b"})

    def test_a_split_connector_cannot_be_hidden(self) -> None:
        end = self.j7()
        self.carve("PWR", ["1", "2", "3"])
        self.service.delete_link(DESIGNER, self.sid, self.version(), self.links["L-J7J4"])
        moved = [l for l in self.document()["links"] if l["a"]["instanceId"] == end["instanceId"]
                 and l["a"]["port"]["portKey"] == end["port"]["portKey"]]
        for link in moved:
            self.service.delete_link(DESIGNER, self.sid, self.version(), link["id"])
        with self.assertRaises(Conflict):
            self.service.set_override(DESIGNER, self.sid, self.version(), end["instanceId"], end["port"]["portKey"], "hidden")

    def test_a_link_can_end_at_a_sub_port(self) -> None:
        body = self.carve("PWR", ["19", "20"]) if self.j7()["port"]["pinCount"] >= 20 else self.skipTest("J7 too small")
        pay = self.link("L-J7J4")["b"]
        link = self.service.create_link(
            DESIGNER, self.sid, self.version(), a={**self.j7(), "portKey": self.j7()["port"]["portKey"],
                                                  "subportId": body["subport"]["id"]},
            b={"instanceId": pay["instanceId"], "portKey": pay["port"]["portKey"]}, name="Aux", harness=None).body
        self.assertEqual(link["a"]["subport"]["name"], "PWR")
        with self.assertRaisesRegex(Invalid, "pin_not_on_subport"):
            self.service.replace_rows(DESIGNER, self.sid, self.version(), link["id"],
                                      [{"pinA": "1", "pinB": "19", "signal": "x"}])


class EditTest(SubportCase):
    def test_removing_a_sub_port_returns_its_rows_to_the_remainder(self) -> None:
        body = self.carve("PWR", ["1", "2", "3"])
        new_link = body["moves"][0]["newLinkId"]
        result = self.service.delete_subport(DESIGNER, self.sid, self.version(), self.j7()["instanceId"],
                                             body["subport"]["id"]).body
        [move] = result["moves"]
        self.assertEqual((move["linkId"], move["action"], move["toSubportId"]), (new_link, "retarget", None))
        self.assertIsNone(next(l for l in self.document()["links"] if l["id"] == new_link)["a"]["subport"])
        self.assertEqual(self.store.list_subports(self.sid), [])

    def test_growing_a_sub_port_moves_more_rows(self) -> None:
        body = self.carve("PWR", ["1", "2"])
        result = self.service.update_subport(DESIGNER, self.sid, self.version(), self.j7()["instanceId"],
                                             body["subport"]["id"], pads=["1", "2", "3", "4"]).body
        self.assertEqual(result["subport"]["pads"], ["1", "2", "3", "4"])
        [move] = result["moves"]
        self.assertEqual((move["action"], move["toSubportId"], len(move["rowIds"])), ("split", body["subport"]["id"], 2))
        target = next(l for l in self.document()["links"] if l["id"] == move["newLinkId"])
        self.assertEqual(target["a"]["subport"]["name"], "PWR")

    def test_a_sub_port_follows_its_connector(self) -> None:
        body = self.carve("PWR", ["1", "2", "3"])
        end = self.j7()
        moved = {**end["port"], "reference": "J17"}
        with self.store.mutation(self.sid, expected_version=None, actor="system:detection") as change:
            self.store.set_link_port(change, self.links["L-J7J4"], "a", moved)
        self.conn.commit()
        [stored] = self.store.list_subports(self.sid)
        self.assertEqual((stored["id"], stored["port"]["reference"]), (body["subport"]["id"], "J17"))


class FindingTest(SubportCase):
    def test_a_sub_port_pad_that_disappears_is_reported(self) -> None:
        self.carve("PWR", ["1", "2", "3"])
        end = self.j7()
        instance = self.store.get_instance(self.sid, end["instanceId"])
        artifact = self.store.get_interface(instance["project_id"], instance["baseline_commit"], EXTRACTOR_VERSION)
        components = [{**c, "pins": [p for p in c["pins"] if p["pad"] != "2"]}
                      if c["portKey"] == end["port"]["portKey"] else c for c in artifact["components"]]
        interface_cache.interfaces.clear()  # a direct artifact write bypasses the SB2-93 cache
        self.conn.execute("UPDATE system_interface_artifacts SET payload = %s WHERE project_id = %s AND commit = %s",
                          (json.dumps({**artifact, "components": components}), instance["project_id"],
                           instance["baseline_commit"]))
        self.conn.commit()
        found = [f for f in self.document()["validation"]["findings"] if f["rule"] == "SYS-V21"]
        self.assertEqual([(f["instanceId"], f["reference"], f["detail"]["pads"]) for f in found],
                         [(end["instanceId"], "J7.PWR", ["2"])])


class PlanTest(unittest.TestCase):
    def test_an_emptied_end_keeps_the_end_with_most_rows(self) -> None:
        port = {"portKey": "k", "memberKeys": ["k"]}
        link = {"id": "slk_1", "name": "", "a_instance_id": "i", "a_port": port, "a_subport_id": "gone",
                "b_instance_id": "j", "b_port": {"portKey": "x", "memberKeys": ["x"]}, "rows": [
                    {"id": "r1", "pin_a": "1"}, {"id": "r2", "pin_a": "2"}, {"id": "r3", "pin_a": "3"}]}
        after = [{"id": "s1", "name": "A", "pads": ["1"]}]
        moves = subports.plan_moves([link], "i", port, after)
        self.assertEqual([(m["action"], m["toSubportId"], m["rowIds"]) for m in moves],
                         [("retarget", None, ["r2", "r3"]), ("split", "s1", ["r1"])])
        self.assertEqual(moves[1]["newLinkName"], "A")


class SubportApiTest(SubportCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch.object(service_module, "service", self.service)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.app = FastAPI()
        install_error_handlers(self.app)
        self.app.include_router(systems_api.router, prefix="/api/systems")

    def test_preview_needs_no_etag_and_a_change_does(self) -> None:
        end = self.j7()
        path = f"/api/systems/{self.sid}/instances/{end['instanceId']}/subports"
        body = {"portKey": end["port"]["portKey"], "name": "PWR", "pads": ["1", "2"]}
        preview = _request(self.app, "POST", path + "?preview=true", body=body)
        self.assertEqual((preview.status, len(preview.json["moves"])), (200, 1))
        self.assertEqual(_request(self.app, "POST", path, body=body).status, 428)
        self.assertEqual(_request(self.app, "POST", path, body=body, user="viewer",
                                  headers={"If-Match": etag(self.sid, self.version())}).status, 403)
        created = _request(self.app, "POST", path, body=body, headers={"If-Match": etag(self.sid, self.version())})
        self.assertEqual(created.status, 201)
        spid = created.json["subport"]["id"]
        renamed = _request(self.app, "PATCH", f"{path}/{spid}", body={"name": "POWER"},
                           headers={"If-Match": created.headers["etag"]})
        self.assertEqual((renamed.status, renamed.json["subport"]["label"]), (200, "J7.POWER"))
        gone = _request(self.app, "DELETE", f"{path}/{spid}", headers={"If-Match": renamed.headers["etag"]})
        self.assertEqual(gone.status, 200)


if __name__ == "__main__":
    unittest.main()
