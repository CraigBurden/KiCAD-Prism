import { describe, expect, it } from "vitest";

import { orderedFieldEntries } from "./semantic-fields";

const keys = (fields: Record<string, string>) => orderedFieldEntries(fields).map(([key]) => key);

describe("orderedFieldEntries", () => {
    it("lists the canonical fields first, in the index's order, then the rest A to Z", () => {
        expect(keys({ Zeta: "1", Datasheet: "d", alpha: "2", Value: "10k", Beta: "3", Manufacturer: "m" }))
            .toEqual(["Value", "Datasheet", "Manufacturer", "Beta", "Zeta", "alpha"]);
    });

    it("reads the same whatever order the map arrived in (a0 insertion, a1 code point)", () => {
        const a0 = { Value: "10k", DNP: "No", Description: "R", Tolerance: "1%", Package: "0402" };
        const a1 = { DNP: "No", Description: "R", Package: "0402", Tolerance: "1%", Value: "10k" };
        expect(keys(a1)).toEqual(keys(a0));
    });
});
