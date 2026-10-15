# ADR: Prism-native KiCad parser and the design bundle

- **Status:** Accepted (2026-10-16)
- **Deciders:** Prism maintainers
- **Supersedes:** the per-feature KiCad loading described in `docs/plans/kicad-monkey-*.md`
- **Reference branch:** `feature/analytic-pack-spike` (analytic 3D tab, Simulation Studio, `board.prism` a1). It is reference only: code may be copied from it, it is never merged.
- **Integration branch:** `feature/native-design-bundle`, cut from `dev`. Every work package lands there as a stacked pull request (§9).

## 1. Context

Prism interprets the same KiCad project revision many times, with different code, under different keys:

| Consumer | How it reads a revision today | Key |
|---|---|---|
| 3D tab (mesh) | Python `topology_compiler`: `KiCadDesign`, `KiCadPcb` twice, two raw `parse_sexp` passes for stackup, `prism-kicad-native` (Rust, upstream kicad_monkey `bc6796c1`), `kicad-cli pcb export glb` twice | content `source_fingerprint` + build fingerprint |
| 3D tab (analytic, reference branch) | the above plus `prism-bundle` (Rust, fork `b6316117`): design JSON + materializer | same |
| Semantic index | Python `KiCadDesign` + netlist + full `KiCadPcb` (42 s, 2.6 GB on a 57 MB board), three more raw-text scans of the schematics | git blob ids |
| Design Comparison | the index again (schematic only), Node `ecad-diff` (second parser), regex stackup, `kicad-cli` Gerbers; the browser parses a fourth time | commit sha |
| Release Studio | `KiCadPcb` up to three times, `parse_sexp` for closure, the index again, many `kicad-cli` steps | closure digest (commit sha inside) |
| System Builder interface | its own `KiCadDesign` + netlist + board | commit sha + extractor version |
| System Builder 3D scene | the 3D tab's bundle (scene manifest, `components.glb`, mid-plane from stackup layers, `bundleToBoard`) | 3D bundle fingerprint |
| Simulation Studio (reference branch) | `board.prism` from `prism-bundle`; board facts from the semantic index | content fingerprint |
| Catalog / project component import | own s-expression scanners, the index, `pcbnew` for footprint flips | per import |
| Project metadata, variants API | `KiCadProject`, a header regex, `variant_source_scan` per request | per import / per request |

Consequences measured on a live instance:
- A large board's revision is loaded up to six times.
- The Python board model alone peaks at about 3 GB.
- Three different revision keys mean nothing can reuse another feature's work.
- The Python kicad_monkey 2026.9.7 and the Rust core `bc6796c1`/`b6316117` are different engine revisions interpreting the same files.

## 2. Decision

1. **Prism owns a native KiCad parser.** The Rust part of `krishna-swaroop/kicad_monkey` (the fork Prism already pins, `b6316117`) is imported into this repository with its history. That covers all of its crates and the structure they are built, tested and released with. It is maintained here, with no further dependency on upstream releases.
2. **Fork, don't rewrite. Import verbatim first.** The import commit is a pure copy, so it can be diffed against the fork. Renaming, Prism CI wiring and new crates follow in separate commits. The connectivity, net-naming, hierarchy, variant and format semantics are kept as they are. The MIT notice (Copyright (c) 2026 Wavenumber LLC) is preserved.
3. **Nothing is trimmed.** Crates and modules the first milestone does not use stay. Each has a foreseeable Prism use (§4.2), and re-porting later from a diverged fork is the expensive direction. Build size is controlled with Cargo features instead.
4. **One design bundle per revision.** A single Rust CLI, `prism-kicad`, parses a revision once and writes `board.prism`. The bundle holds the sources, the materialization, `design.json` and every projection Prism needs.
5. **Every consumer reads bundle members.** No Prism feature opens a `.kicad_sch`, `.kicad_pcb` or `.kicad_pro` itself. The only exceptions are listed in §2.1.
6. **CLI and files, not in-process bindings.** Python reads JSON and pack members. The same CLI later backs an MCP server.
7. **One revision key.** Every per-revision artifact is keyed by the design revision key (§5).
8. **Prism owns the bundle crates.** prism-sim-studio depends on Prism's bundle reader, not the reverse. `prism-bundle` moves out of prism-sim-studio.
9. **Python kicad_monkey is removed** once every consumer has migrated.

### 2.1 What stays outside the parser

- **Real KiCad outputs**, which are deliverables or KiCad's own verdicts:
  - Gerbers and drill files;
  - DRC and ERC;
  - position files, BOM CSV, PDF/SVG plots and renders, thumbnails;
  - board stats;
  - STEP and GLB model exports;
  - the zone refill (`pcbnew` ZONE_FILLER) and the footprint flip (`pcbnew`).

  They run KiCad on sources taken from the bundle, keyed by the bundle key plus the KiCad version. Gerbers and drill files stay outside the bundle (decided, §10).
