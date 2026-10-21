"""The STEP routes: state, start, download, redaction and readiness
(docs/system-builder/CONTRACTS.md §18)."""

from __future__ import annotations

import unittest
from unittest import mock

from fastapi import FastAPI

from app.api import systems as systems_api
from app.core.errors import install_error_handlers
from app.services.job_runtime import RetryableJobError
from app.system_builder.document import canonical, new_document
from support.asgi import request as _request
from support.postgres import requires_scratch_postgres, seed_folder
from test_system_bundle_job import occurrence
from test_system_step_job import PROJECT, StepWorkspace

SYSTEM = "sys_step_api"
HIDDEN_PROJECT = "prj_000000000022"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


class SystemStepApiTests(StepWorkspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        with self.scratch.connection() as conn:
            seed_folder(conn, "fld_hidden", visibility_mode="roles", allowed_roles=["designer"])
        self.commit = self.add_board(PROJECT, "r_step")
        self.hidden_commit = self.add_board(HIDDEN_PROJECT, "r_hidden", folder_id="fld_hidden")
        self.design = self.build_design_bundle(PROJECT)
        self.hidden_design = self.build_design_bundle(HIDDEN_PROJECT)
        self.enterContext(mock.patch.object(systems_api, "store", self.system_store))
        self.enterContext(mock.patch.object(systems_api, "service", self.service))
        self.app = _app()

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, path, **kwargs)

    def _one_board(self, system_id: str) -> str:
        document = new_document("Flight stack")
        document["occurrences"] = [occurrence("occ_board", "Main board", PROJECT, self.commit)]
        self.system_store.create(
            system_id, canonical(document), folder_id=None,
            created_by="owner@example.com", role="admin",
        )
        answer = self.service.bundle(system_id, self.caller(), role="viewer")
        self.run_system_job(self.queued_job("system_bundle"))
        return str(answer["key"])

    def caller(self):
        from app.system_builder.service import Caller

        return Caller(email="owner@example.com", can_see_project=lambda project_id: True)

    def test_none_then_build_then_download(self) -> None:
        self._one_board(SYSTEM)

        none = self.call("GET", f"/api/systems/{SYSTEM}/step", user="viewer")
        self.assertEqual(none.status, 200, none.text)
        self.assertEqual(none.json, {"state": "none", "boards": [], "missing": []})

        started = self.call("POST", f"/api/systems/{SYSTEM}/step", user="viewer")
        self.assertEqual(started.status, 202, started.text)
        self.assertEqual(started.json["state"], "building")

        blocked = self.call("GET", f"/api/systems/{SYSTEM}/step/file", user="viewer")
        self.assertEqual(blocked.status, 409, blocked.text)
        self.assertEqual(blocked.json["code"], "system_step_not_ready")

        step_job = self.queued_job("system_step")
        with self.assertRaises(RetryableJobError):
            self.run_step_job(step_job)
        building = self.call("GET", f"/api/systems/{SYSTEM}/step", user="viewer")
        self.assertEqual(building.status, 200, building.text)
        self.assertEqual(building.json["state"], "building")
        self.assertEqual(building.json["boards"][0]["state"], "building")

        self.run_board_job(self.queued_job("system_board_step"))
        self.run_step_job(step_job)

        ready = self.call("GET", f"/api/systems/{SYSTEM}/step", user="viewer")
        self.assertEqual(ready.status, 200, ready.text)
        self.assertEqual(ready.json["state"], "ready")
        self.assertGreater(ready.json["sizeBytes"], 0)
        self.assertEqual(ready.json["boards"][0]["state"], "ready")

        download = self.call("GET", f"/api/systems/{SYSTEM}/step/file", user="viewer")
        self.assertEqual(download.status, 200, download.text)
        self.assertTrue(download.headers["content-type"].startswith("model/step"))
        self.assertEqual(
            download.headers["content-disposition"],
            'attachment; filename="flight-stack.step"',
        )
        self.assertTrue(download.text.startswith("ISO-10303-21;"))

    def test_a_caller_who_cannot_see_a_board_is_refused(self) -> None:
        document = new_document("Mixed")
        document["occurrences"] = [
            occurrence("occ_visible", "Visible", PROJECT, self.commit),
            occurrence("occ_hidden", "Hidden", HIDDEN_PROJECT, self.hidden_commit),
        ]
        self.system_store.create(
            SYSTEM, canonical(document), folder_id=None,
            created_by="owner@example.com", role="admin",
        )
        for method, path in (
            ("GET", f"/api/systems/{SYSTEM}/step"),
            ("POST", f"/api/systems/{SYSTEM}/step"),
            ("GET", f"/api/systems/{SYSTEM}/step/file"),
        ):
            response = self.call(method, path, user="viewer")
            self.assertEqual(response.status, 403, response.text)
            self.assertEqual(response.json["code"], "system_redacted")

    def test_a_post_while_the_bundle_builds_is_409(self) -> None:
        document = new_document("Flight stack")
        document["occurrences"] = [occurrence("occ_board", "Main board", PROJECT, self.commit)]
        self.system_store.create(
            SYSTEM, canonical(document), folder_id=None,
            created_by="owner@example.com", role="admin",
        )
        response = self.call("POST", f"/api/systems/{SYSTEM}/step", user="viewer")
        self.assertEqual(response.status, 409, response.text)
        self.assertEqual(response.json["code"], "system_bundle_building")


if __name__ == "__main__":
    unittest.main()
