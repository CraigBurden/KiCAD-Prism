"""Write backend/tests/.test_durations.json (seconds per test module) from pytest JUnit XML files.

The CI backend shards (``pytest --shard k/n``, backend/tests/conftest.py) balance whole modules by
these numbers. Refresh them when shards drift apart: download the ``backend-results-*`` artifacts of
a recent run and pass their ``results.xml`` files here.

    python scripts/update_backend_test_durations.py results-1.xml results-2.xml results-3.xml
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / "backend" / "tests" / ".test_durations.json"


def module_durations(paths: list[str]) -> dict[str, float]:
    totals: Counter[str] = Counter()
    for path in paths:
        for case in ET.parse(path).iter("testcase"):
            parts = case.get("classname", "").split(".")
            module = parts[1] if len(parts) > 1 and parts[0] == "tests" else parts[0]
            if module:
                totals[module] += float(case.get("time") or 0)
    return {module: round(seconds, 1) for module, seconds in sorted(totals.items())}


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    durations = module_durations(argv)
    TARGET.write_text(json.dumps(durations, indent=1, sort_keys=True) + "\n")
    print(f"{len(durations)} modules, {sum(durations.values()):.0f} s -> {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
