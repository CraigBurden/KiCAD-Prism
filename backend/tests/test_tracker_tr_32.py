"""TR-32: poll destination updates with durable cursors (F4, F7)."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.comments_revisions import history  # noqa: E402
from app.services.trackers.contracts import RemoteChange, UpdateCursor  # noqa: E402
from app.services.trackers.errors import ProviderError  # noqa: E402
from app.services.trackers.github_updates import (  # noqa: E402
    POLL_OVERLAP_SECONDS,
    change_delivery_id,
    change_to_hint,
    cursor_from_checkpoint,
    overlap_since,
    parse_iso8601,
)
from app.services.trackers.inbound import (  # noqa: E402
    CallableFetcher,
    apply_destination_hints,
)
from app.services.trackers.inbox_store import InboxStore  # noqa: E402
from app.services.trackers.op_store import OpStore  # noqa: E402
from app.services.trackers.poller import poll_destination_updates, scope_key  # noqa: E402
from app.services.trackers.provenance import body_hash  # noqa: E402
from app.services.trackers.store import TrackerStore  # noqa: E402
from test_tracker_tr_28 import (  # noqa: E402
    BOT_ID,
    BOT_LOGIN,
    COMMENT_ID,
    CONNECTOR,
    CONTAINER,
    EXT_COMMENT,
    ISSUE_ID,
    ISSUE_NUMBER,
    OP_REPLY,
    REPLY_ID,
    _forge_user,
    _remote_comment,
    _remote_issue,
)
from support.postgres import requires_scratch_postgres, tracker_schema, seed_comment, seed_reply  # noqa: E402

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

DOCS = Path(__file__).resolve().parents[2] / "docs" / "tracker-integration"
F4 = json.loads((DOCS / "fixtures" / "F04.json").read_text(encoding="utf-8"))
F7 = json.loads((DOCS / "fixtures" / "F07.json").read_text(encoding="utf-8"))


class GithubUpdatesUnitTests(unittest.TestCase):
    def test_overlap_rewinds_five_minutes(self) -> None:
        since = "2026-09-20T16:00:00Z"
        overlapped = overlap_since(since)
        delta = parse_iso8601(since) - parse_iso8601(overlapped)
        self.assertEqual(int(delta.total_seconds()), POLL_OVERLAP_SECONDS)

    def test_cursor_from_checkpoint_applies_overlap_and_page(self) -> None:
        cursor = cursor_from_checkpoint(
            {
                "cursor": {"since": "2026-09-20T16:00:00Z"},
                "page_cursor": "https://api.github.com/page-2",
            }
        )
        self.assertEqual(cursor.page, "https://api.github.com/page-2")
        self.assertEqual(cursor.since, overlap_since("2026-09-20T16:00:00Z"))

    def test_change_delivery_id_is_stable(self) -> None:
        change = RemoteChange(
            objectKind="issue",
            remoteContainerId=CONTAINER,
            externalId="198400412",
            observedUpdatedAt="2026-09-20T16:05:00Z",
        )
        first = change_delivery_id(connector_id=CONNECTOR, container_id=CONTAINER, change=change)
        second = change_delivery_id(connector_id=CONNECTOR, container_id=CONTAINER, change=change)
        self.assertEqual(first, second)
        self.assertTrue(first.startswith("poll:"))
        hint = change_to_hint(change, connector_id=CONNECTOR)
        self.assertEqual(hint["objectKind"], "issue")
        self.assertNotIn("actor", hint)



@requires_scratch_postgres("tracker persistence tests")
class PollPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = tracker_schema(self, "tr32")
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        self.store = TrackerStore(self.conn)
        self.ops = OpStore(self.conn)
        self.inbox = InboxStore(self.conn)
        self.store.upsert_connector(
            connector_id=CONNECTOR,
            provider="github",
            instance_kind="github.com",
            bot_forge_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
        )
        self.conn.commit()
        self.pages: list[tuple[list[RemoteChange], UpdateCursor]] = []
        self.calls: list[UpdateCursor] = []

    def _seed_project(
        self,
        *,
        project_id: str,
        comment_id: str,
        thread_id: str,
        external_id: str = ISSUE_ID,
        external_number: str | None = ISSUE_NUMBER,
    ) -> None:
        self.store.set_project_tracker(
            project_tracker_id=f"pt_{project_id}",
            project_id=project_id,
            connector_id=CONNECTOR,
            container_kind="repo",
            container_path="acme/openswitch",
            remote_container_id=CONTAINER,
            generation=2,
        )
        seed_comment(self.conn, comment_id, project_id, author="Priya", content="root content")
        self.store.insert_thread(
            thread_id=thread_id,
            comment_id=comment_id,
            project_tracker_id=f"pt_{project_id}",
            destination_generation=2,
            connector_id=CONNECTOR,
            remote_container_id=CONTAINER,
            external_id=external_id,
            external_number=external_number,
            external_url=f"https://github.com/acme/openswitch/issues/{external_number or external_id}",
        )

    def _seed_prism_reply(self, *, thread_id: str, body: str, project_id: str = "prj_a") -> None:
        seed_reply(
            self.conn,
            REPLY_ID,
            COMMENT_ID,
            project_id,
            author="Priya",
            author_kind="user",
            origin="prism",
            content=body,
            revision=1,
        )
        self.store.insert_reply_link(
            link_id="trl_1",
            tracked_thread_id=thread_id,
            reply_id=REPLY_ID,
            external_comment_id=EXT_COMMENT,
            remote_author_id=BOT_ID,
            remote_author_login=BOT_LOGIN,
        )

    def _queue_pages(self, pages: list[tuple[list[RemoteChange], UpdateCursor]]) -> None:
        self.pages = list(pages)

    def _list_updates(self, _dest, cursor: UpdateCursor):
        self.calls.append(cursor)
        if not self.pages:
            return [], UpdateCursor(since=cursor.since, page=None)
        page, next_cursor = self.pages.pop(0)
        return page, next_cursor

    def _checkpoint(self) -> dict:
        row = self.conn.execute(
            "SELECT * FROM sync_checkpoints WHERE kind = 'poll' AND scope_key = %s",
            (scope_key(CONNECTOR, CONTAINER),),
        ).fetchone()
        return dict(row) if row else {}

    def test_f7_pagination_full_advances_cursor_after_all_pages(self) -> None:
        self._queue_pages(
            [
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400411",
                            observedUpdatedAt="2026-09-20T16:01:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:01:00Z", page="page-2"),
                ),
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400412",
                            observedUpdatedAt="2026-09-20T16:02:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:02:00Z", page="page-3"),
                ),
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400413",
                            observedUpdatedAt="2026-09-20T16:03:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:03:00Z", page=None),
                ),
            ]
        )
        outcome = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertTrue(outcome.complete)
        self.assertEqual(outcome.pages_fetched, 3)
        self.assertEqual(outcome.hints_enqueued, 3)
        checkpoint = self._checkpoint()
        self.assertIsNone(checkpoint.get("page_cursor"))
        cursor = checkpoint["cursor"]
        if isinstance(cursor, str):
            cursor = json.loads(cursor)
        self.assertEqual(cursor["since"], "2026-09-20T16:03:00Z")
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) AS n FROM remote_hints").fetchone()["n"],
            3,
        )

    def test_f7_pagination_interrupted_resumes_without_duplicates(self) -> None:
        self._queue_pages(
            [
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400411",
                            observedUpdatedAt="2026-09-20T16:01:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:01:00Z", page="page-2"),
                ),
            ]
        )
        first = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
            max_pages=1,
        )
        self.conn.commit()
        self.assertFalse(first.complete)
        checkpoint = self._checkpoint()
        cursor = checkpoint["cursor"]
        if isinstance(cursor, str):
            cursor = json.loads(cursor)
        self.assertEqual(cursor["since"], "1970-01-01T00:00:00Z")
        self.assertEqual(checkpoint["page_cursor"], "page-2")
        self.assertEqual(first.hints_enqueued, 1)

        self._queue_pages(
            [
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400412",
                            observedUpdatedAt="2026-09-20T16:02:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:02:00Z", page=None),
                ),
            ]
        )
        second = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertTrue(second.complete)
        self.assertEqual(self.calls[1].page, "page-2")
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) AS n FROM remote_hints").fetchone()["n"],
            2,
        )
        cursor = self._checkpoint()["cursor"]
        if isinstance(cursor, str):
            cursor = json.loads(cursor)
        self.assertEqual(cursor["since"], "2026-09-20T16:02:00Z")

    def test_f7_pagination_interrupted_fetch_failure_keeps_cursor(self) -> None:
        self._queue_pages(
            [
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId="198400411",
                            observedUpdatedAt="2026-09-20T16:01:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:01:00Z", page="page-2"),
                ),
            ]
        )
        poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
            max_pages=1,
        )
        self.conn.commit()
        self.pages = []
        failing = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=lambda *_args: (_ for _ in ()).throw(
                ProviderError("transient", "page 2 failed", retryable=True)
            ),
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertFalse(failing.complete)
        self.assertIsNotNone(failing.error)
        checkpoint = self._checkpoint()
        cursor = checkpoint["cursor"]
        if isinstance(cursor, str):
            cursor = json.loads(cursor)
        self.assertEqual(cursor["since"], "1970-01-01T00:00:00Z")
        self.assertEqual(checkpoint["page_cursor"], "page-2")
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) AS n FROM remote_hints").fetchone()["n"],
            1,
        )

    def test_f7_poll_window_overlap_dedupes_boundary_objects(self) -> None:
        boundary = "2026-09-20T16:00:00Z"
        self.conn.execute(
            """
            INSERT INTO sync_checkpoints (kind, scope_key, cursor, last_success_at)
            VALUES ('poll', %s, %s::jsonb, NOW())
            """,
            (scope_key(CONNECTOR, CONTAINER), json.dumps({"since": boundary})),
        )
        self.conn.commit()
        change = RemoteChange(
            objectKind="issue",
            remoteContainerId=CONTAINER,
            externalId="198400412",
            observedUpdatedAt=boundary,
        )
        delivery_id = change_delivery_id(
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            change=change,
        )
        self.inbox.enqueue(
            connector_id=CONNECTOR,
            delivery_id=delivery_id,
            hints=[change_to_hint(change, connector_id=CONNECTOR)],
        )
        self.conn.commit()
        self._queue_pages([( [change], UpdateCursor(since=boundary, page=None) )])
        outcome = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertTrue(outcome.complete)
        self.assertEqual(outcome.hints_enqueued, 0)
        self.assertEqual(outcome.hints_deduplicated, 1)
        self.assertEqual(self.calls[0].since, overlap_since(boundary))

    def test_f7_shared_repo_two_projects_single_poll(self) -> None:
        self._seed_project(project_id="prj_a", comment_id=COMMENT_ID, thread_id="tt_a")
        self._seed_project(
            project_id="prj_b",
            comment_id="c_b",
            thread_id="tt_b",
            external_id="198400413",
            external_number="413",
        )
        self.conn.commit()
        self._queue_pages(
            [
                (
                    [
                        RemoteChange(
                            objectKind="issue",
                            remoteContainerId=CONTAINER,
                            externalId=ISSUE_ID,
                            observedUpdatedAt="2026-09-20T16:05:00Z",
                        )
                    ],
                    UpdateCursor(since="2026-09-20T16:05:00Z", page=None),
                ),
            ]
        )
        poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) AS n FROM remote_deliveries").fetchone()["n"],
            1,
        )
        fetcher = CallableFetcher(
            issue=lambda *_args: _remote_issue(body="issue body", state="open"),
        )
        results = apply_destination_hints(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            fetcher=fetcher,
            bot_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
        )
        self.conn.commit()
        self.assertEqual(len(results), 1)
        verified = self.conn.execute(
            "SELECT COUNT(*) AS n FROM tracked_threads WHERE last_verified_at IS NOT NULL"
        ).fetchone()["n"]
        self.assertEqual(verified, 1)

    def test_f4_unknown_editor_via_poll(self) -> None:
        self._seed_project(project_id="prj_a", comment_id=COMMENT_ID, thread_id="tt_a")
        original = "bot mirrored body"
        edited = "bot mirrored body + human fix"
        self._seed_prism_reply(thread_id="tt_a", body=original)
        self.ops.insert(
            op_id=OP_REPLY,
            tracked_thread_id="tt_a",
            op="edit_comment",
            destination_generation=2,
            expected_body_hash=body_hash(original),
        )
        self.conn.commit()
        change = RemoteChange(
            objectKind="comment",
            remoteContainerId=CONTAINER,
            externalId=ISSUE_ID,
            externalCommentId=EXT_COMMENT,
            observedUpdatedAt="2026-09-20T16:10:00Z",
        )
        self._queue_pages([( [change], UpdateCursor(since="2026-09-20T16:10:00Z", page=None) )])
        poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=self._list_updates,
            inbox=self.inbox,
        )
        self.conn.commit()
        hint = self.conn.execute(
            "SELECT * FROM remote_hints WHERE external_comment_id = %s",
            (EXT_COMMENT,),
        ).fetchone()
        self.assertIsNone(hint.get("actor_id"))
        self.assertIsNone(hint.get("actor_login"))
        fetcher = CallableFetcher(
            comment=lambda *_args: _remote_comment(
                body=edited,
                author=_forge_user(user_id=BOT_ID, login=BOT_LOGIN, is_bot=True),
            ),
        )
        apply_destination_hints(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            fetcher=fetcher,
            bot_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
        )
        self.conn.commit()
        revisions = [
            row
            for row in history(self.conn, project_id="prj_a", target_kind="reply", target_id=REPLY_ID)
            if row["changeKind"] == "edit"
        ]
        self.assertEqual(len(revisions), 1)
        self.assertEqual(revisions[0]["editorKind"], "remote_unknown")
        self.assertEqual(revisions[0]["editorDisplay"], "edited on GitHub")

    def test_rate_limited_poll_schedules_backoff(self) -> None:
        resume = "2026-09-20T17:00:00Z"
        outcome = poll_destination_updates(
            self.conn,
            connector_id=CONNECTOR,
            container_id=CONTAINER,
            container_path="acme/openswitch",
            list_updates=lambda *_args: (_ for _ in ()).throw(
                ProviderError("rate_limited", "limited", resume_at=resume, retryable=False)
            ),
            inbox=self.inbox,
        )
        self.conn.commit()
        self.assertFalse(outcome.complete)
        self.assertIsNotNone(outcome.retry_after_seconds)
        checkpoint = self._checkpoint()
        self.assertIsNotNone(checkpoint.get("next_run_at"))
        self.assertIn("rate_limited", json.dumps(checkpoint.get("last_error") or {}))


if __name__ == "__main__":
    unittest.main()
