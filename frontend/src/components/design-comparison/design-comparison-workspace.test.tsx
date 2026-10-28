import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
    toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
    Toaster: () => null,
}));
vi.mock("@/lib/api", () => ({
    fetchJson: vi.fn(async () => ({ items: [] })),
    fetchApi: vi.fn(async () => new Response("{}", { status: 200 })),
    readApiError: vi.fn(async () => "error"),
    ApiHttpError: class ApiHttpError extends Error {},
}));

// Hoisted so the job result keeps its identity across renders, the way the
// real useState-backed hook does. A fresh object per render would re-fire
// every result-keyed effect and hide what these tests are about.
const { JOB } = vi.hoisted(() => {
    const change = (id: string, domain: "schematic" | "pcb") => {
        const layers = domain === "pcb" ? ["F.Cu"] : [];
        return {
            id,
            kind: "changed",
            domain,
            category: "components",
            classification: "primary",
            label: id,
            reference: id.toUpperCase(),
            objectKind: domain === "pcb" ? "footprint" : "symbol",
            page: "root.kicad_sch",
            reasons: ["content-changed"],
            fields: {},
            details: {},
            net: undefined as string | undefined,
            semanticId: `sem-${id}` as string | undefined,
            base: { sourceId: `base-${id}`, documentPath: "root.kicad_sch", layers },
            head: { sourceId: `head-${id}`, documentPath: "root.kicad_sch", layers },
        };
    };
    const pcbChanges = [
        change("p1", "pcb"),
        {
            ...change("gnd-added", "pcb"),
            kind: "added",
            category: "nets",
            label: "GND",
            reference: undefined,
            objectKind: "track",
            net: "GND",
            semanticId: undefined,
            reasons: ["object-added"],
        },
        {
            ...change("gnd-removed", "pcb"),
            kind: "removed",
            category: "nets",
            label: "GND",
            reference: undefined,
            objectKind: "track",
            net: "GND",
            semanticId: undefined,
            reasons: ["object-removed"],
        },
    ];
    const emptySummary = { added: 0, removed: 0, changed: 0 };
    return {
        JOB: {
            result: {
                schema: "prism.design_compare.result.a1",
                base: { revisionKey: "b", projectFile: "root.kicad_pro" },
                head: { revisionKey: "c", projectFile: "root.kicad_pro" },
                files: {
                    base: [{ path: "root.kicad_sch", filename: "root.kicad_sch" }],
                    head: [{ path: "root.kicad_sch", filename: "root.kicad_sch" }],
                },
                projectDiff: {
                    schema: "prism.kicad_project_diff_v1",
                    provider: "prism-semantic",
                    project: {
                        documents: [{
                            path: "root.kicad_sch",
                            docType: "kicad_sch",
                            changes: [],
                        }],
                    },
                    navigation: {},
                    diagnostics: [],
                },
                schematic: { changes: [change("s1", "schematic")] },
                pcb: { changes: pcbChanges },
                bom: { summary: emptySummary, changes: [], fields: [] },
                stackup: {
                    present: false,
                    changed: false,
                    base: [],
                    head: [],
                    baseSettings: {},
                    headSettings: {},
                },
                routeMetrics: { base: {}, head: {} },
                counts: {
                    schematic: { ...emptySummary, changed: 1 },
                    pcb: { ...emptySummary, changed: 1 },
                    bom: emptySummary,
                },
                fabrication: {},
            },
            status: { state: "completed" },
            error: null,
        },
    };
});

vi.mock("./use-design-compare-job", () => ({ useDesignCompareJob: () => JOB }));
vi.mock("./use-comparison-comments", () => ({
    useComparisonComments: () => [[], vi.fn(), { status: "live", error: null, hasLoaded: true }],
}));
// The shell hosts a custom element jsdom cannot instantiate, and has its own
// suite. What is under test here is the workspace around it.
vi.mock("./comparison-presentation-shell", () => ({
    ComparisonPresentationShell: ({
        toolbarContent,
    }: {
        toolbarContent?: React.ReactNode;
    }) => <div data-testid="shell">{toolbarContent}</div>,
}));

import { DesignComparisonWorkspace } from "./design-comparison-workspace";

