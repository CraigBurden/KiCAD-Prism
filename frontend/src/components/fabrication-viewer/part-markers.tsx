import { memo } from "react";

import type { BoardRect } from "@/components/design-comparison/fabrication-viewport";

import { isProblem, STATUS_COLOUR } from "./part-status";
import type { PlacementPart } from "./types";

/** Sizes are in screen pixels, so a marker reads the same at any zoom. */
const DOT_PX = 3;
const ARROW_PX = 9;
const HIT_PX = 8;
const SELECTED_PX = 6;
const RING_PX = 6;
const LABEL_PX = 12;

/**
 * Where each part is and which way it faces, over the board.
 *
 * Positions are board millimetres in the same Y-down frame as the layers, so
 * the overlay shares their rectangle exactly. The arrow is the part's own zero
 * angle turned by its rotation; rotation is counter-clockwise on a Y-up board,
 * which is clockwise-negative here. A part the BOM check flagged also gets a
 * ring, so the finding does not rest on colour alone.
 */
export const PartMarkers = memo(function PartMarkers({
    parts,
    drawn,
    pxPerMm,
    selected,
    mirrored,
    onSelect,
}: {
    parts: PlacementPart[];
    drawn: BoardRect;
    pxPerMm: number;
    selected: string | null;
    /** The pane is flipped, so text has to be flipped back to stay readable. */
    mirrored: boolean;
    onSelect: (part: PlacementPart) => void;
}) {
    if (!pxPerMm) return null;
    const mm = (px: number) => px / pxPerMm;
    return (
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`${drawn.x} ${drawn.y} ${drawn.width} ${drawn.height}`}
            preserveAspectRatio="none"
            aria-label="Parts"
        >
            {parts.map((part) => {
                const chosen = part.ref === selected;
                const angle = (part.rotation * Math.PI) / 180;
                const reach = mm(chosen ? ARROW_PX * 1.6 : ARROW_PX);
                const colour = chosen ? "#ffffff" : STATUS_COLOUR[part.status];
                return (
                    <g key={`${part.side}:${part.ref}`}>
                        <title>{`${part.ref}  ${part.value}  ${part.package}  ${part.rotation} deg`}</title>
                        <line
                            x1={part.x}
                            y1={part.y}
                            x2={part.x + Math.cos(angle) * reach}
                            y2={part.y - Math.sin(angle) * reach}
                            stroke={colour}
                            strokeWidth={mm(chosen ? 2 : 1)}
                            strokeLinecap="round"
                        />
                        {isProblem(part.status) && !chosen && (
                            <circle
                                cx={part.x}
                                cy={part.y}
                                r={mm(RING_PX)}
                                fill="none"
                                stroke={colour}
                                strokeWidth={mm(1.5)}
                            />
                        )}
                        <circle
                            cx={part.x}
                            cy={part.y}
                            r={mm(chosen ? SELECTED_PX : DOT_PX)}
                            fill={chosen ? "none" : colour}
                            stroke={colour}
                            strokeWidth={mm(chosen ? 2 : 0)}
                        />
                        <circle
                            cx={part.x}
                            cy={part.y}
                            r={mm(HIT_PX)}
                            fill="transparent"
                            className="cursor-pointer"
                            // A click picks the part; a press that moves pans the board, which
                            // then captures the pointer, so no click reaches the marker.
                            onClick={() => onSelect(part)}
                        />
                        {chosen && (
                            <text
                                transform={`translate(${part.x + mm(10)} ${part.y - mm(10)}) scale(${mirrored ? -1 : 1} 1)`}
                                fontSize={mm(LABEL_PX)}
                                fill="#ffffff"
                                stroke="#000000"
                                strokeWidth={mm(3)}
                                paintOrder="stroke"
                                textAnchor={mirrored ? "end" : "start"}
                            >
                                {part.ref}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
});
