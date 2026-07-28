# Design Comparison: a leaner implementation

Status: proposal. Nothing here is implemented.

## The problem in one sentence

We compute the diff twice — once semantically in the backend and once
geometrically in a second Prism-specific scanner — and then render it through
two unrelated viewer APIs depending on which of the three views is on screen.

## What exists today

### Backend

| Stage | Cost / revision | Output |
| --- | --- | --- |
| `build_semantic_index` | 4.1 s | 4.14 MB — nets, terminals, components, hierarchy |
| `_extract_geometry` | 2.2 s | **28.96 MB** — 37,877 entries |
| `_semantic_bom_rows` | — | 1.14 MB |
| **`revision.json`** | | **32.15 MB** |

`_diff_designs` turns the two indexes into Prism change records.
`document_diff_service.build_project_diff` then normalises those into a
KiCad-shaped `PROJECT_DIFF` plus a `navigation` sidecar, filling every `bbox`
from the geometry sidecar.

The geometry sidecar's bounds are **hardcoded constant boxes**:

```python
# Used only if native UUID focus is unavailable.
"bounds": [at[0] - 5, at[1] - 5, 10, 10],       # every footprint
symbol_bounds = [at[0] - 2.54, at[1] - 2.54, 5.08, 5.08]   # every symbol
```

Real values from a cached artifact: `[120.65, 238.76, 5.08, 5.08]`,
`[50.187, 72.75, 10, 10]`. Same size for a 0402 and a BGA.

### Frontend

Three presentation modes, **two rendering paths**:

| Mode | Viewer API | Bounds from |
| --- | --- | --- |
| Composite | `loadDocumentComparison` → `selectDocumentDiff` | viewer (exact) |
| Side-by-side | `setRevisionDiffPresentation` → `selectRevisionDiff` | backend (constant boxes) |
| Old/New | `setRevisionDiffPresentation` → `selectRevisionDiff` | backend (constant boxes) |

`comparison-presentation-shell.tsx` is 2,092 lines carrying four viewer slots
(`compositeViewer`, `baseViewer`, `compareViewer`, `oldNewViewer`), two
lifecycle paths, and two selection bridges.

### ecad-viewer

The fork already specifies the right boundary in
`docs/DOCUMENT_DIFF_REVIEW_ARCHITECTURE.md`, and implements it in
`document-diff.ts` (371 lines) and `diff-presentation.ts` (247 lines).
`loadDocumentComparison` parses both revisions, injects removed reference
items into the comparison scene, and returns exact bounds and overlay lines
per target — plus diagnostics naming any change it could not resolve.

It has **no netlist**: `netlist`, `connectivity` and `bus_expansion` all grep
to zero hits in the shipped bundle.

## Coverage gaps

~1,034 objects per project are in the files and in neither index:

| kind | count | | kind | count |
| --- | ---: | --- | --- | ---: |
| `gr_*` (board graphics) | 733 | | `image` | 13 |
| `generated` | 119 | | `rule_area` | 9 |
| `bus_entry` | 88 | | `dimension` | 3 |
| `rectangle` | 38 | | `group` | 2 |
| `sheet` | 27 | | `netclass_flag` | 2 |

Component property *values* are diffed comprehensively (81 fields, union
comparison). Property *attributes* — `at`, `hide`, `effects` — are not
captured at all, so moving a reference designator or hiding a value is
invisible.

## Prior art

**Altium** computes one difference set and presents it three ways: a
structural tree (document → object class → property), a side-by-side canvas,
and an overlay. The tree is navigable independently of the canvas — you can
work the change list without rendering anything.

**Xpedition** is netlist-first. It reports "net `VBUS` gained a connection to
`U4.7`" rather than "these 40 track segments moved", and only descends to
geometry when asked. Its comparison is meaningful on a design that was
completely re-routed but is electrically identical.

Both confirm the same split: **one computed difference set, several
arrangements**, and **connectivity is a first-class change kind, not a
by-product of geometry**.

## Proposal

### Principle

The three views are not three renderers. They are three arrangements of one
prepared comparison. Prepare once; switching view changes cameras and
visibility, never the model.

And: **the backend owns identity and connectivity; the viewer owns geometry.**
The backend should never emit a coordinate.

### 1. Replace `_extract_geometry` with an object digest

The backend still has to *detect* that an object changed — the viewer presents
a diff, it does not compute one. But it does not need geometry to do that.

Per object, one depth-aware pass per file:

```
{ uuid, kind, layer, parentUuid, hash }        # hash of the normalised body
```

No coordinates, no point lists, no bounds. The diff is a set difference on
`uuid` plus a hash comparison. Bounds are resolved later by the viewer from
`sourceId`.

