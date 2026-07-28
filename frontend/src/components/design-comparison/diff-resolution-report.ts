import type {
    EcadDiffResolutionDiagnostic,
    EcadDiffResolutionReason,
    EcadDocumentComparisonPreparation,
} from "../../types/ecad-viewer";

/**
 * Phase 0B measurement.
 *
 * The backend fills every `KiCadItemChange.bbox` with a constant box -- 5.08 mm
 * for any symbol, 10 mm for any footprint -- under a comment saying it is used
 * "only if native UUID focus is unavailable". Nothing has ever measured how
 * often that is. The viewer replaces those bounds with the bounds the scene
 * actually painted, and now reports how often it could not.
 *
 * `fallbackBoundsRate` is the answer: the share of selection targets still
 * focusing a Prism-supplied box. Near zero means the backend can stop emitting
 * bounds; materially above zero means identity resolution needs fixing first.
 */
export type DiffResolutionReport = {
    documentPath: string;
    context: "SCH" | "PCB";
    sourceCacheHit: boolean;
    prepareMs: number;
    changes: number;
    sourceResolved: number;
    targets: number;
    targetsWithPaintedBounds: number;
    targetsUsingProvidedBounds: number;
    /** 0–1, rounded to four places. Null when the viewer prepared no targets. */
    fallbackBoundsRate: number | null;
    ambiguousSourceIds: number;
    duplicateChangeTargets: number;
    diagnosticsByReason: Partial<Record<EcadDiffResolutionReason, number>>;
    /** Object kinds that failed to resolve, worst first, capped at eight. */
    failuresByTypeName: Array<{ typeName: string; count: number }>;
    /** True when the bundle predates resolution reporting. */
    unreported: boolean;
};

const FAILURE_REASONS = new Set<EcadDiffResolutionReason>([
    "missing-source-id",
    "item-not-found",
    "paint-bounds-not-found",
]);

function countByReason(
    diagnostics: readonly EcadDiffResolutionDiagnostic[],
): Partial<Record<EcadDiffResolutionReason, number>> {
    const counts: Partial<Record<EcadDiffResolutionReason, number>> = {};
    for (const entry of diagnostics) {
        counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
    }
    return counts;
}

function failuresByTypeName(
    diagnostics: readonly EcadDiffResolutionDiagnostic[],
): Array<{ typeName: string; count: number }> {
    const counts = new Map<string, number>();
    for (const entry of diagnostics) {
        if (!FAILURE_REASONS.has(entry.reason)) continue;
        const key = entry.typeName ?? "unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([typeName, count]) => ({ typeName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

export function buildDiffResolutionReport(
    preparation: EcadDocumentComparisonPreparation,
): DiffResolutionReport {
    const diagnostics = preparation.diagnostics ?? [];
    const resolution = preparation.resolution;
    const targets = resolution?.targets ?? preparation.targets.size;
    const painted = resolution?.targetsWithPaintedBounds ?? 0;
    const provided = resolution?.targetsUsingProvidedBounds ?? 0;
    return {
        documentPath: preparation.document.path,
        context: preparation.context,
        sourceCacheHit: preparation.sourceCacheHit,
        prepareMs: Number(preparation.prepareMs.toFixed(1)),
        changes: resolution?.changes ?? preparation.document.changes.length,
        sourceResolved: resolution?.sourceResolved ?? 0,
        targets,
        targetsWithPaintedBounds: painted,
        targetsUsingProvidedBounds: provided,
        // Null, never 0, when the bundle cannot report or prepared no targets.
        // A numeric zero here would read as "no fallbacks were used", which is
        // the opposite of what an unreporting bundle actually tells us.
        fallbackBoundsRate: resolution && targets > 0
            ? Number((provided / targets).toFixed(4))
            : null,
        ambiguousSourceIds: resolution?.ambiguousSourceIds ?? 0,
        duplicateChangeTargets: resolution?.duplicateChangeTargets ?? 0,
        diagnosticsByReason: countByReason(diagnostics),
        failuresByTypeName: failuresByTypeName(diagnostics),
        // Distinguishes "measured zero fallbacks" from "the loaded bundle
        // cannot report", which would otherwise both read as a clean result.
        unreported: resolution === undefined,
    };
}
