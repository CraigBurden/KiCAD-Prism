import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FabricationViewer } from "./fabrication-viewer";
import { buildSource, isLayerName, outputsSource } from "./sources";
import type { FabricationLayer, FabricationView } from "./types";

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

function layer(partial: Partial<FabricationLayer> & Pick<FabricationLayer, "id" | "role" | "side">): FabricationLayer {
    return {
        name: partial.id.toUpperCase(),
        function: "",
        colour: "#c83434",
        file: `${partial.id}.gbr`,
        kind: partial.role === "drill" ? "excellon" : "gerber",
        warnings: [],
        ...partial,
    };
}

const VIEW: FabricationView = {
    present: true,
    renderVersion: 2,
    bounds: [0, -10, 20, 0],
    board: [0, -10, 20, 0],
    size: { width: 20, height: 10 },
    copperLayers: 2,
    layers: [
        layer({ id: "f.silk", role: "silk", side: "top" }),
        layer({ id: "f.mask", role: "mask", side: "top" }),
        layer({ id: "f.cu", role: "copper", side: "top", function: "Copper,L1,Top" }),
        layer({ id: "b.cu", role: "copper", side: "bottom" }),
        layer({ id: "edge", role: "outline", side: "both" }),
        layer({ id: "drill", role: "drill", side: "both", file: "board.drl" }),
    ],
    drill: {
        tools: [
            { diameter: 0.3, plated: true, function: "Plated,PTH,ViaDrill", hits: 2, slots: 0, file: "board.drl" },
            { diameter: 3.2, plated: false, function: "NonPlated,NPTH,ComponentDrill", hits: 1, slots: 0, file: "board.drl" },
        ],
        holes: 3,
        slots: 0,
        smallest: 0.3,
    },
};

const SOURCE = buildSource("p1", "b1");

