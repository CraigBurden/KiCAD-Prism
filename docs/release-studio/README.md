# Release Studio

Release Studio turns a committed KiCad revision into inspectable manufacturing
documents and a zip attached to a GitHub or GitLab Release.

## Start here

- [User guide](USER_GUIDE.md) — configure, build, inspect PDFs, publish.
- [Configuration](CONFIGURATION.md) — committed release YAML and document fields.
- [Artifacts](ARTIFACTS.md) — dossiers, vendor packs, and canonicalization.
- [Operations](OPERATIONS.md) — executor, tokens, retention, and diagnosis.
- [Architecture](ARCHITECTURE.md) — immutable build identity and publish sink.
- [Testing](TESTING.md) — automated checks and live KiCad coverage.

Signed policy evaluation, waivers, approvals, and offline attestation are
frozen on `feature/release-studio-governance`. They are not part of the running
product. See [GOVERNANCE.md](GOVERNANCE.md).

## Canonical flow

1. **Release Studio** — author the release configuration, manufacturing
   metadata, and variant. **Save & publish** validates it, publishes a
   configuration-only commit to the tracked branch, and selects that SHA.
2. **Start build** — materialize the commit, run the KiCad pipeline, and store
   documents, members, evidence, and a dossier.
3. **Outputs** — inspect composed PDFs, dossier members, logs, and vendor packs.
4. **Publish** — zip the dossier and create a GitHub or GitLab Release on the
   imported remote, using `GITHUB_TOKEN` or `GITLAB_TOKEN`.

Host-absolute library table URIs and missing `.pretty` entries are recorded as
warnings. They do not block the build or the forge publish.
