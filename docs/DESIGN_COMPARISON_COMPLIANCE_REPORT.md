# Design Comparison Visualization and Compliance Report

Date: 2026-07-22  
Trace: `design-compare-1784680761594-fa3164f3-d8f1-45f2-9cfa-9b827afa8b13`  
Revisions: `234e065b94ac1d0ee94d828aad093ab9a317f868` → `aebbfebf290ab9f4a0f45e2546d229ad47f64cdb`

This report covers Schematic and PCB comparison only. BOM and Stackup were reported working and were not changed in this pass.

## Visualization contract

Status colors are Added `#2BE481`, Removed `#FF4D67`, Modified `#FFC928`, and Conflict `#D76BFF`.

- Composite paints the comparison document, retains reference-only removed objects, softly mutes unchanged colors, and shows every resolvable static halo. Added objects are green, removed retained objects are red, and objects present on both sides of a modification are amber unless a more specific connectivity/label delta supplies red or green child targets.
- Side-by-side paints Base and Compare independently. Added targets appear only in Compare, removed targets only in Base, and shared modifications on both panes. A document absent from one resolved hierarchy gets an explicit missing-revision pane.
- Old/New uses one stable viewer host. It applies only the active revision's targets after that exact revision has finished `replaceSources()`. A document absent from the active hierarchy gets the explicit missing-revision pane.
- Every resolved target has a static halo. Routing underlays are 7 px translucent plus a 2.5 px core. Selected/hovered routing receives the dotted animation at 5 px near fit zoom, interpolating to 3 px at 3× fit zoom. Other selected objects receive a solid status-colored emphasis.
- Hover never moves the camera. Selection cross-probes and frames the combined bounds. Reduced motion, an inactive host, and a hidden document stop animation.

## Schematic change matrix

| Logical change | Classification rule | Composite | Side-by-side | Old/New | Latest-trace compliance |
|---|---|---|---|---|---|
| Component added | RefDes is 0→N | Green comparison symbol halo | Compare green; Base has no target | New green; Old has no target | Passed: 4 Composite and 2 Side-by-side examples; active R299 also applied in New |
| Component removed | RefDes is N→0 | Retained reference symbol, red | Base red; Compare has no target | Old red; New has no target | Passed in Composite (1); not manually exercised in the other modes |
| Symbol fields modified | Reference, Value, Footprint, or custom field delta | Amber symbol with Old/New field details | Amber on every applicable side | Amber on active side | Passed in Composite and Side-by-side; combined field/sheet records were exercised |
| Instance replaced | New native UUID keeps the same RefDes | Old/new instances aggregate as one amber logical change | Amber owning symbol on both sides | Amber active instance | Passed: 4 Composite examples and 2 combined Side-by-side examples; no `rotations` exception in the latest trace |
| RefDes multiplicity changed | Same RefDes N→M where both are non-zero | Unmatched decrease red or increase green, grouped as Modified | Side-specific unmatched instance colors | Active side shows its unmatched instances | Backend-covered; not exercised in the latest trace |
| Sheet changed | Existing component resolves to a different instantiated page | Amber target on the selected affected page | Amber on each available page; absent hierarchy is explicit | Active page or explicit missing pane | One pre-fix Compare hierarchy failure was observed; hierarchy-based availability is now regression-tested, manual recheck pending |
| Same-page movement/rotation | UUID, sheet, fields, and connectivity unchanged | Omitted | Omitted | Omitted | Backend classification-covered; absence cannot be proven from click trace |
| Net added | One logical net record exists only in Compare | Green wires/labels/pins/junctions | Compare green only | New green only | 13 Composite and 5 Side-by-side examples resolved. `LLCE_CAN5_TX` exposed the incorrect `0→0` summary and is fixed to `Instances 0→1` |
| Net removed | One logical net record exists only in Base | Retained red native targets | Base red only | Old red only | Passed in Composite (1); not exercised in the other modes |
| Net renamed | Stable terminal membership, different net name | Amber affected native targets | Amber on both sides | Amber on active side | Backend-covered; not exercised in the latest trace |
| Connectivity changed | Added/removed `Ref.Pin` membership | Removed terminals red, added terminals green; shared fallback amber | Removed pins Base-red, added pins Compare-green | Active side shows its red/green terminal delta | Passed in Composite (4); not exercised after switching views |
| Local/global label count changed | Count changes; hierarchical labels and power symbols excluded | Unmatched old labels red and unmatched new labels green | Base removed labels red; Compare added labels green | Active unmatched labels only | Passed in Composite (5) and Side-by-side (13) |
| Wire rerouted / UUID churn | Terminal membership unchanged | Omitted | Omitted | Omitted | Backend classification-covered; absence cannot be proven from click trace |
| Standalone graphic added/removed | Non-semantic schematic drawing object | Secondary green/red entry when enabled | Side-local green/red | Active side green/red | Not exercised; secondary items were hidden in the trace |
| Standalone graphic modified | Geometry-only modification | Intentionally omitted | Intentionally omitted | Intentionally omitted | By design |

