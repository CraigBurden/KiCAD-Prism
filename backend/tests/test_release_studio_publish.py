"""Release Studio publish: forge calls stay off the event loop; forge and record agree."""

from __future__ import annotations

import asyncio
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.api import release_studio as api
from app.services import forge_publish_service as forge
from app.services.job_service import jobs as job_queue

GITHUB_REPO = "https://github.com/org/board.git"


class _Gate:
    """A forge call that waits until the test releases it, like a slow forge."""

    def __init__(self, response=None) -> None:
        self.gate = threading.Event()
        self.entered = threading.Event()
        self.response = response

    def __call__(self, *args, **kwargs):  # noqa: ANN002,ANN003 - requests.request seam
        self.entered.set()
        if not self.gate.wait(timeout=5):
            raise AssertionError("forge gate was never released")
        return self.response


class _Response:
    status_code = 200
    content = b"[]"
    reason = "OK"
    text = "[]"

    def json(self):
        return []


async def _loop_stays_free_while(pending: asyncio.Task, gate: _Gate) -> bool:
    await asyncio.get_running_loop().run_in_executor(None, gate.entered.wait, 2)
    probe = asyncio.create_task(asyncio.sleep(0.01))
    done, _ = await asyncio.wait({probe}, timeout=1.0)
    finished = probe in done and not pending.done()
    gate.gate.set()
    return finished


class ForgeCallsDoNotBlockTheEventLoopTests(unittest.TestCase):
    """Build detail is polled every 3 s while Publish is open; a slow forge must not stall Prism."""

    user = SimpleNamespace(email="qa@example.com", role="admin")
    build = {
        "id": "build-1",
        "candidate_id": "candidate-1",
        "status": "succeeded",
        "dossier_artifact_id": "",
        "evidence_artifact_id": "",
    }

    def _patches(self):
        return (
            patch.object(forge.settings, "GITHUB_TOKEN", "ghp_example"),
            patch.object(api, "authorized_project", return_value={"repo_url": GITHUB_REPO}),
            patch.object(api, "_build_or_404", return_value=self.build),
            patch.object(api.store, "get_candidate", return_value={"id": "candidate-1"}),
            patch.object(api, "_candidate_configuration", return_value={"revision": "v1.0.0"}),
            patch.object(api, "_vendor_readiness", return_value=[]),
            patch.object(api, "_approval_state", return_value={"published": None}),
            patch.object(api.store, "build_members", return_value=[]),
            patch.object(api.store, "build_evidence", return_value=[]),
            patch.object(api.store, "build_fingerprints", return_value={}),
        )

    def _assert_loop_free(self, make_call, *overrides) -> None:
        gate = _Gate(_Response())

        async def scenario() -> bool:
            pending = asyncio.create_task(make_call())
            free = await _loop_stays_free_while(pending, gate)
            try:
                await pending
            except Exception:  # noqa: BLE001 - only the loop matters here
                pass
            return free

        for patcher in (*self._patches(), *overrides):
            patcher.start()
            self.addCleanup(patcher.stop)
        with patch.object(forge.requests, "request", gate):
            self.assertTrue(asyncio.run(scenario()), "a forge call blocked the event loop")

    def test_build_detail_reads_the_forge_off_the_loop(self) -> None:
        self._assert_loop_free(lambda: api.get_build("project", "build-1", self.user))

    def test_tag_check_reads_the_forge_off_the_loop(self) -> None:
        self._assert_loop_free(lambda: api.check_release_tag("project", "v1.0.0", self.user))

    def test_publish_calls_the_forge_off_the_loop(self) -> None:
        request = api.PublishRequest(tag="v1.0.0")
        self._assert_loop_free(
            lambda: api.publish_build("project", "build-1", request, self.user),
            patch.object(api.store, "get_candidate", return_value={"commit_sha": "a" * 40}),
            patch.object(api, "_approval_state", return_value={"published": None, "can_publish": True}),
            patch.object(api, "_artifact_bytes", return_value=b"tar"),
            patch.object(api.forge_publish, "dossier_tar_to_zip", return_value=b"zip"),
            patch.object(api, "_ready_vendor_pack_assets", return_value=([], [])),
        )

    def test_build_enqueue_checks_the_tag_off_the_loop(self) -> None:
        request = api.CandidateRequest(
            commit_sha="a" * 40,
            identity={"tag": "v1.0.0", "document_name": "DOC", "date": "2026-10-11"},
        )
        self._assert_loop_free(
            lambda: api.create_candidate("project", request, self.user),
            patch.object(job_queue, "enqueue", return_value={"job_id": "job-1"}),
            patch.object(api.store, "save_source_defaults"),
        )


