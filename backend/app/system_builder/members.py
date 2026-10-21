"""A system document's board members and the system bundle key
(docs/system-builder/CONTRACTS.md §8.1–§8.2).

Each board occurrence names a project and the commit it is at. :func:`resolve`
opens that revision's design bundle, queues a build when it is missing, and
answers whether the two projections ``system build`` reads are ready. A placed
entry occurrence is ``ready`` when its catalog revision still carries a
``system_entry`` payload, and ``absent`` when it does not (§12.2); body
occurrences stay ``unsupported`` until stage 3. A project that no longer
exists, or whose project file is not in the commit's tree, is ``absent``.

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
from typing import Any, Callable, Mapping, Sequence

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
    entry_payload: Path | None = None
    entry_payload_sha256: str = ""
    entry_stage: str = ""
    is_entry: bool = False


def entry_lookup(component_id: str, revision_id: str) -> Any:
    """A placed entry's payload, from the production catalog.

    Imported lazily so this module does not depend on the catalog at import time;
    tests and the publishing service pass their own lookup.
    """

    from app.system_builder.publishing import lookup_entry

    return lookup_entry(component_id, revision_id)


def resolve(
    document: Mapping[str, Any],
    *,
    requested_by: str = "",
    entry_resolver: Callable[[str, str], Any] | None = None,
) -> tuple[Member, ...]:
    """Every occurrence's member state, in the document's order.

    ``queue=True`` asks for a design bundle when one is missing or incomplete,
    deduplicated on the bundle key exactly as any other consumer does. A placed
    entry is read through ``entry_resolver`` (the catalog by default).
    """

    lookup = entry_resolver or globals()["entry_lookup"]
    resolved: list[Member] = []
    for occurrence in document.get("occurrences", []):
        occurrence_id = str(occurrence["id"])
        source = occurrence.get("source") or {}
        if source.get("kind") == "entry":
            found = lookup(
                str(source.get("componentId") or ""),
                str(source.get("revisionId") or ""),
            )
            if found is None:
                resolved.append(Member(occurrence_id, ABSENT, is_entry=True))
            else:
                resolved.append(
                    Member(
                        occurrence_id,
                        READY,
                        bundle_key=found.system_bundle_key,
                        entry_payload=found.payload_path,
                        entry_payload_sha256=found.payload_sha256,
                        entry_stage=found.stage,
                        is_entry=True,
                    )
                )
            continue
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
    """SHA-256 of the document's canonical JSON without ``layout`` (CONTRACTS §8.1).

    Layout is presentation only and no rule reads it, so moving a symbol or a
    pin reuses the system bundle instead of rebuilding it.
    """

    return hashlib.sha256(canonical_bytes(
        {name: value for name, value in document.items() if name != "layout"}
    )).hexdigest()


#: The system bundle's format, part of its key (CONTRACTS §8.1); the twin of
#: ``prism_system::SYSTEM_BUNDLE_FORMAT``. 1: stage 3a added ``placement``; 2: stage
#: 3c added mates' drawn ``pads``; 3: stage 3d added bodies and the ``parts`` digest;
#: 4: stage 3d added ``placement.exports``; 5: stage 4a added ``harnesses``; 6: stage
#: 4c added ``harnesses[].route``.
SYSTEM_BUNDLE_FORMAT = 6


def system_bundle_key(
    document: Mapping[str, Any],
    generator_digest: str,
    members: Sequence[Member],
    *,
    board_sub_ports: Mapping[str, Any] | None = None,
    entries: Mapping[str, Any] | None = None,
    parts: str | None = None,
) -> str:
    """The system bundle key (CONTRACTS §8.1).

    Only a ready occurrence contributes its bundle key. Unsupported occurrences
    are in neither list: no stage reads them yet, so they cannot change the
    bundle's content. ``board_sub_ports`` is the ``prism.board_sub_ports.a0``
    build input, reduced to ``{id: version}``; ``entries`` is the published
    entries' payload digest and stage per occurrence; ``parts`` is the digest of
    the ``prism.system_parts.a0`` input, None without one. Those fields are
    always in the preimage.
    """

    # An entry's own bundle key is part of its payload, not the board members;
    # it contributes through ``entries`` instead (CONTRACTS §8.1, §12.2).
    ready = {
        member.occurrence: member.bundle_key
        for member in members
        if member.state == READY and member.bundle_key is not None and not member.is_entry
    }
    sub_port_versions = {
        str(item["id"]): int(item["version"])
        for item in (board_sub_ports or {}).get("subPorts", [])
    }
    preimage = {
        "documentSha256": document_sha256(document),
        "format": SYSTEM_BUNDLE_FORMAT,
        "generator": generator_digest,
        "members": ready,
        "absent": sorted(member.occurrence for member in members if member.state == ABSENT),
        "pending": sorted(member.occurrence for member in members if member.state == PENDING),
        "boardSubPorts": sub_port_versions,
        "entries": dict(entries or {}),
        "parts": parts,
    }
    return hashlib.sha256(canonical_bytes(preimage)).hexdigest()


def entry_key_input(members: Sequence[Member]) -> dict[str, dict[str, str]]:
    """The ``entries`` field of the system bundle key: payload digest and stage."""

    return {
        member.occurrence: {
            "payload": member.entry_payload_sha256,
            "stage": member.entry_stage,
        }
        for member in members
        if member.state == READY and member.entry_payload is not None
    }


def cli_args(members: Sequence[Member]) -> list[str]:
    """The ``--member``/``--absent``/``--entry`` arguments for ``prism-kicad system build``.

    A pending occurrence is omitted: the CLI reports it ``pending`` itself. An
    entry whose payload is gone is ``absent``, like a project that left the
    workspace.
    """

    args: list[str] = []
    for member in members:
        if member.state == READY and member.entry_payload is not None:
            args += [
                "--entry", f"{member.occurrence}={member.entry_payload}",
                "--entry-stage", f"{member.occurrence}={member.entry_stage}",
            ]
        elif member.state == READY:
            assert member.archive is not None and member.revision_key is not None
            args += [
                "--member", f"{member.occurrence}={member.archive}",
                "--member-revision-key", f"{member.occurrence}={member.revision_key}",
            ]
        elif member.state == ABSENT and not member.is_entry:
            args += ["--absent", member.occurrence]
    return args
