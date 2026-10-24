# ADR amendment U: what the user sees

- **Status:** Accepted (2026-10-17). The maintainer took decisions 1, 2, 3 and 5 as proposed. They rejected the proposed narrowing of decision 4: every consumer of the parent ADR still migrates. This text is applied to the parent ADR and `decisions.md` in the same pull request. The contract changes of §3.3 land with their work package. §3.3 "Stages after `parse`" and §4's K2a and K2b lists are revised by amendment K2 (2026-10-17).
- **Parent:** [`adr-native-design-bundle.md`](adr-native-design-bundle.md): §5 (storage), §7 (parity and budgets), §8 (first deploy), §10, §11 G2 and G7. It applies to every amendment (C2, C2r, C3) and to every work package that has not merged.

## 1. Context

Since the parent ADR, the native path has beaten the legacy one on the journeys users wait on. On EDA-04903:
- the parse stage takes about 10 s, against the Python index's 60 s;
- a cold Design Comparison fills every tab except fabrication in about 15 s, against today's 21 s first result and 54 s for every tab;
- a warm comparison, from bundles, takes about 2 s.

Most of the effort since then has gone into things no user sees:

1. **Byte parity with legacy quirks.**
   - Examples: Python's `round(mm, 4)` route lengths, ECMAScript number text, Python truthiness and `0 == False` when compacting attributes, `localeCompare` order.
   - Each needs a trap list, a converter to the new contract, goldens and a harness.
   - A parity reference once encoded a bug of its own: the BOM column default mocked to empty.
2. **Cold bundles by design.**
   - The revision key is repository-wide (revision-key.md §5.1), so any change in a repository makes every project's bundles cold.
   - That pushed `compare` into a source-tree mode, and then into proving the two modes byte-identical.
3. **JSON between Rust and Rust.**
   - "CLI and files" (parent §2 item 6) is the right boundary for Python.
   - But producers also build `serde_json::Value` trees inside Rust, and `compare` parses members back into typed values.
   - Profiling put much of the parse stage's CPU and memory there.
4. **Optimization without a stopping point.** No budget was set per user journey, so nothing said when performance work was done.

## 2. Decisions

1. **Parity means what the user sees.**
   - A native output is right when every user-visible result equals today's, or is a reviewed improvement on it:
     - review cards, groups and counts;
     - changed objects and their highlights;
     - BOM rows, stackup rows, route lengths as displayed;
     - project metadata, Release Studio deliverables, 3D views and System Builder results.
   - Bytes matter only where a machine reads them (§3.1).
2. **Each user journey has a budget, and performance work stops when it is met** (§3.2). Work that is not needed to meet a budget is not done; the same goes for keeping one met.
3. **Warm by default** (§3.3).
   - Prism builds parse-stage bundles in the background for new commits on tracked branches.
   - A new revision key reuses an existing bundle whose recorded read set the new tree leaves unchanged.
   - The revision key itself is unchanged.
4. **Every consumer migrates, as the parent ADR planned.** Design Comparison, the semantic index, Release Studio, System Builder (interface and 3D), the 3D tab, Simulation Studio, catalog import and project metadata. Wave 4 removes the legacy paths and Python kicad_monkey.
5. **Typed values inside Rust, JSON at the file boundary.**
   - Producers return typed values (the generated contract types).
   - `prism-kicad compare` in source-tree mode passes the producers' typed values to the comparison directly.
   - Members are still JSON files, with the same bytes.
   - No bindings and no binary member format.

## 3. Rules

### 3.1 Parity (replaces parent §7 "Comparison rules")

- **Byte-stable** is still required, because a machine reads these:
  - ecad-viewer's input (`KiCadProjectDiffBundleV1`);
  - every member's own determinism (parent §7 "Determinism"), so that a bundle key names one set of bytes;
  - `compare`'s bundle and source-tree modes, which must agree, so that the result does not depend on whether a bundle existed;
  - formats other programs read: prism-sim-studio's pack and manifest, vendor CSV files, Gerbers and drill files.
- **Everything else** is compared at the level the user sees. Today's output and the goldens remain the yardstick. A difference is acceptable when it is:
  - **invisible**: it changes no rendered value, ordering, count or highlight (for example, number text, map key order, an internal id); or
  - **an improvement**: it is visible, and the new value is more correct. Examples: exact nanometre lengths instead of 4-decimal millimetres, code-point order instead of host-locale order, a bug fix.
- **Every visible difference is listed** in the consumer's divergence file (`native/parity/divergences/<consumer>.md`). Each entry names:
  - the case;
  - what the user saw before and sees now;
  - why the new value is right.

  The maintainer reviews the list in the pull request that introduces it.
- **Legacy quirks are not reproduced**, unless the user sees them and the maintainer wants to keep them. A converter from today's output to a new contract may still be used to build a reference. It is a test tool, not a rule for the implementation.
- **Existing references stay as they are.** Work packages that already match their references byte for byte keep them. New and unmerged work follows this section.

### 3.2 Budgets (replaces parent §7 "Budgets")

Measured on EDA-04903 (57 MB board) in a throwaway container from the worker image (10 CPUs, 7 GB), as in amendment C2r §1.2. Peak memory is the worst of five runs, because it varies with how the parallel producers overlap. Local measurements are a development proxy; the container decides.

| Journey | Budget |
|---|---|
| Stage `parse`, one revision | ≤ 10 s; peak ≤ 1.5 GB |
| Cold Design Comparison, two commits without bundles, every tab except fabrication | ≤ 15 s; peak ≤ 3 GB for the whole comparison |
| Cold Design Comparison, every tab including fabrication | ≤ today's 54.2 s |
| Warm Design Comparison, both bundles stored | ≤ 2 s; peak ≤ 1 GB |
| A projection member read by the backend | ≤ 0.1 s after the bundle is stored (validated once, at store) |
| Stages `board` and `models` | ≤ today's equivalent Python and `kicad-cli` path for the same consumer |

