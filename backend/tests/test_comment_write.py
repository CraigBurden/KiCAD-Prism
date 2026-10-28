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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import comment_live_events  # noqa: E402
from app.services.comment_permissions import ActorIdentity, CommentPermissionError  # noqa: E402
from app.services.comments_revisions import Editor  # noqa: E402
from app.services.trackers.contracts import ForgeUser, RemoteComment, RemoteVersion  # noqa: E402
from app.services.trackers.op_store import OpStore  # noqa: E402
from app.services.trackers.store import TrackerStore  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema, comments_store_on  # noqa: E402

APP = Path(__file__).resolve().parents[1] / "app"
AUTHOR = Editor(user_id="u_a", kind="user", display="Author")


class _StoreCase(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "comments_write", create=False)
        self.schema = self.scratch.name
        self.store = comments_store_on(self.scratch)
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.path = self.tempdir.name
        self.project_id = "prj_test"
        self.store.initialize()

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


@requires_scratch_postgres()
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


@requires_scratch_postgres()
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


def _identity(actor_id: str, role: str, kind: str = "user") -> ActorIdentity:
    return ActorIdentity(actor_id=actor_id, actor_kind=kind, display_name=actor_id, role=role, auth_type="session")


OWNER = _identity("u_a", "viewer")
OTHER = _identity("u_b", "designer")
ADMIN = _identity("u_admin", "admin")
GUEST_ADMIN = _identity("guest:local", "admin", "guest")
SERVICE_ADMIN = _identity("service:ci", "admin", "service")


