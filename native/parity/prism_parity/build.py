"""Build every fixture's parse-stage bundle with ``prism-kicad`` for ``compare``.

CI runs this with the workspace's ``prism-kicad`` and then
``python -m prism_parity compare --bundles <out>``. A case whose golden was
captured from sources KiCad upgraded (``capture.json`` records an upgraded
input) needs that upgrade to give the same bytes, so without KiCad it is
skipped and named, and ``compare`` reports it as missing; the local job
(``native/parity/README.md``) covers it.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from . import fixtures as fx

# stage parse exits 9 when a member failed (stages.parse partial); the
# comparison decides whether that member was expected.
_ACCEPTED_EXITS = {0, 9}


def _capture(case: fx.Case) -> dict:
    path = fx.GOLDENS_DIR / case.id / "capture.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def needs_upgrade(case: fx.Case) -> bool:
    """The golden was captured from sources KiCad upgraded."""

    return any("upgradedSha256" in record for record in _capture(case).get("inputs", []))


def refused_today(case: fx.Case) -> bool:
    """Today's code captured no member (design_variants/malformed): no bundle is expected either."""

    members = _capture(case).get("members", {})
    return bool(members) and all(m.get("status") != "captured" for m in members.values())


def main(args) -> int:
    binary = Path(args.prism_kicad).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    kicad = None if args.no_upgrade else fx.find_kicad()
    cases, _ = fx.load_fixtures()
    failed = 0
    with tempfile.TemporaryDirectory(prefix="prism-parity-bundles-") as scratch:
        for case in fx.select(cases, args.cases):
            if kicad is None and needs_upgrade(case):
                print(f"{case.id}: skipped, its sources need KiCad's upgrade (local job)", flush=True)
                continue
            prepared = fx.prepare(case, Path(scratch), kicad)
            command = [
                str(binary), "bundle", "build", str(prepared.src / case.project),
                "--stage", "parse", "-o", str(out / f"{case.id}.prism"),
                "--source-root", str(prepared.src), "--quiet",
            ]
            for record in prepared.inputs:
                if "upgradedFromVersion" in record:
                    command += ["--upgraded", f"{record['path']}={record['upgradedFromVersion']}"]
            run = subprocess.run(command, capture_output=True, text=True)
            if run.returncode not in _ACCEPTED_EXITS:
                expected = refused_today(case)
                note = "expected: today refuses it too" if expected else run.stderr[-400:]
                print(f"{case.id}: prism-kicad exit {run.returncode} ({note})", flush=True)
                failed += 0 if expected else 1
            else:
                print(f"{case.id}: built", flush=True)
    return 1 if failed else 0
