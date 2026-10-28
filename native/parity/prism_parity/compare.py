"""The parity runner: compare bundle members with goldens (conventions.md §14).

Per case and member, in this order:

1. Read the golden (``goldens/<case>/<stem>.json``) and the member.
2. Apply the member's accepted divergences (``divergences/<stem>.json``) for the case.
3. Run the member's extra checks (``members.py``): board-objects' contentDigest
   against G's reference implementation, system-interface's digest over its body.
4. Remove the contract's non-semantic fields on both sides.
5. Compare by JSON value. Any remaining difference is unexplained and fails.

The verdict of a member is ``equal``, ``equal-with-divergences`` (an accepted
divergence changed the outcome), ``differs``, ``missing`` (no member in the
bundle), ``expected-refusal`` (today's code refuses the sources, e.g.
``dv-malformed``, and the bundle rightly has no member: stage parse fails),
``unexpected-member`` (today's code refuses the sources but the bundle has the
member: a failure), ``no-golden`` (no golden for another reason) or
``invalid`` (the member does not validate against its schema, ``--validate``).
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import divergences as dv
from . import fixtures as fx
from . import jsonvalue
from .bundle import Bundle, BundleError, find_bundles
from .members import MEMBERS, Member, resolve

# capture.json statuses meaning "today refuses these sources; stage parse must fail".
REFUSALS = ("today-failed", "stage-parse-fails")
FAILING = ("differs", "invalid", "error", "unexpected-member")


@dataclass
class MemberReport:
    member: str
    status: str
    differences: int = 0
    listed: list[jsonvalue.Difference] = field(default_factory=list)
    divergences: list[str] = field(default_factory=list)
    checks: list[dict] = field(default_factory=list)
    note: str | None = None

    def as_json(self) -> dict:
        out: dict[str, Any] = {"member": self.member, "status": self.status}
        if self.differences:
            out["differences"] = self.differences
            out["listed"] = [d.as_json() for d in self.listed]
        if self.divergences:
            out["divergences"] = self.divergences
        if self.checks:
            out["checks"] = self.checks
        if self.note:
            out["note"] = self.note
        return out


@dataclass
class CaseReport:
    case: str
    bundle: str | None
    members: list[MemberReport] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    status: str = "compared"  # compared | missing | no-goldens | error

    def failed(self, require_all: bool) -> bool:
        if self.status == "error":
            return True
        if self.status in ("missing",) and require_all:
            return True
        return any(m.status in FAILING or (require_all and m.status == "missing") for m in self.members)

    def as_json(self) -> dict:
        return {
            "case": self.case,
            "bundle": self.bundle,
            "status": self.status,
            "warnings": self.warnings,
            "members": [m.as_json() for m in self.members],
        }


# ------------------------------------------------------------------- goldens


class Goldens:
    def __init__(self, root: Path) -> None:
        self.root = root

    def capture(self, case: str) -> dict | None:
        path = self.root / case / "capture.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def document(self, case: str, stem: str) -> Any:
        path = self.root / case / MEMBERS[stem].golden_name
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def sidecar(self, case: str, stem: str, name: str) -> Any:
        path = self.root / case / f"{stem}.{name}.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def cases(self) -> list[str]:
        return sorted(p.name for p in self.root.iterdir() if (p / "capture.json").exists()) if self.root.exists() else []


# -------------------------------------------------------------------- checks


def _objects_by_ref(document: dict) -> dict[str, dict]:
    out = {}
    for doc in document.get("documents", []):
        for obj in doc.get("objects", []):
            out[f"{doc['path']}#{obj['uuid']}"] = obj
    return out


def check_content_digest(golden: dict, member: dict) -> dict:
    """board-objects: each member contentDigest equals G's reference implementation's."""

    expected = _objects_by_ref(golden)
    actual = _objects_by_ref(member)
    mismatched = [ref for ref in sorted(set(expected) & set(actual))
                  if expected[ref].get("contentDigest") != actual[ref].get("contentDigest")]
    result = {"check": "content-digest", "compared": len(set(expected) & set(actual)), "mismatched": len(mismatched)}
    if mismatched:
        result["examples"] = mismatched[:10]
    result["result"] = "equal" if not mismatched else "differs"
    return result


def system_interface_digest(document: dict) -> str:
    body = {k: v for k, v in document.items() if k not in ("digest", "projectId", "commit", "extractor")}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def check_digest_self(golden: dict, member: dict) -> dict:
    """system-interface: the member's digest is sha256 over its own canonical body (``ie:41-61``)."""

    recomputed = system_interface_digest(member)
    ok = recomputed == member.get("digest")
    result = {"check": "digest-self", "result": "equal" if ok else "differs"}
    if not ok:
        result["member"] = member.get("digest")
        result["recomputed"] = recomputed
    return result


