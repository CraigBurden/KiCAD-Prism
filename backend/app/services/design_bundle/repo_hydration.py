"""Submodules and Git LFS objects for the bundle's sources (decisions.md, bundle manifest item 3).

A bundle materializes every design source of a revision, including files in
submodules and LFS objects (ADR §11 G4). Prism's import and sync therefore
initialize submodules recursively and fetch LFS objects into the clone, so a
worker can materialize them later without the network. A failure here never
fails the sync: it is reported, and a bundle that then cannot materialize a
design source fails its own job, which is retried.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Mapping

TIMEOUT_SECONDS = 900


def _run(repo: Path, args: list[str], env: Mapping[str, str] | None) -> tuple[bool, str]:
    try:
        process = subprocess.run(
            ["git", "-C", str(repo), *args], capture_output=True, text=True, env=dict(env) if env else None,
            timeout=TIMEOUT_SECONDS, check=False, stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return False, str(error)
    return process.returncode == 0, (process.stderr or process.stdout).strip()[-400:]


def hydrate(repo: Path, *, env: Mapping[str, str] | None = None) -> dict[str, object]:
    """``git submodule update --init --recursive``, then the LFS objects of every commit the prebuild builds."""

    report: dict[str, object] = {"submodules": "none", "lfs": "none"}
    if (repo / ".gitmodules").is_file():
        ok, detail = _run(repo, ["submodule", "update", "--init", "--recursive"], env)
        report["submodules"] = "initialized" if ok else f"failed: {detail}"
    if shutil.which("git-lfs") is None:
        report["lfs"] = "git-lfs is not installed"
        return report
    # HEAD's objects into the working tree, then those of every commit the
    # prebuild builds (branch heads, each branch's newest commits, tags) into
    # the local store, where materialization looks for them. ``--recent``
    # alone skips a branch not updated in the last days, whose bundles then
    # lose its LFS 3D models.
    ok, detail = _run(repo, ["lfs", "pull"], env)
    if ok:
        from app.services.design_bundle.reuse import prebuild_commits

        commits = prebuild_commits(repo)
        if commits:
            ok, detail = _run(repo, ["lfs", "fetch", "origin", *commits], env)
    if ok and (repo / ".gitmodules").is_file():
        ok, detail = _run(repo, ["submodule", "foreach", "--recursive", "git lfs pull"], env)
    report["lfs"] = "fetched" if ok else f"failed: {detail}"
    return report
