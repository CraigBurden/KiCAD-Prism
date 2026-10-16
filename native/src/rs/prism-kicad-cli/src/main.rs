//! `prism-kicad`, the command line of `native/contracts/prism/cli-spec.md`.
//! WP-B implements it; until then every invocation is a usage error.

use std::process::ExitCode;

fn main() -> ExitCode {
    eprintln!("prism-kicad: not implemented yet (WP-B)");
    ExitCode::from(2)
}
