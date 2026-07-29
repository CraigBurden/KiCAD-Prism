# Design Comparison: a leaner implementation

Status: proposal, revision 2. Phase 0A is implemented; nothing else is.

Revision 2 folds in a design review of revision 1. The architectural centre is
unchanged — one authoritative comparison, backend owns electrical meaning,
viewer owns painted geometry. Six things changed, all of them because
revision 1 was wrong or optimistic:

| # | Revision 1 said | Revision 2 says |
| --- | --- | --- |
| 1 | replace the sidecar with `{uuid, kind, layer, parentUuid, hash}` | the sidecar carries **identity routing**, not just geometry; the digest must carry `documentPath` and `instancePath` too |
| 2 | Phase 0 measures `diagnostics` | those diagnostics **cannot see** painted-bounds failure; new reasons required |
| 3 | one prepared scene drives three views | one comparison **session**; Composite's scene cannot render a faithful reference view |
| 4 | make `KiCadItemChange.bbox` optional | split the type — keep the native contract strict, add a Prism input type |
| 5 | add `getPreparedTargets()` | unnecessary; `loadDocumentComparison` already returns the map |
| 6 | ~1.5 MB, 8.3 s → 5.5 s | ~2.3–4 MB, and 5.5 s is an upside target not a commitment |

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

`revision.json` is a server-side cache artifact, not a client payload. Its size
costs disk, serialisation and cache I/O per revision; the browser only receives
the per-change `geometry` fragments attached to change records.

`_diff_designs` turns the two indexes into Prism change records.
`document_diff_service.build_project_diff` then normalises those into a
KiCad-shaped `PROJECT_DIFF` plus a `navigation` sidecar.

The geometry sidecar's bounds are **hardcoded constant boxes**:

```python
# Used only if native UUID focus is unavailable.
"bounds": [at[0] - 5, at[1] - 5, 10, 10],       # every footprint
symbol_bounds = [at[0] - 2.54, at[1] - 2.54, 5.08, 5.08]   # every symbol
```

Real values from a cached artifact: `[120.65, 238.76, 5.08, 5.08]`,
`[50.187, 72.75, 10, 10]`. Same size for a 0402 and a BGA. When bounds are
absent entirely, `_bbox_iu` manufactures `[0, 0, 0, 0]`
(`document_diff_service.py:81`) — a focusable target at the origin.

### Frontend

Three presentation modes, **two rendering paths**, three viewer instances:

| Mode | Viewer API | Bounds from |
| --- | --- | --- |
| Composite | `loadDocumentComparison` → `selectDocumentDiff` | viewer (exact) |
| Side-by-side | `setRevisionDiffPresentation` → `selectRevisionDiff` | backend (constant boxes) |
| Old/New | `setRevisionDiffPresentation` → `selectRevisionDiff` | backend (constant boxes) |

`comparison-presentation-shell.tsx` is 2,092 lines. It holds three viewer
instances — `compositeViewer`, `baseViewer`, `compareViewer` — and Old/New
**aliases** one of the latter two rather than owning a fourth
(`comparison-presentation-shell.tsx:943`). The duplication to remove is two
preparation and selection paths, not four viewers.

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
prepared comparison. Prepare once; switching view changes cameras, viewports
and visibility, never the identity model.

And: **the backend owns identity and connectivity; the viewer owns painted
geometry.** The backend should not emit a coordinate that the viewer could
compute.

### 1. Replace `_extract_geometry` with an *identity* digest

The sidecar is misnamed. Beyond bounds it supplies document routing, object
kind, parent identity for pins, and semantic enrichment — and
`document_diff_service` depends on all of it:

- `_document_path` reads `geometry["page"]` **before** any other source
  (`document_diff_service.py:65-72`);
- `_item_change` derives `typeName` from `geometry["kind"]` (`:128`);
- `test_native_geometry_page_overrides_human_hierarchy_and_folds_siblings`
  exists precisely because the sidecar corrects a human hierarchy string into
  a loadable `.kicad_sch` path.

Deleting bounds is safe. Deleting routing is not. The digest is therefore:

```
{
  sourceId,          # native UUID
  kind,              # symbol | pin | footprint | zone | track | gr_line | ...
  documentPath,      # loadable path, e.g. "Subsheets/USB.kicad_sch"
  instancePath?,     # KIID_PATH for hierarchical instances
  layer?,            # PCB only
  parentSourceId?,   # pins → owning symbol, pads → owning footprint
  centroid,          # [x, y] — see below
  hash               # 64-bit hash of the normalised body
}
```

No point lists, no bounds. `documentPath` + `instancePath` matter because the
viewer architecture defines schematic identity as `projectPath + KIID_PATH`,
not filename or terminal UUID alone.

