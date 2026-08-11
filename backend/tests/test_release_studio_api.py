"""R19 acceptance: the Release Studio HTTP surface.

Route handlers are called directly (the pattern `test_health_api.py` uses) so
the gate logic is exercised without standing up OIDC.  What matters here is
that the release endpoint refuses for the right reasons and in the right order:
unwaived blockers, unevaluable rules, then missing approvals.
"""

from __future__ import annotations

import asyncio
import os
import sys
import unittest
import uuid
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

from fastapi import HTTPException  # noqa: E402

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

        self.user = _User("quality")
        self.project_id = "proj-1"

    def _drop(self) -> None:
        self.conn.rollback()
        self.conn.execute("SET search_path TO public")
        self.conn.execute(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE')
        self.conn.commit()

    # -- fixtures ----------------------------------------------------------

    def _built(self, *, drc_errors: int = 0):
        from tests.test_release_studio_governance import _dossier

        candidate = self.service.create_candidate(
            project_id=self.project_id, repository_id="repo-1", config_key="default",
            commit_sha="a" * 40, variant="default",
            technical_config_digest="tc" * 32, input_closure_digest="ic" * 32,
            toolchain_digest="tl" * 32, generator_build="r11", hermetic=True,
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
        completed = self.service.complete_build(
            build_id=build["id"], dossier=dossier, toolchain={}, fence=1
        )
        return candidate, completed

    # -- tests -------------------------------------------------------------

    def test_build_detail_exposes_every_governed_view(self) -> None:
        _candidate, build = self._built()
        payload = _run(self.api.get_build(self.project_id, build["id"], user=self.user))
        self.assertEqual(
            sorted(payload),
            ["approvals", "build", "evaluation", "evidence", "fingerprints", "members"],
        )
        self.assertEqual(len(payload["members"]), 3)
        self.assertEqual(sorted(payload["fingerprints"]), ["assembly", "bare_board", "evidence"])

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
            )
            self.service.transition_waiver(waiver["id"], status="approved", actor="quality")

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

    def test_waiver_cannot_be_approved_by_its_owner_through_the_api(self) -> None:
        waiver = _run(
            self.api.create_waiver(
                self.project_id,
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
