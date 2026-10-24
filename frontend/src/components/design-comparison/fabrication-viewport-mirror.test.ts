import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBoardViewport } from "./fabrication-viewport";

const BOARD = { x: 0, y: 0, width: 100, height: 100 };
const PANE = { width: 400, height: 400, left: 0, top: 0 };

// A 100 mm board in a 400 px pane fits at 4 px/mm.
const box = { getBoundingClientRect: () => PANE, setPointerCapture: () => undefined };
const press = { preventDefault: () => undefined, currentTarget: box };

function drag(handlers: ReturnType<typeof useBoardViewport>["handlers"], dx: number) {
    act(() => {
        handlers.onPointerDown({
            ...press, button: 0, pointerId: 1, clientX: 100, clientY: 100,
        } as never);
        handlers.onPointerMove({
            pointerId: 1, clientX: 100 + dx, clientY: 100, currentTarget: box,
        } as never);
    });
}

describe("board viewport, mirrored", () => {
    it("pans so the content follows the pointer", () => {
        const plain = renderHook(() => useBoardViewport(BOARD));
        drag(plain.result.current.handlers, 40);
        // Dragging right pulls the view left over the board: the centre moves to lower x.
        expect(plain.result.current.view.cx).toBeCloseTo(40);

        const mirrored = renderHook(() => useBoardViewport(BOARD, { mirrorX: true }));
        drag(mirrored.result.current.handlers, 40);
        // On screen the board is flipped, so the same drag moves the centre the other way.
        expect(mirrored.result.current.view.cx).toBeCloseTo(60);
    });

    it("leaves vertical panning alone", () => {
        const mirrored = renderHook(() => useBoardViewport(BOARD, { mirrorX: true }));
        act(() => {
            mirrored.result.current.handlers.onPointerDown({
                ...press, button: 0, pointerId: 1, clientX: 0, clientY: 0,
            } as never);
            mirrored.result.current.handlers.onPointerMove({
                pointerId: 1, clientX: 0, clientY: 40, currentTarget: box,
            } as never);
        });
        expect(mirrored.result.current.view.cy).toBeCloseTo(40);
        expect(mirrored.result.current.view.cx).toBeCloseTo(50);
    });

    it("a press that barely moves is a click: no pan, no capture; past the threshold it pans", () => {
        const captured: number[] = [];
        const target = { ...box, setPointerCapture: (id: number) => captured.push(id) };
        const { result } = renderHook(() => useBoardViewport(BOARD));
        act(() => {
            result.current.handlers.onPointerDown({
                ...press, currentTarget: target, button: 0, pointerId: 7, clientX: 100, clientY: 100,
            } as never);
            result.current.handlers.onPointerMove({
                pointerId: 7, clientX: 102, clientY: 100, currentTarget: target,
            } as never);
        });
        expect(captured).toEqual([]);
        expect(result.current.view.cx).toBeCloseTo(50);

        act(() => {
            result.current.handlers.onPointerMove({
                pointerId: 7, clientX: 120, clientY: 100, currentTarget: target,
            } as never);
        });
        expect(captured).toEqual([7]);
        expect(result.current.view.cx).toBeCloseTo(45);
    });

    it("keeps the board point under the cursor fixed while zooming", () => {
        for (const mirrorX of [false, true]) {
            const { result } = renderHook(() => useBoardViewport(BOARD, { mirrorX }));
            const cursor = { x: 300, y: 120 };
            const sign = mirrorX ? -1 : 1;
            const boardPointAt = () => {
                const { cx, scale } = result.current.view;
                return cx + (sign * (cursor.x - PANE.width / 2)) / (4 * scale);
            };
            const before = boardPointAt();
            act(() => {
                result.current.handlers.onWheel({
                    currentTarget: box, clientX: cursor.x, clientY: cursor.y, deltaY: -462,
                } as never);
            });
            expect(result.current.view.scale).toBeGreaterThan(1.9);
            expect(boardPointAt()).toBeCloseTo(before, 3);
        }
    });
});
