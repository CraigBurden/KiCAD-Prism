"""The paced backfill and prebuild of bundles (ADR §8, first deploy; G7; amendments U §3.3, K2).

The prism worker calls :func:`tick` every
``PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS``. A tick walks projects round
robin from where the last one stopped, over the commits the prebuild keeps
warm (:func:`reuse.prebuild_commits`): branch heads, each branch's newest
``PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS`` commits along the first parent, and
every tagged commit. For each commit with no bundle and no alias yet it keys
the commit (one ``git ls-tree``), then:

- aliases it to a stored bundle whose read set holds (``prism-kicad bundle
  reuse``, no build; K2 §3.3);
- otherwise queues its build, at most one per tick and only while no
  ``design_bundle`` job is queued or running (one slot). An interactive
  request preempts a queued or running backfill build, which leaves no bundle
  row behind so the next tick queues it again.

On the way it records what keying found about each project's HEAD
(``ws_design_bundle_flags``): a board or root schematic that no longer
resolves now that files are attributed by anchor only, an invalid committed
``.prism.json``, or an anchor missing from the tree. It flags; it never picks
a file (decisions.md, revision key item 7).
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from app.core.config import settings
from app.services.design_bundle import cli, jobs, reuse, rows
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit
from app.services.design_bundle.revision_key import RevisionKeyError

logger = logging.getLogger(__name__)

#: Most branch heads keyed in one tick, so a tick stays short on a large workspace.
MAX_KEYS_PER_TICK = 25


@dataclass
class BackfillState:
    """What the worker keeps between ticks: where the round robin stopped."""

    cursor: str = ""
    queued: list[str] = field(default_factory=list)


def head_commit(repo: Path) -> str | None:
    process = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", "HEAD^{commit}"], capture_output=True, text=True, check=False)
    return process.stdout.strip() if process.returncode == 0 else None


def repo_of(project: Mapping[str, Any]) -> Path:
    from app.services.workspace_service import workspace

    return Path(workspace._abs_clone_path(str(project["clone_path"])))


def tick(state: BackfillState, *, connect: rows.Connect | None = None) -> dict[str, Any]:
    """One paced step. Returns what it did (for logs and tests)."""

    outcome: dict[str, Any] = {"queued": None, "keyed": 0, "reused": [], "flagged": {}}
    if not settings.PRISM_DESIGN_BUNDLE_AUTO_BUILD or settings.PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS <= 0:
        outcome["skipped"] = "disabled"
        return outcome
    try:
        generator = cli.generator()
    except (cli.CliUnavailable, cli.CliFailure) as error:
        outcome["skipped"] = f"prism-kicad unavailable: {error}"
        return outcome
    busy = bool(rows.active_jobs(jobs.KIND, connect=connect))
    if busy:
        outcome["busy"] = "a design_bundle job is active"
    projects = rows.projects(connect=connect)
    if not projects:
        return outcome
    start = next((i for i, project in enumerate(projects) if str(project["id"]) > state.cursor), 0)
    with tempfile.TemporaryDirectory(prefix="prism-bundle-reuse-") as work:
        for project in projects[start:] + projects[:start]:
            if outcome["keyed"] >= MAX_KEYS_PER_TICK:
                break
            state.cursor = str(project["id"])
            busy = _project(project, generator, Path(work), outcome, state, busy=busy, connect=connect)
    return outcome


def _project(
    project: Mapping[str, Any],
    generator: Any,
    work: Path,
    outcome: dict[str, Any],
    state: BackfillState,
    *,
    busy: bool,
    connect: rows.Connect | None,
) -> bool:
    """The prebuild of one project; returns whether the build slot is now taken."""

    project_id = str(project["id"])
    repo = repo_of(project)
    ref = ProjectRef.from_row(project)
    head = head_commit(repo)
    for commit in reuse.prebuild_commits(repo):
        if outcome["keyed"] >= MAX_KEYS_PER_TICK:
            break
        if commit != head and reuse.is_served(project_id, commit, generator, connect=connect):
            continue
        outcome["keyed"] += 1
        try:
            key = key_at_commit(repo, ref, commit)
        except RevisionKeyError as error:
            logger.warning("Backfill could not key %s@%s: %s", project_id, commit, error)
            continue
        if commit == head:
            found = jobs.flags_of(key)
            rows.set_flags(project_id, commit, found, connect=connect)
            if found:
                outcome["flagged"][project_id] = sorted(found)
        if key.absent:
            rows.record_absence(project_id, commit, str(key.absent_project_file), connect=connect)
            continue
        revision_key = key.key.revision_key  # type: ignore[union-attr]
        rows.index_key(project_id, commit, key.key.config_digest, revision_key, connect=connect)  # type: ignore[union-attr]
        existing = rows.get_bundle(project_id, generator.bundle_key(revision_key), connect=connect)
        if existing and existing["state"] in ("complete", "queued", "building", "failed"):
            continue  # stored, on its way, or failed (retried on the next sync or request)
        if rows.get_alias(project_id, revision_key, generator.digest, connect=connect):
            continue
        served_by = reuse.try_reuse(project_id, repo, key, generator, work / commit, connect=connect)
        if served_by:
            outcome["reused"].append({"project_id": project_id, "commit": commit, "bundle_key": served_by})
            continue
        if busy:
            continue
        job_id = jobs.start_design_bundle_job(
            project_id, commit=commit, requested_by=jobs.BACKFILL_REQUESTED_BY, priority=jobs.BACKFILL_PRIORITY, head=commit == head
        )
        if job_id:
            outcome["queued"] = {"project_id": project_id, "commit": commit, "job_id": job_id}
            state.queued.append(job_id)
            busy = True
    return busy
