"""R12-R14 acceptance: rule catalogue, policy resolution, evaluation."""

from __future__ import annotations

import re
import sys
import unittest
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from app.release_studio import policy as policy_module  # noqa: E402
from app.release_studio.policy import (  # noqa: E402
    OUTCOMES,
    RULES_BY_ID,
    PolicyError,
    RuleContext,
    catalogue_payload,
    evaluate,
    release_is_permitted,
    resolve_policy,
)


@dataclass(frozen=True)
class _Member:
    path: str
    member_kind: str
    domains: tuple[str, ...]


def _context(**overrides):
    base = dict(
        members=[
            _Member("fabrication/gerbers/board-F_Cu.gbr", "gerber", ("bare_board",)),
            _Member("assembly/positions.csv", "position", ("assembly",)),
            _Member("evidence/drc.json", "drc_report", ("evidence",)),
        ],
        evidence=[
            {"kind": "drc", "counts": {"error": 0, "warning": 0, "total": 0}},
            {"kind": "erc", "counts": {"error": 0, "total": 0}},
        ],
        projections={"stackup": {"copper_layer_count": 4}},
        hermetic=True,
        non_hermetic_reasons=[],
        manifest={},
    )
    base.update(overrides)
    return RuleContext(**base)


def _policy(rules, required_approvals=()):
    return {
        "schema": policy_module.POLICY_SCHEMA,
        "rules": rules,
        "required_approvals": list(required_approvals),
    }


class PolicyResolutionTests(unittest.TestCase):
    def test_unknown_rule_id_is_rejected_at_load(self) -> None:
        with self.assertRaisesRegex(PolicyError, "unknown rule id"):
            resolve_policy(_policy([{"id": "does.not.exist"}]))

    def test_unpinned_org_extends_is_a_load_error(self) -> None:
        with self.assertRaisesRegex(PolicyError, "pinned as org:<key>@<version>"):
            resolve_policy({"extends": "org:corporate", "rules": []})

    def test_pinned_org_policy_is_merged_and_overridable(self) -> None:
        org = {
            "rules": [{"id": "drc.clean", "severity": "blocker", "params": {"max_errors": 0}}],
            "required_approvals": [{"role": "pcb_design", "domains": ["bare_board"]}],
        }
        resolved = resolve_policy(
            {
                "extends": "org:corporate@3",
                "rules": [{"id": "drc.clean", "severity": "warning", "params": {"max_errors": 2}}],
            },
            org_policy_loader=lambda key, version: org,
        )
        self.assertEqual(len(resolved.rules), 1)
        self.assertEqual(resolved.rules[0]["severity"], "warning")
        self.assertEqual(resolved.rules[0]["params"], {"max_errors": 2})
        # The org link is recorded with its own content digest.
        self.assertEqual([link["kind"] for link in resolved.links], ["org", "project"])
        self.assertTrue(all(link["content_digest"] for link in resolved.links))
        self.assertEqual(resolved.required_approvals[0]["role"], "pcb_design")

    def test_binding_digest_is_stable_for_an_unchanged_policy(self) -> None:
        document = _policy(
            [
                {"id": "erc.clean", "params": {"max_errors": 0}},
                {"id": "drc.clean", "params": {"max_errors": 0}},
            ]
        )
        self.assertEqual(
            resolve_policy(document).binding_digest,
            resolve_policy(dict(document)).binding_digest,
        )

    def test_resolved_rules_are_normalized_regardless_of_declaration_order(self) -> None:
        """The rule set normalizes even though the document digest tracks text.

        ``content_digest`` intentionally follows the source bytes, so
        reordering the YAML does change ``policy_binding_digest`` — that is a
        real edit to a governed document. What must not vary is the resolved
        rule set the evaluator runs.
        """

        forward = resolve_policy(
            _policy(
                [
                    {"id": "erc.clean", "params": {"max_errors": 0}},
                    {"id": "drc.clean", "params": {"max_errors": 0}},
                ]
            )
        )
        reversed_ = resolve_policy(
            _policy(
                [
                    {"id": "drc.clean", "params": {"max_errors": 0}},
                    {"id": "erc.clean", "params": {"max_errors": 0}},
                ]
            )
        )
        self.assertEqual(forward.rules, reversed_.rules)
        self.assertEqual(
            [rule["rule_id"] for rule in forward.rules], ["drc.clean", "erc.clean"]
        )

    def test_every_rule_declares_a_typed_param_schema(self) -> None:
        for rule in RULES_BY_ID.values():
            self.assertIsInstance(rule.param_schema, dict)
            for name, declared in rule.param_schema.items():
                self.assertIn(declared, {"int", "str", "list[str]"}, f"{rule.rule_id}.{name}")

    def test_wrongly_typed_and_unknown_params_are_rejected(self) -> None:
        with self.assertRaisesRegex(PolicyError, "must be an integer"):
            resolve_policy(_policy([{"id": "drc.clean", "params": {"max_errors": "zero"}}]))
        with self.assertRaisesRegex(PolicyError, "unknown parameter"):
            resolve_policy(_policy([{"id": "drc.clean", "params": {"nope": 1}}]))

    def test_unknown_severity_and_domain_are_rejected(self) -> None:
        with self.assertRaisesRegex(PolicyError, "severity must be one of"):
            resolve_policy(_policy([{"id": "drc.clean", "severity": "catastrophe"}]))
        with self.assertRaisesRegex(PolicyError, "unknown domains"):
            resolve_policy(_policy([], [{"role": "qa", "domains": ["galaxy"]}]))

    def test_catalogue_is_serializable_for_the_ui(self) -> None:
        payload = catalogue_payload()
        self.assertTrue(payload)
        for entry in payload:
            self.assertEqual(
                sorted(entry),
                [
                    "applies_to",
                    "default_severity",
                    "description",
                    "domain",
                    "param_schema",
                    "rule_id",
                    "title",
                    "version",
                ],
            )

    def test_policy_module_contains_no_dynamic_evaluation(self) -> None:
        source = Path(policy_module.__file__).read_text(encoding="utf-8")
        for forbidden in (r"\beval\s*\(", r"\bexec\s*\(", r"__import__\s*\("):
            self.assertIsNone(
                re.search(forbidden, source), f"policy.py must not use {forbidden}"
            )


