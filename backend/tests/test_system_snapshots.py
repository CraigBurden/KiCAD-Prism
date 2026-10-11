"""SYS-09: snapshots, the ICD (CSV and HTML) and snapshot diffs (contract §9)."""

from __future__ import annotations

import csv
import io
import unittest

from fastapi import FastAPI
from unittest import mock

from system_builder_db import FixtureSystemCase
from test_system_api import _request

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import icd
from app.services.systems import service as service_module
from app.services.systems.manifest_schema import Manifest, digests
from app.services.systems.jobs import extract_and_store
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Conflict, NotFound, StaleVersion
from app.services.systems.visibility import etag

DESIGNER = Caller(role="designer", email="designer@example.com")
VIEWER = Caller(role="viewer", email="viewer@example.com")


def rows_of(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


class SnapshotCase(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"})
        for board, project_id in (("mini_obc", "prj_obc"), ("mini_payload", "prj_pay"),
                                  ("mini_power", "prj_pwr")):
            extract_and_store(self.projects[project_id], self.commits[board]["F0"], self.connect)
        self.link_names = {v: k for k, v in self.links.items()}

    def snapshot(self, name: str = "CDR", note: str = "") -> dict:
        return self.service.create_snapshot(DESIGNER, self.sid, self.version(), name, note).body

    def hide_pay(self) -> None:
        self.conn.execute("INSERT INTO ws_folders (id, visibility_mode, allowed_roles)"
                          " VALUES ('fld_admins', 'roles', '[\"admin\"]')")
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pay'")
        self.conn.commit()

    def accept_f8(self) -> None:
        self.move_track("mini_obc", "F8")
        result = self.detector.check_instance(self.instances["OBC-A"])
        extract_and_store(self.projects["prj_obc"], self.commits["mini_obc"]["F8"], self.connect)
        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == result.review_id]
        self.service.decide(DESIGNER, self.sid, self.version(), review["id"], review["items"][0]["id"],
                            "accept", None)


class SnapshotTest(SnapshotCase):
    def test_snapshot_freezes_the_document_without_bumping_the_version(self) -> None:
        before = self.version()
        meta = self.snapshot("CDR", "critical design review")
        self.assertEqual(self.version(), before)
        self.assertTrue(meta["id"].startswith("ssn_"))
        self.assertEqual((meta["name"], meta["note"], meta["openReviewCount"], meta["rendererVersion"]),
                         ("CDR", "critical design review", 0, icd.RENDERER_VERSION))
        stored = self.store.get_snapshot(self.sid, meta["id"])
        self.assertEqual(meta["digest"], digests(Manifest.model_validate(stored["manifest"]))["full"])
        [event] = self.events("snapshot_created")
        self.assertEqual(event["payload"], {"snapshotId": meta["id"], "name": "CDR", "digest": meta["digest"]})
        self.assertEqual([s["id"] for s in self.service.list_snapshots(DESIGNER, self.sid)], [meta["id"]])
        # SB2-116: the listing says what the snapshot froze, for the publish dialog.
        listed = self.service.list_snapshots(DESIGNER, self.sid)[0]
        frozen = stored["document"]
        self.assertEqual((listed["findingCounts"], listed["exportCount"]),
                         ({"error": frozen["findingCounts"]["error"], "warning": frozen["findingCounts"]["warning"]},
                          len(frozen.get("exports") or [])))

        read = self.service.get_snapshot(DESIGNER, self.sid, meta["id"])
        live = self.service.document(DESIGNER, self.sid).body
        self.assertEqual(read["document"]["links"], live["links"])
        self.assertEqual(read["document"]["instances"], live["instances"])
        self.assertIn("validation", read["document"])

    def test_snapshot_rejects_stale_versions_and_duplicate_names(self) -> None:
        version = self.version()
        with self.assertRaises(StaleVersion):
            self.service.create_snapshot(DESIGNER, self.sid, version - 1, "CDR", "")
        self.snapshot("CDR")
        with self.assertRaises(Conflict):
            self.service.create_snapshot(DESIGNER, self.sid, version, " CDR ", "")
        with self.assertRaises(NotFound):
            self.service.get_snapshot(DESIGNER, self.sid, "ssn_missing")

    def test_csv_follows_the_export_contract(self) -> None:
        content, name, version = self.service.icd(DESIGNER, self.sid, "csv")
        self.assertEqual((name, version), ("Fixture", self.version()))
        self.assertTrue(content.startswith(",".join(icd.CSV_COLUMNS) + "\r\n"))
        records = rows_of(content)
        self.assertEqual(len(records), 18 + 4 + 2 + 1 + 1)
        self.assertEqual([r["link_name"] for r in records], sorted(r["link_name"] for r in records))
        j7 = [r for r in records if r["link_name"] == "L-J7J4"]
        self.assertEqual([r["a_pin"] for r in j7], [str(n) for n in range(1, 19)])
        self.assertEqual({r["status"] for r in records}, {"ok"})
        self.assertEqual({(r["a_board"], r["a_connector"], r["b_board"], r["b_connector"]) for r in j7},
                         {("OBC-A", "J7", "PAY", "J4")})
        self.assertEqual({r["a_commit"] for r in j7}, {self.commits["mini_obc"]["F0"]})
        pin18 = next(r for r in j7 if r["a_pin"] == "18")
        self.assertEqual(pin18["a_net"], "PAYLOAD_IRQ#")

    def test_open_review_marks_rows_and_bans_the_html(self) -> None:
        frozen = self.snapshot("before")
        self.move_track("mini_obc", "F1")
        self.detector.check_instance(self.instances["OBC-A"])
        live = rows_of(self.service.icd(DESIGNER, self.sid, "csv")[0])
        flagged = [(r["link_name"], r["a_pin"]) for r in live if r["status"] == "review"]
        self.assertEqual(flagged, [("L-J7J4", "17")])
        html = self.service.icd(DESIGNER, self.sid, "html")[0]
        self.assertEqual(html.count("This document contains 1 unreviewed change."), 2)
        self.assertIn("Live · generated", html)

        old_csv, _, version = self.service.icd(DESIGNER, self.sid, "csv", frozen["id"])
        self.assertIsNone(version)
        self.assertEqual({r["status"] for r in rows_of(old_csv)}, {"ok"})
        old_html = self.service.icd(DESIGNER, self.sid, "html", frozen["id"])[0]
        self.assertNotIn("unreviewed", old_html)
        self.assertIn("Snapshot before · generated", old_html)
        self.assertEqual(self.snapshot("with-review")["openReviewCount"], 1)

    def test_html_escapes_system_owned_text(self) -> None:
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            self.store.update_link(change, self.links["L-J7J4"], name="<script>alert(1)</script>")
        self.conn.commit()
        html = self.service.icd(DESIGNER, self.sid, "html")[0]
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)

    def test_diff_against_live_and_between_snapshots(self) -> None:
        first = self.snapshot("F0")
        self.accept_f8()
        diff = self.service.diff_snapshot(DESIGNER, self.sid, first["id"], "live")
        self.assertEqual([(b["label"], b["status"]) for b in diff["boards"]], [("OBC-A", "rebased")])
        self.assertEqual(diff["boards"][0]["after"], self.commits["mini_obc"]["F8"])
        [link] = diff["links"]
        self.assertEqual((link["name"], link["status"]), ("L-J7J4", "changed"))
        [changed] = link["rows"]["changed"]
        self.assertEqual((changed["before"]["pinA"], changed["before"]["netA"], changed["after"]["netA"]),
                         ("18", ["PAYLOAD_IRQ#"], ["PAYLOAD_INT#"]))
        second = self.snapshot("F8")
        self.assertEqual(self.service.diff_snapshot(DESIGNER, self.sid, first["id"], second["id"]),
                         {**diff, "against": second["id"]})
        self.assertEqual(self.service.diff_snapshot(DESIGNER, self.sid, second["id"], "live"),
                         {"snapshotId": second["id"], "against": "live", "boards": [], "links": []})
        with self.assertRaises(NotFound):
            self.service.diff_snapshot(DESIGNER, self.sid, first["id"], "ssn_missing")

    def test_restricted_boards_are_redacted_on_read(self) -> None:
        frozen = self.snapshot()
        self.hide_pay()
        stored = self.store.get_snapshot(self.sid, frozen["id"])["document"]
        self.assertIn(self.commits["mini_payload"]["F0"], str(stored))  # stored unredacted

        document = self.service.get_snapshot(VIEWER, self.sid, frozen["id"])["document"]
        pay = next(i for i in document["instances"] if i["label"] == "PAY")
        self.assertEqual((pay["restricted"], pay["projectId"], pay["baselineCommit"]), (True, None, None))
        self.assertNotIn(self.commits["mini_payload"]["F0"], str(document))
        for text in (self.service.icd(VIEWER, self.sid, fmt, frozen["id"])[0] for fmt in ("csv", "html")):
            self.assertNotIn(self.commits["mini_payload"]["F0"], text)
            self.assertNotIn("mini_payload", text)
        j7 = [r for r in rows_of(self.service.icd(VIEWER, self.sid, "csv")[0]) if r["link_name"] == "L-J7J4"]
        self.assertEqual({(r["b_connector"], r["b_pin"], r["b_net"], r["b_commit"]) for r in j7}, {("", "", "", "")})
        diff = self.service.diff_snapshot(VIEWER, self.sid, frozen["id"], "live")
        self.assertEqual(diff["boards"], [])
        admin = self.service.get_snapshot(Caller(role="admin", email="a@x"), self.sid, frozen["id"])
        self.assertEqual(admin["document"], stored)


