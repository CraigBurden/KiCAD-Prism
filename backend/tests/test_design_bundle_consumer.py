"""The consumer switch and rollout fallback (`design_bundle.consumer`, ADR §8)."""

from __future__ import annotations

import unittest
from unittest import mock

from app.core.config import settings
from app.services.design_bundle import consumer
from app.services.design_bundle.manifest import Readiness

PATH = "projections/project.json"


class _Opened:
    def __init__(self, states: dict[str, str], *, absent: bool = False):
        self.absent = absent
        self._states = states
        self.read_paths: list[str] = []

    def readiness(self, paths):
        return {path: Readiness(path, self._states[path], "parse", "why") for path in paths}

    def read_json(self, path):
        self.read_paths.append(path)
        return {"schema": "prism.project.a0"}


class BundleReadTests(unittest.TestCase):
    def _read(self, opened, source="bundle"):
        with mock.patch.object(settings, "PRISM_DESIGN_SOURCE_PROJECT_METADATA", source), \
                mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
            return consumer.bundle_read("PROJECT_METADATA", "prj", "c0ffee", [PATH], requested_by="u"), open_revision

    def test_legacy_switch_never_opens_the_bundle(self):
        result, open_revision = self._read(_Opened({PATH: "ready"}), source="legacy")
        self.assertIsNone(result)
        open_revision.assert_not_called()

    def test_ready_members_are_read_and_the_job_is_queued_on_open(self):
        opened = _Opened({PATH: "ready"})
        result, open_revision = self._read(opened)
        open_revision.assert_called_once_with("prj", "c0ffee", queue=True, requested_by="u")
        self.assertIsNotNone(result)
        self.assertTrue(result.ready(PATH))
        self.assertEqual(result.json(PATH)["schema"], "prism.project.a0")

    def test_not_ready_falls_back(self):
        for state in ("pending", "unavailable", "failed"):
            with self.subTest(state=state):
                result, _ = self._read(_Opened({PATH: state}))
                self.assertIsNone(result)

    def test_final_non_members_are_the_consumers_to_handle(self):
        for state in ("skipped", "not-applicable"):
            with self.subTest(state=state):
                result, _ = self._read(_Opened({PATH: state}))
                self.assertIsNotNone(result)
                self.assertFalse(result.ready(PATH))

    def test_absent_revision_and_open_errors_fall_back(self):
        result, _ = self._read(_Opened({}, absent=True))
        self.assertIsNone(result)
        with mock.patch.object(settings, "PRISM_DESIGN_SOURCE_PROJECT_METADATA", "bundle"), \
                mock.patch.object(consumer.reader, "open_revision", side_effect=LookupError("gone")):
            self.assertIsNone(consumer.bundle_read("PROJECT_METADATA", "prj", None, [PATH]))

    def test_unknown_consumer_is_an_error(self):
        with self.assertRaises(ValueError):
            consumer.source("NOPE")


if __name__ == "__main__":
    unittest.main()
