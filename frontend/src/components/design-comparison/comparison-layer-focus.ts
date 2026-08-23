import type { ChangeItem } from "./types";

/**
 * Layer focus for one selected PCB review item.
 *
 * Selecting copper isolates the copper it is on: a net shows every layer it is
 * routed across, a part shows the side it is mounted on, and the rest of the
 * board is hidden. Without that, a change on B.Cu is read through the F.Cu
 * artwork stacked on top of it, which is the opposite of evidence.
 *
 * Each revision carries its own copper, so the reference and comparison layer
 * sets are derived independently: a pane must never infer its layers from the
 * other revision's objects, or a re-layered route -- or a part moved to the
 * other side of the board -- reads as if it were always on both.
 */
export type ComparisonLayerFocus = {
    net: string | null;
    /** Copper layers the reference (base) revision routes this net on. */
    reference: string[];
    /** Copper layers the comparison (head) revision routes this net on. */
    comparison: string[];
    /**
     * True when the selection contains no track, arc or part. Only then do via
     * span endpoints define the focus; a via must not expose untouched
     * intermediate copper just because its barrel passes through.
     */
    viaOnly: boolean;
};

export type LayerFocusSide = "reference" | "comparison" | "both";

/**
 * Mechanical context kept visible under a focus. Copper alone leaves the
 * reviewer with no board frame to place the evidence against, and the outline
 * carries no copper evidence of its own.
 */
export const LAYER_FOCUS_CONTEXT_LAYERS = ["Edge.Cuts"];

const ROUTING_KINDS = new Set([
    "track",
    "segment",
    "arc",
    "arc_segment",
    "via",
]);

/**
 * Parts sit on one side of the board, and a pad is where a part meets copper.
 * Both name the side they are on, so both can be isolated the same way a route
 * is -- which is the point: reviewing a change to a part on B.Cu means seeing
 * B.Cu, not the front artwork drawn over it.
 */
const COMPONENT_KINDS = new Set(["footprint", "pad"]);

const VIA_KINDS = new Set(["via"]);

function nativeKind(change: ChangeItem): string {
    return String(
        change.object_kind
        ?? change.geometry?.kind
        ?? change.oldGeometry?.kind
        ?? "",
    ).toLocaleLowerCase();
}

function isCopperLayer(layer: string): boolean {
    return layer.toLocaleLowerCase().endsWith(".cu");
}

function sideLayers(change: ChangeItem, side: "reference" | "comparison"): string[] {
    const item = side === "reference" ? change.base_item : change.compare_item;
    const geometry = side === "reference" ? change.oldGeometry : change.geometry;
    const candidates = [
        ...(item?.layers ?? []),
        item?.layer,
        geometry?.layer,
    ];
    return [...new Set(candidates.filter((layer): layer is string => Boolean(layer)))]
        .filter(isCopperLayer);
}

/**
 * Derive the focused copper layers for a selection, or null when the selection
 * holds anything that is not copper. Silkscreen, courtyard and fabrication
 * items are excluded on purpose: hiding layers is only defensible when every
 * selected object is copper the reviewer is trying to isolate, and a rule
 * change has no layer at all.
 */
export function layerFocusForChanges(
    changes: ChangeItem[],
): ComparisonLayerFocus | null {
    if (!changes.length) return null;
    if (!changes.every((change) => {
        const kind = nativeKind(change);
        return change.domain === "pcb"
            && (ROUTING_KINDS.has(kind) || COMPONENT_KINDS.has(kind));
    })) {
        return null;
    }

    const viaOnly = changes.every((change) => VIA_KINDS.has(nativeKind(change)));
    // Tracks, arcs and parts define the focus. Vias only contribute when
    // nothing else in the selection does, so a via drop on a two-layer board
    // does not light up every inner layer its barrel crosses.
    const contributing = viaOnly
        ? changes
        : changes.filter((change) => !VIA_KINDS.has(nativeKind(change)));

    const reference = new Set<string>();
    const comparison = new Set<string>();
    for (const change of contributing) {
        for (const layer of sideLayers(change, "reference")) reference.add(layer);
        for (const layer of sideLayers(change, "comparison")) comparison.add(layer);
    }
    if (!reference.size && !comparison.size) return null;

    // A wholly added or removed route -- or part -- leaves one revision with no
    // copper of its own. That pane still has to prove the absence somewhere, so
    // it borrows the layer context of the revision that does carry it.
    const resolved = {
        reference: [...(reference.size ? reference : comparison)].sort(),
        comparison: [...(comparison.size ? comparison : reference)].sort(),
    };

    const net = changes.find((change) => change.net?.trim())?.net?.trim() ?? null;
    return { net, viaOnly, ...resolved };
}

/**
 * Expand KiCad's layer wildcards against the layers a board actually has.
 *
 * A through-hole pad does not sit on a side, so KiCad does not name one: its
 * layer is `*.Cu`, meaning every copper layer, and `F&B.Cu` means the two
 * outer ones. Those are patterns, not layers. A viewer asked to show `*.Cu`
 * matches nothing, which is why selecting a through-hole part used to leave
 * the board showing its outline and nothing else.
 *
 * Anything already naming a real layer passes through, so a caller can hand
 * this a mix of patterns and names -- restoring a reviewer's saved layers goes
 * through the same path.
 */
export function resolveLayerPatterns(
    patterns: readonly string[],
    boardLayers: readonly string[],
): string[] {
    const resolved = new Set<string>();
    for (const pattern of patterns) {
        if (!pattern.includes("*") && !pattern.includes("&")) {
            resolved.add(pattern);
            continue;
        }
        const [prefix, suffix] = splitPattern(pattern);
        for (const layer of boardLayers) {
            if (!layer.toLocaleLowerCase().endsWith(suffix)) continue;
            // `F&B.Cu` is the two outer layers, not every layer of that type.
            if (prefix && !prefix.includes(outerSideOf(layer))) continue;
            resolved.add(layer);
        }
    }
    return [...resolved];
}

/** `*.Cu` -> ["", ".cu"]; `F&B.Cu` -> ["f&b", ".cu"]. */
function splitPattern(pattern: string): [string, string] {
    const dot = pattern.lastIndexOf(".");
    if (dot < 0) return ["", pattern.toLocaleLowerCase()];
    const head = pattern.slice(0, dot).toLocaleLowerCase();
    return [head === "*" ? "" : head, pattern.slice(dot).toLocaleLowerCase()];
}

/** "f" for a front layer, "b" for a back one, "" for anything inner. */
function outerSideOf(layer: string): string {
    const lower = layer.toLocaleLowerCase();
    if (lower.startsWith("f.")) return "f";
    if (lower.startsWith("b.")) return "b";
    return "\u0000";
}

/**
 * Layers a pane should show while the focus is active. Everything else on the
 * board is hidden: the focus owns visibility for as long as the selection
 * stands.
 */
export function focusVisibleLayers(
    focus: ComparisonLayerFocus,
    side: LayerFocusSide,
): string[] {
    const copper = side === "both"
        ? [...new Set([...focus.reference, ...focus.comparison])].sort()
        : focus[side];
    return [...copper, ...LAYER_FOCUS_CONTEXT_LAYERS];
}
