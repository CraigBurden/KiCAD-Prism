# JLCPCB vendor configuration

`jlcpcb.config.json` is the plain-JSON form of Release Studio's
`backend/app/release_studio/vendors/jlcpcb.config.jsonc`; only `schema`
changes, from `kicad_cruncher.bom.config.a0` to
`prism.vendor.jlcpcb.config.a0`. It is the input of

```sh
prism-kicad vendor run jlcpcb --in <bundle.prism> --config jlcpcb.config.json -o <dir>
```

The comments below are the ones the JSONC file carries; they explain why each
value is pinned and are not part of the JSON.

## Why this file exists

`--format <kind>` emits one kind per invocation and explicitly "overrides
multi-output config mode", so asking for CSV and XLSX of both the BOM and the
CPL cost four full parses of the design. Config mode emits every listed kind
from one load. This file is hashed into `toolchain_digest` (see
`documents/renderer_resource_digest`), so editing it moves `build_key` instead
of silently changing a vendor pack under an unchanged one.

Two values are load-bearing and were found by diffing real output:

- **`include_dnp`** The Cruncher template ships `true`. Leaving it there added
  the board's do-not-populate parts to the BOM handed to the assembler -- on
  USB-PD that was R6, R7 and R13. `--format jlc-csv` excludes them, and so
  must we.
- **`group_fields`** The template ships `["mfg","mpn","description"]`.
  `--format` groups on value+footprint. On OBC the difference was real: 17
  resistors share one Value and one footprint but carry three different power
  ratings in their Description, so the template's key split one BOM line into
  three. Matching `--format` keeps this a performance change.

`variants.mode` is pinned to `base` because the template ships `all`, which
would emit a pack per variant. The caller passes `--variant` when a release
selects one.
