#!/usr/bin/env node
/**
 * Parse a KiCad snapshot with ecad-viewer's own parser and emit an object
 * index.
 *
 * M1 of the Design Comparison revamp. The point is not speed for its own
 * sake: the server and the browser currently disagree about what objects a
 * design contains, because Prism scans the files in Python and the viewer
 * parses them with `kicad-sexpr-parser`. Using the same parser on both sides
 * makes "an object the server named" and "an object the viewer can resolve"
 * the same set by construction.
 *
 * Input is a snapshot directory. Output is one entry per addressable object:
 *
 *   { uuid, kind, documentPath, kiidPaths, at, rotation, mirror, layer,
 *     net, properties, parentUuid, hash }
 *
 * with no bounds, no point lists and no rendering geometry. `at` is a
 * centroid for every object, not only for components, because `position_delta`
 * groups by net and needs a position for tracks too.
 *
 * Usage:
 *   node scripts/ecad-parse.mjs <snapshot-dir> [--out FILE] [--summary-only]
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BoardParser, SchematicParser } from "./vendor/kicad-sexpr-parser.mjs";

export const SCHEMA = "prism.ecad_object_index_v1";

/** Mirrors design_compare_service._GENERATED_PARTS. */
const GENERATED_PARTS = new Set([
    ".cache",
    ".git",
    ".kicad-prism",
    "archive",
    "autosave",
    "node_modules",
]);

// KiCad recomputes these on every board edit. Hashing them would report every
// zone as modified whenever anything on the board moved, which is worse than
// useless in a review tool -- while an edit to a zone *outline* still has to
// register.
const GENERATED_FIELDS = new Set(["filled_polygons", "render_cache"]);

// Identity, not content. A wire whose uuid changed but whose geometry did not
// is the same wire moved between files, and the hash should say so.
const IDENTITY_FIELDS = new Set(["uuid", "tstamp"]);

function collect_documents(root) {
    const documents = [];
    const walk = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!GENERATED_PARTS.has(entry.name)) {
                    walk(join(directory, entry.name));
                }
                continue;
            }
            const extension = extname(entry.name);
            if (extension === ".kicad_sch" || extension === ".kicad_pcb") {
                documents.push(join(directory, entry.name));
            }
        }
    };
    walk(root);
    return documents.sort();
}

function canonical(value) {
    if (Array.isArray(value)) {
        return value.map(canonical);
    }
    if (value && typeof value === "object") {
        const result = {};
        for (const key of Object.keys(value).sort()) {
            if (IDENTITY_FIELDS.has(key) || GENERATED_FIELDS.has(key)) {
                continue;
            }
            const child = value[key];
            if (child === undefined) {
                continue;
            }
            result[key] = canonical(child);
        }
        return result;
    }
    // -0 and 0 are the same coordinate; JSON.stringify disagrees.
    return typeof value === "number" && Object.is(value, -0) ? 0 : value;
}

function content_hash(value) {
    return createHash("blake2b512")
        .update(JSON.stringify(canonical(value)))
        .digest("hex")
        .slice(0, 16);
}

/** A hash of the object minus every addressable child.
 *
 * Without this, editing one pad reports the pad *and* its footprint, and
 * every group above it. The child is replaced by its own hash so that
 * re-parenting still registers on the parent.
 */
function shallow_hash(value, child_keys) {
    const shallow = { ...value };
    for (const key of child_keys) {
        const children = shallow[key];
        shallow[key] = Array.isArray(children)
            ? children.map((child) => child?.uuid ?? child?.tstamp ?? "")
            : undefined;
    }
    return content_hash(shallow);
}

function point_of(at) {
    const position = at?.position;
    if (!position || typeof position.x !== "number") {
        return null;
    }
    return [position.x, position.y];
}

function centroid_of(points) {
    const usable = (points ?? []).filter(
        (point) => point && typeof point.x === "number" && typeof point.y === "number",
    );
    if (usable.length === 0) {
        return null;
    }
    const x = usable.reduce((total, point) => total + point.x, 0) / usable.length;
    const y = usable.reduce((total, point) => total + point.y, 0) / usable.length;
    return [round6(x), round6(y)];
}

