"""Comment attachments in forge issues and replies (issue #417, phase 3b)."""

from __future__ import annotations

import asyncio
import io
import json
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import SecretStr

from app.api import comment_attachment_links as public_api
from app.core.config import settings
from app.services import comment_attachments
from app.services.trackers import attachment_links
from app.services.trackers.contracts import Destination
from app.services.trackers.gitlab_auth import GitLabBotAuth, GitLabBotCredentials
from app.services.trackers.gitlab_issues import GitLabIssueAdapter
from app.services.trackers.http import TrackerHttp
from support.postgres import requires_scratch_postgres, scratch_schema, comments_store_on  # noqa: E402

ID = "0123456789abcdef0123456789abcdef"
DEST = Destination(connectorId="cn_1", containerKind="repo", containerPath="hw/board", remoteContainerId="77", generation=1)


def _settings(**overrides):
    values = {"COMMENT_ATTACHMENT_LINK_SECRET": SecretStr("s" * 48), "PUBLIC_BASE_URL": "https://prism.example.com",
              "COMMENT_ATTACHMENT_LINK_TTL_DAYS": 30, **overrides}
    return [patch.object(settings, key, value) for key, value in values.items()]


class SignedLinkTests(unittest.TestCase):
    def setUp(self) -> None:
        for p in _settings():
            p.start()
            self.addCleanup(p.stop)

    def _parts(self, url: str):
        path, query = url.split("?")
        params = dict(item.split("=") for item in query.split("&"))
        return path.rsplit("/", 2)[-2:], int(params["exp"]), params["sig"]

    def test_link_opens_one_file_until_it_expires(self) -> None:
        url = attachment_links.signed_url("prj_1", ID, now=1_000)
        self.assertTrue(url.startswith(f"https://prism.example.com/api/public/comment-attachments/prj_1/{ID}?exp="))
        (project, attachment), exp, sig = self._parts(url)
        self.assertEqual(exp, 1_000 + 30 * 86400)
        self.assertTrue(attachment_links.verify_signature(project, attachment, exp, sig, now=2_000))
        self.assertFalse(attachment_links.verify_signature(project, attachment, exp, sig, now=exp + 1))
        self.assertFalse(attachment_links.verify_signature("prj_2", attachment, exp, sig, now=2_000))
        self.assertFalse(attachment_links.verify_signature(project, "f" * 32, exp, sig, now=2_000))
        self.assertFalse(attachment_links.verify_signature(project, attachment, exp + 86400, sig, now=2_000))

    def test_links_are_off_without_ttl_base_or_secret(self) -> None:
        for override in ({"COMMENT_ATTACHMENT_LINK_TTL_DAYS": 0}, {"PUBLIC_BASE_URL": ""}, {"COMMENT_ATTACHMENT_LINK_SECRET": SecretStr("")}):
            with self.subTest(override=override):
                patches = _settings(**override)
                for p in patches:
                    p.start()
                try:
                    self.assertIsNone(attachment_links.signed_url("prj_1", ID))
                finally:
                    for p in patches:
                        p.stop()

    def test_public_route_refuses_bad_signatures_without_touching_storage(self) -> None:
        with patch.object(public_api.comments_store, "get_attachment") as lookup:
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(public_api.get_signed_comment_attachment("prj_1", ID, exp=99_999_999_999, sig="0" * 64))
        self.assertEqual(caught.exception.status_code, 404)
        lookup.assert_not_called()

    def test_public_route_serves_a_valid_link(self) -> None:
        url = attachment_links.signed_url("prj_1", ID)
        (project, attachment), exp, sig = self._parts(url)
        with tempfile.TemporaryDirectory() as root, patch.object(settings, "COMMENT_ATTACHMENT_ROOT", root):
            digest = comment_attachments.write_blob(b"png-bytes")
            row = {"sha256": digest, "media_type": "image/png", "filename": "snip.png"}
            with patch.object(public_api.comments_store, "get_attachment", return_value=row) as lookup:
                response = asyncio.run(public_api.get_signed_comment_attachment(project, attachment, exp=exp, sig=sig))
        lookup.assert_called_once_with("prj_1", ID)
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertIn("sandbox", response.headers["content-security-policy"])


