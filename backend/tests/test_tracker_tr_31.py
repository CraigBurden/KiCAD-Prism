"""TR-31: observed state and pending-intent reconciliation (F6, D1)."""

from __future__ import annotations

import json
import sys
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.comments_revisions import Editor, set_root_status  # noqa: E402
from app.services.trackers.capabilities import ProviderCapabilities  # noqa: E402
from app.services.trackers.contracts import (  # noqa: E402
    ForgeUser,
    IssueContainerRef,
    RemoteEvent,
    RemoteIssue,
    RemoteVersion,
)
from app.services.trackers.migrations import migrate_workspace_tracker_tables  # noqa: E402
from app.services.trackers.op_store import OpStore, apply_schema as apply_op_schema  # noqa: E402
from app.services.trackers.promotion import PromotionActor  # noqa: E402
from app.services.trackers.publication_policy import PublicationDenied  # noqa: E402
from app.services.trackers.state_mutations import (  # noqa: E402
    analyze_state_events,
    enqueue_set_state,
    preflight_mismatch,
    versions_match,
)
from app.services.trackers.store import TrackerStore  # noqa: E402
from app.services.trackers.create_executor import execute_claimed_op  # noqa: E402
from tracker_fault_harness import install_fake_provider  # noqa: E402
from app.services.comments_schema_migrations import COMMENTS_LEDGER  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema, seed_comment  # noqa: E402

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

DOCS = Path(__file__).resolve().parents[2] / "docs" / "tracker-integration"
F6 = json.loads((DOCS / "fixtures" / "F06.json").read_text(encoding="utf-8"))

CONNECTOR = "cn_gh1"
CONTAINER = "987654321"
REPO = "acme/openswitch"
ISSUE_ID = "198400412"
ISSUE_NUMBER = 412
BOT_ID = "199001"
BOT_LOGIN = "prism[bot]"
HUMAN_LOGIN = "arjun-gh"
HUMAN_ID = "5550001"
COMMENT_ID = "c_8f3a1b2c"
THREAD_ID = "tt_a"




def _issue(
    *,
    state: str = "open",
    updated_at: str = "2026-09-20T15:42:11Z",
    etag: str = "W/1",
) -> RemoteIssue:
    return RemoteIssue(
        externalId=ISSUE_ID,
        url=f"https://github.com/{REPO}/issues/{ISSUE_NUMBER}",
        number=ISSUE_NUMBER,
        title="State fixture",
        body="body",
        state=state,  # type: ignore[arg-type]
        labels=["prism"],
        assignees=[],
        author=ForgeUser(id=BOT_ID, login=BOT_LOGIN, isBot=True),
        version=RemoteVersion(updatedAt=updated_at, etag=etag),
        container=IssueContainerRef(remoteContainerId=CONTAINER, path=REPO),
    )


class FakeIssueAdapter:
    """Scripted F6 forge: the event list is exactly what each case declares.

    ``StatefulFakeForge`` records its own bot events on ``set_state``; the F6
    postflight cases need the remote history to stay as scripted.
    """

    def __init__(self, *, has_state_events: bool = True) -> None:
        self.has_state_events = has_state_events
        self.issues: dict[str, RemoteIssue] = {}
        self.events: list[RemoteEvent] = []
        self.set_state_calls: list[str] = []

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider="github",
            canEditOwnComment=True,
            canDeleteOwnComment=True,
            canEditIssueBody=True,
            hasStateEvents=self.has_state_events,
            hasTransferEvents=True,
            supportsConditionalGet=True,
            maxAssignees=10,
            apiVersion="2022-11-28",
            instanceKind="github.com",
        )

    def get_issue(self, _dest, _ext_id, etag=None):  # noqa: ANN001
        key = str(_ext_id)
        issue = self.issues.get(key) or self.issues.get(str(ISSUE_NUMBER)) or _issue()
        return issue

    def set_state(self, _dest, _ext_id, state, note):  # noqa: ANN001
        del note
        self.set_state_calls.append(state)
        current = self.get_issue(_dest, _ext_id, etag=None)
        assert isinstance(current, RemoteIssue)
        next_version = RemoteVersion(
            updatedAt=f"2026-09-20T16:0{len(self.set_state_calls)}:00Z",
            etag=f"W/{len(self.set_state_calls)}",
        )
        updated = current.model_copy(update={"state": state, "version": next_version})
        self.issues[str(_ext_id)] = updated
        self.issues[str(ISSUE_NUMBER)] = updated
        return updated

    def list_events(self, _dest, _ext_id):  # noqa: ANN001
        return list(self.events)



