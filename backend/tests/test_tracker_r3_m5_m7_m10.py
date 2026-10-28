"""Focused coverage for R3-M5 / M7 / M8 / M10 hygiene fixes."""

from __future__ import annotations

import logging
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.trackers.drafts import (  # noqa: E402
    guard_generated_text_no_email,
    generated_text_contains_email,
)
from app.services.trackers.identity_service import validate_relative_return_to  # noqa: E402
from app.services.trackers.publication_policy import PublicationPolicyService  # noqa: E402
from app.services.trackers.reply_executor import _reply_attribution  # noqa: E402
from app.services.trackers.migrations import migrate_workspace_tracker_tables  # noqa: E402
from app.services.trackers.store import issue_number_for_api  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema  # noqa: E402


class DraftEmailGuardTests(unittest.TestCase):
    def test_guard_rejects_email(self) -> None:
        self.assertTrue(generated_text_contains_email("ops@example.com"))
        with self.assertRaisesRegex(ValueError, "email"):
            guard_generated_text_no_email("hello ops@example.com", what="reply attribution")

    def test_reply_attribution_omits_email_authors(self) -> None:
        with self.assertLogs("app.services.trackers.reply_executor", level="WARNING") as captured:
            line = _reply_attribution({"id": "r1", "author": "ops@example.com"})
        self.assertIsNone(line)
        self.assertTrue(any("email" in message.lower() for message in captured.output))

    def test_reply_attribution_escapes_safe_authors(self) -> None:
        line = _reply_attribution({"id": "r1", "author": "Priya <ops>"})
        self.assertEqual(line, "*Priya &lt;ops&gt;* (via Prism)")


class IssueNumberFallbackTests(unittest.TestCase):
    def test_fallback_logs_when_external_number_missing(self) -> None:
        with self.assertLogs("app.services.trackers.store", level="WARNING") as captured:
            value = issue_number_for_api({"id": "tt_1", "external_id": "412", "external_number": None})
        self.assertEqual(value, "412")
        self.assertTrue(any("missing external_number" in message for message in captured.output))

    def test_prefers_external_number_without_warning(self) -> None:
        with self.assertNoLogs("app.services.trackers.store", level="WARNING"):
            value = issue_number_for_api({"id": "tt_1", "external_id": "node", "external_number": "9"})
        self.assertEqual(value, "9")


class ReturnToValidationTests(unittest.TestCase):
    def test_rejects_backslash_and_control_chars(self) -> None:
        self.assertEqual(validate_relative_return_to("/ok/path"), "/ok/path")
        self.assertEqual(validate_relative_return_to("/evil\\windows"), "/")
        self.assertEqual(validate_relative_return_to("/has\nnewline"), "/")
        self.assertEqual(validate_relative_return_to("/has\x00null"), "/")
        self.assertEqual(validate_relative_return_to("//evil.example"), "/")
        self.assertEqual(validate_relative_return_to("https://evil.example/"), "/")


@requires_scratch_postgres("tracker persistence tests")
class ObserveBeforeWriteTxnTests(unittest.TestCase):
    """R3-M10: observe_container must run before the settings write transaction."""

    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "r3m10", then=(migrate_workspace_tracker_tables,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        self.conn.execute("INSERT INTO tracker_connectors (id, provider, instance_kind) VALUES ('cn_1', 'github', 'github.com')")
        self.conn.commit()
        self.events: list[str] = []

        @contextmanager
        def connect():
            with self.scratch.connection() as conn:
                self.events.append("conn_open")
                try:
                    yield conn
                finally:
                    self.events.append("conn_close")

        def observe(connector_id, **kwargs):
            self.events.append("observe")
            open_count = self.events.count("conn_open") - self.events.count("conn_close")
            self.assertEqual(open_count, 0, "observe_container must run outside the write txn")
            return {
                "visibility": "private",
                "containerPath": kwargs.get("container_path") or "acme/repo",
                "remoteContainerId": kwargs.get("remote_container_id") or "42",
            }

        connectors = MagicMock()
        connectors.observe_container.side_effect = observe
        connectors.get.return_value = {"id": "cn_1", "paused": False, "pausedReason": None}
        self.service = PublicationPolicyService(connect=connect, connector_service=connectors)

    def test_observe_runs_between_read_and_write_connections(self) -> None:
        self.service.update_settings(
            "prj_1",
            actor_user_id="u_1",
            connector_id="cn_1",
            destination={
                "containerKind": "repo",
                "containerPath": "acme/repo",
                "remoteContainerId": "42",
                "visibility": "private",
            },
        )
        self.assertEqual(
            self.events,
            ["conn_open", "conn_close", "observe", "conn_open", "conn_close"],
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    unittest.main()
