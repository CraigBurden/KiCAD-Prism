"""SB2-03: exports (CONTRACTS_P2 §4): rules, interface, SYS-V16, refresh on advance, redaction, manifest."""

from __future__ import annotations

import copy
import unittest

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_snapshots import DESIGNER, VIEWER, SnapshotCase

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import exports as exports_module
from app.services.systems import manifest as manifest_io
from app.services.systems import service as service_module
from app.services.systems.manifest_schema import digests
from app.services.systems.store import Conflict, Invalid, NotFound


class ExportCase(SnapshotCase):
    def port_key(self, label: str, reference: str) -> str:
        instance = self.store.get_instance(self.sid, self.instances[label])
        interface = self.store.get_interface(instance["project_id"], instance["baseline_commit"],
                                             service_module.EXTRACTOR_VERSION)
        return next(c["portKey"] for c in interface["components"] if c["reference"] == reference)

    def export(self, name: str = "DEBUG", label: str = "OBC-A", reference: str = "J6") -> dict:
        return self.service.create_export(
            DESIGNER, self.sid, self.version(), name=name, description="debug header",
            instance_id=self.instances[label], port_key=self.port_key(label, reference), child_export_id=None,
        ).body

    def document(self, caller=DESIGNER) -> dict:
        return self.service.document(caller, self.sid).body


