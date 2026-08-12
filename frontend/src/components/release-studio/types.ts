export type GovernedDomain = "bare_board" | "assembly" | "documentation" | "evidence";

/**
 * A release configuration authored in Git under
 * `.prism/release-studio/configurations/`. A project without one cannot be
 * built, which is the difference between "no candidates yet" and "not set up".
 */
export type ReleaseConfiguration = {
    config_key: string;
    title: string;
    board_rel: string;
    schematic_rel: string;
    jobset_rel: string;
    default_variant: string;
    typography?: string;
    document_number?: string;
    revision?: string;
    fields?: Record<string, string>;
    notes?: Record<string, string[]>;
};

export type DocumentSheet = {
    key: string;
    svg?: { path: string; released_digest: string; media_type: string };
    pdf?: { path: string; released_digest: string; media_type: string };
};

export type ReleaseCandidate = {
    id: string;
    project_id: string;
    config_key: string;
    commit_sha: string;
    variant: string;
    build_key: string;
    status: "draft" | "building" | "built" | "failed" | "superseded" | "frozen";
    hermetic: boolean;
    non_hermetic_reasons: string[];
    technical_config_digest: string;
    input_closure_digest: string;
    toolchain_digest: string;
    created_by: string;
    created_at: string;
    latest_build?: ReleaseBuild | null;
};

export type ReleaseBuild = {
    id: string;
    candidate_id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    attempt: number;
    manifest_digest: string;
    dossier_digest: string;
    dossier_artifact_id: string | null;
    evidence_artifact_id: string | null;
    error_code: string;
    error_message: string;
    warnings?: string[];
    started_at: string | null;
    completed_at: string | null;
};

export type ReleaseMember = {
    id: string;
    path: string;
    member_kind: string;
    media_type: string;
    size_bytes: number;
    released_digest: string;
    source_raw_digest: string;
    canonicalizer: string;
    domains: GovernedDomain[];
};

export type ReleaseEvidence = {
    kind: "drc" | "erc";
    report_digest: string;
    counts: Record<string, number>;
};

export type Finding = {
    id: string;
    rule_id: string;
    rule_version: string;
    severity: "warning" | "failure" | "blocker";
    status: "open" | "waived";
    domain: GovernedDomain;
    subject: string;
    message: string;
    finding_key: string;
    waiver_id: string | null;
};

/**
 * Evaluation state per rule, kept separate from findings so `unsupported`
 * can never be rendered as though the rule had passed.
 */
export type RuleOutcome = {
    rule_id: string;
    rule_version: string;
    outcome: "pass" | "info" | "warning" | "failure" | "blocker" | "unsupported";
    finding_count: number;
    unsupported_reason: string;
};

export type Evaluation = {
    id: string;
    outcome: string;
    policy_binding_digest: string;
    counts: Record<string, number>;
    findings: Finding[];
    rule_outcomes: RuleOutcome[];
    created_at: string;
};

export type ApprovalInvalidation = {
    id: string;
    reason: string;
    /** Which half of the (technical, policy) binding went stale. */
    stale_component: "technical" | "policy" | "both";
    changed_domains: string[];
    created_at: string;
};

export type Approval = {
    id: string;
    role: string;
    domains: GovernedDomain[];
    decision: "approved" | "rejected" | "changes_requested";
    approver: string;
    note: string;
    exception_kind: string | null;
    exception_reason: string | null;
    policy_binding_digest: string;
    technical_scope_fingerprints: Record<string, string>;
    carried_from_approval_id: string | null;
    created_at: string;
    invalidations: ApprovalInvalidation[];
};

export type Waiver = {
    id: string;
    rule_id: string;
    domain: string;
    subject_pattern: string;
    finding_key: string;
    reason: string;
    owner: string;
    approver: string | null;
    status: "proposed" | "approved" | "rejected" | "revoked" | "expired";
    /** Set only when the owner approved their own waiver, with a written reason. */
    exception_kind: "self_approval" | null;
    exception_reason: string | null;
    expires_at: string | null;
    created_at: string;
};

export type ReleaseRecord = {
    id: string;
    config_key: string;
    release_label: string;
    document_number: string;
    revision: string;
    dossier_digest: string;
    manifest_digest: string;
    attestation_digest: string;
    signing_key_id: string;
    commit_sha: string;
    variant: string;
    released_by: string;
    created_at: string;
    superseded_by: string | null;
};

export type AuditEvent = {
    id: string;
    sequence: number;
    event_type: string;
    actor: string;
    subject_kind: string;
    subject_id: string;
    details: Record<string, unknown>;
    event_hash: string;
    created_at_iso: string;
};

export type VerificationReport = {
    ok: boolean;
    checks: { ok: boolean; message: string }[];
};

export type RuleCatalogueEntry = {
    rule_id: string;
    version: string;
    title: string;
    domain: GovernedDomain;
    default_severity: "warning" | "failure" | "blocker";
    applies_to: string[];
    param_schema: Record<string, "int" | "str" | "list[str]">;
    description: string;
};

export type PolicyVersion = {
    id: string;
    version: number;
    status: "draft" | "published" | "retired";
    rules: Record<string, unknown>;
    content_digest: string;
    published_at: string | null;
    published_by: string | null;
};

export type OrganizationPolicy = {
    id: string;
    policy_key: string;
    title: string;
    latest_version?: number;
    version_count?: number;
    versions?: PolicyVersion[];
};

export type WebReleaseShare = {
    id: string;
    record_id: string;
    status: "active" | "revoked";
    expires_at: string | null;
    created_by: string;
    created_at: string;
};

export type BuildDetail = {
    build: ReleaseBuild;
    members: ReleaseMember[];
    evidence: ReleaseEvidence[];
    fingerprints: Record<string, { fingerprint: string; fidelity: string }>;
    evaluation: Evaluation | null;
    approvals: Approval[];
};
