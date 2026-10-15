"""SB2-20: system nets through harness wires and pin maps (CONTRACTS_P2 §8, §17.2).

Golden: ``fixtures/system_builder/p2/goldens/harness_splice_nets.json``, the
fixture's WH-001 cable as one 3-end harness with a splice on PWR J3 pin 3.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from test_system_import import DESIGNER, ImportCase
from test_system_snapshots import VIEWER

from app.services.systems import scene as scene_module, system_nets

GOLDEN = json.loads((Path(__file__).resolve().parent / "fixtures" / "system_builder" / "p2" / "goldens"
                     / "harness_splice_nets.json").read_text())


class HarnessNetsTest(ImportCase):
    def groups(self) -> list[dict]:
        return self.service._net_groups(DESIGNER, self.sid)[0]

    def group_with(self, net: str) -> dict:
        return next(g for g in self.groups() if any(m["net"] == net for m in g["members"]))

    @staticmethod
    def members(group: dict) -> list[list[str]]:
        return sorted([m["displayPath"], m["net"]] for m in group["members"])

    def test_a_three_end_splice_matches_the_golden(self) -> None:
        by_rows = self.members(self.group_with("/PAY_PWR"))
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        self.assertEqual(harness["name"], GOLDEN["harness"])
        group = self.group_with("/PAY_PWR")
        golden = GOLDEN["net"]
        self.assertEqual((group["name"], group["aliases"], group["pinCount"], self.members(group)),
                         (golden["name"], golden["aliases"], golden["pinCount"], golden["members"]))
        self.assertEqual(self.members(group), by_rows, "the harness joins exactly what its rows joined")
        hops = sorted([{"from": [h["from"]["end"], h["from"]["endPin"], h["from"]["displayPath"], h["from"]["reference"],
                                h["from"]["pad"]],
                       "to": [h["to"]["end"], h["to"]["endPin"], h["to"]["displayPath"], h["to"]["reference"], h["to"]["pad"]]}
                       for h in group["hops"] if h["kind"] == "wire"], key=json.dumps)
        self.assertEqual(hops, golden["hops"])
        self.assertTrue(all(h["harnessId"] == harness["id"] and h["harnessName"] == "WH-001"
                            for h in group["hops"] if h["kind"] == "wire"))

    def test_the_pin_map_decides_which_pad_a_wire_reaches(self) -> None:
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        j11 = next(e for e in harness["ends"] if e["mates"]["port"]["reference"] == "J11")
        self.service.update_harness_end(DESIGNER, self.sid, self.version(), harness["id"], j11["id"],
                                        {"pinMap": {"1": "2", "2": "1"}})
        group = self.group_with("/PAY_PWR")
        # End pin 1 now lands on J11 pad 2 (GND), so the supply meets ground (and the ground wire, on end
        # pin 2, now reaches CH_A's rail on pad 1).
        self.assertIn(["PAY", "GND"], self.members(group))
        [supply] = [h for h in group["hops"] if h["kind"] == "wire" and h["to"]["reference"] == "J11" and h["from"]["pad"] == "3"]
        self.assertEqual((supply["to"]["endPin"], supply["to"]["pad"], supply["to"]["nets"]), ("1", "2", ["GND"]))

    def test_an_unmated_end_carries_the_join_but_is_no_member(self) -> None:
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        harness = self.service.add_harness_end(DESIGNER, self.sid, self.version(), harness["id"], {"pinCount": 2}).body
        loose = next(e for e in harness["ends"] if e["mates"] is None)
        j12 = next(e for e in harness["ends"] if e["mates"] and e["mates"]["port"]["reference"] == "J12")
        wires = [{"id": w["id"], "from": w["from"], "to": w["to"], "signal": w["signal"]} for w in harness["wires"]]
        # J12 pin 1 and the loose end's pin 1, and the loose pin 1 on to J11 pin 2 (GND): a splice at a free end.
        j11 = next(e for e in harness["ends"] if e["mates"] and e["mates"]["port"]["reference"] == "J11")
        wires += [{"from": {"end": j12["id"], "pin": "1"}, "to": {"end": loose["id"], "pin": "1"}, "signal": "X"},
                  {"from": {"end": loose["id"], "pin": "1"}, "to": {"end": j11["id"], "pin": "2"}, "signal": "X"}]
        self.service.replace_wires(DESIGNER, self.sid, self.version(), harness["id"], wires)
        group = self.group_with("/PAY_PWR")
        self.assertIn(["PAY", "GND"], self.members(group))
        self.assertTrue(all(m["displayPath"] for m in group["members"]))
        free = [h for h in group["hops"] if h["kind"] == "wire" and None in (h["from"]["occurrence"], h["to"]["occurrence"])]
        self.assertEqual(len(free), 2)
        self.assertTrue(all((h["to"] if h["to"]["occurrence"] is None else h["from"])["end"] == "End 4" for h in free))


class SceneHarnessTest(ImportCase):
    """SB2-34: the scene lists each harness with its ends on board occurrences, for the proxies."""

    def test_the_scene_places_harness_ends_on_their_connectors(self) -> None:
        self.assertEqual(self.service.scene(VIEWER, self.sid)["harnesses"], [])
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        [listed] = self.service.scene(VIEWER, self.sid)["harnesses"]
        self.assertEqual((listed["id"], listed["name"], listed["level"]), (harness["id"], "WH-001", None))
        paths = {o["displayPath"]: o["path"] for o in self.service.scene(VIEWER, self.sid)["occurrences"]}
        by_end = {e["id"]: e for e in harness["ends"]}
        self.assertEqual([(e["ordinal"], e["occurrence"], e["reference"]) for e in listed["ends"]],
                         [(by_end[e["id"]]["ordinal"], f"/{by_end[e['id']]['mates']['instanceId']}",
                           by_end[e["id"]]["mates"]["port"]["reference"]) for e in listed["ends"]])
        self.assertTrue(all(e["occurrence"] in paths.values() for e in listed["ends"]))
        self.assertEqual(sorted((w["id"], w["from"], w["to"]) for w in listed["wires"]),
                         sorted((w["id"], w["from"]["end"], w["to"]["end"]) for w in harness["wires"]))

    def test_scene_harnesses_carry_their_nodes(self) -> None:
        # SB2-45: the tubes route through stored breakouts and waypoints.
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        a, b = harness["ends"][0]["id"], harness["ends"][1]["id"]
        self.service.replace_nodes(DESIGNER, self.sid, self.version(), harness["id"], [
            {"kind": "waypoint", "positionMm": [1.0, 2.0, 3.0], "between": [a, b], "pinned": True}])
        [listed] = self.service.scene(VIEWER, self.sid)["harnesses"]
        self.assertEqual([(n["kind"], n["positionMm"], n["between"], n["pinned"]) for n in listed["nodes"]],
                         [("waypoint", [1.0, 2.0, 3.0], [a, b], True)])

    def test_scene_ends_carry_their_connector_for_the_tubes(self) -> None:
        # SB2-44: the browser poses each end from its connector's v6 geometry and stored frame.
        harness = self.service.harness_from_label(DESIGNER, self.sid, self.version(), "WH-001").body
        [listed] = self.service.scene(VIEWER, self.sid)["harnesses"]
        by_reference = {e["reference"]: e for e in listed["ends"]}
        connector = by_reference["J3"]["connector"]
        self.assertTrue({p["pad"] for p in connector["geometry"]["pads"]} >= {"1"})
        self.assertGreater(connector["thicknessMm"], 0)
        self.assertIsNone(connector["stored"], "nothing confirmed yet: the browser infers")
        self.assertIsNone(by_reference["J3"]["part"])
        # mini_payload has no PCB: its connectors have no geometry, so those ends can't be posed.
        self.assertEqual((by_reference["J11"]["connector"], by_reference["J12"]["connector"]), (None, None))
        self.assertTrue(all("gaugeAwg" in w for w in listed["wires"]))
        j3 = next(e for e in harness["ends"] if e["mates"]["port"]["reference"] == "J3")
        port_key = j3["mates"]["port"]["portKey"]
        geometry = next(e for e in listed["ends"] if e["id"] == j3["id"])["connector"]["geometry"]
        from app.services.systems import mating as mating_module
        self.service.set_mating(DESIGNER, self.sid, self.version(), j3["mates"]["instanceId"], port_key,
                                {"mode": "override", "axis": "bottom", "quarterTurns": 1})
        [listed] = self.service.scene(VIEWER, self.sid)["harnesses"]
        stored = next(e for e in listed["ends"] if e["id"] == j3["id"])["connector"]["stored"]
        self.assertEqual(stored, {"axis": "bottom", "quarterTurns": 1})
        self.assertIsNotNone(mating_module.infer(geometry))


class SceneHarnessRedactionTest(unittest.TestCase):
    harness = {"id": "shw_1", "level": "", "name": "W1", "wires": [{"id": "w1", "from": "e1", "to": "e2"}], "ends": [
        {"id": "e1", "ordinal": 0, "occurrence": "/sin_a", "reference": "J1", "connector": {"geometry": "g"}},
        {"id": "e2", "ordinal": 1, "occurrence": "/sin_b", "reference": "J2", "connector": {"geometry": "g"}},
        {"id": "e3", "ordinal": 2, "occurrence": None, "reference": None},
    ]}

    def test_restricted_boards_keep_the_box_not_the_connector(self) -> None:
        shown = {"/sin_a": {"restricted": False}, "/sin_b": {"restricted": True}}
        [out] = scene_module.redact_harnesses([self.harness], shown)
        self.assertEqual([(e["occurrence"], e["reference"]) for e in out["ends"]],
                         [("/sin_a", "J1"), ("/sin_b", None), (None, None)])
        self.assertEqual([e["connector"] for e in out["ends"]], [{"geometry": "g"}, None, None],
                         "a restricted board's connector geometry is withheld")
        # A board the reader cannot see at all is no anchor.
        [out] = scene_module.redact_harnesses([self.harness], {"/sin_a": {"restricted": False}})
        self.assertEqual(out["ends"][1]["occurrence"], None)

    def test_a_hidden_child_systems_harnesses_are_left_out(self) -> None:
        inner = {**self.harness, "level": "/sin_child"}
        self.assertEqual(scene_module.redact_harnesses([inner], {"/sin_child": {"restricted": True}}), [])
        self.assertEqual(scene_module.redact_harnesses([inner], {}), [])
        [out] = scene_module.redact_harnesses([inner], {"/sin_child": {"restricted": False}})
        self.assertEqual(out["level"], "/sin_child")


class ManifestHarnessTest(unittest.TestCase):
    """A subsystem's harnesses come from its snapshot manifest (camelCase, ``mates.port``)."""

    def test_manifest_wires_join_nets_through_the_pin_map(self) -> None:
        def port(ref: str) -> dict:
            return {"portKey": f"k-{ref}", "memberKeys": [f"k-{ref}"], "reference": ref}

        harness = {
            "id": "shn_1", "name": "Loom",
            "ends": [{"id": "she_a", "ordinal": 0, "mates": {"instanceId": "sin_a", "portKey": "k-J1", "port": port("J1")},
                      "pinMap": None},
                     {"id": "she_b", "ordinal": 1, "mates": {"instanceId": "sin_b", "portKey": "k-J2", "port": port("J2")},
                      "pinMap": {"1": "2"}}],
            "wires": [{"id": "shw_1", "from": {"end": "she_a", "pin": "1"}, "to": {"end": "she_b", "pin": "1"},
                       "signal": "EN", "netFrom": ["/EN"], "netTo": ["/ENABLE"]}],
        }
        root = system_nets.Level(prefix="", kinds={"sin_a": "board", "sin_b": "board"},
                                 labels={"sin_a": "A", "sin_b": "B"}, links=[], harnesses=[harness])
        [group] = system_nets.build(root)
        self.assertEqual(sorted((m["occurrence"], m["net"]) for m in group.members),
                         [("/sin_a", "/EN"), ("/sin_b", "/ENABLE")])
        [hop] = group.hops
        self.assertEqual((hop["kind"], hop["to"]["endPin"], hop["to"]["pad"], group.pin_count), ("wire", "1", "2", 2))


