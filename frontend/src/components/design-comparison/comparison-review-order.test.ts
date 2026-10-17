import { describe, expect, it } from "vitest";
import { prepareChangesForReview, reviewOrder } from "./comparison-review-noise";
import type { ChangeItem } from "./types";

function change(
    id: string,
    kind: ChangeItem["kind"],
    page: string,
    at?: [number, number],
): ChangeItem {
    const side = {
        sourceId: id,
        documentPath: page,
        layers: [],
        ...(at ? { at: { xNm: at[0], yNm: at[1] } } : {}),
    };
    return {
        id,
        domain: "schematic",
        kind,
        category: "graphics",
        classification: "primary",
        label: id,
        objectKind: "graphic",
        page,
        reasons: [kind === "added" ? "object-added" : kind === "removed" ? "object-removed" : "moved"],
        fields: {},
        details: {},
        ...(kind === "added" ? {} : { base: side }),
        ...(kind === "removed" ? {} : { head: side }),
    };
}

describe("reviewOrder", () => {
    it("reads page, then removed, changed, added, then top to bottom, then left to right", () => {
        const changes = [
            change("z", "added", "b.kicad_sch", [0, 0]),
            change("y", "added", "a.kicad_sch", [5, 9]),
            change("x", "added", "a.kicad_sch", [9, 1]),
            change("w", "added", "a.kicad_sch", [1, 1]),
            change("v", "changed", "a.kicad_sch", [0, 0]),
            change("u", "removed", "a.kicad_sch", [0, 50]),
        ];
        expect([...changes].sort(reviewOrder).map((entry) => entry.id))
            .toEqual(["u", "v", "w", "x", "y", "z"]);
    });

    it("puts a change without a position after the placed ones, then orders by id", () => {
        const changes = [
            change("b", "added", "a.kicad_sch"),
            change("a", "added", "a.kicad_sch"),
            change("c", "added", "a.kicad_sch", [7, 7]),
        ];
        expect([...changes].sort(reviewOrder).map((entry) => entry.id))
            .toEqual(["c", "a", "b"]);
    });

    it("is the order the review list is prepared in, whatever order compare wrote", () => {
        const changes = [
            change("pcb-1", "added", "a.kicad_sch", [3, 3]),
            change("pcb-0", "removed", "a.kicad_sch", [3, 3]),
        ];
        const forward = prepareChangesForReview(changes).changes.map((entry) => entry.id);
        const backward = prepareChangesForReview([...changes].reverse()).changes
            .map((entry) => entry.id);
        expect(forward).toEqual(["pcb-0", "pcb-1"]);
        expect(backward).toEqual(forward);
    });
});
