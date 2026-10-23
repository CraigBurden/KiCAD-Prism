"""Creating a project that Prism itself hosts, model B.

Two ways in, both landing in the same place: a bare repo Prism owns, a registered
project, and an `origin_url` a client can clone.

    create()  from nothing. A seeded KiCad skeleton, so the repo is openable
              immediately rather than being an empty directory.

    adopt()   from a folder the user already has. The tree is NOT moved and NOT
              converted; we create a bare repo, push the history into it, and set it as
              `origin`. The user keeps working where they were.

Both go through git_host_service, which owns the bare-repo mechanics.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

from app.services import git_host_service
from app.services.git_host_service import GitHostError
from app.services.workspace_service import _new_id, workspace

logger = logging.getLogger(__name__)


class CreateError(Exception):
    """Couldn't create or adopt, with a reason worth showing."""


def _git(args: list[str], cwd: Path) -> None:
    result = subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        detail = (result.stderr or "").strip().splitlines()
        raise CreateError(detail[-1] if detail else "git failed")


def create(name: str, description: str = "", folder_id: str | None = None) -> dict:
    """A new, empty, Prism-hosted project.

    Seeded with a real KiCad project skeleton and a .gitignore, not left as an empty
    repo. An empty repo is a worse starting point than it looks: `git clone` of one
    warns, there is no branch yet for anything to track, and the user's first act would
    have to be creating the very files we know they need.
    """
    name = (name or "").strip()
    if not name:
        raise CreateError("A project name is required.")

    project_id = _new_id("prj_")

    try:
        git_host_service.create(project_id)
    except GitHostError as exc:
        raise CreateError(str(exc)) from exc

    # Build the first commit in a scratch tree and push it. The bare repo never gets a
    # working tree of its own, which is the point of it being bare.
    with tempfile.TemporaryDirectory() as scratch:
        tree = Path(scratch)
        try:
            _seed(tree, name, description)
            _git(["init", "-b", "main"], tree)
            _git(["config", "user.email", "prism@local"], tree)
            _git(["config", "user.name", "Prism"], tree)
            _git(["add", "-A"], tree)
            _git(["commit", "-m", f"Create {name}"], tree)
            _git(
                [
                    "remote",
                    "add",
                    "origin",
                    str(git_host_service.repo_path(project_id)),
                ],
                tree,
            )
            _git(["push", "-u", "origin", "main"], tree)
        except CreateError:
            # Do not leave a half-made repo behind for the user to trip over later.
            git_host_service.delete(project_id)
            raise

    return _register(project_id, name, description, folder_id)


def _seed(tree: Path, name: str, description: str) -> None:
    """The minimum that makes a folder a KiCad project Prism can render."""
    (tree / ".gitignore").write_text(
        git_host_service.default_gitignore(), encoding="utf-8"
    )
    # An empty KiCad project file. KiCad fills in the rest on first open; what matters
    # is that a .kicad_pro exists, because that is what the agent hands to the OS and
    # what Prism's own detection looks for.
    (tree / f"{name}.kicad_pro").write_text("{}\n", encoding="utf-8")
    if description:
        (tree / "README.md").write_text(
            f"# {name}\n\n{description}\n", encoding="utf-8"
        )


def adopt(
    working_tree: str,
    name: str = "",
    description: str = "",
    folder_id: str | None = None,
) -> dict:
    """Take a folder the user already has, and make Prism its origin.

    The tree stays exactly where it is. It gains a remote; nothing else about it
    changes, and it is never converted to bare.

    It must already be a git repo with a commit. Turning a pile of files into a repo is
    deliberately NOT done here: deciding what belongs in the first commit is the user's
    call, not ours, and a `git add -A` on somebody's project folder is how you commit
    3 GB of build output and a private key.
    """
    tree = Path(working_tree).expanduser()
    if not tree.is_dir():
        raise CreateError(f"{tree} is not a folder.")

    name = (name or tree.name).strip()
    project_id = _new_id("prj_")

    try:
        git_host_service.adopt(project_id, tree)
    except GitHostError as exc:
        git_host_service.delete(project_id)
        raise CreateError(str(exc)) from exc

    return _register(project_id, name, description, folder_id, clone_path=str(tree))


def _register(
    project_id: str,
    name: str,
    description: str,
    folder_id: str | None,
    clone_path: str | None = None,
) -> dict:
    """Put the project in the workspace, pointed at the repo Prism now hosts.

    `origin_owner="prism"` is passed explicitly rather than letting register_repository
    sniff the tree: we KNOW who owns this origin, and guessing at something we already
    know is how a wrong answer creeps in.
    """
    origin = git_host_service.origin_url(project_id)

    # The server keeps its own clone so it can render the board, exactly as it does for
    # an external origin. Nothing about model B changes that.
    server_clone = clone_path or _clone_for_server(project_id, origin)

    repo_id = workspace.register_repository(
        name=name,
        url=origin or str(git_host_service.repo_path(project_id)),
        clone_path_abs=server_clone,
        import_type="single",
        origin_url=origin,
        origin_owner="prism",
    )
    # Pass the id we already minted. The bare repo is named after it (prj_abc.git), so
    # letting the workspace mint a second one would leave the repo and the row pointing
    # at different projects, and every later lookup by id would miss.
    workspace.register_project(
        repo_id=repo_id,
        name=name,
        relative_path=".",
        description=description or f"Project {name}",
        folder_id=folder_id,
        project_id=project_id,
    )

    logger.info("Created Prism-hosted project %s (%s)", name, project_id)
    return {
        "id": project_id,
        "name": name,
        "origin_url": origin,
        "origin_owner": "prism",
    }


def _clone_for_server(project_id: str, origin: str) -> str:
    """The server's own working copy of a repo it hosts.

    Clone from the bare repo on disk, not over HTTP: it is the same machine, and routing
    through our own web server would need credentials we would have to invent.
    """
    from app.core.config import settings

    dest = Path(settings.KICAD_PROJECTS_ROOT) / "type1" / project_id
    dest.parent.mkdir(parents=True, exist_ok=True)

    bare = git_host_service.repo_path(project_id)
    result = subprocess.run(
        ["git", "clone", str(bare), str(dest)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or "").strip().splitlines()
        raise CreateError(detail[-1] if detail else "Couldn't clone the new repo.")
    return str(dest)
