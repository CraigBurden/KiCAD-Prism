"""The changes you haven't committed yet: the working tree against HEAD.

The web app can only ever show *committed* history, because that's all the backend
can see. The interesting changes while you're actually working in KiCad are the
ones still on disk, so the agent lists them itself, from `git status`.

This is a file-level list. Item-level detail (which footprints, which wires) is
not computed here yet; every file carries an empty `groups` list, which the
plugin renders as a plain row.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import types
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .projects import _run_git

log = logging.getLogger(__name__)


def _backend_services_dir() -> Path:
    """Where the backend's shared services live.

    Frozen, they are bundled into the binary (build_agent.py copies them in),
    because the user has a plugin zip and no repo. From a checkout, walk up to the
    repo and use the real backend source.
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return Path(base) / "backend_services"
    return Path(__file__).resolve().parents[2] / "backend" / "app" / "services"


@lru_cache(maxsize=1)
def _load_noise_classifier():
    """The backend's is_noise(), loaded by path from the backend source.

    Shared rather than duplicated on purpose: the web history and the plugin's
    change list must agree on what counts as a KiCad backup, or a file hidden in
    one place and shown in the other is just confusing. Two copies of these
    patterns would drift the first time KiCad changes a suffix.
    """
    services = _backend_services_dir()
    path = services / "kicad_noise_service.py"
    if not path.is_file():
        log.warning("kicad_noise_service not found; nothing will be flagged as noise")
        return None
    try:
        return _load_by_path("app.services.kicad_noise_service", path)
    except Exception:
        log.warning("couldn't load the noise classifier", exc_info=True)
        return None


def _is_noise(path: str) -> bool:
    mod = _load_noise_classifier()
    # No classifier means show everything: better a noisy list than a silently
    # incomplete one.
    return bool(mod and mod.is_noise(path))


def _load_by_path(name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(name)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@dataclass
class FileChange:
    """One changed file."""

    path: str  # repo-relative
    filename: str  # basename
    status: str  # added | removed | modified
    kind: str  # pcb | sch | other
    # KiCad's own droppings, backup archives, -bak files, autosaves, caches. Tagged
    # rather than dropped: the UI collapses them behind a count, so nothing vanishes
    # without a trace. A file that silently disappears from a change list is worse
    # than one that's merely noisy, it's a lie about the state of the repo.
    noise: bool = False

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "filename": self.filename,
            "status": self.status,
            "kind": self.kind,
            "noise": self.noise,
            # Item-level detail is not computed yet; the plugin renders a plain row.
            "groups": [],
        }


def _changed_paths(repo: Path) -> list[tuple[str, str]]:
    """(status, repo-relative path) for everything not committed.

    Uses `git status --porcelain`, which reports staged *and* unstaged changes,
    both are "uncommitted" as far as the user is concerned. The format is column
    oriented (" M path"), so the output must not be stripped.
    """
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    try:
        lines = _run_git(repo, "status", "--porcelain", strip=False).splitlines()
    except Exception:
        return out

    for line in lines:
        if not line.strip():
            continue
        code, name = line[:2], line[3:].strip()
        # Renames read as "old -> new"; the new path is what's on disk.
        if " -> " in name:
            name = name.split(" -> ", 1)[1]
        name = name.strip('"')
        if name in seen:
            continue
        seen.add(name)

        if code == "??" or "A" in code:
            status = "added"
        elif "D" in code:
            status = "removed"
        else:
            status = "modified"
        out.append((status, name))
    return out


def uncommitted_changes(
    repo_root: str | Path, scope: str | Path | None = None
) -> list[dict]:
    """Every uncommitted change, one entry per file.

    `scope` (a project directory) restricts the result to that subtree, which
    matters in a monorepo holding several KiCad projects.
    """
    repo = Path(repo_root)
    if not repo.is_dir():
        return []

    scope_rel: str | None = None
    if scope:
        try:
            scope_rel = Path(scope).resolve().relative_to(repo.resolve()).as_posix()
        except ValueError:
            scope_rel = None  # scope outside the repo, don't filter

    changes: list[FileChange] = []

    for status, rel in _changed_paths(repo):
        if (
            scope_rel
            and scope_rel not in ("", ".")
            and not rel.startswith(scope_rel + "/")
        ):
            continue

        name = Path(rel).name
        noise = _is_noise(rel)

        if noise:
            kind = "other"
        elif rel.endswith(".kicad_sch"):
            kind = "sch"
        elif rel.endswith(".kicad_pcb"):
            kind = "pcb"
        else:
            kind = "other"
        changes.append(FileChange(rel, name, status, kind, noise=noise))

    # Boards and schematics first, they're what the user came to see. Noise last,
    # regardless of type.
    rank = {"sch": 0, "pcb": 1, "other": 2}
    changes.sort(key=lambda c: (c.noise, rank[c.kind], c.path))
    return [c.to_dict() for c in changes]

