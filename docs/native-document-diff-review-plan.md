# Native document comparison rollout

## Decision

History keeps the existing Commit and Release views. Design Comparison moves
to one native ecad-viewer scene that accepts two immutable revision source sets
and KiCad-shaped `PROJECT_DIFF` / `DOCUMENT_DIFF` JSON.

The public ecad-viewer Graphics API is reduced to typed comment markers and
comment areas. Difference graphics are not host overlays:

- comparison-side native items form the normal retained scene;
- unchanged items are monochrome;
- added and modified comparison items are painted through their native
  painters;
- removed native items are resolved from the reference parse and injected into
  the same retained scene;
- selection uses one internal highlight box and precomputed camera bounds.

No ghost, split, image-overlay, measurement, or legacy visual mode is retained.

## Provider boundary

Prism currently generates `prism.kicad_project_diff_v1` through an independent
adapter over the existing kicad-monkey semantic index and granular native
geometry extraction.

The adapter preserves KiCad field names and units:

```text
PROJECT_DIFF.documents[]
  DOCUMENT_DIFF.path
  DOCUMENT_DIFF.docType
  DOCUMENT_DIFF.changes[]
    ITEM_CHANGE.id
    ITEM_CHANGE.typeName
    ITEM_CHANGE.kind
    ITEM_CHANGE.properties[]
    ITEM_CHANGE.bbox
    ITEM_CHANGE.refdes
    ITEM_CHANGE.children[]
```

A separate navigation sidecar maps Prism semantic change IDs to immutable
document paths and native change IDs. Non-renderable semantic-only differences
remain in the Differences pane and produce explicit diagnostics.

When KiCad V11 exposes stable CLI JSON, add a `kicad-cli` provider that returns
the same project-diff contract. Do not port GPL implementation code into
Prism/ecad-viewer; execute KiCad as a tool or implement the documented data
shape independently.

## Implemented foundation

- ecad-viewer branch: `feature/native-document-diff-viewer`
- pinned viewer commit: `33a832d765daa48666bf688c40cb28aeaf20963c`
- Prism branch: `feature/history-document-diff-review`
- strict JSON validation and KiCad IU conversion
- reference/comparison parsing through one shared worker pool
- full-content parse-cache identity
- native A/R/M painting and removed-item injection
- O(1) item/group selection targets
- atomic internal selection overlay + camera frame
- parsed-project and prepared-document reuse across changed files
- serialized latest-request-wins revision loading across SCH/PCB switches
- native painter bounds for focus and a screen-space selection outline
- theme-aware monochrome context, including schematic drawing sheets
- local-only selection counters for parser and full-paint regressions
- typed comment-only overlay host API
- Prism semantic-to-DOCUMENT_DIFF provider and field-only geometry hydration
- one-viewer History comparison panel with existing filters, discussions, BOM,
  Stackup, URL state, and PCB layers preserved

## Remaining performance phases

### Phase 1 — retained warm selection

Acceptance:

- item click calls `selectDocumentDiff()` exactly once;
- group click selects the native group union when all members share a document;
- parser delta is zero;
- document paint delta is zero;
- p95 click-to-visible frame is at most 100 ms on a prepared page.

The viewer emits local `ecad-viewer:document-comparison-frame` details with
`clickToFrameMs`, `paintCount`, and `parserCount`. Prism warns locally if a warm
selection violates the zero-parse/zero-paint contract.

### Phase 2 — changed-document scene cache

Cache painted schematic scenes by:

```text
comparison revision
reference revision
full projectPath
theme
drawing-sheet signature
DOCUMENT_DIFF signature
```

Cache the retained layers, source-ID bounds index, scene bounds, and removed
reference items. Activate a cached scene without parsing or painting. Use a
shared 128–512 MiB adaptive LRU budget and full hierarchical paths, never
filenames, as keys.

Acceptance:

- prepared cross-sheet p95 at most 200 ms;
- repeated sheet activation records zero paints and zero parses;
- repeated hierarchical instances remain distinct.

### Phase 3 — background preparation

Open the initially selected document first. Prepare other changed documents in
approximately 8 ms chunks, yielding to foreground selection. Show
`Preparing changed documents N/M` without blocking the workspace.

Acceptance:

- cold document p95 at most 1.5 s;
- no main-thread task over 50 ms;
- foreground selection preempts background work;
- latest request always wins.

## Benchmark matrix

Run production builds with `?ecadPerfLog=1` and capture at least 30 selections
per case:

| Fixture | Coverage |
| --- | --- |
| Small | One schematic, two-layer PCB, A/R/M components |
| Medium | Hierarchy, zones, vias, tracks/arcs, field-only changes |
| JTYU-OBC | Large hierarchy and 12-layer board |
| Pathological | Repeated sheets, deleted documents, duplicate IDs, large zones |

Record:

- source bytes and parser/model time for both revisions;
- comparison validation, identity resolution, unresolved count, and cold paint;
- click-to-visible frame, parser delta, paint delta, and target primitive count;
- document cache hit/miss and retained-scene memory once Phase 2 lands;
- long tasks and rapid previous/next correctness.

Do not claim the p95 targets from development builds or synthetic index-only
tests. Production JTYU-OBC measurements are required.

## Verification gates

- ecad-viewer browser tests and production bundle build
- backend document-diff and existing design-comparison tests
- frontend Vitest, ESLint, and production build
- light/dark and desktop/narrow visual QA
- exact bundle commit/digests in `frontend/public/ecad-viewer.manifest.json`
- comparison never changes the Git checkout
- Commit and Release History actions remain unchanged
