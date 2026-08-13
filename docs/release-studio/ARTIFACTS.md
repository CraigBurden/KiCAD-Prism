# Release Studio artifacts

## What a build retains

A successful build retains an immutable technical dossier, a separate build-
evidence archive, member metadata, domain fingerprints, projections, logs, and
an evaluation record. The dossier contains canonical release bytes, including:

- `manifest.json` with sorted member paths, canonicalizer identities, released
  digests, media types, member kinds, domains, and technical digest graph;
- fabrication material such as Gerbers and Excellon drill files;
- assembly material such as BOM and component-position/CPL files;
- documentation PDFs (cover, fabrication, assembly, testpoint, drill, and
  configured schematic material); and
- `manifest.json` references to the technical digest graph and projection
  digests, rather than the full projection payload.

The separate build-evidence archive retains full board facts, DRC/ERC reports,
per-step logs, timings, and raw pre-canonical material for inspection and
forensics. Those payloads are deliberately excluded from the dossier and its
manifest digest so wall-clock data and diagnostic text do not change the
released technical identity.

The raw source digest is retained for each member, but the dossier contains the
canonicalized bytes.

## Canonicalization invariants

Canonical JSON sorts keys, emits compact UTF-8 JSON, NFC-normalizes strings,
rejects non-string keys/NFC collisions and non-finite numbers. Artifact
canonicalizers remove only recognized, non-manufacturing volatile metadata:
KiCad creation dates in Gerber/Excellon/job JSON/report outputs, known CSV
generation headers, STEP timestamps, SVG metadata/date comments, PDF metadata,
and board-stat timestamps. Semantic content, including drill-body comments,
Gerber generation software, and STEP `DATA` content, remains intact.

Deterministic archives use sorted POSIX-safe member names and stable ownership,
timestamps, and gzip metadata. The invariant is practical as well as formal:
equivalent exports at different wall-clock times must yield identical released
bytes, while their raw digests may differ.

## Vendor readiness and packs

The signed dossier is authoritative. A vendor upload pack is a derived,
convenience archive assembled from the dossier plus profile-specific evidence;
it is not independently signed and does not replace the signed members.

Selected profiles must produce all artifacts their profile promises before they
are considered ready for download or manufacture. For JLCPCB that means
Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and `cpl.xlsx`. Prism's JLC
profile stores the CSV files as attested members and draws the workbooks from
profile-specific evidence when building the derived upload ZIP. Download the
signed release archive for recordkeeping; use the derived pack only as an
upload convenience.

## Attestation and offline verification

A release archive contains `dossier.tar.gz`, `attestation.json`,
`attestation.sig`, `signing-key.json`, `verify.py`, and verification guidance.
The attestation references the dossier and manifest digests, commit/variant,
release identity, policy/waiver/override snapshot, approvals, signing key, and
audit-chain head. It is signed with Ed25519; governance metadata is intentionally
outside the technical dossier digest.

### Offline verification

Obtain the organization's public key through an authenticated trusted channel
(the public signing-key endpoint is distribution metadata, not a trust anchor),
then run:

```sh
python3 verify.py release.tar.gz \
  --trusted-key <key-id>=/path/to/<key-id>.pem
```

The verifier needs no Prism service, database, or network. It checks archive
contents, every dossier member digest, dossier/manifest/attestation digest
links, and the signature against the caller-supplied key. A valid archive with
an administrative override still verifies; the verifier reports that override
as a notice, not as a normal policy pass.
