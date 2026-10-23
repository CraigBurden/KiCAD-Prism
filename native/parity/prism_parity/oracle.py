"""The KiCad oracle (ADR §7): check goldens against KiCad itself.

On each case's prepared (upgraded) sources, KiCad 10.0.6 writes:

- ``kicad-cli sch export netlist --format kicadxml`` → components and nets;
- ``kicad-cli pcb export stats --format json`` → pad, via and component counts,
  board thickness and outline size.

Checks (each against the case's golden, when that golden exists):

| Check | KiCad | Golden |
|---|---|---|
| ``netlist-components`` | netlist component references | ``semantic-index`` component references |
| ``netlist-nets`` | nets and their (reference, pin) nodes | ``semantic-index`` terminals grouped by ``schematicNetName`` |
| ``netlist-net-names`` | names of nets whose nodes match a golden net of another name | the golden's name |
| ``stats-thickness`` | ``board.board_thickness`` | ``stackup.boardThicknessNm`` |
| ``stats-vias`` | ``vias`` by type | ``stackup.viaSpans`` counts by ``viaType`` |
| ``stats-pads`` | ``pads`` by type | ``placements`` pad types (smd, thru_hole, connect, np_thru_hole) |
| ``stats-components`` | ``components.total`` front/back | ``placements`` footprints by side |
| ``stats-outline`` | ``board.width``/``height`` (4 decimals) | ``placements.outlineBounds`` |

The same comparison runs on a bundle's members once producers exist (pass
``--goldens`` a directory of members laid out like the goldens). Known,
explained disagreements between KiCad and Prism's contracts are listed in
``oracle-known.json`` with the reason; anything else fails.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from . import fixtures as fx
from .compare import Goldens

KNOWN_FILE = fx.PARITY_DIR / "oracle-known.json"
PAD_TYPES = {"smd": "smd", "thru_hole": "through_hole", "connect": "connector", "np_thru_hole": "npth"}


def _nm(mm_text: str) -> int:
    value = float(re.match(r"\s*(-?[0-9.]+)", mm_text).group(1))
    return int(Decimal(value * 1e6).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _run(kicad: fx.KiCad, args: list[str], scratch: Path) -> subprocess.CompletedProcess:
    scratch.mkdir(parents=True, exist_ok=True)
    return subprocess.run([kicad.cli, *args], capture_output=True, text=True, env=fx.isolated_env(scratch), timeout=900)


def kicad_netlist(kicad: fx.KiCad, schematic: Path, scratch: Path) -> dict | None:
    out = scratch / "netlist.xml"
    run = _run(kicad, ["sch", "export", "netlist", "--format", "kicadxml", "-o", str(out), str(schematic)], scratch / "tmp")
    if run.returncode != 0 or not out.exists():
        return None
    root = ET.parse(out).getroot()
    components = sorted({comp.get("ref") for comp in root.iter("comp")})
    nets: dict[str, set] = {}
    for net in root.iter("net"):
        nets[net.get("name")] = {(node.get("ref"), node.get("pin")) for node in net.iter("node")}
    return {"components": components, "nets": nets}


def kicad_stats(kicad: fx.KiCad, board: Path, scratch: Path) -> dict | None:
    out = scratch / "stats.json"
    run = _run(kicad, ["pcb", "export", "stats", "--format", "json", "--units", "mm", "-o", str(out), str(board)], scratch / "tmp")
    if run.returncode != 0 or not out.exists():
        return None
    return json.loads(out.read_text(encoding="utf-8"))


def _result(check: str, kicad: Any, golden: Any) -> dict:
    ok = kicad == golden
    out = {"check": check, "result": "agree" if ok else "disagree"}
    if not ok:
        out["kicad"] = kicad
        out["golden"] = golden
    return out


def netlist_checks(netlist: dict, index: dict) -> list[dict]:
    golden_refs = sorted({c["reference"] for c in index["components"] if c.get("reference")})
    checks = []
    only_kicad = sorted(set(netlist["components"]) - set(golden_refs))
    only_golden = sorted(set(golden_refs) - set(netlist["components"]))
    check = _result("netlist-components", len(netlist["components"]), len(golden_refs))
    if only_kicad or only_golden:
        check.update(result="disagree", onlyKicad=only_kicad[:20], onlyGolden=only_golden[:20])
    checks.append(check)
    nodes: dict[str, set] = defaultdict(set)
    for terminal in index["terminals"]:
        name = terminal.get("schematicNetName")
        if name is not None and terminal.get("reference"):
            nodes[name].add((terminal["reference"], terminal.get("pin", "")))
    kicad_nets = {name: members for name, members in netlist["nets"].items()}
    only_kicad_nets = sorted(set(kicad_nets) - set(nodes))
    only_golden_nets = sorted(set(nodes) - set(kicad_nets))
    # A net only one side names may be the same net under another name: match by its nodes.
    by_nodes = {frozenset(nodes[name]): name for name in only_golden_nets}
    renamed = {name: by_nodes[frozenset(kicad_nets[name])] for name in only_kicad_nets if frozenset(kicad_nets[name]) in by_nodes}
    only_kicad_nets = [name for name in only_kicad_nets if name not in renamed]
    only_golden_nets = [name for name in only_golden_nets if name not in set(renamed.values())]
    node_mismatch = sorted(name for name in set(kicad_nets) & set(nodes) if kicad_nets[name] != nodes[name])
    check = {"check": "netlist-nets", "kicadNets": len(kicad_nets), "goldenNets": len(nodes),
             "result": "agree" if not (only_kicad_nets or only_golden_nets or node_mismatch) else "disagree"}
    if check["result"] == "disagree":
        check.update(onlyKicad=only_kicad_nets[:20], onlyGolden=only_golden_nets[:20], nodesDiffer=node_mismatch[:20])
        if node_mismatch:
            name = node_mismatch[0]
            check["example"] = {"net": name, "kicadOnly": sorted(kicad_nets[name] - nodes[name])[:10],
                                "goldenOnly": sorted(nodes[name] - kicad_nets[name])[:10]}
    checks.append(check)
    # Same nodes, other name: reported on its own so a naming rule can be explained once.
    check = {"check": "netlist-net-names", "renamed": len(renamed), "result": "agree" if not renamed else "disagree"}
    if renamed:
        check["examples"] = [{"kicad": k, "golden": v} for k, v in sorted(renamed.items())[:10]]
    checks.append(check)
    return checks


def stats_checks(stats: dict, stackup: dict | None, placements: dict | None) -> list[dict]:
    checks = []
    if stackup is not None:
        checks.append(_result("stats-thickness", _nm(stats["board"]["board_thickness"]), stackup["boardThicknessNm"]))
        vias = Counter()
        for span in stackup["viaSpans"]:
            vias[span["viaType"]] += span["count"]
        checks.append(_result("stats-vias", {k: stats["vias"].get(k, 0) for k in ("through", "blind", "buried", "micro")},
                              {k: vias.get(k, 0) for k in ("through", "blind", "buried", "micro")}))
    if placements is not None:
        pads = Counter()
        sides = Counter()
        for footprint in placements["footprints"]:
            sides[footprint["side"]] += 1
            for pad in footprint["pads"]:
                pads[PAD_TYPES.get(pad["type"], pad["type"])] += 1
        kicad_pads = {k: v for k, v in stats["pads"].items() if k in PAD_TYPES.values()}
        checks.append(_result("stats-pads", kicad_pads, {k: pads.get(k, 0) for k in kicad_pads}))
        total = stats["components"]["total"]
        checks.append(_result("stats-components", {"front": total["front"], "back": total["back"]},
                              {"front": sides.get("front", 0), "back": sides.get("back", 0)}))
        bounds = placements.get("outlineBounds")
        if stats["board"].get("has_outline") and bounds:
            width = (bounds["maxNm"]["xNm"] - bounds["minNm"]["xNm"]) / 1e6
            height = (bounds["maxNm"]["yNm"] - bounds["minNm"]["yNm"]) / 1e6
            checks.append(_result("stats-outline", [stats["board"]["width"], stats["board"]["height"]],
                                  [f"{width:.4f} mm", f"{height:.4f} mm"]))
    return checks


def _known() -> list[dict]:
    if not KNOWN_FILE.exists():
        return []
    return json.loads(KNOWN_FILE.read_text(encoding="utf-8")).get("known", [])


def run_case(case: fx.Case, goldens: Goldens, kicad: fx.KiCad, scratch: Path) -> dict:
    prepared = fx.prepare(case, scratch, kicad)
    work = prepared.work / "oracle"
    work.mkdir(parents=True, exist_ok=True)
    project = prepared.src / case.project
    schematic = project.with_suffix(".kicad_sch")
    board = project.with_suffix(".kicad_pcb")
    # The project golden names exactly the root schematic and board the bundle parses.
    for document in (goldens.document(case.id, "project") or {}).get("documents", []):
        if document.get("kind") == "root-schematic":
            schematic = prepared.src / document["path"]
        elif document.get("kind") == "board":
            board = prepared.src / document["path"]
    report: dict[str, Any] = {"case": case.id, "checks": []}
    index = goldens.document(case.id, "semantic-index")
    if schematic.exists() and index is not None:
        netlist = kicad_netlist(kicad, schematic, work)
        if netlist is None:
            report["checks"].append({"check": "netlist", "result": "kicad-failed"})
        else:
            report["checks"].extend(netlist_checks(netlist, index))
    stackup, placements = goldens.document(case.id, "stackup"), goldens.document(case.id, "placements")
    if board.exists() and (stackup is not None or placements is not None):
        stats = kicad_stats(kicad, board, work)
        if stats is None:
            report["checks"].append({"check": "stats", "result": "kicad-failed"})
        else:
            report["checks"].extend(stats_checks(stats, stackup, placements))
    known = {(k["case"], k["check"]): k for k in _known()}
    for check in report["checks"]:
        entry = known.get((case.id, check["check"])) or known.get(("*", check["check"]))
        if check["result"] in ("disagree", "kicad-failed") and entry:
            check["result"] = "known"
            check["reason"] = entry["reason"]
    shutil.rmtree(prepared.work, ignore_errors=True)
    return report


def main(args) -> int:
    kicad = fx.find_kicad()
    goldens = Goldens(Path(args.goldens))
    if args.corpus:
        from . import corpus

        cases = fx.select(corpus.load(Path(args.corpus)), args.cases)
    else:
        cases = fx.select(fx.load_fixtures()[0], args.cases)
    from .capture import new_scratch

    scratch = new_scratch(Path(args.scratch) if args.scratch else None)
    reports = []
    bad = 0
    for case in cases:
        if args.corpus:
            from . import corpus

            corpus.materialize(case, scratch)
        report = run_case(case, goldens, kicad, scratch)
        reports.append(report)
        line = ", ".join(f"{c['check']}={c['result']}" for c in report["checks"]) or "nothing to check"
        print(f"{case.id}: {line}")
        for check in report["checks"]:
            if check["result"] in ("disagree", "kicad-failed"):
                bad += 1
                print(f"    {check['check']}: {json.dumps({k: v for k, v in check.items() if k not in ('check', 'result')}, default=list)[:600]}")
    counts = Counter(c["result"] for r in reports for c in r["checks"])
    print(f"oracle (KiCad {kicad.version}): {len(reports)} case(s); " + ", ".join(f"{v} {k}" for k, v in sorted(counts.items())))
    if args.json:
        Path(args.json).write_text(json.dumps({"kicad": kicad.version, "cases": reports}, indent=1, default=list) + "\n")
    return 1 if bad else 0
