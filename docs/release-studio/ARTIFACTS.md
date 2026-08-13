# Release Studio artifacts

## What a build retains

A successful build retains an immutable technical dossier, a separate build-
evidence archive, member metadata, domain fingerprints, projections, and logs.
The dossier contains canonical release bytes, including:

- `manifest.json` with sorted member paths, canonicalizer identities, released
  digests, media types, member kinds, domains, and technical digest graph;
- fabrication material such as Gerbers and Excellon drill files;
- assembly material such as BOM and component-position/CPL files;
- documentation PDFs (cover, fabrication, assembly, testpoint, drill, and
  configured schematic material); and
- `manifest.json` references to the technical digest graph and projection
  digests, rather than the full projection payload.

The separate build-evidence archive retains full board facts, DRC/ERC reports,
per-step logs, timings, and raw pre-canonical material. Those payloads are
excluded from the dossier and its manifest digest so wall-clock data does not
change the released technical identity.

## Canonicalization invariants

Canonical JSON sorts keys, emits compact UTF-8 JSON, NFC-normalizes strings,
rejects non-string keys/NFC collisions and non-finite numbers. Artifact
canonicalizers remove only recognized, non-manufacturing volatile metadata:
KiCad creation dates in Gerber/Excellon/job JSON/report outputs, known CSV
generation headers, STEP timestamps, SVG metadata/date comments, PDF metadata,
and board-stat timestamps.

Deterministic archives use sorted POSIX-safe member names and stable ownership,
timestamps, and gzip metadata. Equivalent exports at different wall-clock times
must yield identical released bytes, while their raw digests may differ.

## Vendor readiness and packs

A vendor upload pack is a derived convenience archive assembled from the
dossier plus profile-specific evidence. It does not replace the dossier
members.

Selected profiles must produce all artifacts their profile promises before they
are considered ready. For JLCPCB that means Gerbers, drill, `bom.csv`,
`cpl.csv`, `bom.xlsx`, and `cpl.xlsx`.

## Forge zip

**Publish** repacks dossier members into a zip (`{project}-{tag}.zip`) and
attaches it to a GitHub or GitLab Release. The zip is the same files as the
stored dossier, in a forge-friendly container. Signed attestation archives are
not produced by the running product; that format lives on
`feature/release-studio-governance`.
