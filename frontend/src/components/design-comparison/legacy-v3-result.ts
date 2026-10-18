/**
 * Reads a result of the backend's legacy path (`prism.semantic_comparison_v3`)
 * into the review document's shape, by the rules of
 * `native/contracts/prism/field-maps/design-compare.md`.
 *
 * Design Comparison defaults to `prism-kicad compare` since the C2r switch;
 * the legacy path runs only with `PRISM_DESIGN_SOURCE_DESIGN_COMPARISON=legacy`
 * until R1 deletes it, and this file with it.
 * Nothing else in this directory may read a v3 field.
 */

import {
    DESIGN_COMPARE_RESULT_SCHEMA,
    NM_PER_MM,
    type DesignCompareBom,
    type DesignCompareChange,
    type DesignCompareChangeDetails,
    type DesignCompareChangeSide,
    type DesignCompareFieldDelta,
    type DesignCompareReason,
    type DesignCompareRouteMetric,
    type DesignCompareStackupLayer,
    type DesignCompareStackupSettings,
    type DesignCompareSummary,
    type DesignCompareTarget,
    type DesignCompareTargetRole,
    type PointNm,
    type ReviewValue,
} from "./design-compare-result";
import type {
    DesignCompareReadiness,
    DesignCompareResult,
    FabricationDiff,
    KiCadProjectDiffBundle,
} from "./types";

export const LEGACY_RESULT_SCHEMA = "prism.semantic_comparison_v3";

type Mm = [number, number];

interface LegacyItem {
    source_id?: string | null;
    parent_source_id?: string | null;
    page?: string | null;
    layer?: string | null;
    layers?: string[] | null;
    reference?: string | null;
    net?: string | null;
}

interface LegacyVisualTarget {
    side?: "reference" | "comparison";
    sourceId?: string | null;
    kind?: string | null;
    role?: string | null;
    documentPath?: string | null;
    page?: string | null;
    parentSourceId?: string | null;
    sheetPath?: string | null;
    reference?: string | null;
    at?: Mm | null;
}

interface LegacyChange {
    id: string;
    kind: DesignCompareChange["kind"];
    domain: DesignCompareChange["domain"];
    category: DesignCompareChange["category"];
    classification?: DesignCompareChange["classification"];
    label?: string;
    page?: string | null;
    reference?: string | null;
    net?: string | null;
    semantic_id?: string | null;
    object_kind?: string | null;
    source_id_base?: string | null;
    source_id_compare?: string | null;
    base_item?: LegacyItem | null;
    compare_item?: LegacyItem | null;
    position_base?: Mm | null;
    position_compare?: Mm | null;
    reasons?: DesignCompareReason[];
    fields?: Record<string, unknown>;
    details?: {
        reviewOnly?: boolean;
        connectivity?: { addedTerminals?: string[]; removedTerminals?: string[] };
        instanceCount?: { old: number; new: number };
        labelInstances?: { old: number; new: number };
        sheetChange?: { old?: string | null; new?: string | null };
        visualTargets?: LegacyVisualTarget[];
    };
}

interface LegacyRouteMetric {
    centerline_length_mm: number;
    via_count: number;
    used_layers: string[];
    via_barrel_length_mm: number | null;
}

interface LegacyStackupLayer {
    name: string;
    type?: string | null;
    thickness?: number | null;
    material?: string | null;
    color?: string | null;
    epsilon_r?: number | null;
    loss_tangent?: number | null;
}

interface LegacySettings {
    copper_finish?: string | null;
    dielectric_constraints?: boolean | null;
}

export interface LegacyResult {
    schema?: string;
    schematic: { changes: LegacyChange[] };
    pcb: {
        changes: LegacyChange[];
        route_metrics?: {
            base?: Record<string, LegacyRouteMetric>;
            compare?: Record<string, LegacyRouteMetric>;
        };
    };
    bom?: {
        fields?: string[];
        changes?: DesignCompareBom["changes"];
        summary?: Partial<DesignCompareSummary>;
    } | null;
    stackup?: {
        present?: boolean;
        changed?: boolean;
        base?: LegacyStackupLayer[];
        head?: LegacyStackupLayer[];
        base_settings?: LegacySettings | null;
        head_settings?: LegacySettings | null;
    } | null;
    files?: { base?: DesignCompareResult["files"]["base"]; head?: DesignCompareResult["files"]["head"] };
    document_diff: KiCadProjectDiffBundle;
    fabrication?: FabricationDiff;
    readiness?: DesignCompareReadiness;
}

export function isLegacyResult(payload: { schema?: string }): boolean {
    return payload.schema === LEGACY_RESULT_SCHEMA
        || payload.schema === "prism.semantic_comparison_v2";
}

/** Millimetres to nanometres, rounded half up. */
function nm(mm: number): number {
    return Math.floor(mm * NM_PER_MM + 0.5);
}

function point(at: Mm | null | undefined): PointNm | undefined {
    return at ? { xNm: nm(at[0]), yNm: nm(at[1]) } : undefined;
}

