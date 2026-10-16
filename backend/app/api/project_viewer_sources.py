"""Viewer source routes of /api/projects (split out of projects.py by WP-S1)."""

import json
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.api._helpers import get_project_for_role_or_404
from app.api.projects import (
    ARCHIVE_DIR_NAMES,
    COMMIT_FILE_STREAM_BYTES,
    _commit_file_response,
    _files_from_commit,
    _join_relative_paths,
    _output_dir_from_config,
    _path_config_from_commit,
    _read_commit_file,
    _repo_context,
)
from app.core.security import AuthenticatedUser, require_viewer
from app.services import (
    file_service,
    path_config_service,
    project_service,
    project_viewer_sources_bundle as viewer_sources_bundle,
    semantic_visualizer_service,
)
from app.services.design_bundle.consumer import bundle_read
from app.services.path_config_service import PathConfig

router = APIRouter(dependencies=[Depends(require_viewer)])


def _project_metadata_bundle(
    project_id: str, commit: Optional[str], requested_by: str
) -> Optional[viewer_sources_bundle.BundleRead]:
    """The PROJECT_METADATA bundle for a revision, or ``None`` to serve legacy (ADR §8).

    ``bundle_read`` owns the switch and the rollout fallback: it returns ``None``
    when ``PRISM_DESIGN_SOURCE_PROJECT_METADATA`` is ``legacy``, when a needed
    member is not ready yet (it queues the ``design_bundle`` job) or when a member
    failed. The projection is requested up front because the mapping needs it to
    name the sources; the effective configuration is read from the same opening.

    A request without a commit is the working tree, which a bundle (keyed by a
    commit's sources) cannot represent when it holds uncommitted changes, so it
    always takes the legacy path.
    """

    if not commit:
        return None
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
        self.content = source.content
        self._cached = cached

    @property
    def size(self) -> int:
        return len(self.content)

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

    cached = None
    if len(source.content) > COMMIT_FILE_STREAM_BYTES:
        member = f"sources/{source.repo_path}"
        cached = read.extract([member]) / member
    return _commit_file_response(_BundleCommitFile(source, cached), inline=inline, headers=headers)


def _worksheet_path_key(path: str | Path) -> tuple[int, int, str]:
    normalized = str(path).replace("\\", "/")
    parts = [part.casefold() for part in normalized.split("/")]
    archived = int(any(part in ARCHIVE_DIR_NAMES for part in parts))
    return archived, len(parts), normalized.casefold()


def _anchored_commit_path(
    project: project_service.Project,
    paths: List[str],
    suffix: str,
) -> Optional[str]:
    """Select this project's root file from a commit listing.

    The default schematic/PCB globs are shared by every project in the
    directory. Once a project has an anchor, falling back to the first match is
    the same identity bug as ignoring the anchor altogether. Legacy rows have
    no anchor and retain the deterministic first-match behaviour.
    """
    if not paths:
        return None
    anchor = project_service.project_anchor(project)
    if not anchor:
        return paths[0]
    expected = Path(anchor).with_suffix(suffix).name
    return next((path for path in paths if path == expected), None)


def _sibling_root_schematic_names(
    project: project_service.Project, project_paths: List[str]
) -> set[str]:
    """Root schematics owned by the other anchored projects in this directory."""
    anchor = project_service.project_anchor(project)
    if not anchor:
        return set()
    own_project = Path(anchor).name
    return {
        Path(path).with_suffix(".kicad_sch").name
        for path in project_paths
        if Path(path).name != own_project
    }


def _read_configured_commit_file(
    project: project_service.Project,
    commit: str,
    configured_path: Optional[str],
    *,
    not_found_detail: str,
) -> file_service.CommitFile:
    path = configured_path or ""
    if not path:
        raise HTTPException(status_code=404, detail=not_found_detail)

    if "*" not in path:
        return _read_commit_file(project, commit, path, not_found_detail=not_found_detail)

    repo_path, sub_path = _repo_context(project)
    matches = file_service.find_files_in_commit(repo_path, commit, path, relative_prefix=sub_path)
    if not matches:
        raise HTTPException(status_code=404, detail=not_found_detail)
    selected = matches[0]
    default_suffix = {
        path_config_service.DEFAULT_PATHS["schematic"]: ".kicad_sch",
        path_config_service.DEFAULT_PATHS["pcb"]: ".kicad_pcb",
    }.get(path)
    if default_suffix:
        selected = _anchored_commit_path(project, matches, default_suffix)
        if selected is None:
            raise HTTPException(status_code=404, detail=not_found_detail)
    return _read_commit_file(project, commit, selected, not_found_detail=not_found_detail)


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
    project = get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    if read is not None:
        source = viewer_sources_bundle.schematic(read)
        if source is not None:
            return _bundle_commit_response(read, source, inline=True)

    if commit:
        config = _path_config_from_commit(project, commit)
        commit_file = _read_configured_commit_file(
            project,
            commit,
            config.schematic or "*.kicad_sch",
            not_found_detail="Schematic not found",
        )
        return _commit_file_response(commit_file, inline=True)

    path = project_service.find_schematic_file(
        project.path, project_service.project_anchor(project)
    )
    if not path:
        raise HTTPException(status_code=404, detail="Schematic not found")
    return FileResponse(path)

