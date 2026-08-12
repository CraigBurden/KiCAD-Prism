# Release Studio bundle

A Release Studio release is one signed archive. Offline verification needs no
Prism instance, database, or network.

```text
release.tar.gz
├── dossier.tar.gz          # immutable technical package
│   ├── manifest.json       # member digests + projection digests + digests graph
│   ├── bare_board/         # Gerbers, drill/Excellon, board stats, stackup evidence
│   ├── assembly/           # positions.csv, bom.csv, …
│   ├── documentation/      # composed cover / fab / assembly / testpoint / drill PDFs
│   └── evidence/           # DRC/ERC reports, build-evidence.json, …
├── attestation.json        # who / when / policy / approvals (references dossier)
├── attestation.sig         # Ed25519 over attestation_digest
├── signing-key.json        # public key material bundled for convenience
├── verify.py               # standalone offline verifier
└── VERIFY.md               # how to pin trust and run verification
```

## Who and when

Governance identity lives only in the attestation, never in the technical
dossier digests:

| Field | Meaning |
| --- | --- |
| `released_by` | Subject that created the release |
| `released_at` | ISO-8601 instant of release |
| `commit_sha` | Exact Git revision the dossier was built from |
| `approvals` | Approval snapshot bound to this release |
| `policy` | Policy evaluation / waiver / override snapshot |
| `signing_key_id` | Which organization key signed `attestation.sig` |

`manifest_digest` and `dossier_digest` are technical. Changing an approver or
release time must not move them; the attestation references those digests and
is what gets signed.

## How to verify

```sh
python3 verify.py release.tar.gz \
  --trusted-key <key_id>=/path/to/<key_id>.pem
```

Obtain the organization's published key from
`GET /api/release-studio/signing-keys` over authenticated TLS (or another
trusted channel). A key id alone is not a trust anchor. Exit status is 0 only
when every check in `VERIFY.md` passes.
