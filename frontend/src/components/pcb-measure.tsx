import { useCallback, useEffect, useState } from "react";
import { Ruler, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KeyCap } from "@/components/keyboard-shortcuts-dialog";
import { shortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useCommittedRef } from "@/hooks/use-committed-ref";
import { useEcadViewer, type EcadViewer } from "@/lib/ecad-viewer";
import type { EcadMeasureSnap, EcadMeasureUnits } from "@/types/ecad-viewer";

export const MEASURE_SHORTCUT = "mod+shift+m";
export const MEASURE_UNITS_STORAGE_KEY = "prism.pcb.measure-units";
const MM_PER_MIL = 0.0254;

/** 3 decimals in millimetres, 1 in mils, as the viewer's label. */
export function formatLength(mm: number, units: EcadMeasureUnits): string {
    return units === "mil" ? (mm / MM_PER_MIL).toFixed(1) : mm.toFixed(3);
}

/**
 * Measure mode of the PCB element. Mirrors the element's state and its
 * change event, so Cmd/Ctrl+Shift+M and the rail button always agree.
 */
export function useMeasureMode(viewer: EcadViewer | null) {
    const { measureMode: on, measureAvailable: available } = useEcadViewer(viewer);
    const toggle = useCallback(() => viewer?.setMeasureMode(!on), [on, viewer]);
    return { on, toggle, available };
}

function readStoredUnits(): EcadMeasureUnits {
    try {
        return window.localStorage.getItem(MEASURE_UNITS_STORAGE_KEY) === "mil" ? "mil" : "mm";
    } catch {
        return "mm";
    }
}

/**
 * The reviewer's mm/mil choice, kept per browser. The element hears it each
 * time measure mode turns on (by button or key) and on every change.
 */
export function useMeasureUnits(viewer: EcadViewer | null) {
    const [units, setUnits] = useState<EcadMeasureUnits>(readStoredUnits);
    const unitsRef = useCommittedRef(units);
    useEffect(() => {
        if (!viewer) return;
        const off = viewer.on("measure-mode", ({ on }) => {
            if (on) viewer.setMeasureUnits(unitsRef.current);
        });
        return () => off();
    }, [viewer, unitsRef]);
    const choose = useCallback((next: EcadMeasureUnits) => {
        setUnits(next);
        viewer?.setMeasureUnits(next);
        try {
            window.localStorage.setItem(MEASURE_UNITS_STORAGE_KEY, next);
        } catch {
            // Storage blocked: the choice lasts for this page only.
        }
    }, [viewer]);
    return [units, choose] as const;
}

export function MeasureModeToggle({ viewer }: { viewer: EcadViewer | null }) {
    const { on, toggle, available } = useMeasureMode(viewer);
    if (!available) return null;
    return (
        <Button
            variant={on ? "secondary" : "ghost"}
            size="icon"
            className={cn("size-8", on && "text-primary")}
            onClick={toggle}
            aria-pressed={on}
            aria-label="Measure"
            title={`Measure · ${shortcutKeys(MEASURE_SHORTCUT).join("")}`}
        >
            <Ruler className="size-4" />
        </Button>
    );
}

function snapName(snap: EcadMeasureSnap): string {
    return snap.label || "point";
}

/**
 * The readout under the board while measure mode is on: the two ends, the
 * distance, ΔX, ΔY and the angle, the units, and the way out.
 */
export function MeasureReadout({ viewer }: { viewer: EcadViewer | null }) {
    const { on } = useMeasureMode(viewer);
    const state = useEcadViewer(viewer).measureState;
    const [units, setUnits] = useMeasureUnits(viewer);
    if (!on) return null;
    const measurement = state?.measurement ?? null;
    const unit = units === "mil" ? "mil" : "mm";
    return (
        <section
            aria-label="Measure"
            className="pointer-events-auto flex max-w-full items-center gap-2 border bg-background/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur-sm"
        >
            <Ruler className="size-3.5 shrink-0 text-primary" aria-hidden />
            {measurement ? (
                <>
                    <span className="min-w-0 truncate" title={[measurement.a, measurement.b].map((snap) => [snapName(snap), snap.net].filter(Boolean).join(" · ")).join(" → ")}>
                        {snapName(measurement.a)} → {snapName(measurement.b)}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-primary" aria-label="Distance">
                        {formatLength(measurement.distance, units)} {unit}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        ΔX <span className="text-foreground">{formatLength(measurement.dx, units)}</span>{" "}
                        ΔY <span className="text-foreground">{formatLength(measurement.dy, units)}</span>{" "}
                        ∠ <span className="text-foreground">{measurement.angle.toFixed(2)}°</span>
                    </span>
                </>
            ) : (
                <span className="font-mono text-muted-foreground" aria-label="Distance">—</span>
            )}
            <div className="flex shrink-0 border" role="group" aria-label="Units">
                {(["mm", "mil"] as const).map((option) => (
                    <Button
                        key={option}
                        type="button"
                        variant={units === option ? "secondary" : "ghost"}
                        size="xs"
                        aria-pressed={units === option}
                        onClick={() => setUnits(option)}
                    >
                        {option}
                    </Button>
                ))}
            </div>
            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                {shortcutKeys(MEASURE_SHORTCUT).map((key) => (
                    <KeyCap key={key}>{key}</KeyCap>
                ))}
            </span>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6"
                aria-label="Leave measure mode"
                title="Leave measure mode"
                onClick={() => viewer?.setMeasureMode(false)}
            >
                <X className="size-3.5" aria-hidden />
            </Button>
        </section>
    );
}
