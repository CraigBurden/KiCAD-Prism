"""SB2-08: system nets across the hierarchy, and the join checks V09/V10 (CONTRACTS_P2 §8)."""

from __future__ import annotations

import time
import unittest

from test_system_assemblies import AssemblyCase
from test_system_snapshots import DESIGNER, VIEWER

from app.services.systems import system_nets, validation
from app.services.systems.store import Invalid
from app.services.systems.system_nets import Level, name_mismatch, net_meets_none, power_meets_signal
from support.postgres import seed_folder


class JoinRuleTest(unittest.TestCase):
    def test_v09_relates_renamed_nets_and_flags_unrelated_ones(self) -> None:
        cases = [
            (["/Payload IF/GPIO4"], ["/IO4"], False), (["/Payload IF/GPIO4"], ["/IO5"], True),
            (["PAYLOAD_RESET#"], ["/RST_IN#"], False), (["/PWR_GOOD"], ["/PG_OUT"], False),
            (["/SPI_SCK"], ["/SCK_IN"], False), (["/UART_TX"], ["/RX"], False),
            (["/TM_MON_1"], ["GND_3"], True), (["PAYLOAD_INT#"], ["/IRQ_OUT#"], True),
            (["Net-(J1-Pad3)"], ["/X"], False), ([], ["/X"], False), (["~{RESET}"], ["/RST"], False),
        ]
        for net_a, net_b, expected in cases:
            with self.subTest(a=net_a, b=net_b):
                self.assertEqual(name_mismatch(net_a, net_b), expected)

    def test_v10_power_meets_a_named_signal(self) -> None:
        self.assertTrue(power_meets_signal(True, ["GND_3"], False, ["/TM_MON_1"]))
        self.assertFalse(power_meets_signal(True, ["GND"], True, ["GND_3"]))
        self.assertFalse(power_meets_signal(True, ["GND"], False, []))  # unconnected on the other side
        self.assertFalse(power_meets_signal(None, ["GND"], False, ["/X"]))  # pre-v5 artifact: not evaluated

    def test_v10_in_validation_uses_the_pins_power_flag(self) -> None:
        def interface(power: bool, net: str) -> dict:
            return {"components": [{"portKey": "k", "memberKeys": ["k"], "reference": "J1", "candidate": True,
                                    "pins": [{"pad": "1", "nets": [net], "powerNet": power}]}], "hasPcb": False}
        instances = [{"id": "a", "resolution": "resolved"}, {"id": "b", "resolution": "resolved"}]
        port = {"portKey": "k", "memberKeys": ["k"], "reference": "J1"}
        links = [{"id": "L", "a_instance_id": "a", "b_instance_id": "b", "a_port": port, "b_port": port, "harness": None,
                  "rows": [{"id": "r", "pin_a": "1", "pin_b": "1", "net_a": ["GND_3"], "net_b": ["/TM_MON_1"]}]}]
        interfaces = {"a": interface(True, "GND_3"), "b": interface(False, "/TM_MON_1")}
        report = validation.validate(instances, links, interfaces, {"a": {}, "b": {}})
        rules = sorted((f["rule"], f["severity"]) for f in report["findings"])  # V09 needs no opt-in (D-P2-57)
        self.assertEqual(rules, [("SYS-V09", "warning"), ("SYS-V10", "error")])
        [v10] = [f for f in report["findings"] if f["rule"] == "SYS-V10"]
        self.assertEqual((v10["linkId"], v10["rowId"], v10["detail"]["powerSide"]), ("L", "r", "a"))


    def test_v23_named_net_on_a_pin_on_no_net(self) -> None:
        cases = [
            (["/VCC_CMBD_3V3_M"], [], "a"), ([], ["/VCC"], "b"),
            (["/VCC"], ["unconnected-(J7-Pad4)"], "a"), (["/VCC"], ["/Sheet/unconnected-(J7-Pad4)"], "a"),
            (["/VCC"], ["Net-(J7-Pad4)"], None),  # an auto-net is a connection
            (["Net-(J3-Pad1)"], [], None), ([], [], None), (["/A"], ["/B"], None),
        ]
        for net_a, net_b, expected in cases:
            with self.subTest(a=net_a, b=net_b):
                self.assertEqual(net_meets_none(net_a, net_b), expected)

    def test_v23_in_validation_needs_both_interfaces(self) -> None:
        def interface(net: str | None) -> dict:
            return {"components": [{"portKey": "k", "memberKeys": ["k"], "reference": "J1", "candidate": True,
                                    "pins": [{"pad": "1", "nets": [net] if net else [], "powerNet": False}]}], "hasPcb": False}
        instances = [{"id": "a", "resolution": "resolved"}, {"id": "b", "resolution": "resolved"}]
        port = {"portKey": "k", "memberKeys": ["k"], "reference": "J1"}
        links = [{"id": "L", "a_instance_id": "a", "b_instance_id": "b", "a_port": port, "b_port": port, "harness": None,
                  "rows": [{"id": "r", "pin_a": "1", "pin_b": "1", "net_a": ["/VCC_3V3"], "net_b": []}]}]
        report = validation.validate(instances, links, {"a": interface("/VCC_3V3"), "b": interface(None)}, {"a": {}, "b": {}})
        [v23] = report["findings"]
        self.assertEqual((v23["rule"], v23["severity"], v23["pin"], v23["detail"]["namedSide"]), ("SYS-V23", "warning", "1", "a"))
        self.assertEqual(validation.rule_label("net_meets_no_net"), "Named net meets a pin on no net")
        unextracted = validation.validate(instances, links, {"a": interface("/VCC_3V3")}, {"a": {}, "b": {}})
        self.assertFalse([f for f in unextracted["findings"] if f["rule"] == "SYS-V23"])


