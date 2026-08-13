import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReleaseStudioPanel } from "./ReleaseStudioPanel";
import type { BuildDetail, ReleaseCandidate } from "./types";

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
    getBuild: vi.fn(),
    listDocumentSheets: vi.fn(async () => []),
    publishBuild: vi.fn(async () => ({ release: { url: "https://github.com/org/repo/releases/tag/v1", tag: "v1", forge: "github" }, filename: "board-v1.zip" })),
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

const detail: BuildDetail = {
    build: candidate.latest_build!,
    candidate,
    configuration: {
        config_key: "default", title: "Default", board_rel: "board.kicad_pcb", schematic_rel: "board.kicad_sch", jobset_rel: "Outputs.kicad_jobset", default_variant: "", document_number: "DOC-1", revision: "A",
    },
    members: [],
    evidence: [],
    fingerprints: {},
    vendor_readiness: [{ vendor_id: "jlcpcb", ready: false, missing_requirements: ["Gerber", "drill"] }],
    forge: {
        kind: "github",
        name: "GitHub",
        host: "github.com",
        owner_repo: "org/repo",
        token_configured: true,
        token_hint: "",
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

/** The Release Studio tab owns the Git-authored configuration template. */
async function openSettings() {
    fireEvent.click(await screen.findByRole("button", { name: /^release studio$/i }));
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

    it("starts a new run with no stage already ticked", async () => {
        // The previous build stayed selected while the new one ran, so its
        // finished detail drove the rail: Source, Outputs, Publish and
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
        // Outputs and Publish belong to the run being replaced, not this one.
        expect(rail.textContent).not.toContain("members");
        expect(rail.textContent).not.toContain("approval(s)");
        expect(rail.textContent).not.toContain("release(s)");
        // And the ticks: the reported symptom was every stage showing done
        // over a build that had only just been queued.
        const states = Array.from(rail.querySelectorAll("[data-state]")).map((node) =>
            node.getAttribute("data-state"),
        );
        expect(states).toEqual(["done", "active", "locked", "locked"]);
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
        expect(within(rail).getByRole("button", { name: /Publish/i })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Continue to publish/i })).toBeNull();
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
        expect(within(rail).getByRole("button", { name: /Publish/i })).toBeDisabled();
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

    it("publishes a successful build as a GitHub Release", async () => {
        render(<ReleaseStudioPanel projectId="p1" canMutate />);
        await openOutputs();
        fireEvent.click(screen.getByRole("button", { name: /Continue to publish/i }));
        fireEvent.change(await screen.findByLabelText("Tag"), { target: { value: "v1.0.0" } });
        fireEvent.click(screen.getByRole("button", { name: /Publish to GitHub/i }));
        await waitFor(() => expect(vi.mocked(api.publishBuild)).toHaveBeenCalledWith(
            "p1",
            "build-1",
            { tag: "v1.0.0", title: "", notes: "" },
        ));
        expect(await screen.findByRole("link", { name: /github.com\/org\/repo\/releases\/tag\/v1/i })).toBeTruthy();
    });
});
