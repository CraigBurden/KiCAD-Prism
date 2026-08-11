"""Release Studio API (R19).

Mounted at ``/api/projects``; every path lives under
``/{project_id}/release-studio`` because ``/{project_id}/releases`` already
serves Git tags and must keep doing so.

The signing-keys endpoint is deliberately unauthenticated: public keys exist to
be distributed, and an offline recipient verifying a release has no Prism
credentials.
"""

from __future__ import annotations

import io
import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api._helpers import get_project_for_role_or_404
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.release_studio.attestation import (
    build_attestation,
    build_release_archive,
    load_signing_key,
)
from app.release_studio.policy import (
    RuleContext,
    catalogue_payload,
    evaluate,
    release_is_permitted,
    resolve_policy,
)
from app.release_studio.verify import verify_archive_bytes
from app.services import release_studio_build_service as build_service
from app.services import release_studio_service as store
from app.services.job_service import jobs

router = APIRouter(dependencies=[Depends(require_viewer)])

# Org-level router: no project scope, and no authentication on the key set.
public_router = APIRouter()

EVALUATOR_BUILD = "release-studio/r13"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CandidateRequest(BaseModel):
    config_key: str = Field("default", max_length=200)
    commit_sha: str = Field(..., min_length=4, max_length=64)
    variant: str = Field("", max_length=200)


class EvaluateRequest(BaseModel):
    config_key: str = Field("default", max_length=200)


class WaiverRequest(BaseModel):
    config_key: str = Field("default", max_length=200)
    rule_id: str = Field(..., max_length=200)
    domain: str = Field(..., max_length=64)
    reason: str = Field(..., min_length=3, max_length=4000)
    subject_pattern: str = Field("", max_length=400)
    finding_key: str = Field("", max_length=128)
    expires_at: str | None = None


class WaiverTransitionRequest(BaseModel):
    reason: str = Field("", max_length=4000)


class ApprovalRequest(BaseModel):
    role: str = Field(..., max_length=120)
    domains: list[str] = Field(default_factory=list)
    decision: str = Field("approved", max_length=40)
    note: str = Field("", max_length=4000)
    exception_kind: str | None = None
    exception_reason: str | None = None
    reauth_password: str = Field("", max_length=400)


class ReleaseRequest(BaseModel):
    release_label: str = Field(..., min_length=1, max_length=200)
    document_number: str = Field("", max_length=200)
    revision: str = Field("", max_length=64)


# ---------------------------------------------------------------------------
# Configurations and catalogue
# ---------------------------------------------------------------------------