CHECKS = {"content-digest": check_content_digest, "digest-self": check_digest_self}


# ------------------------------------------------------------------ compare


def compare_member(
    member: Member,
    case: str,
    golden: Any,
    actual: Any,
    divergences: list[dv.Divergence],
    siblings: dict[str, Any],
    max_diffs: int,
) -> MemberReport:
    expected, got, applied = dv.apply(divergences, case, golden, actual, siblings)
    checks = []
    for name in member.checks:
        try:
            checks.append(CHECKS[name](expected, got))
        except (KeyError, TypeError) as error:
            checks.append({"check": name, "result": "differs", "error": f"{type(error).__name__}: {error}"})
    for pattern in member.non_semantic:
        jsonvalue.remove_pattern(expected, pattern)
        jsonvalue.remove_pattern(got, pattern)
    found = []
    count = 0
    for difference in jsonvalue.diff(expected, got):
        count += 1
        if len(found) < max_diffs:
            found.append(difference)
    used = [a.id for a in applied if a.effect != "no-effect"]
    if count or any(c["result"] != "equal" for c in checks):
        status = "differs"
    elif not used:
        status = "equal"
    else:
        # Did any accepted divergence change the outcome? Compare again without them.
        bare_expected = copy.deepcopy(golden)
        bare_actual = copy.deepcopy(actual)
        for pattern in member.non_semantic:
            jsonvalue.remove_pattern(bare_expected, pattern)
            jsonvalue.remove_pattern(bare_actual, pattern)
        status = "equal" if jsonvalue.equal(bare_expected, bare_actual) else "equal-with-divergences"
    return MemberReport(member.stem, status, count, found, used, checks)


def compare_case(
    case: str,
    bundle_path: Path,
    goldens: Goldens,
    members: list[Member],
    divergence_dir: Path,
    max_diffs: int = 20,
    validate: bool = False,
) -> CaseReport:
    report = CaseReport(case, str(bundle_path))
    meta = goldens.capture(case)
    if meta is None:
        report.status = "no-goldens"
        report.warnings.append(f"no goldens for case {case!r}")
        return report
    try:
        bundle = Bundle(bundle_path)
    except BundleError as error:
        report.status = "error"
        report.warnings.append(str(error))
        return report
    try:
        report.warnings.extend(check_bundle_inputs(bundle, meta))
        siblings = {stem: goldens.document(case, stem) for stem in MEMBERS}
        invalid = validate_members(bundle, members) if validate else {}
        for member in members:
            state = meta["members"].get(member.stem, {"status": "not-captured"})
            try:
                actual = bundle.member(member)
            except BundleError as error:
                report.members.append(MemberReport(member.stem, "error", note=str(error)))
                continue
            if state.get("status") in REFUSALS:
                # Today's code refuses these sources (e.g. dv-malformed): stage parse must
                # fail too, so the bundle carries no such member (bundle-format.md §2.1).
                reason = state.get("reason", "")
                if actual is None:
                    report.members.append(MemberReport(member.stem, "expected-refusal", note=f"today: {reason}"))
                else:
                    report.members.append(MemberReport(
                        member.stem, "unexpected-member",
                        note=f"today's code refuses these sources ({reason}), but the bundle has {member.bundle_path}"))
                continue
            if state.get("status") != "captured":
                note = f"{state.get('status')}: {state.get('reason', '')}".strip()
                if actual is not None:
                    note += " (the bundle has this member; nothing to compare it with)"
                report.members.append(MemberReport(member.stem, "no-golden", note=note))
                continue
            if actual is None:
                report.members.append(MemberReport(member.stem, "missing", note=f"{member.bundle_path} not in the bundle"))
                continue
            if member.stem in invalid:
                report.members.append(MemberReport(member.stem, "invalid", note=invalid[member.stem]))
                continue
            golden = siblings[member.stem]
            report.members.append(
                compare_member(member, case, golden, actual, dv.load(divergence_dir, member.stem), siblings, max_diffs)
            )
    finally:
        bundle.close()
    return report


