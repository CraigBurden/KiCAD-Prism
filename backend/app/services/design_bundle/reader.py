"""How a consumer reads bundle members (bundle-format.md §3.3, §8, §9).

A consumer names the revision and the members it needs. :func:`open_revision`
keys the revision, opens the stored archive if there is
one, and answers readiness per member; ``read_json`` and ``extract`` return
verified bytes or files. Nothing here builds a bundle: ``queue=True`` asks for
one when the archive is missing or pending, deduplicated on the bundle key.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from app.services.design_bundle import cli, jobs, rows, store
from app.services.design_bundle.archive import Archive
from app.services.design_bundle.manifest import Readiness, readiness

_ACTIVE = ("queued", "running", "retry_wait", "cancel_requested")


@dataclass
class OpenedRevision:
    project_id: str
    commit: str | None
    revision_key: str | None
    generator_digest: str
    bundle_key: str | None
    archive: Archive | None
    job_active: bool
    absent: bool = False

    def readiness(self, paths: Iterable[str]) -> dict[str, Readiness]:
        manifest = self.archive.manifest if self.archive is not None else None
        return {path: readiness(manifest, path, job_active=self.job_active) for path in paths}

    def _need(self) -> Archive:
        if self.archive is None:
            raise LookupError("the bundle is not stored yet")
        if self.bundle_key:
            rows.touch_bundle(self.project_id, self.bundle_key)
        return self.archive

    def read(self, path: str) -> bytes:
        """A member's bytes, checked for size, SHA-256 and schema (§9 steps 6-7)."""

        return self._need().read(path)

    def read_json(self, path: str) -> Any:
        return json.loads(self.read(path).decode("utf-8"))

    def extract(self, paths: Iterable[str]) -> Path:
        """Members as files in the archive's verified version directory (§8)."""

        archive = self._need()
        assert self.revision_key is not None
        return store.extract(archive, self.project_id, self.revision_key, self.generator_digest, paths)


def open_revision(project_id: str, commit: str | None = None, *, queue: bool = False, requested_by: str = "") -> OpenedRevision:
    """The stored bundle of ``project_id`` at ``commit`` (``HEAD`` when ``None``), as far as it got."""

    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id)
    if not row:
        raise LookupError(f"Project '{project_id}' not found")
    key = jobs.project_key(row, commit)
    generator = cli.generator()
    if key.absent:
        return OpenedRevision(project_id, key.commit, None, generator.digest, None, None, False, absent=True)
    revision_key = key.key.revision_key  # type: ignore[union-attr]
    bundle_key = generator.bundle_key(revision_key)
    archive = store.open_bundle(project_id, revision_key, generator.digest, bundle_key)
    bundle = rows.get_bundle(project_id, bundle_key)
    active = bool(bundle and rows.job_status(bundle.get("job_id")) in _ACTIVE)
    complete = archive is not None and all(
        archive.manifest["stages"][stage]["status"] != "pending" for stage in ("parse", "board", "models")
    )
    if queue and not active and not complete:
        active = bool(jobs.start_design_bundle_job(project_id, commit=key.commit, requested_by=requested_by))
    return OpenedRevision(project_id, key.commit, revision_key, generator.digest, bundle_key, archive, active)


def member_states(opened: OpenedRevision, paths: Iterable[str]) -> Mapping[str, str]:
    return {path: answer.state for path, answer in opened.readiness(paths).items()}
