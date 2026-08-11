"""Members, manifest, dossier, and technical scope fingerprints (R10).

Everything in this module lives strictly in the technical domain.  No approver
identity, policy binding, candidate id, build id, job id, or wall-clock time may
reach any digest computed here — that separation is what lets a policy change
invalidate an approval without pretending the build changed.  It is enforced by
:func:`assert_no_governance_leak` and asserted in the R10 tests.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.release_studio.canonical import (
    CANONICALIZER_REGISTRY_NAME,
    CANONICALIZER_REGISTRY_VERSION,
    canonicalize,
    sha256_canonical,
    write_deterministic_archive,
)
from app.release_studio.steps import EVIDENCE_STEPS, StepOutput

MANIFEST_SCHEMA = "prism.release-studio.manifest/1"

GOVERNED_DOMAINS: tuple[str, ...] = ("bare_board", "assembly", "documentation", "evidence")

# Keys that must never appear anywhere in the manifest tree.  A build id or an
# approver name inside the manifest would make manifest_digest move for
# governance-only reasons.
FORBIDDEN_MANIFEST_KEYS: frozenset[str] = frozenset(
    {
        "approver",
        "approvals",
        "build_id",
        "candidate_id",
        "created_at",
        "evaluation_id",
        "job_id",
        "policy_binding",
        "policy_binding_digest",
        "release_id",
        "released_at",
        "signature",
        "signing_key_id",
    }
)

_SUFFIX_CANONICALIZERS: Mapping[str, str] = {
    ".gbr": "gerber",
    ".gbl": "gerber",
    ".gbo": "gerber",
    ".gbp": "gerber",
    ".gbs": "gerber",
    ".gtl": "gerber",
    ".gto": "gerber",
    ".gtp": "gerber",
    ".gts": "gerber",
    ".gm1": "gerber",
    ".gbrjob": "gbrjob",
    ".drl": "excellon",
    ".csv": "csv",
    ".pdf": "pdf",
    ".svg": "svg",
    ".step": "step",
    ".stp": "step",
}

_MEDIA_TYPES: Mapping[str, str] = {
    "gerber": "application/vnd.gerber",
    "gbrjob": "application/json",
    "excellon": "text/plain",
    "csv": "text/csv",
    "pdf": "application/pdf",
    "svg": "image/svg+xml",
    "step": "model/step",
    "drc_erc_json": "application/json",
    "board_stats_json": "application/json",
}


class DossierError(RuntimeError):
    """A dossier could not be assembled deterministically."""


@dataclass(frozen=True, slots=True)
class Member:
    """One released file: canonical bytes plus the raw bytes' identity."""

    path: str
    member_kind: str
    media_type: str
    size_bytes: int
    released_digest: str
    source_raw_digest: str
    canonicalizer: str
    domains: tuple[str, ...]
    step_id: str = ""

    def manifest_entry(self) -> dict[str, Any]:
        return {
            "member_kind": self.member_kind,
            "media_type": self.media_type,
            "size_bytes": self.size_bytes,
            "released_digest": self.released_digest,
            "canonicalizer": self.canonicalizer,
            "domains": list(self.domains),
        }


@dataclass(frozen=True, slots=True)
class Dossier:
    members: tuple[Member, ...]
    manifest: dict[str, Any]
    dossier_digest: str
    manifest_digest: str
    dossier_bytes: bytes
    evidence_bytes: bytes
    evidence: tuple[dict[str, Any], ...] = ()
    fingerprints: Mapping[str, dict[str, Any]] = field(default_factory=dict)

    def member_by_path(self, path: str) -> Member | None:
        return next((member for member in self.members if member.path == path), None)


def canonicalizer_for(relative_path: str, spec_canonicalizer: str) -> str:
    """Pick the canonicalizer for one produced file."""

    if spec_canonicalizer:
        return spec_canonicalizer
    suffix = Path(relative_path).suffix.lower()
    resolved = _SUFFIX_CANONICALIZERS.get(suffix)
    if resolved is None:
        raise DossierError(
            f"no canonicalizer registered for {relative_path!r}; add one to the "
            "R4 registry before releasing this member type"
        )
    return resolved