function round6(value) {
    // KiCad writes at most 6 decimal places. Keeping the float's full tail
    // would make a centroid differ between runs of the same file.
    return Math.round(value * 1e6) / 1e6;
}

function entry(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
            result[key] = value;
        }
    }
    return result;
}

/** Every KIID_PATH this symbol or sheet is placed at.
 *
 * A reused hierarchical sheet is one file, so each of its instances holds the
 * very same symbol UUIDs; KiCad identifies a symbol by sheet instance path +
 * UUID. Emitting an array rather than a single path is deliberate -- taking
 * the first one is what collapsed distinct components onto one change id.
 */
function kiid_paths(item) {
    const paths = new Set();
    for (const project of item?.instances?.projects ?? []) {
        for (const instance of project.paths ?? []) {
            if (typeof instance.path === "string" && instance.path) {
                paths.add(`${instance.path.replace(/\/$/, "")}/${item.uuid}`);
            }
        }
    }
    return paths.size > 0 ? [...paths].sort() : undefined;
}

function symbol_reference(symbol) {
    for (const project of symbol?.instances?.projects ?? []) {
        for (const instance of project.paths ?? []) {
            if (instance.reference) {
                return instance.reference;
            }
        }
    }
    if (symbol?.default_instance?.reference) {
        return symbol.default_instance.reference;
    }
    return symbol?.properties?.find((property) => property.name === "Reference")?.text;
}

function symbol_instances(symbol) {
    const instances = [];
    for (const project of symbol?.instances?.projects ?? []) {
        for (const instance of project.paths ?? []) {
            instances.push(
                entry({
                    reference: instance.reference,
                    path:
                        typeof instance.path === "string" && instance.path
                            ? `${instance.path.replace(/\/$/, "")}/${symbol.uuid}`
                            : undefined,
                }),
            );
        }
    }
    if (instances.length === 0 && symbol?.default_instance?.reference) {
        instances.push({ reference: symbol.default_instance.reference });
    }
    return instances.length > 0 ? instances : undefined;
}

function symbol_properties(symbol) {
    // Attributes, not just values. `at`, `hide` and `effects` on a property
    // are invisible to the current pipeline, which is why a field that only
    // moved reads as unchanged.
    return (symbol.properties ?? []).map((property) =>
        entry({
            name: property.name,
            value: property.text,
            at: point_of(property.at),
            rotation: property.at?.rotation,
            hide: property.hide === true ? true : undefined,
            effects: property.effects,
        }),
    );
}

