"""Adding a KiCad .gitignore to a project that hasn't got one.

A project that was imported, or started outside Prism, often has none, and the result
is a repo that reports KiCad's churn as uncommitted work forever: caches, lock files,
backups and fetched libraries, none of which anyone chose to have.

That is not cosmetic. It makes "you have uncommitted changes" meaningless, so the user
learns to ignore the warning for the one time it matters, and it makes "discard my
changes" ill-defined, because the pile is churn and design work mixed together.

The patterns live in the backend's kicad_noise_service, beside the filter that hides the
same files from the history. Same knowledge, said once.

Two things this does NOT do:

  * It does not commit. Writing a file is easy to undo; committing on someone's behalf
    is a change to shared history they did not ask for.
  * It does not untrack anything, ever. An ignore rule only affects files git is not
    already tracking, so a project that COMMITTED its .kicad_prl keeps reporting it, and
    that is correct: somebody chose to commit it, and reversing that is not ours to do
    even with a prompt. We report which files are in that position; we do not touch them.
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)

# Last-resort .gitignore, used only if the shared one cannot be loaded.
#
# The real one lives in the backend's kicad_noise_service, beside the patterns it
# mirrors, and rides along with the module the agent already loads for noise
# classification (see worktree_diff). This copy exists so a broken load degrades to a
# workable ignore file rather than to none at all.
_FALLBACK_GITIGNORE = """\
# KiCad-Prism
*-backups/
*.kicad_pcb-bak
*.kicad_sch-bak
*.bak
_autosave-*
*.lck
~*.lck
fp-info-cache
*-cache.lib
*-cache.dcm
RemoteLibrary/
"""


def gitignore() -> str:
    """The KiCad .gitignore to write. Shared with the backend so the file we write and
    the filter the history uses cannot disagree about what counts as churn."""
    from .worktree_diff import _load_noise_classifier

    mod = _load_noise_classifier()
    text = getattr(mod, "GITIGNORE", "") if mod else ""
    if not text:
        log.warning("Using the fallback .gitignore; the shared one wasn't loadable")
        return _FALLBACK_GITIGNORE
    return text


class IgnoreError(Exception):
    """Couldn't do it, with a reason worth showing."""


def _git(repo: Path, *args: str, check: bool = True) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise IgnoreError(f"Couldn't run git: {exc}") from exc
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        raise IgnoreError(detail[-1] if detail else "git failed")
    return result.stdout


def status(project_dir: str | Path) -> dict:
    """Would a .gitignore help here, and what would it change?

    Read-only. Returns:

        has_gitignore   one already exists (we never overwrite it)
        would_ignore    untracked paths that would stop being reported
        already_tracked paths the ignore file names but git ALREADY tracks, so the
                        ignore would do nothing for them until they are untracked
    """
    path = Path(project_dir)
    if not (path / ".git").is_dir():
        return {
            "is_repo": False,
            "has_gitignore": False,
            "would_ignore": [],
            "already_tracked": [],
        }

    has = (path / ".gitignore").is_file()

    return {
        "is_repo": True,
        "has_gitignore": has,
        "would_ignore": [] if has else _would_ignore(path),
        "already_tracked": _tracked_but_ignorable(path),
    }


def _would_ignore(path: Path) -> list[str]:
    """Untracked paths the new .gitignore would silence.

    Asks git rather than matching the patterns ourselves: .gitignore is a subtler format
    than it looks, and a second implementation of it would be wrong in ways nobody
    notices until a real file goes missing from a change list.
    """
    ignore = path / ".gitignore"
    try:
        ignore.write_text(gitignore(), encoding="utf-8")
        listed = _git(
            path, "ls-files", "--others", "--exclude-standard", check=False
        ).splitlines()
        before = _git(path, "ls-files", "--others", check=False).splitlines()
    except IgnoreError:
        return []
    finally:
        try:
            ignore.unlink()
        except OSError:
            pass

    # What `--exclude-standard` dropped IS what the .gitignore would silence.
    return sorted(set(before) - set(listed) - {".gitignore"})


def _tracked_but_ignorable(path: Path) -> list[str]:
    """Files git already tracks that the ignore file names.

    An ignore rule does nothing for these: git keeps reporting a tracked file's edits
    however many patterns match it. So they will keep appearing, and telling the user
    "added, you're all set" while a committed .kicad_prl keeps showing up would be a
    small lie.

    Reported, not fixed. Untracking one would reverse a decision somebody made when they
    committed it, and `git rm --cached` on another team's deliberate choice is not ours
    to run.
    """
    from .worktree_diff import _is_noise

    try:
        tracked = _git(path, "ls-files", check=False).splitlines()
    except IgnoreError:
        return []
    return sorted(p for p in tracked if p and _is_noise(p))


def add(project_dir: str | Path) -> dict:
    """Write the KiCad .gitignore. Never overwrites an existing one.

    Only ever affects files git is not already tracking, which is git's own rule and the
    right one: a project that committed its .kicad_prl chose to, and this does not argue.

    Does not commit. The user reviews and commits like any other edit.
    """
    path = Path(project_dir)
    if not (path / ".git").is_dir():
        raise IgnoreError(f"{path} is not a git repository.")

    ignore = path / ".gitignore"
    if ignore.is_file():
        # Theirs, and possibly hand-tuned. Appending our block would be presumptuous and
        # merging two ignore files sensibly is not a thing we can do.
        raise IgnoreError(
            "This project already has a .gitignore. Prism won't overwrite it."
        )

    silenced = _would_ignore(path)

    try:
        ignore.write_text(gitignore(), encoding="utf-8")
    except OSError as exc:
        raise IgnoreError(f"Couldn't write {ignore}: {exc}") from exc

    log.info("Wrote %s (%d file(s) silenced)", ignore, len(silenced))
    return {
        "ok": True,
        "silenced": silenced,
        # Files the ignore cannot help, because they are already tracked. The caller
        # should say so rather than implying everything is now quiet.
        "still_tracked": _tracked_but_ignorable(path),
        # The user still has to commit it. Say so rather than implying we did.
        "committed": False,
    }
