# Release Studio configuration

Release configurations are committed YAML files at:

```text
.prism/release-studio/configurations/<key>.yaml
```

The required schema is `prism.release-studio.configuration/1`. Prism accepts
only known keys and requires `title`, `board`, `schematic`, and **`jobset`**.
All file references are POSIX, repository-root-relative paths that resolve to
regular files inside the selected commit. Absolute paths, `..`, Windows path
forms, and escaping symlinks are rejected.

```yaml
schema: prism.release-studio.configuration/1
title: USB-PD production release
board: hardware/usb-pd.kicad_pcb
schematic: hardware/usb-pd.kicad_sch
jobset: hardware/Outputs.kicad_jobset
default_variant: default
variants:
  - default
  - assembly-reduced
document_number: USBPD-100
revision: A
typography: geist-pixel-square
vendors:
  - jlcpcb
fields:
  manufacturing_ipc_class: IPC-6012 Class 2
  assembly_ipc_class: IPC-A-610 Class 2
  solder_mask_colour: Green
  via_treatment: Tented
policy:
  path: .prism/release-studio/policies/production.yaml
```

Optional configuration keys are `default_variant`, `variants`, `fields`,
`notes`, `document_number`, `revision`, `template`, `sheets`, `typography`,
`vendors`, and `policy`. `typography` selects a committed rendering input;
the panel's display/template controls do not override a build. Omitted vendors
currently default to `jlcpcb`; an explicit empty list selects none.

## Settings authoring

Settings is the normal configuration authoring surface. **Save & publish** runs
under the repository write lock shared with Sync. Prism fetches the tracked
branch, validates the complete mapping in an isolated checkout, creates a
configuration-only commit, and pushes it with a lease against that fetched
upstream revision. Only after the push succeeds does Prism fast-forward its
local mirror and select the published full commit SHA.

A rejected push, protected branch, missing write credential, concurrent remote
update, dirty tracked mirror, or unrelated local commit fails closed. Prism
does not leave a local-only configuration commit and does not implicitly push
unrelated changes. Use the repository's normal access policy to grant the Prism
machine identity permission to publish this governed configuration path.

Git tracking remains required: a build must be reproducible from one immutable
revision, including the configuration that selected its source files,
documentation metadata, policy and manufacturer outputs. The user does not
need to create, edit, commit, or separately push the YAML.

The four manufacturing fields above have controlled document placement:

- manufacturing and assembly IPC classes appear in the cover's
  **Manufacturing & Assembly Spec** table;
- solder-mask colour and via treatment appear in the cover's
  **Board Characteristics** table;
- via type/count/span statistics are projected from the board and appear on
  the Drill page. They are not manually declared counts.

## Semantics

- **Revision API boundary:** release configuration and build APIs accept only a
  full immutable 40-character commit SHA. The UI may accept `HEAD` or a short
  SHA only as a convenience when it exactly matches a listed commit; it
  immediately resolves that input to the listed full SHA before calling either
  API. Arbitrary branches and other refs are rejected.
- **Configuration and revision:** Prism loads and normalizes the configuration
  at the chosen commit. The resulting normalized mapping is snapshotted and
  digest-bound to the build.
- **Variant:** the requested named variant is part of the technical build
  identity. It changes population-dependent artifacts such as BOM/CPL and can
  change approvals' technical scope.
- **Documents:** document metadata, templates, sheets, notes, fields, and
  typography are build inputs when configured. Composed PDFs are released
  members, not editable UI output.
- **Vendors:** selected profile IDs are technical inputs. A selected profile is
  vendor-ready only when its complete profile artifacts are present. JLCPCB
  readiness requires Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and
  `cpl.xlsx`.
- **Policy:** policy is governance input, not technical input. A project
  overlay may point directly to
  `.prism/release-studio/policies/<key>.yaml`, use `{path: ...}`, or extend a
  pinned organization policy such as `org:manufacturing@3`. An unpinned
  `org:manufacturing` reference is rejected.

## Digests and snapshots

`technical_config_digest` is the SHA-256 of canonical JSON for the normalized
technical configuration. It excludes the policy binding; a policy-only change
can require a new evaluation/approval without changing released technical
bytes. The complete input closure separately records repository files,
submodules, LFS materialization, verified toolchain resources, environment
bindings, and library resolution. Its digest and the pinned executor identity
are part of build identity.

Substitutions use only `{{namespace.key}}`-style tokens. Missing values,
malformed braces, and recursive replacement are errors rather than silent
empty text.
