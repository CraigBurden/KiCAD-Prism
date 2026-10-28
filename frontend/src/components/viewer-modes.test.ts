import { describe, expect, it, vi } from "vitest";
import type { EcadSemanticSelectionDetail } from "@/types/ecad-viewer";
import {
    VIEWER_TABS,
    commentModeAvailable,
    consumeElementEscape,
    elementModes,
    initialViewerModes,
    viewerKeyIntent,
    viewerModesReducer,
    type ViewerKey,
    type ViewerModes,
    type VisualizerTab,
} from "./viewer-modes";

/**
 * These tables document how the project viewer behaved before its mode
 * rules moved out of visualizer.tsx (AC-17). A row changing here is a
 * behaviour change, not a refactor.
 */

const key = (overrides: Partial<ViewerKey>): ViewerKey => ({
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
});

const modes = (overrides: Partial<ViewerModes> = {}): ViewerModes => ({
    ...initialViewerModes(null),
    ...overrides,
});

const DRAFT = {
    context: "SCH" as const,
    location: { x: 1, y: 2, layer: "" },
    element: null,
};

const busy = (tab: VisualizerTab): ViewerModes => modes({
    tab,
    commentMode: true,
    draft: DRAFT,
    selectedCommentId: "c-1",
    rightRail: "comments",
});

describe("initial tab", () => {
    it.each([
        [null, "sch"],
        ["sch", "sch"],
        ["pcb", "pcb"],
        ["3d", "3d"],
        ["bom", "bom"],
        ["stackup", "stackup"],
        ["assembly", "assembly"],
        ["PCB", "sch"],
        ["history", "sch"],
    ])("?tab=%s opens %s", (requested, tab) => {
        expect(initialViewerModes(requested)).toEqual({
            tab,
            commentMode: false,
            draft: null,
            selectedCommentId: null,
            rightRail: null,
            mounted: { pcb: tab === "pcb", "3d": tab === "3d" || tab === "stackup" },
        });
    });
});

describe("Esc order", () => {
    type Stub = { insets: boolean; measure: boolean };
    const element = ({ insets, measure }: Stub) => ({
        escapeInsets: vi.fn(() => insets),
        escapeMeasure: vi.fn(() => measure),
    });

    // tab, element consumes (insets, measure), consumed, insets asked, measure asked
    it.each([
        ["sch", { insets: true, measure: true }, true, true, false],
        ["sch", { insets: false, measure: true }, false, true, false],
        ["pcb", { insets: true, measure: true }, true, true, false],
        ["pcb", { insets: false, measure: true }, true, true, true],
        ["pcb", { insets: false, measure: false }, false, true, true],
    ] as const)("%s, element %o: consumed=%s", (tab, stub, consumed, askedInsets, askedMeasure) => {
        const viewer = element(stub);
        expect(consumeElementEscape(tab, viewer)).toBe(consumed);
        expect(viewer.escapeInsets).toHaveBeenCalledTimes(askedInsets ? 1 : 0);
        expect(viewer.escapeMeasure).toHaveBeenCalledTimes(askedMeasure ? 1 : 0);
    });

    it.each(["3d", "bom", "stackup", "assembly"] as const)("%s has no element step", (tab) => {
        const viewer = element({ insets: true, measure: true });
        expect(consumeElementEscape(tab, viewer)).toBe(false);
        expect(viewer.escapeInsets).not.toHaveBeenCalled();
        expect(viewer.escapeMeasure).not.toHaveBeenCalled();
    });

    it("an element without the inset/measure API never consumes", () => {
        expect(consumeElementEscape("pcb", {})).toBe(false);
        expect(consumeElementEscape("pcb", null)).toBe(false);
    });

    it.each(["Escape"])("%s is an escape on every tab, with any modifier", (name) => {
        for (const tab of VIEWER_TABS) {
            expect(viewerKeyIntent(key({ key: name }), tab, false)).toEqual({ kind: "escape" });
            expect(viewerKeyIntent(key({ key: name, metaKey: true, shiftKey: true }), tab, true))
                .toEqual({ kind: "escape" });
        }
    });

    it.each(VIEWER_TABS)("an unconsumed Esc on %s ends comment mode, the draft, the comment and the rail", (tab) => {
        expect(viewerModesReducer(busy(tab), { type: "escape" })).toEqual(modes({ tab }));
    });
});