class SnapshotApiTest(SnapshotCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch.object(service_module, "service", self.service)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.app = FastAPI()
        install_error_handlers(self.app)
        self.app.include_router(systems_api.router, prefix="/api/systems")

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, f"/api/systems/{self.sid}{path}", **kwargs)

    def test_routes_are_exposed(self) -> None:
        paths = set(self.app.openapi()["paths"])
        for path in ("/snapshots", "/snapshots/{snapshot_id}", "/snapshots/{snapshot_id}/diff",
                     "/icd.{fmt}", "/snapshots/{snapshot_id}/icd.{fmt}"):
            self.assertIn("/api/systems/{system_id}" + path, paths)

    def test_create_needs_designer_and_if_match(self) -> None:
        current = etag(self.sid, self.version())
        self.assertEqual(self.call("POST", "/snapshots", body={"name": "CDR"}).status, 428)
        self.assertEqual(self.call("POST", "/snapshots", body={"name": "CDR"}, headers={"If-Match": current},
                                   user="viewer").status, 403)
        created = self.call("POST", "/snapshots", body={"name": "CDR"}, headers={"If-Match": current})
        self.assertEqual((created.status, created.headers["etag"]), (201, current))
        again = self.call("POST", "/snapshots", body={"name": "CDR"}, headers={"If-Match": current})
        self.assertEqual(again.status, 409)
        listed = self.call("GET", "/snapshots", user="viewer")
        self.assertEqual([s["name"] for s in listed.json], ["CDR"])
        read = self.call("GET", f"/snapshots/{created.json['id']}", user="viewer")
        self.assertEqual(read.json["digest"], created.json["digest"])
        self.assertEqual(self.call("GET", "/snapshots/ssn_missing").status, 404)

    def test_icd_downloads(self) -> None:
        live_csv = self.call("GET", "/icd.csv", user="viewer")
        self.assertEqual(live_csv.status, 200)
        self.assertTrue(live_csv.headers["content-type"].startswith("text/csv"))
        self.assertEqual(live_csv.headers["content-disposition"], 'attachment; filename="Fixture-live-icd.csv"')
        self.assertEqual(live_csv.headers["etag"], etag(self.sid, self.version()))
        live_html = self.call("GET", "/icd.html", user="viewer")
        self.assertTrue(live_html.headers["content-type"].startswith("text/html"))
        self.assertIn("default-src 'none'", live_html.headers["content-security-policy"])
        self.assertEqual(live_html.headers["x-content-type-options"], "nosniff")
        self.assertIn("<h1>Fixture</h1>", live_html.text)
        self.assertEqual(self.call("GET", "/icd.pdf").status, 422)

        current = etag(self.sid, self.version())
        snap = self.call("POST", "/snapshots", body={"name": "CDR"}, headers={"If-Match": current}).json
        frozen = self.call("GET", f"/snapshots/{snap['id']}/icd.csv")
        self.assertEqual(frozen.text, live_csv.text)
        self.assertNotIn("etag", frozen.headers)
        diff = self.call("GET", f"/snapshots/{snap['id']}/diff?against=live")
        self.assertEqual((diff.json["boards"], diff.json["links"]), ([], []))
        self.assertEqual(self.call("GET", f"/snapshots/{snap['id']}/diff?against=ssn_missing").status, 404)


if __name__ == "__main__":
    unittest.main()
