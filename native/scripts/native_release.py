#!/usr/bin/env python3
"""Build native/'s release artifacts: prism-kicad binaries and the wasm package.

Replaces the fork's PyPI wheel release (ADR section 4.2, WP-F3). One release
is, for the version of ``prism-kicad-cli``:

- ``prism-kicad-<v>-linux-amd64.tar.gz``, ``-linux-arm64`` and ``-macos-arm64``
  (macOS is for development);
- ``prism-kicad-wasm-<v>.tgz``, an npm-installable package of
  ``prism-kicad-wasm`` (wasm-bindgen ``--target web``);
- ``SHA256SUMS`` and ``release.json``.

Linux binaries are built exactly the way ``backend/Dockerfile``'s
``prism-kicad-builder`` stage builds the worker image's ``/usr/local/bin/prism-kicad``:
same ``rust:<NATIVE_RUST_VERSION>-bookworm`` image, same ``/build/native``
path, same pruned workspace and lock check. ``image-check`` builds that stage
and proves the image and the release ship the same bytes, which matters
because ``board.kmpack`` is byte-identical only for the same binary
(decisions.md, Conventions 3).

Commands (from anywhere)::

    native_release.py binary --platform linux-amd64|linux-arm64|macos-arm64 [--out DIR]
    native_release.py wasm [--out DIR]
    native_release.py assemble [--out DIR]       SHA256SUMS, release.json, local-path check
    native_release.py image-check --platform linux-arm64 [--out DIR]
    native_release.py dry-run [--out DIR] [--platform P ...] [--image-check]

``dry-run`` runs binary for each platform, wasm and assemble into ``--out``
(default ``native/target/release-dist``). Linux builds need Docker; on a
host of the other architecture Docker emulates it (slow but correct). The
wasm package needs the ``wasm32-unknown-unknown`` target and a
``wasm-bindgen`` CLI of the version ``Cargo.lock`` pins (``WASM_BINDGEN`` or
PATH): ``cargo install wasm-bindgen-cli --version <v> --locked``.

Exit status: 0 success, 1 a build or check failed, 2 usage error.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import platform as host_platform
import re
import shutil
import subprocess
import sys
import tarfile
import tomllib
from collections.abc import Sequence
from pathlib import Path

NATIVE = Path(__file__).resolve().parents[1]
REPO = NATIVE.parent
DOCKERFILE = REPO / "backend" / "Dockerfile"
DEFAULT_OUT = NATIVE / "target" / "release-dist"
CLI_MANIFEST = NATIVE / "src" / "rs" / "prism-kicad-cli" / "Cargo.toml"
WASM_CRATE = "prism-kicad-wasm"
WASM_PACKAGE = "@kicad-prism/prism-kicad-wasm"
LINUX = {"linux-amd64": "amd64", "linux-arm64": "arm64"}
MACOS = {"macos-arm64": "aarch64-apple-darwin"}
PLATFORMS = (*LINUX, *MACOS)
# The worker image's builder stage, verbatim in effect (backend/Dockerfile, prism-kicad-builder).
CONTAINER_BUILD = r"""
set -euo pipefail
mkdir -p /build/native/src && cd /build/native
cp -a /src/Cargo.toml /src/Cargo.lock /src/rust-toolchain.toml /src/clippy.toml /src/.cargo /src/assets .
cp -a /src/src/rs src/rs
cp Cargo.lock /tmp/Cargo.lock.locked
cargo build --release -p prism-kicad-cli
awk '/^name = /{n=$3} /^version = /{print n, $3}' /tmp/Cargo.lock.locked | sort -u > /tmp/locked.pairs
awk '/^name = /{n=$3} /^version = /{print n, $3}' Cargo.lock | sort -u > /tmp/built.pairs
if [ -n "$(comm -13 /tmp/locked.pairs /tmp/built.pairs)" ]; then
  echo "a crate is not at its locked version:" >&2; comm -13 /tmp/locked.pairs /tmp/built.pairs >&2; exit 1
