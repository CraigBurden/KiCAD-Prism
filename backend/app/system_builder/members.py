"""A system document's board members and the system bundle key
(docs/system-builder/CONTRACTS.md §8.1–§8.2).

Each board occurrence names a project and the commit it is at. :func:`resolve`
opens that revision's design bundle, queues a build when it is missing, and
answers whether the two projections ``system build`` reads are ready. Entry and
body occurrences are ``unsupported``: their stages have no input yet. A project
that no longer exists, or whose project file is not in the commit's tree, is
``absent``.

The project lookup is role-blind on purpose. A caller reaches this module only
after :class:`app.system_builder.store.SystemStore` has authorised the system
itself; a build job runs as the system. Board visibility of the *reader* is a
redaction concern (``redaction.redact_bundle``), never a reason to compute a
different key: the system bundle is one stored artifact for every caller.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.services.design_bundle import reader
from app.services.design_bundle import store as design_store

#: The projections ``system build`` reads (CONTRACTS §8.1).
MEMBER_PATHS: tuple[str, ...] = (
    "projections/system-interface.json",
    "projections/semantic-index.json",
)

READY = "ready"
PENDING = "pending"
ABSENT = "absent"
UNSUPPORTED = "unsupported"


@dataclass(frozen=True)
class Member:
    """One occurrence as the system bundle build sees it (CONTRACTS §8.2)."""

    occurrence: str
    state: str
    project_id: str = ""
    commit: str = ""
    revision_key: str | None = None
    bundle_key: str | None = None
    archive: Path | None = None


def resolve(document: Mapping[str, Any], *, requested_by: str = "") -> tuple[Member, ...]:
    """Every occurrence's member state, in the document's order.

    ``queue=True`` asks for a design bundle when one is missing or incomplete,
    deduplicated on the bundle key exactly as any other consumer does.
    """

    resolved: list[Member] = []
    for occurrence in document.get("occurrences", []):
        occurrence_id = str(occurrence["id"])
        source = occurrence.get("source") or {}
        if source.get("kind") != "board":
            resolved.append(Member(occurrence_id, UNSUPPORTED))
            continue
        project_id = str(source.get("projectId") or "")
        commit = str((source.get("track") or {}).get("commit") or "")
        try:
            opened = reader.open_revision(
                project_id, commit, queue=True, requested_by=requested_by
            )
        except LookupError:
            # The project was removed from the workspace after the document named it.
            resolved.append(Member(occurrence_id, ABSENT, project_id, commit))
            continue
        if opened.absent:
            resolved.append(Member(occurrence_id, ABSENT, project_id, commit))
            continue
        states = opened.readiness(MEMBER_PATHS)
        if all(answer.state == READY for answer in states.values()):
            assert opened.archive_revision_key is not None
            assert opened.revision_key is not None and opened.bundle_key is not None
            archive = design_store.archive_path(
                project_id, opened.archive_revision_key, opened.generator_digest
            )
            resolved.append(
                Member(
                    occurrence_id, READY, project_id, commit,
                    opened.revision_key, opened.bundle_key, archive,
                )
            )
        else:
            resolved.append(
                Member(
                    occurrence_id, PENDING, project_id, commit,
                    opened.revision_key, opened.bundle_key,
                )
            )
    return tuple(resolved)


def canonical_bytes(value: Any) -> bytes:
    """The key's canonical JSON: sorted keys, compact separators, UTF-8."""

    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def document_sha256(document: Mapping[str, Any]) -> str:
    """SHA-256 of the document's canonical JSON (CONTRACTS §8.1)."""

    return hashlib.sha256(canonical_bytes(document)).hexdigest()


def system_bundle_key(
    document: Mapping[str, Any], generator_digest: str, members: Sequence[Member]
) -> str:
    """The system bundle key (CONTRACTS §8.1).

    Only a ready occurrence contributes its bundle key. Unsupported occurrences
    are in neither list: no stage reads them yet, so they cannot change the
    bundle's content.
    """

    ready = {
        member.occurrence: member.bundle_key
        for member in members
        if member.state == READY and member.bundle_key is not None
    }
    preimage = {
        "documentSha256": document_sha256(document),
        "generator": generator_digest,
        "members": ready,
        "absent": sorted(member.occurrence for member in members if member.state == ABSENT),
        "pending": sorted(member.occurrence for member in members if member.state == PENDING),
    }
    return hashlib.sha256(canonical_bytes(preimage)).hexdigest()


def cli_args(members: Sequence[Member]) -> list[str]:
    """The ``--member``/``--absent`` arguments for ``prism-kicad system build``.

    A pending occurrence is omitted: the CLI reports it ``pending`` itself.
    """

    args: list[str] = []
    for member in members:
        if member.state == READY:
            assert member.archive is not None and member.revision_key is not None
            args += [
                "--member", f"{member.occurrence}={member.archive}",
                "--member-revision-key", f"{member.occurrence}={member.revision_key}",
            ]
        elif member.state == ABSENT:
            args += ["--absent", member.occurrence]
    return args
