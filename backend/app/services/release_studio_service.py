"""Persistence and governance for Release Studio (R11, R15-R17, R18).

The two domains stay separated here as strictly as they do in the digest
graph.  Technical rows — candidates, builds, members, fingerprints — never read
a policy or an approver.  Governance rows bind to the *pair*
``(technical_scope_fingerprint[domain], policy_binding_digest)`` stored in two
independent columns, so a stale approval can say which half went stale.

Approvals and audit events are immutable at the application boundary (database
triggers raise on UPDATE/DELETE); invalidation is an append to
``ws_release_approval_invalidations``, never an edit.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Mapping, Sequence

from app.release_studio.canonical import sha256_canonical
from app.release_studio.dossier import GOVERNED_DOMAINS
from app.services.postgres_database import database
from app.services.workspace_schema_migrations import apply_workspace_migrations

SELF_APPROVAL_BYPASS_REASON = "two-person rule bypassed by deployment configuration"


def self_approval_bypassed() -> bool:
    """May one identity both raise and approve, with no second person?

    Automatic when authentication is off, because there is then exactly one
    identity in the entire deployment and the two-person rule is not merely
    inconvenient but unsatisfiable.  ``PRISM_RELEASE_ALLOW_SELF_APPROVAL``
    forces it on for an authenticated deployment that has made that call
    deliberately.

    The bypass changes who may approve; it never changes what is recorded.  A
    self-approval taken under it is still written to the row and to the
    hash-chained audit trail as a ``self_approval`` exception, so a reader can
    always tell that no second person was involved.
    """

    import os

    flag = os.environ.get("PRISM_RELEASE_ALLOW_SELF_APPROVAL", "").strip().casefold()
    if flag in {"1", "true", "yes", "on"}:
        return True
    if flag in {"0", "false", "no", "off"}:
        return False

    from app.core.config import settings

    return not settings.AUTH_ENABLED

CANDIDATE_STATUSES = ("draft", "building", "built", "failed", "superseded", "frozen")
APPROVAL_DECISIONS = ("approved", "rejected", "changes_requested")
EXCEPTION_KINDS = ("self_approval", "emergency", "self_approval_and_emergency")
WAIVER_STATUSES = ("proposed", "approved", "rejected", "revoked", "expired")


class ReleaseStudioError(RuntimeError):
    """A Release Studio operation was refused."""


class ReleaseGateError(ReleaseStudioError):
    """A release was refused by policy, evidence, or approval gates."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


@contextmanager
def connect() -> Iterator[Any]:
    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        yield conn


def initialize() -> None:
    with connect() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("prism-schema",))
        apply_workspace_migrations(conn)
        conn.commit()


# ---------------------------------------------------------------------------
# Audit chain
# ---------------------------------------------------------------------------


def _event_hash(previous_hash: str | None, fields: Mapping[str, Any], created_at_iso: str) -> str:
    """``H(previous_hash, event fields, created_at_iso)``.

    ``previous_hash`` is hashed as JSON ``null`` for the genesis event, never as
    an empty string, so a genesis event and an event chained from ``''`` can
    never collide.
    """

    return sha256_canonical(
        {
            "previous_hash": previous_hash,
            "event": dict(fields),
            "created_at_iso": created_at_iso,
        }
    )


def append_audit_event(
    conn: Any,
    *,
    project_id: str,
    config_key: str,
    event_type: str,
    actor: str,
    subject_kind: str,
    subject_id: str,
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Append one event under the caller's transaction."""

    row = conn.execute(
        """
        SELECT sequence, event_hash FROM ws_release_audit_events
        WHERE project_id = %s AND config_key = %s
        ORDER BY sequence DESC LIMIT 1
        """,
        (project_id, config_key),
    ).fetchone()
    sequence = (int(row["sequence"]) + 1) if row else 1
    previous_hash = str(row["event_hash"]) if row else None

    created_at_iso = _now_iso()
    fields = {
        "project_id": project_id,
        "config_key": config_key,
        "sequence": sequence,
        "event_type": event_type,
        "actor": actor,
        "subject_kind": subject_kind,
        "subject_id": subject_id,
        "details": dict(details or {}),
    }
    event_hash = _event_hash(previous_hash, fields, created_at_iso)
    event_id = _new_id("audit")
    conn.execute(
        """
        INSERT INTO ws_release_audit_events(
            id, project_id, config_key, sequence, event_type, actor,
            subject_kind, subject_id, details, previous_hash, event_hash,
            created_at_iso
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            event_id, project_id, config_key, sequence, event_type, actor,
            subject_kind, subject_id, json.dumps(fields["details"]),
            previous_hash, event_hash, created_at_iso,
        ),
    )
    return {"id": event_id, "sequence": sequence, "event_hash": event_hash}


def audit_head(conn: Any, project_id: str, config_key: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT sequence, event_hash FROM ws_release_audit_events
        WHERE project_id = %s AND config_key = %s
        ORDER BY sequence DESC LIMIT 1
        """,
        (project_id, config_key),
    ).fetchone()
    return dict(row) if row else {"sequence": 0, "event_hash": ""}


def current_audit_head(project_id: str, config_key: str) -> dict[str, Any]:
    """``audit_head`` for callers that are not already inside a transaction."""

    with connect() as conn:
        return audit_head(conn, project_id, config_key)


def list_audit_events(project_id: str, config_key: str, limit: int = 500) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ws_release_audit_events
            WHERE project_id = %s AND config_key = %s
            ORDER BY sequence DESC LIMIT %s
            """,
            (project_id, config_key, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def verify_audit_chain(project_id: str, config_key: str) -> dict[str, Any]:
    """Walk the chain and recompute every link.

    Unlike the migration's shape precondition, this checks *linkage*: sequence
    contiguity, a single genesis, and ``previous_hash[n] == event_hash[n-1]``.
    """

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ws_release_audit_events
            WHERE project_id = %s AND config_key = %s ORDER BY sequence ASC
            """,
            (project_id, config_key),
        ).fetchall()

    problems: list[str] = []
    previous_hash: str | None = None
    expected_sequence = 1
    for row in rows:
        record = dict(row)
        if int(record["sequence"]) != expected_sequence:
            problems.append(
                f"sequence gap: expected {expected_sequence}, found {record['sequence']}"
            )
            expected_sequence = int(record["sequence"])
        if record["previous_hash"] != previous_hash:
            problems.append(
                f"broken link at sequence {record['sequence']}: previous_hash does not "
                "match the preceding event_hash"
            )
        recomputed = _event_hash(
            record["previous_hash"],
            {
                "project_id": record["project_id"],
                "config_key": record["config_key"],
                "sequence": int(record["sequence"]),
                "event_type": record["event_type"],
                "actor": record["actor"],
                "subject_kind": record["subject_kind"],
                "subject_id": record["subject_id"],
                "details": record["details"] or {},
            },
            record["created_at_iso"],
        )
        if recomputed != record["event_hash"]:
            problems.append(f"event {record['sequence']} hash does not match its content")
        previous_hash = record["event_hash"]
        expected_sequence += 1

    return {
        "ok": not problems,
        "events": len(rows),
        "head": previous_hash or "",
        "problems": problems,
    }