class GitLabUploadTests(unittest.TestCase):
    def test_upload_posts_multipart_and_returns_project_url(self) -> None:
        calls = []

        class Raw:
            status_code = 201
            headers: dict = {}
            reason = "Created"
            url = ""
            content = json.dumps({"url": "/uploads/abc/snip.png", "markdown": "![snip](/uploads/abc/snip.png)"}).encode()
            text = content.decode()

            def json(self):
                return json.loads(self.content)

        def send(method, url, **kwargs):
            calls.append({"method": method, "url": url, **kwargs})
            return Raw()

        http = TrackerHttp(extra_hosts=("git.example.com",), sender=send)
        auth = GitLabBotAuth(
            GitLabBotCredentials(access_token="glpat-fixture", instance_kind="self-hosted", base_url="https://git.example.com"),
            http=http,
        )
        adapter = GitLabIssueAdapter(auth, http=http, bot_user_id="900", bot_login="bot")
        url = adapter.upload_file(DEST, 'snip".png', b"\x89PNG", "image/png")
        self.assertEqual(url, "/uploads/abc/snip.png")
        sent = calls[0]
        self.assertEqual((sent["method"], sent["url"]), ("POST", "https://git.example.com/api/v4/projects/77/uploads"))
        self.assertTrue(sent["headers"]["Content-Type"].startswith("multipart/form-data; boundary=prism-"))
        self.assertIn(b'name="file"; filename="snip.png"', sent["data"])
        self.assertIn(b"\x89PNG", sent["data"])


@requires_scratch_postgres("comment store tests")
class OutboundInboundPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "test_attachment_links", create=False)
        self.schema = self.scratch.name
        self.store = comments_store_on(self.scratch)
        self.blobs = tempfile.TemporaryDirectory()
        for p in [*_settings(), patch.object(settings, "COMMENT_ATTACHMENT_ROOT", self.blobs.name)]:
            p.start()
            self.addCleanup(p.stop)
        from PIL import Image

        out = io.BytesIO()
        Image.new("RGB", (4, 4), (1, 2, 3)).save(out, format="PNG")
        self.attachment = self.store.create_attachment(
            "prj_1", comment_attachments.prepare_upload(out.getvalue(), "snip.png"), "snip.png", "user:a", "A",
        )
        self.body = f"See ![snip.png](attachment:{self.attachment['id']}) now"

    def tearDown(self) -> None:
        self.blobs.cleanup()

    def test_github_gets_signed_links_that_map_back(self) -> None:
        with self.store._connect() as conn:
            outbound = attachment_links.for_destination(conn, project_id="prj_1", destination=DEST)
            sent = outbound.render(self.body, "md")
            self.assertIn("https://prism.example.com/api/public/comment-attachments/prj_1/", sent)
            self.assertNotIn("attachment:", sent)
            self.assertEqual(outbound.render(self.body, "plain"), self.body)
            # The forge echoes the body; locally it is the original reference again.
            self.assertEqual(attachment_links.canonicalize_inbound(conn, sent, project_id="prj_1"), self.body)
            # A link signed for another project is left alone.
            self.assertEqual(attachment_links.canonicalize_inbound(conn, sent, project_id="prj_2"), sent)

    def test_uploading_forge_gets_the_file_once_per_destination(self) -> None:
        uploads = []

        class Adapter:
            def upload_file(self, dest, filename, data, media_type):
                uploads.append((dest.remoteContainerId, filename, media_type, len(data)))
                return f"/uploads/{len(uploads)}/{filename}"

        with self.store._connect() as conn:
            outbound = attachment_links.for_destination(conn, project_id="prj_1", destination=DEST, adapter=Adapter())
            first = outbound.render(self.body, "md")
            second = outbound.render(self.body, "md")
            self.assertEqual(first, second)
            self.assertEqual(first, "See ![snip.png](/uploads/1/snip.png) now")
            self.assertEqual(len(uploads), 1)
            back = attachment_links.canonicalize_inbound(
                conn, first, project_id="prj_1", connector_id="cn_1", container_id="77",
            )
            self.assertEqual(back, self.body)
            # Another project's destination row does not claim this project's URL.
            self.assertEqual(
                attachment_links.canonicalize_inbound(conn, first, project_id="prj_2", connector_id="cn_1", container_id="77"),
                first,
            )

    def test_unknown_references_degrade_to_their_label(self) -> None:
        with self.store._connect() as conn:
            outbound = attachment_links.for_destination(conn, project_id="prj_2", destination=DEST)
            self.assertEqual(outbound.render(self.body, "md"), "See [image: snip.png] now")


if __name__ == "__main__":
    unittest.main()
