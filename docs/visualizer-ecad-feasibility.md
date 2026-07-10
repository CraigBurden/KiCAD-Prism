# ecad-viewer + Prism WebGPU visualizer feasibility

Date: 2026-07-10  
Status: Phase 0 feasibility complete; implementation is on `feature/ecad-webgpu-visualizer-reset`.

## Decision

The requested architecture is feasible. Use the hybrid approach:

1. ecad-viewer renders schematic and PCB source files.
2. ecad-viewer exposes a small, stable selection/control adapter.
3. Prism resolves those stable source identities through a lightweight semantic index.
4. The existing Prism WebGPU work is retained only for the 3D/semantic tab.

There is a reliable mapping path from selected ecad-viewer objects to KiCad source
UUIDs. The stop condition (“no reliable source identity”) was not reached.

The main technical caveat is KiCad 10 PCB net syntax. JTYU-OBC uses name-only net
references such as `(net "VBUS")`. Both the local ecad-viewer parser and current
KiCanvas model tracks/pads primarily as numeric net references. Object UUIDs still
parse, so Prism can enrich a selection through the sidecar, but ecad-viewer needs a
small parser/highlight patch before it can natively highlight these name-only nets.

## Reconciled sources

| Source | Revision inspected | Relevant state |
|---|---:|---|
| KiCAD-Prism `origin/main` | `5ba87fe` | Separate lazy ecad-viewer SCH/PCB tabs, online 3D viewer, iBoM iframe, designator-only SCH/PCB host orchestration |
| KiCAD-Prism semantic branch | `d4808d6` | Monolithic Prism viewer and asset job; usable WebGPU feature picking, component/net highlighting, semantic topology, BOM implementation |
| Local ecad-viewer main | `6e01118` | Host cross-probe API and relayed selection events |
| Local ecad-viewer PCB branch | `7b44296` | Component search and PCB selection improvements |
| Local ecad-viewer schematic-world branch | `4bf33f8` | World renderer, LOD and UUID highlighting; this renderer is not required for the new architecture |
| Local ecad-viewer working tree | uncommitted | Only world-app embed/export plumbing in the inspected checkout |
| krishna-swaroop/ecad-viewer `origin/main` | `a85abd4` | Older fork base, last commit 2026-01-30 |
| Latest upstream KiCanvas | `b031159` | New click-to-highlight footprints/nets plus loading and KiCad 10 schematic fixes |
| Keybored02/KiCAD-Prism `origin/dev` | `5577458` | ecad-viewer retained, React selection inspector, BOM cross-probe, hotkeys, PCB click workarounds |

The expected public `Keybored02/ecad-viewer` repository was not accessible at the
expected GitHub path. The bundled ecad-viewer artifact and integration in
Keybored02/KiCAD-Prism were inspected instead.

## Reconciliation findings

### What the local ecad-viewer fork added

- `setCrossProbeEnabled()` and `requestCrossProbe()` on the host element.
- `ecad-viewer:crossprobe:request` and `ecad-viewer:crossprobe:result` events.
- relaying `kicanvas:select` to the host with `sourceContext`.
- programmatic designator selection/focus for schematic symbols and PCB footprints.
- local PCB object selection for footprint, pad, track, via and zone objects.
- PCB component search and focus behavior.
- a separate schematic-world renderer with LOD, broad item picking and multi-UUID
  highlights.

Only the host adapter concepts should be retained. The schematic-world renderer and
its rendering changes should not be merged into the normal schematic path.

### What current upstream KiCanvas added after the local fork snapshot

- click-to-highlight PCB footprints and nets (`#185`);
- KiCad 10 schematic property visibility handling (`#182`);
- KiCad 9 rule-area and schematic-circle rendering;
- correct URL-decoded paths and hierarchical sheet paths, including Codeberg VFS;
- a context-menu based board pick flow and simplified embed/shell structure.

The current upstream selection event still has only `{ item, previous }`; it does not
provide a normalized public source identity. Upstream board picking returns a
`Footprint` or net-bearing object rather than guaranteeing the exact pad/track/via/
zone that was clicked.

### Can the local changes be cleanly rebased?

No. The repositories have diverged structurally and do not share the inspected commit
IDs as a usable rebase line. ecad-viewer contains its own shell, BOM/3D code, visitors,
selection menu and host APIs, while current KiCanvas refactored those areas. A blind
rebase or copy would be high risk.

Use a manual reconciliation branch:

1. choose the rendering/parser base deliberately;
2. port current upstream file-loading and format fixes;
3. retain local object-level PCB picking where it is more informative;
4. add the small normalized host adapter described below;
5. exclude the schematic-world renderer from Prism's normal SCH tab.

