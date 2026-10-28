// Today's Design Comparison object index on one snapshot, plus the reference
// `contentDigest` of every listed object (board-objects field map, "How a
// golden is produced from today's code", steps 2 and 3).
//
//   node board_objects_today.mjs <ecad-parse.mjs> <snapshot-dir>
//
// Run with ECAD_INDEX_CACHE=0 (Context.run_node sets it) so nothing is written
// beside the snapshot. Prints one JSON document:
//   { documents, objects, routeMetrics,      today's index_snapshot fields
//     forms: { <documentPath>: { <uuid>: { start, digest } } } }
// `forms` covers the non-review-only objects of every .kicad_sch/.kicad_pcb
// document whose id is a canonical uuid; `start` orders them in file order.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { documentDigester } from "./board_objects_sexpr.mjs";

const [parser, snapshot] = process.argv.slice(2);
if (!parser || !snapshot) {
    console.error("usage: board_objects_today.mjs <ecad-parse.mjs> <snapshot-dir>");
    process.exit(2);
}
if ((process.env.ECAD_INDEX_CACHE ?? "1") !== "0") {
    console.error("ECAD_INDEX_CACHE must be 0: index_snapshot would write a cache beside the snapshot");
    process.exit(2);
}
const { index_snapshot } = await import(pathToFileURL(parser).href);
const index = index_snapshot(snapshot);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const forms = {};
for (const document of index.documents) {
    const board = document.path.endsWith(".kicad_pcb");
    if (document.error || !(board || document.path.endsWith(".kicad_sch"))) continue;
    const digestOf = documentDigester(readFileSync(join(snapshot, document.path), "utf8"), board);
    const out = (forms[document.path] = {});
    for (const object of index.objects) {
        if (object.documentPath !== document.path || object.reviewOnly || !UUID.test(object.uuid)) continue;
        out[object.uuid] = digestOf(object.uuid);
    }
}

process.stdout.write(JSON.stringify({
    schema: index.schema,
    documents: index.documents.map(({ parseMs, ...rest }) => rest),
    objects: index.objects,
    routeMetrics: index.routeMetrics,
    forms,
}));