def _level(prefix: str, boards: list[str], links: list[dict], exports=(), assemblies=()) -> Level:
    kinds = {b: "board" for b in boards} | {a: "assembly" for a in assemblies}
    return Level(prefix=prefix, kinds=kinds, labels={k: k for k in kinds}, links=links, exports=list(exports))


def _link(lid: str, a: tuple, b: tuple, rows: list[tuple]) -> dict:
    def end(spec):
        instance, key, ref = spec
        return {"instanceId": instance, ("exportId" if key.startswith("sxp") else "portKey"): key,
                ("export" if key.startswith("sxp") else "port"): {"reference": ref, "name": ref}}
    return {"id": lid, "name": lid, "a": end(a), "b": end(b),
            "rows": [{"pinA": pa, "pinB": pb, "netA": na, "netB": nb} for pa, pb, na, nb in rows]}


class GraphTest(unittest.TestCase):
    def test_a_net_crosses_an_export_and_a_re_export(self) -> None:
        # grandchild: board G carries /PWR on its J1 (exported as sxp_g)
        grandchild = _level("/sin_c/sin_gc", ["G"], [], exports=[{"id": "sxp_g", "target": {"instanceId": "G", "portKey": "gJ1", "port": {"reference": "J1"}}}])
        # child: re-exports the grandchild's export as sxp_c; also links board C to it internally? no: C is separate
        child = _level("/sin_c", ["C"], [], exports=[{"id": "sxp_c", "target": {"instanceId": "sin_gc", "exportId": "sxp_g"}}],
                       assemblies=["sin_gc"])
        child.children["sin_gc"] = grandchild
        root = _level("", ["P"], [_link("L1", ("P", "pJ3", "J3"), ("sin_c", "sxp_c", "PWR_IN"), [("1", "1", ["VBUS"], ["/PWR"])])],
                      assemblies=["sin_c"])
        root.children["sin_c"] = child
        [group] = [g for g in system_nets.build(root) if len(g.members) > 1]
        self.assertEqual(sorted((m["occurrence"], m["net"]) for m in group.members),
                         [("/P", "VBUS"), ("/sin_c/sin_gc/G", "/PWR")])
        [hop] = group.hops
        self.assertEqual((hop["from"]["reference"], hop["to"]["occurrence"], hop["to"]["reference"]), ("J3", "/sin_c/sin_gc/G", "J1"))
        self.assertEqual(group.aliases, ["PWR", "VBUS"])

    def test_same_board_net_joins_two_links_and_unconnected_pins_stay_apart(self) -> None:
        links = [_link("L1", ("A", "a1", "J1"), ("B", "b1", "J1"), [("1", "1", ["/X"], ["/X"]), ("2", "2", [], [])]),
                 _link("L2", ("B", "b2", "J2"), ("C", "c1", "J1"), [("1", "1", ["/X"], ["/Y"])])]
        groups = [g for g in system_nets.build(_level("", ["A", "B", "C"], links))]
        x = next(g for g in groups if "X" in g.aliases)
        self.assertEqual(sorted(m["occurrence"] for m in x.members), ["/A", "/B", "/C"])
        self.assertEqual(len(x.hops), 2)
        unconnected = [g for g in groups if not g.aliases]
        self.assertEqual(len(unconnected), 1)
        self.assertEqual(len(unconnected[0].members), 2)

    def test_two_hundred_boards_in_under_two_seconds(self) -> None:
        boards = [f"B{n:03d}" for n in range(200)]
        links = [_link(f"L{n}", (boards[n], "k", "J1"), (boards[n + 1], "k2", "J2"),
                       [(str(p), str(p), [f"/N{p}"], [f"/N{p}"]) for p in range(1, 21)]) for n in range(199)]
        start = time.perf_counter()
        groups = system_nets.build(_level("", boards, links))
        elapsed = time.perf_counter() - start
        self.assertEqual(len(groups), 20)
        self.assertLess(elapsed, 2.0, f"{elapsed:.2f}s")