describe("tab keys", () => {
    it.each([
        ["1", "Digit1", "sch"],
        ["2", "Digit2", "pcb"],
        ["3", "Digit3", "3d"],
        ["4", "Digit4", "bom"],
        ["5", "Digit5", "stackup"],
        ["6", "Digit6", "assembly"],
        // A layout whose digit row types other characters still switches.
        ["é", "Digit2", "pcb"],
        ["2", "Numpad2", "pcb"],
    ] as const)("%s (%s) opens %s", (name, code, tab) => {
        expect(viewerKeyIntent(key({ key: name, code }), "bom", false)).toEqual({ kind: "tab", tab });
    });

    it.each([
        key({ key: "7", code: "Digit7" }),
        key({ key: "0", code: "Digit0" }),
        key({ key: "1", code: "Digit1", metaKey: true }),
        key({ key: "1", code: "Digit1", ctrlKey: true }),
        key({ key: "1", code: "Digit1", altKey: true }),
        key({ key: "!", code: "Digit1", shiftKey: true }),
    ])("%o is not a tab key", (event) => {
        expect(viewerKeyIntent(event, "bom", true)).toBeNull();
    });

    it("a tab change keeps every mode", () => {
        expect(viewerModesReducer(busy("sch"), { type: "tab", tab: "3d" }))
            .toEqual({ ...busy("3d"), mounted: { pcb: false, "3d": true } });
    });
});

describe("mounted views", () => {
    it.each([
        ["pcb", { pcb: true, "3d": false }],
        ["3d", { pcb: false, "3d": true }],
        ["stackup", { pcb: false, "3d": true }],
        ["bom", { pcb: false, "3d": false }],
        ["assembly", { pcb: false, "3d": false }],
    ] as const)("visiting %s mounts %o, and leaving keeps it", (tab, mounted) => {
        const visited = viewerModesReducer(modes(), { type: "tab", tab });
        expect(visited.mounted).toEqual(mounted);
        expect(viewerModesReducer(visited, { type: "tab", tab: "sch" }).mounted).toEqual(mounted);
    });

    it("mounts the board for insets and the 3D tab for an inset's 3D view, once", () => {
        const board = viewerModesReducer(modes(), { type: "mount", view: "pcb" });
        expect(board.mounted).toEqual({ pcb: true, "3d": false });
        expect(board.tab).toBe("sch");
        const both = viewerModesReducer(board, { type: "mount", view: "3d" });
        expect(both.mounted).toEqual({ pcb: true, "3d": true });
        expect(viewerModesReducer(both, { type: "mount", view: "3d" })).toBe(both);
    });
});

