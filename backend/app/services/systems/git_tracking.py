"""Git-tracked systems: the manifest committed on snapshot (CONTRACTS_P2 §21, D-P2-42..45, SB2-53).

Prism keeps a private bare clone per linked system and never uses a working tree:
a commit is the branch tip's tree with ``prism.system.json`` replaced, built with
plumbing and pushed under a lease on the fetched tip, never forced. A manifest on
the branch that differs from the one Prism last pushed or imported is an outside
change; it refuses commits until SB2-54 imports it through a review.

``sync`` and ``commit_snapshot`` take the workspace connection factory so tests can
run them against an isolated schema; the job handlers pass the workspace one.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, ContextManager, Mapping, Optional

from psycopg.types.json import Jsonb

from app.core.config import settings
from app.services.git_failures import GitAccessError, describe_git_failure

logger = logging.getLogger(__name__)

MANIFEST_FILE = "prism.system.json"
COMMITTER = ("KiCAD Prism", "prism@kicad-prism.invalid")
GIT_ACTOR = "system:git"
SYNC_JOB_KIND = "system_git_sync"
COMMIT_JOB_KIND = "system_git_commit"
PUSH_ATTEMPTS = 3
_TIMEOUT = 120

Connect = Callable[[], ContextManager[Any]]


class LeaseRejected(Exception):
    """The branch moved since the fetch: someone pushed in between."""


@dataclass(frozen=True)
class Author:
    name: str
    email: str


def repos_root() -> Path:
    from app.services import project_service

    configured = settings.PRISM_SYSTEM_REPOS_ROOT.strip()
    return Path(configured) if configured else Path(project_service.PROJECTS_ROOT) / ".kicad-prism" / "system-repos"


def clone_path(system_id: str) -> Path:
    return repos_root() / f"{system_id}.git"


def manifest_bytes(manifest: Mapping[str, Any]) -> bytes:
    """§21.1: sorted keys, two-space indentation, a trailing newline."""
    return (json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def author_of(snapshot: Mapping[str, Any]) -> Author:
    """The Prism user who took the snapshot (D-P2-43), as recorded when it was queued."""
    recorded = (snapshot.get("git") or {}).get("author") or {}
    email = str(recorded.get("email") or str(snapshot.get("created_by") or "").removeprefix("user:") or "")
    name = str(recorded.get("name") or "").strip() or email.split("@", 1)[0] or "Prism user"
    return Author(name=name, email=email or "unknown@kicad-prism.invalid")


def commit_message(snapshot: Mapping[str, Any]) -> str:
    parts = [f"Snapshot {snapshot['name']}"]
    if str(snapshot.get("note") or "").strip():
        parts.append(str(snapshot["note"]).strip())
    parts.append(f"Prism-System: {snapshot['system_id']}\nPrism-Snapshot: {snapshot['id']}")
    return "\n\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# Plumbing


def _env(extra: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    from app.services.project_import_service import git_env

    return {**git_env(), **(extra or {})}


def _git(repo: Path, *args: str, stdin: Optional[bytes] = None, env: Optional[Mapping[str, str]] = None) -> str:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args], input=stdin, capture_output=True, timeout=_TIMEOUT, env=_env(env),
        check=True,
    )
    return completed.stdout.decode("utf-8", "replace").strip()


def _access_error(error: BaseException, url: str) -> GitAccessError:
    reason, message = describe_git_failure(error, target=url)
    return GitAccessError(message, reason=reason)


def ensure_clone(path: Path, url: str) -> None:
    """A bare clone with ``origin`` at ``url``, fetching every branch into ``refs/remotes/origin``."""
    if not (path / "HEAD").exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", "--quiet", "--bare", str(path)], check=True, capture_output=True,
                       timeout=_TIMEOUT, env=_env())
        _git(path, "remote", "add", "origin", url)
        _git(path, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")
    elif _git(path, "remote", "get-url", "origin") != url:
        _git(path, "remote", "set-url", "origin", url)


def fetch(path: Path, url: str, branch: str) -> Optional[str]:
    """Fetch and return the branch tip, or None while the branch does not exist."""
    try:
        _git(path, "fetch", "--quiet", "--prune", "origin")
    except subprocess.CalledProcessError as error:
        raise _access_error(error, url) from None
    return tip_of(path, branch)


def tip_of(path: Path, branch: str) -> Optional[str]:
    try:
        return _git(path, "rev-parse", "--verify", "--quiet", f"refs/remotes/origin/{branch}^{{commit}}") or None
    except subprocess.CalledProcessError:
        return None


def blob_at(path: Path, commit: Optional[str]) -> Optional[str]:
    if commit is None:
        return None
    try:
        return _git(path, "rev-parse", "--verify", "--quiet", f"{commit}:{MANIFEST_FILE}") or None
    except subprocess.CalledProcessError:
        return None


def blob_id(path: Path, content: bytes) -> str:
    return _git(path, "hash-object", "--stdin", stdin=content)


def build_commit(path: Path, parent: Optional[str], content: bytes, author: Author, message: str) -> str:
    """The parent's tree with the manifest replaced, committed on top of it."""
    blob = _git(path, "hash-object", "-w", "--stdin", stdin=content)
    with tempfile.TemporaryDirectory() as scratch:
        index = {"GIT_INDEX_FILE": str(Path(scratch) / "index")}
        if parent:
            _git(path, "read-tree", parent, env=index)
        else:
            _git(path, "read-tree", "--empty", env=index)
        _git(path, "update-index", "--add", "--cacheinfo", f"100644,{blob},{MANIFEST_FILE}", env=index)
        tree = _git(path, "write-tree", env=index)
    identity = {
        "GIT_AUTHOR_NAME": author.name, "GIT_AUTHOR_EMAIL": author.email,
        "GIT_COMMITTER_NAME": COMMITTER[0], "GIT_COMMITTER_EMAIL": COMMITTER[1],
    }
    parents = ["-p", parent] if parent else []
    return _git(path, "commit-tree", tree, *parents, stdin=message.encode("utf-8"), env=identity)


