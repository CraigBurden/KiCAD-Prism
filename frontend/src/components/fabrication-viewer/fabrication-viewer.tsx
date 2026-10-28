import { useCallback, useMemo, useReducer, useState } from "react";

import { useBoardViewport } from "@/components/design-comparison/fabrication-viewport";

import { BoardCanvas, toRect, withMargin } from "./board-canvas";
import { DrillTable } from "./drill-table";
import { LayersRail } from "./layers-rail";
import { PartMarkers } from "./part-markers";
import { PlacementPanel } from "./placement-panel";
import type { FabricationSource, FabricationView, PlacementPart } from "./types";
import { useFabricationView, useLayerImages } from "./use-fabrication-data";
import { usePlacement } from "./use-placement";
import { ViewerFooter } from "./viewer-footer";
import { initialState, paintOrder, soloStack, viewerReducer, type LayerPreset } from "./viewer-state";
import { ViewerToolbar, type ViewerView } from "./viewer-toolbar";

/** Half the width of the square framed around a picked part, in millimetres. */
const PICK_FRAME_MM = 2;

function summaryOf(view: FabricationView): string {
    return [
        view.size ? `${view.size.width.toFixed(1)} × ${view.size.height.toFixed(1)} mm` : null,
        view.copperLayers ? `${view.copperLayers} copper layers` : null,
        view.drill.holes ? `${view.drill.holes} holes` : null,
    ].filter(Boolean).join(" · ");
}

const TITLES: Record<ViewerView, string> = { board: "Board", drill: "Drill", placement: "Placement" };

