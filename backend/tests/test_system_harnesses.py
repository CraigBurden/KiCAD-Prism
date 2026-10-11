"""SB2-14: harness objects (CONTRACTS_P2 §16.1, §17) on the P1 fixture system.

The acceptance case is the replay: a board net rename (fixture step F1, pin 17
of OBC-A J7) opens a review item on the harness wire, and accepting it moves
the wire's net baseline.
"""

from __future__ import annotations

from system_builder_db import FixtureSystemCase
from support.postgres import seed_folder

from app.services.systems import manifest as manifest_io
from app.services.systems.jobs import extract_and_store
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Conflict, Invalid

DESIGNER = Caller(role="designer", email="designer@example.com")
VIEWER = Caller(role="viewer", email="viewer@example.com")


class HarnessCase(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"})
        for board, project_id in (("mini_obc", "prj_obc"), ("mini_payload", "prj_pay"), ("mini_power", "prj_pwr")):
            extract_and_store(self.projects[project_id], self.commits[board]["F0"], self.connect)
        extract_and_store(self.projects["prj_obc"], self.commits["mini_obc"]["F1"], self.connect)

    def convert(self, link: str = "L-J7J4") -> dict:
        return self.service.link_to_harness(DESIGNER, self.sid, self.version(), self.links[link]).body

    def document(self, caller: Caller = DESIGNER) -> dict:
        return self.service.document(caller, self.sid).body


class ConversionTest(HarnessCase):
    def test_a_link_becomes_a_two_end_harness_and_back(self) -> None:
        link = self.store.get_link(self.sid, self.links["L-J7J4"])
        harness = self.convert()
        self.assertEqual([e["mates"]["port"]["reference"] for e in harness["ends"]], ["J7", "J4"])
        self.assertEqual(len(harness["wires"]), len(link["rows"]))
        self.assertEqual({w["label"] for w in harness["wires"]}, {r["id"] for r in link["rows"]})
        self.assertEqual(sorted((w["from"]["pin"], w["to"]["pin"], tuple(w["netFrom"]), tuple(w["netTo"]))
                                for w in harness["wires"]),
                         sorted((r["pin_a"], r["pin_b"], tuple(r["net_a"]), tuple(r["net_b"])) for r in link["rows"]))
        self.assertTrue(harness["linkable"])
        document = self.document()
        self.assertNotIn(link["id"], [l["id"] for l in document["links"]])
        self.assertEqual([h["id"] for h in document["harnesses"]], [harness["id"]])
        self.assertEqual(self.events("harness_created")[-1]["payload"]["fromLink"], link["id"])
        back = self.service.harness_to_link(DESIGNER, self.sid, self.version(), harness["id"]).body
        self.assertEqual(sorted((r["pinA"], r["pinB"], tuple(r["netA"])) for r in back["rows"]),
                         sorted((r["pin_a"], r["pin_b"], tuple(r["net_a"])) for r in link["rows"]))
        self.assertEqual(self.document()["harnesses"], [])

    def test_the_p1_label_becomes_one_harness_with_a_splice(self) -> None:
        labelled = [l for l in self.store.list_links(self.sid) if l["harness"]]
        label = labelled[0]["harness"]
        group = [l for l in labelled if l["harness"] == label]
        self.assertGreaterEqual(len(group), 2)
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), label).body
        ports = {(l[f"{e}_instance_id"], l[f"{e}_port"]["portKey"]) for l in group for e in "ab"}
        self.assertEqual(len(harness["ends"]), len(ports))
        self.assertEqual(len(harness["wires"]), sum(len(l["rows"]) for l in group))
        self.assertEqual(harness["label"], label)
        self.assertFalse(harness["linkable"])
        self.assertEqual([l for l in self.store.list_links(self.sid) if l["harness"] == label], [])
        with self.assertRaises(Conflict) as refused:
            self.service.harness_to_link(DESIGNER, self.sid, self.version(), harness["id"])
        self.assertTrue(str(refused.exception).startswith("harness_not_linkable"))
        report = self.service.validation_report(DESIGNER, self.sid).body
        self.assertFalse([f for f in report["findings"] if (f["detail"] or {}).get("harnessId") == harness["id"]
                          and f["severity"] == "error"])

    def test_a_port_is_mated_once(self) -> None:
        harness = self.convert()
        end = harness["ends"][0]["mates"]
        with self.assertRaises(Conflict):
            self.service.add_harness_end(DESIGNER, self.sid, self.version(), harness["id"],
                                         {"instanceId": end["instanceId"], "portKey": end["portKey"]})
        other = next(l for l in self.store.list_links(self.sid) if l["id"] != self.links["L-J7J4"])
        with self.assertRaises(Conflict) as refused:
            self.service.create_link(DESIGNER, self.sid, self.version(), a={"instanceId": end["instanceId"], "portKey": end["portKey"]},
                                     b={"instanceId": other["b_instance_id"], "portKey": other["b_port"]["portKey"]},
                                     name="mate", harness=None, link_type="b2b")
        self.assertTrue(str(refused.exception).startswith("port_already_mated"))

    def test_identity_harness_between_two_ports(self) -> None:
        link = self.store.get_link(self.sid, self.links["L-J7J4"])
        self.service.delete_link(DESIGNER, self.sid, self.version(), link["id"])
        harness = self.service.create_harness(DESIGNER, self.sid, self.version(), {
            "name": "WH-001", "identity": True,
            "ends": [{"instanceId": link["a_instance_id"], "portKey": link["a_port"]["portKey"]},
                     {"instanceId": link["b_instance_id"], "portKey": link["b_port"]["portKey"]}]}).body
        self.assertTrue(harness["wires"])
        self.assertTrue(all(w["from"]["pin"] == w["to"]["pin"] for w in harness["wires"]))
        self.assertTrue(all(w["netFrom"] or w["netTo"] for w in harness["wires"]), "unconnected pairs are skipped")
        proposed = self.service.generate_wires(DESIGNER, self.sid, harness["id"], harness["ends"][0]["id"],
                                               harness["ends"][1]["id"], "identity", {})
        self.assertEqual(proposed["wires"], [])
        reasons = {s["reason"] for s in proposed["skipped"]}
        self.assertIn("existing", reasons)  # every wired pair is already there
        self.assertLessEqual(reasons, {"existing", "unconnected"})

    def test_wire_edits_validate_pins_and_flag_duplicates(self) -> None:
        harness = self.convert()
        first = harness["wires"][0]
        a, b = harness["ends"][0]["id"], harness["ends"][1]["id"]
        with self.assertRaises(Invalid):
            self.service.replace_wires(DESIGNER, self.sid, self.version(), harness["id"],
                                       [{"from": {"end": a, "pin": "999"}, "to": {"end": b, "pin": "1"}}])
        duplicate = {"from": first["to"], "to": first["from"], "signal": "again"}
        wires = [{k: w[k] for k in ("id", "from", "to", "signal")} for w in harness["wires"]] + [duplicate]
        self.service.replace_wires(DESIGNER, self.sid, self.version(), harness["id"], wires)
        v01 = [f for f in self.service.validation_report(DESIGNER, self.sid).body["findings"] if f["rule"] == "SYS-V01"]
        # Either wire of the pair may be the one reported (wires carry no order); the pair is what matters.
        [finding] = v01
        self.conn.commit()
        added = next(w["id"] for w in self.store.get_harness(self.sid, harness["id"])["wires"] if w["signal"] == "again")
        self.assertEqual({finding["detail"]["wireId"], finding["detail"]["duplicateOf"]}, {first["id"], added})

    def test_manifest_round_trips_harnesses(self) -> None:
        self.convert()
        before = manifest_io.build(self.store, self.sid, created_by="user:t", created_at="2026-09-30T00:00:00+00:00")
        self.assertEqual(len(before.harnesses), 1)
        self.store.delete_system(self.sid)
        self.conn.commit()
        manifest_io.import_manifest(self.store, before, actor="user:importer")
        self.conn.commit()
        after = manifest_io.build(self.store, self.sid, created_by="user:t", created_at="2026-09-30T00:00:00+00:00")
        self.assertEqual(after.harnesses, before.harnesses)

    def test_an_end_on_a_hidden_board_is_redacted(self) -> None:
        harness = self.convert()
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pay'")
        self.conn.commit()
        [seen] = self.document(VIEWER)["harnesses"]
        pay = next(e for e in seen["ends"] if e["mates"]["redacted"])
        self.assertIsNone(pay["mates"]["port"])
        self.assertTrue(all(w["netTo"] is None and w["redactedEnds"] == ["to"] for w in seen["wires"]))
        with self.assertRaises(Exception):
            self.service.delete_harness(VIEWER.__class__(role="designer", email="x@y"), self.sid, self.version(), harness["id"])


