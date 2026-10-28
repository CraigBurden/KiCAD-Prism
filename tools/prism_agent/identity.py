"""Reading a project's identity, and finding a project by it.

The agent used to answer "which Prism project is this folder?" by asking the server
for every project's `path` and comparing strings. That only ever worked because the
server and the client were the same machine. Move the server one hop and the paths it
reports are *its* paths, which can never equal a local one.

Phase 1 put the answer in the repo: a committed `project` block in `.prism.json`
carrying the project's id. This module reads it, and searches for it.

    read(dir)                 -> {"id": ..., "server": ...} or None
    find_by_id(id, roots)     -> the local directory holding that project, or None

`server` is a hint, not a constraint. The same repo may legitimately be registered on
a staging server and a production one, and refusing to work because we found the
"wrong" one would be worse than useless. Match on `id`.

Searching is bounded on purpose. A checkout can be anywhere, but walking a whole disk
to find one is not a plan, so we look under the user's configured projects roots and
stop. A root is a place to *look*, not a place you are forced to put things.
"""

from __future__ import annotations

import json
from pathlib import Path

MARKER_NAME = ".prism.json"

# How deep below a root to look for a marker. Roots hold project folders, sometimes
# nested one level in a monorepo, so three is generous. Unbounded recursion over a
# home directory is how you make an agent that hangs on startup.
MAX_DEPTH = 3

# Never descend into these. Cheap to skip, ruinous to walk.
SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "build",
    "dist",
    ".cache",
    "RemoteLibrary",
}


def read(project_dir: str | Path) -> dict | None:
    """The `project` block from a checkout's `.prism.json`, or None."""
    marker = Path(project_dir) / MARKER_NAME
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # Missing, unreadable, or not JSON. All the same to us: no identity.
        return None
    if not isinstance(data, dict):
        return None
    block = data.get("project")
    if not isinstance(block, dict) or not block.get("id"):
        return None
    return block


def project_id(project_dir: str | Path) -> str:
    """The project id this checkout claims, or "" if it claims none."""
    block = read(project_dir)
    return str(block.get("id", "")) if block else ""


def _iter_candidates(root: Path, depth: int = 0):
    """Directories under `root` that could be a project, breadth-first-ish."""
    if depth > MAX_DEPTH:
        return
    try:
        entries = sorted(root.iterdir())
    except OSError:
        return  # unreadable root: not fatal, just nothing to find here
    for entry in entries:
        if not entry.is_dir() or entry.name in SKIP_DIRS or entry.name.startswith("."):
            continue
        yield entry
        yield from _iter_candidates(entry, depth + 1)


def write(project_dir: str | Path, project_id: str, server: str = "") -> bool:
    """Stamp the identity into a checkout's `.prism.json`, keeping everything else.

    A local write, not a commit. Committing on the user's behalf, into a repo they may
    not have looked at yet, is not ours to do; the marker is useful the moment it exists
    on disk, and it gets committed whenever they next commit.

    Never raises. A checkout that cannot be stamped still works, it just falls back to
    matching by git origin.
    """
    marker = Path(project_dir) / MARKER_NAME

    data: dict = {}
    if marker.exists():
        try:
            loaded = json.loads(marker.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
        except (OSError, ValueError):
            # Do not clobber a file we could not parse. It may be hand-written and
            # merely have a trailing comma, and destroying someone's path config to
            # add an id they did not ask for is not a trade worth making.
            return False

    block = {"id": project_id}
    if server:
        block["server"] = server
    if data.get("project") == block:
        return False  # already says this; do not dirty the tree for nothing

    data["project"] = block
    try:
        marker.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    except OSError:
        return False
    return True


def find_by_id(target_id: str, roots: list[str]) -> str:
    """The local directory holding the project with this id, or "".

    Searches each root in order, so the first root wins a tie. Two checkouts of the
    same project is a real situation (a scratch clone next to a working one), and
    picking the one under the earliest root is at least predictable.
    """
    if not target_id:
        return ""
    for raw in roots:
        try:
            root = Path(raw).expanduser().resolve()
        except (OSError, ValueError):
            continue
        if not root.is_dir():
            continue
        # The root may itself be a project, not just a container of them.
        if project_id(root) == target_id:
            return str(root)
        for candidate in _iter_candidates(root):
            if project_id(candidate) == target_id:
                return str(candidate)
    return ""