def build_members(outputs: Sequence[StepOutput]) -> tuple[Member, ...]:
    """Canonicalize every produced file into a released member."""

    members: list[Member] = []
    seen: set[str] = set()
    for output in outputs:
        if not output.ran:
            continue
        for path in output.files:
            relative = path.relative_to(output.root).as_posix()
            if relative in seen:
                raise DossierError(f"duplicate member path: {relative}")
            seen.add(relative)
            raw = path.read_bytes()
            canonicalizer = canonicalizer_for(relative, output.spec.canonicalizer)
            try:
                canonical = canonicalize(canonicalizer, raw)
            except Exception as exc:  # noqa: BLE001 - surfaced with the member path
                raise DossierError(
                    f"canonicalizing {relative} with {canonicalizer!r} failed: {exc}"
                ) from exc
            members.append(
                Member(
                    path=relative,
                    member_kind=output.spec.member_kind,
                    media_type=_MEDIA_TYPES.get(canonicalizer, "application/octet-stream"),
                    size_bytes=len(canonical),
                    released_digest=hashlib.sha256(canonical).hexdigest(),
                    source_raw_digest=hashlib.sha256(raw).hexdigest(),
                    canonicalizer=canonicalizer,
                    domains=output.spec.domains,
                    step_id=output.step_id,
                )
            )
    return tuple(sorted(members, key=lambda member: member.path))


def compute_dossier_digest(members: Sequence[Member]) -> str:
    """``H(sorted[(path, released_digest)])`` — the manifest is excluded."""

    return sha256_canonical(
        [[member.path, member.released_digest] for member in sorted(members, key=lambda m: m.path)]
    )


def technical_scope_fingerprint(
    domain: str,
    members: Sequence[Member],
    *,
    toolchain_digest: str,
    normalized_argv: Mapping[str, Sequence[str]],
    config_fragments: Mapping[str, Any],
    projections: Mapping[str, Any] | None = None,
    fidelity: str = "artifact",
) -> dict[str, Any]:
    """Fingerprint one governed domain. No policy input, by construction."""

    domain_members = [member for member in members if domain in member.domains]
    steps = sorted({member.step_id for member in domain_members if member.step_id})
    inputs = {
        "domain_id": domain,
        "released_digests": [
            [member.path, member.released_digest]
            for member in sorted(domain_members, key=lambda m: m.path)
        ],
        "normalized_argv": [list(normalized_argv.get(step, ())) for step in steps],
        "config_fragments": dict(config_fragments),
        "projections": dict(projections or {}),
        "toolchain_digest": toolchain_digest,
    }
    return {
        "domain": domain,
        "fingerprint": sha256_canonical(inputs),
        "inputs": inputs,
        "fidelity": fidelity,
    }


def assert_no_governance_leak(payload: Any, *, where: str = "manifest") -> None:
    """Fail loudly if a governance field reached a technical-domain digest."""

    def walk(node: Any, trail: str) -> None:
        if isinstance(node, Mapping):
            for key, value in node.items():
                if key in FORBIDDEN_MANIFEST_KEYS:
                    raise DossierError(
                        f"{where} contains governance field {key!r} at {trail or '<root>'}"
                    )
                walk(value, f"{trail}.{key}" if trail else str(key))
        elif isinstance(node, (list, tuple)):
            for index, value in enumerate(node):
                walk(value, f"{trail}[{index}]")

    walk(payload, "")


