#!/usr/bin/env bash
# CI entry: native/'s non-compiler gates, run by the quality gate's native-hygiene job. It runs
# first and the long native jobs wait for it, so it must stay fast and must not compile Rust.
#   1. the Rust structural-hygiene ratchet (rust_hygiene.sh) and its tests;
#   2. the committed parity corpus is present;
#   3. the Prism contracts build from TypeSpec and validate (npm ci; check:prism-contracts).
# The corpus round trip (parity_corpus.py sexpr-gate) runs in native-workspace, after the tests.
# Needs uv, Python >= 3.11 and Node 24 with npm.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${here}/.."
"${here}/rust_hygiene.sh"
uv run --quiet --no-project --python "${PRISM_HYGIENE_PYTHON:-3.12}" \
  --with-requirements "${here}/rust_hygiene_requirements.txt" \
  python "${here}/test_rust_hygiene.py"
python3 "${here}/parity_corpus.py" check
npm ci --no-audit --no-fund
npm run check:prism-contracts
