# Design bundle

The only Python package that knows the design-bundle format. The design is
`docs/architecture/adr-native-design-bundle.md`; the frozen contracts are
`native/contracts/prism/bundle-format.md`, `native/contracts/prism/cli-spec.md`
and `native/contracts/prism/revision-key.md`, with JSON Schema in
`native/contracts/generated/schema/`. Never edit those here: a contract change
is an ADR amendment.

| Module | Role |
| --- | --- |
| `revision_key.py` | The design revision key `prism.revision_key.a1`: selection, canonical config, preimage, commit and working-tree listings, the key record. Prism's Python reference; `backend/tests/test_design_bundle_revision_key.py` holds it to every W0 vector. |
| `effective_config.py` | The effective configuration Prism resolves (revision-key.md §4.4): anchor exactly, stored settings over the committed Prism settings file, globs to the anchor's stem only, `zone_fills` from the stored setting. Keys a commit or a working tree. |
| `generator.py` | The generator id's canonical bytes, digest and the bundle key (cli-spec.md §5.1). |
| `schemas.py` | Validators for the committed JSON Schema, every schema registered by `$id`. |
| `archive.py` | The `.prism` reader: bundle-format.md §9, strict zip, bounded inflation, member digests and schemas. |
| `manifest.py` | Member readiness (§3.3) and the manifest invariants (§3.4). |
| `store.py` | `.kicad-prism/bundles/<project>/<revision key>/<generator>.prism`, its `.prism.verified` marker (step 7 ran once), the unpacked cache, deletion. |
| `rows.py` | The commit index and bundle tables (workspace migrations 100-102). |
| `cli.py` | Runs `prism-kicad`: exit codes, stdout validation, timeouts, cancel, peak memory. |
| `materialize.py`, `kicad_steps.py`, `stage_models.py` | What the job does around the CLI: sources (LFS, gitlinks), the seeded upgrade, the zone refill, the component GLB. `stage_models.py` passes to WP-V1 in Wave 2. |
| `jobs.py` | The `design_bundle` job kind and how it is queued. |
| `reuse.py` | Warm bundles (ADR amendment K2): which archive serves a revision key (its own, else an alias row), `prism-kicad bundle reuse` against a few candidates before a build, and the commits the prebuild keeps warm (branch windows and tags). |
| `backfill.py`, `retention.py` | The worker's paced prebuild (alias or queue, one build at a time) and bundle retention, which keeps the prebuild set and every aliased archive. |
| `regenerate.py` | A designer's forced rebuild of one commit's or a whole project's design data, skipping reuse. |
| `repo_hydration.py` | Submodules and LFS objects for import and sync. |
| `reader.py` | How a consumer opens a revision's bundle and reads members. |
| `consumer.py` | `bundle_read`: a Wave 3 consumer's switch and the rollout fallback (not ready or failed → legacy for this request, job queued). Every consumer goes through it. |

## Rules

- **No KiCad parsing here or anywhere else in Python.** Keying reads Git
  listings and names only; the upgrade step reads a file's `(version …)` and
  sheet names to know what to hand to KiCad. The parse is `prism-kicad`'s.
- **Decide from the exit code and stdout, never stderr** (cli-spec.md §3).
  Validate every stdout document before using it.
- **Attribute files by anchor, never by directory** (issue #681). Do not add a
  fallback that picks "the board in the directory"; the backfill flags
  instead.
- **A stage only moves from `pending` to final** for a stored bundle. The job
  resumes from the archive; it never re-runs a stage.
- **Tests run against the stub**, `backend/tests/support/prism_kicad_stub.py`,
  installed by `backend/tests/support/design_bundle_fixtures.py`. Do not rely
  on its archive bytes or messages.
