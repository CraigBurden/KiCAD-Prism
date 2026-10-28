import { describe, expect, it } from "vitest";
import {
    recommendPresentationForChange,
    recommendPresentationForChanges,
} from "./comparison-review-policy";
import type { ComparisonPresentationMode } from "./comparison-url";
import type { ChangeItem } from "./types";

type ChangeSpec = Partial<ChangeItem> & { layers?: string[] };

function reviewChange(overrides: ChangeSpec = {}): ChangeItem {
    const { layers, ...rest } = overrides;
    const sideLayers = layers ?? [];
    return {
        id: "change-1",
        kind: "changed",
        domain: "schematic",
        category: "graphics",
        classification: "primary",
        label: "Change",
        objectKind: "graphic",
        reasons: ["content-changed"],
        fields: {},
        details: {},
        base: { sourceId: "base-1", documentPath: "root.kicad_sch", layers: sideLayers },
        head: { sourceId: "head-1", documentPath: "root.kicad_sch", layers: sideLayers },
        ...rest,
    };
}

type PolicyCase = {
    name: string;
    change: ChangeSpec;
    mode: ComparisonPresentationMode;
};

const schematicCases: PolicyCase[] = [
    {
        name: "added symbol",
        change: { kind: "added", category: "components", objectKind: "symbol", reasons: ["object-added"] },
        mode: "composite",
    },
    {
        name: "removed symbol",
        change: { kind: "removed", category: "components", objectKind: "symbol", reasons: ["object-removed"] },
        mode: "composite",
    },
    {
        name: "symbol field edit",
        change: {
            category: "components",
            objectKind: "symbol",
            reasons: ["symbol-fields-changed"],
            fields: { Value: { old: "10k", new: "4.7k" } },
        },
        mode: "old-new",
    },
    {
        name: "symbol field and placement edit",
        change: {
            category: "components",
            objectKind: "symbol",
            reasons: ["symbol-fields-changed", "moved"],
            fields: { Value: { old: "10k", new: "4.7k" } },
        },
        mode: "side-by-side",
    },
    {
        name: "symbol placement edit",
        change: { category: "components", objectKind: "symbol", reasons: ["moved"] },
        mode: "side-by-side",
    },
    {
        name: "symbol library replacement",
        change: { category: "components", objectKind: "symbol", reasons: ["lib-changed"] },
        mode: "side-by-side",
    },
    {
        name: "pin edit",
        change: { category: "nets", objectKind: "pin", reasons: ["content-changed"] },
        mode: "side-by-side",
    },
    {
        name: "power symbol edit",
        change: {
            category: "components",
            objectKind: "symbol",
            reference: "#PWR0118",
            label: "#PWR0118",
            reasons: ["properties-changed"],
            fields: { Value: { old: "GND", new: "+3V3" } },
        },
        mode: "side-by-side",
    },
    {
        name: "no-connect marker",
        change: { kind: "added", category: "nets", objectKind: "no-connect", reasons: ["object-added"] },
        mode: "side-by-side",
    },
    {
        name: "bus entry",
        change: { kind: "removed", category: "nets", objectKind: "bus-entry", reasons: ["object-removed"] },
        mode: "side-by-side",
    },
    {
        name: "hierarchical sheet",
        change: { kind: "added", category: "sheets", objectKind: "sheet", reasons: ["object-added"] },
        mode: "side-by-side",
    },
    {
        name: "instance replacement",
        change: { category: "components", objectKind: "symbol", reasons: ["instance-replaced"] },
        mode: "side-by-side",
    },
    {
        name: "connectivity change",
        change: { category: "nets", objectKind: "wire", reasons: ["connectivity-changed"] },
        mode: "side-by-side",
    },
    {
        name: "bus membership",
        change: { category: "nets", objectKind: "bus", reasons: ["bus-membership-changed"] },
        mode: "side-by-side",
    },
    {
        name: "net rename",
        change: { category: "nets", objectKind: "label", reasons: ["net-renamed"] },
        mode: "side-by-side",
    },
    {
        name: "added wire",
        change: { kind: "added", category: "nets", objectKind: "wire", reasons: ["object-added"] },
        mode: "composite",
    },
    {
        name: "removed label",
        change: { kind: "removed", category: "nets", objectKind: "label", reasons: ["object-removed"] },
        mode: "composite",
    },
    {
        name: "added logical net",
        change: {
            kind: "added",
            category: "nets",
            objectKind: "net",
            net: "VBUS",
            reasons: ["object-added"],
        },
        mode: "composite",
    },
    {
        name: "added junction",
        change: { kind: "added", category: "nets", objectKind: "junction", reasons: ["object-added"] },
        mode: "composite",
    },
    {
        name: "modified label text",
        change: {
            category: "nets",
            objectKind: "label",
            reasons: ["renamed"],
            fields: { Text: { old: "SDA", new: "I2C_SDA" } },
        },
        mode: "side-by-side",
    },
    {
        name: "sheet pin",
        change: { category: "sheets", objectKind: "sheet-pin", reasons: ["renamed"] },
        mode: "side-by-side",
    },
    {
        name: "hierarchy path change",
        change: {
            category: "components",
            objectKind: "symbol",
            reference: "R12",
            reasons: ["re-pathed"],
        },
        mode: "side-by-side",
    },
    {
        name: "modified junction",
        change: { category: "nets", objectKind: "junction", reasons: ["moved"] },
        mode: "side-by-side",
    },
    {
        name: "moved drawing",
        change: { category: "graphics", objectKind: "graphic", reasons: ["moved"] },
        mode: "side-by-side",
    },
    {
        name: "drawing content",
        change: { category: "graphics", objectKind: "graphic", reasons: ["content-changed"] },
        mode: "old-new",
    },
    {
        name: "image content",
        change: { category: "graphics", objectKind: "image", reasons: ["content-changed"] },
        mode: "old-new",
    },
    {
        name: "table content",
        change: { category: "graphics", objectKind: "table", reasons: ["content-changed"] },
        mode: "old-new",
    },
];