def build_manifest(
    *,
    members: Sequence[Member],
    dossier_digest: str,
    commit_sha: str,
    variant: str,
    config_key: str,
    technical_config_digest: str,
    input_closure_digest: str,
    toolchain: Mapping[str, Any],
    toolchain_digest: str,
    build_key: str,
    fingerprints: Mapping[str, dict[str, Any]],
    projections: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """The manifest never contains its own digest, and never governance data."""

    manifest = {
        "schema": MANIFEST_SCHEMA,
        "config_key": config_key,
        "commit_sha": commit_sha,
        "variant": variant,
        "build_key": build_key,
        "technical_config_digest": technical_config_digest,
        "input_closure_digest": input_closure_digest,
        "toolchain_digest": toolchain_digest,
        "toolchain": dict(toolchain),
        "canonicalizer_registry": {
            "name": CANONICALIZER_REGISTRY_NAME,
            "version": CANONICALIZER_REGISTRY_VERSION,
        },
        "dossier_digest": dossier_digest,
        "members": {member.path: member.manifest_entry() for member in members},
        "scope_fingerprints": {
            domain: record["fingerprint"] for domain, record in sorted(fingerprints.items())
        },
        "projections": dict(projections or {}),
    }
    assert_no_governance_leak(manifest)
    return manifest


def assemble(
    *,
    outputs: Sequence[StepOutput],
    commit_sha: str,
    variant: str,
    config_key: str,
    technical_config_digest: str,
    input_closure_digest: str,
    toolchain: Mapping[str, Any],
    toolchain_digest: str,
    build_key: str,
    config_fragments: Mapping[str, Any] | None = None,
    projections: Mapping[str, Any] | None = None,
) -> Dossier:
    """Canonicalize, fingerprint, and package one build's outputs."""

    members = build_members(outputs)
    if not members:
        raise DossierError("no released members were produced")
    dossier_digest = compute_dossier_digest(members)
    normalized_argv = {output.step_id: output.normalized_argv for output in outputs}

    fingerprints = {}
    for domain in GOVERNED_DOMAINS:
        if not any(domain in member.domains for member in members):
            continue
        fingerprints[domain] = technical_scope_fingerprint(
            domain,
            members,
            toolchain_digest=toolchain_digest,
            normalized_argv=normalized_argv,
            config_fragments=config_fragments or {},
            projections=projections,
        )

    manifest = build_manifest(
        members=members,
        dossier_digest=dossier_digest,
        commit_sha=commit_sha,
        variant=variant,
        config_key=config_key,
        technical_config_digest=technical_config_digest,
        input_closure_digest=input_closure_digest,
        toolchain=toolchain,
        toolchain_digest=toolchain_digest,
        build_key=build_key,
        fingerprints=fingerprints,
        projections=projections,
    )
    manifest_digest = sha256_canonical(manifest)

    canonical_files = _canonical_bytes_by_path(outputs, members)
    dossier_members = dict(canonical_files)
    dossier_members["manifest.json"] = _manifest_bytes(manifest)
    dossier_bytes = write_deterministic_archive(dossier_members)

    evidence_members = {
        f"raw/{path}": data for path, data in _raw_bytes_by_path(outputs, members).items()
    }
    evidence_members["build-evidence.json"] = _manifest_bytes(
        {
            "schema": "prism.release-studio.build-evidence/1",
            "build_key": build_key,
            "manifest_digest": manifest_digest,
            "members": {
                member.path: {
                    "source_raw_digest": member.source_raw_digest,
                    "released_digest": member.released_digest,
                    "canonicalizer": member.canonicalizer,
                }
                for member in members
            },
            "steps": {
                output.step_id: {
                    "step_type": output.step_type,
                    "normalized_argv": list(output.normalized_argv),
                    "returncode": output.returncode,
                    "skipped_reason": output.skipped_reason,
                }
                for output in outputs
            },
        }
    )
    evidence_bytes = write_deterministic_archive(evidence_members)

    return Dossier(
        members=members,
        manifest=manifest,
        dossier_digest=dossier_digest,
        manifest_digest=manifest_digest,
        dossier_bytes=dossier_bytes,
        evidence_bytes=evidence_bytes,
        evidence=_evidence_records(outputs, members),
        fingerprints=fingerprints,
    )


def _manifest_bytes(payload: Mapping[str, Any]) -> bytes:
    from app.release_studio.canonical.json import canonical_json_bytes

    return canonical_json_bytes(payload)


def _canonical_bytes_by_path(
    outputs: Sequence[StepOutput], members: Sequence[Member]
) -> dict[str, bytes]:
    by_path: dict[str, bytes] = {}
    for output in outputs:
        if not output.ran:
            continue
        for path in output.files:
            relative = path.relative_to(output.root).as_posix()
            member = next((m for m in members if m.path == relative), None)
            if member is None:
                continue
            by_path[relative] = canonicalize(member.canonicalizer, path.read_bytes())
    return by_path


def _raw_bytes_by_path(
    outputs: Sequence[StepOutput], members: Sequence[Member]
) -> dict[str, bytes]:
    by_path: dict[str, bytes] = {}
    for output in outputs:
        if not output.ran:
            continue
        for path in output.files:
            relative = path.relative_to(output.root).as_posix()
            by_path[relative] = path.read_bytes()
    return by_path


def _evidence_records(
    outputs: Sequence[StepOutput], members: Sequence[Member]
) -> tuple[dict[str, Any], ...]:
    import json as _json

    from app.release_studio.steps import evidence_counts

    records: list[dict[str, Any]] = []
    for output in outputs:
        kind = EVIDENCE_STEPS.get(output.step_id)
        if kind is None or not output.ran or not output.files:
            continue
        member = next(
            (m for m in members if m.step_id == output.step_id),
            None,
        )
        if member is None:
            continue
        canonical = canonicalize(member.canonicalizer, output.files[0].read_bytes())
        try:
            report = _json.loads(canonical.decode("utf-8"))
        except ValueError:
            report = {}
        records.append(
            {
                "kind": kind,
                "report_digest": member.released_digest,
                "counts": evidence_counts(report if isinstance(report, dict) else {}),
                "member_path": member.path,
            }
        )
    return tuple(records)


__all__ = [
    "FORBIDDEN_MANIFEST_KEYS",
    "GOVERNED_DOMAINS",
    "MANIFEST_SCHEMA",
    "Dossier",
    "DossierError",
    "Member",
    "assemble",
    "assert_no_governance_leak",
    "build_manifest",
    "build_members",
    "canonicalizer_for",
    "compute_dossier_digest",
    "technical_scope_fingerprint",
]
