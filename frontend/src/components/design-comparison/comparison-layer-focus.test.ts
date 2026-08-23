import { describe, expect, it } from "vitest";
import {
    focusVisibleLayers,
    layerFocusForChanges,
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
        object_kind: "track",
        net: "USB_DP",
        reasons: ["content-changed"],
        base_item: { source_id: "a", layers: ["F.Cu"] },
        compare_item: { source_id: "a", layers: ["F.Cu"] },
        ...overrides,
    };
}

describe("comparison layer focus", () => {
    it("derives each revision's copper independently", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base_item: { source_id: "a", layers: ["F.Cu"] },
                compare_item: { source_id: "a", layers: ["B.Cu"] },
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
            routingChange({ id: "t", object_kind: "track" }),
            routingChange({
                id: "a",
                object_kind: "arc",
                base_item: { source_id: "b", layers: ["F.Cu"] },
                compare_item: { source_id: "b", layers: ["F.Cu"] },
            }),
            routingChange({
                id: "v",
                object_kind: "via",
                base_item: { source_id: "c", layers: ["F.Cu", "In2.Cu"] },
                compare_item: { source_id: "c", layers: ["F.Cu", "In2.Cu"] },
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
                object_kind: "via",
                base_item: { source_id: "c", layers: ["F.Cu", "In1.Cu"] },
                compare_item: { source_id: "c", layers: ["F.Cu", "B.Cu"] },
            }),
        ]);

        expect(focus?.viaOnly).toBe(true);
        expect(focus?.reference).toEqual(["F.Cu", "In1.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu", "F.Cu"]);
    });

    it("normalizes the parser's segment and arc_segment kinds", () => {
        const focus = layerFocusForChanges([
            routingChange({ object_kind: "segment" }),
            routingChange({ id: "b", object_kind: "arc_segment" }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
    });

    it("falls back to the routed revision for a wholly removed route", () => {
        const focus = layerFocusForChanges([
            routingChange({
                kind: "removed",
                base_item: { source_id: "a", layers: ["In1.Cu"] },
                compare_item: null,
            }),
        ]);

        expect(focus?.reference).toEqual(["In1.Cu"]);
        expect(focus?.comparison).toEqual(["In1.Cu"]);
    });

    it("reads a single layer field when no layer list is present", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base_item: { source_id: "a", layer: "F.Cu" },
                compare_item: { source_id: "a", layer: "B.Cu" },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
        expect(focus?.comparison).toEqual(["B.Cu"]);
    });

    it("keeps non-copper layers out of the focus", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base_item: { source_id: "a", layers: ["F.Cu", "F.Mask"] },
                compare_item: { source_id: "a", layers: ["F.Cu", "F.Mask"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["F.Cu"]);
    });

    it("does not focus a selection holding anything that is not copper", () => {
        expect(layerFocusForChanges([])).toBeNull();
        // Silkscreen, courtyard and fabrication items name a layer but are not
        // copper the reviewer is isolating, and a rule change names none.
        expect(
            layerFocusForChanges([
                routingChange({ object_kind: "footprint_text" }),
            ]),
        ).toBeNull();
        expect(
            layerFocusForChanges([
                routingChange(),
                routingChange({ id: "g", object_kind: "graphic" }),
            ]),
        ).toBeNull();
        expect(
            layerFocusForChanges([
                routingChange({ domain: "schematic", object_kind: "track" }),
            ]),
        ).toBeNull();
    });

    // Reviewing a part on the back of the board means seeing the back of the
    // board. Before this, only routing isolated its copper, so selecting a
    // part left the whole stack visible and its footprint was read through
    // whatever the front carried over it.
    it("focuses the side a part is mounted on", () => {
        const focus = layerFocusForChanges([
            routingChange({
                category: "components",
                object_kind: "footprint",
                label: "R52",
                base_item: { source_id: "r52", layers: ["B.Cu"] },
                compare_item: { source_id: "r52", layers: ["B.Cu"] },
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
                object_kind: "pad",
                base_item: { source_id: "p", layers: ["F.Cu"] },
                compare_item: { source_id: "p", layers: ["B.Cu"] },
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
                base_item: { source_id: "t", layers: ["F.Cu"] },
                compare_item: { source_id: "t", layers: ["F.Cu"] },
            }),
            routingChange({
                id: "pad",
                category: "components",
                object_kind: "pad",
                base_item: { source_id: "p", layers: ["B.Cu"] },
                compare_item: { source_id: "p", layers: ["B.Cu"] },
            }),
        ]);

        expect(focus?.reference).toEqual(["B.Cu", "F.Cu"]);
    });

    it("does not focus when no copper layer could be resolved", () => {
        expect(
            layerFocusForChanges([
                routingChange({ base_item: null, compare_item: null }),
            ]),
        ).toBeNull();
    });

    it("keeps the board outline visible alongside the focused copper", () => {
        const focus = layerFocusForChanges([
            routingChange({
                base_item: { source_id: "a", layers: ["F.Cu"] },
                compare_item: { source_id: "a", layers: ["B.Cu"] },
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
                base_item: { source_id: "a", layers: ["F.Cu"] },
                compare_item: { source_id: "a", layers: [] },
            }),
            routingChange({
                id: "change-2",
                kind: "removed",
                reasons: ["object-removed"],
                base_item: { source_id: "b", layers: ["B.Cu"] },
                compare_item: { source_id: "b", layers: [] },
            }),
        ])!;

        expect(focus.reference).toEqual(["B.Cu", "F.Cu"]);
        expect(focus.comparison).toEqual(["B.Cu", "F.Cu"]);
        expect(focusVisibleLayers(focus, "comparison"))
            .toEqual(["B.Cu", "F.Cu", "Edge.Cuts"]);
    });
});