@requires_scratch_postgres()
class WritePermissionMatrixTests(_StoreCase):
    """Who may write what, checked by the store inside the write's transaction.

    A refused write leaves no revision and streams nothing.
    """

    def _refused(self, write, code: str) -> None:
        before = self._cursor()
        with self.assertRaises(CommentPermissionError) as raised:
            write()
        self.assertEqual(raised.exception.code, code)
        self.assertEqual(self._kinds_after(before), [])

    def _thread(self, author: ActorIdentity = OWNER) -> tuple[str, str]:
        root = self.store.create_comment(self.project_id, self.path, "PCB", {"x": 1, "y": 2}, "Root", actor=author)
        comment, reply = self.store.add_reply(self.project_id, self.path, root["id"], "Reply", actor=author)
        return root["id"], reply["id"]

    def test_create_and_reply_record_the_actor_and_return_its_capabilities(self) -> None:
        root = self.store.create_comment(self.project_id, self.path, "PCB", {"x": 1, "y": 2}, "Root", actor=OWNER)
        self.assertEqual((root["author"], root["authorUserId"], root["authorKind"]), ("u_a", "u_a", "user"))
        self.assertEqual(root["permissions"]["canEdit"], True)
        self.assertEqual(root["permissions"]["canResolve"], False)
        comment, reply = self.store.add_reply(self.project_id, self.path, root["id"], "Reply", actor=OTHER)
        self.assertEqual(reply["authorUserId"], "u_b")
        self.assertEqual(reply["permissions"], {
            "canReply": True, "canEdit": True, "canDelete": True, "canResolve": True, "canPublish": False,
        })
        self.assertEqual(comment["permissions"]["canEdit"], False)
        self.assertEqual([r["permissions"]["canEdit"] for r in comment["replies"]], [True])

    def test_edit_and_delete_are_owner_or_admin(self) -> None:
        cid, rid = self._thread()
        refused = [
            ("edit root", lambda: self.store.patch_comment(self.project_id, self.path, cid, actor=OTHER, content="x")),
            ("delete root", lambda: self.store.delete_comment(self.project_id, self.path, cid, actor=OTHER)),
            ("edit reply", lambda: self.store.edit_reply(self.project_id, self.path, cid, rid, "x", actor=OTHER)),
            ("delete reply", lambda: self.store.delete_reply(self.project_id, self.path, cid, rid, actor=OTHER)),
            ("reattach", lambda: self.store.reattach_comment(
                self.project_id, self.path, cid, actor=OTHER, commit="b" * 40, location={"x": 0, "y": 0},
                element_id=None, relative_point=None, expected_revision=1)),
        ]
        for name, write in refused:
            with self.subTest(name):
                self._refused(write, "not_owner")
        self.assertEqual(self.streamed(lambda: self.store.edit_reply(
            self.project_id, self.path, cid, rid, "owner edit", actor=OWNER)), ["upsert"])
        self.assertEqual(self.streamed(lambda: self.store.patch_comment(
            self.project_id, self.path, cid, actor=ADMIN, content="admin edit")), ["upsert"])
        self.assertEqual(self.streamed(lambda: self.store.delete_comment(
            self.project_id, self.path, cid, actor=OWNER)), ["delete", "upsert"])

    def test_legacy_and_remote_rows(self) -> None:
        legacy = self.store.create_comment(self.project_id, self.path, "PCB", {"x": 1, "y": 2}, "Old", "Someone")
        self._refused(lambda: self.store.patch_comment(
            self.project_id, self.path, legacy["id"], actor=OWNER, content="x"), "legacy_admin_only")
        self.store.patch_comment(self.project_id, self.path, legacy["id"], actor=ADMIN, content="admin")
        with self.store._connect() as conn:
            from app.services import comment_write

            remote = comment_write.insert_reply(
                conn, project_id=self.project_id, comment_id=legacy["id"], content="forge",
                editor=Editor(user_id=None, kind="remote", display="octo", origin="remote"),
            )
            conn.commit()
        self._refused(lambda: self.store.edit_reply(
            self.project_id, self.path, legacy["id"], remote, "x", actor=ADMIN), "remote_object_read_only")

    def test_status_needs_designer(self) -> None:
        cid, _ = self._thread()
        self._refused(lambda: self.store.patch_comment(
            self.project_id, self.path, cid, actor=OWNER, status="RESOLVED"), "status_role_required")
        # The owner may edit, but an edit and a status change are one write: both or neither.
        self._refused(lambda: self.store.patch_comment(
            self.project_id, self.path, cid, actor=OWNER, content="x", status="RESOLVED"), "status_role_required")
        self.assertEqual(self.store.get_comment(self.project_id, self.path, cid)["content"], "Root")
        resolved = self.store.patch_comment(self.project_id, self.path, cid, actor=OTHER, status="RESOLVED")
        self.assertEqual(resolved["status"], "RESOLVED")

    def test_pin_is_admin_only(self) -> None:
        cid, _ = self._thread()
        self._refused(lambda: self.store.pin_comment_anchor(
            self.project_id, self.path, cid, actor=OWNER, commit="a" * 40), "legacy_admin_only")
        pinned = self.store.pin_comment_anchor(self.project_id, self.path, cid, actor=ADMIN, commit="a" * 40)
        self.assertEqual(pinned["anchor"]["state"], "pinned")

    def test_publication_refusals(self) -> None:
        cid, rid = self._thread()
        for actor, code in ((GUEST_ADMIN, "publication_required"), (OWNER, "publication_required")):
            with self.subTest(actor.actor_kind, role=actor.role):
                self._refused(lambda: self.store.promote_comment(self.project_id, self.path, cid, actor), code)
        for actor, code in ((GUEST_ADMIN, "publication_required"), (SERVICE_ADMIN, "publication_required"),
                            (OWNER, "status_role_required")):
            with self.subTest("share", kind=actor.actor_kind):
                self._refused(lambda: self.store.share_reply(self.project_id, self.path, cid, rid, actor), code)

    def test_missing_targets_are_none_before_permission(self) -> None:
        cid, _ = self._thread()
        self.assertIsNone(self.store.patch_comment(self.project_id, self.path, "c_gone", actor=OTHER, content="x"))
        self.assertFalse(self.store.delete_comment(self.project_id, self.path, "c_gone", actor=OTHER))
        self.assertIsNone(self.store.edit_reply(self.project_id, self.path, cid, "r_gone", "x", actor=OTHER))
        self.assertIsNone(self.store.share_reply(self.project_id, self.path, cid, "r_gone", GUEST_ADMIN))
        self.assertIsNone(self.store.promote_comment(self.project_id, self.path, "c_gone", ADMIN))

    def test_anchor_resolution_runs_only_after_permission(self) -> None:
        from app.api import comments  # noqa: F401  (imports the anchor service without its import cycle)
        from app.services.comment_anchor_service import ResolvedAnchor

        cid, _ = self._thread()
        resolved: list[str] = []

        def resolve(context: str):
            resolved.append(context)
            return ResolvedAnchor(state="pinned", commit="c" * 40, source="client", source_revision_key=None,
                                  file_path="board.kicad_pcb", project_relative_path=None)

        self._refused(lambda: self.store.reattach_comment(
            self.project_id, self.path, cid, actor=OTHER, commit="b" * 40, location={"x": 0, "y": 0},
            element_id=None, relative_point=None, expected_revision=1, resolve=resolve), "not_owner")
        self.assertEqual(resolved, [])
        moved = self.store.reattach_comment(
            self.project_id, self.path, cid, actor=OWNER, commit="b" * 40, location={"x": 0, "y": 0},
            element_id=None, relative_point=None, expected_revision=1, resolve=resolve)
        self.assertEqual(resolved, ["PCB"])
        self.assertEqual(self.store.get_anchor_bindings(self.project_id, [cid])[cid][0]["commit"], "c" * 40)
        self.assertEqual(moved["permissions"]["canEdit"], True)


