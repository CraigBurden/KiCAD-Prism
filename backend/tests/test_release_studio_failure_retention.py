"""Regression coverage for durable Release Studio failure diagnostics."""

from __future__ import annotations

import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services import release_studio_build_service as build_service
from app.services.job_artifact_service import JobArtifactService
from app.services.job_runtime import JobCancelled, JobContext
from app.services.kicad_tools import KicadTools
from app.services.release_studio_publish_service import BuildArchives, ReleasePublisher
from tests.kicad_tool_fakes import FakeTool
from tests.release_publish_fakes import FakeForge, FakeRecords


def _stub_design(closure: Path):
    """The one ready-bundle answer ``execute_build`` reads its files from."""

    class _Design:
        archive_path = closure / "synthetic.prism"

        def board_path(self, *_args) -> Path:  # noqa: ANN002
            return closure / "hardware" / "board.kicad_pcb"

        def board_member(self, *_args) -> str:  # noqa: ANN002
            return "refilled/board.kicad_pcb"

        def schematic_path(self, *_args) -> Path:  # noqa: ANN002
            return closure / "hardware" / "board.kicad_sch"

        def schematic_member(self, *_args) -> str:  # noqa: ANN002
            return "sources/board.kicad_sch"

    return _Design()


class _FencedJobService:
    """Small fenced service fake that retains the artifact publication record."""

    def __init__(self) -> None:
        self.artifacts: list[dict[str, object]] = []
        self.status = "running"
        self.register_kwargs: dict[str, object] = {}

    def get(self, job_id: str) -> dict[str, object]:
        return {"job_id": job_id, "fence": 1, "status": self.status}

    def progress(self, *args, **kwargs) -> bool:  # noqa: ANN002,ANN003 - JobService seam
        return True

    def register_fenced_artifacts(self, job_id, worker_id, fence, artifacts, **kwargs):  # noqa: ANN001
        self.register_kwargs = dict(kwargs)
        self.artifacts.extend(dict(item) for item in artifacts)
        return [f"artifact-{len(self.artifacts)}"]


def _read_failure_archive(artifact: dict[str, object]) -> tuple[dict[str, object], str]:
    with tarfile.open(fileobj=io.BytesIO(Path(str(artifact["object_path"])).read_bytes()), mode="r:gz") as archive:
        failure = json.loads(archive.extractfile("failure.json").read())  # type: ignore[union-attr]
        log = archive.extractfile("logs/build-failure.log").read().decode("utf-8")  # type: ignore[union-attr]
    return failure, log


class ReleaseStudioFailureRetentionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.service = _FencedJobService()

    def _context(self, *, payload: dict[str, object]) -> JobContext:
        with patch("app.services.job_runtime.job_state_root", return_value=self.root):
            return JobContext(
                {"job_id": "release-failure-test", "fence": 1, "status": "running", "payload": payload},
                worker_id="test-worker",
                service=self.service,  # type: ignore[arg-type]
            )

    def test_prepare_failure_retains_attempt_and_publishes_diagnostic_evidence(self) -> None:
        context = self._context(
            payload={
                "project_id": "project-1",
                "config_key": "production",
                "commit_sha": "a" * 40,
                "variant": "rev-a",
                "author": "operator-1",
            }
        )
        retained = {
            "id": "build-prepare-failed",
            "candidate_id": "candidate-prepare-failed",
            "status": "running",
        }
        terminal: list[dict[str, object]] = []

        with (
            patch(
                "app.services.workspace_service.workspace.get_project_by_id",
                return_value={"path": str(self.root), "repo_id": "repo-1", "relative_path": "."},
            ),
            patch.object(
                build_service,
                "prepare_candidate",
                side_effect=RuntimeError("closure token=super-secret unavailable"),
            ),
            patch.object(build_service.attempts, "record_prepare_failure", return_value=retained) as record,
            patch.object(
                build_service.attempts,
                "fail_build",
                side_effect=lambda build_id, **kwargs: terminal.append(
                    {"build_id": build_id, **kwargs}
                ),
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "closure token"):
                build_service.run_release_studio_build_job(context)

        self.assertEqual(record.call_count, 1)
        self.assertEqual(len(terminal), 1)
        self.assertEqual(terminal[0]["build_id"], retained["id"])
        self.assertEqual(terminal[0]["evidence_artifact_id"], "artifact-1")
        self.assertEqual(len(self.service.artifacts), 1)
        failure, log = _read_failure_archive(self.service.artifacts[0])
        self.assertEqual(failure["failure"]["code"], "prepare_failed")
        self.assertIn("[REDACTED]", failure["failure"]["message"])
        self.assertNotIn("super-secret", log)
        self.assertEqual(failure["pipeline"]["jobs"][0]["steps"][0]["status"], "failure")
        self._assert_failure_log_api(retained, self.service.artifacts[0])

    def test_prepare_failure_configuration_is_a_captured_build_detail_snapshot(self) -> None:
        """Reopening a retained prepare failure must not touch Git or mutable HEAD."""

        captured = {
            "configuration_snapshot_captured": True,
            "configuration_document": {
                "schema": "prism.release-studio.configuration/1",
                "title": "Preparation failure: production",
                "board": "", "schematic": "", "default_variant": "",
                "fields": {}, "notes": {"failure_context": "preparation did not complete"}, "variants": [], "typography": "inter",
                "vendors": [], "document_number": "", "revision": "",
            },
        }
        from app.release_studio.config import technical_config_digest

        candidate = {
            **captured,
            "id": "candidate-prepare-failed",
            "project_id": "project-1",
            "config_key": "production",
            "technical_config_digest": technical_config_digest(captured["configuration_document"]),
        }
        build = {
            "id": "build-prepare-failed", "candidate_id": candidate["id"],
            "status": "failed", "evidence_artifact_id": "artifact-1",
        }
        user = SimpleNamespace(role="viewer", email="viewer@example.com")
        evidence = self.root / "prepare-failure-evidence.tar.gz"
        evidence.write_bytes(b"retained evidence")
        forge = FakeForge()
        publisher = ReleasePublisher(
            records=FakeRecords(builds=[build], candidates=[candidate], artifacts={"artifact-1": evidence}),
            forges=forge,
        )
        detail = publisher.detail("project-1", {"repo_url": ""}, build["id"], user)
        self.assertEqual(
            detail["configuration"]["notes"]["failure_context"],
            "preparation did not complete",
        )
        self.assertEqual(detail["build"]["status"], "failed")
        self.assertIsNone(detail["forge_release"])
        self.assertEqual(forge.calls, [])

    def test_post_start_failure_marks_attempt_and_publishes_diagnostic_evidence(self) -> None:
        context = self._context(payload={"author": "operator-1"})
        closure = self.root / "closure"
        (closure / "hardware").mkdir(parents=True)
        (closure / "hardware" / "board.kicad_pcb").write_text("(kicad_pcb)")
        build = {"id": "build-post-start", "candidate_id": "candidate-post-start", "status": "running"}
        failed: list[dict[str, object]] = []
        candidate = {
            "id": "candidate-post-start",
            "commit_sha": "b" * 40,
            "config_key": "production",
            "variant": "rev-b",
            "build_key": "c" * 64,
            "technical_config_digest": "d" * 64,
            "input_closure_digest": "e" * 64,
            "_bundle_design": _stub_design(closure),
        }

        def fail_build(build_id, **kwargs):  # noqa: ANN001 - service seam
            failed.append({"id": build_id, "status": "failed", **kwargs})

        def explode(args, **_kwargs):  # noqa: ANN001 - FakeTool handler
            raise RuntimeError("tool token=post-start-secret failed")

        with (
            patch.object(build_service.attempts, "start_build", return_value=build),
            patch.object(build_service.attempts, "fail_build", side_effect=fail_build),
        ):
            with self.assertRaisesRegex(RuntimeError, "post-start-secret"):
                build_service.execute_build(
                    context,
                    candidate=candidate,
                    closure_root=closure,
                    config={"board": "hardware/board.kicad_pcb"},
                    artifacts=JobArtifactService(root=self.root),
                    tools=KicadTools(cli=FakeTool(explode)),
                )

        self.assertEqual(len(failed), 1)
        self.assertEqual(failed[0]["id"], build["id"])
        self.assertEqual(failed[0]["status"], "failed")
        self.assertEqual(failed[0]["error_code"], "build_failed")
        self.assertEqual(failed[0]["evidence_artifact_id"], "artifact-1")
        self.assertEqual(len(self.service.artifacts), 1)
        failure, log = _read_failure_archive(self.service.artifacts[0])
        self.assertEqual(failure["failure"]["code"], "build_failed")
        self.assertIn("[REDACTED]", failure["failure"]["message"])
        self.assertNotIn("post-start-secret", log)
        self.assertEqual(failure["pipeline"]["jobs"][0]["steps"][0]["status"], "success")
        self._assert_failure_log_api(build, self.service.artifacts[0])

    def test_cancellation_marks_build_cancelled_and_retains_log_evidence(self) -> None:
        context = self._context(payload={"author": "operator-1"})
        closure = self.root / "closure-cancelled"
        (closure / "hardware").mkdir(parents=True)
        (closure / "hardware" / "board.kicad_pcb").write_text("(kicad_pcb)")
        build = {"id": "build-cancelled", "candidate_id": "candidate-cancelled", "status": "running"}
        cancelled: list[dict[str, object]] = []
        candidate = {
            "id": "candidate-cancelled", "commit_sha": "c" * 40,
            "config_key": "production", "variant": "", "build_key": "d" * 64,
            "technical_config_digest": "e" * 64, "input_closure_digest": "f" * 64,
            "_bundle_design": _stub_design(closure),
        }
        def cancel_mid_step(args, **_kwargs):  # noqa: ANN001 - FakeTool handler
            # What a cancel request looks like to a running tool: the poll it
            # was handed by execute_build raises.
            self.service.status = "cancel_requested"
            cli.cancel()

        cli = FakeTool(cancel_mid_step)

        with (
            patch.object(build_service.attempts, "start_build", return_value=build),
            patch.object(
                build_service.attempts, "cancel_build",
                side_effect=lambda build_id, **kwargs: cancelled.append(
                    {"id": build_id, "status": "cancelled", **kwargs}
                ),
            ),
        ):
            with self.assertRaises(JobCancelled):
                build_service.execute_build(
                    context, candidate=candidate, closure_root=closure,
                    config={"board": "hardware/board.kicad_pcb"},
                    artifacts=JobArtifactService(root=self.root),
                    tools=KicadTools(cli=cli),
                )

        self.assertEqual(cancelled[0]["status"], "cancelled")
        self.assertEqual(cancelled[0]["evidence_artifact_id"], "artifact-1")
        self.assertEqual(
            self.service.register_kwargs["allowed_statuses"],
            ("running", "cancel_requested"),
        )
        failure, log = _read_failure_archive(self.service.artifacts[0])
        self.assertEqual(failure["failure"]["code"], "cancelled")
        self.assertIn("Cancellation requested", log)
        self._assert_failure_log_api(build, self.service.artifacts[0])

    def test_success_evidence_log_api_exposes_explicit_success_status(self) -> None:
        from app.release_studio.canonical import write_deterministic_archive
        from app.release_studio.canonical.json import canonical_json_bytes

        archive = write_deterministic_archive(
            {
                "build-evidence.json": canonical_json_bytes(
                    {
                        "steps": {
                            "drc": {
                                "step_type": "drc", "returncode": 0,
                                "elapsed_ms": 5, "skipped_reason": "", "status": "success",
                            }
                        },
                        "timings": [],
                    }
                ),
                "logs/drc.log": b"DRC clean\n",
            }
        )
        stored = self.root / "evidence-success.tar.gz"
        stored.write_bytes(archive)
        archives = self._archives(
            {"id": "build-success", "candidate_id": "candidate-success", "evidence_artifact_id": "artifact-success"},
            stored,
        )
        listed = archives.logs("project-1", "build-success")
        self.assertEqual(listed["steps"][0]["status"], "success")
        self.assertEqual(archives.log("project-1", "build-success", "drc"), b"DRC clean\n")

    def _assert_failure_log_api(
        self, build: dict[str, object], artifact: dict[str, object]
    ) -> None:
        """The normal list/read endpoints must serve reopened failed attempts."""

        build = {**build, "evidence_artifact_id": "artifact-1"}
        archives = self._archives(build, Path(str(artifact["object_path"])))
        listed = archives.logs("project-1", str(build["id"]))
        log = archives.log("project-1", str(build["id"]), "build-failure")
        self.assertIn("build-failure", {step["step_id"] for step in listed["steps"]})
        self.assertTrue(log.decode("utf-8").strip())

    def _archives(self, build: dict[str, object], evidence: Path) -> BuildArchives:
        return BuildArchives(
            FakeRecords(
                builds=[build],
                candidates=[{"id": build["candidate_id"], "project_id": "project-1"}],
                artifacts={str(build["evidence_artifact_id"]): evidence},
            )
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
