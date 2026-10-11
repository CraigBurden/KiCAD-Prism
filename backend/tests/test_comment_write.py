"""Every comment write streams its change in the same transaction.

``docs/architecture/live-comments.md``: all mutations, local and
tracker-origin, append a change event inside the transaction that changes the
comment. These tests pin, per write, the change kinds a viewer's stream
receives, so a refactor of the write path cannot drop or add one.
"""

from __future__ import annotations

import re
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import comment_live_events  # noqa: E402
from app.services.comments_revisions import Editor  # noqa: E402
from app.services.trackers.contracts import ForgeUser, RemoteComment, RemoteVersion  # noqa: E402
from app.services.trackers.op_store import OpStore  # noqa: E402
from app.services.trackers.store import TrackerStore  # noqa: E402
from tests.test_tracker_tr_01 import (  # noqa: E402
    POSTGRES_URL,
    SHARED_APPLICATION_DATABASE,
    DisposableSchemaStore,
    psycopg,
)

APP = Path(__file__).resolve().parents[1] / "app"
AUTHOR = Editor(user_id="u_a", kind="user", display="Author")


class _StoreCase(unittest.TestCase):
    def setUp(self) -> None:
        self.schema = f"comments_write_{uuid.uuid4().hex[:12]}"
        self.store = DisposableSchemaStore(self.schema)
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.path = self.tempdir.name
        self.project_id = "prj_test"
        self.addCleanup(self._drop_schema)
        self.store.initialize()

    def _drop_schema(self) -> None:
        with self.store._connect() as conn:
            conn.execute(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE')
            conn.commit()

    def _cursor(self) -> int:
        with self.store._connect() as conn:
            return comment_live_events.current_cursor(conn, self.project_id)

    def _kinds_after(self, cursor: int) -> list[str]:
        with self.store._connect() as conn:
            return [event["changeKind"] for event in comment_live_events.changes_after(conn, self.project_id, cursor)]

    def streamed(self, write) -> list[str]:
        before = self._cursor()
        write()
        return self._kinds_after(before)

    def _root(self, **kwargs) -> dict:
        return self.store.create_comment(
            self.project_id, self.path, "PCB", {"x": 1, "y": 2}, "Root", "Author",
            author_user_id="u_a", **kwargs,
        )

    def _linked_thread(self, comment_id: str) -> None:
        with self.store._connect() as conn:
            conn.execute(
                """INSERT INTO tracked_threads
                   (id, comment_id, project_tracker_id, destination_generation,
                    connector_id, remote_container_id, external_id, link_state)
                   VALUES ('t1', %s, 'destination', 1, 'connector', 'repository', 'node-1', 'linked')""",
                (comment_id,),
            )
            conn.commit()


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required")
@unittest.skipUnless(psycopg is not None, "psycopg is required")
@unittest.skipIf(SHARED_APPLICATION_DATABASE, "TEST_POSTGRES_URL must not target PRISM_DATABASE_URL")
class EveryWriteStreamsTests(_StoreCase):
    def test_local_writes_stream_their_change(self) -> None:
        created: dict = {}
        self.assertEqual(self.streamed(lambda: created.update(self._root())), ["upsert"])
        cid = created["id"]
        reply: dict = {}

        def add_reply() -> None:
            _, payload = self.store.add_reply(self.project_id, self.path, cid, "Reply", "Author", author_user_id="u_a")
            reply.update(payload)

        cases = [
            ("add_reply", add_reply, ["upsert"]),
            ("patch content", lambda: self.store.patch_comment(
                self.project_id, self.path, cid, AUTHOR, content="Edited"), ["upsert"]),
            ("patch content and status", lambda: self.store.patch_comment(
                self.project_id, self.path, cid, AUTHOR, content="Again", status="RESOLVED"), ["upsert", "upsert"]),
            ("pin", lambda: self.store.pin_comment_anchor(
                self.project_id, self.path, cid, AUTHOR, commit="a" * 40, source_revision_key=None), ["upsert"]),
            ("reattach", lambda: self.store.reattach_comment(
                self.project_id, self.path, cid, commit="b" * 40, location={"x": 3, "y": 4},
                element_id=None, relative_point=None, file_path=None, editor=AUTHOR,
                expected_revision=self._revision(cid)), ["anchor"]),
            ("edit_reply", lambda: self.store.edit_reply(
                self.project_id, self.path, cid, reply["id"], "Reply edited", AUTHOR, None), ["upsert"]),
            ("reaction", lambda: self.store.set_reaction(
                self.project_id, self.path, cid, None, user_id="u_a", user_display="Author",
                reaction="thumbs_up", present=True), ["upsert"]),
            ("unchanged reaction", lambda: self.store.set_reaction(
                self.project_id, self.path, cid, None, user_id="u_a", user_display="Author",
                reaction="thumbs_up", present=True), []),
            ("delete_reply", lambda: self.store.delete_reply(
                self.project_id, self.path, cid, reply["id"], AUTHOR), ["upsert"]),
        ]
        for name, write, expected in cases:
            with self.subTest(name):
                self.assertEqual(self.streamed(write), expected)

        self.store.add_reply(self.project_id, self.path, cid, "Second", "Author", author_user_id="u_a")
        with self.subTest("delete root with a live reply"):
            self.assertEqual(
                self.streamed(lambda: self.store.delete_comment(self.project_id, self.path, cid, AUTHOR)),
                ["delete", "upsert"],
            )

    def test_comparison_writes_carry_the_pair(self) -> None:
        created = self._root(scope="comparison", base_commit="a" * 40, compare_commit="b" * 40)
        self.store.add_reply(self.project_id, self.path, created["id"], "Reply", "Author")
        with self.store._connect() as conn:
            events = comment_live_events.changes_after(conn, self.project_id, 0)
        self.assertEqual([(e["scope"], e["baseCommit"], e["compareCommit"]) for e in events],
                         [("comparison", "a" * 40, "b" * 40)] * 2)

    def _revision(self, comment_id: str) -> int:
        return int(self.store.get_comment(self.project_id, self.path, comment_id)["revision"])

    def test_tracker_replies_stream_their_change(self) -> None:
        from app.services.trackers import inbound, state_mutations

        cid = self._root()["id"]
        self._linked_thread(cid)
        remote = RemoteComment(
            externalCommentId="ec-1", externalId="node-1", url="https://forge.test/c/1", body="From the forge",
            author=ForgeUser(id="9", login="octo"), version=RemoteVersion(),
        )

        def inbound_reply() -> None:
            with self.store._connect() as conn:
                thread = conn.execute(
                    "SELECT t.*, c.project_id FROM tracked_threads t JOIN comments c ON c.id = t.comment_id WHERE t.id = 't1'"
                ).fetchone()
                inbound._insert_remote_reply(conn, thread=thread, comment=remote, store=TrackerStore(conn))
                conn.commit()

        def system_note() -> None:
            with self.store._connect() as conn:
                state_mutations.append_system_note(conn, project_id=self.project_id, comment_id=cid, content="Closed")
                conn.commit()

        # The inbound reply's create revision streams an upsert; its link row
        # streams a projection through the tracked_replies trigger.
        self.assertEqual(self.streamed(inbound_reply), ["upsert", "projection"])
        self.assertEqual(self.streamed(system_note), ["upsert"])
        thread = self.store.get_comment(self.project_id, self.path, cid)
        remote_reply, note = thread["replies"]
        self.assertEqual((remote_reply["authorKind"], remote_reply["origin"], remote_reply["content"]),
                         ("remote", "remote", "From the forge"))
        self.assertEqual((note["authorKind"], note["origin"], note["author"]), ("system", "prism", "System"))


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required")
@unittest.skipUnless(psycopg is not None, "psycopg is required")
@unittest.skipIf(SHARED_APPLICATION_DATABASE, "TEST_POSTGRES_URL must not target PRISM_DATABASE_URL")
class ReplySyncStateTests(_StoreCase):
    """``sync_state`` lives on ``comment_replies``, which has no trigger.

    The reply executor clears it with no explicit event; what streams the
    clear is the same transaction's ``sync_ops`` confirm (and link rows),
    whose projection trigger appends the event.
    """

    def _unsynced_reply(self) -> tuple[str, str]:
        cid = self._root()["id"]
        self._linked_thread(cid)
        _, reply = self.store.add_reply(self.project_id, self.path, cid, "Viewer reply", "Viewer")
        with self.store._connect() as conn:
            conn.execute("UPDATE comment_replies SET sync_state = 'unsynced_local' WHERE id = %s", (reply["id"],))
            conn.execute(
                """INSERT INTO sync_ops (id, tracked_thread_id, op, state, destination_generation, fence)
                   VALUES ('op-r', 't1', 'add_comment', 'sent', 1, 1)"""
            )
            conn.commit()
        return cid, reply["id"]

    def test_comment_replies_have_no_trigger(self) -> None:
        _, reply_id = self._unsynced_reply()
        before = self._cursor()
        with self.store._connect() as conn:
            conn.execute("UPDATE comment_replies SET sync_state = NULL WHERE id = %s", (reply_id,))
            conn.commit()
        self.assertEqual(self._kinds_after(before), [])

    def test_executor_clear_streams_through_the_tracker_trigger(self) -> None:
        from app.services.trackers import reply_executor

        cid, reply_id = self._unsynced_reply()
        remote = RemoteComment(
            externalCommentId="ec-9", externalId="node-1", url="https://forge.test/c/9", body="x",
            author=ForgeUser(id="1", login="prism-bot"), version=RemoteVersion(),
        )
        before = self._cursor()
        with self.store._connect() as conn:
            with conn.transaction():
                reply_executor._confirm_reply_link(
                    conn, TrackerStore(conn), thread_id="t1", reply_id=reply_id, remote=remote,
                    op_id="op-r", fence=1, ops=OpStore(conn), connector={"id": "connector"},
                    container_path="org/repo", issue_number="1",
                )
                # Inside the transaction: the clear is not visible to others yet,
                # and neither is its event.
                in_tx = [e["changeKind"] for e in comment_live_events.changes_after(conn, self.project_id, before)]
        self.assertTrue(in_tx and set(in_tx) == {"projection"})
        self.assertEqual(self._kinds_after(before), in_tx)
        reply = self.store.get_reply(self.project_id, cid, reply_id)
        self.assertNotIn("syncState", reply)


class NoRawCommentWritesOutsideTheWriteModuleTests(unittest.TestCase):
    """Trackers and routes write comment rows only through the write module."""

    WRITE = re.compile(r"(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(comments|comment_replies)\b", re.IGNORECASE)
    ALLOWED = {
        "services/comment_write.py",
        "services/comments_revisions.py",
        "services/comments_store_writes.py",
        "services/comments_store_service.py",  # project deletion (hard delete)
        "services/comments_store_codec.py",  # comments.json import
        "services/comments_schema_migrations.py",
        "services/comments_store_schema.py",
    }

    def test_only_the_write_module_writes_comment_rows(self) -> None:
        offenders = []
        for path in sorted(APP.rglob("*.py")):
            rel = path.relative_to(APP).as_posix()
            if rel in self.ALLOWED:
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if self.WRITE.search(line):
                    offenders.append(f"{rel}:{number}: {line.strip()}")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