@router.get("/{project_id}/release-studio/configurations")
async def list_configurations(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    get_project_for_role_or_404(project_id, user.role)
    return {"configurations": build_service.sync_configurations(project_id)}


@router.get("/{project_id}/release-studio/rule-catalogue")
async def rule_catalogue(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    get_project_for_role_or_404(project_id, user.role)
    return {"rules": catalogue_payload()}


# ---------------------------------------------------------------------------
# Candidates and builds
# ---------------------------------------------------------------------------


@router.get("/{project_id}/release-studio/candidates")
async def list_candidates(
    project_id: str,
    config_key: str | None = Query(None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    candidates = store.list_candidates(project_id, config_key)
    for candidate in candidates:
        candidate["latest_build"] = store.latest_build(candidate["id"])
    return {"candidates": candidates}


@router.post("/{project_id}/release-studio/candidates")
async def create_candidate(
    project_id: str,
    request: CandidateRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    """Enqueue a build. Idempotent on ``build_key`` once the closure resolves."""

    get_project_for_role_or_404(project_id, user.role)
    job = jobs.enqueue(
        "release_studio_build",
        {
            "project_id": project_id,
            "config_key": request.config_key,
            "commit_sha": request.commit_sha,
            "variant": request.variant,
            "author": user.email,
        },
        project_id=project_id,
        requested_by=user.email,
        artifact_key=f"release-studio:{project_id}:{request.config_key}:{request.commit_sha}",
    )
    return {"job": job}


@router.get("/{project_id}/release-studio/candidates/{candidate_id}")
async def get_candidate(
    project_id: str, candidate_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    candidate = store.get_candidate(candidate_id)
    if candidate is None or candidate["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate["builds"] = [store.latest_build(candidate_id)] if store.latest_build(candidate_id) else []
    return candidate


@router.get("/{project_id}/release-studio/builds/{build_id}")
async def get_build(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    return {
        "build": build,
        "members": store.build_members(build_id),
        "evidence": store.build_evidence(build_id),
        "fingerprints": store.build_fingerprints(build_id),
        "evaluation": store.latest_evaluation(build_id),
        "approvals": store.list_approvals(build_id),
    }


@router.get("/{project_id}/release-studio/builds/{build_id}/dossier")
async def download_dossier(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    payload = _artifact_bytes(build["dossier_artifact_id"])
    return Response(
        content=payload,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="dossier-{build_id}.tar.gz"'},
    )


@router.get("/{project_id}/release-studio/builds/{build_id}/build-evidence")
async def download_build_evidence(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    payload = _artifact_bytes(build["evidence_artifact_id"])
    return Response(
        content=payload,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="evidence-{build_id}.tar.gz"'},
    )


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


@router.post("/{project_id}/release-studio/builds/{build_id}/evaluate")
async def evaluate_build(
    project_id: str,
    build_id: str,
    request: EvaluateRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    """Re-evaluate an existing build. Runs zero KiCad steps by construction."""

    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    candidate = store.get_candidate(build["candidate_id"]) or {}
    result = _evaluate(project_id, request.config_key, build, candidate, actor=user.email)
    return {"evaluation": store.latest_evaluation(build_id), "outcome": result.outcome}


def _evaluate(project_id: str, config_key: str, build, candidate, *, actor: str):
    policy_document = _policy_document(project_id, config_key)
    resolved = resolve_policy(policy_document)
    members = [_MemberView(row) for row in store.build_members(build["id"])]
    context = RuleContext(
        members=members,
        evidence=store.build_evidence(build["id"]),
        projections={},
        hermetic=bool(candidate.get("hermetic", True)),
        non_hermetic_reasons=list(candidate.get("non_hermetic_reasons") or []),
        manifest={},
    )
    result = evaluate(
        resolved,
        context,
        waivers=store.active_waivers(project_id, config_key),
    )
    store.record_evaluation(
        build_id=build["id"], evaluation=result, evaluator_build=EVALUATOR_BUILD, actor=actor
    )
    return result


class _MemberView:
    """Adapt a persisted member row to the shape rules expect."""

    def __init__(self, row: dict[str, Any]) -> None:
        self.path = row["path"]
        self.member_kind = row["member_kind"]
        self.domains = tuple(row.get("domains") or ())
        self.released_digest = row["released_digest"]


def _policy_document(project_id: str, config_key: str) -> dict[str, Any]:
    """The default policy used until a project ships its own overlay.

    Deliberately small: DRC/ERC clean, hermetic inputs, and the members a
    fabricator needs. A project overlay in Git replaces this wholesale.
    """

    return {
        "rules": [
            {"id": "drc.clean", "severity": "blocker", "params": {"max_errors": 0}},
            {"id": "erc.clean", "severity": "blocker", "params": {"max_errors": 0}},
            {"id": "build.hermetic", "severity": "blocker"},
            {"id": "assembly.positions_present", "severity": "failure"},
            {
                "id": "dossier.required_members",
                "severity": "failure",
                "params": {"patterns": ["fabrication/gerbers/*", "fabrication/drill/*"]},
            },
        ],
        "required_approvals": [
            {"role": "pcb_design", "domains": ["bare_board"]},
            {"role": "manufacturing", "domains": ["assembly"]},
        ],
    }


# ---------------------------------------------------------------------------
# Waivers
# ---------------------------------------------------------------------------


@router.get("/{project_id}/release-studio/waivers")
async def list_waivers(
    project_id: str,
    config_key: str = Query("default"),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    return {"waivers": store.list_waivers(project_id, config_key)}


@router.post("/{project_id}/release-studio/waivers")
async def create_waiver(
    project_id: str, request: WaiverRequest, user: AuthenticatedUser = Depends(require_designer)
):
    get_project_for_role_or_404(project_id, user.role)
    try:
        return store.create_waiver(
            project_id=project_id,
            config_key=request.config_key,
            rule_id=request.rule_id,
            domain=request.domain,
            reason=request.reason,
            owner=user.email,
            subject_pattern=request.subject_pattern,
            finding_key=request.finding_key,
            expires_at=request.expires_at,
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{project_id}/release-studio/waivers/{waiver_id}/{action}")
async def transition_waiver(
    project_id: str,
    waiver_id: str,
    action: str,
    request: WaiverTransitionRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    status = {"approve": "approved", "reject": "rejected", "revoke": "revoked"}.get(action)
    if status is None:
        raise HTTPException(status_code=400, detail=f"Unknown waiver action: {action}")
    try:
        return store.transition_waiver(
            waiver_id, status=status, actor=user.email, reason=request.reason
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Approvals
# ---------------------------------------------------------------------------


@router.post("/{project_id}/release-studio/builds/{build_id}/approvals")
async def create_approval(
    project_id: str,
    build_id: str,
    request: ApprovalRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    _build_or_404(project_id, build_id)
    try:
        return store.create_approval(
            build_id=build_id,
            role=request.role,
            domains=request.domains,
            decision=request.decision,
            approver=user.email,
            note=request.note,
            exception_kind=request.exception_kind,
            exception_reason=request.exception_reason,
            reauth_context={"method": "session", "email": user.email},
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Release
# ---------------------------------------------------------------------------


@router.post("/{project_id}/release-studio/builds/{build_id}/release")
async def create_release(
    project_id: str,
    build_id: str,
    request: ReleaseRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    candidate = store.get_candidate(build["candidate_id"]) or {}
    config_key = str(candidate.get("config_key") or "default")

    evaluation = store.latest_evaluation(build_id)
    if evaluation is None:
        raise HTTPException(status_code=400, detail="Build has not been evaluated")

    result = _evaluate(project_id, config_key, build, candidate, actor=user.email)
    permitted, reason = release_is_permitted(result)
    if not permitted:
        raise HTTPException(status_code=409, detail=f"Release refused: {reason}")

    approvals = store.effective_approvals(build_id)
    required = resolve_policy(_policy_document(project_id, config_key)).required_approvals
    covered = {
        (approval["role"], domain)
        for approval in approvals
        for domain in (approval["domains"] or [])
    }
    missing = [
        f"{entry['role']} for {domain}"
        for entry in required
        for domain in entry["domains"]
        if (entry["role"], domain) not in covered
    ]
    if missing:
        raise HTTPException(
            status_code=409, detail=f"Release refused: missing approval(s) {missing}"
        )

    key = _signing_key()
    head = store.current_audit_head(project_id, config_key)
    attestation = build_attestation(
        manifest_digest=build["manifest_digest"],
        dossier_digest=build["dossier_digest"],
        commit_sha=str(candidate.get("commit_sha") or ""),
        variant=str(candidate.get("variant") or ""),
        config_key=config_key,
        project_id=project_id,
        release_label=request.release_label,
        document_number=request.document_number,
        revision=request.revision,
        released_by=user.email,
        released_at_iso=_now_iso(),
        policy_snapshot={
            "policy_binding_digest": result.policy_binding_digest,
            "waivers": [
                finding.waiver_id for finding in result.findings if finding.waiver_id
            ],
        },
        approval_snapshot=[
            {
                "role": approval["role"],
                "approver": approval["approver"],
                "decision": approval["decision"],
                "domains": list(approval["domains"] or []),
            }
            for approval in approvals
        ],
        audit_head=head,
        signing_key_id=key.key_id,
        issuer=os.environ.get("PRISM_RELEASE_ISSUER", ""),
    )
    signature = key.sign_hex(attestation["attestation_digest"])
    store.upsert_signing_key(
        key_id=key.key_id, algorithm="ed25519", public_key=key.public_pem,
        created_by=user.email,
    )
    try:
        record = store.create_release_record(
            build_id=build_id,
            release_label=request.release_label,
            document_number=request.document_number,
            revision=request.revision,
            released_by=user.email,
            attestation=attestation,
            signature=signature,
            signing_key_id=key.key_id,
            policy_snapshot=attestation["policy"],
            approval_snapshot=attestation["approvals"],
        )
    except Exception as exc:  # noqa: BLE001 - unique label collisions land here
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return record


@router.get("/{project_id}/release-studio/records")
async def list_records(
    project_id: str,
    config_key: str | None = Query(None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    return {"records": store.list_release_records(project_id, config_key)}


@router.get("/{project_id}/release-studio/records/{record_id}/release-archive")
async def download_release_archive(
    project_id: str, record_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    record, archive = _release_archive(project_id, record_id)
    return Response(
        content=archive,
        media_type="application/gzip",
        headers={
            "Content-Disposition":
                f'attachment; filename="{record["release_label"]}-release.tar.gz"'
        },
    )


@router.post("/{project_id}/release-studio/records/{record_id}/verify")
async def verify_record(
    project_id: str, record_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    """Run the same standalone verifier the recipient runs."""

    get_project_for_role_or_404(project_id, user.role)
    record, archive = _release_archive(project_id, record_id)
    trusted = tuple(
        key["key_id"] for key in store.list_signing_keys() if key["status"] != "revoked"
    )
    report = verify_archive_bytes(archive, trusted_key_ids=trusted)
    return {"record_id": record_id, **report.to_dict()}


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


@router.get("/{project_id}/release-studio/audit")
async def list_audit(
    project_id: str,
    config_key: str = Query("default"),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    return {"events": store.list_audit_events(project_id, config_key)}


@router.get("/{project_id}/release-studio/audit/verify")
async def verify_audit(
    project_id: str,
    config_key: str = Query("default"),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    return store.verify_audit_chain(project_id, config_key)


# ---------------------------------------------------------------------------
# Org-level signing keys (unauthenticated by design)
# ---------------------------------------------------------------------------


@public_router.get("/api/release-studio/signing-keys")
async def signing_keys():
    """Public key material only. Superseded keys stay listed so old releases verify."""

    # Publish the configured key as soon as it is readable, not only once the
    # first release is issued: a recipient must be able to pin the key before
    # there is anything signed with it, and an operator needs to see that the
    # deployment is actually configured to sign.
    try:
        configured = load_signing_key()
    except Exception:  # noqa: BLE001 - an unconfigured deployment lists nothing
        configured = None
    if configured is not None:
        store.upsert_signing_key(
            key_id=configured.key_id,
            algorithm="ed25519",
            public_key=configured.public_pem,
            created_by="",
        )

    return {
        "keys": [
            {
                "key_id": key["key_id"],
                "algorithm": key["algorithm"],
                "public_key": key["public_key"],
                "status": key["status"],
                "valid_from": key["valid_from"],
                "valid_to": key["valid_to"],
            }
            for key in store.list_signing_keys()
        ]
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _build_or_404(project_id: str, build_id: str) -> dict[str, Any]:
    build = store.get_build(build_id)
    if build is None:
        raise HTTPException(status_code=404, detail="Build not found")
    candidate = store.get_candidate(build["candidate_id"])
    if candidate is None or candidate["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Build not found")
    return build


def _artifact_bytes(artifact_digest: str | None) -> bytes:
    if not artifact_digest:
        raise HTTPException(status_code=404, detail="Artifact not available")
    from app.services.job_artifact_service import JobArtifactService

    objects = JobArtifactService().objects
    path = objects / artifact_digest[:2] / artifact_digest[2:4] / artifact_digest
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact object is no longer present")
    return path.read_bytes()


def _signing_key():
    """Load the org release key from the process secret.

    The private key never reaches the database or the worker; when it is absent
    the API refuses to release rather than issuing something unverifiable.
    """

    key_id = os.environ.get("PRISM_RELEASE_SIGNING_KEY_ID", "").strip()
    pem = os.environ.get("PRISM_RELEASE_SIGNING_KEY", "").strip()
    pem_file = os.environ.get("PRISM_RELEASE_SIGNING_KEY_FILE", "").strip()
    if not pem and pem_file:
        try:
            pem = Path(pem_file).read_text(encoding="utf-8")
        except OSError as exc:
            raise HTTPException(
                status_code=503, detail=f"Release signing key file is unreadable: {exc}"
            ) from exc
    if not key_id or not pem:
        raise HTTPException(
            status_code=503,
            detail=(
                "Release signing is not configured. Set PRISM_RELEASE_SIGNING_KEY_ID and "
                "PRISM_RELEASE_SIGNING_KEY (or PRISM_RELEASE_SIGNING_KEY_FILE)."
            ),
        )
    try:
        return load_signing_key(key_id, pem)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _release_archive(project_id: str, record_id: str) -> tuple[dict[str, Any], bytes]:
    record = store.get_release_record(record_id)
    if record is None or record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Release record not found")
    build = store.get_build(record["build_id"])
    if build is None:
        raise HTTPException(status_code=404, detail="Release build is missing")

    keys = {key["key_id"]: key for key in store.list_signing_keys()}
    key = keys.get(record["signing_key_id"])
    if key is None:
        raise HTTPException(
            status_code=409, detail="The signing key for this release is not published"
        )
    attestation = _stored_attestation(record, build)
    archive = build_release_archive(
        dossier_bytes=_artifact_bytes(build["dossier_artifact_id"]),
        attestation=attestation,
        signature_hex=record["signature"],
        signing_key_id=record["signing_key_id"],
        public_pem=key["public_key"],
        valid_from=str(key["valid_from"] or ""),
        valid_to=str(key["valid_to"] or ""),
    )
    return record, archive


def _stored_attestation(record: dict[str, Any], build: dict[str, Any]) -> dict[str, Any]:
    """Reconstruct the signed attestation from the immutable release record."""

    attestation = record.get("attestation_body")
    if isinstance(attestation, dict) and attestation:
        return attestation
    raise HTTPException(
        status_code=409,
        detail=(
            "This release record predates attestation persistence; re-release the build "
            "to produce a downloadable archive."
        ),
    )


__all__ = ["public_router", "router"]
