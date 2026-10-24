"""A project's output folders and its files at a commit.

The project routes, the viewer sources and the fabrication viewer all read a
project's design and manufacturing outputs, from the working tree or at a
commit. This module says where those folders are and reads a file or a listing
out of one at a commit; ``project_revision`` decides where the project sits in
its repository. Refusals are typed (``app.core.errors``).
"""

from __future__ import annotations

import posixpath
from pathlib import Path
from typing import List, Optional

from app.core import errors
from app.services import file_service, project_revision, project_service
from app.services.path_config_service import PathConfig
from app.services.project_history_scope import ProjectHistory, project_history
from app.services.workspace_service import workspace


def project_location(project: project_service.Project) -> project_revision.ProjectLocation:
    """Where the project sits in its repository (``project_revision`` decides).

    A project whose checkout is missing keeps its own path as the root, so the
    Git read that follows reports the missing commit or file as before.
    """
    try:
        return project_revision.locate(project)
    except project_revision.ProjectNotInRepository:
        return project_revision.ProjectLocation(
            Path(project.path), "", project_service.project_anchor(project)
        )


def repo_context(project: project_service.Project) -> tuple[str, Optional[str]]:
    """Repository root and subproject path for project-scoped git operations."""
    location = project_location(project)
    return str(location.repo_root), location.sub_path


def history_context(project: project_service.Project) -> tuple[str, ProjectHistory]:
    """Repository root and what decides the project's commit history (issue #681)."""
    location = project_location(project)
    row = workspace.get_project_by_id(project.id) or {}
    rows = workspace.get_projects_by_repo(str(row["repo_id"])) if row.get("repo_id") else []
    return str(location.repo_root), project_history(location.relative_path, location.anchor, project.id, rows)


def output_dir(project: project_service.Project, output_type: str) -> str:
    """The working tree's ``design`` or ``manufacturing`` outputs folder."""
    resolved = project_service.resolved_paths_for(project)
    found = (
        resolved.design_outputs_dir
        if output_type == "design"
        else resolved.manufacturing_outputs_dir
    )
    if not found:
        raise errors.NotFound(f"{output_type} outputs folder not configured")
    return found


def path_config_at(project: project_service.Project, commit: Optional[str]) -> PathConfig:
    """The project's path settings at ``commit``, or the working tree's without one."""
    if not commit:
        return project_service.path_config_for(project)
    try:
        return project_revision.path_config_at(project_location(project), commit)
    except project_revision.RevisionNotFound as error:
        raise errors.NotFound(f"Commit not found: {commit}") from error
    except ValueError as error:
        raise errors.caller_error(error, 500) from error


def output_dir_in(config: PathConfig, output_type: str) -> str:
    """The ``design`` or ``manufacturing`` outputs folder named by ``config``."""
    found = config.designOutputs if output_type == "design" else config.manufacturingOutputs
    if not found:
        raise errors.NotFound(f"{output_type} outputs folder not configured")
    return found


def join_relative_paths(*parts: Optional[str]) -> str:
    """Join repository-relative parts, refusing any that would leave the repository."""
    cleaned = []
    for part in parts:
        if not part:
            continue
        normalized = posixpath.normpath(str(part).replace("\\", "/"))
        if normalized in ("", "."):
            continue
        if normalized.startswith("/") or normalized == ".." or normalized.startswith("../"):
            raise errors.BadRequest("Invalid file path")
        cleaned.append(normalized)
    return posixpath.join(*cleaned) if cleaned else ""


def read_commit_file(
    project: project_service.Project,
    commit: str,
    file_path: str,
    *,
    relative_prefix: Optional[str] = None,
    not_found_detail: str = "File not found",
) -> file_service.CommitFile:
    """One file at ``commit``, ``file_path`` relative to ``relative_prefix`` in the project."""
    repo_path, sub_path = repo_context(project)
    prefix = sub_path
    if relative_prefix:
        prefix = join_relative_paths(prefix, relative_prefix)

    return file_service.read_file_from_commit(
        repo_path,
        commit,
        file_path,
        relative_prefix=prefix,
        not_found_detail=not_found_detail,
    )


def list_commit_files(
    project: project_service.Project,
    commit: str,
    directory_path: str,
) -> List[file_service.FileItem]:
    """The files under ``directory_path`` (relative to the project) at ``commit``."""
    repo_path, sub_path = repo_context(project)
    return file_service.get_files_from_commit(
        repo_path,
        commit,
        directory_path,
        relative_prefix=sub_path,
    )
