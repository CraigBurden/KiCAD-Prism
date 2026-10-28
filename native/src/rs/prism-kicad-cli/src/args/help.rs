//! The `-h` usage text, kept apart from the argument grammar.

/// The usage text of `-h`.
pub const HELP: &str = "prism-kicad: parse a KiCad revision once and write its design bundle

usage:
  prism-kicad version
  prism-kicad bundle build <project.kicad_pro> --stage parse -o <out.prism>
              [--source-root <dir>] [--revision-key <hex>] [--key-record <record.json>]
              [--upgraded <path>=<version>]... [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage board --in <bundle.prism> -o <out.prism>
              [--refilled-board <board.kicad_pcb> --refill-tool <kicad-version>]
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage models --in <bundle.prism> -o <out.prism>
              --models-glb <components.glb> --models-tool <kicad-version>
              [--geometer <exe> [--model-dir <VAR>=<dir>]... [--hlr-cache <dir>]]
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle verify <bundle.prism> [COMMON]
  prism-kicad bundle extract <bundle.prism> <member>... -o <dir> [COMMON]
  prism-kicad bundle reuse --in <bundle.prism> --key-record <record.json> [COMMON]
  prism-kicad revision-key <repo> (--commit <rev> | --worktree) --project <rel>
              [--config <effective.json>] [COMMON]
  prism-kicad compare (--base <base.prism> | --base-src <project.kicad_pro>
              [--base-source-root <dir>] [--base-config <effective.json>]
              [--base-upgraded <path>=<version>]...) --base-revision-key <hex>
              (--head <head.prism> | --head-src … as for the base) --head-revision-key <hex>
              [--include-unchanged] -o <result.json> [COMMON]
  prism-kicad vendor list [COMMON]
  prism-kicad vendor run <vendor-id> --in <bundle.prism> --config <cfg.json>
              -o <dir> [--variant <name>] [COMMON]
  prism-kicad artwork --in <bundle.prism> --config <artwork.json>
              --view <name>... -o <dir> [--variant <name>]
              [--paper-scale <ratio>] [COMMON]
  prism-kicad stroke-text (--request <runs.json> | --metrics) [COMMON]
  prism-kicad drawing-sheet --request <sheet.json> [COMMON]

COMMON: [--limit <name>=<value>]... [--threads <n>] [--quiet]

Every command writes one JSON document to stdout and JSON Lines to stderr
(native/contracts/prism/cli-spec.md).
";
