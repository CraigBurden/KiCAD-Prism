#!/usr/bin/env bash
# Run the Rust hygiene ratchet (rust_hygiene.py) with its pinned, hashed inputs.
# Needs uv and Python >= 3.11. Arguments pass through: --prune, --record "why".
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec uv run --quiet --no-project --python "${PRISM_HYGIENE_PYTHON:-3.12}" \
    --with-requirements "$here/rust_hygiene_requirements.txt" \
    python "$here/rust_hygiene.py" "$@"
