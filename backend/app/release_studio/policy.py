"""Rule catalogue, policy resolution, and the evaluator (R12-R14).

Rules are a **code catalogue**, not a DSL: configuration selects rule ids,
severities, and typed parameters, and nothing in a policy document is ever
evaluated as code.  There is no ``eval``/``exec`` anywhere in this module and a
test greps for it.

A finding describes a *problem* that can be waived or resolved.  Per-rule
evaluation state — including ``pass`` and ``unsupported`` — lives in the
separate rule-outcome list, so "the projection this rule needs is missing" can
never be mistaken for "this rule passed".
"""

from __future__ import annotations

import fnmatch
import hashlib
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence

from app.release_studio.canonical import sha256_canonical
from app.release_studio.config.schema import POLICY_SCHEMA
from app.release_studio.dossier import GOVERNED_DOMAINS

SEVERITIES: tuple[str, ...] = ("warning", "failure", "blocker")
OUTCOMES: tuple[str, ...] = ("pass", "info", "warning", "failure", "blocker", "unsupported")
BLOCKING_SEVERITIES: frozenset[str] = frozenset({"failure", "blocker"})

_ORG_PINNED = re.compile(r"^org:([A-Za-z0-9._-]+)@([1-9][0-9]*)$")


class PolicyError(RuntimeError):
    """A policy could not be loaded, resolved, or evaluated."""


@dataclass(frozen=True, slots=True)
class RuleSpec:
    """One catalogue rule and the shape of its parameters."""

    rule_id: str
    version: str
    title: str
    domain: str
    default_severity: str
    applies_to: tuple[str, ...]
    param_schema: Mapping[str, str]
    check: Callable[["RuleContext", Mapping[str, Any]], list["Finding"]]
    description: str = ""


@dataclass(frozen=True, slots=True)
class Finding:
    rule_id: str
    rule_version: str
    severity: str
    domain: str
    subject: str
    message: str
    observed: Mapping[str, Any] = field(default_factory=dict)
    expected: Mapping[str, Any] = field(default_factory=dict)
    status: str = "open"
    waiver_id: str | None = None

    @property
    def finding_key(self) -> str:
        """Stable across rebuilds: identity is rule + subject, never a row id."""

        return hashlib.sha256(
            "\x1f".join((self.rule_id, self.domain, self.subject)).encode("utf-8")
        ).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "rule_version": self.rule_version,
            "severity": self.severity,
            "domain": self.domain,
            "subject": self.subject,
            "message": self.message,
            "observed": dict(self.observed),
            "expected": dict(self.expected),
            "status": self.status,
            "waiver_id": self.waiver_id,
            "finding_key": self.finding_key,
        }


@dataclass(frozen=True, slots=True)
class RuleOutcome:
    rule_id: str
    rule_version: str
    outcome: str
    finding_count: int = 0
    unsupported_reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "rule_version": self.rule_version,
            "outcome": self.outcome,
            "finding_count": self.finding_count,
            "unsupported_reason": self.unsupported_reason,
        }


@dataclass(frozen=True, slots=True)
class RuleContext:
    """Everything a rule may read. Deliberately narrow."""

    members: Sequence[Any]
    evidence: Sequence[Mapping[str, Any]]
    projections: Mapping[str, Any]
    hermetic: bool
    non_hermetic_reasons: Sequence[str]
    manifest: Mapping[str, Any]

    def evidence_of(self, kind: str) -> Mapping[str, Any] | None:
        return next((item for item in self.evidence if item.get("kind") == kind), None)

    def members_in(self, domain: str) -> list[Any]:
        return [member for member in self.members if domain in member.domains]


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------


