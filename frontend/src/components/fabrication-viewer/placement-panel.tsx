import { memo, useMemo, useReducer, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { STATUS_COLOUR, STATUS_HINT, STATUS_LABEL } from "./part-status";
import type { MissingPart, PartStatus, PlacementPart, PlacementView } from "./types";

type Row = PlacementPart | MissingPart;
type StatusFilter = PartStatus | "all";
type SideFilter = "all" | "top" | "bottom";

interface Filters {
    search: string;
    side: SideFilter;
    status: StatusFilter;
}

type FilterAction =
    | { type: "search"; value: string }
    | { type: "side"; value: SideFilter }
    | { type: "status"; value: StatusFilter };

function filtersReducer(state: Filters, action: FilterAction): Filters {
    switch (action.type) {
        case "search":
            return { ...state, search: action.value };
        case "side":
            return { ...state, side: action.value };
        default:
            // Picking the filter that is already on turns it off.
            return { ...state, status: state.status === action.value ? "all" : action.value };
    }
}

/** The problems worth a chip, in the order a reviewer cares about them. */
const PROBLEMS: { status: PartStatus; count: (view: PlacementView) => number }[] = [
    { status: "not-placed", count: (v) => v.counts.notPlaced },
    { status: "dnp-placed", count: (v) => v.counts.dnpPlaced },
    { status: "not-in-bom", count: (v) => v.counts.notInBom },
];

/** Rows drawn at once; a search narrows it, and a board has few hundred parts at most. */
const ROW_LIMIT = 300;

/** Enter or Space does what a click on the row does. */
function pickOnKey(event: KeyboardEvent<HTMLElement>, pick: () => void) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pick();
    }
}

function isPlaced(row: Row): row is PlacementPart {
    return "x" in row;
}

function matches(row: Row, filters: Filters): boolean {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    // A part that was never placed has no side to match.
    if (filters.side !== "all" && (!isPlaced(row) || row.side !== filters.side)) return false;
    const needle = filters.search.trim().toLowerCase();
    return !needle || `${row.ref} ${row.value} ${row.package}`.toLowerCase().includes(needle);
}

function Chip({ active, onClick, title, children }: {
    active: boolean;
    onClick: () => void;
    title?: string;
    children: ReactNode;
}) {
    return (
        <Button size="xs" variant={active ? "default" : "outline"} aria-pressed={active} title={title} onClick={onClick}>
            {children}
        </Button>
    );
}

function CheckSummary({ view, filters, dispatch }: {
    view: PlacementView;
    filters: Filters;
    dispatch: (action: FilterAction) => void;
}) {
    if (!view.hasBom) {
        return (
            <p className="text-xs text-muted-foreground">
                No BOM was found with this position file, so the parts are not checked against one.
            </p>
        );
    }
    const problems = PROBLEMS.filter((item) => item.count(view) > 0);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Checked against {view.files.bom}:</span>
            {problems.length === 0 && <span className="text-xs text-success">every part matches</span>}
            {problems.map((item) => (
                <Chip
                    key={item.status}
                    active={filters.status === item.status}
                    title={STATUS_HINT[item.status]}
                    onClick={() => dispatch({ type: "status", value: item.status })}
                >
                    {STATUS_LABEL[item.status]} ({item.count(view)})
                </Chip>
            ))}
        </div>
    );
}

/** Memoised: it stays mounted under the board, which re-renders on every pan frame. */
export const PlacementPanel = memo(function PlacementPanel({ view, selected, onSelect }: {
    view: PlacementView;
    selected: string | null;
    onSelect: (part: PlacementPart) => void;
}) {
    const [filters, dispatch] = useReducer(filtersReducer, { search: "", side: "all", status: "all" });
    const rows = useMemo<Row[]>(
        () => [...view.parts, ...view.missing].filter((row) => matches(row, filters)),
        [view, filters],
    );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={filters.search}
                    onChange={(event) => dispatch({ type: "search", value: event.target.value })}
                    placeholder="Search reference, value or package"
                    aria-label="Search parts"
                    className="h-7 w-64 text-xs"
                />
                <div className="flex" role="group" aria-label="Side">
                    {(["all", "top", "bottom"] as const).map((side) => (
                        <Button
                            key={side}
                            size="xs"
                            variant={filters.side === side ? "default" : "outline"}
                            aria-pressed={filters.side === side}
                            onClick={() => dispatch({ type: "side", value: side })}
                        >
                            {side === "all" ? "Both sides" : side === "top" ? "Top" : "Bottom"}
                        </Button>
                    ))}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                    {view.counts.placed} placed ({view.counts.top} top, {view.counts.bottom} bottom)
                </span>
            </div>
            <CheckSummary view={view} filters={filters} dispatch={dispatch} />
            {view.warnings.length > 0 && (
                <p className="text-xs text-warning">{view.warnings.slice(0, 3).join(" ")}</p>
            )}
            <div className="themed-scrollbar min-h-0 flex-1 overflow-auto rounded border">
                <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                            {["Ref", "Value", "Package", "Side", "X", "Y", "Rot", "Check"].map((heading) => (
                                <th
                                    key={heading}
                                    className={cn("px-3 py-1.5 font-semibold", ["X", "Y", "Rot"].includes(heading) && "text-right")}
                                >
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.slice(0, ROW_LIMIT).map((row) => {
                            const placed = isPlaced(row);
                            return (
                                <tr
                                    key={`${placed ? row.side : "missing"}:${row.ref}`}
                                    className={cn(
                                        "border-t",
                                        placed && "cursor-pointer hover:bg-muted/40",
                                        row.ref === selected && "bg-primary/15",
                                    )}
                                    aria-selected={row.ref === selected}
                                    tabIndex={placed ? 0 : undefined}
                                    onClick={placed ? () => onSelect(row) : undefined}
                                    onKeyDown={placed ? (event) => pickOnKey(event, () => onSelect(row)) : undefined}
                                >
                                    <td className="px-3 py-1.5 font-mono">{row.ref}</td>
                                    <td className="max-w-[10rem] truncate px-3 py-1.5" title={row.value}>{row.value || "-"}</td>
                                    <td className="max-w-[14rem] truncate px-3 py-1.5 text-muted-foreground" title={row.package}>
                                        {row.package || "-"}
                                    </td>
                                    <td className="px-3 py-1.5">{placed ? row.side : "-"}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{placed ? row.x.toFixed(2) : "-"}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{placed ? row.y.toFixed(2) : "-"}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{placed ? row.rotation : "-"}</td>
                                    <td className="px-3 py-1.5">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                aria-hidden
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: STATUS_COLOUR[row.status] }}
                                            />
                                            {row.status === "no-bom" ? "-" : STATUS_LABEL[row.status]}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No parts match.</p>}
                {rows.length > ROW_LIMIT && (
                    <p className="border-t p-2 text-xs text-muted-foreground">
                        Showing {ROW_LIMIT} of {rows.length}. Search to narrow the list.
                    </p>
                )}
            </div>
        </div>
    );
});
