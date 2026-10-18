"""Force a project's bundles to be rebuilt (K2b).

Reuse serves a revision from another revision's archive while its read set
holds (ADR amendment K2 §3.3), and a generator bump rebuilds every bundle on
its own. This is the manual path for a bundle that looks wrong:

- **one commit** (default ``HEAD``): the commit's alias and its own archive go,
  together with every alias that pointed to that archive, and a build that
  skips reuse is queued. Other revisions of those aliases are aliased or built
  again by the prebuild or their next request.
- **the project**: every archive and alias of the project goes and ``HEAD`` is
  rebuilt without reuse; the prebuild rebuilds the rest, reusing between the
  new builds.

Refused while a ``design_bundle`` job of the project is active, so nothing is
deleted under a running build.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.services.design_bundle import cli, jobs, rows, store

Scope = Literal["commit", "project"]


class RegenerateConflict(Exception):
    """A build of the project is queued or running."""


class RegenerateNotApplicable(Exception):
    """The project is absent at the commit, so it has no bundle."""


@dataclass(frozen=True)
class Regenerated:
    scope: Scope
    commit: str | None
    removed_bundles: int
    removed_aliases: int
    job_id: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "scope": self.scope,
            "commit": self.commit,
            "removedBundles": self.removed_bundles,
            "removedAliases": self.removed_aliases,
            "jobId": self.job_id,
        }


def regenerate(
    project_id: str,
    *,
    commit: str | None = None,
    scope: Scope = "commit",
    requested_by: str = "",
    connect: rows.Connect | None = None,
) -> Regenerated:
    """Drop the bundles in ``scope`` and queue a rebuild that skips reuse.

    Raises :class:`RegenerateConflict` while a build of the project is active,
    :class:`RegenerateNotApplicable` when the project is absent at ``commit``,
    ``LookupError`` for an unknown project and ``cli.CliUnavailable`` without
    ``prism-kicad``.
    """

    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id)
    if not row:
        raise LookupError(f"Project '{project_id}' not found")
    if rows.active_project_jobs(jobs.KIND, project_id, connect=connect):
        raise RegenerateConflict("A design bundle of this project is being built; try again when it finishes")
    if scope == "project":
        return _project(project_id, requested_by, connect)
    key = jobs.project_key(row, commit)
    if key.absent:
        raise RegenerateNotApplicable(f"The project is not present at this commit ({key.absent_project_file})")
    generator = cli.generator()
    revision_key = key.key.revision_key  # type: ignore[union-attr]
    own = generator.bundle_key(revision_key)
    removed_aliases = rows.delete_aliases(project_id, revision_keys=[revision_key], bundle_keys=[own], connect=connect)
    removed_bundles = 0
    if rows.get_bundle(project_id, own, connect=connect) is not None:
        store.delete(project_id, revision_key, generator.digest)
        rows.delete_bundles(project_id, [own], connect=connect)
        removed_bundles = 1
    job_id = jobs.start_design_bundle_job(
        project_id, commit=key.commit, requested_by=requested_by, head=commit is None, force=True
    )
    return Regenerated("commit", str(key.commit), removed_bundles, removed_aliases, job_id)


def _project(project_id: str, requested_by: str, connect: rows.Connect | None) -> Regenerated:
    stored = rows.bundles(project_id, connect=connect)
    removed_aliases = rows.delete_aliases(project_id, connect=connect)
    for bundle in stored:
        store.delete(project_id, str(bundle["revision_key"]), str(bundle["generator_digest"]))
    rows.delete_bundles(project_id, [str(bundle["bundle_key"]) for bundle in stored], connect=connect)
    job_id = jobs.start_design_bundle_job(project_id, requested_by=requested_by, head=True, force=True)
    return Regenerated("project", None, len(stored), removed_aliases, job_id)