function index_schematic(text, documentPath, timings) {
    const parseStarted = performance.now();
    const schematic = new SchematicParser().parse(text);
    timings.parserMs += performance.now() - parseStarted;
    const objects = [];
    const anonymous = {};

    const push = (item, kind, extra = {}, childKeys = []) => {
        if (!item?.uuid) {
            // Anonymous forms are not independently addressable -- the viewer
            // cannot resolve them either -- so they stay folded into whatever
            // parent's hash covers them. Counted, not silently dropped.
            anonymous[kind] = (anonymous[kind] ?? 0) + 1;
            return;
        }
        objects.push(
            entry({
                uuid: item.uuid,
                kind,
                documentPath,
                hash: shallow_hash(item, childKeys),
                ...extra,
            }),
        );
    };

    for (const symbol of schematic.symbols ?? []) {
        push(
            symbol,
            "symbol",
            entry({
                libId: symbol.lib_id,
                at: point_of(symbol.at),
                rotation: symbol.at?.rotation,
                mirror: symbol.mirror,
                unit: symbol.unit,
                dnp: symbol.dnp === true ? true : undefined,
                inBom: symbol.in_bom === false ? false : undefined,
                onBoard: symbol.on_board === false ? false : undefined,
                refdes: symbol_reference(symbol),
                kiidPaths: kiid_paths(symbol),
                instances: symbol_instances(symbol),
                properties: symbol_properties(symbol),
            }),
            // Not `properties`: a schematic property has no uuid, so
            // replacing it with a child reference would make every property
            // edit -- value, position, visibility -- invisible on the symbol.
            ["pins"],
        );
        for (const pin of symbol.pins ?? []) {
            push(
                pin,
                "pin",
                entry({
                    parentUuid: symbol.uuid,
                    number: pin.number,
                    // A pin instance carries no position of its own; the
                    // viewer derives it from the library symbol. Inheriting
                    // the parent's centroid keeps every object positioned
                    // without inventing geometry.
                    at: point_of(symbol.at),
                }),
            );
        }
    }

    for (const sheet of schematic.sheets ?? []) {
        push(
            sheet,
            "sheet",
            entry({
                at: point_of(sheet.at),
                kiidPaths: kiid_paths(sheet),
                properties: symbol_properties(sheet),
            }),
            ["pins"],
        );
        for (const pin of sheet.pins ?? []) {
            push(
                pin,
                "sheet_pin",
                entry({
                    parentUuid: sheet.uuid,
                    text: pin.text,
                    at: point_of(pin.at),
                }),
            );
        }
    }

    for (const [key, kind] of [
        ["wires", "wire"],
        ["buses", "bus"],
    ]) {
        for (const item of schematic[key] ?? []) {
            push(item, kind, entry({ at: centroid_of(item.pts) }));
        }
    }

    for (const [key, kind] of [
        ["junctions", "junction"],
        ["no_connects", "no_connect"],
        ["bus_entries", "bus_entry"],
    ]) {
        for (const item of schematic[key] ?? []) {
            push(item, kind, entry({ at: point_of(item.at) }));
        }
    }

    for (const [key, kind] of [
        ["net_labels", "label"],
        ["global_labels", "global_label"],
        ["hierarchical_labels", "hierarchical_label"],
    ]) {
        for (const item of schematic[key] ?? []) {
            push(
                item,
                kind,
                entry({
                    text: item.text,
                    net: item.text,
                    at: point_of(item.at),
                    rotation: item.at?.rotation,
                }),
            );
        }
    }

    for (const drawing of schematic.drawings ?? []) {
        push(
            drawing,
            "graphic",
            entry({
                at:
                    point_of(drawing.at) ??
                    centroid_of(drawing.pts) ??
                    centroid_of([drawing.start, drawing.end].filter(Boolean)),
                text: drawing.text,
            }),
        );
    }

    for (const image of schematic.images ?? []) {
        push(image, "image", entry({ at: point_of(image.at) }));
    }
    for (const table of schematic.tables ?? []) {
        push(table, "table", {});
    }

    return {
        objects,
        anonymous,
        collections: {
            symbols: (schematic.symbols ?? []).length,
            sheets: (schematic.sheets ?? []).length,
            wires: (schematic.wires ?? []).length,
            buses: (schematic.buses ?? []).length,
            junctions: (schematic.junctions ?? []).length,
            no_connects: (schematic.no_connects ?? []).length,
            bus_entries: (schematic.bus_entries ?? []).length,
            net_labels: (schematic.net_labels ?? []).length,
            global_labels: (schematic.global_labels ?? []).length,
            hierarchical_labels: (schematic.hierarchical_labels ?? []).length,
            drawings: (schematic.drawings ?? []).length,
            lib_symbols: (schematic.lib_symbols ?? []).length,
        },
    };
}

/** The net a board item belongs to, whichever shape the file used.
 *
 * The declared type is `number | string`, but the parser actually hands back
 * `{ number, name }` for pads, tracks and vias. Trusting the declaration
 * silently produced an undefined net on every copper object -- and
 * `position_delta` groups by net, so that would have split one net into many.
 */
function net_name_of(item, netsByCode) {
    const net = item?.net;
    if (net && typeof net === "object") {
        return net.name || netsByCode.get(net.number) || undefined;
    }
    if (typeof net === "string") {
        return net || undefined;
    }
    if (typeof net === "number") {
        return netsByCode.get(net) || undefined;
    }
    return undefined;
}

/** Canonical KiCad layer name across parser versions.
 *
 * Most board items expose a string, while text-like graphics may expose
 * `{ name, knockout }`. Letting that object cross the Node boundary makes the
 * Python adapter attempt to add a dictionary to a set.
 */
function layer_name_of(value) {
    if (value && typeof value === "object") {
        return value.name || value.canonical_name || undefined;
    }
    return typeof value === "string" && value ? value : undefined;
}

