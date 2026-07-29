/**
 * Semantic properties of the object index that M2 will diff against.
 *
 * Run with `node --test scripts/` -- Node 22's built-in runner, so this needs
 * no dependency the backend image does not already have.
 *
 * The reconciliation check in ecad-parse.mjs already proves the index accounts
 * for every object the parser found, against real designs. These cover the
 * things a count cannot: what a hash does and does not respond to.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { index_document } from "./ecad-parse.mjs";

const SCHEMATIC = `
(kicad_sch
  (version 20231120)
  (lib_symbols
    (symbol "Device:R"
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
        (uuid "cafecafe-0000-0000-0000-000000000000"))))
  (symbol (lib_id "Device:R") (at 10 20 0) (unit 1)
    (uuid "11111111-1111-1111-1111-111111111111")
    (property "Reference" "R1" (at 12 19 0)
      (effects (font (size 1.27 1.27) (bold yes)) (justify left)))
    (property "Value" "10k" (at 12 21 0))
    (pin "1" (uuid "22222222-2222-2222-2222-222222222222"))
    (instances
      (project "obc"
        (path "/aaaa-0001" (reference "R1") (unit 1))
        (path "/aaaa-0002" (reference "R9") (unit 1)))))
  (wire (pts (xy 0 0) (xy 10 0))
    (uuid "33333333-3333-3333-3333-333333333333"))
  (junction (at 5 5) (diameter 0))
)
`;

const BOARD = `
(kicad_pcb
  (version 20240108)
  (net 0 "")
  (net 1 "VBUS")
  (footprint "R_0402" (layer "F.Cu") (at 1 2)
    (uuid "aaaaaaaa-0000-0000-0000-000000000000")
    (property "Reference" "R1")
    (path "/aaaa-0001")
    (fp_line (start 0 0) (end 1 0) (stroke (width 0.1) (type solid))
      (layer "F.SilkS") (uuid "eeeeeeee-0000-0000-0000-000000000000"))
    (pad "1" smd rect (at 0 0) (size 1 1) (layers "F.Cu") (net 1 "VBUS")
      (uuid "bbbbbbbb-0000-0000-0000-000000000000"))
    (zone (net 1) (net_name "VBUS") (layer "F.Cu")
      (uuid "ffffffff-0000-0000-0000-000000000000")
      (polygon (pts (xy 0 0) (xy 1 0) (xy 1 1)))))
  (zone (net 1) (net_name "VBUS") (layer "F.Cu")
    (uuid "cccccccc-0000-0000-0000-000000000000")
    (polygon (pts (xy 0 0) (xy 10 0) (xy 10 10)))
    (filled_polygon (layer "F.Cu") (pts (xy 0 0) (xy 5 0) (xy 5 5))))
  (segment (start 0 0) (end 4 0) (width 0.2) (layer "F.Cu") (net 1)
    (uuid "dddddddd-0000-0000-0000-000000000000"))
  (gr_text "ASSEMBLY" (at 2 3) (layer "F.SilkS")
    (uuid "12121212-0000-0000-0000-000000000000")
    (effects (font (size 1 1) (thickness 0.15))))
)
`;

const sch = (text = SCHEMATIC) => index_document(text, "root.kicad_sch");
const pcb = (text = BOARD) => index_document(text, "board.kicad_pcb");

test("the library symbol cache is not placed content", () => {
    // Scanning into lib_symbols would emit phantom objects no schematic item
    // ever resolves to, and its pin uuids would collide conceptually with
    // real instance pins.
    assert.equal(sch().byUuid.has("cafecafe-0000-0000-0000-000000000000"), false);
    assert.equal(sch().byUuid.has("22222222-2222-2222-2222-222222222222"), true);
});

test("an anonymous form is counted, not silently dropped", () => {
    // The junction has no uuid, so nothing can address it -- but a shortfall
    // that is never counted is indistinguishable from a parser gap.
    const result = sch();
    assert.equal(result.anonymous.junction, 1);
    assert.equal([...result.byUuid.values()].some((o) => o.kind === "junction"), false);
});

test("a symbol carries every KIID_PATH it is placed at", () => {
    // A reused hierarchical sheet is one file, so its instances share the
    // symbol's uuid. Taking only the first path is what collapsed distinct
    // components onto one change id.
    const symbol = sch().byUuid.get("11111111-1111-1111-1111-111111111111");
    assert.deepEqual(symbol.kiidPaths, [
        "/aaaa-0001/11111111-1111-1111-1111-111111111111",
        "/aaaa-0002/11111111-1111-1111-1111-111111111111",
    ]);
    assert.equal(symbol.refdes, "R1");
});

test("property attributes are visible, not just values", () => {
    const symbol = sch().byUuid.get("11111111-1111-1111-1111-111111111111");
    const reference = symbol.properties.find((p) => p.name === "Reference");
    assert.equal(reference.value, "R1");
    assert.deepEqual(reference.at, [12, 19]);
    assert.equal(reference.effects.font.bold, true);
    assert.equal(reference.effects.justify.horiz, "left");

    // A property that only moved is a change the current pipeline cannot see.
    const moved = sch(SCHEMATIC.replace("(at 12 19 0)", "(at 14 19 0)"));
    assert.notEqual(
        moved.byUuid.get("11111111-1111-1111-1111-111111111111").hash,
        symbol.hash,
    );
});

test("a wire keeps a centroid but no point list", () => {
    const wire = sch().byUuid.get("33333333-3333-3333-3333-333333333333");
    assert.deepEqual(wire.at, [5, 0]);
    assert.equal("pts" in wire, false);
});

test("editing a pad does not cascade into its footprint", () => {
    // The whole point of the shallow hash. A footprint whose hash covered its
    // pads would report both for a single pad edit.
    const before = pcb();
    const after = pcb(BOARD.replace("(size 1 1)", "(size 2 2)"));
    const pad = "bbbbbbbb-0000-0000-0000-000000000000";
    const footprint = "aaaaaaaa-0000-0000-0000-000000000000";

    assert.notEqual(before.byUuid.get(pad).hash, after.byUuid.get(pad).hash);
    assert.equal(before.byUuid.get(footprint).hash, after.byUuid.get(footprint).hash);
});

test("nested footprint zones are independently indexed", () => {
    const board = pcb();
    const zone = board.byUuid.get("ffffffff-0000-0000-0000-000000000000");

    assert.equal(zone.kind, "footprint_zone");
    assert.equal(zone.parentUuid, "aaaaaaaa-0000-0000-0000-000000000000");
    // Footprint graphics remain folded into the footprint's authored-content
    // hash so a library refresh does not fan out into thousands of redundant
    // child changes.
    assert.equal(
        board.byUuid.has("eeeeeeee-0000-0000-0000-000000000000"),
        false,
    );
});

test("moving a footprint does not disturb its pads", () => {
    const before = pcb();
    const after = pcb(BOARD.replace("(at 1 2)", "(at 9 9)"));
    const pad = "bbbbbbbb-0000-0000-0000-000000000000";
    const footprint = "aaaaaaaa-0000-0000-0000-000000000000";

    assert.notEqual(before.byUuid.get(footprint).hash, after.byUuid.get(footprint).hash);
    assert.equal(before.byUuid.get(pad).hash, after.byUuid.get(pad).hash);
    assert.deepEqual(after.byUuid.get(footprint).at, [9, 9]);
});

test("a regenerated zone fill is not an authored change", () => {
    // KiCad recomputes fills on every board edit. Hashing them would report
    // every zone as modified whenever anything on the board moved.
    const zone = "cccccccc-0000-0000-0000-000000000000";
    const base = pcb().byUuid.get(zone);
    const refilled = pcb(BOARD.replace("(xy 5 0) (xy 5 5)", "(xy 6 0) (xy 6 6)"));
    const reshaped = pcb(BOARD.replace("(xy 10 10)", "(xy 11 11)"));

    assert.equal(base.hash, refilled.byUuid.get(zone).hash);
    assert.notEqual(base.hash, reshaped.byUuid.get(zone).hash);
});

test("net names are resolved from codes", () => {
    // Tracks carry a numeric net code; position_delta groups by net name, so
    // an unresolved code would silently split one net into many.
    const board = pcb();
    assert.equal(board.byUuid.get("dddddddd-0000-0000-0000-000000000000").net, "VBUS");
    assert.equal(board.byUuid.get("bbbbbbbb-0000-0000-0000-000000000000").net, "VBUS");
    assert.equal(board.byUuid.get("cccccccc-0000-0000-0000-000000000000").net, "VBUS");
});

test("a track keeps a centroid so position_delta survives", () => {
    // The geometry sidecar M3 deletes is what supplies positions today, and
    // position_delta groups by net over tracks, not only components.
    const segment = pcb().byUuid.get("dddddddd-0000-0000-0000-000000000000");
    assert.deepEqual(segment.at, [2, 0]);
    assert.equal(segment.layer, "F.Cu");
});

test("structured graphic layers cross the object boundary as names", () => {
    const drawing = pcb().byUuid.get(
        "12121212-0000-0000-0000-000000000000",
    );
    assert.equal(drawing.kind, "drawing");
    assert.equal(drawing.layer, "F.SilkS");
});

test("a footprint's path is its schematic symbol's KIID_PATH", () => {
    const footprint = pcb().byUuid.get("aaaaaaaa-0000-0000-0000-000000000000");
    assert.deepEqual(footprint.kiidPaths, ["/aaaa-0001"]);
    assert.equal(footprint.refdes, "R1");
});

test("reformatting is not a change", () => {
    const compact = index_document(
        '(kicad_sch (wire (pts (xy 0 0) (xy 1 0)) (uuid "eeee-0001")))',
        "a.kicad_sch",
    );
    const spaced = index_document(
        '(kicad_sch\n  (wire\n    (pts (xy 0 0)   (xy 1 0))\n    (uuid "eeee-0001")\n  )\n)',
        "a.kicad_sch",
    );
    assert.equal(compact.byUuid.get("eeee-0001").hash, spaced.byUuid.get("eeee-0001").hash);
});

test("point order stays significant", () => {
    // Order is not semantic in a file, but it is in a polygon.
    const first = index_document(
        '(kicad_sch (polyline (pts (xy 0 0) (xy 1 1) (xy 2 0)) (uuid "eeee-0002")))',
        "a.kicad_sch",
    );
    const second = index_document(
        '(kicad_sch (polyline (pts (xy 0 0) (xy 2 0) (xy 1 1)) (uuid "eeee-0002")))',
        "a.kicad_sch",
    );
    assert.notEqual(
        first.byUuid.get("eeee-0002").hash,
        second.byUuid.get("eeee-0002").hash,
    );
});
