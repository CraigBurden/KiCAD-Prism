/**
 * A pane that changes size lays the board out again: the camera is kept in board
 * millimetres relative to fit, so an unmoved view stays fitted at every size.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Pane } from "./fabrication-panel";
import { centreCamera, type BoardRect } from "./fabrication-viewport";

const observers: ControlledResizeObserver[] = [];

class ControlledResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {
        observers.push(this);
    }
    observe() {}
    disconnect() {}
    resize(width: number, height: number) {
        this.callback(
            [{ contentRect: { width, height } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
        );
    }
}

const handlers = {
    onWheel: () => undefined,
    onPointerDown: () => undefined,
    onPointerMove: () => undefined,
    onPointerUp: () => undefined,
    onPointerCancel: () => undefined,
};

beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Pane on resize", () => {
    it("fits the board again when the pane changes size", () => {
        const board: BoardRect = { x: 0, y: 0, width: 40, height: 20 };
        const { getByTestId } = render(
            <Pane label="TOP" drawn={board} board={board} camera={centreCamera(board)} handlers={handlers}>
                {() => <span data-testid="art" />}
            </Pane>,
        );
        const art = () => getByTestId("art").parentElement as HTMLElement;

        act(() => observers[0].resize(800, 600));
        expect(art().style.width).toBe("800px");
        expect(art().style.transform).toBe("translate(0px, 100px)");

        act(() => observers[0].resize(400, 600));
        expect(art().style.width).toBe("400px");
        expect(art().style.transform).toBe("translate(0px, 200px)");
    });
});
