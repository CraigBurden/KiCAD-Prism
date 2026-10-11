"""SYS-11: mapping generators (contract §8.5), pure and through the API."""

from __future__ import annotations

import unittest
from unittest import mock

from fastapi import FastAPI

from system_builder_db import FixtureSystemCase
from support.postgres import seed_folder
from test_system_api import _request

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import generators
from app.services.systems import service as service_module
from app.services.systems.jobs import extract_and_store
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Invalid, NotFound

DESIGNER = Caller(role="designer", email="designer@example.com")
VIEWER = Caller(role="viewer", email="viewer@example.com")


def pins(count: int, nets=None, first: int = 1) -> dict:
    nets = nets or {}
    return {str(n): {"pad": str(n), "pinNames": [f"P{n}"], "nets": nets.get(str(n), [f"/N{n}"])}
            for n in range(first, first + count)}


def pairs(result: dict) -> list[tuple[str, str]]:
    return [(r["pinA"], r["pinB"]) for r in result["rows"]]


class GeneratorTest(unittest.TestCase):
    def test_identity_pairs_common_pads_in_natural_order(self) -> None:
        result = generators.generate("identity", pins(12), pins(10), [])
        self.assertEqual(pairs(result), [(str(n), str(n)) for n in range(1, 11)])
        row = result["rows"][0]
        self.assertEqual((row["signal"], row["source"], row["netA"], row["pinNamesB"]),
                         ("N1", "generator", ["/N1"], ["P1"]))

    def test_signal_prefers_a_named_net_over_kicad_auto_names(self) -> None:
        """SB2-118: ``Net-(J3-Pad1)`` on side A gives way to side B's named net; two auto names keep A's."""
        a = pins(3, {"1": ["Net-(J3-Pad1)"], "2": ["unconnected-(J3-Pad2)"], "3": ["/VIN"]})
        b = pins(3, {"1": ["/+12V_CMBD_M"], "2": ["Net-(J7-Pad2)"], "3": ["/VIN_B"]})
        result = generators.generate("identity", a, b, [], {"includeUnconnected": True})
        self.assertEqual([r["signal"] for r in result["rows"]], ["+12V_CMBD_M", "unconnected-(J3-Pad2)", "VIN"])

    def test_reverse_and_ranges(self) -> None:
        self.assertEqual(pairs(generators.generate("reverse", pins(4), pins(4), [])),
                         [("1", "4"), ("2", "3"), ("3", "2"), ("4", "1")])
        result = generators.generate("reverse", pins(10), pins(10), [],
                                     {"rangeA": {"from": "3", "to": "5"}, "rangeB": {"from": "8"}})
        self.assertEqual(pairs(result), [("3", "10"), ("4", "9"), ("5", "8")])
        for options in ({"rangeA": {"from": "99"}}, {"rangeA": {"from": "5", "to": "3"}}):
            with self.assertRaises(Invalid):
                generators.generate("identity", pins(10), pins(10), [], options)

    def test_offset(self) -> None:
        self.assertEqual(pairs(generators.generate("offset", pins(6), pins(10), [], {"offset": 4})),
                         [("1", "5"), ("2", "6"), ("3", "7"), ("4", "8"), ("5", "9"), ("6", "10")])
        self.assertEqual(pairs(generators.generate("offset", pins(6), pins(3), [], {"offset": -3})),
                         [("4", "1"), ("5", "2"), ("6", "3")])
        for bad in ({}, {"offset": "2"}, {"offset": True}, {"offset": 10**6}):
            with self.assertRaises(Invalid):
                generators.generate("offset", pins(3), pins(3), [], bad)

    def test_net_name_matches_leaves_once_each(self) -> None:
        a = pins(4, {"1": ["GND"], "2": ["GND"], "3": ["/If/SPI_SCK"], "4": ["/Only_A"]})
        b = pins(4, {"1": ["/Sub/spi_sck"], "2": ["GND"], "3": ["GND"], "4": ["/Other"]})
        self.assertEqual(pairs(generators.generate("net_name", a, b, [])), [("1", "2"), ("2", "3"), ("3", "1")])

    def test_never_overwrites_and_skips_unconnected(self) -> None:
        a = pins(4, {"4": []})
        b = pins(4, {"4": []})
        result = generators.generate("identity", a, b, [{"pin_a": "1", "pin_b": "3"}])
        self.assertEqual(pairs(result), [("2", "2")])
        self.assertEqual(result["skipped"], [{"pinA": "1", "pinB": "1", "reason": "existing"},
                                             {"pinA": "3", "pinB": "3", "reason": "existing"},
                                             {"pinA": "4", "pinB": "4", "reason": "unconnected"}])
        loose = generators.generate("identity", a, b, [], {"includeUnconnected": True})
        self.assertEqual(loose["rows"][-1]["signal"], "")

    def test_rows_carry_the_join_rules_they_would_raise(self) -> None:
        a = pins(4, {"1": ["/VCC_3V3"], "2": ["/TM_MON"], "3": ["GND"], "4": ["/SDA"]})
        b = pins(4, {"1": [], "2": ["GND_3"], "3": ["/SCL"], "4": ["/I2C_SDA"]})
        a["3"]["powerNet"], b["3"]["powerNet"] = True, False
        flags = {r["pinA"]: [f["rule"] for f in r["flags"]] for r in generators.generate("identity", a, b, [])["rows"]}
        self.assertEqual(flags, {"1": ["SYS-V23"], "2": ["SYS-V09"], "3": ["SYS-V09", "SYS-V10"], "4": []})
        self.assertEqual(generators.suspect(a["3"], b["3"], ["GND"], ["/SCL"])[1],
                         {"rule": "SYS-V10", "name": "power_meets_signal", "severity": "error"})

    def test_unknown_generator(self) -> None:
        with self.assertRaises(Invalid):
            generators.generate("magic", pins(1), pins(1), [])


