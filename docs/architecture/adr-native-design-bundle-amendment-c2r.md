# ADR amendment C2r: Design Comparison computed in Rust, for ecad-viewer

- **Status:** Accepted (2026-10-17), with the recommended option for Q1–Q3 (§7). Its text is applied to the parent ADR, amendment C2, `cli-spec.md` §5.6, `bundle-format.md` §9, `decisions.md` and `ownership.md` in the same pull request. The contracts of §4 land in their own pull request (§9 step 1).
- **Revises:** [amendment C2](adr-native-design-bundle-amendment-c2.md). This revision supersedes its §2 items 1, 2 and 5, §3.3–§3.4, §4, §5 and decisions D3 and D4. D1 (project-relative keys), D2 (code-point order) and §3.1–§3.2 (the bundle checks) stand.
- **Parent:** [`adr-native-design-bundle.md`](adr-native-design-bundle.md): §8 (`DESIGN_COMPARISON`), §9.6 (C2 row), §10 item 7, §11 G1. It also amends [`bundle-format.md`](../../native/contracts/prism/bundle-format.md) §9.
- **Decided before this draft (maintainer, 2026-10-17):**
  - stop porting Node's `ecad-diff` shape: `prism-kicad compare` computes every Design Comparison tab in Rust;
  - old data structures shaped for the Python and Node implementation may be removed;
  - whatever `compare` emits must stay compatible with ecad-viewer, which displays the differences;
  - the backend's Python reader validates member schemas once, when a bundle is stored, not on every read;
  - the gate for switching C2 on is a cold two-commit comparison of EDA-04903 to every tab filled, Gerbers included, measured in a throwaway worker-image container.

## 1. Context

### 1.1 What C2 built

