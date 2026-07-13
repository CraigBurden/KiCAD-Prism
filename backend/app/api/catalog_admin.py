from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.security import AuthenticatedUser, require_catalog_reader, require_catalog_writer
from app.services.component_catalog_service import catalog_service
from app.services import semantic_visualizer_service
from app.services.project_component_import_service import run_project_import_session
from app.services.workspace_service import workspace

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

WORKFLOW_TRANSITIONS: dict[str, set[str]] = {
    "open": {"in_progress", "archived"},
    "in_progress": {"qa_review", "open", "archived"},
    "qa_review": {"done", "in_progress", "archived"},
    "done": {"released", "qa_review", "archived"},
    "released": {"archived", "open"},
    "archived": {"open"},
}

LEGACY_WORKFLOW_STAGE_MAP = {
    "draft": "open",
    "in_review": "qa_review",
    "qa_approved": "done",
    "deprecated": "archived",
}


def _normalize_workflow_stage(value: str) -> str:
    normalized = value.strip().lower()
    return LEGACY_WORKFLOW_STAGE_MAP.get(normalized, normalized)


def _can_transition_workflow(user: AuthenticatedUser, current_stage: str, next_stage: str) -> bool:
    if current_stage == next_stage:
        return user.role in {"admin", "component_designer"} or (user.role == "component_qa" and current_stage == "qa_review")
    if next_stage not in WORKFLOW_TRANSITIONS.get(current_stage, set()):
        return False
    if user.role == "admin":
        return True
    if user.role == "component_designer":
        return not (current_stage == "qa_review" and next_stage == "done")
    if user.role == "component_qa":
        return current_stage == "qa_review" and next_stage in {"done", "in_progress", "archived"}
    return False


def _update_validation_job(job_id: str, **fields: Any) -> None:
    workspace.update_job(job_id, **fields)


def _run_validation_job(job_id: str, component_ids: list[str] | None = None) -> None:
    errors: list[dict[str, str]] = []
    validated = 0
    component_payload: dict[str, Any] | None = None
    try:
        if component_ids is None:
            ids: list[str] = []
            page = 1
            while True:
                result = catalog_service.list_components(
                    include_inactive=False,
                    page=page,
                    page_size=10000,
                    lightweight=True,
                )
                ids.extend(str(component["id"]) for component in result["items"])
                if page >= int(result.get("pages") or 1):
                    break
                page += 1
        else:
            ids = component_ids

        total = len(ids)
        if total == 0:
            _update_validation_job(
                job_id,
                status="completed",
                message="No components to validate",
                percent=100,
                validated=0,
                total=0,
                errors=[],
            )
            return

        _update_validation_job(job_id, message=f"Validating 0/{total} components", total=total)
        for index, component_id in enumerate(ids, start=1):
            _update_validation_job(
                job_id,
                message=f"Validating {index}/{total} components",
                percent=((index - 1) / total) * 100,
                current_component_id=component_id,
                validated=validated,
                errors=errors,
            )
            try:
                result = catalog_service.validate_component_klc(component_id)
                validated += 1
                if total == 1:
                    component_payload = result.get("component")
            except ValueError as exc:
                errors.append({"component_id": component_id, "error": str(exc)})

        _update_validation_job(
            job_id,
            status="completed",
            message=f"Validated {validated}/{total} components",
            percent=100,
            validated=validated,
            total=total,
            errors=errors,
            component=component_payload,
        )
    except Exception as exc:
        _update_validation_job(
            job_id,
            status="failed",
            message="KLC validation failed",
            percent=100,
            error=str(exc),
            validated=validated,
            errors=errors,
            component=component_payload,
        )


def _start_validation_job(component_ids: list[str] | None = None) -> str:
    job_id = str(uuid.uuid4())
    mode = "component" if component_ids and len(component_ids) == 1 else "catalog"
    workspace.create_job(
        job_id,
        "catalog_validation",
        status="running",
        message="Queued KLC validation",
        percent=0,
        mode=mode,
        component_ids=component_ids,
        validated=0,
        total=len(component_ids) if component_ids else None,
        errors=[],
    )
    thread = threading.Thread(target=_run_validation_job, args=(job_id, component_ids), daemon=True)
    thread.start()
    return job_id


def _update_preview_job(job_id: str, **fields: Any) -> None:
    workspace.update_job(job_id, **fields)