_LEASE_SIGNALS = ("stale info", "fetch first", "non-fast-forward", "[rejected]")
_DENIED_SIGNALS = ("permission to", "denied to", "write access", "protected branch", "pre-receive hook declined",
                   "read only", "read-only", "not allowed to push", "403")


def push(path: Path, url: str, branch: str, commit: str, expected: Optional[str]) -> None:
    """Push ``commit`` to the branch only if it is still at ``expected`` (None: absent)."""
    lease = f"--force-with-lease=refs/heads/{branch}:{expected or ''}"
    try:
        _git(path, "push", "--porcelain", lease, "origin", f"{commit}:refs/heads/{branch}")
    except subprocess.CalledProcessError as error:
        said = ((error.stdout or b"") + b"\n" + (error.stderr or b"")).decode("utf-8", "replace").casefold()
        if any(signal in said for signal in _LEASE_SIGNALS):
            raise LeaseRejected(branch) from None
        if any(signal in said for signal in _DENIED_SIGNALS):
            raise GitAccessError("The Git server refused the push: Prism's credentials can read this repository "
                                 "but not write to it.", reason="push-denied") from None
        raise _access_error(error, url) from None
    _git(path, "update-ref", f"refs/remotes/origin/{branch}", commit)


# ---------------------------------------------------------------------------
# Rows


def _link(conn: Any, system_id: str, *, lock: bool = False) -> Optional[dict]:
    row = conn.execute(
        f"SELECT * FROM system_git_links WHERE system_id = %s{' FOR UPDATE' if lock else ''}", (system_id,)
    ).fetchone()
    return dict(row) if row else None


def _set_snapshot_git(conn: Any, snapshot_id: str, git: Mapping[str, Any]) -> None:
    conn.execute("UPDATE system_snapshots SET git = %s WHERE id = %s", (Jsonb(dict(git)), snapshot_id))


