# prism-docs-lab

Documentation prototypes over a `.prism` design bundle: hand-run generators
that write one self-contained HTML file so a documentation idea can be judged
before it becomes product behaviour.

**This is not Release Studio.** Nothing here is queued by a job, served by the
API, shipped in an image or covered by the product's contracts. The prototypes
read only what a bundle already carries, make no network request, and are kept
in the repo so they stay deterministic and maintainable.

## Prototypes

| Binary | What it makes |
| --- | --- |
| `net-class-atlas` | One page per board: a section for each net class, with the board drawn in that class's traces, arcs, vias, zone fills and the pads of the footprints its nets reach, plus a table of the class's nets. |
| `mechanical-outline` | One or two A3 landscape sheets: a third-angle top view with holes, bodies and dimensions, front and side elevations with measured heights, a notes block, and height and hole tables. |

## Run one

From `native/`:

```sh
cargo run -p prism-docs-lab --bin net-class-atlas -- \
    --in <bundle.prism> -o <atlas.html> [--side top|bottom|both]
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
| `projections/route-metrics.json` | per-net routed length, vias, used layers |
| `projections/stackup.json` | the copper layer order |
| `projections/placements.json` | sides and courtyards |
| `models/assembly-hlr.json` | each footprint's body outline |

On the page, traces and pads take KiCad's default copper colours, a layer
checkbox hides that layer everywhere, and clicking a trace or a table row
isolates one net.

## The mechanical outline

```sh
cargo run -p prism-docs-lab --bin mechanical-outline -- \
    --in <bundle.prism> -o <dir> [--geometer <exe>] \
    [--model-dir VAR=DIR]... [--height-limit-mm 5.0]
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
  bundle and reading its members), `palette` (KiCad's copper colours), `html`
  (deterministic escaping, numbers and the page shell) and the shared
  stylesheet in `src/assets/`.
- `src/mech/` — the mechanical outline's own modules: `board` (bundle facts),
  `geometer` (the one session and its cache), `layout` (scale and third-angle
  cells), `views` (top view and elevations), `tables` (height and hole
  tables), `draw` (SVG primitives and dimensions), `sheet` (frame, title
  block, notes, HTML) and `table`.
- `src/bin/<name>/` — one directory per prototype: `main.rs` (arguments and
  wiring) beside its own modules and assets.

Everything is deterministic: the same bundle and the same arguments give a
byte-identical file. There is no timestamp, no clock, no environment read and
no unordered iteration in the output.
