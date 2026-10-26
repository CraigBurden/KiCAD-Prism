# W0 maintainer decisions

Decisions taken on the open questions raised while authoring Wave 0. The numbers refer to `ownership.md` §12.

## Ownership map (2026-10-16)

1. **R2 and Release Studio's Python tools.** *Superseded on 2026-10-17 by amendment C3 (see "Release Studio, amendment C3" below).* Option (a), for now. Python kicad_monkey and kicad-cruncher stay installed for Release Studio's tool uses only: `pcb-svg`, `bom` and `pnp`, and the stroke font and drawing-sheet rendering. R2's acceptance becomes "no revision parse imports kicad-monkey", and X allow-lists the four modules.
   - Follow-up: these features are easy to rebuild from Prism's own parser output plus `kicad-cli`. Porting them is a later ADR, after which both Python packages go.
2. **Catalog library-file imports** (`mates`, `module_connectors`, `module_interface`). Option (a): they stay until the library ADR, and X allow-lists them.
3. **S1** (Wave 2: a behaviour-free split of `api/projects.py` and `project_service.py`). Option (a): added.
4. **C8** (`PROJECT_METADATA`: project metadata, properties and the viewer-source routes). Option (a): added.
5. **Databases that ran the reference branch's migrations 56–59.** The live instance did. Its ledger was already renumbered during the cutover to dev on 2026-10-16 (`data/deploy/ledger-renumber-for-dev.sql` in the main checkout):
   - `sim_studio_setups` 56 → 9056, `sim_studio_runs` 57 → 9057, `sim_studio_layouts` 58 → 9058;
   - `job_retention_indexes` 59 → 57.

   C6's `RENUMBERED` entries must therefore move the sim_studio rows from 9056–9058, as well as from 56–58 on any database still in the reference branch's numbering, to their reserved numbers 106–108. Names are unique in the ledger, so C6 reuses these names to adopt the existing tables. It does not create them again.
6. **`prism-geometry` when `prism-bundle` moves.** Option (b): drop the five-line `geometry()` wrapper from Prism's reader, and prism-sim-studio calls `Geometry::open` itself. prism-sim-studio may be changed freely as part of this effort.
7. **Runtime JSON Schema validator.** Option (a): K adds `jsonschema` to `requirements/runtime.in`.
8. **CI for PRs stacked on `wp/*` branches.** Option (a): L adds `wp/**` to the quality gate's `pull_request` branches.
9. **R4's table drops.** Option (a): they ship in the release after R1's, per `schema_ledger.py:19-21`.
10. **C4.** Option (a): split into C4a (System Builder interface, parallel with the other Wave 3 WPs) and C4b (3D scene, after C5); System Builder was removed on 2026-10-23 (archive tag `archive/system-builder-v2`).
11. **GLB cache key.** Option (a): built from P4's model references in `project.json`; V1 runs after P4.

## Conventions (2026-10-16)

1. **One path type.** `RepoPath` (repository-relative) is the only path type in bundle documents. `ObjectRef` is `<RepoPath>#<uuid>`, and `ProjectPath` is removed.
   - No compatibility is kept with today's project-relative Design Comparison ids. Comparisons for projects in subdirectories, and for projects sharing a directory, are flaky today (issue #681), and are redesigned instead.
   - Files belong to a project only by explicit resolution through its anchor and effective configuration, never by directory.
   - A project absent at a revision is an explicit outcome, not a failure. See conventions.md §8.
2. **Envelope.** A single leading `schema` field in every new document, the manifest a2 included.
3. **Determinism across architectures.** Option (c): parse-stage JSON members are byte-identical on linux arm64, linux amd64 and macOS. `board.kmpack` is byte-identical only for the same binary on the same architecture.
4. **`.gitignore`.** The installer rule is anchored to `/generated/` (done), so committed JSON Schema is not hidden.
5. **Post-F1 locations.** Everything beside the contracts: `native/contracts/prism/` for the docs, `native/scripts/contracts/` for the scripts (conventions.md §1).
6. **Points.** Object form `{xNm, yNm}`.

