/**
 * Types for the Design Comparison result returned by the backend
 * `design_compare_service`. Mirrors `backend/app/services/design_compare_service.py`
 * and `backend/app/services/bom_diff_service.py`.
 */

export type ChangeKind = "added" | "removed" | "changed";
export type ChangeDomain = "schematic" | "pcb";

/** Matches the shared category taxonomy in `@/lib/diff-grouping`. */
export type ChangeCategory =
    | "components"
    | "nets"
    | "board"
    | "zones"
    | "graphics"
    | "symbols"
    | "sheets"
    | "text"
    | "other";

export type FieldDiffValue =
    | { old?: string | number | null; new?: string | number | null }
    | string
    | number
    | null
    | undefined;

/** Compact UUID → world geometry sidecar entry, keyed by source item uuid. */
export interface GeometryEntry {
    kind:
        | "track"
        | "arc"
        | "via"
        | "zone"
        | "footprint"
        | "symbol"
        | "wire"
        | "label"
        | "junction"
        | "graphic";
    source_id?: string;
    semantic_id?: string;
    parent_source_id?: string;
    reference?: string;
    page?: string;
    x?: number;
    y?: number;
    rotation?: number;
    points?: Array<[number, number]>;
    width?: number;
    layer?: string;
    net?: string;
    radius?: number;
    bounds?: [number, number, number, number];
    lib_id?: string;
}

export interface NativeComparisonItem {
    source_id?: string | null;
    parent_source_id?: string | null;
    semantic_id?: string | null;
    page?: string | null;
    path?: string | null;
    layer?: string | null;
    reference?: string | null;
    net?: string | null;
}

export interface ChangeItem {
    id: string;
    kind: ChangeKind;
    domain: ChangeDomain;
    category: ChangeCategory | string;
    label: string;
    page?: string | null;
    alsoOnPages?: string[];
    uuid?: string;
    source_id_base?: string | null;
    source_id_compare?: string | null;
    semantic_id?: string | null;
    reference?: string | null;
    classification?: "primary" | "secondary";
    net?: string;
    layers?: string[];
    geometry?: GeometryEntry;
    oldGeometry?: GeometryEntry;
    fields?: Record<string, FieldDiffValue>;
    base_item?: NativeComparisonItem | null;
    compare_item?: NativeComparisonItem | null;
    reasons?: ChangeReason[];
    details?: ChangeDetails;
    affected_source_ids_base?: string[];
    affected_source_ids_compare?: string[];
    source_side?: "reference" | "comparison";
}

export type ChangeReason =
    | "object-added"
    | "object-removed"
    | "symbol-fields-changed"
    | "instance-replaced"
    | "instance-count-changed"
    | "sheet-changed"
    | "net-renamed"
    | "connectivity-changed"
    | "label-count-changed";

export interface ChangeDetails {
    fieldDeltas?: Record<string, FieldDiffValue>;
    connectivity?: {
        addedTerminals: string[];
        removedTerminals: string[];
    };
    instanceCount?: { old: number; new: number };
    netInstances?: { old: number; new: number };
    labelInstances?: { old: number; new: number };
    sheetChange?: { old?: string | null; new?: string | null };
    instanceReplacement?: { old: string[]; new: string[] };
    visualTargets?: Array<{
        side: "reference" | "comparison";
        status: "added" | "removed" | "modified";
        sourceId: string;
        parentSourceId?: string | null;
        /** Native .kicad_sch filename used to load the paint document. */
        page?: string | null;
        /** Human hierarchy retained separately from the native filename. */
        sheetPath?: string | null;
        role: "component" | "wire" | "label" | "junction" | "terminal";
        reference?: string;
        pin?: string;
    }>;
}

export interface SemanticChangeGroup {
    id: string;
    category: ChangeCategory | string;
    status: ChangeKind;
    classification: "primary" | "secondary";
    label: string;
    semantic_id?: string | null;
    members: string[];
    old_fields: Record<string, unknown>;
    new_fields: Record<string, unknown>;
    unresolved_thread_count: number;
    reasons?: ChangeReason[];
    details?: ChangeDetails;
}

export interface DiffSummary {
    added: number;
    removed: number;
    changed: number;
}

export interface SchematicDiff {
    pages: string[];
    changes: ChangeItem[];
    groups: SemanticChangeGroup[];
    summary: DiffSummary;
}

export interface PcbDiff {
    changes: ChangeItem[];
    groups: SemanticChangeGroup[];
    summary: DiffSummary;
    route_metrics?: {
        base: Record<string, RouteMetrics>;
        compare: Record<string, RouteMetrics>;
    };
}

export interface RouteMetrics {
    centerline_length_mm: number;
    via_count: number;
    used_layers: string[];
    via_barrel_length_mm: number | null;
    propagation_delay: null;
    diagnostics: string[];
}

export type BomRowStatus = "added" | "removed" | "changed" | "unchanged";

export interface BomChangeRow {
    ref: string;
    status: BomRowStatus;
    old?: Record<string, string>;
    new?: Record<string, string>;
    diffs?: Record<string, { old: string; new: string }>;
}

export interface BomDiff {
    summary: DiffSummary;
    changes: BomChangeRow[];
    fields: string[];
    include_unchanged?: boolean;
}

export interface StackupLayer {
    name: string;
    type: string;
    thickness?: number | null;
    ordinal?: number;
}

export interface StackupDiff {
    base: StackupLayer[];
    head: StackupLayer[];
    changed: boolean;
    present: boolean;
}

export interface SourceFileRef {
    filename: string;
    path: string;
}

export type KiCadChangeKind =
    | "added"
    | "removed"
    | "modified"
    | "collision"
    | "duplicate_uuid";

export interface KiCadItemChange {
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
    children: KiCadItemChange[];
}

export interface KiCadDocumentDiff {
    path: string;
    docType: string;
    changes: KiCadItemChange[];
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

export interface GeometrySnapshot {
    schematic: Record<string, GeometryEntry>;
    pcb: Record<string, GeometryEntry>;
}

export interface DesignCompareResult {
    schema?: "prism.semantic_comparison_v2" | string;
    base: string;
    head: string;
    compare?: string;
    diagnostics?: string[];
    schematic: SchematicDiff;
    pcb: PcbDiff;
    bom: BomDiff | null;
    stackup: StackupDiff;
    /** Legacy debug sidecar; current viewers consume document_diff and source files. */
    geometry?: {
        base: GeometrySnapshot;
        head: GeometrySnapshot;
    };
    files: {
        base: SourceFileRef[];
        head: SourceFileRef[];
    };
    document_diff: KiCadProjectDiffBundle;
}

export interface DesignCompareJobStatus {
    job_id: string;
    status: "running" | "completed" | "failed";
    message: string;
    percent: number;
    logs: string[];
    base?: string;
    head?: string;
}

export type ViewerSide = "base" | "head";
