"""The optional KiCad oracle for placements' pad anchors (field map step 4).

``kicad-cli pcb export ipcd356`` on a copy of the board under the member's
scratch (kicad-cli writes a ``.kicad_prl`` beside its input), with KiCad's
temporary and runtime directories there too. The IPC-D-356 records give every
pad's position in units of 1e-4 inch, y negated. Every numbered pad of the
member must be within half a unit (1.27 µm) of a record with the same
reference and pin (both truncated to the record's field widths). Unnumbered
pads have no record and are not checked; numbered pads without a record are
counted and reported.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path

from .. import fixtures as fx
from . import Context

UNIT_NM = 2540.0  # 1e-4 inch
HALF_UNIT = 0.5 + 1e-6
COORD = re.compile(r"X([+-]?\d{6})Y([+-]?\d{6})")


def records(path: Path) -> dict[tuple[str, str], list[tuple[int, int]]]:
    found: dict[tuple[str, str], list[tuple[int, int]]] = defaultdict(list)
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line[:3] not in ("317", "327", "367") or "VIA" in line[17:26]:
            continue
        ref = line[20:26].strip()
        pin = line[27:31].strip() if line[26:27] == "-" else ""
        match = COORD.search(line)
        if match:
            found[(ref, pin)].append((int(match.group(1)), -int(match.group(2))))
    return found


def compare(document: dict, found: dict) -> tuple[int, float, list, int]:
    checked, worst, over, missing = 0, 0.0, [], 0
    for fp in document["footprints"]:
        ref = fp.get("reference", "")
        for pad in fp["pads"]:
            if not pad["number"]:
                continue
            candidates = found.get((ref[:6], pad["number"][:4]), [])
            if not candidates:
                missing += 1
                continue
            x = pad["positionNm"]["xNm"] / UNIT_NM
            y = pad["positionNm"]["yNm"] / UNIT_NM
            delta = min(max(abs(x - cx), abs(y - cy)) for cx, cy in candidates)
            worst = max(worst, delta)
            checked += 1
            if delta > HALF_UNIT:
                over.append((ref, pad["number"], round(delta, 3)))
    return checked, worst, over, missing


def run(ctx: Context, board: Path, document: dict) -> str | None:
    kicad = ctx.prepared.kicad
    if kicad is None or not document["footprints"]:
        return None
    work = ctx.scratch / "ipcd356"
    if work.exists():
        shutil.rmtree(work)
    (work / "tmp").mkdir(parents=True)
    copy = work / board.name
    shutil.copyfile(board, copy)
    out = work / "board.d356"
    try:
        subprocess.run(
            [kicad.cli, "pcb", "export", "ipcd356", "-o", str(out), str(copy)],
            env=fx.isolated_env(work / "tmp"), check=True, capture_output=True, timeout=900,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        return f"KiCad oracle not run: {type(error).__name__}"
    checked, worst, over, missing = compare(document, records(out))
    text = (
        f"KiCad {kicad.version} ipcd356 oracle: {checked} numbered pads within {worst:.3f} IPC units "
        f"(limit 0.5), {len(over)} over, {missing} numbered pads without a record"
    )
    if over:
        text += f"; over: {over[:10]}"
    return text
