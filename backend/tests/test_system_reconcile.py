"""SYS-07: review decisions, atomic application, keep pinned and rebase.

Reviews come from real detection over the fixture repositories
(``system_builder_db.FixtureSystemCase``); decisions go through
``SystemService`` exactly as the API calls it.
"""

from __future__ import annotations

import unittest

from fastapi import FastAPI

from system_builder_db import FixtureSystemCase

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems.service import Caller, SystemService
from app.services.systems.store import Conflict, Invalid, NotFound, StaleVersion

DESIGNER = Caller(role="designer", email="designer@example.com")


class ReconcileTest(FixtureSystemCase):
    def setUp(self) -> None:
        super().setUp()
        self.queued: list[tuple[str, str]] = []

        def enqueue(project_id: str, commit: str, *, requested_by: str = "") -> dict:
            self.queued.append((project_id, commit))
            return {"job_id": "job-x", "status": "queued"}

        self.service = SystemService(connect=self.connect, project_loader=self.projects.get, enqueue=enqueue)

    # ------------------------------------------------------------------ helpers

    def open_review(self, snapshot: str, label: str = "OBC-A", board: str = "mini_obc") -> dict:
        self.move_track(board, snapshot)
        result = self.detector.check_instance(self.instances[label])
        self.assertEqual(result.outcome, "review_opened")
        return next(r for r in self.service.list_reviews(DESIGNER, self.sid, "open")
                    if r["id"] == result.review_id)

    def decide(self, review: dict, item: dict, decision: str, payload: dict | None = None) -> dict:
        return self.service.decide(DESIGNER, self.sid, self.version(), review["id"], item["id"],
                                   decision, payload).body

    def row(self, link_name: str, pin_a: str) -> dict | None:
        self.conn.commit()
        link = self.store.get_link(self.sid, self.links[link_name])
        return next((r for r in link["rows"] if r["pin_a"] == pin_a), None)

    def baseline(self, label: str) -> str:
        self.conn.commit()
        return self.store.get_instance(self.sid, self.instances[label])["baseline_commit"]

    # ------------------------------------------------------------------ decisions

    def test_accept_net_change_applies_the_review(self) -> None:
        review = self.open_review("F1")
        [item] = review["items"]
        self.assertEqual((item["kind"], item["pins"]), ("net_changed", ["17"]))
        version = self.version()
        applied = self.decide(review, item, "accept")
        self.assertEqual(applied["status"], "applied")
        self.assertEqual(applied["items"][0]["decision"], "accept")
        self.assertEqual(self.baseline("OBC-A"), self.commits["mini_obc"]["F1"])
        self.assertEqual(self.row("L-J7J4", "17")["net_a"], [])
        self.assertEqual(self.version(), version + 1)
        kinds = [e["kind"] for e in self.store.history(self.sid, limit=5)]
        self.assertEqual(kinds[:2], ["review_applied", "review_item_decided"])

    def test_review_applies_only_when_the_last_item_is_decided(self) -> None:
        review = self.open_review("F5")
        items = review["items"]
        self.assertEqual(len(items), 12)
        for item in items[:-1]:
            self.decide(review, item, "accept")
        # Decisions stay editable until the review applies.
        self.decide(review, items[0], "remove_rows")
        state = next(r for r in self.service.list_reviews(DESIGNER, self.sid, None) if r["id"] == review["id"])
        self.assertEqual(state["status"], "open")
        self.assertEqual(self.baseline("OBC-A"), self.commits["mini_obc"]["F0"])
        self.decide(review, items[-1], "accept")
        self.assertEqual(self.baseline("OBC-A"), self.commits["mini_obc"]["F5"])
        self.assertIsNone(self.row("L-J7J4", "3"))  # removed by the changed decision
        self.assertEqual(self.row("L-J7J4", "4")["net_a"], ["/Payload Interface/SPI_MOSI"])
        self.assertEqual(self.row("L-J7J4", "1")["net_a"], ["GND"])  # untouched

    def test_remap_moves_the_row_to_another_pad(self) -> None:
        review = self.open_review("F1")
        [item] = review["items"]
        with self.assertRaises(Invalid):
            self.decide(review, item, "remap", {"pad": "99"})
        self.decide(review, item, "remap", {"pad": "19"})
        self.assertIsNone(self.row("L-J7J4", "17"))
        moved = self.row("L-J7J4", "19")
        self.assertEqual(moved["pin_b"], "17")
        self.assertEqual(moved["net_a"], ["/Payload IF/SPARE19"])

    def test_remove_rows(self) -> None:
        review = self.open_review("F1")
        self.decide(review, review["items"][0], "remove_rows")
        self.assertIsNone(self.row("L-J7J4", "17"))
        self.assertEqual(self.baseline("OBC-A"), self.commits["mini_obc"]["F1"])

    def test_accept_connector_change_refreshes_port_and_nets(self) -> None:
        review = self.open_review("F4")
        [item] = review["items"]
        self.assertEqual(item["kind"], "connector_changed")
        self.decide(review, item, "accept")
        link = self.store.get_link(self.sid, self.links["L-J7J4"])
        self.assertEqual(link["a_port"]["libId"], "Connector_Generic:Conn_02x12_Odd_Even")
        self.assertEqual(link["a_port"]["pinCount"], 24)

    def test_bind_candidate_rebinds_the_link_end(self) -> None:
        review = self.open_review("F9")
        [item] = review["items"]
        j6 = next(c for c in item["candidates"] if c["reference"] == "J6")
        with self.assertRaises(Invalid):
            self.decide(review, item, "bind_candidate", {"portKey": "/not/offered"})
        self.decide(review, item, "bind_candidate", {"portKey": j6["portKey"]})
        link = self.store.get_link(self.sid, self.links["L-J2J1"])
        self.assertEqual((link["a_port"]["reference"], link["a_port"]["portKey"]), ("J6", j6["portKey"]))
        self.assertEqual(self.baseline("OBC-A"), self.commits["mini_obc"]["F9"])
        kinds = [e["kind"] for e in self.store.history(self.sid, limit=10)]
        self.assertIn("connector_rebound", kinds)

    def test_decisions_must_fit_the_item(self) -> None:
        review = self.open_review("F1")
        [item] = review["items"]
        with self.assertRaises(Invalid):
            self.decide(review, item, "bind_candidate", {"portKey": "x"})
        missing = self.open_review("F9")
        with self.assertRaises(Invalid):
            self.decide(missing, missing["items"][0], "accept")
        with self.assertRaises(NotFound):
            self.service.decide(DESIGNER, self.sid, self.version(), missing["id"], "sri_nope", "accept", None)

    def test_stale_etag_and_closed_reviews_are_refused(self) -> None:
        review = self.open_review("F1")
        with self.assertRaises(StaleVersion):
            self.service.decide(DESIGNER, self.sid, self.version() - 1, review["id"],
                                review["items"][0]["id"], "accept", None)
        self.move_track("mini_obc", "F11.2")
        self.detector.check_instance(self.instances["OBC-A"])  # supersedes it
        with self.assertRaises(Conflict):
            self.decide(review, review["items"][0], "accept")

    def test_keep_pinned_pins_and_keeps_the_baseline(self) -> None:
        review = self.open_review("F1")
        kept = self.service.keep_pinned(DESIGNER, self.sid, self.version(), review["id"]).body
        self.assertEqual(kept["status"], "kept_pinned")
        self.conn.commit()
        instance = self.store.get_instance(self.sid, self.instances["OBC-A"])
        self.assertTrue(instance["pinned"])
        self.assertEqual(instance["baseline_commit"], self.commits["mini_obc"]["F0"])
        self.assertEqual(self.row("L-J7J4", "17")["net_a"], ["PAYLOAD_RESET#"])
        with self.assertRaises(Conflict):
            self.service.keep_pinned(DESIGNER, self.sid, self.version(), review["id"])

    # ------------------------------------------------------------------ rebase

    def test_rebase_moves_a_pinned_instance(self) -> None:
        f2 = self.commits["mini_obc"]["F2"]
        state, _ = self.service.rebase(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], f2)
        self.assertEqual(state, "queued")
        self.assertEqual(self.queued, [("prj_obc", f2)])
        from app.services.systems.jobs import extract_and_store

        extract_and_store(self.projects["prj_obc"], f2, self.connect)
        state, result = self.service.rebase(DESIGNER, self.sid, self.version(),
                                            self.instances["OBC-B"], f2[:12])
        self.assertEqual((state, result.body["outcome"]), ("done", "auto_advanced"))
        self.assertEqual(self.baseline("OBC-B"), f2)
        self.assertTrue(result.body["instance"]["pinned"])
        self.assertEqual(self.store.history(self.sid, limit=1)[0]["kind"], "baseline_rebased")
        with self.assertRaises(Conflict):
            self.service.rebase(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], f2)
        with self.assertRaises(Invalid):
            self.service.rebase(DESIGNER, self.sid, self.version(), self.instances["OBC-B"], "f" * 40)

    def test_rebase_closes_a_baseline_unreachable_review(self) -> None:
        self.conn.execute("UPDATE system_instances SET baseline_commit = %s WHERE id = %s",
                          ("0" * 40, self.instances["PAY"]))
        self.conn.commit()
        self.detector.check_instance(self.instances["PAY"])
        [unreachable] = self.service.list_reviews(DESIGNER, self.sid, "open")
        self.assertEqual(unreachable["kind"], "baseline_unreachable")
        f0 = self.commits["mini_payload"]["F0"]
        from app.services.systems.jobs import extract_and_store

        extract_and_store(self.projects["prj_pay"], f0, self.connect)
        _, result = self.service.rebase(DESIGNER, self.sid, self.version(), self.instances["PAY"], f0)
        self.assertEqual(result.body["outcome"], "auto_advanced")
        self.assertEqual(result.body["instance"]["resolution"], "resolved")
        statuses = {r["id"]: r["status"] for r in self.service.list_reviews(DESIGNER, self.sid, None)}
        self.assertEqual(statuses[unreachable["id"]], "closed")


class ReconcileRoutingTest(unittest.TestCase):
    def test_review_routes_are_exposed(self) -> None:
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        paths = set(app.openapi()["paths"])
        for path in ("/api/systems/{system_id}/reviews",
                     "/api/systems/{system_id}/reviews/{review_id}/items/{item_id}/decision",
                     "/api/systems/{system_id}/reviews/{review_id}/keep-pinned",
                     "/api/systems/{system_id}/instances/{instance_id}/rebase"):
            self.assertIn(path, paths)


if __name__ == "__main__":
    unittest.main()