- **The browser viewers.** The Schematic and PCB tabs and the Design Comparison overlay keep parsing raw files in ecad-viewer, served from the bundle's `sources/`. The imported `wasm` crate makes a later move to one parser in the browser possible (separate ADR).
- **Library files** (`.kicad_sym`, `.kicad_mod` in the catalog). These are not project revisions. They stay with `kicad_library_reader` until a later ADR; the imported `symbol_library` module is the starting point.
- **kicad-cruncher as a tool.** Release Studio keeps calling it for assembly SVGs and JLCPCB BOM/PnP. Its Rust CLI is imported with the rest, so Prism owns the source from now on (decided, §10).

## 3. Consequences

- One parse per revision, in a worker, never in the API process.
- Peak memory and time are bounded by Rust, not Python object graphs.
- Prism carries the fork's Rust: about 190k lines across 8 crates, including tests and generated contracts. Prism also owns KiCad format changes from KiCad 11 onwards.
- Every projection needs a schema, a Rust producer, a Python reader and a parity test against today's output.
- Migration is per consumer, behind a flag, so dev stays shippable throughout.
- The worker image and CI gain a Rust build of the workspace. It is cached (§11, G10).

## 4. Architecture

### 4.1 Repository layout

The fork's layout is kept under `native/`, so the import is a plain prefix and later comparisons with the fork stay readable:

```text
native/                                    the fork's root, imported with history (WP-F1)
  Cargo.toml, Cargo.lock, rust-toolchain.toml (1.98.0), clippy.toml,
  rust-hygiene.toml, rust-hygiene-baseline.json
  src/rs/
    kicad-monkey-core/                     parser, model, plot IR, design JSON, materializer
    kicad-monkey-contracts/                generated + hand-written contracts and validators
    kicad-monkey-materialization-pack/     board.kmpack
    kicad-monkey-svg/                      SVG serializer for the plot IR
    kicad-monkey-wasm/                     browser adapters (incl. materialization lowering)
    kicad-monkey-native/                   one-request-per-process transport
    kicad-monkey-codegen/                  JSON Schema -> Rust contracts
    prism-projections/                     NEW: Prism projections over the core model (§6)
    prism-bundle/                          MOVED from prism-sim-studio: manifest a2, build, read, verify
    prism-kicad-cli/                       NEW: binary `prism-kicad`
  packages/kicad_cruncher/src/rs/kicad-cruncher-cli/
  src/tsp/, tspconfig.yaml, package.json   TypeSpec contract sources and toolchain
  src/tsp/prism/                           NEW: TypeSpec for the bundle manifest and every projection
  contracts/generated/schema/              JSON Schema compiled from TypeSpec (committed)
  tests/parity/ and the Rust-referenced fixtures (licence-cleared, §4.2)
  scripts/ (the Rust, contract and release scripts)
  parity/                                  NEW: Prism parity runner, golden-diff rules, divergences.md
  LICENSE (MIT, Wavenumber LLC), NOTICE    kept as imported; the root NOTICE points to it
kicad-prism-viewer/native/                 prism-kicad-native and prism-clipper2 join the workspace in WP-R3
backend/app/services/design_bundle/        the only Python package that knows the bundle format
```

- **Crate names:** they keep their `kicad-monkey-*` names in the import commit. WP-F2 renames them to `prism-kicad-*` (core, contracts, pack, svg, wasm, native, codegen) in one mechanical commit.
- **Reader feature:** `prism-bundle` has a `reader` feature with no dependency on the parser. prism-sim-studio pins Prism at a commit and depends on `prism-bundle` (reader) and the pack crate.

### 4.2 Import scope

The import takes everything Rust in the fork at `b6316117`. That is upstream `bc6796c1` plus 30 commits adding the analytic materializer:

| Part | Size | First use | Foreseeable use |
|---|---|---|---|
| core | 85k src + 33k tests | parsing, design JSON, materializer; Prism projections | — |
| contracts (generated + validators) | 41k + 4k tests | materialization, source bundle, compiled schematic graph | new bundle and projection schemas through the same TypeSpec → JSON Schema → codegen pipeline |
| materialization pack | 2.2k | `board.kmpack` | — |
| svg | 10k | — | catalog previews, Release Studio artwork and thumbnails without `kicad-cli` |
| wasm | 5k | — | one parser in the browser (Schematic/PCB tabs, comparison overlay, analytic lowering client-side) |
| native | 2.3k | — | superseded by `prism-kicad`; kept so the workspace builds and tests as imported |
| codegen | 1.8k | regenerating contracts when a schema changes | — |
| kicad-cruncher-cli | — | still invoked as a tool by Release Studio | assembly views, BOM/PnP owned in Rust |
| core modules unused at first: plot contracts, `pcb_authoring`, `symbol_library`, `sexpr_mutation`, `schematic_embedded` | ~11k | — | writing KiCad files (Release Studio staged boards, catalog placement rewrites, maybe the footprint flip), catalog libraries, KiCad 9/10 embedded files |

