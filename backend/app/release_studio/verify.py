#!/usr/bin/env python3
"""Standalone offline verifier for a Prism Release Studio release archive.

This file is copied verbatim into ``release.tar.gz`` and must keep running with
**no Prism, no database, and no network**.  It therefore imports nothing from
``app.*``; the only non-stdlib import is ``cryptography`` for Ed25519, and its
absence degrades to a clearly reported "signature not checked" rather than a
false pass.

    python3 verify.py release.tar.gz
    python3 verify.py release.tar.gz --trusted-key-id prism-2026-08

Exit status is 0 only when every check passed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import tarfile
import unicodedata
from typing import Any


def canonical_json(value: Any) -> str:
    """Byte-for-byte the encoder Release Studio digests with.

    Kept in sync with ``app/release_studio/canonical/json.py``; the round-trip
    is asserted by ``test_release_studio_attestation.py`` so this copy cannot
    drift.
    """

    return json.dumps(
        _normalize_nfc(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def _normalize_nfc(value: Any) -> Any:
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [_normalize_nfc(item) for item in value]
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("canonical JSON object keys must be strings")
            normalized_key = unicodedata.normalize("NFC", key)
            if normalized_key in normalized:
                raise ValueError(f"NFC key collision: {key!r}")
            normalized[normalized_key] = _normalize_nfc(item)
        return normalized
    return value


def sha256_canonical(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


class VerificationError(RuntimeError):
    pass


class Report:
    def __init__(self) -> None:
        self.checks: list[tuple[bool, str]] = []

    def record(self, ok: bool, message: str) -> bool:
        self.checks.append((bool(ok), message))
        return bool(ok)

    @property
    def ok(self) -> bool:
        return all(ok for ok, _ in self.checks)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "checks": [{"ok": ok, "message": message} for ok, message in self.checks],
        }

    def render(self) -> str:
        lines = [("PASS" if ok else "FAIL") + f"  {message}" for ok, message in self.checks]
        lines.append("")
        lines.append("RESULT: " + ("VERIFIED" if self.ok else "REJECTED"))
        return "\n".join(lines)


def verify_archive_bytes(
    data: bytes,
    *,
    trusted_key_ids: tuple[str, ...] = (),
) -> Report:
    """Verify a ``release.tar.gz`` given only its bytes."""

    report = Report()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as archive:
        names = set(archive.getnames())
        required = {"dossier.tar.gz", "attestation.json", "attestation.sig", "signing-key.json"}
        missing = sorted(required - names)
        if not report.record(not missing, f"archive contains {sorted(required)}"):
            report.record(False, f"missing archive entries: {missing}")
            return report
        dossier_bytes = archive.extractfile("dossier.tar.gz").read()
        attestation_raw = archive.extractfile("attestation.json").read()
        signature = archive.extractfile("attestation.sig").read()
        signing_key = json.loads(archive.extractfile("signing-key.json").read().decode("utf-8"))

    attestation = json.loads(attestation_raw.decode("utf-8"))

    # 1-2: every member hashes to its manifest entry, and the set hashes to
    # dossier_digest.
    members: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(dossier_bytes), mode="r:*") as dossier:
        for info in dossier.getmembers():
            if info.isfile():
                members[info.name] = dossier.extractfile(info).read()

    manifest_bytes = members.pop("manifest.json", None)
    if not report.record(manifest_bytes is not None, "dossier contains manifest.json"):
        return report
    manifest = json.loads(manifest_bytes.decode("utf-8"))

    declared = manifest.get("members") or {}
    mismatched = []
    for path, entry in sorted(declared.items()):
        payload = members.get(path)
        if payload is None:
            mismatched.append(f"{path}: absent from dossier")
            continue
        actual = hashlib.sha256(payload).hexdigest()
        if actual != entry.get("released_digest"):
            mismatched.append(f"{path}: {actual} != {entry.get('released_digest')}")
    extra = sorted(set(members) - set(declared))
    report.record(
        not mismatched, f"{len(declared)} member digest(s) match the manifest"
    )
    for problem in mismatched[:10]:
        report.record(False, f"member digest mismatch: {problem}")
    report.record(not extra, "dossier contains no undeclared members")

    recomputed_dossier = sha256_canonical(
        [[path, entry["released_digest"]] for path, entry in sorted(declared.items())]
    )
    report.record(
        recomputed_dossier == manifest.get("dossier_digest"),
        "H(sorted[(path, released_digest)]) == manifest.dossier_digest",
    )

    # 3: the manifest hashes to manifest_digest.
    manifest_digest = sha256_canonical(manifest)
    report.record(
        "manifest_digest" not in manifest, "manifest does not contain its own digest"
    )
    report.record(
        attestation.get("manifest_digest") == manifest_digest,
        "attestation.manifest_digest == H(canonical(manifest))",
    )

    # 4-5: the attestation hashes to attestation_digest.
    declared_attestation_digest = attestation.get("attestation_digest")
    body = {key: value for key, value in attestation.items() if key != "attestation_digest"}
    recomputed_attestation = sha256_canonical(body)
    report.record(
        declared_attestation_digest == recomputed_attestation,
        "H(canonical(attestation)) == attestation.attestation_digest",
    )
    report.record(
        attestation.get("dossier_digest") == manifest.get("dossier_digest"),
        "attestation.dossier_digest == manifest.dossier_digest",
    )

    # 6-7: Ed25519 over attestation_digest, under a trusted key id.
    key_id = str(signing_key.get("key_id") or "")
    report.record(
        attestation.get("signing_key_id") == key_id,
        f"attestation names the bundled signing key ({key_id})",
    )
    _verify_signature(report, signing_key, signature, recomputed_attestation)
    if trusted_key_ids:
        report.record(key_id in trusted_key_ids, f"signing key {key_id!r} is trusted")
    else:
        report.record(True, "signing key trust not pinned (pass --trusted-key-id to enforce)")
    return report


def _verify_signature(
    report: Report, signing_key: dict[str, Any], signature: bytes, digest_hex: str
) -> None:
    algorithm = str(signing_key.get("algorithm") or "").lower()
    if algorithm != "ed25519":
        report.record(False, f"unsupported signature algorithm: {algorithm!r}")
        return
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
    except ImportError:  # pragma: no cover - exercised only without cryptography
        report.record(False, "cryptography is unavailable; signature NOT checked")
        return

    try:
        public_key = load_pem_public_key(str(signing_key["public_key"]).encode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - any parse failure is a rejection
        report.record(False, f"signing key could not be parsed: {exc}")
        return
    try:
        public_key.verify(bytes.fromhex(signature.decode("ascii").strip()), digest_hex.encode("ascii"))
    except InvalidSignature:
        report.record(False, "Ed25519 signature does not match attestation_digest")
        return
    except Exception as exc:  # noqa: BLE001
        report.record(False, f"signature verification failed: {exc}")
        return
    report.record(True, "Ed25519 signature verifies against attestation_digest")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archive", help="path to release.tar.gz")
    parser.add_argument(
        "--trusted-key-id",
        action="append",
        default=[],
        help="accept only these signing key ids (repeatable)",
    )
    parser.add_argument("--json", action="store_true", help="emit a JSON report")
    args = parser.parse_args(argv)

    with open(args.archive, "rb") as handle:
        report = verify_archive_bytes(
            handle.read(), trusted_key_ids=tuple(args.trusted_key_id)
        )
    print(json.dumps(report.to_dict(), indent=2) if args.json else report.render())
    return 0 if report.ok else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