## Revision key (2026-10-16)

1. **Source-set scope.** Repository-wide by kind for a1, accepting churn in multi-project repositories. Optimisations come later; `excluded_dirs` allows a narrowing policy without a new key version.
2. **Libraries.** `.kicad_sym`, `.kicad_mod`, `.lib` and `.dcm` are in the source set.
3. **`sources/`.** Holds the closure the build read, each member cross-referenced to its key entry, not the whole source set.
4. **Working tree.** Ignored files do not count (`git add -A` semantics).
5. **Anchor.** The project file is exactly the stored anchor. There are no directory fallbacks when keying (issue #681), and an anchor missing from the tree means "project absent at this revision".
6. **Jobsets in `sources/`.** Every `kicad-jobset` entry of the key is always a closure member, so Release Studio can run jobsets on bundle sources.
7. **Stricter resolution accepted.** A board or schematic whose stem differs from the anchor's needs an explicit path setting. K's first-deploy backfill flags affected projects instead of guessing.

## CLI (2026-10-16)

1. **Zone fills.** Default: refill with pcbnew; on persistent failure the board stage stays pending (no silent fallback). Per-project option `zone_fills: saved` in the effective configuration (part of the revision key) builds the board stage from the saved fills, recorded as saved-fill provenance with a warning.
2. **ADR amendments from the CLI spec** (folded into the ADR):
   - the three-stage `bundle build` synopsis, with `--in` chaining;
   - GLB timestamp canonicalization;
   - the store path `<revision_key>/<generator_digest>.prism`;
   - the procedures and the pack format version in the generator id;
   - recording content failures in `bundle.json`.

## Bundle manifest and format (2026-10-16)

1. **design.json schema.** None in W0; owed later. WP-C6 (or B, if the cross-check needs it first) adds a TypeSpec and JSON Schema for `kicad_monkey.design.a0` (ADR G16).
2. **Transitional viewer assets.** Not in the bundle. The old 3D store serves the mesh 3D tab until C5; `--viewer-dir` and the `viewer-asset` role are removed. `viewer/models/components.glb` stays.
3. **Sources that cannot be materialized.** Option (a) for design sources: no bundle, and the job retries. A 3D model that cannot be materialized does not block the bundle: it is recorded as the stage-parse warning `model-unavailable`, and the GLB is built without it. Prism's sync initializes submodules recursively and fetches LFS objects (K), and the worker image gets `git-lfs` (L), which it lacks today. Motivating case: Openswitch's 3D models live in the `kicad-libraries` submodule, which is uninitialized on the live instance.

## Placements (2026-10-16)

1. **System interface geometry.** P5 computes it from the parsed core with today's float pipeline, for v1 parity. Placements is KiCad-faithful and serves as a cross-check.
2. **Footprint-local frame.** `conventions.md` §7 now says what the file holds: before rotation, with back-side children already mirrored.
3. **Testpoints.** No stored field. Release Studio derives them from `reference` with its own `TP` rule.
4. **`outlineBounds`.** Board-level Edge.Cuts only, absent when there are none. P5 keeps its items fallback.
5. **Rotation.** Pad anchors are computed exactly as KiCad 10.0.7 places them: integer-nm `RotatePoint`, exact at multiples of 90°, `EDA_ANGLE`'s ±√½ at multiples of 45°, otherwise the pure-Rust `libm` crate. They are bit-identical to KiCad and across architectures. Every other transcendental function in parse-stage producers also goes through the pure-Rust `libm` crate (`conventions.md` §14).

## Stackup (2026-10-16)

1. **Dielectric sub-layers.** One entry per sub-layer, and every consumer's tables and thickness totals count them, as KiCad and the fork's materializer do (divergence D1 accepted).
2. **Unknown KiCad tokens.** The field is omitted, with the stage-parse warning `stackup-unknown-token`. A new token becomes a planned a1 bump.
3. **Stale stackup.** The stackup drives the copper layers and via spans (Release Studio parity), with the warning `stackup-copper-mismatch`.

## Route metrics (2026-10-16)

1. **Route-length display rounding.** Divergence D3 accepted: the 4th decimal may differ from today on a half-tie, by 0.1 µm.
2. **Used layers.** Option (b): a via adds every copper layer it spans, in the board's copper order (`copperLayers`' rule), so a through via adds every copper layer. Divergence D7.
3. **Arc-length formula.** Mirrors today's operation for operation, for exact parity. `hypot` and `atan2` go through the pure-Rust `libm` crate.