class EvaluationTests(unittest.TestCase):
    def test_clean_build_passes(self) -> None:
        resolved = resolve_policy(
            _policy(
                [
                    {"id": "drc.clean", "params": {"max_errors": 0}},
                    {"id": "build.hermetic"},
                    {"id": "assembly.positions_present"},
                ]
            )
        )
        result = evaluate(resolved, _context())
        self.assertEqual(result.outcome, "pass")
        self.assertEqual(result.findings, ())
        self.assertTrue(all(item.outcome == "pass" for item in result.rule_outcomes))
        self.assertEqual(release_is_permitted(result), (True, ""))

    def test_missing_projection_is_unsupported_never_pass(self) -> None:
        resolved = resolve_policy(
            _policy([{"id": "stackup.min_copper_layers", "params": {"minimum": 4}}])
        )
        result = evaluate(resolved, _context(projections={}))
        outcome = result.rule_outcomes[0]
        self.assertEqual(outcome.outcome, "unsupported")
        self.assertNotEqual(outcome.outcome, "pass")
        self.assertIn("stackup projection", outcome.unsupported_reason)
        self.assertEqual(result.outcome, "unsupported")
        permitted, reason = release_is_permitted(result)
        self.assertFalse(permitted)
        self.assertIn("could not be evaluated", reason)

    def test_missing_evidence_is_unsupported_not_a_clean_drc(self) -> None:
        resolved = resolve_policy(_policy([{"id": "drc.clean", "params": {"max_errors": 0}}]))
        result = evaluate(resolved, _context(evidence=[]))
        self.assertEqual(result.rule_outcomes[0].outcome, "unsupported")
        self.assertFalse(release_is_permitted(result)[0])

    def test_all_six_outcomes_are_reachable(self) -> None:
        reachable = set()

        clean = evaluate(
            resolve_policy(_policy([{"id": "build.hermetic"}])), _context()
        )
        reachable.add(clean.rule_outcomes[0].outcome)

        disabled = evaluate(
            resolve_policy(_policy([{"id": "build.hermetic", "enabled": False}])), _context()
        )
        reachable.add(disabled.rule_outcomes[0].outcome)

        unsupported = evaluate(
            resolve_policy(_policy([{"id": "stackup.min_copper_layers"}])),
            _context(projections={}),
        )
        reachable.add(unsupported.rule_outcomes[0].outcome)

        for severity in ("warning", "failure", "blocker"):
            result = evaluate(
                resolve_policy(
                    _policy([{"id": "assembly.positions_present", "severity": severity}])
                ),
                _context(members=[]),
            )
            reachable.add(result.rule_outcomes[0].outcome)

        self.assertEqual(reachable, set(OUTCOMES))

    def test_non_hermetic_build_blocks_with_the_offending_input(self) -> None:
        resolved = resolve_policy(_policy([{"id": "build.hermetic"}]))
        result = evaluate(
            resolved,
            _context(hermetic=False, non_hermetic_reasons=["/usr/share/kicad/footprints"]),
        )
        self.assertEqual(result.outcome, "blocker")
        self.assertEqual(result.findings[0].subject, "/usr/share/kicad/footprints")
        self.assertFalse(release_is_permitted(result)[0])

    def test_severity_override_is_honoured(self) -> None:
        resolved = resolve_policy(
            _policy([{"id": "assembly.positions_present", "severity": "warning"}])
        )
        result = evaluate(resolved, _context(members=[]))
        self.assertEqual(result.findings[0].severity, "warning")
        self.assertEqual(result.outcome, "warning")
        # A warning is not blocking.
        self.assertTrue(release_is_permitted(result)[0])

    def test_finding_key_is_stable_across_rebuilds(self) -> None:
        resolved = resolve_policy(_policy([{"id": "assembly.positions_present"}]))
        first = evaluate(resolved, _context(members=[]))
        second = evaluate(resolved, _context(members=[]))
        self.assertEqual(
            [item.finding_key for item in first.findings],
            [item.finding_key for item in second.findings],
        )
        # ...and does not depend on the severity the policy assigned.
        louder = evaluate(
            resolve_policy(
                _policy([{"id": "assembly.positions_present", "severity": "blocker"}])
            ),
            _context(members=[]),
        )
        self.assertEqual(first.findings[0].finding_key, louder.findings[0].finding_key)

    def test_waiver_marks_exactly_one_finding_and_unblocks_release(self) -> None:
        resolved = resolve_policy(
            _policy(
                [
                    {"id": "assembly.positions_present", "severity": "blocker"},
                    {"id": "drc.clean", "params": {"max_errors": 0}},
                ]
            )
        )
        unwaived = evaluate(
            resolved,
            _context(
                members=[],
                evidence=[{"kind": "drc", "counts": {"error": 3, "total": 3}}],
            ),
        )
        self.assertFalse(release_is_permitted(unwaived)[0])
        self.assertEqual(len(unwaived.findings), 2)

        target = next(
            item for item in unwaived.findings if item.rule_id == "assembly.positions_present"
        )
        waived = evaluate(
            resolved,
            _context(
                members=[],
                evidence=[{"kind": "drc", "counts": {"error": 3, "total": 3}}],
            ),
            waivers=[
                {
                    "id": "wv-1",
                    "status": "approved",
                    "rule_id": target.rule_id,
                    "finding_key": target.finding_key,
                }
            ],
        )
        statuses = {item.rule_id: item.status for item in waived.findings}
        self.assertEqual(statuses["assembly.positions_present"], "waived")
        self.assertEqual(statuses["drc.clean"], "open")
        self.assertEqual(waived.counts["waived"], 1)
        # The DRC blocker is still open, so release is still refused.
        self.assertFalse(release_is_permitted(waived)[0])

    def test_only_approved_waivers_apply(self) -> None:
        resolved = resolve_policy(_policy([{"id": "assembly.positions_present"}]))
        for status in ("proposed", "rejected", "revoked", "expired"):
            result = evaluate(
                resolved,
                _context(members=[]),
                waivers=[
                    {
                        "id": "wv",
                        "status": status,
                        "rule_id": "assembly.positions_present",
                        "subject_pattern": "*",
                    }
                ],
            )
            self.assertEqual(result.findings[0].status, "open", status)

    def test_waived_blocker_permits_release_when_it_is_the_only_one(self) -> None:
        resolved = resolve_policy(
            _policy([{"id": "assembly.positions_present", "severity": "blocker"}])
        )
        result = evaluate(
            resolved,
            _context(members=[]),
            waivers=[
                {
                    "id": "wv-9",
                    "status": "approved",
                    "rule_id": "assembly.positions_present",
                    "subject_pattern": "assembly/*",
                }
            ],
        )
        permitted, reason = release_is_permitted(result)
        self.assertTrue(permitted, reason)
        self.assertEqual(result.findings[0].waiver_id, "wv-9")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
