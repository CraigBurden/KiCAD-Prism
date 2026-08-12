#!/usr/bin/env python3
"""Standalone offline verifier for a Prism Release Studio release archive.

This file is copied verbatim into ``release.tar.gz`` and must keep running with
**no Prism, no database, and no network**.  It therefore imports nothing from
``app.*``; the only non-stdlib import is ``cryptography`` for Ed25519, and its
absence degrades to a clearly reported "signature not checked" rather than a
false pass.

    python3 verify.py release.tar.gz
    python3 verify.py release.tar.gz \
        --trusted-key prism-2026-08=/path/to/prism-2026-08.pem

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
from collections.abc import Mapping
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
        #: Things a recipient must be told that are not verification failures.
        #:
        #: An administratively overridden release is genuinely signed by the
        #: issuing organization -- it verifies, and saying otherwise would be
        #: false.  What a recipient needs to know is that it went out over open
        #: blockers, which is a separate statement from "these bytes are ours".
        self.notices: list[str] = []

    def record(self, ok: bool, message: str) -> bool:
        self.checks.append((bool(ok), message))
        return bool(ok)

    def note(self, message: str) -> None:
        self.notices.append(message)

    @property
    def ok(self) -> bool:
        return all(ok for ok, _ in self.checks)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "checks": [{"ok": ok, "message": message} for ok, message in self.checks],
            "notices": list(self.notices),
        }

    def render(self) -> str:
        lines = [("PASS" if ok else "FAIL") + f"  {message}" for ok, message in self.checks]
        for notice in self.notices:
            lines.append(f"NOTE  {notice}")
        lines.append("")
        lines.append("RESULT: " + ("VERIFIED" if self.ok else "REJECTED"))
        return "\n".join(lines)


def verify_archive_bytes(
    data: bytes,
    *,
    trusted_keys: Mapping[str, str] | None = None,
    trusted_key_ids: tuple[str, ...] = (),
) -> Report:
    """Verify a ``release.tar.gz`` against independently trusted key bytes.

    ``signing-key.json`` is useful metadata, but it is part of the untrusted
    archive.  Authenticity therefore requires a caller-supplied mapping from
    key id to public PEM.  ``trusted_key_ids`` is only an additional allow-list;
    a key id by itself is never a trust anchor.
    """

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

    # The attestation is signed, so anything it says about how the release was
    # authorized is as trustworthy as the signature -- which is exactly why an
    # administrative override is recorded there and surfaced here.
    override = (attestation.get("policy") or {}).get("override")
    if isinstance(override, dict):
        findings = override.get("findings") or []
        unsupported = override.get("unsupported_rules") or []
        report.note(
            f"released over {len(findings)} open blocking finding(s) and "
            f"{len(unsupported)} unevaluated rule(s) by administrative override"
        )
        report.note(f"override actor: {override.get('actor') or 'unrecorded'}")
        report.note(f"override reason: {override.get('reason') or 'unrecorded'}")
        for finding in findings[:10]:
            report.note(
                f"  overridden: {finding.get('rule_id')} [{finding.get('severity')}] "
                f"{finding.get('subject')} -- {finding.get('message')}"
            )

    # 6-8: the bundled key must equal independently trusted material, then the
    # signature must verify under that trusted key.  A key id is metadata, not
    # a trust anchor: an attacker can copy a legitimate id into a forged bundle.
    key_id = str(signing_key.get("key_id") or "")
    report.record(
        attestation.get("signing_key_id") == key_id,
        f"attestation names the bundled signing key ({key_id})",
    )
    algorithm = str(signing_key.get("algorithm") or "").lower()
    if not report.record(
        algorithm == "ed25519",
        f"signing key algorithm is Ed25519 (declared {algorithm!r})",
    ):
        return report
    if trusted_key_ids:
        report.record(key_id in trusted_key_ids, f"signing key {key_id!r} is trusted")
    pinned_pem = (trusted_keys or {}).get(key_id)
    if pinned_pem is None:
        report.record(
            False,
            f"no trusted public key material was supplied for signing key {key_id!r}",
        )
        return report
    if not _same_public_key(report, str(signing_key.get("public_key") or ""), pinned_pem):
        return report
    _verify_signature(report, pinned_pem, signature, recomputed_attestation)
    return report


def _same_public_key(report: Report, bundled_pem: str, trusted_pem: str) -> bool:
    """Compare public keys by normalized DER, not PEM whitespace."""

    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
    except ImportError:  # pragma: no cover - exercised only without cryptography
        return report.record(False, "cryptography is unavailable; key trust NOT checked")

    try:
        bundled = load_pem_public_key(bundled_pem.encode("utf-8"))
        trusted = load_pem_public_key(trusted_pem.encode("utf-8"))
        bundled_der = bundled.public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        trusted_der = trusted.public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    except Exception as exc:  # noqa: BLE001 - any parse failure is a rejection
        return report.record(False, f"signing key could not be normalized: {exc}")
    return report.record(
        bundled_der == trusted_der,
        "bundled signing key matches independently trusted public key material",
    )


def _verify_signature(
    report: Report, public_pem: str, signature: bytes, digest_hex: str
) -> None:
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
    except ImportError:  # pragma: no cover - exercised only without cryptography
        report.record(False, "cryptography is unavailable; signature NOT checked")
        return

    try:
        public_key = load_pem_public_key(public_pem.encode("utf-8"))
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
        "--trusted-key",
        action="append",
        default=[],
        metavar="KEY_ID=PEM_FILE",
        help="trusted public key material (repeatable; required for authenticity)",
    )
    parser.add_argument(
        "--trusted-key-id",
        action="append",
        default=[],
        help="additional key-id allow-list (repeatable; not a trust anchor)",
    )
    parser.add_argument("--json", action="store_true", help="emit a JSON report")
    args = parser.parse_args(argv)

    trusted_keys: dict[str, str] = {}
    for value in args.trusted_key:
        key_id, separator, pem_path = value.partition("=")
        if not separator or not key_id or not pem_path:
            parser.error("--trusted-key must use KEY_ID=PEM_FILE")
        if key_id in trusted_keys:
            parser.error(f"duplicate --trusted-key id: {key_id}")
        with open(pem_path, encoding="utf-8") as pem_handle:
            trusted_keys[key_id] = pem_handle.read()

    with open(args.archive, "rb") as handle:
        report = verify_archive_bytes(
            handle.read(),
            trusted_keys=trusted_keys,
            trusted_key_ids=tuple(args.trusted_key_id),
        )
    print(json.dumps(report.to_dict(), indent=2) if args.json else report.render())
    return 0 if report.ok else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
