/**
 * What a single change *is*, as reviewer-facing vocabulary.
 *
 * Everything here reads one `ChangeItem` and answers a question about it — what
 * kind of KiCad object it names, which sheet it lives on, which of its fields
 * carry an authored decision rather than a nudged coordinate. The noise policy,
 * the grouping rules and the queue all ask those questions, and they must get
 * the same answer, so they ask here.
 *
 * Nothing in this module knows about groups or about the review queue.
 */

import { CATEGORY_META, type Category } from "@/lib/diff-grouping";
import { kindsWith } from "./comparison-change-kinds";
import type { ChangeItem, FieldDelta } from "./types";

const NET_REASON_CODES = new Set([
    "connectivity-changed",
    "net-renamed",
    "label-count-changed",
]);

const SCHEMATIC_LAYOUT_REASONS = new Set([
    "moved",
    "rotated",
    "mirrored",
    "properties-changed",
]);

export const SCHEMATIC_WIRING_KINDS = kindsWith("wiring");

export const PCB_COPPER_KINDS = kindsWith("copper");

export const PCB_COMPONENT_CHILD_KINDS = kindsWith("component-child");

export const RULE_KINDS = kindsWith("rule");

const LAYOUT_FIELD_NAMES = new Set([
    "position",
    "rotation",
    "mirror",
]);

const STRUCTURED_GEOMETRY_KEYS = new Set([
    "at",
    "points",
    "position",
    "rotation",
    "size",
    // Native identifiers are editor bookkeeping, not review evidence.
    "uuid",
    "tstamp",
    "sourceUuid",
    "busUid",
]);

function normalizeCategory(category: string): Category {
    if (category === "board") return "other";
    return category in CATEGORY_META ? (category as Category) : "other";
}

function isSchematicPowerReference(change: ChangeItem): boolean {
    return change.domain === "schematic"
        && /^#(?:PWR|FLG)/i.test(change.reference ?? change.label);
}

export function objectKind(change: ChangeItem): string {
    return (change.objectKind ?? "object").toLocaleLowerCase();
}

/** Every layer either revision's object occupies, sorted and once each. */
export function unionLayers(change: ChangeItem): string[] {
    return [...new Set([...(change.base?.layers ?? []), ...(change.head?.layers ?? [])])]
        .sort();
}

/** The layers a change names: its objects' layers, then each side's own layer. */
export function changeLayers(change: ChangeItem): string[] {
    return [
        ...unionLayers(change),
        change.base?.layer,
        change.head?.layer,
    ].filter((layer): layer is string => Boolean(layer));
}

export function hasNativeParent(change: ChangeItem): boolean {
    return Boolean(change.base?.parentSourceId || change.head?.parentSourceId);
}

export function semanticCategory(change: ChangeItem): Category {
    const category = normalizeCategory(change.category);
    const kind = objectKind(change);
    if (category === "rules" || RULE_KINDS.has(kind)) return "rules";
    if (change.domain === "pcb" && change.reference) {
        if (kind === "pad") {
            return change.kind === "changed"
                && (change.reasons?.includes("net-changed") || "Net" in (change.fields ?? {}))
                ? "nets"
                : "components";
        }
        if (PCB_COMPONENT_CHILD_KINDS.has(kind) && (kind !== "zone" || hasNativeParent(change))) {
            return "components";
        }
    }
    if (category === "zones") return category;
    if (
        isSchematicPowerReference(change)
        || change.net
        || change.reasons?.some((reason) => NET_REASON_CODES.has(reason))
    ) {
        return "nets";
    }
    return category;
}

export function referenceFor(change: ChangeItem): string | null {
    return change.reference
        ?? change.head?.reference
        ?? change.base?.reference
        ?? change.details.targets?.find((target) => target.reference)?.reference
        ?? null;
}

export function pageFor(change: ChangeItem): string {
    // A side whose document is not known has an empty path.
    return change.page
        || change.head?.documentPath
        || change.base?.documentPath
        || change.details.targets?.[0]?.documentPath
        || "Schematic";
}

function normalizedValue(value: unknown): unknown {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(normalizedValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, normalizedValue(entry)]),
        );
    }
    return value;
}

