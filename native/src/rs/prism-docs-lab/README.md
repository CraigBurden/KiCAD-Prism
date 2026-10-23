# prism-docs-lab

Documentation prototypes over a `.prism` design bundle: hand-run generators
that write self-contained HTML, SVG or PDF so a documentation idea can be
judged before it becomes product behaviour.

**This is not Release Studio.** Nothing here is queued by a job, served by the
API, shipped in an image or covered by the product's contracts. The prototypes
read only what a bundle already carries, make no network request, and are kept
in the repo so they stay deterministic and maintainable.

## Prototypes

| Binary | What it makes |
| --- | --- |
| `net-class-atlas` | One page per board: a section for each net class, with the board drawn in that class's traces, arcs, vias, zone fills and the pads of the footprints its nets reach, plus a table of the class's nets. |
| `connector-icd` | One A3 landscape interface control sheet per connector, in SVG, plus an index page and a PDF of it: identification, views of the part from its STEP model, a board locator and the pinout with the nets each pin reaches. |
| `mechanical-outline` | One or two A3 landscape sheets: a third-angle top view with holes, bodies and dimensions, front and side elevations with measured heights, a notes block, and height and hole tables. |

## Themes

Every prototype takes `--theme light|dark|blueprint` and defaults to `light`,
the ink-on-white look the pages were designed in. `light` is byte-identical to
the output from before the flag existed. `dark` and `blueprint` are for screens
and shared links: they put light ink on a dark page and tint every band, rule
and table, so a printed sheet uses a lot of ink. The roles:

| Role | `light` | `dark` | `blueprint` |
| --- | --- | --- | --- |
| paper | `#ffffff` | `#141416` | `#123a6b` |
| ink (outlines, text) | `#1d1d1f` | `#e6e6e8` | `#f2f6fb` |
| muted (captions) | `#6b6b70` | `#9a9aa2` | `#a9c1df` |
| rule (table rules, frame ticks) | `#c4c8cf` | `#3a3b40` | `#3e6496` |
| header (table band) | `#eef0f3` | `#22232a` | `#1a4a82` |
| stripe (alternate row) | `#f7f8fa` | `#1b1c21` | `#164477` |
| pad | `#c4c8cf` | `#5a5d66` | `#5d86b8` |
| body (mechanical outlines) | `#9a9aa0` | `#7c7f88` | `#c9d8ea` |
| alert (over-limit, DNP) | `#B00020` | `#ff6b7a` | `#ffb547` |
| frame | `#1d1d1f` | `#e6e6e8` | `#f2f6fb` |

The copper colours are not themed: they carry KiCad's layer meaning and stay
`F.Cu` red, `B.Cu` blue and the inner-layer table (`src/palette.rs`), drawn over
whatever paper the theme uses. A blueprint page is Prussian blue with warm
amber as its alert colour, because red does not read on blue.

The roles live in `src/theme.rs`; each `Theme::palette()` is the only place a
colour is chosen. The HTML pages keep one stylesheet: dark and blueprint write
the palette on `:root` and the same rules read those custom properties, while
`light` emits the stylesheet unchanged. Dark and blueprint pages ask the
printer for `print-color-adjust: exact` so a PDF keeps its background.

## Run one

From `native/`:

```sh
cargo run -p prism-docs-lab --bin net-class-atlas -- \
    --in <bundle.prism> -o <atlas.html> [--side top|bottom|both] \
    [--theme light|dark|blueprint]
```

The bundle needs its parse, board and models stages built (a `models.prism`
from `prism-kicad bundle build --stage models`). The output is one HTML file
with inline CSS, inline SVG and a little inline JavaScript: no external
request, no CDN. `--side` picks which footprints are drawn in full (pads and
designator); `both` adds a switch on the page.

The command prints one summary line: net classes, nets, tracks, vias, the
output size and how long the read and render took.

### What the atlas reads

