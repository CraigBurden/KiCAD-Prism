"""Prism as a git origin: bare repositories it hosts itself.

This is model B. Prism stops being only a viewer of somebody else's git and becomes the
place git lives. Everything else in the storage plan already supports it, so this module
is small on purpose: a bare repo, and a way to reach it.

**Bare, and only on this side.** A bare repo has no working tree, which is exactly right
for an origin that several people push to: there is no checked-out copy for two users to
corrupt. A *client* clone is never bare, because KiCad opens files off the disk. Nothing
is ever converted from one to the other. When Prism adopts an existing repo it creates a
new bare repo and PUSHES into it; the user's working tree is untouched and simply gains
a remote.

**The transport is Smart HTTP**, served on the port Prism already listens on (see
api/git_http.py). That means one port, no sshd, no key management, and, most importantly,
that reaching a repo goes through the same auth as everything else in Prism rather than
a parallel system nobody remembers to revoke.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Long enough for a real board with 3D models. A push that gets killed halfway leaves
# the client thinking it failed while the server may have taken the objects.
GIT_TIMEOUT = 900


class GitHostError(Exception):
    """Couldn't do the git-hosting thing, with a reason worth surfacing."""


def repos_root() -> Path:
    """Where the bare repos live.

    Beside the workspace DB, not inside `data/projects`: a bare repo is not a project
    checkout, and putting it under the projects root would put it in the path of every
    scan that walks looking for KiCad files.
    """
    return Path(settings.KICAD_PROJECTS_ROOT) / ".kicad-prism" / "git"


def repo_path(project_id: str) -> Path:
    """The bare repo for a project id.

    `project_id` is minted by us (`prj_` + hex), never user input, so it cannot contain
    a separator. Validated anyway: this builds a filesystem path, and a component that
    could escape `repos_root()` would be a serious bug.
    """
    if not project_id or "/" in project_id or "\\" in project_id or ".." in project_id:
        raise GitHostError(f"Invalid project id: {project_id!r}")
    return repos_root() / f"{project_id}.git"


def exists(project_id: str) -> bool:
    return repo_path(project_id).is_dir()


def origin_url(project_id: str) -> str:
    """What a client should clone.

    Empty when the server has no public URL configured. Better to say nothing than to
    hand out a URL (say, 127.0.0.1) that only works on the server's own machine.

    Reads PUBLIC_BASE_URL, the canonical public origin. This used to read a
    PRISM_SERVER_URL that no longer exists, so every call raised AttributeError and
    publishing could not hand the agent an origin to push to.
    """
    base = settings.PUBLIC_BASE_URL.strip().rstrip("/")
    if not base:
        return ""
    return f"{base}/git/{project_id}.git"


def _run(args: list[str], cwd: str | Path | None = None) -> str:
    try:
        result = subprocess.run(
            args,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise GitHostError(f"Couldn't run git: {exc}") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        raise GitHostError(detail[-1] if detail else "git failed")
    return result.stdout


def create(project_id: str) -> Path:
    """Create an empty bare repo for a project. Idempotent."""
    path = repo_path(project_id)
    if path.is_dir():
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    _run(["git", "init", "--bare", "--initial-branch=main", str(path)])

    # Smart HTTP will not serve a repo without this. It is the single most common
    # reason a self-hosted git-over-HTTP setup silently 403s on clone.
    _run(["git", "config", "http.receivepack", "true"], cwd=path)
    _run(["git", "config", "http.uploadpack", "true"], cwd=path)

    logger.info("Created bare repo %s", path)
    return path


def adopt(project_id: str, working_tree: str | Path) -> str:
    """Take an existing working tree as a Prism-hosted project.

    The tree is NOT converted to bare and NOT moved. We create a new bare repo, push the
    tree's history into it, and set it as `origin`. The user keeps working in the same
    folder they were already in; it simply gains a remote.

    The tree must already be a git repo with at least one commit. Turning a pile of
    files into a repo (git init, .gitignore, first commit) is a separate, explicit act,
    because deciding what to commit is a decision the user has to make, not us.
    """
    tree = Path(working_tree)
    if not (tree / ".git").is_dir():
        raise GitHostError(f"{tree} is not a git repository.")

    # An empty repo has no HEAD, and rev-parse *fails* rather than returning blank. Say
    # what is actually wrong: git's own "Needed a single revision" tells the user
    # nothing about what to do next.
    try:
        _run(["git", "rev-parse", "--verify", "HEAD"], cwd=tree)
    except GitHostError as exc:
        raise GitHostError(
            f"{tree} has no commits yet. Commit something before adopting it."
        ) from exc

    # Check for an existing origin BEFORE creating anything. Silently replacing someone's
    # remote would disconnect them from the upstream they actually push to, and creating
    # the bare repo first would leave an orphan behind when we refuse.
    existing = ""
    try:
        existing = _run(["git", "remote", "get-url", "origin"], cwd=tree).strip()
    except GitHostError:
        pass  # no origin, which is the expected case here
    if existing:
        raise GitHostError(
            f"{tree} already has an origin ({existing}). Adopting would replace it."
        )

    bare = create(project_id)

    # A local path, not the HTTP URL: the push happens server-side, on the same disk,
    # so there is no reason to route it through our own web server (and no credentials
    # to do so with).
    _run(["git", "remote", "add", "origin", str(bare)], cwd=tree)

    branch = (
        _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=tree).strip() or "main"
    )
    _run(["git", "push", "-u", "origin", branch], cwd=tree)

    logger.info("Adopted %s into %s", tree, bare)
    return str(bare)


def delete(project_id: str) -> bool:
    """Remove a hosted repo. Destroys history, so only ever call this when the user has
    explicitly deleted the project."""
    path = repo_path(project_id)
    if not path.is_dir():
        return False
    shutil.rmtree(path)
    logger.info("Deleted bare repo %s", path)
    return True


def is_empty(project_id: str) -> bool:
    """A repo with no commits yet. Freshly created ones are, until somebody pushes."""
    path = repo_path(project_id)
    if not path.is_dir():
        return False
    try:
        _run(["git", "rev-parse", "--verify", "HEAD"], cwd=path)
    except GitHostError:
        return True
    return False


def default_gitignore() -> str:
    """What a KiCad project should not commit.

    Delegates to kicad_noise_service, which owns the patterns. This used to be a second
    copy of the same list, and a second copy is how the .gitignore and the history filter
    quietly stop agreeing about what counts as churn.
    """
    from app.services.kicad_noise_service import GITIGNORE

    return GITIGNORE


def http_backend_env(project_id: str, extra: dict | None = None) -> dict:
    """Environment for `git http-backend` serving one repo.

    GIT_PROJECT_ROOT plus a path deliberately scoped to a SINGLE repo rather than the
    whole root, so a malformed PATH_INFO cannot walk sideways into another project's
    history.
    """
    env = dict(os.environ)
    env.update(
        {
            "GIT_PROJECT_ROOT": str(repos_root()),
            # Without this, http-backend refuses to serve anything it was not
            # explicitly told is exportable.
            "GIT_HTTP_EXPORT_ALL": "1",
        }
    )
    if extra:
        env.update({k: str(v) for k, v in extra.items()})
    return env