/** Footprint fields, from whichever of the two shapes the file uses.
 *
 * KiCad 8 moved footprint fields from the `properties` map to repeated
 * `(property "Name" "value")` forms, which the parser surfaces as
 * `properties_kicad_8`. Reading only `properties` left `refdes` undefined on
 * every footprint in every modern board.
 */
function footprint_properties(footprint) {
    const kicad8 = (footprint.properties_kicad_8 ?? []).map((property) =>
        entry({
            name: property.name,
            value: property.value ?? property.text,
            at: point_of(property.at),
            hide: property.hide === true ? true : undefined,
        }),
    );
    if (kicad8.length > 0) {
        return kicad8;
    }
    return Object.entries(footprint.properties ?? {}).map(([name, value]) => ({
        name,
        value,
    }));
}

function index_board(text, documentPath, timings) {
    const parseStarted = performance.now();
    const board = new BoardParser().parse(text);
    timings.parserMs += performance.now() - parseStarted;
    const objects = [];
    const anonymous = {};
    const netsByCode = new Map((board.nets ?? []).map((net) => [net.number, net.name]));
    const routeMetrics = {};

    const route_metric = (net) => {
        const name = net || "";
        return (routeMetrics[name] ??= {
            routeLengthMm: 0,
            viaCount: 0,
            usedLayers: [],
            viaSpans: {},
        });
    };

    const add_layer = (metric, value) => {
        const layer = layer_name_of(value);
        if (layer && !metric.usedLayers.includes(layer)) {
            metric.usedLayers.push(layer);
        }
    };

    const distance = (a, b) =>
        a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;

    const segment_length = (segment) => {
        if (!segment.mid) {
            return distance(segment.start, segment.end);
        }
        const a = segment.start;
        const b = segment.mid;
        const c = segment.end;
        if (!a || !b || !c) {
            return 0;
        }
        const determinant =
            2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(determinant) < 1e-12) {
            return distance(a, b) + distance(b, c);
        }
        const aa = a.x * a.x + a.y * a.y;
        const bb = b.x * b.x + b.y * b.y;
        const cc = c.x * c.x + c.y * c.y;
        const ux =
            (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y))
            / determinant;
        const uy =
            (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x))
            / determinant;
        const radius = Math.hypot(a.x - ux, a.y - uy);
        const angle = (point) => Math.atan2(point.y - uy, point.x - ux);
        const tau = Math.PI * 2;
        const ccw = ((angle(c) - angle(a)) % tau + tau) % tau;
        const midCcw = ((angle(b) - angle(a)) % tau + tau) % tau;
        const sweep = midCcw <= ccw + 1e-9 ? ccw : tau - ccw;
        return radius * sweep;
    };

    const push = (item, kind, extra = {}, childKeys = []) => {
        const uuid = item?.uuid || item?.tstamp;
        if (!uuid) {
            anonymous[kind] = (anonymous[kind] ?? 0) + 1;
            return;
        }
        objects.push(
            entry({
                uuid,
                kind,
                documentPath,
                hash: shallow_hash(item, childKeys),
                ...extra,
            }),
        );
    };

    for (const footprint of board.footprints ?? []) {
        const parentUuid = footprint.uuid || footprint.tstamp;
        push(
            footprint,
            "footprint",
            entry({
                libId: footprint.library_link,
                at: point_of(footprint.at),
                rotation: footprint.at?.rotation,
                layer: layer_name_of(footprint.layer),
                // `path` on a footprint is already the KIID_PATH of the
                // schematic symbol it came from.
                kiidPaths: footprint.path ? [footprint.path] : undefined,
                refdes: footprint_properties(footprint).find(
                    (property) => property.name === "Reference",
                )?.value,
                sheetfile: footprint.sheetfile || undefined,
                properties: footprint_properties(footprint),
            }),
            // Not `properties`: they carry no uuid, so replacing them with
            // child references would make every property edit invisible.
            ["pads", "zones", "drawings", "models"],
        );
        for (const pad of footprint.pads ?? []) {
            push(
                pad,
                "pad",
                entry({
                    parentUuid,
                    number: pad.number,
                    at: point_of(pad.at),
                    rotation: pad.at?.rotation,
                    layer: layer_name_of((pad.layers ?? [])[0]),
                    net: net_name_of(pad, netsByCode),
                }),
            );
        }
        for (const zone of footprint.zones ?? []) {
            push(
                zone,
                "footprint_zone",
                entry({
                    parentUuid,
                    at: centroid_of(
                        (zone.polygons ?? []).flatMap((poly) => poly.pts ?? []),
                    ),
                    layer: layer_name_of(
                        zone.layer ?? (zone.layers ?? [])[0],
                    ),
                    net: zone.net_name || net_name_of(zone, netsByCode),
                }),
            );
        }
    }

    for (const segment of board.segments ?? []) {
        const net = net_name_of(segment, netsByCode);
        const metric = route_metric(net);
        metric.routeLengthMm += segment_length(segment);
        add_layer(metric, segment.layer);
        push(
            segment,
            segment.mid ? "arc_segment" : "segment",
            entry({
                at: centroid_of([segment.start, segment.mid, segment.end].filter(Boolean)),
                layer: layer_name_of(segment.layer),
                net,
            }),
        );
    }

    for (const via of board.vias ?? []) {
        const net = net_name_of(via, netsByCode);
        const layers = (via.layers ?? []).map(layer_name_of).filter(Boolean);
        const metric = route_metric(net);
        metric.viaCount += 1;
        for (const layer of layers) {
            add_layer(metric, layer);
        }
        const span = layers.length > 0 ? layers.join("|") : "";
        metric.viaSpans[span] = (metric.viaSpans[span] ?? 0) + 1;
        push(
            via,
            "via",
            entry({
                at: point_of(via.at),
                layer: layers[0],
                layers,
                net,
            }),
        );
    }

    for (const zone of board.zones ?? []) {
        push(
            zone,
            "zone",
            entry({
                at: centroid_of((zone.polygons ?? []).flatMap((poly) => poly.pts ?? [])),
                layer: layer_name_of(zone.layer),
                net: zone.net_name || net_name_of(zone, netsByCode),
            }),
        );
    }

    for (const drawing of board.drawings ?? []) {
        push(
            drawing,
            "drawing",
            entry({
                at:
                    point_of(drawing.at) ??
                    centroid_of(drawing.pts) ??
                    centroid_of([drawing.start, drawing.mid, drawing.end].filter(Boolean)),
                layer: layer_name_of(drawing.layer),
                text: drawing.text,
            }),
        );
    }

    for (const group of board.groups ?? []) {
        // KiCad's auto-generated board-characteristics and stackup tables come
        // through as groups with a name, no id and `members: [null]`. Nothing
        // can address them, here or in the viewer.
        push({ ...group, uuid: group.id }, "group", entry({ name: group.name }));
    }

    return {
        objects,
        anonymous,
        routeMetrics,
        collections: {
            footprints: (board.footprints ?? []).length,
            pads: (board.footprints ?? []).reduce(
                (total, footprint) => total + (footprint.pads ?? []).length,
                0,
            ),
            footprint_zones: (board.footprints ?? []).reduce(
                (total, footprint) => total + (footprint.zones ?? []).length,
                0,
            ),
            segments: (board.segments ?? []).length,
            vias: (board.vias ?? []).length,
            zones: (board.zones ?? []).length,
            drawings: (board.drawings ?? []).length,
            groups: (board.groups ?? []).length,
            nets: (board.nets ?? []).length,
        },
    };
}

