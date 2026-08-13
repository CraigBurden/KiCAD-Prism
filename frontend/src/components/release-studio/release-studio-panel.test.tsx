import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalList, ReleaseStudioPanel, RuleOutcomeList } from "./ReleaseStudioPanel";
import type { Approval, BuildDetail, ReleaseCandidate, ReleaseRecord } from "./types";

vi.mock("./api", () => ({
    listConfigurations: vi.fn(async () => [
        {
            config_key: "default",
            title: "Default",
            board_rel: "board.kicad_pcb",
            schematic_rel: "board.kicad_sch",
            jobset_rel: "Outputs.kicad_jobset",
            default_variant: "",
            typography: "geist-pixel-square",
            vendors: ["jlcpcb"],
        },
    ]),
    saveConfiguration: vi.fn(),
    listCandidates: vi.fn(),
    listRecords: vi.fn(async () => []),
    listWebReleases: vi.fn(async () => []),
    createWebRelease: vi.fn(async () => ({ id: "share-1", url: "/public/release" })),
    revokeWebRelease: vi.fn(async () => ({ id: "share-1", status: "revoked" })),
    verifyRecord: vi.fn(async () => ({ ok: true, checks: [] })),
    listWaivers: vi.fn(async () => []),
    listAudit: vi.fn(async () => []),
    verifyAudit: vi.fn(async () => ({ ok: true, events: 3, problems: [] })),
    getBuild: vi.fn(),
    listDocumentSheets: vi.fn(async () => []),
    createRelease: vi.fn(async () => ({ id: "rel-1" })),
    startBuild: vi.fn(async () => ({ job: { job_id: "job-1" } })),
    sheetObjectUrl: vi.fn(async () => "blob:sheet"),
    downloadUrl: vi.fn(() => "/x"),
    dossierDownloadUrl: vi.fn((projectId: string, buildId: string) => `/api/projects/${projectId}/release-studio/builds/${buildId}/dossier`),
    buildEvidenceDownloadUrl: vi.fn((projectId: string, buildId: string) => `/api/projects/${projectId}/release-studio/builds/${buildId}/build-evidence`),
    downloadFile: vi.fn(),
    listVendorProfiles: vi.fn(async () => [
        {
            id: "jlcpcb",
            title: "JLCPCB",
            pack_filename: "jlcpcb-upload.zip",
            description: "Gerbers, drill, and JLCPCB SMT workbooks.",
            required_pack_artifacts: ["gerber", "drill", "bom.csv", "cpl.csv", "bom.xlsx", "cpl.xlsx"],
        },
    ]),
    listProjectCommits: vi.fn(async () => [
        {
            hash: "abcdef1",
            full_hash: "abcdef12abcdef12abcdef12abcdef12abcdef12",
            author: "designer",
            email: "d@example.com",
            date: "2026-08-11T00:00:00Z",
            message: "head commit",
        },
    ]),
    vendorPackUrl: vi.fn(() => "/pack"),
    recordVendorPackUrl: vi.fn(() => "/pack"),
    evaluateBuild: vi.fn(async () => ({ outcome: "pass" })),
    createApproval: vi.fn(async () => ({ id: "appr-x" })),
    rescindApproval: vi.fn(async () => ({ id: "inval-1" })),
    createWaiver: vi.fn(async () => ({ id: "wv-1" })),
    listBuildLogs: vi.fn(async () => ({ timings: [], steps: [] })),
    fetchBuildLog: vi.fn(async () => ""),
}));

vi.mock("@/lib/jobs", () => ({
    cancelPrismJob: vi.fn(),
    watchPrismJob: vi.fn(),
    throwIfJobFailed: vi.fn(),
    jobPipeline: vi.fn((job: { pipeline?: unknown }) => job.pipeline),
}));

import * as api from "./api";

const candidate: ReleaseCandidate = {
    id: "cand-1",
    project_id: "p1",
    config_key: "default",
    commit_sha: "abcdef12abcdef12abcdef12abcdef12abcdef12",
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
    builds: [],
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
    evaluation_id: "eval-1",
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
    candidate,
    configuration: {
        config_key: "default", title: "Default", board_rel: "board.kicad_pcb", schematic_rel: "board.kicad_sch", jobset_rel: "Outputs.kicad_jobset", default_variant: "", document_number: "DOC-1", revision: "A",
    },
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
    waivers: [],
    vendor_readiness: [{ vendor_id: "jlcpcb", ready: false, missing_requirements: ["Gerber", "drill"] }],
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
                finding_key: "f".repeat(64),
                waiver_id: null,
            },
        ],
    },
};

/** Start a run from the Settings-first configuration screen. */
async function startRun() {
    fireEvent.click(await screen.findByRole("button", { name: /start build/i }));
}