const pcbCases: PolicyCase[] = [
    ...["footprint", "pad", "track", "arc", "via", "zone"].map((kind): PolicyCase => ({
        name: `${kind} fabrication change`,
        change: {
            domain: "pcb" as const,
            category: kind === "footprint"
                ? "components"
                : kind === "zone" ? "zones" : "nets",
            objectKind: kind,
            reasons: ["content-changed" as const],
        },
        mode: "side-by-side" as const,
    })),
    {
        // One-sided: the base revision has nothing to put in the other pane,
        // so the composite scene shows the new footprint in board context
        // instead of spending half the width on an empty board.
        name: "added footprint",
        change: {
            domain: "pcb",
            kind: "added",
            category: "components",
            objectKind: "footprint",
            reasons: ["object-added"],
        },
        mode: "composite",
    },
    {
        name: "added pad",
        change: {
            domain: "pcb",
            kind: "added",
            category: "nets",
            objectKind: "pad",
            reasons: ["object-added"],
        },
        mode: "composite",
    },
    {
        name: "added fabrication graphic",
        change: {
            domain: "pcb",
            kind: "added",
            category: "graphics",
            objectKind: "footprint-graphic",
            layers: ["F.SilkS"],
            reasons: ["object-added"],
        },
        mode: "side-by-side",
    },
    {
        name: "added documentation graphic",
        change: {
            domain: "pcb",
            kind: "added",
            category: "graphics",
            objectKind: "graphic",
            layers: ["Dwgs.User"],
            reasons: ["object-added"],
        },
        mode: "old-new",
    },
    {
        name: "footprint BOM and position-file state",
        change: {
            domain: "pcb",
            category: "components",
            objectKind: "footprint",
            reference: "R7",
            reasons: ["properties-changed"],
            fields: {
                "Exclude from BOM": { old: false, new: true },
                "Exclude from position files": { old: false, new: true },
            },
        },
        mode: "side-by-side",
    },
    {
        name: "board outline",
        change: {
            domain: "pcb",
            category: "graphics",
            objectKind: "graphic",
            layers: ["Edge.Cuts"],
            reasons: ["content-changed"],
        },
        mode: "side-by-side",
    },
    {
        name: "silkscreen graphic",
        change: {
            domain: "pcb",
            category: "graphics",
            objectKind: "footprint-graphic",
            layers: ["F.SilkS"],
            reasons: ["content-changed"],
        },
        mode: "side-by-side",
    },
    {
        name: "courtyard text",
        change: {
            domain: "pcb",
            category: "graphics",
            objectKind: "footprint-text",
            layers: ["F.CrtYd"],
            reasons: ["content-changed"],
        },
        mode: "side-by-side",
    },
    {
        name: "documentation drawing",
        change: {
            domain: "pcb",
            category: "graphics",
            objectKind: "graphic",
            layers: ["Dwgs.User"],
            reasons: ["content-changed"],
        },
        mode: "old-new",
    },
    {
        name: "organizational group",
        change: {
            domain: "pcb",
            kind: "added",
            category: "other",
            classification: "secondary",
            objectKind: "group",
            reasons: ["object-added"],
        },
        mode: "composite",
    },
    {
        name: "net-class rule",
        change: {
            domain: "pcb",
            category: "rules",
            objectKind: "net-class",
            reasons: ["properties-changed"],
            fields: { "Track width": { old: 0.18, new: 0.2 } },
            details: { reviewOnly: true },
        },
        mode: "old-new",
    },
    {
        name: "net-class assignment",
        change: {
            domain: "pcb",
            category: "rules",
            objectKind: "net-class-assignment",
            reasons: ["properties-changed"],
            fields: { "Net class": { old: "Default", new: "USB" } },
            details: { reviewOnly: true },
        },
        mode: "old-new",
    },
    {
        name: "board fabrication constraints",
        change: {
            domain: "pcb",
            category: "rules",
            objectKind: "board-constraint",
            reasons: ["properties-changed"],
            fields: { "Minimum track width (mm)": { old: 0.127, new: 0.1 } },
            details: { reviewOnly: true },
        },
        mode: "old-new",
    },
];