def _run_preview_job(job_id: str) -> None:
    try:
        def update_progress(counts: dict[str, Any]) -> None:
            total_assets = int(counts.get("total_assets") or 0)
            scanned_assets = int(counts.get("scanned_assets") or 0)
            percent = 100 if total_assets == 0 else (scanned_assets / total_assets) * 100
            _update_preview_job(
                job_id,
                message=f"Generating previews {scanned_assets}/{total_assets}",
                percent=percent,
                **counts,
            )

        result = catalog_service.generate_missing_component_previews(progress_callback=update_progress)
        _update_preview_job(
            job_id,
            status="completed",
            message=(
                f"Generated {result.get('generated', 0)} missing previews; "
                f"{result.get('failed', 0)} failed"
            ),
            percent=100,
            **result,
        )
    except Exception as exc:
        _update_preview_job(
            job_id,
            status="failed",
            message="Preview generation failed",
            percent=100,
            error=str(exc),
        )


def _start_preview_job() -> str:
    job_id = str(uuid.uuid4())
    workspace.create_job(
        job_id,
        "catalog_preview_generation",
        status="running",
        message="Queued preview generation",
        percent=0,
        scanned_assets=0,
        generated=0,
        skipped_ready=0,
        failed=0,
        errors=[],
    )
    thread = threading.Thread(target=_run_preview_job, args=(job_id,), daemon=True)
    thread.start()
    return job_id


class CreateManualComponentRequest(BaseModel):
    value: str
    description: str
    datasheet: str
    manufacturer: str
    manufacturer_part_number: str
    category: str = ""
    package_name: str = ""
    vendor: str = ""
    vendor_part_number: str = ""
    mass_g: str = ""
    rqjc_c_w: str = ""
    rqjc_top_c_w: str = ""
    temp_max_c: str = ""
    temp_min_c: str = ""
    power_dissipation_w: str = ""
    rate: str = ""
    sap_code: str = ""
    change_summary: str = "Create component"
    extra_fields: dict[str, str] = Field(default_factory=dict)


class UpdateComponentMetadataRequest(BaseModel):
    value: str | None = None
    description: str | None = None
    datasheet_url: str | None = None
    manufacturer: str | None = None
    mpn: str | None = None
    category: str | None = None
    package_name: str | None = None
    vendor: str | None = None
    vendor_part_number: str | None = None
    mass_g: str | None = None
    rqjc_c_w: str | None = None
    rqjc_top_c_w: str | None = None
    temp_max_c: str | None = None
    temp_min_c: str | None = None
    power_dissipation_w: str | None = None
    rate: str | None = None
    sap_code: str | None = None
    expected_revision_id: str = Field(min_length=1)
    change_summary: str = "Update component metadata"
    extra_fields: dict[str, str] | None = None


class ReleaseStatusRequest(BaseModel):
    release_status: str = ""
    workflow_stage: str = ""
    self_approval_override_reason: str = ""
    review_note: str = ""
    expected_revision_id: str = ""
    expected_manifest_hash: str = ""


class ProjectComponentSelectionRequest(BaseModel):
    component_uid: str = ""
    reference: str = ""
    schematic_uuid: str = ""
    pcb_footprint_uuid: str = ""


class ProjectImportRequest(BaseModel):
    scope: str
    project_id: str = ""
    source_revision: str = ""
    selection: ProjectComponentSelectionRequest | None = None


class AcceptProjectImportProposalRequest(BaseModel):
    metadata_overrides: dict[str, Any] = Field(default_factory=dict)
    asset_selections: dict[str, list[str]] = Field(default_factory=dict)
    change_summary: str = "Import component from project"