Derived unconnected nets use the native terminal pin when available and fall back to the owning component. Only a truly source-less derived record shows the informational message: “This is a derived connectivity change with no standalone KiCad object to highlight.”

## PCB change matrix

PCB classification is physical and UUID/geometry based. The latest trace contains no PCB Difference-panel clicks, so the “Observed” column distinguishes automated coverage from manual evidence.

| Physical change | Classification | Composite | Side-by-side | Old/New | Compliance |
|---|---|---|---|---|---|
| Footprint added | Components / Added | Green footprint halo | Compare green only | New green only | Implemented; generic revision-overlay browser tests pass; not manually observed |
| Footprint removed | Components / Removed | Retained red footprint | Base red only | Old red only | Implemented; not manually observed |
| Footprint moved, rotated, flipped/layer-changed, or library identity changed | Components / Modified | Amber footprint | Amber both panes | Amber active side | Rotation was a discovered gap and is now fixed/tested; other geometry fields were already fingerprinted |
| Straight track added/removed/modified | Nets when net-owned | Green/red/amber route halo | Side-local A/R or amber both | Active-side status | Geometry and renderer-covered; not manually observed |
| Track arc added/removed/modified | Nets when net-owned | Green/red/amber route halo | Side-local A/R or amber both | Active-side status | Geometry and renderer-covered; not manually observed |
| Via added/removed/modified | Nets when net-owned | Status-colored via bounds | Side-local A/R or amber both | Active-side status | Geometry-covered; not manually observed |
| Copper zone outline/layer/net changed | Nets / A, R, or M | Status-colored zone bounds | Side-local A/R or amber both | Active-side status | Geometry-covered; not manually observed |
| Non-net zone added/removed/modified | Physical / Graphics secondary | Status-colored secondary halo | Side-local A/R or amber both | Active-side status | Implemented; not manually observed |
| Route metric change | Net detail only | Length/via/layer/barrel details in panel | Same logical selection | Same logical selection | Backend-covered; not manually observed |

## Trace findings and fixes

- Composite: all 33 selections completed as `applied`; average click-to-frame was 17.8 ms (4–65 ms), with zero parser invocations and zero document repaints.
- Side-by-side: all 18 selection transactions completed. Ten applied on both panes and eight applied only on Compare, matching the tested added/compare-only targets. Three Base-absent USB transitions were intentional.
- One Side-by-side page load failed because `S32G3_Boot_Config.kicad_sch` existed in the Compare source archive but was not instantiated in the Compare sheet hierarchy. Raw source presence has been replaced with resolved viewer-page availability.
- Old/New: the trace exposed stale work during both direction changes. Page selection, overlay installation, and selection ran against the previous revision before source replacement completed. All these operations are now gated by the exact `ecadReadyRevision`, with a deferred replacement regression test.
- Several revision overlay installations reported fewer resolved than requested targets (for example 52/90). Multi-page logical changes with a source lacking a page were being installed on every matching document. Such targets are now admitted only when navigation identifies one unambiguous document.
- The earlier `rotations` exception did not recur in this trace. Pin ownership and transform fallbacks remain covered by the ecad-viewer browser suite.
- No PCB interaction was recorded, so no claim of manual PCB compliance is made.

