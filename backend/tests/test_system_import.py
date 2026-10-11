"""SYS-10: connection CSV import (contract §9.3) on the fixture system."""

from __future__ import annotations

import json
import unittest
from unittest import mock

from fastapi import FastAPI

from system_builder_db import FixtureSystemCase
from test_system_api import _request

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import csv_import, icd
from app.services.systems import service as service_module
from app.services.systems.jobs import extract_and_store
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Conflict, Invalid, NotFound, StaleVersion
from app.services.systems.visibility import etag

DESIGNER = Caller(role="designer", email="designer@example.com")
VIEWER = Caller(role="viewer", email="viewer@example.com")

PLAIN_HEADER = "from_board,from_connector,from_pin,to_board,to_connector,to_pin,signal,harness\n"
PLAIN_MAP = {t: t for t in ("from_board", "from_connector", "from_pin", "to_board", "to_connector", "to_pin",
                            "signal", "harness")}


class ImportCase(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = SystemService(connect=self.connect, project_loader=self.projects.get,
                                     enqueue=lambda *a, **k: {"job_id": "j", "status": "queued"})
        for board, project_id in (("mini_obc", "prj_obc"), ("mini_payload", "prj_pay"),
                                  ("mini_power", "prj_pwr")):
            extract_and_store(self.projects[project_id], self.commits[board]["F0"], self.connect)
        self.boards = {label: iid for label, iid in self.instances.items()}

    def upload(self, text: str, delimiter: str | None = None) -> dict:
        return self.service.upload_import(DESIGNER, self.sid, filename="wiring.csv", raw=text.encode(),
                                          delimiter=delimiter)

    def preview(self, import_id: str, column_map=PLAIN_MAP, board_map=None) -> dict:
        return self.service.preview_import(DESIGNER, self.sid, import_id, column_map,
                                           board_map if board_map is not None else self.boards, None).body

    def commit(self, import_id: str, column_map=PLAIN_MAP, board_map=None) -> dict:
        return self.service.commit_import(DESIGNER, self.sid, self.version(), import_id, column_map,
                                          board_map if board_map is not None else self.boards, None).body

    def link_rows(self, link_id: str) -> list[tuple]:
        self.conn.commit()
        return [(r["id"], r["pin_a"], r["pin_b"], r["signal"], r["source"])
                for r in self.store.get_link(self.sid, link_id)["rows"]]

    def delete_link(self, name: str) -> None:
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            self.store.delete_link(change, self.links[name])
        self.conn.commit()


class ParseTest(unittest.TestCase):
    def test_sniffs_delimiters_and_bom(self) -> None:
        parsed = csv_import.parse(csv_import.decode("﻿a;b;c\n1;2;3\n\n4;5\n".encode()))
        self.assertEqual((parsed.delimiter, parsed.columns), (";", ["a", "b", "c"]))
        self.assertEqual(parsed.rows, [(2, {"a": "1", "b": "2", "c": "3"}), (4, {"a": "4", "b": "5", "c": ""})])
        self.assertEqual(csv_import.parse("a\tb\n1\t2\n").delimiter, "\t")

    def test_rejects_bad_uploads(self) -> None:
        for raw in (b"\xff\xfe\x00", b"", b"a,a\n1,2\n"):
            with self.assertRaises(Invalid):
                csv_import.parse(csv_import.decode(raw))
        with self.assertRaises(Invalid):
            csv_import.decode(b"x" * (csv_import.MAX_UPLOAD_BYTES + 1))

    def test_suggests_export_and_plain_headers(self) -> None:
        self.assertEqual(csv_import.suggest_column_map(list(icd.CSV_COLUMNS))["to_connector"], "b_connector")
        self.assertEqual(csv_import.suggest_column_map(["From Board", "To-Pin"]),
                         {"from_board": "From Board", "to_pin": "To-Pin"})


class ImportTest(ImportCase):
    def test_reimporting_an_export_is_idempotent(self) -> None:
        before = {name: self.link_rows(lid) for name, lid in self.links.items()}
        replaced = len(self.events("rows_replaced"))
        export = icd.render_csv(self.service._icd_source(DESIGNER, self.sid, None)[0])
        upload = self.upload(export)
        self.assertEqual(upload["rowCount"], 26)
        self.assertEqual(upload["boardValues"]["a_board"], ["OBC-A", "OBC-B", "PWR"])
        column_map = upload["suggestedColumnMap"]
        self.assertEqual(set(column_map), set(csv_import.TARGETS))

        preview = self.preview(upload["importId"], column_map)
        self.assertEqual(preview["counts"], {"matched": 23, "needsReview": 3, "unresolved": 0, "conflict": 0})
        self.assertEqual({e["action"] for e in preview["matched"] + preview["needsReview"]}, {"update"})
        self.assertEqual(sorted(e["values"]["signal"] for e in preview["needsReview"]),
                         ["PAYLOAD_IRQ", "PAYLOAD_RESET", "PAYLOAD_RESET"])

        report = self.commit(upload["importId"], column_map)
        self.assertEqual((report["created"], report["updated"], report["unchanged"], report["linksCreated"]),
                         (0, 0, 23, []))
        self.assertEqual({name: self.link_rows(lid) for name, lid in self.links.items()}, before)
        self.assertEqual(len(self.events("rows_replaced")), replaced)
        [event] = self.events("import_committed")
        self.assertEqual(event["payload"]["reviewId"], report["reviewId"])

        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["kind"] == "import"]
        self.assertEqual([i["kind"] for i in review["items"]], ["signal_mismatch"] * 3)
        for item in review["items"]:
            review = self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"],
                                         "accept", None).body
        self.assertEqual(review["status"], "applied")
        self.assertEqual({name: self.link_rows(lid) for name, lid in self.links.items()}, before)
        with self.assertRaises(Conflict):
            self.commit(upload["importId"], column_map)

    def test_buckets_and_reasons(self) -> None:
        self.delete_link("L-J7J4")
        text = PLAIN_HEADER + "\n".join([
            "OBC-A,J7,3,PAY,J4,3,",                      # matched, signal defaults to the A leaf
            "OBC-A,J7,4,PAY,J4,4,mosi_in,",              # matched on the B leaf, case-insensitively
            "OBC-A,J7,5,PAY,J4,5,DATA_OUT,",             # needs review
            "PAY,J4,3,OBC-A,J7,3,,",                     # conflict: duplicates line 2, reversed
            "OBC-A,J7,6,PAY,J4,6,,WH-9",                 # matched, another harness makes another link
            "Mystery,J7,1,PAY,J4,1,,",                   # unresolved: board unmapped
            "Spare,J7,1,PAY,J4,1,,",                     # unresolved: board skipped
            "OBC-A,J99,1,PAY,J4,1,,",                    # unresolved: connector
            "OBC-A,J7,99,PAY,J4,1,,",                    # unresolved: pin
            "OBC-A,J7,,PAY,J4,1,,",                      # unresolved: missing value
            "OBC-A,J7,1,OBC-A,J7,2,,",                   # conflict: same port
            "OBC-A,J2,1,PWR,J1,1,VIN_28V,",              # conflict: existing row, no row_id
        ]) + "\n"
        upload = self.upload(text)
        boards = {**self.boards, "Spare": "skip"}
        preview = self.preview(upload["importId"], board_map=boards)
        reasons = {b: [(e["line"], e["reason"]) for e in preview[b]] for b in csv_import.BUCKETS}
        self.assertEqual(reasons, {
            "matched": [(2, None), (3, None), (6, None)],
            "needsReview": [(4, "signal_mismatch")],
            "unresolved": [(7, "board_unmapped"), (8, "board_skipped"), (9, "connector_not_found"),
                           (10, "pin_not_found"), (11, "missing_value")],
            "conflict": [(5, "duplicate_upload"), (12, "same_port"), (13, "duplicate_existing")],
        })
        self.assertEqual(preview["matched"][0]["signal"], "SPI_SCK")
        j7 = next(c for c in csv_import.baseline_interfaces(self.store, self.sid)[self.instances["OBC-A"]]["components"]
                  if c["reference"] == "J7")
        pin3 = next(p for p in j7["pins"] if p["pad"] == "3")
        self.assertEqual(preview["matched"][0]["from"]["pinNames"], pin3["pinNames"])

        report = self.commit(upload["importId"], board_map=boards)
        self.assertEqual((report["created"], len(report["linksCreated"])), (3, 2))
        self.assertEqual([e["line"] for e in report["unresolved"]], [7, 8, 9, 10, 11])
        self.conn.commit()
        links = {(l["name"], l["harness"]): l for l in self.store.list_links(self.sid)}
        plain = links[("OBC-A/J7 ↔ PAY/J4", None)]
        self.assertEqual([(r["pin_a"], r["pin_b"], r["signal"], r["source"], r["net_a"]) for r in plain["rows"]
                          if r["pin_a"] == "3"], [("3", "3", "SPI_SCK", "import", ["/Payload IF/SPI_SCK"])])
        self.assertEqual(len(links[("OBC-A/J7 ↔ PAY/J4", "WH-9")]["rows"]), 1)

        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["kind"] == "import"]
        [item] = review["items"]
        self.assertEqual(item["observed"]["signal"], "DATA_OUT")
        self.assertEqual(item["expected"], {"leaves": ["MISO_OUT", "SPI_MISO"]})
        with self.assertRaises(Invalid):
            self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"], "remap", None)
        applied = self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"], "accept",
                                      {"signal": "SPI_MISO"}).body
        self.assertEqual(applied["status"], "applied")
        rows = {r[1]: r for r in self.link_rows(plain["id"])}
        self.assertEqual(rows["5"][3], "SPI_MISO")

    def test_row_ids_update_in_place_and_never_cross_links(self) -> None:
        self.conn.commit()
        j2 = sorted(self.store.get_link(self.sid, self.links["L-J2J1"])["rows"], key=lambda r: int(r["pin_a"]))
        j7 = self.store.get_link(self.sid, self.links["L-J7J4"])["rows"]
        header = PLAIN_HEADER.rstrip("\n") + ",row_id\n"
        text = header + "\n".join([
            f"OBC-A,J2,1,PWR,J1,1,VIN_28V_MAIN,,{j2[0]['id']}",  # update: new signal, needs review
            f"PWR,J1,2,OBC-A,J2,2,GND,,{j2[1]['id']}",            # update, reversed ends, unchanged
            f"OBC-A,J2,3,PWR,J1,3,PWR_GOOD,,{j7[0]['id']}",       # conflict: row of another link
            f"OBC-A,J2,4,PWR,J1,4,PWR_EN,,{j2[2]['id']}",         # conflict: pins belong to another row
            "OBC-A,J2,4,PWR,J1,3,,,srw_foreign",                  # unknown id: created
        ]) + "\n"
        column_map = {**PLAIN_MAP, "row_id": "row_id"}
        upload = self.upload(text)
        preview = self.preview(upload["importId"], column_map)
        self.assertEqual([(e["line"], e["reason"]) for e in preview["conflict"]],
                         [(4, "row_in_other_link"), (5, "pin_pair_taken")])
        self.assertEqual([(e["line"], e["action"]) for e in preview["matched"]], [(3, "update"), (6, "create")])
        self.assertEqual([(e["line"], e["rowId"]) for e in preview["needsReview"]], [(2, j2[0]["id"])])
        report = self.commit(upload["importId"], column_map)
        self.assertEqual((report["created"], report["updated"], report["unchanged"]), (1, 0, 1))
        rows = self.link_rows(self.links["L-J2J1"])
        self.assertEqual(len(rows), 5)
        self.assertNotIn("srw_foreign", [r[0] for r in rows])

    def test_commit_promotes_a_port_that_is_not_exposed(self) -> None:
        interface = csv_import.baseline_interfaces(self.store, self.sid)[self.instances["OBC-A"]]
        resistor = next(c for c in interface["components"]
                        if c["reference"].startswith("R") and not c.get("candidate") and c.get("pins"))
        pad = resistor["pins"][0]["pad"]
        upload = self.upload(PLAIN_HEADER + f"OBC-A,{resistor['reference']},{pad},PAY,J4,1,,\n")
        preview = self.preview(upload["importId"])
        [entry] = preview["matched"]
        self.assertFalse(entry["from"]["exposed"])
        self.commit(upload["importId"])
        self.conn.commit()
        self.assertEqual(self.store.list_overrides(self.instances["OBC-A"]).get(resistor["portKey"]), "promoted")
        self.assertEqual(len(self.events("port_override_set")), 1)

    def test_maps_are_validated_and_restricted_boards_are_hidden(self) -> None:
        upload = self.upload(PLAIN_HEADER + "OBC-A,J7,1,PAY,J4,1,,\n")
        with self.assertRaises(Invalid):
            self.preview(upload["importId"], {k: v for k, v in PLAIN_MAP.items() if k != "to_pin"})
        with self.assertRaises(Invalid):
            self.preview(upload["importId"], {**PLAIN_MAP, "signal": "nope"})
        with self.assertRaises(Invalid):
            self.preview(upload["importId"], board_map={"OBC-A": "sin_missing"})
        with self.assertRaises(NotFound):
            self.preview("sim_missing")
        with self.assertRaises(StaleVersion):
            self.service.commit_import(DESIGNER, self.sid, self.version() - 1, upload["importId"], PLAIN_MAP,
                                       self.boards, None)
        self.conn.execute("INSERT INTO ws_folders (id, visibility_mode, allowed_roles)"
                          " VALUES ('fld_admins', 'roles', '[\"admin\"]')")
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pay'")
        self.conn.commit()
        with self.assertRaises(NotFound):
            self.preview(upload["importId"])

    def test_import_review_items_on_restricted_boards_are_redacted(self) -> None:
        self.delete_link("L-J7J4")
        upload = self.upload(PLAIN_HEADER + "OBC-A,J7,5,PAY,J4,5,DATA_OUT,\n")
        review_id = self.commit(upload["importId"])["reviewId"]
        self.conn.execute("INSERT INTO ws_folders (id, visibility_mode, allowed_roles)"
                          " VALUES ('fld_admins', 'roles', '[\"admin\"]')")
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pay'")
        self.conn.commit()
        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open") if r["id"] == review_id]
        [item] = review["items"]
        self.assertEqual((item["redacted"], item["observed"], item["expected"]), (True, None, None))
        with self.assertRaises(NotFound):
            self.service.decide(DESIGNER, self.sid, self.version(), review_id, item["id"], "accept", None)
        admin = Caller(role="admin", email="admin@example.com")
        [shown] = [r for r in self.service.list_reviews(admin, self.sid, "open") if r["id"] == review_id]
        self.assertEqual(shown["items"][0]["observed"]["signal"], "DATA_OUT")


    def test_a_decision_response_redacts_other_items_on_restricted_boards(self) -> None:
        self.delete_link("L-J7J4")
        self.delete_link("L-J2J1")
        upload = self.upload(PLAIN_HEADER + "OBC-A,J7,5,PAY,J4,5,DATA_OUT,\nOBC-A,J2,3,PWR,J1,3,NOT_THIS_NET,\n")
        committed = self.commit(upload["importId"])
        self.assertEqual(committed["counts"]["needsReview"], 2, committed)
        self.conn.execute("INSERT INTO ws_folders (id, visibility_mode, allowed_roles)"
                          " VALUES ('fld_admins', 'roles', '[\"admin\"]')")
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = 'prj_pay'")
        self.conn.commit()
        [review] = [r for r in self.service.list_reviews(DESIGNER, self.sid, "open")
                    if r["id"] == committed["reviewId"]]
        visible = next(i for i in review["items"] if not i["redacted"])
        body = self.service.decide(DESIGNER, self.sid, self.version(), review["id"], visible["id"],
                                   "remove_rows", None).body
        hidden = [i for i in body["items"] if i["id"] != visible["id"]]
        self.assertEqual([(i["redacted"], i["observed"]) for i in hidden], [(True, None)])
        self.assertNotIn("DATA_OUT", json.dumps(body))


