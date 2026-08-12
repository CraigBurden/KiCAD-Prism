# Release Studio pipeline

How one build turns a Git revision into a dossier. This is the current
behaviour, not a plan.

## Sequence

```text
input closure
    → catalogue wave A   (drc, erc, board_stats, positions, bom)
      ∥ Cruncher assembly views
    → catalogue wave B   (gerbers, drill, schematic.pdf)
    → projections        (one KiCadPcb parse, reused by the semantic index)
    → document engine    (layer plots + cover render + drill map;
                          testpoint Cruncher after the plot pool)
    → compose PDFs
    → canonicalize / fingerprint / package
```

There is no persistent Pcbnew or IPC-API session. Every tool is a cold
`subprocess.run` of `kicad-cli` or `kicad-cruncher`.

## Toolchain roles

| Tool | What it produces |
| --- | --- |
| `kicad-cli` | DRC/ERC, board stats, gerbers, Excellon, positions, BOM, schematic PDF, layer plots, cover render, drill map |
| `kicad-cruncher pcb-svg` | Assembly views (one board load, both sides) and a second load for testpoint views |
| `kicad-monkey` | Stackup / variants / testpoints / population projections, and the semantic index |
| Prism compose | Cover, fabrication, assembly, testpoint, and drill PDFs from one layout model |

## RAM fences

Each `kicad-cli` / Cruncher process holds the whole board. Caps are memory
fences, not core counts:

- catalogue: 6 concurrent steps
- artwork acquisition: 4 concurrent plots
- Cruncher assembly starts in wave A, beside the cheap catalogue steps
- testpoint Cruncher runs after that pool so it cannot steal a plot slot

## Typography

Compose reads `typography` from the **committed** configuration YAML. The
Release Studio panel's "Display typography" control only fills a copyable
template; it is not a build override. A configuration that omits the key
(JTYU-OBC's `default.yaml` does) uses Geist Pixel Square
(`geist-pixel-square`). To get KiCad NewStroke, commit:

```yaml
typography: kicad-newstroke
```

## Released drawings

The dossier's `documentation/` members are PDFs only: one file per document
(`cover`, `fabrication`, `assembly`, `testpoint`, `drill`). Page SVGs are the
same layout model rendered by a second backend; they stay in memory for tests
and are not released. In-app preview fetches the PDF.

## Evidence vs manifest

`build-evidence.json` carries projection text, per-step `elapsed_ms`, and
pipeline phase timings. None of that is hashed into `manifest.json` or a
technical-scope fingerprint. Wall clock must not move a build key.

## Hermeticity

Judged on the catalogue Prism actually runs. A named `.kicad_jobset` must be
present and parseable; destinations the catalogue does not execute (including
an unreferenced `special_execute`) do not taint the build.

A compose failure is a failed `documents` step (`returncode=1`, no sheet
members). Manufacturing members still assemble.