- one pass instead of 18 (`_extract_geometry` runs one `finditer` per kind)
- depth-aware, so the 687 zones nested at depth 3 are not dropped
- every kind, closing the 1,034-object gap for free
- ~1.5 MB instead of 28.96 MB (≈40 bytes × 38k objects)

The honest limitation: a hash says *that* an object changed, not *what*
changed. For board graphics and routing that is enough — the viewer shows you.
For components we keep the full property diff, which is tier 2 below.

### 2. One change model, three tiers

| Tier | Owner | Kinds |
| --- | --- | --- |
| **1 — Connectivity** | backend (semantic index) | net added/removed/renamed; net membership delta; pin reassignment; net class change; sheet instance added/removed/re-pathed; bus membership change |
| **2 — Identity & properties** | backend (semantic index) | component added/removed; `lib_id` swap; footprint change; any of the 81 property values; **property attributes (`at`, `hide`, `effects`)**; DNP / exclude-from-BOM / exclude-from-board; sheet assignment |
| **3 — Geometry & graphics** | backend detects (digest), **viewer resolves bounds** | moved / rotated / mirrored; layer change; track/arc/via added/removed/rerouted; zone outline or fill settings; silkscreen and board graphics; text and dimensions |

Tier 1 is the reason the semantic index cannot move to the browser, and the
reason we are not just a visual differ. Tier 3 is the reason the geometry
sidecar should not exist.

### 3. Unify all three views onto the document-diff path

Delete `setRevisionDiffPresentation`, `selectRevisionDiff`,
`previewRevisionDiff` and `buildRevisionDiffPresentation`. Every mode goes
through `loadDocumentComparison` → `setComparisonPresentation` →
`selectDocumentDiff`.

Composite is the prepared scene. Side-by-side is two viewports filtered to
`reference` / `comparison`. Old/New is one viewport toggling side — already a
visibility change rather than a reload (2db0bcd), which generalises.

## ecad-viewer changes required

1. **`setComparisonPresentation({ mode, side? })`** — `"composite" |
   "side" | "toggle"`, applied to an existing preparation with no reparse and
   no new scene. This is the one substantial addition.

2. **Make `KiCadItemChange.bbox` optional.** It is required today, which is
   precisely why the backend synthesises constant boxes. When absent, resolve
   from `sourceId` through the existing source index and report failures in
   `diagnostics` exactly as now.

3. **`getPreparedTargets(): readonly EcadPreparedDiffTarget[]`** — so the
   change list renders from the same bounds the canvas uses instead of a second
   source of truth.

Camera linking for side-by-side stays in Prism
(`use-comparison-camera-sync.ts`, 52 lines) — it works and does not belong in
the viewer.

## Sequencing

**Phase 0 — measure, change nothing.** Instrument
`EcadDocumentComparisonPreparation.diagnostics` over real compares and count
`missing-source-id` / `item-not-found`. This is the fallback rate the constant
boxes exist to cover, and it decides whether Phase 1 is safe. Cheap, and it
gates everything else.

**Phase 1 — object digest.** Replaces `_extract_geometry`; closes the
1,034-object gap; drops `revision.json` from 32 MB to ~4.5 MB.

**Phase 2 — unify the views.** Removes the second rendering path and its half
of the shell. Requires viewer items 1 and 2.

**Phase 3 — property attributes and tier-1 completeness.** `at` / `hide` /
`effects`; bus and sheet-instance changes as first-class kinds.

## Expected outcome

| | now | after |
| --- | --- | --- |
| compare wall clock | 8.3 s | ~5.5 s |
| `revision.json` | 32.15 MB | ~4.5 MB |
| objects diffable | ~37k | ~38k, all kinds |
| bounds accuracy | constant boxes | exact painted bounds |
| rendering paths | 2 | 1 |
| Prism S-expression scanning | ~299 lines | ~80 lines (digest) |

`_balanced_s_expression_end` and `_iter_sexpr_blocks` survive — `_extract_stackup`
and `_schematic_instance_fields` still need them.

## Risks

- **Fallback rate unknown.** Phase 0 exists to answer this. If it is
  materially above zero, fix uuid resolution before deleting anything.
- **Hash-only tier 3.** "Changed" without "what changed" for board graphics.
  Acceptable for graphics; not acceptable for components, which is why tier 2
  keeps the full property diff.
- **Side-by-side parse cost.** Two viewer instances each hold a scene today.
  Whether one preparation can drive two viewports, or whether two instances
  sharing the content-addressed source cache is fast enough, needs measuring
  before committing to item 1's scope.
- **Headless consumers.** Anything reading `geometry` from the API without a
  browser loses it. Needs an audit before Phase 1.
- **Server cache is shared; browser parsing is per session.** This proposal
  only removes *duplicated* work — the viewer already parses these files.
  Pushing further work frontward would multiply per user, which is the
  asymmetry behind the 84% cache-miss complaint.
