import { StrictMode } from "react";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseClipboardMatrix, useStagedGridEdits } from "./use-staged-grid-edits";

// A grid of string rows and string fields; edits keyed "row:field".
type Edits = Record<string, string>;
const writeCell = (edits: Edits, row: string, field: string, value: string): Edits => ({
    ...edits,
    [`${row}:${field}`]: value,
});

const ROWS = ["r1", "r2", "r3"];
const FIELDS = ["a", "b"];

afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
});

function renderStaged(hotkeys: Parameters<typeof useStagedGridEdits>[0]["hotkeys"] = { enabled: true }) {
    return renderHook(() => useStagedGridEdits({ writeCell, hotkeys }), { wrapper: StrictMode });
}

describe("parseClipboardMatrix", () => {
    it("splits rows and tabs and drops one trailing newline", () => {
        expect(parseClipboardMatrix("1\t2\r\n3\t4\n")).toEqual([["1", "2"], ["3", "4"]]);
    });

    it("keeps blank rows in the middle", () => {
        expect(parseClipboardMatrix("1\n\n3")).toEqual([["1"], [""], ["3"]]);
    });

    it("returns no rows for empty text", () => {
        expect(parseClipboardMatrix("")).toEqual([]);
    });
});

describe("useStagedGridEdits", () => {
    it("records one undo step per cell, fill-down, and paste", () => {
        const { result } = renderStaged();

        act(() => result.current.setCell("r1", "a", "x"));
        act(() => result.current.fillDown(ROWS, "b", "y"));
        let pasted = false;
        act(() => {
            pasted = result.current.paste("1\t2\n3\t4", { rows: ROWS, fields: FIELDS, row: 1, column: 0 });
        });

        expect(pasted).toBe(true);
        expect(result.current.edits).toEqual({
            "r1:a": "x", "r1:b": "y", "r2:a": "1", "r2:b": "2", "r3:a": "3", "r3:b": "4",
        });

        act(() => result.current.undo());
        expect(result.current.edits).toEqual({ "r1:a": "x", "r1:b": "y", "r2:b": "y", "r3:b": "y" });
        act(() => result.current.undo());
        expect(result.current.edits).toEqual({ "r1:a": "x" });
        act(() => result.current.undo());
        expect(result.current.edits).toEqual({});
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it("pastes only inside the grid and only cells the grid accepts", () => {
        const { result } = renderStaged();
        act(() => {
            result.current.paste(
                "1\t2\t3\n4\t5\t6\n7\t8\t9",
                { rows: ROWS, fields: FIELDS, row: 1, column: 1 },
                (_row, _field, value) => value !== "1",
            );
        });
        // Column b only (cells past the right edge are dropped), rows r2 and r3
        // (the third pasted row is past the bottom), and "1" is refused.
        expect(result.current.edits).toEqual({ "r3:b": "4" });
    });

    it("leaves an empty paste to the browser and records nothing", () => {
        const { result } = renderStaged();
        let pasted = true;
        act(() => {
            pasted = result.current.paste("", { rows: ROWS, fields: FIELDS, row: 0, column: 0 });
        });
        expect(pasted).toBe(false);
        expect(result.current.canUndo).toBe(false);
    });

    it("keeps 100 undo steps", () => {
        const { result } = renderStaged({ enabled: true });
        for (let index = 0; index < 105; index += 1) {
            act(() => result.current.setCell("r1", "a", `v${index}`));
        }
        let undone = 0;
        while (result.current.canUndo) {
            act(() => result.current.undo());
            undone += 1;
        }
        expect(undone).toBe(100);
        expect(result.current.edits).toEqual({ "r1:a": "v4" });
    });

    it("replace rewrites edits without history; reset clears history and can keep edits", () => {
        const { result } = renderStaged();
        act(() => result.current.setCell("r1", "a", "x"));
        act(() => result.current.setCell("r2", "a", "y"));
        act(() => result.current.replace(({ "r2:a": _dropped, ...rest }) => rest));
        expect(result.current.edits).toEqual({ "r1:a": "x" });
        expect(result.current.canUndo).toBe(true);

        act(() => result.current.reset((current) => current));
        expect(result.current.edits).toEqual({ "r1:a": "x" });
        expect(result.current.canUndo).toBe(false);

        act(() => result.current.reset());
        expect(result.current.edits).toEqual({});
    });

    it("binds undo, redo and save to the keyboard, including inside inputs", () => {
        const onSave = vi.fn();
        const { result } = renderStaged({ enabled: true, onSave });
        const input = document.body.appendChild(document.createElement("input"));
        act(() => result.current.setCell("r1", "a", "x"));

        act(() => { fireEvent.keyDown(input, { key: "z", ctrlKey: true }); });
        expect(result.current.edits).toEqual({});
        act(() => { fireEvent.keyDown(input, { key: "z", ctrlKey: true, shiftKey: true }); });
        expect(result.current.edits).toEqual({ "r1:a": "x" });
        act(() => { fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }); });
        act(() => { fireEvent.keyDown(document.body, { key: "y", ctrlKey: true }); });
        expect(result.current.edits).toEqual({ "r1:a": "x" });

        const save = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
        act(() => { input.dispatchEvent(save); });
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(save.defaultPrevented).toBe(true);
    });

    it("ignores keys outside its scope and leaves them to the browser", () => {
        const grid = document.body.appendChild(document.createElement("div"));
        const cell = grid.appendChild(document.createElement("input"));
        const search = document.body.appendChild(document.createElement("input"));
        const { result } = renderStaged({ enabled: true, scope: { current: grid } });
        act(() => result.current.setCell("r1", "a", "x"));

        const outside = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
        act(() => { search.dispatchEvent(outside); });
        expect(result.current.edits).toEqual({ "r1:a": "x" });
        expect(outside.defaultPrevented).toBe(false);

        const inside = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
        act(() => { cell.dispatchEvent(inside); });
        expect(result.current.edits).toEqual({});
        expect(inside.defaultPrevented).toBe(true);
    });

    it("binds nothing while disabled", () => {
        const { result } = renderStaged({ enabled: false });
        act(() => result.current.setCell("r1", "a", "x"));
        act(() => { fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }); });
        expect(result.current.edits).toEqual({ "r1:a": "x" });
    });
});