fi
install -m 0755 target/release/prism-kicad /out/prism-kicad
rustc --version > /out/rustc-version
"""


class ReleaseError(Exception):
    pass


def run(command: Sequence[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    result = subprocess.run(command, text=True, check=False, **kwargs)  # type: ignore[call-overload]
    if result.returncode != 0:
        raise ReleaseError(f"{command[0]} {command[1] if len(command) > 1 else ''} failed ({result.returncode})")
    return result


def version() -> str:
    return tomllib.loads(CLI_MANIFEST.read_text())["package"]["version"]


def dockerfile_arg(name: str) -> str:
    match = re.search(rf"^ARG {name}=(\S+)", DOCKERFILE.read_text(), re.MULTILINE)
    if not match:
        raise ReleaseError(f"backend/Dockerfile has no ARG {name}")
    return match.group(1)


def locked_version(crate: str) -> str:
    match = re.search(rf'name = "{re.escape(crate)}"\nversion = "([^"]+)"', (NATIVE / "Cargo.lock").read_text())
    if not match:
        raise ReleaseError(f"{crate} is not in Cargo.lock")
    return match.group(1)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def deterministic_tgz(target: Path, members: Sequence[tuple[str, Path]]) -> None:
    """A gzip'd tar with fixed metadata (mtime 0, root:root, sorted), so equal inputs give equal bytes."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w", format=tarfile.PAX_FORMAT) as archive:
        for name, source in sorted(members):
            info = tarfile.TarInfo(name)
            info.size = source.stat().st_size
            info.mode = 0o755 if os.access(source, os.X_OK) else 0o644
            info.mtime = 0
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            with source.open("rb") as handle:
                archive.addfile(info, handle)
    with target.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
        zipped.write(buffer.getvalue())


def licence_members(prefix: str) -> list[tuple[str, Path]]:
    files = [("LICENSE", REPO / "LICENSE"), ("NOTICE", REPO / "NOTICE"), ("LICENSE-native", NATIVE / "LICENSE"), ("LICENSES-native.md", NATIVE / "LICENSES.md"), ("FTL.TXT", NATIVE / "licenses" / "FTL.TXT")]
    return [(f"{prefix}/{name}", path) for name, path in files if path.is_file()]


def remap_rustflags() -> str:
    """Strip host paths from panic locations and debug info (later prefixes win in rustc)."""
    cargo_home = Path(os.environ.get("CARGO_HOME", Path.home() / ".cargo")).resolve()
    pairs = [(Path.home().resolve(), "/home"), (cargo_home, "/usr/local/cargo"), (NATIVE, "/build/native")]
    flags = " ".join(f"--remap-path-prefix={src}={dst}" for src, dst in pairs)
    return (os.environ.get("RUSTFLAGS", "") + " " + flags).strip()


def stage_dir(out: Path, name: str) -> Path:
    path = out / "stage" / name
    shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True)
    return path


def smoke(binary: Path, plat: str) -> None:
    """The binary runs on its platform and is prism-kicad (WP-B's version, or F2's stub)."""
    if plat in LINUX:
        command = ["docker", "run", "--rm", "--platform", f"linux/{LINUX[plat]}", "--volume", f"{binary.parent}:/dist:ro",
                   f"debian:bookworm-slim", "/dist/prism-kicad", "version"]  # fmt: skip
    else:
        command = [str(binary), "version"]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if "prism-kicad" not in result.stdout + result.stderr and '"schema"' not in result.stdout:
        raise ReleaseError(f"{plat} binary did not run as prism-kicad: {result.returncode} {result.stderr[-500:]}")
    print(f"smoke {plat}: exit {result.returncode}: {(result.stdout or result.stderr).strip()[:200]}")


