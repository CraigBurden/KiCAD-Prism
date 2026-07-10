# ecad-viewer + Prism WebGPU visualizer implementation

Date: 2026-07-10  
Branch: `feature/ecad-webgpu-visualizer-reset`  
Base: `origin/main@5ba87fe`

## Outcome

The Visualizer is split into five independent tabs:

1. Schematic — ecad-viewer source rendering.
2. PCB — ecad-viewer source rendering.
3. 3D — Prism WebGPU semantic renderer and explicit asset generation.
4. BOM — semantic-index-backed dense engineering table.
5. Assembly Assistant — the existing iBoM iframe.

Schematic and PCB source requests do not depend on either semantic-index or 3D
generation. Missing or stale WebGPU assets are reported only in the 3D tab.

The 3D custom element is lazy-created on first use and then remains mounted for the
life of the Project Detail page. Inactive viewer layers are visually and accessibly
hidden without being unmounted. Returning to 3D resizes the renderer and reapplies
the global selection so the selected component/net is framed again.

The embedded custom element mounts the reused renderer with an explicit `3d`
workspace scope. It does not initialize the legacy schematic-world or internal BoM
workspaces retained by the standalone development entry; ecad-viewer and Prism's
engineering table remain the only owners of those product surfaces.

## Cross-probe architecture

`usePrismCrossProbe` owns the latest normalized `PrismSelection`, enriches it when
`semantic-index.json` is available, and fans it out to registered viewer clients.
Clients are keyed by context and source revision so future visual-diff viewers can
register both revisions without relying on one global SCH/PCB singleton.

The ecad-viewer adapter emits immutable low-level source identity snapshots. Prism
performs component, terminal and net enrichment through the sidecar. 3D selections
are emitted by `prism-semantic-viewer:selectionchange`; selections received before
the renderer is ready are retained and applied after its ready event.

Prism owns the shared ShadCN selection inspector. Its ecad embeds set
`show-selection-panel="false"`, hiding ecad-viewer's internal properties panel while
leaving the standalone viewer default unchanged. Escape clears the selection. `C`
enters comment mode for SCH/PCB and Escape exits it.

## Artifact identity and caching

The lightweight semantic index cache key includes:

- project ID;
- a source revision hash of KiCad project, schematic, PCB, symbol and footprint files;
- semantic-index schema and generator version;
- a generator source-code fingerprint;
- the installed kicad-monkey version.

The isolated 3D cache uses project/source revision plus the WebGPU compiler and
renderer build fingerprint. Status responses expose the source revision and generator
name/version/build. Explicit regeneration is available, but reopening an unchanged
revision reuses its tagged cache.

The Linux Clipper2 shared library is installed at
`/usr/local/lib/libprism_clipper2.so` and selected through
`PRISM_CLIPPER2_LIBRARY`. This keeps it available when the development compose
override bind-mounts local viewer source over `/opt/kicad-prism-viewer`.
Clipper selection now defaults to `auto`: A2 native clipping is used when the library
is available, with a deterministic JS fallback instead of failing asset generation
when the optional native accelerator is absent.

## Stabilization behavior

- The embedded WebGPU panel has a dedicated two-column collapsed rule; its drawer
  contracts from 376 px to a 46 px rail while the canvas expands.
- 3D selection resolves semantic net UID/name before any renderer-local numeric ID,
  preventing KiCad net codes from selecting unrelated internal features.
- Programmatic PCB highlights retain ownership across pointer hover and release it on
  local click or clear.
- ecad source/property custom elements follow Chromium construction rules, and the
  Prism embed omits ecad's internal property panel entirely.
- Schematic `[` / `]` navigation follows project page order; `Alt+Backspace`
  (Option+Delete on macOS) loads the exact hierarchical parent at arbitrary depth.
- The 3D `I` shortcut and both Isolate controls share one state transition. Isolated
  nets hide the board substrate and retain copper-layer colors; contextual net
  highlights remain green.
- BOM groups strictly by Value, persists user-resized column widths locally, and
  uses token/field-aware filtering with prefix and trailing-space exact-reference
  behavior.
- The selection inspector uses type-aware component/net/terminal pages and reserves
  Library Manager and component-database integration surfaces.
