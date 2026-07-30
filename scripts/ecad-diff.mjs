#!/usr/bin/env node
/**
 * Diff two parsed snapshots and emit only the delta.
 *
 * M2 of the Design Comparison revamp. One Node process parses base and head
 * and returns added / removed / modified. Shipping 44k parsed objects across
 * the Python/Node boundary would hand back everything the parser wins;
 * shipping ~2.5k changes will not.
 *
 * Identity is `documentPath#uuid`, not the uuid alone. A reused hierarchical
 * sheet is one file, so the same uuid legitimately appears in several
 * documents' *instances*; within one file it is unique. Collapsing on the uuid
 * is what merged distinct components onto one change id before `35cd76f`.
 *
 * A modification is classified rather than merely flagged: the parser knows an
 * object *moved* rather than that its bytes differ, for every kind, without a
 * special case for components.
 *
 * Usage:
 *   node scripts/ecad-diff.mjs <base-snapshot> <head-snapshot> [--out FILE]
 *                              [--summary-only]
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { index_snapshot } from "./ecad-parse.mjs";

export const SCHEMA = "prism.ecad_object_delta_v1";

/** Fields whose change has a name worth reporting, in report order. */
const CLASSIFIERS = [
    ["moved", (before, after) => !same_point(before.at, after.at)],
    ["rotated", (before, after) => (before.rotation ?? 0) !== (after.rotation ?? 0)],
    ["mirrored", (before, after) => before.mirror !== after.mirror],
    ["layer-changed", (before, after) => before.layer !== after.layer],
    ["net-changed", (before, after) => before.net !== after.net],
    ["renamed", (before, after) => before.refdes !== after.refdes],
    ["lib-changed", (before, after) => before.libId !== after.libId],
    ["dnp-changed", (before, after) => (before.dnp ?? false) !== (after.dnp ?? false)],
    [
        "re-pathed",
        (before, after) =>
            JSON.stringify(before.kiidPaths ?? []) !== JSON.stringify(after.kiidPaths ?? []),
    ],
];

// Values projected by the index rather than read verbatim from the item's
// shallow hash. Most importantly, a schematic pin inherits its owning
// symbol's position. Comparing only `hash` would therefore miss every pin move
// even though the object index carries the new position.
const INDEX_FIELDS = [
    "kind",
    "parentUuid",
    "at",
    "rotation",
    "mirror",
    "layer",
    "net",
    "refdes",
    "libId",
    "dnp",
    "kiidPaths",
    "instances",
    "properties",
];

function same_point(before, after) {
    if (!before || !after) {
        return before === after || (!before && !after);
    }
    return before[0] === after[0] && before[1] === after[1];
}

function key_of(object) {
    return `${object.documentPath}#${object.uuid}`;
}

function same_index_fields(before, after) {
    return INDEX_FIELDS.every(
        (field) => JSON.stringify(before[field] ?? null) === JSON.stringify(after[field] ?? null),
    );
}

function native_object(object) {
    return {
        uuid: object.uuid,
        kind: object.kind,
        documentPath: object.documentPath,
        parentUuid: object.parentUuid,
        at: object.at,
        rotation: object.rotation,
        mirror: object.mirror,
        layer: object.layer,
        layers: object.layers,
        net: object.net,
        refdes: object.refdes,
        libId: object.libId,
        dnp: object.dnp,
        inBom: object.inBom,
        onBoard: object.onBoard,
        kiidPaths: object.kiidPaths,
        instances: object.instances,
        properties: object.properties,
    };
}

function native_target(object) {
    return {
        uuid: object.uuid,
        kind: object.kind,
        documentPath: object.documentPath,
        parentUuid: object.parentUuid,
        at: object.at,
    };
}

function component_objects(objects) {
    return objects
        .filter((object) => object.kind === "symbol" || object.kind === "footprint")
        .map(native_object);
}

function property_deltas(before, after) {
    const deltas = [];
    const beforeByName = new Map((before.properties ?? []).map((p) => [p.name, p]));
    const afterByName = new Map((after.properties ?? []).map((p) => [p.name, p]));
    for (const name of new Set([...beforeByName.keys(), ...afterByName.keys()])) {
        const from = beforeByName.get(name);
        const to = afterByName.get(name);
        if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) {
            continue;
        }
        const fromAttributes = from === undefined
            ? undefined
            : {
                at: from.at,
                rotation: from.rotation,
                hide: from.hide ?? false,
                effects: from.effects,
            };
        const toAttributes = to === undefined
            ? undefined
            : {
                at: to.at,
                rotation: to.rotation,
                hide: to.hide ?? false,
                effects: to.effects,
            };
        deltas.push({
            name,
            from: from?.value,
            to: to?.value,
            // A property that only moved or was hidden is a real edit the
            // value-only comparison this replaces cannot see.
            attributesChanged:
                from !== undefined
                && to !== undefined
                && JSON.stringify(fromAttributes) !== JSON.stringify(toAttributes),
            fromAttributes,
            toAttributes,
        });
    }
    return deltas.sort((a, b) => a.name.localeCompare(b.name));
}