export function fieldSides(value: FieldDelta | undefined): { old: unknown; new: unknown } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const sides = value as { old?: unknown; new?: unknown };
    if (!("old" in sides) && !("new" in sides)) return null;
    return { old: sides.old, new: sides.new };
}

function valuesEquivalent(oldValue: unknown, newValue: unknown): boolean {
    return JSON.stringify(normalizedValue(oldValue)) === JSON.stringify(normalizedValue(newValue));
}

function isLayoutField(name: string): boolean {
    const folded = name.trim().toLocaleLowerCase();
    return LAYOUT_FIELD_NAMES.has(folded) || folded.endsWith(" attributes");
}

function parsedStructuredValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function withoutStructuredGeometry(value: unknown): unknown {
    const parsed = parsedStructuredValue(value);
    if (Array.isArray(parsed)) return parsed.map(withoutStructuredGeometry);
    if (parsed && typeof parsed === "object") {
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
                .flatMap(([key, child]) => (
                    STRUCTURED_GEOMETRY_KEYS.has(key)
                        ? []
                        : [[key, withoutStructuredGeometry(child)]]
                )),
        );
    }
    return parsed;
}

function isStructuredGeometryOnlyField(
    name: string,
    sides: { old: unknown; new: unknown },
): boolean {
    if (!name.trim().toLocaleLowerCase().endsWith("content")) return false;
    const oldValue = parsedStructuredValue(sides.old);
    const newValue = parsedStructuredValue(sides.new);
    if (
        !oldValue || typeof oldValue !== "object"
        || !newValue || typeof newValue !== "object"
    ) return false;
    return !valuesEquivalent(oldValue, newValue)
        && valuesEquivalent(
            withoutStructuredGeometry(oldValue),
            withoutStructuredGeometry(newValue),
        );
}

export function hasStructuredGeometryOnlyField(change: ChangeItem): boolean {
    return Object.entries(change.fields ?? {}).some(([name, value]) => {
        const sides = fieldSides(value);
        return Boolean(sides && isStructuredGeometryOnlyField(name, sides));
    });
}

export function meaningfulFieldEntries(change: ChangeItem): Array<[string, { old: unknown; new: unknown }]> {
    const entries: Array<[string, { old: unknown; new: unknown }]> = [];
    for (const [name, value] of Object.entries(change.fields ?? {})) {
        if (isLayoutField(name)) continue;
        const sides = fieldSides(value);
        if (!sides || valuesEquivalent(sides.old, sides.new)) continue;
        if (isStructuredGeometryOnlyField(name, sides)) continue;
        entries.push([name, sides]);
    }
    return entries;
}

export function isSamePageLayoutOnly(change: ChangeItem): boolean {
    if (change.domain !== "schematic" || change.kind !== "changed") return false;
    if (hasStructuredGeometryOnlyField(change) && meaningfulFieldEntries(change).length === 0) {
        return true;
    }
    const reasons = change.reasons ?? [];
    if (!reasons.length || reasons.some((reason) => !SCHEMATIC_LAYOUT_REASONS.has(reason))) {
        return false;
    }
    return meaningfulFieldEntries(change).length === 0;
}

export function parentSymbolKey(change: ChangeItem): string {
    return [change.kind, referenceFor(change) ?? "", pageFor(change)].join(":");
}

export function stringFieldPair(
    change: ChangeItem,
    names: string[],
): { old: string; new: string } | null {
    for (const name of names) {
        const sides = fieldSides(change.fields?.[name]);
        if (typeof sides?.old === "string" && typeof sides.new === "string") {
            return { old: sides.old, new: sides.new };
        }
    }
    return null;
}

export function compactValue(value: unknown): string {
    const normalized = normalizedValue(value);
    if (normalized === null || normalized === undefined || normalized === "") return "—";
    if (typeof normalized === "string" || typeof normalized === "number" || typeof normalized === "boolean") {
        return String(normalized);
    }
    const encoded = JSON.stringify(normalized);
    return encoded.length > 42 ? `${encoded.slice(0, 39)}…` : encoded;
}
