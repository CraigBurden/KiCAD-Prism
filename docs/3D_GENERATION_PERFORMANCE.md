# 3D generation performance: fresh JTYU-OBC investigation

Date: 2026-07-16

## Outcome

The first reproducible cold compiler baseline was **117.38 seconds**. Low-risk
changes reduced it to **67.42 seconds** while preserving the generated semantic
geometry. Starting both KiCad exports at job start and overlapping them with
topology/semantic work reduced the complete compiler path again to **47.46
seconds**, a **59.6% reduction** from the original baseline.

The shortest credible route to a board visible in under 15 seconds is a
progressive bundle contract. That contract is now implemented and benchmarked
through the backend service. Two cold runs published `board-ready` at
**11.12-12.47 seconds**, `components-ready` at **22.33-25.14 seconds**, and
`semantic-ready` at **43.80-50.69 seconds**. The board-only bundle produced a
real WebGPU frame in **223 milliseconds**, making the measured cold
board-visible path **11.34-12.69 seconds** before the frontend's polling delay.

If the 15-second target instead means that the board, all component models, all
semantic copper geometry, and all selection metadata must be complete, the
current KiCad component exporter alone takes about 19-23 seconds. Meeting that
definition requires replacing or deeply changing that exporter, not just
changing Prism's orchestration.

## Benchmark method

- Project: JTYU-OBC, `OBC.kicad_pro`
- PCB source: 41.08 MB
- Host: Apple arm64, 10 logical CPUs
- KiCad CLI: 10.0.4
- Python: 3.14.2
- Node: 24.10.0
- Every cold compiler run used a new output directory and new cache directory,
  `--force-rebuild`, and `--clean-cache`.
- CPU-heavy configurations were run sequentially to avoid benchmark
  interference.
- Tile-size and worker-count results are single-trial directional measurements;
  they should be repeated before choosing production defaults across projects.

The application wrapper adds about 0.20 seconds for source fingerprinting and
0.55 seconds for dependency preflight on this machine. Those are not material
to the current critical path.

## Cold pipeline, stage by stage

| Stage | Original cold | Best low-risk cold | Exact work | Main conclusion |
| --- | ---: | ---: | --- | --- |
| Load KiCad project/design | 7.09 s | 7.30 s | Read project and schematic hierarchy; create lazy design aggregate | Still required for topology; not the largest remaining cost |
| Topology input JSON | 24.88 s | 0.53 s | Previously called generic `design.to_json()`, which also forced unused PnP/PCB data; now uses netlist-only JSON | Removed redundant PCB materialization from the topology path |
| Board parse and topology indexes | 24.18 s | 22.94 s | Force the complete kicad-monkey PCB object model, then derive the compact topology contract | Dominated by a roughly 23 s pure-Python PCB parse; indexes are now derived from the shared IR |
| Topology model | about 0.1 s | about 0.1 s | Stable IDs, components, nets, terminal links, indexes | Already inexpensive |
| KiCad GLB exports | 32.75 s | 23.41 s | Export board/mask/silkscreen GLB and component-only GLB, then inspect component nodes | Two processes can run concurrently; component export remains the floor |
| Semantic scene | 27.93 s | 13.11 s | PCB IR, semantic object expansion, JSON interchange, tile assignment/clipping, triangulation, meshopt, GLB writes | Larger tiles and one fewer JSON write help; the 120 MB interchange remains wasteful |
| Final compiler writes | 0.30 s | 0.04 s | Write topology/semantic metadata and artifact inventory | Redundant standalone `viewer.html` removed for 3D-only scope |
| **Compiler total** | **117.38 s** | **67.42 s** | Complete cold 3D artifact set | **49.96 s saved by low-risk changes** |

The later overlapped compiler run completed in **47.46 seconds**. Its two KiCad
exports ran from job start while topology and PCB work proceeded independently.
The application-level staged run was slightly slower at 50.76 seconds total
because it included service publication and experienced normal CPU contention.

### What “load PCB” actually does

The expensive kicad-monkey PCB materialization parses the complete 41 MB
S-expression and hydrates domain objects for, among other data:

- 982 footprints and 4,118 pads;
- 13,559 segments and 1,374 track arcs;
- 1,941 vias and 154 filled zones;
- board graphics, dimensions, layers, setup, nets, properties, and stackup;
- net references and parent/child relationships.