function LoadedViewer({ source, view, focusFile }: {
    source: FabricationSource;
    view: FabricationView;
    focusFile?: string;
}) {
    const [state, dispatch] = useReducer(viewerReducer, undefined, () => initialState(view.layers, focusFile));
    const [mode, setMode] = useState<ViewerView>("board");
    const placement = usePlacement(source);
    const parts = placement.status === "ready" ? placement.data : null;

    const shown = useMemo(
        () => view.layers.filter((layer) => state.visible.has(layer.id)),
        [view.layers, state.visible],
    );
    const highlighted = view.layers.find((layer) => layer.id === state.highlighted) ?? null;
    const painted = useMemo(
        () => highlighted ? soloStack(view.layers, highlighted) : paintOrder(shown, state.side),
        [highlighted, view.layers, shown, state.side],
    );
    const paintedIds = useMemo(() => painted.map((layer) => layer.id), [painted]);
    const images = useLayerImages(source, paintedIds, view.renderVersion);

    const drawn = view.bounds ? toRect(view.bounds) : null;
    const fitted = view.board ? toRect(view.board) : drawn;
    const board = fitted ? withMargin(fitted) : null;
    const mirrored = state.side === "bottom";
    const viewport = useBoardViewport(board, { mirrorX: mirrored });

    // A part that is not in the BOM is not part of the build, so it is left off the
    // board; it stays in the table, where the check lists it. A part you picked is
    // always drawn, so a pick from the table never lands on an empty spot.
    const sideParts = useMemo(
        () => parts && state.showParts
            ? parts.parts.filter((part) =>
                part.side === state.side
                && (part.status !== "not-in-bom" || part.ref === state.selected))
            : [],
        [parts, state.showParts, state.side, state.selected],
    );
    const picked = parts?.parts.find((part) => part.ref === state.selected) ?? null;

    // Stable callbacks: the camera changes on every pan frame, and the rail, the
    // markers and the parts table must not re-render with it.
    const { frame } = viewport;
    const pick = useCallback((part: PlacementPart) => {
        dispatch({ type: "select", ref: part.ref, side: part.side, layers: view.layers });
        frame({
            x: part.x - PICK_FRAME_MM,
            y: part.y - PICK_FRAME_MM,
            width: PICK_FRAME_MM * 2,
            height: PICK_FRAME_MM * 2,
        });
    }, [view.layers, frame]);
    const pickFromTable = useCallback((part: PlacementPart) => {
        pick(part);
        setMode("board");
    }, [pick]);
    const onToggle = useCallback((id: string) => dispatch({ type: "toggle", id }), []);
    const onHighlight = useCallback((id: string) => dispatch({ type: "highlight", id }), []);
    const onPreset = useCallback(
        (preset: LayerPreset) => dispatch({ type: "preset", preset, layers: view.layers }),
        [view.layers],
    );

    const withWarnings = shown.filter((layer) => layer.warnings.length > 0);
    const note = highlighted
        ? [highlighted.file, ...highlighted.warnings].join(" · ")
        : withWarnings.length > 0
            ? `${withWarnings.map((layer) => layer.name).join(", ")}: ${withWarnings[0]!.warnings[0]}`
            : "";

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1">
            {/* Hidden, not unmounted, outside the board view: tables get the width and
                the rail keeps its collapsed state and size. */}
            <div className={mode === "board" ? "contents" : "hidden"}>
                <LayersRail
                    layers={view.layers}
                    visible={state.visible}
                    highlighted={state.highlighted}
                    onToggle={onToggle}
                    onHighlight={onHighlight}
                    onPreset={onPreset}
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <ViewerToolbar
                    title={mode === "board" ? (highlighted?.name ?? TITLES.board) : TITLES[mode]}
                    subtitle={mode === "board" && highlighted ? highlighted.function || highlighted.role : summaryOf(view)}
                    view={mode}
                    onView={setMode}
                    drillCount={view.drill.holes}
                    placementLabel={
                        parts ? `Placement (${parts.counts.placed})`
                            : placement.status === "error" ? "Placement" : undefined
                    }
                    side={state.side}
                    onSide={(side) => dispatch({ type: "side", side, layers: view.layers })}
                    hasParts={parts !== null}
                    showParts={state.showParts}
                    onToggleParts={() => dispatch({ type: "parts" })}
                    onZoom={(factor) => viewport.zoomBy(factor)}
                    onFit={viewport.reset}
                />
                <div className="flex min-h-0 min-w-0 flex-1 gap-2 p-3">
                    {mode === "board" && (board && drawn ? (
                        <BoardCanvas
                            label={mirrored ? "Bottom (mirrored)" : "Top"}
                            board={board}
                            drawn={drawn}
                            layers={painted}
                            images={images}
                            mirrored={mirrored}
                            viewport={viewport}
                            overlay={sideParts.length > 0
                                ? (pxPerMm) => (
                                    <PartMarkers
                                        parts={sideParts}
                                        drawn={drawn}
                                        pxPerMm={pxPerMm}
                                        selected={state.selected}
                                        mirrored={mirrored}
                                        onSelect={pick}
                                    />
                                )
                                : undefined}
                        />
                    ) : (
                        <p className="p-3 text-sm text-muted-foreground">
                            The layers in this package have no geometry to draw.
                        </p>
                    ))}
                    {mode === "drill" && <DrillTable drill={view.drill} />}
                    {mode === "placement" && placement.status === "error" && (
                        <p role="alert" className="p-3 text-sm text-destructive">{placement.message}</p>
                    )}
                    {/* Kept mounted so its search and filters survive a look at the board. */}
                    {parts && (
                        <div className={mode === "placement" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}>
                            <PlacementPanel
                                view={parts}
                                selected={state.selected}
                                onSelect={pickFromTable}
                            />
                        </div>
                    )}
                </div>
                <ViewerFooter
                    picked={picked}
                    note={mode === "board" ? note : ""}
                    zoomPercent={mode === "board" ? Math.round(viewport.view.scale * 100) : undefined}
                    onClear={() => dispatch({ type: "select", ref: null, layers: view.layers })}
                />
            </div>
        </div>
    );
}

/**
 * A fabrication package as a board: layers with the Visualizer's menu, top and
 * bottom, pan and zoom, the drill table, and the pick-and-place parts when the
 * source has them. Source-agnostic; key it on `source.key`.
 */
export function FabricationViewer({ source, focusFile }: {
    source: FabricationSource;
    /** Open on one file's layer instead of the default selection. */
    focusFile?: string;
}) {
    const loaded = useFabricationView(source);
    if (loaded.status === "loading") {
        return <p className="p-3 text-sm text-muted-foreground">Loading fabrication package...</p>;
    }
    if (loaded.status === "error") {
        return <p role="alert" className="p-3 text-sm text-destructive">{loaded.message}</p>;
    }
    return <LoadedViewer source={source} view={loaded.view} focusFile={focusFile} />;
}