## Occurrences (2026-10-16)

1. **One file format.** The parser and every contract handle only the current KiCad format of the worker image. Older `.kicad_pcb` and `.kicad_sch` sources are upgraded by KiCad before stage parse, under the `kicad-seeded-upgrade-a0` procedure pinned in the generator id:
   - boards: pcbnew with a fixed `KIID.SeedGenerator` seed, which is byte-deterministic;
   - schematics: `kicad-cli sch upgrade`.

   Members hold the upgraded bytes, with `upgraded_from_version`. The KiCad 7 fallbacks (`tstamp`, `fp_text reference`) are removed from all contracts, so footprint identity is the same in occurrences and the semantic index.
2. **Raw variant records** stay in occurrences. P2 adds footprint and sheet variant parsing to the core.
3. **Only symbols reached through the hierarchy** count, as in KiCad. Stale instance records and orphan sheets are dropped.
4. **Multi-unit BOM rows** use the index's representative unit (KiCad's netlist rule).
5. **BOM columns** stay a closed set of 15. A new column bumps the version.

## Board objects (2026-10-16)

All seven recommendations are accepted:
1. `contentDigest` is a canonical s-expression text with per-kind allow-lists.
2. Review-field values stay in today's display form.
3. Kinds are kebab-case, mapped uniformly to today's snake_case.
4. Today's BLAKE2b review-only ids are reproduced, so comment anchors stay stable.
5. KiCad 7+ board groups are listed.
6. The parser test suite's hand-written ids are rewritten as canonical uuids.
7. Objects today's parser never indexes wait for a1.

The documents are the project's closure (`sources/`), never the repository-wide source set.

## Project (2026-10-16)

1. **Library tables.** Only the project's own `fp-lib-table` and `sym-lib-table`, the ones KiCad uses beside the `.kicad_pro`. Release Studio no longer scans every table in the repository (divergence D2).
2. **Legacy model variables.** `${KICAD9_3DMODEL_DIR}` and older follow KiCad's fallback to the worker's version in C3. The member records the variable as written.
3. **`text-path` references** stay in a0. Hermeticity policy for them is C3's.
4. **Title blocks.** The producer expands them (`expandedTitleBlock`).

## Semantic index (2026-10-16)

1. The envelope keeps `schema` and `sourceRevisionKey` only. `generatedAt`, `generator` and `commit` are dropped.
2. `sourceRevisionKey` is the 64-hex design revision key. C1 treats stored 32-hex comment-anchor keys as legacy and falls back to the anchor's commit.
3. `components[].fields` keys are in code-point order. The inspector orders its rows itself.
4. `assembly.diagnostics[].detail` keeps today's shape in a1, as a documented exception, and is redesigned in a2 with the variants API.
5. Release Studio approvals carry over once across the migration. The semantic digests are recomputed on the a1 member.
6. Design Comparison's schematic view is derived from the full index. The `mini_obc/F8` split-net case is a recorded divergence.
7. `pinName` and `pinType` are absent, not `""`, on terminals built only from graphical pin lists.
8. KiCad 7 footprint identity is resolved by the source upgrade (see Occurrences 1).

## System interface (2026-10-16)

1. The member omits `projectId`, `commit` and `extractor`. The digest is unaffected.
2. It stays v1: the Rust producer emits nothing v1 lacks.
3. P5 ports kicad_monkey's `get_bounds()` outline fallback exactly, so digests match. Accepting a divergence is the fallback if the port proves disproportionate, and must be decided before G freezes goldens.
4. A project with no schematic gets an empty interface (zero components), not a failed job.
5. Parity documents are exempt from the naming, enum-spelling, side, frame and empty-string conventions where today's output differs (`conventions.md` §5, `Degrees` doc).
6. KiCad 7 boards are resolved by the source upgrade: references come from properties, and digests change only on old boards.

