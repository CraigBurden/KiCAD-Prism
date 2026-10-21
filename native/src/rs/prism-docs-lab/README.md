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

## Layout

- `src/lib.rs` — the parts a later prototype reuses: `bundle` (opening a
  bundle and reading its members), `palette` (KiCad's copper colours), `html`
  (deterministic escaping, numbers and the page shell) and the shared
  stylesheet in `src/assets/`.
- `src/bin/<name>/` — one directory per prototype: `main.rs` (arguments and
  wiring) beside its own modules and assets.

Everything is deterministic: the same bundle and the same arguments give a
byte-identical file. There is no timestamp, no clock, no environment read and
no unordered iteration in the output.