| Member | Used for |
| --- | --- |
| `refilled/<stem>.kicad_pcb`, else `sources/<board>` | the board, parsed with `prism-kicad-core` |
| `projections/semantic-index.json` | each net's `netClass` |
| `projections/route-metrics.json` | per-net routed length and via count (layers come from the net's own tracks) |
| `projections/stackup.json` | the copper layer order |
| `projections/placements.json` | sides and courtyards |
| `models/assembly-hlr.json` | each footprint's body outline |

On the page, traces and pads take KiCad's default copper colours, a layer
checkbox hides that layer everywhere, and clicking a trace or a table row
isolates one net.

## Connector ICDs

```sh
cargo run -p prism-docs-lab --bin connector-icd -- \
    --in <bundle.prism> -o <dir> [--geometer <exe>] [--model-dir VAR=DIR]... \
    [--refs J1,J2] [--prefixes J,P,CN,X] [--exclude-prefixes JP] \
    [--exclude-refs J9] [--chrome <exe>] [--no-pdf] [--theme light|dark|blueprint]
```

Connectors are the footprints whose reference starts with one of `--prefixes`
(the defaults are `J`, `P`, `CN` and `X`) but with none of `--exclude-prefixes`
(default `JP`, KiCad's solder jumpers) and is not named in `--exclude-refs`, or
exactly the references named by `--refs`. Each one gets `<dir>/<ref>.svg`; a connector whose pinout does not
fit gets `<ref>-2.svg`, `<ref>-3.svg`, … and the sheet header says
`<ref> (2 of 3)`. `<dir>/index.html` inlines every sheet in order with a table
of contents, and `<dir>/connectors.pdf` is that page printed by headless
Chrome (`@page { size: A3 landscape; margin: 0 }`, one sheet per page).

A sheet carries:

1. **Identification** — reference, value, description, manufacturer, part
   number, substitutions, footprint, side, position, rotation, DNP and how the
   3D model fared. Only fields with values are printed.
2. **Views** — top (looking down the board normal, with the footprint's pads,
   pin numbers, pin-1 mark and the board edge overlaid), front (the mating
   face) and side, plus a small isometric, all hidden-line projections of the
   footprint's first STEP model. Outline edges print at 0.35 mm in ink, detail
   at 0.18 mm in grey, and the front and side views carry the overall width,
   depth and height as dimension lines. All of a connector's views share one
   scale, the largest at which every view fits its cell, and each states it (`6:1`).
3. **Locator** — the board outline with this connector filled in and the other
   connectors as labelled grey outlines.
4. **Pinout** — one row per pin in natural order (1, 2, 10, A1, A2, B1…): pin
   number, name, electrical type, net leaf (the full hierarchical name is a
   tooltip in the HTML), net class and the other components on the net (up to
   six, then `+n`). Power and ground rows are tinted; pads with no schematic
   terminal are listed last as `mechanical`.
5. **Title block** — board, design or revision key, connector, sheet n of N,
   and `Connector ICD — prototype`.

The mating face is a heuristic: the horizontal direction (±x or ±y in the
footprint's frame) in which the model's bounding box overhangs the pads
farthest, since a connector overhangs toward the board edge it mates across. A
part taller than it is wide with no overhang mates upwards, so its top view is
the mating face.

When the footprint names no STEP model — no model at all, only a `.wrl`, or
bytes the bundle cannot supply — the top view is drawn from the footprint
itself (pads plus its `F.Fab`/`F.SilkS` outline) and the other three cells say
`No 3D model — footprint view only`. The identification table records the
reason (`model-unavailable`, `model-not-step` or `projection-failed`).

### What the ICD reads

| Member | Used for |
| --- | --- |
| `refilled/<stem>.kicad_pcb`, else `sources/<board>` | footprints, pads, graphics and `(model …)` references |
| `projections/semantic-index.json` | component fields, terminals, pin names/types and net classes |
| `projections/placements.json` | side, position, rotation, DNP and courtyard |
| `sources/…` | the STEP models the board's `${KIPRJMOD}` paths name |
| `bundle.json` | the board name and the design or revision key |

A model is resolved exactly as the models stage resolves one: `${KIPRJMOD}`,
`${VAR}` through `--model-dir`, `$VAR`, `kicad-embed://` and the
`KICAD<n>_3DMODEL_DIR` fallback. `$(VAR)` is expanded as well, because KiCad
projects in the wild write it and the bundle carries the file it names.

Geometer is one process for the whole run (`--geometer`, else
`$GEOMETER_EXECUTABLE`); projections are cached in memory per model SHA-256,
pose and view. Without a Geometer runtime the ICD still writes every sheet,
with the footprint-only fallback. The PDF needs Chrome (`--chrome`, else
`$CHROME` or the platform's usual location); `--no-pdf` skips it.

Everything except the PDF is deterministic: the same bundle and arguments give
byte-identical SVG and HTML. The PDF comes from Chrome and may differ.

## The mechanical outline

```sh
cargo run -p prism-docs-lab --bin mechanical-outline -- \
    --in <bundle.prism> -o <dir> [--geometer <exe>] \
    [--model-dir VAR=DIR]... [--height-limit-mm 5.0] \
    [--theme light|dark|blueprint]
```

Writes `mechanical-1.svg`, `mechanical-2.svg` when the tables do not fit sheet
1, `index.html` (both sheets inline) and `mechanical.pdf` printed by headless
Chrome. The sheet is A3 landscape: a KiCad-style frame and zone grid, a
third-angle top view with every drill, slot and body, front and right-side
elevations, a notes block, and the height and hole tables.

The top view comes from the bundle: the board perimeter and cutouts from the
parsed board, bodies from `models/assembly-hlr.json`, holes and slots from the
parsed board, and the courtyard or pad envelope dashed when a footprint has no
outline. Heights and elevation silhouettes are measured at run time: one
Geometer process projects each distinct `(STEP model, pose, view)` and measures
its posed bounds, so a resistor shared by twenty placements costs one
projection. Without `--geometer` (or `$GEOMETER_EXECUTABLE`) the sheets still
render, with every height unknown.

Mounting holes are the largest drill of a footprint named `MountingHole*` or
referenced `H*`/`MH*`, plus board-level NPTH drills of 1 mm or more. An NPTH
drill inside a footprint that has nets is a locating peg, not a mounting hole.
A part with no STEP model is listed as height unknown; a non-STEP model's
authored Z offset is used as a stand-in when it has one.

The output is deterministic: sorted iteration, fixed precision, no clock. The
PDF is Chrome's and may differ between runs.

### Limits of the prototype

- The scale list holds enlargements only (1:1 to 5:1); a board larger than the
  sheet at 1:1 overflows rather than shrinking.
- The hole table holds 112 rows, then lists the count it left out. Vias are
  drawn but dropped first, so a via-heavy board lists its drilled pads.
- Overhang is measured against the board's bounding rectangle, not its true
  perimeter, so a notch or a round edge can overstate it.
- An elevation silhouette uses Geometer's outline edges only; no internal
  detail and no hidden lines.
- Heights are the posed STEP model's bounds: a model whose own origin sits
  below the board reads as a part below the bottom surface.

## Layout

- `src/lib.rs` — the parts a later prototype reuses: `bundle` (opening a
  bundle and reading its members), `palette` (KiCad's copper colours), `theme`
  (the three looks and their named colour roles), `html` (deterministic
  escaping, numbers and the page shell) and the shared stylesheet in
  `src/assets/`.
- `src/icd/` — the connector ICD's own modules: `board` (the facts),
  `footprint` (pads, fallback graphics and frame transforms), `pose` (the
  model-to-footprint transform and the mating-face heuristic), `hlr` (the
  Geometer session, model resolution and the projection cache), `pins`
  (natural order, power rows, connects-to), `sheet` (one A3 SVG: the frame and
  title block, `views` and `tables` beside it) and `page` (the index and its
  print rules).

- `src/mech/` — the mechanical outline's own modules: `board` (bundle facts),
  `geometer` (the one session and its cache), `layout` (scale and third-angle
  cells), `views` (top view and elevations), `tables` (height and hole
  tables), `draw` (SVG primitives and dimensions), `sheet` (frame, title
  block, notes, HTML) and `table`.
- `src/bin/<name>/` — one directory per prototype: `main.rs` (arguments and
  wiring) beside its own modules and assets.

Everything the atlas writes is deterministic: the same bundle and the same
arguments give a byte-identical file. There is no timestamp, no clock, no
environment read and no unordered iteration in the output.