async function selectHistoryRun() {
    fireEvent.click(await screen.findByRole("button", { name: /^history$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /abcdef12/i }));
}

/** Open a run's Sign-off stage from the stage rail. */
async function openReview() {
    await selectHistoryRun();
    const outputs = await screen.findByRole("button", { name: /Outputs/i });
    await waitFor(() => expect(outputs).not.toBeDisabled());
    fireEvent.click(outputs);
    fireEvent.click(await screen.findByRole("button", { name: /Continue to sign-off/i }));
}

/** Sign-off gates are collapsible; the release controls live in gate 4. */
async function openReleaseTab() {
    await openReview();
    const gate = await screen.findByRole("button", { name: /Issue signed release/i });
    if (gate.getAttribute("aria-expanded") !== "true") fireEvent.click(gate);
    await waitFor(() => expect(screen.getByLabelText(/Release label/i)).toBeTruthy());
}

/** The settings view owns the Git-authored configuration template. */
async function openSettings() {
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
}

/** Open a run's Outputs stage from the stage rail. */
async function openOutputs() {
    await selectHistoryRun();
    const outputs = await screen.findByRole("button", { name: /Outputs/i });
    await waitFor(() => expect(outputs).not.toBeDisabled());
    fireEvent.click(outputs);
}

describe("ReleaseStudioPanel", () => {
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, "", "/");
        vi.mocked(api.listConfigurations).mockResolvedValue([
            {
                config_key: "default",
                title: "Default",
                board_rel: "board.kicad_pcb",
                schematic_rel: "board.kicad_sch",
                jobset_rel: "Outputs.kicad_jobset",
                default_variant: "",
                typography: "geist-pixel-square",
                vendors: ["jlcpcb"],
            },
        ]);
        vi.mocked(api.listCandidates).mockResolvedValue([candidate]);
        vi.mocked(api.getBuild).mockResolvedValue(detail);
        vi.mocked(api.verifyAudit).mockResolvedValue({ ok: true, events: 3, problems: [] });
        vi.mocked(api.listDocumentSheets).mockResolvedValue([]);
    });

    it("explains an unbuildable project instead of leaving Build inert", async () => {
        vi.mocked(api.listConfigurations).mockResolvedValue([]);
        vi.mocked(api.listCandidates).mockResolvedValue([]);

        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await openSettings();
        const build = await screen.findByRole("button", { name: /start build/i });
        expect((build as HTMLButtonElement).disabled).toBe(true);
    });

    it("renders unsupported distinctly from pass", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        // Gates arrive collapsed once their work is done; the policy detail is
        // one click away rather than a wall on entry.
        fireEvent.click(await screen.findByRole("button", { name: /Check against policy/i }));
        await waitFor(() => expect(screen.getByText("stackup.min_copper_layers")).toBeTruthy());

        const passBadge = screen.getByText("pass");
        const unsupportedBadges = screen.getAllByText("unsupported");
        expect(unsupportedBadges.length).toBeGreaterThan(0);
        for (const badge of unsupportedBadges) {
            expect(badge.className).not.toEqual(passBadge.className);
        }
        expect(screen.getByText(/the stackup projection is not available/)).toBeTruthy();
    });

    it("renders the committed configuration as an editable Settings form", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openSettings();
        expect(await screen.findByDisplayValue("board.kicad_pcb")).toBeTruthy();
        expect(screen.getByDisplayValue("Outputs.kicad_jobset")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Save & publish/i })).toBeDisabled();
    });

    it("keeps historical revisions buildable but cannot publish over the branch tip", async () => {
        const tip = candidate.commit_sha;
        const historical = "1".repeat(40);
        vi.mocked(api.listProjectCommits).mockResolvedValue([
            { hash: tip.slice(0, 7), full_hash: tip, author: "designer", email: "d@example.com", date: "2026-08-11T00:00:00Z", message: "tip" },
            { hash: historical.slice(0, 7), full_hash: historical, author: "designer", email: "d@example.com", date: "2026-08-10T00:00:00Z", message: "historical" },
        ]);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        const revision = await screen.findByLabelText("Build revision");
        fireEvent.change(revision, { target: { value: historical } });

        expect(await screen.findByText("Historical")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Start build/i })).not.toBeDisabled();
        fireEvent.change(await screen.findByLabelText("Release title"), { target: { value: "Older title" } });
        expect(screen.getByRole("button", { name: /Save & publish/i })).toBeDisabled();
    });

    it("preserves absent versus explicitly empty vendor selection and shows normalized response fields", async () => {
        vi.mocked(api.listConfigurations).mockResolvedValue([
            { config_key: "legacy", title: "Legacy", board_rel: "board.kicad_pcb", schematic_rel: "board.kicad_sch", jobset_rel: "Outputs.kicad_jobset", default_variant: "" },
            { config_key: "strict", title: "Strict", board_rel: "board.kicad_pcb", schematic_rel: "board.kicad_sch", jobset_rel: "Outputs.kicad_jobset", default_variant: "A", vendors: [], variants: ["A", "B"], policy: "release-policy.yaml", template: "docs/release.kicad_wks", sheets: ["cover", "fab"], fields: { document_number: "USB-PD" }, notes: { release: ["pilot"] } },
        ]);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openSettings();
        expect(await screen.findByRole("button", { name: "jlcpcb" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.change(screen.getByLabelText("Configuration"), { target: { value: "strict" } });
        await waitFor(() => expect(screen.getByRole("button", { name: "jlcpcb" })).toHaveAttribute("aria-pressed", "false"));
        expect(screen.getByDisplayValue("A, B")).toBeTruthy();
    });

    it("lists composed documentation sheets as a dedicated preview surface", async () => {
        vi.mocked(api.listDocumentSheets).mockResolvedValue([
            {
                key: "fabrication",
                pdf: { path: "documentation/fabrication.pdf", released_digest: "b".repeat(64), media_type: "application/pdf" },
            },
        ]);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        await waitFor(() =>
            expect(screen.getByRole("tab", { name: /Documents \(1\)/ })).toBeTruthy(),
        );
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
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await openReleaseTab();
        expect(screen.queryByLabelText(/Release over open blockers/i)).toBeNull();
        expect(screen.getByText(/Unsupported policy evidence blocks release/)).toBeTruthy();
    });

    it("requires an admin to state a reason before overriding blockers", async () => {
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate isAdmin />);

        await openReleaseTab();
        const label = await screen.findByRole("textbox", { name: /Release label/i });
        fireEvent.change(label, { target: { value: "REL-1" } });

        const release = screen.getByRole("button", { name: /Sign and release/i });
        expect((release as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByLabelText(/Release over open blockers/i));
        const overriding = screen.getByRole("button", { name: /Override and release/i });
        expect((overriding as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText(/Override reason/i), {
            target: { value: "customer accepted the deviation" },
        });
        expect((screen.getByRole("button", { name: /Override and release/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("surfaces a broken audit chain rather than failing quietly", async () => {
        vi.mocked(api.verifyAudit).mockResolvedValue({
            ok: false,
            events: 4,
            problems: ["broken link at sequence 3"],
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await selectHistoryRun();
        await waitFor(() => expect(screen.getByText(/Audit chain BROKEN/)).toBeTruthy());
    });

    it("renders the GitHub Actions-style jobs rail from pipeline metadata", async () => {
        const { watchPrismJob } = await import("@/lib/jobs");
        vi.mocked(watchPrismJob).mockImplementation(async (_id, options) => {
            const job = {
                job_id: "job-1",
                kind: "release_studio_build",
                status: "running" as const,
                stage: "checks",
                message: "Ran drc",
                percent: 20,
                pipeline: {
                    jobs: [
                        {
                            id: "checks",
                            name: "Checks",
                            status: "in_progress" as const,
                            steps: [{ id: "drc", name: "DRC", status: "in_progress" as const }],
                        },
                    ],
                },
            };
            options?.onUpdate?.(job, []);
            await new Promise((resolve) => window.setTimeout(resolve, 80));
            const done = { ...job, status: "completed" as const, percent: 100 };
            options?.onUpdate?.(done, []);
            return done;
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        // New release opens Source rather than firing an expensive job on one
        // click; the build starts from the revision that was chosen there.
        await startRun();
        await waitFor(() => expect(screen.getByText("Checks")).toBeTruthy());
        expect(screen.getByText("DRC")).toBeTruthy();
    });

    it("lets an admin back out of an override once the blockers are gone", async () => {
        // The override control only renders while blockers exist. Setting the
        // flag and then clearing the blockers used to strand the user: the
        // backend refuses an override with nothing to override, and the
        // checkbox that set it was no longer on screen.
        render(<ReleaseStudioPanel projectId="p1" canMutate isAdmin />);
        await openReleaseTab();
        expect(screen.getByLabelText(/Release over open blockers/i)).toBeTruthy();
        const action = await screen.findByRole("button", { name: /Sign and release/i });
        expect(action.textContent).not.toContain("Override");
    });

    it("names the finding in the waiver picker, not just its rule", async () => {
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const pickers = await screen.findAllByRole("combobox");
        const picker = pickers.find((item) => item.textContent?.includes("drc.clean"));
        expect(picker).toBeTruthy();
        // Rule plus subject reads as a category; several distinct findings
        // looked like the same entry until the message was included.
        expect(picker!.textContent).toContain("drc.clean");
        expect(picker!.textContent).toContain("·");
    });

    it("approves against the policy's own role and domain, not typed text", async () => {
        // The free-text form let an approval be recorded as "manufacturing for
        // bare_board", which satisfied no requirement and could not be undone.
        // Each required pair now has its own card that supplies both values.
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            approvals: [],
            required_approvals: [
                { role: "pcb_design", domain: "bare_board", satisfied: false },
                { role: "manufacturing", domain: "assembly", satisfied: false },
            ],
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const gate = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (gate.getAttribute("aria-expanded") !== "true") fireEvent.click(gate);
        fireEvent.click(await screen.findByRole("button", { name: /Approve as manufacturing/i }));
        await waitFor(() =>
            expect(vi.mocked(api.createApproval)).toHaveBeenCalledWith("p1", "build-1", {
                role: "manufacturing",
                domains: ["assembly"],
                note: "",
                evaluation_id: "eval-1",
            }),
        );
    });

    it("starts a new run with no stage already ticked", async () => {
        // The previous build stayed selected while the new one ran, so its
        // finished detail drove the rail: Source, Outputs, Sign-off and
        // Released all showed done over a build that had only just queued.
        const { watchPrismJob } = await import("@/lib/jobs");
        vi.mocked(watchPrismJob).mockImplementation(async (_id, options) => {
            const job = {
                job_id: "job-2",
                kind: "release_studio_build",
                status: "running" as const,
                stage: "documents",
                message: "Composing documentation",
                percent: 70,
                pipeline: { jobs: [] },
            };
            options?.onUpdate?.(job, []);
            await new Promise((resolve) => window.setTimeout(resolve, 60));
            return { ...job, status: "completed" as const, percent: 100 };
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await startRun();

        const rail = await screen.findByRole("navigation", { name: /run stages/i });
        await waitFor(() => expect(rail.textContent).toContain("running"));
        // Outputs and Sign-off belong to the run being replaced, not this one.
        expect(rail.textContent).not.toContain("members");
        expect(rail.textContent).not.toContain("approval(s)");
        expect(rail.textContent).not.toContain("release(s)");
        // And the ticks: the reported symptom was every stage showing done
        // over a build that had only just been queued.
        const states = Array.from(rail.querySelectorAll("[data-state]")).map((node) =>
            node.getAttribute("data-state"),
        );
        expect(states).toEqual(["done", "active", "locked", "locked", "locked"]);
    });

    it("binds a waiver to the build it was raised against", async () => {
        // finding_key is stable across rebuilds, so a config-scoped waiver
        // silently carried an accepted exception into the next release.
        vi.mocked(api.getBuild).mockResolvedValue(blockedDetail);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const reason = await screen.findByPlaceholderText(/Why this finding is accepted/i);
        fireEvent.change(reason, { target: { value: "accepted for the prototype run" } });
        fireEvent.click(await screen.findByRole("button", { name: /Propose waiver/i }));
        await waitFor(() =>
            expect(vi.mocked(api.createWaiver)).toHaveBeenCalledWith(
                "p1",
                "build-1",
                expect.any(Object),
            ),
        );
    });

    it("keeps Settings first and starts only from the explicit build action", async () => {
        const before = vi.mocked(api.startBuild).mock.calls.length;
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        expect(await screen.findByRole("heading", { name: /Release configuration/i })).toBeTruthy();
        expect(vi.mocked(api.startBuild).mock.calls.length).toBe(before);
        fireEvent.click(await screen.findByRole("button", { name: /start build/i }));
        await waitFor(() =>
            expect(vi.mocked(api.startBuild).mock.calls.length).toBe(before + 1),
        );
    });

    it("offers a manufacturer pack picker driven by the registry", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        fireEvent.click(await screen.findByRole("tab", { name: /Members/i }));
        await waitFor(() => expect(screen.getByLabelText("Manufacturer")).toBeTruthy());
        expect(screen.getByRole("button", { name: /Download jlcpcb-upload.zip/i })).toBeDisabled();
    });

    it("shows missing vendor workbooks even when canonical outputs exist", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            members: [
                { id: "g", path: "fabrication/gerbers/top.gbr", member_kind: "gerber", media_type: "text/plain", size_bytes: 1, released_digest: "g", source_raw_digest: "g", canonicalizer: "text", domains: ["bare_board"] },
                { id: "d", path: "fabrication/drill/board.drl", member_kind: "drill", media_type: "text/plain", size_bytes: 1, released_digest: "d", source_raw_digest: "d", canonicalizer: "text", domains: ["bare_board"] },
                { id: "b", path: "manufacturing/vendors/jlcpcb/bom.csv", member_kind: "vendor_csv", media_type: "text/csv", size_bytes: 1, released_digest: "b", source_raw_digest: "b", canonicalizer: "csv", domains: ["assembly"] },
                { id: "c", path: "manufacturing/vendors/jlcpcb/cpl.csv", member_kind: "vendor_csv", media_type: "text/csv", size_bytes: 1, released_digest: "c", source_raw_digest: "c", canonicalizer: "csv", domains: ["assembly"] },
            ],
            vendor_readiness: [{ vendor_id: "jlcpcb", ready: false, missing_requirements: ["bom.xlsx", "cpl.xlsx"] }],
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        expect(screen.getByText("bom.csv").parentElement?.textContent).toContain("ready");
        expect(screen.getByText("bom.xlsx").parentElement?.textContent).toContain("missing");
        expect(screen.getByRole("button", { name: /Download jlcpcb-upload.zip/i })).toBeDisabled();
    });

    it("downloads build evidence from the authoritative build-evidence route", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        fireEvent.click(screen.getByRole("button", { name: /Build evidence/i }));
        await waitFor(() => expect(vi.mocked(api.downloadFile)).toHaveBeenCalledWith(
            "/api/projects/p1/release-studio/builds/build-1/build-evidence",
            "build-build-1-evidence.tar.gz",
        ));
    });

    it("surfaces build download failures through the workflow error state", async () => {
        vi.mocked(api.downloadFile).mockRejectedValueOnce(new Error("evidence download denied"));
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        fireEvent.click(screen.getByRole("button", { name: /Build evidence/i }));
        expect(await screen.findByText("evidence download denied")).toBeTruthy();
    });

    it("keeps sign-off document identity read-only and build-bound", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            configuration: { ...detail.configuration!, document_number: "USB-PD-TRIG", revision: "A" },
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReleaseTab();
        expect(screen.getByLabelText("Document number").textContent).toBe("USB-PD-TRIG");
        expect(screen.getByLabelText("Revision").textContent).toBe("A");
        expect(screen.queryByRole("textbox", { name: /Document number|Revision/i })).toBeNull();
    });

    it("clears old detail immediately when switching to a failed attempt", async () => {
        const failed = {
            ...candidate.latest_build!,
            id: "build-failed",
            status: "failed" as const,
            attempt: 2,
            completed_at: "2026-08-12T00:00:00Z",
            error_message: "KiCad exited 1",
        };
        vi.mocked(api.listCandidates).mockResolvedValue([{ ...candidate, builds: [failed, candidate.latest_build!] }]);
        vi.mocked(api.getBuild).mockImplementation((_, buildId) =>
            buildId === "build-1" ? Promise.resolve(detail) : new Promise<BuildDetail>(() => {}),
        );
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        fireEvent.click(await screen.findByRole("button", { name: /^history$/i }));
        fireEvent.click(await screen.findByRole("button", { name: /succeeded.*attempt 1/i }));
        await waitFor(() => expect(screen.getByText("succeeded")).toBeTruthy());

        fireEvent.click(screen.getByRole("button", { name: /failed.*attempt 2/i }));

        const rail = screen.getByRole("navigation", { name: /run stages/i });
        expect(within(rail).getByRole("button", { name: /Outputs/i })).toBeDisabled();
        expect(within(rail).getByRole("button", { name: /Sign-off/i })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Continue to sign-off/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /Sign and release/i })).toBeNull();
        expect(screen.getByText("loading")).toBeTruthy();
    });

    it("uses only the resolved immutable HEAD SHA for configuration lookup", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await waitFor(() => expect(vi.mocked(api.listConfigurations)).toHaveBeenCalledWith("p1", "abcdef12abcdef12abcdef12abcdef12abcdef12"));
        expect(vi.mocked(api.listConfigurations).mock.calls.every((call) => call[1] === "abcdef12abcdef12abcdef12abcdef12abcdef12")).toBe(true);
    });

    it("fails closed when the selected revision configuration cannot be read", async () => {
        vi.mocked(api.listConfigurations).mockRejectedValue(new Error("immutable configuration lookup failed"));
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openSettings();
        await waitFor(() => expect(screen.getByText(/immutable configuration lookup failed/i)).toBeTruthy());
        expect(screen.getByRole("button", { name: /start build/i })).toBeDisabled();
        expect(vi.mocked(api.listConfigurations).mock.calls.every((call) => call[1] === "abcdef12abcdef12abcdef12abcdef12abcdef12")).toBe(true);
    });

    it("treats a missing vendor readiness response as unavailable rather than ready", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({ ...detail, vendor_readiness: undefined });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        expect(screen.getByText("gerber").parentElement?.textContent).toContain("unavailable");
        expect(screen.getByText("bom.csv").parentElement?.textContent).toContain("unavailable");
        expect(screen.getByRole("button", { name: /Download jlcpcb-upload.zip/i })).toBeDisabled();
    });

    it("allows a valid policy with zero required approvals to unlock release", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            approvals: [],
            required_approvals: [],
            evaluation: {
                ...detail.evaluation!,
                outcome: "pass",
                rule_outcomes: [{ ...detail.evaluation!.rule_outcomes[0], outcome: "pass" }],
            },
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReleaseTab();
        expect(screen.getByText("no approvals required")).toBeTruthy();
        fireEvent.change(screen.getByRole("textbox", { name: /Release label/i }), { target: { value: "REL-EMPTY" } });
        expect(screen.getByRole("button", { name: /Sign and release/i })).not.toBeDisabled();
    });

    it("mounts signed release library actions but keeps an unknown vendor pack locked", async () => {
        const record: ReleaseRecord = {
            id: "record-1", build_id: "build-1", config_key: "default", release_label: "REL-1", document_number: "DOC-1", revision: "A", dossier_digest: "d", manifest_digest: "m", attestation_digest: "a", signing_key_id: "key", commit_sha: candidate.commit_sha, variant: "default", released_by: "designer", created_at: "2026-08-12T00:00:00Z", superseded_by: null,
        };
        vi.mocked(api.listRecords).mockResolvedValue([record]);
        vi.mocked(api.listWebReleases).mockResolvedValue([{ id: "share-1", record_id: "record-1", status: "active", expires_at: null, created_by: "designer", created_at: "2026-08-12T00:00:00Z" }]);
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        fireEvent.click(await screen.findByRole("button", { name: /^library$/i }));
        fireEvent.click(await screen.findByRole("button", { name: /REL-1/i }));
        await waitFor(() => expect(screen.getByRole("button", { name: /Archive/i })).toBeTruthy());
        expect(screen.getByRole("button", { name: /Verify/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Share/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Revoke/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Download jlcpcb-upload.zip/i })).toBeDisabled();
    });

    it("reloads the selected build detail after an approval mutation", async () => {
        const required = { role: "pcb_design", domain: "bare_board", satisfied: false };
        const effectiveApproval: Approval = { ...invalidatedApproval, id: "appr-current", invalidations: [], evaluation_id: "eval-1" };
        vi.mocked(api.getBuild)
            .mockResolvedValueOnce({ ...detail, approvals: [], required_approvals: [required], required_approvals_available: true })
            .mockResolvedValueOnce({ ...detail, approvals: [], required_approvals: [required], required_approvals_available: true })
            .mockResolvedValueOnce({ ...detail, approvals: [effectiveApproval], required_approvals: [{ ...required, satisfied: true }], required_approvals_available: true });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const gate = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (gate.getAttribute("aria-expanded") !== "true") fireEvent.click(gate);
        fireEvent.click(await screen.findByRole("button", { name: /Approve as pcb_design/i }));
        await waitFor(() => expect(vi.mocked(api.createApproval)).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByText(/approved by quality/i)).toBeTruthy());
    });

    it("rescinds only the effective approval for the current evaluation and policy", async () => {
        const historical: Approval = { ...invalidatedApproval, id: "appr-old", invalidations: [], evaluation_id: "eval-1", policy_binding_digest: "policy-old" };
        const effective: Approval = { ...invalidatedApproval, id: "appr-current", invalidations: [], evaluation_id: "eval-1" };
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            approvals: [historical, effective],
            required_approvals: [{ role: "pcb_design", domain: "bare_board", satisfied: true }],
            required_approvals_available: true,
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const gate = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (gate.getAttribute("aria-expanded") !== "true") fireEvent.click(gate);
        fireEvent.change(await screen.findByLabelText(/Reason to rescind/i), { target: { value: "scope changed" } });
        fireEvent.click(screen.getByRole("button", { name: /Rescind/i }));
        await waitFor(() => expect(vi.mocked(api.rescindApproval)).toHaveBeenCalledWith("p1", "build-1", "appr-current", "scope changed"));
    });

    it("blocks an explicitly unavailable approval coverage response", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            required_approvals: null,
            required_approvals_available: false,
            required_approvals_error: "policy source unavailable",
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReleaseTab();
        const coverage = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (coverage.getAttribute("aria-expanded") !== "true") fireEvent.click(coverage);
        expect(screen.getByText(/Required approval policy is unavailable/i)).toBeTruthy();
        expect(screen.queryByText("no approvals required")).toBeNull();
    });

    it("blocks approval and release when backend marks the evaluation stale", async () => {
        vi.mocked(api.getBuild).mockResolvedValue({
            ...detail,
            approvals: [],
            required_approvals: [{ role: "pcb_design", domain: "bare_board", satisfied: false }],
            required_approvals_available: true,
            evaluation_fresh: false,
            evaluation_fresh_error: "waiver state changed",
            evaluation: { ...detail.evaluation!, outcome: "pass", rule_outcomes: [] },
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReleaseTab();
        expect(screen.getByText(/Evaluation is stale; re-evaluate before approvals or release/i)).toBeTruthy();
        const approvals = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (approvals.getAttribute("aria-expanded") !== "true") fireEvent.click(approvals);
        expect(screen.queryByRole("button", { name: /Approve as pcb_design/i })).toBeNull();
        fireEvent.change(screen.getByRole("textbox", { name: /Release label/i }), { target: { value: "REL-STALE" } });
        expect(screen.getByRole("button", { name: /Sign and release/i })).toBeDisabled();
    });

    it("preflights the evaluation and never posts a newly stale approval", async () => {
        const required = { role: "manufacturing", domain: "assembly", satisfied: false };
        vi.mocked(api.getBuild)
            .mockResolvedValueOnce({ ...detail, approvals: [], required_approvals: [required], required_approvals_available: true, evaluation_fresh: true })
            .mockResolvedValueOnce({ ...detail, approvals: [], required_approvals: [required], required_approvals_available: true, evaluation_fresh: false });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openReview();
        const gate = await screen.findByRole("button", { name: /Collect sign-off/i });
        if (gate.getAttribute("aria-expanded") !== "true") fireEvent.click(gate);
        fireEvent.click(await screen.findByRole("button", { name: /Approve as manufacturing/i }));
        expect(await screen.findByText(/Evaluation changed. Re-evaluate before approving/i)).toBeTruthy();
        expect(api.createApproval).not.toHaveBeenCalled();
    });

    it("builds only from the full immutable SHA selected in Settings", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        const revision = await screen.findByLabelText("Build revision");
        expect(revision).toHaveValue("abcdef12abcdef12abcdef12abcdef12abcdef12");
        const build = screen.getByRole("button", { name: /Start build/i });
        await waitFor(() => expect(build).not.toBeDisabled());
        fireEvent.click(build);
        await waitFor(() => expect(vi.mocked(api.startBuild)).toHaveBeenCalledWith("p1", expect.objectContaining({ commit_sha: "abcdef12abcdef12abcdef12abcdef12abcdef12" })));
    });

    it("refreshes history after a queued build fails and routes the selected attempt to logs", async () => {
        const failed = { ...candidate.latest_build!, id: "build-failed", job_id: "job-failed", status: "failed" as const, attempt: 2, completed_at: "2026-08-12T00:00:00Z", error_message: "KiCad failed" };
        const failedCandidate = { ...candidate, latest_build: failed, builds: [failed] };
        const { watchPrismJob, throwIfJobFailed } = await import("@/lib/jobs");
        vi.mocked(api.listCandidates).mockResolvedValueOnce([candidate]).mockResolvedValue([failedCandidate]);
        vi.mocked(api.getBuild).mockResolvedValue({ ...detail, build: failed, candidate: failedCandidate });
        vi.mocked(watchPrismJob).mockResolvedValue({ job_id: "job-failed", kind: "release_studio_build", status: "completed", stage: "build", message: "failed", percent: 100 });
        vi.mocked(api.startBuild).mockResolvedValueOnce({ job: { job_id: "job-failed" } });
        vi.mocked(throwIfJobFailed).mockImplementation(() => { throw new Error("The build failed."); });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await startRun();
        const rail = await screen.findByRole("navigation", { name: /run stages/i });
        await waitFor(() => expect(within(rail).getByRole("button", { name: /Build/i })).toHaveAttribute("data-state", "failed"));
        expect(within(rail).getByRole("button", { name: /Outputs/i })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: /^history$/i }));
        expect(await screen.findByRole("button", { name: /failed.*attempt 2/i })).toBeTruthy();
    });

    it("treats a cancelled build as terminal and keeps diagnostics reachable", async () => {
        const cancelled = { ...candidate.latest_build!, id: "build-cancelled", status: "cancelled" as const, attempt: 2, completed_at: "2026-08-12T00:00:00Z", error_message: "Cancelled by operator" };
        const cancelledCandidate = { ...candidate, latest_build: cancelled, builds: [cancelled] };
        vi.mocked(api.listCandidates).mockResolvedValue([cancelledCandidate]);
        vi.mocked(api.getBuild).mockResolvedValue({ ...detail, build: cancelled, candidate: cancelledCandidate });
        vi.mocked(api.listBuildLogs).mockResolvedValue({ timings: [], steps: [{ step_id: "gerbers", step_type: "export", status: "cancelled", returncode: 1, elapsed_ms: 5, skipped_reason: "", argv: [] }] });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);

        await selectHistoryRun();
        const rail = await screen.findByRole("navigation", { name: /run stages/i });
        await waitFor(() => expect(within(rail).getByRole("button", { name: /Build/i })).toHaveAttribute("data-state", "cancelled"));
        expect(within(rail).getByRole("button", { name: /Outputs/i })).toBeDisabled();
        expect(within(rail).getByRole("button", { name: /Sign-off/i })).toBeDisabled();
        expect(within(rail).getByRole("button", { name: /Released/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /cancelled.*attempt 2/i })).toHaveAttribute("aria-current", "true");
        await waitFor(() => expect(vi.mocked(api.listBuildLogs)).toHaveBeenCalledWith("p1", "build-cancelled"));
        expect(screen.getByLabelText("cancelled")).toBeTruthy();
        expect(screen.queryByLabelText("failure")).toBeNull();
    });

    it("falls back to return code when archived status is an empty string", async () => {
        vi.mocked(api.listBuildLogs).mockResolvedValue({ timings: [], steps: [{ step_id: "gerbers", step_type: "export", status: "", returncode: 0, elapsed_ms: 5, skipped_reason: "", argv: [] }] });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await selectHistoryRun();
        expect(await screen.findByLabelText("success")).toBeTruthy();
        expect(screen.queryByLabelText("failure")).toBeNull();
    });

    it("saves manufacturing metadata through the Settings authoring surface", async () => {
        vi.mocked(api.saveConfiguration).mockResolvedValue({
            configuration: { ...detail.configuration!, config_key: "default", fields: { manufacturing_ipc_class: "IPC-6012 Class 2" } },
            commit_sha: candidate.commit_sha,
            path: ".prism/release-studio/configurations/default.yaml",
        });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        fireEvent.change(await screen.findByLabelText("Manufacturing IPC class"), {
            target: { value: "IPC-6012 Class 2" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Save & publish/i }));
        await waitFor(() => expect(vi.mocked(api.saveConfiguration)).toHaveBeenCalledWith(
            "p1",
            "default",
            expect.objectContaining({
                fields: expect.objectContaining({ manufacturing_ipc_class: "IPC-6012 Class 2" }),
            }),
            candidate.commit_sha,
        ));
    });

    it("keeps a live log stream open and cancels the active job", async () => {
        const { watchPrismJob, cancelPrismJob } = await import("@/lib/jobs");
        vi.mocked(watchPrismJob).mockImplementation(async (_id, options) => {
            options?.onUpdate?.({
                job_id: "job-live", kind: "release_studio_build", status: "running",
                stage: "checks", message: "Running DRC", percent: 25,
                pipeline: { jobs: [{ id: "checks", name: "Checks", status: "in_progress", steps: [{ id: "drc", name: "DRC", status: "in_progress" }] }] },
            }, ["Starting release build", "Running DRC"]);
            return new Promise(() => {});
        });
        vi.mocked(api.startBuild).mockResolvedValueOnce({ job: { job_id: "job-live" } });
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await startRun();
        expect(await screen.findByLabelText("Live build log")).toHaveTextContent("Running DRC");
        fireEvent.click(screen.getByRole("button", { name: /Cancel build/i }));
        await waitFor(() => expect(cancelPrismJob).toHaveBeenCalledWith("job-live"));
    });

    it("selects outputs by the completed job identity instead of the previous run", async () => {
        const nextBuild = { ...candidate.latest_build!, id: "build-2", job_id: "job-2", completed_at: "2026-08-13T00:00:00Z" };
        const nextCandidate = { ...candidate, id: "cand-2", latest_build: nextBuild, builds: [nextBuild], created_at: "2026-08-13T00:00:00Z" };
        vi.mocked(api.listCandidates)
            .mockResolvedValueOnce([candidate])
            .mockResolvedValue([nextCandidate, candidate]);
        vi.mocked(api.startBuild).mockResolvedValueOnce({ job: { job_id: "job-2" } });
        const { watchPrismJob } = await import("@/lib/jobs");
        vi.mocked(watchPrismJob).mockResolvedValue({ job_id: "job-2", kind: "release_studio_build", status: "completed", stage: "package", message: "Done", percent: 100 });
        vi.mocked(api.getBuild).mockImplementation(async (_project, buildId) => ({
            ...detail,
            build: buildId === "build-2" ? nextBuild : candidate.latest_build!,
            candidate: buildId === "build-2" ? nextCandidate : candidate,
        }));
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await startRun();
        await waitFor(() => expect(api.getBuild).toHaveBeenCalledWith("p1", "build-2"));
        expect(window.location.search).toContain("build=build-2");
    });
});
