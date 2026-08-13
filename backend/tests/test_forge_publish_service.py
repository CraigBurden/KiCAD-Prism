"""Unit tests for GitHub/GitLab Release publishing."""

from __future__ import annotations

import io
import sys
import tarfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from app.services import forge_publish_service as forge  # noqa: E402


def _dossier_tar(*names: str) -> bytes:
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode="w:gz") as archive:
        for name in names:
            data = f"{name}\n".encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return payload.getvalue()


class _Response:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text
        self.reason = "error"
        self.content = b"{}" if payload is not None else b""

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class ForgeDescribeTests(unittest.TestCase):
    def test_github_remote_is_detected(self) -> None:
        with patch.object(forge.settings, "GITHUB_TOKEN", "ghp_example"):
            target = forge.describe_forge("https://github.com/org/board.git")
        self.assertEqual(target.kind, "github")
        self.assertEqual(target.owner_repo, "org/board")
        self.assertTrue(target.token_configured)

    def test_gitlab_remote_is_detected(self) -> None:
        with patch.object(forge.settings, "GITLAB_TOKEN", ""):
            target = forge.describe_forge("https://gitlab.com/group/board.git")
        self.assertEqual(target.kind, "gitlab")
        self.assertFalse(target.token_configured)
        self.assertIn("GITLAB_TOKEN", target.token_hint)

    def test_unsupported_host_explains_the_limit(self) -> None:
        target = forge.describe_forge("https://bitbucket.org/org/board.git")
        self.assertEqual(target.kind, "unsupported")
        self.assertIn("GitHub and GitLab", target.token_hint)


class ForgeZipTests(unittest.TestCase):
    def test_dossier_tar_is_repacked_as_zip(self) -> None:
        zip_bytes = forge.dossier_tar_to_zip(_dossier_tar("manifest.json", "docs/cover.pdf"))
        import zipfile

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
            self.assertEqual(set(archive.namelist()), {"manifest.json", "docs/cover.pdf"})

    def test_filename_is_safe(self) -> None:
        self.assertEqual(forge.release_zip_filename("USB PD", "v1.0.0"), "USB-PD-v1.0.0.zip")


class ForgePublishTests(unittest.TestCase):
    def test_missing_github_token_is_actionable(self) -> None:
        with patch.object(forge.settings, "GITHUB_TOKEN", ""):
            with self.assertRaises(forge.ForgePublishError) as caught:
                forge.publish_release(
                    repo_url="https://github.com/org/board.git",
                    commit_sha="a" * 40,
                    tag="v1.0.0",
                    title="",
                    notes="",
                    zip_bytes=b"zip",
                    filename="board-v1.0.0.zip",
                )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("GITHUB_TOKEN", str(caught.exception))

    def test_github_creates_a_release_and_uploads_the_zip(self) -> None:
        calls: list[dict] = []

        def request(method, url, **kwargs):  # noqa: ANN001
            calls.append({"method": method, "url": url, "json": kwargs.get("json"), "data": kwargs.get("data")})
            if method == "POST" and url.endswith("/releases"):
                return _Response(
                    201,
                    {
                        "html_url": "https://github.com/org/board/releases/tag/v1.0.0",
                        "upload_url": "https://uploads.github.com/repos/org/board/releases/1/assets{?name,label}",
                    },
                )
            return _Response(201, {})

        with (
            patch.object(forge.settings, "GITHUB_TOKEN", "ghp_example"),
            patch.object(forge.requests, "request", side_effect=request),
        ):
            published = forge.publish_release(
                repo_url="https://github.com/org/board.git",
                commit_sha="a" * 40,
                tag="v1.0.0",
                title="Board",
                notes="notes",
                zip_bytes=b"zip-bytes",
                filename="board-v1.0.0.zip",
            )
        self.assertEqual(published["url"], "https://github.com/org/board/releases/tag/v1.0.0")
        self.assertEqual(calls[0]["json"]["tag_name"], "v1.0.0")
        self.assertEqual(calls[0]["json"]["target_commitish"], "a" * 40)
        self.assertIn("name=board-v1.0.0.zip", calls[1]["url"])
        self.assertEqual(calls[1]["data"], b"zip-bytes")

    def test_gitlab_uploads_a_package_then_creates_the_release(self) -> None:
        calls: list[str] = []

        def request(method, url, **kwargs):  # noqa: ANN001
            calls.append(f"{method} {url}")
            return _Response(201, {})

        with (
            patch.object(forge.settings, "GITLAB_TOKEN", "glpat-example"),
            patch.object(forge.requests, "request", side_effect=request),
        ):
            published = forge.publish_release(
                repo_url="https://gitlab.com/group/board.git",
                commit_sha="b" * 40,
                tag="v2.0.0",
                title="Board",
                notes="",
                zip_bytes=b"zip-bytes",
                filename="board-v2.0.0.zip",
            )
        self.assertEqual(published["forge"], "gitlab")
        self.assertIn("/-/releases/v2.0.0", published["url"])
        self.assertTrue(calls[0].startswith("PUT "))
        self.assertTrue(calls[1].startswith("POST "))
        self.assertIn("/packages/generic/", calls[0])
        self.assertTrue(calls[1].endswith("/releases"))

    def test_clone_only_token_is_reported_as_forbidden(self) -> None:
        with (
            patch.object(forge.settings, "GITHUB_TOKEN", "ghp_clone"),
            patch.object(
                forge.requests,
                "request",
                return_value=_Response(403, {"message": "Resource not accessible by integration"}),
            ),
        ):
            with self.assertRaises(forge.ForgePublishError) as caught:
                forge.publish_release(
                    repo_url="https://github.com/org/board.git",
                    commit_sha="a" * 40,
                    tag="v1.0.0",
                    title="",
                    notes="",
                    zip_bytes=b"zip",
                    filename="board-v1.0.0.zip",
                )
        self.assertEqual(caught.exception.status_code, 403)
        self.assertIn("contents:write", str(caught.exception))

    def test_invalid_tag_is_rejected_before_calling_the_forge(self) -> None:
        with (
            patch.object(forge.settings, "GITHUB_TOKEN", "ghp_example"),
            patch.object(forge.requests, "request") as request,
        ):
            with self.assertRaises(forge.ForgePublishError):
                forge.publish_release(
                    repo_url="https://github.com/org/board.git",
                    commit_sha="a" * 40,
                    tag="refs/tags/v1",
                    title="",
                    notes="",
                    zip_bytes=b"zip",
                    filename="board.zip",
                )
        request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