- **Build size:** the worker's `prism-kicad` binary enables only the features it needs. The other crates build and test in CI.
- **Not imported:**
  - the Python provider (`kicad_monkey` Python, `hatch_build.py`, `pyproject.toml`, `uv.lock`) and the Python test suite (`tests/L0..L99`). Prism keeps the PyPI 2026.9.7 package until WP-R2.
  - `node_modules/` and `target/`.
- **Licence gates** (WP-F0, before the import lands):
  - `src/rs/kicad-monkey-core/src/fake_style.rs` states it is an exact port of FreeType's fake-bold/italic pass. Establish its provenance and either keep it with the right notice or replace it.
  - GPL-2.0 KiCad QA netlist fixtures and third-party library and real-world project files under the fork's tests are excluded from the import *and from its history* (§4.3).
  - The CC0 newstroke tables and fonts (`assets/fonts`, 22 MB) are imported with their notice.
- **Infrastructure the fork depends on that Prism cannot** (WP-F3):
  - The Rust hygiene ratchet runs through Wavenumber's `wn-dev-std`/Rack. Prism runs the same `rust-hygiene.toml` limits with its own checker, or `clippy` lints plus the existing module-size gate.
  - The large test corpus is a 266 MB archive on `artifacts.wavenumber.net`. Replaced by Prism's parity corpus (§7).
  - The `kicad-cli` oracle builds are Windows recorder builds from Wavenumber's cache. Replaced by the `kicad-cli` in Prism's worker image.
  - Releases publish Python wheels to PyPI. Re-targeted to `prism-kicad` binaries (linux arm64/amd64, macOS for development) and the wasm package as GitHub release artifacts, and into the worker image.
  - `wn-geometer` and the Geometer C SDK stay pinned external dependencies (§10).

### 4.3 Import mechanics (WP-F1)

1. Clone the fork at `b6316117` and run `git filter-repo` with an allow-list of the paths in §4.1. Strip the excluded fixtures from *all* history, so no GPL file ever enters Prism's history.
2. In the integration branch: `git subtree add --prefix=native <filtered-repo> <branch>`. This is one merge commit that brings the filtered history and is otherwise a pure copy.
3. Verify the import:
   - `cargo test --workspace` passes at `native/` as imported, on Rust 1.98.0;
   - `prism-bundle` from prism-sim-studio, pointed at `native/` by a path dependency, produces byte-identical `design.json` and `board.kmpack` to the `b6316117` git dependency on the fixtures and the corpus.
4. Later fixes from upstream can still be compared or cherry-picked, because the history is shared. Prism does not track upstream.

### 4.4 Data flow and staged readiness

```text
import / sync / on-demand commit
        │  revision key (git ls-tree, no checkout)                    §5
        ▼
design_bundle job (prism-worker)                                      one per bundle key
  stage parse   1. materialize sources (git cat-file, LFS, gitlinks)
                2. prism-kicad bundle build --stage parse             ONE parse: design.json, projections/*
                   -> bundle readable; consumers that need only projections proceed
  stage board   3. zone refill            pcbnew ZONE_FILLER          KiCad
                4. prism-kicad bundle build --stage board             materialization/board.kmpack
  stage models  5. kicad-cli pcb export glb --no-board-body           viewer/models/components.glb
                   (cached by board + model blobs + KiCad version)
  store         6. <bundle key>.prism, unpack on first use
        ▼
consumers read members through backend/app/services/design_bundle,
declaring which members they need; they wait only for those
```

- **Staging:** `bundle.json` records each stage's status. Stage `parse` takes seconds on a large board. The Python index took 60 s, and Design Comparison and System Builder need nothing more than this stage. Stage `board` (refill + materialize) and stage `models` add 1–2 minutes and are needed only by the 3D tab, System Builder 3D and Simulation Studio.
- **Archive updates:** the bundle archive is rewritten atomically at the end of each stage.
- **Concurrency:** builds run under a `design_bundle` resource slot (memory-bounded) with dedup on the bundle key.

## 5. Revision key and storage

- **Design revision key** (`prism.revision_key.a1`): sha256 over
  - the literal `prism.revision_key.a1\0`;
  - the *effective* project configuration: the resolved project-file path and the path overrides (§11, G6). A settings change stored in Prism's database changes the key, just as a commit does.
  - every `(path, git blob id)` in the source set, sorted.

  The source set is: `.kicad_pro`, `.kicad_sch`, `.kicad_pcb`, `.kicad_dru`, `.kicad_wks`, `.kicad_jobset`, `fp-lib-table`, `sym-lib-table`, `.prism.json`, and every 3D model file under the repository that the board references.

  A commit's key comes from `git ls-tree` alone. A working tree's comes from git's blob hashing of the files on disk. The same content gives the same key either way. Gitlinks (submodules) contribute their commit id. LFS files contribute their pointer's blob id, which changes with the content.
- **Generator id:** `prism-kicad version` JSON. It holds:
  - the crate version, manifest version and projection schema versions;
  - the KiCad version used for the KiCad-produced members, which also pins KiCad's stock 3D model library.

  It is bumped explicitly, never derived from binary or source bytes.
