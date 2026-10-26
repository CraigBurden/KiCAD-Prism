"""Checkouts hold the committed bytes on every OS.

Git for Windows sets ``core.autocrlf=true`` in its system config, so a clone Prism
makes there is checked out with CRLF while git holds LF. ``prism-kicad
revision-key`` hashes the working tree with the system config switched off, so
such a tree would not match its own commit or the same commit on Linux. Every
clone Prism makes sets ``core.autocrlf=false`` in the repository's own config,
and :func:`convert_existing` fixes the checkouts made before that.
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

#: ``git clone`` arguments; the setting lands in the new repository's config.
CLONE_ARGS = ("-c", "core.autocrlf=false")
#: The same, as one GitPython ``multi_options`` entry.
NO_AUTOCRLF_CLONE_OPTIONS = (" ".join(CLONE_ARGS),)


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=False,
        stdin=subprocess.DEVNULL,
    )


def convert_existing(repo: Path) -> bool:
    """Set ``core.autocrlf=false`` in ``repo`` and re-check its files out; True if it did.

    A checkout that is not a git repository, has no commit, has local edits, or
    already has the setting is left alone (the last is not a conversion).
    """

    if not (repo / ".git").exists():
        return False
    current = _git(repo, "config", "--local", "--get", "core.autocrlf").stdout.strip()
    if current == "false":
        return False
    if _git(repo, "rev-parse", "--verify", "-q", "HEAD").returncode != 0:
        return False
    if _git(repo, "status", "--porcelain", "--untracked-files=no").stdout.strip():
        logger.info("not converting line endings of %s: it has local edits", repo)
        return False
    if _git(repo, "config", "--local", "core.autocrlf", "false").returncode != 0:
        return False
    # The index keeps its stat data, so git would call every file unchanged:
    # drop it and check the files out again.
    if _git(repo, "rm", "--cached", "-r", "-q", ".").returncode != 0:
        return False
    if _git(repo, "reset", "--hard", "-q").returncode != 0:
        logger.warning("line-ending conversion of %s did not finish", repo)
        return False
    return True


def convert_projects(projects_root: Path) -> int:
    """Run :func:`convert_existing` on every checkout under ``<root>/<kind>/<project>``."""

    converted = 0
    if not projects_root.is_dir():
        return converted
    for repo in sorted(projects_root.glob("*/*")):
        try:
            if repo.is_dir() and convert_existing(repo):
                converted += 1
                logger.info("checked %s out again with LF line endings", repo)
        except OSError as error:
            logger.warning("line-ending conversion of %s failed: %s", repo, error)
    return converted
