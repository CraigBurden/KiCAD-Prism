"""The ICD routes (docs/system-builder/CONTRACTS.md §17).

The index, a download's type and disposition, unknown names, the building
refusal, and a restricted board's name and pins being absent.
"""

from __future__ import annotations

import csv
import io
import unittest
from unittest import mock

from fastapi import FastAPI

from app.api import systems as systems_api
from app.core.errors import install_error_handlers
from app.system_builder import redaction
from app.system_builder import service as service_module
from app.system_builder.service import Caller, SystemService
from app.system_builder.settings import limits
from support import icd_fixture as fixture
from support.asgi import request as _request

SYSTEM = "sys_icd"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


def _record(system_id: str = SYSTEM) -> dict:
    return {
        "system_id": system_id,
        "name": fixture.SYSTEM,
        "version": fixture.VERSION,
        "document": fixture.document(),
    }


class _Store:
    """One stored system, read by id."""

    def __init__(self, record: dict) -> None:
        self.record = record

    def read(self, system_id: str, *, role: str):
        return self.record if system_id == self.record["system_id"] else None


class _Service(SystemService):
    """The real reads, with the bundle answer stubbed and redacted per caller."""

    def __init__(self, record: dict, answer: dict) -> None:
        super().__init__(_Store(record), limits)
        self.record = record
        self.answer = answer

    def bundle(self, system_id: str, caller: Caller, *, role: str) -> dict:
        hidden = redaction.hidden_occurrences(self.record["document"], caller.can_see_project)
        answer = dict(self.answer)
        if "bundle" in answer:
            answer["bundle"] = redaction.redact_bundle(
                answer["bundle"], hidden, document=self.record["document"]
            )
        return answer


def _caller(user) -> Caller:
    # The designer sees everything; the viewer cannot see Gamma's board.
    return Caller(
        email=user.email,
        name=user.name,
        role=user.role,
        can_see_project=lambda project_id: (
            user.role != "viewer" or project_id != fixture.HIDDEN_PROJECT
        ),
    )


class IcdApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.record = _record()
        self.service = _Service(
            self.record,
            {
                "state": "ready",
                "key": fixture.BUNDLE_KEY,
                "pending": [],
                "documentVersion": fixture.VERSION,
                "bundle": fixture.bundle(),
            },
        )
        self.app = _app()
        self.enterContext(mock.patch.object(systems_api, "service", self.service))
        self.enterContext(mock.patch.object(systems_api, "_caller", _caller))
        self.enterContext(mock.patch.object(
            service_module.workspace, "get_project_for_role", fixture.project_for_role,
        ))

    def call(self, path: str, *, user: str = "viewer"):
        return _request(self.app, "GET", path, user=user)

    def test_the_index_lists_every_file_and_the_sheet_count(self) -> None:
        response = self.call(f"/api/systems/{SYSTEM}/icd")
        self.assertEqual(response.status, 200, response.text)
        body = response.json
        self.assertEqual(body["state"], "ready")
        self.assertGreaterEqual(body["sheets"], 1)
        names = [item["name"] for item in body["files"]]
        self.assertEqual(names[0], "icd.pdf")
        self.assertEqual(names[1], "sheet-1.svg")
        self.assertEqual(names[-2:], ["icd.html", "icd.csv"])
        self.assertEqual(sum(name.endswith(".svg") for name in names), body["sheets"])
        types = {item["name"]: item["contentType"] for item in body["files"]}
        self.assertEqual(types["icd.pdf"], "application/pdf")
        self.assertEqual(types["sheet-1.svg"], "image/svg+xml")
        self.assertEqual(types["icd.html"], "text/html")
        self.assertEqual(types["icd.csv"], "text/csv")

    def test_a_download_has_its_type_and_attachment_name(self) -> None:
        response = self.call(f"/api/systems/{SYSTEM}/icd/icd.csv")
        self.assertEqual(response.status, 200, response.text)
        self.assertTrue(response.headers["content-type"].startswith("text/csv"))
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="fixture-rig-icd.csv"',
        )
        self.assertTrue(response.text.startswith("group,kind,a_occurrence"))

        pdf = self.call(f"/api/systems/{SYSTEM}/icd/icd.pdf")
        self.assertEqual(pdf.status, 200, pdf.text)
        self.assertEqual(pdf.headers["content-type"], "application/pdf")
        self.assertEqual(
            pdf.headers["content-disposition"],
            'attachment; filename="fixture-rig-icd.pdf"',
        )
        self.assertTrue(pdf.text.startswith("%PDF"))

    def test_an_unknown_system_or_file_is_404(self) -> None:
        unknown = self.call("/api/systems/sys_nope/icd")
        self.assertEqual(unknown.status, 404, unknown.text)
        self.assertEqual(unknown.json["code"], "system_not_found")

        name = self.call(f"/api/systems/{SYSTEM}/icd/icd.txt")
        self.assertEqual(name.status, 404, name.text)
        self.assertEqual(name.json["code"], "icd_output_not_found")

        sheet = self.call(f"/api/systems/{SYSTEM}/icd/sheet-99.svg")
        self.assertEqual(sheet.status, 404, sheet.text)
        self.assertEqual(sheet.json["code"], "icd_output_not_found")

    def test_a_building_bundle_says_so_in_the_index_and_refuses_a_file(self) -> None:
        building = _Service(
            self.record,
            {
                "state": "building", "key": "b" * 64, "pending": [],
                "documentVersion": fixture.VERSION,
            },
        )
        with mock.patch.object(systems_api, "service", building):
            index = self.call(f"/api/systems/{SYSTEM}/icd")
            self.assertEqual(index.status, 200, index.text)
            self.assertEqual(index.json, {"state": "building", "files": [], "sheets": 0})

            file = self.call(f"/api/systems/{SYSTEM}/icd/icd.pdf")
            self.assertEqual(file.status, 409, file.text)
            self.assertEqual(file.json["code"], "icd_outputs_building")

    def test_a_caller_who_cannot_see_a_board_gets_no_name_or_pins_from_it(self) -> None:
        designer = self.call(f"/api/systems/{SYSTEM}/icd/icd.html", user="designer")
        self.assertEqual(designer.status, 200, designer.text)
        self.assertIn("Gamma Board", designer.text)
        self.assertIn("SECRET", designer.text)

        viewer = self.call(f"/api/systems/{SYSTEM}/icd/icd.csv", user="viewer")
        self.assertEqual(viewer.status, 200, viewer.text)
        self.assertNotIn("Gamma Board", viewer.text)
        self.assertNotIn("SECRET", viewer.text)
        self.assertNotIn("Gamma", viewer.text)
        rows = list(csv.reader(io.StringIO(viewer.text)))
        self.assertLess(len(rows) - 1, len(fixture.model().connections))

        html = self.call(f"/api/systems/{SYSTEM}/icd/icd.html", user="viewer")
        self.assertEqual(html.status, 200, html.text)
        self.assertNotIn("Gamma Board", html.text)
        self.assertNotIn("SECRET", html.text)
        self.assertIn("Gamma", html.text)
        self.assertIn("restricted", html.text)


if __name__ == "__main__":
    unittest.main()
