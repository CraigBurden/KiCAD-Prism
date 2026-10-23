/**
 * `prism.design_compare.result.a1`: the review document `prism-kicad compare`
 * writes (`native/src/tsp/prism/design-compare-a1.tsp`, field map
 * `native/contracts/prism/field-maps/design-compare.md`).
 *
 * Written by hand to mirror the contract; `design-compare-result.test.ts`
 * types the contract's example against it. Change the contract first, then
 * this file. Lengths and coordinates are integer nanometres.
 */

import type { ChangeItem, KiCadProjectDiffBundle } from "./types";

export const DESIGN_COMPARE_RESULT_SCHEMA = "prism.design_compare.result.a1";

export type DesignCompareChangeKind = "added" | "removed" | "changed";
export type DesignCompareChangeDomain = "schematic" | "pcb";

/** Matches the shared category taxonomy in `@/lib/diff-grouping`. */
export type DesignCompareCategory =
    | "rules"
    | "components"
    | "nets"
    | "board"
    | "zones"
    | "graphics"
    | "symbols"
    | "sheets"
    | "text"
    | "other";

export type DesignCompareClassification = "primary" | "secondary";

export type DesignCompareReason =
    | "object-added"
    | "object-removed"
    | "symbol-fields-changed"
    | "instance-replaced"
    | "instance-count-changed"
    | "sheet-changed"
    | "net-renamed"
    | "connectivity-changed"
    | "label-count-changed"
    | "bus-membership-changed"
    | "moved"
    | "rotated"
    | "mirrored"
    | "layer-changed"
    | "net-changed"
    | "renamed"
    | "lib-changed"
    | "dnp-changed"
    | "re-pathed"
    | "properties-changed"
    | "content-changed";

/** A point in nanometres, +x right, +y down. */
export interface PointNm {
    xNm: number;
    yNm: number;
}

export type ReviewScalar = string | number | boolean;

/** A review field's value: a text, number, flag, list or settings table. */
export type ReviewValue =
    | string
    | number
    | boolean
    | string[]
    | number[]
    | Record<string, ReviewScalar>;

export interface DesignCompareRevision {
    revisionKey: string;
    /** Absent for a side compared from its source tree. */
    bundleKey?: string;
    projectFile: string;
}

export interface DesignCompareSourceFile {
    path: string;
    filename: string;
}

export interface DesignCompareFiles {
    base: DesignCompareSourceFile[];
    head: DesignCompareSourceFile[];
}

/** One field's two values; a side without a value omits it. */
export interface DesignCompareFieldDelta {
    old?: ReviewValue;
    new?: ReviewValue;
}

export interface DesignCompareCountDelta {
    old: number;
    new: number;
}

export interface DesignCompareChangeDetails {
    /** Structured review evidence with no independently paintable KiCad item. */
    reviewOnly?: true;
    connectivity?: {
        addedTerminals: string[];
        removedTerminals: string[];
    };
    instanceCount?: DesignCompareCountDelta;
    labelInstances?: DesignCompareCountDelta;
    sheetChange?: { old?: string; new?: string };
    /**
     * The objects ecad-viewer highlights for the change, base side first.
     * Absent when there are none, as for a review-only change.
     */
    targets?: DesignCompareTarget[];
}

export type DesignCompareSide = "base" | "head";

/** How a target is drawn: its own kind, or its part in the change. */
export type DesignCompareTargetRole =
    | "component"
    | "wire"
    | "bus"
    | "bus-entry"
    | "label"
    | "junction"
    | "terminal"
    | "sheet"
    | "sheet-pin"
    | "symbol"
    | "no-connect"
    | "graphic"
    | "footprint"
    | "pad"
    | "track"
    | "arc"
    | "via"
    | "zone"
    | "footprint-graphic"
    | "footprint-text"
    | "image"
    | "table"
    | "group"
    | "net-class"
    | "net-class-assignment";

/** One object ecad-viewer highlights for a change. */
export interface DesignCompareTarget {
    side: DesignCompareSide;
    sourceId: string;
    /** The board-objects kind (`pin`, `sheet-pin`). */
    kind?: string;
    /** Absent when the target has no role beyond its kind. */
    role?: DesignCompareTargetRole;
    documentPath?: string;
    at?: PointNm;
    /** The sheet instance path of a schematic object. */
    sheetPath?: string;
    reference?: string;
}