class _FakeGitHub:
    """Just enough of the GitHub Releases API: one Release per tag."""

    def __init__(self) -> None:
        self.releases: dict[int, str] = {}
        self._next = 1

    def __call__(self, method, url, **kwargs):  # noqa: ANN001,ANN003 - requests.request seam
        response = SimpleNamespace(status_code=200, reason="OK", text="", content=b"{}")
        body: dict = {}
        if method == "POST" and url.endswith("/releases"):
            tag = kwargs["json"]["tag_name"]
            if tag in self.releases.values():
                response.status_code = 422
                body = {"message": "Validation Failed: already_exists"}
            else:
                release_id = self._next
                self._next += 1
                self.releases[release_id] = tag
                response.status_code = 201
                body = {
                    "id": release_id,
                    "upload_url": f"https://uploads.github.com/releases/{release_id}/assets{{?name}}",
                    "html_url": f"https://github.com/org/board/releases/tag/{tag}",
                }
        elif method == "GET" and "/releases/tags/" in url:
            tag = url.rsplit("/", 1)[-1]
            match = [release_id for release_id, name in self.releases.items() if name == tag]
            if match:
                body = {"id": match[0]}
            else:
                response.status_code = 404
        elif method == "DELETE" and "/releases/" in url:
            self.releases.pop(int(url.rsplit("/", 1)[-1]), None)
            response.status_code = 204
        response.json = lambda: body
        response.content = b"{}" if body else b""
        return response


class ForgeReleaseAndLocalRecordAgreeTests(unittest.TestCase):
    """A Release on the forge without a local record makes the next publish fail on the tag."""

    user = SimpleNamespace(email="qa@example.com", role="admin")

    def test_a_failed_record_does_not_leave_a_release_that_blocks_the_retry(self) -> None:
        github = _FakeGitHub()
        build = {"id": "build-1", "candidate_id": "candidate-1", "status": "succeeded", "dossier_artifact_id": "d"}
        records: list[dict] = []
        outcomes = iter([RuntimeError("database went away"), None])

        def record_publish(**kwargs):  # noqa: ANN003 - store seam
            outcome = next(outcomes)
            if outcome is not None:
                raise outcome
            records.append(kwargs)
            return {"id": "pub-1", **kwargs}

        request = api.PublishRequest(tag="v1.0.0")
        with (
            patch.object(forge.settings, "GITHUB_TOKEN", "ghp_example"),
            patch.object(forge.requests, "request", github),
            patch.object(api, "authorized_project", return_value={"name": "board", "repo_url": GITHUB_REPO}),
            patch.object(api, "_build_or_404", return_value=build),
            patch.object(api.store, "get_candidate", return_value={"commit_sha": "a" * 40}),
            patch.object(api, "_candidate_configuration", return_value={"revision": "v1.0.0"}),
            patch.object(api, "_vendor_readiness", return_value=[]),
            patch.object(api, "_approval_state", return_value={"published": None, "can_publish": True}),
            patch.object(api, "_artifact_bytes", return_value=b"tar"),
            patch.object(api.forge_publish, "dossier_tar_to_zip", return_value=b"zip"),
            patch.object(api.store, "record_publish", side_effect=record_publish),
        ):
            with self.assertRaises(Exception):
                asyncio.run(api.publish_build("project", "build-1", request, self.user))
            self.assertEqual(github.releases, {}, "the forge kept a Release Prism has no record of")
            retried = asyncio.run(api.publish_build("project", "build-1", request, self.user))

        self.assertEqual(retried["release"]["tag"], "v1.0.0")
        self.assertEqual(len(records), 1)
        self.assertEqual(list(github.releases.values()), ["v1.0.0"])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