/**
 * Fails the render rather than hanging the run.
 *
 * The comparison state lives in the address bar, so a redundant write is a
 * navigation and a navigation is a render. Left unguarded the two feed each
 * other and the event loop never yields -- which is a test-run timeout with no
 * output, not a readable failure. Counting router-driven renders and throwing
 * turns that into an assertion.
 */
let routerRenders = 0;

function SettleGuard({ cap }: { cap: number }) {
    const location = useLocation();
    // A module-scoped counter rather than a ref: counting has to include
    // renders React discards, which is exactly the work a ref is not allowed
    // to record.
    routerRenders += 1;
    if (routerRenders > cap) {
        throw new Error(
            `the comparison did not settle: ${routerRenders} renders driven `
            + `by the router, last search "${location.search}"`,
        );
    }
    return null;
}

function mountOn(tab: string) {
    routerRenders = 0;
    return render(
        <MemoryRouter
            initialEntries={[
                `/?section=history&base=b&compare=c&view=semantic&diff=${tab}`,
            ]}
        >
            <SettleGuard cap={25} />
            <DesignComparisonWorkspace
                projectId="p1"
                base="b"
                head="c"
                branchTipSha={null}
                canComment
                onClose={vi.fn()}
            />
        </MemoryRouter>,
    );
}

describe("design comparison workspace", () => {
    // Every tab, because the re-anchor effect that used to spin runs on all of
    // them: with nothing selected it clears an already-empty selection on each
    // pass, and that write reaches the URL.
    for (const tab of ["sch", "pcb", "bom", "stackup", "fabrication"]) {
        it(`settles when opened on the ${tab} tab`, async () => {
            mountOn(tab);
            // The tab bar is rendered on every tab, unlike the domain shells,
            // so finding it means the tree reached a stable render. Reaching
            // this line at all is the assertion: an unsettled workspace never
            // returns from `render`.
            expect(await screen.findAllByRole("button", { name: /schematic/i }))
                .not.toHaveLength(0);
        });
    }

    it("keeps a deep link's tab and selection", async () => {
        routerRenders = 0;
        render(
            <MemoryRouter
                initialEntries={[
                    "/?section=history&base=b&compare=c&view=semantic"
                    + "&diff=pcb&item=p1",
                ]}
            >
                <SettleGuard cap={25} />
                <DesignComparisonWorkspace
                    projectId="p1"
                    base="b"
                    head="c"
                    branchTipSha={null}
                    canComment
                    onClose={vi.fn()}
                />
            </MemoryRouter>,
        );
        // The tab carries a change-count badge, so its accessible name is
        // "PCB" plus a number.
        const pcbTab = (await screen.findAllByRole("button", { name: /pcb/i }))[0];
        expect(pcbTab).toHaveAttribute("aria-pressed", "true");
    });

    it("filters authored decisions without reclassifying their parser events", async () => {
        mountOn("pcb");
        fireEvent.click(await screen.findByRole("button", { name: "Filter changes" }));
        fireEvent.click(screen.getByRole("button", { name: "Modified Modified (2)" }));
        fireEvent.click(screen.getByRole("button", { name: "Removed Removed (0)" }));

        // The added and removed GND primitives form one Modified routing
        // decision. Added-only must not split that decision and relabel half of
        // it as an Added row.
        expect(screen.getByRole("button", { name: "Added Added (0)" }))
            .toHaveTextContent("Added (0)");
        expect(screen.getByText("No differences match these filters.")).toBeTruthy();
    });

    it("highlights the shown mode and resets an override on the next listing", async () => {
        mountOn("pcb");

        expect(screen.queryByRole("button", { name: "Auto" })).toBeNull();
        expect(await screen.findByRole("button", { name: "Composite" }))
            .toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Side by side" }))
            .toHaveAttribute("aria-pressed", "false");

        fireEvent.click(screen.getByRole("button", {
            name: "Single revision presentation mode",
        }));
        expect(screen.getByRole("button", {
            name: "Single revision presentation mode",
        })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", {
            name: "Modified Modified P1",
        }));
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Side by side" }))
                .toHaveAttribute("aria-pressed", "true");
        });
        expect(screen.getByRole("button", {
            name: "Single revision presentation mode",
        })).toHaveAttribute("aria-pressed", "false");
    });
});
