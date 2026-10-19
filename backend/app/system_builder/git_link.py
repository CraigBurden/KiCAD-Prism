"""A system linked to a file on a repository branch (docs/system-builder/CONTRACTS.md §13).

The link row names the project, the branch and the repository-relative path of
one ``.system.json`` file. Committing writes the document at the request's
version there: a temporary clone, one commit whose author is the caller and
whose committer is Prism, a push leased against the fetched head, then a
fast-forward of Prism's mirror. Prism never pulls on its own; importing the
file is a separate request, applied through the ordinary operations engine as
one undoable version (:mod:`app.system_builder.ops`).

Divergence is a state, not an error to retry: while the file at the fetched
head is not the blob Prism wrote last, a commit fails ``system_git_diverged``
with that blob and pushes nothing. Importing it is how the user accepts it.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, ContextManager, Mapping, Optional

from app.core import errors
from app.release_studio.git_publish import GitPublishError, run_git
from app.services import project_revision
from app.services.git_remote_access import git_env
from app.services.job_kinds import JobKind, JobSubject, repository_lock
from app.services.job_runtime import JobContext, JobResult, PermanentJobError, RetryableJobError
from app.system_builder.document import canonical, clone
from app.system_builder.store import workspace_connection

logger = logging.getLogger(__name__)

KIND = "system_git_commit"

PATH_SUFFIX = ".system.json"
DEFAULT_DIRECTORY = "systems"
BRANCH = "origin"
COMMITTER_NAME = "Prism System Builder"

DIVERGED = "diverged"
UNCHANGED = "unchanged"
COMMIT = "commit"


class NotLinked(errors.Conflict):
    """The system has no Git link (§13.1)."""

    code = "system_git_not_linked"
    default_detail = "The system is not linked to a Git file"


class PathInvalid(errors.Invalid):
    """The linked path is not a repository-relative ``.system.json`` (§13.1)."""

    code = "system_git_path_invalid"


class BranchInvalid(errors.Invalid):
    """The branch name cannot name a branch Git will fetch or push."""

    code = "system_git_branch_invalid"


class ProjectUnavailable(errors.UpstreamFailure):
    """The linked project's repository could not be read or written."""

    code = "system_git_unavailable"
    default_detail = "The project's Git repository is unavailable"


class GitFailure(RuntimeError):
    """A Git command failed. ``detail`` is logged, never sent to a client."""

    def __init__(self, message: str, detail: str = "") -> None:
        super().__init__(message)
        self.detail = detail


class BranchMissing(GitFailure):
    """The linked branch does not exist in the project's repository."""


class MirrorDirty(GitFailure):
    """The mirror has tracked local changes, so committing would bypass it."""


# --------------------------------------------------------------- path rules


def slug(name: str) -> str:
    """A system name as a lower-case kebab-case path component."""

    text = re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")
    return text or "system"


def default_path(name: str) -> str:
    """``systems/<slug>.system.json`` for a system named ``name`` (§13.1)."""

    return f"{DEFAULT_DIRECTORY}/{slug(name)}{PATH_SUFFIX}"


def validate_path(path: str) -> str:
    """Return ``path`` when it is a safe repository-relative system file.

    A path is POSIX, relative, ends in ``.system.json``, and may neither leave
    the repository (``..``, an absolute or drive prefix) nor enter ``.git``.
    """

    text = str(path or "")
    if not text or text != text.strip():
        raise PathInvalid("A repository-relative path ending in .system.json is required")
    if "\\" in text:
        raise PathInvalid("A repository path uses forward slashes")
    if text.startswith("/") or re.match(r"^[A-Za-z]:", text):
        raise PathInvalid("A repository path may not be absolute")
    if any(ord(character) < 32 for character in text):
        raise PathInvalid("A repository path may not contain control characters")
    parts = text.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise PathInvalid("A repository path may not be empty, '.', or '..'")
    if any(part.lower() == ".git" for part in parts):
        raise PathInvalid("A repository path may not enter .git")
    name = parts[-1]
    if not name.endswith(PATH_SUFFIX) or name == PATH_SUFFIX:
        raise PathInvalid(f"A system file's name ends in {PATH_SUFFIX}")
    return text


def validate_branch(branch: str) -> str:
    """Return ``branch`` when Git will accept it as a branch name."""

    text = str(branch or "").strip()
    forbidden = set(" ~^:?*[\\")
    if (
        not text
        or text.startswith("-")
        or text.startswith("/")
        or text.endswith("/")
        or text.endswith(".")
        or ".." in text
        or "//" in text
        or "@{" in text
        or any(character.isspace() or character in forbidden for character in text)
    ):
        raise BranchInvalid("That is not a valid branch name")
    if any(part.startswith(".") or part.endswith(".lock") for part in text.split("/")):
        raise BranchInvalid("That is not a valid branch name")
    return text


