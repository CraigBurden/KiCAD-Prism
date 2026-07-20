import { Eye, EyeOff, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ECadViewerElement, EcadPcbLayerState } from "@/types/ecad-viewer";

const PCB_PRESETS = [
    ["front", "Front"],
    ["back", "Back"],
    ["copper", "All copper"],
    ["outer-copper", "Outer copper"],
    ["inner-copper", "Inner copper"],
    ["drawings", "Drawings"],
    ["all", "Show all"],
    ["none", "Hide all"],
] as const;

export type ComparisonPcbLayersPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    layers: EcadPcbLayerState[];
    onToggleVisibility: (name: string, visible: boolean) => void;
    onApplyPreset: (
        preset: Parameters<
            NonNullable<ECadViewerElement["applyPcbLayerPreset"]>
        >[0],
    ) => void;
    onHighlight?: (name: string | null) => void;
    className?: string;
};

export function ComparisonPcbLayersToggle({
    open,
    onClick,
}: {
    open: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            variant={open ? "secondary" : "outline"}
            size="sm"
            className="h-8"
            onClick={onClick}
            aria-expanded={open}
        >
            <Layers3 className="mr-2 h-3.5 w-3.5" />
            Layers
        </Button>
    );
}

/** Visualizer-style PCB layer drawer for design comparison hosts. */
export function ComparisonPcbLayersPanel({
    open,
    onOpenChange,
    layers,
    onToggleVisibility,
    onApplyPreset,
    onHighlight,
    className,
}: ComparisonPcbLayersPanelProps) {
    if (!open) return null;

    return (
        <aside
            className={cn(
                "flex w-72 shrink-0 flex-col border-l bg-background/95",
                className,
            )}
            aria-label="PCB layer visibility"
        >
            <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                    <Layers3 className="size-4" />
                    Board layers
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onOpenChange(false)}
                >
                    Close
                </Button>
            </div>
            <div className="border-b p-3">
                <Select
                    onValueChange={(value) =>
                        onApplyPreset(
                            value as Parameters<
                                NonNullable<
                                    ECadViewerElement["applyPcbLayerPreset"]
                                >
                            >[0],
                        )
                    }
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Layer preset" />
                    </SelectTrigger>
                    <SelectContent>
                        {PCB_PRESETS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ScrollArea className="min-h-0 flex-1">
                <div className="p-2">
                    {layers.map((layer) => (
                        <div
                            key={layer.name}
                            className={cn(
                                "group flex items-center gap-2 border-l-2 px-2 py-1.5 text-xs hover:bg-accent",
                                layer.highlighted
                                    ? "border-primary bg-accent"
                                    : "border-transparent",
                            )}
                        >
                            <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                onClick={() => onHighlight?.(layer.name)}
                            >
                                <span
                                    className="size-3 shrink-0 border"
                                    style={{ backgroundColor: layer.color }}
                                />
                                <span
                                    className={cn(
                                        "truncate",
                                        !layer.visible && "text-muted-foreground",
                                    )}
                                >
                                    {layer.name}
                                </span>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                    onToggleVisibility(
                                        layer.name,
                                        !layer.visible,
                                    )
                                }
                                aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                            >
                                {layer.visible ? (
                                    <Eye className="size-3.5" />
                                ) : (
                                    <EyeOff className="size-3.5 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                    ))}
                    {!layers.length && (
                        <p className="px-2 py-4 text-xs text-muted-foreground">
                            Layers appear after the PCB comparison loads.
                        </p>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
}
