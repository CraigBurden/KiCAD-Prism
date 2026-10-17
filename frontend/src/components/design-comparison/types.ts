/**
 * Types for Design Comparison's frontend. The result's own types are the
 * review contract's, in `design-compare-result.ts`; this file names them in
 * the frontend's vocabulary and adds what the backend's job artifact carries
 * beside the result: fabrication, readiness and sidecar URLs.
 */

import type {
    DesignCompareBom,
    DesignCompareBomRow,
    DesignCompareBomStatus,
    DesignCompareCategory,
    DesignCompareChange,
    DesignCompareChangeDetails,
    DesignCompareChangeDomain,
    DesignCompareChangeKind,
    DesignCompareCounts,
    DesignCompareFieldDelta,
    DesignCompareReason,
    DesignCompareResultA1,
    DesignCompareRevision,
    DesignCompareRouteMetric,
    DesignCompareSourceFile,
    DesignCompareStackup,
    DesignCompareStackupLayer,
    DesignCompareStackupSettings,
    DesignCompareSummary,
} from "./design-compare-result";

export type ChangeKind = DesignCompareChangeKind;
export type ChangeDomain = DesignCompareChangeDomain;
export type ChangeCategory = DesignCompareCategory;
export type ChangeReason = DesignCompareReason;
/**
 * A change as the tabs hold it: the review document's, plus `derivedFrom`,
 * which the frontend sets (`comparison-review-noise.ts`; C2r Q2) when this
 * change only records another domain's authored edit being propagated into
 * this file. KiCad rewrites every copper object's net reference after one
 * schematic net rename; those rewrites are evidence of the rename, not
 * separate design decisions.
 */
export interface ChangeItem extends DesignCompareChange {
    derivedFrom?: { kind: "net-rename"; old: string; new: string };
}
export type ChangeDetails = DesignCompareChangeDetails;
export type FieldDelta = DesignCompareFieldDelta;
export type DiffSummary = DesignCompareSummary;
export type RouteMetrics = DesignCompareRouteMetric;
export type BomRowStatus = DesignCompareBomStatus;
export type BomChangeRow = DesignCompareBomRow;
export type BomDiff = DesignCompareBom;
export type StackupLayer = DesignCompareStackupLayer;
export type StackupSettings = DesignCompareStackupSettings;
export type StackupDiff = DesignCompareStackup;
export type SourceFileRef = DesignCompareSourceFile;

export type KiCadChangeKind =
    | "added"
    | "removed"
    | "modified"
    | "collision"
    | "duplicate_uuid";

/** Strict item shape produced by native KiCad PROJECT_DIFF. */
export interface NativeKiCadItemChange {
    id: string;
    typeName: string;
    kind: KiCadChangeKind;
    properties: Array<{
        name: string;
        before: { type: string; v?: unknown; label?: string };
        after: { type: string; v?: unknown; label?: string };
    }>;
    bbox: [number, number, number, number];
    refdes?: string;
    sourceSide?: "reference" | "comparison";
    retainReference?: boolean;
    children: NativeKiCadItemChange[];
}

/**
 * Prism supplies native identity and lets ecad-viewer measure geometry from
 * the parsed scene. Transitional callers may still include a bbox.
 */
export interface PrismItemChangeInput
    extends Omit<NativeKiCadItemChange, "bbox" | "children"> {
    bbox?: [number, number, number, number];
    children: PrismItemChangeInput[];
}

export interface KiCadDocumentDiff {
    path: string;
    docType: string;
    changes: PrismItemChangeInput[];
}

export interface KiCadProjectDiffBundle {
    schema: "prism.kicad_project_diff_v1" | string;
    provider: "prism-semantic" | "kicad-cli" | string;
    project: { documents: KiCadDocumentDiff[] };
    navigation: Record<
        string,
        {
            documentPath: string;
            changeId: string;
            changeIds?: string[];
            documents?: Array<{
                documentPath: string;
                changeId: string;
                changeIds: string[];
            }>;
        }
    >;
    diagnostics: Array<{ changeId: string; reason: string }>;
}

/**
 * One plotted layer of the fabrication package, compared between revisions.
 * The regions are in KiCad board millimetres so they cross-probe against the
 * same coordinate space as every other visual target.
 */
