"""SB2-06: links to a subsystem's exports, and re-exports (CONTRACTS_P2 §4.1, §6.1, §10)."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_assemblies import AssemblyCase
from test_system_snapshots import DESIGNER, VIEWER

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import manifest as manifest_io
from app.services.systems import service as service_module
from app.services.systems.manifest_schema import digests
from app.services.systems.store import Conflict, Invalid, SystemStore


class ExportLinkTest(AssemblyCase):
    """Bus = CNDH-A (the fixture system, exporting OBC-A J6 as PWR_IN) + a PWR board."""

    def build_bus(self) -> dict:
        publication = self.child()
        bus, version = self.parent()
        cndh = self.add(bus, version, "CNDH-A", publication["componentId"])
        pwr = self.service.add_instance(DESIGNER, bus, cndh.version, project_id="prj_pwr", label="PDU",
                                        baseline_commit=self.commits["mini_power"]["F0"], tracked_ref=None, pinned=False)
        [subsystem] = [i for i in self.document_of(bus)["instances"] if i["id"] == cndh.body["id"]]
        export_id = subsystem["ports"][0]["portKey"]
        return {"bus": bus, "cndh": cndh.body["id"], "pwr": pwr.body["id"], "export": export_id,
                "publication": publication}

    def document_of(self, system_id: str, caller=DESIGNER) -> dict:
        return self.service.document(caller, system_id).body

    def version_of(self, system_id: str) -> int:
        return self.document_of(system_id)["system"]["version"]

    def pwr_port(self, bus: str, pwr: str, reference: str = "J1") -> str:
        [instance] = [i for i in self.document_of(bus)["instances"] if i["id"] == pwr]
        return next(p["portKey"] for p in instance["ports"] if p["reference"] == reference)

    def link(self, ctx: dict) -> dict:
        return self.service.create_link(
            DESIGNER, ctx["bus"], self.version_of(ctx["bus"]),
            a={"instanceId": ctx["pwr"], "portKey": self.pwr_port(ctx["bus"], ctx["pwr"])},
            b={"instanceId": ctx["cndh"], "portKey": ctx["export"]}, name="Bus power", harness=None,
        ).body

    def test_a_link_to_an_export_captures_the_childs_pin_nets(self) -> None:
        ctx = self.build_bus()
        link = self.link(ctx)
        self.assertEqual((link["b"]["port"]["reference"], link["b"]["export"]["reference"]), ("PWR_IN", "J6"))
        rows = self.service.replace_rows(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), link["id"],
                                         [{"pinA": "1", "pinB": "1", "signal": "VBUS"}]).body["rows"]
        [row] = rows
        interface = self.service.export_interface(DESIGNER, self.sid)
        child_pin_1 = next(p for p in interface["exports"][0]["pins"] if p["pad"] == "1")
        self.assertEqual(row["netB"], child_pin_1["nets"])
        self.assertTrue(row["observedB"]["present"])
        with self.assertRaisesRegex(Invalid, "pin 99 does not exist on PWR_IN"):
            self.service.replace_rows(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), link["id"],
                                      [{"pinA": "1", "pinB": "99"}])
        generated = self.service.generate_rows(DESIGNER, ctx["bus"], link["id"], "identity", {}).body
        self.assertTrue(generated["rows"])
        self.assertEqual(self.service.validation_report(DESIGNER, ctx["bus"]).body["counts"]["error"], 0)

    def test_an_assembly_interface_reads_like_a_board_interface(self) -> None:
        ctx = self.build_bus()
        state, body = self.service.interface(VIEWER, ctx["bus"], ctx["cndh"], None)
        self.assertEqual(state, "ready")
        [component] = body["components"]
        self.assertEqual((component["portKey"], component["reference"], component["value"], component["exposed"]),
                         (ctx["export"], "PWR_IN", "J6", True))
        with self.assertRaisesRegex(Invalid, "always ports"):
            self.service.set_override(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), ctx["cndh"], ctx["export"],
                                      "hidden")
        with self.assertRaisesRegex(Invalid, "no commits"):
            self.service.interface(VIEWER, ctx["bus"], ctx["cndh"], "a" * 40)

    def test_re_exports_pass_a_child_export_up(self) -> None:
        ctx = self.build_bus()
        created = self.service.create_export(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), name="CNDH_PWR",
                                             description="", instance_id=ctx["cndh"], port_key=None,
                                             child_export_id=ctx["export"]).body
        self.assertEqual((created["childExportId"], created["resolved"]), (ctx["export"], True))
        [entry] = self.service.export_interface(DESIGNER, ctx["bus"])["exports"]
        self.assertEqual((entry["name"], entry["reference"], entry["resolved"]), ("CNDH_PWR", "J6", True))
        self.assertTrue(entry["occurrence"].startswith(f"/{ctx['cndh']}/"), entry["occurrence"])
        with self.assertRaisesRegex(Conflict, "export_port_linked"):
            self.link(ctx)
        with self.assertRaisesRegex(Invalid, "not an export of this subsystem"):
            self.service.create_export(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), name="X", description="",
                                       instance_id=ctx["cndh"], port_key=None, child_export_id="sxp_" + "0" * 32)

    def test_a_linked_child_export_cannot_be_re_exported(self) -> None:
        ctx = self.build_bus()
        self.link(ctx)
        with self.assertRaisesRegex(Conflict, "export_port_linked"):
            self.service.create_export(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), name="CNDH_PWR",
                                       description="", instance_id=ctx["cndh"], port_key=None,
                                       child_export_id=ctx["export"])

    def test_icd_names_the_physical_connector_and_the_manifest_round_trips(self) -> None:
        ctx = self.build_bus()
        link = self.link(ctx)
        self.service.replace_rows(DESIGNER, ctx["bus"], self.version_of(ctx["bus"]), link["id"],
                                  [{"pinA": "1", "pinB": "1", "signal": "VBUS"}])
        html, _name, _version = self.service.icd(DESIGNER, ctx["bus"], "html")
        self.assertIn("CNDH-A ▸ PWR_IN → J6", html)
        with self.connect() as conn:
            store = SystemStore(conn)
            refs = self.service._catalog_refs(store, ctx["bus"])
            before = manifest_io.build(store, ctx["bus"], created_by="t", created_at="2026-09-30T00:00:00Z",
                                       catalog_refs=refs)
            [end] = [l.b for l in before.links]
            self.assertEqual((end.exportId, end.export.name), (ctx["export"], "PWR_IN"))
            store.delete_system(ctx["bus"])
            manifest_io.import_manifest(store, before, actor="user:t")
            after = manifest_io.build(store, ctx["bus"], created_by="t", created_at="2026-09-30T00:00:00Z",
                                      catalog_refs=refs)
            conn.commit()
        self.assertEqual(digests(after), digests(before))

    def test_api_accepts_export_ends(self) -> None:
        ctx = self.build_bus()
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        etag = f'"sys:{ctx["bus"]}:{self.version_of(ctx["bus"])}"'
        port = self.pwr_port(ctx["bus"], ctx["pwr"])
        with mock.patch.object(service_module, "service", self.service):
            both = _request(app, "POST", f"/api/systems/{ctx['bus']}/links", headers={"If-Match": etag},
                            body={"a": {"instanceId": ctx["pwr"], "portKey": port, "exportId": "x"},
                                  "b": {"instanceId": ctx["cndh"], "exportId": ctx["export"]}})
            created = _request(app, "POST", f"/api/systems/{ctx['bus']}/links", headers={"If-Match": etag},
                               body={"a": {"instanceId": ctx["pwr"], "portKey": port},
                                     "b": {"instanceId": ctx["cndh"], "exportId": ctx["export"]}})
        self.assertEqual(both.status, 422)
        self.assertEqual(created.status, 201, created.text)
        self.assertEqual(created.json["b"]["export"]["reference"], "J6")


if __name__ == "__main__":
    unittest.main()