@requires_scratch_postgres("tracker persistence tests")
class StateReconciliationPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "tr31", ledgers=(COMMENTS_LEDGER,), then=(migrate_workspace_tracker_tables, apply_op_schema,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        self.store = TrackerStore(self.conn)
        self.ops = OpStore(self.conn)
        self.adapter = FakeIssueAdapter()
        self._seed_destination()

        @contextmanager
        def factory():
            conn = self.scratch.connect()
            try:
                yield conn
            finally:
                conn.close()

        provider = install_fake_provider(self.adapter, factory)
        provider.__enter__()
        self.addCleanup(provider.__exit__, None, None, None)

    def _seed_destination(self) -> None:
        self.store.upsert_connector(
            connector_id=CONNECTOR,
            provider="github",
            instance_kind="github.com",
            bot_forge_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
            credential_envelope="test-envelope",
        )
        self.store.set_project_tracker(
            project_tracker_id="pt_a",
            project_id="prj_a",
            connector_id=CONNECTOR,
            container_kind="repo",
            container_path=REPO,
            remote_container_id=CONTAINER,
            generation=2,
            visibility="private",
        )
        self.store.acknowledge_destination(
            ack_id="ack_priv",
            connector_id=CONNECTOR,
            remote_container_id=CONTAINER,
            visibility="private",
            acknowledged_by="u_admin",
        )

    def _seed_linked_thread(
        self,
        *,
        status: str = "OPEN",
        remote_state: str = "open",
        remote_version: dict | None = None,
    ) -> None:
        version = remote_version or {"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"}
        seed_comment(
            self.conn,
            COMMENT_ID,
            "prj_a",
            author="Priya",
            content="root",
            status=status,
            anchor_commit="abc123",
            revision=1,
        )
        self.store.insert_thread(
            thread_id=THREAD_ID,
            comment_id=COMMENT_ID,
            project_tracker_id="pt_a",
            destination_generation=2,
            connector_id=CONNECTOR,
            remote_container_id=CONTAINER,
            external_id=ISSUE_ID,
            external_number=str(ISSUE_NUMBER),
            external_url=f"https://github.com/{REPO}/issues/{ISSUE_NUMBER}",
            link_state="linked",
        )
        self.conn.execute(
            """
            UPDATE tracked_threads
            SET remote_state = %s, remote_version = %s::jsonb
            WHERE id = %s
            """,
            (remote_state, json.dumps(version), THREAD_ID),
        )
        self.adapter.issues[str(ISSUE_NUMBER)] = _issue(state=remote_state, updated_at=version["updatedAt"], etag=version["etag"])

    def _insert_set_state_op(self, *, expected_state: str | None, expected_version: dict | None) -> dict:
        op_id = f"op_state_{uuid.uuid4().hex[:8]}"
        self.ops.insert(
            op_id=op_id,
            tracked_thread_id=THREAD_ID,
            op="set_state",
            destination_generation=2,
            local_revision=2,
            actor_user_id="u_designer",
            expected_remote_state=expected_state,
            expected_remote_version=expected_version,
        )
        claimed = self.ops.claim("worker-a")
        self.assertIsNotNone(claimed)
        self.ops.mark_sent(claimed["id"], claimed["fence"])
        self.conn.commit()
        return claimed

    def test_f6_clean_close(self) -> None:
        self._seed_linked_thread(status="RESOLVED", remote_state="open")
        self.adapter.events = [
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e1",
                event="closed",
                createdAt="2026-09-20T16:00:00Z",
                actor=ForgeUser(id=BOT_ID, login=BOT_LOGIN, isBot=True),
            )
        ]
        claimed = self._insert_set_state_op(
            expected_state="open",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        op = self.ops.get(claimed["id"])
        thread = self.conn.execute("SELECT remote_state, remote_version FROM tracked_threads WHERE id = %s", (THREAD_ID,)).fetchone()
        self.assertEqual(op["state"], "confirmed")
        self.assertEqual(thread["remote_state"], "closed")
        self.assertEqual(self.adapter.set_state_calls, ["closed"])

    def test_f6_close_vs_remote_reopen_preflight(self) -> None:
        self._seed_linked_thread(
            status="RESOLVED",
            remote_state="open",
            remote_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        self.adapter.issues[str(ISSUE_NUMBER)] = _issue(
            state="open",
            updated_at="2026-09-20T16:05:00Z",
            etag="W/3",
        )
        # Fixture: remote reopened→closed→reopened since the snapshot.
        self.adapter.events = [
                RemoteEvent(
                    externalId=str(ISSUE_NUMBER),
                    eventId="e1",
                    event="reopened",
                    createdAt="2026-09-20T15:50:00Z",
                    actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
                ),
                RemoteEvent(
                    externalId=str(ISSUE_NUMBER),
                    eventId="e2",
                    event="closed",
                    createdAt="2026-09-20T15:55:00Z",
                    actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
                ),
                RemoteEvent(
                    externalId=str(ISSUE_NUMBER),
                    eventId="e3",
                    event="reopened",
                    createdAt="2026-09-20T16:05:00Z",
                    actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
                ),
        ]
        claimed = self._insert_set_state_op(
            expected_state="open",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        comment = self.conn.execute("SELECT status FROM comments WHERE id = %s", (COMMENT_ID,)).fetchone()
        notes = self.conn.execute(
            "SELECT content FROM comment_replies WHERE comment_id = %s AND author_kind = 'system'",
            (COMMENT_ID,),
        ).fetchall()
        self.assertEqual(self.ops.get(claimed["id"])["state"], "superseded")
        self.assertEqual(comment["status"], "OPEN")
        self.assertEqual(len(notes), 1)
        self.assertEqual(self.adapter.set_state_calls, [])

    def test_f6_same_state_remote_transition(self) -> None:
        self._seed_linked_thread(
            status="RESOLVED",
            remote_state="closed",
            remote_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        self.adapter.issues[str(ISSUE_NUMBER)] = _issue(
            state="closed",
            updated_at="2026-09-20T16:05:00Z",
            etag="W/3",
        )
        # Fixture: remote reopened then closed again (v3) — a human transition.
        self.adapter.events = [
                RemoteEvent(
                    externalId=str(ISSUE_NUMBER),
                    eventId="e1",
                    event="reopened",
                    createdAt="2026-09-20T15:50:00Z",
                    actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
                ),
                RemoteEvent(
                    externalId=str(ISSUE_NUMBER),
                    eventId="e2",
                    event="closed",
                    createdAt="2026-09-20T16:05:00Z",
                    actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
                ),
        ]
        claimed = self._insert_set_state_op(
            expected_state="closed",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        thread = self.conn.execute("SELECT remote_version FROM tracked_threads WHERE id = %s", (THREAD_ID,)).fetchone()
        self.assertEqual(self.ops.get(claimed["id"])["state"], "superseded")
        self.assertEqual(thread["remote_version"]["etag"], "W/3")
        self.assertEqual(self.adapter.set_state_calls, [])

    def test_f6_own_comment_bumps_version_without_state_change(self) -> None:  # TR-46 live
        # Prism's reply landed after the snapshot (updated_at moved) but the
        # state is unchanged and no human touched it: the intent must proceed.
        self._seed_linked_thread(
            status="RESOLVED",
            remote_state="open",
            remote_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        self.adapter.issues[str(ISSUE_NUMBER)] = _issue(
            state="open",
            updated_at="2026-09-20T16:05:00Z",
            etag="W/3",
        )
        self.adapter.events = [
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e-old",
                event="reopened",
                createdAt="2026-09-20T15:00:00Z",
                actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN, isBot=False),
            ),
        ]
        claimed = self._insert_set_state_op(
            expected_state="open",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        self.assertEqual(self.ops.get(claimed["id"])["state"], "confirmed")
        self.assertEqual(self.adapter.set_state_calls, ["closed"])
        notes = self.conn.execute(
            "SELECT content FROM comment_replies WHERE comment_id = %s AND author_kind = 'system'",
            (COMMENT_ID,),
        ).fetchall()
        self.assertEqual(notes, [])

    def test_f6_remote_edit_between_get_and_patch(self) -> None:
        self._seed_linked_thread(status="RESOLVED", remote_state="open")
        self.adapter.events = [
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e-human",
                event="reopened",
                createdAt="2026-09-20T16:00:00Z",
                actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN),
            ),
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e-bot",
                event="closed",
                createdAt="2026-09-20T16:00:00Z",
                actor=ForgeUser(id=BOT_ID, login=BOT_LOGIN, isBot=True),
            ),
        ]
        claimed = self._insert_set_state_op(
            expected_state="open",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        comment = self.conn.execute("SELECT status FROM comments WHERE id = %s", (COMMENT_ID,)).fetchone()
        notes = self.conn.execute(
            "SELECT content FROM comment_replies WHERE comment_id = %s AND author_kind = 'system'",
            (COMMENT_ID,),
        ).fetchall()
        self.assertEqual(comment["status"], "OPEN")
        self.assertEqual(self.adapter.set_state_calls, ["closed", "open"])
        self.assertEqual(len(notes), 1)
        self.assertIn(HUMAN_LOGIN, notes[0]["content"])

    def test_f6_unknown_expectation(self) -> None:
        self._seed_linked_thread(status="RESOLVED", remote_state="open")
        self.conn.execute(
            "UPDATE tracked_threads SET remote_version = NULL, remote_state = 'open' WHERE id = %s",
            (THREAD_ID,),
        )
        claimed = self._insert_set_state_op(expected_state=None, expected_version=None)
        execute_claimed_op(claimed)
        self.conn.commit()
        self.assertEqual(self.ops.get(claimed["id"])["state"], "superseded")
        self.assertEqual(self.adapter.set_state_calls, [])

    def test_f6_no_events_capability(self) -> None:
        self.adapter.has_state_events = False
        self._seed_linked_thread(status="RESOLVED", remote_state="open")
        claimed = self._insert_set_state_op(
            expected_state="open",
            expected_version={"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        )
        execute_claimed_op(claimed)
        self.conn.commit()
        op = self.ops.get(claimed["id"])
        self.assertEqual(op["state"], "confirmed")
        last_error = op["last_error"]
        if isinstance(last_error, str):
            last_error = json.loads(last_error)
        self.assertEqual(last_error["message"], "postflight=unsupported")

    def test_f6_two_rapid_local_intents(self) -> None:
        self._seed_linked_thread(status="OPEN", remote_state="open")
        actor = PromotionActor(user_id="u_designer", role="designer")
        close_revision = set_root_status(
            self.conn,
            project_id="prj_a",
            comment_id=COMMENT_ID,
            status="RESOLVED",
            editor=Editor(user_id="u_designer", kind="user", display="Designer"),
            expected_revision=1,
        )
        enqueue_set_state(
            self.conn,
            project_id="prj_a",
            comment_id=COMMENT_ID,
            actor=actor,
            local_revision=close_revision,
            workspace_schema=self.schema,
        )
        open_revision = set_root_status(
            self.conn,
            project_id="prj_a",
            comment_id=COMMENT_ID,
            status="OPEN",
            editor=Editor(user_id="u_designer", kind="user", display="Designer"),
            expected_revision=close_revision,
        )
        enqueue_set_state(
            self.conn,
            project_id="prj_a",
            comment_id=COMMENT_ID,
            actor=actor,
            local_revision=open_revision,
            workspace_schema=self.schema,
        )
        self.conn.commit()
        first = self.ops.claim("worker-a")
        self.assertIsNotNone(first)
        self.ops.mark_sent(first["id"], first["fence"])
        self.conn.commit()
        execute_claimed_op(first)
        self.conn.commit()
        second = self.ops.claim("worker-a")
        self.assertIsNotNone(second)
        self.ops.mark_sent(second["id"], second["fence"])
        self.conn.commit()
        execute_claimed_op(second)
        self.conn.commit()
        notes = self.conn.execute(
            "SELECT COUNT(*) AS n FROM comment_replies WHERE comment_id = %s AND author_kind = 'system'",
            (COMMENT_ID,),
        ).fetchone()
        self.assertEqual(self.ops.get(first["id"])["state"], "confirmed")
        self.assertEqual(self.ops.get(second["id"])["state"], "confirmed")
        self.assertEqual(self.adapter.set_state_calls, ["closed", "open"])
        self.assertEqual(notes["n"], 0)

    def test_f6_equal_coarse_timestamps_use_event_order(self) -> None:
        events = [
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e-human",
                event="reopened",
                createdAt="2026-09-20T16:00:00Z",
                actor=ForgeUser(id=HUMAN_ID, login=HUMAN_LOGIN),
            ),
            RemoteEvent(
                externalId=str(ISSUE_NUMBER),
                eventId="e-bot",
                event="closed",
                createdAt="2026-09-20T16:00:00Z",
                actor=ForgeUser(id=BOT_ID, login=BOT_LOGIN, isBot=True),
            ),
        ]
        outcome, editor, human_state = analyze_state_events(
            events,
            bot_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
        )
        self.assertEqual((outcome, human_state), ("human_precedes", "open"))
        self.assertIn(HUMAN_LOGIN, editor.display if editor else "")

    def test_f6_clock_skew_does_not_use_timestamps(self) -> None:
        thread = {
            "remote_state": "open",
            "remote_version": {"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"},
        }
        fetched = _issue(state="open", updated_at="2026-09-20T05:42:11Z", etag="W/3")
        self.assertTrue(preflight_mismatch(thread, fetched))
        self.assertFalse(versions_match(thread["remote_version"], fetched.version))

    def test_f6_viewer_resolve_refused(self) -> None:
        self._seed_linked_thread()
        actor = PromotionActor(user_id="u_viewer", role="viewer")
        with self.assertRaises(PublicationDenied):
            enqueue_set_state(
                self.conn,
                project_id="prj_a",
                comment_id=COMMENT_ID,
                actor=actor,
                local_revision=2,
                workspace_schema=self.schema,
            )

    def test_versions_match_is_opaque_equality(self) -> None:
        left = {"updatedAt": "2026-09-20T15:42:11Z", "etag": "W/1"}
        right = RemoteVersion(updatedAt="2026-09-20T15:42:11Z", etag="W/1")
        self.assertTrue(versions_match(left, right))


if __name__ == "__main__":
    unittest.main()