function side(
    item: LegacyItem | null | undefined,
    at: Mm | null | undefined,
    change: LegacyChange,
): DesignCompareChangeSide | undefined {
    if (!item?.source_id) return undefined;
    const out: DesignCompareChangeSide = {
        sourceId: item.source_id,
        documentPath: item.page || change.page || "",
        layers: [...(item.layers ?? [])].sort(),
    };
    if (item.parent_source_id) out.parentSourceId = item.parent_source_id;
    if (item.layer) out.layer = item.layer;
    const position = point(at);
    if (position) out.at = position;
    if (item.reference) out.reference = item.reference;
    if (item.net) out.net = item.net;
    return out;
}

/**
 * A structure change (sheet instance, bus) carries source ids but no native
 * item; its visual target holds the page and position.
 */
function structureSide(
    change: LegacyChange,
    sourceId: string | null | undefined,
    pane: "reference" | "comparison",
): [LegacyItem, Mm | null | undefined] | undefined {
    if (!sourceId) return undefined;
    const target = change.details?.visualTargets?.find((entry) => entry.side === pane);
    return [
        {
            source_id: sourceId,
            page: target?.documentPath || change.page,
            parent_source_id: target?.parentSourceId,
        },
        target?.at,
    ];
}

const TARGET_ROLES: ReadonlySet<string> = new Set<DesignCompareTargetRole>([
    "component", "wire", "bus", "bus-entry", "label", "junction", "terminal",
    "sheet", "sheet-pin", "symbol", "no-connect", "graphic", "footprint", "pad",
    "track", "arc", "via", "zone", "footprint-graphic", "footprint-text",
    "image", "table", "group", "net-class", "net-class-assignment",
]);

/** v3 kinds and roles are spelled with `_`; board-objects spells them with `-`. */
const kindSpelling = (value: string) => value.replaceAll("_", "-");

/** Field map, "Targets": today's visual targets, entry for entry. */
function targets(legacy: LegacyVisualTarget[] | undefined): DesignCompareTarget[] {
    const out: DesignCompareTarget[] = [];
    for (const target of legacy ?? []) {
        if (!target.sourceId) continue;
        const entry: DesignCompareTarget = {
            side: target.side === "reference" ? "base" : "head",
            sourceId: target.sourceId,
        };
        if (target.kind) entry.kind = kindSpelling(target.kind);
        const role = kindSpelling(target.role ?? "");
        if (TARGET_ROLES.has(role)) entry.role = role as DesignCompareTargetRole;
        const documentPath = target.documentPath || target.page;
        if (documentPath) entry.documentPath = documentPath;
        const at = point(target.at);
        if (at) entry.at = at;
        if (target.sheetPath) entry.sheetPath = target.sheetPath;
        if (target.reference) entry.reference = target.reference;
        out.push(entry);
    }
    return out;
}

function fieldDelta(delta: unknown): DesignCompareFieldDelta {
    if (delta !== null && typeof delta === "object" && !Array.isArray(delta)) {
        const { old, new: next } = delta as { old?: unknown; new?: unknown };
        const out: DesignCompareFieldDelta = {};
        if (old !== null && old !== undefined) out.old = old as ReviewValue;
        if (next !== null && next !== undefined) out.new = next as ReviewValue;
        return out;
    }
    return delta === null || delta === undefined ? {} : { new: delta as ReviewValue };
}

function change(legacy: LegacyChange): DesignCompareChange {
    const out: DesignCompareChange = {
        id: legacy.id,
        domain: legacy.domain,
        kind: legacy.kind,
        category: legacy.category,
        classification: legacy.classification ?? "primary",
        label: legacy.label ?? "",
        reasons: legacy.reasons?.length
            ? legacy.reasons
            : [legacy.kind === "added" ? "object-added" : "object-removed"],
        fields: Object.fromEntries(
            Object.entries(legacy.fields ?? {}).map(([name, delta]) => [name, fieldDelta(delta)]),
        ),
        details: {},
    };
    if (legacy.object_kind) out.objectKind = kindSpelling(legacy.object_kind);
    if (legacy.reference) out.reference = legacy.reference;
    if (legacy.net) out.net = legacy.net;
    if (legacy.semantic_id) out.semanticId = legacy.semantic_id;
    if (legacy.page) out.page = legacy.page;

    const details = legacy.details ?? {};
    const outDetails: DesignCompareChangeDetails = out.details;
    if (details.reviewOnly) outDetails.reviewOnly = true;
    if (details.connectivity) {
        outDetails.connectivity = {
            addedTerminals: [...(details.connectivity.addedTerminals ?? [])].sort(),
            removedTerminals: [...(details.connectivity.removedTerminals ?? [])].sort(),
        };
    }
    if (details.instanceCount) outDetails.instanceCount = { ...details.instanceCount };
    if (details.labelInstances) outDetails.labelInstances = { ...details.labelInstances };
    if (details.sheetChange) {
        outDetails.sheetChange = {};
        if (details.sheetChange.old) outDetails.sheetChange.old = details.sheetChange.old;
        if (details.sheetChange.new) outDetails.sheetChange.new = details.sheetChange.new;
    }
    const found = targets(details.visualTargets);
    if (found.length) outDetails.targets = found;

    const [baseItem, baseAt] = legacy.base_item
        ? [legacy.base_item, legacy.position_base]
        : structureSide(legacy, legacy.source_id_base, "reference") ?? [undefined, undefined];
    const [headItem, headAt] = legacy.compare_item
        ? [legacy.compare_item, legacy.position_compare]
        : structureSide(legacy, legacy.source_id_compare, "comparison") ?? [undefined, undefined];
    const base = side(baseItem, baseAt, legacy);
    const head = side(headItem, headAt, legacy);
    if (base && legacy.kind !== "added") out.base = base;
    if (head && legacy.kind !== "removed") out.head = head;
    return out;
}

