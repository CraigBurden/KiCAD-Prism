export type LayerRole = "silk" | "paste" | "mask" | "copper" | "outline" | "drill" | "other";
export type LayerSide = "top" | "bottom" | "inner" | "both";

export interface FabricationLayer {
    id: string;
    name: string;
    function: string;
    role: LayerRole;
    side: LayerSide;
    colour: string;
    file: string;
    kind: "gerber" | "excellon";
    warnings: string[];
}

export interface DrillTool {
    diameter: number;
    plated: boolean;
    function: string;
    hits: number;
    slots: number;
    file: string;
}

export interface FabricationView {
    present: boolean;
    /** How the backend draws layers; part of every layer URL so a new drawing is never served from cache. */
    renderVersion: number;
    /** Everything drawn, [minX, minY, maxX, maxY] in board millimetres. */
    bounds: [number, number, number, number] | null;
    /** The board profile, or the drawn extent when the package has none. */
    board: [number, number, number, number] | null;
    size: { width: number; height: number } | null;
    copperLayers: number;
    layers: FabricationLayer[];
    drill: {
        tools: DrillTool[];
        holes: number;
        slots: number;
        smallest: number | null;
    };
}

/**
 * Where a package's data comes from. The viewer knows nothing about Release
 * Studio or the Assets Portal; each supplies its own two URLs.
 */
export interface FabricationSource {
    /** Identity of the package. A new key is a new viewer. */
    key: string;
    viewUrl: string;
    layerUrl: (layerId: string) => string;
    /** Pick-and-place parts. Without it the viewer has no Placement tab. */
    placementUrl?: string;
}

export type PartStatus = "ok" | "not-in-bom" | "dnp-placed" | "no-bom" | "not-placed";

export interface PlacementPart {
    ref: string;
    value: string;
    package: string;
    /** Board millimetres, Y down, like the layers. */
    x: number;
    y: number;
    /** Degrees counter-clockwise, as the position file states it. */
    rotation: number;
    side: "top" | "bottom";
    status: PartStatus;
}

/** In the BOM and meant to be placed, but absent from the position file. */
export interface MissingPart {
    ref: string;
    value: string;
    package: string;
    status: "not-placed";
}

export interface PlacementView {
    present: boolean;
    parts: PlacementPart[];
    missing: MissingPart[];
    counts: {
        placed: number;
        top: number;
        bottom: number;
        notInBom: number;
        dnpPlaced: number;
        notPlaced: number;
    };
    hasBom: boolean;
    files: { positions: string; bom: string };
    warnings: string[];
}