def check_bundle_inputs(bundle: Bundle, meta: dict) -> list[str]:
    """Warn when the bundle parsed other source bytes than the golden was captured from."""

    manifest = bundle.manifest()
    if not manifest:
        return []
    sources = {
        m["path"][len("sources/"):]: m.get("sha256")
        for m in manifest.get("members", [])
        if isinstance(m, dict) and str(m.get("path", "")).startswith("sources/")
    }
    warnings = []
    for item in meta.get("inputs", []):
        if item["path"] not in sources:
            continue
        want = item.get("upgradedSha256", item["sha256"])
        if sources[item["path"]] != want:
            warnings.append(
                f"source {item['path']}: bundle sha256 {sources[item['path']][:12]}... != golden input {want[:12]}..."
                + (" (upgraded by kicad-seeded-upgrade-a0)" if "upgradedSha256" in item else "")
            )
    return warnings


def validate_members(bundle: Bundle, members: list[Member]) -> dict[str, str]:
    """Validate the bundle's members with ``validate.mjs`` (ajv, every schema registered)."""

    node = os.environ.get("PRISM_PARITY_NODE") or shutil.which("node")
    if not node:
        raise SystemExit("--validate needs node (24.22.0): set PRISM_PARITY_NODE")
    script = fx.PARITY_DIR / "validate.mjs"
    out: dict[str, str] = {}
    with tempfile.TemporaryDirectory(prefix="prism-parity-validate-") as tmp:
        written = []
        for member in members:
            data = bundle.member_bytes(member)
            if data is None:
                continue
            path = Path(tmp) / member.golden_name
            path.write_bytes(data)
            written.append((member, path))
        for member, path in written:
            run = subprocess.run([node, str(script), "--quiet", str(path)], capture_output=True, text=True)
            if run.returncode != 0:
                out[member.stem] = run.stdout.strip()[-1500:] or run.stderr.strip()[-1500:]
    return out


# -------------------------------------------------------------------- pairs


def pair_patterns(goldens: Goldens, bundles: dict[str, Bundle], pairs: list[list[str]]) -> list[dict]:
    """board-objects step 4: contentDigest equal ⇔ today's hash equal, on revision pairs.

    Uses today's hashes (``board-objects.today-hash.json`` sidecars) and the two
    bundles' members, for every ObjectRef listed in both.
    """

    member = MEMBERS["board-objects"]
    results = []
    for base, head in pairs:
        if base not in bundles or head not in bundles:
            continue
        hashes = (goldens.sidecar(base, "board-objects", "today-hash"), goldens.sidecar(head, "board-objects", "today-hash"))
        docs = (bundles[base].member(member), bundles[head].member(member))
        if None in hashes or None in docs:
            continue
        objects = (_objects_by_ref(docs[0]), _objects_by_ref(docs[1]))
        shared = sorted(set(objects[0]) & set(objects[1]) & set(hashes[0]) & set(hashes[1]))
        disagree = [
            ref for ref in shared
            if (hashes[0][ref] == hashes[1][ref]) != (objects[0][ref].get("contentDigest") == objects[1][ref].get("contentDigest"))
        ]
        results.append({"pair": [base, head], "compared": len(shared), "disagreements": len(disagree),
                         "examples": disagree[:10], "result": "equal" if not disagree else "differs"})
    return results


# --------------------------------------------------------------------- main


def print_report(reports: list[CaseReport], pairs: list[dict], quiet: bool) -> None:
    width = max([len(m) for m in MEMBERS] + [10])
    for report in reports:
        interesting = report.status != "compared" or report.warnings or any(m.status not in ("equal", "equal-with-divergences", "no-golden", "expected-refusal") for m in report.members)
        if quiet and not interesting:
            continue
        print(f"{report.case}  ({report.bundle})" if report.bundle else report.case)
        for warning in report.warnings:
            print(f"  warning: {warning}")
        if report.status not in ("compared",):
            print(f"  {report.status}")
        for m in report.members:
            if quiet and m.status in ("equal", "equal-with-divergences", "no-golden", "expected-refusal"):
                continue
            line = f"  {m.member:<{width}}  {m.status}"
            if m.divergences:
                line += f"  [accepted: {', '.join(m.divergences)}]"
            if m.status == "differs":
                line += f"  {m.differences} difference(s)"
            if m.note:
                line += f"  {m.note}"
            print(line)
            for check in m.checks:
                if check["result"] != "equal":
                    print(f"      check {check['check']}: {json.dumps({k: v for k, v in check.items() if k != 'check'})}")
            for difference in m.listed:
                print(f"      {difference.describe()}")
            if m.differences > len(m.listed):
                print(f"      ... {m.differences - len(m.listed)} more")
    for pair in pairs:
        if quiet and pair["result"] == "equal":
            continue
        print(f"pair {pair['pair'][0]} -> {pair['pair'][1]}: board-objects contentDigest pattern {pair['result']} "
              f"({pair['compared']} objects, {pair['disagreements']} disagreements)")


