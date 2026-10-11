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


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