# ---------------------------------------------------------------------------
# Configurations
# ---------------------------------------------------------------------------


def upsert_configuration(
    *,
    project_id: str,
    config_key: str,
    title: str,
    board_rel: str,
    schematic_rel: str = "",
    jobset_rel: str = "",
    default_variant: str = "",
    created_by: str = "",
) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO ws_release_configurations(
                id, project_id, config_key, title, board_rel, schematic_rel,
                jobset_rel, default_variant, created_by
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (project_id, config_key) DO UPDATE SET
                title = EXCLUDED.title,
                board_rel = EXCLUDED.board_rel,
                schematic_rel = EXCLUDED.schematic_rel,
                jobset_rel = EXCLUDED.jobset_rel,
                default_variant = EXCLUDED.default_variant,
                updated_at = NOW()
            """,
            (
                _new_id("cfg"), project_id, config_key, title, board_rel,
                schematic_rel, jobset_rel, default_variant, created_by,
            ),
        )
        conn.commit()
    return get_configuration(project_id, config_key) or {}


def list_configurations(project_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_configurations WHERE project_id = %s ORDER BY config_key",
            (project_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_configuration(project_id: str, config_key: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_configurations WHERE project_id = %s AND config_key = %s",
            (project_id, config_key),
        ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------


def compute_build_key(
    *,
    technical_config_digest: str,
    input_closure_digest: str,
    variant: str,
    toolchain_digest: str,
) -> str:
    """``H(technical_config_digest, input_closure_digest, variant, toolchain_digest)``.

    Policy is deliberately absent: re-evaluating an existing build under a new
    policy must not produce a different build key or re-run KiCad.
    """

    return sha256_canonical(
        {
            "technical_config_digest": technical_config_digest,
            "input_closure_digest": input_closure_digest,
            "variant": variant,
            "toolchain_digest": toolchain_digest,
        }
    )


def create_candidate(
    *,
    project_id: str,
    repository_id: str,
    config_key: str,
    commit_sha: str,
    variant: str,
    technical_config_digest: str,
    input_closure_digest: str,
    toolchain_digest: str,
    generator_build: str,
    hermetic: bool,
    non_hermetic_reasons: Sequence[str] = (),
    closure_inputs: Sequence[Mapping[str, Any]] = (),
    created_by: str = "",
) -> dict[str, Any]:
    """Idempotent on ``build_key``: the same inputs return the same candidate."""

    build_key = compute_build_key(
        technical_config_digest=technical_config_digest,
        input_closure_digest=input_closure_digest,
        variant=variant,
        toolchain_digest=toolchain_digest,
    )
    with connect() as conn:
        existing = conn.execute(
            """
            SELECT * FROM ws_release_candidates
            WHERE project_id = %s AND config_key = %s AND build_key = %s
            """,
            (project_id, config_key, build_key),
        ).fetchone()
        if existing:
            return dict(existing)

        candidate_id = _new_id("cand")
        conn.execute(
            """
            INSERT INTO ws_release_candidates(
                id, project_id, repository_id, config_key, commit_sha, variant,
                technical_config_digest, input_closure_digest, toolchain_digest,
                generator_build, build_key, status, hermetic, non_hermetic_reasons,
                created_by
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'draft',%s,%s,%s)
            """,
            (
                candidate_id, project_id, repository_id, config_key, commit_sha,
                variant, technical_config_digest, input_closure_digest,
                toolchain_digest, generator_build, build_key, hermetic,
                json.dumps(list(non_hermetic_reasons)), created_by,
            ),
        )
        for item in closure_inputs:
            conn.execute(
                """
                INSERT INTO ws_release_closure_inputs(
                    id, candidate_id, kind, path, git_object_id, mode,
                    object_type, lfs_oid, materialized_digest, details
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (candidate_id, kind, path) DO NOTHING
                """,
                (
                    _new_id("ci"), candidate_id, item.get("kind", "repository"),
                    item.get("path", ""), item.get("git_object_id", ""),
                    item.get("mode", ""), item.get("object_type", ""),
                    item.get("lfs_oid", ""), item.get("materialized_digest", ""),
                    json.dumps(dict(item.get("details") or {})),
                ),
            )
        append_audit_event(
            conn,
            project_id=project_id,
            config_key=config_key,
            event_type="candidate.created",
            actor=created_by,
            subject_kind="candidate",
            subject_id=candidate_id,
            details={"commit_sha": commit_sha, "variant": variant, "build_key": build_key},
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (candidate_id,)
        ).fetchone()
    return dict(row)


def list_candidates(project_id: str, config_key: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM ws_release_candidates WHERE project_id = %s"
    params: list[Any] = [project_id]
    if config_key:
        query += " AND config_key = %s"
        params.append(config_key)
    query += " ORDER BY created_at DESC"
    with connect() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    return [dict(row) for row in rows]


def get_candidate(candidate_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (candidate_id,)
        ).fetchone()
    return dict(row) if row else None


def set_candidate_status(candidate_id: str, status: str, *, actor: str = "") -> dict[str, Any]:
    if status not in CANDIDATE_STATUSES:
        raise ReleaseStudioError(f"unknown candidate status: {status!r}")
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s FOR UPDATE", (candidate_id,)
        ).fetchone()
        if row is None:
            raise ReleaseStudioError("candidate not found")
        if row["status"] == "frozen" and status == "frozen":
            raise ReleaseStudioError("candidate is already frozen")
        conn.execute(
            "UPDATE ws_release_candidates SET status = %s, updated_at = NOW() WHERE id = %s",
            (status, candidate_id),
        )
        append_audit_event(
            conn,
            project_id=row["project_id"],
            config_key=row["config_key"],
            event_type=f"candidate.{status}",
            actor=actor,
            subject_kind="candidate",
            subject_id=candidate_id,
            details={"from": row["status"], "to": status},
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (candidate_id,)
        ).fetchone()
    return dict(updated)


# ---------------------------------------------------------------------------
# Builds
# ---------------------------------------------------------------------------


def start_build(candidate_id: str, *, job_id: str | None, fence: int) -> dict[str, Any]:
    with connect() as conn:
        attempt = int(
            (
                conn.execute(
                    "SELECT COUNT(*) AS n FROM ws_release_builds WHERE candidate_id = %s",
                    (candidate_id,),
                ).fetchone()
                or {"n": 0}
            )["n"]
        ) + 1
        build_id = _new_id("build")
        conn.execute(
            """
            INSERT INTO ws_release_builds(
                id, candidate_id, job_id, fence, attempt, status, started_at
            ) VALUES (%s,%s,%s,%s,%s,'running',NOW())
            """,
            (build_id, candidate_id, job_id, fence, attempt),
        )
        conn.execute(
            "UPDATE ws_release_candidates SET status='building', updated_at=NOW() WHERE id=%s",
            (candidate_id,),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)).fetchone()
    return dict(row)


def complete_build(
    *,
    build_id: str,
    dossier,
    toolchain: Mapping[str, Any],
    dossier_artifact_id: str | None = None,
    evidence_artifact_id: str | None = None,
    fence: int | None = None,
    actor: str = "",
    warnings: Sequence[str] = (),
) -> dict[str, Any]:
    """Finalize one build in a single transaction, re-validating the fence.

    Object storage and PostgreSQL are separate systems, so this is fenced and
    crash-safe rather than atomic.  The property that matters is that a stale
    worker can never make its artifact authoritative.
    """

    with connect() as conn:
        build = conn.execute(
            "SELECT * FROM ws_release_builds WHERE id = %s FOR UPDATE", (build_id,)
        ).fetchone()
        if build is None:
            raise ReleaseStudioError("build not found")
        if fence is not None and int(build["fence"]) != int(fence):
            raise ReleaseStudioError(
                f"stale fence: build holds {build['fence']}, caller presented {fence}"
            )
        candidate = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (build["candidate_id"],)
        ).fetchone()

        conn.execute(
            """
            UPDATE ws_release_builds SET
                status='succeeded', manifest_digest=%s, dossier_digest=%s,
                dossier_artifact_id=%s, evidence_artifact_id=%s,
                toolchain=%s, warnings=%s, completed_at=NOW()
            WHERE id = %s
            """,
            (
                dossier.manifest_digest, dossier.dossier_digest,
                dossier_artifact_id, evidence_artifact_id,
                json.dumps(dict(toolchain)), json.dumps(list(warnings)), build_id,
            ),
        )
        conn.execute("DELETE FROM ws_release_members WHERE build_id = %s", (build_id,))
        for member in dossier.members:
            member_id = _new_id("mem")
            conn.execute(
                """
                INSERT INTO ws_release_members(
                    id, build_id, path, member_kind, media_type, size_bytes,
                    released_digest, source_raw_digest, canonicalizer
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    member_id, build_id, member.path, member.member_kind,
                    member.media_type, member.size_bytes, member.released_digest,
                    member.source_raw_digest, member.canonicalizer,
                ),
            )
            for domain in member.domains:
                conn.execute(
                    """
                    INSERT INTO ws_release_member_domains(member_id, build_id, domain)
                    VALUES (%s,%s,%s) ON CONFLICT DO NOTHING
                    """,
                    (member_id, build_id, domain),
                )

        conn.execute("DELETE FROM ws_release_evidence WHERE build_id = %s", (build_id,))
        for record in dossier.evidence:
            conn.execute(
                """
                INSERT INTO ws_release_evidence(id, build_id, kind, report_digest, counts)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    _new_id("ev"), build_id, record["kind"],
                    record["report_digest"], json.dumps(record["counts"]),
                ),
            )

        conn.execute("DELETE FROM ws_release_scope_fingerprints WHERE build_id = %s", (build_id,))
        for domain, record in dossier.fingerprints.items():
            conn.execute(
                """
                INSERT INTO ws_release_scope_fingerprints(
                    build_id, domain, fingerprint, inputs, fidelity
                ) VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    build_id, domain, record["fingerprint"],
                    json.dumps(record["inputs"]), record.get("fidelity", "artifact"),
                ),
            )

        for artifact_id, kind in (
            (dossier_artifact_id, "dossier"),
            (evidence_artifact_id, "build_evidence"),
        ):
            if artifact_id:
                conn.execute(
                    """
                    INSERT INTO ws_artifact_release_pins(artifact_id, pin_kind, pin_ref)
                    VALUES (%s,%s,%s) ON CONFLICT (artifact_id) DO NOTHING
                    """,
                    (artifact_id, kind, build_id),
                )

        conn.execute(
            "UPDATE ws_release_candidates SET status='built', updated_at=NOW() WHERE id=%s",
            (build["candidate_id"],),
        )
        append_audit_event(
            conn,
            project_id=candidate["project_id"],
            config_key=candidate["config_key"],
            event_type="build.succeeded",
            actor=actor,
            subject_kind="build",
            subject_id=build_id,
            details={
                "manifest_digest": dossier.manifest_digest,
                "dossier_digest": dossier.dossier_digest,
                "members": len(dossier.members),
            },
        )
        conn.commit()
        row = conn.execute("SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)).fetchone()
    return dict(row)


def fail_build(build_id: str, *, error_code: str, error_message: str, actor: str = "") -> None:
    with connect() as conn:
        build = conn.execute(
            "SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)
        ).fetchone()
        if build is None:
            return
        candidate = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (build["candidate_id"],)
        ).fetchone()
        conn.execute(
            """
            UPDATE ws_release_builds SET status='failed', error_code=%s,
                   error_message=%s, completed_at=NOW() WHERE id=%s
            """,
            (error_code, error_message[:2000], build_id),
        )
        conn.execute(
            "UPDATE ws_release_candidates SET status='failed', updated_at=NOW() WHERE id=%s",
            (build["candidate_id"],),
        )
        append_audit_event(
            conn,
            project_id=candidate["project_id"],
            config_key=candidate["config_key"],
            event_type="build.failed",
            actor=actor,
            subject_kind="build",
            subject_id=build_id,
            details={"error_code": error_code},
        )
        conn.commit()


