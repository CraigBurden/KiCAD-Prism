"""Project consumer checks: the field map's "Card", "3D" and "Closure" adapters.

Field map ``project.md``, "How a golden is produced from today's code" (the W0
scripts ``run_today.py`` and ``rederive.py``). Each adapter re-derives one of
today's outputs from the golden; today's output comes from today's code on the
prepared copy (Card, 3D) or on a scratch git repository made from a copy of
it (Closure: ``materialize_input_closure`` reads git objects). Nothing touches
a real repository.

The closure is checked in two model environments, ``{}`` and
``KICAD10_3DMODEL_DIR`` = KiCad 10.0.6's stock models when this host has them.
Only the check depends on the host; the golden does not.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .. import jsonvalue
from . import Context
from .project import is_path_reference, normalize

STOCK_MODELS = Path("/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels")
LOADABLE = (".step", ".stp", ".stpz", ".stepz", ".step.gz", ".stp.gz", ".igs", ".iges", ".wrl", ".wrz", ".x3d", ".idf", ".emn")
GIT_DATE = "2026-01-01T00:00:00Z"


def _detail(diffs: list, limit: int) -> list[str]:
    out = [d.describe() for d in diffs[:limit]]
    if len(diffs) > limit:
        out.append(f"... {len(diffs)} differences in all")
    return out


def compare(shape: str, today: Any, rederived: Any, explain=None) -> dict:
    diffs = list(jsonvalue.diff(today, rederived))
    if not diffs:
        return {"shape": shape, "result": "equal"}
    if explain is not None:
        adjusted, ids = explain(today)
        if ids and jsonvalue.equal(adjusted, rederived):
            return {"shape": shape, "result": "divergence", "divergences": sorted(set(ids)),
                    "detail": _detail(diffs, 10)}
    return {"shape": shape, "result": "differs", "detail": _detail(diffs, 20)}


def _strip_project_dir(project_dir: str, repo_path: str) -> str:
    """D12: today's card path is relative to the project directory."""

    if not project_dir:
        return repo_path
    prefix = project_dir.rstrip("/") + "/"
    return repo_path[len(prefix):] if repo_path.startswith(prefix) else repo_path


# -------------------------------------------------------------------- card


def card(member: dict, kind: str, project_dir: str):
    for d in member["documents"]:
        if d["kind"] == kind:
            out = {
                "path": _strip_project_dir(project_dir, d["path"]),
                "filename": d["path"].rsplit("/", 1)[-1],
                "version": d.get("formatVersion"),
                "generator": d.get("generator"),
                "generator_version": d.get("generatorVersion"),
                "title_block": None,
            }
            if "expandedTitleBlock" in d:
                tb = d["expandedTitleBlock"]
                out["title_block"] = {"title": tb.get("title", ""), "date": tb.get("date", "")}
            return out
    return None


def today_card(ctx: Context) -> dict:
    from kicad_monkey import KiCadProject

    from app.services import project_properties_service as pps

    pro = ctx.project_file.resolve()
    variables = dict(KiCadProject.from_file(str(pro)).text_variables)
    project_dir = str(pro.parent)
    sch = pro.with_suffix(".kicad_sch")
    pcb = pro.with_suffix(".kicad_pcb")
    schematic = pps.compute_schematic_metadata(project_dir, str(sch) if sch.exists() else None,
                                               project_variables=variables, project_name=pro.stem)
    board = pps.compute_pcb_metadata(project_dir, str(pcb) if pcb.exists() else None, {},
                                     project_variables=variables, project_name=pro.stem)
    if board is not None:
        board = {k: v for k, v in board.items() if k not in ("dimensions_mm", "thickness_mm")}
    return {"schematic": schematic, "pcb": board}