/** The changed object as one revision has it. */
export interface DesignCompareChangeSide {
    sourceId: string;
    parentSourceId?: string;
    documentPath: string;
    layer?: string;
    /**
     * Every layer this revision's object occupies, sorted. A track names one
     * layer; a via names its span. Kept per revision so a focused routing
     * review can show each pane only the copper that revision carries.
     */
    layers: string[];
    at?: PointNm;
    reference?: string;
    net?: string;
}

export interface DesignCompareChange {
    /** The key of `projectDiff.navigation`. */
    id: string;
    domain: DesignCompareChangeDomain;
    kind: DesignCompareChangeKind;
    category: DesignCompareCategory;
    classification: DesignCompareClassification;
    label: string;
    /** The board-objects kind (`sheet-pin`, `board-constraint`); absent for a net-level change. */
    objectKind?: string;
    reference?: string;
    net?: string;
    semanticId?: string;
    page?: string;
    /** Never empty. */
    reasons: DesignCompareReason[];
    /** Keyed by field display name. */
    fields: Record<string, DesignCompareFieldDelta>;
    details: DesignCompareChangeDetails;
    /** Absent for an added object. */
    base?: DesignCompareChangeSide;
    /** Absent for a removed object. */
    head?: DesignCompareChangeSide;
}

export interface DesignCompareSummary {
    added: number;
    removed: number;
    changed: number;
}

export type DesignCompareBomStatus = "added" | "removed" | "changed" | "unchanged";

export interface DesignCompareBomRow {
    ref: string;
    status: DesignCompareBomStatus;
    old?: Record<string, string>;
    new?: Record<string, string>;
    diffs?: Record<string, { old: string; new: string }>;
}

export interface DesignCompareBom {
    fields: string[];
    changes: DesignCompareBomRow[];
    summary: DesignCompareSummary;
}

export interface DesignCompareStackupLayer {
    name: string;
    type?: string;
    thicknessNm?: number;
    material?: string;
    color?: string;
    epsilonR?: number;
    lossTangent?: number;
}

export interface DesignCompareStackupSettings {
    copperFinish?: string;
    dielectricConstraints?: boolean;
}

export interface DesignCompareStackup {
    present: boolean;
    changed: boolean;
    base: DesignCompareStackupLayer[];
    head: DesignCompareStackupLayer[];
    baseSettings: DesignCompareStackupSettings;
    headSettings: DesignCompareStackupSettings;
}

export interface DesignCompareRouteMetric {
    routeLengthNm: number;
    viaCount: number;
    usedLayers: string[];
    /** Absent when the barrel length is unreliable. */
    viaBarrelLengthNm?: number;
}

export interface DesignCompareRouteMetrics {
    /** Keyed by net name. */
    base: Record<string, DesignCompareRouteMetric>;
    head: Record<string, DesignCompareRouteMetric>;
}

export interface DesignCompareCounts {
    schematic: DesignCompareSummary;
    pcb: DesignCompareSummary;
    bom: DesignCompareSummary;
}

export interface DesignCompareResultA1 {
    schema: typeof DESIGN_COMPARE_RESULT_SCHEMA;
    base: DesignCompareRevision;
    head: DesignCompareRevision;
    files: DesignCompareFiles;
    /** `ChangeItem` is `DesignCompareChange` plus what the frontend derives. */
    schematic: { changes: ChangeItem[] };
    pcb: { changes: ChangeItem[] };
    bom: DesignCompareBom;
    stackup: DesignCompareStackup;
    routeMetrics: DesignCompareRouteMetrics;
    /** ecad-viewer's input, unchanged (mirror contract `kicad-project-diff-v1.tsp`). */
    projectDiff: KiCadProjectDiffBundle;
    counts: DesignCompareCounts;
}

export const NM_PER_MM = 1_000_000;

/** A nanometre point as KiCad board or page millimetres. */
export function pointMm(point: PointNm): [number, number] {
    return [point.xNm / NM_PER_MM, point.yNm / NM_PER_MM];
}