def _audit(conn: Any, system_id: str, kind: str, payload: Mapping[str, Any]) -> None:
    from app.services.systems.store_base import new_id

    conn.execute(
        "INSERT INTO system_audit_events (id, system_id, actor, kind, payload) VALUES (%s, %s, %s, %s, %s)",
        (new_id("sae_"), system_id, GIT_ACTOR, kind, Jsonb(dict(payload))),
    )


def _record_fetch(conn: Any, system_id: str, *, tip: Optional[str], error: Optional[GitAccessError]) -> None:
    conn.execute(
        """
        UPDATE system_git_links SET last_fetched_at = NOW(), tip = COALESCE(%s, tip), last_error = %s
        WHERE system_id = %s
        """,
        (tip, Jsonb({"reason": error.reason, "message": str(error)}) if error else None, system_id),
    )


def read_blob(path: Path, blob: Optional[str]) -> Optional[bytes]:
    if blob is None:
        return None
    completed = subprocess.run(["git", "-C", str(path), "cat-file", "blob", blob], capture_output=True,
                               timeout=_TIMEOUT, env=_env(), check=True)
    return completed.stdout


def parse_manifest(system_id: str, content: Optional[bytes]) -> tuple[Optional[dict], list[str]]:
    """The outside manifest as JSON, and why it cannot be imported (empty when it can)."""
    from pydantic import ValidationError

    from app.services.systems.manifest_schema import Manifest

    if content is None:
        return None, [f"{MANIFEST_FILE} was removed from the branch"]
    try:
        data = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return None, [f"{MANIFEST_FILE} is not JSON: {error}"]
    try:
        manifest = Manifest.model_validate(data)
    except ValidationError as error:
        return data, [f"{'.'.join(str(p) for p in problem['loc']) or 'manifest'}: {problem['msg']}"
                      for problem in error.errors()[:20]]
    if manifest.system.id != system_id:
        return data, [f"the manifest is of system {manifest.system.id}, not this one"]
    return data, []


def _open_review(conn: Any, link: Mapping[str, Any], path: Path, outside: str) -> None:
    """§21.3 (SB2-54): a ``manifest_import`` review of the outside manifest, replacing any open one."""
    from app.services.systems import manifest as manifest_io
    from app.services.systems.store import SystemStore

    store = SystemStore(conn)
    blob = blob_at(path, outside)
    data, problems = parse_manifest(link["system_id"], read_blob(path, blob))
    known = read_blob(path, link["known_blob"])
    before = json.loads(known.decode("utf-8")) if known else {}
    with store.mutation(link["system_id"], expected_version=None, actor=GIT_ACTOR, archived_ok=True) as change:
        _close_open_reviews(store, change)
        store.open_review(change, instance_id=None, kind="manifest_import", from_commit=link["tip"],
                          to_commit=outside, pending_changes={
                              "blob": blob, "problems": problems,
                              "summary": manifest_io.difference(before, data) if data is not None and not problems
                              else None})


def _close_open_reviews(store: Any, change: Any) -> None:
    rows = store.conn.execute(
        "SELECT id FROM system_reviews WHERE system_id = %s AND kind = 'manifest_import' AND status = 'open'",
        (change.system_id,),
    ).fetchall()
    for row in rows:
        store.set_review_status(change, row["id"], "superseded", audit_kind="review_superseded")


def _detect(conn: Any, link: Mapping[str, Any], path: Path, tip: Optional[str]) -> Optional[str]:
    """§21.3: the outside commit, when the tip's manifest is not the known one; also stores it,
    and opens (or, back in sync, closes) its import review."""
    outside = tip if blob_at(path, tip) != link["known_blob"] else None
    if outside != link["outside_commit"]:
        conn.execute("UPDATE system_git_links SET outside_commit = %s WHERE system_id = %s",
                     (outside, link["system_id"]))
        if outside is not None:
            _open_review(conn, link, path, outside)
        else:
            from app.services.systems.store import SystemStore

            store = SystemStore(conn)
            with store.mutation(link["system_id"], expected_version=None, actor=GIT_ACTOR, archived_ok=True) as change:
                _close_open_reviews(store, change)
    return outside


