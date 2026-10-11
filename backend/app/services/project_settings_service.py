"""Prism-side project settings, stored in the workspace database.

What a user sets in Prism (path overrides, display name, description,
workflows, portfolio) lives in ``ws_projects.path_settings`` and never in the
server-managed checkout. Writing ``.prism.json`` into the tree made the tracked
file dirty, and Sync, which treats a dirty tree as someone's local edit,
stopped fast-forwarding.

Resolution, highest first:

1. Settings stored here for the project (path + anchor).
2. The ``.prism.json`` committed in the checkout (``projects.<anchor>`` over
   the shared block), or at a revision via ``project_revision.path_config_at``.
3. Auto-detection, then the defaults (``path_config_service``).

``path_config_service.get_path_config`` asks ``stored_settings`` for every
checkout path, so workers, routes and path-only callers all see the same
result. Checkouts are not all under the projects root (an adopted folder stays
where the user keeps it), so the lookup is by registered checkout path; a
temporary revision snapshot matches no project and gets the committed
configuration only. The index is one query, cached per process for a short TTL.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from psycopg.types.json import Jsonb

from app.services import path_config_service

#: Fields a Prism edit may store; the same set the in-tree writer used to keep.
STORED_FIELDS = (*path_config_service.PATH_FIELDS, "project_name", "description", "workflows", "portfolio")

# Other processes (workers) see an edit within this many seconds.
_INDEX_TTL_SECONDS = 2.0
_index: Dict[Tuple[str, str], Dict[str, Any]] = {}
_index_loaded_at: Optional[float] = None
_index_lock = threading.Lock()


def _key(project_path: str, anchor: Optional[str]) -> Tuple[str, str]:
    return str(Path(project_path).resolve()), (anchor or "").strip()


def _checkout_path(abs_clone: str, relative_path: Optional[str]) -> str:
    relative = relative_path or "."
    return abs_clone if relative == "." else os.path.join(abs_clone, relative)


def _load_index() -> Dict[Tuple[str, str], Dict[str, Any]]:
    from app.services.workspace_service import workspace

    workspace.initialize()
    with workspace._connect() as conn:
        rows = conn.execute(
            """SELECT p.relative_path, p.project_file_rel, p.path_settings, r.clone_path
               FROM ws_projects p JOIN ws_repositories r ON r.id = p.repo_id
               WHERE p.path_settings IS NOT NULL"""
        ).fetchall()
    index: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in rows:
        checkout = _checkout_path(workspace._abs_clone_path(row["clone_path"]), row["relative_path"])
        index[_key(checkout, row["project_file_rel"])] = dict(row["path_settings"] or {})
    return index


def invalidate() -> None:
    global _index_loaded_at
    with _index_lock:
        _index_loaded_at = None


def stored_settings(project_path: str, anchor: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Settings stored in Prism for the project at ``project_path``/``anchor``."""

    global _index, _index_loaded_at
    with _index_lock:
        now = time.monotonic()
        if _index_loaded_at is None or now - _index_loaded_at > _INDEX_TTL_SECONDS:
            _index = _load_index()
            _index_loaded_at = now
        found = _index.get(_key(project_path, anchor))
    return dict(found) if found else None


def _field(project: Any, name: str) -> Any:
    return project.get(name) if isinstance(project, dict) else getattr(project, name, None)


def save(project: Any, config: path_config_service.PathConfig) -> Dict[str, Any]:
    """Merge ``config`` into the project's stored settings. Nothing touches the checkout."""

    from app.services.workspace_service import workspace

    project_id = str(_field(project, "id") or "")
    row = workspace.get_project_by_id(project_id) if project_id else None
    if not row:
        raise ValueError(f"Project '{project_id}' not found")
    stored: Dict[str, Any] = dict(row.get("path_settings") or {})
    updates = config.dict(exclude_none=True)
    stored.update({field: updates[field] for field in STORED_FIELDS if field in updates})
    if not workspace.update_project(project_id, path_settings=Jsonb(stored)):
        raise ValueError(f"Project '{project_id}' not found")
    invalidate()
    path_config_service.clear_config_cache(str(_field(project, "path") or "") or None)
    return stored


# ---------------------------------------------------------------------------
# One-time import of a Prism-written .prism.json
# ---------------------------------------------------------------------------


def _committed_prism_json(checkout: Path) -> Optional[Dict[str, Any]]:
    """The file as committed at HEAD; ``None`` when it is untracked or unchanged."""

    status = subprocess.run(
        ["git", "-C", str(checkout), "status", "--porcelain", "--", ".prism.json"],
        capture_output=True, text=True, check=False,
    )
    if status.returncode != 0 or not status.stdout.strip():
        return None
    if status.stdout.startswith("??"):
        return {}
    head = subprocess.run(
        ["git", "-C", str(checkout), "show", "HEAD:./.prism.json"],
        capture_output=True, text=True, check=False,
    )
    try:
        committed = json.loads(head.stdout) if head.returncode == 0 else {}
    except json.JSONDecodeError:
        committed = {}
    return committed if isinstance(committed, dict) else {}


def prism_written_settings(checkout: Path, anchor: Optional[str]) -> Dict[str, Any]:
    """Values a Prism edit wrote into the checkout's ``.prism.json``.

    Only an untracked file, or the keys of a tracked file that differ from
    HEAD, count: a clean committed file is the repository's own configuration.
    """

    path = checkout / ".prism.json"
    if not path.is_file():
        return {}
    committed = _committed_prism_json(checkout)
    if committed is None:
        return {}
    try:
        working = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(working, dict):
        return {}
    now = path_config_service.config_for_anchor(working, anchor)
    before = path_config_service.config_for_anchor(committed, anchor)
    return {
        field: now[field]
        for field in STORED_FIELDS
        if field in now and now[field] != before.get(field)
    }


def import_working_tree_settings(conn: Any, abs_clone_path: Callable[[str], str]) -> int:
    """Copy Prism-written ``.prism.json`` values into the database, once per project.

    Runs after the workspace migrations. The file is left as it is (it may hold
    a user's edits); the stored copy wins from now on. Returns how many
    projects received settings.
    """

    rows = conn.execute(
        """SELECT p.id, p.relative_path, p.project_file_rel, p.path_settings, r.clone_path
           FROM ws_projects p JOIN ws_repositories r ON r.id = p.repo_id
           WHERE NOT p.path_settings_checked"""
    ).fetchall()
    imported = 0
    for row in rows:
        checkout = Path(_checkout_path(abs_clone_path(row["clone_path"]), row["relative_path"]))
        found = prism_written_settings(checkout, row["project_file_rel"]) if checkout.is_dir() else {}
        if found:
            merged = {**found, **dict(row["path_settings"] or {})}
            conn.execute(
                "UPDATE ws_projects SET path_settings=%s, path_settings_checked=TRUE WHERE id=%s",
                (Jsonb(merged), row["id"]),
            )
            imported += 1
        else:
            conn.execute("UPDATE ws_projects SET path_settings_checked=TRUE WHERE id=%s", (row["id"],))
    return imported
