import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createGroupingContext, groupChanges } from "./comparison-review-groups";
import { prepareChangesForReview } from "./comparison-review-noise";
import { recommendPresentationForChanges } from "./comparison-review-policy";
import {
    DESIGN_COMPARE_RESULT_SCHEMA,
    type DesignCompareChange,
    type DesignCompareChangeDetails,
    type DesignCompareChangeSide,
    type DesignCompareResultA1,
    type DesignCompareRouteMetric,
    type DesignCompareStackup,
    type DesignCompareStackupLayer,
    type DesignCompareTarget,
    type DesignCompareTargetRole,
} from "./design-compare-result";

/**
 * `design-compare-result.ts` is written by hand. These tests tie it to the
 * contract: each key list below must name every key of its interface (checked
 * by the compiler) and every property of the generated JSON Schema's model
 * (checked here).
 */

const contract = (path: string) => resolve(__dirname, "../../../../native/contracts", path);

type Schema = {
    $id: string;
    properties: Record<string, unknown>;
    $defs: Record<string, { properties?: Record<string, unknown>; enum?: string[] }>;
};

const schema = JSON.parse(
    readFileSync(contract("generated/schema/DesignCompareResultA1.json"), "utf8"),
) as Schema;

/** Every key of `T`, and only those: a missing or extra key fails to compile. */
function keysOf<T>() {
    return <const K extends readonly (keyof T)[]>(
        keys: K & ([Exclude<keyof T, K[number]>] extends [never] ? unknown : never),
    ) => [...keys].sort();
}

const MODELS: Array<[string, string[]]> = [
    ["DesignCompareChange", keysOf<DesignCompareChange>()([
        "id", "domain", "kind", "category", "classification", "label", "objectKind",
        "reference", "net", "semanticId", "page", "reasons", "fields", "details", "base", "head",
    ])],
    ["DesignCompareChangeDetails", keysOf<DesignCompareChangeDetails>()([
        "reviewOnly", "connectivity", "instanceCount", "labelInstances", "sheetChange", "targets",
    ])],
    ["DesignCompareChangeSide", keysOf<DesignCompareChangeSide>()([
        "sourceId", "parentSourceId", "documentPath", "layer", "layers", "at", "reference", "net",
    ])],
    ["DesignCompareTarget", keysOf<DesignCompareTarget>()([
        "side", "sourceId", "kind", "role", "documentPath", "at", "sheetPath", "reference",
    ])],
    ["DesignCompareStackup", keysOf<DesignCompareStackup>()([
        "present", "changed", "base", "head", "baseSettings", "headSettings",
    ])],
    ["DesignCompareStackupLayer", keysOf<DesignCompareStackupLayer>()([
        "name", "type", "thicknessNm", "material", "color", "epsilonR", "lossTangent",
    ])],
    ["DesignCompareRouteMetric", keysOf<DesignCompareRouteMetric>()([
        "routeLengthNm", "viaCount", "usedLayers", "viaBarrelLengthNm",
    ])],
];

const ROLES: Record<DesignCompareTargetRole, true> = {
    component: true, wire: true, bus: true, "bus-entry": true, label: true, junction: true,
    terminal: true, sheet: true, "sheet-pin": true, symbol: true, "no-connect": true,
    graphic: true, footprint: true, pad: true, track: true, arc: true, via: true, zone: true,
    "footprint-graphic": true, "footprint-text": true, image: true, table: true, group: true,
    "net-class": true, "net-class-assignment": true,
};

describe("the a1 types mirror the contract", () => {
    it("names the schema", () => {
        expect(schema.$id).toBe("urn:prism:schema:prism.design_compare.result:a1");
        expect(DESIGN_COMPARE_RESULT_SCHEMA).toBe("prism.design_compare.result.a1");
        const root = keysOf<DesignCompareResultA1>()([
            "schema", "base", "head", "files", "schematic", "pcb", "bom", "stackup",
            "routeMetrics", "projectDiff", "counts",
        ]);
        expect(Object.keys(schema.properties).sort()).toEqual(root);
    });

    it.each(MODELS)("%s has the contract's properties", (model, keys) => {
        expect(Object.keys(schema.$defs[model]?.properties ?? {}).sort()).toEqual(keys);
    });

    it("has the contract's target roles", () => {
        expect(schema.$defs.DesignCompareTargetRole?.enum?.slice().sort())
            .toEqual(Object.keys(ROLES).sort());
    });
});

describe("the contract's example", () => {
    const example = JSON.parse(
        readFileSync(contract("prism/examples/DesignCompareResultA1.example.json"), "utf8"),
    ) as DesignCompareResultA1;

    it("reads as a review list", () => {
        const schematic = prepareChangesForReview(example.schematic.changes);
        const groups = groupChanges(
            schematic.changes,
            [],
            createGroupingContext(schematic.changes, example.bom),
        );
        expect(groups.length).toBeGreaterThan(0);
        // Its nets touch pins, and pins are reviewed side by side.
        const nets = groups.filter((group) => group.changes.some((change) =>
            change.details.targets?.some((target) => target.role === "terminal")));
        expect(nets.length).toBeGreaterThan(0);
        for (const group of nets) {
            expect(recommendPresentationForChanges(group.changes).rule)
                .toBe("schematic-electrical-exact");
        }
    });
});