describe("review presentation policy", () => {
    it.each(schematicCases)("chooses $mode for schematic $name", ({ change, mode }) => {
        expect(recommendPresentationForChange(reviewChange(change)).mode).toBe(mode);
    });

    it.each(pcbCases)("chooses $mode for PCB $name", ({ change, mode }) => {
        expect(recommendPresentationForChange(reviewChange(change)).mode).toBe(mode);
    });

    it("gives structured evidence priority over geometric PCB rules", () => {
        const result = recommendPresentationForChange(reviewChange({
            domain: "pcb",
            category: "components",
            objectKind: "footprint",
            reasons: ["moved"],
            details: { reviewOnly: true },
        }));

        expect(result).toMatchObject({
            mode: "old-new",
            rule: "structured-rule",
        });
    });

    it("uses the strongest evidence view for a mixed semantic group", () => {
        const result = recommendPresentationForChanges([
            reviewChange({ kind: "added", objectKind: "wire", category: "nets", reasons: ["object-added"] }),
            reviewChange({ objectKind: "no-connect", category: "nets", reasons: ["content-changed"] }),
            reviewChange({ objectKind: "table", reasons: ["content-changed"] }),
        ]);

        expect(result.mode).toBe("side-by-side");
        expect(result.rule).toMatch(/^group:/);
    });

    it("keeps both pages visible for a cross-sheet component relocation", () => {
        const result = recommendPresentationForChanges([
            reviewChange({
                id: "old-fl3",
                kind: "removed",
                category: "components",
                objectKind: "symbol",
                reference: "FL3",
                page: "usb_phy.kicad_sch",
                reasons: ["object-removed"],
            }),
            reviewChange({
                id: "new-fl3",
                kind: "added",
                category: "components",
                objectKind: "symbol",
                reference: "FL3",
                page: "control_port.kicad_sch",
                reasons: ["object-added"],
            }),
        ]);

        expect(result.mode).toBe("side-by-side");
        expect(result.rule).toBe("group:schematic-cross-sheet-relocation");
    });

    it("defaults the unselected overview to Composite", () => {
        expect(recommendPresentationForChanges([]).mode).toBe("composite");
    });

    /**
     * The tables are evaluated in order and each ends in an unconditional rule,
     * so every change resolves to a named rule. `recommendPresentationForChange`
     * falls back to `unmatched` only if that terminator is ever removed —
     * deliberately a safe default rather than a throw, because this runs during
     * render. This proves the fallback stays unreachable.
     */
    it("resolves every change to a named rule, never the safety fallback", () => {
        const domains = ["schematic", "pcb"] as const;
        const kinds = ["added", "removed", "changed"] as const;
        const categories = [
            undefined, "components", "symbols", "nets", "graphics", "text",
            "rules", "zones", "board", "sheets", "other",
        ] as const;
        const objectKinds = [
            undefined, "symbol", "pin", "sheet", "wire", "label", "junction",
            "footprint", "pad", "track", "via", "zone", "group", "net-class",
            "image", "text", "graphic",
        ];

        for (const domain of domains) {
            for (const kind of kinds) {
                for (const category of categories) {
                    for (const objectKind of objectKinds) {
                        const result = recommendPresentationForChange(reviewChange({
                            domain,
                            kind,
                            category,
                            objectKind: objectKind,
                        }));
                        expect(result.rule).not.toBe("unmatched");
                        expect(result.mode).toBeTruthy();
                    }
                }
            }
        }
    });
});