- **Bundle key:** sha256(revision key, generator id).
- **Storage:**
  - `.kicad-prism/bundles/<project_id>/<revision_key>/<generator>.prism`;
  - an unpacked cache beside it, which can always be deleted;
  - the previous generators of a revision are removed when a new one is stored.
- **Commit index:** `(project, commit sha, effective-config digest) → revision key`, cached.
- **Retention:**
  - bundles of branch heads, pinned System Builder commits, released Release Studio candidates and kept Simulation Studio runs stay;
  - others go after `PRISM_DESIGN_BUNDLE_RETENTION_DAYS` unused (§11, G2).

## 6. Bundle members (`prism.bundle.manifest` a2)

Each member has a role, a schema id, sha256, size and the stage that wrote it in the manifest. Projections are written by `prism-projections` from the single parsed model. Their schemas are TypeSpec in `native/src/tsp/prism/`, compiled to JSON Schema in `native/contracts/generated/schema/` and to Rust through `codegen`. Python validates members against the same JSON Schema.

| Member | Stage | Schema | Contents | Consumers |
|---|---|---|---|---|
| `bundle.json` | all | `prism.bundle.manifest.a2` | members, stages, revision key, generator id, effective config, fill provenance, cross-check, warnings | all |
| `sources/**` | parse | — | the source set as committed (LFS hydrated) | browser viewers, KiCad-output jobs |
| `design.json` | parse | `kicad_monkey.design.a0` | design model | Simulation Studio engines, projections |
| `projections/semantic-index.json` | parse | `prism.semantic_index.a1` | components, nets, terminals, sheets, buses, 12 indexes, assembly (variants). Adds: `pinName`, `pinType`, `libraryRef`, and per terminal both `netName` (pad-resolved) and `schematicNetName` | identity endpoint, inspector, search, BOM table, variants UI and API, component import, Release Studio, Simulation Studio board facts |
| `projections/board-objects.json` | parse | `prism.board_objects.a0` | per object (`documentPath#uuid`): kind, parent, at, rotation, mirror, layers, net, refdes, lib id, flags, kiid paths, instances, properties, review fields; `.kicad_pro`/`.kicad_dru` settings objects | Design Comparison deltas, focus and navigation |
| `projections/occurrences.json` | parse | `prism.occurrences.a0` | symbol instances with path, reference and properties; footprints by refdes; sheet-level dnp/in-BOM folded along the path; canonical BOM fields | Design Comparison BOM rows, Release Studio, System Builder, catalog usage |
| `projections/stackup.json` | parse | `prism.stackup.a0` | layers (name, type, material, thickness, εr, tan δ, colour, kind), settings (finish, constraints, edge connector/plating), board thickness, via types and spans; mask colours | Design Comparison stackup tab, Release Studio tables, 3D tab looks, System Builder mid-plane, Simulation Studio |
| `projections/route-metrics.json` | parse | `prism.route_metrics.a0` | per net: length, via count, layers used, via spans | Design Comparison |
| `projections/placements.json` | parse | `prism.placements.a0` | per footprint: reference, side, xy/rot, dnp, excluded-from-pos, testpoint, courtyard, pads, first model, library link; board outline; designators | Release Studio sheets, System Builder interface and 3D scene, catalog import |
| `projections/project.json` | parse | `prism.project.a0` | title block, KiCad version, text variables, net classes, sheet hierarchy, model/worksheet/library-table path references | project metadata, Release Studio input closure, 3D board metadata |
| `projections/system-interface.json` | parse | `prism.system_interface.v1` (existing) | connectors and modules with schematic-only pin nets, pin names/types, power nets, pcb nets, geometry | System Builder |
| `refilled/<stem>.kicad_pcb` | board | — | board after the zone refill | materializer, KiCad-output jobs |
| `materialization/board.kmpack` | board | `kicad_monkey.materialization.a0` | analytic board | 3D tab, System Builder 3D, Simulation Studio |
| `viewer/models/components.glb` | models | — | component bodies from `kicad-cli` | 3D tab, System Builder 3D and collision meshes |
| `viewer/**` (transitional) | models | existing viewer contract | topology/scene assets until WP-C5 retires the Python compiler | 3D tab (mesh), System Builder 3D |

## 7. Parity and correctness

- **Goldens:** for each projection, today's output is captured by today's code (WP-G) on:
  - the corpus: the projects on the developer instance (EDA-04903 and 7 others), System Builder's fixture systems, and Release Studio's fixtures;
  - the committed demo fixtures;
  - public KiCad projects whose licences allow it. The kicad_cruncher test projects' licences are checked in F0 before use.
- **Comparison rules:**
  - byte-identical after removing `generatedAt`, unless a documented divergence (`native/parity/divergences.md`) is accepted;
  - every divergence names the case, why the new output is right, and which consumer is affected.