## A. ecad-viewer selection identity

The current local host event is:

```ts
{
  item: unknown;
  previous: unknown;
  sourceContext: "SCH" | "PCB";
}
```

`item` is the live parsed KiCad model object. The following fields are available in
practice, but are not yet normalized as a stable public contract.

| Selection | Stable/currently available identity |
|---|---|
| Schematic symbol | source `uuid`, reference property/getter, value, footprint, instance map, parent schematic filename |
| Schematic pin | source pin `uuid`, pin number, parent symbol UUID/reference, parent schematic filename |
| Schematic wire | source `uuid`; no resolved net on the render object |
| Local/global/hierarchical label | source `uuid`, text/name; no resolved net UID |
| Junction/no-connect | source `uuid`; connectivity is not stored on the render object |
| Sheet pin | source `uuid`, name, owning sheet reachable from the document model |
| PCB footprint | source `uuid`/legacy tstamp, reference, value, layer, properties |
| PCB pad | source `uuid`, pad number, parent footprint reference/UUID, net object when parsed |
| PCB track/arc/via | source `uuid`, net identifier/name when parsed, layer(s) |
| PCB zone | source `uuid`, net identifier/name, layer(s) |
| PCB graphic | source UUID and layer exist in the model, but graphics are not included in the local board selectable union |

`crossIndex` is not a sufficient stable global identity. The local implementation
constructs values such as `pad_5` and `symbol_pin_5`; these collide across components,
and the selected placed `PinInstance` does not consistently expose the corresponding
cross-index getter. Use `(reference, pin)` and source UUID instead.

Minimum event patch:

```ts
type EcadSemanticSelectionDetail = {
  sourceContext: "SCH" | "PCB";
  itemType: string;
  uuid?: string;
  reference?: string;
  pin?: string;
  net?: string;
  netCode?: number;
  sheet?: string;
  page?: string;
  layer?: string;
  crossIndex?: string;
  rawItem?: unknown;
};
```

Build this snapshot inside ecad-viewer while the typed object is available. Prism
should not depend on walking minifiable class internals or cyclic live objects.

## B. schematic semantic enrichment

The existing kicad-monkey design compiler already resolves schematic connectivity.
Its design JSON contains:

- component reference, schematic instance UUID and sheet UUID/name paths;
- terminal `(designator, pin)` plus source pin UUID/SVG ID;
- per-net source UUID lists for wires, labels, junctions, power ports, hierarchy
  ports and sheet entries;
- sheet-aware `svg_to_nets` indexes.

Therefore the sidecar can map:

| Source selection | Semantic mapping |
|---|---|
| symbol UUID/reference | `componentUid` and reference |
| pin UUID or `(reference,pin)` | `terminalUid`, `componentUid`, `netUid` |
| wire UUID | `netUid`, net name |
| label/global/hier label UUID | `netUid`, net name, sheet scope |
| junction UUID | `netUid` where the junction belongs to a compiled connected subgraph |
| no-connect UUID | explicit no-connect context; normally no electrical net |
| sheet pin UUID | hierarchical endpoint and resolved net |

The normal single-sheet local viewer currently makes wires/pins/symbols clickable,
but labels are not in its normal interactive pick layer. This requires a small picking
patch (not a renderer replacement) so labels and sheet pins can emit selections.

## C. PCB semantic enrichment

kicad-monkey's PCB model exposes footprint, pad, segment, track-arc, via and zone UUIDs,
their net references and layers, plus stackup metadata. A semantic-index generator can
join:

- footprint reference -> component;
- `(footprint reference, pad number)` -> terminal;
- pad/track/arc/via/zone UUID -> net;
- net name/code -> all matching PCB source UUIDs;
- graphics UUID -> layer;
- stackup layer -> material/thickness/electrical metadata.

The current `kicad_monkey.design.a0` artifact is schematic-connectivity rich but does
not yet emit the complete PCB UUID reverse indexes suggested for
`semantic-index.json`. The generator must add these by walking `design.pcb`; no new
connectivity engine is required.

### JTYU-OBC smoke evidence

The current kicad-monkey checkout successfully compiled JTYU-OBC:

- 24 schematic instances;
- 918 semantic components;
- 898 resolved schematic nets;
- 4,838 indexed wire UUIDs;
- 893 indexed label UUIDs;
- 1,432 indexed junction UUIDs;
- 3,531 indexed pin identities;
- 11,181 total schematic IDs in `svg_to_nets`.

Its PCB parser retained:

