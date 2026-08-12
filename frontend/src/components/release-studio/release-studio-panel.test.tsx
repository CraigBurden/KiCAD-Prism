import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalList, ReleaseStudioPanel, RuleOutcomeList } from "./ReleaseStudioPanel";
import type { Approval, BuildDetail, ReleaseCandidate } from "./types";

vi.mock("./api", () => ({
    listConfigurations: vi.fn(async () => [
        {
            config_key: "default",
            title: "Default",
            board_rel: "board.kicad_pcb",
            schematic_rel: "board.kicad_sch",
            jobset_rel: "Outputs.kicad_jobset",
            default_variant: "",
        },
    ]),
    listCandidates: vi.fn(),
    listRecords: vi.fn(async () => []),
    listWebReleases: vi.fn(async () => []),
    listWaivers: vi.fn(async () => []),
    listAudit: vi.fn(async () => []),
    verifyAudit: vi.fn(async () => ({ ok: true, events: 3, problems: [] })),
    getBuild: vi.fn(),
    listDocumentSheets: vi.fn(async () => []),
    createRelease: vi.fn(async () => ({ id: "rel-1" })),
    sheetObjectUrl: vi.fn(),
    downloadUrl: vi.fn(() => "/x"),
    downloadFile: vi.fn(),
}));

vi.mock("@/lib/jobs", () => ({
    watchPrismJob: vi.fn(),
    throwIfJobFailed: vi.fn(),
}));

import * as api from "./api";

const candidate: ReleaseCandidate = {
    id: "cand-1",
    project_id: "p1",
    config_key: "default",
    commit_sha: "abcdef1234567890",
    variant: "default",
    build_key: "bk",
    status: "built",
    hermetic: true,
    non_hermetic_reasons: [],
    technical_config_digest: "tc",
    input_closure_digest: "ic",
    toolchain_digest: "tl",
    created_by: "designer",
    created_at: "2026-08-11T00:00:00Z",
    latest_build: {
        id: "build-1",
        candidate_id: "cand-1",
        status: "succeeded",
        attempt: 1,
        manifest_digest: "m".repeat(64),
        dossier_digest: "d".repeat(64),
        dossier_artifact_id: "a1",
        evidence_artifact_id: "a2",
        error_code: "",
        error_message: "",
        started_at: null,
        completed_at: null,
    },
};

const invalidatedApproval: Approval = {
    id: "appr-1",
    role: "pcb_design",
    domains: ["bare_board"],
    decision: "approved",
    approver: "quality",
    note: "",
    exception_kind: null,
    exception_reason: null,
    policy_binding_digest: "pb",
    technical_scope_fingerprints: { bare_board: "fp" },
    carried_from_approval_id: null,
    created_at: "2026-08-11T00:00:00Z",
    invalidations: [
        {
            id: "inv-1",
            reason: "policy binding changed",
            stale_component: "policy",
            changed_domains: [],
            created_at: "2026-08-11T01:00:00Z",
        },
    ],
};

const detail: BuildDetail = {
    build: candidate.latest_build!,
    members: [],
    evidence: [],
    fingerprints: {},
    evaluation: {
        id: "eval-1",
        outcome: "unsupported",
        policy_binding_digest: "pb",
        counts: {},
        findings: [],
        rule_outcomes: [
            {
                rule_id: "drc.clean",
                rule_version: "1",
                outcome: "pass",
                finding_count: 0,
                unsupported_reason: "",
            },
            {
                rule_id: "stackup.min_copper_layers",
                rule_version: "1",
                outcome: "unsupported",
                finding_count: 0,
                unsupported_reason: "the stackup projection is not available",
            },
        ],
        created_at: "2026-08-11T00:00:00Z",
    },
    approvals: [invalidatedApproval],
};

const blockedDetail: BuildDetail = {
    ...detail,
    evaluation: {
        ...detail.evaluation!,
        outcome: "blocker",
        findings: [
            {
                id: "find-1",
                rule_id: "drc.clean",
                rule_version: "1",
                severity: "blocker",
                status: "open",
                domain: "evidence",
                subject: "drc/error",
                message: "DRC reported 3 error(s); at most 0 allowed",
                observed: {},
                expected: {},
                finding_key: "f".repeat(64),
                waiver_id: null,
            },
        ],
    },
};

/** Radix activates a tab on mousedown, not on a synthesized click alone. */
async function openReleaseTab() {
    const trigger = await screen.findByRole("tab", { name: "Release" });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText(/Release label/i)).toBeTruthy());
}

