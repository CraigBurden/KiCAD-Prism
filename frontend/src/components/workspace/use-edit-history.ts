import { useCallback, useReducer } from "react";

/**
 * Edit history for the library grids: the pending edits plus the undo/redo
 * stacks, moved through one pure reducer so a single dispatch transitions all
 * three coherently. Nesting setState calls inside updater callbacks instead
 * (as the remediation grid once did) duplicates history entries under
 * StrictMode, because React may invoke an updater more than once. Reading
 * ref-held stacks during render (as bulk edit once did) leaves buttons stale.
 *
 * Behavior contract:
 * - commit pushes the prior edits onto the undo stack (capped at
 *   `EDIT_HISTORY_DEPTH`, shared by both grids) and clears the redo stack; a
 *   no-op commit changes nothing.
 * - undo/redo swap the top of one stack with the current edits and are
 *   no-ops on empty stacks.
 * - replace rewrites the edits WITHOUT touching history (used when accepted
 *   rows drop out of the pending set).
 * - reset wipes both stacks and either empties the edits or keeps what its
 *   update returns (used after saving or applying).
 *
 * Edits are an immutable map; an update must return a new object to count as
 * a change.
 */

export type EditMap = Record<string, unknown>;

export interface EditHistoryState<E extends EditMap> {
    edits: E;
    undoStack: E[];
    redoStack: E[];
}

export type EditHistoryAction<E extends EditMap> =
    | { type: "commit"; update: (current: E) => E }
    | { type: "replace"; update: (current: E) => E }
    | { type: "reset"; update?: (current: E) => E }
    | { type: "undo" }
    | { type: "redo" };

/** Undo depth of every library grid (decision D33: one depth for both). */
const EDIT_HISTORY_DEPTH = 100;

export const emptyEditHistory: EditHistoryState<EditMap> = {
    edits: {},
    undoStack: [],
    redoStack: [],
};

export function editHistoryReducer<E extends EditMap>(
    state: EditHistoryState<E>,
    action: EditHistoryAction<E>,
): EditHistoryState<E> {
    switch (action.type) {
        case "commit": {
            const next = action.update(state.edits);
            if (next === state.edits) return state;
            return {
                edits: next,
                undoStack: [...state.undoStack.slice(-(EDIT_HISTORY_DEPTH - 1)), state.edits],
                redoStack: [],
            };
        }
        case "replace": {
            const next = action.update(state.edits);
            return next === state.edits ? state : { ...state, edits: next };
        }
        case "reset": {
            if (!action.update) {
                return state === emptyEditHistory ? state : (emptyEditHistory as EditHistoryState<E>);
            }
            return { edits: action.update(state.edits), undoStack: [], redoStack: [] };
        }
        case "undo": {
            const previous = state.undoStack[state.undoStack.length - 1];
            if (!previous) return state;
            return {
                edits: previous,
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [...state.redoStack, state.edits],
            };
        }
        case "redo": {
            const next = state.redoStack[state.redoStack.length - 1];
            if (!next) return state;
            return {
                edits: next,
                undoStack: [...state.undoStack, state.edits],
                redoStack: state.redoStack.slice(0, -1),
            };
        }
    }
}

export function useEditHistory<E extends EditMap>() {
    const [state, dispatch] = useReducer(
        editHistoryReducer<E>,
        emptyEditHistory as EditHistoryState<E>,
    );

    const commitEdits = useCallback(
        (update: (current: E) => E) => dispatch({ type: "commit", update }),
        [],
    );
    const replaceEdits = useCallback(
        (update: (current: E) => E) => dispatch({ type: "replace", update }),
        [],
    );
    const resetHistory = useCallback(
        (update?: (current: E) => E) => dispatch({ type: "reset", update }),
        [],
    );
    const undo = useCallback(() => dispatch({ type: "undo" }), []);
    const redo = useCallback(() => dispatch({ type: "redo" }), []);

    return { ...state, commitEdits, replaceEdits, resetHistory, undo, redo };
}