Prism subsequently converts those objects to a PCB IR containing 18,747
records, then expands the relevant geometry to 49,762 semantic objects, 20,920
object features, and 1,974 barrels.

The original code also parsed the entire board a second time solely to locate
the `(stackup ...)` form. Selecting that balanced form directly reduces that
step from about 22.4 seconds to 28-59 milliseconds.

### KiCad-owned GLB exports

Sequential measurements:

- board context, without components: about 10.0-10.4 seconds;
- components, without the board body: about 20.9-21.4 seconds;
- combined sequential wall time: about 31.3-32.8 seconds.

Two guarded parallel trials completed in 22.14 and 21.90 seconds. A full
instrumented compiler run completed the parallel export stage in 23.41 seconds.
Both processes returned success and the component GLB contained 1,017 component
nodes. KiCad GLB byte output is slightly nondeterministic between invocations,
including sequential invocations; semantic tile output is deterministic.

Parallel export is now the default, with `PRISM_KICAD_EXPORT_PARALLEL=0` as an
operational escape hatch. It should still be exercised across more KiCad
projects and operating systems before that escape hatch is removed.

## Redundant processing and duplicated information

### Removed or reduced

1. **Generic design JSON for topology.** It included PnP/PCB work that the
   topology compiler did not consume. Netlist-only JSON produces the required
   components and nets in about 0.5 seconds.
2. **Second full PCB parse for stackup.** A balanced S-expression selector now
   reads only the stackup form.
3. **Two complete writes of the 120 MB semantic input.** The payload is now
   built in memory and serialized once to its cache path. This reduced semantic
   input collection by roughly 2.3 seconds.
4. **Standalone viewer HTML in API bundles.** The frontend loads the bundled
   custom element; the 835 KB standalone HTML copy was unused in 3D-only scope.
5. **Thousands of glTF transform log lines.** Library logging is now suppressed
   below errors. The backend previously persisted every one of these lines.
6. **Duplicate viewer bootstrap fetches.** Custom-element connection and
   attribute callbacks could start two reloads for the same bundle URL, fetching
   the bundle, topology, and semantic metadata twice. Reload coalescing now
   issues one request for each artifact.

### Still present

1. **The same PCB source is parsed three ways.** kicad-monkey parses it once;
   each of the two KiCad CLI exporters parses it again. Prism also reads it for
   a SHA-256, although that read costs only about 20 ms.
2. **The semantic handoff is 120.47 MB of JSON.** It is serialized by Python,
   parsed by Node, and transformed into a compact native clipping request. At
   20 mm tiles, the native request is about 16.3 MB and its response about
   16.6 MB, demonstrating how much of the JSON size is textual representation.
3. **Preclipped geometry is serialized again.** The native response is written
   as a roughly 23 MB JSON artifact for the Node worker.
4. **Components, nets, layers, feature IDs, and bounds occur in multiple
   artifacts.** `topology.json` is about 5.4 MB; the 20 mm scene manifest is
   about 7.0 MB and repeats renderer-facing subsets; `semantic_geometry.json`
   repeats component-node/asset metadata.
5. **Artifact publication copies the completed tree.** This is small compared
   with parsing/export today, but a progressive contract should publish files
   atomically by phase instead of copying an entire completed tree before the
   first frame can begin.

There were no byte-identical duplicate files in the artifact inventory. The
duplication is semantic data repeated in different schemas, not duplicate file
blobs.

## Tile-size results

JTYU-OBC's semantic bounds are about 131 x 89 mm across 12 copper layers.

| Tile size | Tile GLBs | Tile bytes | Native clip + Node pack |
| ---: | ---: | ---: | ---: |
| 20 mm | 503 | 14.90 MB | 14.72 s |
| 40 mm | 144 | 13.28 MB | 7.63 s |
| 80 mm | 48 | 12.72 MB | 6.44 s |
| 160 mm | 12 | 12.18 MB | 2.78 s |

At 160 mm every polygon stays within one tile and no boolean clipping jobs are
needed. The existing JS/native parity gate passed, and the full cold run
generated 3,060,381 vertices and 3,008,233 triangles in both verified paths.

Twenty millimetres should not remain a universal default. For JTYU-OBC, one
tile per copper layer is both faster to generate and smaller to transfer. The
production policy should be board-size adaptive and should cap per-tile byte
size/triangle count for large boards rather than fix physical tile width at 20
mm. Browser residency and interaction benchmarks across small and large boards
are still required before setting that policy as the default.