- `prism-kicad compare` (#745) ports Node's `diff_indexes` over two bundles' `projections/board-objects.json`. It equals today's Node output on 15 of the 16 harness pairs; the sixteenth differs only by an inherited divergence.
- The Python side (unmerged, branch `wp/c2-design-compare-bundle`) feeds today's assembly code from the members, with adapters that rebuild each Python shape: the schematic-only semantic view, components and BOM rows, stackup and route metrics. On eight real pairs it gives today's tabs, apart from documented divergences.

### 1.2 What the benchmark showed

Two commits of EDA-04903 (57 MB board, one footprint moved), nothing cached, measured until every tab is filled, each path in its own throwaway container from the worker image (10 CPUs, 7 GB):

| | Today | Bundle path, no bundles yet |
|---|---|---|
| First result (Schematic + BOM) | 21.2 s | 30.6 s |
| Every tab | 54.2 s | 70.2 s |
| Largest process | 1.7 GB | 1.5 GB |

| Step, both revisions in parallel | Today | Bundle path |
|---|---|---|
| Revision inputs | 19.5 s: Python schematic-only index; Node's diff (8.5 s) alongside | 25.7 s: parse stage 20.9 s, then `bundle verify` 4.9 s |
| Object diff | in the step above | `compare` 4.5 s |
| Tab data | in the step above | 0.9 s |
| Gerbers (`kicad-cli`) | 20 s | 25.5 s |
| Gerber image diff | ~13 s | 13.6 s |

The bundle path fails the ADR's own G1 rule, that the first cold comparison is no slower than today. Three causes:

1. **The parse stage computes everything, serially.** It writes every consumer's members (the 35 MB design JSON, the system interface, placements, …), one producer after another on one thread, re-lexing the board text in several of them, then deflates the archive. A profile on EDA-04903 spreads 12.4 s over about ten producers, 2 s of deflate and about 2.7 s of lexing. Today's path does less for Design Comparison: a schematic-only index and Node's object index.
2. **`compare` conforms to Node and Python shapes.** About half its output is `nativeObjects` and `componentObjects`, every object of both sides, which exist only because the Python assembly was written around Node's output. They drive most of its 1.18 GB peak on EDA-04903 (2.3 GB before the streaming fix) and its 65 MB output.
3. **The Python reader validates every member read with `jsonschema`.** EDA-04903's `semantic-index.json` (19.7 MB) costs 10.5 s per read; `board-objects.json` (47 MB) would cost 260 s.

Gerbers and their image diff, about 33 s, are the same work on both paths.

### 1.3 The display constraint

ecad-viewer parses both revisions' raw KiCad files in the browser and highlights what changed. Its input is `KiCadProjectDiffBundle` (`prism.kicad_project_diff_v1`, `frontend/src/components/design-comparison/types.ts:320`), passed with `diffFormat: "prism"` (`frontend/src/types/ecad-viewer.d.ts:360-380`). It is modeled on KiCad's native PROJECT_DIFF:
- per document: changes, each with `id` (the object's KIID path), `typeName`, `kind`, typed property deltas `{name, before: {type, v}, after: {type, v}}` (`type` one of `null`, `bool`, `int`, `double`, `string`) and `children`;
- `navigation`: from each review item's id to the documents and change ids it covers;
- `diagnostics`.

ecad-viewer resolves each change id against its own parsed objects, measures the bounds itself, and reports how well that went (`EcadDiffResolutionSummary`: `sourceResolved`, `item-not-found`, …). Today Python builds this bundle (`document_diff_service.build_project_diff`) from Node's change list.

## 2. Decision

1. **`compare` computes Design Comparison, not an object delta.** One run produces everything the tabs show except fabrication:
   - the Schematic and PCB changes, with classification, labels, reasons, property deltas and the net-rename derivation;
   - connectivity (net and terminal) changes;
   - the BOM diff;
   - the stackup diff;
   - route metrics for both sides;
   - ecad-viewer's `KiCadProjectDiffBundle`.
2. **ecad-viewer's input format is fixed.** `compare` emits `KiCadProjectDiffBundle` exactly as ecad-viewer reads it today; ecad-viewer does not change. Each property's `type` comes from what the KiCad property is (an integer field is `int`, a coordinate `double`), never from how a number happened to be written.
3. **A new review contract replaces `prism.semantic_comparison_v3`.** It carries the tabs' data, typed, and references changes by the ids `KiCadProjectDiffBundle` and its `navigation` use. Prism's Design Comparison frontend moves to it; only the viewer host's hand-off to ecad-viewer stays as it is. `nativeObjects`, `componentObjects` and `prism.compare.object_delta.a0` are removed.
4. **Two input modes, one set of producers.**
   - *Bundles:* `compare --base <a.prism> --head <b.prism>` reads the members it needs.
   - *Source trees:* when a commit has no bundle yet, `compare` takes its source tree, with the same inputs `bundle build --stage parse` takes. It parses both sides in parallel and runs **only** the producers Design Comparison reads (board objects, semantic index, occurrences, stackup, route metrics), in memory: no archive, no deflate, no verify. The backend queues the full bundle build alongside, so later comparisons and the other consumers reuse one parse.
   - Both modes run the same producer code, so they give the same result. A test compares the two modes on every pair.
5. **Python passes the result through.** `design_compare_service` decides the mode, runs `compare`, stores the result as the job's artifact, and adds fabrication. `design_compare_nodes.py`, `design_compare_semantics.py`, `design_compare_net_pairing.py`, `design_compare_occurrences.py`, `document_diff_service.py` and the C2-a adapters are deleted from the bundle path; they stay only for the legacy fallback until R1.
6. **One result, no staged publish in bundle mode.** Today's "Schematic and BOM first" publish hides the slow PCB stage. In bundle mode every tab except fabrication arrives at once, and fabrication follows when its Gerbers are ready. The readiness states stay, so the frontend handles both.
7. **Fabrication stays in Python and KiCad.** Gerbers remain `kicad-cli` output, keyed by bundle key (§10 item 2 of the parent). Caching them per commit as a bundle-stage artifact is a follow-up; it does not gate C2.
8. **The parse stage gets faster for every consumer.** Producers run in parallel; each file is lexed once and its tree shared; large members use a faster deflate level. Output bytes do not change: the generator pin must pass without a re-bless.
9. **Store-time validation** (amends bundle-format §9). The backend runs `prism-kicad bundle verify`, all checks including member schemas, once when it stores an archive and records the result with the archive. Its reads then run steps 1–6 (structure, identity, size, CRC-32, SHA-256) and skip step 7. The SHA-256 ties the bytes it reads to the bytes that were validated. `bundle verify` itself and the Rust reader are unchanged. The verify is off the comparison's critical path: a comparison in source-tree mode does not wait for it.

## 3. CLI: `compare` (replaces cli-spec §5.6's output)

```text
prism-kicad compare --base <a.prism> --head <b.prism> -o <result.json> [COMMON]
prism-kicad compare --base-src <project.kicad_pro> --head-src <project.kicad_pro>
            [--base-source-root <dir>] [--head-source-root <dir>]
            [--base-upgraded <path>=<version>]... [--head-upgraded <path>=<version>]...
            [--config <effective.json>] -o <result.json> [COMMON]
```

- One side may be a bundle and the other a source tree (`--base` with `--head-src`, and so on).
- Checks: bundles keep C2 §3.2 (reader checks, same generator id, anchors in one directory, members present). A source tree fails as `bundle build --stage parse` does (exit 3 or 9 with the same codes). Both sides must use the same generator id; a source tree side uses the running CLI's.
- `-o` receives the review document (§4), written atomically and streamed (C2 §3.3). stdout receives `CliCompareResultA0`, revised to the new counts.
- Determinism: the same inputs give byte-identical output. No timings, host paths or versions.
- Limits: `max-memory-bytes` and `timeout-ms` keep `compare` defaults; the defaults are set from the benchmark (§5) by this amendment's contracts PR.

## 4. Contracts (written in the contracts PR)

- **`prism.design_compare.result.a0`** (root `DesignCompareResultA0`), `native/src/tsp/prism/design-compare-a0.tsp`; *a1 since step 6 (2026-10-18), adding `details.targets`, which the review list reads (`decisions.md`, C2r item 9)*. Camel case, units as the conventions require, except where a field mirrors ecad-viewer's input. It holds:
  - `base` and `head`: revision identity (bundle key or the source-tree's revision key), anchor, file list;
  - `schematic` and `pcb`: changes and summaries;
  - `connectivity`: net and terminal changes;
  - `bom`, `stackup`, `routeMetrics`;
  - `projectDiff`: the `KiCadProjectDiffBundle` (§2 item 2);
  - `counts` and `diagnostics`.
- **`prism.kicad_project_diff.v1`** (root `KiCadProjectDiffBundleV1`), typing ecad-viewer's input exactly as `types.ts:280-338` and `ecad-viewer.d.ts` define it today. It is a mirror contract: its spelling is ecad-viewer's, and a change to it is an ecad-viewer change.
- A field map, `field-maps/design-compare.md`, maps each of today's `DesignCompareResult` fields (`types.ts:412-437`) to the new contract or records its removal.
- `prism.compare.object_delta.a0` and `CompareObjectDeltaA0` are removed, and `CliCompareResultA0` gets the new counts, by the pull request that switches `compare` to the new output (§9 step 4): today's engine is built on their generated types.

## 5. Parity and acceptance

**Output acceptance.** The goal is the same review, not the same bytes as Node.
- *Review groups and counts:* on a recorded set of real pairs, the new result gives the same review groups, the same counts per tab and the same changed objects as today's path, after the documented divergences (C2 compare-1 to compare-3, and the field maps' C2 divergences). Each difference is either a documented divergence or fixed.
- *ecad-viewer resolution:* on the same pairs, ecad-viewer's `EcadDiffResolutionSummary` for every document is equal to or better than today's: `sourceResolved` not lower, and no new `item-not-found`, `source-id-ambiguous` or `duplicate-change-target` diagnostics. A browser check records the counters for both paths.
- *The pairs:* the 16 harness pairs, the 8 end-to-end pairs (mini_obc, mini_power, dv-oracle, usb-pd, synthetic, cynthion, EDA-04903), every pair of `test_design_compare_*.py`, and one consecutive-commit pair per corpus project.
- *Modes:* bundle mode and source-tree mode give byte-identical `-o` on every pair.

**Performance gate.** C2 is switched on only when, on the §1.2 benchmark (EDA-04903, two commits, nothing cached, throwaway worker-image container):
- every tab except fabrication is ready before today's first result (21.2 s);
- every tab including fabrication is ready no later than today's 54.2 s;
- `compare`'s peak heap stays within its `max-memory-bytes` default, and the backend's largest process does not exceed today's 1.7 GB.

The benchmark script and its results are committed under `native/parity/benchmarks/`, as the standing benchmark task requires.

**Parity runner.** The parity member `compare` compares the review document's groups and counts on the harness pairs; the runner gains its `pairs` list (C2 §5).

## 6. Expected divergences

The review is computed anew, so where today's output follows a Node or Python accident, the new output may differ. Every such case is recorded in `native/parity/divergences/compare.md` with the pair, today's value and the reason. Known now:
- the C2 entries compare-1 (code-point order), compare-2 (sub-nanometre coordinates) and compare-3 (object order);
- property value types follow the KiCad property, not the JSON text (§2 item 2);
- the field maps' C2 divergences that the end-to-end check confirmed: semantic-index D7 (reconciled net names), stackup `/settings` (no spurious "changed" without a stackup), route-metrics D7 (via layers).

## 7. Open questions

**Q1. The new review contract and stored comparisons.** Results stored under `prism.semantic_comparison_v3` remain readable by today's frontend code.
- *Recommended:* the frontend reads both until R1. A stored v3 result is shown as today; a new one through the new contract. Stored results are per job and are recomputed on the next request after R1.
- *Alternative:* convert stored v3 results on read. This keeps one frontend path but needs a converter that R1 deletes again.

**Q2. Where the review logic is ported from.** Today's labels, classification, net pairing and net-rename derivation live in Python (`design_compare_nodes.py`, `design_compare_semantics.py`, `design_compare_net_pairing.py`); review grouping and presentation policy live in the frontend (`comparison-review-groups.ts`, `comparison-review-policy.ts`).
- *Recommended:* the Python logic moves into `compare`; the frontend's grouping and presentation policy stay in the frontend. This keeps UI decisions where the UI is.
- *Alternative:* move grouping into `compare` too. This gives one place for review semantics, but every presentation change then needs a CLI release.

**Q3. Building bundles before the first comparison.** Today bundles are built when first requested.
- *Recommended:* not part of C2. Source-tree mode removes the cold-path cost, so C2 does not depend on when bundles are built.
- *Alternative:* queue a parse-stage build for each new commit of an imported project. This makes cold comparisons rare but adds background load per push.

## 8. Text changes to apply on acceptance

1. **Amendment C2.** Mark §2 items 1, 2 and 5, §3.3–§3.4, §4, §5, D3 and D4 superseded by this revision.
2. **ADR §9.6, C2 row.**
   - *Deliverable:* "• every tab except fabrication computed by `prism-kicad compare`, from bundles or, when a commit has none yet, from its source tree (amendment C2r); • ecad-viewer's diff bundle from `compare`; • fabrication from `kicad-cli`, keyed by bundle key; • Node `ecad-diff` and the Python assembly retired".
   - *Accept:* §5 of this revision replaces C2's added items.
3. **ADR §10 item 7.** "Design Comparison is computed in Rust (`prism-kicad compare`), from bundles or source trees; ecad-viewer's input format is unchanged (amendment C2r)."
4. **ADR §11 G1.** Resolution: source-tree mode and the parse-stage speed-up; gated by §5.
5. **`cli-spec.md` §5.6.** The synopsis, checks and output of §3; §7.2 defaults set from the benchmark; §8 adds any source-tree codes reused from `bundle build`.
6. **`bundle-format.md` §9.** Step 7 runs once per stored archive for the backend's reader (§2 item 9).
7. **`decisions.md`.** A "Design Comparison in Rust (2026-10-17)" section with this revision's decisions and Q1–Q3.
8. **`ownership.md`.** C2 owns `design-compare-a0.tsp`, `kicad-project-diff-v1.tsp` and the new field map; `compare-a0.tsp` is removed.

## 9. Work split once accepted

Each step lands as its own PR into `feature/native-design-bundle`. Already finished work that still has value lands first: `compare`'s memory streaming and number format, and on the backend the BOM part-number fix and parallel Gerbers.

1. **Contracts** (main thread): §4's two roots, the field map, examples, generated schemas and Rust bindings; `compare-a0.tsp` removed.
2. **Store-time validation** (DeepSeek chunk): the backend runs `bundle verify` when it stores an archive and records the result; reads skip step 7; bundle-format §9 text.
3. **Parse-stage speed-up** (main thread): parallel producers, lex once, deflate level; generator pin unchanged; before-and-after timings on EDA-04903.
4. **`compare` rewrite** (main thread, with DeepSeek chunks per tab): source-tree mode; the review document; `KiCadProjectDiffBundle`. The engine's index rebuild, matching and classification are kept; the per-tab logic is ported from the Python modules listed in §2 item 5; mode equality and review-group parity as tests.
5. **Backend pass-through** (main thread): mode decision, fabrication, the job artifact; the legacy path kept behind the switch.
6. **Frontend** (main thread): the new contract; v3 kept for stored results (Q1); the ecad-viewer hand-off unchanged.
7. **Gate** (main thread): §5's acceptance on the recorded pairs, ecad-viewer counters from a browser check, and the cold EDA-04903 benchmark. The switch flips only after the gate passes and the maintainer agrees.

## 10. The switch (2026-10-18)

`PRISM_DESIGN_SOURCE_DESIGN_COMPARISON` now defaults to `bundle`. The gate (§5, step 7) did not pass on every item, and the maintainer switched anyway:
- **Review parity:** passed. 1,971 review groups over the 18 recorded pairs and 6 corpus pairs differ only where `native/parity/divergences/compare.md` records it.
- **ecad-viewer resolution:** passed. No document is worse (37 equal, 11 better).
- **Modes:** bundle mode and source-tree mode give byte-identical `-o` on every pair.
- **Cold EDA-04903** (`native/parity/benchmarks/README.md`, "Cold Design Comparison"): not passed. The first result takes 50.9 s against today's 28.1 s; every tab takes 63.3 s against 62.6 s; the largest process is 2.7 GB against 1.7 GB. The KiCad 8 → 10 upgrade and two full parses cause it. On a design already saved by KiCad 10, the first result is within a few seconds of today's and every tab about 20 s sooner.
- **Why it is accepted:** with ADR amendment K2's warm bundles (the prebuild of each branch's newest commits and every tagged commit), a comparison of two prebuilt commits reads bundles and takes 3 s. The cold path is the exception: a commit outside the prebuild set, or a deployment that turns `PRISM_DESIGN_BUNDLE_AUTO_BUILD` off. The switch PR makes it default to on.
- **F1, no fallback:** a `compare` failure fails the comparison; it never falls back to the legacy path. `legacy` stays selectable until R1 deletes it.
- **The switch PR** removes `prism.compare.object_delta.a0` (`compare-a0.tsp`, `compare-font-a0.tsp`, its example, field map, schema and Rust bindings) and the engine code only its writer used. `compare`'s stdout becomes `prism.cli.compare_result.a1` (`cli-compare-a1.tsp`), whose `counts` are the result's per-tab counts (§4).
