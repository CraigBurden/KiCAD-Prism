"""SB2-94: long builds run outside the system lock, so other editors are not queued behind them."""

from __future__ import annotations

import threading
import time
import unittest
from unittest import mock

from test_system_exports import ExportCase
from test_system_snapshots import DESIGNER

from app.services.systems.store import StaleVersion

WAIT_S = 10.0


class LockScopeTest(ExportCase):
    def hold_builds(self, method: str = "_build"):
        """Patch ``method`` (the document build, or the export response) so each call signals ``built``
        and then waits for ``go``."""
        built, go = threading.Event(), threading.Event()
        original = getattr(self.service, method)

        def slow(*args, **kwargs):
            result = original(*args, **kwargs)
            built.set()
            if not go.wait(WAIT_S):
                raise AssertionError("the test never released the build")
            return result

        return built, go, mock.patch.object(self.service, method, side_effect=slow)

    def run_in_thread(self, fn):
        outcome: dict = {}

        def target():
            try:
                outcome["value"] = fn()
            except BaseException as error:  # reported to the main thread
                outcome["error"] = error

        thread = threading.Thread(target=target)
        thread.start()
        return thread, outcome

    def edit(self) -> float:
        """Rename the system and return how long it took."""
        started = time.monotonic()
        self.service.update_system(DESIGNER, self.sid, self.version(), {"description": "edited"})
        return time.monotonic() - started

    def test_an_edit_during_a_snapshot_build_goes_through_and_the_snapshot_is_refused(self) -> None:
        version = self.version()
        built, go, patch = self.hold_builds()
        with patch:
            thread, outcome = self.run_in_thread(
                lambda: self.service.create_snapshot(DESIGNER, self.sid, version, "CDR", ""))
            self.assertTrue(built.wait(WAIT_S))
            took = self.edit()  # the build is still running: the old code held the lock here
            go.set()
            thread.join(WAIT_S)
        self.assertLess(took, 2.0)
        # The snapshot was built at the old version; storing it now would mislabel it.
        self.assertIsInstance(outcome.get("error"), StaleVersion)
        self.assertEqual(self.store.list_snapshots(self.sid), [])

    def test_a_snapshot_with_no_edit_in_between_is_stored(self) -> None:
        version = self.version()
        built, go, patch = self.hold_builds()
        with patch:
            thread, outcome = self.run_in_thread(
                lambda: self.service.create_snapshot(DESIGNER, self.sid, version, "CDR", ""))
            self.assertTrue(built.wait(WAIT_S))
            go.set()
            thread.join(WAIT_S)
        self.assertNotIn("error", outcome)
        self.assertEqual([s["name"] for s in self.store.list_snapshots(self.sid)], ["CDR"])
        self.assertEqual(self.version(), version)  # a snapshot never bumps the version

    def test_an_edit_during_an_export_response_build_goes_through(self) -> None:
        built, go, patch = self.hold_builds("_export_entries")  # AC-16: the response reads the entry only
        with patch:
            thread, outcome = self.run_in_thread(lambda: self.export())
            self.assertTrue(built.wait(WAIT_S))  # the export is committed; its response is being built
            took = self.edit()
            go.set()
            thread.join(WAIT_S)
        self.assertLess(took, 2.0)
        self.assertNotIn("error", outcome)
        self.assertEqual(outcome["value"]["name"], "DEBUG")


if __name__ == "__main__":
    unittest.main()
