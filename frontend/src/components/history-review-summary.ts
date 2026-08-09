import {
    compactValue,
    meaningfulFieldEntries,
    pageFor,
    referenceFor,
    semanticCategory,
} from "./design-comparison/comparison-change-facts";
import { humanize } from "./design-comparison/comparison-change-vocabulary";
import {
    prepareChangesForReview,
    semanticNetRenames,
} from "./design-comparison/comparison-review-noise";
import type {
    ChangeDomain,
    ChangeItem,
    ChangeKind,
    DesignCompareResult,
} from "./design-comparison/types";

export type HistoryReviewSection = "components" | "nets" | "sheets" | "other";

export interface HistoryReviewEntry {
    id: string;
    changeId: string;
    domain: ChangeDomain;
    domains: ChangeDomain[];
    section: HistoryReviewSection;
    kind: ChangeKind;
    label: string;
    reference: string | null;
    page: string;
    evidence: string[];
}

export interface HistoryReviewSummary {
    entries: HistoryReviewEntry[];
}

const SECTION_ORDER: Record<HistoryReviewSection, number> = {
    components: 0,
    nets: 1,
    sheets: 2,
    other: 3,
};

const HISTORY_FIELD_ORDER = [
    "value",
    "footprint",
    "dnp",
    "description",
    "manufacturer",
    "manufacturer part number",
    "part number",
    "datasheet",
];

function sectionFor(change: ChangeItem): HistoryReviewSection {
    const category = semanticCategory(change);
    if (category === "components" || category === "symbols") return "components";
    if (category === "nets") return "nets";
    if (category === "sheets") return "sheets";
    return "other";
}

function changeEvidence(change: ChangeItem): string[] {
    const fields = meaningfulFieldEntries(change)
        .sort(([left], [right]) => {
            const leftRank = HISTORY_FIELD_ORDER.indexOf(left.toLocaleLowerCase());
            const rightRank = HISTORY_FIELD_ORDER.indexOf(right.toLocaleLowerCase());
            return (leftRank < 0 ? HISTORY_FIELD_ORDER.length : leftRank)
                - (rightRank < 0 ? HISTORY_FIELD_ORDER.length : rightRank)
                || left.localeCompare(right);
        })
        .map(([name, values]) => (
            `${humanize(name)}: ${compactValue(values.old)} → ${compactValue(values.new)}`
        ));
    if (fields.length) return fields;

    if (change.kind === "added") return ["Added to the design"];
    if (change.kind === "removed") return ["Removed from the design"];
    return (change.reasons ?? [])
        .slice(0, 2)
        .map((reason) => humanize(reason));
}

function entryFor(change: ChangeItem): HistoryReviewEntry {
    const reference = referenceFor(change);
    return {
        id: `${change.domain}:${change.id}`,
        changeId: change.id,
        domain: change.domain,
        domains: [change.domain],
        section: sectionFor(change),
        kind: change.kind,
        label: reference ?? change.label,
        reference,
        page: pageFor(change),
        evidence: changeEvidence(change),
    };
}

function mergeComponentEntries(entries: HistoryReviewEntry[]): HistoryReviewEntry[] {
    const merged = new Map<string, HistoryReviewEntry>();
    for (const entry of entries) {
        if (entry.section !== "components") {
            merged.set(entry.id, entry);
            continue;
        }
        const key = entry.reference
            ? `component:${entry.reference.trim().toLocaleLowerCase()}`
            : entry.id;
        const current = merged.get(key);
        if (!current) {
            merged.set(key, { ...entry, id: key });
            continue;
        }
        const preferEntry = current.domain === "pcb" && entry.domain === "schematic";
        merged.set(key, {
            ...(preferEntry ? entry : current),
            id: key,
            kind: current.kind === entry.kind ? current.kind : "changed",
            domains: [...new Set([...current.domains, ...entry.domains])],
            evidence: [...new Set([...current.evidence, ...entry.evidence])],
        });
    }
    return [...merged.values()];
}

export function buildHistoryReviewSummary(
    result: DesignCompareResult,
): HistoryReviewSummary {
    const schematic = prepareChangesForReview(result.schematic.changes);
    const netRenames = semanticNetRenames(result.schematic.changes);
    const pcb = prepareChangesForReview(result.pcb.changes, { netRenames });
    const entries = mergeComponentEntries(
        [...schematic.changes, ...pcb.changes]
            .filter((change) => change.classification !== "secondary")
            .map(entryFor),
    )
        .sort((left, right) => (
            SECTION_ORDER[left.section] - SECTION_ORDER[right.section]
            || left.label.localeCompare(right.label, undefined, {
                numeric: true,
                sensitivity: "base",
            })
            || left.domain.localeCompare(right.domain)
            || left.id.localeCompare(right.id)
        ));
    return { entries };
}

export function historyReviewSectionLabel(section: HistoryReviewSection): string {
    if (section === "components") return "Components";
    if (section === "nets") return "Nets";
    if (section === "sheets") return "Sheets";
    return "Other design changes";
}
