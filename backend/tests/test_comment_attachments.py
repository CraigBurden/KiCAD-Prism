"""Rich comment bodies and attachments (issue #417)."""

from __future__ import annotations

import asyncio
import io
import tempfile
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.api import comments as comments_api
from app.core.config import settings
from app.core.security import AuthenticatedUser
from app.services import comment_attachments
from app.services.comment_attachments import AttachmentError
from app.services.comments_revisions import Editor
from support.postgres import requires_scratch_postgres, scratch_schema, comments_store_on  # noqa: E402



def _png(size=(8, 6), *, exif: bool = False) -> bytes:
    from PIL import Image

    image = Image.new("RGB", size, (200, 30, 30))
    out = io.BytesIO()
    if exif:
        data = Image.Exif()
        data[0x010F] = "SecretCameraMaker"
        image.save(out, format="PNG", exif=data)
    else:
        image.save(out, format="PNG")
    return out.getvalue()


class _Upload:
    def __init__(self, data: bytes, filename: str) -> None:
        self._data = data
        self.filename = filename

    async def read(self, limit: int = -1) -> bytes:
        return self._data if limit < 0 else self._data[:limit]


class PrepareUploadTests(unittest.TestCase):
    def test_png_is_reencoded_without_metadata(self) -> None:
        raw = _png(exif=True)
        self.assertIn(b"SecretCameraMaker", raw)
        prepared = comment_attachments.prepare_upload(raw, "snip.png")
        self.assertEqual(prepared.media_type, "image/png")
        self.assertEqual((prepared.width, prepared.height), (8, 6))
        self.assertNotIn(b"SecretCameraMaker", prepared.data)

    def test_type_comes_from_bytes_not_name(self) -> None:
        with self.assertRaises(AttachmentError) as caught:
            comment_attachments.prepare_upload(b"<html><script>alert(1)</script></html>", "innocent.png")
        self.assertEqual(caught.exception.code, "attachment_type_unsupported")
        pdf = comment_attachments.prepare_upload(b"%PDF-1.7\n...", "datasheet.txt")
        self.assertEqual((pdf.media_type, pdf.extension), ("application/pdf", "pdf"))

    def test_svg_and_binary_text_are_refused(self) -> None:
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        with self.assertRaises(AttachmentError):
            comment_attachments.prepare_upload(svg, "icon.svg")
        with self.assertRaises(AttachmentError):
            comment_attachments.prepare_upload(b"\xff\xfe\x00bad", "notes.txt")

    def test_size_cap(self) -> None:
        with patch.object(settings, "COMMENT_ATTACHMENT_MAX_BYTES", 1024):
            with self.assertRaises(AttachmentError) as caught:
                comment_attachments.prepare_upload(b"a" * 2048, "big.txt")
        self.assertEqual(caught.exception.code, "attachment_too_large")

    def test_reference_parsing_and_filenames(self) -> None:
        a, b = "a" * 32, "b" * 32
        body = f"![x](attachment:{a}) and [spec](attachment:{b}) again ![y](attachment:{a})"
        self.assertEqual(comment_attachments.referenced_ids(body), [a, b])
        self.assertEqual(comment_attachments.safe_filename("../../etc/passwd", "txt"), "passwd.txt")
        self.assertEqual(comment_attachments.safe_filename("Screenshot 1.PNG", "png"), "Screenshot 1.png")
        self.assertEqual(comment_attachments.safe_filename(None, "png"), "attachment.png")