/** Layer ids the viewer has asked the API for, in order. */
function requestedLayers(): string[] {
    return apiMock.fetchApi.mock.calls.map(([url]) =>
        String(url).split("/layers/")[1].replace(/\.svg.*$/, ""),
    );
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
    // Most packages have no position file; the placement tests say otherwise.
    apiMock.fetchJson.mockImplementation(async (url: string) => {
        if (String(url).includes("/placement")) {
            throw new apiMock.ApiHttpError(404, "This build has no position file");
        }
        return VIEW;
    });
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

async function openViewer(focusFile?: string) {
    const view = render(<FabricationViewer source={SOURCE} focusFile={focusFile} />);
    await screen.findByText(/20\.0 × 10\.0 mm/);
    return view;
}

const hide = (name: string) => screen.queryByRole("button", { name: `Hide ${name}` });
const show = (name: string) => screen.queryByRole("button", { name: `Show ${name}` });
const boardSide = (name: "Top" | "Bottom") =>
    within(screen.getByRole("group", { name: "Board side" })).getByRole("button", { name });
const viewButton = (name: RegExp | string) =>
    within(screen.getByRole("group", { name: "Fabrication views" })).getByRole("button", { name });
const flipped = () => document.querySelector('[style*="scaleX(-1)"]');

describe("FabricationViewer", () => {
    it("summarises the package under the title, like the comparison does", async () => {
        await openViewer();
        expect(screen.getByText("Board", { selector: "p" })).toBeInTheDocument();
        expect(screen.getByText(/2 copper layers/)).toBeInTheDocument();
        expect(screen.getByText(/3 holes/)).toBeInTheDocument();
    });

    it("draws the default layers and leaves mask off", async () => {
        await openViewer();
        await waitFor(() => expect(requestedLayers().sort()).toEqual(["drill", "edge", "f.cu", "f.silk"]));
        expect(hide("F.CU")).toBeInTheDocument();
        expect(show("F.MASK")).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
    });

    it("lists the layers the way the Visualizer does: swatch, name, eye", async () => {
        await openViewer();
        const rail = screen.getByRole("complementary", { name: "Board display" });
        expect(within(rail).getByText("Board display")).toBeInTheDocument();
        expect(within(rail).getByRole("combobox", { name: "Layer preset" })).toBeInTheDocument();
        expect(within(rail).getByText("F.CU").previousElementSibling).toHaveStyle({ backgroundColor: "#c83434" });
    });

    it("fetches a layer the first time it is shown, and only then", async () => {
        await openViewer();
        await waitFor(() => expect(requestedLayers()).toHaveLength(4));

        fireEvent.click(show("F.MASK")!);
        await waitFor(() => expect(requestedLayers()).toHaveLength(5));
        expect(requestedLayers()).toContain("f.mask");

        fireEvent.click(hide("F.MASK")!);
        fireEvent.click(show("F.MASK")!);
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(5));
        expect(requestedLayers()).toHaveLength(5);
    });

    it("hides a layer without dropping the others", async () => {
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        fireEvent.click(hide("F.SILK")!);
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
        expect(screen.queryByAltText("F.SILK")).not.toBeInTheDocument();
    });

    it("picking a layer's name shows it on its own with the profile, names it, and lets go on a second click", async () => {
        const drawn = () => screen.getAllByRole("img").map((image) => (image as HTMLImageElement).alt);
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        fireEvent.click(screen.getByText("F.CU"));
        expect(drawn()).toEqual(["F.CU", "EDGE"]);
        // The title is the layer, its function under it, its file in the footer.
        expect(screen.getAllByText("F.CU").length).toBeGreaterThan(1);
        expect(screen.getByText("Copper,L1,Top")).toBeInTheDocument();
        expect(screen.getByText("f.cu.gbr")).toBeInTheDocument();

        fireEvent.click(screen.getAllByText("F.CU")[0]!);
        expect(drawn()).toEqual(["F.CU", "F.SILK", "EDGE", "DRILL"]);
    });

    it("a layer behind the board can still be read on its own", async () => {
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        fireEvent.click(screen.getByText("B.CU"));
        await waitFor(() => expect(screen.getAllByRole("img").map((image) => (image as HTMLImageElement).alt))
            .toEqual(["B.CU", "EDGE"]));
    });

    it("turns the board over: bottom layers, mirrored, labelled", async () => {
        await openViewer();
        expect(flipped()).not.toBeInTheDocument();
        expect(screen.getByText("Top", { selector: "span" })).toBeInTheDocument();

        fireEvent.click(boardSide("Bottom"));
        await waitFor(() => expect(requestedLayers()).toContain("b.cu"));
        expect(hide("B.CU")).toBeInTheDocument();
        expect(show("F.CU")).toBeInTheDocument();
        expect(flipped()).toBeInTheDocument();
        expect(boardSide("Bottom")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Bottom (mirrored)")).toBeInTheDocument();
    });

    it("asks for every layer at the backend's current rendering, so a stale cached drawing is never reused", async () => {
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        const urls = apiMock.fetchApi.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/layers/"));
        expect(urls.length).toBeGreaterThan(0);
        for (const url of urls) expect(url).toMatch(/\.svg\?r=2$/);
    });

    it("draws every layer fully opaque: no blending, no fading", async () => {
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        for (const image of screen.getAllByRole("img")) {
            expect(image.style.mixBlendMode).toBe("");
            expect(image.style.opacity).toBe("");
        }
        expect(document.querySelector(".isolate")).not.toBeInTheDocument();
    });

    it("draws the board on black, behind the layers", async () => {
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        expect(screen.getAllByRole("img")[0]!.closest(".cursor-grab")).toHaveClass("bg-black");
    });

    it("draws every layer that is on, opaque, in board order", async () => {
        const order = () => screen.getAllByRole("img").map((image) => (image as HTMLImageElement).alt);
        await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        fireEvent.click(show("B.CU")!);
        fireEvent.click(show("F.MASK")!);
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(6));
        // Farthest first, so the last one is on top. The profile and holes go over everything.
        expect(order()).toEqual(["B.CU", "F.CU", "F.MASK", "F.SILK", "EDGE", "DRILL"]);

        fireEvent.click(boardSide("Bottom"));
        await waitFor(() => expect(requestedLayers()).toContain("b.cu"));
        fireEvent.click(show("F.CU")!);
        fireEvent.click(show("F.MASK")!);
        fireEvent.click(show("F.SILK")!);
        await waitFor(() => expect(order()).toEqual(["F.SILK", "F.MASK", "F.CU", "B.CU", "EDGE", "DRILL"]));
    });

    it("keeps the rail narrow, and has no Parts & filters section to take room", async () => {
        await openViewer();
        const rail = screen.getByRole("complementary", { name: "Board display" });
        expect(rail).toHaveStyle({ width: "208px" });
        expect(screen.queryByRole("button", { name: "Parts & filters" })).not.toBeInTheDocument();
    });

    it("collapses the rail to its handle and brings it back", async () => {
        await openViewer();
        fireEvent.click(screen.getByRole("button", { name: "Collapse board display" }));
        expect(hide("F.CU")).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Layer preset" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Expand board display" }));
        expect(hide("F.CU")).toBeInTheDocument();
    });

    it("zooms from the toolbar and shows the zoom in the footer", async () => {
        await openViewer();
        expect(screen.getByText("100%")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
        expect(screen.getByText("140%")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Fit board" }));
        expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("opens on one file when asked to", async () => {
        await openViewer("f.mask.gbr");
        await waitFor(() => expect(requestedLayers().sort()).toEqual(["edge", "f.mask"]));
        expect(hide("F.MASK")).toBeInTheDocument();
        expect(show("F.CU")).toBeInTheDocument();
    });

    it("lists the drill tools in their own view", async () => {
        await openViewer();
        fireEvent.click(viewButton(/Drill/));
        const table = await screen.findByRole("table");
        expect(within(table).getByText("0.3 mm")).toBeInTheDocument();
        expect(within(table).getByText("Plated")).toBeInTheDocument();
        expect(within(table).getByText("Non-plated")).toBeInTheDocument();
        expect(within(table).getByText("Via")).toBeInTheDocument();
        expect(screen.getByText(/smallest 0\.3 mm/)).toBeInTheDocument();
        // The board's own controls belong to the board view.
        expect(screen.queryByRole("group", { name: "Board side" })).not.toBeInTheDocument();
    });

    it("says so when a layer cannot be loaded", async () => {
        apiMock.fetchApi.mockImplementation(async (url: string) =>
            String(url).includes("/f.cu.svg") ? { ok: false, status: 500 } : { ok: true, blob: async () => new Blob(["<svg/>"]) },
        );
        await openViewer();
        expect(await screen.findByRole("alert")).toHaveTextContent("Could not load F.CU");
    });

    it("shows the failure when the package cannot be loaded", async () => {
        apiMock.fetchJson.mockImplementation(async () => {
            throw new Error("This build has no fabrication files");
        });
        render(<FabricationViewer source={SOURCE} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("This build has no fabrication files");
    });

    it("revokes the layer URLs when it goes away", async () => {
        const { unmount } = await openViewer();
        await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
    });
});

describe("buildSource", () => {
    it("addresses a build's package and its layers", () => {
        expect(SOURCE.viewUrl).toBe("/api/projects/p1/release-studio/builds/b1/fabrication-view");
        expect(SOURCE.layerUrl("f.cu")).toBe(
            "/api/projects/p1/release-studio/builds/b1/fabrication-view/layers/f.cu.svg",
        );
    });
});

describe("outputsSource", () => {
    it("addresses a committed folder and its layers with the same query", () => {
        const source = outputsSource("p 1", "manufacturing", "gerbers/rev b", "a".repeat(40));
        const query = `type=manufacturing&folder=gerbers%2Frev+b&commit=${"a".repeat(40)}`;
        expect(source.viewUrl).toBe(`/api/projects/p%201/fabrication-view?${query}`);
        expect(source.layerUrl("f.cu")).toBe(`/api/projects/p%201/fabrication-view/layers/f.cu.svg?${query}`);
    });

    it("leaves the commit out for the working tree, and keys each target apart", () => {
        const working = outputsSource("p1", "design", "");
        expect(working.viewUrl).toBe("/api/projects/p1/fabrication-view?type=design&folder=");
        expect(working.key).not.toBe(outputsSource("p1", "design", "x").key);
        expect(working.key).not.toBe(outputsSource("p1", "design", "", "b".repeat(40)).key);
    });
});

describe("isLayerName", () => {
    it("knows KiCad's Gerber and drill extensions", () => {
        for (const name of ["a-F_Cu.gtl", "a-B_Cu.gbl", "a-Edge_Cuts.gm1", "a-In1_Cu.g1", "a.gbr", "a.drl", "A.GTO", "a.xln"]) {
            expect(isLayerName(name), name).toBe(true);
        }
    });

    it("leaves other files alone, including the job file and look-alikes", () => {
        for (const name of ["a-job.gbrjob", "logo.gif", "repo.git", "notes.pdf", "bom.csv", "gerber"]) {
            expect(isLayerName(name), name).toBe(false);
        }
    });
});
