"""Release Studio API.

Mounted at ``/api/projects``; every path lives under
``/{project_id}/release-studio`` because ``/{project_id}/releases`` already
serves Git tags and must keep doing so.
"""

from __future__ import annotations

import hashlib
import io
import json
import tarfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api._helpers import get_project_for_role_or_404
from app.core.security import AuthenticatedUser, require_designer, require_viewer
from app.services import forge_publish_service as forge_publish
from app.services import release_studio_build_service as build_service
from app.services import release_studio_service as store
from app.services.job_service import jobs
from app.services.workspace_service import workspace

router = APIRouter(dependencies=[Depends(require_viewer)])


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


class PublishRequest(BaseModel):
    tag: str = Field(..., min_length=1, max_length=100)
    title: str = Field("", max_length=200)
    notes: str = Field("", max_length=8000)


# ---------------------------------------------------------------------------
# Configurations
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
    project = workspace.get_project_by_id(project_id) or {}
    try:
        forge = forge_publish.describe_forge(str(project.get("repo_url") or "")).to_dict()
    except forge_publish.ForgePublishError as exc:
        forge = {
            "kind": "unsupported",
            "name": "",
            "host": "",
            "owner_repo": "",
            "token_configured": False,
            "token_hint": str(exc),
        }
    return {
        "build": build,
        "candidate": candidate,
        "configuration": configuration,
        "members": store.build_members(build_id),
        "evidence": store.build_evidence(build_id),
        "fingerprints": store.build_fingerprints(build_id),
        "vendor_readiness": _vendor_readiness(build, configuration),
        "forge": forge,
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
# Publish to GitHub / GitLab
# ---------------------------------------------------------------------------


@router.post("/{project_id}/release-studio/builds/{build_id}/publish")
async def publish_build(
    project_id: str,
    build_id: str,
    request: PublishRequest,
    user: AuthenticatedUser = Depends(require_designer),
):
    """Zip the dossier and create a GitHub or GitLab Release on the imported remote."""

    get_project_for_role_or_404(project_id, user.role)
    build = _build_or_404(project_id, build_id)
    if str(build.get("status") or "") != "succeeded":
        raise HTTPException(status_code=409, detail="Only a successful build can be published")
    candidate = store.get_candidate(str(build["candidate_id"])) or {}
    commit_sha = str(candidate.get("commit_sha") or "")
    if not _is_full_git_sha(commit_sha):
        raise HTTPException(status_code=409, detail="The build is not bound to a full Git commit")
    project = workspace.get_project_by_id(project_id) or {}
    try:
        zip_bytes = forge_publish.dossier_tar_to_zip(_artifact_bytes(build.get("dossier_artifact_id")))
        filename = forge_publish.release_zip_filename(
            str(project.get("name") or project.get("parent_repo") or "release"),
            request.tag,
        )
        published = forge_publish.publish_release(
            repo_url=str(project.get("repo_url") or ""),
            commit_sha=commit_sha,
            tag=request.tag,
            title=request.title,
            notes=request.notes,
            zip_bytes=zip_bytes,
            filename=filename,
        )
    except forge_publish.ForgePublishError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return {"release": published, "filename": filename}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
        raise HTTPException(status_code=409, detail=str(exc)) from exc

def _vendor_readiness(build: dict[str, Any], configuration: dict[str, Any]) -> list[dict[str, Any]]:
    """Expose exact pack readiness; archive downloads use the same predicate."""

    from app.release_studio.vendors import vendor_pack_readiness

    dossier = _artifact_bytes(build.get("dossier_artifact_id")) if build.get("dossier_artifact_id") else b""
    evidence = _artifact_bytes(build.get("evidence_artifact_id")) if build.get("evidence_artifact_id") else b""
    return [
        vendor_pack_readiness(vendor_id, dossier_bytes=dossier, evidence_bytes=evidence)
        for vendor_id in configuration.get("vendors") or []
    ]


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

