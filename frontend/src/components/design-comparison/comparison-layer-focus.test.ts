import { describe, expect, it } from "vitest";
import {
    focusVisibleLayers,
    layerFocusForChanges,
    resolveFocusLayers,
} from "./comparison-layer-focus";
import type { ChangeItem } from "./types";

function routingChange(overrides: Partial<ChangeItem> = {}): ChangeItem {
    return {
        id: "change-1",
        kind: "changed",
        domain: "pcb",
        category: "nets",
        classification: "primary",
        label: "USB_DP",
        objectKind: "track",
        net: "USB_DP",
        reasons: ["content-changed"],
        fields: {},
        details: {},
        base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
        head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
        ...overrides,
    };
}

describe("comparison layer focus", () => {
    it("derives each revision's copper independently", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
                reasons: ["layer-changed"],
            }),
        ]);

        expect(focus).toEqual({
            net: "USB_DP",
            viaOnly: false,
            reference: ["F.Cu"],
            comparison: ["B.Cu"],
        });
    });

    it("ignores via spans while a track or arc defines the route", () => {
        const focus = layerFocusForChanges([
            routingChange({ id: "t", objectKind: "track" }),
            routingChange({
                id: "a",
                objectKind: "arc",
                base: { sourceId: "b", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "b", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
            }),
            routingChange({
                id: "v",
                objectKind: "via",
                base: { sourceId: "c", documentPath: "board.kicad_pcb", layers: ["F.Cu", "In2.Cu"] },
                head: { sourceId: "c", documentPath: "board.kicad_pcb", layers: ["F.Cu", "In2.Cu"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
        expect(focus?.comparison).toEqual(["F.Cu"]);
        expect(focus?.viaOnly).toBe(false);
    });

    it("uses via endpoints only when the change is via-only", () => {
        const focus = layerFocusForChanges([
            routingChange({
                id: "v",
                objectKind: "via",
                base: { sourceId: "c", documentPath: "board.kicad_pcb", layers: ["F.Cu", "In1.Cu"] },
                head: { sourceId: "c", documentPath: "board.kicad_pcb", layers: ["F.Cu", "B.Cu"] },
            }),
        ]);

        expect(focus?.viaOnly).toBe(true);
        expect(focus?.reference).toEqual(["F.Cu", "In1.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu", "F.Cu"]);
    });

    it("focuses tracks and arcs on their own layer", () => {
        const focus = layerFocusForChanges([
            routingChange({ objectKind: "track" }),
            routingChange({ id: "b", objectKind: "arc" }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
    });

    it("falls back to the routed revision for a wholly removed route", () => {
        const focus = layerFocusForChanges([
            routingChange({
                kind: "removed",
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["In1.Cu"] },
                head: undefined,
            }),
        ]);

        expect(focus?.reference).toEqual(["In1.Cu"]);
        expect(focus?.comparison).toEqual(["In1.Cu"]);
    });

    it("reads a single layer field when no layer list is present", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: [], layer: "F.Cu" },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: [], layer: "B.Cu" },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu"]);
    });

    it("shows every layer the selection occupies, copper or not", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu", "F.Mask"] },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu", "F.Mask"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu", "F.Mask"]);
    });

    it("keeps the relevant outer copper as orientation context", () => {
        const focus = layerFocusForChanges([
            routingChange({
                objectKind: "graphic",
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.SilkS"] },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["B.Fab"] },
            }),
        ])!;

        expect(focusVisibleLayers(focus, "reference"))
            .toEqual(["F.Cu", "F.SilkS", "Edge.Cuts"]);
        expect(focusVisibleLayers(focus, "comparison"))
            .toEqual(["B.Cu", "B.Fab", "Edge.Cuts"]);
    });

    // The listing a reviewer actually clicks is the part group, and the
    // backend puts the part's fab text in it next to the copper. Requiring
    // every selected object to be copper meant that group isolated nothing:
    // the feature only worked if you opened the group and clicked the copper
    // row inside it.
    it("focuses a part group carrying a non-copper annotation with it", () => {
        const focus = layerFocusForChanges([
            routingChange({
                category: "components",
                objectKind: "footprint",
                net: undefined,
                base: { sourceId: "r52", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
                head: { sourceId: "r52", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
            }),
            routingChange({
                id: "text",
                category: "components",
                objectKind: "footprint_text",
                net: undefined,
                base: { sourceId: "r52t", documentPath: "board.kicad_pcb", layers: ["B.Fab"] },
                head: { sourceId: "r52t", documentPath: "board.kicad_pcb", layers: ["B.Fab"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["B.Cu", "B.Fab"]);
        expect(focusVisibleLayers(focus!, "both"))
            .toEqual(["B.Cu", "B.Fab", "Edge.Cuts"]);
    });

    it("does not focus a selection that sits on no layer at all", () => {
        expect(layerFocusForChanges([])).toBeNull();
        // A design rule has no layer, so there is nothing to isolate to.
        expect(
            layerFocusForChanges([
                routingChange({
                    category: "rules",
                    objectKind: "rule",
                    base: { sourceId: "r", documentPath: "board.kicad_pcb", layers: [] },
                    head: { sourceId: "r", documentPath: "board.kicad_pcb", layers: [] },
                }),
            ]),
        ).toBeNull();
        // Layer visibility is a PCB idea; a schematic selection never touches it.
        expect(
            layerFocusForChanges([
                routingChange({ domain: "schematic", objectKind: "track" }),
            ]),
        ).toBeNull();
    });

    it("lets the layered members of a mixed selection define the focus", () => {
        const focus = layerFocusForChanges([
            routingChange(),
            routingChange({
                id: "rule",
                category: "rules",
                objectKind: "rule",
                base: { sourceId: "r", documentPath: "board.kicad_pcb", layers: [] },
                head: { sourceId: "r", documentPath: "board.kicad_pcb", layers: [] },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
    });

    // Reviewing a part on the back of the board means seeing the back of the
    // board. Before this, only routing isolated its copper, so selecting a
    // part left the whole stack visible and its footprint was read through
    // whatever the front carried over it.
    it("focuses the side a part is mounted on", () => {
        const focus = layerFocusForChanges([
            routingChange({
                category: "components",
                objectKind: "footprint",
                label: "R52",
                base: { sourceId: "r52", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
                head: { sourceId: "r52", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["B.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu"]);
        expect(focusVisibleLayers(focus!, "both")).toEqual(["B.Cu", "Edge.Cuts"]);
    });

    it("focuses a pad the same way, and follows a part across the board", () => {
        const focus = layerFocusForChanges([
            routingChange({
                category: "components",
                objectKind: "pad",
                base: { sourceId: "p", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "p", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
            }),
        ]);

        // Per revision, so a part that moved side does not read as if it had
        // always been on both.
        expect(focus?.reference).toEqual(["F.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu"]);
    });

    it("focuses a part and the routing selected with it together", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base: { sourceId: "t", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "t", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
            }),
            routingChange({
                id: "pad",
                category: "components",
                objectKind: "pad",
                base: { sourceId: "p", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
                head: { sourceId: "p", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["B.Cu", "F.Cu"]);
    });

    it("does not focus when no layer could be resolved", () => {
        expect(
            layerFocusForChanges([
                routingChange({ base: undefined, head: undefined }),
            ]),
        ).toBeNull();
    });

    it("keeps the board outline visible alongside the focused copper", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
            }),
        ])!;

        expect(focusVisibleLayers(focus, "reference")).toEqual([
            "F.Cu",
            "Edge.Cuts",
        ]);
        expect(focusVisibleLayers(focus, "comparison")).toEqual([
            "B.Cu",
            "Edge.Cuts",
        ]);
        expect(focusVisibleLayers(focus, "both")).toEqual([
            "B.Cu",
            "F.Cu",
            "Edge.Cuts",
        ]);
    });

    it("borrows layer context for a removed route the backend shapes as empty", () => {
        // The existing null-`compare_item` case is not the shape the backend
        // actually sends: a removed track carries a compare item with an empty
        // layer list. Both must reach the same fallback, or the compare pane is
        // stripped to the board outline and proves nothing.
        const focus = layerFocusForChanges([
            routingChange({
                kind: "removed",
                reasons: ["object-removed"],
                base: { sourceId: "a", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
                head: { sourceId: "a", documentPath: "board.kicad_pcb", layers: [] },
            }),
            routingChange({
                id: "change-2",
                kind: "removed",
                reasons: ["object-removed"],
                base: { sourceId: "b", documentPath: "board.kicad_pcb", layers: ["B.Cu"] },
                head: { sourceId: "b", documentPath: "board.kicad_pcb", layers: [] },
            }),
        ])!;

        expect(focus.reference).toEqual(["B.Cu", "F.Cu"]);
        expect(focus.comparison).toEqual(["B.Cu", "F.Cu"]);
        expect(focusVisibleLayers(focus, "comparison"))
            .toEqual(["B.Cu", "F.Cu", "Edge.Cuts"]);
    });
});

describe("focus layer resolution", () => {
    const board = ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu", "Edge.Cuts", "F.SilkS", "B.Mask"];

    it("shows a through-hole pad on the outer copper only", () => {
        // KiCad does not give a through-hole pad a side, and `*.Cu` handed
        // straight to a viewer matches no layer, so the board went dark. It
        // resolves to the outside rather than to all copper: a pad is legible
        // where it is a pad, and opening the inner planes buries it.
        expect(resolveFocusLayers(["*.Cu"], board)).toEqual(["F.Cu", "B.Cu"]);
    });

    it("treats the outer-pair pattern the same way", () => {
        expect(resolveFocusLayers(["F&B.Cu"], board)).toEqual(["F.Cu", "B.Cu"]);
    });

    it("honours a pattern naming one side", () => {
        expect(resolveFocusLayers(["F.*"], board)).toEqual([]);
        expect(resolveFocusLayers(["*.Mask"], board)).toEqual(["B.Mask"]);
    });

    it("passes real layer names through, so a mixed list resolves once", () => {
        expect(resolveFocusLayers(["B.Cu", "Edge.Cuts"], board))
            .toEqual(["B.Cu", "Edge.Cuts"]);
        expect(resolveFocusLayers(["*.Cu", "Edge.Cuts"], board))
            .toEqual(["F.Cu", "B.Cu", "Edge.Cuts"]);
    });

    it("keeps an inner layer that a change names outright", () => {
        // A zone or track really on In2.Cu still focuses there; only wildcards
        // are narrowed to the outside.
        expect(resolveFocusLayers(["In2.Cu"], board)).toEqual(["In2.Cu"]);
    });

    it("resolves nothing for a pattern this board has no layers for", () => {
        expect(resolveFocusLayers(["*.Paste"], board)).toEqual([]);
    });
});
