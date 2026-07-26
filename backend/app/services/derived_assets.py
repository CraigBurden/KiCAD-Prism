"""
Storage for assets Prism generates about a project.

Prism renders board thumbnails itself. Those renders used to be written into
``<checkout>/assets/thumbnail/``, inside the user's own Git working tree. That
left every checkout permanently dirty, meant ``git pull`` could refuse to fast
forward once upstream touched the same path, and put Prism's output in the way
of anyone running ``git add -A`` in the repository. For a tool whose whole
premise is that Git stays the source of truth, writing into the source of truth
is the one thing it must not do.

Generated assets therefore live outside every checkout, under the Prism data
directory, keyed by the project's location on disk. The checkout stays exactly
as Git left it.
"""

from __future__ import annotations

import hashlib
import logging
import re
import shutil
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Thumbnails Prism wrote into checkouts before generated assets were moved out.
# Matched so they can be cleaned up, never so they can be reused.
_LEGACY_THUMBNAIL_PATTERNS = ("thumbnail.*.webp", "thumbnail.png")
_GENERATED_THUMBNAIL_RE = re.compile(r"^thumbnail\.[0-9a-f]{8,}\.webp$")

THUMBNAIL_MEDIA_TYPE = "image/webp"


def derived_root() -> Path:
    """Root of the Prism-owned derived asset tree."""
    return Path(settings.KICAD_PROJECTS_ROOT) / ".kicad-prism" / "derived"


def _project_key(project_path: str | Path) -> str:
    """Stable directory name for a project checkout.

    Keyed by resolved path rather than project id because assets are generated
    during import, before the project row exists.
    """
    resolved = str(Path(project_path).resolve())
    return hashlib.sha256(resolved.encode("utf-8")).hexdigest()[:32]


def thumbnail_dir(project_path: str | Path) -> Path:
    return derived_root() / "thumbnails" / _project_key(project_path)


def store_thumbnail(project_path: str | Path, source: Path) -> tuple[Path, str, int]:
    """Move ``source`` into the derived store, returning (path, digest, size).

    Replaces any thumbnail already held for this project, so the directory holds
    at most one render and stale digests cannot be served.
    """
    encoded = source.read_bytes()
    digest = hashlib.sha256(encoded).hexdigest()
    directory = thumbnail_dir(project_path)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"thumbnail.{digest[:16]}.webp"
    source.replace(target)
    for stale in directory.glob("thumbnail.*.webp"):
        if stale != target:
            stale.unlink(missing_ok=True)
    return target, digest, target.stat().st_size


def find_thumbnail(project_path: str | Path) -> Optional[Path]:
    """Return the generated thumbnail for a project, if one has been rendered."""
    directory = thumbnail_dir(project_path)
    if not directory.is_dir():
        return None
    for candidate in sorted(directory.glob("thumbnail.*.webp")):
        if candidate.is_file():
            return candidate
    return None


def discard(project_path: str | Path) -> None:
    """Drop every derived asset for a project checkout."""
    shutil.rmtree(thumbnail_dir(project_path), ignore_errors=True)


def purge_legacy_in_tree_thumbnails(project_path: str | Path, repo) -> list[str]:
    """Remove thumbnails an older Prism wrote into the checkout.

    Only files matching Prism's own generated naming *and* untracked by Git are
    touched: an untracked file at that path was written by Prism and never
    committed, so removing it cannot lose anyone's work. A thumbnail the team
    actually committed is tracked, stays put, and continues to take precedence
    over anything Prism renders.
    """
    directory = Path(project_path) / "assets" / "thumbnail"
    if not directory.is_dir():
        return []

    candidates: list[Path] = []
    for pattern in _LEGACY_THUMBNAIL_PATTERNS:
        candidates.extend(path for path in directory.glob(pattern) if path.is_file())
    if not candidates:
        return []

    try:
        tracked_output = repo.git.ls_files("--", str(directory))
    except Exception:
        # Without a reliable tracked-file list, leave the checkout alone.
        return []
    tracked = {
        (Path(repo.working_tree_dir) / line).resolve()
        for line in tracked_output.splitlines()
        if line.strip()
    }

    removed: list[str] = []
    for candidate in candidates:
        if candidate.resolve() in tracked:
            continue
        if candidate.name != "thumbnail.png" and not _GENERATED_THUMBNAIL_RE.match(candidate.name):
            continue
        candidate.unlink(missing_ok=True)
        removed.append(candidate.name)

    if removed:
        logger.info(
            "Removed %d Prism-generated thumbnail(s) from the checkout at %s",
            len(removed),
            project_path,
        )
        try:
            next(directory.iterdir())
        except StopIteration:
            directory.rmdir()
    return removed