def get_build(build_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)).fetchone()
    return dict(row) if row else None


def latest_build(candidate_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT * FROM ws_release_builds WHERE candidate_id = %s
            ORDER BY attempt DESC LIMIT 1
            """,
            (candidate_id,),
        ).fetchone()
    return dict(row) if row else None


def get_artifact(artifact_id: str) -> dict[str, Any] | None:
    """Resolve one published artifact row by id.

    Builds reference artifacts by ``ws_artifacts(id)``, so serving a dossier
    means looking the object location up rather than deriving it from a digest.
    """

    with connect() as conn:
        row = conn.execute(
            "SELECT id, kind, digest, object_path, media_type, size_bytes "
            "FROM ws_artifacts WHERE id = %s",
            (artifact_id,),
        ).fetchone()
    return dict(row) if row else None


def build_members(build_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT m.*, COALESCE(
                ARRAY_AGG(d.domain ORDER BY d.domain) FILTER (WHERE d.domain IS NOT NULL),
                '{}'
            ) AS domains
            FROM ws_release_members m
            LEFT JOIN ws_release_member_domains d ON d.member_id = m.id
            WHERE m.build_id = %s GROUP BY m.id ORDER BY m.path
            """,
            (build_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def build_evidence(build_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_evidence WHERE build_id = %s ORDER BY kind", (build_id,)
        ).fetchall()
    return [dict(row) for row in rows]


def build_fingerprints(build_id: str) -> dict[str, dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_scope_fingerprints WHERE build_id = %s", (build_id,)
        ).fetchall()
    return {row["domain"]: dict(row) for row in rows}


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def record_evaluation(
    *,
    build_id: str,
    evaluation,
    evaluator_build: str,
    actor: str = "",
) -> dict[str, Any]:
    """Persist one evaluation. Re-evaluating never touches technical rows."""

    with connect() as conn:
        build = conn.execute(
            "SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)
        ).fetchone()
        if build is None:
            raise ReleaseStudioError("build not found")
        candidate = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (build["candidate_id"],)
        ).fetchone()

        existing = conn.execute(
            """
            SELECT id FROM ws_release_evaluations
            WHERE build_id = %s AND policy_binding_digest = %s AND evaluator_build = %s
            """,
            (build_id, evaluation.policy_binding_digest, evaluator_build),
        ).fetchone()
        evaluation_id = existing["id"] if existing else _new_id("eval")
        if existing:
            conn.execute(
                "DELETE FROM ws_release_findings WHERE evaluation_id = %s", (evaluation_id,)
            )
            conn.execute(
                "DELETE FROM ws_release_rule_outcomes WHERE evaluation_id = %s", (evaluation_id,)
            )
            conn.execute(
                "UPDATE ws_release_evaluations SET outcome=%s, counts=%s WHERE id=%s",
                (evaluation.outcome, json.dumps(dict(evaluation.counts)), evaluation_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO ws_release_evaluations(
                    id, build_id, policy_binding, policy_binding_digest, outcome,
                    counts, evaluator_build
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    evaluation_id, build_id, json.dumps(dict(evaluation.policy_binding)),
                    evaluation.policy_binding_digest, evaluation.outcome,
                    json.dumps(dict(evaluation.counts)), evaluator_build,
                ),
            )

        for finding in evaluation.findings:
            conn.execute(
                """
                INSERT INTO ws_release_findings(
                    id, evaluation_id, rule_id, rule_version, severity, status,
                    domain, subject, message, observed, expected, finding_key, waiver_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    _new_id("find"), evaluation_id, finding.rule_id, finding.rule_version,
                    finding.severity, finding.status, finding.domain, finding.subject,
                    finding.message, json.dumps(dict(finding.observed)),
                    json.dumps(dict(finding.expected)), finding.finding_key,
                    finding.waiver_id or None,
                ),
            )
        for outcome in evaluation.rule_outcomes:
            conn.execute(
                """
                INSERT INTO ws_release_rule_outcomes(
                    id, evaluation_id, rule_id, rule_version, outcome,
                    finding_count, unsupported_reason
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    _new_id("out"), evaluation_id, outcome.rule_id, outcome.rule_version,
                    outcome.outcome, outcome.finding_count, outcome.unsupported_reason,
                ),
            )

        append_audit_event(
            conn,
            project_id=candidate["project_id"],
            config_key=candidate["config_key"],
            event_type="build.evaluated",
            actor=actor,
            subject_kind="evaluation",
            subject_id=evaluation_id,
            details={
                "outcome": evaluation.outcome,
                "policy_binding_digest": evaluation.policy_binding_digest,
            },
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_evaluations WHERE id = %s", (evaluation_id,)
        ).fetchone()
    return dict(row)


def latest_evaluation(build_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT * FROM ws_release_evaluations WHERE build_id = %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (build_id,),
        ).fetchone()
        if row is None:
            return None
        evaluation = dict(row)
        evaluation["findings"] = [
            dict(item)
            for item in conn.execute(
                """
                SELECT * FROM ws_release_findings WHERE evaluation_id = %s
                ORDER BY domain, rule_id, subject
                """,
                (evaluation["id"],),
            ).fetchall()
        ]
        evaluation["rule_outcomes"] = [
            dict(item)
            for item in conn.execute(
                "SELECT * FROM ws_release_rule_outcomes WHERE evaluation_id = %s ORDER BY rule_id",
                (evaluation["id"],),
            ).fetchall()
        ]
    return evaluation


# ---------------------------------------------------------------------------
# Waivers (R15)
# ---------------------------------------------------------------------------


def create_waiver(
    *,
    project_id: str,
    config_key: str,
    rule_id: str,
    domain: str,
    reason: str,
    owner: str,
    subject_pattern: str = "",
    finding_key: str = "",
    expires_at: str | None = None,
) -> dict[str, Any]:
    if not subject_pattern and not finding_key:
        raise ReleaseStudioError("a waiver must scope either a subject_pattern or a finding_key")
    if not reason.strip():
        raise ReleaseStudioError("a waiver requires a reason")
    waiver_id = _new_id("wv")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO ws_release_waivers(
                id, project_id, config_key, rule_id, domain, subject_pattern,
                finding_key, reason, owner, status, expires_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'proposed',%s)
            """,
            (
                waiver_id, project_id, config_key, rule_id, domain,
                subject_pattern, finding_key, reason, owner, expires_at,
            ),
        )
        append_audit_event(
            conn, project_id=project_id, config_key=config_key,
            event_type="waiver.proposed", actor=owner,
            subject_kind="waiver", subject_id=waiver_id,
            details={"rule_id": rule_id, "domain": domain},
        )
        conn.commit()
    return get_waiver(waiver_id) or {}


def transition_waiver(
    waiver_id: str,
    *,
    status: str,
    actor: str,
    reason: str = "",
    exception_kind: str | None = None,
    exception_reason: str = "",
) -> dict[str, Any]:
    """Waiver rows are never deleted; every transition is audited."""

    if status not in WAIVER_STATUSES:
        raise ReleaseStudioError(f"unknown waiver status: {status!r}")
    if exception_kind is not None and exception_kind != "self_approval":
        raise ReleaseStudioError(f"unknown waiver exception kind: {exception_kind!r}")
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_waivers WHERE id = %s FOR UPDATE", (waiver_id,)
        ).fetchone()
        if row is None:
            raise ReleaseStudioError("waiver not found")
        if status == "approved":
            own = str(row["owner"]).casefold() == actor.casefold()
            if own and exception_kind != "self_approval" and self_approval_bypassed():
                # Still recorded as an exception: the bypass decides who may
                # approve, not what the trail says happened.
                exception_kind = "self_approval"
                exception_reason = SELF_APPROVAL_BYPASS_REASON
            if own and exception_kind != "self_approval":
                raise ReleaseStudioError(
                    "a waiver cannot be approved by its own owner without an "
                    "audited self_approval exception"
                )
            if own and not exception_reason.strip():
                raise ReleaseStudioError(
                    "a self-approved waiver requires a written exception reason"
                )
            if not own and exception_kind is not None:
                raise ReleaseStudioError(
                    "a waiver approved by another person takes no exception"
                )
            conn.execute(
                """
                UPDATE ws_release_waivers SET status='approved', approver=%s,
                       approved_at=NOW(), exception_kind=%s, exception_reason=%s
                WHERE id=%s
                """,
                (
                    actor,
                    exception_kind,
                    exception_reason.strip() if exception_kind else None,
                    waiver_id,
                ),
            )
        elif status == "revoked":
            conn.execute(
                """
                UPDATE ws_release_waivers SET status='revoked', revoked_at=NOW(),
                       revoked_reason=%s WHERE id=%s
                """,
                (reason, waiver_id),
            )
        else:
            conn.execute(
                "UPDATE ws_release_waivers SET status=%s WHERE id=%s", (status, waiver_id)
            )
        append_audit_event(
            conn, project_id=row["project_id"], config_key=row["config_key"],
            event_type=f"waiver.{status}", actor=actor,
            subject_kind="waiver", subject_id=waiver_id,
            details={
                "from": row["status"],
                "to": status,
                "reason": reason,
                # The exception is the whole point of the escape hatch: it must
                # be in the hash-chained trail, not only on the waiver row.
                **(
                    {
                        "exception_kind": exception_kind,
                        "exception_reason": exception_reason.strip(),
                    }
                    if exception_kind
                    else {}
                ),
            },
        )
        conn.commit()
    return get_waiver(waiver_id) or {}


def get_waiver(waiver_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_waivers WHERE id = %s", (waiver_id,)
        ).fetchone()
    return dict(row) if row else None


def active_waivers(project_id: str, config_key: str) -> list[dict[str, Any]]:
    """Approved and unexpired. An expired waiver stops applying without deletion."""

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ws_release_waivers
            WHERE project_id = %s AND config_key = %s AND status = 'approved'
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at
            """,
            (project_id, config_key),
        ).fetchall()
    return [dict(row) for row in rows]


def list_waivers(project_id: str, config_key: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ws_release_waivers WHERE project_id = %s AND config_key = %s
            ORDER BY created_at DESC
            """,
            (project_id, config_key),
        ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Approvals and carry-forward (R16/R17)
# ---------------------------------------------------------------------------


def create_approval(
    *,
    build_id: str,
    role: str,
    domains: Sequence[str],
    decision: str,
    approver: str,
    note: str = "",
    exception_kind: str | None = None,
    exception_reason: str | None = None,
    reauth_context: Mapping[str, Any] | None = None,
    carried_from_approval_id: str | None = None,
) -> dict[str, Any]:
    """Insert one immutable approval bound to (fingerprints, policy digest)."""

    if decision not in APPROVAL_DECISIONS:
        raise ReleaseStudioError(f"unknown approval decision: {decision!r}")
    if exception_kind is not None and exception_kind not in EXCEPTION_KINDS:
        raise ReleaseStudioError(f"unknown exception kind: {exception_kind!r}")
    if exception_kind and not (exception_reason or "").strip():
        raise ReleaseStudioError("an approval exception requires a written reason")
    unknown = sorted(set(domains) - set(GOVERNED_DOMAINS))
    if unknown:
        raise ReleaseStudioError(f"unknown governed domains: {unknown}")

    with connect() as conn:
        build = conn.execute(
            "SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)
        ).fetchone()
        if build is None:
            raise ReleaseStudioError("build not found")
        candidate = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (build["candidate_id"],)
        ).fetchone()
        evaluation = conn.execute(
            """
            SELECT * FROM ws_release_evaluations WHERE build_id = %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (build_id,),
        ).fetchone()
        if evaluation is None:
            raise ReleaseStudioError("a build must be evaluated before it can be approved")

        fingerprints = {
            row["domain"]: row["fingerprint"]
            for row in conn.execute(
                "SELECT domain, fingerprint FROM ws_release_scope_fingerprints WHERE build_id = %s",
                (build_id,),
            ).fetchall()
            if row["domain"] in set(domains)
        }
        missing = sorted(set(domains) - set(fingerprints))
        if missing:
            raise ReleaseStudioError(f"build has no fingerprint for domain(s) {missing}")

        is_self = (
            str(candidate["created_by"] or "").casefold() == approver.casefold()
            and decision == "approved"
            and not (exception_kind and "self_approval" in exception_kind)
        )
        if is_self and self_approval_bypassed():
            exception_kind = "self_approval"
            exception_reason = exception_reason or SELF_APPROVAL_BYPASS_REASON
        elif is_self:
            raise ReleaseStudioError(
                "two-person approval required: the candidate author cannot approve it "
                "without an audited self-approval exception"
            )

        approval_id = _new_id("appr")
        conn.execute(
            """
            INSERT INTO ws_release_approvals(
                id, project_id, config_key, candidate_id, build_id, role, domains,
                decision, approver, note, exception_kind, exception_reason,
                technical_scope_fingerprints, policy_binding_digest, manifest_digest,
                carried_from_approval_id, reauth_context, evaluation_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                approval_id, candidate["project_id"], candidate["config_key"],
                build["candidate_id"], build_id, role, list(domains), decision, approver,
                note, exception_kind, exception_reason, json.dumps(fingerprints),
                evaluation["policy_binding_digest"], build["manifest_digest"] or "",
                carried_from_approval_id, json.dumps(dict(reauth_context or {})),
                evaluation["id"],
            ),
        )
        append_audit_event(
            conn, project_id=candidate["project_id"], config_key=candidate["config_key"],
            event_type=f"approval.{decision}", actor=approver,
            subject_kind="approval", subject_id=approval_id,
            details={
                "role": role,
                "domains": list(domains),
                "carried_from": carried_from_approval_id,
                "exception_kind": exception_kind,
            },
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_approvals WHERE id = %s", (approval_id,)
        ).fetchone()
    return dict(row)


def list_approvals(build_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_approvals WHERE build_id = %s ORDER BY created_at",
            (build_id,),
        ).fetchall()
        approvals = [dict(row) for row in rows]
        for approval in approvals:
            approval["invalidations"] = [
                dict(item)
                for item in conn.execute(
                    """
                    SELECT * FROM ws_release_approval_invalidations
                    WHERE approval_id = %s ORDER BY created_at
                    """,
                    (approval["id"],),
                ).fetchall()
            ]
    return approvals


def effective_approvals(build_id: str) -> list[dict[str, Any]]:
    """Approvals that are still valid: approved, and never invalidated."""

    return [
        approval
        for approval in list_approvals(build_id)
        if approval["decision"] == "approved" and not approval["invalidations"]
    ]


def carry_forward_approvals(
    *,
    source_build_id: str,
    target_build_id: str,
    actor: str = "",
) -> dict[str, Any]:
    """Carry approvals whose binding still holds; audit the rest as invalid.

    An approval binds to two independent values.  Comparing them separately is
    what lets the diagnostic name *which half* went stale rather than reporting
    an opaque invalidation.
    """

    carried: list[dict[str, Any]] = []
    invalidated: list[dict[str, Any]] = []

    target_fingerprints = build_fingerprints(target_build_id)
    with connect() as conn:
        target_evaluation = conn.execute(
            """
            SELECT * FROM ws_release_evaluations WHERE build_id = %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (target_build_id,),
        ).fetchone()
    if target_evaluation is None:
        raise ReleaseStudioError("the target build must be evaluated before carry-forward")
    target_policy_digest = target_evaluation["policy_binding_digest"]

    for approval in effective_approvals(source_build_id):
        source_fingerprints = approval["technical_scope_fingerprints"] or {}
        changed_domains = [
            domain
            for domain in approval["domains"]
            if (target_fingerprints.get(domain) or {}).get("fingerprint")
            != source_fingerprints.get(domain)
        ]
        policy_changed = approval["policy_binding_digest"] != target_policy_digest

        if not changed_domains and not policy_changed:
            carried.append(
                create_approval(
                    build_id=target_build_id,
                    role=approval["role"],
                    domains=approval["domains"],
                    decision="approved",
                    approver=approval["approver"],
                    note=f"carried forward from {approval['id']}",
                    exception_kind=approval["exception_kind"],
                    exception_reason=approval["exception_reason"],
                    carried_from_approval_id=approval["id"],
                )
            )
            continue

        stale_component = (
            "both" if changed_domains and policy_changed
            else ("technical" if changed_domains else "policy")
        )
        reason = (
            f"technical scope changed for {changed_domains}" if changed_domains and not policy_changed
            else "policy binding changed" if policy_changed and not changed_domains
            else f"technical scope changed for {changed_domains} and the policy binding changed"
        )
        invalidated.append(
            _record_invalidation(
                approval_id=approval["id"],
                reason=reason,
                stale_component=stale_component,
                changed_domains=changed_domains,
                created_by=actor,
            )
        )

    return {"carried": carried, "invalidated": invalidated}


def _record_invalidation(
    *,
    approval_id: str,
    reason: str,
    stale_component: str,
    changed_domains: Sequence[str],
    created_by: str,
) -> dict[str, Any]:
    invalidation_id = _new_id("inval")
    with connect() as conn:
        approval = conn.execute(
            "SELECT * FROM ws_release_approvals WHERE id = %s", (approval_id,)
        ).fetchone()
        conn.execute(
            """
            INSERT INTO ws_release_approval_invalidations(
                id, approval_id, reason, stale_component, changed_domains, created_by
            ) VALUES (%s,%s,%s,%s,%s,%s)
            """,
            (
                invalidation_id, approval_id, reason, stale_component,
                list(changed_domains), created_by,
            ),
        )
        append_audit_event(
            conn, project_id=approval["project_id"], config_key=approval["config_key"],
            event_type="approval.invalidated", actor=created_by,
            subject_kind="approval", subject_id=approval_id,
            details={"stale_component": stale_component, "changed_domains": list(changed_domains)},
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_approval_invalidations WHERE id = %s", (invalidation_id,)
        ).fetchone()
    return dict(row)


def invalidate_for_policy_change(
    *, build_id: str, new_policy_binding_digest: str, actor: str = ""
) -> list[dict[str, Any]]:
    """Policy moved with no source change: approvals go, the technical rows stay."""

    invalidated = []
    for approval in effective_approvals(build_id):
        if approval["policy_binding_digest"] == new_policy_binding_digest:
            continue
        invalidated.append(
            _record_invalidation(
                approval_id=approval["id"],
                reason="policy binding changed",
                stale_component="policy",
                changed_domains=[],
                created_by=actor,
            )
        )
    return invalidated


# ---------------------------------------------------------------------------
# Release records (R18)
# ---------------------------------------------------------------------------


def create_release_record(
    *,
    build_id: str,
    release_label: str,
    document_number: str,
    revision: str,
    released_by: str,
    attestation: Mapping[str, Any],
    signature: str,
    signing_key_id: str,
    policy_snapshot: Mapping[str, Any],
    approval_snapshot: Sequence[Mapping[str, Any]],
    attestation_artifact_id: str | None = None,
) -> dict[str, Any]:
    with connect() as conn:
        build = conn.execute(
            "SELECT * FROM ws_release_builds WHERE id = %s", (build_id,)
        ).fetchone()
        if build is None:
            raise ReleaseGateError("build not found")
        candidate = conn.execute(
            "SELECT * FROM ws_release_candidates WHERE id = %s", (build["candidate_id"],)
        ).fetchone()
        record_id = _new_id("rel")
        conn.execute(
            """
            INSERT INTO ws_release_records(
                id, project_id, config_key, candidate_id, build_id, release_label,
                document_number, revision, dossier_digest, manifest_digest,
                attestation_digest, signature, signing_key_id, attestation_artifact_id,
                commit_sha, variant, released_by, policy_snapshot, approval_snapshot,
                attestation_body
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                record_id, candidate["project_id"], candidate["config_key"],
                build["candidate_id"], build_id, release_label, document_number,
                revision, build["dossier_digest"], build["manifest_digest"],
                attestation["attestation_digest"], signature, signing_key_id,
                attestation_artifact_id, candidate["commit_sha"], candidate["variant"],
                released_by, json.dumps(dict(policy_snapshot)),
                json.dumps([dict(item) for item in approval_snapshot]),
                json.dumps(dict(attestation)),
            ),
        )
        conn.execute(
            "UPDATE ws_release_candidates SET status='frozen', updated_at=NOW() WHERE id=%s",
            (build["candidate_id"],),
        )
        append_audit_event(
            conn, project_id=candidate["project_id"], config_key=candidate["config_key"],
            event_type="release.created", actor=released_by,
            subject_kind="release", subject_id=record_id,
            details={
                "release_label": release_label,
                "manifest_digest": build["manifest_digest"],
                "signing_key_id": signing_key_id,
            },
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_records WHERE id = %s", (record_id,)
        ).fetchone()
    return dict(row)


def list_release_records(project_id: str, config_key: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM ws_release_records WHERE project_id = %s"
    params: list[Any] = [project_id]
    if config_key:
        query += " AND config_key = %s"
        params.append(config_key)
    query += " ORDER BY created_at DESC"
    with connect() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    return [dict(row) for row in rows]


def get_release_record(record_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM ws_release_records WHERE id = %s", (record_id,)
        ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Signing keys (public material only)
# ---------------------------------------------------------------------------


def upsert_signing_key(
    *,
    key_id: str,
    algorithm: str,
    public_key: str,
    created_by: str = "",
    status: str = "active",
    valid_from: str | None = None,
    valid_to: str | None = None,
) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO ws_release_signing_keys(
                key_id, algorithm, public_key, status, created_by, valid_from, valid_to
            ) VALUES (%s,%s,%s,%s,%s,COALESCE(%s::timestamptz, NOW()),%s)
            ON CONFLICT (key_id) DO UPDATE SET
                public_key = EXCLUDED.public_key,
                status = EXCLUDED.status,
                valid_to = EXCLUDED.valid_to
            """,
            (key_id, algorithm, public_key, status, created_by, valid_from, valid_to),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ws_release_signing_keys WHERE key_id = %s", (key_id,)
        ).fetchone()
    return dict(row)


def list_signing_keys() -> list[dict[str, Any]]:
    """Superseded keys stay published so old releases keep verifying."""

    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ws_release_signing_keys ORDER BY created_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


__all__ = [
    "APPROVAL_DECISIONS",
    "CANDIDATE_STATUSES",
    "EXCEPTION_KINDS",
    "WAIVER_STATUSES",
    "ReleaseGateError",
    "ReleaseStudioError",
    "active_waivers",
    "append_audit_event",
    "audit_head",
    "build_evidence",
    "build_fingerprints",
    "build_members",
    "carry_forward_approvals",
    "complete_build",
    "compute_build_key",
    "connect",
    "create_approval",
    "create_candidate",
    "create_release_record",
    "create_waiver",
    "current_audit_head",
    "effective_approvals",
    "fail_build",
    "get_artifact",
    "get_build",
    "get_candidate",
    "get_configuration",
    "get_release_record",
    "get_waiver",
    "initialize",
    "invalidate_for_policy_change",
    "latest_build",
    "latest_evaluation",
    "list_approvals",
    "list_audit_events",
    "list_candidates",
    "list_configurations",
    "list_release_records",
    "list_signing_keys",
    "list_waivers",
    "record_evaluation",
    "set_candidate_status",
    "self_approval_bypassed",
    "start_build",
    "transition_waiver",
    "upsert_configuration",
    "upsert_signing_key",
    "verify_audit_chain",
]
