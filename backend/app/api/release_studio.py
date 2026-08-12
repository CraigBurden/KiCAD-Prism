"""Release Studio API (R19).

Mounted at ``/api/projects``; every path lives under
``/{project_id}/release-studio`` because ``/{project_id}/releases`` already
serves Git tags and must keep doing so.

The signing-keys endpoint is deliberately unauthenticated: public keys exist to
be distributed, and an offline recipient verifying a release has no Prism
credentials.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import tarfile
from collections import OrderedDict
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api._helpers import get_project_for_role_or_404
from app.core.roles import role_meets_minimum
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
    override_record,
    release_is_permitted,
    resolve_policy,
)
from app.release_studio.verify import verify_archive_bytes
from app.services import release_studio_build_service as build_service
from app.services import release_policy_service as policy_store
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
    exception_kind: str | None = None
    exception_reason: str = Field("", max_length=4000)


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
    #: Administrative break-glass. Releasing over open blockers is an admin
    #: action, is refused without a reason, and is written into the signed
    #: attestation -- so a recipient sees it without having to ask.
    override_blockers: bool = False
    override_reason: str = Field("", max_length=2000)


class WebReleaseRequest(BaseModel):
    expires_at: str | None = None


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


@router.get("/{project_id}/release-studio/builds/{build_id}/sheets")
async def list_document_sheets(
    project_id: str,
    build_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """List composed sheets without making the client infer them from members."""

    get_project_for_role_or_404(project_id, user.role)
    _build_or_404(project_id, build_id)
    by_key: dict[str, dict[str, Any]] = {}
    for member in store.build_members(build_id):
        path = str(member.get("path") or "")
        if not path.startswith("documentation/"):
            continue
        filename = path.removeprefix("documentation/")
        if filename.endswith(".pdf"):
            key = filename.removesuffix(".pdf")
            by_key.setdefault(key, {"key": key})["pdf"] = {
                "path": path,
                "released_digest": member["released_digest"],
                "media_type": member.get("media_type") or "application/pdf",
            }
    return {"sheets": [by_key[key] for key in sorted(by_key)]}


@router.get("/{project_id}/release-studio/builds/{build_id}/sheets/{sheet_key}.pdf")
async def preview_document_sheet(
    project_id: str,
    build_id: str,
    sheet_key: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Serve the immutable PDF preview for one composed documentation document."""

    if not sheet_key or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in sheet_key):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return await download_member(
        project_id,
        build_id,
        f"documentation/{sheet_key}.pdf",
        disposition="inline",
        user=user,
    )