class AttachmentApiTests(unittest.TestCase):
    user = AuthenticatedUser(email="rev@example.test", name="Reviewer", role="viewer", user_id="rev-id")
    project = SimpleNamespace(id="p1", path="/unused")

    def _upload(self, data: bytes, name: str):
        with patch.object(comments_api, "get_project_for_role_or_404", return_value=self.project), \
             patch.object(comments_api.comments_store, "create_attachment", return_value={"id": "f" * 32}) as create:
            response = asyncio.run(comments_api.upload_comment_attachment("p1", _Upload(data, name), self.user))
        return response, create

    def test_upload_records_session_identity(self) -> None:
        response, create = self._upload(_png(), "../snip.png")
        self.assertEqual(response["url"], f"/api/projects/p1/comment-attachments/{'f' * 32}")
        args = create.call_args.args
        self.assertEqual(args[2], "snip.png")
        self.assertEqual(args[3], "rev-id")

    def test_upload_errors_map_to_status(self) -> None:
        response, create = self._upload(b"<html></html>", "x.png")
        self.assertEqual(response.status_code, 415)
        create.assert_not_called()
        with patch.object(settings, "COMMENT_ATTACHMENT_MAX_BYTES", 1024):
            response, _ = self._upload(b"a" * 4096, "x.txt")
        self.assertEqual(response.status_code, 413)

    def test_content_format_and_length_are_validated(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            comments_api._content_format("html")
        self.assertEqual(caught.exception.status_code, 400)
        self.assertEqual(comments_api._content_format(None), "plain")
        self.assertIsNone(comments_api._content_format(None, default=None))
        with self.assertRaises(HTTPException) as caught:
            comments_api._normalize_content("x" * (comment_attachments.MAX_CONTENT_CHARS + 1))
        self.assertEqual(caught.exception.status_code, 413)

    def test_comparison_thread_accepts_markdown(self) -> None:
        request = comments_api.CreateComparisonCommentRequest(
            baseCommit="a" * 40, compareCommit="b" * 40, domain="PCB", content="**bold**", contentFormat="md",
        )
        anchor = SimpleNamespace(
            base_commit="a" * 40, compare_commit="b" * 40, file_path=None, commit=None,
            source_revision_key=None, source=None, selected_side=None, project_relative_path=None,
            design_key=None,
        )
        with patch.object(comments_api, "get_project_for_role_or_404", return_value=self.project), \
             patch.object(comments_api, "resolve_comparison_anchor", return_value=anchor), \
             patch.object(comments_api.comments_store, "create_comment", return_value={
                 "id": "c1", "authorUserId": "rev-id", "authorKind": "user", "replies": [],
             }) as create:
            asyncio.run(comments_api.create_comparison_comment("p1", request, self.user))
        self.assertEqual(create.call_args.kwargs["content_format"], "md")

    def test_download_is_sandboxed(self) -> None:
        with tempfile.TemporaryDirectory() as root, patch.object(settings, "COMMENT_ATTACHMENT_ROOT", root):
            digest = comment_attachments.write_blob(b"%PDF-1.7")
            row = {"sha256": digest, "media_type": "application/pdf", "filename": "spec.pdf"}
            with patch.object(comments_api, "get_project_for_role_or_404", return_value=self.project), \
                 patch.object(comments_api.comments_store, "get_attachment", return_value=row):
                response = asyncio.run(comments_api.get_comment_attachment("p1", "a" * 32, self.user))
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertIn("sandbox", response.headers["content-security-policy"])
        self.assertTrue(response.headers["content-disposition"].startswith("attachment"))

@requires_scratch_postgres("comment store tests")
class AttachmentStorePostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "test_comment_att", create=False)
        self.schema = self.scratch.name
        self.store = comments_store_on(self.scratch)
        self.project_id = "p_" + uuid.uuid4().hex[:12]
        self.path = tempfile.TemporaryDirectory()
        self.blobs = tempfile.TemporaryDirectory()
        root_patch = patch.object(settings, "COMMENT_ATTACHMENT_ROOT", self.blobs.name)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def tearDown(self) -> None:
        self.path.cleanup()
        self.blobs.cleanup()

    def _upload(self, user_id: str = "user:a", project_id: str | None = None) -> dict:
        prepared = comment_attachments.prepare_upload(_png(), "snip.png")
        return self.store.create_attachment(project_id or self.project_id, prepared, "snip.png", user_id, "A")

    def _create(self, content: str, user_id: str = "user:a", fmt: str = "md") -> dict:
        return self.store.create_comment(
            self.project_id, self.path.name, "PCB", {"x": 1, "y": 2}, content, "A",
            content_format=fmt, author_user_id=user_id, author_kind="user",
        )

    def test_markdown_comment_links_and_describes_attachment(self) -> None:
        upload = self._upload()
        self.assertEqual(upload["state"], "pending")
        created = self._create(f"**Look** at this\n\n![snip.png](attachment:{upload['id']})")
        self.assertEqual(created["contentFormat"], "md")
        self.assertEqual([item["id"] for item in created["attachments"]], [upload["id"]])
        self.assertEqual(created["attachments"][0]["state"], "attached")
        self.assertEqual(created["attachments"][0]["width"], 8)
        listed = self.store.get_comments_file(self.project_id, self.path.name)["comments"][0]
        self.assertEqual(listed["attachments"][0]["id"], upload["id"])
        history = self.store.get_history(self.project_id, "root", created["id"])
        self.assertEqual(history[0]["contentFormat"], "md")

    def test_legacy_rows_stay_plain(self) -> None:
        created = self.store.create_comment(
            self.project_id, self.path.name, "PCB", {"x": 1, "y": 2}, "plain *text*", "A",
        )
        self.assertEqual(created["contentFormat"], "plain")
        self.assertNotIn("attachments", created)

    def test_cannot_claim_someone_elses_pending_upload(self) -> None:
        upload = self._upload(user_id="user:a")
        with self.assertRaises(AttachmentError) as caught:
            self._create(f"![x](attachment:{upload['id']})", user_id="user:b")
        self.assertEqual(caught.exception.code, "attachment_forbidden")
        # The failed save rolled back: nothing half-created, upload still pending.
        self.assertEqual(self.store.get_comments_file(self.project_id, self.path.name)["comments"], [])
        self.assertEqual(self.store.get_attachment(self.project_id, upload["id"])["state"], "pending")

    def test_cross_project_reference_is_refused(self) -> None:
        other = self._upload(project_id="p_other_project")
        with self.assertRaises(AttachmentError) as caught:
            self._create(f"![x](attachment:{other['id']})")
        self.assertEqual(caught.exception.code, "attachment_not_found")
        self.assertIsNone(self.store.get_attachment(self.project_id, other["id"]))

    def test_reply_and_edit_link_and_quote(self) -> None:
        root = self._create("root")
        first = self._upload(user_id="user:b")
        comment, reply = self.store.add_reply(
            self.project_id, self.path.name, root["id"], f"![r](attachment:{first['id']})", "B",
            author_user_id="user:b", author_kind="user", content_format="md",
        )
        self.assertEqual(reply["contentFormat"], "md")
        self.assertEqual(reply["attachments"][0]["id"], first["id"])
        # Someone else may quote an attached snip, and an edit links a new upload.
        second = self._upload(user_id="user:a")
        edited = self.store.edit_comment(
            self.project_id, self.path.name, root["id"], Editor("user:a", "user", "A"), expected_revision=1,
            content=f"![q](attachment:{first['id']}) ![n](attachment:{second['id']})", content_format="md",
        )
        self.assertEqual(edited["contentFormat"], "md")
        self.assertEqual({item["id"] for item in edited["attachments"]}, {first["id"], second["id"]})
        self.assertEqual(self.store.get_attachment(self.project_id, second["id"])["comment_id"], root["id"])

    def test_sweep_removes_only_stale_unclaimed_uploads(self) -> None:
        stale = self._upload()
        kept = self._upload()
        self._create(f"![k](attachment:{kept['id']})")
        with self.store._connect() as conn:
            conn.execute(
                "UPDATE comment_attachments SET created_at = NOW() - INTERVAL '2 days' WHERE id = ANY(%s)",
                ([stale["id"], kept["id"]],),
            )
            removed = comment_attachments.sweep_stale_pending(conn, self.project_id)
            conn.commit()
        self.assertEqual(removed, 1)
        self.assertIsNone(self.store.get_attachment(self.project_id, stale["id"]))
        survivor = self.store.get_attachment(self.project_id, kept["id"])
        # Same pixels, same digest: the blob stays while the claimed row uses it.
        self.assertTrue(comment_attachments.blob_path(survivor["sha256"]).is_file())


if __name__ == "__main__":
    unittest.main()