@router.get("/components")
def list_catalog_components(
    q: str = Query(default=""),
    source: str | None = Query(default=None),
    availability_state: str | None = Query(default=None),
    workflow_stage: str | None = Query(default=None),
    validation_status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    sort_by: str = Query(default=""),
    sort_dir: str = Query(default="asc"),
    lightweight: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    _ = user
    try:
        return catalog_service.list_components(
            query=q,
            source=source,
            availability_state=availability_state,
            workflow_stage=workflow_stage,
            validation_status=validation_status,
            category=category,
            include_inactive=include_inactive,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_dir=sort_dir,
            lightweight=lightweight,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/categories")
def list_catalog_categories(user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    return {"categories": catalog_service.list_categories()}


@router.get("/workflow/summary")
def workflow_summary(user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    return catalog_service.workflow_summary()


@router.get("/release-queue")
def release_queue(
    q: str = Query(default=""),
    workflow_stage: str = Query(default="all", pattern="^(all|qa_review|done)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    _ = user
    stages = "qa_review,done" if workflow_stage == "all" else workflow_stage
    try:
        result = catalog_service.list_components(
            query=q,
            workflow_stage=stages,
            include_inactive=False,
            page=page,
            page_size=page_size,
            sort_by="updated_at",
            sort_dir="desc",
            lightweight=False,
        )
        return {**result, "summary": catalog_service.release_queue_summary()}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/health")
def catalog_health(user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    return catalog_service.catalog_health()


@router.post("/import-sessions/projects", status_code=202)
def create_project_import_session(
    payload: ProjectImportRequest,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    visible_projects = {str(project["id"]) for project in workspace.get_all_projects(user.role)}
    if payload.scope in {"component", "project"} and payload.project_id not in visible_projects:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        selected_project_ids = sorted(visible_projects) if payload.scope == "all-projects" else [payload.project_id]
        project_revisions: dict[str, str] = {}
        for project_id in selected_project_ids:
            project = workspace.get_project_by_id(project_id)
            if not project:
                continue
            repo_root = semantic_visualizer_service._repo_root(Path(str(project["path"])))
            requested_ref = payload.source_revision if project_id == payload.project_id and payload.source_revision else "HEAD"
            project_revisions[project_id] = semantic_visualizer_service._resolve_commit(repo_root, requested_ref)
        session = catalog_service.create_project_import_session(
            scope=payload.scope,
            project_id=payload.project_id,
            project_ids=selected_project_ids,
            project_revisions=project_revisions,
            source_revision=project_revisions.get(payload.project_id, payload.source_revision),
            selection=payload.selection.model_dump(exclude_none=True) if payload.selection else None,
            actor=user.email,
        )
        thread = threading.Thread(target=run_project_import_session, args=(str(session["id"]),), daemon=True)
        thread.start()
        return session
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/import-sessions/{session_id}")
def get_project_import_session(
    session_id: str,
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    session = catalog_service.get_project_import_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Import session not found")
    if user.role != "admin" and str(session.get("created_by") or "") != user.email:
        raise HTTPException(status_code=403, detail="Import session access denied")
    return session


@router.get("/import-sessions")
def list_project_import_sessions(user: AuthenticatedUser = Depends(require_catalog_reader)):
    return {
        "items": catalog_service.list_project_import_sessions(
            created_by=user.email,
            include_all=user.role == "admin",
        )
    }


@router.get("/import-sessions/{session_id}/proposals")
def list_project_import_proposals(
    session_id: str,
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    session = catalog_service.get_project_import_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Import session not found")
    if user.role != "admin" and str(session.get("created_by") or "") != user.email:
        raise HTTPException(status_code=403, detail="Import session access denied")
    return {"items": catalog_service.list_project_import_proposals(session_id)}


def _project_import_proposal_for_user(proposal_id: str, user: AuthenticatedUser) -> dict[str, Any]:
    proposal = catalog_service.get_project_import_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Import proposal not found")
    session = catalog_service.get_project_import_session(str(proposal["session_id"]))
    if not session:
        raise HTTPException(status_code=404, detail="Import session not found")
    if user.role != "admin" and str(session.get("created_by") or "") != user.email:
        raise HTTPException(status_code=403, detail="Import proposal access denied")
    return proposal


@router.post("/import-proposals/{proposal_id}/accept")
def accept_project_import_proposal(
    proposal_id: str,
    payload: AcceptProjectImportProposalRequest,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _project_import_proposal_for_user(proposal_id, user)
    try:
        return catalog_service.accept_project_import_proposal(
            proposal_id,
            metadata_overrides=payload.metadata_overrides,
            asset_selections=payload.asset_selections,
            actor=user.email,
            change_summary=payload.change_summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import-proposals/{proposal_id}/reject")
def reject_project_import_proposal(
    proposal_id: str,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _project_import_proposal_for_user(proposal_id, user)
    try:
        return catalog_service.reject_project_import_proposal(proposal_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/components")
def create_catalog_component(
    payload: CreateManualComponentRequest,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    try:
        data = payload.model_dump()
        change_summary = str(data.pop("change_summary"))
        return catalog_service.create_manual_component(actor=user.email, change_summary=change_summary, **data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/components/{component_id}")
def get_catalog_component(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    component = catalog_service.get_component(component_id)
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.get("/components/{component_id}/revisions")
def list_component_revisions(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return {"items": catalog_service.list_component_revisions(component_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/revisions/compare")
def compare_component_revisions(
    component_id: str,
    before: str = Query(...),
    after: str = Query(...),
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    _ = user
    try:
        return catalog_service.compare_component_revisions(component_id, before, after)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/revisions/{revision_id}")
def get_component_revision(
    component_id: str,
    revision_id: str,
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    _ = user
    revision = catalog_service.get_component_revision(component_id, revision_id)
    if not revision:
        raise HTTPException(status_code=404, detail="Component revision not found")
    return revision


@router.get("/components/{component_id}/audit")
def list_component_audit(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return {"items": catalog_service.list_component_audit_events(component_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/audit/verify")
def verify_component_audit(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return catalog_service.verify_component_audit_chain(component_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/usage")
def list_component_usage(
    component_id: str,
    mode: str = Query(default="current", pattern="^(current|history)$"),
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    try:
        visible_projects = {str(project["id"]) for project in workspace.get_all_projects(user.role)}
        items = catalog_service.list_component_usage(component_id, include_history=mode == "history")
        return {"items": [item for item in items if str(item.get("project_id") or "") in visible_projects]}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/reviews")
def list_component_reviews(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return {"items": catalog_service.list_component_review_decisions(component_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/components/{component_id}/releases")
def list_component_releases(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return {"items": catalog_service.list_component_release_records(component_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/previews/{preview_id}")
def get_catalog_preview(preview_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    preview = catalog_service.catalog_preview_path(preview_id)
    if not preview:
        raise HTTPException(status_code=404, detail="Preview not found")
    path, content_type = preview
    return FileResponse(path, media_type=content_type, headers={"Cache-Control": "private, max-age=300"})


@router.patch("/components/{component_id}")
def update_catalog_component(
    component_id: str,
    payload: UpdateComponentMetadataRequest,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    request_data = payload.model_dump()
    expected_revision_id = str(request_data.pop("expected_revision_id") or "")
    change_summary = str(request_data.pop("change_summary") or "Update component metadata")
    updates: dict[str, Any] = {
        key: value
        for key, value in request_data.items()
        if value is not None
    }
    try:
        component = catalog_service.update_component_metadata(
            component_id,
            updates,
            actor=user.email,
            change_summary=change_summary,
            expected_revision_id=expected_revision_id,
        )
    except ValueError as exc:
        status_code = 409 if "revision conflict" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.post("/components/{component_id}/symbol-import")
async def import_symbol_library(
    component_id: str,
    file: UploadFile = File(...),
    target_library: str = Form(default=""),
    selected_symbol: str = Form(default=""),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded symbol library was empty")

    try:
        return catalog_service.import_symbol_library(
            component_id,
            upload_name=file.filename or "uploaded.kicad_sym",
            payload=payload,
            target_library=target_library or component_id,
            selected_symbol=selected_symbol,
            actor=user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/components/{component_id}/footprint-import")
async def import_footprint(
    component_id: str,
    file: UploadFile = File(...),
    target_library: str = Form(default=""),
    selected_footprint: str = Form(default=""),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded footprint payload was empty")

    try:
        return catalog_service.import_footprint(
            component_id,
            upload_name=file.filename or "uploaded.kicad_mod",
            payload=payload,
            target_library=target_library or "Prism_Footprints",
            selected_footprint=selected_footprint,
            actor=user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/components/{component_id}/assets/{asset_type}")
async def import_auxiliary_asset(
    component_id: str,
    asset_type: str,
    file: UploadFile = File(...),
    target_library: str = Form(default=""),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded asset payload was empty")

    try:
        return catalog_service.attach_auxiliary_asset(
            component_id,
            asset_type=asset_type,
            upload_name=file.filename or f"{asset_type}.bin",
            payload=payload,
            target_library=target_library or "Prism_Assets",
            actor=user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/components/{component_id}/assets/{asset_type}")
def detach_component_asset(
    component_id: str,
    asset_type: str,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    try:
        return catalog_service.detach_asset(component_id, asset_type, actor=user.email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/components/{component_id}")
def delete_catalog_component(component_id: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    if not catalog_service.delete_component(component_id, actor=user.email):
        raise HTTPException(status_code=404, detail="Component not found")
    return {"ok": True}


@router.post("/components/{component_id}/release")
def transition_release_status(
    component_id: str,
    payload: ReleaseStatusRequest,
    user: AuthenticatedUser = Depends(require_catalog_reader),
):
    try:
        stage = payload.workflow_stage or payload.release_status
        next_stage = _normalize_workflow_stage(stage)
        component_before = catalog_service.get_component(component_id)
        if not component_before:
            raise HTTPException(status_code=404, detail="Component not found")
        current_stage = _normalize_workflow_stage(
            str(component_before.get("workflow_stage") or component_before.get("release_status") or "")
        )
        if not _can_transition_workflow(user, current_stage, next_stage):
            raise HTTPException(status_code=403, detail="Catalog workflow transition not allowed for this role")
        override_reason = payload.self_approval_override_reason.strip()
        if override_reason and user.role != "admin":
            raise HTTPException(status_code=403, detail="Only administrators may override two-person approval")
        component = catalog_service.set_release_status(
            component_id,
            stage,
            actor=user.email,
            self_approval_override_reason=override_reason,
            review_note=payload.review_note,
            actor_role=user.role,
            expected_revision_id=payload.expected_revision_id,
            expected_manifest_hash=payload.expected_manifest_hash,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.post("/components/{component_id}/previews/regenerate")
def regenerate_component_previews(component_id: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    try:
        component = catalog_service.regenerate_component_previews(component_id, actor=user.email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.post("/components/{component_id}/validate")
def validate_component_klc(component_id: str, user: AuthenticatedUser = Depends(require_catalog_writer)):
    _ = user
    job_id = _start_validation_job([component_id])
    return {"job_id": job_id, "status": "queued"}


@router.get("/components/{component_id}/validation")
def get_component_validation(component_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    try:
        return catalog_service.get_component_validation(component_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/validation/run")
def validate_catalog(user: AuthenticatedUser = Depends(require_catalog_writer)):
    _ = user
    job_id = _start_validation_job()
    return {"job_id": job_id, "status": "queued"}


@router.get("/validation/jobs/{job_id}")
def get_validation_job(job_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    job = workspace.get_job(job_id, "catalog_validation")
    if not job:
        raise HTTPException(status_code=404, detail="Validation job not found")
    return job


@router.get("/validation/runs/{run_id}")
def get_validation_run(run_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    run = catalog_service.get_validation_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")
    return run


@router.get("/validation/runs/{run_id}/{report_name}")
def get_validation_report(run_id: str, report_name: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    path = catalog_service.validation_report_path(run_id, report_name)
    if not path:
        raise HTTPException(status_code=404, detail="Validation report not found")
    media_type = "application/json" if report_name.endswith(".json") else "application/xml" if report_name.endswith(".xml") else "text/plain"
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.post("/previews/generate-missing")
def generate_missing_previews(user: AuthenticatedUser = Depends(require_catalog_writer)):
    _ = user
    job_id = _start_preview_job()
    return {"job_id": job_id, "status": "queued"}


@router.get("/previews/jobs/{job_id}")
def get_preview_job(job_id: str, user: AuthenticatedUser = Depends(require_catalog_reader)):
    _ = user
    job = workspace.get_job(job_id, "catalog_preview_generation")
    if not job:
        raise HTTPException(status_code=404, detail="Preview generation job not found")
    return job


@router.post("/exports/kicad-dbl")
def export_kicad_dbl_bundle(user: AuthenticatedUser = Depends(require_catalog_writer)):
    _ = user
    try:
        return catalog_service.export_kicad_dbl_bundle()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ─── Phase 2: CSV Import Routes ──────────────────────────────────────────────

@router.post("/components/import-csv")
async def import_metadata_csv(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _ = user
    content = await file.read()
    try:
        csv_str = content.decode("utf-8")
        return catalog_service.import_metadata_csv(csv_str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stock/sync-csv")
async def import_stock_csv(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _ = user
    content = await file.read()
    try:
        csv_str = content.decode("utf-8")
        return catalog_service.import_stock_csv(csv_str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ─── Phase 2: Asset Browsing/Linking Routes ──────────────────────────────────

@router.get("/assets/browse")
def browse_library_assets(
    asset_type: str = Query(...),
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _ = user
    try:
        files = catalog_service.browse_library_assets(asset_type)
        return {"files": files}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class LinkAssetRequest(BaseModel):
    file_path: str
    target_library: str = ""
    target_name: str = ""


@router.post("/components/{component_id}/assets/{asset_type}/link")
def link_library_asset(
    component_id: str,
    asset_type: str,
    payload: LinkAssetRequest,
    user: AuthenticatedUser = Depends(require_catalog_writer),
):
    _ = user
    try:
        return catalog_service.link_library_asset(
            component_id,
            asset_type,
            file_path_rel=payload.file_path,
            target_library=payload.target_library,
            target_name=payload.target_name,
            actor=user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