class DriftTest(HarnessCase):
    def test_a_board_net_rename_opens_a_review_item_on_the_wire(self) -> None:
        harness = self.convert()
        obc_end = harness["ends"][0]
        wire17 = next(w for w in harness["wires"] if w["from"]["pin"] == "17")
        self.move_track("mini_obc", "F1")
        result = self.detector.check_instance(self.instances["OBC-A"])
        self.assertEqual(result.outcome, "review_opened")
        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == result.review_id]
        [item] = review["items"]
        self.assertEqual((item["kind"], item["linkId"], item["rowIds"], item["pins"]),
                         ("net_changed", obc_end["id"], [wire17["id"]], ["17"]))
        self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"], "accept", None)
        [after] = self.document()["harnesses"]
        moved = next(w for w in after["wires"] if w["id"] == wire17["id"])
        self.assertEqual(moved["netFrom"], item["observed"])
        self.assertNotEqual(moved["netFrom"], wire17["netFrom"])
        self.assertEqual(self.store.get_instance(self.sid, self.instances["OBC-A"])["baseline_commit"],
                         self.commits["mini_obc"]["F1"])

    def test_remap_edits_the_end_pin_map(self) -> None:
        harness = self.convert()
        obc_end = harness["ends"][0]
        self.move_track("mini_obc", "F1")
        result = self.detector.check_instance(self.instances["OBC-A"])
        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == result.review_id]
        [item] = review["items"]
        self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"], "remap", {"pad": "19"})
        [after] = self.document()["harnesses"]
        self.assertEqual(next(e for e in after["ends"] if e["id"] == obc_end["id"])["pinMap"], {"17": "19"})
