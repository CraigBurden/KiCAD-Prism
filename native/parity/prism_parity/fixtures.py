"""Fixture and corpus manifests, and the inputs a golden is captured from.

A *case* is one project at one revision: a committed fixture (``fixtures.json``)
or a corpus project (a corpus manifest outside the repository, ``corpus.py``).
Its ``source_root`` stands for the repository root (cli-spec.md §5.2, ``--source-root``);
its ``project`` is the anchor, the ``RepoPath`` of the ``.kicad_pro``.

Before any of today's code runs, the case is *prepared*: its source root is
copied into a scratch directory and every ``.kicad_sch``/``.kicad_pcb`` older
than the KiCad's current file format is upgraded exactly as stage parse's
inputs are (``kicad-seeded-upgrade-a0``, cli-spec.md §9.4, bundle-format.md
§2.2). Goldens are therefore computed from the same bytes the bundle parses.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

PARITY_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PARITY_DIR.parent.parent
FIXTURES_FILE = PARITY_DIR / "fixtures.json"
GOLDENS_DIR = PARITY_DIR / "goldens"

# The source kinds of the revision key (revision-key.md §5) that a golden's
# inputs record. Output directories and autosaves never count.
SOURCE_SUFFIXES = (
    ".kicad_pro", ".kicad_sch", ".kicad_pcb", ".kicad_dru", ".kicad_wks", ".kicad_jobset",
    ".kicad_sym", ".kicad_mod", ".lib", ".dcm", ".prism.json",
    ".step", ".stp", ".wrl", ".wrz", ".stpz", ".igs", ".iges",
)
SOURCE_NAMES = ("fp-lib-table", "sym-lib-table")
AUTOSAVE = re.compile(r"(^_autosave-|^~|\.lck$|-bak$|\.bak$)")

# kicad-seeded-upgrade-a0 (cli-spec.md §9.4).
UPGRADE_SEED = 0x50524953
# The (version N) a KiCad release writes. The goldens' KiCad is pinned here so a
# different local KiCad cannot silently produce different upgraded bytes.
CURRENT_FORMAT = {"10.0.6": {"sch": 20260306, "pcb": 20260206}}
VERSION_RE = re.compile(rb"\(version\s+(\d+)\)")


@dataclass
class Case:
    id: str
    source_root: Path  # absolute directory that stands for the repository root
    project: str  # RepoPath of the anchor
    kind: str = "fixture"  # fixture | corpus
    source_root_label: str = ""  # how the manifest names the root (repo-relative for fixtures)
    note: str | None = None
    excluded_dirs: list[str] = field(default_factory=list)
    commit: str | None = None  # corpus: the commit to materialize
    paths: list[str] = field(default_factory=list)  # corpus: pathspecs to materialize (default: all)

    @property
    def project_dir(self) -> str:
        """RepoPath of the anchor's directory, ``""`` at the repository root."""

        parent = Path(self.project).parent.as_posix()
        return "" if parent == "." else parent


def load_fixtures(path: Path = FIXTURES_FILE) -> tuple[list[Case], list[list[str]]]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("schema") != "prism.parity.fixtures.a0":
        raise SystemExit(f"{path}: not a prism.parity.fixtures.a0 manifest")
    cases = [
        Case(
            id=item["id"],
            source_root=(REPO_ROOT / item["sourceRoot"]).resolve(),
            project=item["project"],
            source_root_label=item["sourceRoot"],
            note=item.get("note"),
            excluded_dirs=list(item.get("excludedDirs", [])),
        )
        for item in doc["fixtures"]
    ]
    ids = [case.id for case in cases]
    if len(ids) != len(set(ids)):
        raise SystemExit(f"{path}: duplicate fixture ids")
    return cases, doc.get("pairs", [])


def select(cases: list[Case], names: str | None) -> list[Case]:
    if not names or names == "all":
        return cases
    wanted = [name.strip() for name in names.split(",") if name.strip()]
    known = {case.id: case for case in cases}
    missing = [name for name in wanted if name not in known]
    if missing:
        raise SystemExit(f"unknown case id(s): {', '.join(missing)}")
    return [known[name] for name in wanted]


# ------------------------------------------------------------------ inputs


def is_source(rel: str, excluded_dirs: list[str] = ()) -> bool:
    parts = rel.split("/")
    if any(part.startswith(".") and part not in (".prism.json",) for part in parts[:-1]):
        return False
    if any(rel == d or rel.startswith(d.rstrip("/") + "/") for d in excluded_dirs):
        return False
    name = parts[-1]
    if AUTOSAVE.search(name):
        return False
    return name in SOURCE_NAMES or name.lower().endswith(SOURCE_SUFFIXES)


def source_files(root: Path, excluded_dirs: list[str] = ()) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for name in filenames:
            rel = (Path(dirpath) / name).relative_to(root).as_posix()
            if is_source(rel, excluded_dirs):
                out.append(rel)
    return sorted(out)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def input_hashes(root: Path, excluded_dirs: list[str] = ()) -> dict[str, str]:
    return {rel: sha256_file(root / rel) for rel in source_files(root, excluded_dirs)}


# ----------------------------------------------------------------- tools


@dataclass
class KiCad:
    cli: str
    python: str | None
    version: str

    @property
    def current(self) -> dict[str, int]:
        if self.version not in CURRENT_FORMAT:
            raise SystemExit(
                f"KiCad {self.version}: no pinned file-format versions (prism_parity/fixtures.py CURRENT_FORMAT); "
                f"goldens are captured with KiCad {', '.join(CURRENT_FORMAT)}"
            )
        return CURRENT_FORMAT[self.version]


