import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BomDiff } from "./types";

interface BomPanelProps {
    bom: BomDiff | null;
}

/** BOM tab rendering, ported from `visual-diff-viewer.tsx`. */
export function BomPanel({ bom }: BomPanelProps) {
    const [filters, setFilters] = useState({
        added: true,
        removed: true,
        changed: true,
    });

    if (!bom) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                BOM data not available
            </div>
        );
    }

    const anyFilterSelected = filters.added || filters.removed || filters.changed;
    const filteredChanges = anyFilterSelected
        ? bom.changes.filter((c) => filters[c.status as keyof typeof filters])
        : bom.changes;

    return (
        <div className="flex-1 flex flex-col h-full bg-background min-h-0">
            <div className="p-4 border-b flex gap-4 text-sm shrink-0">
                <Button
                    variant={filters.added ? "secondary" : "outline"}
                    size="sm"
                    className={`flex items-center gap-1.5 h-8 ${filters.added ? "bg-green-500/10 border-green-500 text-green-700" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, added: !f.added }))}
                >
                    <div className={`w-2 h-2 rounded-full ${filters.added ? "bg-green-500" : "bg-muted-foreground"}`} /> Added ({bom.summary.added})
                </Button>
                <Button
                    variant={filters.removed ? "secondary" : "outline"}
                    size="sm"
                    className={`flex items-center gap-1.5 h-8 ${filters.removed ? "bg-red-500/10 border-red-500 text-red-700" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, removed: !f.removed }))}
                >
                    <div className={`w-2 h-2 rounded-full ${filters.removed ? "bg-red-500" : "bg-muted-foreground"}`} /> Removed ({bom.summary.removed})
                </Button>
                <Button
                    variant={filters.changed ? "secondary" : "outline"}
                    size="sm"
                    className={`flex items-center gap-1.5 h-8 ${filters.changed ? "bg-orange-500/10 border-orange-500 text-orange-700" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, changed: !f.changed }))}
                >
                    <div className={`w-2 h-2 rounded-full ${filters.changed ? "bg-orange-500" : "bg-muted-foreground"}`} /> Changed ({bom.summary.changed})
                </Button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead className="bg-muted text-muted-foreground font-medium border-b sticky top-0 z-10">
                        <tr className="bg-muted">
                            <th className="px-4 py-2 border-r bg-muted">Status</th>
                            {bom.fields.map((f) => (
                                <th key={f} className="px-4 py-2 border-r bg-muted">{f}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredChanges.map((item, idx) => {
                            const isAdded = item.status === "added";
                            const isRemoved = item.status === "removed";
                            const isChanged = item.status === "changed";

                            let rowClass = "border-b ";
                            if (isAdded) rowClass += "bg-green-500/10 text-green-900";
                            if (isRemoved) rowClass += "bg-red-500/10 text-red-900 italic line-through opacity-70";
                            if (isChanged) rowClass += "bg-orange-500/5";

                            return (
                                <tr key={`${item.ref}-${idx}`} className={rowClass}>
                                    <td className="px-4 py-2 border-r font-medium uppercase text-[10px] tracking-wider">
                                        {item.status}
                                    </td>
                                    {bom.fields.map((f) => {
                                        const oldValue = item.old?.[f];
                                        const newValue = item.new?.[f];
                                        const fieldDiff = item.diffs?.[f];

                                        if (isChanged && fieldDiff) {
                                            return (
                                                <td key={f} className="px-4 py-2 border-r bg-orange-500/5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] line-through w-fit">
                                                            {fieldDiff.old}
                                                        </div>
                                                        <div className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium w-fit">
                                                            {fieldDiff.new}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        let cellClass = "px-4 py-2 border-r ";
                                        if (item.status === "unchanged") cellClass += "opacity-50 font-light text-muted-foreground";

                                        return (
                                            <td key={f} className={cellClass}>
                                                {isRemoved ? oldValue : newValue}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {filteredChanges.length === 0 && (
                            <tr>
                                <td colSpan={bom.fields.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                                    No entries match the selected filters
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
