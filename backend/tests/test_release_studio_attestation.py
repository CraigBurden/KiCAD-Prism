"""R18/R18a acceptance: attestation, Ed25519 signing, offline verification.

The decisive test here is that a *fabricated* archive — one whose every digest
has been faithfully recomputed after editing an approver name — is rejected.
That is the difference between "internally consistent" and "attributable".
"""

from __future__ import annotations

import io
import json
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from app.release_studio import verify as verify_module  # noqa: E402
from app.release_studio.attestation import (  # noqa: E402
    SigningError,
    attestation_digest_of,
    build_attestation,
    build_release_archive,
    generate_signing_key,
    load_signing_key,
    verify_signature,
)
from app.release_studio.canonical import write_deterministic_archive  # noqa: E402
from app.release_studio.canonical.json import canonical_json, canonical_json_bytes  # noqa: E402


def _dossier() -> tuple[bytes, str, str, dict]:
    import hashlib

    files = {
        "fabrication/gerbers/board-F_Cu.gbr": b"%FSLAX46Y46*%\nD10*\nM02*\n",
        "assembly/positions.csv": b"Ref,Val\nR1,10k\n",
    }
    members = {
        path: {
            "member_kind": "gerber",
            "media_type": "application/vnd.gerber",
            "size_bytes": len(data),
            "released_digest": hashlib.sha256(data).hexdigest(),
            "canonicalizer": "gerber",
            "domains": ["bare_board"],
        }
        for path, data in files.items()
    }
    dossier_digest = verify_module.sha256_canonical(
        [[path, entry["released_digest"]] for path, entry in sorted(members.items())]
    )
    manifest = {
        "schema": "prism.release-studio.manifest/1",
        "config_key": "default",
        "commit_sha": "a" * 40,
        "variant": "default",
        "dossier_digest": dossier_digest,
        "members": members,
    }
    payload = dict(files)
    payload["manifest.json"] = canonical_json_bytes(manifest)
    return write_deterministic_archive(payload), dossier_digest, verify_module.sha256_canonical(
        manifest
    ), manifest


def _release(approver: str = "krishna", key_id: str = "prism-2026-08"):
    dossier_bytes, dossier_digest, manifest_digest, _ = _dossier()
    key, _pem = generate_signing_key(key_id)
    attestation = build_attestation(
        manifest_digest=manifest_digest,
        dossier_digest=dossier_digest,
        commit_sha="a" * 40,
        variant="default",
        config_key="default",
        project_id="proj-1",
        release_label="REL-0001",
        document_number="DOC-1",
        revision="A",
        released_by="release-manager",
        released_at_iso="2026-08-11T12:00:00+00:00",
        policy_snapshot={"policy_binding_digest": "p" * 64},
        approval_snapshot=[{"role": "pcb_design", "approver": approver, "decision": "approved"}],
        audit_head={"event_hash": "h" * 64, "sequence": 412},
        signing_key_id=key.key_id,
        issuer="Example Org",
    )
    signature = key.sign_hex(attestation["attestation_digest"])
    archive = build_release_archive(
        dossier_bytes=dossier_bytes,
        attestation=attestation,
        signature_hex=signature,
        signing_key_id=key.key_id,
        public_pem=key.public_pem,
        issuer="Example Org",
    )
    return archive, key, attestation


class AttestationTests(unittest.TestCase):
    def test_sign_and_verify_round_trip(self) -> None:
        key, pem = generate_signing_key("k1")
        reloaded = load_signing_key("k1", pem)
        digest = "b" * 64
        signature = reloaded.sign_hex(digest)
        self.assertTrue(verify_signature(key.public_pem, signature, digest))
        self.assertFalse(verify_signature(key.public_pem, signature, "c" * 64))

    def test_non_ed25519_key_is_refused(self) -> None:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        rsa_pem = (
            rsa.generate_private_key(public_exponent=65537, key_size=2048)
            .private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            .decode()
        )
        with self.assertRaisesRegex(SigningError, "must be Ed25519"):
            load_signing_key("k", rsa_pem)

    def test_attestation_references_the_dossier_and_carries_the_audit_head(self) -> None:
        _archive, _key, attestation = _release()
        self.assertEqual(attestation["audit"]["chain_head_hash"], "h" * 64)
        self.assertEqual(attestation["audit"]["sequence"], 412)
        self.assertEqual(attestation_digest_of(attestation), attestation["attestation_digest"])

    def test_verifier_canonical_json_matches_the_production_encoder(self) -> None:
        """The bundled verifier carries its own encoder; it must not drift."""

        for payload in (
            {"b": 1, "a": [2, {"z": "é", "y": "é"}]},
            {"nested": {"k": [1, 2, {"m": "ünïcode"}]}},
            {"unicode_value": "é"},
        ):
            self.assertEqual(canonical_json(payload), verify_module.canonical_json(payload))


