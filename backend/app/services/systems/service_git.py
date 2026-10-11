"""Git-tracked systems on the service: the link and commit-on-snapshot (CONTRACTS_P2 §21, SB2-53).

The Git work itself runs in jobs (``git_tracking``); this mixin keeps the link,
refuses snapshots while an outside change waits for review, and queues jobs
after the transaction commits.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Mapping, Optional

from psycopg import errors as pg_errors
from psycopg.types.json import Jsonb

from app.services.systems import git_tracking
from app.services.systems.service_base import Caller, Result, _iso
from app.services.systems.sources import SourceError, valid_tracked_ref
from app.services.systems.store import Conflict, Forbidden, Invalid, NotFound, SystemStore

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Remote:
    """A remote that passed the import URL policy and answered ``ls-remote``."""

    url: str
    dedup_key: str
    default_branch: Optional[str]


def resolve_remote(url: str) -> Remote:
    """§21.1: the project-import URL policy and a read-only reachability check."""
    from app.services.git_access_service import check_repository_access
    from app.services.git_remote_url import RemoteUrlError, parse_remote_url
    from app.services.git_remote_access import git_env, remote_url_policy

    try:
        parsed = parse_remote_url(url, remote_url_policy())
    except RemoteUrlError as error:
        raise Invalid(f"git_url_invalid: {error}") from None
    access = check_repository_access(parsed, git_env=git_env())
    if not access.authorized:
        raise Invalid(f"git_unreachable: {access.reason}: {access.message}")
    return Remote(url=parsed.url, dedup_key=parsed.dedup_key, default_branch=access.default_branch)


def link_document(row: Optional[Mapping[str, Any]]) -> Optional[dict]:
    if row is None:
        return None
    return {"url": row["url"], "branch": row["branch"], "tip": row["tip"], "knownBlob": row["known_blob"],
            "outsideCommit": row["outside_commit"], "lastFetchedAt": _iso(row["last_fetched_at"]),
            "lastError": row["last_error"], "linkedBy": row["linked_by"], "linkedAt": _iso(row["linked_at"])}


class GitMixin:
    _git_remote = staticmethod(resolve_remote)
    _git_enqueue_sync = staticmethod(git_tracking.enqueue_sync)
    _git_enqueue_commit = staticmethod(git_tracking.enqueue_commit)

    def _git_link_row(self, store: SystemStore, system_id: str) -> Optional[dict]:
        row = store.conn.execute("SELECT * FROM system_git_links WHERE system_id = %s", (system_id,)).fetchone()
        return dict(row) if row else None

    def git_link(self, caller: Caller, system_id: str) -> Optional[dict]:
        with self._tx() as store:
            self._system(store, system_id, caller)
            return link_document(self._git_link_row(store, system_id))

    def set_git_link(self, caller: Caller, system_id: str, version: int, url: str,
                     branch: Optional[str] = None) -> Result:
        """Link the system to ``url``'s ``branch`` (default: the repository's default branch), or change it."""
        remote = self._git_remote(url.strip())
        try:
            branch = valid_tracked_ref(branch or remote.default_branch or "main")
        except SourceError as error:
            raise Invalid(str(error)) from None
        with self._tx() as store:
            self._system(store, system_id, caller)
            previous = self._git_link_row(store, system_id)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                same = previous is not None and (previous["dedup_key"], previous["branch"]) == (remote.dedup_key, branch)
                try:
                    with store.conn.transaction():
                        store.conn.execute(
                            """
                            INSERT INTO system_git_links (system_id, url, dedup_key, branch, linked_by)
                            VALUES (%(system)s, %(url)s, %(key)s, %(branch)s, %(actor)s)
                            ON CONFLICT (system_id) DO UPDATE SET
                                url = EXCLUDED.url, dedup_key = EXCLUDED.dedup_key, branch = EXCLUDED.branch,
                                linked_by = EXCLUDED.linked_by, linked_at = NOW(), last_error = NULL,
                                tip = CASE WHEN %(same)s THEN system_git_links.tip END,
                                known_blob = CASE WHEN %(same)s THEN system_git_links.known_blob END,
                                outside_commit = CASE WHEN %(same)s THEN system_git_links.outside_commit END,
                                last_fetched_at = CASE WHEN %(same)s THEN system_git_links.last_fetched_at END
                            """,
                            {"system": system_id, "url": remote.url, "key": remote.dedup_key, "branch": branch,
                             "actor": caller.actor, "same": same},
                        )
                except pg_errors.UniqueViolation:
                    raise Conflict("git_link_in_use: another system is linked to this repository branch") from None
                change.audit("git_relinked" if previous else "git_linked", {"url": remote.url, "branch": branch})
            row = self._git_link_row(store, system_id)
        self._git_quietly(self._git_enqueue_sync, system_id, requested_by=caller.email)
        return Result(link_document(row), system_id, change.version)

    def remove_git_link(self, caller: Caller, system_id: str, version: int) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                removed = store.conn.execute("DELETE FROM system_git_links WHERE system_id = %s RETURNING url",
                                             (system_id,)).fetchone()
                if removed is None:
                    raise NotFound("The system is not linked to a repository")
                change.audit("git_unlinked", {"url": removed["url"]})
        git_tracking.remove_clone(system_id)
        return Result(None, system_id, change.version)

    def fetch_git(self, caller: Caller, system_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            if self._git_link_row(store, system_id) is None:
                raise NotFound("The system is not linked to a repository")
        job = self._git_enqueue_sync(system_id, requested_by=caller.email)
        return {"jobId": job["id"]}

    def retry_snapshot_git(self, caller: Caller, system_id: str, snapshot_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            link = self._git_link_row(store, system_id)
            snapshot = store.get_snapshot(system_id, snapshot_id)
            state = (snapshot.get("git") or {}).get("state")
            if link is None:
                raise Conflict("git_not_linked: the system is not linked to a repository")
            if state not in {"failed", "refused"}:
                raise Conflict(f"git_not_retryable: the snapshot's commit is {state or 'not tracked'}")
            if state == "refused" and link["outside_commit"]:
                raise Conflict(f"git_outside_change: {link['outside_commit']} changed {git_tracking.MANIFEST_FILE} "
                               "outside Prism; import it first")
            store.conn.execute("UPDATE system_snapshots SET git = %s WHERE id = %s",
                               (Jsonb(self._queued_git(snapshot.get("git"))), snapshot_id))
        job = self._git_enqueue_commit(system_id, snapshot_id, requested_by=caller.email)
        return {"jobId": job["id"]}

    def decide_manifest_import(self, caller: Caller, system_id: str, version: int, review_id: str,
                               decision: str) -> Result:
        """§21.3 (SB2-54): accept (the system becomes the outside manifest) or reject (Prism's stays,
        and the next snapshot replaces the outside one). Either way the outside change is cleared."""
        from app.services.systems import manifest as manifest_io
        from app.services.systems import visibility
        from app.services.systems.manifest_schema import Manifest

        if decision not in {"accept", "reject"}:
            raise Invalid("decision must be accept or reject")
        with self._tx() as store:
            self._system(store, system_id, caller)
            try:
                review = store.get_review(system_id, review_id)
            except NotFound:
                raise NotFound("Review not found") from None
            link = self._git_link_row(store, system_id)
            if review["kind"] != "manifest_import" or review["status"] != "open":
                raise Conflict("review_closed: this review is not an open manifest import")
            if link is None or link["outside_commit"] != review["to_commit"]:
                raise Conflict("review_stale: the branch moved on since this review opened; fetch and review again")
            blob = (review.get("pending_changes") or {}).get("blob")
            manifest = None
            if decision == "accept":
                data, problems = git_tracking.parse_manifest(
                    system_id, git_tracking.read_blob(git_tracking.clone_path(system_id), blob))
                if problems:
                    raise Invalid("manifest_invalid: " + "; ".join(problems))
                manifest = Manifest.model_validate(data)
                projects = [i.projectId for i in manifest.instances if i.kind == "board"]
                access = visibility.project_access(store.conn, projects, caller.role)
                if any(not (access.get(p) or {}).get("visible") for p in projects):
                    raise Forbidden("the manifest names a board you cannot see")
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                if manifest is not None:
                    manifest_io.replace_contents(store, change, manifest)
                    # SB2-97: the direct limits hold through the store's writes; the hierarchy's (depth,
                    # flattened boards, cycles) are checked here, so a refused import rolls back whole.
                    self._tree(store, system_id)
                    store.set_review_status(change, review_id, "applied", audit_kind="manifest_imported",
                                            payload={"commit": review["to_commit"]})
                else:
                    store.set_review_status(change, review_id, "closed", audit_kind="manifest_import_rejected",
                                            payload={"commit": review["to_commit"]})
                store.conn.execute(
                    "UPDATE system_git_links SET known_blob = %s, outside_commit = NULL WHERE system_id = %s",
                    (blob, system_id))
                body = self._review_doc(store, store.get_review(system_id, review_id), False)
        for instance in manifest.instances if manifest is not None else ():
            if instance.kind == "board":
                self._enqueue_quietly(instance.projectId, instance.baselineCommit, caller)
        return Result(body, system_id, change.version)

    # ------------------------------------------------------------------
    # Publishing (§21.6, D-P2-46)

    def _publication_git(self, store: SystemStore, system_id: str,
                         git: Optional[Mapping[str, Any]]) -> Optional[dict]:
        """The commit a snapshot's revision records, or None. A commit still in flight is a 409, so a
        linked system's revision never misses a commit that is about to exist."""
        state = (git or {}).get("state")
        if state == "queued":
            raise Conflict("git_commit_pending: the snapshot is still being committed; publish it once it is")
        if state != "pushed":
            return None
        link = self._git_link_row(store, system_id)
        return {"url": link["url"] if link else None, "branch": git["branch"], "commit": git["commit"]}

    def snapshot_for_commit(self, caller: Caller, system_id: str, commit: str) -> str:
        """The snapshot Prism pushed as ``commit``; only those commits can be published."""
        commit = (commit or "").strip().lower()
        if len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit):
            raise Invalid("commit must be a full 40-character SHA")
        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.conn.execute(
                "SELECT id FROM system_snapshots WHERE system_id = %s AND git ->> 'state' = 'pushed' "
                "AND git ->> 'commit' = %s",
                (system_id, commit),
            ).fetchone()
        if row is None:
            raise NotFound("commit_not_a_snapshot: only a commit Prism pushed for a snapshot can be published")
        return str(row["id"])

    # ------------------------------------------------------------------
    # Snapshot hooks (``create_snapshot``)

    @staticmethod
    def _queued_git(previous: Optional[Mapping[str, Any]] = None, caller: Optional[Caller] = None) -> dict:
        author = (previous or {}).get("author") or {"name": caller.name if caller else "",
                                                    "email": caller.email if caller else ""}
        return {"state": "queued", "author": author}

    def _snapshot_git(self, store: SystemStore, system_id: str, caller: Caller) -> Optional[dict]:
        """The new snapshot's ``git`` status, or a 409 while an outside change waits (§21.3)."""
        link = self._git_link_row(store, system_id)
        if link is None:
            return None
        if link["outside_commit"]:
            raise Conflict(f"git_outside_change: {link['outside_commit']} changed {git_tracking.MANIFEST_FILE} "
                           "outside Prism; import it through review before taking a snapshot")
        return self._queued_git(caller=caller)

    def _git_quietly(self, enqueue: Any, *args: Any, requested_by: str) -> None:
        try:
            enqueue(*args, requested_by=requested_by)
        except Exception:  # the link or snapshot is stored; a fetch or retry queues it again
            logger.exception("Could not queue Git work for %s", args)