`centroid` is the one coordinate that stays, and the [consumer
audit](design-comparison/geometry-sidecar-consumers.md) is why. The change list
reports **`position_delta`** — mean `dx`/`dy`/`distance` per group — computed
from the sidecar's `x`/`y`. That is not component-only: tracks group by net, so
"net `VBUS` shifted 0.4 mm" is a currently-shipping output. Keeping two floats
preserves it; the `points` arrays that produced those floats, and that account
for most of the 28.96 MB, still go.

For **components and footprints**, add a structured digest beside the hash:

```
{ at, rotation, mirror, layer, netId }
```

Five scalars, no point arrays. This is what makes "U4 moved 2 mm, rotated 90°"
possible instead of "U4 modified". Routing and graphics stay hash-plus-centroid
— the canvas communicates the rest better than words do.

Gains:

- the 687 zones nested at depth 3 stop being dropped
- every kind covered, closing the 1,034-object gap

**"One pass instead of 18" was wrong and has been dropped.** Revisions 1 and 2
both claimed the eighteen per-kind `finditer` passes were the cost to remove.
Measured on a 34.9 MB board, locating the same 23,698 objects costs:

| | |
| --- | ---: |
| kicad-monkey projection scan (`iter_sexp_form_spans`) | 10.4 s |
| 18 regex `finditer` passes | 0.52 s |
| 1 alternation regex pass | **0.06 s** |

The projection scan costs ~10 s *regardless of how few forms it selects* —
selecting only `footprint` (982 spans) took 11.0 s — because it walks the whole
file in Python. The 18 passes were never the bottleneck; `_extract_geometry`
spends its 2.2 s on per-object work, not on finding objects. The digest is
therefore regex-driven, with extents bounded by `_balanced_s_expression_end`,
which drives its paren walk through the regex engine for the same reason.
Rewriting it that way took the digest from 15.4 s to 3.6 s with byte-identical
output.

#### Digest rules

A naive "hash the normalised body" has four traps. The scanner must state its
position on each:

**Parent–child cascade.** If a footprint's hash covers its pads, moving one pad
reports both the pad and the footprint as modified, and every group, symbol and
zone inherits the same noise. Use a **shallow hash**: normalise the parent's own
attributes and replace each independently addressable child with a stable
reference to that child, not the child's content.

**Authored vs generated.** Filled zone polygons change whenever KiCad
regenerates the board, with no authored change at all. Split
`authored zone definition` from `generated fill representation` and hash only
the former by default. The same applies to any `(generated ...)` block.

**Objects without UUIDs.** "Every kind" is not "every object is independently
addressable". Position-in-file identity produces pure noise after a reorder.
For anonymous objects, fold them into their parent's shallow hash as a
parent-scoped multiset, so a reorder is invisible and a real edit is not.

**Normalisation.** The normaliser must explicitly decide, and document, whether
it ignores: whitespace and formatting; field order where order is not
semantic; generated timestamps; UUIDs when hashing content; zone fills; cache
and generated sections. Ordering must be preserved where ordering changes
behaviour.

### 2. One change model, three tiers

| Tier | Owner | Kinds |
| --- | --- | --- |
| **1 — Connectivity** | backend (semantic index) | net added/removed/renamed; net membership delta; pin reassignment; net class change; sheet instance added/removed/re-pathed; bus membership change |
| **2 — Identity & properties** | backend (semantic index) | component added/removed; `lib_id` swap; footprint change; any of the 81 property values; **property attributes (`at`, `hide`, `effects`)**; DNP / exclude-from-BOM / exclude-from-board; sheet assignment |
| **3 — Geometry & graphics** | backend detects (digest), **viewer resolves bounds** | moved / rotated / mirrored / layer-changed **for components and footprints** (structured digest); track/arc/via/zone/graphics/text **added, removed or modified** (hash only) |

Tier 3 is deliberately split. A whole-body hash yields exactly three verbs —
added, removed, modified — and revision 1 promised classifications it could not
deliver. The structured digest buys back the classifications that matter for
components; everything else says "modified" and lets the canvas explain.

Tier 1 is the reason the semantic index cannot move to the browser, and the
reason we are not merely a visual differ.

### 3. One comparison session, one or two viewports

Revision 1 claimed one prepared scene could drive all three views by changing
visibility. It cannot. `build_diff_presentation` paints the **comparison**
document as authority and injects only those reference items that are part of a
change (`diff-presentation.ts:169-192`; `reference_items` accumulates
`retained_reference_items` alone). Unchanged and modified reference objects are
never in that scene. So the prepared Composite scene can render Composite and a
comparison-only view — never a faithful reference-only view, and therefore never
the left pane of Side-by-side.

The target is a session, not a scene:

