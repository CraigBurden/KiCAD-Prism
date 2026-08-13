# Release Studio operations

## Executor and CI

Release execution is pinned to the KiCad executor image declared in
`backend/Dockerfile`. The built image writes the exact OCI reference used by
`FROM` to `/etc/prism/kicad-base-image`; runtime release work identifies that
same value through `PRISM_RELEASE_EXECUTOR_IMAGE`. The live contract requires
a lowercase SHA-256 image digest and KiCad `10.0.4`.

The live release suite runs `kicad-cli` with argument vectors, not shell
interpolation. The required quality gate on the core merge paths builds the
pinned AMD64 image and fails on zero tests, skips, failures, or errors. Registry
availability for that pinned image is therefore part of the merge and recovery
SLA. Operators may intentionally override `KICAD_BASE_IMAGE` for a controlled
build, but must record and validate the replacement identity.

## Signing keys and environment

The API process, not the worker or database, receives the Ed25519 private key.
Set and protect:

```text
PRISM_RELEASE_SIGNING_KEY_ID=<organization-key-id>
PRISM_RELEASE_SIGNING_KEY_FILE=<readable-secret-file>
PRISM_RELEASE_ISSUER=<organization-name>
```

The private key must be supplied through the deployment secret mechanism and
must never be stored in Prism tables, artifacts, source control, logs, or the
browser. Only public key material and signing-key status are persisted.
Signing material for a `PRISM_RELEASE_SIGNING_KEY_ID` is immutable once it is
recorded. Rotate keys by deploying new material under a new key ID; do not
replace the material associated with an existing ID, because historical release
verification depends on that stable public-key identity.

## Retention and garbage collection

Release pins are indefinite liveness markers for the artifacts referenced by
dossiers, attestations, and evidence. Metadata pruning excludes pinned artifacts
atomically across normal, invalidated, and partial-job retention paths. Object
garbage collection likewise treats pinned paths as live, including invalidated
artifacts. Unpinned artifacts remain subject to ordinary retention, including
zero-second retention when configured. Pins have no TTL; remove a release only
through an explicitly governed retention process, not by direct storage
deletion.

## Troubleshooting and audit checks

- A failed or cancelled build: open the retained terminal attempt and inspect
  its archived diagnostics, per-step log, and timings. A cancellation is not a
  failure and neither status can proceed to evaluation, approval, or release;
  fix the committed source/configuration or executor condition as appropriate,
  then create another attempt.
- A running build: use the persistent live console in **Current**. **Cancel
  build** calls the job cancellation endpoint and remains available after a
  reload when the attempt has a persisted job identity.
- A configuration publication refusal: confirm the tracked branch is current,
  the checkout has no tracked edits or unrelated local commits, and Prism's
  Git identity can push through the repository's branch policy. Publication
  uses the same repository write lock and remote credentials as Sync and uses
  a lease; it never overwrites a concurrent remote update or leaves a local-only
  commit after rejection.
- An `unsupported` policy result: capture the required evidence/projection or
  use a reasoned administrator override when the release must proceed.
- A missing vendor pack: confirm the selected profile's complete artifact set;
  for JLCPCB, Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and `cpl.xlsx`
  are all required.
- A signing refusal: verify the key ID/file/issuer configuration and that the
  API process can read the private-key secret.
- An audit concern: use the project audit verification endpoint and compare
  the signed release's attested audit head with the current chain. Database
  immutability triggers protect ordinary writes, but a database owner can alter
  privileged state; signed archives and offline verification provide the
  independent integrity evidence.

## Backup and restore

Back up PostgreSQL release records, audit data, configuration-owning Git
repositories, signing-key recovery material under its key-management policy,
and the artifact object store together. A restore is incomplete if database
metadata is restored without the dossiers/evidence it addresses, or if release
archives can no longer be verified against retained public keys. After restore,
run standard Prism restore checks, verify the audit chain, and offline-verify a
sample of retained release archives before reopening release operations.
