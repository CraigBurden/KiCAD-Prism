#!/usr/bin/env python3
"""The KiCad oracle for native/: the ``kicad-cli`` of Prism's worker image.

The fork recorded its oracle outputs with pinned Windows KiCad builds restored
from Wavenumber's R2 cache (``restore_kicad_cli_cache.py``, retired). Prism's
oracle is the ``kicad-cli`` every KiCad job already runs (ADR section 4.2, 7):

- in the worker image, ``/usr/bin/kicad-cli`` (the pinned ``kicad/kicad`` base);
- locally, the same resolution order as ``backend/app/services/kicad_tools.py``:
  ``KICAD_CLI_PATH`` (or the legacy ``KICAD_CLI``), then ``PATH``, then the usual
  install locations (macOS: ``/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli``);
- or explicitly inside a built worker image, ``--image <tag>`` (needs Docker).

Commands::

    kicad_cli_oracle.py locate [--expect-version X.Y.Z]
    kicad_cli_oracle.py capture <.kicad_pro|.kicad_sch|.kicad_pcb> --out DIR [--image TAG]

``capture`` writes ADR section 7's oracle documents for one project:
``netlist.net`` (``sch export netlist``, kicadsexpr), ``stats.json``
(``pcb export stats --format json``) and ``oracle.json`` recording the KiCad
version and the commands. WP-G's parity runner compares nets and counts
against them.

Exit status: 0 success, 1 kicad-cli failed or the version differs, 2 usage error.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

WORKER_IMAGE_CLI = "/usr/bin/kicad-cli"
ENV_NAMES = ("KICAD_CLI_PATH", "KICAD_CLI")


class OracleError(Exception):
    pass


def install_locations() -> tuple[str, ...]:
    if sys.platform == "darwin":
        return (
            "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli",
            os.path.expanduser("~/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"),
        )
    if os.name == "nt":
        root = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "KiCad"
        versions = sorted(root.glob("*"), reverse=True) if root.is_dir() else []
        return tuple(str(version / "bin" / "kicad-cli.exe") for version in versions)
    return (WORKER_IMAGE_CLI, "/usr/local/bin/kicad-cli")


def locate() -> Path:
    for name in ENV_NAMES:
        value = os.environ.get(name, "").strip()
        if value:
            path = Path(value).expanduser()
            if not (path.is_file() and os.access(path, os.X_OK)):
                raise OracleError(f"{name}={value} is not an executable kicad-cli")
            return path
    found = shutil.which("kicad-cli")
    if found:
        return Path(found)
    for candidate in install_locations():
        if Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return Path(candidate)
    raise OracleError("no kicad-cli: set KICAD_CLI_PATH, put kicad-cli on PATH, or pass --image <worker image>")


class Runner:
    """kicad-cli on this host, or inside a worker image with the project mounted read-only."""

    def __init__(self, image: str | None) -> None:
        self.image = image
        self.cli = WORKER_IMAGE_CLI if image else str(locate())

    def __call__(self, args: Sequence[str], *, project: Path | None = None, out: Path | None = None) -> str:
        command = [self.cli, *args]
        if self.image:
            mounts: list[str] = []
            if project is not None:
                mounts += ["--volume", f"{project}:/project:ro"]
            if out is not None:
                mounts += ["--volume", f"{out}:/out"]
            command = ["docker", "run", "--rm", *mounts, "--entrypoint", self.cli, self.image, *args]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            detail = (result.stderr.strip() or result.stdout.strip())[-2000:]
            raise OracleError(f"{' '.join(args[:3])} failed ({result.returncode}): {detail}")
        return result.stdout.strip()

    def version(self) -> str:
        return self(["version"]).splitlines()[-1].strip()


def _sources(path: Path) -> tuple[Path | None, Path | None]:
    """The root schematic and the board beside a project file (same stem, as KiCad pairs them)."""
    stem = path.with_suffix("")
    sch = stem.with_suffix(".kicad_sch") if path.suffix in (".kicad_pro", ".kicad_sch") else None
    pcb = stem.with_suffix(".kicad_pcb") if path.suffix in (".kicad_pro", ".kicad_pcb") else None
    return (sch if sch and sch.is_file() else None, pcb if pcb and pcb.is_file() else None)


def capture(runner: Runner, source: Path, out: Path) -> dict[str, object]:
    source = source.resolve()
    if source.suffix not in (".kicad_pro", ".kicad_sch", ".kicad_pcb") or not source.is_file():
        raise OracleError(f"{source} is not a .kicad_pro, .kicad_sch or .kicad_pcb file")
    sch, pcb = _sources(source)
    if sch is None and pcb is None:
        raise OracleError(f"no schematic or board beside {source.name}")
    out.mkdir(parents=True, exist_ok=True)
    out = out.resolve()
    project_dir = source.parent

    def inner(path: Path) -> str:
        return f"/project/{path.relative_to(project_dir).as_posix()}" if runner.image else str(path)

    def target(name: str) -> str:
        return f"/out/{name}" if runner.image else str(out / name)

    commands: list[list[str]] = []
    if sch is not None:
        commands.append(["sch", "export", "netlist", "--format", "kicadsexpr", "--output", target("netlist.net"), inner(sch)])
    if pcb is not None:
        commands.append(["pcb", "export", "stats", "--format", "json", "--units", "mm", "--output", target("stats.json"), inner(pcb)])
    for command in commands:
        runner(command, project=project_dir, out=out)
    record = {
        "schema": "prism.kicad_cli_oracle.a0",
        "kicadVersion": runner.version(),
        "source": source.name,
        "image": runner.image,
        "commands": [["kicad-cli", *c[:-3], "--output", Path(c[-2]).name, Path(c[-1]).name] for c in commands],
        "outputs": sorted(p.name for p in out.iterdir() if p.name in ("netlist.net", "stats.json")),
    }
    (out / "oracle.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    loc = sub.add_parser("locate", help="print the resolved kicad-cli and its version")
    loc.add_argument("--expect-version", help="fail unless kicad-cli reports exactly this version")
    loc.add_argument("--image", help="use the kicad-cli inside this worker image instead")
    cap = sub.add_parser("capture", help="write netlist.net, stats.json and oracle.json for one project")
    cap.add_argument("source", type=Path)
    cap.add_argument("--out", type=Path, required=True)
    cap.add_argument("--image", help="run kicad-cli inside this worker image (docker)")
    args = parser.parse_args(argv)
    try:
        runner = Runner(args.image)
        if args.command == "locate":
            version = runner.version()
            print(f"{runner.image + ':' if runner.image else ''}{runner.cli} {version}")
            if args.expect_version and version != args.expect_version:
                print(f"FAIL kicad-cli is {version}, expected {args.expect_version}", file=sys.stderr)
                return 1
            return 0
        record = capture(runner, args.source, args.out)
        print(json.dumps(record, indent=2))
        return 0
    except OracleError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
