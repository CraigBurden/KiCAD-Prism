# Release Studio operations

## Executor and CI

Release execution is pinned to the KiCad executor image declared in
`backend/Dockerfile`. The built image writes the exact OCI reference used by
`FROM` to `/etc/prism/kicad-base-image`; runtime release work identifies that
same value through `PRISM_RELEASE_EXECUTOR_IMAGE`. The live contract requires
a lowercase SHA-256 image digest and KiCad `10.0.4`.

The live release suite runs `kicad-cli` with argument vectors, not shell
interpolation. The required quality gate on the core merge paths builds the
pinned AMD64 image and fails on zero tests, skips, failures, or errors.

## Forge tokens

Prism's workspace SSH key can clone; it cannot create a GitHub or GitLab
Release. Set workspace environment:

```text
GITHUB_TOKEN=<token with contents:write>
GITLAB_TOKEN=<token with api scope>
```

Use GitHub's token for `github.com` remotes and GitLab's token for GitLab
hosts. A clone-only token returns HTTP 403 with copy that asks for write
scope. Tokens are workspace-level, not per-user OAuth.

## Retention and garbage collection

Release pins are indefinite liveness markers for the artifacts referenced by
dossiers and evidence. Metadata pruning excludes pinned artifacts. Unpinned
artifacts remain subject to ordinary retention. Pins have no TTL.

## Troubleshooting

- A failed or cancelled build: open the retained attempt and inspect its
  archived diagnostics. Neither status can be published; start a new attempt.
- A running build: use the live console. **Cancel build** remains available
  after a reload when the attempt has a persisted job identity.
- A configuration publication refusal: confirm the tracked branch is current
  and Prism can push. Publication uses the same repository write lock as Sync.
- A missing vendor pack: confirm the selected profile's complete artifact set;
  for JLCPCB, Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and `cpl.xlsx`
  are all required.
- A publish refusal: confirm `GITHUB_TOKEN` / `GITLAB_TOKEN` has write scope,
  the remote is GitHub or GitLab, and the tag is unused.
- Host-absolute `fp-lib-table` URIs: these are warnings. They do not fail the
  build. Footprints already in the `.kicad_pcb` still export.

## Backup and restore

Back up PostgreSQL release records, configuration-owning Git repositories, and
the artifact object store together. A restore is incomplete if database
metadata is restored without the dossiers it addresses.
