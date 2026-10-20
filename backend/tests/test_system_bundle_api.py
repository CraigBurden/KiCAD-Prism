"""The system bundle route: build state, ETag, redaction and visibility
(docs/system-builder/CONTRACTS.md §5, §6, §8)."""

from __future__ import annotations

import copy
import unittest
from unittest import mock

from fastapi import FastAPI

from app.api import systems as systems_api
from app.core.errors import install_error_handlers
from app.services.design_bundle import cli
from app.system_builder import bundle_store
from app.system_builder import members as member_view
from app.system_builder import parts as parts_module
from app.system_builder.document import canonical, new_document
from support.asgi import request as _request
from support.postgres import requires_scratch_postgres, seed_folder
from test_system_bundle_job import SystemBundleWorkspace, occurrence

SYSTEM = "sys_api"
VISIBLE = "prj_000000000011"
HIDDEN = "prj_000000000012"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


class SystemBundleApiTests(SystemBundleWorkspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        with self.scratch.connection() as conn:
            seed_folder(conn, "fld_hidden", visibility_mode="roles", allowed_roles=["designer"])
        self.visible_commit = self.add_board(VISIBLE, "r_visible")
        self.hidden_commit = self.add_board(HIDDEN, "r_hidden", folder_id="fld_hidden")
        self.visible_design = self.build_design_bundle(VISIBLE)
        self.hidden_design = self.build_design_bundle(HIDDEN)
        self.enterContext(mock.patch.object(systems_api, "store", self.system_store))
        self.enterContext(mock.patch.object(systems_api, "service", self.service))
        self.app = _app()

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, path, **kwargs)

    def test_the_route_answers_building_then_ready_with_the_system_etag(self) -> None:
        self.create_system(
            SYSTEM, [occurrence("occ_visible", "Visible", VISIBLE, self.visible_commit)]
        )

        first = self.call("GET", f"/api/systems/{SYSTEM}/bundle", user="viewer")
        self.assertEqual(first.status, 200, first.text)
        body = first.json
        self.assertEqual((body["state"], body["pending"], body["documentVersion"]), ("building", [], 1))
        self.assertEqual(len(body["key"]), 64)
        self.assertEqual(first.headers["etag"], f'"system:{SYSTEM}:1"')

        self.run_system_job(self.queued_job("system_bundle"))
        second = self.call("GET", f"/api/systems/{SYSTEM}/bundle", user="viewer")
        self.assertEqual(second.status, 200, second.text)
        body = second.json
        self.assertEqual((body["state"], body["pending"]), ("ready", []))
        self.assertEqual(body["bundle"]["schema"], "prism.system_bundle.a0")
        self.assertEqual(
            [item["state"] for item in body["bundle"]["occurrences"]], ["ready"]
        )
        self.assertEqual(second.headers["etag"], f'"system:{SYSTEM}:1"')

    def test_a_viewer_who_cannot_see_a_board_reads_the_bundle_redacted(self) -> None:
        document = new_document("Redacted reads")
        document["occurrences"] = [
            occurrence("occ_visible", "Visible", VISIBLE, self.visible_commit),
            occurrence("occ_hidden", "Hidden", HIDDEN, self.hidden_commit),
        ]
        document["mates"] = [
            {
                "id": "mate_x",
                "a": {"occurrence": "occ_visible", "connector": "J1"},
                "b": {"occurrence": "occ_hidden", "connector": "J1"},
                "orientation": {"quarterTurns": 0, "flip": False},
                "rows": {},
            }
        ]
        document["harnesses"] = [
            {
                "id": "har_h", "label": "H", "ends": [], "wires": [], "splices": [],
                "branchPoints": [], "segments": [], "coverings": [], "cables": [],
                "looseEnds": [], "markers": [], "waypoints": [],
                "links": [
                    {
                        "id": "link_x",
                        "a": {"occurrence": "occ_visible", "connector": "J2"},
                        "b": {"occurrence": "occ_hidden", "connector": "J1"},
                        "unmapped": [],
                    }
                ],
            }
        ]
        document = canonical(document)
        self.system_store.create(
            SYSTEM, document, folder_id=None, created_by="owner@example.com", role="admin",
        )

        resolved = member_view.resolve(document, requested_by="test")
        key = member_view.system_bundle_key(
            document, cli.generator().digest, resolved,
            parts=parts_module.digest({"schema": parts_module.SCHEMA, "parts": []}),
        )
        bundle = {
            "schema": "prism.system_bundle.a0",
            "documentSha256": member_view.document_sha256(document),
            "occurrences": [
                {"occurrence": "occ_visible", "state": "ready",
                 "revisionKey": self.visible_design["revision_key"],
                 "bundleKey": self.visible_design["bundle_key"], "connectors": []},
                {"occurrence": "occ_hidden", "state": "ready",
                 "revisionKey": self.hidden_design["revision_key"],
                 "bundleKey": self.hidden_design["bundle_key"], "connectors": []},
            ],
            "nets": [
                {
                    "id": "net-0123456789abcdef", "name": "VBAT", "names": ["VBAT"],
                    "boardNets": [
                        {"occurrence": "occ_visible", "net": "VBAT"},
                        {"occurrence": "occ_hidden", "net": "VBAT"},
                    ],
                    "pins": [
                        {"occurrence": "occ_visible", "connector": "J1", "pad": "1"},
                        {"occurrence": "occ_hidden", "connector": "J1", "pad": "1"},
                    ],
                },
                {
                    "id": "net-fedcba9876543210", "name": "SECRET", "names": ["SECRET"],
                    "boardNets": [{"occurrence": "occ_hidden", "net": "SECRET"}],
                    "pins": [{"occurrence": "occ_hidden", "connector": "J1", "pad": "2"}],
                },
            ],
            "mates": [
                {"mate": "mate_x", "source": "geometry", "pairs": [{"a": "1", "b": "1"}],
                 "unmappedA": [], "unmappedB": []}
            ],
            "links": [
                {"harness": "har_h", "link": "link_x",
                 "wires": [{"a": "1", "b": "1", "rule": "net-name", "suggested": False}],
                 "unmappedA": [], "unmappedB": []}
            ],
            "splices": [],
            "suggestions": [
                {"occurrence": "occ_visible", "connector": "J2", "key": "power", "name": "Power",
                 "source": "power", "pins": ["1", "2"]},
                {"occurrence": "occ_hidden", "connector": "J1", "key": "power", "name": "Power",
                 "source": "power", "pins": ["1", "2"]},
            ],
            "findings": [
                {"code": "connector-missing", "severity": "error", "subject": "connector:occ_hidden/J9",
                 "message": "J9 is missing", "objects": ["occ_hidden"], "waived": False}
            ],
        }
        bundle_store.write(SYSTEM, key, bundle)
        bundle_store.upsert(
            system_id=SYSTEM, bundle_key=key, state="complete", document_version=1
        )
        stored = copy.deepcopy(bundle)

        designer = self.call("GET", f"/api/systems/{SYSTEM}/bundle", user="designer")
        self.assertEqual(designer.status, 200, designer.text)
        self.assertEqual(designer.json["state"], "ready")
        self.assertEqual(len(designer.json["bundle"]["mates"][0]["pairs"]), 1)

        viewer = self.call("GET", f"/api/systems/{SYSTEM}/bundle", user="viewer")
        self.assertEqual(viewer.status, 200, viewer.text)
        redacted = viewer.json["bundle"]
        hidden = next(item for item in redacted["occurrences"] if item["occurrence"] == "occ_hidden")
        self.assertEqual(hidden, {"occurrence": "occ_hidden", "state": "redacted", "connectors": []})
        visible = next(item for item in redacted["occurrences"] if item["occurrence"] == "occ_visible")
        self.assertEqual(visible["bundleKey"], self.visible_design["bundle_key"])
        self.assertEqual([net["id"] for net in redacted["nets"]], ["net-0123456789abcdef"])
        self.assertEqual(
            [pin["occurrence"] for pin in redacted["nets"][0]["pins"]], ["occ_visible"]
        )
        self.assertEqual(redacted["mates"][0]["pairs"], [])
        self.assertEqual(redacted["links"][0]["wires"], [])
        self.assertEqual(
            [item["occurrence"] for item in redacted["suggestions"]], ["occ_visible"]
        )
        self.assertEqual(redacted["findings"][0]["message"], "Concerns a board you cannot see")
        self.assertEqual(redacted["findings"][0]["objects"], [])
        self.assertEqual(bundle_store.read(SYSTEM, key), stored)

    def test_an_invisible_system_is_404(self) -> None:
        self.system_store.create(
            "sys_hidden", new_document("Hidden"), folder_id="fld_hidden",
            created_by="owner@example.com", role="designer",
        )
        response = self.call("GET", "/api/systems/sys_hidden/bundle", user="viewer")
        self.assertEqual(response.status, 404, response.text)
        self.assertEqual(response.json["code"], "system_not_found")


if __name__ == "__main__":
    unittest.main()
