"""R11/R15-R17/R18 acceptance against real PostgreSQL.

Covers the governed cycle end to end — candidate, build, evaluate, waive,
approve, carry forward, release, verify — plus the two separation properties
the whole design exists for:

* a policy bump with no source change invalidates approvals while
  ``manifest_digest`` and every ``technical_scope_fingerprint`` stay put;
* an assembly-only change invalidates ``assembly`` and carries ``bare_board``.

Skips without ``TEST_POSTGRES_URL``; the strict runner forbids skipping.
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

TEST_POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()


@dataclass(frozen=True)
class _Member:
    path: str
    member_kind: str
    media_type: str
    size_bytes: int
    released_digest: str
    source_raw_digest: str
    canonicalizer: str
    domains: tuple[str, ...]


@dataclass(frozen=True)
class _Dossier:
    manifest_digest: str
    dossier_digest: str
    members: tuple[_Member, ...]
    evidence: tuple[Mapping[str, Any], ...] = ()
    fingerprints: Mapping[str, dict] = field(default_factory=dict)


def _dossier(*, positions_digest: str = "p" * 64, manifest: str = "m" * 64) -> _Dossier:
    from app.release_studio.canonical import sha256_canonical

    members = (
        _Member(
            "fabrication/gerbers/board-F_Cu.gbr", "gerber", "application/vnd.gerber",
            120, "g" * 64, "gr" * 32, "gerber", ("bare_board",),
        ),
        _Member(
            "assembly/positions.csv", "position", "text/csv",
            80, positions_digest, "pr" * 32, "csv", ("assembly",),
        ),
        _Member(
            "evidence/drc.json", "drc_report", "application/json",
            60, "d" * 64, "dr" * 32, "drc_erc_json", ("evidence",),
        ),
    )
    fingerprints = {
        domain: {
            "domain": domain,
            "fingerprint": sha256_canonical(
                [
                    [m.path, m.released_digest]
                    for m in members
                    if domain in m.domains
                ]
            ),
            "inputs": {"domain_id": domain},
            "fidelity": "artifact",
        }
        for domain in ("bare_board", "assembly", "evidence")
    }
    return _Dossier(
        manifest_digest=manifest,
        dossier_digest="ds" * 32,
        members=members,
        evidence=(
            {"kind": "drc", "report_digest": "d" * 64, "counts": {"error": 0, "total": 0}},
            {"kind": "erc", "report_digest": "e" * 64, "counts": {"error": 0, "total": 0}},
        ),
        fingerprints=fingerprints,
    )


@unittest.skipIf(psycopg is None, "psycopg is required")
@unittest.skipIf(not TEST_POSTGRES_URL, "TEST_POSTGRES_URL must point at an isolated database")
class ReleaseStudioGovernanceTests(unittest.TestCase):
    schema: str

    @classmethod
    def setUpClass(cls) -> None:
        os.environ["PRISM_DATABASE_URL"] = TEST_POSTGRES_URL
        cls.schema = f"rs_gov_{uuid.uuid4().hex[:10]}"

    def setUp(self) -> None:
        from unittest.mock import patch

        from app.services import release_studio_service as service
        from app.services.workspace_schema_migrations import apply_workspace_migrations

        # The self-approval bypass defaults to *on* wherever authentication is
        # off, which includes the test environment. Pin it off so the tests that
        # assert the two-person rule are testing the rule and not the ambient
        # configuration; the bypass has its own test that pins it on.
        bypass = patch.dict(os.environ, {"PRISM_RELEASE_ALLOW_SELF_APPROVAL": "0"})
        bypass.start()
        self.addCleanup(bypass.stop)

        self.service = service
        self.conn = psycopg.connect(TEST_POSTGRES_URL, row_factory=psycopg.rows.dict_row)
        self.addCleanup(self.conn.close)
        self.schema = f"rs_gov_{uuid.uuid4().hex[:10]}"
        self.conn.execute(f'CREATE SCHEMA "{self.schema}"')
        self.conn.execute(f'SET search_path TO "{self.schema}", public')
        self._base_tables()
        apply_workspace_migrations(self.conn)
        self.conn.commit()
        self.addCleanup(self._drop_schema)

        # Point the service's own connections at this disposable schema.
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

        self._original_connect = service.connect
        service.connect = _connect
        self.addCleanup(lambda: setattr(service, "connect", self._original_connect))

        self.project_id = "proj-1"
        self.config_key = "default"

    def _drop_schema(self) -> None:
        self.conn.rollback()
        self.conn.execute(f'SET search_path TO public')
        self.conn.execute(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE')
        self.conn.commit()

    def _base_tables(self) -> None:
        # Mirrors test_release_studio_schema_migration's base fixture: the
        # Release Studio migrations run on top of the v3 job foundation.
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
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                percent REAL NOT NULL DEFAULT 0,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """,
            prepare=False,
        )
        self.conn.execute("INSERT INTO ws_repositories(id) VALUES ('repo-1')")
        self.conn.execute("INSERT INTO ws_projects(id, repo_id) VALUES ('proj-1','repo-1')")

    # -- helpers -----------------------------------------------------------

    def _candidate(self, *, closure="c" * 64, author="designer", variant="default"):
        return self.service.create_candidate(
            project_id=self.project_id,
            repository_id="repo-1",
            config_key=self.config_key,
            commit_sha="a" * 40,
            variant=variant,
            technical_config_digest="tc" * 32,
            input_closure_digest=closure,
            toolchain_digest="tl" * 32,
            generator_build="r10",
            hermetic=True,
            created_by=author,
        )

    def _built(self, candidate, dossier):
        build = self.service.start_build(candidate["id"], job_id=None, fence=1)
        return self.service.complete_build(
            build_id=build["id"],
            dossier=dossier,
            toolchain={"kicad_version": "10.0.4"},
            fence=1,
        )

    def _evaluate(self, build_id, *, rules=None, waivers=(), members=None, evidence=None):
        from app.release_studio.policy import RuleContext, evaluate, resolve_policy

        resolved = resolve_policy(
            {
                "rules": rules
                if rules is not None
                else [{"id": "drc.clean", "params": {"max_errors": 0}}],
                "required_approvals": [{"role": "pcb_design", "domains": ["bare_board"]}],
            }
        )
        context = RuleContext(
            members=members if members is not None else [],
            evidence=evidence
            if evidence is not None
            else [{"kind": "drc", "counts": {"error": 0, "total": 0}}],
            projections={},
            hermetic=True,
            non_hermetic_reasons=[],
            manifest={},
        )
        result = evaluate(resolved, context, waivers=waivers)
        self.service.record_evaluation(
            build_id=build_id, evaluation=result, evaluator_build="r13"
        )
        return result

    # -- candidates and builds --------------------------------------------

    def test_candidate_creation_is_idempotent_on_build_key(self) -> None:
        first = self._candidate()
        second = self._candidate()
        self.assertEqual(first["id"], second["id"])
        self.assertTrue(first["build_key"])
        # A different closure is a different candidate.
        third = self._candidate(closure="z" * 64)
        self.assertNotEqual(first["id"], third["id"])

    def test_build_key_excludes_policy_and_survives_reevaluation(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        before = self.service.get_build(built["id"])

        # Re-evaluate under a different policy: no technical row may move.
        self._evaluate(
            built["id"],
            rules=[{"id": "drc.clean", "severity": "warning", "params": {"max_errors": 5}}],
        )
        after = self.service.get_build(built["id"])
        self.assertEqual(before["manifest_digest"], after["manifest_digest"])
        self.assertEqual(before["dossier_digest"], after["dossier_digest"])
        self.assertEqual(
            self.service.build_fingerprints(built["id"]),
            self.service.build_fingerprints(built["id"]),
        )

    def test_stale_fence_cannot_complete_a_build(self) -> None:
        candidate = self._candidate()
        build = self.service.start_build(candidate["id"], job_id=None, fence=7)
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "stale fence"):
            self.service.complete_build(
                build_id=build["id"],
                dossier=_dossier(),
                toolchain={},
                fence=6,
            )
        self.assertEqual(self.service.get_build(build["id"])["status"], "running")

    def test_members_evidence_and_fingerprints_are_persisted(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        members = self.service.build_members(built["id"])
        self.assertEqual(len(members), 3)
        positions = next(m for m in members if m["path"] == "assembly/positions.csv")
        self.assertEqual(list(positions["domains"]), ["assembly"])
        self.assertNotEqual(positions["released_digest"], positions["source_raw_digest"])
        self.assertEqual(len(self.service.build_evidence(built["id"])), 2)
        self.assertEqual(
            sorted(self.service.build_fingerprints(built["id"])),
            ["assembly", "bare_board", "evidence"],
        )

    # -- audit chain -------------------------------------------------------

    def test_audit_chain_verifies_and_detects_tampering(self) -> None:
        candidate = self._candidate()
        self._built(candidate, _dossier())
        report = self.service.verify_audit_chain(self.project_id, self.config_key)
        self.assertTrue(report["ok"], report["problems"])
        self.assertGreaterEqual(report["events"], 2)

        # A privileged mutation is detectable even though the trigger blocks
        # the application from making it.
        self.conn.execute(
            "ALTER TABLE ws_release_audit_events DISABLE TRIGGER "
            "trg_ws_release_audit_events_immutable"
        )
        self.conn.execute(
            "UPDATE ws_release_audit_events SET actor = 'someone-else' WHERE sequence = 1"
        )
        self.conn.execute(
            "ALTER TABLE ws_release_audit_events ENABLE TRIGGER "
            "trg_ws_release_audit_events_immutable"
        )
        self.conn.commit()
        tampered = self.service.verify_audit_chain(self.project_id, self.config_key)
        self.assertFalse(tampered["ok"])
        self.assertTrue(any("hash does not match" in item for item in tampered["problems"]))

    def test_application_writes_cannot_mutate_the_audit_trail(self) -> None:
        candidate = self._candidate()
        self._built(candidate, _dossier())
        with self.service.connect() as conn:
            with self.assertRaises(psycopg.errors.ObjectNotInPrerequisiteState):
                conn.execute("UPDATE ws_release_audit_events SET actor='x'")

    # -- waivers -----------------------------------------------------------

    def test_waiver_lifecycle_is_audited_and_never_deletes_rows(self) -> None:
        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="drc.clean", domain="evidence", reason="agreed with CM",
            owner="designer", subject_pattern="drc/*",
        )
        self.assertEqual(waiver["status"], "proposed")
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "own owner"):
            self.service.transition_waiver(waiver["id"], status="approved", actor="designer")
        approved = self.service.transition_waiver(
            waiver["id"], status="approved", actor="quality"
        )
        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["approver"], "quality")

        revoked = self.service.transition_waiver(
            waiver["id"], status="revoked", actor="quality", reason="no longer applies"
        )
        self.assertEqual(revoked["status"], "revoked")
        self.assertIsNotNone(self.service.get_waiver(waiver["id"]))
        events = [
            item["event_type"]
            for item in self.service.list_audit_events(self.project_id, self.config_key)
        ]
        for expected in ("waiver.proposed", "waiver.approved", "waiver.revoked"):
            self.assertIn(expected, events)

    def test_self_approving_a_waiver_requires_an_audited_exception(self) -> None:
        # A single-operator deployment owns every waiver it raises, so a flat
        # prohibition makes every blocker permanently unclearable. The two-person
        # rule still stands; it is escapable only on the same terms an approval
        # already imposes -- a named kind, a written reason, and an audit event.
        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="drc.clean", domain="evidence", reason="agreed with CM",
            owner="solo", subject_pattern="drc/*",
        )

        with self.assertRaisesRegex(self.service.ReleaseStudioError, "audited"):
            self.service.transition_waiver(
                waiver["id"], status="approved", actor="solo"
            )
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "written"):
            self.service.transition_waiver(
                waiver["id"], status="approved", actor="solo",
                exception_kind="self_approval",
            )
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "unknown waiver exception"):
            self.service.transition_waiver(
                waiver["id"], status="approved", actor="solo",
                exception_kind="emergency", exception_reason="because",
            )

        approved = self.service.transition_waiver(
            waiver["id"], status="approved", actor="solo",
            exception_kind="self_approval",
            exception_reason="sole operator on a local deployment",
        )
        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["exception_kind"], "self_approval")
        self.assertEqual(
            approved["exception_reason"], "sole operator on a local deployment"
        )

        # The exception must be in the hash-chained trail, not only on the row.
        event = next(
            item
            for item in self.service.list_audit_events(self.project_id, self.config_key)
            if item["event_type"] == "waiver.approved"
        )
        self.assertEqual(event["details"]["exception_kind"], "self_approval")
        self.assertIn("sole operator", event["details"]["exception_reason"])
        self.assertTrue(self.service.verify_audit_chain(self.project_id, self.config_key)["ok"])

    def test_the_bypass_permits_self_approval_but_still_records_it(self) -> None:
        """A deployment may switch the rule off; it may not switch the trail off.

        The bypass exists because a single-operator deployment has exactly one
        identity, so the two-person rule is unsatisfiable rather than merely
        inconvenient. What it must never do is make a self-approval look like an
        ordinary one.
        """

        from unittest.mock import patch

        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="drc.clean", domain="evidence", reason="agreed with CM",
            owner="solo", subject_pattern="drc/*",
        )

        with patch.dict(os.environ, {"PRISM_RELEASE_ALLOW_SELF_APPROVAL": "1"}):
            self.assertTrue(self.service.self_approval_bypassed())
            approved = self.service.transition_waiver(
                waiver["id"], status="approved", actor="solo"
            )

        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["approver"], "solo")
        # Recorded, not hidden.
        self.assertEqual(approved["exception_kind"], "self_approval")
        self.assertEqual(
            approved["exception_reason"], self.service.SELF_APPROVAL_BYPASS_REASON
        )
        event = next(
            item
            for item in self.service.list_audit_events(self.project_id, self.config_key)
            if item["event_type"] == "waiver.approved"
        )
        self.assertEqual(event["details"]["exception_kind"], "self_approval")
        self.assertTrue(self.service.verify_audit_chain(self.project_id, self.config_key)["ok"])

    def test_the_bypass_is_off_when_explicitly_disabled(self) -> None:
        from unittest.mock import patch

        with patch.dict(os.environ, {"PRISM_RELEASE_ALLOW_SELF_APPROVAL": "false"}):
            self.assertFalse(self.service.self_approval_bypassed())
        with patch.dict(os.environ, {"PRISM_RELEASE_ALLOW_SELF_APPROVAL": "yes"}):
            self.assertTrue(self.service.self_approval_bypassed())

    def test_a_waiver_approved_by_another_person_takes_no_exception(self) -> None:
        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="erc.clean", domain="evidence", reason="agreed with CM",
            owner="designer", subject_pattern="erc/*",
        )
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "takes no exception"):
            self.service.transition_waiver(
                waiver["id"], status="approved", actor="quality",
                exception_kind="self_approval", exception_reason="not applicable",
            )
        approved = self.service.transition_waiver(
            waiver["id"], status="approved", actor="quality"
        )
        self.assertEqual(approved["status"], "approved")
        self.assertIsNone(approved["exception_kind"])

    def test_expired_waiver_stops_applying_without_deletion(self) -> None:
        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="drc.clean", domain="evidence", reason="temporary",
            owner="designer", subject_pattern="drc/*",
            expires_at="2020-01-01T00:00:00+00:00",
        )
        self.service.transition_waiver(waiver["id"], status="approved", actor="quality")
        self.assertEqual(self.service.active_waivers(self.project_id, self.config_key), [])
        self.assertEqual(self.service.get_waiver(waiver["id"])["status"], "approved")

    # -- approvals ---------------------------------------------------------

    def test_self_approval_requires_an_audited_exception(self) -> None:
        candidate = self._candidate(author="designer")
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "two-person approval"):
            self.service.create_approval(
                build_id=built["id"], role="pcb_design", domains=["bare_board"],
                decision="approved", approver="designer",
            )
        approval = self.service.create_approval(
            build_id=built["id"], role="pcb_design", domains=["bare_board"],
            decision="approved", approver="designer",
            exception_kind="self_approval",
            exception_reason="sole engineer on site; agreed with QA lead",
        )
        self.assertEqual(approval["exception_kind"], "self_approval")

    def test_exception_without_a_reason_is_refused(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "written reason"):
            self.service.create_approval(
                build_id=built["id"], role="pcb_design", domains=["bare_board"],
                decision="approved", approver="quality", exception_kind="emergency",
            )

    def test_approval_rows_are_immutable(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        self.service.create_approval(
            build_id=built["id"], role="pcb_design", domains=["bare_board"],
            decision="approved", approver="quality",
        )
        with self.service.connect() as conn:
            with self.assertRaises(psycopg.errors.ObjectNotInPrerequisiteState):
                conn.execute("UPDATE ws_release_approvals SET decision='rejected'")

    def test_approval_requires_an_evaluation_first(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        with self.assertRaisesRegex(self.service.ReleaseStudioError, "must be evaluated"):
            self.service.create_approval(
                build_id=built["id"], role="pcb_design", domains=["bare_board"],
                decision="approved", approver="quality",
            )

    # -- the two separation properties -------------------------------------

    def test_policy_bump_invalidates_approvals_but_no_technical_row_moves(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        self.service.create_approval(
            build_id=built["id"], role="pcb_design", domains=["bare_board"],
            decision="approved", approver="quality",
        )
        before_manifest = self.service.get_build(built["id"])["manifest_digest"]
        before_fingerprints = {
            domain: record["fingerprint"]
            for domain, record in self.service.build_fingerprints(built["id"]).items()
        }

        second = self._evaluate(
            built["id"],
            rules=[{"id": "drc.clean", "severity": "warning", "params": {"max_errors": 1}}],
        )
        invalidated = self.service.invalidate_for_policy_change(
            build_id=built["id"],
            new_policy_binding_digest=second.policy_binding_digest,
            actor="quality",
        )

        self.assertEqual(len(invalidated), 1)
        self.assertEqual(invalidated[0]["stale_component"], "policy")
        self.assertEqual(self.service.effective_approvals(built["id"]), [])

        after = self.service.get_build(built["id"])
        self.assertEqual(before_manifest, after["manifest_digest"])
        self.assertEqual(
            before_fingerprints,
            {
                domain: record["fingerprint"]
                for domain, record in self.service.build_fingerprints(built["id"]).items()
            },
        )

    def test_assembly_only_change_carries_bare_board_and_invalidates_assembly(self) -> None:
        candidate = self._candidate()
        first = self._built(candidate, _dossier())
        evaluation = self._evaluate(first["id"])
        for domain in ("bare_board", "assembly"):
            self.service.create_approval(
                build_id=first["id"],
                role="pcb_design" if domain == "bare_board" else "manufacturing",
                domains=[domain], decision="approved", approver="quality",
            )

        # A DNP-only variant change moves the position file and nothing else.
        next_candidate = self._candidate(closure="c2" * 32)
        second = self._built(next_candidate, _dossier(positions_digest="q" * 64))
        self._evaluate(second["id"])

        result = self.service.carry_forward_approvals(
            source_build_id=first["id"], target_build_id=second["id"], actor="quality"
        )
        carried_domains = sorted(d for item in result["carried"] for d in item["domains"])
        self.assertEqual(carried_domains, ["bare_board"])
        self.assertEqual(len(result["invalidated"]), 1)
        self.assertEqual(result["invalidated"][0]["stale_component"], "technical")
        self.assertEqual(list(result["invalidated"][0]["changed_domains"]), ["assembly"])
        self.assertTrue(result["carried"][0]["carried_from_approval_id"])

    # -- release -----------------------------------------------------------

    def test_full_governed_cycle_ends_in_a_signed_verifiable_release(self) -> None:
        from app.release_studio.attestation import (
            build_attestation,
            build_release_archive,
            generate_signing_key,
        )
        from app.release_studio.canonical import write_deterministic_archive
        from app.release_studio.canonical.json import canonical_json_bytes
        from app.release_studio.policy import release_is_permitted
        from app.release_studio.verify import verify_archive_bytes

        candidate = self._candidate()
        built = self._built(candidate, _dossier())

        # A DRC blocker first: release must be refused.
        blocked = self._evaluate(
            built["id"], evidence=[{"kind": "drc", "counts": {"error": 2, "total": 2}}]
        )
        permitted, reason = release_is_permitted(blocked)
        self.assertFalse(permitted)
        self.assertIn("blocking finding", reason)

        # Waive it, then re-evaluate.
        waiver = self.service.create_waiver(
            project_id=self.project_id, config_key=self.config_key,
            rule_id="drc.clean", domain="evidence", reason="CM accepted deviation",
            owner="designer", subject_pattern="drc/*",
        )
        self.service.transition_waiver(waiver["id"], status="approved", actor="quality")
        cleared = self._evaluate(
            built["id"],
            evidence=[{"kind": "drc", "counts": {"error": 2, "total": 2}}],
            waivers=self.service.active_waivers(self.project_id, self.config_key),
        )
        permitted, reason = release_is_permitted(cleared)
        self.assertTrue(permitted, reason)

        approval = self.service.create_approval(
            build_id=built["id"], role="pcb_design", domains=["bare_board"],
            decision="approved", approver="quality",
            reauth_context={"method": "password", "at": "2026-08-11T12:00:00+00:00"},
        )

        # Build a real dossier archive so the verifier has something to check.
        import hashlib

        files = {"fabrication/gerbers/board-F_Cu.gbr": b"%FSLAX46Y46*%\nM02*\n"}
        manifest = {
            "schema": "prism.release-studio.manifest/1",
            "commit_sha": candidate["commit_sha"],
            "members": {
                path: {"released_digest": hashlib.sha256(data).hexdigest()}
                for path, data in files.items()
            },
        }
        from app.release_studio.canonical import sha256_canonical

        manifest["dossier_digest"] = sha256_canonical(
            [[p, e["released_digest"]] for p, e in sorted(manifest["members"].items())]
        )
        payload = dict(files)
        payload["manifest.json"] = canonical_json_bytes(manifest)
        dossier_bytes = write_deterministic_archive(payload)

        key, _pem = generate_signing_key("prism-test-key")
        self.service.upsert_signing_key(
            key_id=key.key_id, algorithm="ed25519", public_key=key.public_pem
        )
        head = self.service.current_audit_head(self.project_id, self.config_key)
        attestation = build_attestation(
            manifest_digest=sha256_canonical(manifest),
            dossier_digest=manifest["dossier_digest"],
            commit_sha=candidate["commit_sha"],
            variant=candidate["variant"],
            config_key=self.config_key,
            project_id=self.project_id,
            release_label="REL-0001",
            document_number="DOC-1",
            revision="A",
            released_by="release-manager",
            released_at_iso="2026-08-11T12:00:00+00:00",
            policy_snapshot={
                "policy_binding_digest": cleared.policy_binding_digest,
                "waivers": [waiver["id"]],
            },
            approval_snapshot=[
                {
                    "role": approval["role"],
                    "approver": approval["approver"],
                    "decision": approval["decision"],
                    "domains": list(approval["domains"]),
                }
            ],
            audit_head=head,
            signing_key_id=key.key_id,
            issuer="Example Org",
        )
        record = self.service.create_release_record(
            build_id=built["id"],
            release_label="REL-0001",
            document_number="DOC-1",
            revision="A",
            released_by="release-manager",
            attestation=attestation,
            signature=key.sign_hex(attestation["attestation_digest"]),
            signing_key_id=key.key_id,
            policy_snapshot={"waivers": [waiver["id"]]},
            approval_snapshot=[{"approver": approval["approver"]}],
        )
        self.assertEqual(record["release_label"], "REL-0001")
        self.assertIn(waiver["id"], record["policy_snapshot"]["waivers"])
        self.assertEqual(self.service.get_candidate(candidate["id"])["status"], "frozen")

        archive = build_release_archive(
            dossier_bytes=dossier_bytes,
            attestation=attestation,
            signature_hex=record["signature"],
            signing_key_id=key.key_id,
            public_pem=key.public_pem,
        )
        report = verify_archive_bytes(archive, trusted_key_ids=(key.key_id,))
        self.assertTrue(report.ok, report.render())

        chain = self.service.verify_audit_chain(self.project_id, self.config_key)
        self.assertTrue(chain["ok"], chain["problems"])
        self.assertEqual(attestation["audit"]["chain_head_hash"], head["event_hash"])

    def test_two_release_records_may_reference_one_dossier(self) -> None:
        candidate = self._candidate()
        built = self._built(candidate, _dossier())
        self._evaluate(built["id"])
        # A release record must name a published key: the FK is what stops a
        # release referencing key material nobody can fetch.
        self.service.upsert_signing_key(
            key_id="k", algorithm="ed25519", public_key="-----BEGIN PUBLIC KEY-----"
        )
        common = dict(
            build_id=built["id"],
            document_number="DOC-1",
            revision="A",
            released_by="release-manager",
            attestation={"attestation_digest": "x" * 64},
            signature="00",
            signing_key_id="k",
            policy_snapshot={},
            approval_snapshot=[],
        )
        first = self.service.create_release_record(release_label="REL-1", **common)
        second = self.service.create_release_record(release_label="REL-2", **common)
        self.assertEqual(first["dossier_digest"], second["dossier_digest"])
        self.assertEqual(len(self.service.list_release_records(self.project_id)), 2)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
