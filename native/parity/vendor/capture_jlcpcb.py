"""Capture today's JLCPCB BOM and CPL as goldens for ``prism-kicad vendor run jlcpcb``.

Amendment C3 §4: the CSVs must be byte-identical and the XLSX cell-identical
to today's Cruncher output. Today's output is what Release Studio's
``vendors/jlcpcb.py`` runs: ``kicad-cruncher bom`` and ``pnp`` with the pinned
``jlcpcb.config.jsonc``, one call each, on the project file, with
``KIPRJMOD`` set and ``--variant`` when a release selects one.

They run on the bytes in the case's bundle (``sources/``), the same upgraded
sources the bundle's members came from, so goldens and bundle agree on input.
One golden set per variant: ``base`` (no ``--variant``) and every KiCad variant
the bundle's ``occurrences`` member declares.

    python3 native/parity/vendor/capture_jlcpcb.py --bundles <dir> --cruncher <kicad-cruncher> [--cases a,b]

Writes ``native/parity/goldens/<case>/vendor-jlcpcb/<variant>/{bom,cpl}.{csv,xlsx}``
and ``vendor-jlcpcb/capture.json`` (Cruncher version, inputs).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARITY = HERE.parent
REPO = PARITY.parent.parent
CONFIG = REPO / "backend/app/release_studio/vendors/jlcpcb.config.jsonc"
OUTPUTS = {
    "bom.csv": "*jlc-csv.csv",
    "cpl.csv": "*jlc-cpl.csv",
    "bom.xlsx": "*jlc-xlsx.xlsx",
    "cpl.xlsx": "*jlc-cpl-xlsx.xlsx",
}


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _case_project(case: str) -> str:
    fixtures = json.loads((PARITY / "fixtures.json").read_text())["fixtures"]
    return next(item["project"] for item in fixtures if item["id"] == case)


def _variants(archive: zipfile.ZipFile) -> list[str]:
    occurrences = json.loads(archive.read("projections/occurrences.json"))
    return sorted({item["name"] for item in occurrences.get("variantDeclarations", []) if item.get("name")})


def _run(cruncher: str, project: Path, work: Path, variant: str | None) -> dict[str, Path]:
    env = {**os.environ, "KIPRJMOD": str(project.parent)}
    for tool in ("bom", "pnp"):
        argv = [cruncher, tool, "--config", str(CONFIG), str(project), "-o", str(work)]
        if variant:
            argv += ["--variant", variant]
        done = subprocess.run(argv, cwd=project.parent, env=env, capture_output=True, text=True)
        if done.returncode != 0:
            raise RuntimeError(f"{' '.join(argv[1:3])} failed: {(done.stderr or done.stdout)[-600:]}")
    found: dict[str, Path] = {}
    for name, pattern in OUTPUTS.items():
        matches = sorted(work.rglob(pattern))
        if len(matches) != 1:
            raise RuntimeError(f"expected one {pattern} in {work}, found {[str(m) for m in matches]}")
        found[name] = matches[0]
    return found


def capture(case: str, bundle: Path, cruncher: str) -> dict:
    project_name = _case_project(case)
    out_root = PARITY / "goldens" / case / "vendor-jlcpcb"
    with zipfile.ZipFile(bundle) as archive, tempfile.TemporaryDirectory(prefix=f"jlc-{case}-") as tmp:
        src = Path(tmp) / "src"
        for name in archive.namelist():
            if name.startswith("sources/") and not name.endswith("/"):
                target = src / name[len("sources/"):]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))
        variants = _variants(archive)
        inputs = {str(p.relative_to(src)): _sha(p) for p in sorted(src.rglob("*")) if p.is_file()}
        if out_root.exists():
            shutil.rmtree(out_root)
        sets = {}
        for variant in [None, *variants]:
            label = variant or "base"
            work = Path(tmp) / f"out-{label}"
            work.mkdir()
            files = _run(cruncher, src / project_name, work, variant)
            dest = out_root / label
            dest.mkdir(parents=True)
            sets[label] = {}
            for name, path in files.items():
                shutil.copyfile(path, dest / name)
                sets[label][name] = _sha(dest / name)
    version = subprocess.run([cruncher, "--version"], capture_output=True, text=True).stdout.strip()
    record = {
        "schema": "prism.parity.vendor-capture.a0",
        "vendor": "jlcpcb",
        "producer": version,
        "config": {"path": str(CONFIG.relative_to(REPO)), "sha256": _sha(CONFIG)},
        "project": project_name,
        "inputs": inputs,
        "variants": sets,
    }
    (out_root / "capture.json").write_text(json.dumps(record, indent=1, sort_keys=True) + "\n")
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bundles", required=True, type=Path)
    parser.add_argument("--cruncher", required=True)
    parser.add_argument("--cases", default="rs-synthetic,rs-usb-pd,rs-cynthion")
    args = parser.parse_args()
    for case in args.cases.split(","):
        record = capture(case, args.bundles / f"{case}.prism", args.cruncher)
        print(f"{case}: {', '.join(record['variants'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
