# PostgreSQL and ecad-viewer extension refactor

## Pinned inputs

- JTYU-OBC project commit: `8f71cfea2b2cac8719f709fa09d2cd5c93449839`
- USB-PD-Trigger-Board project commit: `3ec8f9cc79c874c433551f96889fce49c4eaac94`
- ecad-viewer upstream: `a6456d3e9f10cdf761ce0c0e711ac69251e1fa45`
- Prism ecad adapter: `2dcb4052a4510a4d83005ae9d776c1cf57bde761`
- Previous local ecad baseline: `7b442967613115e47ac7c9d492edd3d506ea2794`

The generated browser artifacts and their SHA-256 values are recorded in
`frontend/public/ecad-viewer.manifest.json`.

## Persistence

Prism runtime state now uses one PostgreSQL database with the `workspace`,
`comments`, `catalog`, and `operations` schemas. The component catalog adds a
transactionally refreshed `catalog.component_heads` read projection. Component,
revision, and revision-asset triggers update this projection in the same transaction
as the source mutation.

Catalog and Bulk Edit reads avoid preview and full evidence hydration. Bulk Edit
selects only visible fixed fields plus `extra_fields` when a visible custom field
requires it. CSV export uses a PostgreSQL server-side cursor. Directory discovery
keeps a bounded cache keyed by source hashes, inventory paths/sizes, and footprint
resolutions.

The destructive reset script preserves Git checkouts while clearing runtime schemas,
catalog artifacts, and semantic/WebGPU caches. The legacy catalog migration service,
SQL translation layer, SQLite runtime tests, monolithic Library Manager panel, and
asset-capable metadata CSV endpoint have been removed. SQLite remains only as the
required output format for generated KiCad database-library bundles and as a supported
input format for migration connectors.

## ecad host and extension layer

The Prism host adapter provides:

- `replaceSources` and `appendSources`, with the root schematic loaded before subsheets;
- `setActive`, which pauses hidden viewer interaction and drawing;
- structured `requestCrossProbe`, `clearSelection`, and `ecad-viewer:selection` events;
- `setOverlayScene` and `clearOverlayScene` retained extension channels.

Overlay scenes use dedicated underlay, content-overlay, or foreground layers. They
support world, bounding-box, source-item, and semantic entity anchors without mutating
KiCad items. Interactive primitives use indexed hit testing and emit opaque caller
metadata. This is the future integration point for comments, semantic visual diff,
ERC annotations, and measurements.

React commenting pin overlays were removed. In-browser commenting is restored via the
`comments` overlay channel: translucent yellow note glyphs (no ID text on canvas), optional
dashed area bboxes, a compact marker card, and the side Comments panel. Comment CRUD never
mutates `.kicad_sch` / `.kicad_pcb` and does not call `replaceSources` / reparse.

The overlap-selection behavior from PR #61 is incorporated at the ecad boundary:
opening the chooser does not select the first candidate, hover does not emit a
selection, and clicking a concrete candidate emits one structured selection event.

## Visualizer and semantic identity

Schematic and PCB hosts stay mounted by project, commit, and context. Tab changes use
`setActive` instead of remounting. The root schematic is painted before subsheets are
appended, and source parsing remains in upstream workers.

Schematic/PCB tabs never wait for semantic or WebGPU assets. The compact semantic
identity artifact is generated and loaded in the background on first Visualizer use,
while heavy WebGPU/3D generation remains explicit and isolated to the 3D tab. Status,
generation, and identity endpoints remain independently available.
Identity loading is deferred until BOM/3D or a selection requires enrichment. The 3D
artifact remains responsible for WebGPU feature, node, and tile identities.

## Verification completed

- Rebuilt backend, catalog worker, and frontend containers against the preserved
  PostgreSQL database.
- Confirmed two imported workspace projects remain registered after restarts.
- Confirmed `catalog.component_heads` v2 installs and a rollback-only component /
  revision mutation refreshes the projection.
- Confirmed server-cursor CSV export returns a valid scoped header.
- Backend tracked unit suite: 53 passed, 6 PostgreSQL integration tests skipped when
  `TEST_POSTGRES_URL` is absent.
- Frontend ESLint and production TypeScript/Vite build pass.
- ecad-viewer bundle builds reproducibly from its pinned adapter commit.

Browser timing, hover latency, and 20-cycle memory measurements remain manual checks
against the pinned projects. They are intentionally not inferred from build results.

## Manual performance checklist

For each pinned project, record cold and warm runs for:

1. time from entering Schematic to usable root-sheet interaction;
2. worker parse count per source (expected: one);
3. idle animation-frame and React activity (expected: none);
4. hover latency p95 (target: below 50 ms);
5. 20 SCH/PCB tab cycles (expected: no remount, reparse, or sustained heap growth);
6. overlap chooser selection (expected: exactly one event after choosing an item).

## JTYU-OBC parse benchmark (Node, `kicad-parser`)

Measured on branch `feature/perf-matteo-port` against
`JTYU-OBC/OBC.kicad_pcb` (39.2 MB) and
`Subsheets/S32G3_PWR_Rail_Connections.kicad_sch` (2.3 MB).
Enable browser logs with `localStorage.setItem('ecadPerfLog','1')` or `?ecadPerfLog=1`.

| Metric | Baseline | After Matteo parser port | Speedup |
|--------|----------|--------------------------|---------|
| PCB `listify` | 2418 ms | ~515 ms | ~4.7× |
| PCB full parse (`listify` + `parse_expr`) | **52358 ms** | **~740 ms** | **~71×** |
| PCB `parse_expr` (approx) | 49940 ms | ~220 ms | ~227× |
| Largest SCH full parse | 128 ms | ~44 ms | ~2.9× |

Ports included: drop eager `${expr}` logging in `parse_expr`, fast single-pass
`listify`, shared `WorkerPool` + parse dedup, draw/hover/resize render fixes,
`custom-element` render-then-swap, `ecad-blob` `connectedCallback`.
Board net-isolation rewrite and duplicate host APIs were intentionally skipped.