# --------------------------------------------------------------- file bytes


def file_bytes(document: Mapping[str, Any]) -> bytes:
    """The document as §13.2 writes it: sorted keys, two-space indent, one LF."""

    payload = json.dumps(
        canonical(clone(document)), indent=2, sort_keys=True, ensure_ascii=False
    )
    return f"{payload}\n".encode("utf-8")


def commit_outcome(*, last_blob: str, head_blob: str, desired_blob: str) -> str:
    """What a commit would do, before it touches a repository (§13.2)."""

    if (last_blob or "") != (head_blob or ""):
        return DIVERGED
    if (head_blob or "") == (desired_blob or ""):
        return UNCHANGED
    return COMMIT


# -------------------------------------------------------------------- link


_LINK_COLUMNS = (
    "system_id, project_id, branch, path, last_commit, last_blob, "
    "last_version, linked_by, linked_at"
)

Connect = Callable[[], ContextManager[Any]]


class GitLinkStore:
    """``ws_system_git_links`` and the last commit job queued for a system."""

    def __init__(self, connect: Connect = workspace_connection) -> None:
        self._connect = connect

    def read(self, system_id: str) -> Optional[dict[str, Any]]:
        """The link row, or None when the system has no link."""

        with self._connect() as conn:
            row = conn.execute(
                f"SELECT {_LINK_COLUMNS} FROM ws_system_git_links WHERE system_id = %s",
                (system_id,),
            ).fetchone()
        return dict(row) if row is not None else None

    def upsert(
        self, system_id: str, *, project_id: str, branch: str, path: str, linked_by: str,
    ) -> dict[str, Any]:
        """Create or relink; relinking clears the last commit and blob (§13.1)."""

        with self._connect() as conn:
            row = conn.execute(
                f"""
                INSERT INTO ws_system_git_links
                    (system_id, project_id, branch, path, linked_by)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (system_id) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    branch = EXCLUDED.branch,
                    path = EXCLUDED.path,
                    last_commit = NULL,
                    last_blob = NULL,
                    linked_by = EXCLUDED.linked_by,
                    linked_at = now()
                RETURNING {_LINK_COLUMNS}
                """,
                (system_id, project_id, branch, path, linked_by),
            ).fetchone()
        return dict(row)

    def unlink(self, system_id: str) -> bool:
        """Remove the link; True when one existed."""

        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM ws_system_git_links WHERE system_id = %s", (system_id,)
            )
            conn.commit()
        return cursor.rowcount > 0

    def record_commit(
        self, system_id: str, *, commit: str, blob: str, version: int,
    ) -> None:
        """Record what Prism wrote last (§13.2)."""

        with self._connect() as conn:
            conn.execute(
                """
                UPDATE ws_system_git_links
                   SET last_commit = %s, last_blob = %s, last_version = %s
                 WHERE system_id = %s
                """,
                (commit, blob, int(version), system_id),
            )
            conn.commit()

    def record_imported_blob(self, system_id: str, *, blob: str) -> None:
        """Accept the imported blob as the base of the next commit (§13.3)."""

        with self._connect() as conn:
            conn.execute(
                "UPDATE ws_system_git_links SET last_blob = %s WHERE system_id = %s",
                (blob, system_id),
            )
            conn.commit()

    def last_job(self, system_id: str) -> Optional[dict[str, Any]]:
        """The newest commit job this system queued, whatever its state."""

        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id AS job_id, status, error_code, error_message, payload,
                       created_at, updated_at
                  FROM ws_jobs
                 WHERE kind = %s AND payload->>'system_id' = %s
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
                """,
                (KIND, system_id),
            ).fetchone()
        return dict(row) if row is not None else None


def git_link_store() -> GitLinkStore:
    """The link store the job reads; tests replace the factory."""

    return GitLinkStore()


# ------------------------------------------------------------ remote reads


@dataclass(frozen=True)
class BranchFile:
    """The fetched branch head and, when present, the system file's blob."""

    repo_root: Path
    remote_url: str
    branch: str
    remote_ref: str
    head: str
    blob: str
    data: bytes


def _execute(
    *args: str,
    cwd: Path,
    env: Optional[Mapping[str, str]] = None,
    check_cancelled: Optional[Callable[[], None]] = None,
):
    try:
        return run_git(
            *args, cwd=cwd, env=env, check_cancelled=check_cancelled
        )
    except GitPublishError as error:
        raise GitFailure(f"git {args[0]} could not finish", str(error)) from error


