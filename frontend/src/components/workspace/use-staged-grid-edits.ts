import { useCallback, useMemo, type RefObject } from "react";

import { useHotkeys, type HotkeyBinding } from "@/hooks/use-hotkeys";
import { useEditHistory, type EditMap } from "./use-edit-history";

/**
 * Staged edits for a spreadsheet-style grid: edits held locally until the
 * grid saves them, with undo/redo, fill-down, paste and the undo/redo/save
 * hotkeys. Both library grids (bulk edit and import remediation) use it.
 *
 * The grid supplies `writeCell`, a pure function that returns the edits with
 * one cell set (it decides what a row and a field are, and what an edit that
 * restores the original value means). Every cell-level operation goes through
 * it and lands as one undo step.
 */

export interface StagedGridEditsOptions<E extends EditMap, R, F> {
    /** Return `edits` with `row`'s `field` set to `value`. Must not mutate `edits`. */
    writeCell: (edits: E, row: R, field: F, value: string) => E;
    hotkeys: {
        enabled: boolean;
        /** Only act on keys pressed inside this element (the whole window when omitted). */
        scope?: RefObject<HTMLElement | null>;
        /** Bound to mod+s when given. */
        onSave?: () => void;
    };
}

export interface StagedCellTarget<R, F> {
    rows: readonly R[];
    fields: readonly F[];
    row: number;
    column: number;
}

export interface StagedGridEdits<E extends EditMap, R, F> {
    edits: E;
    canUndo: boolean;
    canRedo: boolean;
    /** Apply any update as one undo step. */
    commit: (update: (current: E) => E) => void;
    /** Set one cell as one undo step. */
    setCell: (row: R, field: F, value: string) => void;
    /** Write `value` into `field` of every row in `rows` as one undo step. */
    fillDown: (rows: readonly R[], field: F, value: string) => void;
    /**
     * Paste tab-separated clipboard text from the target cell, skipping cells
     * past the grid's edge and cells `accept` refuses, as one undo step.
     * Returns false when the text holds no cells (the caller lets the browser
     * handle that paste).
     */
    paste: (
        text: string,
        target: StagedCellTarget<R, F>,
        accept?: (row: R, field: F, value: string) => boolean,
    ) => boolean;
    /** Rewrite the edits without recording history. */
    replace: (update: (current: E) => E) => void;
    /** Clear history; empty the edits, or keep what `update` returns. */
    reset: (update?: (current: E) => E) => void;
    undo: () => void;
    redo: () => void;
}

/** Split clipboard text into rows of tab-separated cells, ignoring one trailing newline. */
export function parseClipboardMatrix(text: string): string[][] {
    return text
        .replace(/\r/g, "")
        .split("\n")
        .filter((line, index, rows) => line || index < rows.length - 1)
        .map((line) => line.split("\t"));
}

function inScope(event: KeyboardEvent, scope: RefObject<HTMLElement | null> | undefined): boolean {
    if (!scope) return true;
    return event.target instanceof Node && Boolean(scope.current?.contains(event.target));
}

export function useStagedGridEdits<E extends EditMap, R, F>({
    writeCell,
    hotkeys,
}: StagedGridEditsOptions<E, R, F>): StagedGridEdits<E, R, F> {
    const { edits, undoStack, redoStack, commitEdits, replaceEdits, resetHistory, undo, redo } =
        useEditHistory<E>();

    const setCell = useCallback(
        (row: R, field: F, value: string) =>
            commitEdits((current) => writeCell(current, row, field, value)),
        [commitEdits, writeCell],
    );

    const fillDown = useCallback(
        (rows: readonly R[], field: F, value: string) =>
            commitEdits((current) => rows.reduce((next, row) => writeCell(next, row, field, value), current)),
        [commitEdits, writeCell],
    );

    const paste = useCallback(
        (
            text: string,
            target: StagedCellTarget<R, F>,
            accept?: (row: R, field: F, value: string) => boolean,
        ) => {
            const matrix = parseClipboardMatrix(text);
            if (!matrix.length) return false;
            commitEdits((current) => {
                let next = current;
                matrix.forEach((values, rowOffset) => values.forEach((value, columnOffset) => {
                    const row = target.rows[target.row + rowOffset];
                    const field = target.fields[target.column + columnOffset];
                    if (row === undefined || field === undefined) return;
                    if (accept && !accept(row, field, value)) return;
                    next = writeCell(next, row, field, value);
                }));
                return next;
            });
            return true;
        },
        [commitEdits, writeCell],
    );

    const { enabled, scope, onSave } = hotkeys;
    // Undo, redo and save stay live while a cell's editor has focus: the point
    // is to correct a value just typed. With a scope, keys pressed elsewhere
    // keep the browser's own behaviour (undo in the search box).
    const bindings = useMemo(() => {
        const scoped = (action: () => void) => (event: KeyboardEvent) => {
            if (!inScope(event, scope)) return;
            event.preventDefault();
            action();
        };
        const list: HotkeyBinding[] = [
            { combo: "mod+z", handler: scoped(undo), allowInInputs: true, allowDefault: true },
            { combo: "mod+shift+z", handler: scoped(redo), allowInInputs: true, allowDefault: true },
            { combo: "mod+y", handler: scoped(redo), allowInInputs: true, allowDefault: true },
        ];
        if (onSave) {
            list.push({ combo: "mod+s", handler: scoped(onSave), allowInInputs: true, allowDefault: true });
        }
        return list;
    }, [onSave, redo, scope, undo]);
    useHotkeys(bindings, { enabled });

    return {
        edits,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        commit: commitEdits,
        setCell,
        fillDown,
        paste,
        replace: replaceEdits,
        reset: resetHistory,
        undo,
        redo,
    };
}