function position_delta(before, after) {
    if (!before.at || !after.at) {
        return undefined;
    }
    const dx = round6(after.at[0] - before.at[0]);
    const dy = round6(after.at[1] - before.at[1]);
    if (dx === 0 && dy === 0) {
        return undefined;
    }
    return { dx, dy, distance: round6(Math.hypot(dx, dy)) };
}

function round6(value) {
    return Math.round(value * 1e6) / 1e6;
}

export function diff_indexes(baseObjects, headObjects) {
    const base = new Map(baseObjects.map((object) => [key_of(object), object]));
    const head = new Map(headObjects.map((object) => [key_of(object), object]));
    const changes = [];
    const ignored = [];
    let unchanged = 0;

    for (const [key, after] of head) {
        const before = base.get(key);
        if (before === undefined) {
            changes.push({
                key,
                status: "added",
                ...native_object(after),
                compare: native_object(after),
            });
            continue;
        }
        if (before.hash === after.hash && same_index_fields(before, after)) {
            if (
                before.generatedHash !== undefined
                && before.generatedHash !== after.generatedHash
            ) {
                ignored.push({
                    key,
                    status: "ignored",
                    reason: "generated-content-only",
                    ...native_object(after),
                });
            }
            unchanged += 1;
            continue;
        }
        const reasons = CLASSIFIERS.filter(([, test]) => test(before, after)).map(
            ([name]) => name,
        );
        const properties = property_deltas(before, after);
        if (properties.length > 0) {
            reasons.push("properties-changed");
        }
        changes.push({
            key,
            status: "modified",
            ...native_object(after),
            base: native_object(before),
            compare: native_object(after),
            atBase: before.at,
            // A shallow-hash delta with no positional/identity/property
            // classifier is still authored content: pad shape, stroke, fill,
            // text effects, zone rules, and similar native fields. M7 names
            // that class explicitly instead of leaking "unclassified".
            reasons: reasons.length > 0 ? reasons : ["content-changed"],
            positionDelta: position_delta(before, after),
            properties: properties.length > 0 ? properties : undefined,
        });
    }

    for (const [key, before] of base) {
        if (head.has(key)) {
            continue;
        }
        changes.push({
            key,
            status: "removed",
            ...native_object(before),
            base: native_object(before),
        });
    }

    const byKind = {};
    const byReason = {};
    for (const change of changes) {
        const row = (byKind[change.kind] ??= { added: 0, removed: 0, modified: 0 });
        row[change.status] += 1;
        for (const reason of change.reasons ?? []) {
            byReason[reason] = (byReason[reason] ?? 0) + 1;
        }
    }

    changes.sort((a, b) => a.key.localeCompare(b.key));
    return {
        changes,
        ignored,
        counts: {
            added: changes.filter((change) => change.status === "added").length,
            removed: changes.filter((change) => change.status === "removed").length,
            modified: changes.filter((change) => change.status === "modified").length,
            unchanged,
            ignored: ignored.length,
            baseObjects: base.size,
            headObjects: head.size,
        },
        byKind,
        byReason,
    };
}

export function diff_snapshots(baseRoot, headRoot) {
    const started = performance.now();
    const base = index_snapshot(baseRoot);
    const head = index_snapshot(headRoot);
    const deltaStarted = performance.now();
    const delta = diff_indexes(base.objects, head.objects);
    const now = performance.now();

    return {
        schema: SCHEMA,
        base: {
            root: baseRoot,
            objects: base.counts.total,
            timings: base.timings,
            nativeObjects: base.objects.map(native_target),
            componentObjects: component_objects(base.objects),
            routeMetrics: base.routeMetrics,
        },
        head: {
            root: headRoot,
            objects: head.counts.total,
            timings: head.timings,
            nativeObjects: head.objects.map(native_target),
            componentObjects: component_objects(head.objects),
            routeMetrics: head.routeMetrics,
        },
        ...delta,
        timings: {
            baseMs: base.timings.totalMs,
            headMs: head.timings.totalMs,
            deltaMs: Math.round((now - deltaStarted) * 1000) / 1000,
            totalMs: Math.round((now - started) * 1000) / 1000,
        },
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        node: process.version,
    };
}

function main(argv) {
    const positional = [];
    let out = null;
    let summaryOnly = false;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--out") {
            out = argv[(index += 1)];
        } else if (argv[index] === "--summary-only") {
            summaryOnly = true;
        } else {
            positional.push(argv[index]);
        }
    }
    if (positional.length !== 2) {
        console.error(
            "usage: ecad-diff.mjs <base-snapshot> <head-snapshot> [--out FILE] "
            + "[--summary-only]",
        );
        process.exit(2);
    }

    const report = diff_snapshots(positional[0], positional[1]);
    const summary = {
        ...report,
        base: {
            ...report.base,
            nativeObjects: undefined,
            componentObjects: undefined,
            routeMetrics: undefined,
        },
        head: {
            ...report.head,
            nativeObjects: undefined,
            componentObjects: undefined,
            routeMetrics: undefined,
        },
        changes: undefined,
    };
    if (out) {
        writeFileSync(out, JSON.stringify(summaryOnly ? summary : report));
    }
    console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main(process.argv.slice(2));
}