The 3D journeys' budgets (set on 2026-10-18, amendment V2 §7) are measured in headless Chrome on an Apple-silicon Mac with assets on loopback; the cold commit is measured in the container as above.

| Journey | Budget |
|---|---|
| 3D tab, warm commit: board shown whole (every layer and the parts, held back until all are drawn) | ≤ 1.5 s |
| 3D tab, warm commit, opened again (same bundle) | ≤ 0.5 s |
| Bytes before the board shows | no more than the mesh path's (39 MB on EDA-04903) |
| Cold commit: board shown | ≤ 120 s; peak ≤ 3 GB |
| System Builder scene, warm system of five boards: every board drawn | ≤ 3 s (confirmed in V2b) |
| 3D tab, inspecting: GPU time per frame orbiting at 2× pixels, every view (assembled, substrate hidden, separated, exploded) | p95 ≤ 16.7 ms |
| System Builder scene, five boards, exploded: GPU time per frame orbiting at 2× pixels | p95 ≤ 16.7 ms |
| Harness node drag: curve and tube redrawn | same frame (≤ 16 ms) |
| Simulation result on a warm bundle: first overlay frame | ≤ 1 s; no geometry downloaded |

- A pull request that changes a hot path reports the journey's measurement before and after.
- When every budget of a journey is met, its performance work stops. New work is opened only to meet a budget, or after the maintainer raises one.
- On 2026-10-17, worst-case peak memory of stage `parse` measured 2.7 GB, so that budget is not yet met.

### 3.3 Warm by default (extends parent §5 and §8)

- **Background builds.**
  - After each sync, Prism queues stage `parse` for the new commits of every tracked branch, newest first: up to `PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS` per branch (default 20; amendment K2 §7 makes it 10 plus every tagged commit, and adds a forced rebuild).
  - The builds use the existing `design_bundle` slot and its dedup on the bundle key.
  - Stages `board` and `models` stay on demand.
  - The paced backfill of branch heads (parent §8) stays.
- **Reuse by read set.**
  - Stage `parse` records its read set in `bundle.json`:
    - every repository path a producer read, with its object id;
    - every path whose existence it tested, with its object id or "absent";
    - every directory listing it made, as directory, suffixes and the paths it returned.
  - **Rule:** if every recorded path has the same object id (or is still absent) in a new tree, and every listing returns the same paths, the build would read the same bytes and produce the same parse-stage members.
  - So for a new revision key with no bundle, Prism looks for a stored bundle of the same project, effective configuration and generator whose read set holds in the new tree.
  - On a match, it records `(project, revision key) → bundle key` in the commit index's alias table instead of building.
  - A consumer that is given a revision key reads through the alias.
  - The revision-key algorithm (`prism.revision_key.a1`) does not change, so no stored key changes.
- **Producers read only what they need.**
  - The read set is only as narrow as the producers' reads, so `Sources` (`prism-projections`) replaces "every path of the source set" with three recorded queries:
    - read a path;
    - test that a path exists;
    - list one directory by suffix.
  - No producer may depend on the whole source set.
  - `board-objects` covers the project's own documents, selected by anchor and effective configuration as the parent ADR requires (§6): the project file, its `.kicad_dru`, the board and every schematic the root schematic reaches.
  - Today it takes every `.kicad_sch`, `.kicad_pcb`, `.kicad_pro` and `.kicad_dru` in the repository-wide source set. In a multi-project repository, a comparison of one project therefore shows the files of the others.
  - The change is user-visible (§3.1). Design Comparison no longer lists other projects' files, or schematic files the design does not reach. It is recorded in `native/parity/divergences/board-objects.md`.
- **Stages after `parse`.** Superseded by amendment K2 §3.5 ([`adr-native-design-bundle-amendment-k2.md`](adr-native-design-bundle-amendment-k2.md)): stages board and models run on the archive's own `sources/`, so revisions whose read set holds share one archive, all stages included, and there is no `bundle rekey`.
- **Contract changes, in the work package:**
  - `bundle-format.md` and `prism.bundle.manifest` gain the read set (a3);
  - `cli-spec.md` gains the read set's recording and `bundle reuse` (amendment K2 §3.7);
  - `revision-key.md` §10 gains the alias table;
  - the generator id is bumped.

## 4. Consequences

- **Remaining C2r chunks.** `connectivity` and `projectDiff` follow §3.1. They match today's review groups and ecad-viewer's resolution counters, not the converted reference's bytes. Chunk 3 (`objects`) already matches byte for byte and keeps that.
- **Performance work under the budgets:**
  - item 1 (`compare` builds only the `design.json` parts it reads, #755) is done;
  - items 2, 3 and 5 are in progress. They are kept because they bring stage `parse` towards its budgets;
  - item 4, typed members in `compare`, is now required by decision 5;
  - item 6, memory, is required by the stage `parse` peak budget.
- **New work packages K2a and K2b (warm by default).** Their ownership and acceptance are in amendment K2 §4, which replaces the lists first written here (they named `bundle rekey`, which K2 removes).
- **Wave plan.** Unchanged: every consumer migrates (decision 4).

## 5. Text changes applied with this amendment

- Parent ADR:
  - status line;
  - §7: the comparison rules and budgets point to §3.1 and §3.2;
  - §8: first deploy adds the background prebuild;
  - §10: item 8 (this amendment);
  - §11 G1, G2 and G7: notes.
- `native/contracts/prism/decisions.md`: a section for this amendment.
