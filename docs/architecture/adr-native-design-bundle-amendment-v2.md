# ADR amendment V2: one analytic 3D path

- **Status:** Accepted (2026-10-18). The decisions in "Decided before this draft" are the maintainer's, and so are the answers to §6: Q1 the alternative below the recommendation (a plain queue), Q2 and Q3 as recommended, Q4 deferred to V2a. The text changes of §9 are applied in the same pull request, except item 3, which waits for V2a's measurements.
- **Revises:** the parent ADR §9.6 rows C4b, C5 and C6, and the 3D half of amendment U §3.2 (budgets for 3D journeys, which U did not set).
- **Parent:** [`adr-native-design-bundle.md`](adr-native-design-bundle.md) §4.4 (staged readiness), §5 (storage), §9.6, §9.7 (R1, R2). It builds on [amendment K2](adr-native-design-bundle-amendment-k2.md) (warm bundles) and [V1](adr-native-design-bundle.md) (the component GLB in stage `models`).
- **Decided before this draft** (maintainer, 2026-10-18):
  1. **One 3D path.** The WebGPU viewer renders the analytic model from the bundle: `materialization/board.kmpack` for the board and `viewer/models/components.glb` for the parts. Every older 3D path is retired, not kept behind a flag.
  2. **No waits.** K2's warm bundles, which the prebuild already keeps for each branch's newest commits and every tagged commit, are what makes 3D instant. No second store is added for 3D.
  3. **System Builder renders analytic boards** from each constituent PCB's bundle, at the revision the system pins. The analytic geometry is used to make board-to-board (B2B) mating and live harness geometry simpler.
  4. **System Builder's harness and B2B mating definition UI is designed anew.** No branch holds a revamp to port.
  5. **Every System Builder operation is scriptable** through one operations API that the UI and an in-page `window.prismSystemBuilder` object both call, as Simulation Studio's setup API and `window.prismSimStudio` do (sim-adr-0017). No MCP server for now.
  6. **Wire-level geometry generation** in the style of Blender's geometry nodes is a research spike after System Builder's migration, not part of it (§5, V2-R).
  7. **Simulation result overlays get optimised** when Simulation Studio lands (§4).
  8. **Order:** C5 → System Builder (C4b, widened) → C6, one work package at a time.

## 1. Context

Prism has one WebGPU renderer: raw WebGPU/WGSL in `kicad-prism-viewer/viewer/src`, built into `frontend/public/prism-semantic-viewer.js` and used as the `<prism-semantic-viewer>` element. Three surfaces use it, each with a different source of geometry.

| Surface | Host | Geometry today (`feature/native-design-bundle`) | On the spike branch (`feature/analytic-pack-spike`) |
|---|---|---|---|
| 3D tab | `frontend/src/components/webgpu-3d-tab.tsx` (board mode) | meshes from the Python topology compiler (`kicad-prism-viewer/pipeline/topology_compiler/`), built by the `webgpu_3d` job (`viewer_3d_jobs.py`, `job_webgpu_ready.py`) and served by `semantic_visualizer_service.py` (1,179 lines) through `api/project_viewer_3d.py`; part bodies from `kicad-cli` GLB | the analytic renderer: `analytic-pack.js` reads `kicad_monkey.materialization.a0`, `analytic-lower-worker.js` lowers slices off the main thread, `analytic-renderer.js` and `analytic-shaders.js` draw copper, mask, silk, dielectric and via barrels with layer toggles |
| System Builder scene | `frontend/src/features/system-builder/scene-3d-tab.tsx` (`mode="system"`) | the same mesh bundles per board, through `systems/bundles.py`; collision bodies parsed from each bundle's GLB into `.npz` caches (`collision_meshes.py`); harness curves solved in Python (`placement/harness_curves.py`) with a TypeScript twin that must agree to 0.01 mm | unchanged |
| Simulation Studio | `frontend/src/components/sim-studio/` | — (not on the integration branch) | overlays on the analytic renderer: `run-overlay.ts` loads field grids and per-operation values, `field-relief.js` raises a voltage relief, arrows show current density |

The bundle already carries what the analytic renderer reads. Stage `board` writes `materialization/board.kmpack` with the same schema id the spike reads (`analytic-pack.js:6`), and stage `models` writes the component GLB (V1). K2b's prebuild runs all three stages, so a warm commit has both.

What is missing is the wiring: the 3D tab still asks the Python pipeline, System Builder still assembles mesh bundles, and Simulation Studio's runs download their own copy of the pack (`run-overlay.ts`: `runPackUrl`, "the run's own materialization").

