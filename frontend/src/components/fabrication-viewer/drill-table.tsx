import type { FabricationView } from "./types";

/** `Plated,PTH,ViaDrill` reads as "Via"; the plating is already its own column. */
const drillUse = (fn: string) => fn.split(",").slice(2).join(" ").replace(/Drill$/, "") || "-";

const mm = (value: number) => `${value.toFixed(3).replace(/\.?0+$/, "")} mm`;

export function DrillTable({ drill }: { drill: FabricationView["drill"] }) {
    if (drill.tools.length === 0) {
        return <p className="p-3 text-sm text-muted-foreground">This package has no drill file.</p>;
    }
    return (
        <div className="themed-scrollbar min-h-0 min-w-0 flex-1 overflow-auto rounded border">
            <p className="border-b px-3 py-2 text-xs text-muted-foreground">
                {drill.holes} holes
                {drill.slots > 0 ? `, ${drill.slots} slot moves` : ""}
                {drill.smallest !== null ? `, smallest ${mm(drill.smallest)}` : ""}
            </p>
            <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                        <th className="px-3 py-1.5 font-semibold">Size</th>
                        <th className="px-3 py-1.5 font-semibold">Type</th>
                        <th className="px-3 py-1.5 font-semibold">Use</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Holes</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Slot moves</th>
                    </tr>
                </thead>
                <tbody>
                    {drill.tools.map((tool) => (
                        <tr key={`${tool.file}:${tool.function}:${tool.diameter}`} className="border-t">
                            <td className="px-3 py-1.5 font-mono">{mm(tool.diameter)}</td>
                            <td className="px-3 py-1.5">{tool.plated ? "Plated" : "Non-plated"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                                {drillUse(tool.function)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">{tool.hits}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{tool.slots || "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
