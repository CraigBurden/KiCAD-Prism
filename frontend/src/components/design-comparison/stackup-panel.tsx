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
                    accent === "old" ? "bg-red-500/10 text-red-700" : "bg-green-500/10 text-green-700",
                )}
            >
                {title}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Layer</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Thickness (mm)</th>
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
                                <tr key={idx} className={cn("border-b", changed && "bg-amber-500/10")}>
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
    if (!stackup || !stackup.present) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                No stackup data available for this project.
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            {stackup.changed && (
                <div className="shrink-0 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700">
                    Stackup differs between revisions — changed rows are highlighted below.
                </div>
            )}
            <div className="flex min-h-0 flex-1 divide-x">
                <StackupTable title="Old stackup" accent="old" layers={stackup.base} otherLayers={stackup.head} />
                <StackupTable title="New stackup" accent="new" layers={stackup.head} otherLayers={stackup.base} />
            </div>
        </div>
    );
}