class NetApiTest(AssemblyCase):
    """Bus = CNDH-A (the fixture system; PWR_IN = OBC-A J6) + PDU, linked PDU J1 ↔ CNDH-A PWR_IN."""

    def setUp(self) -> None:
        super().setUp()
        publication = self.child()
        self.bus, version = self.parent()
        added = self.add(self.bus, version, "CNDH-A", publication["componentId"])
        pdu = self.service.add_instance(DESIGNER, self.bus, added.version, project_id="prj_pwr", label="PDU",
                                        baseline_commit=self.commits["mini_power"]["F0"], tracked_ref=None, pinned=False)
        doc = self.service.document(DESIGNER, self.bus).body
        export_id = next(i for i in doc["instances"] if i["id"] == added.body["id"])["ports"][0]["portKey"]
        j1 = next(p["portKey"] for i in doc["instances"] if i["id"] == pdu.body["id"] for p in i["ports"] if p["reference"] == "J1")
        link = self.service.create_link(DESIGNER, self.bus, doc["system"]["version"],
                                        a={"instanceId": pdu.body["id"], "portKey": j1},
                                        b={"instanceId": added.body["id"], "portKey": export_id}, name="Bus power", harness=None).body
        self.service.replace_rows(DESIGNER, self.bus, self.service.document(DESIGNER, self.bus).body["system"]["version"],
                                  link["id"], [{"pinA": "1", "pinB": "1", "signal": "VIN"}])

    def test_vin_is_traced_from_the_parent_into_the_child(self) -> None:
        found = self.service.nets(VIEWER, self.bus, search="VIN_28V")
        self.assertEqual(found["total"], 1, found)
        [summary] = found["groups"]
        self.assertGreaterEqual(summary["boards"], 3)  # PDU, CNDH-A ▸ OBC-A, and the child board OBC-A links to
        net = self.service.net(VIEWER, self.bus, summary["groupId"])
        paths = {m["displayPath"] for m in net["members"]}
        self.assertIn("PDU", paths)
        self.assertIn("CNDH-A ▸ OBC-A", paths)
        self.assertTrue(any(h["from"]["displayPath"] == "PDU" and h["to"]["displayPath"] == "CNDH-A ▸ OBC-A"
                            and h["to"]["reference"] == "J6" for h in net["hops"]), net["hops"])
        self.assertTrue(any(h["from"]["displayPath"].startswith("CNDH-A ▸") and h["to"]["displayPath"].startswith("CNDH-A ▸")
                            for h in net["hops"]), "the child's own links are part of the trace")
        on_pdu = self.service.nets(VIEWER, self.bus, occurrence=next(m["occurrence"] for m in net["members"]
                                                                    if m["displayPath"] == "PDU"))
        self.assertIn(summary["groupId"], [g["groupId"] for g in on_pdu["groups"]])

    def test_a_board_net_resolves_to_its_system_net(self) -> None:
        [summary] = self.service.nets(VIEWER, self.bus, search="VIN_28V")["groups"]
        member = next(m for m in self.service.net(VIEWER, self.bus, summary["groupId"])["members"] if m["displayPath"] == "PDU")
        found = self.service.nets(VIEWER, self.bus, occurrence=member["occurrence"], net=member["net"])
        self.assertEqual([g["groupId"] for g in found["groups"]], [summary["groupId"]])
        # Exact: a prefix of the name, or the name on another board, finds nothing.
        self.assertEqual(self.service.nets(VIEWER, self.bus, occurrence=member["occurrence"], net=member["net"][:-1])["total"], 0)
        other = next(m for m in self.service.net(VIEWER, self.bus, summary["groupId"])["members"] if m["displayPath"] != "PDU")
        self.assertEqual(self.service.nets(VIEWER, self.bus, occurrence=other["occurrence"], net="NO_SUCH_NET")["total"], 0)
        with self.assertRaises(Invalid):
            self.service.nets(VIEWER, self.bus, net=member["net"])

    def test_the_list_pages_with_offset(self) -> None:
        everything = self.service.nets(VIEWER, self.bus, limit=500)
        self.assertGreater(everything["total"], 2)
        first = self.service.nets(VIEWER, self.bus, limit=2)
        rest = self.service.nets(VIEWER, self.bus, limit=500, offset=2)
        self.assertEqual((first["total"], rest["offset"]), (everything["total"], 2))
        self.assertEqual([g["groupId"] for g in first["groups"] + rest["groups"]],
                         [g["groupId"] for g in everything["groups"]])

    def test_the_list_can_carry_members_for_search(self) -> None:
        [summary] = self.service.nets(VIEWER, self.bus, search="VIN_28V")["groups"]
        self.assertNotIn("members", summary)
        [listed] = self.service.nets(VIEWER, self.bus, search="VIN_28V", members=True)["groups"]
        detail = self.service.net(VIEWER, self.bus, summary["groupId"])
        self.assertEqual(listed["members"], [{"occurrence": m["occurrence"], "net": m["net"]}
                                             for m in detail["members"] if m["occurrence"] and m["net"]])
        self.assertIn("PDU", {m["displayPath"] for m in detail["members"]})

    def test_hidden_boards_are_redacted_in_nets(self) -> None:
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pwr'")
        self.conn.commit()
        [summary] = self.service.nets(VIEWER, self.bus, search="VIN_28V")["groups"]
        net = self.service.net(VIEWER, self.bus, summary["groupId"])
        self.assertTrue(any(m["redacted"] for m in net["members"]))
        self.assertNotIn("PDU", {m["displayPath"] for m in net["members"]})
        self.assertFalse(any("PDU" in (h["from"]["displayPath"], h["to"]["displayPath"]) for h in net["hops"]))


if __name__ == "__main__":
    unittest.main()
