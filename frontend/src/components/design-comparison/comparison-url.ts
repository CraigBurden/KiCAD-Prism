export type ComparisonUrlTab = "sch" | "pcb" | "bom" | "stackup";
export type ComparisonPresentationMode =
    | "composite"
    | "side-by-side"
    | "old-new";

export type ComparisonUrlState = {
    base: string | null;
    compare: string | null;
    view: "semantic" | null;
    diff: ComparisonUrlTab;
    presentationMode: ComparisonPresentationMode;
    item: string | null;
    showSecondary: boolean;
    layers: string[];
};

const COMPARISON_KEYS = [
    "base",
    "compare",
    "view",
    "diff",
    "presentation",
    "item",
    "secondary",
    "layers",
] as const;

function parsePresentationMode(
    raw: string | null,
): ComparisonPresentationMode {
    if (raw === "side-by-side") return "side-by-side";
    if (raw === "old-new") return "old-new";
    return "composite";
}

export function readComparisonUrlState(
    search: string | URLSearchParams = window.location.search,
): ComparisonUrlState {
    const params =
        typeof search === "string" ? new URLSearchParams(search) : search;
    const rawTab = params.get("diff");
    const diff: ComparisonUrlTab =
        rawTab === "pcb" || rawTab === "bom" || rawTab === "stackup"
            ? rawTab
            : "sch";
    return {
        base: params.get("base"),
        compare: params.get("compare"),
        view: params.get("view") === "semantic" ? "semantic" : null,
        diff,
        presentationMode: parsePresentationMode(params.get("presentation")),
        item: params.get("item"),
        showSecondary: params.get("secondary") === "1",
        layers: (params.get("layers") ?? "").split(",").filter(Boolean),
    };
}

/** Apply open review params while preserving unrelated query keys (branch, etc.). */
export function applyOpenComparisonParams(
    params: URLSearchParams,
    input: {
        base: string;
        compare: string;
        diff?: ComparisonUrlTab;
        presentationMode?: ComparisonPresentationMode;
    },
): URLSearchParams {
    const next = new URLSearchParams(params);
    next.set("section", "history");
    next.set("base", input.base);
    next.set("compare", input.compare);
    next.set("view", "semantic");
    next.set("diff", input.diff ?? "sch");
    if (!input.presentationMode || input.presentationMode === "composite") {
        next.delete("presentation");
    } else {
        next.set("presentation", input.presentationMode);
    }
    return next;
}

/** Remove review deep-link params; keep section=history by default. */
export function clearComparisonParams(
    params: URLSearchParams,
    options: { keepSection?: boolean } = {},
): URLSearchParams {
    const next = new URLSearchParams(params);
    for (const key of COMPARISON_KEYS) next.delete(key);
    if (options.keepSection !== false) next.set("section", "history");
    return next;
}

/** Merge in-workspace navigation state into the current search params. */
export function applyWorkspaceComparisonParams(
    params: URLSearchParams,
    state: {
        base: string;
        compare: string;
        activeTab: ComparisonUrlTab;
        presentationMode: ComparisonPresentationMode;
        selectedChangeId: string | null;
        showSecondary: boolean;
        visibleLayers: string[];
    },
): URLSearchParams {
    const next = applyOpenComparisonParams(params, {
        base: state.base,
        compare: state.compare,
        diff: state.activeTab,
        presentationMode: state.presentationMode,
    });
    if (state.selectedChangeId) next.set("item", state.selectedChangeId);
    else next.delete("item");
    if (state.showSecondary) next.set("secondary", "1");
    else next.delete("secondary");
    if (state.visibleLayers.length) {
        next.set("layers", state.visibleLayers.join(","));
    } else {
        next.delete("layers");
    }
    return next;
}

export function comparisonIsOpen(state: ComparisonUrlState): boolean {
    return Boolean(state.base && state.compare);
}