MAC_CLI = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
MAC_PYTHON = "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3"


def find_kicad(required: bool = True) -> KiCad | None:
    cli = os.environ.get("KICAD_CLI_PATH") or shutil.which("kicad-cli") or (MAC_CLI if Path(MAC_CLI).exists() else None)
    if not cli:
        if required:
            raise SystemExit("kicad-cli not found: set KICAD_CLI_PATH")
        return None
    python = os.environ.get("PRISM_KICAD_PYTHON") or (MAC_PYTHON if Path(MAC_PYTHON).exists() else None)
    with tempfile.TemporaryDirectory(prefix="prism-parity-kicad-") as tmp:
        out = subprocess.run([cli, "version"], capture_output=True, text=True, env=isolated_env(Path(tmp)), check=True)
    version = out.stdout.strip().splitlines()[-1].strip()
    return KiCad(cli=cli, python=python, version=version)


def isolated_env(scratch: Path) -> dict[str, str]:
    """``backend/app/services/kicad_tools.isolated_env``: KiCad's instance lock and caches in ``scratch``."""

    env = dict(os.environ)
    for key in ("TMPDIR", "TMP", "TEMP", "XDG_RUNTIME_DIR"):
        env[key] = str(scratch)
    return env


def file_version(path: Path) -> int | None:
    with path.open("rb") as handle:
        head = handle.read(4096)
    match = VERSION_RE.search(head)
    return int(match.group(1)) if match else None


BOARD_UPGRADE = (
    "import sys, pcbnew\n"
    f"pcbnew.KIID.SeedGenerator({UPGRADE_SEED:#x})\n"
    "board = pcbnew.LoadBoard(sys.argv[1])\n"
    "pcbnew.SaveBoard(sys.argv[1], board)\n"
)


def upgrade(src: Path, kicad: KiCad, scratch: Path, timeout: int = 900) -> list[dict]:
    """Upgrade every old-format schematic and board under ``src`` in place.

    Files are visited in code point order of their path. Returns one record
    per upgraded file: path, original version, upgraded bytes' sha256.
    """

    current = kicad.current
    records = []
    for rel in source_files(src):
        suffix = rel.rsplit(".", 1)[-1]
        kind = {"kicad_sch": "sch", "kicad_pcb": "pcb"}.get(suffix)
        if kind is None:
            continue
        path = src / rel
        version = file_version(path)
        if version is None or version >= current[kind]:
            continue
        work = Path(tempfile.mkdtemp(prefix="upgrade-", dir=scratch))
        env = isolated_env(work)
        if kind == "pcb":
            if not kicad.python:
                raise SystemExit("PRISM_KICAD_PYTHON (KiCad's Python with pcbnew) is needed to upgrade boards")
            copy = work / path.name
            shutil.copyfile(path, copy)
            pro = path.with_suffix(".kicad_pro")
            if pro.exists():
                shutil.copyfile(pro, work / pro.name)
            subprocess.run([kicad.python, "-I", "-c", BOARD_UPGRADE, str(copy)], env=env, check=True,
                           capture_output=True, timeout=timeout)
            shutil.copyfile(copy, path)
        else:
            subprocess.run([kicad.cli, "sch", "upgrade", str(path)], env=env, check=True,
                           capture_output=True, timeout=timeout)
        shutil.rmtree(work, ignore_errors=True)
        records.append({"path": rel, "upgradedFromVersion": version, "upgradedSha256": sha256_file(path)})
    return records


@dataclass
class Prepared:
    case: Case
    src: Path  # the prepared copy: stands for the repository root
    work: Path  # scratch for this case (tool caches, today's side files)
    inputs: list[dict]  # committed inputs, with upgrade records merged in
    kicad: KiCad | None


def prepare(case: Case, scratch: Path, kicad: KiCad | None, *, upgrade_sources: bool = True) -> Prepared:
    """Copy the case's sources into ``scratch/<id>/src`` and upgrade old formats.

    A corpus case is already a scratch export (``corpus.materialize``) and is upgraded in place.
    """

    work = scratch / case.id
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    committed = input_hashes(case.source_root, case.excluded_dirs)
    if case.kind == "corpus":
        # corpus.materialize already exported the commit into scratch: upgrade it in place.
        src = case.source_root
    else:
        src = work / "src"
        src.mkdir()
        for rel in _all_files(case.source_root):
            target = src / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(case.source_root / rel, target)
    upgrades: dict[str, dict] = {}
    if upgrade_sources and kicad is not None:
        tool = work / "kicad-tmp"
        tool.mkdir()
        settings_before = {rel for rel in _all_files(src) if rel.endswith(".kicad_prl")}
        upgrades = {record["path"]: record for record in upgrade(src, kicad, tool)}
        # kicad-cli and pcbnew may write .kicad_prl beside their input; it is not a source.
        for rel in _all_files(src):
            if rel.endswith(".kicad_prl") and rel not in settings_before:
                (src / rel).unlink()
    inputs = []
    for rel, digest in committed.items():
        record = {"path": rel, "sha256": digest}
        if rel in upgrades:
            record.update({k: v for k, v in upgrades[rel].items() if k != "path"})
        inputs.append(record)
    return Prepared(case=case, src=src, work=work, inputs=inputs, kicad=kicad)


def _all_files(root: Path) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d != ".git")
        for name in filenames:
            out.append((Path(dirpath) / name).relative_to(root).as_posix())
    return sorted(out)