class HousingModelTest(unittest.TestCase):
    """SB2-47: a scene end with a part gets the first converted model of the part revision it pins (§18.2, #698)."""

    def test_first_converted_model_or_none(self) -> None:
        from app.services.systems.service import SystemService

        class Catalog:
            calls: list[tuple[str, object]] = []

            def list_models(self, component_id, revision_id=None):
                Catalog.calls.append((component_id, revision_id))
                if component_id == "broken":
                    raise LookupError("not a part")
                return [{"glb": None, "alignment": {}},
                        {"glb": {"key": "k2", "bounds": {"minMm": [0, 0, -9], "maxMm": [1, 1, 0]}},
                         "alignment": {"offsetMm": [0, 0, 1], "rotationDeg": [0, 0, 90], "scale": 1.0,
                                       "updatedBy": "user:x", "updatedAt": None}}] if component_id == "cmp_a" else []

        service = SystemService.__new__(SystemService)
        service._catalog = lambda: Catalog()
        harnesses = [{"ends": [{"part": "cmp_a", "partRevisionId": "rev_a"}, {"part": "cmp_a", "partRevisionId": "rev_a"},
                               {"part": "cmp_b", "partRevisionId": "rev_b"}, {"part": None, "partRevisionId": None},
                               {"part": "broken", "partRevisionId": "rev_x"}]}]
        service._attach_housings(harnesses)
        ends = harnesses[0]["ends"]
        self.assertEqual(ends[0]["housing"], {"glbKey": "k2", "boundsMm": {"minMm": [0, 0, -9], "maxMm": [1, 1, 0]},
                                              "alignment": {"offsetMm": [0, 0, 1], "rotationDeg": [0, 0, 90], "scale": 1.0}})
        self.assertIs(ends[1]["housing"], ends[0]["housing"])
        self.assertEqual([e["housing"] for e in ends[2:]], [None, None, None])
        self.assertEqual(Catalog.calls, [("cmp_a", "rev_a"), ("cmp_b", "rev_b"), ("broken", "rev_x")],
                         "each pinned part revision is asked once")