/** Index one document's text. The unit the tests exercise. */
export function index_document(text, documentPath) {
    const timings = { parserMs: 0 };
    const result =
        extname(documentPath) === ".kicad_pcb"
            ? index_board(text, documentPath, timings)
            : index_schematic(text, documentPath, timings);
    const byUuid = new Map(result.objects.map((object) => [object.uuid, object]));
    return { ...result, byUuid };
}

export function index_snapshot(root) {
    const started = performance.now();
    const documents = [];
    const objects = [];
    const collections = {};
    const anonymous = {};
    const routeMetrics = {};
    // `parserMs` is the parser alone; `parseMs` is parser plus building the
    // index on top of it. Keeping them apart is what makes this comparable
    // with the 639 ms the plan quotes, which measured only the parse.
    const timings = { parserMs: 0 };
    let readMs = 0;
    let parseMs = 0;

    for (const path of collect_documents(root)) {
        const documentPath = relative(root, path).split(sep).join("/");
        const readStarted = performance.now();
        const text = readFileSync(path, "utf8");
        readMs += performance.now() - readStarted;

        const parseStarted = performance.now();
        const board = extname(path) === ".kicad_pcb";
        let result;
        let error;
        try {
            result = board
                ? index_board(text, documentPath, timings)
                : index_schematic(text, documentPath, timings);
        } catch (cause) {
            error = String(cause?.message ?? cause);
            result = { objects: [], collections: {}, anonymous: {}, routeMetrics: {} };
        }
        const elapsed = performance.now() - parseStarted;
        parseMs += elapsed;

        objects.push(...result.objects);
        for (const [key, value] of Object.entries(result.collections)) {
            collections[key] = (collections[key] ?? 0) + value;
        }
        for (const [key, value] of Object.entries(result.anonymous ?? {})) {
            anonymous[key] = (anonymous[key] ?? 0) + value;
        }
        for (const [net, value] of Object.entries(result.routeMetrics ?? {})) {
            const metric = (routeMetrics[net] ??= {
                routeLengthMm: 0,
                viaCount: 0,
                usedLayers: [],
                viaSpans: {},
            });
            metric.routeLengthMm += value.routeLengthMm ?? 0;
            metric.viaCount += value.viaCount ?? 0;
            metric.usedLayers = [
                ...new Set([...metric.usedLayers, ...(value.usedLayers ?? [])]),
            ].sort();
            for (const [span, count] of Object.entries(value.viaSpans ?? {})) {
                metric.viaSpans[span] = (metric.viaSpans[span] ?? 0) + count;
            }
        }
        documents.push(
            entry({
                path: documentPath,
                docType: board ? "kicad_pcb" : "kicad_sch",
                bytes: statSync(path).size,
                objects: result.objects.length,
                parseMs: Math.round(elapsed * 1000) / 1000,
                error,
            }),
        );
    }

    const byKind = {};
    for (const object of objects) {
        byKind[object.kind] = (byKind[object.kind] ?? 0) + 1;
    }

    return {
        schema: SCHEMA,
        root,
        documents,
        objects,
        routeMetrics,
        counts: { total: objects.length, byKind, anonymous },
        collections,
        timings: {
            readMs: Math.round(readMs * 1000) / 1000,
            parserMs: Math.round(timings.parserMs * 1000) / 1000,
            indexMs: Math.round((parseMs - timings.parserMs) * 1000) / 1000,
            parseMs: Math.round(parseMs * 1000) / 1000,
            totalMs: Math.round((performance.now() - started) * 1000) / 1000,
        },
        // libuv normalises ru_maxrss to kilobytes on every platform,
        // including Darwin where the syscall reports bytes -- verified
        // against process.memoryUsage().rss rather than assumed, because
        // getting it wrong here understates peak memory 1000-fold and M1's
        // gate is a memory ceiling.
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        node: process.version,
    };
}