## Ownership map, folded (2026-10-16)

- ADR §9 now carries the ownership decisions:
  - the waves and merge order, with S1 and C8;
  - the ownership rules (`AGENTS.md`, owner succession, stubs, build outputs, migration blocks);
  - the `prism-projections` `lib.rs` owner (F2);
  - R2's acceptance with the allow-listed tool uses.
- C6's `RENUMBERED` entries also move the live instance's parked 9056–9058 rows to 106–108.

## Backend bundle service, WP-K gaps (2026-10-16)

1. **Upgrade record.** Stage parse takes one `--upgraded <path>=<version>` per source K upgraded, and the manifest records `upgraded_from_version` on that member (cli-spec.md §5.2.2, §9.4). The key record is unchanged: the revision key covers the committed blobs, and an upgrade must not change it.
2. **File formats in the generator id.** `CliVersionA0` gains `kicad_file_formats` (`board`, `schematic`), the `(version N)` of `kicad_version`, raised with it. Sources older than these are the ones upgraded. The bundle-key vectors of cli-spec.md §5.1.5 are recomputed: generator digest `d32ccf9d…`.
3. **Dedup scope.** The bundle key identifies content, not a project. K dedups `design_bundle` jobs on `<project_id>:<bundle_key>`, matching the per-project store (cli-spec.md §5.1.4).

## KiCad patch releases (2026-10-16)

1. `--refill-tool` and `--models-tool` must match the generator id's `kicad_version` in major.minor only, so the worker's KiCad 10.0.7 serves a generator pinned at 10.0.6. Patch releases keep the file formats, and their output differences are tolerated. The manifest does not record the patch release that made a refill or GLB, and the bundle key does not cover it.

## Compare, amendment C2 (2026-10-17)

Design Comparison's object diff becomes `prism-kicad compare` (cli-spec.md §5.6; rationale and parity traps in `docs/architecture/adr-native-design-bundle-amendment-c2.md`). The maintainer took the recommended option on each question:

1. **D1, keys.** Object keys and `documentPath` stay relative to the project file's directory, as today, so focus targets, stored comparisons and deep links keep their keys. `compare` strips the anchor's directory from each member `RepoPath`.
2. **D2, order.** `changes` and each property-delta list are sorted in code point order instead of today's `localeCompare`, whose order depends on the host's locale. Recorded as divergence `compare-1`; only the order of the review list changes.
3. **D3, objects.** `compare` also emits `nativeObjects` and `componentObjects`, so the mm/nm and kind rebuild rules of `field-maps/board-objects.md` exist only in Rust. `routeMetrics` is not emitted: C2 reads `projections/route-metrics.json`.
4. **D4, generators.** Bundles written by different generator ids are refused (exit 7, `generator-mismatch`); the backend rebuilds the stale one.

## Design Comparison in Rust, amendment C2r (2026-10-17)

Design Comparison is computed by `prism-kicad compare` instead of a port of Node's diff plus Python assembly (rationale and benchmark in `docs/architecture/adr-native-design-bundle-amendment-c2r.md`). Decided by the maintainer:

