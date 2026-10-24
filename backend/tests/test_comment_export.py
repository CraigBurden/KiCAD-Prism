"""Comment export pipeline and the `.comments/` bundle (issue #417)."""

from __future__ import annotations

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.config import settings
from app.services import comment_attachments, comment_bundle, comment_export
from app.services.comments_revisions import Editor
from support.postgres import (  # noqa: E402
    requires_scratch_postgres,
    scratch_schema,
    comments_store,
    comments_store_on,
)


A = "a" * 32
B = "b" * 32


def _png(color=(10, 120, 200)) -> bytes:
    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", (6, 4), color).save(out, format="PNG")
    return out.getvalue()


class RendererTests(unittest.TestCase):
    def test_markdown_flattens_to_readable_text(self) -> None:
        body = (
            f"**OVP** is `21.5 V`, see [datasheet](https://ti.com/x) and ![scope](attachment:{A})\n\n"
            f"> quoted\n\n- item\n\n[icd.pdf](attachment:{B}) 5 &lt; 8 \\- literal"
        )
        text = comment_export.to_plain(body, "md", {B: {"filename": "ICD rev C.pdf"}})
        self.assertIn("OVP is 21.5 V, see datasheet (https://ti.com/x) and [image: scope]", text)
        self.assertIn("quoted", text)
        self.assertNotIn(">", text.replace("5 < 8", ""))
        self.assertIn("[file: ICD rev C.pdf]", text)
        self.assertIn("5 < 8 - literal", text)

    def test_rewrite_resolves_or_falls_back_to_label(self) -> None:
        body = f'![snip](attachment:{A} "t") and [spec](attachment:{B})'
        out = comment_export.rewrite_attachment_targets(body, lambda i, _img: "x.png" if i == A else None)
        self.assertEqual(out, '![snip](x.png "t") and [file: spec]')
        self.assertEqual(comment_export.attachment_ids(body, "md"), [A, B])
        self.assertEqual(comment_export.attachment_ids(body, "plain"), [])

    def test_thread_markdown_fences_plain_text(self) -> None:
        text = comment_bundle.render_thread_markdown(
            {"id": "c_1", "context": "PCB", "content": "# not a heading", "contentFormat": "plain",
             "location": {"x": 1, "y": 2}, "replies": []}, {},
        )
        self.assertIn("    # not a heading", text)


