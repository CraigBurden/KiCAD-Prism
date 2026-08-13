# Release Studio governance

Governance is evaluated against an immutable build. Policy evaluation reads the
build's captured members, evidence, projections, and hermeticity state; it does
not recalculate identity from a mutable checkout.

## Policies and outcomes

Policies select typed rules from the server-owned catalogue. They are not
executable YAML. Every evaluated rule has an outcome, including `pass`,
warning/failure/blocker outcomes, and `unsupported`. `unsupported` means the
rule could not be evaluated from the build's captured evidence or projection;
it is never treated as a pass and blocks normal release.

Blocking findings must be resolved or covered by an approved waiver. A waiver
is project- and configuration-scoped and is bound to the build that produced
the finding. It does not carry silently to a subsequent build. A waiver records
its rule/domain and a subject pattern or finding key, reason, owner, lifecycle,
and audit events. It may expire or be revoked without deleting history.

## Approval authority

Required approvals bind a policy role and one or more governed domains to the
evaluated build's technical scope fingerprints and policy-binding digest. A
policy label is a requirement category, **not a user identity** and not an
editable claim from the UI.

Prism currently has global project roles, not server-owned per-project
approval grants. Consequently, only an **admin** may create or satisfy a
required policy approval role. Designers cannot create or fulfill required
release approvals under this model. Do not document or assume project-local
approval grants until the server owns and enforces that model.

Approvals are immutable records. A candidate author cannot approve their own
candidate unless the audited self-approval exception path is used with a
written reason. The same two-person rule applies to a waiver owner approving
their own waiver. Those exceptions are deliberately visible in the approval or
waiver record and audit chain; they are not an unrecorded bypass.

Only the original approver or an admin may rescind an approval. Rescission
appends an invalidation with a reason; it never edits or deletes the original
approval. A change in technical scope or policy binding similarly invalidates
or prevents carry-forward of an approval while preserving its history.

## Release gates and overrides

Normal release requires a completed evaluation, no open blocking findings,
no unsupported outcomes, and coverage for every required role/domain pair.
An administrator may use an explicit break-glass override only for actual
blockers or unsupported rules and only with a non-empty reason. The override
actor, reason, findings, and unsupported rules are attested and therefore
visible to offline recipients. An override is not a policy pass and cannot be
recorded on an otherwise clean build.
