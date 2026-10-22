"""Check an assembly artwork's drill and slot marks against KiCad's drill files.

Local check (it needs a full bundle, so Geometer and KiCad): build the oracle
board's bundle through stage models, render both assembly views, then

    python native/parity/docs-oracle/check_artwork.py <dir with assembly_*_view.svg> \\
        native/parity/docs-oracle/kicad

Every KiCad hole must have a mark within 2 µm, in the top view and in the
mirrored bottom view (whose marks are drawn in board coordinates under a
`scale(-1 1)` group). Exit status 1 on any miss.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def excellon(path: Path) -> list[tuple[float, float]]:
    """Round holes and slot midpoints, board frame (KiCad writes y up)."""

    points: list[tuple[float, float]] = []
    start: tuple[float, float] | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"(G0[01])?X([-\d.]+)Y([-\d.]+)", line.strip())
        if not match:
            continue
        x, y = float(match.group(2)), -float(match.group(3))
        if match.group(1) == "G00":
            start = (x, y)
        elif match.group(1) == "G01" and start is not None:
            points.append(((start[0] + x) / 2, (start[1] + y) / 2))
            start = None
        else:
            points.append((x, y))
    return points


def marks(svg: str) -> list[tuple[float, float]]:
    found: list[tuple[float, float]] = []
    for layer in ("DRILLS", "SLOTS"):
        group = re.search(rf'<g id="layer-{layer}"[^>]*>(.*?)</g>', svg, re.S)
        body = group.group(1) if group else ""
        found += [(float(x), float(y)) for x, y in re.findall(r'<circle cx="([-\d.]+)" cy="([-\d.]+)"', body)]
        found += [
            ((float(a) + float(c)) / 2, (float(b) + float(d)) / 2)
            for a, b, c, d in re.findall(
                r'<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"', body
            )
        ]
    return found


def main() -> int:
    art, kicad = Path(sys.argv[1]), Path(sys.argv[2])
    # Every drilled span (through, blind and micro F.Cu-In1.Cu, buried
    # In1.Cu-In2.Cu); a backdrill re-drills a hole that is already counted.
    truth = [
        hole
        for name in ("oracle-PTH.drl", "oracle-NPTH.drl", "oracle-front-in1.drl", "oracle-in1-in2.drl")
        for hole in excellon(kicad / name)
    ]
    failed = False
    for view in ("top", "bottom"):
        drawn = marks((art / f"assembly_{view}_view.svg").read_text(encoding="utf-8"))
        misses = 0
        worst = 0.0
        for hole in truth:
            distance = min(
                ((hole[0] - mark[0]) ** 2 + (hole[1] - mark[1]) ** 2) ** 0.5 for mark in drawn
            ) if drawn else float("inf")
            worst = max(worst, distance)
            misses += distance > 0.002
        print(f"{view}: {len(drawn)} marks, {len(truth)} KiCad holes, {misses} missed, worst {worst:.4f} mm")
        failed |= misses > 0 or len(drawn) != len(truth)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
