"""Project properties routes of /api/projects (split out of projects.py by WP-S1)."""
import asyncio
import logging
from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api._helpers import get_project_for_role_or_404
from app.api.projects import _load_project_readme_content, _repo_context
from app.core.security import AuthenticatedUser, require_viewer
from app.services import project_import_service, project_metadata_service, project_service

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_viewer)])


class ProjectPropertiesTitleBlock(BaseModel):
    # KiCad's title block also carries rev, company and numbered comments.
    # Prism parsed all of them and rendered none; narrowed to what the
    # properties panel displays.
    title: str = ""
    date: str = ""


class ProjectPropertiesSchematicFile(BaseModel):
    path: str
    filename: str
    version: Optional[int] = None
    generator: Optional[str] = None
    generator_version: Optional[str] = None
    title_block: Optional[ProjectPropertiesTitleBlock] = None


class ProjectPropertiesPcbFile(BaseModel):
    path: str
    filename: str
    version: Optional[int] = None
    generator: Optional[str] = None
    generator_version: Optional[str] = None
    dimensions_mm: Optional[Dict[str, float]] = None
    thickness_mm: Optional[float] = None
    title_block: Optional[ProjectPropertiesTitleBlock] = None


class ProjectPropertiesLatestCommit(BaseModel):
    hash: str
    full_hash: str
    author: str
    email: str
    date: str
    message: str


class ProjectPropertiesTag(BaseModel):
    tag: str
    commit_hash: str
    date: str
    message: str


class ProjectPropertiesRepository(BaseModel):
    latest_commit: Optional[ProjectPropertiesLatestCommit] = None
    latest_tag: Optional[ProjectPropertiesTag] = None


class ProjectPropertiesFiles(BaseModel):
    schematic: Optional[ProjectPropertiesSchematicFile] = None
    pcb: Optional[ProjectPropertiesPcbFile] = None


class ProjectPropertiesResponse(BaseModel):
    project: project_service.Project
    repository: ProjectPropertiesRepository
    files: ProjectPropertiesFiles


@router.get("/{project_id}/properties", response_model=ProjectPropertiesResponse)
async def get_project_properties(project_id: str, user: AuthenticatedUser = Depends(require_viewer)):
    project = get_project_for_role_or_404(project_id, user.role)
    return await asyncio.to_thread(_build_project_properties, project)


def _stored_project_metadata(
    project: project_service.Project,
) -> tuple[Optional[dict], Optional[dict], Optional[dict]]:
    """Read the project's stored KiCad metadata, refreshing it out of band.

    This used to derive both dictionaries inline, which meant reading and
    scanning the schematic and the board on every open of the workspace preview
    panel. On a 57 MB design that scan pinned a core for minutes and, being
    pure Python, starved the event loop serving every other request -- which is
    what made opening a large project take tens of seconds.

    The facts change only when the files change, so the import and sync jobs
    compute them and this reads the row. A project imported before the table
    existed, or one whose files moved without a sync, has its refresh queued
    here and returns what is stored meanwhile. That is a card with some blank
    fields for one job's duration, never a request that blocks on kicad-cli.
    """
    anchor = project_service.project_anchor(project)
    repo_path, _relative_path = _repo_context(project)

    record, current = project_metadata_service.stored_metadata_is_current(
        project.id, project.path, anchor, repo_path
    )
    if not current:
        try:
            project_import_service.start_project_metadata_job(
                project.id, requested_by="project-properties"
            )
        except Exception as error:
            # The queue being unavailable must not take the panel down with it;
            # the card simply keeps whatever was last stored.
            logger.warning(
                "Could not queue metadata refresh for %s: %s", project.id, error
            )

    if not record:
        return None, None, None
    return record.get("schematic"), record.get("pcb"), record.get("repository")


def _build_project_properties(project: project_service.Project) -> ProjectPropertiesResponse:
    schematic_metadata, pcb_metadata, repository = _stored_project_metadata(project)
    repository = repository or {}
    latest_commit = repository.get("latest_commit")
    latest_tag = repository.get("latest_tag")

    return ProjectPropertiesResponse(
        project=project,
        repository=ProjectPropertiesRepository(
            latest_commit=(
                ProjectPropertiesLatestCommit(**latest_commit)
                if latest_commit
                else None
            ),
            latest_tag=(
                ProjectPropertiesTag(**latest_tag)
                if latest_tag
                else None
            ),
        ),
        files=ProjectPropertiesFiles(
            schematic=(
                ProjectPropertiesSchematicFile(**schematic_metadata)
                if schematic_metadata
                else None
            ),
            pcb=(
                ProjectPropertiesPcbFile(**pcb_metadata)
                if pcb_metadata
                else None
            ),
        ),
    )


@router.get("/{project_id}/overview")
async def get_project_overview(
    project_id: str,
    commit: str = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """
    Return project detail and README content in one payload for the overview page.
    """
    project = get_project_for_role_or_404(project_id, user.role)
    return {
        "project": project.model_dump(),
        "readme": _load_project_readme_content(project, commit),
    }
