import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FabricationViewer } from "./fabrication-viewer";
import { buildSource, outputsSource } from "./sources";
import type { FabricationView, PlacementView } from "./types";

const apiMock = vi.hoisted(() => ({
    fetchJson: vi.fn(),
    fetchApi: vi.fn(),
    readApiError: vi.fn(async () => "layer failed"),
    ApiHttpError: class ApiHttpError extends Error {
        constructor(public status: number, message: string) {
            super(message);
        }
    },
}));
vi.mock("@/lib/api", () => apiMock);

const layer = (id: string, role: string, side: string) => ({
    id, name: id.toUpperCase(), function: "", role, side, colour: "#c83434",
    file: `${id}.gbr`, kind: "gerber", warnings: [],
});

const VIEW = {
    present: true,
    renderVersion: 2,
    bounds: [0, -10, 20, 0],
    board: [0, -10, 20, 0],
    size: { width: 20, height: 10 },
    copperLayers: 2,
    layers: [
        layer("f.cu", "copper", "top"),
        layer("b.cu", "copper", "bottom"),
        layer("edge", "outline", "both"),
    ],
    drill: { tools: [], holes: 0, slots: 0, smallest: null },
} as unknown as FabricationView;

const PLACEMENT: PlacementView = {
    present: true,
    parts: [
        { ref: "C1", value: "10nF", package: "C_0402", x: 5, y: 4, rotation: 90, side: "top", status: "ok" },
        { ref: "R2", value: "1k", package: "R_0402", x: 8, y: 3, rotation: 0, side: "top", status: "not-in-bom" },
        { ref: "R10", value: "1k", package: "R_0402", x: 12, y: 6, rotation: 270, side: "bottom", status: "dnp-placed" },
    ],
    missing: [{ ref: "R5", value: "1k", package: "R_0402", status: "not-placed" }],
    counts: { placed: 3, top: 2, bottom: 1, notInBom: 1, dnpPlaced: 1, notPlaced: 1 },
    hasBom: true,
    files: { positions: "pos.csv", bom: "bom.csv" },
    warnings: [],
};

const SOURCE = buildSource("p1", "b1");

/** Serve the view, and placement data, "no position file", or a failure. */
function serve(placement: PlacementView | "absent" | Error = PLACEMENT) {
    apiMock.fetchJson.mockImplementation(async (url: string) => {
        if (!String(url).includes("/placement")) return VIEW;
        if (placement === "absent") throw new apiMock.ApiHttpError(404, "This build has no position file");
        if (placement instanceof Error) throw placement;
        return placement;
    });
}

class ImmediateResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
        this.callback(
            [{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
        );
    }
    unobserve() {}
    disconnect() {}
}

