#!/usr/bin/env bash
set -euo pipefail

PRISM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECAD_VIEWER_DIR="${ECAD_VIEWER_DIR:-${PRISM_ROOT}/../ecad-viewer-prism-refactor}"
APP_DIR="${ECAD_VIEWER_DIR}/packages/ecad-viewer-app"
PUBLIC_DIR="${PRISM_ROOT}/frontend/public"
UPSTREAM_COMMIT="$(tr -d '[:space:]' < "${PRISM_ROOT}/scripts/ecad-viewer-upstream.lock")"

git -C "${ECAD_VIEWER_DIR}" merge-base --is-ancestor "${UPSTREAM_COMMIT}" HEAD
node "${APP_DIR}/scripts/build.js"

install -m 0644 "${APP_DIR}/build/ecad-viewer.js" "${PUBLIC_DIR}/ecad-viewer.js"
install -m 0644 "${APP_DIR}/build/parser.worker.js" "${PUBLIC_DIR}/parser.worker.js"

ADAPTER_COMMIT="$(git -C "${ECAD_VIEWER_DIR}" rev-parse HEAD)"
ECAD_SHA="$(shasum -a 256 "${PUBLIC_DIR}/ecad-viewer.js" | awk '{print $1}')"
WORKER_SHA="$(shasum -a 256 "${PUBLIC_DIR}/parser.worker.js" | awk '{print $1}')"
BUILD_VERSION="prism-host-adapter-v2.1"

cat > "${PUBLIC_DIR}/ecad-viewer.manifest.json" <<EOF
{
  "schema": "prism.ecad_viewer_build_a0",
  "version": "${BUILD_VERSION}",
  "upstreamCommit": "${UPSTREAM_COMMIT}",
  "adapterCommit": "${ADAPTER_COMMIT}",
  "artifacts": {
    "ecad-viewer.js": "sha256:${ECAD_SHA}",
    "parser.worker.js": "sha256:${WORKER_SHA}"
  }
}
EOF

echo "Built ecad-viewer ${BUILD_VERSION} from ${ADAPTER_COMMIT}"