## Parallelism results

### Node tile workers

For the same 160 mm, 12-tile scene:

| Workers | Node total |
| ---: | ---: |
| 1 | 5.14 s |
| 2 | 3.30 s |
| 4 | 2.11 s |
| 6 | **1.91 s** |
| 8 | 2.20 s |

Six workers is already the best measured choice on this host. More worker
threads add overhead.

### Processes that can overlap

- board-only and component-only KiCad exports can overlap behind a guarded
  feature flag;
- both KiCad exports can start before topology/PCB parsing because their command
  inputs do not depend on the compiled topology;
- after PCB metadata is available, semantic tile construction can overlap
  the tail of the component export;
- frontend loading can begin when the board GLB is published and need not wait
  for components or semantic tiles.

The compiler and backend now implement these overlaps and publish atomic
`board-ready`, `components-ready`, and `semantic-ready` bundle revisions.

Prism now has one cached board-compilation product. The first consumer triggers
one `KiCadPcb` parse, one PCB IR construction, and one IR materialization. Board
topology indexes and pad-hole records are derived from that IR instead of
walking all footprints again. The result is shared by topology compilation and
semantic GLTF generation. The former projection/full runtime distinction and
its environment switch have been removed.

The unified IR-derived indexes contain 4,118 terminal-pad links and 45 drilled
pads for JTYU-OBC. Hole-only pads are indexed from `pad_hole` blocks even when
the IR intentionally has no copper pad body. Collection statistics come from
IR record counts. Only small direct board reads remain for stackup/header data
and the Edge.Cuts bounding box.

### JTYU-OBC cold Docker benchmark (2026-07-16)

Each end-to-end sample ran in a new container with a separate empty Prism store
and semantic cache, the same read-only JTYU-OBC checkout, forced rebuilds, six
semantic workers, medium meshopt, and adaptive 160 mm tiling. The host was Apple
Silicon and the KiCad x86-64 image ran under emulation. The baseline is the
single-parse implementation immediately before the unified refactor.

| Milestone | Baseline | Unified sample 1 | Unified sample 2 |
| --- | ---: | ---: | ---: |
| Board ready | 17.12 s | 20.53 s | 16.92 s |
| Components ready | 31.94 s | 34.85 s | 33.20 s |
| Semantic ready | 104.48 s | 112.70 s | 109.72 s |
| Staged build total | 104.62 s | 112.88 s | 109.86 s |

The cold end-to-end samples do not show a speedup. They show substantial
emulated parse/export variance: unified board compilation varied from 58.54 to
60.15 seconds, while independent KiCad exports varied from 30.92 to 32.33
seconds. Both unified totals were 5.24-8.26 seconds slower than the one baseline
sample, so this refactor must not be presented as the solution to cold-start
latency.

An additional Docker microbenchmark removed KiCad exports and compared both
product-building strategies against the same already-parsed board:

| Same-parse board work | Legacy products | Unified products |
| --- | ---: | ---: |
| Metadata/index traversal | 0.457 s | 0.125 s |
| Pad-hole traversal | 0.003 s | included above |
| PCB IR construction | 2.616 s | 2.616 s |
| PCB IR materialization | 3.001 s | 3.001 s |
| **Post-parse total** | **6.077 s** | **5.743 s** |

The unified pass therefore saves 0.334 seconds, or 5.5% of post-parse product
work. Including the measured 46.08-second PCB parse, the improvement is only
about 0.6%. Its primary value is removing redundant representations and making
future parser/IR optimization possible through one boundary.

Parity checks found byte-identical `topology.json` and all 12 semantic GLB
tiles. In-process checks also found exact board/stackup, statistics,
terminal-pad-link, pad-hole, and compiled-topology equality.

## kicad-monkey

The newer local kicad-monkey tree already contains `KiCadPcbProjection`. A
fresh JTYU measurement showed two generic hot-path problems: net lookup maps
were rebuilt for every net-bound object, and nested source locations rescanned
the source prefix for every object. Behavior-preserving caches and constant-time
relative line/column rebasing produced these before/after results:

