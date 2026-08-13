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
    Evaluation,
    Finding,
    RuleContext,
    RuleOutcome,
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
from app.services.workspace_service import workspace

router = APIRouter(dependencies=[Depends(require_viewer)])

# Org-level router: no project scope, and no authentication on the key set.
public_router = APIRouter()

EVALUATOR_BUILD = "release-studio/r13"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CandidateRequest(BaseModel):
    config_key: str = Field("default", max_length=200)
    # A queued build must name an immutable Git object. Ref names and short
    # SHAs can move or be ambiguous before the worker materializes the closure.
    commit_sha: str = Field(..., pattern=r"^[0-9a-fA-F]{40}$")
    variant: str = Field("", max_length=200)


class ConfigurationWriteRequest(BaseModel):
    configuration: dict[str, Any]
    base_commit_sha: str = Field(..., pattern=r"^[0-9a-fA-F]{40}$")
    commit: bool = True


class EvaluateRequest(BaseModel):
    # Compatibility-only. Evaluation authority is the candidate's committed
    # configuration, not a value supplied by the caller.
    config_key: str = Field("default", max_length=200)


class WaiverRequest(BaseModel):
    config_key: str = Field("default", max_length=200)
    rule_id: str = Field(..., max_length=200)
    domain: str = Field(..., max_length=64)
    reason: str = Field(..., min_length=3, max_length=4000)
    subject_pattern: str = Field("", max_length=400)
    finding_key: str = Field("", max_length=128)
    #: The build this exception was raised against. A waiver accepts a finding
    #: on a specific set of outputs, so it does not travel to the next release.
    build_id: str = Field("", max_length=64)
    expires_at: str | None = None


class WaiverTransitionRequest(BaseModel):
    reason: str = Field("", max_length=4000)
    exception_kind: str | None = None
    exception_reason: str = Field("", max_length=4000)


class ApprovalRequest(BaseModel):
    # The UI must name the evaluation it displayed. This closes the interval
    # where a waiver/policy re-evaluation lands between render and approval.
    evaluation_id: str = Field(..., min_length=1, max_length=64)
    role: str = Field(..., max_length=120)
    domains: list[str] = Field(default_factory=list)
    decision: str = Field("approved", max_length=40)
    note: str = Field("", max_length=4000)
    exception_kind: str | None = None
    exception_reason: str | None = None
    reauth_password: str = Field("", max_length=400)


class RescindRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=2000)


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
async def list_configurations(
    project_id: str,
    commit_sha: str | None = Query(None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    if commit_sha:
        if not _is_full_git_sha(commit_sha):
            raise HTTPException(
                status_code=400,
                detail="commit_sha must be a full 40-character hexadecimal Git SHA",
            )
        try:
            configurations = build_service.list_configurations_at_commit(
                project_id, commit_sha
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"configurations": configurations}
    return {"configurations": build_service.sync_configurations(project_id)}


@router.put("/{project_id}/release-studio/configurations/{config_key}")
async def save_configuration(
    project_id: str,
    config_key: str,
    request: ConfigurationWriteRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    """Publish a configuration through the repository-locked worker."""

    get_project_for_role_or_404(project_id, user.role)
    if not request.commit:
        raise HTTPException(
            status_code=400,
            detail="Release configurations must be committed before they can be built",
        )
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    repository_id = str(row.get("repo_id") or "")
    document_digest = hashlib.sha256(
        json.dumps(
            request.configuration,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    job = jobs.enqueue(
        "release_studio_configuration_publish",
        {
            "project_id": project_id,
            "config_key": config_key,
            "configuration": request.configuration,
            "base_commit_sha": request.base_commit_sha,
            "author": user.email,
        },
        project_id=project_id,
        repository_id=repository_id or None,
        requested_by=user.email,
        artifact_key=f"release-studio-config:{project_id}:{config_key}:{document_digest}",
        max_attempts=2,
        resources={"prism_worker": 1},
        locks=[{
            "key": f"repository:{repository_id}" if repository_id else f"project:{project_id}",
            "mode": "write",
        }],
    )
    return {"job": job}


@router.get("/{project_id}/release-studio/vendor-profiles")
async def list_vendor_profiles(
    project_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    from app.release_studio.vendors import public_profile_payload

    return {"profiles": public_profile_payload()}


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
        candidate["builds"] = store.list_builds(candidate["id"])
        candidate["latest_build"] = candidate["builds"][0] if candidate["builds"] else None
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
        artifact_key=(
            f"release-studio:{project_id}:{request.config_key}:"
            f"{request.commit_sha}:{request.variant}"
        ),
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
    candidate["builds"] = store.list_builds(candidate_id)
    candidate["latest_build"] = candidate["builds"][0] if candidate["builds"] else None
    return candidate


@router.get("/{project_id}/release-studio/builds/{build_id}")
async def get_build(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    candidate = store.get_candidate(str(build["candidate_id"])) or {}
    configuration = _candidate_configuration(project_id, candidate)
    approval_coverage = _required_approval_coverage(project_id, build, user)
    evaluation = store.latest_evaluation(build_id)
    evaluation_fresh = bool(
        evaluation is not None
        and _evaluation_has_current_waivers(
            project_id, str(candidate.get("config_key") or ""), build_id, evaluation
        )
    )
    return {
        "build": build,
        "candidate": candidate,
        "configuration": configuration,
        "members": store.build_members(build_id),
        "evidence": store.build_evidence(build_id),
        "fingerprints": store.build_fingerprints(build_id),
        "evaluation": evaluation,
        "evaluation_fresh": evaluation_fresh,
        **(
            {"evaluation_fresh_error": "Evaluation is stale after a waiver change; evaluate again."}
            if evaluation is not None and not evaluation_fresh
            else {}
        ),
        "approvals": store.list_approvals(build_id),
        "waivers": store.list_waivers(
            project_id, str(candidate.get("config_key") or ""), build_id
        ),
        "vendor_readiness": _vendor_readiness(build, configuration),
        # What the policy demands before this build can be released, and which
        # of those are already covered. Resolving it only at release time meant
        # the first a user heard of a required role was a refusal naming it.
        "required_approvals": approval_coverage["required_approvals"],
        "required_approvals_available": approval_coverage["available"],
        **(
            {"required_approvals_error": approval_coverage["error"]}
            if not approval_coverage["available"]
            else {}
        ),
    }


def _required_approval_coverage(
    project_id: str, build: dict[str, Any], user: AuthenticatedUser | None = None
) -> dict[str, Any]:
    """Each (role, domain) the policy requires, marked satisfied or not.

    The result explicitly distinguishes a resolved policy with no required
    approvals from an unavailable policy. The latter must never look releasable
    to a client.
    """

    candidate = store.get_candidate(str(build.get("candidate_id") or ""))
    if candidate is None:
        return {
            "available": False,
            "required_approvals": None,
            "error": "candidate not found",
        }
    try:
        required = resolve_policy(
            _policy_document(project_id, candidate),
            org_policy_loader=policy_store.load_bound_version,
        ).required_approvals
    except Exception as exc:  # noqa: BLE001 - render, but make stale policy explicit
        return {"available": False, "required_approvals": None, "error": str(exc)}
    covered = {
        (approval["role"], domain)
        for approval in store.effective_approvals(str(build["id"]))
        for domain in (approval["domains"] or [])
    }
    return {
        "available": True,
        "required_approvals": [
            {
                "role": entry["role"],
                "domain": domain,
                "satisfied": (entry["role"], domain) in covered,
                # Product roles do not confer engineering authority. This is a
                # conservative mapping until per-project approval grants exist.
                "eligible_app_roles": ["admin"],
                "can_current_user_approve": bool(
                    user is not None and role_meets_minimum(user.role, "admin")
                ),
            }
            for entry in required
            for domain in entry["domains"]
        ],
    }


def _is_full_git_sha(value: str) -> bool:
    return len(value) == 40 and all(char in "0123456789abcdefABCDEF" for char in value)


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


@router.get("/{project_id}/release-studio/builds/{build_id}/vendor-packs/{vendor_id}")
async def download_build_vendor_pack(
    project_id: str,
    build_id: str,
    vendor_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    return _vendor_pack_response(build, vendor_id)


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


@router.get("/{project_id}/release-studio/builds/{build_id}/logs")
async def list_build_logs(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    """Which steps have a log, how long each took, and how it ended."""

    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    evidence_index = _evidence_json(build)
    steps = evidence_index.get("steps") or {}
    return {
        "timings": list(evidence_index.get("timings") or build.get("timings") or []),
        "steps": [
            {
                "step_id": step_id,
                "step_type": entry.get("step_type") or "",
                "returncode": entry.get("returncode"),
                "elapsed_ms": entry.get("elapsed_ms") or 0,
                "skipped_reason": entry.get("skipped_reason") or "",
                "argv": entry.get("normalized_argv") or [],
                # Failed/cancelled retained attempts carry this in their
                # canonical evidence index; consumers must not infer terminal
                # state from a missing process return code.
                "status": entry.get("status") or "",
            }
            for step_id, entry in sorted(steps.items())
        ],
    }


@router.get("/{project_id}/release-studio/builds/{build_id}/logs/{step_id}")
async def download_build_log(
    project_id: str,
    build_id: str,
    step_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Serve one step's full log out of build-evidence.

    The job row keeps a 4000-character tail and is pruned on the job retention
    schedule; this is the copy that lives as long as the release does.
    """

    if not step_id or any(
        ch not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for ch in step_id
    ):
        raise HTTPException(status_code=404, detail="Log not found")
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    payload = _evidence_member(build, f"logs/{step_id}.log")
    if payload is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return Response(content=payload, media_type="text/plain; charset=utf-8")


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
    result = _evaluate(project_id, build, candidate, actor=user.email)
    return {"evaluation": store.latest_evaluation(build_id), "outcome": result.outcome}


def _evaluate(project_id: str, build, candidate, *, actor: str):
    if build.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="Only a successful immutable build can be evaluated")
    policy_document = _policy_document(project_id, candidate)
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
    active_waivers = store.active_waivers(
        project_id, str(candidate.get("config_key") or ""), str(build["id"])
    )
    result = evaluate(
        resolved,
        context,
        waivers=active_waivers,
        build_id=str(build["id"]),
    )
    store.record_evaluation(
        build_id=build["id"], evaluation=result, evaluator_build=EVALUATOR_BUILD,
        waiver_binding_digest=store.waiver_binding_digest(
            project_id, str(candidate.get("config_key") or ""), str(build["id"]),
            waivers=active_waivers,
        ),
        actor=actor,
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


@router.post("/{project_id}/release-studio/builds/{build_id}/waivers")
async def create_build_waiver(
    project_id: str,
    build_id: str,
    request: WaiverRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    candidate = store.get_candidate(str(build["candidate_id"])) or {}
    try:
        return store.create_waiver(
            project_id=project_id,
            config_key=str(candidate.get("config_key") or ""),
            rule_id=request.rule_id,
            domain=request.domain,
            reason=request.reason,
            owner=user.email,
            subject_pattern=request.subject_pattern,
            finding_key=request.finding_key,
            build_id=str(build["id"]),
            expires_at=request.expires_at,
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{project_id}/release-studio/waivers")
async def create_waiver(
    project_id: str, request: WaiverRequest, user: AuthenticatedUser = Depends(require_designer)
):
    get_project_for_role_or_404(project_id, user.role)
    if not request.build_id:
        raise HTTPException(status_code=400, detail="A waiver must name an immutable build")
    build = _build_or_404(project_id, request.build_id)
    candidate = store.get_candidate(str(build["candidate_id"])) or {}
    try:
        return store.create_waiver(
            project_id=project_id,
            config_key=str(candidate.get("config_key") or ""),
            rule_id=request.rule_id,
            domain=request.domain,
            reason=request.reason,
            owner=user.email,
            subject_pattern=request.subject_pattern,
            finding_key=request.finding_key,
            build_id=str(build["id"]),
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
            project_id=project_id,
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
    if not role_meets_minimum(user.role, "admin"):
        raise HTTPException(status_code=403, detail="Configured release approvals require the admin role")
    candidate = store.get_candidate(_build_or_404(project_id, build_id)["candidate_id"]) or {}
    resolved_policy = resolve_policy(
        _policy_document(project_id, candidate),
        org_policy_loader=policy_store.load_bound_version,
    )
    current_evaluation = store.latest_evaluation(build_id)
    if current_evaluation is None or current_evaluation["policy_binding_digest"] != resolved_policy.binding_digest:
        raise HTTPException(
            status_code=409,
            detail="Build evaluation is stale; evaluate it again before approval",
        )
    required_pairs = {
        (entry["role"], domain)
        for entry in resolved_policy.required_approvals
        for domain in entry["domains"]
    }
    if len(request.domains) != 1 or (request.role, request.domains[0]) not in required_pairs:
        raise HTTPException(status_code=400, detail="Approval must select one required policy role/domain pair")
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
            expected_policy_binding_digest=resolved_policy.binding_digest,
            expected_evaluation_id=request.evaluation_id,
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Release
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/release-studio/builds/{build_id}/approvals/{approval_id}/rescind"
)
async def rescind_approval(
    project_id: str,
    build_id: str,
    approval_id: str,
    request: RescindRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    """Withdraw an approval.

    Approval rows are immutable -- a database trigger raises on UPDATE and
    DELETE -- so this appends to ``ws_release_approval_invalidations`` the same
    way a stale binding does. The record of who approved, and that it was later
    withdrawn and why, both survive.
    """

    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    try:
        return store.rescind_approval(
            approval_id=approval_id,
            build_id=str(build["id"]),
            reason=request.reason,
            actor=user.email,
            is_admin=role_meets_minimum(user.role, "admin"),
        )
    except store.ReleaseStudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{project_id}/release-studio/builds/{build_id}/release")
async def create_release(
    project_id: str,
    build_id: str,
    request: ReleaseRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    if build.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="Only a successful immutable build can be released")
    candidate = store.get_candidate(build["candidate_id"]) or {}
    config_key = str(candidate.get("config_key") or "default")
    configuration = _candidate_configuration(project_id, candidate)

    evaluation = store.latest_evaluation(build_id)
    if evaluation is None:
        raise HTTPException(status_code=400, detail="Build has not been evaluated")

    # Approval rows bind to one concrete evaluation.  Re-evaluating during
    # release would create an unreviewed result after the approval was given,
    # so release consumes the current stored evaluation instead.
    result = _stored_evaluation(evaluation)
    resolved = resolve_policy(
        _policy_document(project_id, candidate),
        org_policy_loader=policy_store.load_bound_version,
    )
    if evaluation.get("policy_binding_digest") != resolved.binding_digest:
        raise HTTPException(status_code=409, detail="Build evaluation is stale; evaluate it again before release")
    if not _evaluation_has_current_waivers(project_id, config_key, build_id, evaluation):
        raise HTTPException(
            status_code=409,
            detail="Build evaluation is stale after a waiver change; evaluate it again before release",
        )

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
    required = resolved.required_approvals
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
        document_number=str(configuration.get("document_number") or ""),
        revision=str(configuration.get("revision") or ""),
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
            document_number=str(configuration.get("document_number") or ""),
            revision=str(configuration.get("revision") or ""),
            released_by=user.email,
            attestation=attestation,
            signature=signature,
            signing_key_id=key.key_id,
            policy_snapshot=attestation["policy"],
            approval_snapshot=attestation["approvals"],
            expected_evaluation_id=str(evaluation["id"]),
            expected_policy_binding_digest=str(resolved.binding_digest),
            expected_waiver_binding_digest=str(evaluation.get("waiver_binding_digest") or ""),
            expected_required_approvals=required,
            expected_approval_ids=[str(approval["id"]) for approval in approvals],
            expected_audit_head=str(head.get("event_hash") or ""),
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


@router.get("/{project_id}/release-studio/records/{record_id}/vendor-packs/{vendor_id}")
async def download_record_vendor_pack(
    project_id: str,
    record_id: str,
    vendor_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    get_project_for_role_or_404(project_id, user.role)
    record = store.get_release_record(record_id)
    if record is None or record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Release not found")
    build = _build_or_404(project_id, str(record["build_id"]))
    return _vendor_pack_response(
        build,
        vendor_id,
        filename_stem=str(record.get("release_label") or "release"),
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


def _candidate_configuration(project_id: str, candidate: dict[str, Any]) -> dict[str, Any]:
    try:
        return build_service.configuration_for_candidate(project_id, candidate)
    except build_service.BuildError as exc:
        # A release identity that cannot be proved from its immutable source is
        # not safe to display as authoritative or to sign.
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _evaluation_has_current_waivers(
    project_id: str,
    config_key: str,
    build_id: str,
    evaluation: dict[str, Any],
) -> bool:
    """Whether the stored evaluation saw the active waiver state at release."""

    return str(evaluation.get("waiver_binding_digest") or "") == store.waiver_binding_digest(
        project_id, config_key, build_id
    )


def _stored_evaluation(row: dict[str, Any]) -> Evaluation:
    """Rehydrate persisted evaluation state without re-running policy at release."""

    findings = tuple(
        Finding(
            rule_id=str(item["rule_id"]),
            rule_version=str(item["rule_version"]),
            severity=str(item["severity"]),
            domain=str(item["domain"]),
            subject=str(item["subject"]),
            message=str(item["message"]),
            observed=dict(item.get("observed") or {}),
            expected=dict(item.get("expected") or {}),
            status=str(item.get("status") or "open"),
            waiver_id=str(item.get("waiver_id") or ""),
        )
        for item in row.get("findings") or []
    )
    outcomes = tuple(
        RuleOutcome(
            rule_id=str(item["rule_id"]),
            rule_version=str(item["rule_version"]),
            outcome=str(item["outcome"]),
            finding_count=int(item.get("finding_count") or 0),
            unsupported_reason=str(item.get("unsupported_reason") or ""),
        )
        for item in row.get("rule_outcomes") or []
    )
    return Evaluation(
        outcome=str(row["outcome"]),
        findings=findings,
        rule_outcomes=outcomes,
        counts=dict(row.get("counts") or {}),
        policy_binding=dict(row.get("policy_binding") or {}),
        policy_binding_digest=str(row["policy_binding_digest"]),
    )


def _vendor_readiness(build: dict[str, Any], configuration: dict[str, Any]) -> list[dict[str, Any]]:
    """Expose exact pack readiness; archive downloads use the same predicate."""

    from app.release_studio.vendors import vendor_pack_readiness

    dossier = _artifact_bytes(build.get("dossier_artifact_id")) if build.get("dossier_artifact_id") else b""
    evidence = _artifact_bytes(build.get("evidence_artifact_id")) if build.get("evidence_artifact_id") else b""
    return [
        vendor_pack_readiness(vendor_id, dossier_bytes=dossier, evidence_bytes=evidence)
        for vendor_id in configuration.get("vendors") or []
    ]


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


def _vendor_pack_response(
    build: dict[str, Any],
    vendor_id: str,
    *,
    filename_stem: str | None = None,
) -> Response:
    from app.release_studio.vendors import VendorPackError, build_vendor_pack, profile_by_id

    try:
        profile = profile_by_id(vendor_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown vendor profile: {vendor_id}") from exc
    try:
        pack = build_vendor_pack(
            vendor_id,
            dossier_bytes=_artifact_bytes(build.get("dossier_artifact_id")),
            evidence_bytes=_artifact_bytes(build.get("evidence_artifact_id"))
            if build.get("evidence_artifact_id")
            else b"",
        )
    except VendorPackError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    stem = filename_stem or f"build-{build['id']}"
    filename = f"{stem}-{profile.pack_filename}"
    return Response(
        content=pack,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _evidence_member(build: dict[str, Any], path: str) -> bytes | None:
    """One file out of build-evidence.tar.gz, or ``None`` when it is absent.

    Builds made before logs were archived have no ``logs/`` entries, so a miss
    is an ordinary 404 rather than a failure.
    """

    payload = _artifact_bytes(build.get("evidence_artifact_id"))
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        try:
            member = archive.extractfile(path)
        except KeyError:
            return None
        return member.read() if member is not None else None


def _evidence_json(build: dict[str, Any]) -> dict[str, Any]:
    """The build-evidence index, or an empty one when it cannot be read."""

    try:
        payload = _evidence_member(build, "build-evidence.json")
    except HTTPException:
        return {}
    if not payload:
        return {}
    try:
        return json.loads(payload)
    except ValueError:
        return {}


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