describe("ReleaseStudioPanel", () => {
    beforeEach(() => {
        vi.mocked(api.listCandidates).mockResolvedValue([candidate]);
        vi.mocked(api.getBuild).mockResolvedValue(detail);
    });

    it("explains an unbuildable project instead of leaving Build inert", async () => {
        // A project with no committed configuration used to enqueue a job that
        // failed in the worker while the panel reported nothing at all.
        vi.mocked(api.listConfigurations).mockResolvedValue([]);
        vi.mocked(api.listCandidates).mockResolvedValue([]);

        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await waitFor(() =>
            expect(screen.getByText(/no release configuration/i)).toBeTruthy(),
        );
        const build = screen.getByRole("button", { name: /build/i });
        expect((build as HTMLButtonElement).disabled).toBe(true);
    });

    it("renders unsupported distinctly from pass", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await waitFor(() => expect(screen.getByText("stackup.min_copper_layers")).toBeTruthy());

        const passBadge = screen.getByText("pass");
        // "unsupported" appears twice: the aggregate outcome and the rule's own
        // outcome. Both must be styled apart from a pass.
        const unsupportedBadges = screen.getAllByText("unsupported");
        expect(unsupportedBadges.length).toBeGreaterThan(0);
        for (const badge of unsupportedBadges) {
            expect(badge.className).not.toEqual(passBadge.className);
        }
        // The reason a rule could not run has to be legible, not just a colour.
        expect(screen.getByText(/the stackup projection is not available/)).toBeTruthy();
    });

    it("uses KiCad NewStroke in the configuration template", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        const select = await screen.findByLabelText("Display typography");
        expect((select as HTMLSelectElement).value).toBe("geist-pixel-square");
        expect(screen.getByDisplayValue(/typography: geist-pixel-square/)).toBeTruthy();
    });

    it("lists composed documentation sheets as a dedicated preview surface", async () => {
        vi.mocked(api.listDocumentSheets).mockResolvedValue([
            {
                key: "fabrication",
                svg: { path: "documentation/fabrication.svg", released_digest: "a".repeat(64), media_type: "image/svg+xml" },
                pdf: { path: "documentation/fabrication.pdf", released_digest: "b".repeat(64), media_type: "application/pdf" },
            },
        ]);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await waitFor(() => expect(screen.getByText("Documents (1)")).toBeTruthy());
    });

    it("names which half of the approval binding went stale", () => {
        render(<ApprovalList approvals={[invalidatedApproval]} />);

        expect(screen.getByText("invalidated")).toBeTruthy();
        const stale = screen.getByText(/Stale/);
        expect(stale.textContent).toContain("policy");
        expect(stale.textContent).toContain("policy binding changed");
    });

    it("labels a carried-forward approval and shows its exception reason", () => {
        render(
            <ApprovalList
                approvals={[
                    {
                        ...invalidatedApproval,
                        id: "appr-2",
                        invalidations: [],
                        carried_from_approval_id: "appr-1",
                        exception_kind: "self_approval",
                        exception_reason: "sole engineer on site",
                    },
                ]}
            />,
        );
        expect(screen.getByText("carried forward")).toBeTruthy();
        expect(screen.getByText(/sole engineer on site/)).toBeTruthy();
    });

    it("keeps an unsupported rule outcome visually apart from a pass", () => {
        render(<RuleOutcomeList outcomes={detail.evaluation!.rule_outcomes} />);
        const pass = screen.getByText("pass");
        const unsupported = screen.getByText("unsupported");
        expect(pass.className).not.toEqual(unsupported.className);
        expect(screen.getByText(/the stackup projection is not available/)).toBeTruthy();
    });

    it("offers no blocker override to a designer", async () => {
        // Break-glass is an administrative act. A designer who can see the
        // control but not use it learns the wrong thing about their authority.
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await openReleaseTab();
        expect(screen.queryByLabelText(/Release over open blockers/i)).toBeNull();
        // ...and the refusal is still stated, so the absence reads as policy
        // rather than as a missing control.
        expect(screen.getByText(/unwaived blocking finding/)).toBeTruthy();
    });

    it("requires an admin to state a reason before overriding blockers", async () => {
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate isAdmin />);

        await openReleaseTab();
        const label = await screen.findByRole("textbox", { name: /Release label/i });
        fireEvent.change(label, { target: { value: "REL-1" } });

        const release = screen.getByRole("button", { name: /Sign and release/i });
        expect((release as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(screen.getByLabelText(/Release over open blockers/i));
        const overriding = screen.getByRole("button", { name: /Override and release/i });
        expect((overriding as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText(/Override reason/i), {
            target: { value: "customer accepted the deviation" },
        });
        expect(
            (screen.getByRole("button", { name: /Override and release/i }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);

        fireEvent.click(screen.getByRole("button", { name: /Override and release/i }));
        await waitFor(() =>
            expect(vi.mocked(api.createRelease)).toHaveBeenCalledWith("p1", "build-1", {
                release_label: "REL-1",
                document_number: "",
                revision: "A",
                override_blockers: true,
                override_reason: "customer accepted the deviation",
            }),
        );
    });

    it("surfaces a broken audit chain rather than failing quietly", async () => {
        vi.mocked(api.verifyAudit).mockResolvedValue({
            ok: false,
            events: 4,
            problems: ["broken link at sequence 3"],
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await waitFor(() => expect(screen.getByText(/Audit chain BROKEN/)).toBeTruthy());
    });
});
