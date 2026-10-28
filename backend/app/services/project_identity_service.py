"""Project identity: the `project` block in `.prism.json`.

A checkout has to be able to say what it is without asking anyone. Today it cannot,
so the agent infers identity by comparing its local path against a path the server
reported, which only works because they happen to be the same machine. A path is not
an identity.

So the id travels *in the repo*, committed:

    {
      "project": {
        "id": "prj_672e0edb9885",
        "server": "https://prism.example.com"
      },
      "paths": { ... }
    }

`server` is a hint, not a constraint. The same repo can legitimately be registered on
a staging server and a production one, and a client that found the "wrong" one should
still work. Match on `id`; use `server` only to disambiguate.

Nothing reads this yet. It is written on import and backfilled on open, so that by the
time anything depends on it the markers are already in place.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MARKER_NAME = ".prism.json"


def read(project_path: str | Path) -> dict[str, Any] | None:
    """The `project` block, or None if this checkout carries no identity."""
    marker = Path(project_path) / MARKER_NAME
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("Could not read %s: %s", marker, err)
        return None

    block = data.get("project")
    if not isinstance(block, dict) or not block.get("id"):
        return None
    return block


def project_id(project_path: str | Path) -> str | None:
    block = read(project_path)
    return block.get("id") if block else None


def write(project_path: str | Path, project_id: str, server: str = "") -> bool:
    """Stamp the identity into `.prism.json`, preserving everything else in it.

    Returns whether the file was touched. False means it already said this, which is
    the common case on reopen and is not worth a write (it would dirty the working
    tree for no reason).

    Never raises: a project that cannot be stamped is a project that keeps working
    the old way. Identity is additive until phase 2, and failing an import over it
    would be a bad trade.
    """
    marker = Path(project_path) / MARKER_NAME

    existing: dict[str, Any] = {}
    if marker.exists():
        try:
            loaded = json.loads(marker.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
        except (OSError, json.JSONDecodeError) as err:
            # Do NOT overwrite a file we failed to parse. It may be hand-written and
            # merely have a trailing comma, and clobbering someone's path config to
            # add an id they did not ask for is not a trade worth making.
            logger.warning(
                "Refusing to stamp identity into unparseable %s: %s", marker, err
            )
            return False

    block = {"id": project_id}
    if server:
        block["server"] = server

    if existing.get("project") == block:
        return False

    existing["project"] = block

    try:
        marker.write_text(
            json.dumps(existing, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError as err:
        logger.warning("Could not stamp identity into %s: %s", marker, err)
        return False

    from app.services import path_config_service

    path_config_service.clear_config_cache(str(project_path))
    logger.info("Stamped identity %s into %s", project_id, marker)
    return True


def matches(project_path: str | Path, project_id: str) -> bool:
    """Is this checkout the given project? Id only, deliberately: see the note on
    `server` above."""
    block = read(project_path)
    return bool(block) and block["id"] == project_id
