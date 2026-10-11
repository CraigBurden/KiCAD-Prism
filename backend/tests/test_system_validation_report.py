"""AC-16: the whole validation report from small in-memory states, one test per rule (no database).

``validation.report`` takes a loaded system (here a plain object with the same attributes) plus the
catalog's mate pairs and the scene key, and returns every finding with waivers applied, in the
stage order ``validation.STAGES`` declares.
"""

from __future__ import annotations

import copy
import unittest
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from app.services.systems import validation
from app.services.systems.mating import geometry_digest
from app.services.systems.validation import MateCatalog


def component(key: str, reference: str, pads: dict, *, pcb: Optional[dict] = None, power: Optional[dict] = None,
              mpn: Optional[str] = None, geometry: Optional[dict] = None) -> dict:
    return {"portKey": key, "memberKeys": [key], "reference": reference, "libId": "L:X", "footprint": "F:X",
            "candidate": True, "dnp": False, "mpn": mpn, "geometry": geometry,
            "pins": [{"pad": pad, "nets": nets, "pcbNets": (pcb or {}).get(pad, nets),
                      "powerNet": bool((power or {}).get(pad))} for pad, nets in pads.items()]}


def port(key: str, reference: str) -> dict:
    return {"portKey": key, "memberKeys": [key], "reference": reference, "libId": "L:X", "footprint": "F:X",
            "pinCount": 2}


def link(lid: str, rows: list[tuple], *, kind: Optional[str] = None,
         a: tuple = ("i1", "/k1", "J1"), b: tuple = ("i2", "/k2", "J2")) -> dict:
    """``rows`` are ``(pin_a, pin_b)`` or ``(pin_a, pin_b, net_a, net_b)``."""
    out = []
    for n, row in enumerate(rows):
        pin_a, pin_b, *nets = row
        net_a, net_b = nets or (["A"], ["A"])
        out.append({"id": f"{lid}-{n}", "pin_a": pin_a, "pin_b": pin_b, "net_a": net_a, "net_b": net_b})
    return {"id": lid, "harness": None, "type": kind, "a_instance_id": a[0], "a_port": port(a[1], a[2]),
            "b_instance_id": b[0], "b_port": port(b[1], b[2]), "rows": out}


@dataclass
class Facts:
    """A loaded system reduced to what ``validation.report`` reads."""

    boards: list = field(default_factory=lambda: [{"id": "i1", "resolution": "resolved"},
                                                  {"id": "i2", "resolution": "resolved"}])
    links: list = field(default_factory=list)
    exports: list = field(default_factory=list)
    harnesses: list = field(default_factory=list)
    subports: list = field(default_factory=list)
    open_reviews: list = field(default_factory=list)
    open_renames: list = field(default_factory=list)
    waivers: list = field(default_factory=list)
    interfaces: dict = field(default_factory=lambda: {
        "i1": {"hasPcb": True, "components": [component("/k1", "J1", {"1": ["A"], "2": ["B"]})]},
        "i2": {"hasPcb": True, "components": [component("/k2", "J2", {"1": ["A"], "2": ["B"]})]},
    })
    overrides: dict = field(default_factory=dict)
    mating: dict = field(default_factory=dict)
    unavailable: dict = field(default_factory=dict)
    optional_rules: tuple = ()
    child_states: list = field(default_factory=list)
    end_components: dict = field(default_factory=dict)
    mate_mismatches: Optional[list] = None
    harness_checks: dict = field(default_factory=dict)
    collision_check: Optional[dict] = None


def run(facts: Facts, *, mates: Optional[MateCatalog] = None, scene_key: str = "scene-1") -> dict:
    return validation.report(facts, mates=mates, scene_key=scene_key)


def rules(report: dict) -> list[str]:
    return [f["rule"] for f in report["findings"]]