| Projection work | Before | After |
| --- | ---: | ---: |
| Read source/create projection | 0.02 s | 0.02 s |
| First top-level span scan | 8.76 s | 7.52 s |
| Hydrate footprints | 5.58 s | 6.12 s |
| Expose pads/resolve nets | 14.98 s | **2.76 s** |
| Hydrate segments | 1.21 s | 1.14 s |
| Hydrate vias | 0.41 s | 0.25 s |
| Hydrate zones | 13.71 s | 10.33 s |
| **Measured family total** | **44.67 s** | **28.13 s** |

The two changes are library-generic, preserve exact source metadata, and have
focused projection tests. They contain no Prism schemas, flags, imports, or
renderer assumptions, so they can be proposed to Wavenumber rather than
requiring a Prism-maintained fork. Prism's unified production path no longer
depends on projection, but these remain worthwhile improvements for selective
read-only consumers of kicad-monkey.

Useful kicad-monkey changes are therefore:

1. optimize the still-expensive generic top-level span scanner;
2. add an optional compact projection API that emits primitive records directly,
   without hydrating the heavyweight round-trip domain model;
3. move the 41 MB projection scanner and numeric packing loop to Rust/C++ if
   the optimized Python scanner still exceeds a few seconds;
4. preserve the existing full parser for editing/round-trip consumers.

This should be a new explicit API rather than silently changing the semantics
of `KiCadPcb.from_file()`.

## JSON, PostgreSQL, and the renderer contract

PostgreSQL is not a good intermediate for this one-shot, local, bulk geometry
pipeline. It would add row encoding, indexes or table setup, IPC, and query
materialization while the next consumers need contiguous typed arrays. It can
be useful for persistent project search or multi-user metadata, but not as the
hot geometry interchange.

JSON remains useful for small manifests and diagnostics. It is the wrong shape
for millions of coordinates. A better next interchange is a versioned binary
geometry buffer with:

- typed coordinate/index arrays;
- offset tables for objects, rings, and holes;
- compact integer IDs for layers, nets, kinds, and features;
- a small JSON header containing schema/version, bounds, and asset paths.

The existing Clipper2 A2 binary request is a useful starting point. Extending a
similar binary contract through Node would remove most of the 120 MB JSON
serialize/parse cost and the preclipped JSON copy.

The browser should continue receiving meshopt-compressed GLB for mesh data;
that is already binary and GPU-friendly. The large scene manifest should be
split into a small bootstrap manifest plus binary feature/bounds tables. This
improves parse time and memory but is secondary to publishing the base board
early.

## Would another language help?

A rewrite of the application or orchestrator would not address the measured
bottlenecks. Python process overhead is negligible; pure-Python parsing,
object hydration, and JSON encoding are not. Keep Python for orchestration and
move only hot data-plane work to native code:

- canonical PCB parsing and IR construction;
- typed geometry packing;
- optionally direct GLB tile authoring if Node becomes material after the
  earlier costs are removed.

KiCad CLI is already native code. Its component-export time cannot be fixed by
rewriting the Prism backend in Go or Rust.

## Implemented staged architecture

1. Start board-only GLB export, component GLB export, and unified board compilation at the
   beginning of the job.
2. Atomically publish a minimal `board-ready` bundle when `base_board.glb`
   exists.
3. Let the 3D tab create WebGPU and render the base board immediately.
4. Publish `components-ready` and load the component GLB at the next readiness
   revision.
5. Publish `semantic-ready` with topology and semantic tiles; enable layer/net
   interactions at that point.

The current React integration visibly reports stage/progress and remounts the
custom element at each readiness revision. Browser HTTP caching prevents the
large immutable GLBs from becoming a generation bottleneck, but a future
viewer controller API can add components and semantic tables in-place to avoid
any visual remount at the stage boundary.

Measured evidence puts the actual board-visible milestone at 11.34-12.69
seconds on the benchmark host. Full semantic readiness remains 43.8-50.7
seconds and is the next optimization target, not a blocker for entering the 3D
tab.

### Option B: complete bundle before first frame

Keep one atomic readiness state. Pursue a compact kicad-monkey projection,
binary interchange, adaptive tiling, and overlapped exports. This should reduce
the 67-second full bundle substantially, but the measured 19-23 second KiCad
component exporter means the complete cold bundle still cannot reliably meet
15 seconds without a different component-generation strategy.

The product decision is now staged readiness: the base board is visibly
interactive first, with progress shown while components and semantic data are
generated.
