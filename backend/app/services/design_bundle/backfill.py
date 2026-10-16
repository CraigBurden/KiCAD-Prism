"""The paced backfill of branch-head bundles (ADR §8, first deploy; G7).

Instead of every project rebuilding at once, the prism worker calls
:func:`tick` every ``PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS``. A tick
does nothing while any ``design_bundle`` job is queued or running (one slot),
and otherwise walks projects round robin from where the last tick stopped,
keying each branch head (one ``git ls-tree`` each). It queues at most one
bundle, the first head whose bundle is not stored.

On the way it records what keying found about each project's HEAD
(``ws_design_bundle_flags``): a board or root schematic that no longer
resolves now that files are attributed by anchor only, an invalid committed
``.prism.json``, or an anchor missing from the tree. It flags; it never picks
a file (decisions.md, revision key item 7).
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from app.core.config import settings
from app.services.design_bundle import cli, jobs, rows
from app.services.design_bundle.effective_config import ProjectRef, key_at_commit
from app.services.design_bundle.revision_key import RevisionKeyError

logger = logging.getLogger(__name__)

#: Most branch heads keyed in one tick, so a tick stays short on a large workspace.
MAX_KEYS_PER_TICK = 25
REQUESTED_BY = "design-bundle-backfill"
BACKFILL_PRIORITY = 300


@dataclass
class BackfillState:
    """What the worker keeps between ticks: where the round robin stopped."""

    cursor: str = ""
    queued: list[str] = field(default_factory=list)


def branch_heads(repo: Path) -> list[str]:
    """The distinct commits local and remote-tracking branches point at, sorted."""

    process = subprocess.run(
        ["git", "-C", str(repo), "for-each-ref", "--format=%(objectname) %(objecttype)", "refs/heads", "refs/remotes"],
        capture_output=True, text=True, check=False,
    )
    if process.returncode != 0:
        return []
    return sorted({line.split()[0] for line in process.stdout.splitlines() if line.endswith(" commit")})


def head_commit(repo: Path) -> str | None:
    process = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", "HEAD^{commit}"], capture_output=True, text=True, check=False)
    return process.stdout.strip() if process.returncode == 0 else None


def repo_of(project: Mapping[str, Any]) -> Path:
    from app.services.workspace_service import workspace

    return Path(workspace._abs_clone_path(str(project["clone_path"])))


def tick(state: BackfillState, *, connect: rows.Connect | None = None) -> dict[str, Any]:
    """One paced step. Returns what it did (for logs and tests)."""

    outcome: dict[str, Any] = {"queued": None, "keyed": 0, "flagged": {}}
    if not settings.PRISM_DESIGN_BUNDLE_AUTO_BUILD or settings.PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS <= 0:
        outcome["skipped"] = "disabled"
        return outcome
    if rows.active_jobs(jobs.KIND, connect=connect):
        outcome["skipped"] = "a design_bundle job is active"
        return outcome
    try:
        generator = cli.generator()
    except (cli.CliUnavailable, cli.CliFailure) as error:
        outcome["skipped"] = f"prism-kicad unavailable: {error}"
        return outcome
    projects = rows.projects(connect=connect)
    if not projects:
        return outcome
    start = next((i for i, project in enumerate(projects) if str(project["id"]) > state.cursor), 0)
    for project in projects[start:] + projects[:start]:
        if outcome["keyed"] >= MAX_KEYS_PER_TICK:
            break
        project_id = str(project["id"])
        state.cursor = project_id
        repo = repo_of(project)
        ref = ProjectRef.from_row(project)
        head = head_commit(repo)
        for commit in branch_heads(repo):
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
            bundle_key = generator.bundle_key(key.key.revision_key)  # type: ignore[union-attr]
            existing = rows.get_bundle(project_id, bundle_key, connect=connect)
            if existing and existing["state"] in ("complete", "queued", "building", "failed"):
                continue  # stored, on its way, or failed (retried on the next sync or request)
            job_id = jobs.start_design_bundle_job(
                project_id, commit=commit, requested_by=REQUESTED_BY, priority=BACKFILL_PRIORITY, head=commit == head
            )
            if job_id:
                outcome["queued"] = {"project_id": project_id, "commit": commit, "job_id": job_id}
                state.queued.append(job_id)
                return outcome
    return outcome
