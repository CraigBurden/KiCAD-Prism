import type { ReactNode } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ViewSide } from "./viewer-state";

export type ViewerView = "board" | "drill" | "placement";

/** Compare's zoom step, so the two feel the same under the wheel and the buttons. */
export const ZOOM_STEP = 1.4;

/** The bordered segmented control Design Comparison uses for Old/New and the like. */
function Segments({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div
            className="inline-flex items-center gap-0.5 rounded-md border bg-background p-0.5"
            role="group"
            aria-label={label}
        >
            {children}
        </div>
    );
}

function Segment({ active, onClick, children }: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClick}
            aria-pressed={active}
        >
            {children}
        </Button>
    );
}

export function ViewerToolbar({
    title,
    subtitle,
    view,
    onView,
    drillCount,
    placementLabel,
    side,
    onSide,
    hasParts,
    showParts,
    onToggleParts,
    onZoom,
    onFit,
}: {
    title: string;
    subtitle: string;
    view: ViewerView;
    onView: (view: ViewerView) => void;
    drillCount: number;
    /** The Placement button's text; undefined when the package has no position file. */
    placementLabel?: string;
    side: ViewSide;
    onSide: (side: ViewSide) => void;
    hasParts: boolean;
    showParts: boolean;
    onToggleParts: () => void;
    onZoom: (factor: number) => void;
    onFit: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {view === "board" && (
                    <>
                        <Segments label="Zoom">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onZoom(1 / ZOOM_STEP)}
                                aria-label="Zoom out"
                            >
                                <ZoomOut className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onZoom(ZOOM_STEP)}
                                aria-label="Zoom in"
                            >
                                <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={onFit}
                                aria-label="Fit board"
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                        </Segments>
                        <Segments label="Board side">
                            <Segment active={side === "top"} onClick={() => onSide("top")}>Top</Segment>
                            <Segment active={side === "bottom"} onClick={() => onSide("bottom")}>Bottom</Segment>
                        </Segments>
                        {hasParts && (
                            <Segments label="Part markers">
                                <Segment active={showParts} onClick={onToggleParts}>Parts</Segment>
                            </Segments>
                        )}
                    </>
                )}
                <Segments label="Fabrication views">
                    <Segment active={view === "board"} onClick={() => onView("board")}>Board</Segment>
                    <Segment active={view === "drill"} onClick={() => onView("drill")}>
                        Drill ({drillCount})
                    </Segment>
                    {placementLabel !== undefined && (
                        <Segment active={view === "placement"} onClick={() => onView("placement")}>
                            {placementLabel}
                        </Segment>
                    )}
                </Segments>
            </div>
        </div>
    );
}