- **KiCad oracle:** `kicad-cli sch export netlist` and `pcb export stats` on the same corpus check nets and counts against KiCad itself, not only against Prism's previous output.
- **CI:** committed fixtures run on every PR (`native-parity` job). The full corpus is a nightly or local job, because private projects are not committed.
- **Determinism:** the same inputs give a byte-identical bundle (fixed timestamps, sorted members, stable maps). A test builds twice and compares.
- **Budgets** (EDA-04903, 57 MB board, in the worker image):
  - stage `parse`: ≤ 30 s, peak ≤ 1.5 GB;
  - the index projection alone: ≤ 5 s.
  - The API process never parses a KiCad file (WP-X).

## 8. Migration and flags

Each consumer switches through `PRISM_DESIGN_SOURCE_<CONSUMER>` = `legacy` (default) | `bundle`:
- `SEMANTIC_INDEX`
- `DESIGN_COMPARISON`
- `RELEASE_STUDIO`
- `SYSTEM_BUILDER`
- `VIEWER_3D`
- `PROJECT_METADATA`
- `CATALOG_IMPORT`

A consumer's flag flips to `bundle` by default in the PR that proves its parity. Its legacy path is deleted in Wave 4. Simulation Studio and the analytic 3D tab are not on dev today, so they are ported directly onto bundles, with no legacy mode.

**First deploy:**
- Bundles are built lazily on demand, plus a paced backfill of branch heads (one `design_bundle` slot). This replaces the cliff of every project rebuilding at once.
- The old stores are removed by WP-R4 once their consumers are on bundles:
  - `semantic-index/` and `semantic-visualizer/`;
  - the Design Comparison revision cache;
  - `system_interface_artifacts` and `system_bundle_frames`;
  - the 3D commit index.

## 9. Work breakdown for parallel agents

### 9.1 Rules every agent follows

- **Branching:**
  - integration branch `feature/native-design-bundle` from `dev`;
  - each work package (WP) is one branch `wp/<id>-<slug>` in its own worktree, stacked on the integration branch (or on the WP it depends on), and one PR into the integration branch;
  - the integration branch's first commit adds it to the quality gate's `pull_request` and `push` triggers, so every stacked PR gets CI;
  - the integration branch merges into `dev` per wave, after the maintainer approves.
- **Ownership:** a WP edits only the paths it owns (tables below). Shared files have a single owner. Others request changes from that owner, never edit them directly. The shared files are:
  - `native/Cargo.toml` and `native/Cargo.lock` (F1, then F2);
  - `native/src/tsp/prism/` and the generated contracts (W0; changes only by an ADR amendment PR);
  - `backend/app/core/config.py` (K owns the new flags);
  - `docker-compose.yml` and `backend/Dockerfile` (L);
  - `.github/workflows/*` (L);
  - `prism-projections/src/lib.rs` (P1).
- **Contracts first:** Wave 1+ code against the Wave 0 contracts and CLI spec, never against each other's work in progress. A WP that needs a contract change stops and reports it.
- **Definition of done for every WP:**
  - its acceptance tests pass;
  - `cargo fmt --check`, `cargo clippy --workspace -D warnings` and `cargo test` pass for any Rust it touches;
  - the backend suite passes (`pytest -n auto -rs`, Postgres integration modules not skipped);
  - Node 24.22.0 is used for anything that runs node;
  - `check_module_size.py`, `check_catalog_architecture.py`, `check_agent_docs.py` and `git diff --check` pass;
  - `AGENTS.md` maps are updated for any new or moved module;
  - a short PR body says what was verified and how.
- **Unchanged rules:** no AI attribution in any upstream kicad_monkey PR; no commercial solver names in prism-sim-studio; no edits to `.env`; no merging to `dev` without the maintainer; no touching the live instance.

### 9.2 Waves

```text
Wave 0  contracts (serial)            W0
Wave 1  foundations (parallel)        F0 F1 F3 B K G L     (F1 needs F0; F2 follows F1)
Wave 2  projections (parallel)        P1 P2 P3 P4 P5 V1    (need F2, B; parity needs G)
Wave 3  consumers (parallel)          C1 C2 C3 C4 C5 C6 C7 (each needs its projections and K)
Wave 4  removal (parallel)            R1 R2 R3 R4 X
```

### 9.3 Wave 0: contracts (one agent, serial; blocks everything)

