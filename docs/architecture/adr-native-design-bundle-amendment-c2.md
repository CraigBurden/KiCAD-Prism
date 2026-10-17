# ADR amendment: Design Comparison's object diff in Rust (`prism-kicad compare`)

- **Status:** Accepted (2026-10-17), with the recommended option for each of D1–D4 (§7). **Partly superseded (2026-10-17)** by [amendment C2r](adr-native-design-bundle-amendment-c2r.md): §2 items 1, 2 and 5, §3.3–§3.4, §4, §5 and D3–D4. D1, D2 and §3.1–§3.2 stand. Its text is applied to the parent ADR, `native/contracts/prism/cli-spec.md` (§5.6), `decisions.md` and `ownership.md`, and the TypeSpec lands in the same pull request, as for the earlier contract amendment (#727).
- **Parent:** [`adr-native-design-bundle.md`](adr-native-design-bundle.md): §2 item 6, §9.3 (CLI synopsis), §9.6 (C2 row), §10, §11.
- **Decided before this draft:** the maintainer chose, on 2026-10-17, to rewrite Design Comparison's diff engine in Rust instead of porting it to Python. The other consumers (C1, C3, C4a, C7, C8) stay thin Python readers.

## 1. Context

Today one Node process per comparison does the following (`design_compare_service.py:638-662`):
1. It parses both snapshots with the vendored ecad-viewer parser (`ecad-parse.mjs`, 2 k lines, plus a 3.5 k-line vendored parser).
2. It diffs the two object indexes (`ecad-diff.mjs` `diff_indexes`, 567 lines).
3. It writes `prism.ecad_object_delta_v1`.

Python reads four parts of that output:
- `changes`, through `_node_changes` (`design_compare_nodes.py:417`);
- `base`/`head` `nativeObjects`, through `_hydrate_native_targets`;
- `componentObjects`, through `revision_components` (`design_compare_occurrences.py:129`);
- `routeMetrics`, for the routing review and the stackup tab (`design_compare_service.py:1043`, `:1141`).

After P2, the parse is already in the bundle:
- `projections/board-objects.json` replaces the object index;
- `projections/route-metrics.json` replaces the route digest.

The board-objects field map defines how to rebuild today's index entry from a member object ("Rebuilding today's index entry"). The W0 prototype reran `diff_indexes` on rebuilt entries and matched 14 of 15 revision pairs; the one exception is divergence 2b. What is left in Node is the diff itself.

As written, the ADR's C2 row retires Node and leaves it open where `diff_indexes` goes. The choice is:
- **(a) port it to Python;**
- **(b) port it to Rust**, as a `prism-kicad` command over two bundles.

The maintainer chose (b), because the diff:
- is a pure function of two bundles;
- is sensitive to speed and memory: a 44 k-object board on each side, and C2 must accept "first cold comparison no slower than today";
- fits the existing parity harness;
- keeps the mm/nm rebuild rules in one place, beside the producer that wrote the members.

## 2. Decision

1. **New CLI command `prism-kicad compare`.** It reads `projections/board-objects.json` from two bundles and writes one document, `prism.compare.object_delta.a0`. That document is today's `prism.ecad_object_delta_v1`, field for field, without `routeMetrics` and without the run facts. Python reads `routeMetrics` from `projections/route-metrics.json`, as that field map already plans (it replaces `design_compare_nodes.py:547`). The member is not a lossless copy of today's digest (nm rounding, D3/D4 of that map), so it cannot be turned back into it.
2. **Output parity, not structure.** The Rust engine may work on the members' nanometre form directly, without materialising today's millimetre entries first. Its output must equal today's Node output on every pair of the comparison suite, under the parity rules of ADR §7, apart from the expected divergences listed in §6 below.
3. **The engine is a module, not a crate.** It lives at `native/src/rs/prism-projections/src/compare/`, with the command in `prism-kicad-cli/src/cmd_compare.rs`. No new crate is added, so `native/Cargo.toml` and `native/Cargo.lock` do not change.
4. **No cache of its own.** The diff runs once per comparison job, as today. The comparison result is already stored per job; in bundle mode its key holds both bundle keys instead of both commit SHAs. A separate delta cache would need its own version key, and that version must not sit in the generator id (§5 of the parent): a diff-only change would then rebuild every bundle.
5. **What stays in Python** (C2, unchanged):
   - the connectivity and semantic diff (`design_compare_semantics.py`), which reads `semantic-index`;
   - net pairing, BOM rows and review grouping (`design_compare_nodes.py`, `design_compare_occurrences.py`);
   - Gerbers and `fabrication_compare_service.py`, which are KiCad outputs (§2.1 of the parent).

   Moving the semantic diff to Rust is a possible later step on the same command. It is not part of this amendment.
6. **Node is retired by C2.** In bundle mode, `design_compare_service._ecad_object_delta` calls `prism-kicad compare` and nothing else. R2 removes `backend/design-compare-parser/`, as already planned.

## 3. CLI: `compare` (new cli-spec §5.6)

### 3.1 Synopsis (appended to cli-spec §2.1 and ADR §9.3)

```text
prism-kicad compare --base <base.prism> --head <head.prism> -o <delta.json> [COMMON]
```

- `--base` and `--head` may name the same file: a comparison of a commit with itself gives no changes.
- `-o` is written atomically: a temp file beside it, fsync, then rename (cli-spec §5.2.5, without the self-verify).

### 3.2 Checks before diffing

1. Only `board-objects.json` is read from each bundle. Each bundle passes the reader checks of cli-spec §6.2 and manifest checks 1–2 of §5.3. The member of each bundle is checked for size, CRC-32 and SHA-256 while it streams; the other members are not inflated. A failure is exit 3, `bundle-invalid`.
2. Both bundles name the same generator id. Otherwise exit 7, `generator-mismatch` (the existing code, widened to `compare`), because two producers' members are not comparable. The backend gets this case only when a bundle is stale, and rebuilds it.
3. Both members are present: stage `parse` is `complete`, or `partial` without the member in `failed_members`. Otherwise exit 7, `member-not-found` (widened to `compare`), with no result. Design Comparison then shows today's "object diff unavailable" state for that pair.
4. The two bundles' project anchors (`config.project_file`) lie in the same directory, the base of the object keys (D1). Anchors in different directories are exit 7, with the new code `anchor-mismatch`. Two project files in one directory, as in a rename of the `.kicad_pro`, share a key space and compare. A comparison across a move of the project directory is not a C2 feature.

### 3.3 Output

- **`-o`**: one `CompareObjectDeltaA0` document (§4).
- **stdout**: one `CliCompareResultA0`:

  ```json
  {"schema": "prism.cli.compare_result.a0", "base": {"bundleKey": "…", "objects": 0}, "head": {"bundleKey": "…", "objects": 0}, "counts": {"added": 0, "removed": 0, "modified": 0, "unchanged": 0, "ignored": 0, "baseObjects": 0, "headObjects": 0}}
  ```

  The full document goes to `-o`, not stdout: a full-board churn can hold every object on both sides, far beyond the 64 KiB line cap that §3.1 keeps for stdout documents.
- **Exit codes:** 0, 1–7 as in cli-spec §4. Exit 8–10 are not used.
- **Determinism:** the same two bundles give byte-identical `-o` and stdout. No timings, RSS, host paths or tool versions are written (cli-spec §0.8). Today's `timings`, `peakRssBytes`, `node` and `root` fields are dropped. The benchmark (`design_compare_benchmark.py`) times the subprocess from Python instead.
- **Limits:** the existing reader limits (`max-member-bytes`, `max-archive-bytes`, `max-total-unpacked-bytes`, `max-compression-ratio`) bound the inputs, and no new limit names are needed. cli-spec §7.2 gains `compare` defaults: `max-memory-bytes` 2 GiB and `timeout-ms` 120,000.

### 3.4 Backend integration

- `design_compare_service._ecad_object_delta` gains a bundle branch behind `PRISM_DESIGN_SOURCE_DESIGN_COMPARISON`. The branch:
  1. reads the two bundles through `design_bundle.consumer.bundle_read`;
  2. runs `prism-kicad compare` with the bundle files;
  3. loads `-o`.
- The not-ready policy is unchanged (`native-bundle-consumer-not-ready-policy`): when either bundle is not ready, the job queues the build and serves today's Node path for that request until R1.
- Working-tree comparisons stay legacy.
- Today's `revision_components` (`design_compare_occurrences.py:129`) reads each side's `root`, the snapshot directory, to rescan the schematics for sheet-level DNP and exclude-from-BOM. `root` is a host path and is dropped. In bundle mode C2 takes those flags from `projections/occurrences.json`, which already folds them along the sheet path.

## 4. Contract: `prism.compare.object_delta.a0`

This is a **parity document** (conventions §3 exemption). It keeps today's field names, today's millimetre numbers and today's kinds with `_`, so `_node_changes`, `_hydrate_native_targets` and `revision_components` read it unchanged. TypeSpec: `native/src/tsp/prism/compare-a0.tsp`, namespace `Prism.Contracts.CompareA0`, with roots `CompareObjectDeltaA0` and `CliCompareResultA0`.

| Field | Today (`ecad-diff.mjs`) | a0 |
|---|---|---|
| `schema` | `prism.ecad_object_delta_v1` | `prism.compare.object_delta.a0` |
| `base`, `head` | `{root, objects, timings, nativeObjects, componentObjects, routeMetrics}` | `{bundleKey, objects, nativeObjects, componentObjects}`. `root`, `timings` and `routeMetrics` are dropped; `bundleKey` is added |
| `nativeObjects[]` | `native_target`, :222 | same fields |
| `componentObjects[]` | `native_object` of symbols and footprints, :232 | same fields |
| `routeMetrics` | `index_snapshot().routeMetrics` | not emitted: C2 reads `route-metrics.json` (§2 item 1) |
| `changes[]` | `diff_indexes`, :338-481 | same fields, reasons and property deltas |
| `ignored[]` | object order | same entries; compared as a set (no consumer reads its order) |
| `counts`, `byKind`, `byReason` | :455-480 | same |
| `timings`, `peakRssBytes`, `node` | run facts | dropped |

Object keys follow decision D1 (§7).

## 5. Parity and acceptance

- **Goldens.** WP-G's capture runs today's `ecad-diff.mjs` on the snapshot pairs below. Its run facts are stripped, and the golden is compared with `prism-kicad compare` on the two bundles of the same pair:
  - every pair of `test_design_compare_*.py` and `ecad-diff.test.mjs`;
  - the 15 W0 prototype pairs;
  - one consecutive-commit pair per corpus project.
- **The comparison rules** are those of ADR §7, plus two:
  - `ignored` is compared as a set;
  - `changes` is compared in order, subject to D2.
- **CI.** The new parity member `compare` joins `PARITY_MEMBERS`. It needs pair cases, so the runner gains a `pairs` list beside `cases`, built from the existing prepared cases. This is the parity runner's only change.
- **C2 acceptance** (§9.6) adds: Rust `compare` equals the goldens on every pair, and the comparison of two parse-ready bundles of EDA-04903 finishes in ≤ 2 s, with a peak of ≤ 500 MB, in the worker image.

## 6. Parity traps

These are known places where a naive Rust port changes the output. Each one is a test case in the module.

| # | Today (JS) | A naive Rust port | Rule |
|---|---|---|---|
| T1 | `Math.round` rounds a half up (−2.5 → −2), in `round6` for `positionDelta` | `f64::round` rounds a half away from zero (−2.5 → −3) | use `(x + 0.5).floor()` semantics, as the board-objects centroid rule already does |
| T2 | `Math.hypot(dx, dy)` | `f64::hypot` (libm) can differ in the last bit | compute it as V8 does for two arguments; the result is then passed through `round6`, so a mismatch shows only at an exact half-ulp boundary, and the parity suite decides |
| T3 | `Position` is `at.join(", ")`, ECMAScript `Number::toString` (`25`, `-0` → `0`) | Rust `{}` writes `-0` | format with ECMAScript rules: the field map already requires this (`ed:284`) |
| T4 | `JSON.stringify` equality is sensitive to key order | `serde_json::Value` equality is not | equal by construction, because both sides come from one producer; documented, not reproduced |
| T5 | the signatures of `pair_unmatched` and its key lists use `.sort()`, i.e. UTF-16 code-unit order | `str::cmp` uses code-point order | these differ only above U+FFFF; reproduce code-unit order with `encode_utf16` |
| T6 | `localeCompare` (ICU, default locale) for `changes` and property names | — | see D2 |
| T7 | absent vs `null` vs `undefined`: `?? null` folds them in comparisons; spreads omit `undefined` in output | — | absent stays absent in output; comparisons fold absent and `null` exactly where JS uses `??` |

## 7. Decisions for the maintainer

**D1. Object keys and `documentPath`: repository-relative or project-relative?** The members use `RepoPath` (conventions §8), while today's keys are relative to the snapshot root, the project directory.
- *Recommended:* the output keeps today's project-relative form. `compare` strips the anchor's directory, as C8 already does in `_strip_project_directory`, so the frontend focus targets, stored comparisons and URLs keep their keys.
- *Alternative:* switch to `RepoPath` and update the frontend in C2. This is cleaner, but it is user-visible churn and it breaks stored comparisons' deep links.

**D2. Order of `changes` (today `localeCompare`).** ICU collation depends on the locale, so today's order already depends on the host's `LANG`. Reproducing it in Rust means ICU4X collation data, a new dependency of about 1 MB.
- *Recommended:* code-point order, recorded as expected divergence "compare-1". The affected consumer is the order of Design Comparison's review list, which `_node_changes` preserves; review groups and counts do not change. The parity harness compares `changes` as a sequence after re-sorting both sides by code point, and once more as a sequence of today's order, where the two orders agree.
- *Alternative:* add `icu_collator` and pin a locale. This gives exact parity, but it adds a dependency and ties the order to a locale choice.

**D3. Does `compare` also emit `nativeObjects` and `componentObjects`?**
- *Recommended:* yes. The mm/nm and kind rebuild rules then exist only in Rust, and `_hydrate_native_targets` and `revision_components` do not change. `routeMetrics` is the exception: it comes from its own member (§2 item 1).
- *Alternative:* delta only, with Python rebuilding both lists from `board-objects.json`. That puts a second copy of the rebuild rules in Python.

**D4. Generator mismatch: refuse, or diff anyway?**
- *Recommended:* refuse (exit 7, `generator-mismatch`). A comparison then always diffs two outputs of the same producer, and a generator bump is only a re-queue.
- *Alternative:* diff across generators. Every `contentDigest` change would then show up as a spurious modification.

## 8. Text changes to apply on acceptance

1. **ADR §9.3, CLI synopsis.** Add the `compare` line from §3.1.
2. **ADR §9.6, C2 row.**
   - *Deliverable:* "• object deltas, native objects and components from `prism-kicad compare` over `board-objects` (cli-spec §5.6); • route metrics from `route-metrics`; • Node `ecad-diff` retired".
   - *Owns:* add `native/src/rs/prism-projections/src/compare/`, `native/src/rs/prism-kicad-cli/src/cmd_compare.rs` and the `compare` parity member.
   - *Accept:* add §5's two items.
3. **ADR §10.** Add item 7: "Design Comparison's object diff is produced in Rust (`prism-kicad compare`); its semantic diff stays in Python."
4. **ADR §11.** Add G17: "Today's change order depends on the host locale (`localeCompare`)". Its resolution: D2.
5. **`cli-spec.md`.**
   - New §5.6, from §3.
   - §2.1: add the synopsis.
   - §4: allow exit 7 for `compare`.
   - §7.2: add the `compare` defaults for `max-memory-bytes` and `timeout-ms`.
   - §8: widen `bundle-invalid`, `generator-mismatch` and `member-not-found` to `compare`, and register `anchor-mismatch`.
   - §12: list this amendment.
6. **`decisions.md`.** Add a "Compare (date)" section that records D1–D4.
7. **`ownership.md`.** Add a C2 row for the two Rust paths, and mark `native/src/tsp/prism/compare-a0.tsp` as owned by this amendment's PR.
8. **`native/parity/divergences/compare.md`.** Add "compare-1" if D2 is accepted as recommended.

## 9. Work split once accepted

1. **Contracts PR** (main thread): this text applied; `compare-a0.tsp` and `CliCompareResultA0`, the generated schemas, Rust bindings and examples. No producer code yet.
2. **Rust engine** (a DeepSeek chunk): `compare/` and `cmd_compare.rs`; the parity runner's `pairs` and the captured Node goldens; T1–T7 as unit tests.
3. **C2 proper** (main thread, as planned): the Python bundle branch for semantics, stackup, Gerbers keyed by the bundle key, and overlay sources from `sources/`; the call site; the flag flip once the suite is green.