@requires_scratch_postgres()
class PublicationWritesTests(_StoreCase):
    """AC-33: promote/share answer like every other write; share streams once; replies use the DB clock."""

    def _queue(self, action: str):
        from unittest.mock import patch

        from app.services import comments_store_writes
        from app.services.trackers.promotion import PromotionResult

        result = PromotionResult(action=action)
        return (
            patch.object(comments_store_writes, "enqueue_share_reply", return_value=result),
            patch.object(comments_store_writes, "manual_promote_root", return_value=result),
        )

    def test_promote_and_share_return_the_readers_capabilities(self) -> None:  # D27
        cid = self._root()["id"]
        _, reply = self.store.add_reply(self.project_id, self.path, cid, "Reply", actor=ADMIN)
        share, promote = self._queue("enqueued")
        with share, promote:
            promoted = self.store.promote_comment(self.project_id, self.path, cid, ADMIN)
            shared = self.store.share_reply(self.project_id, self.path, cid, reply["id"], ADMIN)
        for name, thread in (("promote", promoted), ("share", shared)):
            with self.subTest(name):
                self.assertTrue(thread["permissions"]["canEdit"])
                self.assertEqual([r["permissions"]["canEdit"] for r in thread["replies"]], [True])

    def test_share_streams_the_sync_state_clear_only_when_nothing_was_queued(self) -> None:  # D28
        cid = self._root()["id"]
        _, reply = self.store.add_reply(self.project_id, self.path, cid, "Reply", actor=ADMIN)
        for action, expected in (("enqueued", []), ("existing", ["projection"])):
            share, promote = self._queue(action)
            with self.subTest(action), share, promote:
                # A queued op's sync_ops trigger streams the thread (patched out here); the
                # explicit clear event is only for a share that queued nothing.
                self.assertEqual(self.streamed(lambda: self.store.share_reply(
                    self.project_id, self.path, cid, reply["id"], ADMIN)), expected)

    def test_prism_replies_are_stamped_with_the_database_clock(self) -> None:  # D29
        from unittest.mock import patch

        from app.services import comments_store_writes

        cid = self._root()["id"]
        with patch.object(comments_store_writes, "_utc_now_iso", return_value="2001-01-01T00:00:00+00:00"):
            _, reply = self.store.add_reply(self.project_id, self.path, cid, "Reply", actor=OWNER)
        with self.store._connect() as conn:
            row = conn.execute(
                "SELECT updated_at = timestamp AS same FROM comment_replies WHERE id = %s",
                (reply["id"],),
            ).fetchone()
        self.assertFalse(reply["timestamp"].startswith("2001"))
        self.assertTrue(row["same"])


@requires_scratch_postgres()
class AnchorDesignKeyTests(_StoreCase):
    """The design key is stored identity, not an edit (ADR amendment K2 §3.6)."""

    KEY = "a" * 64

    def _create(self, content: str, **kwargs) -> dict:
        return self.store.create_comment(
            self.project_id, self.path, "PCB", {"x": 1, "y": 2}, content, "Author", **kwargs,
        )

    def test_create_stores_and_exposes_the_design_key(self) -> None:
        created = self._create(
            "pinned", anchor_commit="b" * 40, anchor_revision_key="rev-1", anchor_design_key=self.KEY,
        )
        self.assertEqual(created["anchor"]["designKey"], self.KEY)
        self.assertEqual(created["anchor"]["sourceRevisionKey"], "rev-1")
        plain = self._create("plain")
        self.assertIsNone(plain["anchor"]["designKey"])

    def test_fill_backfills_only_unkeyed_pinned_rows(self) -> None:
        pinned = self._create("pinned", anchor_commit="b" * 40)
        existing = self._create("existing", anchor_commit="c" * 40, anchor_design_key="d" * 64)
        unpinned = self._create("unpinned")
        non_hex = self._create("non-hex", anchor_commit="e" * 40)

        before = self.store.get_comment(self.project_id, self.path, pinned["id"])
        filled = self.store.fill_anchor_design_keys(self.project_id, {
            pinned["id"]: self.KEY,
            existing["id"]: "f" * 64,
            unpinned["id"]: "0" * 64,
            non_hex["id"]: "not-hex",
            "c_missing": "1" * 64,
        })
        self.assertEqual(filled, 1)

        after = self.store.get_comment(self.project_id, self.path, pinned["id"])
        self.assertEqual(after["anchor"]["designKey"], self.KEY)
        self.assertEqual(after["revision"], before["revision"])
        self.assertEqual(after["updatedAt"], before["updatedAt"])
        self.assertEqual(
            self.store.get_comment(self.project_id, self.path, existing["id"])["anchor"]["designKey"], "d" * 64,
        )
        self.assertIsNone(self.store.get_comment(self.project_id, self.path, unpinned["id"])["anchor"]["designKey"])
        self.assertIsNone(self.store.get_comment(self.project_id, self.path, non_hex["id"])["anchor"]["designKey"])


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