def harness(hid: str = "wh1", *, part_pins: Optional[list] = None, pin_map: Optional[dict] = None,
            wires: tuple = (("1", "1", ["A"], ["A"]),), cut: Optional[float] = None, part: Optional[str] = None) -> dict:
    ends = [{"id": "e1", "mates_instance_id": "i1", "mates_port": port("/k1", "J1"), "catalog_component_id": part,
             "pin_map": pin_map, "part_pins": part_pins},
            {"id": "e2", "mates_instance_id": "i2", "mates_port": port("/k2", "J2"), "catalog_component_id": None,
             "pin_map": None, "part_pins": None}]
    return {"id": hid, "cut_length_mm": cut, "ends": ends,
            "wires": [{"id": f"w{n}", "from_end": "e1", "from_pin": fp, "to_end": "e2", "to_pin": tp,
                       "net_from": nf, "net_to": nt} for n, (fp, tp, nf, nt) in enumerate(wires)]}


def with_end_components(facts: Facts) -> Facts:
    """``LoadedSystem.end_components`` for the facts' harnesses."""
    from app.services.systems import harnesses as harnesses_module

    facts.end_components = {h["id"]: harnesses_module.end_components(h, facts.interfaces) for h in facts.harnesses}
    return facts


class RuleTest(unittest.TestCase):
    def test_a_clean_system_has_every_report_part(self) -> None:
        report = run(Facts(links=[link("L1", [("1", "1"), ("2", "2", ["B"], ["B"])])]))
        self.assertEqual(list(report), ["findings", "notEvaluated", "exempt", "counts", "collisionCheck", "waivers"])
        self.assertEqual(report["findings"], [])
        self.assertEqual(report["counts"], {"error": 0, "warning": 0, "info": 0, "notEvaluated": 0, "waived": 0})
        self.assertEqual(report["collisionCheck"], {"state": "not_checked", "checkedAt": None, "notEvaluated": []})

    def test_v01_duplicate_rows(self) -> None:
        self.assertEqual(rules(run(Facts(links=[link("L1", [("1", "1"), ("1", "1")])]))), ["SYS-V01"])

    def test_v02_fanout(self) -> None:
        report = run(Facts(links=[link("L1", [("1", "1")]), link("L2", [("1", "2", ["A"], ["B"])])]))
        self.assertEqual([f["rule"] for f in report["findings"] if f["rule"] == "SYS-V02"], ["SYS-V02"] * 2)

    def test_v03_hidden_port(self) -> None:
        report = run(Facts(links=[link("L1", [("1", "1")])], overrides={"i1": {"/k1": "hidden"}}))
        self.assertEqual(rules(report), ["SYS-V03"])

    def test_v04_absent_pad(self) -> None:
        self.assertEqual(rules(run(Facts(links=[link("L1", [("3", "1")])]))), ["SYS-V04"])

    def test_v05_unavailable_source(self) -> None:
        facts = Facts(unavailable={"i2": "extraction_failed"})
        del facts.interfaces["i2"]
        report = run(facts)
        self.assertEqual([(f["rule"], f["instanceId"]) for f in report["findings"]], [("SYS-V05", "i2")])
        self.assertEqual({n["rule"] for n in report["notEvaluated"]}, {"SYS-V03", "SYS-V04", "SYS-V06", "SYS-V07"})

    def test_v06_pcb_out_of_sync_and_v07_ambiguous(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1"), ("2", "2", ["B"], ["B"])])])
        facts.interfaces["i1"]["components"] = [component("/k1", "J1", {"1": ["A", "Z"], "2": ["B"]},
                                                          pcb={"1": ["A", "Z"], "2": ["OLD"]})]
        self.assertEqual(rules(run(facts)), ["SYS-V06", "SYS-V07"])

    def test_v08_open_review(self) -> None:
        report = run(Facts(open_reviews=[{"id": "r1", "instance_id": "i1", "kind": "source_update"}]))
        self.assertEqual(rules(report), ["SYS-V08"])

    def test_v09_names_share_nothing(self) -> None:
        self.assertEqual(rules(run(Facts(links=[link("L1", [("1", "1", ["TX"], ["SCL"])])]))), ["SYS-V09"])

    def test_v10_power_meets_signal(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1", ["+3V3"], ["SDA"])])])
        facts.interfaces["i1"]["components"] = [component("/k1", "J1", {"1": ["+3V3"]}, power={"1": True})]
        self.assertIn("SYS-V10", rules(run(facts)))

    def test_v11_mate_mismatch(self) -> None:
        mismatch = {"linkId": "L1", "offsetMm": 1.0, "lateralMm": 1.0, "axialMm": 0.0, "angleDeg": 0.0}
        self.assertEqual(rules(run(Facts(mate_mismatches=[mismatch]))), ["SYS-V11"])
        self.assertEqual(rules(run(Facts(mate_mismatches=None))), [])

    def test_v12_v13_v20_from_the_routed_harness(self) -> None:
        checks = {"wh1": {
            "lengths": {"complete": True, "estimatedMm": 100.0},
            "collisions": [{"segmentId": "s1", "board": "/i2", "distanceMm": 0.5, "radiusMm": 2.0, "atMm": [0, 0, 0]}],
            "tightBends": [{"segmentId": "s1", "radiusMm": 3.0, "minRadiusMm": 12.0, "atMm": [1, 2, 3]}]}}
        facts = Facts(harnesses=[harness(cut=200.0, wires=())], harness_checks=checks)
        self.assertEqual(sorted(rules(run(with_end_components(facts)))), ["SYS-V12", "SYS-V13", "SYS-V20"])

    def test_v14_v15_children(self) -> None:
        children = [{"instanceId": "a1", "releaseStatus": "draft", "openReviewCount": 0, "blocked": True}]
        self.assertEqual(rules(run(Facts(child_states=children))), ["SYS-V14", "SYS-V15"])

    def test_v16_export_unresolved(self) -> None:
        export = {"id": "x1", "name": "PWR", "target_instance_id": "i1", "target_port": port("/gone", "J9"),
                  "target_export_id": None}
        self.assertEqual(rules(run(Facts(exports=[export]))), ["SYS-V16"])

    def test_v17_stale_mating(self) -> None:
        facts = Facts()
        facts.interfaces["i1"]["components"][0]["geometry"] = {"x": 2}
        record = {"mode": "confirmed", "geometryDigest": geometry_digest({"geometry": {"x": 1}})}
        facts.mating = {"i1": {"/k1": record}, "i2": {}}
        self.assertEqual(rules(run(facts)), ["SYS-V17"])
        facts.mating["i1"]["/k1"] = {**record, "geometryDigest": geometry_digest({"geometry": {"x": 2}})}
        self.assertEqual(rules(run(facts)), [])

    def test_v18_from_the_catalog_input(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1")], kind="b2b")])
        facts.interfaces["i1"]["components"][0]["mpn"] = "P-1"
        facts.interfaces["i2"]["components"][0]["mpn"] = "P-2"
        parts = {"p-1": {"componentId": "c1"}, "p-2": {"componentId": "c2"}}
        self.assertEqual(validation.mate_mpns(facts.links, [], facts.interfaces), ["P-1", "P-2"])
        self.assertEqual(validation.mate_parts(facts.links, [], facts.interfaces, parts), ["c1", "c2"])
        self.assertEqual(rules(run(facts, mates=MateCatalog(parts, set()))), ["SYS-V18"])
        self.assertEqual(rules(run(facts, mates=MateCatalog(parts, {("c1", "c2")}))), [])
        self.assertEqual(rules(run(facts, mates=None)), [], "no catalog answer: not evaluated")

    def test_v19_part_pins_differ_and_a_wire_is_unmapped(self) -> None:
        facts = Facts(harnesses=[harness(part_pins=["1", "2", "3"], part="c9")])
        self.assertEqual(rules(run(with_end_components(facts))), ["SYS-V19"])

    def test_v21_subport_pad_absent(self) -> None:
        subport = {"id": "sp1", "instance_id": "i1", "port_key": "/k1", "name": "CAN", "pads": ["1", "7"]}
        report = run(Facts(subports=[subport]))
        self.assertEqual([(f["rule"], f["detail"]["pads"]) for f in report["findings"]], [("SYS-V21", ["7"])])

    def test_v22_only_while_the_check_matches_the_scene(self) -> None:
        at = datetime(2026, 10, 11, tzinfo=timezone.utc)
        side = {"occurrence": "/i1", "label": "OBC", "reference": "U1"}
        check = {"scene_key": "scene-1", "checked_at": at, "result": {
            "collisions": [{"a": side, "b": {**side, "occurrence": "/i2", "label": "PWR"}, "atMm": [0, 0, 0]}],
            "notEvaluated": [{"occurrence": "/m1", "label": "M", "reason": "no_model"}]}}
        report = run(Facts(collision_check=check))
        self.assertEqual(rules(report), ["SYS-V22"])
        self.assertEqual(report["collisionCheck"]["state"], "current")
        self.assertEqual(report["collisionCheck"]["checkedAt"], at.isoformat())
        stale = run(Facts(collision_check=check), scene_key="scene-2")
        self.assertEqual((rules(stale), stale["collisionCheck"]["state"]), ([], "stale"))

    def test_v23_named_net_meets_no_net(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1", ["SDA"], [])])])
        facts.interfaces["i2"]["components"] = [component("/k2", "J2", {"1": []})]
        self.assertIn("SYS-V23", rules(run(facts)))

    def test_every_rule_has_a_test_here(self) -> None:
        names = {name for name in dir(self) if name.startswith("test_v")}
        covered = {f"SYS-V{part[1:]}" for name in names for part in name.split("_")
                   if part.startswith("v") and part[1:].isdigit()}
        self.assertEqual(covered, set(validation.RULES))


class OrderTest(unittest.TestCase):
    def test_stages_run_in_the_declared_order(self) -> None:
        self.assertEqual([name for name, _stage in validation.STAGES], [
            "structural", "children", "mating_stale", "mate_mismatch", "harness_routes", "harness_rules",
            "mate_pairs", "subports", "renames", "collisions", "waivers"])

    def test_waivers_come_last_and_cover_findings_of_every_stage(self) -> None:
        at = datetime(2026, 10, 11, tzinfo=timezone.utc)
        side = {"occurrence": "/i1", "label": "OBC", "reference": "U1"}
        check = {"scene_key": "scene-1", "checked_at": at, "result": {
            "collisions": [{"a": side, "b": {**side, "occurrence": "/i2"}, "atMm": [0, 0, 0]}]}}
        facts = Facts(collision_check=check)
        [found] = run(facts)["findings"]
        facts.waivers = [{"id": "w1", "finding_key": found["key"], "rule": "SYS-V22", "note": "by design",
                          "created_by": "user:a", "created_at": at}]
        report = run(facts)
        self.assertEqual((report["findings"][0]["waived"]["note"], report["counts"]["warning"], report["counts"]["waived"]),
                         ("by design", 0, 1))
        self.assertTrue(report["waivers"][0]["active"])

    def test_renames_annotate_the_name_findings_before_them(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1", ["TX"], ["SCL"])])],
                      open_renames=[{"id": "rn1", "instance_id": "i1", "net": "TX", "name": "SCL"}])
        [found] = run(facts)["findings"]
        self.assertEqual(found["detail"]["rename"], {"id": "rn1", "instanceId": "i1", "name": "SCL"})

    def test_the_report_is_the_stages_folded(self) -> None:
        facts = Facts(links=[link("L1", [("1", "1"), ("1", "1"), ("3", "2", ["TX"], ["SCL"])])],
                      open_reviews=[{"id": "r1", "instance_id": "i2", "kind": "source_update"}],
                      child_states=[{"instanceId": "a1", "releaseStatus": "draft", "openReviewCount": 0, "blocked": False}])
        folded: dict[str, Any] = {}
        for _name, stage in validation.STAGES:
            folded = stage(copy.deepcopy(folded), facts, None, "scene-1")
        self.assertEqual(run(facts), folded)
        self.assertEqual([f["severity"] for f in folded["findings"]],
                         sorted((f["severity"] for f in folded["findings"]), key=["error", "warning", "info"].index))


if __name__ == "__main__":
    unittest.main()
