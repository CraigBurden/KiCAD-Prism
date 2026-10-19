import { useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/api";
import type { PrismAnalyticOverlay, PrismSemanticViewerElement } from "@/types/prism-semantic-viewer";

import { packGrid, packNets, packOf, packRange, packValues, type PackGrid, type QuantityPack } from "./quantity-pack";
import type { DcDropAnalysis, SimRun, SimSetup } from "./types";

export const runBase = (projectId: string, runId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/sim/a0/runs/${encodeURIComponent(runId)}`;

export interface ResultArtifact {
    kind: string;
    path: string;
    quantity?: string;
}

interface LoadedOverlay {
    overlay: PrismAnalyticOverlay;
    quantity: string;
    units: string;
    range: [number, number];
    count: number;
}

export interface LoadedGrid {
    grid: PackGrid;
    quantity: string;
    units: string;
    range: [number, number];
    count: number;
}

const QUANTITY_PACK = "quantity-pack";

/** The run's pack of `quantity`, if it published one. */
export function quantityArtifact(artifacts: ResultArtifact[], quantity: string): ResultArtifact | undefined {
    return artifacts.find((item) => item.kind === QUANTITY_PACK && item.quantity === quantity);
}

/** Every pack of a run, fetched and inflated together when its result opens: switching needs no fetch. */
export async function loadPacks(base: string, artifacts: ResultArtifact[]): Promise<Map<string, QuantityPack>> {
    const packs = artifacts.filter((item) => item.kind === QUANTITY_PACK && item.quantity);
    const loaded = await Promise.all(packs.map((item) => packOf(base, item.path)));
    return new Map(packs.map((item, k) => [item.quantity as string, loaded[k]]));
}

const finite = (grid: PackGrid) => grid.slices.reduce((sum, slice) => sum + slice.values.filter(Number.isFinite).length, 0);

/** A field's rasters on `net` (the pack's first net when null), with its range. */
export function gridOf(pack: QuantityPack, net: string | null): LoadedGrid | null {
    const grid = packGrid(pack, net);
    if (!grid) return null;
    const range = packRange(pack, grid.net) ?? [0, 1];
    return { grid, quantity: pack.header.quantity.name, units: pack.header.quantity.unit, range, count: finite(grid) };
}

/**
 * The colour range of a magnitude: zero up to the `share` quantile of its
 * values, so a few hot spots at pad edges do not wash out every path.
 */
export function clippedRange(slices: { values: Float32Array }[], share = 0.995): [number, number] {
    const values: number[] = [];
    for (const slice of slices) for (const v of slice.values) if (Number.isFinite(v)) values.push(v);
    if (!values.length) return [0, 1];
    values.sort((a, b) => a - b);
    const top = values[Math.min(values.length - 1, Math.floor(share * values.length))];
    return [0, top > 0 ? top : values[values.length - 1] || 1];
}

/**
 * A pack as the viewer's overlay: `net`'s rasters on their slices, with the
 * per-operation values colouring what no raster covers (the via barrels);
 * a pack without rasters is per-operation values alone.
 */
export function packOverlay(pack: QuantityPack, net: string | null): LoadedOverlay {
    const { name: quantity, unit: units } = pack.header.quantity;
    const values = packValues(pack);
    const loaded = gridOf(pack, net);
    if (!loaded) {
        const items = pack.header.items?.value_range;
        const range: [number, number] = items ? [items.min, items.max] : [0, 1];
        return {
            overlay: { kind: "operation_values", quantity, units, values: values ?? {}, range },
            quantity, units, range, count: pack.header.items?.count ?? 0,
        };
    }
    const range = quantity === "voltage_v" ? loaded.range : clippedRange(loaded.grid.slices);
    return {
        overlay: { kind: "field_grid", quantity, units, grid: loaded.grid, range, ...(values ? { values } : {}) },
        quantity, units, range, count: loaded.count,
    };
}

/** Scalar fields the result view can colour the copper with. */
export const FIELD_QUANTITIES = {
    voltage_v: "Voltage",
    current_density_a_per_m2: "Current density",
    power_density_w_per_m3: "Power density",
} as const;
export type FieldQuantity = keyof typeof FIELD_QUANTITIES;

/** The current density's components, for arrows. */
const VECTOR_X = "current_density_x_a_per_m2";
const VECTOR_Y = "current_density_y_a_per_m2";

/** Nets a result published fields for, in its order (from its voltage pack); empty for single-net results. */
export function netsWithFields(packs: Map<string, QuantityPack>): string[] {
    const voltage = packs.get("voltage_v") ?? [...packs.values()].find((pack) => pack.header.grid);
    return voltage ? packNets(voltage).filter((net): net is string => net !== null) : [];
}

/** Which fields a result published. */
export function availableFields(artifacts: ResultArtifact[]): { scalars: FieldQuantity[]; vectors: boolean } {
    const packs = new Set(artifacts.flatMap((a) => (a.kind === QUANTITY_PACK ? [a.quantity] : [])));
    return {
        scalars: (Object.keys(FIELD_QUANTITIES) as FieldQuantity[]).filter((q) => packs.has(q)),
        vectors: packs.has(VECTOR_X) && packs.has(VECTOR_Y),
    };
}
export interface ConverterResult {
    converter: string;
    input_voltage_v: number;
    input_current_a: number;
    input_power_w: number;
    output_voltage_v: number;
    output_current_a: number;
    output_power_w: number;
    loss_w: number;
    iterations: number;
    converged: boolean;
}

export interface LoadResult {
    load: string;
    min_voltage_v: number;
    max_voltage_v: number;
    max_drop_v: number;
    rail?: string;
    supply_drop_v?: number;
    return_drop_v?: number;
}

export interface RunResult {
    status: string;
    engine: { id: string; engine_version: string };
    summary?: {
        loads: LoadResult[];
        sources: { source: string; current_a: number }[];
        converters?: ConverterResult[];
        copper_loss_w?: number;
        max_current_density_a_per_m2?: number;
        probes: { probe: string; voltage_v: number }[];
        nets?: { net: string; copper_loss_w: number; max_current_density_a_per_m2: number }[];
    };
    realization?: RunRealization;
    artifacts: ResultArtifact[];
}

/** The parts of a DC engine's realization the result view shows. */
export interface RunRealization {
    grids?: { dx_m: number; dy_m: number }[];
    mesh?: {
        unknowns: number;
        budget_mode: string;
        adaptive?: {
            passes: { unknowns: number; max_level: number; relative_estimate: number }[];
            stop: string;
            min_cell_m: number;
        };
    };
    solver?: { backend: string; unknowns: number };
}

export type RunOverlayState =
    | { phase: "off" }
    | { phase: "loading" }
    | {
        phase: "ready";
        quantity: string;
        units: string;
        range: [number, number];
        count: number;
        nets: string[];
        result: RunResult;
        /** Every pack of the run, by quantity. */
        packs: Map<string, QuantityPack>;
        fields: { scalars: FieldQuantity[]; vectors: boolean };
        arrows: { count: number; max: number; reference: number } | null;
        /** Nets the result has fields for, and the one shown. */
        fieldNets: string[];
        net: string | null;
    }
    | { phase: "failed"; error: string };

/** Net names of the rails the run's analysis solved, from its frozen setup. */
export function solvedNets(setup: SimSetup, analysisId: string): string[] {
    const analysis = setup.analyses.find((item: DcDropAnalysis) => item.id === analysisId);
    const rails = new Set(analysis?.rails ?? []);
    return setup.rails.flatMap((rail) => (rails.has(rail.id) ? [rail.net.slice(rail.net.indexOf(":") + 1)] : []));
}

/**
 * Shows a run's result on the viewer once its board is drawn (`packReady`;
 * the viewer draws the commit's design bundle, the one the run solved): colours the copper with the field `quantity`, draws the
 * current's arrows while `arrows` is set, and isolates the nets the analysis
 * solved, so only that copper shows. The viewer's result colours outrank
 * its lit-net glow. Clears all of it when the run changes.
 */
export function useRunOverlay(
    viewer: PrismSemanticViewerElement | null,
    packReady: boolean,
    projectId: string,
    run: SimRun | null,
    quantity: FieldQuantity = "voltage_v",
    arrows = false,
    net: string | null = null,
): RunOverlayState {
    const [loaded, setLoaded] = useState<{ result: RunResult; nets: string[]; packs: Map<string, QuantityPack> } | null>(null);
    // The nets isolated on the viewer: the shown net, or every solved rail.
    const isolated = useRef<string[]>([]);
    const [state, setState] = useState<RunOverlayState>({ phase: "off" });
    const runId = run?.run_id ?? null;
    const analysisId = run?.analysis_id ?? "";
    const live = Boolean(viewer && packReady && runId && typeof viewer.setAnalyticOverlay === "function");

    // The result and setup, and the solved nets isolated.
    useEffect(() => {
        setLoaded(null);
        if (!live || !viewer || !runId) {
            setState({ phase: "off" });
            return;
        }
        let cancelled = false;
        let nets: string[] | null = null;
        const stopIsolating = () => {
            viewer.removeEventListener("prism-semantic-viewer:viewstatechange", isolate);
            viewer.removeEventListener("prism-semantic-viewer:ready", isolate);
        };
        // Once the solved nets are known. The viewer loads its net table
        // progressively, so isolation takes once the nets resolve, until the
        // reviewer isolates a net of their own.
        const isolate = () => {
            if (!nets) return;
            if (cancelled || viewer.getViewState?.()?.isolateNet) {
                stopIsolating();
                return;
            }
            viewer.setHighlightedNets?.(isolated.current.map((netName) => ({ netName })));
            viewer.setNetIsolation?.(true);
        };
        viewer.addEventListener("prism-semantic-viewer:viewstatechange", isolate);
        viewer.addEventListener("prism-semantic-viewer:ready", isolate);
        setState({ phase: "loading" });
        void (async () => {
            try {
                const base = runBase(projectId, runId);
                const [result, setup] = await Promise.all([
                    fetchJson<RunResult>(`${base}/result`),
                    fetchJson<SimSetup>(`${base}/setup`),
                ]);
                const packs = await loadPacks(base, result.artifacts);
                if (cancelled) return;
                nets = solvedNets(setup, analysisId);
                if (!isolated.current.length) isolated.current = nets;
                isolate();
                setLoaded({ result, nets, packs });
            } catch (error) {
                if (!cancelled) setState({ phase: "failed", error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return () => {
            cancelled = true;
            stopIsolating();
            viewer.setAnalyticOverlay?.(null);
            viewer.setAnalyticVectors?.(null);
            viewer.setNetIsolation?.(false);
            viewer.setHighlightedNets?.([]);
        };
    }, [analysisId, live, projectId, runId, viewer]);

    // The net shown: the one asked for, else the first solved rail with fields.
    const fieldNets = loaded ? netsWithFields(loaded.packs) : [];
    const solvedSet = loaded ? new Set(loaded.nets) : null;
    const shown = !fieldNets.length ? null
        : net && fieldNets.includes(net) ? net
        : fieldNets.find((n) => solvedSet?.has(n)) ?? fieldNets[0];
    useEffect(() => {
        if (!loaded || !viewer) return;
        isolated.current = shown ? [shown] : loaded.nets;
        // react-doctor-disable-next-line no-pass-data-to-parent, no-pass-live-state-to-parent - `viewer` is the element adapter, not a parent callback
        viewer.setHighlightedNets?.(isolated.current.map((netName) => ({ netName })));
        viewer.setNetIsolation?.(true);
    }, [loaded, shown, viewer]);

    // The colours: the chosen field, or voltage when the run has no such field.
    // Every pack is already loaded, so this is a viewer call, not a fetch.
    const [colours, setColours] = useState<LoadedOverlay | null>(null);
    useEffect(() => {
        // react-doctor-disable-next-line no-adjust-state-on-prop-change - `colours` mirrors what this effect draws on the viewer, an external system
        setColours(null);
        if (!loaded || !viewer) return;
        const pack = loaded.packs.get(quantity) ?? loaded.packs.get("voltage_v");
        if (!pack) {
            // react-doctor-disable-next-line no-adjust-state-on-prop-change - the overlay the viewer could not be given
            setState({ phase: "failed", error: "The run has no voltage result" });
            return;
        }
        try {
            const next = packOverlay(pack, shown);
            // react-doctor-disable-next-line no-pass-data-to-parent, no-pass-live-state-to-parent - `viewer` is the element adapter, not a parent callback
            viewer.setAnalyticOverlay(next.overlay);
            setColours(next);
        } catch (error) {
            setState({ phase: "failed", error: error instanceof Error ? error.message : String(error) });
        }
    }, [loaded, quantity, shown, viewer]);

    // The arrows.
    const [drawn, setDrawn] = useState<{ count: number; max: number; reference: number } | null>(null);
    useEffect(() => {
        setDrawn(null);
        if (!loaded || !viewer || typeof viewer.setAnalyticVectors !== "function") return;
        const x = loaded.packs.get(VECTOR_X);
        const y = loaded.packs.get(VECTOR_Y);
        const gx = arrows && x ? packGrid(x, shown) : null;
        const gy = arrows && y ? packGrid(y, shown) : null;
        if (!gx || !gy) {
            viewer.setAnalyticVectors(null);
            return;
        }
        const placed = viewer.setAnalyticVectors({ quantity: "current_density_a_per_m2", units: x?.header.quantity.unit ?? "A/m^2", x: gx, y: gy });
        setDrawn(placed ? { count: placed.count, max: placed.max, reference: placed.reference } : null);
        return () => { viewer.setAnalyticVectors(null); };
    }, [arrows, loaded, shown, viewer]);

    useEffect(() => {
        if (!loaded || !colours) return;
        setState({
            phase: "ready",
            quantity: colours.quantity,
            units: colours.units,
            range: colours.range,
            count: colours.count,
            nets: loaded.nets,
            result: loaded.result,
            packs: loaded.packs,
            fields: availableFields(loaded.result.artifacts),
            arrows: drawn,
            fieldNets: netsWithFields(loaded.packs),
            net: shown,
        });
    }, [colours, drawn, loaded, shown]);

    return state;
}
