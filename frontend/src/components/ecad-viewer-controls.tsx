import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Layers3,
    ListFilter,
    Search,
    Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type {
    ECadViewerElement,
    EcadPcbViewState,
    EcadSchematicPageState,
} from "@/types/ecad-viewer";

type EcadViewerControlsProps = {
    context: "SCH" | "PCB";
    viewer: ECadViewerElement | null;
};

const pcbPresets = [
    ["front", "Front"],
    ["back", "Back"],
    ["copper", "All copper"],
    ["outer-copper", "Outer copper"],
    ["inner-copper", "Inner copper"],
    ["drawings", "Drawings"],
    ["all", "Show all"],
    ["none", "Hide all"],
] as const;

export function EcadViewerControls({ context, viewer }: EcadViewerControlsProps) {
    const [open, setOpen] = useState(true);
    const [section, setSection] = useState<"layers" | "objects">("layers");
    const [query, setQuery] = useState("");
    const [pages, setPages] = useState<EcadSchematicPageState[]>([]);
    const [pcbState, setPcbState] = useState<EcadPcbViewState | null>(null);

    const refresh = useCallback(() => {
        if (!viewer) return;
        if (context === "SCH") setPages(viewer.getSchematicPages?.() ?? []);
        else setPcbState(viewer.getPcbViewState?.() ?? null);
    }, [context, viewer]);

    useEffect(() => {
        refresh();
        viewer?.addEventListener("ecad-viewer:view-state-change", refresh);
        return () => viewer?.removeEventListener("ecad-viewer:view-state-change", refresh);
    }, [refresh, viewer]);

    const visiblePages = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        if (!normalized) return pages;
        return pages.filter((page) =>
            [page.name, page.filename, page.page]
                .filter(Boolean)
                .some((value) => value!.toLocaleLowerCase().includes(normalized)),
        );
    }, [pages, query]);

    const mutatePcb = useCallback((action: () => void) => {
        action();
        setPcbState(viewer?.getPcbViewState?.() ?? null);
    }, [viewer]);

    return (
        <aside
            className={cn(
                "relative z-20 flex h-full shrink-0 flex-col border-r bg-background/95 transition-[width] duration-200",
                open ? "w-80" : "w-11",
            )}
            aria-label={context === "SCH" ? "Schematic pages" : "PCB display controls"}
        >
            <div className={cn("flex h-10 shrink-0 items-center border-b", open ? "justify-between px-3" : "justify-center")}>
                {open && (
                    <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
                        {context === "SCH" ? <ListFilter className="size-4" /> : <Layers3 className="size-4" />}
                        <span>{context === "SCH" ? "Schematic pages" : "Board display"}</span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setOpen((value) => !value)}
                    aria-label={open ? "Collapse viewer controls" : "Expand viewer controls"}
                >
                    {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
            </div>

            {open && context === "SCH" && (
                <>
                    <div className="space-y-2 border-b p-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Find page…"
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-full justify-start text-xs"
                            onClick={() => {
                                viewer?.navigateSchematicParent?.();
                                refresh();
                            }}
                        >
                            <Undo2 className="mr-2 size-3.5" />
                            Parent sheet
                            <span className="ml-auto text-[10px] text-muted-foreground">⌥⌫</span>
                        </Button>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="p-2">
                            {visiblePages.map((page) => (
                                <button
                                    key={page.projectPath}
                                    type="button"
                                    className={cn(
                                        "flex w-full items-center gap-2 border-l-2 px-2 py-2 text-left text-xs transition-colors hover:bg-accent",
                                        page.active ? "border-primary bg-accent text-accent-foreground" : "border-transparent text-muted-foreground",
                                    )}
                                    style={{ paddingLeft: `${0.5 + Math.min(page.depth, 6) * 0.75}rem` }}
                                    onClick={() => {
                                        viewer?.switchPage(page.projectPath);
                                        refresh();
                                    }}
                                >
                                    <span className="min-w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
                                        {page.page || "—"}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-foreground">
                                        {page.name || page.filename}
                                    </span>
                                </button>
                            ))}
                            {!visiblePages.length && (
                                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                                    {pages.length ? "No matching pages" : "Pages are loading…"}
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </>
            )}

            {open && context === "PCB" && (
                <>
                    <div className="grid grid-cols-2 border-b p-2">
                        <Button
                            variant={section === "layers" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSection("layers")}
                        >
                            Layers
                        </Button>
                        <Button
                            variant={section === "objects" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSection("objects")}
                        >
                            Objects & filters
                        </Button>
                    </div>
                    {section === "layers" ? (
                        <>
                            <div className="border-b p-3">
                                <Select
                                    onValueChange={(value) => mutatePcb(() => viewer?.applyPcbLayerPreset?.(value as Parameters<NonNullable<ECadViewerElement["applyPcbLayerPreset"]>>[0]))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Layer preset" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pcbPresets.map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="p-2">
                                    {pcbState?.layers.map((layer) => (
                                        <div
                                            key={layer.name}
                                            className={cn(
                                                "group flex items-center gap-2 border-l-2 px-2 py-1.5 text-xs hover:bg-accent",
                                                layer.highlighted ? "border-primary bg-accent" : "border-transparent",
                                            )}
                                        >
                                            <button
                                                type="button"
                                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                onClick={() => mutatePcb(() => viewer?.setPcbLayerHighlight?.(layer.name))}
                                            >
                                                <span className="size-3 shrink-0 border" style={{ backgroundColor: layer.color }} />
                                                <span className={cn("truncate", !layer.visible && "text-muted-foreground")}>{layer.name}</span>
                                            </button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                                onClick={() => mutatePcb(() => viewer?.setPcbLayerVisibility?.(layer.name, !layer.visible))}
                                                aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                                            >
                                                {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    ) : (
                        <ScrollArea className="min-h-0 flex-1">
                            <div className="space-y-5 p-4">
                                <ControlHeading>Object opacity</ControlHeading>
                                {(["tracks", "vias", "pads", "zones"] as const).map((kind) => (
                                    <div key={kind} className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="capitalize">{kind}</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {Math.round((pcbState?.objectOpacity[kind] ?? 1) * 100)}%
                                            </span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={[pcbState?.objectOpacity[kind] ?? 1]}
                                            onValueChange={([value]) => mutatePcb(() => viewer?.setPcbObjectOpacity?.(kind, value ?? 1))}
                                        />
                                    </div>
                                ))}
                                <Separator />
                                <ControlHeading>Visibility filters</ControlHeading>
                                {([
                                    ["references", "References"],
                                    ["values", "Values"],
                                    ["footprintText", "Footprint text"],
                                    ["hiddenText", "Hidden text"],
                                ] as const).map(([kind, label]) => (
                                    <label key={kind} className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                                        <span>{label}</span>
                                        <Checkbox
                                            checked={pcbState?.objectVisibility[kind] ?? false}
                                            onCheckedChange={(checked) => mutatePcb(() => viewer?.setPcbObjectVisibility?.(kind, checked === true))}
                                        />
                                    </label>
                                ))}
                                <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                                    <span>Highlight connected track</span>
                                    <Checkbox
                                        checked={pcbState?.highlightTracks ?? true}
                                        onCheckedChange={(checked) => mutatePcb(() => viewer?.setPcbTrackHighlight?.(checked === true))}
                                    />
                                </label>
                            </div>
                        </ScrollArea>
                    )}
                </>
            )}
        </aside>
    );
}

function ControlHeading({ children }: { children: ReactNode }) {
    return <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}
