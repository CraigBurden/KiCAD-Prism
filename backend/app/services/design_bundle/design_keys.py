"""The design key of a commit: what comment anchors compare (ADR amendment K2 §3.6).

A bundle's design key is its semantic index's ``designKey``: a digest of the
configuration and the read set, without the generator. Every revision key an
alias points at the bundle reads the same files, so it has the same design
key, and a commit that leaves the design unchanged keeps it.

Stage parse records it on the bundle row (:func:`record`). A bundle built
before that is read once, on its first lookup.

Lookups never key a commit or queue a build. A commit with no indexed revision
key or no bundle has no design key yet (``None``), and callers keep today's
behaviour for it.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Iterable

from app.services.design_bundle import archive as archive_rules
from app.services.design_bundle import cli, reuse, rows, store

logger = logging.getLogger(__name__)

MEMBER = "projections/semantic-index.json"
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def of_archive(archive: archive_rules.Archive) -> str | None:
    """The ``designKey`` of the archive's semantic index member, if it has one."""

    if archive.member(MEMBER) is None:
        return None
    try:
        value = json.loads(archive.read(MEMBER)).get("designKey")
    except (archive_rules.BundleInvalid, OSError, ValueError, AttributeError) as error:
        logger.warning("design key of %s unreadable: %s", archive.path, error)
        return None
    return value if isinstance(value, str) and _HEX64.match(value) else None


def record(project_id: str, bundle_key: str, archive: archive_rules.Archive, *, connect: rows.Connect | None = None) -> str | None:
    """Read the archive's design key and store it on the bundle row."""

    found = of_archive(archive)
    if found:
        rows.set_design_key(project_id, bundle_key, found, connect=connect)
    return found


def _of_row(project_id: str, row: dict[str, Any], connect: rows.Connect | None) -> str | None:
    if row.get("design_key"):
        return str(row["design_key"])
    path = store.archive_path(project_id, str(row["revision_key"]), str(row["generator_digest"]))
    if not path.is_file():
        return None
    try:
        opened = archive_rules.open_archive(path, expected_bundle_key=str(row["bundle_key"]))
    except (archive_rules.BundleInvalid, OSError) as error:
        logger.warning("design key: bundle %s unreadable: %s", row["bundle_key"], error)
        return None
    return record(project_id, str(row["bundle_key"]), opened, connect=connect)


def of_commit(project_id: str, commit: str, *, connect: rows.Connect | None = None) -> str | None:
    """The design key of the newest bundle serving ``commit``, else ``None``.

    A commit keyed under two configurations has two revision keys; the bundle
    updated last is the current configuration's.
    """

    try:
        generator = cli.generator()
    except (cli.CliUnavailable, cli.CliFailure):
        return None
    found: list[dict[str, Any]] = []
    for revision_key in rows.indexed_keys(project_id, commit, connect=connect):
        resolved = reuse.resolve(project_id, revision_key, generator, connect=connect)
        row = rows.get_bundle(project_id, resolved.bundle_key, connect=connect) if resolved else None
        if row is not None and row["state"] in ("complete", "building"):
            found.append(row)
    for row in sorted(found, key=lambda item: item["updated_at"], reverse=True):
        key = _of_row(project_id, row, connect)
        if key:
            return key
    return None


def of_commits(project_id: str, commits: Iterable[str], *, connect: rows.Connect | None = None) -> dict[str, str | None]:
    """:func:`of_commit` for each distinct commit."""

    return {commit: of_commit(project_id, commit, connect=connect) for commit in dict.fromkeys(commits)}