class GenerateServiceTest(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"})
        for board, project_id in (("mini_obc", "prj_obc"), ("mini_payload", "prj_pay"),
                                  ("mini_power", "prj_pwr")):
            extract_and_store(self.projects[project_id], self.commits[board]["F0"], self.connect)

    def test_identity_proposes_only_the_unused_spare_pin(self) -> None:
        result = self.service.generate_rows(DESIGNER, self.sid, self.links["L-J7J4"], "identity", {}).body
        [row] = result["rows"]  # J7/J4 pin 19 is the spare no row uses (§11 F7)
        self.assertEqual((row["pinA"], row["pinB"], row["signal"], row["netB"], row["pinNamesA"]),
                         ("19", "19", "SPARE19", [], ["Pin_19"]))
        self.assertEqual(len([s for s in result["skipped"] if s["reason"] == "existing"]), 18)

    def test_proposals_apply_through_replace_rows(self) -> None:
        link_id = self.links["L-J2J1"]
        version = self.version()
        link = self.store.get_link(self.sid, link_id)
        keep = [{"id": r["id"], "pinA": r["pin_a"], "pinB": r["pin_b"], "signal": r["signal"], "source": r["source"]}
                for r in link["rows"] if r["pin_a"] in ("1", "2")]
        version = self.service.replace_rows(DESIGNER, self.sid, version, link_id, keep).version
        proposed = self.service.generate_rows(DESIGNER, self.sid, link_id, "identity", {}).body
        self.assertEqual(pairs(proposed), [("3", "3"), ("4", "4")])
        self.assertEqual(proposed["rows"][0]["signal"], "PWR_GOOD")
        self.assertEqual(self.version(), version)  # generating writes nothing
        rows = keep + [{k: r[k] for k in ("pinA", "pinB", "signal", "source")} for r in proposed["rows"]]
        body = self.service.replace_rows(DESIGNER, self.sid, version, link_id, rows).body
        self.assertEqual(sorted((r["pinA"], r["source"]) for r in body["rows"])[-2:],
                         [("3", "generator"), ("4", "generator")])

    def test_net_name_on_fixture_nets(self) -> None:
        result = self.service.generate_rows(DESIGNER, self.sid, self.links["L-J2J1"], "net_name",
                                            {}).body
        self.assertEqual(result["rows"], [])  # only GND shares a leaf, and pin 2 is already used
        self.assertIn({"pinA": "2", "pinB": "2", "reason": "existing"}, result["skipped"])

    def test_restricted_links_are_hidden(self) -> None:
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"])
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pwr'")
        self.conn.commit()
        with self.assertRaises(NotFound):
            self.service.generate_rows(VIEWER, self.sid, self.links["L-J2J1"], "identity", {})


class GenerateApiTest(GenerateServiceTest):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch.object(service_module, "service", self.service)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.app = FastAPI()
        install_error_handlers(self.app)
        self.app.include_router(systems_api.router, prefix="/api/systems")

    def test_route(self) -> None:
        self.assertIn("/api/systems/{system_id}/links/{link_id}/generate", self.app.openapi()["paths"])
        path = f"/api/systems/{self.sid}/links/{self.links['L-J7J4']}/generate"
        ok = _request(self.app, "POST", path, body={"generator": "reverse"}, user="viewer")
        self.assertEqual((ok.status, ok.json["generator"], ok.json["linkId"]), (200, "reverse", self.links["L-J7J4"]))
        self.assertIn("etag", ok.headers)
        self.assertEqual(_request(self.app, "POST", path, body={"generator": "magic"}).status, 422)
        self.assertEqual(_request(self.app, "POST", path, body={"generator": "offset", "options": {}}).status, 422)


if __name__ == "__main__":
    unittest.main()