def _rule_drc_clean(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    report = context.evidence_of("drc")
    if report is None:
        raise _Unsupported("no DRC evidence was captured for this build")
    findings: list[Finding] = []
    counts = report.get("counts") or {}
    for severity in ("error", "warning"):
        limit = int(params.get(f"max_{severity}s", 0))
        actual = int(counts.get(severity, 0))
        if actual > limit:
            findings.append(
                Finding(
                    rule_id="drc.clean",
                    rule_version="1",
                    severity="blocker" if severity == "error" else "warning",
                    domain="evidence",
                    subject=f"drc/{severity}",
                    message=f"DRC reported {actual} {severity}(s); at most {limit} allowed",
                    observed={"count": actual},
                    expected={"max": limit},
                )
            )
    return findings


def _rule_erc_clean(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    report = context.evidence_of("erc")
    if report is None:
        raise _Unsupported("no ERC evidence was captured for this build")
    counts = report.get("counts") or {}
    limit = int(params.get("max_errors", 0))
    actual = int(counts.get("error", 0))
    if actual > limit:
        return [
            Finding(
                rule_id="erc.clean",
                rule_version="1",
                severity="blocker",
                domain="evidence",
                subject="erc/error",
                message=f"ERC reported {actual} error(s); at most {limit} allowed",
                observed={"count": actual},
                expected={"max": limit},
            )
        ]
    return []


def _rule_build_hermetic(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    if context.hermetic:
        return []
    return [
        Finding(
            rule_id="build.hermetic",
            rule_version="1",
            severity="blocker",
            domain="evidence",
            subject=reason or "unknown",
            message=f"Build is not hermetic: {reason}",
            observed={"reason": reason},
        )
        for reason in (context.non_hermetic_reasons or ["unspecified"])
    ]


def _rule_required_members(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    patterns = [str(item) for item in params.get("patterns", ())]
    if not patterns:
        raise _Unsupported("no required member patterns were configured")
    paths = [member.path for member in context.members]
    findings = []
    for pattern in patterns:
        if not any(fnmatch.fnmatch(path, pattern) for path in paths):
            findings.append(
                Finding(
                    rule_id="dossier.required_members",
                    rule_version="1",
                    severity="failure",
                    domain=str(params.get("domain") or "bare_board"),
                    subject=pattern,
                    message=f"No released member matches required pattern {pattern!r}",
                    expected={"pattern": pattern},
                )
            )
    return findings


def _rule_min_copper_layers(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    stackup = (context.projections or {}).get("stackup")
    if not isinstance(stackup, Mapping):
        raise _Unsupported("the stackup projection is not available for this build")
    layers = stackup.get("copper_layer_count")
    if layers is None:
        raise _Unsupported("the stackup projection has no copper_layer_count")
    minimum = int(params.get("minimum", 1))
    if int(layers) < minimum:
        return [
            Finding(
                rule_id="stackup.min_copper_layers",
                rule_version="1",
                severity="failure",
                domain="bare_board",
                subject="stackup",
                message=f"Board has {layers} copper layers; at least {minimum} required",
                observed={"copper_layer_count": int(layers)},
                expected={"minimum": minimum},
            )
        ]
    return []


def _rule_assembly_has_positions(context: RuleContext, params: Mapping[str, Any]) -> list[Finding]:
    if any(member.member_kind == "position" for member in context.members):
        return []
    return [
        Finding(
            rule_id="assembly.positions_present",
            rule_version="1",
            severity="failure",
            domain="assembly",
            subject="assembly/positions",
            message="No component position file was released",
        )
    ]


class _Unsupported(RuntimeError):
    """Raised by a rule whose required projection or evidence is missing."""


RULE_CATALOGUE: tuple[RuleSpec, ...] = (
    RuleSpec(
        rule_id="drc.clean",
        version="1",
        title="DRC within allowed thresholds",
        domain="evidence",
        default_severity="blocker",
        applies_to=("evidence.drc",),
        param_schema={"max_errors": "int", "max_warnings": "int"},
        check=_rule_drc_clean,
        description="Blocks on DRC errors and optionally caps warnings.",
    ),
    RuleSpec(
        rule_id="erc.clean",
        version="1",
        title="ERC within allowed thresholds",
        domain="evidence",
        default_severity="blocker",
        applies_to=("evidence.erc",),
        param_schema={"max_errors": "int"},
        check=_rule_erc_clean,
    ),
    RuleSpec(
        rule_id="build.hermetic",
        version="1",
        title="Build inputs are hermetic",
        domain="evidence",
        default_severity="blocker",
        applies_to=("build.hermeticity",),
        param_schema={},
        check=_rule_build_hermetic,
    ),
    RuleSpec(
        rule_id="dossier.required_members",
        version="1",
        title="Required members are present",
        domain="bare_board",
        default_severity="failure",
        applies_to=("dossier.members",),
        param_schema={"patterns": "list[str]", "domain": "str"},
        check=_rule_required_members,
    ),
    RuleSpec(
        rule_id="stackup.min_copper_layers",
        version="1",
        title="Minimum copper layer count",
        domain="bare_board",
        default_severity="failure",
        applies_to=("projection.stackup",),
        param_schema={"minimum": "int"},
        check=_rule_min_copper_layers,
    ),
    RuleSpec(
        rule_id="assembly.positions_present",
        version="1",
        title="Assembly position data is released",
        domain="assembly",
        default_severity="failure",
        applies_to=("dossier.members",),
        param_schema={},
        check=_rule_assembly_has_positions,
    ),
)

RULES_BY_ID: Mapping[str, RuleSpec] = {rule.rule_id: rule for rule in RULE_CATALOGUE}


def catalogue_payload() -> list[dict[str, Any]]:
    """Serve the catalogue to the UI so rule params can be form-driven."""

    return [
        {
            "rule_id": rule.rule_id,
            "version": rule.version,
            "title": rule.title,
            "domain": rule.domain,
            "default_severity": rule.default_severity,
            "applies_to": list(rule.applies_to),
            "param_schema": dict(rule.param_schema),
            "description": rule.description,
        }
        for rule in RULE_CATALOGUE
    ]


# ---------------------------------------------------------------------------
# Policy resolution
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ResolvedPolicy:
    links: tuple[dict[str, Any], ...]
    rules: tuple[dict[str, Any], ...]
    required_approvals: tuple[dict[str, Any], ...]

    @property
    def binding(self) -> dict[str, Any]:
        return {
            "links": [dict(link) for link in self.links],
            "rules": [dict(rule) for rule in self.rules],
            "required_approvals": [dict(item) for item in self.required_approvals],
        }

    @property
    def binding_digest(self) -> str:
        return sha256_canonical(self.binding)


def content_digest(policy: Mapping[str, Any]) -> str:
    return sha256_canonical(
        {key: value for key, value in policy.items() if key != "content_digest"}
    )


def resolve_policy(
    project_policy: Mapping[str, Any] | None,
    *,
    org_policy_loader: Callable[[str, int], Mapping[str, Any]] | None = None,
) -> ResolvedPolicy:
    """Resolve a project overlay against its pinned org policy.

    An unpinned ``extends: org:<key>`` is a load error: an overlay that can
    silently follow a moving org policy would make ``policy_binding_digest``
    unreproducible.
    """

    links: list[dict[str, Any]] = []
    merged: dict[str, dict[str, Any]] = {}
    approvals: list[dict[str, Any]] = []

    chain: list[Mapping[str, Any]] = []
    if project_policy:
        extends = str(project_policy.get("extends") or "").strip()
        if extends:
            match = _ORG_PINNED.match(extends)
            if match is None:
                raise PolicyError(
                    f"extends must be pinned as org:<key>@<version>, got {extends!r}"
                )
            if org_policy_loader is None:
                raise PolicyError("no organization policy loader is configured")
            key, version = match.group(1), int(match.group(2))
            org = org_policy_loader(key, version)
            if org is None:
                raise PolicyError(f"organization policy {extends!r} is not published")
            chain.append(org)
            links.append(
                {
                    "source": extends,
                    "kind": "org",
                    "content_digest": str(org.get("content_digest") or content_digest(org)),
                }
            )
        chain.append(project_policy)
        links.append(
            {
                "source": "project",
                "kind": "project",
                "content_digest": content_digest(project_policy),
            }
        )

    for policy in chain:
        for entry in policy.get("rules") or ():
            if not isinstance(entry, Mapping):
                raise PolicyError("each policy rule must be a mapping")
            rule_id = str(entry.get("id") or entry.get("rule_id") or "").strip()
            if rule_id not in RULES_BY_ID:
                raise PolicyError(f"unknown rule id: {rule_id!r}")
            spec = RULES_BY_ID[rule_id]
            severity = str(entry.get("severity") or spec.default_severity)
            if severity not in SEVERITIES:
                raise PolicyError(
                    f"rule {rule_id}: severity must be one of {SEVERITIES}, got {severity!r}"
                )
            params = entry.get("params") or {}
            if not isinstance(params, Mapping):
                raise PolicyError(f"rule {rule_id}: params must be a mapping")
            _validate_params(spec, params)
            merged[rule_id] = {
                "rule_id": rule_id,
                "rule_version": spec.version,
                "severity": severity,
                "enabled": bool(entry.get("enabled", True)),
                "params": dict(params),
            }
        for entry in policy.get("required_approvals") or ():
            if not isinstance(entry, Mapping):
                raise PolicyError("each required approval must be a mapping")
            role = str(entry.get("role") or "").strip()
            if not role:
                raise PolicyError("required approval entries need a role")
            domains = tuple(str(item) for item in entry.get("domains") or ())
            unknown = sorted(set(domains) - set(GOVERNED_DOMAINS))
            if unknown:
                raise PolicyError(f"required approval {role!r}: unknown domains {unknown}")
            approvals = [item for item in approvals if item["role"] != role]
            approvals.append({"role": role, "domains": list(domains)})

    return ResolvedPolicy(
        links=tuple(links),
        rules=tuple(sorted(merged.values(), key=lambda item: item["rule_id"])),
        required_approvals=tuple(sorted(approvals, key=lambda item: item["role"])),
    )


def _validate_params(spec: RuleSpec, params: Mapping[str, Any]) -> None:
    unknown = sorted(set(params) - set(spec.param_schema))
    if unknown:
        raise PolicyError(f"rule {spec.rule_id}: unknown parameter(s) {unknown}")
    for name, declared in spec.param_schema.items():
        if name not in params:
            continue
        value = params[name]
        if declared == "int" and not isinstance(value, int):
            raise PolicyError(f"rule {spec.rule_id}: {name} must be an integer")
        if declared == "str" and not isinstance(value, str):
            raise PolicyError(f"rule {spec.rule_id}: {name} must be a string")
        if declared == "list[str]":
            if not isinstance(value, (list, tuple)) or not all(
                isinstance(item, str) for item in value
            ):
                raise PolicyError(f"rule {spec.rule_id}: {name} must be a list of strings")


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Evaluation:
    outcome: str
    findings: tuple[Finding, ...]
    rule_outcomes: tuple[RuleOutcome, ...]
    counts: Mapping[str, int]
    policy_binding: Mapping[str, Any]
    policy_binding_digest: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "outcome": self.outcome,
            "counts": dict(self.counts),
            "findings": [finding.to_dict() for finding in self.findings],
            "rule_outcomes": [item.to_dict() for item in self.rule_outcomes],
            "policy_binding_digest": self.policy_binding_digest,
        }


def evaluate(
    policy: ResolvedPolicy,
    context: RuleContext,
    *,
    waivers: Sequence[Mapping[str, Any]] = (),
) -> Evaluation:
    """Run every enabled rule and fold the results into one outcome."""

    findings: list[Finding] = []
    outcomes: list[RuleOutcome] = []

    for entry in policy.rules:
        spec = RULES_BY_ID[entry["rule_id"]]
        if not entry.get("enabled", True):
            outcomes.append(RuleOutcome(spec.rule_id, spec.version, "info", 0, "rule disabled"))
            continue
        try:
            raw = spec.check(context, entry["params"])
        except _Unsupported as exc:
            # Never `pass`: an unavailable projection is an evaluation state,
            # not a clean result.
            outcomes.append(
                RuleOutcome(spec.rule_id, spec.version, "unsupported", 0, str(exc))
            )
            continue
        severity = entry["severity"]
        produced = [
            Finding(
                rule_id=item.rule_id,
                rule_version=item.rule_version,
                severity=severity,
                domain=item.domain,
                subject=item.subject,
                message=item.message,
                observed=item.observed,
                expected=item.expected,
            )
            for item in raw
        ]
        produced = [_apply_waivers(item, waivers) for item in produced]
        findings.extend(produced)
        if not produced:
            outcomes.append(RuleOutcome(spec.rule_id, spec.version, "pass", 0))
        else:
            effective = [item for item in produced if item.status != "waived"]
            worst = _worst_severity(effective) if effective else "info"
            outcomes.append(RuleOutcome(spec.rule_id, spec.version, worst, len(produced)))

    findings.sort(key=lambda item: (item.domain, item.rule_id, item.subject))
    counts = _counts(findings, outcomes)
    return Evaluation(
        outcome=_aggregate(findings, outcomes),
        findings=tuple(findings),
        rule_outcomes=tuple(outcomes),
        counts=counts,
        policy_binding=policy.binding,
        policy_binding_digest=policy.binding_digest,
    )


def _apply_waivers(finding: Finding, waivers: Sequence[Mapping[str, Any]]) -> Finding:
    for waiver in waivers:
        if str(waiver.get("status")) != "approved":
            continue
        if str(waiver.get("rule_id")) != finding.rule_id:
            continue
        key = str(waiver.get("finding_key") or "")
        pattern = str(waiver.get("subject_pattern") or "")
        matched = (key and key == finding.finding_key) or (
            pattern and fnmatch.fnmatch(finding.subject, pattern)
        )
        if not matched:
            continue
        return Finding(
            rule_id=finding.rule_id,
            rule_version=finding.rule_version,
            severity=finding.severity,
            domain=finding.domain,
            subject=finding.subject,
            message=finding.message,
            observed=finding.observed,
            expected=finding.expected,
            status="waived",
            waiver_id=str(waiver.get("id") or ""),
        )
    return finding


def _worst_severity(findings: Sequence[Finding]) -> str:
    order = {"warning": 0, "failure": 1, "blocker": 2}
    return max((item.severity for item in findings), key=lambda value: order.get(value, 0))


def _counts(findings: Sequence[Finding], outcomes: Sequence[RuleOutcome]) -> dict[str, int]:
    counts = {severity: 0 for severity in SEVERITIES}
    counts["waived"] = 0
    for finding in findings:
        if finding.status == "waived":
            counts["waived"] += 1
        else:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
    counts["unsupported"] = sum(1 for item in outcomes if item.outcome == "unsupported")
    counts["total"] = len(findings)
    return counts


def _aggregate(findings: Sequence[Finding], outcomes: Sequence[RuleOutcome]) -> str:
    open_findings = [item for item in findings if item.status != "waived"]
    if any(item.severity == "blocker" for item in open_findings):
        return "blocker"
    if any(item.severity == "failure" for item in open_findings):
        return "failure"
    if any(item.severity == "warning" for item in open_findings):
        return "warning"
    if any(item.outcome == "unsupported" for item in outcomes):
        return "unsupported"
    return "pass"


def blocking_findings(evaluation: Evaluation) -> list[Finding]:
    """Findings that stand between this build and a release."""

    return [
        finding
        for finding in evaluation.findings
        if finding.status != "waived" and finding.severity in BLOCKING_SEVERITIES
    ]


def unsupported_rules(evaluation: Evaluation) -> list[RuleOutcome]:
    """Rules that could not be evaluated, which is not the same as passing."""

    return [item for item in evaluation.rule_outcomes if item.outcome == "unsupported"]


def release_is_permitted(
    evaluation: Evaluation, *, overridden: bool = False
) -> tuple[bool, str]:
    """Gate used by R18. Waived blockers pass; open ones never do.

    ``overridden`` is the administrative break-glass path.  It is not a way of
    deciding that a blocker was unimportant -- that is what a waiver is for,
    and a waiver names an owner, an approver, and an expiry.  It exists because
    a two-person governance path can be unavailable when a release still has to
    go out, and because the alternative to an audited override is an
    unaudited one performed with `psql`.

    The caller is responsible for establishing that the actor may do this; the
    override is recorded in the signed attestation either way, so a recipient
    can see that a release went out over open blockers without asking anyone.
    """

    blocking = blocking_findings(evaluation)
    unsupported = unsupported_rules(evaluation)
    if overridden:
        return True, ""
    if blocking:
        subjects = ", ".join(sorted({item.subject for item in blocking})[:5])
        return False, f"{len(blocking)} unwaived blocking finding(s): {subjects}"
    if unsupported:
        names = ", ".join(sorted(item.rule_id for item in unsupported)[:5])
        return False, f"{len(unsupported)} rule(s) could not be evaluated: {names}"
    return True, ""


def override_record(evaluation: Evaluation, *, actor: str, reason: str) -> dict[str, Any]:
    """What an administrative override has to state, for the attestation.

    Every finding and unevaluated rule it steps over is named.  An override
    recorded as a bare flag would let a recipient see *that* the gate was
    bypassed without ever learning *what* it was bypassing.
    """

    return {
        "actor": actor,
        "reason": reason,
        "findings": [
            {
                "rule_id": finding.rule_id,
                "severity": finding.severity,
                "domain": finding.domain,
                "subject": finding.subject,
                "message": finding.message,
                "finding_key": finding.finding_key,
            }
            for finding in sorted(
                blocking_findings(evaluation), key=lambda item: item.finding_key
            )
        ],
        "unsupported_rules": sorted(
            item.rule_id for item in unsupported_rules(evaluation)
        ),
    }


__all__ = [
    "BLOCKING_SEVERITIES",
    "OUTCOMES",
    "RULES_BY_ID",
    "RULE_CATALOGUE",
    "SEVERITIES",
    "Evaluation",
    "Finding",
    "PolicyError",
    "ResolvedPolicy",
    "RuleContext",
    "RuleOutcome",
    "blocking_findings",
    "override_record",
    "unsupported_rules",
    "RuleSpec",
    "catalogue_payload",
    "content_digest",
    "evaluate",
    "release_is_permitted",
    "resolve_policy",
]