# ---------------------------------------------------------------------------
# Jobs


def sync(connect: Connect, system_id: str) -> dict:
    """Clone when missing, fetch, and detect an outside change (§21.4)."""
    with connect() as conn:
        link = _link(conn, system_id)
    if link is None:
        return {"outcome": "unlinked"}
    path = clone_path(system_id)
    try:
        ensure_clone(path, link["url"])
        tip = fetch(path, link["url"], link["branch"])
    except GitAccessError as error:
        with connect() as conn:
            _record_fetch(conn, system_id, tip=None, error=error)
            conn.commit()
        return {"outcome": "failed", "reason": error.reason}
    with connect() as conn:
        link = _link(conn, system_id, lock=True)
        if link is None:
            return {"outcome": "unlinked"}
        _record_fetch(conn, system_id, tip=tip, error=None)
        outside = _detect(conn, link, path, tip)
        conn.commit()
    return {"outcome": "outside_change" if outside else "in_sync", "tip": tip}


def _newer_pushed(conn: Any, snapshot: Mapping[str, Any]) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM system_snapshots
        WHERE system_id = %s AND id <> %s AND git ->> 'state' = 'pushed'
          AND (created_at, id) > (%s, %s)
        LIMIT 1
        """,
        (snapshot["system_id"], snapshot["id"], snapshot["created_at"], snapshot["id"]),
    ).fetchone()
    return row is not None


def _snapshot(conn: Any, system_id: str, snapshot_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT id, system_id, name, note, created_by, created_at, manifest, git FROM system_snapshots "
        "WHERE system_id = %s AND id = %s",
        (system_id, snapshot_id),
    ).fetchone()
    return dict(row) if row else None


def _finish(connect: Connect, snapshot: Mapping[str, Any], state: Mapping[str, Any], *,
            link_update: Optional[Mapping[str, Any]] = None, audit: Optional[tuple[str, dict]] = None) -> dict:
    git = {**{k: v for k, v in (snapshot.get("git") or {}).items() if k == "author"}, **state}
    with connect() as conn:
        _set_snapshot_git(conn, snapshot["id"], git)
        if link_update:
            assignments = ", ".join(f"{column} = %s" for column in link_update)
            conn.execute(f"UPDATE system_git_links SET {assignments} WHERE system_id = %s",
                         (*link_update.values(), snapshot["system_id"]))
        if audit:
            _audit(conn, snapshot["system_id"], *audit)
        conn.commit()
    return dict(state)


def commit_snapshot(connect: Connect, system_id: str, snapshot_id: str) -> dict:
    """§21.2: commit the snapshot's manifest to the linked branch. Returns the stored status."""
    with connect() as conn:
        snapshot = _snapshot(conn, system_id, snapshot_id)
        link = _link(conn, system_id)
        newer = snapshot is not None and _newer_pushed(conn, snapshot)
    if snapshot is None:
        return {"state": "missing"}
    if (snapshot.get("git") or {}).get("state") == "pushed":
        return {key: value for key, value in snapshot["git"].items() if key != "author"}
    if link is None:
        return _finish(connect, snapshot, {"state": "failed", "reason": "unlinked",
                                           "message": "The system is no longer linked to a repository."})
    if newer:
        return _finish(connect, snapshot, {"state": "skipped"})

    path, branch, url = clone_path(system_id), link["branch"], link["url"]
    content = manifest_bytes(snapshot["manifest"])
    try:
        ensure_clone(path, url)
        for _attempt in range(PUSH_ATTEMPTS):
            tip = fetch(path, url, branch)
            ours = blob_id(path, content)
            current = blob_at(path, tip)
            if current == ours:  # pushed before the status was stored (a retried job)
                return _finish(connect, snapshot, {"state": "pushed", "commit": tip, "branch": branch},
                               link_update={"tip": tip, "known_blob": ours, "outside_commit": None})
            if current != link["known_blob"] or link["outside_commit"]:
                if current != link["known_blob"]:
                    with connect() as conn:
                        locked = _link(conn, system_id, lock=True)
                        if locked is not None:
                            _detect(conn, locked, path, tip)
                        conn.commit()
                outside = tip if current != link["known_blob"] else link["outside_commit"]
                return _finish(connect, snapshot, {"state": "refused", "reason": "outside-change", "commit": outside},
                               link_update={"tip": tip},
                               audit=("snapshot_commit_refused", {"snapshotId": snapshot_id, "commit": outside}))
            commit = build_commit(path, tip, content, author_of(snapshot), commit_message(snapshot))
            try:
                push(path, url, branch, commit, tip)
            except LeaseRejected:
                continue
            return _finish(connect, snapshot, {"state": "pushed", "commit": commit, "branch": branch},
                           link_update={"tip": commit, "known_blob": ours, "last_error": None},
                           audit=("snapshot_committed",
                                  {"snapshotId": snapshot_id, "commit": commit, "branch": branch}))
        return _finish(connect, snapshot, {"state": "failed", "reason": "branch-busy",
                                           "message": f"{branch} kept moving while Prism pushed; try again."})
    except GitAccessError as error:
        return _finish(connect, snapshot, {"state": "failed", "reason": error.reason, "message": str(error)})


