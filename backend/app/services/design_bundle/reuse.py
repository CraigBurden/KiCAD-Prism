"""Warm bundles: one archive serves every revision whose read set holds (ADR amendment K2).

A revision key with no archive of its own may be served by a stored bundle of
the same project, effective configuration and generator whose recorded reads,
probes and listings are unchanged in the new tree (K2 §3.3). ``prism-kicad
bundle reuse`` decides that from the bundle's manifest and the revision's key
record; on a hold, an alias row maps the revision key to the bundle
(revision-key.md §10). Nothing is rebuilt and no archive is copied.

- :func:`resolve` finds the archive a revision key reads: its own first, then
  an alias (revision-key.md §10, "Lookup").
- :func:`try_reuse` checks a few candidate bundles before a build: the bundle
  of the commit's first parent, then the project's newest
  (``PRISM_DESIGN_BUNDLE_REUSE_CANDIDATES``).
- :func:`prebuild_commits` is what the background prebuild keeps warm: branch
  heads, each branch's newest ``PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS`` commits
  (first parent), and every tagged commit.
"""

from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from app.core.config import settings
from app.services.design_bundle import cli, rows, store
from app.services.design_bundle.effective_config import ProjectKey
from app.services.design_bundle.generator import Generator

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Resolved:
    """The archive a revision key reads."""

    bundle_key: str
    #: The revision key the archive was built for: its store path.
    archive_revision_key: str
    #: True when the archive is another revision's, through an alias row.
    aliased: bool


def resolve(project_id: str, revision_key: str, generator: Generator, *, connect: rows.Connect | None = None) -> Resolved | None:
    """The revision's own bundle row, else the bundle an alias points to, else ``None``."""

    own = generator.bundle_key(revision_key)
    if rows.get_bundle(project_id, own, connect=connect) is not None:
        return Resolved(own, revision_key, False)
    alias = rows.get_alias(project_id, revision_key, generator.digest, connect=connect)
    if alias is None:
        return None
    target = rows.get_bundle(project_id, str(alias["bundle_key"]), connect=connect)
    if target is None:
        return None
    return Resolved(str(alias["bundle_key"]), str(target["revision_key"]), True)


def is_served(project_id: str, commit: str, generator: Generator, *, connect: rows.Connect | None = None) -> bool:
    """Whether a commit already keyed has a bundle row or an alias, or is recorded absent.

    Cheap: no keying. A commit keyed under an older configuration counts as
    served until it is keyed again (a sync queues HEAD with its fresh key).
    """

    if rows.is_absent_at(project_id, commit, connect=connect):
        return True
    return any(
        resolve(project_id, key, generator, connect=connect) is not None
        for key in rows.indexed_keys(project_id, commit, connect=connect)
    )


def first_parent(repo: Path, commit: str) -> str | None:
    process = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "--quiet", f"{commit}^1^{{commit}}"],
        capture_output=True, text=True, check=False,
    )
    if process.returncode != 0:
        return None
    return process.stdout.strip() or None


def candidates(
    project_id: str, repo: Path, commit: str, generator: Generator, *, limit: int, connect: rows.Connect | None = None
) -> list[dict[str, Any]]:
    """Bundle rows to try, in order: the first parent's, then the project's newest (K2 §4, K2b)."""

    found: list[dict[str, Any]] = []
    parent = first_parent(repo, commit)
    for key in sorted(rows.indexed_keys(project_id, parent, connect=connect)) if parent else []:
        resolved = resolve(project_id, key, generator, connect=connect)
        row = rows.get_bundle(project_id, resolved.bundle_key, connect=connect) if resolved else None
        if row is not None and row["state"] in ("complete", "building"):
            found.append(row)
    for row in rows.recent_bundles(project_id, generator.digest, limit=limit, connect=connect):
        if all(row["bundle_key"] != seen["bundle_key"] for seen in found):
            found.append(row)
    return found[:limit]


