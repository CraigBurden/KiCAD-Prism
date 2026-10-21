"""The harness output routes (docs/system-builder/CONTRACTS.md §16.7).

The index, a download's type and disposition, unknown harness and file names,
the building refusal, and a restricted board's outputs.
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
from app.system_builder.document import new_document
from app.system_builder.harness_outputs import catalog as harness_catalog
from app.system_builder.service import Caller, SystemService
from app.system_builder.settings import limits
from support.asgi import request as _request
from support import harness_outputs_fixture as fixture

SYSTEM = "sys_outputs"
HIDDEN = fixture.HIDDEN_PROJECT


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


def _record(system_id: str = SYSTEM) -> dict:
    document = new_document("Demo rig")
    document["occurrences"] = list(fixture.OCCURRENCES)
    document["harnesses"] = fixture.document()["harnesses"]
    return {
        "system_id": system_id,
        "name": "Demo rig",
        "version": fixture.VERSION,
        "document": document,
    }


def _bundle() -> dict:
    bundle = fixture.bundle()
    bundle.update({"mates": [], "links": [], "suggestions": [], "findings": []})
    return bundle


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
    # The designer sees everything; the viewer cannot see the Sensor's board.
    return Caller(
        email=user.email,
        name=user.name,
        role=user.role,
        can_see_project=lambda project_id: user.role != "viewer" or project_id != HIDDEN,
    )


class HarnessOutputApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.record = _record()
        self.service = _Service(
            self.record,
            {
                "state": "ready",
                "key": fixture.BUNDLE_KEY,
                "pending": [],
                "documentVersion": fixture.VERSION,
                "bundle": _bundle(),
            },
        )
        self.app = _app()
        self.enterContext(mock.patch.object(systems_api, "service", self.service))
        self.enterContext(mock.patch.object(systems_api, "_caller", _caller))
        self.enterContext(mock.patch.object(harness_catalog, "lookup", fixture.lookup))

    def call(self, path: str, *, user: str = "viewer"):
        return _request(self.app, "GET", path, user=user)

    def test_the_index_lists_every_file_and_the_sheet_count(self) -> None:
        response = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs")
        self.assertEqual(response.status, 200, response.text)
        body = response.json
        self.assertEqual(body["state"], "ready")
        self.assertGreaterEqual(body["sheets"], 2)
        names = [item["name"] for item in body["files"]]
        self.assertEqual(names[0], "harness.pdf")
        self.assertEqual(names[1], "sheet-1.svg")
        self.assertEqual(names[-3:], ["wiring.csv", "bom.csv", "harness.yaml"])
        self.assertEqual(sum(name.endswith(".svg") for name in names), body["sheets"])
        for item in body["files"]:
            self.assertEqual(set(item), {"name", "title", "contentType"})
        types = {item["name"]: item["contentType"] for item in body["files"]}
        self.assertEqual(types["harness.pdf"], "application/pdf")
        self.assertEqual(types["sheet-1.svg"], "image/svg+xml")
        self.assertEqual(types["wiring.csv"], "text/csv")
        self.assertEqual(types["harness.yaml"], "application/yaml")

    def test_a_csv_download_has_its_type_and_attachment_name(self) -> None:
        response = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/wiring.csv")
        self.assertEqual(response.status, 200, response.text)
        self.assertTrue(response.headers["content-type"].startswith("text/csv"))
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="demo-rig-h1-wiring.csv"',
        )
        self.assertTrue(response.text.startswith("wire,from_end,from_cavity"))
        self.assertIn("W1", response.text)

    def test_an_unknown_harness_or_file_is_404(self) -> None:
        harness = self.call(f"/api/systems/{SYSTEM}/harnesses/har_nope/outputs")
        self.assertEqual(harness.status, 404, harness.text)
        self.assertEqual(harness.json["code"], "harness_not_found")

        name = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/harness.txt")
        self.assertEqual(name.status, 404, name.text)
        self.assertEqual(name.json["code"], "harness_output_not_found")

        sheet = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/sheet-99.svg")
        self.assertEqual(sheet.status, 404, sheet.text)
        self.assertEqual(sheet.json["code"], "harness_output_not_found")

    def test_a_building_bundle_says_so_in_the_index_and_refuses_a_file(self) -> None:
        building = _Service(
            self.record,
            {"state": "building", "key": "b" * 64, "pending": [], "documentVersion": fixture.VERSION},
        )
        with mock.patch.object(systems_api, "service", building):
            index = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs")
            self.assertEqual(index.status, 200, index.text)
            self.assertEqual(index.json, {"state": "building", "files": [], "sheets": 0})

            file = self.call(f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/harness.yaml")
            self.assertEqual(file.status, 409, file.text)
            self.assertEqual(file.json["code"], "harness_outputs_building")

    def test_a_caller_who_cannot_see_a_board_gets_no_pins_or_nets_from_it(self) -> None:
        designer = self.call(
            f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/wiring.csv", user="designer"
        )
        self.assertEqual(designer.status, 200, designer.text)
        self.assertIn("SECRET", designer.text)
        self.assertIn("J1 · Sensor", designer.text)

        viewer = self.call(
            f"/api/systems/{SYSTEM}/harnesses/{fixture.HARNESS}/outputs/wiring.csv", user="viewer"
        )
        self.assertEqual(viewer.status, 200, viewer.text)
        self.assertNotIn("SECRET", viewer.text)
        self.assertNotIn("/Private/SECRET", viewer.text)
        rows = list(csv.reader(io.StringIO(viewer.text)))
        header = rows[0]
        first = rows[1]
        self.assertEqual(first[header.index("to_end")], "J1 · Sensor")
        self.assertEqual(first[header.index("to_signal")], "")
        self.assertEqual(first[header.index("from_signal")], "VBAT")


if __name__ == "__main__":
    unittest.main()