/** Collection totals the parser reports, against objects actually indexed.
 *
 * M1's gate is that the index accounts for everything the parser found. A
 * silent shortfall is the failure mode that matters -- an object the server
 * never names cannot appear in a diff -- so every collection is reconciled
 * explicitly and anything deliberately not indexed says why.
 */
const RECONCILIATION = {
    footprints: ["footprint"],
    pads: ["pad"],
    footprint_zones: ["footprint_zone"],
    segments: ["segment", "arc_segment"],
    vias: ["via"],
    zones: ["zone"],
    drawings: ["drawing", "graphic"],
    groups: ["group"],
    symbols: ["symbol"],
    sheets: ["sheet"],
    wires: ["wire"],
    buses: ["bus"],
    junctions: ["junction"],
    no_connects: ["no_connect"],
    bus_entries: ["bus_entry"],
    net_labels: ["label"],
    global_labels: ["global_label"],
    hierarchical_labels: ["hierarchical_label"],
};

const NOT_INDEXED = {
    nets: "connectivity, not placed content; kicad-monkey owns net identity",
    lib_symbols: "a definition cache, not placed content -- its pin uuids "
        + "would collide conceptually with real instance pins",
};

export function reconcile(report) {
    const rows = [];
    for (const [collection, kinds] of Object.entries(RECONCILIATION)) {
        const found = report.collections[collection];
        if (found === undefined) {
            continue;
        }
        const indexed = kinds.reduce(
            (total, kind) => total + (report.counts.byKind[kind] ?? 0),
            0,
        );
        const skipped = kinds.reduce(
            (total, kind) => total + (report.counts.anonymous[kind] ?? 0),
            0,
        );
        rows.push({
            collection,
            kinds,
            found,
            indexed,
            anonymous: skipped,
            delta: indexed + skipped - found,
        });
    }
    return {
        rows,
        notIndexed: NOT_INDEXED,
        shortfall: rows.filter((row) => row.delta !== 0),
    };
}