function summary(changes: DesignCompareChange[]): DesignCompareSummary {
    const count = (kind: DesignCompareChange["kind"]) =>
        changes.filter((entry) => entry.kind === kind).length;
    return { added: count("added"), removed: count("removed"), changed: count("changed") };
}

function stackupLayer(layer: LegacyStackupLayer): DesignCompareStackupLayer {
    const out: DesignCompareStackupLayer = { name: layer.name };
    if (layer.type) out.type = layer.type;
    if (layer.thickness) out.thicknessNm = nm(layer.thickness);
    if (layer.material) out.material = layer.material;
    if (layer.color) out.color = layer.color;
    if (layer.epsilon_r !== null && layer.epsilon_r !== undefined) out.epsilonR = layer.epsilon_r;
    if (layer.loss_tangent !== null && layer.loss_tangent !== undefined) {
        out.lossTangent = layer.loss_tangent;
    }
    return out;
}

function settings(value: LegacySettings | null | undefined): DesignCompareStackupSettings {
    const out: DesignCompareStackupSettings = {};
    if (value?.copper_finish) out.copperFinish = value.copper_finish;
    if (value?.dielectric_constraints !== null && value?.dielectric_constraints !== undefined) {
        out.dielectricConstraints = Boolean(value.dielectric_constraints);
    }
    return out;
}

function routeMetrics(
    metrics: Record<string, LegacyRouteMetric> | undefined,
): Record<string, DesignCompareRouteMetric> {
    return Object.fromEntries(
        Object.entries(metrics ?? {}).map(([net, metric]) => {
            const out: DesignCompareRouteMetric = {
                routeLengthNm: nm(metric.centerline_length_mm),
                viaCount: metric.via_count,
                usedLayers: [...metric.used_layers].sort(),
            };
            if (metric.via_barrel_length_mm !== null && metric.via_barrel_length_mm !== undefined) {
                out.viaBarrelLengthNm = nm(metric.via_barrel_length_mm);
            }
            return [net, out];
        }),
    );
}

const byId = (left: DesignCompareChange, right: DesignCompareChange) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

/**
 * The legacy result as the review document. Its revisions have no revision
 * key (the legacy path never computed one), so `base` and `head` carry empty
 * keys; nothing in the tabs reads them.
 */
export function readLegacyResult(
    legacy: LegacyResult,
    extras: Pick<DesignCompareResult, "sidecarUrls"> = {},
): DesignCompareResult {
    const schematic = legacy.schematic.changes.map(change).sort(byId);
    const pcb = legacy.pcb.changes.map(change).sort(byId);
    const bomSummary = legacy.bom?.summary ?? {};
    const bom: DesignCompareBom = {
        fields: [...(legacy.bom?.fields ?? [])],
        changes: [...(legacy.bom?.changes ?? [])].sort((left, right) =>
            left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0),
        summary: {
            added: bomSummary.added ?? 0,
            removed: bomSummary.removed ?? 0,
            changed: bomSummary.changed ?? 0,
        },
    };
    const stackup = legacy.stackup ?? {};
    const revision = { revisionKey: "", projectFile: "" };
    return {
        schema: DESIGN_COMPARE_RESULT_SCHEMA,
        base: revision,
        head: { ...revision },
        files: { base: legacy.files?.base ?? [], head: legacy.files?.head ?? [] },
        schematic: { changes: schematic },
        pcb: { changes: pcb },
        bom,
        stackup: {
            present: Boolean(stackup.present),
            changed: Boolean(stackup.changed),
            base: (stackup.base ?? []).map(stackupLayer),
            head: (stackup.head ?? []).map(stackupLayer),
            baseSettings: settings(stackup.base_settings),
            headSettings: settings(stackup.head_settings),
        },
        routeMetrics: {
            base: routeMetrics(legacy.pcb.route_metrics?.base),
            head: routeMetrics(legacy.pcb.route_metrics?.compare),
        },
        projectDiff: legacy.document_diff,
        counts: { schematic: summary(schematic), pcb: summary(pcb), bom: bom.summary },
        fabrication: legacy.fabrication,
        readiness: legacy.readiness,
        ...extras,
    };
}