- 982/982 footprint UUIDs and references;
- 4,118/4,118 pad UUIDs;
- 13,559/13,559 segment UUIDs with named nets;
- 1,941/1,941 via UUIDs with named nets;
- 154/154 zone UUIDs, 146 with named nets;
- 1,374/1,374 track-arc UUIDs;
- stackup data.

This confirms that the sidecar data source is viable on the requested large manual
smoke project.

## D. cross-probe round trip

| Round trip | Feasibility | Missing work |
|---|---|---|
| SCH component -> PCB -> 3D | Yes | normalized ecad event; central bus; 3D adapter |
| PCB component -> SCH -> 3D | Yes | same |
| 3D component -> SCH/PCB | Yes | WebGPU component picking exists; web component must emit an outward selection event |
| SCH net -> PCB -> 3D | Yes, after patches | clickable label support, sidecar lookup, PCB net request implementation |
| PCB net -> SCH -> 3D | Yes, after patches | sidecar lookup, multi-UUID schematic highlight API |
| 3D net -> SCH/PCB | Yes, after patches | outward 3D selection event and ecad net request implementation |

The Prism WebGPU renderer already has GPU feature picking, `activeNetId`,
`selectedFeatureId`, component reference lookup, net tile residency and component/net
highlight shaders. Its web component currently exposes `setSelection()` but emits only
ready/error events. Internal 3D selections are not sent to React, so the outward event
is the primary missing 3D adapter.

The current ecad-viewer `requestCrossProbe()` implements `designator` and a limited
schematic-label UUID lookup. `net` and `crossIndex` return `not-implemented`.

## E. required ecad-viewer patch surface

Use Option 3 (hybrid).

Required:

1. Emit normalized selection snapshots with item type, source UUID and immediately
   available reference/pin/net/page/layer fields.
2. Preserve KiCad 10 name-only PCB nets in pad/track/arc/via/zone parser models.
3. Make schematic labels and sheet pins pickable in the normal single-sheet viewer.
4. Add a public PCB net highlight/focus request accepting net name and/or code.
5. Add a public normal-schematic multi-UUID highlight/focus request for the wire,
   label, junction and pin UUIDs supplied by Prism's sidecar.
6. Keep programmatic footprint/symbol focus by reference/UUID.

Not required:

- Prism UIDs on painter primitives;
- Prism metadata inside ecad-viewer model classes;
- the local schematic-world renderer;
- semantic asset generation inside ecad-viewer;
- full WebGPU assets before loading SCH/PCB.

## Explicit feasibility answers

- **Can selected schematic symbols map to component references?** Yes. The selected
  symbol carries source UUID and reference/property data.
- **Can selected schematic pins map to terminal/net context?** Yes through pin UUID or
  `(parent reference, pin number)` plus the semantic sidecar.
- **Can selected schematic wires/labels map to net context?** Wires: yes now through
  source UUID + kicad-monkey connectivity. Labels: semantically yes, but normal-view
  label picking needs the small interaction-layer patch.
- **Can selected PCB pads map to terminal/net context?** Yes through pad UUID, parent
  footprint reference and pad number. KiCad 10 net names need the parser patch or
  sidecar UUID lookup.
- **Can selected PCB tracks/vias/zones map to net context?** Yes through source UUID +
  sidecar. Older numeric-net files also expose net directly; KiCad 10 needs the net
  parser patch for direct metadata.
- **Can ecad-viewer accept programmatic component highlighting?** Yes for schematic
  symbols and PCB footprints by designator/UUID in the local adapter.
- **Can ecad-viewer accept programmatic net highlighting?** The underlying PCB viewer
  can highlight numeric nets, but the public request API does not implement `net`.
  Normal schematic full-net highlighting is also missing. Both need the small APIs
  above.
- **Minimum upstream/local changes?** Normalized selection event, KiCad 10 name-net
  parsing, normal-view label picking, public PCB net highlight, and normal-schematic
  multi-UUID highlight. Port upstream loading/format fixes manually; do not rebase the
  schematic-world work.

## Proposed implementation phases after approval

1. Restore the latest `origin/main` visualizer shell and retain ecad-viewer for SCH/PCB.
2. Extract `PrismSelection`, semantic lookup and deferred dispatch into a central bus.
3. Generate/cache `prism.semantic_index_a0` independently from heavy WebGPU assets.
4. Reconcile ecad-viewer on a focused branch and implement only the adapter/parser
   patch surface above.
5. Extract the semantic branch's WebGPU PCB/assembly renderer into a 3D-only web
   component with `selectionchange`, `setSelection`, readiness and error/status APIs.
6. Reuse the semantic branch BOM data/view selectively, with BOM as another bus client.
7. Add component tests first, then net tests, then the JTYU-OBC manual smoke.

Implementation is paused here for product/UI feedback.