def _output(
    *args: str,
    cwd: Path,
    env: Optional[Mapping[str, str]] = None,
    check_cancelled: Optional[Callable[[], None]] = None,
) -> str:
    result = _execute(*args, cwd=cwd, env=env, check_cancelled=check_cancelled)
    if result.returncode != 0:
        raise GitFailure(
            f"git {args[0]} failed", (result.stderr or result.stdout or "").strip()
        )
    return result.stdout.strip()


def _rev(repo_root: Path, ref: str, *, check_cancelled: Optional[Callable[[], None]] = None) -> str:
    """The object ``ref`` names, or ``""`` when it names none."""

    result = _execute("rev-parse", "--verify", ref, cwd=repo_root, check_cancelled=check_cancelled)
    return result.stdout.strip() if result.returncode == 0 else ""


def _current_branch(repo_root: Path) -> str:
    result = _execute("symbolic-ref", "--quiet", "--short", "HEAD", cwd=repo_root)
    return result.stdout.strip() if result.returncode == 0 else ""


def _project_root(project_id: str) -> Path:
    try:
        return project_revision.locate_id(project_id).repo_root
    except Exception as error:  # noqa: BLE001 - every locate failure is the same refusal
        raise GitFailure("the project repository is not available", str(error)) from error


def fetch_branch_file(
    project_id: str,
    branch: str,
    path: str,
    *,
    with_data: bool = False,
    check_cancelled: Optional[Callable[[], None]] = None,
) -> BranchFile:
    """Fetch ``branch`` and report its head, and the system file there.

    ``blob`` is empty when the file does not exist at the head. ``data`` is
    filled only with ``with_data``; a commit needs the blob id alone.
    """

    branch = validate_branch(branch)
    path = validate_path(path)
    repo_root = _project_root(project_id)
    network = git_env()
    remote_url = _output("remote", "get-url", BRANCH, cwd=repo_root)
    fetched = _execute(
        "fetch", "--prune", BRANCH, branch,
        cwd=repo_root, env=network, check_cancelled=check_cancelled,
    )
    if fetched.returncode != 0:
        raise GitFailure(
            "the branch could not be fetched",
            (fetched.stderr or fetched.stdout or "").strip(),
        )
    remote_ref = f"refs/remotes/{BRANCH}/{branch}"
    head = _rev(repo_root, f"{remote_ref}^{{commit}}", check_cancelled=check_cancelled)
    if not head:
        raise BranchMissing(f"The branch {branch!r} does not exist in the project's repository")
    blob = _rev(repo_root, f"{head}:{path}", check_cancelled=check_cancelled)
    data = b""
    if blob and with_data:
        result = _execute(
            "cat-file", "blob", blob, cwd=repo_root, check_cancelled=check_cancelled
        )
        if result.returncode != 0:
            raise GitFailure(
                "the system file could not be read",
                (result.stderr or result.stdout or "").strip(),
            )
        data = result.stdout.encode("utf-8")
    return BranchFile(
        repo_root=repo_root,
        remote_url=remote_url,
        branch=branch,
        remote_ref=remote_ref,
        head=head,
        blob=blob,
        data=data,
    )


def _hash_object(
    repo_root: Path,
    data: bytes,
    *,
    staging_root: Path,
    check_cancelled: Optional[Callable[[], None]] = None,
) -> str:
    """The blob id ``git add`` would store for ``data``, without writing it."""

    staging_root.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        dir=staging_root, prefix=".system-", suffix=".json", delete=False
    )
    try:
        with handle as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return _output(
            "hash-object", "--no-filters", "--", handle.name,
            cwd=repo_root, check_cancelled=check_cancelled,
        )
    finally:
        Path(handle.name).unlink(missing_ok=True)


# ------------------------------------------------------------------ commit


