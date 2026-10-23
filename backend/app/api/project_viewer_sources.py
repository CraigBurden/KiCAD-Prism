"""Viewer source routes of /api/projects (split out of projects.py by WP-S1)."""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse

from app.api._blocking import run_bounded_io
from app.api._helpers import get_project_for_role_or_404
from app.api.projects import (
    COMMIT_FILE_STREAM_BYTES,
    _commit_file_response,
    _files_from_commit,
    _output_dir_from_config,
    _path_config_from_commit,
    _read_commit_file,
)
from app.core.security import AuthenticatedUser, require_viewer
from app.services import (
    file_service,
    project_service,
    project_viewer_sources_bundle as viewer_sources_bundle,
)
from app.services.design_bundle.consumer import bundle_read
from app.services.path_config_service import PathConfig

router = APIRouter(dependencies=[Depends(require_viewer)])


def _project_metadata_bundle(
    project_id: str, commit: Optional[str], requested_by: str
) -> viewer_sources_bundle.BundleRead:
    """The PROJECT_METADATA bundle for a revision (ADR §8, §9.7 R1).

    ``bundle_read`` names the checkout's HEAD when the request has no commit
    and raises ``DesignDataPending`` while a member builds (it queues the
    ``design_bundle`` job) or ``DesignDataFailed`` when it cannot be built; the
    API renders both the same way for every route. The projection is requested
    up front because the mapping needs it to name the sources.
    """

    return bundle_read(
        "PROJECT_METADATA",
        project_id,
        commit,
        [viewer_sources_bundle.PROJECT_JSON],
        requested_by=requested_by,
    )


class _BundleCommitFile:
    """A ``sources/`` member in the shape ``_commit_file_response`` reads from a commit.

    ``_commit_file_response`` streams a member over ``COMMIT_FILE_STREAM_BYTES``
    from ``cached_path()``. The bundle reader has already verified a member's
    bytes, so a large one is handed over as its extracted copy; nothing here
    re-reads Git.
    """

    def __init__(self, source: viewer_sources_bundle.SourceFile, cached: Optional[Path] = None) -> None:
        self.name = source.name
        self.path = source.repo_path
        self.size = source.size
        self._source = source
        self._cached = cached

    @property
    def content(self) -> bytes:
        # Read only for a file served inline; a large one is served from ``cached``.
        return self._source.content

    def cached_path(self) -> Path:
        if self._cached is None:
            raise HTTPException(status_code=500, detail="Git error: could not read the file")
        return self._cached


def _bundle_commit_response(
    read: viewer_sources_bundle.BundleRead,
    source: viewer_sources_bundle.SourceFile,
    *,
    inline: bool = True,
    headers: Optional[dict[str, str]] = None,
):
    """Serve a bundle source member exactly like the legacy commit response."""

    merged = {**read.response_headers(), **(headers or {})}
    cached = None
    if source.size > COMMIT_FILE_STREAM_BYTES:
        member = f"sources/{source.repo_path}"
        cached = read.extract([member]) / member
    return _commit_file_response(_BundleCommitFile(source, cached), inline=inline, headers=merged or None)


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=404, detail=detail)


def _find_commit_3d_model(
    project: project_service.Project,
    commit: str,
    config: PathConfig,
) -> file_service.CommitFile:
    design_dir = _output_dir_from_config(config, "design")
    files = _files_from_commit(project, commit, design_dir)

    model_files = [
        item for item in files
        if not item.is_dir and item.name.lower().endswith((".glb", ".step", ".stp"))
    ]
    selected = next((item for item in model_files if item.path.lower().startswith("3dmodel/")), None)
    if selected is None:
        selected = next((item for item in model_files if "/" not in item.path), None)
    if selected is None:
        raise HTTPException(status_code=404, detail="3D model not found")

    return _read_commit_file(
        project,
        commit,
        selected.path,
        relative_prefix=design_dir,
        not_found_detail="3D model not found",
    )


@router.get("/{project_id}/schematic")
async def get_project_schematic(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    return await run_bounded_io(_schematic_response, project_id, commit, user)


def _schematic_response(
    project_id: str, commit: Optional[str], user: AuthenticatedUser
):
    get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    source = viewer_sources_bundle.schematic(read)
    if source is None:
        raise _not_found("Schematic not found")
    return _bundle_commit_response(read, source, inline=True)


@router.get("/{project_id}/schematic/subsheets")
async def get_project_subsheets(
    project_id: str,
    response: Response,
    commit: Optional[str] = None,
    include: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    return await run_bounded_io(_subsheets_response, project_id, commit, include, user, response)


def _subsheets_response(
    project_id: str,
    commit: Optional[str],
    include: Optional[str],
    user: AuthenticatedUser,
    response: Response,
):
    get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    files = viewer_sources_bundle.subsheets(
        read, project_id, commit, include_content=include == "content"
    )
    if files is None:
        raise _not_found("Schematic not found")
    for name, value in read.response_headers().items():
        response.headers[name] = value
    return {"files": files}


@router.get("/{project_id}/viewer/support-files")
async def get_project_viewer_support_files(
    project_id: str,
    response: Response,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Return the small project/worksheet sources required by ecad-viewer.

    These are identity and presentation inputs, not generated semantic assets.
    Both the schematic and the board viewer need them, so they are served once
    here rather than with each document. The host loads them together with the
    document: the viewer does not repaint a sheet when they arrive afterwards.
    """
    return await run_bounded_io(_support_files_response, project_id, commit, user, response)


def _support_files_response(
    project_id: str, commit: Optional[str], user: AuthenticatedUser, response: Response
):
    get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    files = viewer_sources_bundle.support_files(read)
    if files is None:
        raise _not_found("Project file not found")
    for name, value in read.response_headers().items():
        response.headers[name] = value
    return {"files": files}


@router.get("/{project_id}/pcb")
async def get_project_pcb(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    return await run_bounded_io(_pcb_response, project_id, commit, user)


def _pcb_response(project_id: str, commit: Optional[str], user: AuthenticatedUser):
    get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    source = viewer_sources_bundle.pcb(read)
    if source is None:
        raise _not_found("PCB not found")
    return _bundle_commit_response(read, source, inline=True)


# The bundle does not carry the file this route serves: today it picks a
# committed design-output model (``Design-Outputs/*.glb|.step|.stp``), and output
# directories are excluded from the revision key and so from ``sources/``
# (ADR §5; bundle-format.md §2.2). A bundle's ``model-3d`` references are the
# board's own footprint models, different files with different bytes, so serving
# one here would change the response. The legacy lookup stays until a bundle
# member for the design-output model exists; it is not approximated.
@router.get("/{project_id}/3d-model")
async def get_project_3d_model(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    return await run_bounded_io(_3d_model_response, project_id, commit, user)


def _3d_model_response(project_id: str, commit: Optional[str], user: AuthenticatedUser):
    project = get_project_for_role_or_404(project_id, user.role)

    if commit:
        config = _path_config_from_commit(project, commit)
        commit_file = _find_commit_3d_model(project, commit, config)
        return _commit_file_response(
            commit_file,
            inline=True,
            headers={"Cache-Control": "public, max-age=300"},
        )

    path = project_service.find_3d_model(project.path)
    if not path:
        raise HTTPException(status_code=404, detail="3D model not found")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=300"})