## Performance investigation

The recorded JTYU-OBC job ran from `00:39:21.752074` to `00:43:55.390447` UTC: **273.64 seconds**.

Four avoidable costs were identified and changed:

1. Each worker archived its entire commit, then deleted heavy outputs. The two commits contain 463.9 MiB and 464.4 MiB across all tracked files. The comparison inputs are 71.8 MiB and 72.3 MiB, so KiCad-only archive path selection removes about **84.5%** of snapshot input bytes.
2. Each revision cache serialized the semantic index twice as `semantic` and `design`. The compatibility duplicate is removed and the cache schema is advanced to v4.
3. The final 62,776,036-byte result included an unused full Base/Compare geometry sidecar. Removing only that property reduces the same compact JSON to 4,368,338 bytes, about a **93.0%** reduction. Native navigation retains the required bounds and source IDs.
4. Completion wrote the full result to both an atomic result file and the workspace PostgreSQL JSONB row. The database duplicate is removed; restart recovery continues to use the result file.

Per-revision logs now report snapshot, semantic-index, stackup, geometry, BOM, source-list, cache-write, revision-total, diff-assembly, result-publish, and comparison-total durations plus cache/result sizes.

A fresh post-deployment run of the same revision pair completed in **232.15 seconds**, an improvement of **41.49 seconds / 15.2%**:

| Stage | Base | Compare | Wall-time implication |
|---|---:|---:|---|
| Selective snapshot | 2.866 s | 2.856 s | Overlapped |
| Semantic index | 205.214 s | 202.799 s | Overlapped, but dominates the critical path |
| Stackup | 0.227 s | 2.625 s | Minor |
| Geometry | 13.987 s | 13.861 s | Overlapped |
| BOM | 5.437 s | 5.517 s | Overlapped |
| Cache write | 2.217 s | 1.171 s | Minor |
| Revision total | 230.030 s | 230.118 s | Revision-pipeline wall time: 230.131 s |
| Diff assembly |  |  | 1.966 s |
| Result publication |  |  | 0.047 s; final result 3.9 MiB |

The two revision workers do overlap, but schematic netlist/connectivity compilation is CPU-heavy Python work. Each worker remains in semantic extraction for roughly 203–205 seconds, so parallel scheduling cannot make the job faster than that longest phase and thread contention limits effective CPU parallelism. Snapshotting, geometry extraction, BOM generation, and result publication are no longer primary bottlenecks. The next performance project should profile and optimize `kicad_monkey.compile_design_netlist`, or isolate the two semantic compiles in processes after confirming memory headroom; changing worker count or adding more threads is not expected to materially improve this project.

## Known limitations / decisions needed

1. **PCB pad-only changes are not standalone records.** A pad size, drill, shape, or pad-net change that does not alter the indexed footprint geometry can be missed. Recommendation: add pad geometry/native UUID extraction and group net-owned pads under Nets, other pad geometry under Components.
2. **Footprint-internal graphics/text/courtyard edits are not fingerprinted.** Recommendation: hash paint-relevant footprint child geometry into the footprint record while keeping one logical component row.
3. **Zone rule changes are incomplete.** Outline, layer, width, and net are tracked; clearance, thermal, fill, priority, and keepout-rule-only changes may be missed. Recommendation: add a normalized zone-rule fingerprint and present its field deltas.
4. **Disconnected net rename ambiguity.** A net with neither terminals nor stable native overlap cannot be reliably paired across revisions, so a rename may appear as Removed + Added. Recommendation: keep this conservative behavior unless a sheet/name/nearest-geometry heuristic is explicitly accepted.
5. **Manual coverage is incomplete.** The supplied trace exercised Schematic Composite thoroughly, Schematic Side-by-side substantially, and one carried selection in Old/New, but no PCB entries and no independent Old/New net/label selections.
