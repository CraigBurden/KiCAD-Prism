import { cn } from "@/lib/utils";
import type { StackupDiff, StackupLayer } from "./types";

interface StackupPanelProps {
    stackup: StackupDiff | null;
}

function rowsDiffer(a: StackupLayer | undefined, b: StackupLayer | undefined): boolean {
    if (!a || !b) return true;
    return a.name !== b.name || a.type !== b.type || (a.thickness ?? null) !== (b.thickness ?? null);
}

function StackupTable({
    title,
    accent,
    layers,
    otherLayers,
}: {
    title: string;
    accent: "old" | "new";
    layers: StackupLayer[];
    otherLayers: StackupLayer[];
}) {
    const rowCount = Math.max(layers.length, otherLayers.length);
    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
                className={cn(
                    "sticky top-0 z-10 shrink-0 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide",
                    accent === "old"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/10 text-success",
                )}
            >
                {title}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                        <tr>
                            <th className="bg-muted px-3 py-2 text-left">#</th>
                            <th className="bg-muted px-3 py-2 text-left">Layer</th>
                            <th className="bg-muted px-3 py-2 text-left">Type</th>
                            <th className="bg-muted px-3 py-2 text-right">Thickness (mm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rowCount }, (_, idx) => {
                            const layer = layers[idx];
                            const other = otherLayers[idx];
                            if (!layer) {
                                return (
                                    <tr key={idx} className="border-b italic text-muted-foreground opacity-50">
                                        <td className="px-3 py-2">{idx + 1}</td>
                                        <td className="px-3 py-2" colSpan={3}>—</td>
                                    </tr>
                                );
                            }
                            const changed = rowsDiffer(layer, other);
                            return (
                                <tr key={idx} className={cn("border-b", changed && "bg-warning/10")}>
                                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                    <td className="px-3 py-2 font-medium">{layer.name}</td>
                                    <td className="px-3 py-2">{layer.type}</td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        {layer.thickness != null ? layer.thickness.toFixed(4) : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                        {rowCount === 0 && (
                            <tr>
                                <td colSpan={4} className="px-3 py-12 text-center text-muted-foreground">
                                    No stackup layers found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function StackupPanel({ stackup }: StackupPanelProps) {
    // No stackup could be read from either revision. This is not "no changes" —
    // it means the board (or its stackup block) was not available to read, which
    // on this setup means the PCB has not been rendered yet. Say so plainly and
    // tell the reviewer what to do, rather than showing an empty or vague panel.
    if (!stackup || !stackup.present) {
        return (
            <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-sm font-medium text-foreground">
                        Stackup not available yet
                    </h3>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        No board stackup could be read from these revisions. Render
                        the PCB for this project, then run the comparison again to
                        see the stackup.
                    </p>
                </div>
            </section>
        );
    }

    // Present in at least one revision: always show both stackups side by side,
    // whether or not they changed. An unchanged stackup is still worth looking at
    // to confirm it did not move. Only add the "differs" banner when it changed.
    return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
                className={cn(
                    "shrink-0 border-b px-4 py-1.5 text-xs",
                    stackup.changed
                        ? "bg-warning/10 text-warning-foreground"
                        : "bg-muted/40 text-muted-foreground",
                )}
            >
                {stackup.changed
                    ? "Stackup differs between revisions — changed rows are highlighted below."
                    : "Stackup is identical in both revisions."}
            </div>
            <div className="flex min-h-0 flex-1 divide-x">
                <StackupTable title="Old stackup" accent="old" layers={stackup.base} otherLayers={stackup.head} />
                <StackupTable title="New stackup" accent="new" layers={stackup.head} otherLayers={stackup.base} />
            </div>
        </section>
    );
}