def _card_explain(today: dict, member: dict):
    """D1: a bare ``(generator eeschema)`` is ``null`` today (quoted strings only)."""

    adjusted = json.loads(json.dumps(today))
    ids = []
    for side, kind in (("schematic", "root-schematic"), ("pcb", "board")):
        doc = next((d for d in member["documents"] if d["kind"] == kind), None)
        if adjusted.get(side) and doc and adjusted[side]["generator"] is None and doc.get("generator") is not None:
            adjusted[side]["generator"] = doc["generator"]
            ids.append("D1")
    return adjusted, ids


# --------------------------------------------------------------------- 3D


def net_classes(member: dict) -> list[dict]:
    out = []
    for c in member["netClasses"]:
        def mm(key):
            return None if key not in c else c[key] / 1e6

        out.append({
            "name": c["name"], "track_width": mm("trackWidthNm"), "clearance": mm("clearanceNm"),
            "diff_pair_gap": mm("diffPairGapNm"), "diff_pair_width": mm("diffPairWidthNm"),
            "via_diameter": mm("viaDiameterNm"), "via_drill": mm("viaDrillNm"),
        })
    return out


# ----------------------------------------------------------------- closure


def scratch_repository(ctx: Context) -> Path:
    """A git repository of a copy of ``ctx.src``: fixed identity and dates, one commit."""

    repo = ctx.scratch / "closure-repo"
    if repo.exists():
        shutil.rmtree(repo)
    shutil.copytree(ctx.src, repo, symlinks=True)
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("GIT_")},
        "GIT_AUTHOR_NAME": "prism-parity", "GIT_AUTHOR_EMAIL": "parity@prism.invalid", "GIT_AUTHOR_DATE": GIT_DATE,
        "GIT_COMMITTER_NAME": "prism-parity", "GIT_COMMITTER_EMAIL": "parity@prism.invalid", "GIT_COMMITTER_DATE": GIT_DATE,
        "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
    }

    def git(*args: str) -> None:
        subprocess.run(["git", "-C", str(repo), *args], env=env, check=True, capture_output=True)

    git("init", "-q", "-b", "main")
    git("config", "core.autocrlf", "false")
    git("add", "-A")
    git("commit", "-q", "--no-gpg-sign", "-m", "parity fixture")
    return repo


def today_closure(ctx: Context, repo: Path, model_env: dict) -> dict:
    from app.release_studio.closure import materialize_input_closure

    dest = ctx.scratch / "closure-out"
    if dest.exists():
        shutil.rmtree(dest)
    closure = materialize_input_closure(repo, "HEAD", dest, relative_path=ctx.project_dir or ".", model_env=model_env, model_stage=None)
    record = closure.to_dict()
    shutil.rmtree(dest, ignore_errors=True)
    return {"library_references": record["library_references"], "env_bindings": record["env_bindings"]}


def _host_digest(path: str):
    p = Path(path)
    try:
        if p.is_symlink() or not p.is_file():
            return None
        return hashlib.sha256(p.read_bytes()).hexdigest()
    except OSError:
        return None