export interface FabricationRegion {
    index: number;
    kind: "added" | "removed" | "changed";
    /** Bottom-left corner of the marker. */
    x: number;
    y: number;
    width: number;
    height: number;
    addedOps: number;
    removedOps: number;
}

export interface FabricationLayerDiff {
    /** Gerber X2 file function, e.g. `Copper,L1,Top`. */
    function: string;
    /** KiCad layer name, e.g. `F.Cu`. */
    name: string;
    file: { base: string | null; compare: string | null };
    status: "changed" | "unchanged" | "added" | "removed" | "unreadable";
    regions: FabricationRegion[];
    warnings: string[];
    /**
     * Sidecar names for this layer's artwork, drawn from the same operations
     * the comparison comes from. Resolve through `sidecarUrls`.
     */
    render?: { base?: string; compare?: string };
}

export interface FabricationDiff {
    present: boolean;
    summary: {
        layers: number;
        changedLayers: number;
        regions: number;
        addedRegions?: number;
        removedRegions?: number;
        changedRegions?: number;
    };
    /**
     * Board profile in KiCad board millimetres, used to frame the difference
     * markers.
     */
    outline?: {
        segments: number[][][];
        bounds: [number, number, number, number];
    } | null;
    layers: FabricationLayerDiff[];
    warnings: string[];
    /**
     * Rectangle every layer render is drawn in, in KiCad board millimetres.
     * The difference markers use the same space, so they overlay the artwork
     * without a second coordinate system.
     */
    bounds: [number, number, number, number] | null;
    /**
     * The board profile, which is what the view fits to. Fabrication and
     * courtyard layers carry annotation well outside it, and fitting to the
     * drawn extent instead leaves the board adrift in the middle of the pane.
     */
    board: [number, number, number, number] | null;
}

/**
 * What the tabs read: the review document, plus what the job artifact adds
 * beside it. A result from the backend's legacy path
 * (`prism.semantic_comparison_v3`) is read into the same shape by
 * `legacy-v3-result.ts` until R1 removes that path.
 */
export interface DesignCompareResult extends DesignCompareResultA1 {
    /** Absent until the fabrication domain is ready. */
    fabrication?: FabricationDiff;
    readiness?: DesignCompareReadiness;
    /** Sidecar name → URL, for payloads that reference artifacts by name. */
    sidecarUrls?: Record<string, string>;
}

export interface SidecarDescriptor {
    digest: string;
    sizeBytes: number;
    mediaType: string;
    url: string;
}

/** The legacy path's job artifact: a manifest of v3 sidecars. */
export interface DesignCompareBundle {
    schema: "prism.design_compare_bundle_v1";
    resultSchema?: string;
    base: string;
    head: string;
    compare?: string;
    readiness?: DesignCompareReadiness;
    domains: Record<
        DesignCompareDomain,
        {
            summary?: { added: number; removed: number; changed: number } | null;
            changeCount: number;
        }
    >;
    /**
     * Named immutable artifacts. Beyond the fixed domain payloads this also
     * carries per-layer fabrication artwork under `fab:<layer>:<side>`, so the
     * count is open-ended.
     */
    sidecars: Record<string, SidecarDescriptor>;
}

/**
 * The bundle path's job artifact: one sidecar per tab of the review document
 * (named by its key), `core`, `fabrication` and the layer renders.
 */
export interface DesignCompareBundleV2 {
    schema: "prism.design_compare_bundle_v2";
    resultSchema: DesignCompareResultA1["schema"];
    /** Commits. */
    base: string;
    head: string;
    revisions: { base: DesignCompareRevision; head: DesignCompareRevision };
    readiness?: DesignCompareReadiness;
    counts: DesignCompareCounts;
    modes: { base: "bundle" | "source-tree"; head: "bundle" | "source-tree" };
    sidecars: Record<string, SidecarDescriptor>;
}

export type DesignCompareDomain =
    | "schematic"
    | "bom"
    | "pcb"
    | "stackup"
    | "fabrication";
export type DesignCompareDomainStatus = "pending" | "building" | "ready" | "failed";

export interface DesignCompareReadiness {
    stage: "building-initial" | "initial-ready" | "complete" | string;
    domains: Record<DesignCompareDomain, DesignCompareDomainStatus>;
}

export type ViewerSide = "base" | "head";