class OfflineVerificationTests(unittest.TestCase):
    def test_a_genuine_release_verifies(self) -> None:
        archive, key, _ = _release()
        report = verify_module.verify_archive_bytes(
            archive, trusted_key_ids=(key.key_id,)
        )
        self.assertTrue(report.ok, report.render())
        self.assertTrue(
            any("Ed25519 signature verifies" in message for _, message in report.checks)
        )

    def test_untrusted_key_id_is_rejected(self) -> None:
        archive, _key, _ = _release()
        report = verify_module.verify_archive_bytes(
            archive, trusted_key_ids=("some-other-key",)
        )
        self.assertFalse(report.ok)
        self.assertTrue(any("is trusted" in message for ok, message in report.checks if not ok))

    def test_fabricated_archive_with_recomputed_digests_is_rejected(self) -> None:
        """Edit the approver, recompute every digest honestly, keep the key."""

        archive, key, _ = _release(approver="krishna")
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
            entries = {
                info.name: tar.extractfile(info).read()
                for info in tar.getmembers()
                if info.isfile()
            }

        attestation = json.loads(entries["attestation.json"].decode())
        attestation["approvals"][0]["approver"] = "someone-else"
        body = {k: v for k, v in attestation.items() if k != "attestation_digest"}
        # The forger recomputes the digest correctly...
        attestation["attestation_digest"] = verify_module.sha256_canonical(body)
        entries["attestation.json"] = canonical_json_bytes(attestation)
        # ...but cannot produce a matching signature without the private key.
        forged = write_deterministic_archive(entries)

        report = verify_module.verify_archive_bytes(forged, trusted_key_ids=(key.key_id,))
        self.assertFalse(report.ok, "a forged approver must not verify")
        failures = [message for ok, message in report.checks if not ok]
        self.assertTrue(
            any("signature does not match" in message for message in failures), failures
        )

    def test_tampered_member_bytes_are_rejected(self) -> None:
        archive, key, _ = _release()
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
            entries = {
                info.name: tar.extractfile(info).read()
                for info in tar.getmembers()
                if info.isfile()
            }
        with tarfile.open(fileobj=io.BytesIO(entries["dossier.tar.gz"]), mode="r:*") as tar:
            dossier = {
                info.name: tar.extractfile(info).read()
                for info in tar.getmembers()
                if info.isfile()
            }
        dossier["fabrication/gerbers/board-F_Cu.gbr"] += b"G04 sneaky*\n"
        entries["dossier.tar.gz"] = write_deterministic_archive(dossier)

        report = verify_module.verify_archive_bytes(
            write_deterministic_archive(entries), trusted_key_ids=(key.key_id,)
        )
        self.assertFalse(report.ok)
        self.assertTrue(
            any("member digest mismatch" in message for ok, message in report.checks if not ok)
        )

    def test_key_rotation_keeps_old_releases_verifiable(self) -> None:
        old_archive, old_key, _ = _release(key_id="prism-2025-01")
        new_archive, new_key, _ = _release(key_id="prism-2026-08")
        published = (old_key.key_id, new_key.key_id)
        for archive in (old_archive, new_archive):
            report = verify_module.verify_archive_bytes(archive, trusted_key_ids=published)
            self.assertTrue(report.ok, report.render())

    def test_verifier_runs_standalone_with_no_prism_on_the_path(self) -> None:
        """Extract verify.py from the archive and run it in a bare interpreter."""

        archive, key, _ = _release()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "release.tar.gz").write_bytes(archive)
            with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
                (root / "verify.py").write_bytes(tar.extractfile("verify.py").read())
                self.assertIn("VERIFY.md", tar.getnames())

            result = subprocess.run(
                [sys.executable, "verify.py", "release.tar.gz",
                 "--trusted-key-id", key.key_id, "--json"],
                cwd=root,
                capture_output=True,
                text=True,
                # A bare cwd and no PYTHONPATH: nothing from app.* is importable.
                env={"PATH": "/usr/bin:/bin", "HOME": str(root)},
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)["ok"])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