def remove_clone(system_id: str) -> None:
    shutil.rmtree(clone_path(system_id), ignore_errors=True)


def enqueue_sync(system_id: str, *, requested_by: str = GIT_ACTOR) -> dict:
    from app.services.job_service import jobs

    return jobs.enqueue(
        SYNC_JOB_KIND, {"systemId": system_id}, worker_pool="prism", artifact_key=f"system-git-sync:{system_id}",
        requested_by=requested_by, priority=150, max_attempts=1, resources={"prism_worker": 1},
        locks=[{"key": f"system-git:{system_id}", "mode": "write"}],
    )


def enqueue_commit(system_id: str, snapshot_id: str, *, requested_by: str = GIT_ACTOR) -> dict:
    from app.services.job_service import jobs

    return jobs.enqueue(
        COMMIT_JOB_KIND, {"systemId": system_id, "snapshotId": snapshot_id}, worker_pool="prism",
        artifact_key=f"system-git-commit:{snapshot_id}", requested_by=requested_by, priority=120, max_attempts=1,
        resources={"prism_worker": 1}, locks=[{"key": f"system-git:{system_id}", "mode": "write"}],
    )


def enqueue_due_fetches(connect: Connect, *, interval_seconds: int, limit: int = 8) -> int:
    """§21.4 (SB2-54): queue a sync for linked systems not fetched within ``interval_seconds``."""
    if interval_seconds <= 0:
        return 0
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT l.system_id FROM system_git_links l JOIN system_projects s ON s.id = l.system_id
            WHERE s.archived_at IS NULL
              AND (l.last_fetched_at IS NULL OR l.last_fetched_at < NOW() - make_interval(secs => %s))
            ORDER BY l.last_fetched_at NULLS FIRST, l.system_id LIMIT %s
            """,
            (interval_seconds, limit),
        ).fetchall()
    for row in rows:
        enqueue_sync(row["system_id"], requested_by="system:auto-sync")
    return len(rows)


def run_sync_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult
    from app.services.systems.jobs import workspace_connection

    context.progress(stage="system-git-sync", message="Fetching the system repository", percent=10, force=True)
    outcome = sync(workspace_connection, str(context.payload["systemId"]))
    return JobResult(message=f"System repository: {outcome['outcome']}", details=outcome)


def run_commit_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult
    from app.services.systems.jobs import workspace_connection

    context.progress(stage="system-git-commit", message="Committing the snapshot", percent=10, force=True)
    state = commit_snapshot(workspace_connection, str(context.payload["systemId"]),
                            str(context.payload["snapshotId"]))
    return JobResult(message=f"Snapshot commit: {state['state']}", details=state)