- Cross-probe request construction lives beside selection normalization/enrichment,
  leaving the Visualizer shell responsible for composition and client registration.

## Validation

- Frontend TypeScript/Vite production build: passed.
- Frontend ESLint: passed.
- Backend service test suite: 39 passed (the user's untracked
  `test_artifact_readiness.py` was intentionally excluded).
- ecad-viewer type lint and production bundle: passed with zero warnings/errors.
- WebGPU semantic GLTF tests: 8 passed.
- WebGPU viewer JavaScript tests: 5 passed.
- WebGPU compiler Python tests: 66 passed.
- Native Clipper2 CTest: 1 passed.
- Runtime Clipper2 diagnostic: protocol A2 available from the packaged Linux library.
- USB-PD-Trigger-Board: 3D generation completed and the WebGPU viewer reached
  `WebGPU semantic glTF active`.
- JTYU-OBC semantic-index smoke: 944 components, 999 nets, 4,015 terminals,
  11,172 schematic net identities, 20,906 PCB net identities, 885 PCB footprint
  UUID indexes and 3,888 PCB pad-terminal indexes.
- Live JTYU-OBC UI: schematic rendered before 3D assets; five tabs and isolated
  missing-3D generation state verified.
- Live USB-PD UI: lazy PCB/3D shell behavior, generated 3D load, and hidden ecad
  internal selection panel verified.
- Live USB-PD stabilization smoke: WebGPU panel measured `920/376` px expanded and
  `1250/46` px collapsed; the 3D host remained mounted through PCB/BOM switches;
  `VCC_USB_PD_OUT` retained its semantic UID after a tab round trip; BOM Value groups,
  16 px keyboard column resizing, type-aware inspector, and schematic next/parent
  shortcuts were verified. The final page load introduced no browser console errors.
- Live USB-PD isolation smoke: `I` toggled the selected net in and out of isolation,
  synchronized both Isolate controls, hid/restored Board Substrate, retained red/blue
  copper-layer materials while isolated, and did nothing while the BOM tab was active.
- Live JTYU-OBC follow-up smoke: ecad-viewer resolved 30 schematic page instances;
  `]` traversed page-order paths including depth-three children, `[` returned to the
  previous page, and two successive `Alt+Backspace` presses moved depth 3 → 2 → 1.
  BOM prefix filtering excluded unrelated numeric substrings, while the trailing-space
  exact lock reduced a known reference search to its single Value group.
- Final cleanup smoke: the revision-tagged USB-PD assets regenerated successfully,
  the embedded element reached `WebGPU semantic glTF active`, and its shadow tree
  contained no legacy workspace buttons, schematic canvas, or internal BoM view.

## Known limitations

- The ecad adapter is a focused local reconciliation patch, not an upstream PR yet.
- Schematic net highlighting is limited to source UUIDs that have a paintable normal-
  viewer object/bounds; unresolved compiler-only connectivity nodes cannot be drawn.
- Exact terminal focus falls back to the owning component when the destination side
  lacks a source pin/pad UUID.
- WebGPU net highlighting requires net geometry in the generated semantic GLTF.
- The first semantic-index build for very large projects can take longer than one
  minute. It is asynchronous from SCH/PCB rendering, nginx permits the request to
  finish, and the BOM provides an explicit retry if transport is interrupted.
- Upstream ecad-viewer parser warnings for some newer KiCad property flags remain;
  they do not prevent the inspected JTYU-OBC schematic from rendering.

## Follow-up work

1. Upstream the stable selection and `show-selection-panel` adapter in small ecad-
   viewer changesets, then refresh Prism's vendored bundle from the accepted base.
2. Add browser-level automated cross-probe tests with compact KiCad fixtures for
   component, terminal, label, track/via/zone and deferred 3D selection cases.
3. Add semantic-aware visual diff by registering SCH/PCB clients per revision and
   applying kicad-monkey change sets to separate ecad-viewer instances.
4. Persist comment source anchors and later connect comment creation to GitHub App
   authentication and issue creation.
5. Profile and incrementally cache kicad-monkey connectivity stages for faster first
   semantic-index generation on JTYU-scale projects.
6. Refine WebGPU net and PCB highlight materials after functional net round trips are
   covered by fixtures.
