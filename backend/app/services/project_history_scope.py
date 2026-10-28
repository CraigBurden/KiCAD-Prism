"""Which commits are a project's history (issue #681).

A repository can hold several projects, and several can share a directory.
History filtered by directory alone listed a neighbour's commits as this
project's, and commits from before this project existed, which then could not
be opened or compared. A project's history is the commits that change a file in
its directory that no other project owns, from the commit that added its
project file onwards.

Ownership follows KiCad's rule, as ``path_config_service`` does: ``top.kicad_pro``
owns the ``top.*`` KiCad files beside it. A registered project in a
subdirectory owns that subdirectory.
"""

from __future__ import annotations

import posixpath
from dataclasses import dataclass
from typing import Any, Optional, Sequence

#: The files a ``.kicad_pro`` owns by its stem.
OWNED_SUFFIXES = (".kicad_pro", ".kicad_prl", ".kicad_sch", ".kicad_pcb", ".kicad_dru")


@dataclass(frozen=True)
class ProjectHistory:
    """What decides a project's history: its directory, its own file, and the
    directories of the registered projects inside it."""

    relative_path: str = ""
    anchor: Optional[str] = None
    nested: tuple[str, ...] = ()


@dataclass(frozen=True)
class HistoryScope:
    """``git log`` arguments for a project's history at one commit."""

    pathspecs: tuple[str, ...] = ()
    #: Parents of the commit that added the project file: their ancestors are
    #: from before the project existed.
    before: tuple[str, ...] = ()

    def revs(self, sha: str) -> list[str]:
        return [sha, "--not", *self.before] if self.before else [sha]

    def key(self) -> str:
        return "\0".join([*self.pathspecs, "--not", *self.before])


def _join(directory: str, name: str) -> str:
    return posixpath.join(directory, name) if directory else name


def _literal(path: str, *, exclude: bool = False) -> str:
    return f":({'exclude,' if exclude else ''}literal){path}"


def history_scope(repo: Any, sha: str, project: ProjectHistory) -> HistoryScope:
    """The scope of ``project``'s history at ``sha``; ``repo`` is a GitPython ``Repo``."""

    directory = project.relative_path.strip("/")
    if directory == ".":
        directory = ""
    anchor = _join(directory, project.anchor) if project.anchor else ""
    pathspecs: list[str] = []
    if directory or anchor or project.nested:
        pathspecs.append(_literal(directory) if directory else ":/")
        pathspecs += _sibling_exclusions(repo, sha, directory, anchor)
        pathspecs += [_literal(nested, exclude=True) for nested in sorted(project.nested)]
    return HistoryScope(tuple(pathspecs), _parents_of_first_add(repo, sha, anchor))


def _sibling_exclusions(repo: Any, sha: str, directory: str, anchor: str) -> list[str]:
    if not anchor:
        return []
    listing = repo.git.execute(
        ["git", "ls-tree", "--name-only", sha, "--", f"{directory}/" if directory else "."]
    )
    exclusions = []
    for path in listing.splitlines():
        if not path.endswith(".kicad_pro") or path == anchor:
            continue
        stem = path[: -len(".kicad_pro")]
        exclusions += [_literal(stem + suffix, exclude=True) for suffix in OWNED_SUFFIXES]
    return exclusions


def _parents_of_first_add(repo: Any, sha: str, anchor: str) -> tuple[str, ...]:
    if not anchor:
        return ()
    added = repo.git.execute(
        ["git", "log", "--no-renames", "--diff-filter=A", "--format=%H", sha, "--", _literal(anchor)]
    ).split()
    if not added:
        return ()
    parents = repo.git.execute(["git", "rev-list", "--parents", "-n", "1", added[-1]]).split()[1:]
    return tuple(parents)


def project_history(directory: str, anchor: Optional[str], project_id: str, rows: Sequence[Any]) -> ProjectHistory:
    """``ProjectHistory`` for a project at ``directory``, given its repository's workspace rows."""

    def directory_of(row: Any) -> str:
        value = str(row.get("relative_path") or "").strip("/")
        return "" if value == "." else value

    nested = tuple(sorted({
        directory_of(row)
        for row in rows
        if row.get("id") != project_id
        and directory_of(row) not in ("", directory)
        and (not directory or directory_of(row).startswith(directory + "/"))
    }))
    return ProjectHistory(directory, anchor or None, nested)
