"""The viewer-source routes' bundle mapping (WP-C8b, ADR §8 ``PROJECT_METADATA``).

The viewer-source routes serve a revision's design files from the bundle of
that revision instead of a checkout or a Git read. This module is the whole
mapping: given the ``BundleRead`` a route opened through
``design_bundle.consumer.bundle_read``, each function answers one route from two
members.

The two members are:

- the effective configuration recorded in ``bundle.json``
  (``config.project_file``, ``root_schematic``, ``board``), which names a
  project's files by its anchor and never by its directory (issue #681);
- ``projections/project.json``, whose ``documents`` are each schematic file of
  the hierarchy and the board and whose ``references`` carry the resolved
  ``drawing-sheet`` paths (field-maps/project.md).

Every file is a source member ``sources/<RepoPath>`` (bundle-format.md §2.2).
Nothing here opens a bundle, reads a ``.kicad_pro`` or scans a directory: the
route calls ``bundle_read`` once and passes its result in. ``None`` means the
bundle provably has no answer for this project (for example a legacy row with
no anchor), and the route answers 404 rather than approximating.
"""

from __future__ import annotations

import functools
import posixpath
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib.parse import quote

from app.services.design_bundle.consumer import BundleRead

#: The member that holds the project's documents and references (P4).
PROJECT_JSON = "projections/project.json"
_SOURCE_PREFIX = "sources/"
#: The ``drawing-sheet`` settings, in the precedence today's route reads them.
_SHEET_FIELDS = ("/schematic/page_layout_descr_file", "/pcbnew/page_layout_descr_file")
#: The most sheet text one ``subsheets`` answer inlines (``include=content``).
#: A larger hierarchy leaves the sheets past it to per-file reads, so one
#: response never grows without bound.
MAX_INLINE_SUBSHEET_CONTENT_BYTES = 64 * 1024 * 1024


class SourceFile:
    """One ready ``sources/`` member: its name, repository path, size and SHA-256.

    Its bytes are read only when ``content`` is first asked for: a route serves
    a large file from the extracted version directory instead, and never holds
    it whole in memory.
    """

    def __init__(self, name: str, repo_path: str, size: int, sha256: str, load: Callable[[], bytes]) -> None:
        self.name = name
        self.repo_path = repo_path
        self.size = size
        self.sha256 = sha256
        self._load = load

    @functools.cached_property
    def content(self) -> bytes:
        return self._load()


def _extended(read: BundleRead, paths: list[str]) -> BundleRead:
    """``read`` with readiness answers for ``paths`` too.

    ``bundle_read`` is called with the fixed projection path *before* the mapping
    knows which sources the route needs, because the effective configuration
    lives inside the bundle. The extra answers come from the same open archive,
    so a route can still gate each source through :meth:`BundleRead.ready`.
    """

    states: dict[str, Any] = dict(read.states)
    states.update(read.opened.readiness(paths))
    return BundleRead(read.opened, states)


def effective_config(read: BundleRead) -> Mapping[str, Any] | None:
    """The effective configuration ``bundle.json`` records, or ``None``.

    It is not a member a reader names (``bundle.json`` lists the members, it is
    not one), so it is read from the opened archive's manifest — the same value
    the revision key and the build used.
    """

    archive = read.opened.archive
    if archive is None:
        return None
    value = archive.manifest.get("config")
    return value if isinstance(value, dict) else None


def _project_dir(config: Mapping[str, Any]) -> str:
    project_file = str(config.get("project_file") or "")
    return project_file.rsplit("/", 1)[0] if "/" in project_file else ""


def project_relative(config: Mapping[str, Any], repo_path: str) -> str:
    """A repository path as the project-relative path today's routes name files by."""

    directory = _project_dir(config)
    if directory and repo_path.startswith(directory + "/"):
        return repo_path[len(directory) + 1:]
    return repo_path


def _within_project(config: Mapping[str, Any], repo_path: str) -> bool:
    directory = _project_dir(config)
    return not directory or repo_path == directory or repo_path.startswith(directory + "/")


def available(read: BundleRead, repo_path: str) -> bool:
    """Whether ``sources/<repo_path>`` is a ready member of the bundle."""

    if not repo_path:
        return False
    member = f"{_SOURCE_PREFIX}{repo_path}"
    return _extended(read, [member]).ready(member)


def source(read: BundleRead, repo_path: str) -> SourceFile | None:
    """The ready ``sources/<repo_path>`` member, or ``None`` when the bundle lacks it."""

    if not available(read, repo_path):
        return None
    member = f"{_SOURCE_PREFIX}{repo_path}"
    return SourceFile(
        name=posixpath.basename(repo_path), repo_path=repo_path, size=read.size(member),
        sha256=read.sha256(member), load=lambda: read.bytes(member),
    )


