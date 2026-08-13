# Release Studio

Release Studio turns a KiCad revision into inspectable manufacturing documents
and a zip attached to a GitHub or GitLab Release.

The GitHub or GitLab tag is the drawing revision. It is named before the build
so PDFs bake it in.

## Start here

- [User guide](USER_GUIDE.md) — Source through Publish.
- [Release inputs](CONFIGURATION.md) — per-release identity, manufacturing, and
  discovered KiCad paths.
- [Artifacts](ARTIFACTS.md) — dossiers, vendor packs, and canonicalization.
- [Operations](OPERATIONS.md) — executor, tokens, live logs, and diagnosis.
- [Architecture](ARCHITECTURE.md) — immutable build identity and publish sink.
- [Testing](TESTING.md) — automated checks and live KiCad coverage.

Signed policy evaluation, waivers, approvals, and offline attestation are
frozen on `feature/release-studio-governance`. They are not part of the running
product. See [GOVERNANCE.md](GOVERNANCE.md).

## Canonical flow

1. **Source** — pick the Git revision, board, schematic, variant, and
   KiCad BOM preset. Prism discovers candidates from the imported project at
   the selected commit. No Prism YAML and no Save & publish.
2. **Identity** — enter tag, Document Name, date, and release notes. The tag
   becomes the drawing revision and the forge Release name. If the tag already
   exists on the remote, Identity blocks here.
3. **Manufacturing** — per-release build inputs: IPC classes, board finish
   colours, via treatment, manufacturer packs, optional stackup PDF, optional
   impedance CSV.
4. **Build** — starts only after Identity and Manufacturing are complete.
   Materialize the commit, run the KiCad pipeline, and store documents,
   members, evidence, and a dossier. Live job stdout streams to the Build
   stage while the worker runs.
5. **Outputs** — inspect composed PDFs and dossier members.
6. **Publish** — confirm only; no edits. Prism zips the dossier and creates a
   GitHub or GitLab Release on the imported remote, using `GITHUB_TOKEN` or
   `GITLAB_TOKEN`. The Release name is the tag.

Host-absolute library table URIs and missing `.pretty` entries are recorded as
warnings. They do not block the build or the forge publish.
