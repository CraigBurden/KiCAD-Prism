"""SYS-08: structural validation (contract §7.2) against the goldens and per rule."""

from __future__ import annotations

import copy
import unittest

from system_builder_db import FixtureSystemCase
from support.postgres import seed_job
from system_builder_fixtures import expected_steps

from app.services.systems.jobs import extract_and_store
from app.services.systems import interface_cache
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Invalid
from app.services.systems.validation import RULES, validate

DESIGNER = Caller(role="designer", email="designer@example.com")


class ValidationGoldenTest(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"})
        for board, project_id in (("mini_obc", "prj_obc"), ("mini_payload", "prj_pay"),
                                  ("mini_power", "prj_pwr")):
            extract_and_store(self.projects[project_id], self.commits[board]["F0"], self.connect)
        self.labels = {v: k for k, v in self.instances.items()}

    def report(self) -> dict:
        return self.service.validation_report(DESIGNER, self.sid).body

    def test_f0_baseline_findings(self) -> None:
        golden = expected_steps()["baselineFindings"]["F0"]
        report = self.report()
        errors = [f for f in report["findings"] if f["severity"] == "error"]
        warnings = [f for f in report["findings"] if f["severity"] == "warning"]
        self.assertEqual((errors, warnings), ([], []))
        self.assertEqual(
            [{"rule": n["rule"], "instance": self.labels[n["instanceId"]], "reason": n["reason"]}
             for n in report["notEvaluated"]],
            golden["notEvaluated"],
        )
        self.assertEqual(
            [{"rule": e["rule"], "instance": self.labels[e["instanceId"]], "reference": e["reference"],
              "pin": e["pin"]} for e in report["exempt"]],
            [{k: v for k, v in e.items() if k != "reason"} for e in golden["exempt"]],
        )
        document = self.service.document(DESIGNER, self.sid).body
        self.assertEqual(document["findingCounts"], report["counts"])

    def test_f8_after_accept_warns_pcb_out_of_sync(self) -> None:
        golden = expected_steps()["steps"]["F8"]["afterAccept"]["warnings"]
        self.service.update_system(DESIGNER, self.sid, self.version(), {"optionalRules": ["SYS-V09"]})
        self.move_track("mini_obc", "F8")
        result = self.detector.check_instance(self.instances["OBC-A"])
        review = next(r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == result.review_id)
        self.assertEqual(self.report()["counts"]["info"], 1)  # SYS-V08 while the review is open
        self.service.decide(DESIGNER, self.sid, self.version(), review["id"], review["items"][0]["id"],
                            "accept", None)
        warnings = [f for f in self.report()["findings"] if f["severity"] == "warning"]

        def shape(f: dict) -> dict:
            base = {"rule": f["rule"], "instance": self.labels.get(f["instanceId"]), "reference": f["reference"],
                    "pin": f["pin"]}
            if f["rule"] == "SYS-V09":  # a row-level join finding (P2 §8.4)
                return {**base, "netA": f["detail"]["netA"], "netB": f["detail"]["netB"]}
            return {**base, "schematic": f["detail"]["schematic"], "pcb": f["detail"]["pcb"]}

        self.assertEqual([shape(f) for f in warnings],
                         [{k: v for k, v in w.items() if k != "note"} for w in golden])

    def test_v09_runs_on_every_system(self) -> None:
        """D-P2-57 (P2 §23.4): SYS-V09 needs no opt-in; ``optionalRules`` is kept but has no effect."""
        self.move_track("mini_obc", "F8")
        result = self.detector.check_instance(self.instances["OBC-A"])
        review = next(r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == result.review_id)
        self.service.decide(DESIGNER, self.sid, self.version(), review["id"], review["items"][0]["id"], "accept", None)
        self.assertIn("SYS-V09", {f["rule"] for f in self.report()["findings"]})
        body = self.service.update_system(DESIGNER, self.sid, self.version(), {"optionalRules": ["SYS-V09"]}).body
        self.assertEqual(body["optionalRules"], ["SYS-V09"])
        self.assertEqual(self.service.document(DESIGNER, self.sid).body["system"]["optionalRules"], ["SYS-V09"])
        with self.assertRaises(Invalid):
            self.service.update_system(DESIGNER, self.sid, self.version(), {"optionalRules": ["SYS-V10"]})
        self.service.update_system(DESIGNER, self.sid, self.version(), {"optionalRules": []})
        self.assertIn("SYS-V09", {f["rule"] for f in self.report()["findings"]})

    def test_pending_interface_is_not_evaluated_never_passed(self) -> None:
        interface_cache.interfaces.clear()  # a direct artifact write bypasses the SB2-93 cache
        self.conn.execute("DELETE FROM system_interface_artifacts WHERE project_id = 'prj_pwr'")
        self.conn.commit()
        not_evaluated = {(n["rule"], self.labels[n["instanceId"]]) for n in self.report()["notEvaluated"]}
        for rule in ("SYS-V03", "SYS-V04", "SYS-V06", "SYS-V07"):
            self.assertIn((rule, "PWR"), not_evaluated)

    def test_failed_extraction_makes_the_source_unavailable(self) -> None:
        from app.services.systems.jobs import EXTRACT_JOB_KIND, artifact_key

        interface_cache.interfaces.clear()  # a direct artifact write bypasses the SB2-93 cache
        self.conn.execute("DELETE FROM system_interface_artifacts WHERE project_id = 'prj_pwr'")
        seed_job(self.conn, "jf", EXTRACT_JOB_KIND, "failed",
                 artifact_key=artifact_key("prj_pwr", self.commits["mini_power"]["F0"]), error_code="source_unavailable")
        self.conn.commit()
        [finding] = [f for f in self.report()["findings"] if f["rule"] == "SYS-V05"]
        self.assertEqual((self.labels[finding["instanceId"]], finding["detail"]),
                         ("PWR", {"reason": "source_unavailable"}))


def _instance(iid: str, resolution: str = "resolved") -> dict:
    return {"id": iid, "resolution": resolution}


def _component(key: str, reference: str, pads: dict, *, candidate: bool = True, pcb: dict | None = None) -> dict:
    return {"portKey": key, "memberKeys": [key], "reference": reference, "libId": "L:X", "footprint": "F:X",
            "candidate": candidate, "dnp": False,
            "pins": [{"pad": pad, "nets": nets, "pcbNets": (pcb or {}).get(pad, nets)} for pad, nets in pads.items()]}


def _port(key: str, reference: str) -> dict:
    return {"portKey": key, "memberKeys": [key], "reference": reference, "libId": "L:X", "footprint": "F:X",
            "pinCount": 2}


def _link(lid: str, rows: list[tuple[str, str]], *, harness: str | None = None,
          a: tuple[str, str, str] = ("i1", "/k1", "J1"), b: tuple[str, str, str] = ("i2", "/k2", "J2")) -> dict:
    return {"id": lid, "harness": harness, "a_instance_id": a[0], "a_port": _port(a[1], a[2]),
            "b_instance_id": b[0], "b_port": _port(b[1], b[2]),
            "rows": [{"id": f"{lid}-{n}", "pin_a": pa, "pin_b": pb} for n, (pa, pb) in enumerate(rows)]}


class ValidationRuleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.instances = [_instance("i1"), _instance("i2")]
        self.interfaces = {
            "i1": {"hasPcb": True, "components": [_component("/k1", "J1", {"1": ["A"], "2": ["B"]})]},
            "i2": {"hasPcb": True, "components": [_component("/k2", "J2", {"1": ["A"], "2": ["B"]})]},
        }

    def run_rules(self, links, *, overrides=None, reviews=(), interfaces=None, instances=None, unavailable=None):
        return validate(instances or self.instances, links, interfaces or self.interfaces, overrides or {},
                        reviews, unavailable=unavailable)

    def rules(self, report) -> list[tuple[str, str | None]]:
        return [(f["rule"], f["pin"]) for f in report["findings"]]

    def test_clean_system(self) -> None:
        report = self.run_rules([_link("L1", [("1", "1"), ("2", "2")])])
        self.assertEqual(report["findings"], [])
        self.assertEqual(report["counts"], {"error": 0, "warning": 0, "info": 0, "notEvaluated": 0})

    def test_duplicate_rows(self) -> None:
        report = self.run_rules([_link("L1", [("1", "1"), ("1", "1")])])
        self.assertEqual([f["rule"] for f in report["findings"]], ["SYS-V01"])

    def test_fanout_warns_unless_one_harness(self) -> None:
        links = [_link("L1", [("1", "1")]), _link("L2", [("1", "2")])]
        report = self.run_rules(links)
        fanout = [f for f in report["findings"] if f["rule"] == "SYS-V02"]
        self.assertEqual({(f["linkId"], f["end"]) for f in fanout}, {("L1", "a"), ("L2", "a")})
        harnessed = [_link("L1", [("1", "1")], harness="WH"), _link("L2", [("1", "2")], harness="WH")]
        report = self.run_rules(harnessed)
        self.assertEqual(report["findings"], [])
        self.assertEqual([(e["rule"], e["pin"], e["harness"]) for e in report["exempt"]], [("SYS-V02", "1", "WH")])
        mixed = [_link("L1", [("1", "1")], harness="WH"), _link("L2", [("1", "2")])]
        self.assertTrue(any(f["rule"] == "SYS-V02" for f in self.run_rules(mixed)["findings"]))

    def test_hidden_or_missing_port_is_not_exposed(self) -> None:
        report = self.run_rules([_link("L1", [("1", "1")])], overrides={"i1": {"/k1": "hidden"}})
        self.assertEqual([(f["rule"], f["end"]) for f in report["findings"]], [("SYS-V03", "a")])
        gone = copy.deepcopy(self.interfaces)
        gone["i2"]["components"] = []
        report = self.run_rules([_link("L1", [("1", "1")])], interfaces=gone)
        self.assertEqual([(f["rule"], f["detail"]["present"]) for f in report["findings"]], [("SYS-V03", False)])

    def test_absent_pin(self) -> None:
        report = self.run_rules([_link("L1", [("3", "1")])])
        self.assertEqual(self.rules(report), [("SYS-V04", "3")])

    def test_unresolved_source(self) -> None:
        report = self.run_rules([], instances=[_instance("i1", "unresolved"), _instance("i2")],
                                unavailable={"i2": "source_unavailable"})
        self.assertEqual([(f["rule"], f["instanceId"]) for f in report["findings"]],
                         [("SYS-V05", "i1"), ("SYS-V05", "i2")])

    def test_pcb_and_ambiguity_warnings(self) -> None:
        interfaces = copy.deepcopy(self.interfaces)
        interfaces["i1"]["components"] = [_component("/k1", "J1", {"1": ["A", "Z"], "2": ["B"]},
                                                     pcb={"1": ["A", "Z"], "2": ["OLD"]})]
        report = self.run_rules([_link("L1", [("1", "1"), ("2", "2")])], interfaces=interfaces)
        self.assertEqual(self.rules(report), [("SYS-V06", "2"), ("SYS-V07", "1")])
        interfaces["i1"]["hasPcb"] = False
        report = self.run_rules([_link("L1", [("1", "1"), ("2", "2")])], interfaces=interfaces)
        self.assertEqual(self.rules(report), [("SYS-V07", "1")])
        self.assertEqual([(n["rule"], n["instanceId"]) for n in report["notEvaluated"]], [("SYS-V06", "i1")])

    def test_open_review_is_info_and_order_is_severity_first(self) -> None:
        report = self.run_rules([_link("L1", [("3", "1")])],
                                reviews=[{"id": "r1", "instance_id": "i1", "kind": "source_update"}])
        self.assertEqual([f["severity"] for f in report["findings"]], ["error", "info"])
        self.assertEqual(set(RULES), {f"SYS-V0{n}" for n in range(1, 10)} | {"SYS-V10", "SYS-V11", "SYS-V12", "SYS-V13", "SYS-V14", "SYS-V15", "SYS-V16", "SYS-V17", "SYS-V18", "SYS-V19", "SYS-V20", "SYS-V21", "SYS-V22", "SYS-V23"})


if __name__ == "__main__":
    unittest.main()


class JoinFindingPlaceTest(unittest.TestCase):
    """SB2-112: a join finding names side A's board, connector and pin (side B's in the detail), so each
    row keeps its own key and a waiver covers one join, not every join of the link."""

    def test_two_rows_of_one_link_have_their_own_keys(self) -> None:
        from app.services.systems import validation

        link = {"id": "slk_1", "a_instance_id": "sin_a", "a_port": {"reference": "J3"}, "b_port": {"reference": "J7"}}
        found = [validation._finding("SYS-V09", link_id="slk_1", row_id=row["id"], **validation._row_place(link, row))
                 for row in ({"id": "r1", "pin_a": "4", "pin_b": "4"}, {"id": "r2", "pin_a": "6", "pin_b": "6"})]
        self.assertEqual((found[0]["instanceId"], found[0]["reference"], found[0]["pin"], found[0]["detail"]),
                         ("sin_a", "J3", "4", {"pinB": "4", "referenceB": "J7"}))
        self.assertNotEqual(validation.finding_key(found[0]), validation.finding_key(found[1]))