def _write_atomically(target: Path, data: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = ""
    try:
        with tempfile.NamedTemporaryFile(
            "wb", dir=target.parent, prefix=f".{target.name}.", suffix=".tmp", delete=False
        ) as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
            temporary = stream.name
        os.replace(temporary, target)
    finally:
        if temporary and Path(temporary).exists():
            Path(temporary).unlink()


def _check_mirror_is_clean(repo_root: Path, branch: str) -> None:
    """Refuse to publish past a mirror with tracked edits on the linked branch."""

    if _current_branch(repo_root) != branch:
        return
    result = _execute(
        "status", "--porcelain", "--untracked-files=no", cwd=repo_root
    )
    if result.returncode != 0:
        raise GitFailure(
            "failed to inspect the project mirror",
            (result.stderr or result.stdout or "").strip(),
        )
    if result.stdout.strip():
        raise MirrorDirty(
            "the project mirror has tracked local changes; Sync or clean it before committing"
        )


def _mirror_fast_forward(base: BranchFile, commit: str) -> None:
    """Bring Prism's mirror to the pushed commit without disturbing another branch."""

    repo_root = base.repo_root
    fetched = _execute("fetch", BRANCH, base.branch, cwd=repo_root, env=git_env())
    if fetched.returncode != 0:
        raise GitFailure(
            "the commit was pushed, but Prism could not refresh its mirror",
            (fetched.stderr or fetched.stdout or "").strip(),
        )
    if _current_branch(repo_root) == base.branch:
        merged = _execute("merge", "--ff-only", base.remote_ref, cwd=repo_root)
        if merged.returncode != 0:
            raise GitFailure(
                "the commit was pushed, but Prism could not fast-forward its mirror",
                (merged.stderr or merged.stdout or "").strip(),
            )
        return
    local = _rev(repo_root, f"refs/heads/{base.branch}")
    if not local:
        return
    ancestor = _execute("merge-base", "--is-ancestor", local, commit, cwd=repo_root)
    if ancestor.returncode == 0:
        _output(
            "update-ref", f"refs/heads/{base.branch}", commit, local, cwd=repo_root
        )


def _publish(
    base: BranchFile,
    *,
    path: str,
    data: bytes,
    message: str,
    author_name: str,
    author_email: str,
    staging_root: Path,
    check_cancelled: Optional[Callable[[], None]] = None,
) -> Optional[dict[str, str]]:
    """Commit ``data`` in a temporary clone and push it; None when it is unchanged."""

    _check_mirror_is_clean(base.repo_root, base.branch)
    publish_root = staging_root / "system-git"
    if publish_root.exists():
        shutil.rmtree(publish_root)
    _output(
        "clone", "--shared", "--no-checkout", str(base.repo_root), str(publish_root),
        cwd=staging_root, check_cancelled=check_cancelled,
    )
    _output("checkout", "--detach", base.head, cwd=publish_root, check_cancelled=check_cancelled)
    _output("remote", "add", "publish", base.remote_url, cwd=publish_root)

    target = (publish_root / path).resolve()
    try:
        target.relative_to(publish_root.resolve())
    except ValueError as error:
        raise GitFailure("the system path escapes the publication clone") from error
    _write_atomically(target, data)
    _output("add", "--", path, cwd=publish_root, check_cancelled=check_cancelled)

    changed = _execute("diff", "--cached", "--quiet", cwd=publish_root)
    if changed.returncode == 0:
        return None
    if changed.returncode != 1:
        raise GitFailure(
            "failed to inspect the system file change",
            (changed.stderr or changed.stdout or "").strip(),
        )

    commit_env = {
        **git_env(),
        "GIT_AUTHOR_NAME": author_name or author_email,
        "GIT_AUTHOR_EMAIL": author_email,
        # As Release Studio commits: Prism's name, the caller's address.
        "GIT_COMMITTER_NAME": COMMITTER_NAME,
        "GIT_COMMITTER_EMAIL": author_email,
    }
    committed = _execute(
        "-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message,
        cwd=publish_root, env=commit_env, check_cancelled=check_cancelled,
    )
    if committed.returncode != 0:
        raise GitFailure(
            "failed to commit the system file",
            (committed.stderr or committed.stdout or "").strip(),
        )
    commit_sha = _output("rev-parse", "HEAD", cwd=publish_root)
    blob = _output("rev-parse", f"HEAD:{path}", cwd=publish_root)

    if check_cancelled is not None:
        check_cancelled()
    remote_head_ref = f"refs/heads/{base.branch}"
    pushed = _execute(
        "push", "--porcelain",
        f"--force-with-lease={remote_head_ref}:{base.head}",
        "publish", f"{commit_sha}:{remote_head_ref}",
        cwd=publish_root, env=git_env(), check_cancelled=check_cancelled,
    )
    if pushed.returncode != 0:
        raise GitFailure(
            "the system commit was not pushed; the project mirror is unchanged",
            (pushed.stderr or pushed.stdout or "").strip(),
        )
    _mirror_fast_forward(base, commit_sha)
    return {"commit": commit_sha, "blob": blob}


# --------------------------------------------------------------------- job


def start_system_git_commit_job(
    *,
    system_id: str,
    project_id: str,
    repository_id: Optional[str],
    branch: str,
    path: str,
    message: str,
    document: Mapping[str, Any],
    document_version: int,
    author_name: str,
    author_email: str,
    requested_by: str = "",
) -> dict[str, Any]:
    """Queue one commit of ``document`` at ``document_version``."""

    return SYSTEM_GIT_COMMIT.enqueue(
        {
            "system_id": system_id,
            "project_id": project_id,
            "branch": branch,
            "path": path,
            "message": message,
            "document": dict(document),
            "document_version": int(document_version),
            "author_name": author_name,
            "author_email": author_email,
        },
        subject=JobSubject(project_id=project_id, repository_id=repository_id or None),
        requested_by=requested_by,
    )


def run_system_git_commit_job(context: JobContext) -> JobResult:
    """Commit the queued document, or report ``unchanged`` or ``diverged`` (§13.2)."""

    payload = context.payload
    system_id = str(payload["system_id"])
    document = payload.get("document")
    version = int(payload.get("document_version") or 0)
    if not isinstance(document, Mapping):
        raise PermanentJobError(
            "The queued commit has no document", code="system_git_payload_invalid"
        )

    links = git_link_store()
    link = links.read(system_id)
    if link is None:
        raise PermanentJobError(
            "The system is no longer linked to a Git file", code="system_git_not_linked"
        )

    context.progress(
        stage="fetch", message="Reading the linked branch", percent=10, force=True
    )
    try:
        base = fetch_branch_file(
            str(link["project_id"]),
            str(link["branch"]),
            str(link["path"]),
            check_cancelled=context.check_cancelled,
        )
    except BranchMissing as error:
        raise PermanentJobError(str(error), code="system_git_branch_missing") from error
    except GitFailure as error:
        logger.warning("system %s: %s: %s", system_id, error, error.detail)
        raise RetryableJobError(
            "The project's Git repository could not be read",
            code="system_git_unavailable",
        ) from error

    data = file_bytes(document)
    desired_blob = _hash_object(
        base.repo_root, data, staging_root=context.staging_dir,
        check_cancelled=context.check_cancelled,
    )
    outcome = commit_outcome(
        last_blob=str(link.get("last_blob") or ""),
        head_blob=base.blob,
        desired_blob=desired_blob,
    )
    details: dict[str, Any] = {
        "system_id": system_id,
        "project_id": str(link["project_id"]),
        "branch": base.branch,
        "path": str(link["path"]),
        "document_version": version,
    }

    if outcome == DIVERGED:
        context.progress(
            stage="diverged",
            message="The file changed outside Prism",
            percent=100,
            force=True,
            payload_updates={"diverged_blob": base.blob},
        )
        raise PermanentJobError(
            f"The file on {base.branch} changed outside Prism "
            f"(blob {base.blob or '(missing)'}); import it before committing again.",
            code="system_git_diverged",
        )
    if outcome == UNCHANGED:
        details.update(outcome=UNCHANGED, commit=str(link.get("last_commit") or ""), blob=base.blob)
        return JobResult(message="System unchanged", details=details)

    context.progress(
        stage="publish", message="Committing the system document", percent=35, force=True
    )
    try:
        published = _publish(
            base,
            path=str(link["path"]),
            data=data,
            message=str(payload.get("message") or f"Update {document.get('name') or system_id}"),
            author_name=str(payload.get("author_name") or ""),
            author_email=str(payload.get("author_email") or ""),
            staging_root=context.staging_dir,
            check_cancelled=context.check_cancelled,
        )
    except MirrorDirty as error:
        raise PermanentJobError(str(error), code="system_git_mirror_dirty") from error
    except GitFailure as error:
        logger.warning("system %s: %s: %s", system_id, error, error.detail)
        raise RetryableJobError(
            "The system document could not be committed",
            code="system_git_unavailable",
        ) from error

    if published is None:
        details.update(outcome=UNCHANGED, commit=str(link.get("last_commit") or ""), blob=base.blob)
        return JobResult(message="System unchanged", details=details)

    links.record_commit(
        system_id,
        commit=published["commit"],
        blob=published["blob"],
        version=version,
    )
    details.update(
        outcome=COMMIT,
        commit=published["commit"],
        blob=published["blob"],
    )
    return JobResult(message="System committed", details=details)


SYSTEM_GIT_COMMIT = JobKind(
    KIND,
    run_system_git_commit_job,
    lock=repository_lock("write"),
    max_attempts=2,
    priority=120,
)
JOB_KINDS = (SYSTEM_GIT_COMMIT,)
