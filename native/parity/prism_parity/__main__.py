"""Command line: ``python -m prism_parity <command>`` (run from ``native/parity``).

Commands:
  compare   diff bundles (or directories of projection JSON) against goldens
  selftest  prove the runner on hand-made bundles built from the goldens
  inputs    check that the committed fixtures still hash to their goldens' inputs
  capture   run today's code and write goldens (backend environment)
  oracle    check nets and counts against kicad-cli (KiCad 10.0.6)
  corpus    capture goldens for a private corpus manifest into a scratch directory
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import fixtures as fx
from .members import resolve as resolve_members


def _cases(args) -> list[fx.Case]:
    if getattr(args, "corpus", None):
        from . import corpus

        return fx.select(corpus.load(Path(args.corpus)), args.cases)
    cases, _ = fx.load_fixtures()
    return fx.select(cases, args.cases)


def cmd_capture(args) -> int:
    from . import capture

    capture.setup_today(Path(args.today).resolve())
    kicad = None if args.no_upgrade else fx.find_kicad()
    node = capture.default_node()
    members = [m.stem for m in resolve_members(args.members)]
    out = Path(args.out).resolve()
    scratch = capture.new_scratch(Path(args.scratch).resolve() if args.scratch else None)
    failed = 0
    for case in _cases(args):
        print(f"{case.id}: {case.source_root_label or case.source_root} :: {case.project}", flush=True)
        if getattr(args, "corpus", None):
            from . import corpus

            corpus.materialize(case, scratch)
        record = capture.capture_case(
            case,
            out,
            scratch,
            members=members,
            today=Path(args.today).resolve(),
            reference=Path(args.reference).resolve(),
            node=node,
            kicad=kicad,
            upgrade_sources=not args.no_upgrade,
            keep=args.keep,
        )
        failed += sum(1 for m in members if record["members"].get(m, {}).get("status") == "capture-error")
    return 1 if failed else 0


def cmd_compare(args) -> int:
    from . import compare

    return compare.main(args)


def cmd_bundles(args) -> int:
    from . import build

    return build.main(args)


def cmd_selftest(args) -> int:
    from . import selftest

    return selftest.main(args)


def cmd_inputs(args) -> int:
    from . import compare

    return compare.check_inputs(args)


def cmd_oracle(args) -> int:
    from . import oracle

    return oracle.main(args)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="prism_parity", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("compare", help="diff bundles against goldens")
    p.add_argument("target", nargs="?", help="one bundle: a .prism file, a directory with projections/, or a directory of <member>.json")
    p.add_argument("--case", help="the fixture or corpus id the single target is a bundle of")
    p.add_argument("--bundles", help="a directory holding <case>.prism or <case>/ for many cases")
    p.add_argument("--cases", default="all", help="comma-separated case ids (with --bundles)")
    p.add_argument("--members", default="all", help="comma-separated member stems")
    p.add_argument("--goldens", default=str(fx.GOLDENS_DIR), help="golden directory (default: native/parity/goldens)")
    p.add_argument("--divergences", default=str(fx.PARITY_DIR / "divergences"), help="accepted divergences directory")
    p.add_argument("--require-all", action="store_true", help="fail when a case or member is missing from the bundles")
    p.add_argument("--max-diffs", type=int, default=20, help="differences listed per member (all are counted)")
    p.add_argument("--json", help="write the full report as JSON to this path")
    p.add_argument("--quiet", action="store_true", help="print only failures and the summary")
    p.add_argument("--validate", action="store_true", help="also validate each member against its schema (needs node and native/node_modules)")
    p.set_defaults(func=cmd_compare)

    p = sub.add_parser("bundles", help="build every fixture's parse-stage bundle with prism-kicad")
    p.add_argument("--prism-kicad", required=True, help="the prism-kicad binary")
    p.add_argument("--out", required=True, help="directory for <case>.prism")
    p.add_argument("--cases", default="all", help="comma-separated case ids")
    p.add_argument("--no-upgrade", action="store_true", help="do not look for KiCad: skip cases whose sources need its upgrade")
    p.set_defaults(func=cmd_bundles)

    p = sub.add_parser("selftest", help="run the runner on the goldens themselves and on a deliberate change")
    p.add_argument("--goldens", default=str(fx.GOLDENS_DIR))
    p.add_argument("--work", help="where to build the hand-made bundles (default: a temporary directory)")
    p.set_defaults(func=cmd_selftest)

    p = sub.add_parser("inputs", help="check the committed fixtures against their goldens' recorded inputs")
    p.add_argument("--goldens", default=str(fx.GOLDENS_DIR))
    p.add_argument("--cases", default="all")
    p.set_defaults(func=cmd_inputs)

    for name, helptext in (("capture", "write fixture goldens from today's code"), ("corpus", "write corpus goldens to a scratch directory")):
        p = sub.add_parser(name, help=helptext)
        p.add_argument("--cases", default="all")
        p.add_argument("--members", default="all")
        p.add_argument("--today", default=str(fx.REPO_ROOT), help="checkout whose backend/ is today's code (default: this one)")
        from .capture import DEFAULT_REFERENCE

        p.add_argument("--reference", default=str(DEFAULT_REFERENCE), help="reference branch checkout (read-only)")
        p.add_argument("--scratch", help="scratch directory for prepared inputs (default: a temporary directory)")
        p.add_argument("--keep", action="store_true", help="keep the prepared inputs")
        p.add_argument("--no-upgrade", action="store_true", help="skip kicad-seeded-upgrade-a0 (diagnosis only)")
        if name == "capture":
            p.add_argument("--out", default=str(fx.GOLDENS_DIR))
        else:
            p.add_argument("corpus", help="corpus manifest (prism.parity.corpus.a0), outside the repository")
            p.add_argument("--out", required=True, help="golden directory outside the repository")
        p.set_defaults(func=cmd_capture)

    p = sub.add_parser("oracle", help="kicad-cli netlist and board-stats checks")
    p.add_argument("--cases", default="all")
    p.add_argument("--corpus", help="a corpus manifest instead of the committed fixtures")
    p.add_argument("--goldens", default=str(fx.GOLDENS_DIR))
    p.add_argument("--scratch")
    p.add_argument("--json", help="write the report as JSON")
    p.set_defaults(func=cmd_oracle)

    args = parser.parse_args(argv)
    if args.command == "corpus":
        from . import corpus

        corpus.refuse_inside_repo(Path(args.out))
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
