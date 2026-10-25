import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchJson: vi.fn(),
    fetchApi: vi.fn(),
    readApiError: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
    fetchJson: (...args: unknown[]) => mocks.fetchJson(...args),
    fetchApi: (...args: unknown[]) => mocks.fetchApi(...args),
    readApiError: (...args: unknown[]) => mocks.readApiError(...args),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import { DesignDataSection } from "./design-data-section";

const STATUS = {
    bundles: { complete: 2, building: 0, queued: 0, failed: 0 },
    aliases: 3,
    storedBytes: 1024,
};

// A Type-2 subproject lists only commits touching it, so the newest listed
// commit can be older than the checkout's HEAD; the label must name HEAD.
const HEAD = {
    commits: [{ full_hash: "1111111111111111111111111111111111111111" }],
    head: "abcdef12abcdef12abcdef12abcdef12abcdef12",
};

const response = (ok: boolean) => ({ ok } as Response);

const renderSection = (canEdit = true) =>
    render(<DesignDataSection projectId="p1" canEdit={canEdit} />);

beforeEach(() => {
    mocks.fetchJson.mockImplementation(async (url: string) =>
        url.includes("/commits?") ? HEAD : STATUS,
    );
    mocks.fetchApi.mockResolvedValue(response(true));
    mocks.readApiError.mockResolvedValue("A design bundle of this project is being built; try again when it finishes");
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("DesignDataSection", () => {
    it("lists stored bundles and reused revisions", async () => {
        renderSection();
        expect(await screen.findByText("2 stored · 3 reused")).toBeInTheDocument();
        // Nothing building and nothing failed, so the line says only those two.
        expect(screen.queryByText(/building/)).not.toBeInTheDocument();
        expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
        expect(screen.queryByText(/incomplete/)).not.toBeInTheDocument();
        expect(mocks.fetchJson).toHaveBeenCalledWith(
            "/api/projects/p1/design-bundles",
            expect.objectContaining({ signal: expect.anything() }),
        );
    });

    it("adds building and failed counts only when they are non-zero", async () => {
        mocks.fetchJson.mockResolvedValue({
            bundles: { complete: 1, building: 1, queued: 1, failed: 2 },
            aliases: 0,
            storedBytes: 0,
        });
        renderSection();
        expect(await screen.findByText("1 stored · 0 reused · 2 building · 2 failed")).toBeInTheDocument();
    });

    it("lists revisions whose stages failed or are partial", async () => {
        mocks.fetchJson.mockImplementation(async (url: string) =>
            url.includes("/commits?")
                ? HEAD
                : {
                      ...STATUS,
                      incomplete: { failed: 1, partial: 1 },
                      incompleteRevisions: [
                          { commit: "b".repeat(40), revisionKey: "2".repeat(64), failedStages: ["parse"], partialStages: [] },
                          { commit: "c".repeat(40), revisionKey: "3".repeat(64), failedStages: [], partialStages: ["board"] },
                      ],
                  },
        );
        renderSection();
        expect(await screen.findByText("2 stored · 3 reused · 2 incomplete")).toBeInTheDocument();
        const list = screen.getByRole("list", { name: "Incomplete design data" });
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(within(items[0]).getByText("bbbbbbbb")).toHaveAttribute("title", "b".repeat(40));
        expect(within(items[0]).getByText("parse failed")).toBeInTheDocument();
        expect(within(items[1]).getByText("board partial")).toBeInTheDocument();
    });

    it("keeps the counts current while a build runs and stops once it settles", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            const building = { ...STATUS, bundles: { complete: 0, building: 1, queued: 0, failed: 0 } };
            const settled = { ...STATUS, bundles: { complete: 1, building: 0, queued: 0, failed: 0 } };
            const statuses = [building, settled];
            mocks.fetchJson.mockImplementation(async (url: string) =>
                url.includes("/commits?") ? HEAD : (statuses.shift() ?? settled),
            );
            renderSection();
            expect(await screen.findByText("0 stored · 3 reused · 1 building")).toBeInTheDocument();
            await vi.advanceTimersByTimeAsync(5000);
            expect(await screen.findByText("1 stored · 3 reused")).toBeInTheDocument();
            const reads = mocks.fetchJson.mock.calls.filter(([url]) => String(url).endsWith("/design-bundles")).length;
            await vi.advanceTimersByTimeAsync(15000);
            expect(mocks.fetchJson.mock.calls.filter(([url]) => String(url).endsWith("/design-bundles"))).toHaveLength(reads);
        } finally {
            vi.useRealTimers();
        }
    });

    it("shows why a revision failed, in full on hover, and lists failed builds", async () => {
        const reason = "parse: source-unparseable: expected ')' (board/main.kicad_sch:12)";
        mocks.fetchJson.mockImplementation(async (url: string) =>
            url.includes("/commits?")
                ? HEAD
                : {
                      ...STATUS,
                      bundles: { complete: 2, building: 0, queued: 0, failed: 1 },
                      incomplete: { failed: 1, partial: 0 },
                      incompleteRevisions: [
                          { commit: "b".repeat(40), revisionKey: "2".repeat(64), failedStages: ["parse"], partialStages: [], reason },
                      ],
                      failedBuilds: [
                          { commit: "d".repeat(40), revisionKey: "4".repeat(64), reason: "KiCad cannot read board.kicad_pcb" },
                      ],
                  },
        );
        renderSection();
        const incomplete = await screen.findByRole("list", { name: "Incomplete design data" });
        expect(within(incomplete).getByText(reason)).toHaveAttribute("title", reason);
        const failed = screen.getByRole("list", { name: "Failed design data builds" });
        const [build] = within(failed).getAllByRole("listitem");
        expect(within(build).getByText("dddddddd")).toBeInTheDocument();
        expect(within(build).getByText("build failed")).toBeInTheDocument();
        expect(within(build).getByText("KiCad cannot read board.kicad_pcb")).toBeInTheDocument();
    });

    it("says the status is unavailable when the load fails", async () => {
        mocks.fetchJson.mockRejectedValue(new Error("nope"));
        renderSection();
        expect(await screen.findByText("Design data status unavailable")).toBeInTheDocument();
    });

    it("names the commit that Rebuild for HEAD targets", async () => {
        renderSection();
        expect(await screen.findByText("abcdef12")).toBeInTheDocument();
    });

    it("hides the rebuilds when the viewer may not edit", async () => {
        renderSection(false);
        await screen.findByText("2 stored · 3 reused");
        expect(screen.queryByRole("button", { name: "Rebuild for HEAD" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Rebuild all" })).not.toBeInTheDocument();
    });

    it("rebuilds HEAD without a confirmation", async () => {
        renderSection();
        fireEvent.click(await screen.findByRole("button", { name: "Rebuild for HEAD" }));

        await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(1));
        const [url, init] = mocks.fetchApi.mock.calls[0];
        expect(url).toBe("/api/projects/p1/design-bundles/regenerate");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({ scope: "commit" });
        await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Rebuild queued"));
        // The counts are refreshed after the queue, next to the HEAD read.
        await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledTimes(3));
    });

    it("asks before rebuilding everything", async () => {
        renderSection();
        fireEvent.click(await screen.findByRole("button", { name: "Rebuild all" }));

        // Opening the confirmation queues nothing.
        const dialog = await screen.findByRole("dialog");
        expect(mocks.fetchApi).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole("button", { name: "Rebuild all" }));

        await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(1));
        const [url, init] = mocks.fetchApi.mock.calls[0];
        expect(url).toBe("/api/projects/p1/design-bundles/regenerate");
        expect(JSON.parse(init.body)).toEqual({ scope: "project" });
    });

    it("shows the server's detail when the rebuild is refused", async () => {
        mocks.fetchApi.mockResolvedValue(response(false));
        renderSection();
        fireEvent.click(await screen.findByRole("button", { name: "Rebuild for HEAD" }));

        await waitFor(() =>
            expect(mocks.toastError).toHaveBeenCalledWith(
                "A design bundle of this project is being built; try again when it finishes",
            ),
        );
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
        // A refused rebuild does not refresh the counts; only the initial loads ran.
        expect(mocks.fetchJson).toHaveBeenCalledTimes(2);
    });
});