@router.get("/{project_id}/schematic/subsheets")
async def get_project_subsheets(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    if read is not None:
        files = viewer_sources_bundle.subsheets(read, project_id, commit)
        if files is not None:
            return {"files": files}

    if commit:
        config = _path_config_from_commit(project, commit)
        main_schematic = _read_configured_commit_file(
            project,
            commit,
            config.schematic or "*.kicad_sch",
            not_found_detail="Schematic not found",
        )
        repo_path, sub_path = _repo_context(project)
        sibling_roots = _sibling_root_schematic_names(
            project,
            file_service.find_files_in_commit(
                repo_path,
                commit,
                "*.kicad_pro",
                relative_prefix=sub_path,
            ),
        )
        root_sheets = [
            path for path in file_service.find_files_in_commit(
                repo_path,
                commit,
                "*.kicad_sch",
                relative_prefix=sub_path,
            )
            if path != main_schematic.path and path not in sibling_roots
        ]
        subsheets_dir = config.subsheets or "Subsheets"
        nested_sheets = [
            _join_relative_paths(subsheets_dir, item.path)
            for item in _files_from_commit(project, commit, subsheets_dir)
            if not item.is_dir and item.name.endswith(".kicad_sch")
        ]
        subsheets = sorted({*root_sheets, *nested_sheets})
        subsheet_urls = [
            {
                "name": sheet,
                "url": f"/api/projects/{quote(project_id, safe='')}/asset/{quote(sheet, safe='/')}?commit={quote(commit, safe='')}",
            }
            for sheet in subsheets
        ]
        return {"files": subsheet_urls}

    main_path = project_service.find_schematic_file(
        project.path, project_service.project_anchor(project)
    )
    if not main_path:
        raise HTTPException(status_code=404, detail="Schematic not found")

    subsheets = sorted(project_service.get_subsheets(project.path, main_path))
    # Convert filenames to URLs
    subsheet_urls = [{"name": s, "url": f"/api/projects/{project_id}/asset/{s}"} for s in subsheets]
    return {"files": subsheet_urls}


@router.get("/{project_id}/viewer/support-files")
async def get_project_viewer_support_files(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Return the small project/worksheet sources required by ecad-viewer.

    These are identity and presentation inputs, not generated semantic assets.
    Both the schematic and the board viewer need them, so they are served once
    here rather than with each document. The host loads them together with the
    document: the viewer does not repaint a sheet when they arrive afterwards.
    """
    project = get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    if read is not None:
        files = viewer_sources_bundle.support_files(read)
        if files is not None:
            return {"files": files}

    if commit:
        repo_path, sub_path = _repo_context(project)
        pro_paths = file_service.find_files_in_commit(
            repo_path, commit, "*.kicad_pro", relative_prefix=sub_path
        )
        if not pro_paths:
            return {"files": []}
        pro_path = _anchored_commit_path(project, pro_paths, ".kicad_pro")
        if pro_path is None:
            return {"files": []}
        pro_file = _read_commit_file(project, commit, pro_path)
        files = [
            {
                "filename": Path(pro_path).name,
                "content": pro_file.content.decode("utf-8"),
            }
        ]
        try:
            settings = json.loads(pro_file.content.decode("utf-8"))
            configured = str(
                settings.get("schematic", {}).get("page_layout_descr_file", "")
                or settings.get("pcbnew", {}).get("page_layout_descr_file", "")
            )
        except (UnicodeDecodeError, json.JSONDecodeError):
            configured = ""
        worksheet_name = Path(configured.replace("kicad-embed://", "")).name
        if worksheet_name:
            worksheet_paths = file_service.find_files_in_commit(
                repo_path, commit, "*.kicad_wks", relative_prefix=sub_path
            )
            worksheet_path = next(
                iter(
                    sorted(
                        (
                            path
                            for path in worksheet_paths
                            if Path(path).name == worksheet_name
                        ),
                        key=_worksheet_path_key,
                    )
                ),
                None,
            )
            if worksheet_path:
                worksheet = _read_commit_file(project, commit, worksheet_path)
                files.append(
                    {
                        "filename": worksheet_path,
                        "content": worksheet.content.decode("utf-8"),
                    }
                )
        return {"files": files}

    project_file = semantic_visualizer_service.find_kicad_project(
        project.path, project_service.project_anchor(project)
    )
    files = [
        {
            "filename": project_file.name,
            "content": project_file.read_text(encoding="utf-8"),
        }
    ]
    try:
        settings = json.loads(files[0]["content"])
        configured = str(
            settings.get("schematic", {}).get("page_layout_descr_file", "")
            or settings.get("pcbnew", {}).get("page_layout_descr_file", "")
        )
    except json.JSONDecodeError:
        configured = ""
    worksheet_name = Path(configured.replace("kicad-embed://", "")).name
    if worksheet_name:
        worksheet = next(
            iter(
                sorted(
                    (
                        path
                        for path in Path(project.path).rglob(worksheet_name)
                        if path.is_file()
                    ),
                    key=_worksheet_path_key,
                )
            ),
            None,
        )
        if worksheet:
            files.append(
                {
                    "filename": worksheet.relative_to(project.path).as_posix(),
                    "content": worksheet.read_text(encoding="utf-8"),
                }
            )
    return {"files": files}

@router.get("/{project_id}/pcb")
async def get_project_pcb(
    project_id: str,
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    project = get_project_for_role_or_404(project_id, user.role)

    read = _project_metadata_bundle(project_id, commit, user.email)
    if read is not None:
        source = viewer_sources_bundle.pcb(read)
        if source is not None:
            return _bundle_commit_response(read, source, inline=True)

    if commit:
        config = _path_config_from_commit(project, commit)
        commit_file = _read_configured_commit_file(
            project,
            commit,
            config.pcb or "*.kicad_pcb",
            not_found_detail="PCB not found",
        )
        return _commit_file_response(commit_file, inline=True)

    path = project_service.find_pcb_file(
        project.path, project_service.project_anchor(project)
    )
    if not path:
        raise HTTPException(status_code=404, detail="PCB not found")
    return FileResponse(path)

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
