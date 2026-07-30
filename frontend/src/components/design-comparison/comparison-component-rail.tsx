import { Cpu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BomChangeRow, BomDiff } from "./types";

/**
 * Which revision's metadata a selection is asking for.
 *
 * A component's fields differ between revisions — that is the point of the
 * comparison — so a panel that showed one merged view would be lying about
 * one of the two. The side is decided by where the click landed.
 */
export type ComparisonComponentSide = "base" | "compare";

export interface ComparisonComponentSelection {
    reference: string;
    side: ComparisonComponentSide;
}

interface ComparisonComponentRailProps {
    selection: ComparisonComponentSelection | null;
    bom: BomDiff | null;
    baseLabel: string;
    compareLabel: string;
    onClose: () => void;
    embedded?: boolean;
}

/**
 * Fields worth leading with, in this order. Everything else the BOM carries
 * follows alphabetically, so a project with custom fields still shows them.
 */
const PRIMARY_FIELDS = [
    "Value",
    "Footprint",
    "Description",
    "Manufacturer",
    "Manufacturer Part Number",
    "Vendor",
    "Vendor Part Number",
    "Datasheet",
] as const;

const HIDDEN_FIELDS = new Set(["Reference", "Qty", "DNP"]);

export function fieldsForSide(
    row: BomChangeRow | undefined,
    side: ComparisonComponentSide,
): Record<string, string> | undefined {
    if (!row) return undefined;
    return side === "base" ? row.old : row.new;
}

/** Ordered field entries for display: primaries first, then the rest. */
export function orderedFields(
    fields: Record<string, string>,
): Array<[string, string]> {
    const remaining = new Map(
        Object.entries(fields).filter(
            ([name, value]) =>
                !HIDDEN_FIELDS.has(name)
                // kicad_* are the raw flags behind DNP / in-BOM, surfaced as
                // badges above rather than repeated as raw strings.
                && !name.startsWith("kicad_")
                && String(value ?? "").trim() !== "",
        ),
    );
    const ordered: Array<[string, string]> = [];
    for (const name of PRIMARY_FIELDS) {
        const value = remaining.get(name);
        if (value !== undefined) {
            ordered.push([name, value]);
            remaining.delete(name);
        }
    }
    return [
        ...ordered,
        ...[...remaining.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ];
}

function isTruthyFlag(value: string | undefined): boolean {
    return String(value ?? "").toLowerCase() === "true";
}

export function ComparisonComponentRail({
    selection,
    bom,
    baseLabel,
    compareLabel,
    onClose,
    embedded = false,
}: ComparisonComponentRailProps) {
    const row = selection
        ? bom?.changes.find((candidate) => candidate.ref === selection.reference)
        : undefined;
    const fields = selection ? fieldsForSide(row, selection.side) : undefined;
    const sideLabel = selection?.side === "base" ? baseLabel : compareLabel;

    const header = (
        <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
                <Cpu className="size-4 shrink-0" />
                <span className="truncate text-sm font-semibold">
                    {selection?.reference ?? "Component"}
                </span>
                {selection && (
                    <Badge
                        variant={selection.side === "base" ? "outline" : "secondary"}
                        className="shrink-0 font-mono text-[10px]"
                    >
                        {sideLabel}
                    </Badge>
                )}
            </div>
            <Button
                variant="ghost"
                size="sm"
                className="size-7 shrink-0 p-0"
                onClick={onClose}
                aria-label="Close component details"
            >
                <X className="size-3.5" />
            </Button>
        </div>
    );

    let body;
    if (!selection) {
        body = (
            <p className="p-4 text-xs text-muted-foreground">
                Select a component in either revision to see its fields.
            </p>
        );
    } else if (!bom) {
        body = (
            <p className="p-4 text-xs text-muted-foreground">
                No BOM was built for these revisions, so there is no component
                metadata to show. Render the project and run the comparison
                again.
            </p>
        );
    } else if (!fields) {
        // The reference resolves on the other side only. Say which, rather
        // than showing an empty field list that reads like missing data.
        const other = selection.side === "base" ? compareLabel : baseLabel;
        body = (
            <p className="p-4 text-xs text-muted-foreground">
                {selection.reference} does not exist in {sideLabel}. It is
                present only in {other}.
            </p>
        );
    } else {
        const entries = orderedFields(fields);
        const dnp = isTruthyFlag(fields["kicad_dnp"]);
        const notInBom = fields["kicad_in_bom"] !== undefined
            && !isTruthyFlag(fields["kicad_in_bom"]);
        body = (
            <div className="space-y-3 p-3">
                {(dnp || notInBom) && (
                    <div className="flex flex-wrap gap-1.5">
                        {dnp && (
                            <Badge variant="destructive" className="text-[10px]">
                                DNP
                            </Badge>
                        )}
                        {notInBom && (
                            <Badge variant="outline" className="text-[10px]">
                                Not in BOM
                            </Badge>
                        )}
                    </div>
                )}
                {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        This component carries no fields in {sideLabel}.
                    </p>
                ) : (
                    <dl className="space-y-2">
                        {entries.map(([name, value]) => (
                            <div key={name} className="min-w-0">
                                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {name}
                                </dt>
                                <dd className="break-words text-xs">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex min-h-0 flex-col",
                embedded ? "h-full" : "h-full w-72 border-l bg-background",
            )}
        >
            {header}
            <ScrollArea className="min-h-0 flex-1">{body}</ScrollArea>
        </div>
    );
}
