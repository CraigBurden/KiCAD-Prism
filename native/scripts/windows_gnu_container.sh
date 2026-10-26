#!/usr/bin/env bash
# Build and test native/ for Windows (the x86_64-pc-windows-gnu target, mingw-w64) in the pinned
# Rust image, from any host with Docker. Not the MSVC build: CI's native-platforms job builds that.
#
#   windows_gnu_container.sh linux cargo test --locked -p prism-bundle -p prism-kicad-cli
#   windows_gnu_container.sh win   cargo clippy --locked --target x86_64-pc-windows-gnu --all-targets -- -D warnings
#   windows_gnu_container.sh win   cargo build --locked --release --target x86_64-pc-windows-gnu -p prism-kicad-cli
#   windows_gnu_container.sh wine  cargo test --locked --target x86_64-pc-windows-gnu -p prism-bundle -p prism-kicad-cli
#   windows_gnu_container.sh export <dir>      copies prism-kicad.exe from the last release build to <dir>
#
# `linux` is the existing suite, to show the port changed nothing there. `wine` runs the Windows
# test executables under Wine: it covers the file, path and process code, not git.exe (the
# revision-key and reuse tests need a real Windows host), Job Objects or console Ctrl events.
# The tests run on a copy of the tree with text files converted to LF, so a Windows checkout
# (core.autocrlf=true) does not fail the fixtures.
set -euo pipefail

IMAGE="rust:1.98.0-bookworm"
TARGET_VOLUME="prism-native-win-target"
CARGO_VOLUME="prism-native-win-cargo"

if [[ -n "${PRISM_IN_CONTAINER:-}" ]]; then
  mode="$1"
  shift
  if [[ "$mode" == wine ]]; then
    apt-get update -qq >/dev/null
    apt-get install -y -qq gcc-mingw-w64-x86-64 wine64 >/dev/null 2>&1
    # Wine 8 has no bcryptprimitives.dll, which the Rust standard library imports.
    mkdir -p /stub
    printf '#include <windows.h>\nBOOLEAN WINAPI SystemFunction036(PVOID,ULONG);\n__declspec(dllexport) BOOL WINAPI ProcessPrng(PBYTE b, SIZE_T n){return SystemFunction036(b,(ULONG)n);}\n' >/stub/p.c
    x86_64-w64-mingw32-gcc -shared -o /stub/bcryptprimitives.dll /stub/p.c -ladvapi32
    export WINEARCH=win64 WINEPREFIX=/tmp/wp WINEDEBUG=-all
    export WINEPATH='Z:\usr\lib\gcc\x86_64-w64-mingw32\12-posix;Z:\usr\x86_64-w64-mingw32\lib;Z:\stub'
    export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUNNER=wine
    wineboot -i >/dev/null 2>&1 || true
  elif [[ "$mode" == win ]]; then
    apt-get update -qq >/dev/null
    apt-get install -y -qq gcc-mingw-w64-x86-64 >/dev/null 2>&1
  fi
  if [[ "$mode" != linux ]]; then rustup target add x86_64-pc-windows-gnu >/dev/null 2>&1; fi
  mkdir -p /work/native /work/backend/tests
  cp -a /src/. /work/native/
  cp -a /fixtures /work/fixtures
  cp -a /backend-fixtures /work/backend/tests/fixtures
  cd /work
  find . -type f -not -path './native/target/*' | while read -r file; do
    if grep -Iq . "$file" 2>/dev/null; then sed -i 's/\r$//' "$file"; fi
  done
  cd /work/native
  exec "$@"
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
  root="$(cd "$root" && pwd -W)"
  here="$(cd "$here" && pwd -W)"
fi
export MSYS_NO_PATHCONV=1

if [[ "$1" == export ]]; then
  mkdir -p "$2"
  docker run --rm -v "$(cd "$2" && (pwd -W 2>/dev/null || pwd)):/out" -v "$TARGET_VOLUME:/target" "$IMAGE" \
    cp /target/x86_64-pc-windows-gnu/release/prism-kicad.exe /out/
  exit 0
fi

mode="$1"
shift
exec docker run --rm \
  -v "$root/native:/src:ro" -v "$root/fixtures:/fixtures:ro" \
  -v "$root/backend/tests/fixtures:/backend-fixtures:ro" \
  -v "$here:/scripts:ro" \
  -v "$CARGO_VOLUME:/usr/local/cargo/registry" -v "$TARGET_VOLUME:/target" \
  -e CARGO_TARGET_DIR=/target -e PRISM_IN_CONTAINER=1 -w /src "$IMAGE" \
  bash /scripts/windows_gnu_container.sh "$mode" "$@"