def build_binary(plat: str, out: Path) -> Path:
    stage = stage_dir(out, plat)
    if plat in LINUX:
        arch = LINUX[plat]
        image = f"rust:{dockerfile_arg('NATIVE_RUST_VERSION')}-bookworm"
        run([
            "docker", "run", "--rm", "--platform", f"linux/{arch}",
            "--volume", f"{NATIVE}:/src:ro", "--volume", f"{stage}:/out",
            "--volume", f"prism-native-release-registry-{arch}:/usr/local/cargo/registry",
            "--volume", f"prism-native-release-target-{arch}:/build/native/target",
            image, "bash", "-c", CONTAINER_BUILD,
        ])  # fmt: skip
        toolchain = (stage / "rustc-version").read_text().strip()
        (stage / "rustc-version").unlink()
    elif plat in MACOS:
        if sys.platform != "darwin" or host_platform.machine() not in ("arm64", "aarch64"):
            raise ReleaseError(f"{plat} builds on an Apple-silicon macOS host")
        target_dir = out / "cargo-target"
        env = {**os.environ, "RUSTFLAGS": remap_rustflags(), "CARGO_TARGET_DIR": str(target_dir)}
        run(["cargo", "build", "--release", "--locked", "-p", "prism-kicad-cli", "--target", MACOS[plat]], cwd=NATIVE, env=env)
        shutil.copy2(target_dir / MACOS[plat] / "release" / "prism-kicad", stage / "prism-kicad")
        toolchain = subprocess.run(["rustc", "--version"], cwd=NATIVE, capture_output=True, text=True, check=True).stdout.strip()
    else:
        raise ReleaseError(f"unknown platform {plat}; one of {', '.join(PLATFORMS)}")
    binary = stage / "prism-kicad"
    smoke(binary, plat)
    name = f"prism-kicad-{version()}-{plat}"
    deterministic_tgz(out / f"{name}.tar.gz", [(f"{name}/prism-kicad", binary), *licence_members(name)])
    (stage / "build.json").write_text(json.dumps({"platform": plat, "toolchain": toolchain, "binarySha256": sha256(binary)}, indent=2) + "\n")
    print(f"wrote {name}.tar.gz (prism-kicad sha256 {sha256(binary)})")
    return out / f"{name}.tar.gz"


def wasm_bindgen() -> str:
    wanted = locked_version("wasm-bindgen")
    tool = os.environ.get("WASM_BINDGEN") or shutil.which("wasm-bindgen")
    if not tool:
        raise ReleaseError(f"no wasm-bindgen: cargo install wasm-bindgen-cli --version {wanted} --locked")
    found = subprocess.run([tool, "--version"], capture_output=True, text=True, check=False).stdout.split()[-1:]
    if found != [wanted]:
        raise ReleaseError(f"{tool} is wasm-bindgen {found}; Cargo.lock pins {wanted} (set WASM_BINDGEN)")
    return tool


def build_wasm(out: Path) -> Path:
    tool = wasm_bindgen()
    target_dir = out / "cargo-target"
    env = {**os.environ, "RUSTFLAGS": remap_rustflags(), "CARGO_TARGET_DIR": str(target_dir)}
    run(["cargo", "build", "--release", "--locked", "--target", "wasm32-unknown-unknown", "-p", WASM_CRATE, "--lib"], cwd=NATIVE, env=env)
    stage = stage_dir(out, "wasm")
    module = target_dir / "wasm32-unknown-unknown" / "release" / "prism_kicad_wasm.wasm"
    run([tool, "--target", "web", "--out-dir", str(stage), "--out-name", "prism_kicad_wasm", str(module)])
    package = {
        "name": WASM_PACKAGE,
        "version": version(),
        "description": "prism-kicad-wasm: KiCad parsing, plotting and analytic materialization in the browser",
        "license": "MIT",
        "type": "module",
        "main": "prism_kicad_wasm.js",
        "module": "prism_kicad_wasm.js",
        "types": "prism_kicad_wasm.d.ts",
        "files": sorted(p.name for p in stage.iterdir() if p.name != ".gitignore"),
        "prism": {"crateVersion": locked_version(WASM_CRATE), "wasmBindgen": locked_version("wasm-bindgen")},
    }
    (stage / ".gitignore").unlink(missing_ok=True)
    (stage / "package.json").write_text(json.dumps(package, indent=2) + "\n")
    members = [(f"package/{p.relative_to(stage).as_posix()}", p) for p in sorted(stage.rglob("*")) if p.is_file()]
    target = out / f"prism-kicad-wasm-{version()}.tgz"
    deterministic_tgz(target, members + licence_members("package"))
    print(f"wrote {target.name} ({sum(p.stat().st_size for _, p in members) / 1e6:.1f} MB unpacked)")
    return target


