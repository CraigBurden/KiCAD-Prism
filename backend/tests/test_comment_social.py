"""Reactions, edit markers and the attachment quota (issue #417, phase 4)."""

from __future__ import annotations

import asyncio
import io
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.api import comments as comments_api
from app.core.config import settings
from app.core.security import AuthenticatedUser
from app.services import comment_attachments, comment_live_events, comment_social
from app.services.comment_attachments import AttachmentError
from app.services.comments_revisions import Editor
from support.postgres import requires_scratch_postgres, scratch_schema, comments_store_on  # noqa: E402


class PersonalizeTests(unittest.TestCase):
    def test_reader_sees_mine_and_never_the_ids(self) -> None:
        comment = {
            "reactions": [{"reaction": "eyes", "count": 2, "users": ["A", "B"], "_reactedBy": ["user:a", "user:b"]}],
            "replies": [{"reactions": [{"reaction": "check", "count": 1, "users": ["B"], "_reactedBy": ["user:b"]}]}],
        }
        comment_social.personalize(comment, "user:a")
        self.assertEqual(comment["reactions"][0], {"reaction": "eyes", "count": 2, "users": ["A", "B"], "mine": True})
        self.assertFalse(comment["replies"][0]["reactions"][0]["mine"])
        self.assertNotIn("_reactedBy", json.dumps(comment))

class ReactionApiTests(unittest.TestCase):
    user = AuthenticatedUser(email="rev@example.test", name="Reviewer", role="viewer", user_id="rev-id")
    project = SimpleNamespace(id="p1", path="/unused")

    def test_unknown_reaction_is_refused_before_storage(self) -> None:
        with patch.object(comments_api.comments_store, "set_reaction") as store:
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(comments_api.add_comment_reaction("p1", "c1", "poop", None, self.user))
        self.assertEqual(caught.exception.status_code, 422)
        store.assert_not_called()

    def test_reaction_uses_the_session_identity(self) -> None:
        thread = {"id": "c1", "replies": [], "reactions": [
            {"reaction": "eyes", "count": 1, "users": ["Reviewer"], "_reactedBy": ["rev-id"]},
        ]}
        with patch.object(comments_api, "get_project_for_role_or_404", return_value=self.project), \
             patch.object(comments_api.comments_store, "set_reaction", return_value=thread) as store:
            result = asyncio.run(comments_api.add_comment_reaction("p1", "c1", "eyes", "r1", self.user))
        kwargs = store.call_args.kwargs
        self.assertEqual(store.call_args.args[3], "r1")
        self.assertEqual((kwargs["actor"].actor_id, kwargs["present"]), ("rev-id", True))
        # The store personalizes the thread it returns for that actor.
        self.assertIs(result, thread)

