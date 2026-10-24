# Benchmarks: today's Python producers vs the native bundle

`bench_python.py` times today's Python producers on the parity cases: wall time per call and peak RSS. It covers the production entry points (`prod:*`) and every capture module (`golden:<member>`). It is the **baseline** the native bundle is compared with after Wave 4. Run it before any C-step removes a Python path, so the baseline exists.

- Run it on a quiet machine: no builds or other heavy processes. The report records the load average at the start and at the end.
- Each (case, target) runs in a fresh interpreter. The first call is cold, and imports are timed apart; `--repeat` calls follow, with nothing cached between them.
- `rs-cynthion` is the stress case.

```sh
# inside the backend environment (Python 3.12, kicad_monkey of requirements/), Node 24 on PATH
python native/parity/benchmarks/bench_python.py --today . --prepared <dir with <case>/src> \
    --out native/parity/benchmarks/results/<yyyy-mm-dd>-<host>.json
```

Results go in `results/`, one file per run, named by date and host.

The full comparison after Wave 4 adds:
- the time for `prism-kicad bundle build` per design;
- the request latency of the endpoints that parsed on demand, before and after their C-step;
- the worker's peak RSS.

## Baseline: 2026-10-17, before the first C-step

`results/2026-10-17-ithelpdesk-macbook-pro-arm64.json` records:
- **Machine:** Apple silicon, 10 CPUs, Python 3.12.13, kicad_monkey 2026.9.7.
- **Run:** all 33 parity cases, `--repeat 3`, on sources prepared by `prism_parity` (KiCad 10.0.6 upgrade).
- **Load:** no builds or tests were running, but desktop apps and a VM were. The load average was 9.0 at the start and 6.0 at the end, so treat differences under about 10 % as noise.
- **Refusals:** `dv-malformed` is refused by the three production paths that load the design, as today does (`SexprTreeError`).

Best of 3 per call, summed over the cases each target ran on:

| Target | cases | total best (s) | slowest case, best (s) | max peak RSS (MiB) |
|---|---|---|---|---|
| `prod:km-load` | 32 | 4.19 | rs-cynthion 3.35 | 384 |
| `prod:semantic-index` | 32 | 4.98 | rs-cynthion 3.78 | 402 |
| `prod:variant-catalog` | 33 | 0.12 | rs-cynthion 0.02 | 78 |
| `prod:system-interface` | 32 | 4.47 | rs-cynthion 3.59 | 386 |
| `golden:semantic-index` | 33 | 5.17 | rs-cynthion 3.91 | 399 |
| `golden:system-interface` | 33 | 4.53 | rs-cynthion 3.64 | 383 |
| `golden:project` | 33 | 33.78 | rs-cynthion 14.97 | 353 |
| `golden:stackup` | 33 | 10.12 | rs-cynthion 8.52 | 356 |
| `golden:placements` | 33 | 8.75 | rs-cynthion 7.45 | 416 |
| `golden:occurrences` | 33 | 33.20 | rs-cynthion 24.87 | 496 |
| `golden:board-objects` | 33 | 6.68 | rs-cynthion 3.08 | 415 |
| `golden:route-metrics` | 33 | 4.39 | rs-cynthion 1.21 | 404 |

The `golden:*` rows are capture modules: W0 prototypes and adapters around today's code, with Node children for the Design Comparison members. Only `prod:*` are production paths. The full comparison after Wave 4 sets `prism-kicad bundle build --stage parse` (all members from one parse) against these numbers.

## Cold Design Comparison: 2026-10-18 (amendment C2r §5)

`cold_compare.py` times one comparison from nothing to every tab filled, fabrication included. Each path ran in its own throwaway container from the worker image (10 CPUs, 8 GB), with a Linux `prism-kicad` built in `rust:1.98.0-bookworm`. The input is EDA-04903 at two commits of a scratch repository: a 57 MB KiCad 8 board, with one footprint moved between the two. The worker image predates `jsonschema`, so the run stubs the backend's schema module; nothing it reads or stores is validated, which does not affect the timings.