beforeEach(() => {
    serve();
    apiMock.fetchApi.mockImplementation(async () => ({
        ok: true,
        blob: async () => new Blob(["<svg/>"], { type: "image/svg+xml" }),
    }));
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    let counter = 0;
    URL.createObjectURL = vi.fn(() => `blob:layer-${counter++}`);
    URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

/** The board's own Top/Bottom buttons; the parts table has side filters of the same name. */
const boardSide = (name: "Top" | "Bottom") =>
    within(screen.getByRole("group", { name: "Board side" })).getByRole("button", { name });
const viewButton = (name: RegExp | string) =>
    within(screen.getByRole("group", { name: "Fabrication views" })).getByRole("button", { name });
const placementButton = () => screen.findByRole("button", { name: /^Placement/ });
const markers = () => screen.queryByLabelText("Parts", { selector: "svg" });
const partsButton = () =>
    within(screen.getByRole("group", { name: "Part markers" })).getByRole("button", { name: "Parts" });
const flipped = () => document.querySelector('[style*="scaleX(-1)"]');

async function openViewer() {
    render(<FabricationViewer source={SOURCE} />);
    await screen.findByText(/20\.0 × 10\.0 mm/);
}

async function openPlacement() {
    fireEvent.click(await placementButton());
    return screen.findByRole("table");
}

describe("FabricationViewer, placement", () => {
    it("has no Placement view or Parts controls when there is no position file", async () => {
        serve("absent");
        await openViewer();
        await waitFor(() => expect(apiMock.fetchJson).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("button", { name: /^Placement/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("group", { name: "Part markers" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Parts & filters" })).not.toBeInTheDocument();
    });

    it("has no Parts & filters section: the toolbar's Parts button is the switch", async () => {
        await openViewer();
        await waitFor(() => expect(markers()).toBeInTheDocument());
        expect(screen.queryByRole("button", { name: "Parts & filters" })).not.toBeInTheDocument();
    });

    it("lists the parts and what the BOM check found", async () => {
        await openViewer();
        expect(await placementButton()).toHaveTextContent("Placement (3)");
        const table = await openPlacement();
        for (const ref of ["C1", "R2", "R10", "R5"]) {
            expect(within(table).getByText(ref)).toBeInTheDocument();
        }
        expect(screen.getByText(/Checked against bom\.csv/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Not in BOM \(1\)/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /DNP but placed \(1\)/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Not placed \(1\)/ })).toBeInTheDocument();
    });

    it("filters by search, side and a check chip", async () => {
        await openViewer();
        const table = await openPlacement();

        fireEvent.change(screen.getByLabelText("Search parts"), { target: { value: "r_0402" } });
        expect(within(table).queryByText("C1")).not.toBeInTheDocument();
        expect(within(table).getByText("R2")).toBeInTheDocument();

        const sides = within(screen.getByRole("group", { name: "Side" }));
        fireEvent.click(sides.getByRole("button", { name: "Bottom" }));
        expect(within(table).queryByText("R2")).not.toBeInTheDocument();
        expect(within(table).getByText("R10")).toBeInTheDocument();

        fireEvent.click(sides.getByRole("button", { name: "Both sides" }));
        fireEvent.change(screen.getByLabelText("Search parts"), { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: /Not placed/ }));
        expect(within(table).getAllByRole("row")).toHaveLength(2);
        expect(within(table).getByText("R5")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Not placed/ }));
        expect(within(table).getByText("C1")).toBeInTheDocument();
    });

    it("keeps the filters when you look at the board and come back", async () => {
        await openViewer();
        await openPlacement();
        fireEvent.change(screen.getByLabelText("Search parts"), { target: { value: "10nf" } });
        fireEvent.click(viewButton("Board"));
        fireEvent.click(await placementButton());
        expect(screen.getByLabelText("Search parts")).toHaveValue("10nf");
    });

    it("picks a part from the keyboard", async () => {
        await openViewer();
        const table = await openPlacement();
        const row = within(table).getByText("R2").closest("tr")!;
        expect(row).toHaveAttribute("tabindex", "0");
        fireEvent.keyDown(row, { key: "Enter" });
        expect(await screen.findByRole("button", { name: "Clear selection" })).toBeInTheDocument();
    });

    it("does not offer a part that was never placed", async () => {
        await openViewer();
        const table = await openPlacement();
        fireEvent.click(within(table).getByText("R5"));
        expect(screen.queryByRole("button", { name: "Clear selection" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Placement/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("picking a part shows it on the board, with its details in the footer", async () => {
        await openViewer();
        const table = await openPlacement();
        fireEvent.click(within(table).getByText("C1"));
        expect(await screen.findByRole("button", { name: "Clear selection" })).toBeInTheDocument();
        expect(screen.getByText(/10nF · C_0402 · top/)).toBeInTheDocument();
        expect(boardSide("Top")).toHaveAttribute("aria-pressed", "true");
    });

    it("picking a bottom part turns the board over to it", async () => {
        await openViewer();
        const table = await openPlacement();
        fireEvent.click(within(table).getByText("R10"));
        await waitFor(() => expect(boardSide("Bottom")).toHaveAttribute("aria-pressed", "true"));
        expect(flipped()).toBeInTheDocument();
    });

    it("draws the shown side's parts, and the Parts button hides them", async () => {
        await openViewer();
        await waitFor(() => expect(markers()).toBeInTheDocument());
        expect(markers()!.querySelectorAll("title")).toHaveLength(1);

        fireEvent.click(partsButton());
        expect(markers()).not.toBeInTheDocument();
        fireEvent.click(partsButton());

        fireEvent.click(boardSide("Bottom"));
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(1));
    });

    it("leaves parts that are not in the BOM off the board", async () => {
        await openViewer();
        await waitFor(() => expect(markers()).toBeInTheDocument());
        // C1 is in the BOM; R2 is not, so only C1 is drawn on the top side.
        const titles = [...markers()!.querySelectorAll("title")].map((title) => title.textContent);
        expect(titles).toHaveLength(1);
        expect(titles[0]).toContain("C1");
    });

    it("still lists a part that is not in the BOM, and draws it once it is picked", async () => {
        await openViewer();
        const table = await openPlacement();
        expect(within(table).getByText("R2")).toBeInTheDocument();
        fireEvent.click(within(table).getByText("R2"));
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(2));
        fireEvent.click(await screen.findByRole("button", { name: "Clear selection" }));
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(1));
    });

    it("draws every part when there is no BOM to say which are not in it", async () => {
        serve({
            ...PLACEMENT,
            hasBom: false,
            missing: [],
            parts: PLACEMENT.parts.map((part) => ({ ...part, status: "no-bom" as const })),
        });
        await openViewer();
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(2));
    });

    it("rings the parts the check flagged, so colour is not the only cue", async () => {
        await openViewer();
        fireEvent.click(boardSide("Bottom"));
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(1));
        const flagged = markers()!.querySelector("g")!;
        expect(flagged.querySelectorAll("circle[fill='none']")).toHaveLength(1);
        fireEvent.click(boardSide("Top"));
        await waitFor(() => expect(markers()!.querySelectorAll("title")).toHaveLength(1));
        expect(markers()!.querySelector("g")!.querySelectorAll("circle[fill='none']")).toHaveLength(0);
    });

    it("clicking a marker picks that part, and the selection can be cleared", async () => {
        await openViewer();
        await waitFor(() => expect(markers()).toBeInTheDocument());
        fireEvent.click(markers()!.querySelector("circle[fill='transparent']")!);
        expect(await screen.findByRole("button", { name: "Clear selection" })).toBeInTheDocument();
        expect(screen.getByText("C1", { selector: "span" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
        expect(screen.queryByRole("button", { name: "Clear selection" })).not.toBeInTheDocument();
    });

    it("says so when the parts cannot be read, and the board still works", async () => {
        serve(new Error("Not a position file: no ref column"));
        await openViewer();
        fireEvent.click(await placementButton());
        expect(await screen.findByRole("alert")).toHaveTextContent("Not a position file");
        fireEvent.click(viewButton("Board"));
        expect(await screen.findByRole("button", { name: "Hide F.CU" })).toBeInTheDocument();
    });

    it("notes when there was no BOM to check against", async () => {
        serve({ ...PLACEMENT, hasBom: false, missing: [], files: { positions: "pos.csv", bom: "" } });
        await openViewer();
        await openPlacement();
        expect(screen.getByText(/No BOM was found/)).toBeInTheDocument();
    });

    it("says every part matches when nothing is wrong", async () => {
        serve({
            ...PLACEMENT,
            missing: [],
            counts: { ...PLACEMENT.counts, notInBom: 0, dnpPlaced: 0, notPlaced: 0 },
        });
        await openViewer();
        await openPlacement();
        expect(screen.getByText("every part matches")).toBeInTheDocument();
    });
});

describe("placement source URLs", () => {
    it("addresses a build's and a folder's position data", () => {
        expect(SOURCE.placementUrl).toBe("/api/projects/p1/release-studio/builds/b1/placement");
        expect(outputsSource("p1", "manufacturing", "cpl", "a".repeat(40)).placementUrl).toBe(
            `/api/projects/p1/placement?type=manufacturing&folder=cpl&commit=${"a".repeat(40)}`,
        );
    });
});