def schematic(read: BundleRead) -> SourceFile | None:
    """The route's root schematic: ``config.root_schematic`` as a source member.

    ``None`` when the effective configuration names no root schematic — a legacy
    project with no anchor, whose directory fallback the bundle does not make —
    so the route keeps its legacy resolution.
    """

    config = effective_config(read)
    if config is None:
        return None
    root = config.get("root_schematic")
    return source(read, str(root)) if root else None


def pcb(read: BundleRead) -> SourceFile | None:
    """The route's board: ``config.board`` as a source member (``None`` when unnamed)."""

    config = effective_config(read)
    if config is None:
        return None
    board = config.get("board")
    return source(read, str(board)) if board else None


def subsheets(
    read: BundleRead,
    project_id: str,
    commit: str | None,
    *,
    include_content: bool = False,
) -> list[dict[str, str]] | None:
    """The route's ``files`` list: each schematic of the hierarchy below the root.

    ``documents`` holds every schematic the build reached from the root, so this
    replaces the legacy directory scan with the hierarchy itself. It is the same
    list whenever a project's schematics all sit in the project directory (the
    root's siblings) or its configured subsheets directory, which is what the
    legacy scan reads; a detached schematic the build did not reach is not a
    bundle source and is a documented divergence (field-maps/project.md D5).

    ``include_content`` also carries each sheet's text, read from the same open
    bundle as the list itself, so a hierarchy costs one revision resolution.
    Past :data:`MAX_INLINE_SUBSHEET_CONTENT_BYTES` the remaining entries omit
    ``content`` and the client reads those files one by one.
    """

    config = effective_config(read)
    if config is None or not read.ready(PROJECT_JSON):
        return None
    root = config.get("root_schematic")
    # Today's route reads the main schematic first, so its absence is a 404 the
    # mapping must not answer with a list; decline and let the legacy path decide.
    if not root or not available(read, str(root)):
        return None
    document = read.json(PROJECT_JSON)
    names = [
        (project_relative(config, str(entry["path"])), str(entry["path"]))
        for entry in document.get("documents", ())
        if entry.get("kind") == "schematic"
        and entry.get("path") != root
        and _within_project(config, str(entry["path"]))
    ]
    files: list[dict[str, str]] = []
    remaining = MAX_INLINE_SUBSHEET_CONTENT_BYTES
    exhausted = False
    for name, repo_path in sorted(names, key=lambda entry: entry[0]):
        item = _asset_url(project_id, commit, name)
        if include_content and not exhausted:
            member = source(read, repo_path)
            if member is not None:
                if member.size <= remaining:
                    item["content"] = member.content.decode("utf-8", errors="replace")
                    remaining -= member.size
                else:
                    exhausted = True
        files.append(item)
    return files


def _asset_url(project_id: str, commit: str | None, name: str) -> dict[str, str]:
    if commit:
        return {
            "name": name,
            "url": (
                f"/api/projects/{quote(project_id, safe='')}/asset/{quote(name, safe='/')}"
                f"?commit={quote(commit, safe='')}"
            ),
        }
    return {"name": name, "url": f"/api/projects/{project_id}/asset/{name}"}


def support_files(read: BundleRead) -> list[dict[str, str]] | None:
    """The route's ``files`` list: the project file and its drawing sheet.

    The project file is ``config.project_file``; the drawing sheet is the
    ``drawing-sheet`` reference of the same file, resolved by the build. ``None``
    when the project file is not a ready source member. A drawing-sheet setting
    whose target the bundle does not carry is a documented divergence: the
    project file is served alone and the viewer uses KiCad's default frame
    (field-maps/project.md), because the bundle has no repository search to
    reproduce.
    """

    config = effective_config(read)
    if config is None or not read.ready(PROJECT_JSON):
        return None
    project_file = str(config.get("project_file") or "")
    project = source(read, project_file)
    if project is None:
        return None
    document = read.json(PROJECT_JSON)
    files = [{"filename": posixpath.basename(project_file), "content": project.content.decode("utf-8")}]
    sheet = _worksheet(read, config, document, project_file)
    if sheet is not None:
        files.append(
            {"filename": project_relative(config, sheet.repo_path), "content": sheet.content.decode("utf-8")}
        )
    return files


def _worksheet(
    read: BundleRead, config: Mapping[str, Any], document: Mapping[str, Any], project_file: str
) -> SourceFile | None:
    """The drawing sheet ``sources/<path>``, or ``None`` when there is none to serve."""

    references = [
        reference
        for reference in document.get("references", ())
        if reference.get("kind") == "drawing-sheet" and reference.get("documentPath") == project_file
    ]
    for field in _SHEET_FIELDS:
        reference = next((item for item in references if item.get("field") == field), None)
        if reference is None:
            continue
        target = reference.get("target") or {}
        if target.get("kind") == "repository" and target.get("inSources") is True:
            return source(read, str(target.get("path") or ""))
        return None
    return None
