#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass
class SplitStats:
    input_files: int = 0
    symbols_written: int = 0
    cli_converted_files: int = 0
    fallback_converted_files: int = 0
    skipped_files: int = 0
    errors: list[str] = field(default_factory=list)


def _sanitize_name(value: str, default: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {"_", "-", "."} else "_" for ch in (value or "").strip())
    cleaned = cleaned.strip("._-")
    return cleaned or default


def _discover_symbol_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path] if input_path.suffix.lower() == ".kicad_sym" else []
    return sorted(input_path.rglob("*.kicad_sym"))


def _find_kicad_cli(explicit: str) -> str | None:
    candidates = [
        explicit,
        shutil.which("kicad-cli") or "",
        "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli",
        str(Path.home() / "Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"),
        "/usr/bin/kicad-cli",
        "/usr/local/bin/kicad-cli",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def _run_kicad_cli_split(kicad_cli: str, source: Path, destination: Path, *, dry_run: bool) -> tuple[bool, str, int]:
    if dry_run:
        return True, "", 0
    destination.mkdir(parents=True, exist_ok=True)
    before = {path.resolve() for path in destination.rglob("*.kicad_sym")}
    result = subprocess.run(
        [
            kicad_cli,
            "sym",
            "upgrade",
            "--force",
            "--output",
            str(destination),
            str(source),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False, (result.stderr or result.stdout or f"kicad-cli exited with {result.returncode}").strip(), 0
    after = {path.resolve() for path in destination.rglob("*.kicad_sym")}
    return True, "", len(after - before)


def _discover_symbol_names_in_text(text: str) -> list[str]:
    matches = re.findall(r'\(symbol\s+"([^"]+)"', text)
    seen: set[str] = set()
    names: list[str] = []
    for name in matches:
        if re.search(r"_\d+_\d+$", name):
            continue
        if name not in seen:
            seen.add(name)
            names.append(name)
    return names


def _extract_top_level_symbol_blocks(text: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    depth = 0
    start: int | None = None
    name = ""
    in_string = False
    escape = False
    i = 0
    while i < len(text):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            i += 1
            continue
        if ch == "(":
            if depth == 1 and text.startswith("(symbol", i):
                start = i
                j = i + len("(symbol")
                while j < len(text) and text[j].isspace():
                    j += 1
                if j < len(text) and text[j] == '"':
                    j += 1
                    chars: list[str] = []
                    escaped = False
                    while j < len(text):
                        current = text[j]
                        if escaped:
                            chars.append(current)
                            escaped = False
                        elif current == "\\":
                            escaped = True
                        elif current == '"':
                            break
                        else:
                            chars.append(current)
                        j += 1
                    name = "".join(chars)
            depth += 1
        elif ch == ")":
            depth -= 1
            if start is not None and depth == 1:
                blocks.append((name, text[start : i + 1]))
                start = None
                name = ""
        i += 1
    return [(name, block) for name, block in blocks if not re.search(r"_\d+_\d+$", name)]


def _symbol_header(text: str) -> tuple[str, str, str]:
    version_match = re.search(r"\(version\s+([^)]+)\)", text)
    generator_match = re.search(r"\(generator\s+([^)]+)\)", text)
    generator_version_match = re.search(r"\(generator_version\s+([^)]+)\)", text)
    version = version_match.group(1) if version_match else "20211014"
    generator = generator_match.group(1) if generator_match else '"KiCAD Prism Splitter"'
    generator_version = generator_version_match.group(1) if generator_version_match else ""
    return version, generator, generator_version


def _fallback_split(source: Path, destination: Path, *, dry_run: bool, overwrite: bool) -> int:
    text = source.read_text(encoding="utf-8", errors="ignore")
    blocks = _extract_top_level_symbol_blocks(text)
    if not blocks:
        return 0
    version, generator, generator_version = _symbol_header(text)
    destination.mkdir(parents=True, exist_ok=True)
    written = 0
    generator_version_line = f"\n  (generator_version {generator_version})" if generator_version else ""
    for symbol_name, block in blocks:
        symbol_file = destination / f"{_sanitize_name(symbol_name, 'symbol')}.kicad_sym"
        payload = (
            f"(kicad_symbol_lib\n"
            f"  (version {version})\n"
            f"  (generator {generator})"
            f"{generator_version_line}\n"
            f"  {block}\n"
            f")\n"
        )
        if symbol_file.exists() and symbol_file.read_text(encoding="utf-8", errors="ignore") != payload and not overwrite:
            raise ValueError(f"Refusing to overwrite existing different file: {symbol_file}")
        if not dry_run:
            symbol_file.write_text(payload, encoding="utf-8")
        written += 1
    return written


def _destination_for_source(source: Path, input_root: Path, output_root: Path, *, flat: bool) -> Path:
    if flat:
        return output_root
    if input_root.is_file():
        return output_root / _sanitize_name(source.stem, "symbols")
    try:
        relative = source.relative_to(input_root)
        parent_parts = relative.parent.parts
    except ValueError:
        parent_parts = ()
    name_parts = [*parent_parts, source.stem]
    return output_root.joinpath(*[_sanitize_name(part, "library") for part in name_parts])


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Split packed KiCad .kicad_sym libraries into one .kicad_sym file per symbol."
    )
    parser.add_argument("input", type=Path, help="Packed .kicad_sym file or directory containing .kicad_sym files.")
    parser.add_argument("output", type=Path, help="Output directory for unpacked one-symbol-per-file libraries.")
    parser.add_argument("--kicad-cli", default="", help="Path to kicad-cli. Defaults to PATH or common install locations.")
    parser.add_argument("--no-kicad-cli", action="store_true", help="Use the built-in splitter instead of kicad-cli.")
    parser.add_argument("--strict-kicad-cli", action="store_true", help="Fail instead of falling back when kicad-cli split fails.")
    parser.add_argument("--flat", action="store_true", help="Write all symbols directly into the output directory.")
    parser.add_argument("--overwrite", action="store_true", help="Allow overwriting existing different files.")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be processed without writing files.")
    parser.add_argument("--report-json", type=Path, default=None, help="Optional JSON report path.")
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    input_path = args.input.expanduser().resolve()
    output_root = args.output.expanduser().resolve()
    stats = SplitStats()

    if not input_path.exists():
        print(f"Input does not exist: {input_path}", file=sys.stderr)
        return 2

    symbol_files = _discover_symbol_files(input_path)
    if not symbol_files:
        print(f"No .kicad_sym files found in {input_path}", file=sys.stderr)
        return 2

    kicad_cli = None if args.no_kicad_cli else _find_kicad_cli(args.kicad_cli)

    for source in symbol_files:
        stats.input_files += 1
        destination = _destination_for_source(source, input_path, output_root, flat=args.flat)
        try:
            if kicad_cli:
                success, error, written = _run_kicad_cli_split(kicad_cli, source, destination, dry_run=args.dry_run)
                if success:
                    stats.cli_converted_files += 1
                    stats.symbols_written += written or len(_discover_symbol_names_in_text(source.read_text(encoding="utf-8", errors="ignore")))
                    continue
                if args.strict_kicad_cli:
                    raise ValueError(error)
            written = _fallback_split(source, destination, dry_run=args.dry_run, overwrite=args.overwrite)
            if written:
                stats.fallback_converted_files += 1
                stats.symbols_written += written
            else:
                stats.skipped_files += 1
                stats.errors.append(f"No symbols found in {source}")
        except Exception as exc:  # noqa: BLE001
            stats.errors.append(f"{source}: {exc}")

    report = asdict(stats)
    report["input"] = str(input_path)
    report["output"] = str(output_root)
    report["kicad_cli"] = kicad_cli or ""
    if args.report_json:
        args.report_json.parent.mkdir(parents=True, exist_ok=True)
        args.report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if stats.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
