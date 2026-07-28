# Phase 0B: identity and bounds resolution, measured

Phase 0B of [the revamp plan](../DESIGN_COMPARISON_REVAMP.md). The plan said
measure before deleting anything. This is the measurement.

## Setup

| | |
| --- | --- |
| Project | `SSD_XX_200_EPS_BACKPLANE` |
| Base | `05a89dd` "Remap BMB signals, added two 1gig phy on board" |
| Compare | `934be89` "power sequencing fix, tm_tc mux adc mapping" |
| Document | `Subsheets/1000BaseT_PHY.kicad_sch` (composite, cold cache) |
| Viewer | ecad-viewer `df92ecf`, clean tree, reproducible bundle |
| Scale | 1,603 schematic / 459 PCB / 154 BOM changes, 658 groups |

## Result

```
changes                   204
sourceResolved            204     100%
targets                   102
targetsWithPaintedBounds  102     100%
targetsUsingProvidedBounds  0
fallbackBoundsRate          0
visuals                   255
visualsWithPaintedBounds  255     100%   (0% before the generator fix below)
ambiguousSourceIds          0
duplicateChangeTargets    102     100%   (see finding 2)
```

## Finding 1 — the constant boxes are never used for focus

**`fallbackBoundsRate: 0`.** Every one of the 102 selection targets resolved
exact painted bounds from the scene. Not one camera focus used the backend's
5.08 mm symbol box.

Identity resolution was equally clean: 204/204 source ids resolved, zero
`missing-source-id`, zero `item-not-found`, zero ambiguity.

This answers the question Phase 0 existed to ask. The backend can stop emitting
bounds — Phase 1 is unblocked on that point.

The caveat is honest: this is one schematic document on one project. It should
be repeated on a PCB document and on a project with hierarchical sheet
instances before the bounds emission is deleted, because those are where uuid
resolution is most likely to be fragile.

## Finding 2 — per-visual bounds were never resolved at all *(fixed)*

The first run reported `visuals: 255, visualsWithPaintedBounds: 0` — every
target resolved, every visual failed. That contradiction was a real bug:

```ts
const item_bounds = viewer.layers.query_item_bboxes(item);  // generator
native_bounds.push(...item_bounds);
visual_bounds.push(...item_bounds);   // exhausted -- always empty
```

`query_item_bboxes` is a generator. The first spread consumed it; the second
received nothing. So `target.bounds` was correct while **every `visual.bounds`
silently kept whatever the caller supplied** — for Prism, the constant box.
The bug survived because the camera framed the right area; only per-visual
extents were wrong.

Fixed in ecad-viewer `df92ecf` by materializing the generator once. After the
fix: 255/255. `boundsFailuresBySide` is `{reference: 0, comparison: 0}`.

That last number also **refutes a hypothesis in the plan**. Reference-side
visuals were expected to fail for want of a reference scene; they do not,
because `build_diff_presentation` retains changed reference items in the
composite scene, and every reference visual here belongs to a change. The
plan's §3 argument stands on the *unchanged* reference objects that are absent
— not on changed ones.

## Finding 3 — the diff is inflated ~1.7×, and every target is a duplicate

**`duplicateChangeTargets: 102` out of 102 targets.** Every target was built
from two or more changes sharing a side and source id, so the presentation
index — which assigns rather than appends — discarded the earlier resolution
every time.

Tracing it into the artifact:

| | |
| --- | --- |
| Change entries across all 19 documents | **3,989** |
| Unique change ids | **2,340** |
| Inflation | **1.70×** |
| Worst document (`LVSM.kicad_sch`) | 284 entries for 41 ids — **6.9×** |
| `1000BaseT_PHY.kicad_sch` | 204 entries for **51** unique symbols — 4× |

The navigation sidecar records the duplication in plain sight:

```json
"sch-comp-changed-cmp:72b6dc52…": {
  "changeId":  "/01f6c458-c7c6-453e-b528-f72664fb7651",
  "changeIds": ["/01f6c458-…", "/01f6c458-…"]
}
```

and two *different* prism ids resolve to the same component uuid:

```
/01f6c458-… -> ['sch-comp-changed-cmp:72b6dc52…', 'sch-comp-changed-cmp:233d4f83…']
```

So the backend emits each changed component **twice**, as two change records
with different content digests. This is upstream of `document_diff_service` —
it is in the change records `build_project_diff` is handed.

Consequences: the change list shows every modified component twice, "1,603
schematic changes" overstates the real count, and every downstream stage
carries roughly 1.7× the payload it needs. This is a defect in its own right,
not a consequence of the architecture the revamp replaces, and it should be
fixed independently rather than folded into Phase 1.

## What this changes in the plan

- **Phase 1 is unblocked on bounds.** Repeat on a PCB document and a
  hierarchical project first; the schematic result is clean.
- **Ambiguity is not the problem; duplication is.** The plan worried that
  `[0]`-of-many silently picks wrong. Measured ambiguity is zero. The real
  index hazard is duplicate change records, and the fix belongs upstream.
- **§3's two-scene argument needs restating.** Reference-side *changed* items
  paint fine. The argument rests on unchanged reference objects being absent
  from the composite scene, which is still true and still blocks a faithful
  Side-by-side left pane.
