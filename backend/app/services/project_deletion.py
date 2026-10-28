"""Delete a project: its workspace rows, comments and, when unshared, its clone.

Authorization is the caller's job (the route decides who may delete and
whether signed release records may be forced away). This module owns what a
deletion removes, in order, and which failures still count as a deletion.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from app.services import project_service
from app.services.comments_store_service import comments_store
from app.services.workspace_service import workspace


@dataclass
class ProjectDeletion:
    removed_files: bool = False
    repository_deleted: bool = False
    warnings: List[str] = field(default_factory=list)


def delete_project(project_id: str, *, force: bool) -> Optional[ProjectDeletion]:
    """Remove a project; ``None`` when it does not exist.

    Raises ``ProjectHasSignedReleasesError`` when signed release records exist
    and ``force`` is false. The clone is removed only when no other project
    still lives in the repository (a single-project repository always), and
    only when it sits strictly inside ``PROJECTS_ROOT``.
    """

    row = workspace.get_project_by_id(project_id)
    if not row:
        return None

    repo_id = row.get("repo_id")
    import_type = row.get("import_type") or "single"
    clone_path = row.get("parent_repo_path") or row.get("path")
    if not workspace.delete_project(project_id, force=force):
        return None

    remaining_projects = workspace.get_projects_by_repo(repo_id) if repo_id else []
    result = ProjectDeletion(repository_deleted=import_type == "single" or not remaining_projects)

    try:
        comments_store.delete_project_comments(project_id)
    except Exception as exc:
        result.warnings.append(
            f"Project was removed from the workspace, but comments could not be deleted: {exc}"
        )

    if result.repository_deleted and repo_id:
        workspace.delete_repository(repo_id)
        try:
            projects_root = Path(project_service.PROJECTS_ROOT).resolve()
            target = Path(str(clone_path or "")).resolve()
            if target != projects_root and projects_root in target.parents and target.exists():
                shutil.rmtree(target)
                result.removed_files = True
        except Exception as exc:
            result.warnings.append(
                f"Project was removed from the workspace, but files could not be deleted: {exc}"
            )
    return result