def summarize(reports: list[CaseReport], pairs: list[dict], require_all: bool) -> tuple[dict, bool]:
    counts: dict[str, int] = {}
    for report in reports:
        if report.status != "compared":
            counts[f"case-{report.status}"] = counts.get(f"case-{report.status}", 0) + 1
        for m in report.members:
            counts[m.status] = counts.get(m.status, 0) + 1
    failed = any(r.failed(require_all) for r in reports) or any(p["result"] != "equal" for p in pairs)
    return counts, failed


def main(args) -> int:
    goldens = Goldens(Path(args.goldens))
    members = resolve(args.members)
    divergence_dir = Path(args.divergences)
    targets: dict[str, Path] = {}
    if args.bundles:
        found = find_bundles(Path(args.bundles))
        wanted = goldens.cases() if args.cases == "all" else [c.strip() for c in args.cases.split(",")]
        for case in wanted:
            if case in found:
                targets[case] = found[case]
        missing = [case for case in wanted if case not in found]
        unknown = sorted(set(found) - set(goldens.cases()))
    elif args.target:
        if not args.case:
            raise SystemExit("compare <target> needs --case <id> (the fixture or corpus id it is a bundle of)")
        targets[args.case] = Path(args.target)
        missing, unknown = [], []
    else:
        raise SystemExit("give a bundle (with --case) or --bundles <dir>")

    reports = [
        compare_case(case, path, goldens, members, divergence_dir, args.max_diffs, getattr(args, "validate", False))
        for case, path in sorted(targets.items())
    ]
    for case in missing:
        reports.append(CaseReport(case, None, status="missing", warnings=["no bundle for this case"]))
    pairs: list[dict] = []
    if any(m.stem == "board-objects" for m in members) and len(targets) > 1:
        _, pair_list = fx.load_fixtures()
        opened = {}
        try:
            for case, path in targets.items():
                try:
                    opened[case] = Bundle(path)
                except BundleError:
                    pass
            pairs = pair_patterns(goldens, opened, pair_list)
        finally:
            for bundle in opened.values():
                bundle.close()
    print_report(reports, pairs, args.quiet)
    counts, failed = summarize(reports, pairs, args.require_all)
    if unknown:
        print(f"note: bundles without goldens (not compared): {', '.join(unknown)}")
    summary = ", ".join(f"{v} {k}" for k, v in sorted(counts.items()))
    print(f"summary: {len(reports)} case(s); {summary or 'nothing compared'}; {'FAIL' if failed else 'PASS'}")
    if args.json:
        Path(args.json).write_text(json.dumps({
            "schema": "prism.parity.report.a0",
            "result": "fail" if failed else "pass",
            "counts": counts,
            "cases": [r.as_json() for r in reports],
            "pairs": pairs,
        }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return 1 if failed else 0


def check_inputs(args) -> int:
    """Fail when a committed fixture no longer hashes to its goldens' recorded inputs."""

    goldens = Goldens(Path(args.goldens))
    cases, _ = fx.load_fixtures()
    stale = 0
    for case in fx.select(cases, args.cases):
        meta = goldens.capture(case.id)
        if meta is None:
            print(f"{case.id}: no goldens")
            stale += 1
            continue
        recorded = {item["path"]: item["sha256"] for item in meta["inputs"]}
        current = fx.input_hashes(case.source_root, case.excluded_dirs)
        changed = sorted(p for p in set(recorded) | set(current) if recorded.get(p) != current.get(p))
        if changed:
            stale += 1
            print(f"{case.id}: STALE goldens; changed inputs: {', '.join(changed)}")
        if meta.get("sourceRoot") != case.source_root_label or meta.get("project") != case.project:
            stale += 1
            print(f"{case.id}: STALE goldens; fixtures.json names another source root or project")
    total = len(fx.select(cases, args.cases))
    print(f"inputs: {total - stale} of {total} case(s) match their goldens" + ("" if not stale else "; recapture: python -m prism_parity capture --cases <id>"))
    return 1 if stale else 0