```
ComparisonSession
├── parsed reference project
├── parsed comparison project
├── semantic / native diff index
├── reference scene
├── comparison scene
├── composite presentation
└── exact target bounds per side
```

- Composite → comparison scene plus removed-reference injection (what exists).
- Side-by-side → reference and comparison scenes in two viewports.
- Old/New → selects one of the two scenes.
- Parsing and identity resolution happen **once**; scene compilation may happen
  once per side.

This keeps the principle that matters — one computed comparison, one API — while
dropping the claim that it is literally one paint scene.

**Intermediate step, lower risk.** Keep two `<ecad-viewer>` instances for
Side-by-side, but have both consume the shared comparison session and the shared
parsed-source cache. Remove `setRevisionDiffPresentation` first; optimise scene
sharing afterwards. This gets the architectural win without betting on the
two-viewport work landing.

### 4. Two item-change types, and a two-stage preparation

Revision 1 said "make `bbox` optional". That weakens a type which is supposed to
mirror KiCad's native contract, and `bbox` is not decorative: the diff index
converts it to world coordinates immediately, routing-group bounds are computed
from those values before painting, and prepared targets need bounds before the
document loads.

Split the type instead:

```ts
type NativeKiCadItemChange = { bbox: [number, number, number, number]; /* … */ };
type PrismItemChangeInput   = { bbox?: [number, number, number, number]; /* … */ };
```

And make preparation explicitly staged:

1. validate the identity / property diff;
2. resolve source IDs against the parsed scenes;
3. produce exact per-item bounds;
4. construct selection targets and group union bounds.

An item that fails stage 2 or 3 becomes a **non-focusable change-list entry with
a diagnostic** — visible, honest, unclickable. That is strictly better than
today's `[0, 0, 0, 0]`, which is a target that silently flies the camera to the
origin.

### 5. No `getPreparedTargets()`

`loadDocumentComparison` already returns an `EcadDocumentComparisonPreparation`
containing the target map, and the viewer hydrates that same map with painted
bounds before returning it. Prism should hold the returned preparation as the
session handle. A getter would only earn its place if Prism could lose the
result while the viewer stayed mounted, or if targets changed after load through
lazy page preparation. Once §3's session object exists it owns the targets
anyway. Dropped.

## Sequencing

**Phase 0A — make the viewer build reproducible. ✅ Done.**
The shipped manifest claimed `adapterCommit c52ac81` with `dirty: true` and a
non-empty `worktreePatchSha256`: the bundle carried source that was in no
commit. That patch had since been committed as `57178d8`, and the clean tree
hashes to `499f8775` — exactly the `sourceTreeSha256` the dirty build recorded.
Rebuilding from the clean tree reproduced both artifacts **byte for byte**
(`ecad-viewer.js` `a4788ec2…`, `parser.worker.js` `074c4fc2…`). Provenance is
now honest and the diagnostics we collect next are attributable to a commit.

**Phase 0B — comprehensive resolution instrumentation.** The current
diagnostics (`missing-source-id`, `item-not-found`) fire only while resolving
source IDs to parsed objects. Painted-bounds failure is **silent**:
`#hydrate_document_diff_targets` does `if (!native_bounds.length) continue;`
(`ecad_viewer.ts:1522`) and leaves the backend bbox in place without a word.
Measuring today's diagnostics would therefore undercount constant-box usage —
possibly to zero. Add:

```
paint-bounds-not-found
source-id-ambiguous
hierarchy-ambiguous
document-not-found
```

and record per change: domain, document, object kind, source side, hierarchy
depth, source resolution succeeded, painted bounds succeeded, number of objects
matching the source ID, fallback bbox consumed.

**Result: [measured](design-comparison/phase-0b-measurement.md).** On a
204-change schematic: 204/204 identities resolved, 102/102 targets resolved
exact painted bounds, **fallback rate 0**, ambiguity 0. The constant boxes were
never used for focus. Two defects surfaced that the plan had not anticipated —
per-visual bounds were never resolved at all (a generator consumed twice, fixed
in ecad-viewer `df92ecf`), and change ids omitted the sheet instance path, so
reused hierarchical sheets collapsed distinct components onto one id. The
second is the `instancePath` gap this revision predicted, confirmed as a live
correctness bug; fixed for components, and the residual is labels and wires
whose net refs carry no instance path at all.

Ambiguity is worse than "first match wins". `items_by_source_id.set(sourceId,
[presentation_item])` **overwrites** on a repeated source ID
(`diff-presentation.ts:197`), so the earlier resolution is destroyed at index
build time; `first_item` then reads `[0]` of a one-element array
(`:116`). A duplicate identity is not a coin flip — it is silent data loss.
Count these before changing behaviour.

Audit API and headless consumers of `change.geometry` in the same phase.

