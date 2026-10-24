"""The design bundle consumer: ready, pending, failed, dirty (ADR §8, §9.7 R1)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest import mock

from app.services.design_bundle import consumer, reader
from app.services.design_bundle.errors import DesignDataFailed, DesignDataPending
from app.services.design_bundle.manifest import Readiness

PATH = "projections/project.json"


class _Opened:
    def __init__(
        self, states: dict[str, str], *, absent: bool = False, job_active: bool = False, dirty: bool = False,
        failure: str | None = None,
    ):
        self.absent = absent
        self.failure = failure
        self.job_active = job_active
        self.working_tree_dirty = dirty
        self._states = states
        self.read_paths: list[str] = []

    def readiness(self, paths):
        return {path: Readiness(path, self._states[path], "parse", "why") for path in paths}

    def read_json(self, path):
        self.read_paths.append(path)
        return {"schema": "prism.project.a0"}


class BundleReadTests(unittest.TestCase):
    def _read(self, opened, consumer_name="PROJECT_METADATA"):
        with mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
            return (
                consumer.bundle_read(consumer_name, "prj", "c0ffee", [PATH], requested_by="u"),
                open_revision,
            )

    def test_ready_members_are_read_and_the_job_is_queued_on_open(self):
        opened = _Opened({PATH: "ready"})
        result, open_revision = self._read(opened)
        open_revision.assert_called_once_with("prj", "c0ffee", queue=True, requested_by="u")
        self.assertTrue(result.ready(PATH))
        self.assertEqual(result.json(PATH)["schema"], "prism.project.a0")

    def test_a_member_that_is_not_ready_is_pending(self):
        for state in ("pending", "unavailable"):
            with self.subTest(state=state):
                with self.assertRaises(DesignDataPending) as raised:
                    self._read(_Opened({PATH: state}))
                self.assertEqual(raised.exception.members, (PATH,))
                self.assertEqual(raised.exception.job_state, "queued")

    def test_a_running_build_reports_its_job_state(self):
        with self.assertRaises(DesignDataPending) as raised:
            self._read(_Opened({PATH: "pending"}, job_active=True))
        self.assertEqual(raised.exception.job_state, "building")

    def test_a_build_that_ended_in_failure_is_not_pending(self):
        # Failed before parse (no archive), or a later stage left pending in a
        # surviving archive: no job will make the member ready.
        for state in ("unavailable", "pending"):
            with self.subTest(state=state):
                with self.assertRaises(DesignDataFailed) as raised:
                    self._read(_Opened({PATH: state}, failure="KiCad cannot read board.kicad_pcb"))
                self.assertEqual(raised.exception.members, (PATH,))
                self.assertIn("KiCad cannot read", raised.exception.detail)

    def test_members_a_failed_build_did_finish_are_still_served(self):
        result, _ = self._read(_Opened({PATH: "ready"}, failure="zone refill failed"))
        self.assertTrue(result.ready(PATH))

    def test_a_failed_member_is_a_typed_failure(self):
        with self.assertRaises(DesignDataFailed) as raised:
            self._read(_Opened({PATH: "failed"}))
        self.assertEqual(raised.exception.members, (PATH,))
        self.assertIn(PATH, raised.exception.detail)

    def test_final_non_members_are_the_consumers_to_handle(self):
        for state in ("skipped", "not-applicable"):
            with self.subTest(state=state):
                result, _ = self._read(_Opened({PATH: state}))
                self.assertFalse(result.ready(PATH))

    def test_an_absent_revision_fails_with_a_reason(self):
        with self.assertRaises(DesignDataFailed):
            self._read(_Opened({}, absent=True))

    def test_an_open_error_is_a_typed_failure_not_a_fallback(self):
        with mock.patch.object(consumer.reader, "open_revision", side_effect=RuntimeError("bad archive")):
            with self.assertRaises(DesignDataFailed) as raised:
                consumer.bundle_read("PROJECT_METADATA", "prj", None, [PATH])
        self.assertIn("bad archive", raised.exception.detail)

    def test_a_missing_project_still_raises_lookup(self):
        with mock.patch.object(consumer.reader, "open_revision", side_effect=LookupError("gone")):
            with self.assertRaises(LookupError):
                consumer.bundle_read("PROJECT_METADATA", "prj", None, [PATH])

    def test_the_dirty_notice_is_a_response_header(self):
        result, _ = self._read(_Opened({PATH: "ready"}, dirty=True))
        self.assertEqual(result.response_headers(), {"X-Prism-Working-Tree": "dirty"})
        clean, _ = self._read(_Opened({PATH: "ready"}))
        self.assertEqual(clean.response_headers(), {})

    def test_no_consumer_has_a_switch(self):
        self.assertFalse(hasattr(consumer, "source"))
        self.assertEqual(
            consumer.CONSUMERS,
            (
                "SEMANTIC_INDEX",
                "DESIGN_COMPARISON",
                "RELEASE_STUDIO",
                "PROJECT_METADATA",
                "CATALOG_IMPORT",
            ),
        )


class IfReadyTests(unittest.TestCase):
    """Design Comparison's source-tree mode, not a legacy fallback."""

    def test_pending_and_failed_are_none(self):
        for state in ("pending", "failed"):
            with self.subTest(state=state), mock.patch.object(
                consumer.reader, "open_revision", return_value=_Opened({PATH: state})
            ):
                self.assertIsNone(
                    consumer.bundle_read_if_ready("DESIGN_COMPARISON", "prj", "c0ffee", [PATH])
                )

    def test_ready_is_the_read(self):
        with mock.patch.object(
            consumer.reader, "open_revision", return_value=_Opened({PATH: "ready"})
        ):
            self.assertIsNotNone(
                consumer.bundle_read_if_ready("DESIGN_COMPARISON", "prj", "c0ffee", [PATH])
            )