def closure_records(member: dict, project_dir: str, model_env: dict) -> dict:
    """The field map's Closure adapter: today's records from the member plus ``model_env``."""

    records: dict[str, dict] = {}
    bindings: set[str] = set()
    for r in member["references"]:
        kind, raw, t = r["kind"], r["raw"], r["target"]
        if kind == "model-3d":
            if raw.startswith("kicad-embed://"):
                continue  # closure_references.py:136-137
        elif kind not in ("footprint-library", "symbol-library") and not is_path_reference(raw):
            continue  # today's generic scan sees only ${…} text
        used = set(r["variables"])
        if "KIPRJMOD" in used:
            bindings.add("KIPRJMOD")
        rec: dict[str, Any] = {"source_path": r["documentPath"], "reference": raw, "resolved_path": "", "location": "", "advisory": False}
        if kind == "model-3d":
            pinned = not raw.startswith(("${", "$(", "/"))
            if t["kind"] == "repository":
                if t["inSources"]:
                    rec.update(location="closure", resolved_path=t["path"])
                elif pinned:
                    rec.update(location="unreadable")
                elif Path(t["path"]).suffix.casefold() in (".wrl", ".wrz"):
                    rec.update(location="substitutable")
                else:
                    rec.update(location="missing", advisory=True)
            elif t["kind"] in ("kicad-library", "absolute"):
                if t["kind"] == "kicad-library":
                    root = model_env.get(t["variable"], "")
                    path = f"{root.rstrip('/')}/{t['relativePath']}" if root else ""
                else:
                    path = t["path"]
                loadable = path.casefold().endswith(LOADABLE) and raw.replace("\\", "/").casefold().endswith(LOADABLE)
                digest = _host_digest(path) if path and loadable else None
                if digest:
                    rec.update(location="host", digest=digest)
                else:
                    rec.update(location="unreadable")
            else:  # outside-repository, unresolved
                rec.update(location="unreadable")
        else:
            others = used - {"KIPRJMOD"}
            if others:
                rec.update(location="external")  # D6: _PathResolver knows only KIPRJMOD
            elif t["kind"] == "repository":
                if t["inSources"]:
                    rec.update(location="closure", resolved_path=t["path"] or ".")
                else:
                    rec.update(location="missing")
            elif t["kind"] == "unresolved" and t["reason"] not in ("undefined-variable", "home-relative", "uri"):
                rec.update(location="missing")
            else:
                rec.update(location="external")
        records[f"{rec['source_path']}\x1f{raw}"] = rec
    env = [{"name": n, "value": project_dir or "."} for n in sorted(bindings)]
    return {"library_references": dict(sorted(records.items())), "env_bindings": env}


def _today_closure_view(today: dict) -> dict:
    return {
        "library_references": dict(sorted((f"{r['source_path']}\x1f{r['reference']}", r) for r in today["library_references"])),
        "env_bindings": today["env_bindings"],
    }


def _closure_explain(project_dir: str):
    own = {"/".join(normalize(project_dir.split("/") if project_dir else [], name)) for name in ("fp-lib-table", "sym-lib-table")}

    def explain(today: dict):
        """D2: library tables outside the project directory are not the project's."""

        kept, ids = {}, []
        for key, rec in today["library_references"].items():
            name = rec["source_path"].rsplit("/", 1)[-1]
            if name in ("fp-lib-table", "sym-lib-table") and rec["source_path"] not in own:
                ids.append("D2")
                continue
            kept[key] = rec
        return {"library_references": kept, "env_bindings": today["env_bindings"]}, ids

    return explain


# ------------------------------------------------------------------ driver


def run_checks(ctx: Context, member: dict) -> tuple[list[dict], list[str]]:
    checks: list[dict] = []
    notes: list[str] = []

    today = today_card(ctx)
    derived = {"schematic": card(member, "root-schematic", ctx.project_dir), "pcb": card(member, "board", ctx.project_dir)}
    checks.append(compare("card", today, derived, lambda t: _card_explain(t, member)))

    from topology_compiler.board_metadata import project_net_classes

    checks.append(compare("3d.netClasses", project_net_classes(ctx.project_file.resolve()), net_classes(member)))

    environments = [("closure.emptyEnv", {})]
    if STOCK_MODELS.is_dir():
        environments.append(("closure.kicad10Env", {"KICAD10_3DMODEL_DIR": str(STOCK_MODELS)}))
    else:
        notes.append("KiCad 10.0.6 stock 3D models not on this host: closure checked with the empty model environment only")
    repo = scratch_repository(ctx)
    for shape, env in environments:
        today_view = _today_closure_view(today_closure(ctx, repo, env))
        checks.append(compare(shape, today_view, closure_records(member, ctx.project_dir, env), _closure_explain(ctx.project_dir)))
    shutil.rmtree(repo, ignore_errors=True)
    return checks, notes
