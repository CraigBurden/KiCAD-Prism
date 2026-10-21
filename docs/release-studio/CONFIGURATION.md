# Release Studio inputs

Release Studio no longer requires a committed Prism YAML to start a build.
Per-release inputs are entered in the UI and synthesized into the configuration
mapping the document engine and closure already consume.

## What the UI collects

### Source (discovered + selected)

At the chosen commit, Prism discovers KiCad files from the imported project
(`GET .../source?commit_sha=`):

- board (`.kicad_pcb`)
- schematic (`.kicad_sch`)
- variants (the shared catalog discovery, with the explicit `default` entry first)
- BOM presets from the schematic (`kicad-cli sch export bom --preset`)

The variant list is the same service behind the Visualizer's variant selector;
`default` is the native design, not a KiCad variant name.

The user confirms board, schematic, variant, and BOM preset. These paths
and the commit SHA are sent with the build request. The Source picks are
also stored on `ws_projects.release_studio_defaults` so a later release of the
same project can pre-fill them. A saved path is applied only when it still
exists at the selected commit (`GET .../source` after `PUT .../source/defaults`).
A saved named variant that the revision no longer has falls back to `default`
rather than another named variant. Identity, manufacturing, and the commit SHA
are not stored there.

### Identity

- **tag** — forge Release name and drawing REVISION
- **document_name** — cover DOCUMENT field (formerly document number)
- **date** — user-entered cover DATE
- **notes** — release notes

There is no separate revision name and no PCB field editing.

### Manufacturing

Per-release manufacturing fields (not committed to Git):

| Field | Purpose |
| --- | --- |
| `manufacturing_ipc_class` | Cover **Manufacturing & Assembly Spec** |
| `assembly_ipc_class` | Cover **Manufacturing & Assembly Spec** |
| `solder_mask_colour` | Cover **Board Characteristics** |
| `silkscreen_colour` | Cover **Board Characteristics** |
| `via_treatment` | Cover **Board Characteristics** |
| `vendors` | Manufacturer pack profile IDs |
| `impedance_csv` | Optional controlled-impedance table on fabrication |
| `stackup_pdf_b64` | Optional vendor stackup PDF appended to fabrication |

Via type, count, and span statistics are projected from the board and appear on
the Drill page. They are not manually declared counts.

## IPC and board-characteristic dropdowns

Options are returned with the source payload. The stored value is the printed
string (for example `IPC-6012 Class 2` or `Green`) or the free-text value when
**Other** is selected.

**Manufacturing IPC**

- IPC-6012 Class 1 / 2 / 3
- IPC-6013 Class 1 / 2 / 3
- Other (free text)

**Assembly IPC**

- IPC-A-610 Class 1 / 2 / 3
- J-STD-001 Class 1 / 2 / 3
- Other (free text)

**Solder mask colour**

- Green, Matte Green, Black, Matte Black, White, Red, Blue, Purple, Yellow
- Other (free text)

**Silkscreen colour**

- White, Black, Yellow
- Other (free text)

**Via treatment**

- Tented, Untented, Plugged, Filled, Filled and capped
- Other (free text)

## Impedance CSV template

Download: `GET .../impedance-template.csv`

Columns:

| Column | Meaning |
| --- | --- |
| Type | SE or DIFF |
| Name | Net or pair name |
| Layer pair | For example `F.Cu-In1.Cu` |
| Target Z (Ω) | Target impedance |
| Tolerance (Ω) | Allowed deviation |
| Width (mm) | Trace width |
| Spacing (mm) | Pair spacing (DIFF) |
| Notes | Free text |

When uploaded, Prism typesets impedance table pages onto the fabrication PDF
after the layer plots.

## Synthesized configuration

At build time, `synthesize_configuration` assembles a normalized mapping from
identity, manufacturing, and the selected KiCad paths. That mapping is
validated, snapshotted, and digest-bound to the build. It includes document
metadata, IPC fields, variant, vendors, `bom_preset`, typography, sheet
style, and artwork line weights.

## Sheet style and typography

Two committed configuration keys choose how the composed drawing sheets look.
Both are technical inputs: they are part of `technical_config_digest` and the
build identity.

| Key | Values | Default | Effect |
| --- | --- | --- | --- |
| `sheet_style` | `prism`, `kicad` | `prism` | `prism` uses the harness palette: an ink-black frame and title block, grey rules and tints, and colour only where it carries meaning (do-not-populate red). `kicad` reproduces KiCad's red worksheet and plain tables unchanged. |
| `typography` | `geist-pixel-square`, `geist-pixel-grid`, `geist-pixel-circle`, `geist-pixel-triangle`, `geist-pixel-line`, `kicad-newstroke` | `geist-pixel-square` | The bundled face used for sheet text. `kicad-newstroke` draws KiCad's stroke vectors and covers symbols such as ⌀ and ✓ that the Geist faces lack. |
| `artwork_line_weights` | `paper`, `drawing` | `paper` | How assembly and testpoint artwork strokes and designator limits are measured. `paper` prints them at their configured size: the artwork is drawn at the sheet's ratio, so a 0.35 mm outline prints 0.35 mm at any scale. `drawing` keeps the same numbers in board millimetres, so they grow with the drawing (a 0.35 mm outline prints 1.75 mm at 5:1); it is kept for compatibility. |

