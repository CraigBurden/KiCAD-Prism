#!/usr/bin/env bash
# CI entry: the fork's per-platform materializer job (native/.github/workflows/materializer.yml,
# "native"), run by the quality gate's native-platforms job on linux arm64 and macOS. Linux
# amd64 runs the whole workspace in native-workspace. Parse-stage members must be byte-identical
# across these platforms (decisions.md, Conventions 3), so the producer and pack tests run on each.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
cargo test --locked -p prism-kicad-contracts -p prism-kicad-materialization-pack
tests=()
for file in src/rs/prism-kicad-core/tests/board_materialization_*.rs; do
  tests+=(--test "$(basename "${file}" .rs)")
done
cargo test --locked -p prism-kicad-core --lib board_materialization
cargo test --locked -p prism-kicad-core "${tests[@]}"
cargo test --locked -p prism-kicad-wasm --lib materialization
cargo test --locked -p prism-bundle -p prism-projections -p prism-kicad-cli
