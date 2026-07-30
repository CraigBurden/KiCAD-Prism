import { describe, expect, it } from "vitest";
import { fieldsForSide, orderedFields } from "./comparison-component-rail";
import type { BomChangeRow } from "./types";

const changed: BomChangeRow = {
    ref: "R1",
    status: "changed",
    old: { Value: "10k", Footprint: "0603", kicad_dnp: "false" },
    new: { Value: "22k", Footprint: "0603", kicad_dnp: "true" },
};

const added: BomChangeRow = {
    ref: "C9",
    status: "added",
    new: { Value: "100n" },
};

describe("comparison component rail", () => {
    it("reads each revision's own fields, not a merged view", () => {
        // The whole point of the panel: clicking the base pane must not show
        // the compare revision's value for a component that changed.
        expect(fieldsForSide(changed, "base")?.Value).toEqual("10k");
        expect(fieldsForSide(changed, "compare")?.Value).toEqual("22k");
    });

    it("reports absence on the side a component does not exist in", () => {
        // An added component has no base entry. Undefined is the signal the
        // rail uses to say "present only in the other revision" rather than
        // rendering an empty field list that reads like missing data.
        expect(fieldsForSide(added, "base")).toBeUndefined();
        expect(fieldsForSide(added, "compare")?.Value).toEqual("100n");
    });

    it("returns nothing for a reference the BOM does not carry", () => {
        expect(fieldsForSide(undefined, "compare")).toBeUndefined();
    });

    it("leads with primary fields and keeps custom ones", () => {
        const ordered = orderedFields({
            Zephyr: "custom",
            Description: "Resistor",
            Value: "10k",
        });
        expect(ordered.map(([name]) => name)).toEqual([
            "Value",
            "Description",
            "Zephyr",
        ]);
    });

    it("hides the raw kicad flags and empty values", () => {
        // kicad_dnp / kicad_in_bom drive the badges above the list; repeating
        // them as raw "true"/"false" strings is the textual DNP this replaces.
        const ordered = orderedFields({
            Value: "10k",
            kicad_dnp: "true",
            kicad_in_bom: "true",
            Vendor: "   ",
        });
        expect(ordered).toEqual([["Value", "10k"]]);
    });
});