`prism` keeps KiCad's worksheet geometry exactly — outer and inner frame, the
A–F / 1–8 zone grid and its labels — and changes only how it is painted. The
title block keeps its fields and layout; its title row is tinted `#eef0f3`,
alternate field rows are striped `#f7f8fa`, labels are muted `#6b6b70` and
values are ink `#1d1d1f`. Every schedule is drawn as a boxed table with thin
`#c4c8cf` rules, a tinted header band and alternate row stripes, and continues
to use the standard scale series.

`kicad` is retained so a project can match the rest of its KiCad drawing set.
It is byte-for-byte the output the engine produced before `prism` became the
default.

`artwork_line_weights` applies to the assembly and testpoint views. In `paper`
mode the build chooses the document set's sheet size and ratio before drawing,
then passes that ratio to `prism-kicad artwork --paper-scale`; the sheet is
placed at the same ratio, so the drawing's stated scale is the one its strokes
were sized for. The committed artwork configs are tuned for paper: ISO 128-20
line widths (0.35 mm for the board outline and cutouts, 0.25 mm for component
bodies and pad envelopes, 0.18 mm for DNP hatching and other fine detail) and
the ISO 3098 minimum text height of 1.8 mm, with designators
capped at 2.5 mm. Designators still fit inside each body, and may still shrink
below the configured minimum when the body is too small. The bundle path of
these views needs the design bundle's `parse`, `board` and `models` stages.

`drawing` is kept for compatibility: the numbers in the same config files are
then read as board millimetres and are not divided, so the ink grows with the
drawing scale. Geometry, the canvas margin, and the DNP hatch spacing are never
divided in either mode because they describe the board rather than the ink.

## Cover and title block

| Field | Source |
| --- | --- |
| DOCUMENT | Document Name |
| REVISION | tag |
| DATE | user-entered date |
| COMMIT | short SHA |
| VARIANT | selected variant |

**Revision history** on the cover lists this release first, then prior
GitHub/GitLab Releases fetched via the forge API. Columns: Tag, Date, Commit,
Message. The forge title is the tag. If the API fails, only the current row is
shown.

Board characteristics include solder mask, silkscreen, and via treatment.
Manufacturing and assembly spec lines come from the IPC fields.

## Committed YAML leftover

Committed YAML under `.prism/release-studio/configurations/` is leftover from
an earlier authoring path. The running product does not expose `GET`/`PUT`
configuration endpoints. Per-release Identity and Manufacturing are entered in
the UI and snapshotted onto the build.

A project's `.kicad_jobset` is not a Release Studio input. Exports come from
the pinned catalogue, not `kicad-cli jobset run`. A jobset key in committed
YAML is optional leftover and is ignored by the pipeline.

The required schema remains `prism.release-studio.configuration/1`. File
references are POSIX paths that resolve to regular files inside the selected
commit.

**Where a configuration lives.** A project's configurations are under
`<project folder>/.prism/release-studio/configurations/`, and their file
references are relative to the project folder. For a project at the repository
root that is the repository root. For a monorepo subproject it is the
subproject's folder: Settings saves there, and reads at a commit (candidates,
builds) read there, turning the references into repository paths for the
closure. A subproject never reads the repository root's configurations, so
Settings and the at-commit listing show the same set (see `docs/UPGRADES.md`
to move older root-level files into the subproject).

## Semantics

- **Revision API boundary:** release and build APIs accept only a full
  immutable 40-character commit SHA. The UI may accept `HEAD` or a short SHA
  only as a convenience when it exactly matches a listed commit; it
  immediately resolves that input to the listed full SHA before calling either
  API. Arbitrary branches and other refs are rejected.
- **Variant:** the requested named variant is part of the technical build
  identity. It changes population-dependent artifacts such as BOM/CPL. The
  `default` entry maps to the executor's native-design sentinel: no
  `--variant` flag is passed and the sentinel is never persisted as a KiCad
  variant name.
- **Documents:** composed PDFs are released members, not editable UI output.
- **Vendors:** selected profile IDs are technical inputs. A selected profile is
  vendor-ready only when its complete profile artifacts are present. JLCPCB
  readiness requires Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and
  `cpl.xlsx`.

## Digests and snapshots

`technical_config_digest` is the SHA-256 of canonical JSON for the normalized
technical configuration. The complete input closure separately records
repository files, submodules, LFS materialization, verified toolchain resources,
environment bindings, and library resolution. Its digest and the pinned executor
identity are part of build identity.

Substitutions use only `{{namespace.key}}`-style tokens. Missing values,
malformed braces, and recursive replacement are errors rather than silent empty
text.
