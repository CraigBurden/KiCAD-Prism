"""Record the KiCad-produced inputs of stages board and models for every
committed fixture with a board: the refilled board (pcbnew-zone-filler-a0,
cli-spec.md §9.2) and the component GLB (kicad-cli-glb-a0, §9.3), with
KiCad 10.0.6 (macOS, /Applications/KiCad). The tests need no KiCad: they
read these recordings, stored zlib-compressed beside this script as
<fixture dir>/<board>.kicad_pcb.zlib and <fixture dir>/components.glb.zlib.
`components.second.glb.zlib` of usb-pd is a second export a second later,
for the GLB canonicalization check (cli-spec.md §11 item 7).

A fixture KiCad cannot refill (kicad11_tokens: pcbnew crashes on the
KiCad 11 tokens) has no recording; its board stage stays pending, as the
backend's would.

usage: python3 record.py <repo root> <out dir> [<fixture dir>...]
then zlib-compress the outputs into this directory.
"""
import os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

KICAD_APP = Path("/Applications/KiCad/KiCad.app/Contents")
PYTHON = KICAD_APP / "Frameworks/Python.framework/Versions/Current/bin/python3"
KICAD_CLI = KICAD_APP / "MacOS/kicad-cli"
REFILL = (
    "import sys, pcbnew\n"
    "board = pcbnew.LoadBoard(sys.argv[1])\n"
    "pcbnew.ZONE_FILLER(board).Fill(board.Zones())\n"
    "pcbnew.SaveBoard(sys.argv[1], board)\n"
)
ROOTS = ["fixtures/release-studio", "backend/tests/fixtures/design_variants", "backend/tests/fixtures/system_builder"]

def env():
    e = {"PATH": os.environ["PATH"], "HOME": tempfile.mkdtemp(prefix="kicad-home-")}
    return e

def refill(project: Path, board: Path, out: Path):
    with tempfile.TemporaryDirectory() as scratch:
        scratch = Path(scratch)
        stem = board.stem
        shutil.copy(board, scratch / board.name)
        shutil.copy(project, scratch / f"{stem}.kicad_pro")
        dru = project.with_suffix(".kicad_dru")
        if dru.exists():
            shutil.copy(dru, scratch / f"{stem}.kicad_dru")
        subprocess.run([str(PYTHON), "-I", "-c", REFILL, str(scratch / board.name)], check=True, env=env(), timeout=900)
        shutil.copy(scratch / board.name, out)

def export_glb(board: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(KICAD_CLI), "pcb", "export", "glb", "--force", "--no-board-body", "--output", str(out_dir / "components.glb"), str(board)],
                   check=True, env=env(), timeout=900, cwd=board.parent, capture_output=True)

def main():
    repo, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    only = sys.argv[3:] 
    for root in ROOTS:
        for project in sorted((repo / root).rglob("*.kicad_pro")):
            board = project.with_suffix(".kicad_pcb")
            if not board.exists():
                continue
            rel = project.parent.relative_to(repo).as_posix()
            if only and rel not in only:
                continue
            target = out / rel
            if (target / "components.glb").exists():
                continue
            target.mkdir(parents=True, exist_ok=True)
            try:
                refill(project, board, target / board.name)
                export_glb(board, target)
            except subprocess.SubprocessError as error:
                print(rel, "KICAD FAILED", error, flush=True)
                shutil.rmtree(target)
                continue
            print(rel, (target / board.name).stat().st_size, (target / "components.glb").stat().st_size, flush=True)

main()
