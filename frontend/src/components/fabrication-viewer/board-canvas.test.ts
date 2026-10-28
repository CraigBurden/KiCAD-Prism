import { describe, expect, it } from "vitest";

import { toRect, withMargin } from "./board-canvas";

describe("board rectangles", () => {
    it("turns bounds into a rectangle", () => {
        expect(toRect([10, -20, 50, 0])).toEqual({ x: 10, y: -20, width: 40, height: 20 });
    });

    it("pads each side, keeping the centre", () => {
        const padded = withMargin({ x: 0, y: 0, width: 100, height: 50 }, 0.1);
        expect(padded).toEqual({ x: -10, y: -5, width: 120, height: 60 });
        expect(padded.x + padded.width / 2).toBe(50);
        expect(padded.y + padded.height / 2).toBe(25);
    });
});