function main(argv) {
    const positional = [];
    let out = null;
    let summaryOnly = false;
    let repeat = 1;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--out") {
            out = argv[(index += 1)];
        } else if (argument === "--repeat") {
            repeat = Number(argv[(index += 1)]);
        } else if (argument === "--summary-only") {
            summaryOnly = true;
        } else {
            positional.push(argument);
        }
    }
    if (positional.length < 1 || !Number.isInteger(repeat) || repeat < 1) {
        console.error(
            "usage: ecad-parse.mjs <snapshot-dir>... [--out FILE] [--repeat N] "
            + "[--summary-only]",
        );
        process.exit(2);
    }

    // Several snapshots in one process is the production shape, not a
    // convenience: the design is one Node process per compare, parsing base
    // and head. Measured separately, each revision pays JIT warm-up that the
    // second one would not -- 2.1 s standalone against 1.3 s warm on the same
    // input, which is most of the difference between hitting M1's target and
    // missing it. Repeats also share the process on purpose: peak RSS is
    // monotone within one, so the reported ceiling is the worst case.
    const snapshots = [];
    let report;
    for (const root of positional) {
        const runs = [];
        for (let index = 0; index < repeat; index += 1) {
            report = index_snapshot(root);
            // A copy: the last run's timings object is the one `runs` gets
            // attached to, so keeping the reference makes it circular.
            runs.push({ ...report.timings });
        }
        report.reconciliation = reconcile(report);
        if (repeat > 1) {
            const totals = runs.map((timing) => timing.totalMs).sort((a, b) => a - b);
            report.timings.runs = runs;
            report.timings.medianTotalMs = totals[Math.floor(totals.length / 2)];
            report.timings.minTotalMs = totals[0];
            report.timings.maxTotalMs = totals[totals.length - 1];
        }
        snapshots.push(report);
    }

    const summaries = snapshots.map((snapshot) => ({
        ...snapshot,
        objects: undefined,
        documents: snapshot.documents.length,
    }));
    const payload =
        positional.length === 1
            ? snapshots[0]
            : {
                  schema: SCHEMA,
                  snapshots,
                  // RSS is process-wide, so the meaningful figure is the one
                  // read after the last snapshot, not a per-snapshot value.
                  peakRssBytes: process.resourceUsage().maxRSS * 1024,
                  totalMs: snapshots.reduce(
                      (total, snapshot) => total + snapshot.timings.totalMs,
                      0,
                  ),
              };

    if (out) {
        writeFileSync(
            out,
            JSON.stringify(
                summaryOnly
                    ? { ...payload, snapshots: summaries, objects: undefined }
                    : payload,
            ),
        );
    }
    console.log(
        JSON.stringify(
            positional.length === 1
                ? summaries[0]
                : { ...payload, snapshots: summaries },
            null,
            2,
        ),
    );
    const shortfall = snapshots.flatMap((snapshot) => snapshot.reconciliation.shortfall);
    if (shortfall.length > 0) {
        for (const row of shortfall) {
            console.error(
                `unaccounted: ${row.collection} parsed ${row.found}, indexed ${row.indexed}`,
            );
        }
        process.exit(1);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main(process.argv.slice(2));
}