def try_reuse(
    project_id: str,
    repo: Path,
    key: ProjectKey,
    generator: Generator,
    work: Path,
    *,
    cancel: Callable[[], None] | None = None,
    connect: rows.Connect | None = None,
) -> str | None:
    """Alias the key to the first candidate bundle whose read set holds; its bundle key, or ``None``."""

    limit = settings.PRISM_DESIGN_BUNDLE_REUSE_CANDIDATES
    if limit <= 0 or key.key is None or key.commit is None:
        return None
    revision_key = key.key.revision_key
    own = generator.bundle_key(revision_key)
    record = work / "reuse-key-record.json"
    record.parent.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps(key.record(), ensure_ascii=False), encoding="utf-8")
    for row in candidates(project_id, repo, str(key.commit), generator, limit=limit, connect=connect):
        if row["bundle_key"] == own:
            continue
        archive = store.archive_path(project_id, str(row["revision_key"]), generator.digest)
        if not archive.is_file():
            continue
        try:
            done = cli.run(
                ["bundle", "reuse", "--in", str(archive), "--key-record", str(record), "--quiet"],
                timeout_seconds=cli.verify_outer_timeout(),
                expect="prism.cli.reuse_result.a0",
                cancel=cancel,
            )
        except cli.CliUnavailable:
            raise
        except cli.CliFailure as failure:
            logger.warning("bundle reuse of %s for %s failed: %s", row["bundle_key"], revision_key, failure)
            continue
        document = done.document or {}
        if done.exit_code == 0 and document.get("holds") is True:
            rows.add_alias(project_id, revision_key, generator.digest, str(row["bundle_key"]), connect=connect)
            return str(row["bundle_key"])
        failure = document.get("failure") or {}
        logger.debug(
            "bundle %s does not serve %s: %s %s", row["bundle_key"], revision_key,
            failure.get("condition"), failure.get("path", ""),
        )
    return None


# -------------------------------------------------------------- prebuild


def _git_lines(repo: Path, *args: str) -> list[str]:
    process = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=False)
    return process.stdout.splitlines() if process.returncode == 0 else []


def branch_refs(repo: Path) -> list[str]:
    """Local and remote-tracking branches, without symbolic refs such as ``origin/HEAD``."""

    lines = _git_lines(repo, "for-each-ref", "--format=%(refname) %(objecttype) %(symref)", "refs/heads", "refs/remotes")
    return [line.split()[0] for line in lines if line.split()[1:2] == ["commit"] and len(line.split()) == 2]


def tagged_commits(repo: Path) -> list[str]:
    """Every commit a tag names, lightweight or annotated (peeled), sorted."""

    found: set[str] = set()
    for line in _git_lines(repo, "for-each-ref", "--format=%(objectname) %(objecttype) %(*objectname) %(*objecttype)", "refs/tags"):
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "commit":
            found.add(parts[0])
        elif len(parts) == 4 and parts[3] == "commit":
            found.add(parts[2])
    return sorted(found)


def prebuild_commits(repo: Path, *, per_branch: int | None = None) -> list[str]:
    """What the prebuild keeps warm, without duplicates and in the order it builds them.

    Branch heads first, then each branch's newest commits along its first
    parent, newest first, then every tagged commit.
    """

    per_branch = settings.PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS if per_branch is None else per_branch
    refs = branch_refs(repo)
    windows = [
        _git_lines(repo, "rev-list", "--first-parent", f"--max-count={max(per_branch, 1)}", ref) for ref in refs
    ]
    ordered: list[str] = [window[0] for window in windows if window]
    depth = max((len(window) for window in windows), default=0)
    for index in range(1, depth):
        ordered.extend(window[index] for window in windows if index < len(window))
    ordered.extend(tagged_commits(repo))
    seen: set[str] = set()
    return [commit for commit in ordered if not (commit in seen or seen.add(commit))]