1. **Every tab in Rust.** `compare` emits the Schematic and PCB changes, connectivity, BOM, stackup and route metrics as `DesignCompareResultA1` (a0 until step 6), plus ecad-viewer's `KiCadProjectDiffBundle` in today's format. Fabrication stays `kicad-cli` in Python. Supersedes C2's D3 and D4's object-delta output; C2's D1 and D2 stand.
2. **ecad-viewer's input is fixed.** Property value types follow the KiCad property, not the JSON text.
3. **Bundles or source trees.** A commit with no bundle yet is compared from its source tree with only Design Comparison's producers, in memory; the full bundle is built alongside.
4. **Store-time validation.** K validates member schemas once per stored archive with `bundle verify`; reads check structure, identity and digests only (bundle-format.md §9).
5. **Q1, stored comparisons.** The frontend reads both `prism.semantic_comparison_v3` and the new result until R1; stored v3 results are not converted. *Revised 2026-10-18 (step 6):* the tabs read only the new result, and a v3 result, which the legacy path still writes until the gate, is read into that shape on load (`legacy-v3-result.ts`, deleted with the legacy path). The maintainer has no stored comparisons to keep.
6. **Q2, review logic.** Labels, classification, net pairing and the net-rename derivation move from Python into `compare`; review grouping and presentation policy stay in the frontend.
7. **Q3, bundles on push.** Not part of C2; source-tree mode removes the cold-path cost.
8. **Gate.** C2 switches on only after C2r §5's acceptance and the cold EDA-04903 benchmark pass, and the maintainer agrees.
9. **Targets (step 6, 2026-10-18).** The result is `prism.design_compare.result.a1`: a0 plus `details.targets`, today's visual targets slimmed to what the review list reads (kind, role, document, position, sheet path, reference). Without them the review list's presentation and search change (field map, "Targets"). a0 is removed.
10. **The switch (2026-10-18).** Design Comparison defaults to `bundle`. Review parity, the ecad-viewer counters and mode equality passed. The cold EDA-04903 benchmark did not: 50.9 s to the first result against 28.1 s, and 2.7 GB against 1.7 GB. The maintainer accepted it because K2's warm bundles make prebuilt comparisons take about 3 s, and made `PRISM_DESIGN_BUNDLE_AUTO_BUILD` default to on so they exist. No legacy fallback (F1). `prism.compare.object_delta.a0` is removed, and `compare`'s stdout is `prism.cli.compare_result.a1` with per-tab counts. Amendment C2r §10.

## Release Studio, amendment C3 (2026-10-17)

The maintainer decided (`docs/architecture/adr-native-design-bundle-amendment-c3.md`):

1. **No Cruncher.** `kicad-cruncher` and Release Studio's Python `kicad_monkey` uses are dropped and re-implemented in Rust. This supersedes Ownership map item 1; item 2 (the catalog's library-file imports) stands.
2. **Assembly artwork** is a Rust port of Cruncher's `pcb-svg` (`prism-kicad artwork`), keeping the STEP-model hidden-line outlines through the pinned `geometer-client`, vendored into `native/third_party/`, with the Geometer runtime in the image.
3. **HLR** results are a bundle member of stage `models` (`models/assembly-hlr.json`), cached by model bytes, pose and options.
4. **Vendor files** come from `prism-kicad vendor`, a registry of vendor modules over one BOM/placement core, JLCPCB first; Release Studio's vendor selection reads the registry.
5. **Sheet text and frame** come from `prism-kicad stroke-text` and `drawing-sheet` over the core's NewStroke and default worksheet.
6. **Fills:** board kicad-cli steps read `refilled/`, schematic steps `sources/`.
7. **Scope fingerprint:** hashes an a0-compatible view of the semantic index (closes field-map semantic-index D8).
8. **No testpoint-only board and no viewport workaround:** `artwork` selects footprints and applies the canvas itself.
9. **`placements` a1** adds the board's aux axis origin, which the vendor placement files need.

## What the user sees, amendment U (2026-10-17)

Rationale in `docs/architecture/adr-native-design-bundle-amendment-u.md`. Decided by the maintainer:

