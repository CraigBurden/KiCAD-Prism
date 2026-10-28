"""WP-V1 acceptance: the models stage's component GLB equals today's export for the same KiCad.

Today (`kicad-prism-viewer/pipeline/topology_compiler/kicad_cli_export.py:135-143`):
    kicad-cli pcb export glb --force --output <dir>/components.glb --no-board-body <board>
Bundle (`backend/app/services/design_bundle/stage_models.py`, cli-spec.md §9.3):
    kicad-cli pcb export glb --force --no-board-body --output <dir>/components.glb <board>
    run in a copy of the sources, then `generated_at` canonicalized (cli-spec.md §5.2.4).

Each case's source directory is copied twice and exported both ways. The two GLBs must have the
same binary chunk and the same JSON chunk once `asset.extras.generated_at` (the wall clock) is
removed. Stdlib only.

usage: python3 native/parity/component_models_check.py --kicad-cli <kicad-cli> --work <scratch dir>
           <name>=<source dir> [...]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import time
from pathlib import Path


def chunks(path: Path) -> dict[bytes, bytes]:
    data = path.read_bytes()
    magic, _, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError(f"{path} is not a binary glTF")
    out: dict[bytes, bytes] = {}
    offset = 12
    while offset < length:
        size, kind = struct.unpack_from("<I4s", data, offset)
        out[kind] = data[offset + 8: offset + 8 + size]
        offset += 8 + size
    return out


def canonical(path: Path) -> tuple[dict, bytes]:
    parts = chunks(path)
    document = json.loads(parts[b"JSON"].rstrip(b" \0"))
    document.get("asset", {}).get("extras", {}).pop("generated_at", None)
    return document, parts.get(b"BIN\0", b"")


def member_digest(path: Path) -> str:
    """SHA-256 of the GLB as the models stage stores it (cli-spec.md §5.2.4 step 2): the 19
    characters of `generated_at` rewritten in place to `1980-01-01T00:00:00`."""
    data = path.read_bytes()
    marker = b'"generated_at":"'
    start = data.find(marker)
    if start >= 0:
        start += len(marker)
        data = data[:start] + b"1980-01-01T00:00:00" + data[start + 19:]
    return hashlib.sha256(data).hexdigest()


def export(cli: str, source: Path, work: Path, name: str, mode: str) -> tuple[Path, int, float]:
    tree = work / mode / name
    shutil.rmtree(tree, ignore_errors=True)
    shutil.copytree(source, tree, symlinks=False)
    boards = sorted(tree.glob("*.kicad_pcb"))
    if len(boards) != 1:
        raise SystemExit(f"{name}: expected one board in {source}, found {len(boards)}")
    # kicad-cli writes the output's file name into the GLB; the job's is components.glb.
    output = work / mode / f"{name}.out" / "components.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    if mode == "today":
        args = ["pcb", "export", "glb", "--force", "--output", str(output), "--no-board-body", str(boards[0])]
    else:
        args = ["pcb", "export", "glb", "--force", "--no-board-body", "--output", str(output), str(boards[0])]
    started = time.perf_counter()
    done = subprocess.run([cli, *args], capture_output=True, text=True, timeout=1800,
                          cwd=tree if mode == "bundle" else None)
    return output, done.returncode, time.perf_counter() - started


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--kicad-cli", required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("cases", nargs="+", help="<name>=<source dir>")
    args = parser.parse_args()
    failures = 0
    for case in args.cases:
        name, _, source = case.partition("=")
        results = {mode: export(args.kicad_cli, Path(source), args.work, name, mode) for mode in ("today", "bundle")}
        (today, code_today, time_today), (bundle, code_bundle, time_bundle) = results["today"], results["bundle"]
        if code_today or code_bundle or not today.is_file() or not bundle.is_file():
            print(f"{name}: export failed (today exit {code_today}, bundle exit {code_bundle})")
            failures += 1
            continue
        same = canonical(today) == canonical(bundle)
        failures += not same
        meshes = len(canonical(bundle)[0].get("meshes", []))
        print(f"{name}: {'identical' if same else 'DIFFERENT'}, {bundle.stat().st_size} bytes, "
              f"{meshes} meshes, member sha256 {member_digest(bundle)[:8]}…, "
              f"{time_today:.1f} s / {time_bundle:.1f} s")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