## 2. Rules

### 2.1 One source of 3D geometry

- **The board** is the bundle's `materialization/board.kmpack`, read by the analytic renderer. Nothing else produces board geometry for display, collision or export.
- **The parts** are the bundle's `viewer/models/components.glb` (V1), keyed by bundle key.
- **The frame** is the materialization's: integer nanometres in KiCad's board frame, Y down, z from the stackup. System Builder's `bundleToBoard` and mid-plane (`systems/bundles.py:mid_plane_from_layers`) are recomputed from the pack's stackup slices, not from a mesh bundle's `layers`.
- **Selection and cross-probe** use operation indices from the pack and nets and references from `projections/semantic-index.json`, as C5's row already says.

### 2.2 Readiness and the cold path

A 3D view asks for its commit's bundle through the design bundle consumer (`design_bundle/consumer.py`):

- **Warm** (the commit is in the prebuild set, or was opened before): the pack and GLB are stored. The viewer fetches the pack, lowers it in its worker and draws. Parts follow when the GLB arrives.
- **Cold** (a commit outside the prebuild set): the consumer queues the build in the ordinary `design_bundle` queue (Q1), and the view shows where it waits and which stage runs. It draws the board as soon as stage `board` publishes (staged readiness, parent §4.4) and the parts after stage `models`. There is no mesh fallback (decision 1) and no separate quick path. A failed `board` stage shows its error and the "Rebuild" action K2b added.

### 2.3 What is retired

Each work package deletes the old path in the pull request that moves its last reader, instead of leaving it to Wave 4. The 3D tab's mesh path is not the tab's alone: System Builder's scene queues the same `webgpu_3d` job, reads mesh bundles through `semantic_visualizer_service.py` and loads them through the tab's asset route. So V2a ends at step 4, with the analytic board as the tab's default and `legacy` still selectable, and the whole mesh path goes when System Builder stops reading it (maintainer, 2026-10-19). That is now [System Builder v2](adr-system-builder-v2.md)'s stage 0, which replaced V2b and deleted every row below:

