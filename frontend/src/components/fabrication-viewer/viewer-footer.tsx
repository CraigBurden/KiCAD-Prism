import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { PlacementPart } from "./types";

/**
 * The strip under the board, like Design Comparison's: what is selected on the
 * left, the zoom on the right.
 */
export function ViewerFooter({ picked, note, zoomPercent, onClear }: {
    picked: PlacementPart | null;
    /** Shown when nothing is picked, such as a highlighted layer's file and warnings. */
    note: string;
    /** Undefined when the view has no zoom. */
    zoomPercent?: number;
    onClear: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            {picked ? (
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">
                        <span className="font-mono font-semibold text-foreground">{picked.ref}</span>
                        {` · ${picked.value || "no value"} · ${picked.package} · ${picked.side}, `
                            + `${picked.x.toFixed(2)}, ${picked.y.toFixed(2)} mm, ${picked.rotation}°`}
                    </span>
                    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" aria-label="Clear selection" onClick={onClear}>
                        <X className="h-3 w-3" />
                    </Button>
                </span>
            ) : (
                <span className="truncate">{note}</span>
            )}
            {zoomPercent !== undefined && <span className="shrink-0 tabular-nums">{zoomPercent}%</span>}
        </div>
    );
}
