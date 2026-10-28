"""One-off removal of the on-disk stores the design bundle superseded (WP-R4).

ADR §8 lists the stores that become dead once every consumer reads a design
bundle: ``semantic-index/`` and ``semantic-visualizer/`` (which also held the
3D commit index, ``<project>/commit-index.json``). WP-R1 deleted the last
semantic-index reader, and System Builder v2 stage 0 deleted the semantic
visualizer service, so what remains is disk. This module deletes those two
directories beneath the configured data root once, at startup, and records the
run in a marker file so a restart does not repeat it.

The Design Comparison revision cache is *not* here: source-tree comparisons and
the per-bundle-key fabrication plot still use it
(``design_compare_service._prune_revision_cache``,
``design_compare_bundle_path.fabrication_root``), so it is not superseded.

Safety rules:

* only ``<KICAD_PROJECTS_ROOT>/.kicad-prism/{semantic-index,semantic-visualizer}``
  is a target, and nothing outside the configured root is ever removed;
* symlinks are refused rather than followed, so a link to a directory elsewhere
  cannot turn this into a delete outside the root;
* the run is recorded only after the cleanup, and the marker is written
  atomically;
* any error is logged and swallowed: a startup cleanup must not stop the API.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

#: Bump only if a later release needs to run a new cleanup pass.
SCHEMA = "prism.superseded_store_cleanup.a0"
STATE_DIRNAME = ".kicad-prism"
MARKER_NAME = "superseded-stores-cleanup.json"

#: The retired directory names under ``.kicad-prism``. ``semantic-visualizer``
#: contains the old 3D commit index (``<project>/commit-index.json``).
STORES = ("semantic-index", "semantic-visualizer")


def _within(path: Path, root: Path) -> bool:
    try:
        return os.path.commonpath((str(path), str(root))) == str(root)
    except ValueError:
        return False


def _ignore_vanished(function: Any, path: str, error: BaseException) -> None:
    """Every API process runs this at startup; an entry another one removed first is already gone."""

    if not isinstance(error, FileNotFoundError):
        raise error


def _tree_bytes(path: Path) -> int:
    """Bytes below ``path``, without following symlinks out of the tree."""

    total = 0
    stack = [path]
    while stack:
        current = stack.pop()
        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            stack.append(Path(entry.path))
                        elif entry.is_file(follow_symlinks=False) or entry.is_symlink():
                            total += entry.stat(follow_symlinks=False).st_size
                    except OSError:
                        continue
        except OSError:
            continue
    return total


def _record(marker: Path, record: dict[str, Any]) -> None:
    marker.parent.mkdir(parents=True, exist_ok=True)
    temporary = marker.with_name(f".{marker.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    temporary.replace(marker)


def cleanup_superseded_stores(root: str | Path | None = None) -> dict[str, Any]:
    """Delete the retired on-disk stores once and record the bytes reclaimed.

    ``root`` defaults to ``settings.KICAD_PROJECTS_ROOT`` and exists so tests can
    name a temporary data root. Returns a summary with ``ran``, ``bytes``,
    ``removed`` and ``refused``; a second call with the marker present is a
    no-op even if a directory has since reappeared.
    """

    data_root = Path(root if root is not None else settings.KICAD_PROJECTS_ROOT).expanduser()
    try:
        data_root = data_root.resolve()
    except OSError as error:
        logger.warning("Superseded-store cleanup skipped: cannot resolve data root: %s", error)
        return {"ran": False, "bytes": 0, "removed": [], "refused": []}

    state = data_root / STATE_DIRNAME
    marker = state / MARKER_NAME

    if state.is_symlink():
        resolved = state.resolve()
        if not _within(resolved, data_root):
            logger.warning(
                "Superseded-store cleanup refused: %s is a symlink outside the data root %s",
                state,
                data_root,
            )
        return {"ran": False, "bytes": 0, "removed": [], "refused": [str(state)]}

    if marker.exists():
        logger.debug("Superseded-store cleanup already recorded at %s", marker)
        return {"ran": False, "bytes": 0, "removed": [], "refused": []}

    if not data_root.is_dir():
        logger.debug("Superseded-store cleanup skipped: data root %s does not exist", data_root)
        return {"ran": False, "bytes": 0, "removed": [], "refused": []}

    removed: list[dict[str, Any]] = []
    refused: list[dict[str, str]] = []
    total = 0

    for name in STORES:
        target = state / name
        try:
            target.lstat()
        except FileNotFoundError:
            continue
        except OSError as error:
            refused.append({"path": str(target), "reason": str(error)})
            continue

        if os.path.islink(target):
            refused.append({"path": str(target), "reason": "symlink refused"})
            continue
        if not os.path.isdir(target):
            refused.append({"path": str(target), "reason": "not a directory"})
            continue
        if not _within(target.parent.resolve(), data_root):
            refused.append({"path": str(target), "reason": "outside the data root"})
            continue

        size = _tree_bytes(target)
        try:
            shutil.rmtree(target, onexc=_ignore_vanished)
        except OSError as error:
            logger.exception("Could not remove superseded store %s", target)
            refused.append({"path": str(target), "reason": str(error)})
            continue
        total += size
        removed.append({"path": str(target), "bytes": size})
        logger.info("Removed superseded store %s (%d bytes)", target, size)

    record = {
        "schema": SCHEMA,
        "ranAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "bytes": total,
        "removed": removed,
        "refused": refused,
    }
    try:
        _record(marker, record)
    except OSError:
        logger.exception("Could not record the superseded-store cleanup at %s", marker)
        return {"ran": True, "bytes": total, "removed": removed, "refused": refused}

    if total:
        logger.info(
            "Superseded-store cleanup reclaimed %d bytes (%.1f MiB) from %d store(s).",
            total,
            total / (1024 * 1024),
            len(removed),
        )
    else:
        logger.info("Superseded-store cleanup found nothing to remove.")

    return {"ran": True, "bytes": total, "removed": removed, "refused": refused}