| Path | Deleted by |
|---|---|
| The 3D tab's mesh path: `webgpu_3d` job kind (`viewer_3d_jobs.py`, `job_webgpu_ready.py`), `api/project_viewer_3d.py`'s mesh routes, the mesh half of `semantic_visualizer_service.py`, `semantic_viewer_runtime.py` | System Builder v2, stage 0 (shared with System Builder's scene) |
| `PRISM_DESIGN_SOURCE_VIEWER_3D` (one value left) | System Builder v2, stage 0 |
| System Builder's mesh bundles: `systems/bundles.py`'s wrapper of the single-board pipeline, `collision_meshes.py`'s `.npz` path over mesh-bundle GLBs | System Builder v2, stage 0 |
| The topology compiler (`kicad-prism-viewer/pipeline/topology_compiler/`, its tests and benchmarks) and the viewer's mesh loader | System Builder v2, stage 0 |
| `PRISM_DESIGN_SOURCE_SYSTEM_BUILDER` (both halves) | System Builder v2, stage 0 |

R2's row for "`kicad-prism-viewer/` 3D pieces" shrinks to whatever stage 0 left: the viewer's schematic and BOM workspaces, which only the standalone mesh page enabled.

## 3. System Builder

**Superseded by [System Builder v2](adr-system-builder-v2.md)**, which replaced work package V2b (2026-10-19). This section is kept as the record of the analysis that led there.

### 3.1 Analytic boards

- Each instance's board is the pack of the bundle at the instance's pinned commit. Pinned commits are already kept by retention (`rows.pinned_commits`, `system_instances.baseline_commit`), and the prebuild can add them to its set, so an open system is warm.
- The viewer draws several packs at once, each under the instance's pose. Memory follows SB2's invariants: one lowered pack per bundle key, shared by every instance of the same board.
- **Collision bodies:** the board slab is the pack's outline extruded through its stackup; part bodies come from the bundle's GLB, cached by bundle key (a bundle never changes). Modules and catalog parts keep their catalog GLBs.

### 3.2 B2B mating

Mating today solves poses in Python (`placement/mate.py`, `placement/solve.py`) from the interface's port frames. With the pack:
- a connector's mating frame comes from its footprint's pads and courtyard in the pack, not from mesh bounds, so pin-1 orientation and stacking height are exact;
- the solve stays in the backend, where the operations API (§3.4) runs it, and the viewer previews it live from the same inputs.

### 3.3 Harness geometry

- Curves stay centripetal Catmull–Rom through control polygons (`harness_curves.py` and its TypeScript twin). The viewer evaluates them on every edit, so dragging a node redraws in the same frame; the backend checks bend radius and length when the operation is applied.
- End positions come from the pack: a harness end on a connector takes the connector's pad frame, so ends follow a board when its pose or revision changes.

### 3.4 Operations API and scripting

- **One vocabulary.** Every change to a system is an operation: add or remove an instance, set a pose, mate two ports, add a harness, move a node, assign a wire, waive a finding, and so on. `prism.system.ops.a0` types them. Today's ~60 mutation routes in `api/systems*.py` each map to one operation.
- **One endpoint.** `POST /api/systems/{id}/ops` takes a list of operations with the system's ETag, and either previews them (`dry_run`) or applies them atomically. Its result reports what changed, the new ETag and the findings. The existing routes become thin callers of the same service, and are removed once the UI calls `ops`.
- **The in-page object.** The System Builder page installs `window.prismSystemBuilder`, with `ops.preview`, `ops.apply`, `state()` and `findings()` over the signed-in session, as `window.prismSimStudio` does for setups. Agents use it to build and change systems while testing.
- **The UI is a client.** Every button, drag and dialog emits operations, so anything a user does is something a script can do.

### 3.5 Harness and mating UI

Designed anew (decision 4), as the first step of V2b and before its code:
- mockups for review: defining a harness (ends, wires, nodes, bundling), defining a mate (pick two ports, preview, accept), and editing either in the 3D scene;
- the flows are built from operations (§3.4), so each screen also defines the operations it needs.

## 4. Simulation Studio overlays

C6 ports Simulation Studio from the spike branch. Its overlays are optimised as part of the port:

| Today (spike, `frontend/src/components/sim-studio/run-overlay.ts`) | Change |
|---|---|
| Each run serves its own copy of the pack (`runPackUrl`) | A run records the bundle key it ran on (parent C6 row: "runs hard-link the bundle by key"). The viewer reuses the pack it already lowered for that key, so opening a result downloads no geometry |
| A field grid is a JSON document plus one binary per slice; nothing is cached, so switching quantity, net or arrows fetches them again | One binary result file per quantity, every slice with a small header; fetched once per run and quantity and kept for the session |
| The colour range sorts every cell value on the main thread (`clippedRange`) | The engine writes the range and the 99.5th percentile into the result; the browser does no sort |
| Per-operation values become an object keyed by index, then a dense array (`operationOverlay`, `denseOperationValues`) | A `Float32Array` indexed by operation, uploaded as-is |
| `Math.min(...values)` over every value | gone with the range above (it overflows the stack on large results) |
| Cell counts by `filter(Number.isFinite)` per slice | in the result header |

Acceptance for the overlays is in §7.

## 5. Research spike V2-R: wire geometry nodes

After V2b merges, a spike studies generating each wire's geometry from a node graph, as Blender's geometry nodes do: wires as instances along the harness curves, bundling, twist, breakouts and clamps as nodes, evaluated live in the viewer. It reports what a node graph gives over today's curves, where it would run (WASM in the viewer, the backend, or both from one Rust crate), and the cost. Nothing is built for production until the maintainer decides on the report.

## 6. Open questions

**Q1. The cold 3D path.** A commit outside the prebuild set has no pack. *Decided: the build enters the ordinary queue; no priority and no prebuild action (§2.2).*
- *Recommended:* queue its build at the front of the slot and show the stage being waited for, with the board drawn when stage `board` publishes (§2.2). Add a "Prebuild this commit" action where a user picks a commit, so the build starts before the 3D tab opens.
- *Alternative:* a source-tree mode for stage `board`, as `compare` has for `parse`. The materializer and the zone refill are the slow part of stage `board`, so this saves little and adds a second path.

**Q2. Harness geometry: one implementation.** Curves exist twice today, in Python and TypeScript, kept equal by a tolerance test. *Decided: as recommended.*
- *Recommended:* keep the two for V2b, and let V2-R decide whether one Rust crate (WASM in the viewer, `prism-kicad` in the backend) replaces both.
- *Alternative:* write the Rust crate in V2b. That moves V2-R's question into the migration.

**Q3. The operations API and today's routes.** *Decided: as recommended.*
- *Recommended:* the routes call the same service as `ops` during V2b and are removed in V2b's last pull request, once the UI calls `ops` only.
- *Alternative:* keep the routes as a public API beside `ops`. Two ways to change a system have to stay equal.

**Q4. 3D budgets** (§7). U set none for 3D. *Decided: V2a measures today's journeys and proposes the budgets; the maintainer sets them before V2a merges. §7's table is the starting proposal.* The maintainer accepted §7's proposed budgets on 2026-10-18.
- *Recommended:* the values in §7, measured on EDA-04903 and on one System Builder system, in the worker-image container as U §3.2.
- *Alternative:* set them after V2a measures today's numbers.

## 7. Acceptance and budgets

V2a step 1 measured the 3D tab's journeys on today's mesh path and on the analytic path (`native/parity/benchmarks/README.md`, "3D journeys"). The budgets below were proposed from those numbers and accepted by the maintainer on 2026-10-18 (Q4); V2a step 2's column is the analytic path after the viewer port. System Builder's and Simulation Studio's journeys are measured the same way in V2b and V2c.

| Journey | Today, mesh path | Analytic path, spike as is | Analytic path, V2a step 2 | Budget |
|---|---|---|---|---|
| 3D tab, warm commit: board shown whole, every layer and the parts (EDA-04903) | first board frame 0.46–0.55 s, parts after | 2.8–3.2 s (lowering 2.1 s on the main thread) | 1.38–1.72 s | ≤ 1.5 s |
| 3D tab, warm commit, opened again (same bundle) | as above | as above | 0.58–0.72 s | ≤ 0.5 s (lowered slices cached by bundle key) |
| 3D tab, warm commit: board shown whole (USB-PD-Trigger-Board) | 0.09–0.16 s to the parts | same GLB | 0.10–0.14 s; opened again 0.06–0.13 s | within the rows above |
| Bytes before the board shows (EDA-04903) | 39 MB | 27.8 MB | measured in step 3 | no more than today's |
| Cold commit: board shown (EDA-04903, KiCad 8, container) | does not build in 8 GB (113 s and 2.1 GB on the Mac) | stage `board` done at 118.6 s, 2.2 GB peak | measured in step 3 | ≤ 120 s and ≤ 3 GB; the zone refill (76 s) is the cost to cut if this is lowered |
| System Builder scene, warm system of five boards: every board drawn | measured in V2b | | | ≤ 3 s (to confirm in V2b) |
| 3D tab, inspecting (EDA-04903): GPU time per frame orbiting, 2× pixels, in every view (assembled, substrate hidden, separated, exploded) | assembled 4.4–6.5 ms; exploded about 300 ms (latency, not GPU time) | | p50 5.8–16.0 ms, p95 7.4–17.5 ms (V2a GPU pull request) | p95 ≤ 16.7 ms (one 60 Hz frame) |
| System Builder scene, five boards, exploded: GPU time per frame orbiting, 2× pixels | measured in V2b | | | p95 ≤ 16.7 ms |
| Harness node drag: curve and tube redrawn | measured in V2b | | | same frame (≤ 16 ms) |
| Simulation result, run on a warm bundle: first overlay frame | measured in V2c | | | ≤ 1 s; no geometry downloaded |

Browser times are headless Chrome on an Apple-silicon Mac (10 CPUs) with assets on loopback; backend times are the worker-image container (V2a step 1). To meet the first row, V2a lowers in a pool of workers instead of one (the spike's worker fell back to the main thread).

The inspection rows (maintainer, 2026-10-19) hold a guiding rule: the user never feels an optimisation. Nothing stutters, and nothing pops into view while a board is inspected; the first load may hold the board back until it is whole. GPU time is measured with timestamp queries on every render pass (headless Chrome, M2 Pro). To meet them, V2a draws a separated stack's vias off the lit nets as ghost strips (exact barrels stay for the lit nets and the assembled board), its laminate as plain slabs without drill holes, and scissors each slice's stencil steps to its footprint. 4× MSAA stays: without it silkscreen and part edges alias, fine pitch shows moiré and thin traces break up, for about 3 ms a frame. The V2a GPU pull request leaves p95 0.2–0.8 ms over in three views on a loaded machine (p50 within).

The board shows whole (maintainer, 2026-10-18): the viewer holds the board back until every layer and the parts are drawn, so nothing appears layer by layer and no load work runs while the board is on screen. This replaced a first frame of the outer copper and mask (0.71–1.0 s, budget ≤ 1.0 s), whose later layers popped in and froze the view for up to 0.3 s when they landed; the first two rows were restated for it. Step 2 missed both rows: on a reopen the board's GPU buffers were built on the main thread (296 ms), the pack was opened there (141 ms) and 29 cached slices were read one by one (138 ms). The V2a load pull request meets them: EDA-04903 shows whole in 0.90–1.12 s cold and 0.34–0.46 s opened again (USB-PD-Trigger-Board 0.12–0.14 s and 0.06–0.11 s), pixel-identical. The main thread no longer opens the pack (a worker hosts it for the board's life); the workers prepare what the renderer uploads and store it in the cache themselves; a reopen reads one cached record instead of waiting for a worker; and the WASM parses the pack's header once instead of once per slice (lowering 2.35 s → 0.51 s of CPU), so three workers beat six.

V2a step 4 makes the analytic board the 3D tab's default (`PRISM_DESIGN_SOURCE_VIEWER_3D=bundle`; `legacy` stayed until System Builder v2's stage 0 deleted it with System Builder's mesh path, §2.3), and closes V2a. The tab polls the bundle's status while it builds and offers "Rebuild" when the bundle is invalid. A click resolves through the pack's operation bindings: a pad selects its terminal, a footprint's own graphics its component, any other copper its net, and a click on copper (a pad's or a trace's) probes its net as KiCad colours it, while a part keeps the board in view. Each component is its own feature, so host selections by reference frame and highlight it. The parts' GLB is KiCad's, whose board runs from 0 up to its thickness; the analytic board is centred, so the parts are lowered by half the thickness. The 2D (layer) view draws the analytic copper too, each layer laid flat in its cell of the grid by a shift in its slices' uniforms, in the one pass (EDA-04903, all 12 layers: GPU p50 11.2 ms, p95 12.2 ms at 2×). The host echoes each selection back with fewer fields (a pad as its reference and pin); the viewer ignores the echo of its own last selection, so a pad click keeps its net probe and the camera stays put. Checked in the Visualiser on a fresh instance with USB-PD-Trigger-Board imported from GitHub: opening the tab queued the cold build, the tab showed its progress and drew the board when it was ready, and selections crossed between 3D, Schematic, PCB and search in both directions.

And per work package:
- **V2a (C5):** visual check on EDA-04903, USB-PD-Trigger-Board and one System Builder board; the 3D tab on its default switch starts no `topology_compiler` process and queues no `webgpu_3d` job; selection and cross-probe through the semantic index.
- **V2b:** replaced by [System Builder v2](adr-system-builder-v2.md); its stage 0 (deletion) and stages 1–5 carry the acceptance (that ADR's §7).
- **V2c (C6):** DC IR drop end to end on EDA-04903 (the parent's C6 acceptance); the overlay budgets above.

## 8. Work split

| # | Package | Contents | Depends on |
|---|---|---|---|
| V2a | C5: the 3D tab on analytic packs | port the spike's analytic renderer, layer view and mask colours into the viewer as its only board path; the tab reads pack and GLB through the consumer with staged readiness (§2.2); selection and cross-probe through the semantic index; the mesh path stays selectable for V2b to delete (§2.3) | K2b, V1 |
| V2b | Replaced by [System Builder v2](adr-system-builder-v2.md) (its §7: stage 0 deletes, stages 1–5 build) | — | V2a |
| V2c | C6: Simulation Studio | the parent's C6 row, with runs on the bundle by key and the overlay changes of §4 | V2a |
| V2-R | Wire geometry nodes (research) | §5 | System Builder v2, stage 4 |

## 9. Text changes on acceptance

1. **Parent §9.6:** the C5 row points to V2a; the C4b row becomes V2b with the widened scope; the C6 row adds §4's overlay work.
2. **Parent §9.7, R2:** the `kicad-prism-viewer/` 3D removal moves to V2a and V2b (§2.3).
3. **Amendment U §3.2:** the 3D budgets, set on 2026-10-18 after V2a's measurements (Q4). Applied.
4. **`decisions.md`:** a "One analytic 3D path, amendment V2 (2026-10-18)" section with decisions 1–8 and the answers to Q1–Q4.
5. **`ownership.md`:** V2a owns the viewer's analytic files, `webgpu-3d-tab.tsx` and the 3D tab's backend; V2b owns `backend/app/services/systems/` (3D, mating, harness, operations), `api/systems*.py` and `frontend/src/features/system-builder/`; a new contract `system-ops-a0.tsp` with its field map.
