"""AC-22: the Link module's end rules, as tables (no database)."""

from __future__ import annotations

import unittest

from app.services.systems import links
from app.services.systems.links import End
from app.services.systems.store_base import Conflict, Invalid


def port(key: str, *members: str) -> dict:
    return {"portKey": key, "memberKeys": [key, *members]}


def subport(sid: str, instance: str, key: str, pads: list[str], name: str = "PWR") -> dict:
    return {"id": sid, "instance_id": instance, "port": port(key), "pads": pads, "name": name}


def link(lid: str, a: tuple, b: tuple, kind: str = "unspecified") -> dict:
    out = {"id": lid, "type": kind, "rows": []}
    for side, (instance, key, sub) in (("a", a), ("b", b)):
        out.update({f"{side}_instance_id": instance, f"{side}_port": port(key), f"{side}_subport_id": sub})
    return out


def export(eid: str, instance: str, key: str | None = None, child: str | None = None, sub: str | None = None) -> dict:
    return {"id": eid, "target_instance_id": instance, "target_port": port(key) if key else None,
            "target_export_id": child, "target_subport_id": sub}


class EndRules(unittest.TestCase):
    def test_request_problem(self) -> None:
        cases = {
            "port to port": ([{"instanceId": "a", "portKey": "J1"}, {"instanceId": "b", "portKey": "J1"}], None),
            "port to export": ([{"instanceId": "a", "portKey": "J1"}, {"instanceId": "s", "exportId": "sxp_1"}], None),
            "neither key": ([{"instanceId": "a"}, {"instanceId": "b", "portKey": "J1"}], links.ONE_KEY),
            "both keys": ([{"instanceId": "a", "portKey": "J1", "exportId": "sxp_1"},
                           {"instanceId": "b", "portKey": "J1"}], links.ONE_KEY),
            "same port": ([{"instanceId": "a", "portKey": "J1"}, {"instanceId": "a", "portKey": "J1"}], links.SAME_PORT),
            "same export": ([{"instanceId": "s", "exportId": "x"}, {"instanceId": "s", "exportId": "x"}],
                            links.SAME_PORT),
            "two ports of one board": ([{"instanceId": "a", "portKey": "J1"}, {"instanceId": "a", "portKey": "J2"}],
                                       None),
            "one port, two sub-ports": ([{"instanceId": "a", "portKey": "J1", "subportId": "ssp_1"},
                                         {"instanceId": "a", "portKey": "J1"}], links.SAME_PORT),
            "shape before sameness": ([{"instanceId": "a"}, {"instanceId": "a"}], links.ONE_KEY),
        }
        for name, (ends, expected) in cases.items():
            with self.subTest(name):
                self.assertEqual(links.request_problem(ends), expected)

    def test_same_port_ignores_sub_ports(self) -> None:
        cases = {
            "one port": (End("a", "J1"), End("a", "J1"), True),
            "another board": (End("a", "J1"), End("b", "J1"), False),
            "another port": (End("a", "J1"), End("a", "J2"), False),
            "sub-port and remainder": (End("a", "J1", "ssp_1"), End("a", "J1"), True),
            "two sub-ports": (End("a", "J1", "ssp_1"), End("a", "J1", "ssp_2"), True),
        }
        for name, (a, b, expected) in cases.items():
            with self.subTest(name):
                self.assertEqual(links.same_port(a, b), expected)
                if expected:
                    with self.assertRaisesRegex(Invalid, "^both link ends are the same port$"):
                        links.check_distinct(a, b)
                else:
                    links.check_distinct(a, b)

    def test_check_type(self) -> None:
        cases = {
            "unspecified": ("unspecified", None, None),
            "b2b": ("b2b", None, None),
            "b2b with a stack height": ("b2b", 8.5, None),
            "unknown type": ("harness", None, "type must be one of unspecified, b2b"),
            "stack height off b2b": ("unspecified", 3.0, "stackHeightMm applies to board-to-board links only"),
            "zero stack height": ("b2b", 0, "stackHeightMm must be between 0 and 1000 mm"),
            "huge stack height": ("b2b", 1000, "stackHeightMm must be between 0 and 1000 mm"),
        }
        for name, (kind, stack, message) in cases.items():
            with self.subTest(name):
                if message is None:
                    links.check_type(kind, stack)
                else:
                    with self.assertRaises(Invalid) as raised:
                        links.check_type(kind, stack)
                    self.assertEqual(str(raised.exception), message)

    def test_check_subport(self) -> None:
        rows = [subport("ssp_1", "a", "J1", ["1", "2"]), subport("ssp_2", "a", "J2", ["1"]),
                subport("ssp_3", "b", "J1", ["1"])]
        cases = {
            "no sub-port": ("a", port("J1"), None, True),
            "its own": ("a", port("J1"), "ssp_1", True),
            "by member key": ("a", port("J9", "J1"), "ssp_1", True),
            "another connector's": ("a", port("J1"), "ssp_2", False),
            "another board's": ("a", port("J1"), "ssp_3", False),
            "unknown": ("a", port("J1"), "ssp_x", False),
        }
        for name, (instance, connector, sid, ok) in cases.items():
            with self.subTest(name):
                if ok:
                    links.check_subport(rows, instance, connector, sid)
                else:
                    with self.assertRaisesRegex(Invalid, f"^{links.NOT_A_SUBPORT}$"):
                        links.check_subport(rows, instance, connector, sid)

    def test_check_whole_connector(self) -> None:
        for name, component, ok in (("missing", None, True), ("a board port", {"portKey": "J1"}, True),
                                    ("a whole export", {"export": {"exportId": "x"}}, True),
                                    ("part of a split connector", {"export": {"exportId": "x", "subport": True}},
                                     False)):
            with self.subTest(name):
                if ok:
                    links.check_whole_connector(component)
                else:
                    with self.assertRaisesRegex(Conflict, "^port_split: "):
                        links.check_whole_connector(component)

    def test_exported(self) -> None:
        rows = [export("x1", "a", key="J1"), export("x2", "a", key="J2", sub="ssp_1"), export("x3", "s", child="cx")]
        cases = {
            "board port": (End("a", "J1"), "x1"),
            "another board": (End("b", "J1"), None),
            "sub-port of a split connector": (End("a", "J2", "ssp_1"), "x2"),
            "remainder of that connector": (End("a", "J2"), None),
            "sub-port not exported": (End("a", "J1", "ssp_9"), None),
            "re-export": (End("s", "cx"), "x3"),
        }
        for name, (end, expected) in cases.items():
            with self.subTest(name):
                found = links.exported(rows, end)
                self.assertEqual(found and found["id"], expected)
        with self.assertRaisesRegex(Conflict, "^export_port_linked: "):
            links.refuse_exported(rows[0])
        links.refuse_exported(None)

    def test_linked(self) -> None:
        rows = [link("l1", ("a", "J1", None), ("b", "J1", None)), link("l2", ("a", "J2", "ssp_1"), ("c", "J1", None))]
        cases = {
            "a end": (End("a", "J1"), True), "b end": (End("b", "J1"), True), "free": (End("a", "J3"), False),
            "the sub-port": (End("a", "J2", "ssp_1"), True), "the remainder": (End("a", "J2"), False),
        }
        for name, (end, expected) in cases.items():
            with self.subTest(name):
                self.assertEqual(links.linked(rows, end), expected)

    def test_end_pads(self) -> None:
        pins = {"1": {}, "2": {}, "3": {}}
        split = [subport("ssp_1", "a", "J1", ["1"])]
        cases = {
            "whole connector": (link("l", ("a", "J2", None), ("b", "J1", None)), "a", set(pins)),
            "sub-port": (link("l", ("a", "J1", "ssp_1"), ("b", "J1", None)), "a", {"1"}),
            "remainder": (link("l", ("a", "J1", None), ("b", "J1", None)), "a", {"2", "3"}),
            "other board's connector": (link("l", ("a", "J1", None), ("b", "J1", None)), "b", set(pins)),
        }
        for name, (row, side, expected) in cases.items():
            with self.subTest(name):
                self.assertEqual(links.end_pads(row, side, pins, split), expected)


