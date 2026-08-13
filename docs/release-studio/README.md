# Release Studio

Release Studio turns a committed KiCad design revision into an inspectable,
governed, signed manufacturing release. It keeps the technical package
separate from the decision to release it: a build is immutable technical
evidence; a release record is the signed library entry that refers to it.

## Start here

- [User guide](USER_GUIDE.md) — the completed user flow.
- [Configuration](CONFIGURATION.md) — committed release YAML, normalized documents, and summaries.
- [Governance](GOVERNANCE.md) — policies, waivers, approvals, and overrides.
- [Artifacts](ARTIFACTS.md) — dossiers, vendor packs, attestations, and verification.
- [Operations](OPERATIONS.md) — executor, signing, retention, recovery, and diagnosis.
- [Architecture](ARCHITECTURE.md) — immutable boundaries and trust model.
- [Testing](TESTING.md) — automated checks and manual acceptance coverage.

## Canonical flow

1. **Settings** — author the release configuration, manufacturing metadata and
   variant in Prism. **Save & publish** validates it, publishes a leased,
   configuration-only commit to the tracked branch, fast-forwards the mirror,
   and selects the exact remote-backed SHA.
2. **Current** — start one build, follow its persistent live log and cancel it
   safely if required. Completion selects outputs by the job's stored identity.
3. **History / Library** — choose a retained attempt or a signed release. These
   lists are separate and do not preselect stale evidence.
4. **Inspect** — view released document PDFs, dossier members, evidence, logs,
   digests, and available vendor-pack downloads.
5. **Approve** — evaluate the immutable build under policy, address findings,
   apply build-bound waivers where justified, and record valid approvals.
6. **Release** — create a separately named release record. Prism signs its
   attestation over the exact dossier, policy decision, approvals, and audit
   head.
7. **Verify, download, share** — download the dossier or signed archive,
   verify it offline against an independently trusted public key, and create or
   revoke a web share when distribution is appropriate.

Git remains the immutable source of release identity, but manual YAML authoring,
committing, and pushing are not separate user steps. A configuration is usable
only after remote publication succeeds, so ordinary Sync remains a clean
fast-forward operation. The progress rail is
navigational, not a one-way wizard. Builds can be
re-evaluated without rerunning KiCad, approvals can arrive over time, and old
attempts remain selectable. A release record is never just a changed build
status; it is a distinct, immutable project-library object.