def assemble(out: Path) -> Path:
    artifacts = sorted([*out.glob("prism-kicad-*.tar.gz"), *out.glob("prism-kicad-wasm-*.tgz")])
    if not artifacts:
        raise ReleaseError(f"no artifacts in {out}")
    forbid = [str(NATIVE), str(Path.home())]
    run([sys.executable, str(NATIVE / "scripts" / "check_release_artifact_paths.py"), str(out / "stage"),
         *[arg for path in forbid for arg in ("--forbid", path)]])  # fmt: skip
    sums = "".join(f"{sha256(p)}  {p.name}\n" for p in artifacts)
    (out / "SHA256SUMS").write_text(sums)
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=False).stdout.strip()
    builds = {json.loads(p.read_text())["platform"]: json.loads(p.read_text()) for p in sorted((out / "stage").glob("*/build.json"))}
    record = {
        "release": f"prism-kicad-v{version()}",
        "version": version(),
        "commit": commit or None,
        "artifacts": [{"name": p.name, "sha256": sha256(p), "size": p.stat().st_size} for p in artifacts],
        "binaries": builds,
        "wasmBindgen": locked_version("wasm-bindgen"),
    }
    (out / "release.json").write_text(json.dumps(record, indent=2) + "\n")
    print(sums, end="")
    return out / "release.json"


def image_check(plat: str, out: Path) -> None:
    """Build backend/Dockerfile's prism-kicad-builder stage; its binary must equal the release one."""
    if plat not in LINUX:
        raise ReleaseError("image-check is for the linux platforms")
    arch = LINUX[plat]
    build = json.loads((out / "stage" / plat / "build.json").read_text())
    dest = stage_dir(out, f"image-{plat}")
    tag = f"prism-kicad-builder-check:{arch}"
    run(["docker", "buildx", "build", "--file", str(DOCKERFILE), "--target", "prism-kicad-builder",
         "--platform", f"linux/{arch}", "--build-arg", f"KICAD_BASE_PLATFORM=linux/{arch}", "--load", "--tag", tag, str(REPO)])  # fmt: skip
    container = run(["docker", "create", tag], capture_output=True).stdout.strip()
    try:
        run(["docker", "cp", f"{container}:/tmp/prism-kicad", str(dest / "prism-kicad")])
    finally:
        subprocess.run(["docker", "rm", container], capture_output=True, check=False)
        subprocess.run(["docker", "image", "rm", tag], capture_output=True, check=False)
    image_sha = sha256(dest / "prism-kicad")
    print(f"image {plat}: {image_sha}\nrelease {plat}: {build['binarySha256']}")
    if image_sha != build["binarySha256"]:
        raise ReleaseError(f"the worker image's prism-kicad differs from the release binary for {plat}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    commands = {name: sub.add_parser(name) for name in ("binary", "wasm", "assemble", "image-check", "dry-run")}
    for name, p in commands.items():
        p.add_argument("--out", type=Path, default=DEFAULT_OUT)
        if name in ("binary", "image-check"):
            p.add_argument("--platform", required=True, choices=PLATFORMS)
    commands["dry-run"].add_argument("--platform", action="append", choices=PLATFORMS, help="default: all")
    commands["dry-run"].add_argument("--image-check", action="store_true", help="also compare with the worker image's builder stage")
    args = parser.parse_args(argv)
    out: Path = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    try:
        if args.command == "binary":
            build_binary(args.platform, out)
        elif args.command == "wasm":
            build_wasm(out)
        elif args.command == "assemble":
            assemble(out)
        elif args.command == "image-check":
            image_check(args.platform, out)
        else:
            for stale in [*out.glob("prism-kicad-*.t*gz"), out / "SHA256SUMS", out / "release.json"]:
                stale.unlink(missing_ok=True)
            shutil.rmtree(out / "stage", ignore_errors=True)
            for plat in args.platform or PLATFORMS:
                build_binary(plat, out)
            build_wasm(out)
            assemble(out)
            if args.image_check:
                for plat in args.platform or PLATFORMS:
                    if plat in LINUX:
                        image_check(plat, out)
        return 0
    except (ReleaseError, OSError, subprocess.CalledProcessError) as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