class HarnessEndsAsLinks(unittest.TestCase):
    harness = {
        "id": "shn_1", "system_id": "sys_1", "name": "Main", "label": "W1", "updated_at": "t",
        "wires": [{"id": "shw_1", "from_end": "she_a", "from_pin": "1", "to_end": "she_b", "to_pin": "4",
                   "net_from": ["GND"], "net_to": ["/GND"], "signal": "GND"}],
    }

    def test_ids(self) -> None:
        for link_id, expected in (("she_" + "0" * 32, True), ("slk_" + "0" * 32, False), ("", False)):
            with self.subTest(link_id):
                self.assertEqual(links.is_harness_end(link_id), expected)

    def test_end_pad_follows_the_pin_map(self) -> None:
        for name, end, pin, expected in (("identity", {"pin_map": None}, "3", "3"),
                                         ("mapped", {"pin_map": {"3": "7"}}, "3", "7"),
                                         ("unmapped pin", {"pin_map": {"3": "7"}}, "1", "1")):
            with self.subTest(name):
                self.assertEqual(links.end_pad(end, pin), expected)

    def test_end_as_link(self) -> None:
        end = {"id": "she_b", "ordinal": 1, "mates_instance_id": "sin_b", "mates_port": port("J2"),
               "pin_map": {"4": "9"}}
        view = links.end_as_link(self.harness, end)
        self.assertEqual(view["id"], "she_b")
        self.assertEqual(view["type"], "harness_end")
        self.assertEqual(view["name"], "Main end 2")
        self.assertEqual((view["a_instance_id"], view["b_instance_id"]), ("sin_b", None))
        self.assertEqual(view["rows"], [{"id": "shw_1", "pin_a": "9", "pin_b": "", "net_a": ["/GND"], "net_b": [],
                                         "signal": "GND", "source": "manual"}])


if __name__ == "__main__":
    unittest.main()
