#!/usr/bin/env python3
"""Where native/'s KiCad test corpus lives in Prism (ADR section 4.2, 7).

The fork restored a 266 MB archive from ``artifacts.wavenumber.net``
(``kicad_corpus_archive.py``, retired with ``package_kicad_corpus.py``,
``build_kicad_corpus_manifest.py`` and ``sync_upstream_qa_netlist_fixtures.py``).
No Rust test reads that archive: the ones that read projects use the committed
cruncher corpus. Prism's corpus is its parity corpus:

- committed, run on every PR: the roots in ``COMMITTED`` below (Release Studio's
  and System Builder's fixtures, the design-variant fixtures, the cruncher
  corpus), which ``native/parity/fixtures.json`` also draws its cases from;
- private, nightly or local: every directory in ``PRISM_PARITY_CORPUS``
  (``os.pathsep``-separated), such as the developer instance's projects.

Commands::

    parity_corpus.py check                  every committed root exists and holds KiCad sources
    parity_corpus.py list [--suffix .kicad_pcb ...] [--committed-only]
    parity_corpus.py sexpr-gate [--committed-only] [--debug]

``sexpr-gate`` is the fork's corpus lane on Prism's corpus: it pipes every
source through ``prism-kicad-core``'s ``sexpr_corpus_gate`` example (parse,
build, reparse, rebuild, compare) and fails on any record that is not ``ok``.
It builds the example in release unless ``--debug``: CI runs it in the job
that already built the workspace's tests, where a debug build is nearly free
and a release build (thin LTO, one codegen unit) takes minutes.

Exit status: 0 pass, 1 a check failed, 2 usage error.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Iterator, Sequence
from pathlib import Path

NATIVE = Path(__file__).resolve().parents[1]
REPO = NATIVE.parent
ENV_NAME = "PRISM_PARITY_CORPUS"
SUFFIXES = (".kicad_pcb", ".kicad_sch", ".kicad_pro", ".kicad_sym", ".kicad_mod", ".kicad_wks", ".kicad_dru")
# Repository-relative committed roots. A root that must exist is required.
# native/parity (WP-G) holds goldens and the runner, not KiCad sources: its
# fixtures.json points at the roots below, so it is not a corpus root itself.
COMMITTED: tuple[tuple[str, bool], ...] = (
    ("fixtures/release-studio/usb-pd", True),
    ("fixtures/release-studio/synthetic", True),
    ("fixtures/release-studio/cynthion", True),
    ("backend/tests/fixtures/design_variants", True),
    ("backend/tests/fixtures/system_builder", True),
)
# Single-expression s-expression files (.kicad_pro is JSON; .kicad_dru holds several expressions).
SEXPR_SUFFIXES = (".kicad_pcb", ".kicad_sch", ".kicad_sym", ".kicad_mod", ".kicad_wks")
# Inputs that are malformed or otherwise not a round-trip case on purpose.
NOT_ROUND_TRIP_PARTS = frozenset({"malformed"})


def private_roots() -> list[Path]:
    value = os.environ.get(ENV_NAME, "")
    return [Path(part).expanduser().resolve() for part in value.split(os.pathsep) if part.strip()]


def roots(*, committed_only: bool) -> list[Path]:
    found = [REPO / rel for rel, required in COMMITTED if required or (REPO / rel).is_dir()]
    return found if committed_only else found + private_roots()


def sources(root_list: Sequence[Path], suffixes: Sequence[str]) -> Iterator[Path]:
    seen: set[Path] = set()
    for root in root_list:
        for path in sorted(root.rglob("*")):
            if path.suffix in suffixes and path.is_file() and path.resolve() not in seen:
                seen.add(path.resolve())
                yield path.resolve()


def check() -> int:
    failures = 0
    for rel, required in COMMITTED:
        root = REPO / rel
        if not root.is_dir():
            if required:
                print(f"FAIL committed corpus root {rel} is missing")
                failures += 1
            else:
                print(f"note {rel} is absent (optional)")
            continue
        counts = {s: sum(1 for _ in sources([root], (s,))) for s in (".kicad_pro", ".kicad_sch", ".kicad_pcb")}
        if not any(counts.values()):
            print(f"FAIL {rel} holds no KiCad project, schematic or board")
            failures += 1
        print(f"ok   {rel}: " + ", ".join(f"{n} {s}" for s, n in counts.items()))
    for root in private_roots():
        state = "ok  " if root.is_dir() else "FAIL"
        failures += 0 if root.is_dir() else 1
        print(f"{state} {ENV_NAME} root {root}")
    print("RESULT: " + ("FAIL" if failures else "PASS"))
    return 1 if failures else 0


def sexpr_gate(*, committed_only: bool, debug: bool = False) -> int:
    inputs = [p for p in sources(roots(committed_only=committed_only), SEXPR_SUFFIXES) if not NOT_ROUND_TRIP_PARTS & set(p.parts)]
    command = [
        "cargo", "run", "--locked", "--quiet", *([] if debug else ["--release"]),
        "-p", "prism-kicad-core", "--example", "sexpr_corpus_gate",
    ]  # fmt: skip
    result = subprocess.run(
        command, cwd=NATIVE, input="\n".join(map(str, inputs)) + "\n", capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        print(result.stderr[-4000:], file=sys.stderr)
        return 1
    records = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    bad = [r for r in records if r.get("phase") != "ok"]
    for record in bad:
        print(f"FAIL {Path(record['path']).relative_to(REPO) if record['path'].startswith(str(REPO)) else record['path']}: {record['phase']}: {record['error']}")
    total = sum(r.get("input_bytes", 0) for r in records)
    print(f"sexpr corpus gate: {len(records)} of {len(inputs)} sources, {total / 1e6:.1f} MB, {len(bad)} failed")
    ok = not bad and len(records) == len(inputs)
    print("RESULT: " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    listing = sub.add_parser("list")
    listing.add_argument("--suffix", action="append", choices=SUFFIXES)
    gate = sub.add_parser("sexpr-gate")
    gate.add_argument("--debug", action="store_true", help="build the example without --release")
    for p in (listing, gate):
        p.add_argument("--committed-only", action="store_true", help=f"ignore {ENV_NAME}")
    args = parser.parse_args(argv)
    if args.command == "check":
        return check()
    if args.command == "sexpr-gate":
        return sexpr_gate(committed_only=args.committed_only, debug=args.debug)
    for path in sources(roots(committed_only=args.committed_only), tuple(args.suffix or SUFFIXES)):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