@requires_scratch_postgres("comment store tests")
class BundleRoundTripTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "test_comment_bundle", create=False)
        self.schema = self.scratch.name
        self.store = comments_store_on(self.scratch)
        self.project = tempfile.TemporaryDirectory()
        self.blobs = tempfile.TemporaryDirectory()
        root_patch = patch.object(settings, "COMMENT_ATTACHMENT_ROOT", self.blobs.name)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def tearDown(self) -> None:
        self.project.cleanup()
        self.blobs.cleanup()

    def _upload(self, project_id: str, data: bytes, name: str) -> dict:
        prepared = comment_attachments.prepare_upload(data, name)
        return self.store.create_attachment(project_id, prepared, name, "user:a", "A")

    def _seed(self, project_id: str) -> dict:
        snip = self._upload(project_id, _png(), "snip.png")
        pdf = self._upload(project_id, b"%PDF-1.7 spec", "icd.pdf")
        root = self.store.create_comment(
            project_id, self.project.name, "PCB", {"x": 1, "y": 2, "layer": "F.Cu"},
            f"**Look** ![snip.png](attachment:{snip['id']}) and [icd.pdf](attachment:{pdf['id']})", "A",
            content_format="md", author_user_id="user:a", author_kind="user",
        )
        # A reply quoting the same snip, and a legacy plain reply.
        self.store.add_reply(project_id, self.project.name, root["id"], f"quoted ![s](attachment:{snip['id']})",
                             "A", author_user_id="user:a", author_kind="user", content_format="md")
        self.store.add_reply(project_id, self.project.name, root["id"], "*plain*", "B")
        return {"root": root, "snip": snip, "pdf": pdf}

    def test_export_writes_files_and_import_restores_them(self) -> None:
        seeded = self._seed("p_source")
        path = Path(self.store.export_comments_json("p_source", self.project.name))
        bundle = path.parent
        payload = json.loads(path.read_text())
        self.assertEqual(payload["meta"]["version"], "1.1")  # additive, CONTRACTS.md D6
        exported_root = payload["comments"][0]
        self.assertEqual(exported_root["contentFormat"], "md")
        files = sorted(p.name for p in (bundle / "attachments").iterdir())
        self.assertEqual(len(files), 2)
        thread = (bundle / "threads" / f"{seeded['root']['id']}.md").read_text()
        self.assertIn("](../attachments/", thread)
        self.assertIn("    *plain*", thread)

        # Comment ids are global: the same database never re-imports another
        # project's rows, and must not attach files to them.
        self.assertEqual(self.store.get_comments_file("p_clone", self.project.name)["comments"], [])
        # A fresh Prism (its own database) restores everything from the bundle.
        other = comments_store(self, "test_comment_bundle_b")
        clone = other.get_comments_file("p_clone", self.project.name)["comments"]
        self.assertEqual(len(clone), 1)
        root = clone[0]
        self.assertEqual(root["contentFormat"], "md")
        ids = {item["id"] for item in root["attachments"]}
        self.assertEqual(ids, {seeded["snip"]["id"], seeded["pdf"]["id"]})
        quoted = root["replies"][0]
        self.assertEqual(quoted["attachments"][0]["id"], seeded["snip"]["id"])
        self.assertEqual(root["replies"][1]["contentFormat"], "plain")
        snip_row = other.get_attachment("p_clone", seeded["snip"]["id"])
        self.assertEqual(snip_row["comment_id"], root["id"])
        self.assertTrue(comment_attachments.blob_path(snip_row["sha256"]).is_file())

        # Deleting the reference prunes the stale file on the next export.
        self.store.edit_comment("p_source", self.project.name, seeded["root"]["id"], Editor("user:a", "user", "A"),
                                expected_revision=1, content="text only", content_format="md")
        self.store.export_comments_json("p_source", self.project.name)
        self.assertEqual(len(list((bundle / "attachments").iterdir())), 1)  # the quoted snip remains

    def test_discussion_report_zips_markdown_and_snips(self) -> None:
        import zipfile

        seeded = self._seed("p_report")
        comments = self.store.get_comments_file("p_report", self.project.name)["comments"]
        with self.store._connect() as conn:
            data = comment_bundle.discussion_report_zip(conn, "p_report", comments, "Board: review")
        archive = zipfile.ZipFile(io.BytesIO(data))
        names = sorted(archive.namelist())
        self.assertEqual(len([n for n in names if n.startswith("attachments/")]), 2)
        report = archive.read("discussion.md").decode()
        self.assertTrue(report.startswith("# Board: review"))
        self.assertIn("](attachments/", report)
        self.assertNotIn("../attachments", report)
        self.assertIn(seeded["root"]["id"], report)

    def test_hostile_bundle_is_revalidated(self) -> None:
        bundle = Path(self.project.name) / ".comments"
        (bundle / "attachments").mkdir(parents=True)
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        svg_name = "c" * 64 + ".png"
        (bundle / "attachments" / svg_name).write_bytes(svg)
        good_name = "d" * 64 + ".png"
        (bundle / "attachments" / good_name).write_bytes(_png())
        outside = Path(self.project.name) / "secret.png"
        outside.write_bytes(_png((1, 2, 3)))
        payload = {
            "meta": {"version": "1.1"},
            "comments": [{
                "id": "c_hostile", "context": "PCB", "location": {"x": 0, "y": 0},
                "contentFormat": "md",
                "content": f"![a](attachment:{A}) ![b](attachment:{B}) ![c](attachment:{'c' * 32})",
                "attachments": [
                    {"id": A, "path": f"attachments/{svg_name}", "filename": "evil.png"},
                    {"id": B, "path": "attachments/../secret.png", "filename": "x.png"},
                    {"id": "c" * 32, "path": f"attachments/{good_name}", "filename": "ok.png"},
                ],
                "replies": [],
            }],
        }
        (bundle / "comments.json").write_text(json.dumps(payload))
        restored = self.store.get_comments_file("p_hostile", self.project.name)["comments"][0]
        self.assertEqual(restored["content"], f"[image: a] [image: b] ![c](attachment:{'c' * 32})")
        self.assertEqual([item["filename"] for item in restored["attachments"]], ["ok.png"])


if __name__ == "__main__":
    unittest.main()