class ReaderFailureTests(unittest.TestCase):
    """``open_revision`` records a failure only when no build or retry is under way."""

    ROW = {"project_file_rel": "demo.kicad_pro"}

    def _open(self, *, job_status: str | None, queued: str | None):
        key = SimpleNamespace(absent=False, commit="c0ffee", key=SimpleNamespace(revision_key="r" * 64))
        bundle = {"state": "failed", "error": "KiCad cannot read demo.kicad_pcb", "job_id": "j1", "commit_sha": "c0ffee"}
        with (
            mock.patch("app.services.workspace_service.workspace.get_project_by_id", return_value=self.ROW),
            mock.patch.object(reader.jobs, "project_key", return_value=key),
            mock.patch.object(reader.cli, "generator", return_value=SimpleNamespace(digest="d" * 64)),
            mock.patch.object(reader, "_stored", return_value=("b" * 64, "r" * 64, False, None)),
            mock.patch.object(reader.rows, "get_bundle", return_value=bundle),
            mock.patch.object(reader.rows, "job_status", return_value=job_status),
            mock.patch.object(reader.jobs, "start_design_bundle_job", return_value=queued) as start,
        ):
            return reader.open_revision("prj", "c0ffee", queue=True), start

    def test_a_held_failure_is_reported_and_read_as_failed(self):
        opened, start = self._open(job_status="failed", queued=None)
        start.assert_called_once()
        self.assertFalse(opened.job_active)
        self.assertEqual(opened.failure, "KiCad cannot read demo.kicad_pcb")
        with mock.patch.object(consumer.reader, "open_revision", return_value=opened):
            with self.assertRaises(DesignDataFailed):
                consumer.bundle_read("PROJECT_METADATA", "prj", "c0ffee", [PATH])

    def test_a_retry_that_was_queued_is_pending(self):
        for job_status, queued in (("failed", "job-2"), ("retry_wait", None)):
            with self.subTest(job_status=job_status):
                opened, _ = self._open(job_status=job_status, queued=queued)
                self.assertIsNone(opened.failure)
                with mock.patch.object(consumer.reader, "open_revision", return_value=opened):
                    with self.assertRaises(DesignDataPending):
                        consumer.bundle_read("PROJECT_METADATA", "prj", "c0ffee", [PATH])


if __name__ == "__main__":
    unittest.main()
