import type { FabricationLayer } from "./types";

export type ViewSide = "top" | "bottom";

/** The same presets, in the same order, as the Visualizer's layer menu. */
export type LayerPreset =
    | "front"
    | "back"
    | "copper"
    | "outer-copper"
    | "inner-copper"
    | "drawings"
    | "all"
    | "none";

export const LAYER_PRESETS: readonly (readonly [LayerPreset, string])[] = [
    ["front", "Front"],
    ["back", "Back"],
    ["copper", "All copper"],
    ["outer-copper", "Outer copper"],
    ["inner-copper", "Inner copper"],
    ["drawings", "Drawings"],
    ["all", "Show all"],
    ["none", "Hide all"],
];

export interface ViewerState {
    side: ViewSide;
    visible: ReadonlySet<string>;
    /** A layer picked in the list, drawn on its own so it can be read as it is. */
    highlighted: string | null;
    /** Reference of the part picked in the table or on the board. */
    selected: string | null;
    /** Part markers are drawn over the layers. */
    showParts: boolean;
}

export type ViewerAction =
    | { type: "side"; side: ViewSide; layers: FabricationLayer[] }
    | { type: "toggle"; id: string }
    | { type: "preset"; preset: LayerPreset; layers: FabricationLayer[] }
    | { type: "highlight"; id: string }
    | { type: "parts" }
    /** Pick a part; one on the other side turns the board over to it. */
    | { type: "select"; ref: string | null; side?: ViewSide; layers: FabricationLayer[] };

/**
 * What a reviewer wants first: the side's copper and legend, the board profile
 * and the holes. Mask and paste are openings, which read as noise until asked for.
 */
export function presetFor(layers: FabricationLayer[], side: ViewSide): Set<string> {
    const ids = new Set<string>();
    for (const layer of layers) {
        const onSide = layer.side === side;
        const wanted =
            ((layer.role === "copper" || layer.role === "silk") && onSide)
            || layer.role === "outline"
            || layer.role === "drill";
        if (wanted) ids.add(layer.id);
    }
    return ids;
}

/** The layers a menu preset shows. The profile and the holes stay with the side presets. */
export function applyPreset(layers: FabricationLayer[], preset: LayerPreset): Set<string> {
    const matching = (test: (layer: FabricationLayer) => boolean) => {
        const ids = new Set<string>();
        for (const layer of layers) {
            if (test(layer)) ids.add(layer.id);
        }
        return ids;
    };
    const board = (layer: FabricationLayer) => layer.role === "outline" || layer.role === "drill";
    switch (preset) {
        case "front":
            return matching((layer) => layer.side === "top" || board(layer));
        case "back":
            return matching((layer) => layer.side === "bottom" || board(layer));
        case "copper":
            return matching((layer) => layer.role === "copper");
        case "outer-copper":
            return matching((layer) => layer.role === "copper" && layer.side !== "inner");
        case "inner-copper":
            return matching((layer) => layer.role === "copper" && layer.side === "inner");
        case "drawings":
            return matching((layer) => layer.role === "other" || layer.role === "outline");
        case "all":
            return matching(() => true);
        default:
            return new Set();
    }
}

/** How far down into the board a layer sits, from the top silkscreen (0) to the bottom's (8). */
const DEPTH = { silk: 0, paste: 1, mask: 2, copper: 3 } as const;
/** Drawn after every board layer: annotation, then the profile, then the holes. */
const ANNOTATION_DEPTH = 50;
const PROFILE_DEPTH = 100;
const HOLES_DEPTH = 101;

function depthOf(layer: FabricationLayer): number {
    if (layer.role === "outline") return PROFILE_DEPTH;
    if (layer.role === "drill") return HOLES_DEPTH;
    if (layer.role === "other") return ANNOTATION_DEPTH;
    const level = DEPTH[layer.role];
    if (layer.side === "inner") return DEPTH.copper + 1;
    // The bottom side mirrors the top: its copper is nearest the core, its silkscreen outermost.
    return layer.side === "bottom" ? 8 - level : level;
}

/**
 * The layers in the order to paint them: farthest from the viewer first, so a nearer
 * layer covers a farther one the way it does on the board. From the top, the top
 * silkscreen is painted last; from the bottom, the bottom's is. Annotation, the
 * profile and the holes go over all of it. Every layer is fully opaque, so what is
 * on top is simply what you see.
 */
export function paintOrder(layers: FabricationLayer[], side: ViewSide): FabricationLayer[] {
    const rank = (layer: FabricationLayer) => {
        const depth = depthOf(layer);
        return depth >= ANNOTATION_DEPTH ? depth : side === "top" ? -depth : depth;
    };
    return [...layers].sort((a, b) => rank(a) - rank(b));
}

/** A layer picked in the list, drawn on its own with the profile around it. */
export function soloStack(layers: FabricationLayer[], picked: FabricationLayer): FabricationLayer[] {
    return [picked, ...layers.filter((layer) => layer.role === "outline" && layer.id !== picked.id)];
}

/** A package opened on one file: that layer, with the profile to place it. */
export function focusedOn(layers: FabricationLayer[], file: string): Set<string> {
    const target = layers.find((layer) => layer.file === file);
    if (!target) return new Set();
    const ids = new Set<string>([target.id]);
    for (const layer of layers) {
        if (layer.role === "outline") ids.add(layer.id);
    }
    return ids;
}

/** Bottom-only packages and single-file focus open on the side that has the layer. */
export function sideOf(layers: FabricationLayer[], file?: string): ViewSide {
    const target = file ? layers.find((layer) => layer.file === file) : undefined;
    if (target) return target.side === "bottom" ? "bottom" : "top";
    const hasTop = layers.some((layer) => layer.side === "top" && layer.role === "copper");
    const hasBottom = layers.some((layer) => layer.side === "bottom" && layer.role === "copper");
    return !hasTop && hasBottom ? "bottom" : "top";
}

export function initialState(layers: FabricationLayer[], focusFile?: string): ViewerState {
    const side = sideOf(layers, focusFile);
    const focus = focusFile ? focusedOn(layers, focusFile) : new Set<string>();
    return {
        side,
        visible: focus.size > 0 ? focus : presetFor(layers, side),
        highlighted: null,
        selected: null,
        showParts: true,
    };
}

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
}

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
    switch (action.type) {
        case "side":
            return action.side === state.side
                ? state
                : { ...state, side: action.side, visible: presetFor(action.layers, action.side) };
        case "parts":
            return { ...state, showParts: !state.showParts };
        case "select": {
            const turned = action.side && action.side !== state.side
                ? { side: action.side, visible: presetFor(action.layers, action.side) }
                : {};
            return { ...state, ...turned, selected: action.ref, showParts: true };
        }
        case "toggle":
            return { ...state, visible: toggled(state.visible, action.id) };
        case "highlight":
            return { ...state, highlighted: state.highlighted === action.id ? null : action.id };
        case "preset":
            return {
                ...state,
                // Front and Back are what you see from that side, so they turn the board to it.
                side: action.preset === "front" ? "top" : action.preset === "back" ? "bottom" : state.side,
                visible: applyPreset(action.layers, action.preset),
            };
        default:
            return state;
    }
}
