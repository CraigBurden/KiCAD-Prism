import type { ReactNode } from "react";

import { Pane } from "@/components/design-comparison/fabrication-panel";
import type { BoardRect, useBoardViewport } from "@/components/design-comparison/fabrication-viewport";

import type { FabricationLayer } from "./types";
import type { LayerImage } from "./use-fabrication-data";

export type Viewport = ReturnType<typeof useBoardViewport>;

export function toRect(box: readonly [number, number, number, number]): BoardRect {
    return { x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] };
}

/** Breathing room around the board when fitted, as a share of each side. */
const FIT_MARGIN = 0.04;

/**
 * The rectangle the view fits to. Fitting the profile exactly puts its outer
 * edges on the pane border, where they are clipped away.
 */
export function withMargin(rect: BoardRect, margin = FIT_MARGIN): BoardRect {
    const dx = rect.width * margin;
    const dy = rect.height * margin;
    return { x: rect.x - dx, y: rect.y - dy, width: rect.width + 2 * dx, height: rect.height + 2 * dy };
}

/**
 * The visible layers stacked on one board rectangle, in the pane Design Comparison
 * draws its fabrication layers in.
 *
 * Every layer is fully opaque in its own colour, and the caller passes the layers
 * to draw (`paintOrder` or `soloStack`), in painting order. Nothing is blended or
 * faded: a layer is its swatch colour wherever it is drawn.
 */
export function BoardCanvas({
    label,
    board,
    drawn,
    layers,
    images,
    mirrored,
    viewport,
    overlay,
}: {
    label: string;
    board: BoardRect;
    drawn: BoardRect;
    /** The layers to draw, in the order to paint them: farthest first. */
    layers: FabricationLayer[];
    images: Record<string, LayerImage>;
    mirrored: boolean;
    /** Camera and pointer handlers, owned by the parent so it can move the camera. */
    viewport: Viewport;
    /** Drawn over the layers, in the same rectangle; given the current pixels per millimetre. */
    overlay?: (pxPerMm: number) => ReactNode;
}) {
    const loading = layers.some((layer) => images[layer.id]?.status === "loading");
    const failed = layers.filter((layer) => images[layer.id]?.status === "error");

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1">
            <Pane
                label={label}
                drawn={drawn}
                board={board}
                camera={viewport.view}
                handlers={viewport.handlers}
                panning={viewport.panning}
                mirrored={mirrored}
                className="bg-black"
            >
                {(pxPerMm) => (
                    <>
                        {layers.map((layer) => {
                            const image = images[layer.id];
                            if (image?.status !== "ready") return null;
                            return (
                                <img
                                    key={layer.id}
                                    src={image.url}
                                    alt={layer.name}
                                    draggable={false}
                                    decoding="async"
                                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                                />
                            );
                        })}
                        {overlay?.(pxPerMm)}
                    </>
                )}
            </Pane>
            <div className="pointer-events-none absolute left-2 top-7 flex flex-col gap-1">
                {layers.length === 0 && (
                    <p className="text-xs text-muted-foreground">No layers shown</p>
                )}
                {loading && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loading layers</p>
                )}
                {failed.length > 0 && (
                    <p role="alert" className="text-xs text-destructive">
                        Could not load {failed.map((layer) => layer.name).join(", ")}
                    </p>
                )}
            </div>
        </div>
    );
}