1. **Parity is what the user sees.** Byte stability stays only where a machine reads the output (ecad-viewer's input, member determinism, `compare`'s two modes, prism-sim-studio's formats, vendor files). Every other difference must be invisible or a reviewed improvement, listed in `native/parity/divergences/<consumer>.md`. Legacy quirks are not reproduced. References that already match byte for byte stay.
2. **Budgets per journey** (U §3.2). Performance work stops when a journey's budgets are met.
3. **Warm by default** (U §3.3). Background stage-`parse` builds after each sync, and reuse of a stored bundle by its read set through an alias table. `prism.revision_key.a1` is unchanged. This supersedes C2r's Q3 ("bundles on push: not part of C2"). New WP-K2.
4. **Every consumer migrates.** The wave plan is unchanged.
5. **Typed values inside Rust.** Producers return typed values; `compare` reads them directly in source-tree mode. Members stay JSON, byte for byte.

## Warm bundles, amendment K2 (2026-10-17)

Rationale in `docs/architecture/adr-native-design-bundle-amendment-k2.md`. Decided by the maintainer, each as recommended:

1. **Q1: one archive per read set.** Stages board and models run on the archive's own `sources/`. Every revision key whose read set holds shares that archive, all stages included, through the alias table. `bundle rekey` (amendment U) is dropped; `prism-kicad bundle reuse` checks a read set against a key record.
2. **Q2: a design key, not a revision key, in members.** `prism.semantic_index.a2` replaces `sourceRevisionKey` with `designKey`, computed from the configuration digest and the read set. Consumers take the revision they asked for from the request; `compare` takes both revision keys as arguments in both modes.
3. **Q3: the jobset rule stays repository-wide.** Narrowing it belongs to C3.
4. **K2b prebuild (2026-10-18).** The prebuild keeps each branch's newest 10 commits and every tagged commit warm, not 20 per branch, and a designer can force a project's design data to be rebuilt, one commit or all of it. Amendment K2 §7.

## One analytic 3D path, amendment V2 (2026-10-18)

Rationale in `docs/architecture/adr-native-design-bundle-amendment-v2.md`. Decided by the maintainer:

System Builder was removed on 2026-10-23 (archive tag `archive/system-builder-v2`); its V2b decisions are no longer in force.

1. **One 3D path.** The WebGPU viewer renders the bundle's `materialization/board.kmpack` for boards and `viewer/models/components.glb` for parts. Every older 3D path is deleted by the package that moves its last reader (V2 §2.3), not kept behind a flag.
2. **No waits from warm bundles.** K2's prebuild is what makes 3D instant; no second store for 3D.
3. **Simulation overlays** are optimised in C6 (V2 §4).
4. **Order:** V2a (C5) → V2c (C6), one at a time.
5. **Q1, the cold 3D path:** the build enters the ordinary `design_bundle` queue; no priority and no prebuild action. The view shows where it waits and draws the board when stage `board` publishes.
6. **Q4, 3D budgets:** V2a measures the journeys first; the maintainer sets the budgets before V2a merges. Set on 2026-10-18: V2 §7's proposed budgets, accepted as proposed and copied into amendment U §3.2. The same day the maintainer chose to show the board whole (held back until every layer and the parts are drawn); the first-frame row became "board shown whole ≤ 1.5 s". On 2026-10-19 they added the inspection budget (GPU time per frame orbiting at 2× pixels, p95 ≤ 16.7 ms in every view) under one rule: the user never feels an optimisation (no stutter, nothing popping in while inspecting). A separated stack draws its vias off the lit nets as low translucent ghosts and its laminate without drill holes; copper shows KiCad's layer colours whenever the stack is separated or the substrate hidden, the surface finish only on the assembled board; 4× MSAA stays.

## KiCad 10 multi-root projects (2026-10-25)

1. **Top-level sheets come from the project file.** Stage parse and the core open every sheet a project lists in `schematic.top_level_sheets` that is in the source set, as KiCad 10 does (`cli-spec.md` §5.2.2). The effective configuration keeps one `root_schematic`: it gates whether there is a schematic and stays a member (bundle-format.md I4), and the revision key is unchanged because it already hashes the project file and every schematic. A listed sheet that is absent is the warning `top-level-sheet-missing`.
2. **Checked against KiCad 10.0.6 through a wrapper.** kicad-cli loads one schematic, so the two-root fixture (`prism-kicad-cli/tests/fixtures/multi-root`) is checked against kicad-cli's netlist of a root holding the listed sheets as sub-sheets, named and identified as the project lists them: the same occurrence paths and net names.
