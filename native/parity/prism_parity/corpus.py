"""The private corpus: projects on a developer machine, never committed (ADR §7).

A corpus manifest (``prism.parity.corpus.a0``) lives outside the repository::

    {
      "schema": "prism.parity.corpus.a0",
      "projects": [
        {
          "id": "board-a",                          # case id, [a-z0-9._-]+
          "repository": "/abs/path/to/git/repo",    # read-only; never written
          "commit": "HEAD",                         # or a commit sha
          "project": "hw/board-a/board-a.kicad_pro", # the anchor, a RepoPath
          "paths": ["hw", "lib"],                   # optional: pathspecs to materialize (default: the whole tree)
          "excludedDirs": ["hw/board-a/Outputs"]    # optional: as the effective config's excluded_dirs
        }
      ]
    }

``materialize`` exports the commit with ``git archive`` into the scratch
directory (no checkout, no write to the repository: the same files ``git
ls-tree`` names, so the source set matches a revision key at that commit).
LFS files arrive as their pointers and submodules are absent, exactly as an
un-hydrated ``git archive``; a corpus project that needs either must be
hydrated by hand first (K's materializer does both in the job).

Corpus goldens go to a directory outside the repository (``corpus --out``);
``refuse_inside_repo`` enforces it.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tarfile
from pathlib import Path

from . import fixtures as fx

CORPUS_SCHEMA = "prism.parity.corpus.a0"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


def refuse_inside_repo(path: Path) -> None:
    resolved = path.resolve()
    if resolved == fx.REPO_ROOT or fx.REPO_ROOT in resolved.parents:
        raise SystemExit(f"{path}: corpus goldens hold private project data and never go inside the repository")


def load(path: Path) -> list[fx.Case]:
    if path.resolve().is_relative_to(fx.REPO_ROOT) and path.name != "corpus.example.json":
        refuse_inside_repo(path)  # a real manifest names private projects
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("schema") != CORPUS_SCHEMA:
        raise SystemExit(f"{path}: not a {CORPUS_SCHEMA} manifest")
    cases = []
    for item in doc["projects"]:
        if not ID_RE.match(item["id"]):
            raise SystemExit(f"{path}: bad case id {item['id']!r}")
        case = fx.Case(
            id=item["id"],
            source_root=Path(item["repository"]),
            project=item["project"],
            kind="corpus",
            source_root_label=f"corpus:{item['id']}",
            note=item.get("note"),
            excluded_dirs=list(item.get("excludedDirs", [])),
            commit=item.get("commit", "HEAD"),
            paths=list(item.get("paths", [])),
        )
        cases.append(case)
    return cases


def materialize(case: fx.Case, scratch: Path) -> None:
    """Export the case's commit into ``scratch/<id>-repo`` and point the case at it."""

    repo = Path(case.source_root)
    sha = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", f"{case.commit}^{{commit}}"],
                         capture_output=True, text=True, check=True).stdout.strip()
    target = scratch / f"{case.id}-repo"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    with subprocess.Popen(["git", "-C", str(repo), "archive", "--format=tar", sha, *case.paths],
                          stdout=subprocess.PIPE) as process:
        with tarfile.open(fileobj=process.stdout, mode="r|") as tar:
            tar.extractall(target, filter="data")
    if process.returncode != 0:
        raise SystemExit(f"{case.id}: git archive failed ({process.returncode})")
    case.source_root = target
    case.source_root_label = f"corpus:{case.id}@{sha}"