**Phase 1 — introduce the digest in shadow mode. Implemented, not wired in.**
`app/services/design_object_digest.py` plus 12 tests. Measured on JTYU-OBC
(15 MB of schematics, a 34.9 MB board):

| | geometry sidecar | object digest |
| --- | ---: | ---: |
| objects covered | 37,877 | **44,586** |
| extraction | 2.2 s | **3.6 s** |
| artifact | 28.96 MB | **8.07 MB** |

Honest reading: the digest **costs 1.4 s more**, not less, and the artifact is
3.6× smaller rather than the order of magnitude revision 2 predicted. What it
buys for that 1.4 s is ~6,700 objects the geometry sidecar never saw, every
kind rather than eighteen, and no coordinates beyond a centroid. The committed
target — "remove the 2.2 s stage without adding an equivalent cost" — is *not*
met yet; the remaining cost is the balanced-paren walk re-reading nested
content and the per-object centroid regexes.

Shadow-mode delta on a real revision pair: 1,289 added, 550 removed, 735
modified. Cross-checking those sets against the geometry-derived sets is the
next step, and must happen before the sidecar is deleted.

**Phase 2 — remove the bbox dependency from the Prism provider path.**
Composite only. Resolve exact bounds before creating prepared targets and
before grouping routing changes. Once the measured fallback rate is acceptable,
stop emitting backend bounds.

**Phase 3 — comparison-session API.** Conceptually:

```ts
const session = await viewer.prepareComparison(request);
session.setPresentation("composite" | "reference" | "comparison");
session.attachSideBySide(leftViewport, rightViewport);
```

The exact shape can differ; it must own both revisions and all presentation
state.

**Phase 4 — delete the old Prism path.** `buildRevisionDiffPresentation`,
`setRevisionDiffPresentation`, `selectRevisionDiff`, `previewRevisionDiff`.
Camera sync stays in Prism (`use-comparison-camera-sync.ts`, 52 lines) unless
the viewer takes ownership of both split viewports.

**Phase 5 — semantic completeness.** Property attributes, buses, sheet
instances, remaining connectivity classifications. Largely orthogonal; can run
in parallel once the data contracts stabilise.

## Expected outcome

Revision 1's numbers were optimistic. Corrected:

| | now | after | note |
| --- | --- | --- | --- |
| digest artifact | 28.96 MB | ~2.3 MB column-oriented, ~4 MB keyed JSON | 40 bytes/object was wrong; a 36-char UUID plus a 16-hex hash plus keys is ~90 bytes before interning |
| `revision.json` | 32.15 MB | ~7–9 MB | still 3.5–4× smaller, not 7× |
| compare wall clock | 8.3 s | **first target: −2.2 s** | the digest must still scan and hash every object; 5.5 s is the upside, not the commitment |
| objects diffable | ~37k | ~38k, all kinds | |
| bounds accuracy | constant boxes | exact painted bounds | |
| rendering paths | 2 | 1 | |
| Prism S-expression scanning | ~299 lines | ~80 lines | |

The defensible claim is: **remove the 2.2 s geometry stage without adding an
equivalent digest cost**, then benchmark. Anything beyond that is earned, not
predicted.

`_balanced_s_expression_end` and `_iter_sexpr_blocks` survive — `_extract_stackup`
and `_schematic_instance_fields` still need them.

## Risks

- ~~**Fallback rate is unknown.**~~ Measured at 0 on a 204-change schematic.
  Still to repeat on a PCB document and a hierarchical project before the
  backend stops emitting bounds — those are where uuid resolution is most
  likely to be fragile.
- ~~**Ambiguous identities are silently collapsed.**~~ Measured ambiguity is
  zero. The real hazard turned out to be **change ids without a sheet instance
  path**: a reused hierarchical sheet is one file, so its instances share every
  symbol UUID, and two distinct components collapsed onto one id. Fixed for
  components by emitting the full KIID_PATH; labels and wires still collide
  because net refs carry no instance path in the semantic index.
- **Hash-only tier 3.** "Modified" without "what changed" for routing and
  graphics. Mitigated for components by the structured digest.
- **Side-by-side scene cost.** Two retained scenes is more memory than one.
  Whether one session can drive two viewports, or whether two instances over a
  shared source cache is fast enough, must be measured before Phase 3's scope
  is fixed.
- ~~**Headless consumers.**~~ Closed by the 0B audit: no API router, export
  path or non-browser consumer reads the sidecar. The residual risk is version
  skew between a cached frontend bundle and a newer backend, which the
  resolution report's `unreported` flag already distinguishes from a clean
  measurement.
- **Server cache is shared; browser parsing is per session.** This proposal
  only removes *duplicated* work — the viewer already parses these files.
  Pushing further work frontward would multiply per user, which is the
  asymmetry behind the 84% cache-miss complaint.
