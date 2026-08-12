"""Attestation, Ed25519 signing, and release archive assembly (R18/R18a).

Hash chaining proves self-consistency, not issuance: anyone can fabricate an
archive claiming an approval and recompute every digest.  Signing the
attestation is what turns "this archive is internally consistent" into "this
archive is attributable to the organization that released it".

The private key is supplied to the API process as a secret and never touches
the database or the worker.  Only public material is persisted.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Sequence

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.release_studio.canonical import sha256_canonical, write_deterministic_archive
from app.release_studio.canonical.json import canonical_json_bytes

ATTESTATION_SCHEMA = "prism.release-studio.attestation/1"
SIGNATURE_ALGORITHM = "ed25519"

_VERIFIER_SOURCE = Path(__file__).with_name("verify.py")


class SigningError(RuntimeError):
    """The release could not be signed or its key material is unusable."""


@dataclass(frozen=True, slots=True)
class SigningKey:
    key_id: str
    private_key: Ed25519PrivateKey

    @property
    def public_pem(self) -> str:
        return (
            self.private_key.public_key()
            .public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            .decode("ascii")
        )

    def sign_hex(self, digest_hex: str) -> str:
        return self.private_key.sign(digest_hex.encode("ascii")).hex()


def load_signing_key(key_id: str, private_pem: str) -> SigningKey:
    """Load an Ed25519 private key from PEM text."""

    if not key_id.strip():
        raise SigningError("a signing key id is required")
    try:
        key = serialization.load_pem_private_key(private_pem.encode("utf-8"), password=None)
    except Exception as exc:  # noqa: BLE001 - any parse failure is fatal
        raise SigningError(f"signing key could not be parsed: {exc}") from exc
    if not isinstance(key, Ed25519PrivateKey):
        raise SigningError("Release Studio signing keys must be Ed25519")
    return SigningKey(key_id=key_id.strip(), private_key=key)


def generate_signing_key(key_id: str) -> tuple[SigningKey, str]:
    """Create a key pair. Returns the key and its private PEM for the operator."""

    private = Ed25519PrivateKey.generate()
    pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    return SigningKey(key_id=key_id, private_key=private), pem


def verify_signature(public_pem: str, signature_hex: str, digest_hex: str) -> bool:
    try:
        public = serialization.load_pem_public_key(public_pem.encode("utf-8"))
        if not isinstance(public, Ed25519PublicKey):
            return False
        public.verify(bytes.fromhex(signature_hex), digest_hex.encode("ascii"))
    except (InvalidSignature, ValueError, TypeError):
        return False
    return True


def build_attestation(
    *,
    manifest_digest: str,
    dossier_digest: str,
    commit_sha: str,
    variant: str,
    config_key: str,
    project_id: str,
    release_label: str,
    document_number: str,
    revision: str,
    released_by: str,
    released_at_iso: str,
    policy_snapshot: Mapping[str, Any],
    approval_snapshot: Sequence[Mapping[str, Any]],
    audit_head: Mapping[str, Any],
    signing_key_id: str,
    issuer: str = "",
) -> dict[str, Any]:
    """Assemble the attestation. It references the dossier, never the reverse.

    ``audit.chain_head_hash`` is included so post-release truncation of the
    audit trail is detectable against the archived, signed attestation.
    """

    body: dict[str, Any] = {
        "schema": ATTESTATION_SCHEMA,
        "issuer": issuer,
        "project_id": project_id,
        "config_key": config_key,
        "release_label": release_label,
        "document_number": document_number,
        "revision": revision,
        "commit_sha": commit_sha,
        "variant": variant,
        "manifest_digest": manifest_digest,
        "dossier_digest": dossier_digest,
        "released_by": released_by,
        "released_at": released_at_iso,
        "policy": dict(policy_snapshot),
        "approvals": [dict(item) for item in approval_snapshot],
        "audit": {
            "chain_head_hash": str(audit_head.get("event_hash") or ""),
            "sequence": int(audit_head.get("sequence") or 0),
        },
        "signing_key_id": signing_key_id,
        "signature_algorithm": SIGNATURE_ALGORITHM,
    }
    body["attestation_digest"] = sha256_canonical(body)
    return body


def attestation_digest_of(attestation: Mapping[str, Any]) -> str:
    """Recompute the digest over everything except the digest field itself."""

    return sha256_canonical(
        {key: value for key, value in attestation.items() if key != "attestation_digest"}
    )


def build_release_archive(
    *,
    dossier_bytes: bytes,
    attestation: Mapping[str, Any],
    signature_hex: str,
    signing_key_id: str,
    public_pem: str,
    valid_from: str = "",
    valid_to: str = "",
    issuer: str = "",
    archive_mtime: int | None = None,
) -> bytes:
    """Package ``release.tar.gz`` including the standalone verifier."""

    signing_key_document = {
        "key_id": signing_key_id,
        "algorithm": SIGNATURE_ALGORITHM,
        "public_key": public_pem,
        "valid_from": valid_from,
        "valid_to": valid_to,
        "issuer": issuer,
    }
    members = {
        "dossier.tar.gz": dossier_bytes,
        "attestation.json": canonical_json_bytes(attestation),
        "attestation.sig": signature_hex.encode("ascii"),
        "signing-key.json": canonical_json_bytes(signing_key_document),
        "verify.py": _VERIFIER_SOURCE.read_bytes(),
        "VERIFY.md": _verify_readme(signing_key_id).encode("utf-8"),
    }
    if archive_mtime is None:
        archive_mtime = _iso_timestamp(str(attestation.get("released_at") or ""))
    return write_deterministic_archive(members, mtime=archive_mtime)


def _iso_timestamp(value: str) -> int:
    """Convert a signed ISO release instant to deterministic archive metadata."""

    if not value:
        return 0
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        return 0
    return max(0, int(parsed.timestamp()))


def _verify_readme(signing_key_id: str) -> str:
    return f"""# Verifying this release

This archive is verifiable offline. It needs no Prism instance, no database,
and no network access.

```sh
python3 verify.py release.tar.gz \
  --trusted-key {signing_key_id}=/path/to/{signing_key_id}.pem
```

The verifier checks, in order:

1. every member's SHA-256 equals `manifest.members[path].released_digest`
2. `H(sorted[(path, released_digest)])` equals `dossier_digest`
3. `H(canonical(manifest))` equals the attestation's `manifest_digest`
4. `H(canonical(attestation))` equals `attestation_digest`
5. the public key in `signing-key.json` equals independently trusted public
   key material supplied with `--trusted-key`
6. the Ed25519 signature in `attestation.sig` verifies `attestation_digest`
   under that independently trusted key

Steps 1-4 prove the archive is internally consistent. Step 5 is what proves it
was issued by the holder of the organization's release key: recomputing every
digest after editing an approver name still fails, because the signature no
longer matches.

Obtain the organization's published key material from
`GET /api/release-studio/signing-keys` over an authenticated TLS connection, or
through another trusted channel. A key id alone is not a trust anchor. The exit
status is 0 only if every check passed.
"""


__all__ = [
    "ATTESTATION_SCHEMA",
    "SIGNATURE_ALGORITHM",
    "SigningError",
    "SigningKey",
    "attestation_digest_of",
    "build_attestation",
    "build_release_archive",
    "generate_signing_key",
    "load_signing_key",
    "verify_signature",
]
