"""Response models for the project read routes of ``app/api/projects.py``.

MCP-06a types the success responses these routes already return. Every model
allows extra keys, so a field added by a service still reaches the client; the
handlers keep returning their plain dictionaries.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.services import path_config_service, project_service


class MonorepoFolder(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    name: str
    path: str
    item_count: int


class MonorepoProject(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str
    display_name: Optional[str]
    relative_path: str
    has_thumbnail: bool
    last_modified: str


class MonorepoStructure(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    repo_name: str
    current_path: str
    folders: List[MonorepoFolder]
    projects: List[MonorepoProject]


class ProjectSearchHit(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str
    description: str
    parent_repo: Optional[str]
    sub_path: Optional[str]
    last_modified: str
    last_synced_at: Optional[str]
    thumbnail_url: Optional[str]


class ProjectSearchResults(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    results: List[ProjectSearchHit]


class ProjectBranch(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    name: str
    ref: str
    source: str
    is_current: bool
    hash: str
    commit: str
    author: str
    email: str
    date: str
    message: str


class ProjectBranches(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    branches: List[ProjectBranch]
    current_branch: Optional[str]
    default_ref: Optional[str]


class ProjectReadme(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    content: str


class DocFileContent(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    content: str
    path: str


class ProjectRelease(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    tag: str
    commit_hash: str
    full_hash: str
    date: str
    message: str
    # Only a Type-2 page counts the subproject's files a tag changed.
    subproject_files_changed: Optional[int] = None


class ProjectReleases(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    releases: List[ProjectRelease]
    total: Optional[int]
    has_more: bool
    limit: int
    offset: int
    resolved_ref_sha: Optional[str] = None


class CommitKicadChanges(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    sch: int
    pcb: int
    pro: int
    other: int


class ProjectCommit(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    hash: str
    full_hash: str
    author: str
    email: str
    date: str
    message: str
    kicad_changes: CommitKicadChanges


class ProjectCommits(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    commits: List[ProjectCommit]
    total: Optional[int]
    has_more: bool
    limit: int
    offset: int
    resolved_ref_sha: str
    head: Optional[str]


class CommitDistance(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    commits_behind: int


class CommitFileChange(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    path: str
    filename: str
    status: str
    additions: Optional[int]
    deletions: Optional[int]


class ProjectCommitSummary(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    files: List[CommitFileChange]
    base_commit: Optional[str]
    compare_commit: str
    parent_count: int
    comparison_basis: str


class ProjectPathConfig(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    config: path_config_service.PathConfig
    resolved: path_config_service.ResolvedPaths
    source: str


class ProjectName(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    display_name: Optional[str]
    fallback_name: str


class ProjectDescription(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    description: str


class ProjectOverview(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    project: project_service.Project
    readme: Optional[str]


__all__ = [
    "CommitDistance",
    "CommitFileChange",
    "CommitKicadChanges",
    "DocFileContent",
    "MonorepoFolder",
    "MonorepoProject",
    "MonorepoStructure",
    "ProjectBranch",
    "ProjectBranches",
    "ProjectCommit",
    "ProjectCommitSummary",
    "ProjectCommits",
    "ProjectDescription",
    "ProjectName",
    "ProjectOverview",
    "ProjectPathConfig",
    "ProjectReadme",
    "ProjectRelease",
    "ProjectReleases",
    "ProjectSearchHit",
    "ProjectSearchResults",
]