| WP | Deliverable | Owns | Accept |
|---|---|---|---|
| W0 | ADR accepted (this document). Bundle manifest a2 and every §6 projection as TypeSpec, with one example each. CLI spec. Revision-key spec with test vectors. Ownership map. | `native/src/tsp/prism/` (written as a patch applied after F1's import, or in a staging dir `docs/architecture/design-bundle-contracts/` until then), `docs/architecture/adr-native-design-bundle.md` | Schemas validate their examples. The test vectors give the same key from a Python and a Rust reference implementation (written as the first commits of K and B). The maintainer reviews before Wave 1. |

The CLI spec (`prism-kicad`):
- `bundle build <project.kicad_pro> -o <out.prism> --stage parse|board [--refilled-board <pcb> --refill-tool <ver>] [--models-glb <glb>] [--revision-key <hex>] [--config <effective.json>]`
- `bundle verify <bundle>`
- `bundle extract <bundle> <member>... -o <dir>`
- `revision-key <repo> [--commit <sha> | --worktree] --project <rel> [--config <effective.json>]`
- `version`

Exit codes, stderr diagnostics, resource limits (§11, G8) and timeouts are part of the spec.

### 9.4 Wave 1: foundations (parallel)

| WP | Deliverable | Owns | Depends | Accept |
|---|---|---|---|---|
| F0 | Licence and provenance:<br>• the allow-list of paths to import;<br>• the list of fixtures excluded from history;<br>• the `fake_style.rs` decision;<br>• the kicad_cruncher corpus licences;<br>• root `NOTICE` | `NOTICE`, `native/LICENSES.md` (provenance note) | W0 | maintainer sign-off on the provenance note |
| F1 | History import (§4.3): `filter-repo` with F0's allow-list, `subtree add --prefix=native`, verbatim | `native/**` (import commit only) | F0 | `cargo test --workspace` passes as imported; byte-identical `design.json`/`board.kmpack` versus `b6316117` |
| F2 | Rename `kicad-monkey-*` crates to `prism-kicad-*` in one mechanical commit; workspace features for a lean `prism-kicad`; then add `prism-projections` (empty) and wire `prism-kicad-cli` | `native/Cargo.toml`, `native/Cargo.lock`, crate manifests | F1 | workspace builds and tests; diff is rename-only apart from the new crates |
| F3 | Replace the Wavenumber infrastructure (§4.2):<br>• hygiene checker;<br>• corpus pointer;<br>• oracle `kicad-cli`;<br>• release workflow re-targeted to Prism artifacts;<br>• the fork's CI jobs (native, wasm32, hygiene) ported into Prism's workflows | `native/scripts/`, `native/rust-hygiene*`, workflow files via L | F1 | the fork's CI jobs green in Prism's CI; a dry-run release produces the binaries and the wasm package |
| B | Bundle and CLI:<br>• move `prism-bundle` from prism-sim-studio into `native/src/rs/prism-bundle`;<br>• manifest a2 with stages;<br>• `reader` feature;<br>• `prism-kicad-cli` with the W0 commands;<br>• the Rust revision-key reference | `native/src/rs/prism-bundle/`, `native/src/rs/prism-kicad-cli/` | W0, F2 | `prism-kicad bundle build` gives a2 bundles that `verify` accepts; the a1 → a2 mapping is documented; determinism test |
| K | Backend bundle service:<br>• `design_bundle` package (reader, store, retention, commit index);<br>• the Python revision-key reference, including the effective config;<br>• `design_bundle` job with staged readiness, queued on import and sync and on demand by commit;<br>• paced backfill;<br>• the flags (§8) | `backend/app/services/design_bundle/`, job registration, flags in `config.py`, a migration for the commit index if needed | W0 | key test vectors match B's; the job builds with a stub CLI in tests and the real CLI in the image; staged readiness, retention and backfill tests |
| G | Goldens: capture today's outputs for every §6 projection on fixtures and corpus. Today's code is dev for most projections, and the reference branch for the analytic pack and Simulation Studio board facts | `native/parity/` (runner, golden format, fixture goldens); corpus manifest outside the repo | W0 | goldens exist for every projection; the runner diffs a bundle against them |
| L | Build and CI:<br>• the Rust workspace in `backend/Dockerfile`, with cached dependency layers;<br>• `prism-kicad` on PATH in the worker image;<br>• the `native` and `native-parity` CI jobs;<br>• the integration branch in the quality-gate triggers | `backend/Dockerfile`, `docker-compose.yml`, `.github/workflows/*` | W0, F1 | image builds on linux/arm64 and amd64; incremental image build time reported; CI green on the integration branch |

### 9.5 Wave 2: projections (parallel; each adds one producer in `prism-projections`)

Every P-WP owns one module `native/src/rs/prism-projections/src/<name>.rs`, its tests and its goldens' divergence notes.

| WP | Projection(s) | Port from | Accept |
|---|---|---|---|
| P1 | `semantic-index`, including assembly/variants, `pinName`/`pinType`/`libraryRef` and `schematicNetName` | `semantic_index_service.py`, `semantic_index_variants.py`, `semantic_index_nets.py`, the instance-field scan; the reference branch for the added fields | identical to goldens on the corpus (8/8, `generatedAt` excluded); ≤ 5 s on EDA-04903 |
| P2 | `board-objects`, `occurrences`, `route-metrics` | `design-compare-parser/ecad-parse.mjs`, `design_compare_occurrences.py`, the route digest, `placement_stamp.py` (usage) | Design Comparison's `changes`/`nativeObjects`/`componentObjects`/`routeMetrics` reproduced from the members for every pair in the comparison test suite |
| P3 | `stackup`, `placements` (including outline, courtyard, models, mask colours) | `release_studio/projections.py`, `design_compare_artifacts._extract_stackup`, `pcb_extract.py` stackup, `board_looks.py` (reference branch), `systems/interface_extractor.py` geometry | a superset of the three stackup shapes; Release Studio and System Builder goldens match |
| P4 | `project` | `project_metadata_service.py`, `project_properties_service.py`, `release_studio/closure*.py` reference scanning, `board_metadata.py` net classes | project metadata and Release Studio closure goldens match |
| P5 | `system-interface` | `systems/interface_extractor.py` (`EXTRACTOR_VERSION` 8) | identical interface digests on the System Builder fixtures and corpus |
| V1 | `viewer/models/components.glb` in the job's `models` stage (cached by board + model blobs + KiCad version), plus the board-body and mask facts the analytic tab needs | `kicad_cli_export.py` component export; `board_looks.py` (reference branch) | GLB identical to today's for the same KiCad; analytic tab inputs complete without the Python compiler |

### 9.6 Wave 3: consumer migrations (parallel; each behind its flag)

| WP | Consumer | Owns | Needs | Accept |
|---|---|---|---|---|
| C1 | Semantic index consumers:<br>• the identity endpoint serves the member;<br>• component import and the variants API (`variant_catalog_service`) read `assembly`;<br>• Release Studio's index digest;<br>• the API never builds an index | `semantic_index_service.py` (becomes a reader), `api/projects.py` index routes, `api/project_variants.py`, `variant_catalog_service.py`, `project_component_import_service.py` | P1, K | inspector, search, BOM table, variants and cross-probe unchanged (frontend tests plus a browser check on EDA-04903); identity served from a file with ETag; frontend types updated for a1's added fields |
| C2 | Design Comparison:<br>• semantics from `semantic-index`;<br>• deltas, objects, components and route metrics from P2;<br>• stackup from P3;<br>• Node `ecad-diff` retired;<br>• Gerbers keyed by bundle key;<br>• overlay sources from `sources/` | `design_compare_*.py`, `fabrication_compare_service.py` (keying only), `backend/design-compare-parser/` (removal), `frontend/.../design-comparison/revision-sources.ts` | P1, P2, P3, K | full comparison test suite; same review groups on a recorded set of real pairs; first comparison of two cold commits no slower than today (stage `parse` only) |
| C3 | Release Studio:<br>• projections from P3 and P4;<br>• the index from P1;<br>• kicad-cli steps read `sources/` and `refilled/`;<br>• the testpoint-only board and model rewrites stay KiCad-file writes, from bundle sources | `release_studio/projections.py`, `document_pipeline.py`, `closure*.py`, `source.py` | P1, P3, P4, K | dossier and evidence digests identical on the Release Studio fixtures; no `KiCadPcb` load remains |
| C4 | System Builder:<br>• interface from P5, cached by revision key;<br>• 3D scene from the bundle via `bundles.py`: `materialization`, `viewer/models/components.glb`, mid-plane from `stackup`, the same `bundleToBoard` frame;<br>• collision meshes from the bundle GLB;<br>• STEP export reads `sources/` | `backend/app/services/systems/` (interface, bundles, collision meshes, step export), `frontend/src/features/system-builder/scene-3d-tab.tsx` loaders only | P3, P5, V1, K | `test_system_e2e_replay` and scene tests pass; same frames and mid-planes on the corpus systems; the `<prism-semantic-viewer mode="system">` placing flow works in a browser check |
| C5 | 3D tab on the analytic model:<br>• port the reference branch's analytic renderer, 2D layer view and mask colours onto bundle members;<br>• selection and cross-probe through `semantic-index`;<br>• retire the Python topology compiler and mesh path for the 3D tab | `frontend/src/components/webgpu-3d-tab.tsx` and the analytic renderer, `semantic_visualizer_service.py` (becomes a thin bundle reader), `kicad-prism-viewer/` 3D pieces (removal in R2) | V1, P3, K | visual check on EDA-04903, USB-PD-Trigger-Board and one System Builder board; no `topology_compiler` process |
| C6 | Simulation Studio:<br>• port the reference branch's `backend/app/sim_studio/` and `frontend/src/components/sim-studio/` onto bundles;<br>• board facts from `semantic-index` (`pinName`, `pinType`, `libraryRef`);<br>• runs hard-link the bundle by key and gate on `cross_check`;<br>• run retention as on the reference branch;<br>• prism-sim-studio switches to Prism's `prism-bundle` (reader) and pack crate | `backend/app/sim_studio/`, `frontend/src/components/sim-studio/`, workspace migrations for setups/runs/layouts (new numbers after dev's), prism-sim-studio dependency PR | P1, B, K | DC IR drop end to end on EDA-04903 with the sim-worker; prism-sim-studio CI green against the pinned Prism commit |
| C7 | Catalog project component import and usage:<br>• project sides read `occurrences`, `placements` and `sources/` instead of scanning;<br>• the `pcbnew` footprint flip stays | `project_component_asset_extractor.py`, `project_catalog_usage_service.py`, `catalog/placement_stamp.py` project paths | P2, P3, K | `test_project_component_import_service.py` and the catalog Postgres integration pass |

### 9.7 Wave 4: removal and enforcement

| WP | Deliverable | Accept |
|---|---|---|
| R1 | Flip all flags to `bundle`; delete the legacy paths and the flags | suite green with no `legacy` branch left |
| R2 | Remove:<br>• `kicad-prism-viewer/pipeline/topology_compiler` (3D parts);<br>• `backend/design-compare-parser/`;<br>• `kicad_monkey_design_adapter.py`;<br>• the Python `kicad-monkey` and `kicad-cruncher` requirements (Release Studio calls the imported cruncher CLI) | `requirements/runtime.in` has no `kicad-monkey`; image size and build time reported |
| R3 | `prism-kicad-native` and `prism-clipper2` move onto the imported core (or are absorbed into `prism-projections`) | no crate depends on `wavenumber-eng/kicad_monkey` |
| R4 | Remove the superseded stores and tables (§8) with a migration; one-off cleanup of the old directories | no reader of the old stores remains; space reclaimed reported |
| X | Architecture test: no module under `backend/app` imports a KiCad parser or opens `.kicad_*` files, outside `design_bundle/`, the KiCad-output jobs and the catalog library reader | `backend/tests/test_design_source_boundary.py` |

### 9.8 Running it with Ultracode

- **Wave 0** runs first with one agent, and the maintainer reviews its contracts. F0 and F1 also need the maintainer, for the provenance sign-off and the history import.
- **Each later wave is one workflow:**
  - one agent per WP in its own worktree on `wp/<id>-<slug>`;
  - a verify agent per WP that runs the definition of done and the WP's acceptance checks;
  - an integration agent that stacks the wave's PRs onto `feature/native-design-bundle`, resolves order, and runs the full suite plus the parity runner.
- **Agent rules:** a WP agent
  - reports a contract gap and stops, rather than editing a frozen contract or another WP's paths;
  - does not touch the live instance;
  - leaves deployment to the maintainer.
- **Sizing:** Wave 1 has 7 agents (F1 → F2 serial inside it), Wave 2 has 6, Wave 3 has 7 and Wave 4 has 5, each with a verifier.

## 10. Decided defaults

1. Projections that only read parsed facts (including `system-interface`) are produced in Rust.
2. Gerbers and drill files stay outside the bundle, keyed by bundle key.
3. Catalog library parsing moves onto the imported core in a later ADR.
4. kicad-cruncher's Rust is imported and owned. Release Studio keeps calling it as a tool.
5. No Python bindings. The MCP server will call `prism-kicad`.
6. `wn-geometer` and the Geometer C SDK remain pinned external dependencies. Replacing them is out of scope.

## 11. Risks and gaps found in review

| # | Gap | Resolution in this ADR |
|---|---|---|
| G1 | A full bundle per commit (refill, materialize, GLB) would make the first Design Comparison of two cold commits slower than today's schematic-only work | staged readiness (§4.4): comparison needs stage `parse` only |
| G2 | Bundles store sources and the refilled board, duplicating git objects. Per-commit bundles for comparisons grow storage. | deflated members, retention by use (§5), sizes reported by K; revisit storing `sources/` by blob reference if growth matters |
| G3 | 3D models resolve through `KICAD*_3DMODEL_DIR` (KiCad's stock library in the image) as well as from the repository | the repository's model files are in the revision key; the stock library is pinned by the KiCad version in the generator id |
| G4 | LFS files and gitlinks (submodules) | source materialization reuses Release Studio's closure handling (LFS hydration, gitlinks) |
| G5 | Multi-project repositories share files and libraries | the key includes the project anchor; bundles are per project |
| G6 | Settings stored in Prism's database override the committed `.prism.json` and change which files are the project | the effective configuration is part of the revision key and recorded in the manifest |
| G7 | First deploy would rebuild every project at once | lazy builds plus a paced backfill (§8) |
| G8 | Bundles are built from untrusted repositories | parser limits (already in the core), a per-build timeout and memory cap in the CLI spec, zip path checks on read; a fuzzing target is follow-up work |
| G9 | The identity endpoint's schema changes (a0 → a1, additive) | frontend types updated in C1; ETag includes the generator id |
| G10 | A Rust workspace of this size lengthens image builds and CI | cached dependency layers in the Dockerfile; `native` CI jobs run only when `native/` changes |
| G11 | Two Rust cores (imported, and the upstream one in `prism-kicad-native`) coexist until R3 | accepted for the transition; R3 removes it |
| G12 | The user's open upstream materializer PRs and their review | upstream contributions are optional from now on; Prism does not wait for them |
| G13 | Shared `Cargo.lock` and generated contracts conflict between parallel WPs | single owners (§9.1); WPs ask the owner for dependency or contract changes |
| G14 | KiCad version support | KiCad 9 and 10 formats, as the core supports today; the worker image's KiCad (10.0.x) for KiCad outputs; KiCad 11 work is owned here |
| G15 | Contract evolution needs the TypeSpec/npm toolchain inside `native/` | imported with the rest (§4.1); runs under Node 24.22.0 |
