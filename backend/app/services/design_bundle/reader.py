"""How a consumer reads bundle members (bundle-format.md §3.3, §8, §9).

A consumer names the revision and the members it needs. :func:`open_revision`
keys the revision, opens the archive that serves it (its own, else the one an
alias row points to, ADR amendment K2 §3.6) and answers readiness per member; ``read_json`` and ``extract`` return
verified bytes or files. Nothing here builds a bundle: ``queue=True`` asks for
one when the archive is missing or pending, deduplicated on the bundle key.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from app.services.design_bundle import cli, jobs, reuse, rows, store
from app.services.design_bundle.archive import Archive
from app.services.design_bundle.manifest import Readiness, readiness

logger = logging.getLogger(__name__)

_ACTIVE = ("queued", "running", "retry_wait", "cancel_requested")


@dataclass
class OpenedRevision:
    """A revision as a consumer reads it.

    ``revision_key`` is the key asked for, which is what a consumer reports.
    ``bundle_key`` names the archive that serves it, built for
    ``archive_revision_key``: another revision's when ``aliased``.
    """

    project_id: str
    commit: str | None
    revision_key: str | None
    generator_digest: str
    bundle_key: str | None
    archive: Archive | None
    job_active: bool
    absent: bool = False
    archive_revision_key: str | None = None
    aliased: bool = False
    #: The error of a build that ended failed and is not being retried; ``None`` otherwise.
    failure: str | None = None
    #: A no-commit request served HEAD while the checkout held uncommitted
    #: changes in the files the bundle reads (``consumer.BundleRead``).
    working_tree_dirty: bool = False

    def readiness(self, paths: Iterable[str]) -> dict[str, Readiness]:
        manifest = self.archive.manifest if self.archive is not None else None
        return {path: readiness(manifest, path, job_active=self.job_active) for path in paths}

    def _need(self) -> Archive:
        if self.archive is None:
            raise LookupError("the bundle is not stored yet")
        if self.bundle_key:
            rows.touch_bundle(self.project_id, self.bundle_key)
        if self.aliased and self.revision_key:
            rows.touch_alias(self.project_id, self.revision_key, self.generator_digest)
        return self.archive

    def read(self, path: str) -> bytes:
        """A member's bytes, checked for size, SHA-256 and schema (§9 steps 6-7)."""

        return self._need().read(path)

    def read_json(self, path: str) -> Any:
        return json.loads(self.read(path).decode("utf-8"))

    def extract(self, paths: Iterable[str]) -> Path:
        """Members as files in the archive's verified version directory (§8)."""

        archive = self._need()
        stored_as = self.archive_revision_key or self.revision_key
        assert stored_as is not None
        return store.extract(archive, self.project_id, stored_as, self.generator_digest, paths)


def _working_tree_dirty(row: Mapping[str, Any], key: Any) -> bool:
    """Whether the checkout's read set differs from HEAD's (uncommitted changes).

    Only names: ``git status`` lists what ``git add -A`` would touch, and a name
    is compared against the HEAD key's selected entries or the §5.2 name rules.
    A bundle is never built from a dirty tree; the caller serves HEAD and says so.
    """

    if key.absent or key.key is None or key.config is None:
        return False
    from app.services import project_revision
    from app.services.design_bundle import revision_key as rk

    repo = project_revision.locate(row).repo_root
    selected = {entry["path"].encode("utf-8") for entry in key.key.entries}
    excluded = [str(directory).encode("utf-8") for directory in key.config.get("excluded_dirs") or ()]
    for path in rk.worktree_changes(repo):
        if path in selected:
            return True
        if any(path == directory or path.startswith(directory + b"/") for directory in excluded):
            continue
        if rk.category_of(path.rsplit(b"/", 1)[-1], "regular") is not None:
            return True
    return False


def open_revision(project_id: str, commit: str | None = None, *, queue: bool = False, requested_by: str = "") -> OpenedRevision:
    """The stored bundle of ``project_id`` at ``commit`` (``HEAD`` when ``None``), as far as it got."""

    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id)
    if not row:
        raise LookupError(f"Project '{project_id}' not found")
    key = jobs.project_key(row, commit)
    dirty = False
    if commit is None:
        try:
            dirty = _working_tree_dirty(row, key)
        except Exception:  # noqa: BLE001 - a status read must not lose the bundle
            logger.warning("design bundle: could not read %s's working tree", project_id, exc_info=True)
    generator = cli.generator()
    if key.absent:
        return OpenedRevision(project_id, key.commit, None, generator.digest, None, None, False, absent=True)
    revision_key = key.key.revision_key  # type: ignore[union-attr]
    bundle_key, stored_as, aliased, archive = _stored(project_id, revision_key, generator)
    bundle = rows.get_bundle(project_id, bundle_key)
    active = bool(bundle and rows.job_status(bundle.get("job_id")) in _ACTIVE)
    complete = archive is not None and all(
        archive.manifest["stages"][stage]["status"] != "pending" for stage in ("parse", "board", "models")
    )
    if queue and not active and not complete:
        # An aliased archive's later stages are its own revision's job.
        build_commit = (bundle or {}).get("commit_sha") if aliased else key.commit
        active = bool(jobs.start_design_bundle_job(project_id, commit=build_commit or key.commit, requested_by=requested_by))
    failure = None
    if not active and not complete and bundle and bundle["state"] == "failed":
        failure = str(bundle.get("error") or "the design bundle build failed")
    return OpenedRevision(
        project_id, key.commit, revision_key, generator.digest, bundle_key, archive, active,
        archive_revision_key=stored_as, aliased=aliased, failure=failure, working_tree_dirty=dirty,
    )


def _stored(project_id: str, revision_key: str, generator: Any) -> tuple[str, str, bool, Archive | None]:
    """The bundle key, the revision key it is stored under, whether that is an alias, and the archive."""

    resolved = reuse.resolve(project_id, revision_key, generator)
    bundle_key = resolved.bundle_key if resolved else generator.bundle_key(revision_key)
    stored_as = resolved.archive_revision_key if resolved else revision_key
    archive = store.open_bundle(project_id, stored_as, generator.digest, bundle_key)
    return bundle_key, stored_as, bool(resolved and resolved.aliased), archive


def open_revision_key(project_id: str, revision_key: str, generator_digest: str) -> OpenedRevision | None:
    """The stored bundle that serves ``revision_key`` for ``generator_digest``, by key, not commit.

    For URLs that name a revision (a viewer's asset, cached forever): ``None``
    when nothing is stored for it, or the generator is not the running one.
    Nothing is queued.
    """

    generator = cli.generator()
    if generator_digest != generator.digest:
        return None
    bundle_key, stored_as, aliased, archive = _stored(project_id, revision_key, generator)
    if archive is None:
        return None
    return OpenedRevision(
        project_id, None, revision_key, generator.digest, bundle_key, archive, False,
        archive_revision_key=stored_as, aliased=aliased,
    )


def member_states(opened: OpenedRevision, paths: Iterable[str]) -> Mapping[str, str]:
    return {path: answer.state for path, answer in opened.readiness(paths).items()}
