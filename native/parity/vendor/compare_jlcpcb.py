"""Compare ``prism-kicad vendor run jlcpcb`` with the captured Cruncher goldens.

For every case and variant under ``goldens/<case>/vendor-jlcpcb/<variant>/``:

- run ``prism-kicad vendor run jlcpcb`` on ``<bundles>/<case>.prism`` (no
  ``--variant`` for ``base``) into a temporary directory;
- compare ``bom.csv`` and ``cpl.csv`` by bytes;
- compare ``bom.xlsx`` and ``cpl.xlsx`` by sheet names, every cell's value and
  every cell's type (openpyxl's ``data_type``).

Exit 0 when everything matches, 1 on any difference (printed), 2 on a usage
error. Run with the backend Python that has openpyxl, for example:

    python parity/vendor/compare_jlcpcb.py \
      --prism-kicad native/target/debug/prism-kicad --bundles /tmp/bundles
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
PARITY = HERE.parent
NATIVE = PARITY.parent
CONFIG = NATIVE / "src/rs/prism-vendors/configs/jlcpcb.config.json"
DEFAULT_CASES = ("rs-synthetic", "rs-usb-pd", "rs-cynthion")


def variants(case: str) -> list[str]:
    root = PARITY / "goldens" / case / "vendor-jlcpcb"
    return sorted(path.name for path in root.iterdir() if path.is_dir())


def run_vendor(prism_kicad: Path, bundle: Path, output: Path, variant: str) -> None:
    argv = [
        str(prism_kicad),
        "vendor",
        "run",
        "jlcpcb",
        "--in",
        str(bundle),
        "--config",
        str(CONFIG),
        "-o",
        str(output),
    ]
    if variant != "base":
        argv += ["--variant", variant]
    done = subprocess.run(argv, capture_output=True, text=True)
    if done.returncode != 0:
        raise RuntimeError(
            f"{' '.join(argv[1:3])} failed ({done.returncode}): "
            f"{(done.stderr or done.stdout).strip()}"
        )


def compare_csv(expected: Path, actual: Path) -> list[str]:
    wanted = expected.read_bytes()
    found = actual.read_bytes()
    if wanted == found:
        return []
    return [
        f"{actual.name}: bytes differ ({len(found)} bytes vs {len(wanted)} expected)"
    ]


def compare_xlsx(expected: Path, actual: Path) -> list[str]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        wanted = openpyxl.load_workbook(expected)
        found = openpyxl.load_workbook(actual)
    problems: list[str] = []
    if wanted.sheetnames != found.sheetnames:
        problems.append(
            f"{actual.name}: sheets {found.sheetnames} != {wanted.sheetnames}"
        )
        return problems
    for name in wanted.sheetnames:
        sheet_wanted = wanted[name]
        sheet_found = found[name]
        if (
            sheet_found.max_row != sheet_wanted.max_row
            or sheet_found.max_column != sheet_wanted.max_column
        ):
            problems.append(
                f"{actual.name}[{name}]: {sheet_found.max_row}x{sheet_found.max_column} "
                f"!= {sheet_wanted.max_row}x{sheet_wanted.max_column}"
            )
            continue
        for row in range(1, sheet_wanted.max_row + 1):
            for column in range(1, sheet_wanted.max_column + 1):
                left = sheet_found.cell(row=row, column=column)
                right = sheet_wanted.cell(row=row, column=column)
                if (left.value, left.data_type) != (right.value, right.data_type):
                    problems.append(
                        f"{actual.name}[{name}] {left.coordinate}: "
                        f"{(left.value, left.data_type)!r} != "
                        f"{(right.value, right.data_type)!r}"
                    )
    return problems


def check(prism_kicad: Path, bundles: Path, case: str) -> list[str]:
    expected_root = PARITY / "goldens" / case / "vendor-jlcpcb"
    bundle = bundles / f"{case}.prism"
    if not bundle.is_file():
        return [f"{case}: {bundle} is missing"]
    problems: list[str] = []
    with tempfile.TemporaryDirectory(prefix=f"jlc-{case}-") as tmp:
        for variant in variants(case):
            output = Path(tmp) / variant
            output.mkdir()
            try:
                run_vendor(prism_kicad, bundle, output, variant)
            except RuntimeError as error:
                problems.append(f"{case}/{variant}: {error}")
                continue
            expected = expected_root / variant
            for name in ("bom.csv", "cpl.csv"):
                problems += [
                    f"{case}/{variant}/{problem}"
                    for problem in compare_csv(expected / name, output / name)
                ]
            for name in ("bom.xlsx", "cpl.xlsx"):
                problems += [
                    f"{case}/{variant}/{problem}"
                    for problem in compare_xlsx(expected / name, output / name)
                ]
            if not any(problem.startswith(f"{case}/{variant}/") for problem in problems):
                print(f"{case}/{variant}: ok")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--prism-kicad", required=True, type=Path)
    parser.add_argument("--bundles", required=True, type=Path)
    parser.add_argument("--cases", default=",".join(DEFAULT_CASES))
    args = parser.parse_args()
    prism_kicad = args.prism_kicad.resolve()
    if not prism_kicad.is_file():
        parser.error(f"--prism-kicad is not a file: {prism_kicad}")
    problems: list[str] = []
    for case in args.cases.split(","):
        problems += check(prism_kicad, args.bundles, case.strip())
    if problems:
        for problem in problems:
            print(f"DIFF {problem}", file=sys.stderr)
        print(f"{len(problems)} difference(s)", file=sys.stderr)
        return 1
    print("all JLCPCB goldens match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
