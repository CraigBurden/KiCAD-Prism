"""SYS-06: detection against real fixture repositories and PostgreSQL.

The fixture system (``system.json``) is loaded at F0 into an isolated schema
(``system_builder_db.FixtureSystemCase``). A test moves branch ``track`` to a
step's commit to simulate a fetch; detection then resolves, extracts,
evaluates and applies exactly as a worker would.
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest import mock

from system_builder_db import FixtureSystemCase
from system_builder_fixtures import expected_steps

from app.services.systems import detection
from app.services.systems.detection import DETECTION_ACTOR, Detector
from support.repo import git  # noqa: E402


class DetectionTest(FixtureSystemCase):
    # ------------------------------------------------------------------ outcomes

    def test_review_steps_open_one_review_with_the_golden_items(self) -> None:
        steps = expected_steps()["steps"]
        for name in ("F1", "F4", "F5", "F8", "F9"):
            with self.subTest(step=name):
                self.setUp_fresh()
                spec = steps[name]
                tip = self.move_track("mini_obc", spec["candidate"].split("/")[1])
                result = self.detector.check_instance(self.instances["OBC-A"])
                self.assertEqual(result.outcome, "review_opened")
                [review] = self.reviews("OBC-A", "open")
                self.assertEqual((review["kind"], review["from_commit"], review["to_commit"]),
                                 ("source_update", self.commits["mini_obc"]["F0"], tip))
                self.assertEqual(self.comparable_items(review), self.golden_items(spec["items"]))
                instance = self.store.get_instance(self.sid, self.instances["OBC-A"])
                self.assertEqual(instance["baseline_commit"], self.commits["mini_obc"]["F0"])

    def setUp_fresh(self) -> None:
        self.tearDown()
        self.setUp()

    def test_f9_review_stores_ranked_candidates(self) -> None:
        self.move_track("mini_obc", "F9")
        self.detector.check_instance(self.instances["OBC-A"])
        [review] = self.reviews("OBC-A", "open")
        candidates = review["items"][0]["candidates"]
        self.assertEqual([(c["reference"], c["netOverlap"]) for c in candidates], [("J6", 0.75), ("J5", 0.5)])

    def test_auto_advance_applies_silent_changes(self) -> None:
        cases = [("OBC-A", "mini_obc", "F2", "connector_relabelled"),
                 ("OBC-A", "mini_obc", "F3", "connector_rebound"),
                 ("OBC-A", "mini_obc", "F6", None),
                 ("OBC-A", "mini_obc", "F7", None),
                 ("PWR", "mini_power", "F10", "connector_rebound")]
        for label, board, snapshot, silent_kind in cases:
            with self.subTest(step=snapshot):
                self.setUp_fresh()
                before = self.version()
                tip = self.move_track(board, snapshot)
                self.assertEqual(self.detector.check_instance(self.instances[label]).outcome, "auto_advanced")
                self.assertEqual(self.store.get_instance(self.sid, self.instances[label])["baseline_commit"], tip)
                self.assertEqual(self.version(), before + 1)
                self.assertEqual(self.reviews(label), [])
                advanced = self.events("baseline_auto_advanced")
                self.assertEqual(len(advanced), 1)
                self.assertEqual(advanced[0]["actor"], DETECTION_ACTOR)
                if silent_kind:
                    self.assertTrue(self.events(silent_kind))

    def test_f2_relabel_updates_the_port_baseline(self) -> None:
        self.move_track("mini_obc", "F2")
        self.detector.check_instance(self.instances["OBC-A"])
        link = self.store.get_link(self.sid, self.links["L-J2J1"])
        self.assertEqual(link["a_port"]["reference"], "J12")
        [event] = self.events("connector_relabelled")
        self.assertEqual((event["payload"]["before"]["reference"], event["payload"]["after"]["reference"]),
                         ("J2", "J12"))

    def test_f10_port_key_moves_to_unit_b(self) -> None:
        old_key = self.store.get_link(self.sid, self.links["L-J3J11"])["a_port"]["portKey"]
        self.move_track("mini_power", "F10")
        self.detector.check_instance(self.instances["PWR"])
        for name in ("L-J3J11", "L-J3J12"):
            port = self.store.get_link(self.sid, self.links[name])["a_port"]
            self.assertNotEqual(port["portKey"], old_key)
            self.assertEqual(port["memberKeys"], [port["portKey"]])

    def test_f11_newer_candidate_supersedes_the_open_review(self) -> None:
        sequence = expected_steps()["steps"]["F11"]["sequence"]
        self.move_track("mini_obc", "F11.1")
        first = self.detector.check_instance(self.instances["OBC-A"])
        tip = self.move_track("mini_obc", "F11.2")
        second = self.detector.check_instance(self.instances["OBC-A"])
        self.assertEqual((first.outcome, second.outcome), ("review_opened", "review_opened"))
        superseded = self.reviews("OBC-A", "superseded")
        self.assertEqual([r["id"] for r in superseded], [first.review_id])
        [current] = self.reviews("OBC-A", "open")
        self.assertEqual(current["id"], second.review_id)
        self.assertEqual((current["from_commit"], current["to_commit"]), (self.commits["mini_obc"]["F0"], tip))
        self.assertEqual(self.comparable_items(current), self.golden_items(sequence[1]["items"]))
        self.assertEqual(len(self.events("review_superseded")), 1)

    def test_f12_pinned_instance_records_update_available_only(self) -> None:
        tip = self.move_track("mini_obc", "F1")
        results = {r.instance_id: r for r in self.detector.check_repository("repo_obc")}
        self.assertEqual(results[self.instances["OBC-A"]].outcome, "review_opened")
        self.assertEqual(results[self.instances["OBC-B"]].outcome, "update_available")
        self.assertEqual(self.reviews("OBC-B"), [])
        pinned = self.store.get_instance(self.sid, self.instances["OBC-B"])
        self.assertEqual(pinned["tip_commit"], tip)
        self.assertEqual(pinned["baseline_commit"], self.commits["mini_obc"]["F0"])
        self.assertEqual(self.store.get_source_check(self.instances["OBC-B"])["last_outcome"], "update_available")

    def test_unpinning_evaluates_the_tip_a_pinned_check_already_saw(self) -> None:
        self.move_track("mini_obc", "F1")
        self.assertEqual(self.detector.check_instance(self.instances["OBC-B"]).outcome, "update_available")
        with self.store.mutation(self.sid, expected_version=None, actor="user:t") as change:
            self.store.update_instance(change, self.instances["OBC-B"], pinned=False)
        self.conn.commit()
        self.assertEqual(self.detector.check_instance(self.instances["OBC-B"]).outcome, "review_opened")
        self.assertEqual(len(self.reviews("OBC-B", "open")), 1)

    # ------------------------------------------------------------------ idempotency and edges

    def test_rechecking_the_same_tip_changes_nothing(self) -> None:
        self.move_track("mini_obc", "F1")
        self.detector.check_instance(self.instances["OBC-A"])
        version = self.version()
        again = self.detector.check_instance(self.instances["OBC-A"])
        forced = self.detector.check_instance(self.instances["OBC-A"], force=True)
        self.assertEqual((again.outcome, forced.outcome), ("already_checked", "review_current"))
        self.assertEqual(self.version(), version)
        self.assertEqual(len(self.reviews("OBC-A")), 1)

    def test_a_concurrent_check_of_the_same_tip_does_not_duplicate_the_review(self) -> None:
        self.move_track("mini_obc", "F1")
        first = self.detector.check_instance(self.instances["OBC-A"])
        version = self.version()
        # A second worker that resolved and extracted before the first applied.
        instance = self.store.get_instance(self.sid, self.instances["OBC-A"])
        self.conn.commit()
        project = self.projects["prj_obc"]
        from app.services.systems.jobs import extract_and_store

        candidate = extract_and_store(project, self.commits["mini_obc"]["F1"], self.connect)
        late = self.detector._apply(instance, self.commits["mini_obc"]["F1"], candidate)
        self.assertEqual((late.outcome, late.review_id), ("review_current", first.review_id))
        self.assertEqual(self.version(), version)
        self.assertEqual(len(self.reviews("OBC-A")), 1)

    def test_engine_inconsistency_applies_nothing_and_leaves_the_tip_unchecked(self) -> None:
        from app.services.systems import drift

        self.move_track("mini_obc", "F1")
        version = self.version()
        with mock.patch.object(drift, "_digest_equal", return_value=True), \
                self.assertLogs("app.services.systems.detection", "ERROR"):
            result = self.detector.check_instance(self.instances["OBC-A"])
        self.assertEqual(result.outcome, "engine_error")
        self.assertEqual(self.version(), version)
        self.assertEqual(self.reviews("OBC-A"), [])
        self.assertIsNone(self.store.get_source_check(self.instances["OBC-A"])["last_checked_commit"])

    def test_tip_at_baseline_and_missing_ref(self) -> None:
        self.assertEqual(self.detector.check_instance(self.instances["PAY"]).outcome, "at_baseline")
        git(self.repos["mini_payload"], "branch", "-D", "track")
        version = self.version()
        result = self.detector.check_instance(self.instances["PAY"])
        self.assertEqual(result.outcome, "ref_missing")
        self.assertIsNone(self.store.get_instance(self.sid, self.instances["PAY"])["tip_commit"])
        self.assertEqual(self.version(), version)
        self.assertEqual(self.reviews("PAY"), [])

    def test_unreachable_baseline_opens_one_itemless_review(self) -> None:
        missing = "0" * 40
        self.conn.execute("UPDATE system_instances SET baseline_commit = %s WHERE id = %s",
                          (missing, self.instances["PAY"]))
        self.conn.commit()
        self.move_track("mini_payload", "F0")
        first = self.detector.check_instance(self.instances["PAY"])
        self.assertEqual(first.outcome, "baseline_unreachable")
        [review] = self.reviews("PAY", "open")
        self.assertEqual((review["kind"], review["items"], review["from_commit"]),
                         ("baseline_unreachable", [], missing))
        self.assertEqual(self.store.get_instance(self.sid, self.instances["PAY"])["resolution"], "unresolved")
        second = self.detector.check_instance(self.instances["PAY"], force=True)
        self.assertEqual(second.outcome, "baseline_unreachable")
        self.assertEqual(len(self.reviews("PAY")), 1)

    def test_review_keeps_pending_changes_for_acceptance(self) -> None:
        self.move_track("mini_obc", "F1")
        self.detector.check_instance(self.instances["OBC-A"])
        [review] = self.reviews("OBC-A", "open")
        pending = dict(review["pending_changes"])
        self.assertTrue(pending.pop("basis").startswith("sha256:"))
        self.assertEqual(pending, {"portUpdates": [], "silent": []})

    def test_extraction_failure_is_recorded_not_raised(self) -> None:
        self.move_track("mini_obc", "F1")
        failing = Detector(connect=self.connect, project_loader=self.projects.get,
                           extract=mock.Mock(side_effect=ValueError("broken")))
        with self.assertLogs("app.services.systems.detection", "ERROR"):
            result = failing.check_instance(self.instances["OBC-A"])
        self.assertEqual(result.outcome, "extraction_failed")
        self.assertEqual(self.reviews("OBC-A"), [])
        self.assertIsNone(self.store.get_source_check(self.instances["OBC-A"])["last_checked_commit"])
        # The next fetch retries the same tip instead of skipping it.
        self.assertEqual(self.detector.check_instance(self.instances["OBC-A"]).outcome, "review_opened")

    def test_a_failure_after_a_forced_check_still_retries(self) -> None:
        self.move_track("mini_obc", "F1")
        self.detector.check_instance(self.instances["OBC-B"])  # pinned: records the tip as checked
        failing = Detector(connect=self.connect, project_loader=self.projects.get,
                           extract=mock.Mock(side_effect=ValueError("broken")))
        self.conn.execute("UPDATE system_instances SET pinned = false WHERE id = %s", (self.instances["OBC-B"],))
        self.conn.commit()
        with self.assertLogs("app.services.systems.detection", "ERROR"):
            failing.check_instance(self.instances["OBC-B"], force=True)
        self.assertIsNone(self.store.get_source_check(self.instances["OBC-B"])["last_checked_commit"])

    # ------------------------------------------------------------------ enqueueing

    def test_fetch_enqueues_one_check_only_for_tracked_repositories(self) -> None:
        with mock.patch.object(detection, "detector", self.detector), \
                mock.patch("app.services.job_service.jobs.enqueue", return_value={"job_id": "j"}) as enqueue:
            self.assertEqual(detection.enqueue_source_check("repo_obc"), {"job_id": "j"})
            self.conn.execute("UPDATE system_instances SET tracked_ref = NULL WHERE project_id = 'prj_pay'")
            self.conn.commit()
            self.assertIsNone(detection.enqueue_source_check("repo_pay"))
            self.assertIsNone(detection.enqueue_source_check(""))
        self.assertEqual(enqueue.call_count, 1)
        args, kwargs = enqueue.call_args
        self.assertEqual(args[0], detection.SOURCE_CHECK_JOB_KIND)
        self.assertEqual(kwargs["artifact_key"], "system-source-check:repo_obc")


class SyncHookTest(unittest.TestCase):
    def test_sync_job_enqueues_a_source_check_for_the_repository(self) -> None:
        from app.services import project_import_service as imports

        context = SimpleNamespace(payload={"project_id": "p1", "fetch_only": True},
                                  progress=lambda **_: None, check_cancelled=lambda: None)
        with mock.patch.object(imports, "sync_project", return_value={"status": "success", "message": "ok"}), \
                mock.patch.object(imports.workspace, "get_project_by_id", return_value={"repo_id": "repo_1"}), \
                mock.patch("app.services.systems.detection.enqueue_source_check") as enqueue:
            imports.run_project_sync_job_v3(context)
        enqueue.assert_called_once_with("repo_1")

    def test_a_failing_source_check_does_not_fail_the_sync(self) -> None:
        from app.services import project_import_service as imports

        context = SimpleNamespace(payload={"project_id": "p1", "fetch_only": True},
                                  progress=lambda **_: None, check_cancelled=lambda: None)
        with mock.patch.object(imports, "sync_project", return_value={"status": "success", "message": "ok"}), \
                mock.patch.object(imports.workspace, "get_project_by_id", return_value={"repo_id": "r"}), \
                mock.patch("app.services.systems.detection.enqueue_source_check", side_effect=RuntimeError("db")):
            result = imports.run_project_sync_job_v3(context)
        self.assertEqual(result.message, "ok")

    def test_job_handler_is_registered(self) -> None:
        from app.services.job_handlers import load_builtin_job_handlers, registered_job_kinds

        load_builtin_job_handlers()
        self.assertIn(detection.SOURCE_CHECK_JOB_KIND, registered_job_kinds())


if __name__ == "__main__":
    unittest.main()
