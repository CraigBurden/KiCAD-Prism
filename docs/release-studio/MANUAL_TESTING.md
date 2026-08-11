# Release Studio — manual end-to-end pass

This is Stage 1 exit criterion 10: drive the feature in the running app and end
at a release record that cannot be edited.

## 1. Generate a signing key

Release signing is refused unless the key is configured, so the API can never
issue something a recipient cannot verify.

```bash
python3 -c "
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
k = Ed25519PrivateKey.generate()
print(k.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()).decode())
"
```

Put the PEM somewhere the API process can read and set:

```
PRISM_RELEASE_SIGNING_KEY_ID=prism-2026-08
PRISM_RELEASE_SIGNING_KEY_FILE=/run/secrets/prism-release-key.pem
PRISM_RELEASE_ISSUER=Your Organization
```

The private key never reaches the database or the worker.

## 2. Add a release configuration to the project repository

`.prism/release-studio/configurations/default.yaml`:

```yaml
schema: prism.release-studio.configuration/1
title: Production release
board: hardware/board.kicad_pcb
schematic: hardware/board.kicad_sch
default_variant: ""
```

Commit and push it. The closure checks out the **whole tree**, so this file is
part of the build inputs.

## 3. Walk the cycle in the UI

Open the project, choose **Release Studio**, then:

1. **Build** — enter a commit (or `HEAD`) and press Build. The job materializes
   the closure, runs the catalogue, canonicalizes every output, and packages the
   dossier. Watch the candidate appear with its hermeticity state.
2. **Evaluation** — the build is evaluated against the default policy. Confirm
   that a rule whose projection is missing shows as `unsupported`, in its own
   colour, with a reason — not as a pass.
3. **Waivers** — if DRC blocks the release, propose a waiver from the findings
   list. A second person must approve it: the API refuses a waiver approved by
   its own owner.
4. **Approvals** — approve `pcb_design` for `bare_board` and `manufacturing` for
   `assembly`. Approving your own candidate is refused unless you supply a
   written self-approval reason, which is recorded on the immutable row.
5. **Release** — give it a label and press *Sign and release*. Release is
   refused while any blocking finding is unwaived, while any rule is
   `unsupported`, or while a required role/domain approval is missing.

## 4. Verify offline — the point of the whole feature

Download the release archive, then verify it with no Prism, no database, and no
network:

```bash
tar xzf REL-0001-release.tar.gz verify.py
python3 verify.py REL-0001-release.tar.gz --trusted-key-id prism-2026-08
```

Expect `RESULT: VERIFIED`. Now prove it means something:

```bash
mkdir forge && cd forge && tar xzf ../REL-0001-release.tar.gz
# edit an approver name in attestation.json, recompute attestation_digest
# honestly, repack, and re-run verify.py
```

It is rejected on the signature. That is the difference between "internally
consistent" and "attributable to your organization".

## 5. Confirm immutability

- Re-run the same build: the candidate is reused (idempotent on `build_key`).
- Try to edit an approval or an audit row directly in Postgres as the app user:
  the trigger raises.
- `GET .../release-studio/audit/verify` walks the chain and reports linkage.

## Reproducibility spot check

Build the same commit twice, an hour apart, from separate checkouts. Every
member's `released_digest` must match while the Gerber/drill `source_raw_digest`
values differ — the raw bytes carry KiCad's wall-clock stamps, the released
bytes do not.