class ExportTest(ExportCase):
    def delete_link(self, name: str) -> None:
        self.service.delete_link(DESIGNER, self.sid, self.version(), self.links[name])

    def test_an_export_resolves_and_publishes_its_pins(self) -> None:
        created = self.export()
        self.assertEqual((created["name"], created["resolved"], created["port"]["reference"]), ("DEBUG", True, "J6"))
        [listed] = self.document()["exports"]
        self.assertEqual(listed["id"], created["id"])
        self.assertEqual([e["kind"] for e in self.events("export_created")], ["export_created"])
        interface = self.service.export_interface(DESIGNER, self.sid)
        [entry] = interface["exports"]
        self.assertEqual((entry["reference"], entry["pinCount"], entry["resolved"]), ("J6", 4, True))
        self.assertEqual(entry["occurrence"], "/" + self.instances["OBC-A"])
        self.assertEqual([p["pad"] for p in entry["pins"]], ["1", "2", "3", "4"])
        self.assertTrue(all(isinstance(p["nets"], list) for p in entry["pins"]))
        self.assertEqual(self.service.validation_report(DESIGNER, self.sid).body["counts"]["error"], 0)

    def test_rules(self) -> None:
        self.export()
        with self.assertRaisesRegex(Conflict, "export_port_linked"):
            self.export("BUS", "OBC-A", "J7")  # an end of L-J7J4
        with self.assertRaisesRegex(Conflict, "already exists"):
            self.export("debug", "OBC-B", "J5")
        with self.assertRaisesRegex(Conflict, "already exported"):
            self.export("DEBUG2", "OBC-A", "J6")
        with self.assertRaisesRegex(Invalid, "re-export needs an assembly"):
            self.service.create_export(DESIGNER, self.sid, self.version(), name="RE", description="",
                                       instance_id=self.instances["OBC-B"], port_key=None,
                                       child_export_id="sxp_" + "1" * 32)
        key = self.port_key("OBC-B", "J5")
        self.service.set_override(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], key, "hidden")
        with self.assertRaisesRegex(Conflict, "port_not_exposed"):
            self.export("PWR", "OBC-B", "J5")
        # Linking an exported port is refused the other way round too.
        other = self.port_key("OBC-B", "J6")
        with self.assertRaisesRegex(Conflict, "export_port_linked"):
            self.service.create_link(DESIGNER, self.sid, self.version(),
                                     a={"instanceId": self.instances["OBC-A"], "portKey": self.port_key("OBC-A", "J6")},
                                     b={"instanceId": self.instances["OBC-B"], "portKey": other},
                                     name="x", harness=None)

    def test_a_batch_exports_several_ports_in_one_version_or_none(self) -> None:
        item = lambda name, label, ref: {"name": name, "instanceId": self.instances[label],  # noqa: E731
                                         "portKey": self.port_key(label, ref)}
        before = self.version()
        refused = [item("DEBUG", "OBC-A", "J6"), item("BUS", "OBC-A", "J7")]  # J7 is an end of L-J7J4
        with self.assertRaisesRegex(Conflict, "^BUS: export_port_linked"):
            self.service.create_exports(DESIGNER, self.sid, before, refused)
        self.assertEqual((self.document()["exports"], self.version()), ([], before))
        result = self.service.create_exports(DESIGNER, self.sid, before, [item("DEBUG", "OBC-A", "J6"),
                                                                          item("PWR", "OBC-B", "J5")])
        self.assertEqual([e["name"] for e in result.body["exports"]], ["DEBUG", "PWR"])
        self.assertEqual(self.version(), before + 1)
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        with mock.patch.object(service_module, "service", self.service):
            etag = self.service.document(DESIGNER, self.sid).etag
            empty = _request(app, "POST", f"/api/systems/{self.sid}/exports/batch", headers={"If-Match": etag},
                             body={"exports": []})
            created = _request(app, "POST", f"/api/systems/{self.sid}/exports/batch", headers={"If-Match": etag},
                               body={"exports": [item("SWD", "OBC-B", "J6")]})
        self.assertEqual(empty.status, 422)
        self.assertEqual((created.status, [e["name"] for e in created.json["exports"]]), (201, ["SWD"]), created.text)

    def test_rename_retarget_and_delete_keep_the_id_and_audit(self) -> None:
        created = self.export()
        renamed = self.service.update_export(DESIGNER, self.sid, self.version(), created["id"],
                                             {"name": "SWD", "description": "swd"}).body
        self.assertEqual((renamed["id"], renamed["name"]), (created["id"], "SWD"))
        moved = self.service.update_export(DESIGNER, self.sid, self.version(), created["id"],
                                           {"instanceId": self.instances["OBC-B"],
                                            "portKey": self.port_key("OBC-B", "J5")}).body
        self.assertEqual((moved["id"], moved["instanceId"], moved["port"]["reference"]),
                         (created["id"], self.instances["OBC-B"], "J5"))
        self.service.delete_export(DESIGNER, self.sid, self.version(), created["id"])
        self.assertEqual(self.document()["exports"], [])
        self.conn.commit()
        self.assertEqual([e["kind"] for e in reversed(self.store.history(self.sid, limit=500))
                          if e["kind"].startswith("export_")],
                         ["export_created", "export_updated", "export_retargeted", "export_deleted"])

    def test_removing_a_board_with_exports_needs_cascade(self) -> None:
        self.export("DBG", "OBC-B", "J5")
        self.delete_link("L-OBCB-TP1")  # OBC-B's only link, so the export is what blocks removal
        with self.assertRaisesRegex(Conflict, "carries exports"):
            self.service.remove_instance(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], cascade=False)
        self.service.remove_instance(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], cascade=True)
        self.assertEqual(self.document()["exports"], [])
        self.assertEqual(len(self.events("export_deleted")), 1)

    def test_an_export_that_stops_resolving_is_sys_v16(self) -> None:
        created = self.export()
        self.service.set_override(DESIGNER, self.sid, self.version(), self.instances["OBC-A"],
                                  created["portKey"], "hidden")
        findings = self.service.validation_report(DESIGNER, self.sid).body["findings"]
        [v16] = [f for f in findings if f["rule"] == "SYS-V16"]
        self.assertEqual((v16["severity"], v16["detail"]["reason"], v16["detail"]["exportId"]),
                         ("error", "port_not_exposed", created["id"]))
        [entry] = self.service.export_interface(DESIGNER, self.sid)["exports"]
        self.assertEqual((entry["resolved"], entry["pins"]), (False, []))

    def test_advancing_a_baseline_refreshes_a_relabelled_export(self) -> None:
        created = self.export()
        instance = self.store.get_instance(self.sid, self.instances["OBC-A"])
        candidate = copy.deepcopy(self.store.get_interface(instance["project_id"], instance["baseline_commit"],
                                                           service_module.EXTRACTOR_VERSION))
        for component in candidate["components"]:
            if component["portKey"] == created["portKey"]:
                component["reference"] = "J60"
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            exports_module.refresh_after_advance(self.store, change, self.instances["OBC-A"], candidate)
        self.conn.commit()
        self.assertEqual(self.store.get_export(self.sid, created["id"])["target_port"]["reference"], "J60")
        [event] = self.events("connector_relabelled")
        self.assertEqual(event["payload"]["exportId"], created["id"])

    def test_restricted_boards_redact_their_exports(self) -> None:
        self.export("PAYDBG", "OBC-A", "J6")
        self.conn.execute("INSERT INTO ws_folders (id, visibility_mode, allowed_roles)"
                          " VALUES ('fld_admins', 'roles', '[\"admin\"]')")
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_obc'")
        self.conn.commit()
        [export] = self.document(VIEWER)["exports"]
        self.assertEqual((export["name"], export["redacted"], export["port"]), ("PAYDBG", True, None))
        [entry] = self.service.export_interface(VIEWER, self.sid)["exports"]
        self.assertTrue(entry["redacted"])
        self.assertTrue(all(p["nets"] is None for p in entry["pins"]))
        with self.assertRaises(NotFound):
            self.service.delete_export(VIEWER, self.sid, self.version(), export["id"])

    def test_snapshot_interface_matches_live_and_manifest_round_trips(self) -> None:
        self.export()
        meta = self.snapshot("CDR")
        live = self.service.export_interface(DESIGNER, self.sid)
        frozen = self.service.export_interface(DESIGNER, self.sid, meta["id"])
        self.assertEqual(frozen, live)

        before = manifest_io.build(self.store, self.sid, created_by="t", created_at="2026-09-30T00:00:00Z")
        self.assertEqual([e.name for e in before.exports], ["DEBUG"])
        self.store.delete_system(self.sid)
        self.conn.commit()
        manifest_io.import_manifest(self.store, before, actor="user:t")
        self.conn.commit()
        after = manifest_io.build(self.store, self.sid, created_by="t", created_at="2026-09-30T00:00:00Z")
        self.assertEqual(digests(after), digests(before))

    def test_api(self) -> None:
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        with mock.patch.object(service_module, "service", self.service):
            etag = self.service.document(DESIGNER, self.sid).etag
            both = _request(app, "POST", f"/api/systems/{self.sid}/exports", headers={"If-Match": etag},
                            body={"name": "X", "instanceId": self.instances["OBC-A"], "portKey": "p",
                                  "childExportId": "c"})
            created = _request(app, "POST", f"/api/systems/{self.sid}/exports", headers={"If-Match": etag},
                               body={"name": "DBG", "instanceId": self.instances["OBC-A"],
                                     "portKey": self.port_key("OBC-A", "J6")})
            listed = _request(app, "GET", f"/api/systems/{self.sid}/exports", user="viewer")
            interface = _request(app, "GET", f"/api/systems/{self.sid}/export-interface", user="viewer")
            viewer_post = _request(app, "POST", f"/api/systems/{self.sid}/exports", user="viewer",
                                   headers={"If-Match": created.headers["etag"]}, body={"name": "Y",
                                   "instanceId": self.instances["OBC-B"], "portKey": "p"})
        self.assertEqual(both.status, 422)
        self.assertEqual(created.status, 201, created.text)
        self.assertEqual([e["name"] for e in listed.json], ["DBG"])
        self.assertEqual(interface.json["schema"], "prism.system_export_interface.v1")
        self.assertEqual(viewer_post.status, 403)


if __name__ == "__main__":
    unittest.main()