describe("C key", () => {
    // can comment, tab, event, intent
    it.each([
        [true, "sch", key({ key: "c" }), true],
        [true, "pcb", key({ key: "c" }), true],
        [true, "pcb", key({ key: "C", shiftKey: true }), true],
        [false, "sch", key({ key: "c" }), false],
        [true, "3d", key({ key: "c" }), false],
        [true, "bom", key({ key: "c" }), false],
        [true, "stackup", key({ key: "c" }), false],
        [true, "assembly", key({ key: "c" }), false],
        [true, "sch", key({ key: "c", metaKey: true }), false],
        [true, "sch", key({ key: "c", ctrlKey: true }), false],
        [true, "pcb", key({ key: "c", altKey: true }), false],
    ] as const)("can comment=%s on %s, %o → comment=%s", (canComment, tab, event, comment) => {
        expect(viewerKeyIntent(event, tab, canComment)).toEqual(comment ? { kind: "comment" } : null);
    });

    it("without a selection, C toggles comment mode on and off", () => {
        const on = viewerModesReducer(modes({ tab: "sch" }), { type: "comment-key", selection: null });
        expect(on.commentMode).toBe(true);
        expect(on.draft).toBeNull();
        expect(viewerModesReducer(on, { type: "comment-key", selection: null }).commentMode).toBe(false);
    });

    it("a selection without a point toggles too", () => {
        const selection: EcadSemanticSelectionDetail = { sourceContext: "PCB", itemType: "footprint", x: 3 };
        expect(viewerModesReducer(modes({ tab: "pcb" }), { type: "comment-key", selection }).commentMode).toBe(true);
    });

    it.each([
        ["sch", "SCH"],
        ["pcb", "PCB"],
    ] as const)("with a selected point on %s, C opens a %s draft and ends comment mode", (tab, context) => {
        const selection: EcadSemanticSelectionDetail = {
            sourceContext: "PCB",
            itemType: "pad",
            uuid: "u-1",
            reference: "U1",
            layer: "F.Cu",
            page: "2",
            x: 15,
            y: -5,
            bounds: [10, -10, 4, 4],
        };
        const next = viewerModesReducer(modes({ tab, commentMode: true }), { type: "comment-key", selection });
        expect(next.commentMode).toBe(false);
        expect(next.draft).toEqual({
            context,
            location: { x: 15, y: -5, layer: "F.Cu", page: "2" },
            // The point sits outside the item's box, so it clamps to the edge.
            element: { elementId: "u-1", elementRef: "U1", elementType: "pad", relativePoint: [1, 1] },
        });
    });

    it("a selection with an empty box keeps no relative point and an empty layer", () => {
        const selection: EcadSemanticSelectionDetail = {
            sourceContext: "SCH",
            itemType: "symbol",
            x: 1,
            y: 2,
            bounds: [0, 0, 0, 4],
        };
        const next = viewerModesReducer(modes({ tab: "sch" }), { type: "comment-key", selection });
        expect(next.draft?.location).toEqual({ x: 1, y: 2, layer: "", page: undefined });
        expect(next.draft?.element?.relativePoint).toBeUndefined();
    });

    it("the toolbar button toggles comment mode", () => {
        const on = viewerModesReducer(modes(), { type: "toggle-comment-mode" });
        expect(on.commentMode).toBe(true);
        expect(viewerModesReducer(on, { type: "toggle-comment-mode" }).commentMode).toBe(false);
    });
});

describe("mutual exclusion", () => {
    it("measure mode turning on ends comment mode", () => {
        expect(viewerModesReducer(modes({ commentMode: true }), { type: "measure-mode", on: true }).commentMode)
            .toBe(false);
    });

    it("measure mode turning off leaves comment mode alone", () => {
        const state = modes({ commentMode: true });
        expect(viewerModesReducer(state, { type: "measure-mode", on: false })).toBe(state);
    });

    it.each(VIEWER_TABS)("comment mode on %s tells the board to stop measuring", (tab) => {
        expect(elementModes(modes({ tab, commentMode: true }), "pcb").endMeasure).toBe(true);
        expect(elementModes(modes({ tab, commentMode: false }), "pcb").endMeasure).toBe(false);
        expect(elementModes(modes({ tab, commentMode: true }), "sch").endMeasure).toBe(false);
    });

    it("an area drawn in comment mode opens its draft and ends comment mode", () => {
        const location = { x: 1, y: 2, layer: "", bounds: [0, 0, 2, 2] as [number, number, number, number] };
        const next = viewerModesReducer(modes({ commentMode: true }), {
            type: "comment-area",
            context: "PCB",
            location,
        });
        expect(next.commentMode).toBe(false);
        expect(next.draft).toEqual({ context: "PCB", location, element: null });
    });

    it("closing the draft keeps comment mode as it was", () => {
        expect(viewerModesReducer(busy("sch"), { type: "close-draft" })).toEqual({ ...busy("sch"), draft: null });
    });
});

