"""Git repositories for tests, always with the same author identity.

Every command runs with a fixed author and committer, and no global or system
Git config, so a test never depends on the machine's ``user.email``. Repositories
made here also record the identity in their own config, for production code
that commits in them.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

AUTHOR_NAME = "Prism Test"
AUTHOR_EMAIL = "test@prism.invalid"

GIT_ENV = {
    "GIT_AUTHOR_NAME": AUTHOR_NAME,
    "GIT_AUTHOR_EMAIL": AUTHOR_EMAIL,
    "GIT_COMMITTER_NAME": AUTHOR_NAME,
    "GIT_COMMITTER_EMAIL": AUTHOR_EMAIL,
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_TERMINAL_PROMPT": "0",
}


def git_env(**extra: str) -> dict[str, str]:
    """The process environment with the fixed identity (for code under test that runs Git itself)."""

    return {**os.environ, **GIT_ENV, **extra}


def git(cwd: str | Path | None, *args: str, check: bool = True, date: str | None = None) -> str:
    """Run ``git args`` in ``cwd`` and return stripped stdout. ``date`` fixes both commit dates.

    ``cwd=None`` is for commands that name every path they touch (``clone``, ``--git-dir``).
    """

    env = git_env(**({"GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date} if date else {}))
    result = subprocess.run(
        ["git", *args], cwd=None if cwd is None else str(cwd), env=env, check=check, capture_output=True, text=True
    )
    return result.stdout.strip()


def write_files(root: str | Path, files: Mapping[str, str | bytes]) -> None:
    for rel, content in files.items():
        target = Path(root) / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            target.write_bytes(content)
        else:
            target.write_text(content, encoding="utf-8")


def set_identity(path: str | Path) -> None:
    """Record the fixed identity in ``path``'s own config (a clone, or code under test committing there)."""

    git(path, "config", "user.name", AUTHOR_NAME)
    git(path, "config", "user.email", AUTHOR_EMAIL)
    git(path, "config", "commit.gpgsign", "false")


def init_repo(
    path: str | Path,
    files: Mapping[str, str | bytes] | None = None,
    *,
    branch: str = "main",
    message: str = "initial",
) -> str | None:
    """A new repository at ``path`` on ``branch``; commits ``files`` if given and returns that SHA."""

    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-q", "-b", branch)
    set_identity(path)
    if not files:
        return None
    write_files(path, files)
    return commit_all(path, message)


def commit_all(path: str | Path, message: str, *, date: str | None = None, allow_empty: bool = False) -> str:
    """Stage everything and commit; return the new HEAD."""

    git(path, "add", "-A")
    git(path, "commit", "-q", "-m", message, *(("--allow-empty",) if allow_empty else ()), date=date)
    return git(path, "rev-parse", "HEAD")


@dataclass(frozen=True)
class ProjectRepo:
    root: Path         # the repository
    project_dir: Path  # where the .kicad_pro lives (the root, or a monorepo subdirectory)
    project_file: str  # its file name
    sha: str           # the commit holding it


def project_repo(
    root: str | Path,
    name: str = "board",
    *,
    subpath: str | None = None,
    files: Mapping[str, str | bytes] | None = None,
    branch: str = "main",
) -> ProjectRepo:
    """A repository with a KiCad project ``name`` committed in it.

    ``subpath`` puts the project in that subdirectory (a monorepo layout).
    ``files`` are added relative to the project directory; by default it holds
    an empty ``.kicad_pro``, ``.kicad_sch`` and ``.kicad_pcb``.
    """

    root = Path(root)
    project_dir = root / subpath if subpath else root
    content = files if files is not None else {
        f"{name}.kicad_pro": "{}\n",
        f"{name}.kicad_sch": "(kicad_sch)\n",
        f"{name}.kicad_pcb": "(kicad_pcb)\n",
    }
    prefix = f"{subpath}/" if subpath else ""
    sha = init_repo(root, {prefix + rel: body for rel, body in content.items()}, branch=branch)
    return ProjectRepo(root=root, project_dir=project_dir, project_file=f"{name}.kicad_pro", sha=sha or "")


__all__ = [
    "AUTHOR_EMAIL",
    "AUTHOR_NAME",
    "GIT_ENV",
    "ProjectRepo",
    "commit_all",
    "git",
    "git_env",
    "init_repo",
    "project_repo",
    "set_identity",
    "write_files",
]