@requires_scratch_postgres("comment store tests")
class SocialPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "test_comment_social", create=False)
        self.schema = self.scratch.name
        self.store = comments_store_on(self.scratch)
        self.project_id = "p_" + uuid.uuid4().hex[:12]
        self.path = tempfile.TemporaryDirectory()
        self.blobs = tempfile.TemporaryDirectory()
        root_patch = patch.object(settings, "COMMENT_ATTACHMENT_ROOT", self.blobs.name)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        self.root = self.store.create_comment(
            self.project_id, self.path.name, "PCB", {"x": 1, "y": 2}, "**Check** R12", "A",
            content_format="md", author_user_id="user:a", author_kind="user",
        )
        _, self.reply = self.store.add_reply(
            self.project_id, self.path.name, self.root["id"], "Agreed", "B",
            author_user_id="user:b", author_kind="user", content_format="md",
        )

    def tearDown(self) -> None:
        self.path.cleanup()
        self.blobs.cleanup()

    def _react(self, reaction: str, user: str, *, reply: bool = False, present: bool = True):
        return self.store.set_reaction(
            self.project_id, self.path.name, self.root["id"], self.reply["id"] if reply else None,
            user_id=user, user_display=user.split(":")[1].upper(), reaction=reaction, present=present,
        )

    def _cursor(self) -> int:
        with self.store._connect() as conn:
            return comment_live_events.current_cursor(conn, self.project_id)

    def test_reactions_group_per_message_and_toggle_idempotently(self) -> None:
        self._react("eyes", "user:a")
        self._react("thumbs_up", "user:b")
        before = self._cursor()
        self._react("thumbs_up", "user:b")  # repeat: no change, no live event
        self.assertEqual(self._cursor(), before)
        thread = self._react("thumbs_up", "user:a")
        self.assertEqual(self._cursor(), before + 1)
        # Fixed display order, not insertion order.
        self.assertEqual([r["reaction"] for r in thread["reactions"]], ["thumbs_up", "eyes"])
        self.assertEqual(thread["reactions"][0]["count"], 2)
        self.assertEqual(thread["reactions"][0]["users"], ["B", "A"])
        self.assertNotIn("reactions", thread["replies"][0])

        thread = self._react("check", "user:a", reply=True)
        self.assertEqual(thread["replies"][0]["reactions"][0]["reaction"], "check")
        thread = self._react("eyes", "user:a", present=False)
        self.assertEqual([r["reaction"] for r in thread["reactions"]], ["thumbs_up"])
        listed = self.store.get_comments_file(self.project_id, self.path.name)["comments"][0]
        self.assertEqual(listed["replies"][0]["reactions"][0]["_reactedBy"], ["user:a"])

    def test_reaction_on_missing_targets_is_none(self) -> None:
        self.assertIsNone(self.store.set_reaction(
            self.project_id, self.path.name, "c_missing", None,
            user_id="user:a", user_display="A", reaction="eyes", present=True,
        ))
        self.assertIsNone(self.store.set_reaction(
            self.project_id, self.path.name, self.root["id"], "r_missing",
            user_id="user:a", user_display="A", reaction="eyes", present=True,
        ))

    def test_edited_marks_content_edits_only(self) -> None:
        self.store.update_comment_status(self.project_id, self.path.name, self.root["id"], "RESOLVED")
        listed = self.store.get_comments_file(self.project_id, self.path.name)["comments"][0]
        self.assertNotIn("editedAt", listed)
        self.store.edit_reply(
            self.project_id, self.path.name, self.root["id"], self.reply["id"], "Agreed, **fixed**",
            Editor("user:b", "user", "B"), expected_revision=1, content_format="md",
        )
        listed = self.store.get_comments_file(self.project_id, self.path.name)["comments"][0]
        self.assertNotIn("editedAt", listed)
        self.assertTrue(listed["replies"][0]["editedAt"].endswith("Z"))

    def test_export_leaves_reactions_out_of_the_bundle(self) -> None:
        self._react("heart", "user:a")
        path = Path(self.store.export_comments_json(self.project_id, self.path.name))
        text = path.read_text()
        self.assertNotIn("reactions", text)
        self.assertNotIn("_reactedBy", text)

    def test_project_quota_refuses_the_upload_that_would_exceed_it(self) -> None:
        from PIL import Image

        def upload(color):
            out = io.BytesIO()
            Image.new("RGB", (16, 16), color).save(out, format="PNG")
            prepared = comment_attachments.prepare_upload(out.getvalue(), "snip.png")
            return self.store.create_attachment(self.project_id, prepared, "snip.png", "user:a", "A"), prepared

        first, prepared = upload((1, 2, 3))
        with patch.object(settings, "COMMENT_ATTACHMENT_PROJECT_QUOTA_BYTES", first["size"] + len(prepared.data) - 1):
            with self.assertRaises(AttachmentError) as caught:
                upload((4, 5, 6))
        self.assertEqual(caught.exception.code, "attachment_quota")
        with patch.object(settings, "COMMENT_ATTACHMENT_PROJECT_QUOTA_BYTES", 0):
            upload((7, 8, 9))


if __name__ == "__main__":
    unittest.main()
