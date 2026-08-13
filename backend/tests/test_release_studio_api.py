"""R19 acceptance: the Release Studio HTTP surface.

Route handlers are called directly (the pattern `test_health_api.py` uses) so
the gate logic is exercised without standing up OIDC.  What matters here is
that the release endpoint refuses for the right reasons and in the right order:
unwaived blockers, unevaluable rules, then missing approvals.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import os
import sys
import tarfile
import unittest
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

from fastapi import HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402

TEST_POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()


@dataclass
class _User:
    """Mirrors the identity fields the routes actually read off AuthenticatedUser.

    `email` is the identity the routes record as actor/owner/approver; the stub
    carried `username`, which the real model does not have, so the stub could
    not have caught the routes referencing a non-existent attribute.
    """

    email: str
    role: str = "designer"


def _run(coro):
    return asyncio.run(coro)


class ReleaseStudioRequestAndCoverageTests(unittest.TestCase):
    def test_approval_request_requires_the_displayed_evaluation_id(self) -> None:
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            self.api.ApprovalRequest(role="pcb_design", domains=["bare_board"])
        request = self.api.ApprovalRequest(
            evaluation_id="eval-current", role="pcb_design", domains=["bare_board"]
        )
        self.assertEqual(request.evaluation_id, "eval-current")

    def setUp(self) -> None:
        from app.api import release_studio as api

        self.api = api

    def test_candidate_requires_a_full_immutable_git_sha(self) -> None:
        valid = "a" * 40
        self.assertEqual(self.api.CandidateRequest(commit_sha=valid).commit_sha, valid)
        for mutable_or_ambiguous in ("HEAD", "main", "a" * 12, "g" * 40):
            with self.assertRaises(ValidationError):
                self.api.CandidateRequest(commit_sha=mutable_or_ambiguous)

    def test_configuration_authoring_is_repository_locked_and_published(self) -> None:
        user = _User("designer@example.com")
        request = self.api.ConfigurationWriteRequest(
            configuration={"schema": "prism.release-studio.configuration/1"},
            base_commit_sha="a" * 40,
            commit=True,
        )
        queued = {"job_id": "job-config"}
        with (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.api.workspace, "get_project_by_id", return_value={"repo_id": "repo-1"}),
            patch.object(self.api.jobs, "enqueue", return_value=queued) as enqueue,
        ):
            actual = _run(
                self.api.save_configuration("project", "default", request, user)
            )
        self.assertEqual(actual, {"job": queued})
        args, kwargs = enqueue.call_args
        self.assertEqual(args[0], "release_studio_configuration_publish")
        self.assertEqual(args[1]["configuration"], request.configuration)
        self.assertEqual(args[1]["base_commit_sha"], "a" * 40)
        self.assertEqual(kwargs["repository_id"], "repo-1")
        self.assertEqual(
            kwargs["locks"],
            [{"key": "repository:repo-1", "mode": "write"}],
        )

    def test_candidate_enqueue_identity_includes_variant(self) -> None:
        user = _User("designer")
        requests: list[dict] = []

        def enqueue(kind, payload, **kwargs):  # noqa: ANN001 - JobService seam
            requests.append({"kind": kind, "payload": payload, **kwargs})
            return {"job_id": f"job-{len(requests)}"}

        with (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.api.jobs, "enqueue", side_effect=enqueue),
        ):
            first = _run(self.api.create_candidate(
                "project", self.api.CandidateRequest(
                    config_key="production", commit_sha="a" * 40, variant="A"
                ), user
            ))
            same = _run(self.api.create_candidate(
                "project", self.api.CandidateRequest(
                    config_key="production", commit_sha="a" * 40, variant="A"
                ), user
            ))
            other = _run(self.api.create_candidate(
                "project", self.api.CandidateRequest(
                    config_key="production", commit_sha="a" * 40, variant="B"
                ), user
            ))
        self.assertEqual(first["job"]["job_id"], "job-1")
        self.assertEqual(same["job"]["job_id"], "job-2")
        self.assertNotEqual(requests[0]["artifact_key"], requests[2]["artifact_key"])
        self.assertEqual(requests[0]["artifact_key"], requests[1]["artifact_key"])
        self.assertEqual(other["job"]["job_id"], "job-3")

    def test_configuration_preview_rejects_mutable_or_short_commit_ids(self) -> None:
        user = _User("viewer", role="viewer")
        with patch.object(self.api, "get_project_for_role_or_404", lambda *_args: None):
            for mutable_or_ambiguous in ("HEAD", "main", "a" * 12):
                with self.assertRaises(HTTPException) as caught:
                    _run(self.api.list_configurations(
                        "project", commit_sha=mutable_or_ambiguous, user=user
                    ))
                self.assertEqual(caught.exception.status_code, 400)

    def test_build_detail_marks_a_stale_waiver_evaluation_not_fresh(self) -> None:
        build = {"id": "build", "candidate_id": "candidate"}
        candidate = {"id": "candidate", "config_key": "default"}
        with (
            patch.object(self.api, "get_project_for_role_or_404", lambda *_args: None),
            patch.object(self.api, "_build_or_404", return_value=build),
            patch.object(self.api, "_candidate_configuration", return_value={"vendors": []}),
            patch.object(self.api.store, "get_candidate", return_value=candidate),
            patch.object(self.api.store, "latest_evaluation", return_value={"waiver_binding_digest": "old"}),
            patch.object(self.api.store, "waiver_binding_digest", return_value="new"),
            patch.object(self.api.store, "build_members", return_value=[]),
            patch.object(self.api.store, "build_evidence", return_value=[]),
            patch.object(self.api.store, "build_fingerprints", return_value={}),
            patch.object(self.api.store, "list_approvals", return_value=[]),
            patch.object(self.api.store, "list_waivers", return_value=[]),
            patch.object(self.api, "_vendor_readiness", return_value=[]),
            patch.object(self.api, "_required_approval_coverage", return_value={"available": True, "required_approvals": []}),
        ):
            payload = _run(self.api.get_build("project", "build", user=_User("viewer", role="viewer")))
        self.assertFalse(payload["evaluation_fresh"])
        self.assertIn("stale", payload["evaluation_fresh_error"].lower())

    def test_required_approval_coverage_keeps_a_valid_empty_policy_distinct(self) -> None:
        build = {"id": "build", "candidate_id": "candidate"}
        with (
            patch.object(self.api.store, "get_candidate", return_value={"id": "candidate"}),
            patch.object(self.api, "_policy_document", return_value={"rules": []}),
            patch.object(self.api, "resolve_policy", return_value=SimpleNamespace(required_approvals=[])),
            patch.object(self.api.store, "effective_approvals", return_value=[]),
        ):
            coverage = self.api._required_approval_coverage("project", build)
        self.assertTrue(coverage["available"])
        self.assertEqual(coverage["required_approvals"], [])
        self.assertNotIn("error", coverage)

    def test_required_approval_coverage_reports_policy_resolution_failure(self) -> None:
        build = {"id": "build", "candidate_id": "candidate"}
        with (
            patch.object(self.api.store, "get_candidate", return_value={"id": "candidate"}),
            patch.object(self.api, "_policy_document", return_value={"rules": []}),
            patch.object(self.api, "resolve_policy", side_effect=RuntimeError("immutable policy missing")),
        ):
            coverage = self.api._required_approval_coverage("project", build)
        self.assertFalse(coverage["available"])
        self.assertIsNone(coverage["required_approvals"])
        self.assertIn("immutable policy missing", coverage["error"])


class ReleaseStudioDocumentSheetApiTests(unittest.TestCase):
    """D10: composed sheets have a first-class immutable preview surface."""

    def setUp(self) -> None:
        from app.api import release_studio as api

        self.api = api
        self.user = _User("viewer", role="viewer")
        self.pdf = b"%PDF-1.4 test fabrication"
        self.digest = hashlib.sha256(self.pdf).hexdigest()
        pdf_member = {
            "id": "member-pdf",
            "path": "documentation/fabrication.pdf",
            "released_digest": self.digest,
            "media_type": "application/pdf",
        }
        payload = io.BytesIO()
        with tarfile.open(fileobj=payload, mode="w:gz") as archive:
            info = tarfile.TarInfo(pdf_member["path"])
            info.size = len(self.pdf)
            archive.addfile(info, io.BytesIO(self.pdf))

        patches = (
            patch.object(api, "get_project_for_role_or_404", lambda *_args: None),
            patch.object(api, "_build_or_404", lambda *_args: {"dossier_artifact_id": "a1"}),
            patch.object(api.store, "build_members", lambda _build: [pdf_member]),
            patch.object(api, "_artifact_bytes", lambda _artifact: payload.getvalue()),
        )
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_sheet_listing_is_pdf_only(self) -> None:
        result = _run(
            self.api.list_document_sheets("proj", "build", user=self.user)
        )
        self.assertEqual([item["key"] for item in result["sheets"]], ["fabrication"])
        self.assertNotIn("svg", result["sheets"][0])
        self.assertEqual(
            result["sheets"][0]["pdf"]["path"], "documentation/fabrication.pdf"
        )

    def test_sheet_preview_is_digest_checked_and_immutable(self) -> None:
        response = _run(
            self.api.preview_document_sheet(
                "proj", "build", "fabrication", user=self.user
            )
        )
        self.assertEqual(response.body, self.pdf)
        self.assertEqual(response.headers["etag"], f'"{self.digest}"')
        self.assertIn("immutable", response.headers["cache-control"])

    def test_sheet_preview_rejects_non_key_paths(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.preview_document_sheet(
                    "proj", "build", "../manifest", user=self.user
                )
            )
        self.assertEqual(caught.exception.status_code, 404)


class ReleaseStudioVendorApiTests(unittest.TestCase):
    """Vendor profiles and packs are registry-shaped, not JLCPCB-shaped."""

    def setUp(self) -> None:
        from app.api import release_studio as api

        self.api = api
        self.user = _User("viewer", role="viewer")
        gerber = b"G04 gerber*\n"
        xlsx = b"xlsx-bom"
        dossier = io.BytesIO()
        with tarfile.open(fileobj=dossier, mode="w:gz") as archive:
            for name, payload in (
                ("fabrication/gerbers/board-F_Cu.gbr", gerber),
                ("fabrication/drill/board-PTH.drl", b"M48\n"),
                ("manufacturing/vendors/jlcpcb/bom.csv", b"Comment,Designator\n"),
                ("manufacturing/vendors/jlcpcb/cpl.csv", b"Designator,PosX\n"),
            ):
                info = tarfile.TarInfo(name)
                info.size = len(payload)
                archive.addfile(info, io.BytesIO(payload))
        evidence = io.BytesIO()
        with tarfile.open(fileobj=evidence, mode="w:gz") as archive:
            info = tarfile.TarInfo("raw/vendors/jlcpcb/bom.xlsx")
            info.size = len(xlsx)
            archive.addfile(info, io.BytesIO(xlsx))
            info = tarfile.TarInfo("raw/vendors/jlcpcb/cpl.xlsx")
            info.size = len(xlsx)
            archive.addfile(info, io.BytesIO(xlsx))
        self.dossier_bytes = dossier.getvalue()
        self.evidence_bytes = evidence.getvalue()
        patches = (
            patch.object(api, "get_project_for_role_or_404", lambda *_args: None),
            patch.object(
                api,
                "_build_or_404",
                lambda *_args: {
                    "id": "build-1",
                    "dossier_artifact_id": "dossier-1",
                    "evidence_artifact_id": "evidence-1",
                },
            ),
            patch.object(
                api,
                "_artifact_bytes",
                lambda artifact_id: (
                    self.dossier_bytes
                    if artifact_id == "dossier-1"
                    else self.evidence_bytes
                ),
            ),
        )
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_lists_registered_profiles(self) -> None:
        payload = _run(self.api.list_vendor_profiles("proj", user=self.user))
        self.assertEqual([item["id"] for item in payload["profiles"]], ["jlcpcb"])
        self.assertTrue(all("pack_filename" in item for item in payload["profiles"]))
        self.assertTrue(all("title" in item for item in payload["profiles"]))

    def test_unknown_vendor_pack_is_not_jlc_shaped(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.download_build_vendor_pack(
                    "proj", "build-1", "pcbway", user=self.user
                )
            )
        self.assertEqual(caught.exception.status_code, 404)
        self.assertIn("Unknown vendor", str(caught.exception.detail))

    def test_jlcpcb_pack_is_a_zip_of_gerbers_and_workbooks(self) -> None:
        response = _run(
            self.api.download_build_vendor_pack(
                "proj", "build-1", "jlcpcb", user=self.user
            )
        )
        self.assertEqual(response.media_type, "application/zip")
        self.assertIn("jlcpcb-upload.zip", response.headers["content-disposition"])
        with zipfile.ZipFile(io.BytesIO(response.body)) as archive:
            names = set(archive.namelist())
        self.assertIn("gerbers/board-F_Cu.gbr", names)
        self.assertIn("drill/board-PTH.drl", names)
        self.assertIn("bom.xlsx", names)
        self.assertIn("cpl.xlsx", names)


class ReleaseStudioWaiverFreshnessTests(unittest.TestCase):
    """Release must not reuse an evaluation across waiver-state changes."""

    def setUp(self) -> None:
        from app.api import release_studio as api

        self.api = api
        self.evaluation = {"waiver_binding_digest": "before"}

    def test_release_freshness_rejects_a_revoked_waiver(self) -> None:
        # Revocation removes a previously applied approved waiver from the
        # active set; the release predicate must refuse that old evaluation.
        with patch.object(self.api.store, "waiver_binding_digest", return_value="after-revocation"):
            self.assertFalse(self.api._evaluation_has_current_waivers(
                "project", "default", "build", self.evaluation
            ))

    def test_release_freshness_rejects_an_expired_waiver(self) -> None:
        # Expiry has the same security property even though no mutation occurs:
        # the active set changed underneath a stored evaluation.
        with patch.object(self.api.store, "waiver_binding_digest", return_value="after-expiry"):
            self.assertFalse(self.api._evaluation_has_current_waivers(
                "project", "default", "build", self.evaluation
            ))


@unittest.skipIf(psycopg is None, "psycopg is required")
@unittest.skipIf(not TEST_POSTGRES_URL, "TEST_POSTGRES_URL must point at an isolated database")
class ReleaseStudioApiTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["PRISM_DATABASE_URL"] = TEST_POSTGRES_URL
        from app.api import release_studio as api
        from app.services import release_studio_service as service
        from app.services.workspace_schema_migrations import apply_workspace_migrations

        self.api = api
        self.service = service
        self.schema = f"rs_api_{uuid.uuid4().hex[:10]}"
        self.conn = psycopg.connect(TEST_POSTGRES_URL, row_factory=psycopg.rows.dict_row)
        self.addCleanup(self.conn.close)
        self.conn.execute(f'CREATE SCHEMA "{self.schema}"')
        self.conn.execute(f'SET search_path TO "{self.schema}", public')
        self.conn.execute(
            """
            CREATE TABLE ws_repositories (id TEXT PRIMARY KEY);
            CREATE TABLE ws_folders (id TEXT PRIMARY KEY);
            CREATE TABLE ws_projects (
                id TEXT PRIMARY KEY,
                repo_id TEXT NOT NULL REFERENCES ws_repositories(id)
            );
            CREATE TABLE ws_project_portfolio (
                project_id TEXT PRIMARY KEY REFERENCES ws_projects(id)
            );
            CREATE TABLE ws_jobs (
                id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '', percent REAL NOT NULL DEFAULT 0,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """,
            prepare=False,
        )
        self.conn.execute("INSERT INTO ws_repositories(id) VALUES ('repo-1')")
        self.conn.execute("INSERT INTO ws_projects(id, repo_id) VALUES ('proj-1','repo-1')")
        apply_workspace_migrations(self.conn)
        self.conn.commit()
        self.addCleanup(self._drop)

        import contextlib

        schema = self.schema

        @contextlib.contextmanager
        def _connect():
            conn = psycopg.connect(TEST_POSTGRES_URL, row_factory=psycopg.rows.dict_row)
            try:
                conn.execute(f'SET search_path TO "{schema}", public')
                yield conn
            finally:
                conn.close()

        original = service.connect
        service.connect = _connect
        self.addCleanup(lambda: setattr(service, "connect", original))

        patcher = patch.object(api, "get_project_for_role_or_404", lambda *_args: None)
        patcher.start()
        self.addCleanup(patcher.stop)

        # Pin the self-approval bypass off: it defaults to on wherever auth is
        # off, which would make the two-person assertions below vacuous.
        bypass = patch.dict(os.environ, {"PRISM_RELEASE_ALLOW_SELF_APPROVAL": "0"})
        bypass.start()
        self.addCleanup(bypass.stop)

        # Releasing signs with a process secret. Reading it from the ambient
        # environment made these tests pass wherever Compose injects a key and
        # fail on a bare CI runner, so the suite owns a throwaway key instead.
        # create_release publishes the public half, which is what
        # list_signing_keys then hands the offline verifier.
        from app.release_studio.attestation import generate_signing_key

        _key, signing_pem = generate_signing_key("test-release-key")
        signing = patch.dict(
            os.environ,
            {
                "PRISM_RELEASE_SIGNING_KEY_ID": "test-release-key",
                "PRISM_RELEASE_SIGNING_KEY": signing_pem,
                "PRISM_RELEASE_SIGNING_KEY_FILE": "",
            },
        )
        signing.start()
        self.addCleanup(signing.stop)

        self.user = _User("quality")
        self.project_id = "proj-1"

    def _drop(self) -> None:
        self.conn.rollback()
        self.conn.execute("SET search_path TO public")
        self.conn.execute(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE')
        self.conn.commit()

    # -- fixtures ----------------------------------------------------------

    def _built(
        self,
        *,
        drc_errors: int = 0,
        projections: dict[str, object] | None = None,
    ):
        from tests.test_release_studio_governance import _dossier
        from app.release_studio.config.digests import technical_config_digest

        configuration = {
            "schema": "prism.release-studio.configuration/1",
            "title": "API fixture",
            "board": "board.kicad_pcb",
            "schematic": "board.kicad_sch",
            "jobset": "Outputs.kicad_jobset",
            "default_variant": "default",
            "fields": {}, "notes": {}, "variants": [], "typography": "inter",
            "vendors": [], "document_number": "COMMITTED-100", "revision": "A",
        }

        candidate = self.service.create_candidate(
            project_id=self.project_id, repository_id="repo-1", config_key="default",
            commit_sha="a" * 40, variant="default",
            technical_config_digest=technical_config_digest(configuration), input_closure_digest="ic" * 32,
            toolchain_digest="tl" * 32, generator_build="r11", hermetic=True,
            policy_snapshot_captured=True,
            configuration_snapshot_captured=True,
            configuration_document=configuration,
            created_by="designer",
        )
        build = self.service.start_build(candidate["id"], job_id=None, fence=1)
        dossier = _dossier()
        object.__setattr__(
            dossier,
            "evidence",
            (
                {
                    "kind": "drc",
                    "report_digest": "d" * 64,
                    "counts": {"error": drc_errors, "total": drc_errors},
                },
                {"kind": "erc", "report_digest": "e" * 64, "counts": {"error": 0, "total": 0}},
            ),
        )
        if projections:
            fingerprints = {
                domain: {
                    **record,
                    "fidelity": "board" if domain == "bare_board" else record["fidelity"],
                }
                for domain, record in dossier.fingerprints.items()
            }
            object.__setattr__(dossier, "fingerprints", fingerprints)
        # Projections are recorded once per build rather than inside every
        # fingerprint's inputs; re-evaluation reads them from there.
        completed = self.service.complete_build(
            build_id=build["id"], dossier=dossier, toolchain={}, fence=1,
            projections=projections or {},
        )
        return candidate, completed

    # -- tests -------------------------------------------------------------

    def test_build_detail_exposes_every_governed_view(self) -> None:
        _candidate, build = self._built()
        payload = _run(self.api.get_build(self.project_id, build["id"], user=self.user))
        self.assertEqual(
            sorted(payload),
            [
                "approvals", "build", "candidate", "configuration", "evaluation",
                "evaluation_fresh",
                "evidence", "fingerprints", "members",
                # What the policy demands before release, so the first mention
                # of a required role is not the refusal that names it.
                "required_approvals",
                "required_approvals_available",
                "vendor_readiness", "waivers",
            ],
        )
        self.assertEqual(len(payload["members"]), 3)
        self.assertEqual(sorted(payload["fingerprints"]), ["assembly", "bare_board", "evidence"])

    def test_candidate_history_returns_all_attempts_newest_first(self) -> None:
        candidate, build = self._built()
        retry = self.service.start_build(candidate["id"], job_id=None, fence=2)
        self.service.fail_build(retry["id"], error_code="fixture", error_message="retry failed")
        payload = _run(self.api.get_candidate(self.project_id, candidate["id"], user=self.user))
        self.assertEqual([item["id"] for item in payload["builds"]], [retry["id"], build["id"]])
        self.assertEqual(payload["latest_build"]["id"], retry["id"])

    def test_designer_cannot_fulfill_a_required_approval(self) -> None:
        _candidate, build = self._built()
        _run(self.api.evaluate_build(self.project_id, build["id"], self.api.EvaluateRequest(), user=self.user))
        with self.assertRaises(HTTPException) as caught:
            _run(self.api.create_approval(
                self.project_id, build["id"],
                self.api.ApprovalRequest(
                    evaluation_id="eval-displayed",
                    role="pcb_design",
                    domains=["bare_board"],
                ),
                user=_User("designer", role="designer"),
            ))
        self.assertEqual(caught.exception.status_code, 403)

    def test_legacy_waiver_cannot_splice_another_projects_build(self) -> None:
        _candidate, build = self._built()
        with self.assertRaises(HTTPException) as caught:
            _run(self.api.create_waiver(
                "other-project",
                self.api.WaiverRequest(
                    rule_id="drc.clean", domain="evidence", reason="fixture",
                    subject_pattern="drc/*", build_id=build["id"],
                ),
                user=self.user,
            ))
        self.assertEqual(caught.exception.status_code, 404)

    def test_evaluate_records_rule_outcomes_including_unsupported(self) -> None:
        _candidate, build = self._built()
        result = _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        outcomes = {
            item["rule_id"]: item["outcome"]
            for item in result["evaluation"]["rule_outcomes"]
        }
        self.assertIn("drc.clean", outcomes)
        self.assertEqual(outcomes["drc.clean"], "pass")
        # The default policy requires gerbers and drill members, which this
        # synthetic dossier does not have.
        self.assertEqual(outcomes["dossier.required_members"], "failure")

    def test_evaluate_uses_the_builds_persisted_board_projection(self) -> None:
        _candidate, build = self._built(
            projections={"stackup": {"copper_layer_count": 2}}
        )
        policy = {
            "rules": [
                {
                    "id": "stackup.min_copper_layers",
                    "severity": "failure",
                    "params": {"minimum": 4},
                }
            ],
            "required_approvals": [],
        }
        with patch.object(self.api, "_policy_document", return_value=policy):
            result = _run(
                self.api.evaluate_build(
                    self.project_id,
                    build["id"],
                    self.api.EvaluateRequest(config_key="default"),
                    user=self.user,
                )
            )

        outcomes = {
            item["rule_id"]: item["outcome"]
            for item in result["evaluation"]["rule_outcomes"]
        }
        self.assertEqual(outcomes["stackup.min_copper_layers"], "failure")

    def test_release_is_refused_while_a_blocker_is_unwaived(self) -> None:
        _candidate, build = self._built(drc_errors=3)
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.create_release(
                    self.project_id, build["id"],
                    self.api.ReleaseRequest(release_label="REL-1", document_number="", revision="A"),
                    user=self.user,
                )
            )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("blocking finding", caught.exception.detail)

    def test_a_designer_cannot_override_open_blockers(self) -> None:
        """Break-glass is an administrative act, not a designer's."""

        _candidate, build = self._built(drc_errors=3)
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.create_release(
                    self.project_id, build["id"],
                    self.api.ReleaseRequest(
                        release_label="REL-1", document_number="", revision="A",
                        override_blockers=True, override_reason="ship it",
                    ),
                    user=self.user,
                )
            )
        self.assertEqual(caught.exception.status_code, 403)
        self.assertIn("admin role", caught.exception.detail)

    def test_an_override_without_a_reason_is_refused(self) -> None:
        _candidate, build = self._built(drc_errors=3)
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.create_release(
                    self.project_id, build["id"],
                    self.api.ReleaseRequest(
                        release_label="REL-1", document_number="", revision="A",
                        override_blockers=True, override_reason="   ",
                    ),
                    user=_User("admin", role="admin"),
                )
            )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("reason", caught.exception.detail)

    def test_an_override_on_a_clean_build_is_refused(self) -> None:
        """A break-glass marker that stepped over nothing is a lie in a signature."""

        _candidate, build = self._built()
        policy = {"rules": [], "required_approvals": []}
        with patch.object(self.api, "_policy_document", return_value=policy):
            _run(
                self.api.evaluate_build(
                    self.project_id, build["id"],
                    self.api.EvaluateRequest(config_key="default"), user=self.user,
                )
            )
            with self.assertRaises(HTTPException) as caught:
                _run(
                    self.api.create_release(
                        self.project_id, build["id"],
                        self.api.ReleaseRequest(
                            release_label="REL-CLEAN", document_number="", revision="A",
                            override_blockers=True, override_reason="not needed",
                        ),
                        user=_User("admin", role="admin"),
                    )
                )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("no open blockers", caught.exception.detail)

    def test_an_admin_override_releases_and_records_what_it_stepped_over(self) -> None:
        _candidate, build = self._built(drc_errors=3)
        policy = {
            "rules": [
                {"id": "drc.clean", "severity": "blocker", "params": {"max_errors": 0}}
            ],
            "required_approvals": [],
        }
        admin = _User("admin", role="admin")
        with patch.object(self.api, "_policy_document", return_value=policy):
            _run(
                self.api.evaluate_build(
                    self.project_id, build["id"],
                    self.api.EvaluateRequest(config_key="default"), user=self.user,
                )
            )
            record = _run(
                self.api.create_release(
                    self.project_id, build["id"],
                    self.api.ReleaseRequest(
                        release_label="REL-OVERRIDE", document_number="", revision="A",
                        override_blockers=True,
                        override_reason="customer accepted the clearance deviation",
                    ),
                    user=admin,
                )
            )

        override = record["policy_snapshot"]["override"]
        self.assertEqual(override["actor"], "admin")
        self.assertIn("clearance deviation", override["reason"])
        # Every finding it stepped over is named, so a recipient learns what was
        # bypassed and not merely that something was.
        self.assertTrue(override["findings"])
        self.assertTrue(all(item["rule_id"] == "drc.clean" for item in override["findings"]))

        # ...and the override is its own audit event, findable without reading
        # inside every release event's details.
        events = self.service.list_audit_events(self.project_id, "default")
        kinds = [event["event_type"] for event in events]
        self.assertIn("release.blockers_overridden", kinds)
        self.assertIn("release.created", kinds)

    def test_release_is_refused_when_a_required_approval_is_missing(self) -> None:
        _candidate, build = self._built()
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        # Waive the member-presence failures so only the approval gate remains.
        evaluation = self.service.latest_evaluation(build["id"])
        for finding in evaluation["findings"]:
            waiver = self.service.create_waiver(
                project_id=self.project_id, config_key="default",
                rule_id=finding["rule_id"], domain=finding["domain"],
                reason="synthetic fixture", owner="designer",
                finding_key=finding["finding_key"],
                # Waivers are build-scoped: an exception accepted on one set of
                # outputs does not carry to the next release.
                build_id=build["id"],
            )
            self.service.transition_waiver(waiver["id"], status="approved", actor="quality")

        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )

        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.create_release(
                    self.project_id, build["id"],
                    self.api.ReleaseRequest(release_label="REL-1", document_number="", revision="A"),
                    user=self.user,
                )
            )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("missing approval", caught.exception.detail)

    def test_release_is_refused_without_a_configured_signing_key(self) -> None:
        """An unverifiable release is worse than no release."""

        _candidate, build = self._built()
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )
        with patch.dict(os.environ, {"PRISM_RELEASE_SIGNING_KEY_ID": "", "PRISM_RELEASE_SIGNING_KEY": ""}):
            with self.assertRaises(HTTPException) as caught:
                self.api._signing_key()
        self.assertEqual(caught.exception.status_code, 503)
        self.assertIn("signing is not configured", caught.exception.detail)

    def _published_build(self):
        """A build whose dossier artifact genuinely exists and is self-consistent.

        The other fixtures record placeholder digests, which is fine for the
        governance gates but cannot exercise the archive path: the offline
        verifier hashes the bytes it is given, so the tarball, the members
        table, and the manifest all have to agree.
        """

        import hashlib
        import tempfile
        import uuid as _uuid

        from tests.test_release_studio_governance import _Dossier, _Member
        from app.release_studio.canonical import sha256_canonical, write_deterministic_archive
        from app.release_studio.canonical.json import canonical_json_bytes

        files = {
            "fabrication/gerbers/board-F_Cu.gbr": b"%FSLAX46Y46*%\nD10*\nM02*\n",
            "fabrication/drill/board.drl": b"M48\nT1C0.300\n%\nM30\n",
            "assembly/positions.csv": b"Ref,Val,X,Y\nR1,10k,1.0,2.0\n",
        }
        domains = {
            "fabrication/gerbers/board-F_Cu.gbr": ("bare_board",),
            "fabrication/drill/board.drl": ("bare_board",),
            "assembly/positions.csv": ("assembly",),
        }
        members = tuple(
            _Member(
                path, "gerber", "application/vnd.gerber", len(data),
                hashlib.sha256(data).hexdigest(), "r" * 64, "gerber", domains[path],
            )
            for path, data in sorted(files.items())
        )
        dossier_digest = sha256_canonical(
            [[m.path, m.released_digest] for m in sorted(members, key=lambda m: m.path)]
        )
        manifest = {
            "schema": "prism.release-studio.manifest/1",
            "config_key": "default",
            "commit_sha": "a" * 40,
            "variant": "default",
            "dossier_digest": dossier_digest,
            "members": {
                m.path: {
                    "member_kind": m.member_kind,
                    "media_type": m.media_type,
                    "size_bytes": m.size_bytes,
                    "released_digest": m.released_digest,
                    "canonicalizer": m.canonicalizer,
                    "domains": list(m.domains),
                }
                for m in members
            },
        }
        payload = dict(files)
        payload["manifest.json"] = canonical_json_bytes(manifest)
        archive_bytes = write_deterministic_archive(payload)

        fingerprints = {
            domain: {
                "domain": domain,
                "fingerprint": sha256_canonical({"domain_id": domain}),
                "inputs": {"domain_id": domain},
                "fidelity": "artifact",
            }
            for domain in ("bare_board", "assembly", "evidence")
        }
        dossier = _Dossier(
            manifest_digest=sha256_canonical(manifest),
            dossier_digest=dossier_digest,
            members=members,
            evidence=(
                {"kind": "drc", "report_digest": "d" * 64, "counts": {"error": 0, "total": 0}},
                {"kind": "erc", "report_digest": "e" * 64, "counts": {"error": 0, "total": 0}},
            ),
            fingerprints=fingerprints,
        )

        # Publish the object exactly where `_artifact_bytes` will look for it.
        objects = Path(tempfile.mkdtemp())
        digest = hashlib.sha256(archive_bytes).hexdigest()
        object_path = objects / digest
        object_path.write_bytes(archive_bytes)
        artifact_id = str(_uuid.uuid4())
        self.conn.execute(
            """
            INSERT INTO ws_artifacts (
                id, kind, artifact_key, digest, object_path, media_type,
                size_bytes, schema_version, generator_version, readiness
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                artifact_id, "release_dossier", f"release-dossier:{digest}", digest,
                str(object_path), "application/gzip", len(archive_bytes), "", "r11", "ready",
            ),
        )
        # The service opens its own connection, so this has to be visible to it.
        self.conn.commit()

        from app.release_studio.config.digests import technical_config_digest

        configuration = {
            "schema": "prism.release-studio.configuration/1",
            "title": "Published fixture",
            "board": "board.kicad_pcb", "schematic": "board.kicad_sch",
            "jobset": "Outputs.kicad_jobset", "default_variant": "default",
            "fields": {}, "notes": {}, "variants": [], "typography": "inter",
            "vendors": [], "document_number": "COMMITTED-200", "revision": "B",
        }
        candidate = self.service.create_candidate(
            project_id=self.project_id, repository_id="repo-1", config_key="default",
            commit_sha="a" * 40, variant="default",
            technical_config_digest=technical_config_digest(configuration), input_closure_digest="ic" * 32,
            toolchain_digest="tl" * 32, generator_build="r11", hermetic=True,
            policy_snapshot_captured=True,
            configuration_snapshot_captured=True,
            configuration_document=configuration,
            created_by="designer",
        )
        build = self.service.start_build(candidate["id"], job_id=None, fence=1)
        completed = self.service.complete_build(
            build_id=build["id"], dossier=dossier, toolchain={}, fence=1,
            dossier_artifact_id=artifact_id,
        )
        return candidate, completed

    def test_a_governed_release_is_signed_and_verifies_offline(self) -> None:
        """The whole point of the feature, end to end through the API.

        Build -> evaluate -> waive every blocker -> approve both required roles
        -> release -> download the archive -> verify it with the standalone
        verifier and nothing else.
        """

        candidate, build = self._published_build()
        _run(
            self.api.evaluate_build(
                self.project_id, build["id"],
                self.api.EvaluateRequest(config_key="default"), user=self.user,
            )
        )

        evaluation = self.service.latest_evaluation(build["id"])
        for finding in evaluation["findings"]:
            waiver = self.service.create_waiver(
                project_id=self.project_id, config_key="default",
                rule_id=finding["rule_id"], domain=finding["domain"],
                reason="synthetic fixture", owner="designer",
                finding_key=finding["finding_key"],
                # Waivers are build-scoped: an exception accepted on one set of
                # outputs does not carry to the next release.
                build_id=build["id"],
            )
            self.service.transition_waiver(waiver["id"], status="approved", actor="quality")

        # Waiver transitions change the active-waiver binding. Refresh once,
        # then all required approvals intentionally bind to this same view.
        _run(self.api.evaluate_build(
            self.project_id, build["id"], self.api.EvaluateRequest(), user=self.user
        ))
        evaluation = self.service.latest_evaluation(build["id"])
        for role, domain in (("pcb_design", "bare_board"), ("manufacturing", "assembly")):
            _run(
                self.api.create_approval(
                    self.project_id, build["id"],
                    self.api.ApprovalRequest(
                        evaluation_id=evaluation["id"],
                        role=role,
                        domains=[domain],
                        decision="approved",
                    ),
                    user=_User("quality", role="admin"),
                )
            )

        record = _run(
            self.api.create_release(
                self.project_id, build["id"],
                self.api.ReleaseRequest(
                    release_label="REL-1", document_number="DOC-1", revision="A"
                ),
                user=self.user,
            )
        )
        self.assertEqual(record["release_label"], "REL-1")
        self.assertTrue(record["signature"])
        self.assertTrue(record["attestation_digest"])
        self.assertEqual(record["dossier_digest"], build["dossier_digest"])
        self.assertEqual(record["document_number"], "COMMITTED-200")
        self.assertEqual(record["revision"], "B")

        # The archive a recipient actually receives.
        response = _run(
            self.api.download_release_archive(self.project_id, record["id"], user=self.user)
        )
        archive = response.body

        from app.release_studio.verify import verify_archive_bytes

        trusted_keys = {
            item["key_id"]: item["public_key"]
            for item in self.service.list_signing_keys()
        }
        report = verify_archive_bytes(archive, trusted_keys=trusted_keys)
        self.assertTrue(report.ok, report.to_dict())

        # An untrusted key must fail even though every digest is internally
        # consistent: consistency is not authenticity.
        untrusted = verify_archive_bytes(
            archive,
            trusted_keys=trusted_keys,
            trusted_key_ids=("someone-else",),
        )
        self.assertFalse(untrusted.ok)

    def test_waiver_cannot_be_approved_by_its_owner_through_the_api(self) -> None:
        _candidate, build = self._built()
        waiver = _run(
            self.api.create_build_waiver(
                self.project_id, build["id"],
                self.api.WaiverRequest(
                    config_key="default", rule_id="drc.clean", domain="evidence",
                    reason="agreed with the CM", subject_pattern="drc/*",
                ),
                user=_User("designer"),
            )
        )
        with self.assertRaises(HTTPException) as caught:
            _run(
                self.api.transition_waiver(
                    self.project_id, waiver["id"], "approve",
                    self.api.WaiverTransitionRequest(reason=""),
                    user=_User("designer"),
                )
            )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("own owner", caught.exception.detail)

        # The exception path is reachable through the API on the same terms the
        # service imposes: a named kind plus a written reason.
        approved = _run(
            self.api.transition_waiver(
                self.project_id, waiver["id"], "approve",
                self.api.WaiverTransitionRequest(
                    reason="",
                    exception_kind="self_approval",
                    exception_reason="sole operator on this deployment",
                ),
                user=_User("designer"),
            )
        )
        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["exception_kind"], "self_approval")

    def test_audit_verify_reports_a_healthy_chain(self) -> None:
        self._built()
        report = _run(self.api.verify_audit(self.project_id, "default", user=self.user))
        self.assertTrue(report["ok"], report["problems"])
        self.assertGreater(report["events"], 0)

    def test_signing_keys_endpoint_serves_public_material_only(self) -> None:
        self.service.upsert_signing_key(
            key_id="k1", algorithm="ed25519", public_key="-----BEGIN PUBLIC KEY-----"
        )
        payload = _run(self.api.signing_keys())
        self.assertEqual(len(payload["keys"]), 1)
        self.assertEqual(
            sorted(payload["keys"][0]),
            ["algorithm", "key_id", "public_key", "status", "valid_from", "valid_to"],
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
