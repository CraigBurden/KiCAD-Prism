#!/usr/bin/env bash
# CI entry: the fork's wasm32 job (materializer.yml "wasm32") plus the wasm-bindgen tests its
# Windows exit gate ran. Needs the wasm32-unknown-unknown target, Node 24 and a wasm-bindgen CLI
# (wasm-bindgen-test-runner) of the version Cargo.lock pins.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
locked="$(sed -n '/^name = "wasm-bindgen"$/{n;s/^version = "\(.*\)"$/\1/p;}' Cargo.lock)"
runner="$(wasm-bindgen-test-runner --version 2>/dev/null | awk '{print $2}' || true)"
if [[ "${runner}" != "${locked}" ]]; then
  echo "wasm-bindgen-test-runner is '${runner}', Cargo.lock pins ${locked}:" >&2
  echo "  cargo install wasm-bindgen-cli --version ${locked} --locked" >&2
  exit 1
fi
cargo build --locked --target wasm32-unknown-unknown \
  -p prism-kicad-contracts -p prism-kicad-core -p prism-kicad-materialization-pack
cargo clippy --locked --target wasm32-unknown-unknown -p prism-kicad-wasm \
  --no-default-features --features materialization -- -D warnings
cargo check --locked --target wasm32-unknown-unknown -p prism-kicad-wasm \
  --no-default-features --features materialize
cargo clippy --locked --target wasm32-unknown-unknown -p prism-kicad-wasm -- -D warnings
cargo test --locked --target wasm32-unknown-unknown -p prism-kicad-wasm