| | first result | every tab | largest process |
|---|---|---|---|
| today's path | 28.1 s | 62.6 s | 1,703 MB |
| bundle path, before the speed-ups | 145.3 s | 209.3 s | 1,967 MB |
| bundle path, now | 50.9 s | 63.3 s | 2,691 MB |

What the bundle path does cold, and what changed:
- **KiCad upgrade.** Every file of a KiCad 8 design is upgraded first (cli-spec.md §9.4), which today's path never does. Each file is now upgraded on its own copy, eight at a time, and a file both revisions share is upgraded once. Before: 29.9 s per revision, one revision after the other (52.5 s + 55.2 s). Now: 18.8 s for both revisions together. The upgraded bytes are identical to the old one-at-a-time procedure on EDA-04903 (43 files) and cynthion's KiCad 7 commit (18 files).
- **`compare` from two source trees.** 32.1 s, 2.7 GB. It parses the two revisions one after the other. Parsing them at once took 23.5 s but 3.6 GB, close to its 4 GiB heap cap, so it was not kept.
- **Fabrication.** Each revision's Gerbers are now plotted in parallel, while `compare` runs (34.2 s each, alongside), followed by the image diff (12.4 s). Before, the plots ran one after the other once `compare` had returned. Plotting after `compare` instead gives the first result 8 s sooner but every tab 10 s later.

When both commits already have bundles, `compare` reads them instead (bundle mode): 2.9–3.5 s in the same container. That is the path a comparison takes once K2's warm bundles exist. Cold, the first result stays slower than today's, because of the upgrade and the two full parses.

### The same comparison on the upgraded design

To separate the upgrade from everything else, the same edit was repeated on a copy of EDA-04903 already saved by KiCad 10, so neither revision needs upgrading. Runs alternate between the paths and follow each other in the same container, so the machine's load is shared between them.

| | first result | every tab | largest process |
|---|---|---|---|
| today's path | 23.1 s, 25.0 s | 61.3 s, 60.6 s | 1.7 GB |
| bundle path (revisions in turn, Gerbers alongside `compare`) | 26.7 s, 32.0 s | 40.2 s, 42.9 s | 2.2–2.4 GB |
| bundle path, revisions read at once, Gerbers after `compare` | 28.5 s, 25.3 s | 62.5 s, 57.9 s | 3.7 GB |

Without the upgrade, the first result is within a few seconds of today's, and every tab arrives about 20 s sooner. Reading both revisions at once saves little here and costs 1.4 GB, so the kept order is the first bundle-path row.

### Source-tree `compare` without the JSON round trip

In source-tree mode, `compare` used to write each revision's semantic index and board objects out as JSON and parse them back. It now takes the typed documents straight from the parse. Outputs are byte-identical: the 18 recorded pairs, EDA-04903, and the generator pin.

| | `compare`, source-tree mode | peak memory |
|---|---|---|
| Mac, three alternated runs, before | 9.06–10.08 s | 1,988–2,233 MB |
| Mac, after | 8.23–8.71 s | 2,224–2,479 MB |
| container, upgraded EDA-04903, two alternated rounds, before | 30.6 s, 26.4 s | 1,889 MB, 1,919 MB |
| container, after | 31.4 s, 24.2 s | 2,021 MB, 2,177 MB |

On the Mac it is about 9% faster. In the container, where the Gerber plots run at the same time, the difference is within run-to-run noise. Either way it costs 130–260 MB of peak memory, because both revisions' documents are held until the comparison runs.

## 3D journeys, mesh path vs analytic path: 2026-10-18 (amendment V2, V2a step 1)

`results/2026-10-18-v2a-3d-journeys.json` records how today's 3D tab (the Python topology compiler's mesh bundle) and the analytic path (the bundle's `materialization/board.kmpack`, drawn by the spike's analytic renderer) compare. The boards are EDA-04903 (KiCad 8, commit `01a56c3`) and USB-PD-Trigger-Board.