@router.get("/{project_id}/release-studio/builds/{build_id}/members/{member_path:path}")
async def download_member(
    project_id: str,
    build_id: str,
    member_path: str,
    disposition: str = Query("inline", pattern="^(inline|attachment)$"),
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Serve one released member out of the dossier, digest-checked.

    Viewing an output is only meaningful if what you are shown is the released
    bytes, so the extracted member is hashed and compared with the manifest's
    ``released_digest`` before it is returned.  A mismatch means the stored
    dossier no longer matches the record and is a hard error, never a silent
    best effort.
    """

    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)

    return _released_member_response(
        build, member_path, disposition=disposition, build_id=build_id
    )


def _released_member_response(
    build: dict[str, Any],
    member_path: str,
    *,
    disposition: str = "inline",
    public_share: bool = False,
    build_id: str | None = None,
) -> Response:
    member = next(
        (
            item
            for item in store.build_members(build_id or build["id"])
            if item["path"] == member_path
        ),
        None,
    )
    # Resolving through the members table is also what keeps a crafted path from
    # reaching an arbitrary archive entry: only recorded members are addressable.
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found in this build")

    payload = _artifact_bytes(build["dossier_artifact_id"])
    try:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            extracted = archive.extractfile(member_path)
            if extracted is None:
                raise HTTPException(
                    status_code=404, detail="Member is absent from the stored dossier"
                )
            data = extracted.read()
    except tarfile.TarError as exc:
        raise HTTPException(
            status_code=500, detail=f"The stored dossier could not be read: {exc}"
        ) from exc

    actual = hashlib.sha256(data).hexdigest()
    if actual != member["released_digest"]:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Released digest mismatch for {member_path}: the manifest records "
                f"{member['released_digest']} but the stored dossier holds {actual}"
            ),
        )

    filename = member_path.rsplit("/", 1)[-1]
    return Response(
        content=data,
        media_type=member["media_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            # The bytes are immutable and named by their digest.
            "Cache-Control": (
                "private, no-store"
                if public_share
                else "private, max-age=31536000, immutable"
            ),
            "ETag": f'"{actual}"',
            # Released members are third-party bytes -- KiCad's SVG plots most
            # of all -- and SVG served inline from this origin is script.  The
            # sandbox and the sniffing block keep an inline view from becoming
            # a way to run code against a logged-in session.
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
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
    policy_document = _policy_document(project_id, config_key, candidate)
    resolved = resolve_policy(
        policy_document,
        org_policy_loader=policy_store.load_bound_version,
    )
    members = [_MemberView(row) for row in store.build_members(build["id"])]
    context = RuleContext(
        members=members,
        evidence=store.build_evidence(build["id"]),
        projections=_evaluation_projections(build["id"]),
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


def _evaluation_projections(build_id: str) -> dict[str, Any]:
    """The immutable rule inputs this build captured.

    Board and semantic projections are recorded once per build. Re-evaluation
    reads those exact facts; recomputing from a checkout would make governance
    depend on mutable files, while dropping them makes projection-backed rules
    incorrectly report ``unsupported``.
    """

    return store.build_projections(build_id)


class _MemberView:
    """Adapt a persisted member row to the shape rules expect."""

    def __init__(self, row: dict[str, Any]) -> None:
        self.path = row["path"]
        self.member_kind = row["member_kind"]
        self.domains = tuple(row.get("domains") or ())
        self.released_digest = row["released_digest"]


def _policy_document(
    project_id: str,
    config_key: str,
    candidate: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Load the candidate's Git overlay, or the safe built-in baseline.

    Deliberately small: DRC/ERC clean, hermetic inputs, and the members a
    fabricator needs. A project overlay in Git replaces this wholesale.
    """

    if candidate:
        configured = build_service.policy_document_for_candidate(project_id, candidate)
        if configured is not None:
            return configured
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
            waiver_id,
            status=status,
            actor=user.email,
            reason=request.reason,
            exception_kind=request.exception_kind,
            exception_reason=request.exception_reason,
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

    override: dict[str, Any] | None = None
    if request.override_blockers:
        # Break-glass is an administrative act, not a designer's. The role is
        # checked here rather than on the route because every other release is
        # an ordinary designer action.
        if not role_meets_minimum(user.role, "admin"):
            raise HTTPException(
                status_code=403,
                detail="Releasing over open blockers requires the admin role",
            )
        if not request.override_reason.strip():
            raise HTTPException(
                status_code=400,
                detail="An override reason is required to release over open blockers",
            )
        override = override_record(
            result, actor=user.email, reason=request.override_reason.strip()
        )
        if not override["findings"] and not override["unsupported_rules"]:
            # Recording an override on a clean build would put a break-glass
            # marker into a signed attestation that stepped over nothing.
            raise HTTPException(
                status_code=400,
                detail="This build has no open blockers; no override is needed",
            )

    permitted, reason = release_is_permitted(result, overridden=override is not None)
    if not permitted:
        raise HTTPException(status_code=409, detail=f"Release refused: {reason}")

    approvals = store.effective_approvals(build_id)
    required = resolve_policy(
        _policy_document(project_id, config_key, candidate),
        org_policy_loader=policy_store.load_bound_version,
    ).required_approvals
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
            # Inside the signed attestation, so an offline recipient learns that
            # a release went out over open blockers -- and which ones -- from
            # the archive itself rather than by asking the issuer.
            **({"override": override} if override else {}),
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


@router.post("/{project_id}/release-studio/records/{record_id}/web-release")
async def create_web_release(
    project_id: str,
    record_id: str,
    request: WebReleaseRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    record = store.get_release_record(record_id)
    if record is None or record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Release record not found")
    try:
        share = store.create_web_share(
            record_id, actor=user.email, expires_at=request.expires_at
        )
    except (store.ReleaseStudioError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = share.pop("token")
    return {
        "share": share,
        "token": token,
        "url": f"/release-view/{token}",
    }


@router.get("/{project_id}/release-studio/records/{record_id}/web-releases")
async def list_web_releases(
    project_id: str,
    record_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    record = store.get_release_record(record_id)
    if record is None or record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Release record not found")
    return {"shares": store.list_web_shares(record_id)}


@router.post("/{project_id}/release-studio/web-releases/{share_id}/revoke")
async def revoke_web_release(
    project_id: str,
    share_id: str,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    try:
        share = store.revoke_web_share(
            share_id, project_id=project_id, actor=user.email
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return share


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
    trusted = {
        key["key_id"]: key["public_key"]
        for key in store.list_signing_keys()
        if key["status"] != "revoked"
    }
    report = verify_archive_bytes(archive, trusted_keys=trusted)
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


@public_router.get("/api/release-view/{token}")
async def public_release_view(token: str):
    share, record, build = _public_share(token)
    _, verification = _verified_public_archive(record)
    members = [
        {
            "path": member["path"],
            "member_kind": member["member_kind"],
            "media_type": member["media_type"],
            "size_bytes": member["size_bytes"],
            "released_digest": member["released_digest"],
            "domains": list(member.get("domains") or ()),
        }
        for member in store.build_members(build["id"])
    ]
    return Response(
        content=json.dumps(
            {
                "release": {
                    key: record[key]
                    for key in (
                        "id", "release_label", "document_number", "revision",
                        "dossier_digest", "manifest_digest", "attestation_digest",
                        "signing_key_id", "commit_sha", "variant", "created_at",
                    )
                },
                "members": members,
                "verification": verification,
                "expires_at": share.get("expires_at"),
            },
            default=str,
        ),
        media_type="application/json",
        headers=_public_response_headers(),
    )


@public_router.get("/api/release-view/{token}/members/{member_path:path}")
async def public_release_member(token: str, member_path: str):
    _, record, build = _public_share(token)
    _verified_public_archive(record)
    return _released_member_response(
        build, member_path, disposition="inline", public_share=True
    )


@public_router.get("/api/release-view/{token}/archive")
async def public_release_archive(token: str):
    _, record, _ = _public_share(token)
    archive, _ = _verified_public_archive(record)
    return Response(
        content=archive,
        media_type="application/gzip",
        headers={
            "Content-Disposition": f'attachment; filename="{record["release_label"]}-release.tar.gz"',
            **_public_response_headers(),
        },
    )


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


def _public_share(
    token: str,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if len(token) < 32 or len(token) > 200:
        raise HTTPException(status_code=404, detail="Shared release not found")
    share = store.resolve_web_share(token)
    if share is None:
        raise HTTPException(status_code=404, detail="Shared release not found or expired")
    record = store.get_release_record(share["record_id"])
    build = store.get_build(share["build_id"])
    if record is None or build is None:
        raise HTTPException(status_code=404, detail="Shared release is unavailable")
    return share, record, build


#: Verified public archives, keyed by ``attestation_digest``.
#:
#: A release record is immutable and its archive is deterministic, so its
#: verification result is a pure function of that digest.  Without this cache
#: every unauthenticated request -- including each member fetch on a page that
#: lists fifty members -- reassembled the archive and ran a full gzip plus
#: SHA-256 sweep over it, which is an amplification primitive offered to
#: anyone holding a share link.
_PUBLIC_ARCHIVE_CACHE: "OrderedDict[str, tuple[bytes, dict[str, Any]]]" = OrderedDict()

#: Bounded so a workspace with many shared releases cannot pin every dossier in
#: memory; the archives are megabytes each.
_PUBLIC_ARCHIVE_CACHE_LIMIT = 8


def _verified_public_archive(
    record: dict[str, Any],
) -> tuple[bytes, dict[str, Any]]:
    """Fail closed before an unauthenticated route exposes release bytes."""

    cache_key = str(record.get("attestation_digest") or "")
    cached = _PUBLIC_ARCHIVE_CACHE.get(cache_key) if cache_key else None
    if cached is not None:
        _PUBLIC_ARCHIVE_CACHE.move_to_end(cache_key)
        return cached

    trusted = {
        key["key_id"]: key["public_key"]
        for key in store.list_signing_keys()
        if key["status"] != "revoked"
    }
    _, archive = _release_archive(record["project_id"], record["id"])
    verification = verify_archive_bytes(
        archive,
        trusted_keys=trusted,
    ).to_dict()
    if not verification["ok"]:
        # Deliberately not cached: a failure may be a key that has just been
        # revoked, and re-checking a rejected share costs nothing worth saving.
        raise HTTPException(
            status_code=409,
            detail="The shared release failed authenticity verification",
        )
    if cache_key:
        _PUBLIC_ARCHIVE_CACHE[cache_key] = (archive, verification)
        while len(_PUBLIC_ARCHIVE_CACHE) > _PUBLIC_ARCHIVE_CACHE_LIMIT:
            _PUBLIC_ARCHIVE_CACHE.popitem(last=False)
    return archive, verification


def _public_response_headers() -> dict[str, str]:
    return {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "X-Content-Type-Options": "nosniff",
    }


def _artifact_bytes(artifact_id: str | None) -> bytes:
    """Read a published artifact by its ``ws_artifacts`` row id.

    The build rows reference artifacts by id, not by digest -- the FK targets
    ``ws_artifacts(id)`` -- so the object location is resolved from the row
    rather than reconstructed from a digest.  The bytes are re-hashed against
    the recorded digest because a content-addressed store that hands back
    something else has failed at its one job.
    """

    if not artifact_id:
        raise HTTPException(status_code=404, detail="Artifact not available")
    artifact = store.get_artifact(artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact metadata is no longer present")

    path = Path(str(artifact["object_path"]))
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact object is no longer present")
    payload = path.read_bytes()

    digest = str(artifact["digest"] or "")
    actual = hashlib.sha256(payload).hexdigest()
    if digest and actual != digest:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Artifact {artifact_id} is corrupt: recorded digest {digest}, "
                f"stored object hashes to {actual}"
            ),
        )
    return payload


def publish_configured_signing_key() -> str:
    """Publish the configured key's public half into the org key set.

    Called once at startup rather than lazily from the key-set route: a
    recipient must be able to pin the key before anything has been signed with
    it, and an operator needs to see that the deployment is configured to sign
    at all -- but a GET must not carry a write whose outcome depends on the
    process environment.

    Returns the published ``key_id``, or "" when signing is not configured,
    which is a legitimate state and never an error.
    """

    try:
        key = _signing_key()
    except HTTPException:
        return ""
    store.upsert_signing_key(
        key_id=key.key_id, algorithm="ed25519", public_key=key.public_pem, created_by=""
    )
    return key.key_id


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