class ImportApiTest(ImportCase):
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

    def multipart(self, text: str, user: str = "designer"):
        """A multipart upload through the router (``_request`` sends JSON only)."""

        import asyncio
        import json

        from app.core.security import get_current_user
        from test_system_api import USERS

        boundary = "sysb0undary"
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"w.csv\"\r\n"
                f"Content-Type: text/csv\r\n\r\n{text}\r\n--{boundary}--\r\n").encode()
        messages: list[dict] = []

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            messages.append(message)

        self.app.dependency_overrides[get_current_user] = lambda: USERS[user]
        try:
            path = f"/api/systems/{self.sid}/imports"
            asyncio.run(self.app({
                "type": "http", "http_version": "1.1", "method": "POST", "scheme": "http", "path": path,
                "raw_path": path.encode(), "query_string": b"", "root_path": "", "client": ("t", 1),
                "server": ("t", 80),
                "headers": [(b"content-type", f"multipart/form-data; boundary={boundary}".encode())],
            }, receive, send))
        finally:
            self.app.dependency_overrides.pop(get_current_user, None)
        start = next(m for m in messages if m["type"] == "http.response.start")
        data = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
        return start["status"], json.loads(data)

    def test_routes_are_exposed(self) -> None:
        paths = set(self.app.openapi()["paths"])
        for path in ("/imports", "/imports/{import_id}/preview", "/imports/{import_id}/commit"):
            self.assertIn("/api/systems/{system_id}" + path, paths)

    def test_upload_preview_commit_over_http(self) -> None:
        self.delete_link("L-J7J4")
        self.assertEqual(self.multipart(PLAIN_HEADER, user="viewer")[0], 403)
        status, upload = self.multipart(PLAIN_HEADER + "OBC-A,J7,3,PAY,J4,3,,\n")
        self.assertEqual(status, 201)
        self.assertTrue(upload["importId"].startswith("sim_"))
        body = {"columnMap": PLAIN_MAP, "boardMap": self.boards}
        preview = self.call("POST", f"/imports/{upload['importId']}/preview", body=body)
        self.assertEqual((preview.status, preview.json["counts"]["matched"]), (200, 1))
        path = f"/imports/{upload['importId']}/commit"
        self.assertEqual(self.call("POST", path, body=body).status, 428)
        current = etag(self.sid, self.version())
        committed = self.call("POST", path, body=body, headers={"If-Match": current})
        self.assertEqual((committed.status, committed.json["created"]), (200, 1))
        self.assertNotEqual(committed.headers["etag"], current)
        again = self.call("POST", path, body=body, headers={"If-Match": committed.headers["etag"]})
        self.assertEqual(again.status, 409)
        bad = self.call("POST", f"/imports/{upload['importId']}/preview",
                        body={"columnMap": {"from_board": "from_board"}, "boardMap": {}})
        self.assertEqual(bad.status, 422)


if __name__ == "__main__":
    unittest.main()