describe("tab gating", () => {
    // tab, comment mode on the schematic element, on the board element
    it.each([
        ["sch", true, false],
        ["pcb", false, true],
        ["3d", false, false],
        ["bom", false, false],
        ["stackup", false, false],
        ["assembly", false, false],
    ] as const)("comment mode on %s reaches sch=%s pcb=%s", (tab, sch, pcb) => {
        const state = modes({ tab, commentMode: true });
        expect(elementModes(state, "sch").commentMode).toBe(sch);
        expect(elementModes(state, "pcb").commentMode).toBe(pcb);
        const off = modes({ tab });
        expect(elementModes(off, "sch").commentMode).toBe(false);
        expect(elementModes(off, "pcb").commentMode).toBe(false);
    });

    it.each([
        ["sch", true, true],
        ["pcb", true, true],
        ["sch", false, false],
        ["3d", true, false],
        ["bom", true, false],
        ["stackup", true, false],
        ["assembly", true, false],
    ] as const)("the comment-mode button on %s (can comment=%s) shows=%s", (tab, canComment, shown) => {
        expect(commentModeAvailable(tab, canComment)).toBe(shown);
    });
});

describe("schematic page keys", () => {
    it.each([
        [key({ key: "[" }), { kind: "schematic-page", direction: -1 }],
        [key({ key: "{", code: "BracketLeft", shiftKey: true }), { kind: "schematic-page", direction: -1 }],
        [key({ key: "]" }), { kind: "schematic-page", direction: 1 }],
        [key({ key: "x", code: "BracketRight" }), { kind: "schematic-page", direction: 1 }],
        [key({ key: "Backspace", altKey: true }), { kind: "schematic-parent" }],
        [key({ key: "Delete", altKey: true }), { kind: "schematic-parent" }],
        [key({ key: "Backspace" }), null],
    ])("%o on the schematic → %o", (event, intent) => {
        expect(viewerKeyIntent(event, "sch", false)).toEqual(intent);
    });

    it.each(["pcb", "3d"] as const)("page keys do nothing on %s", (tab) => {
        expect(viewerKeyIntent(key({ key: "[" }), tab, false)).toBeNull();
        expect(viewerKeyIntent(key({ key: "Backspace", altKey: true }), tab, false)).toBeNull();
    });
});

describe("comments and the right rail", () => {
    it("selecting a comment and deleting it", () => {
        const selected = viewerModesReducer(modes(), { type: "select-comment", id: "c-2" });
        expect(selected.selectedCommentId).toBe("c-2");
        expect(viewerModesReducer(selected, { type: "comment-deleted", id: "c-3" })).toBe(selected);
        expect(viewerModesReducer(selected, { type: "comment-deleted", id: "c-2" }).selectedCommentId).toBeNull();
        expect(viewerModesReducer(selected, { type: "select-comment", id: null }).selectedCommentId).toBeNull();
    });

    // rail before, input, rail after
    it.each([
        [null, { type: "toggle-rail", tab: "comments" }, "comments"],
        ["comments", { type: "toggle-rail", tab: "comments" }, null],
        ["selection", { type: "toggle-rail", tab: "comments" }, "comments"],
        ["comments", { type: "rail", tab: "selection" }, "selection"],
        ["comments", { type: "rail", tab: null }, null],
        [null, { type: "inspector", hasContent: true }, "selection"],
        ["comments", { type: "inspector", hasContent: true }, "selection"],
        ["selection", { type: "inspector", hasContent: false }, null],
        ["comments", { type: "inspector", hasContent: false }, "comments"],
        [null, { type: "inspector", hasContent: false }, null],
    ] as const)("rail %s, %o → %s", (rightRail, input, after) => {
        expect(viewerModesReducer(modes({ rightRail }), input).rightRail).toBe(after);
    });
});
