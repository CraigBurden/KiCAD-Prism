"""Prove the runner before any producer exists, on hand-made bundles.

1. ``goldens-as-bundles/``: every case's goldens as an unpacked bundle
   (``<case>/projections/<stem>.json``), plus one case as a ``.prism`` archive,
   each with the accepted divergences applied, as a correct producer writes them.
   The runner must report every member equal (or equal through an accepted
   divergence), every refusal expected, and exit 0.
2. ``deliberate-change/``: the same, with one number changed in one member and
   one key removed from another. The runner must exit 1 and name exactly those
   two pointers, and nothing else.
3. The same changed bundle with a temporary divergence file that accepts the
   two changes: the runner must exit 0 and report ``equal-with-divergences``.
4. A changed non-semantic field (the semantic index's ``designKey``)
   must not count.
5. Where a route-metrics golden is changed by the accepted D7 rule, a member
   equal to the rule's output must pass as ``equal-with-divergences`` and the
   unchanged golden must fail.
"""

from __future__ import annotations

import argparse
import copy
import io
import json
import shutil
import tempfile
import zipfile
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

from . import compare, divergences as dv, jsonvalue
from .fixtures import PARITY_DIR
from .members import MEMBERS


def _write_bundle(root: Path, case: str, documents: dict[str, Any]) -> None:
    target = root / case / "projections"
    target.mkdir(parents=True, exist_ok=True)
    for stem, doc in documents.items():
        (target / MEMBERS[stem].golden_name).write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_archive(path: Path, documents: dict[str, Any]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for stem, doc in sorted(documents.items()):
            archive.writestr(MEMBERS[stem].bundle_path, json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")


def _run(argv: list[str]) -> tuple[int, str, dict]:
    from .__main__ import main

    buffer = io.StringIO()
    with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as handle:
        report_path = handle.name
    with redirect_stdout(buffer):
        code = main(argv + ["--json", report_path])
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    Path(report_path).unlink()
    return code, buffer.getvalue(), report


def _first_number(node: Any, pointer: str = "") -> str | None:
    if isinstance(node, dict):
        for key in sorted(node):
            found = _first_number(node[key], f"{pointer}/{jsonvalue.escape(key)}")
            if found:
                return found
    elif isinstance(node, list):
        for index, item in enumerate(node):
            found = _first_number(item, f"{pointer}/{index}")
            if found:
                return found
    elif isinstance(node, (int, float)) and not isinstance(node, bool):
        return pointer
    return None


def _removable_keys(node: Any, pointer: str = ""):
    """Pointers of nested (not top-level) object keys holding scalars, depth first."""

    if isinstance(node, dict):
        for key in sorted(node):
            child = node[key]
            here = f"{pointer}/{jsonvalue.escape(key)}"
            if pointer and not isinstance(child, (dict, list)):
                yield here
            else:
                yield from _removable_keys(child, here)
    elif isinstance(node, list):
        for index, item in enumerate(node):
            yield from _removable_keys(item, f"{pointer}/{index}")


def main(args: argparse.Namespace) -> int:
    goldens = compare.Goldens(Path(args.goldens))
    cases = goldens.cases()
    if not cases:
        print("selftest: no goldens")
        return 1
    work = Path(args.work) if args.work else Path(tempfile.mkdtemp(prefix="prism-parity-selftest-"))
    for sub in ("goldens-as-bundles", "deliberate-change", "divergences-accepting-change"):
        shutil.rmtree(work / sub, ignore_errors=True)
    failures: list[str] = []

    def expect(condition: bool, message: str) -> None:
        print(("  ok    " if condition else "  FAIL  ") + message)
        if not condition:
            failures.append(message)

    documents = {
        case: {stem: goldens.document(case, stem) for stem in MEMBERS
               if (goldens.capture(case) or {}).get("members", {}).get(stem, {}).get("status") == "captured"}
        for case in cases
    }
    # What a correct producer writes: the golden with the accepted divergences applied
    # (route-metrics D7 on rs-cynthion). The goldens themselves stay today's output.
    divergence_dir = PARITY_DIR / "divergences"
    members = {
        case: {stem: dv.apply(dv.load(divergence_dir, stem), case, doc, doc, docs)[0] for stem, doc in docs.items()}
        for case, docs in documents.items()
    }
    total = sum(len(d) for d in documents.values())

    # 1. The goldens themselves.
    clean = work / "goldens-as-bundles"
    for case, docs in members.items():
        _write_bundle(clean, case, docs)
    archive_case = next(case for case in cases if documents[case])
    shutil.rmtree(clean / archive_case)
    _write_archive(clean / f"{archive_case}.prism", members[archive_case])
    code, out, report = _run(["compare", "--bundles", str(clean), "--goldens", str(goldens.root), "--require-all", "--quiet"])
    print("1. goldens as bundles")
    equal = report["counts"].get("equal", 0) + report["counts"].get("equal-with-divergences", 0)
    refused = report["counts"].get("expected-refusal", 0)
    expect(code == 0, f"exit 0 (got {code})")
    expect(equal == total, f"{equal} of {total} members equal ({report['counts'].get('equal-with-divergences', 0)} through an "
           f"accepted divergence; {refused} expected refusals; {len(cases)} cases; {archive_case} as a .prism archive)")

    # 2. A deliberate change.
    changed = work / "deliberate-change"
    shutil.copytree(clean, changed)
    case = max(cases, key=lambda c: (len(documents[c]), c == archive_case))
    stems = sorted(documents[case])
    mutated = copy.deepcopy(members[case])
    number_stem = next(s for s in stems if _first_number(documents[case][s]))
    number_pointer = _first_number(documents[case][number_stem])
    old = jsonvalue.resolve(mutated[number_stem], jsonvalue.split(number_pointer))
    key_stem = next((s for s in stems if s != number_stem and next(_removable_keys(documents[case][s]), None)), number_stem)
    key_pointer = next(p for p in _removable_keys(documents[case][key_stem]) if p != number_pointer)
    edits: dict[str, list[dict]] = {}
    edits.setdefault(number_stem, []).append({"op": "replace", "path": number_pointer, "value": old + 1})
    edits.setdefault(key_stem, []).append({"op": "remove", "path": key_pointer})
    for stem, ops in edits.items():
        for op in ops:
            jsonvalue.apply_patch(mutated[stem], op)
        if stem == "system-interface":  # a producer writes the digest of what it emits
            ops.append({"op": "replace", "path": "/digest", "value": compare.system_interface_digest(mutated[stem])})
            jsonvalue.apply_patch(mutated[stem], ops[-1])
    if (changed / f"{case}.prism").exists():
        (changed / f"{case}.prism").unlink()
    shutil.rmtree(changed / case, ignore_errors=True)
    _write_bundle(changed, case, mutated)
    print(f"2. deliberate change in {case}: {number_stem} {number_pointer} {old} -> {old + 1}; {key_stem} {key_pointer} removed")
    code, out, report = _run(["compare", "--bundles", str(changed), "--goldens", str(goldens.root), "--quiet"])
    differing = {(c["case"], m["member"]): sorted(d["pointer"] for d in m.get("listed", []))
                 for c in report["cases"] for m in c["members"] if m["status"] == "differs"}
    wanted = {(case, stem): sorted(op["path"] for op in ops) for stem, ops in edits.items()}
    expect(code == 1, f"exit 1 (got {code})")
    expect(differing == wanted, f"exactly the changed pointers reported: {sorted(differing.items())}")
    print("   runner output:")
    for line in out.strip().splitlines():
        print("   | " + line)

    # 3. The change accepted as divergences (a temporary divergence directory).
    accepting = work / "divergences-accepting-change"
    shutil.copytree(PARITY_DIR / "divergences", accepting)
    for stem, ops in edits.items():
        path = accepting / f"{stem}.json"
        doc = json.loads(path.read_text()) if path.exists() else {"schema": dv.DIVERGENCES_SCHEMA, "member": stem, "accepted": []}
        doc["accepted"].append({"id": "SELFTEST", "summary": "selftest's deliberate change", "cases": [case],
                                "patches": [dict(op, case=case) for op in ops]})
        path.write_text(json.dumps(doc, indent=1) + "\n")
    code, out, report = _run(["compare", "--bundles", str(changed), "--goldens", str(goldens.root),
                              "--divergences", str(accepting), "--cases", case])
    statuses = {m["member"]: m["status"] for m in report["cases"][0]["members"]}
    expect(code == 0, f"exit 0 with the change accepted (got {code})")
    expect(all(statuses.get(stem) == "equal-with-divergences" for stem in edits),
           f"changed members equal-with-divergences: {[statuses.get(stem) for stem in edits]}")

    # 4. Non-semantic fields do not count.
    si_case = next((c for c in cases if "semantic-index" in documents[c]), None)
    if si_case:
        # From what a correct producer writes (the a2 envelope, D1), not the a1 golden.
        doc = copy.deepcopy(members[si_case]["semantic-index"])
        doc["designKey"] = "0" * 64
        with tempfile.TemporaryDirectory() as tmp:
            _write_bundle(Path(tmp), si_case, {"semantic-index": doc})
            code, out, report = _run(["compare", str(Path(tmp) / si_case), "--case", si_case,
                                      "--goldens", str(goldens.root), "--members", "semantic-index"])
        expect(code == 0, f"4. a different designKey is non-semantic ({si_case}): exit {code}")

    # 5. The accepted route-metrics D7 rule.
    rule = dv.RULES["route-metrics/via-spans-used-layers"]
    d7 = [c for c in cases if "route-metrics" in documents[c] and "stackup" in documents[c]
          and not jsonvalue.equal(rule(copy.deepcopy(documents[c]["route-metrics"]), documents[c]), documents[c]["route-metrics"])]
    if d7:
        with tempfile.TemporaryDirectory() as tmp:
            for c in d7:
                _write_bundle(Path(tmp), c, {"route-metrics": rule(copy.deepcopy(documents[c]["route-metrics"]), documents[c])})
            code, out, report = _run(["compare", "--bundles", tmp, "--goldens", str(goldens.root),
                                      "--members", "route-metrics", "--cases", ",".join(d7)])
            statuses = sorted({m["status"] for c in report["cases"] for m in c["members"]})
            expect(code == 0 and statuses == ["equal-with-divergences"],
                   f"5. D7 applied by a member passes as equal-with-divergences on {len(d7)} case(s): exit {code}, {statuses}")
            for c in d7:
                _write_bundle(Path(tmp), c, {"route-metrics": documents[c]["route-metrics"]})
            code, out, report = _run(["compare", "--bundles", tmp, "--goldens", str(goldens.root),
                                      "--members", "route-metrics", "--cases", ",".join(d7)])
            expect(code == 1, f"   a member that ignores the accepted D7 fails: exit {code}")
    else:
        print("5. no case where route-metrics D7 changes the golden (skipped)")

    print(f"selftest: {'PASS' if not failures else 'FAIL'} ({len(failures)} failure(s)); bundles in {work}")
    return 1 if failures else 0