The measurement has two halves (amendment V2 §6, Q4):
- **Backend, cold:** a throwaway container from the worker image (10 CPUs, 8 GB cap, which is all of Docker's 8.3 GB VM here). `v2a_mesh_build.py` runs the `webgpu_3d` job's build with the image's own code. `v2a_bundle_build.py` runs the bundle's three stages with the feature branch's backend and a Linux `prism-kicad`, as `design_bundle/jobs.py` does.
- **Browser, warm:** headless Chrome on this Mac (Apple silicon, 10 CPUs, 16 GB), assets on a loopback server, cache off, five loads each. The mesh path uses the pixel-diff harness's new `--load` option. The analytic path uses `v2a_analytic_load.mjs` over the spike branch's viewer.

### Cold: building the 3D assets for one commit

| | EDA-04903 | USB-PD-Trigger-Board |
|---|---|---|
| Mesh path, container | killed at the 8 GB cap | 3.7 s (board 2.4 s, parts 3.3 s); 0.3 GB |
| Mesh path, this Mac (no cap) | 113.3 s; parts at 18.3 s, board only at the end; 2.1 GB | — |
| Bundle stages, container | 134.6 s; board ready at 118.6 s; 2.2 GB | 3.3 s; board ready at 1.7 s; 0.25 GB |

EDA-04903's bundle breaks down as: materialize and upgrade 13.8 s, stage `parse` 15.7 s, zone refill 76.3 s, materializer 12.7 s, `kicad-cli` GLB 13.0 s, stage `models` 16.0 s in all. The refill is most of it. K2's prebuild pays this once per design change, before anyone opens the tab.

### Warm: what the browser downloads and when the board appears

| | EDA-04903 | USB-PD-Trigger-Board |
|---|---|---|
| Mesh path, bytes | 39.0 MB (58 MB bundle, 61 files; tiles stream by view) | 2.7 MB |
| Mesh path, `ready` (board drawn) | 456–550 ms | 102–157 ms |
| Mesh path, parts loaded | 499–592 ms | 91–164 ms |
| Mesh path, picture final | 850–971 ms | 219–261 ms |
| Analytic path, pack bytes | 27.8 MB | 0.18 MB |
| Analytic path, pack fetch + `loadAnalyticPack` + first frame | 2,838–3,231 ms | 131–144 ms |
| of which: open | 161–192 ms | 12–23 ms |
| of which: lowering (WASM) | 2,125–2,192 ms, on the main thread | 20–33 ms |

- EDA-04903's 3D models do not resolve in this setup (its component GLB is 376 bytes on both paths), so parts are timed on USB-PD only. Both paths draw the same `kicad-cli` GLB.
- The spike draws the analytic board after mounting a mesh bundle, so its numbers are the extra time to put the pack on screen. With no mesh to load first, V2a's tab costs the element's boot plus these numbers.
- The spike's lowering ran on the main thread: its worker fell back (`lowerIn: main`). Lowering is per slice and independent, so a worker pool, or lowering the outer copper and mask first, cuts the time to the first board frame. Caching lowered slices by bundle key cuts it on every later open.

### Readings for the budgets

- Warm, the analytic path is slower than the mesh path on a large board today: about 2.9 s against about 0.5 s on EDA-04903. Lowering is the gap; download and open are not.
- Cold, the analytic path builds where the mesh path cannot: EDA-04903's mesh build does not fit in the 8 GB box, and the bundle's stages peak at 2.2 GB.

## Full comparison: 2026-10-22, after Wave 4

`bench_native.py` times the native side on the same 33 parity cases and sets it against the 2026-10-17 baseline. Results: `results/2026-10-22-ithelpdesk-macbook-pro-arm64-native.json`.
- **Machine:** the same machine as the baseline. The release `prism-kicad` was built from `feature/native-design-bundle` at 10785dfd (Wave 4 merged).
- **Sources:** prepared by `prism_parity` exactly as the baseline's were.
- **Load:** 3.7 at the start and 5.1 at the end, with desktop apps and a VM running. As with the baseline, treat differences under about 10 % as noise.

```sh
python native/parity/benchmarks/bench_native.py --prism-kicad <release binary> \
    --baseline native/parity/benchmarks/results/2026-10-17-ithelpdesk-macbook-pro-arm64.json \
    --out native/parity/benchmarks/results/<yyyy-mm-dd>-<host>-native.json
```

### Producing the data

How the comparison is made:
- **Native side:** one `prism-kicad bundle build --stage parse`. Each build is a fresh process, start-up included, and produces every parse-stage member: semantic index, system interface, project, stackup, placements, occurrences, board objects and route metrics.
- **Python side:** the three production paths it replaces: semantic index, system interface and variant catalog. Each was timed best of 3 after a cold first call in a warm interpreter.

Best of 3, summed over the cases:

| | all 33 cases (s) | rs-cynthion (s) | rs-usb-pd (s) | max peak RSS (MiB) |
|---|---|---|---|---|
| native parse stage, every member | **1.93** | **0.69** | **0.15** | **306** |
| Python `prod:*` (semantic index + system interface + variant catalog) | 9.58 | 7.39 | 0.54 | 496 |
| Python `golden:*` capture modules, every member | 106.6 | 67.6 | 6.0 | 496 |

- **rs-cynthion**, the stress case, is 11× faster than the production paths and uses 39 % less memory.
- **Faster on 23 of 33 cases.** The other 10 are the smallest fixtures (the `dv-*` designs and three tiny System Builder boards). There, a fresh process costs 20–35 ms, while the Python paths ran warm in-process at 2–34 ms. The deployed path runs the build in a job, never on a request, so this is not something a user waits on.

### What an endpoint does now

The endpoints that parsed on demand now read a member of a warm bundle: semantic index, system interface, and the variant catalog (which is part of the semantic index). Each read opens the verified archive, inflates the member, checks its SHA-256 and decodes the JSON. HTTP, authentication and the database lookup that finds the archive are not included.

Before an archive is readable, the bundle job runs `prism-kicad bundle verify` once and marks it verified (`jobs.py`). So the time from building to readable is build plus verify.

| | read `semantic-index` (ms) | read `system-interface` (ms) | `bundle verify` (s, peak MiB) | before: Python build on request (s) |
|---|---|---|---|---|
| rs-cynthion | 41.9 (2.5 MB) | 24.6 (0.6 MB) | 0.72, 92 | 3.78 / 3.59 |
| rs-usb-pd | 6.2 | 5.0 | 0.09, 21 | 0.29 / 0.24 |
| all 33 cases | — | — | 1.67 in total | — |

Verifying takes about as long as building: 1.67 s against 1.88 s over all cases.

## EDA-04903: 2026-10-22

EDA-04903 is CERN's WREN-V main board: a 57 MB KiCad board and 44 schematic sheets saved by KiCad 8.99. Its sources came from the `sources/` of an earlier scratch bundle. They were upgraded to 10.0.6 by `prism_parity` exactly as the fixtures were; the upgrade is untimed here, and was 61 s file by file. The setup:
- Both sides ran on the same machine and the same upgraded sources, best of 3.
- The Python side ran `bench_python.py --child` at the baseline's commit (aa6c8e3b, kicad-monkey 2026.9.7).
- Results: `results/2026-10-22-ithelpdesk-macbook-pro-arm64-eda-04903.json`.
- Load was 10.1 at the start of the Python run and 5.0–5.9 for the native one.

```sh
python native/parity/benchmarks/bench_native.py --prism-kicad <release binary> \
    --extra-src <dir with the sources> --extra-project EDA-04903-V1-0.kicad_pro --extra-id eda-04903 --out <file>
# Python side, from a checkout of the baseline commit:
python native/parity/benchmarks/bench_python.py --today . --out /dev/null --repeat 3 \
    --child prod:semantic-index '{"id":"eda-04903","src":"<prepared src>","project":"EDA-04903-V1-0.kicad_pro","work":"<scratch>"}'
```

| | best (s) | peak RSS |
|---|---|---|
| `prod:semantic-index` | 43.1 | 2.53 GiB |
| `prod:system-interface` | 41.4 | 2.60 GiB |
| `prod:variant-catalog` | 0.22 | 474 MiB |
| `prod:km-load` (kicad_monkey's load alone) | 39.5 | 2.60 GiB |
| **Python production paths, summed** | **84.7** | **2.60 GiB** |
| `prism-kicad bundle build --stage parse`, every member | **5.32** | **1.76 GiB** |
| `prism-kicad bundle verify` | 4.98 | 0.71 GiB |
| read `semantic-index` (19 MB) from the verified bundle | 0.23 | — |
| read `system-interface` (2.7 MB) | 0.07 | — |

- **Production paths: 84.7 s and 2.6 GB, against 5.3 s and 1.8 GB native.** The production paths are the semantic index, system interface and variant catalog. Native is 16× faster on the parse alone, and about 8× faster counting the verify the job runs before the bundle is readable (10.3 s).
- **On request:** opening the semantic index used to cost 43 s on a cold cache, and the system interface 41 s. Both are now read from a warm bundle in 0.07–0.23 s.
- **Budgets (amendment U §3.2):**
  - **Parse time** is within its 10 s budget (5.3 s).
  - **Parse memory is over:** the peak was 1.76 GiB, against a 1.5 GB budget. The budget is measured in the worker container on Linux, while this figure is macOS RSS, so confirm it in the container before acting on it.
- **`bundle verify` costs as much as the build** (5.0 s against 5.3 s). It runs before anything can read the bundle (on every stage publish, see below), so it doubles the time from push to warm bundle. If that wait matters, verify is the next thing to make faster.

### In the worker container, and a faster verify (2026-10-22, later)

Measured in throwaway containers of the worker image (`egse-prism-prism-worker`, Debian, glibc 2.41, arm64 under Docker on the same Mac, 10 CPUs), with a Linux `prism-kicad` built from this branch in `rust:1.98.0-bookworm`. The sources were copied into the container first, and the peak is the process's own `VmHWM`. Five runs each:

| | before | after this pass |
|---|---|---|
| `bundle build --stage parse`, peak | 2.09–2.15 GiB | 1.98–2.07 GiB |
| `bundle build --stage parse`, wall | 13.5–23.6 s | 12.7–20.6 s |
| `bundle verify` (macOS, warm) | 5.3 s, 0.67 GB | 2.2 s, 0.70–0.77 GB |
| `bundle verify` (container) | — | 2.8 s |

- **Verify:** 94% of its time was the schema validator, mostly allocating. The pointer into the instance is now only written out on a failure. A failed branch of a choice builds no message. `$ref` resolution allocates nothing. `regex` gets its own faster engines (its `perf` feature). The job verifies on every stage publish (`jobs.py`, a new manifest each time), so a full EDA-04903 bundle saves about 9 s.
- **Parse memory:** the producers now write their members as they finish, instead of holding every projection's tree (most of them also as a `serde_json::Value` copy) until all eight are done. Archives are byte-identical.
- **Both parse budgets are missed in the container, and the miss is accepted for now (2026-10-22).** Two causes:
  - **The parse inputs:** most of the remaining peak is the board's decode cache that the producers share (about 450 MB) and the semantic index's inputs.
  - **glibc's allocator:** the same parse spends 8–12 s in the kernel on Linux, against about 1 s on macOS. `MALLOC_ARENA_MAX` and `GLIBC_TUNABLES` (mmap/trim thresholds, `arena_max=4`) recovered some time (10.2–10.8 s at best) but no memory.
- **Not tried:** a different global allocator (mimalloc/jemalloc, a new dependency), a slimmer decode cache, or a measurement on the production host.

### Large designs and Design Comparison

The U §3.2 journey budgets for Design Comparison on EDA-04903 are measured in the worker container; see "Cold Design Comparison" above. Bundle-mode `compare` (both revisions warm) takes 2.9–3.5 s there.
