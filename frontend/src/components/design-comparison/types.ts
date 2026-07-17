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
    kind: "track" | "via" | "footprint" | "symbol" | "wire";
    page?: string;
    x?: number;
    y?: number;
    points?: Array<[number, number]>;
    width?: number;
    layer?: string;
    net?: string;
    radius?: number;
    bounds?: [number, number, number, number];
    lib_id?: string;
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
    net?: string;
    layers?: string[];
    geometry?: GeometryEntry;
    oldGeometry?: GeometryEntry;
    fields?: Record<string, FieldDiffValue>;
}

export interface DiffSummary {
    added: number;
    removed: number;
    changed: number;
}

export interface SchematicDiff {
    pages: string[];
    changes: ChangeItem[];
    summary: DiffSummary;
}

export interface PcbDiff {
    changes: ChangeItem[];
    summary: DiffSummary;
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

export interface GeometrySnapshot {
    schematic: Record<string, GeometryEntry>;
    pcb: Record<string, GeometryEntry>;
}

export interface DesignCompareResult {
    base: string;
    head: string;
    schematic: SchematicDiff;
    pcb: PcbDiff;
    bom: BomDiff | null;
    stackup: StackupDiff;
    geometry: {
        base: GeometrySnapshot;
        head: GeometrySnapshot;
    };
    files: {
        base: SourceFileRef[];
        head: SourceFileRef[];
    };
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
