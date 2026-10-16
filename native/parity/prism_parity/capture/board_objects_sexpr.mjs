// Reference implementation of board-objects' `contentDigest`
// (native/contracts/prism/field-maps/board-objects.md, "contentDigest").
//
// Ported from the W0 prototype (w0/board-objects/sexpr.mjs, digest option "b",
// the allow-lists the maintainer accepted, decisions.md "Board objects" 1).
// The W0 Python `digest_ref.py` is an independent second implementation of the
// same section; board_objects.py cross-checks the two.
import { createHash } from "node:crypto";

// ---------------------------------------------------------------- reader
// Nodes: { t: "list", items, start } | { t: "atom", v } | { t: "str", v }.
// `start` is the UTF-16 offset of the opening parenthesis (only its order is used).
export function parse(text) {
    const root = { t: "list", items: [], start: 0 };
    const stack = [root];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const c = text.charCodeAt(i);
        if (c === 40) { // (
            const node = { t: "list", items: [], start: i };
            stack[stack.length - 1].items.push(node);
            stack.push(node);
            i++;
        } else if (c === 41) { // )
            if (stack.length > 1) stack.pop();
            i++;
        } else if (c === 34) { // "
            let v = "";
            i++;
            while (i < n) {
                const ch = text[i++];
                if (ch === '"') break;
                if (ch === "\\" && i < n) {
                    const e = text[i++];
                    v += e === "n" ? "\n" : e === "t" ? "\t" : e === "r" ? "\r" : e;
                } else v += ch;
            }
            stack[stack.length - 1].items.push({ t: "str", v });
        } else if (c === 32 || c === 9 || c === 10 || c === 13) {
            i++;
        } else {
            const s = i;
            while (i < n) {
                const d = text.charCodeAt(i);
                if (d === 40 || d === 41 || d === 32 || d === 9 || d === 10 || d === 13 || d === 34) break;
                i++;
            }
            stack[stack.length - 1].items.push({ t: "atom", v: text.slice(s, i) });
        }
    }
    return root.items.length === 1 ? root.items[0] : root;
}

export const head = (node) => (node?.t === "list" && node.items[0]?.t === "atom" ? node.items[0].v : undefined);
const childList = (node, name) => node.items.find((c) => head(c) === name);
const isValue = (node) => node?.t === "str" || node?.t === "atom";

/** The object's own identity: its direct `(uuid "…")`, else `(tstamp …)`. */
export function identityOf(node) {
    for (const key of ["uuid", "tstamp"]) {
        const c = childList(node, key);
        if (c) return isValue(c.items[1]) ? c.items[1].v : undefined;
    }
    return undefined;
}

/** uuid -> { node, parent, start } for every list form with a direct uuid/tstamp; the later form wins. */
export function indexForms(rootNode) {
    const byUuid = new Map();
    const walk = (node, parent) => {
        if (node.t !== "list") return;
        const id = identityOf(node);
        if (id) byUuid.set(id, { node, parent, start: node.start });
        for (const c of node.items) walk(c, node);
    };
    walk(rootNode, null);
    return byUuid;
}

// --------------------------------------------------------------- numbers
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Exact decimal value of a numeric atom, no exponent, no superfluous zeros, `0` for any zero (step 5). */
export function canonicalNumber(text) {
    let s = text;
    let sign = "";
    if (s[0] === "+" || s[0] === "-") {
        if (s[0] === "-") sign = "-";
        s = s.slice(1);
    }
    let exp = 0;
    const e = s.search(/[eE]/);
    if (e >= 0) {
        exp = Number(s.slice(e + 1));
        s = s.slice(0, e);
    }
    const [int, frac = ""] = s.split(".");
    const all = int + frac;
    const lead = all.length - all.replace(/^0+/, "").length;
    const point = int.length - lead + exp; // where the decimal point sits within `digits`
    const digits = all.slice(lead).replace(/0+$/, "");
    if (digits === "") return "0";
    let out;
    if (point <= 0) out = "0." + "0".repeat(-point) + digits;
    else if (point >= digits.length) out = digits + "0".repeat(point - digits.length);
    else out = digits.slice(0, point) + "." + digits.slice(point);
    return sign + out;
}

// ------------------------------------------------------- canonical text
const IDENTITY = new Set(["uuid", "tstamp"]);
const GENERATED = new Set(["fields_autoplaced", "filled_polygon", "render_cache"]);
const NET_CARRIERS = new Set(["pad", "segment", "arc", "via", "zone"]);
const FOOTPRINT_CHILDREN = new Set(["pad", "zone", "fp_line", "fp_circle", "fp_arc", "fp_poly", "fp_rect", "fp_text"]);
const CHILD_OBJECT_HEADS = {
    footprint: FOOTPRINT_CHILDREN,
    module: FOOTPRINT_CHILDREN,
    symbol: new Set(["pin"]),
    sheet: new Set(["pin"]),
};

const quote = (v) => JSON.stringify(v);

/** Canonical text of an object form (steps 2–5). ctx: { resolveNet(netNode, form), childObjectId(node) }. */
function canonicalText(form, ctx) {
    const formHead = head(form);
    const childHeads = CHILD_OBJECT_HEADS[formHead];
    const emit = (node, depth, path) => {
        if (node.t === "str") return quote(node.v);
        if (node.t === "atom") return NUMBER.test(node.v) ? canonicalNumber(node.v) : node.v;
        const h = head(node);
        const parts = [];
        for (const c of node.items) {
            if (c.t !== "list") {
                parts.push(emit(c, depth + 1, path));
                continue;
            }
            const ch = head(c);
            if (IDENTITY.has(ch) || GENERATED.has(ch)) continue;
            if (ch === "page" && h === "path" && path.includes("instances")) continue;
            if (depth === 0 && ch === "net" && NET_CARRIERS.has(formHead)) {
                const name = ctx.resolveNet(c, form);
                if (name) parts.push(`(net ${quote(name)})`);
                continue;
            }
            if (depth === 0 && childHeads?.has(ch)) {
                const id = ctx.childObjectId(c);
                parts.push(id ? `(${ch} ${quote(id)})` : `(${ch})`);
                continue;
            }
            parts.push(emit(c, depth + 1, [...path, h]));
        }
        return `(${parts.join(" ")})`;
    };
    return emit(form, 0, []);
}

export const digest = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

/** Step 3: `(net <code> ["name"])` or `(net "name")` by name; a zone prefers its non-empty `(net_name …)`. */
export function boardNetResolver(boardRoot) {
    const table = new Map();
    for (const c of boardRoot.items) {
        if (head(c) === "net" && c.items[1]?.t === "atom" && NUMBER.test(c.items[1].v)) {
            table.set(Number(c.items[1].v), isValue(c.items[2]) ? c.items[2].v : "");
        }
    }
    return (netNode, form) => {
        if (head(form) === "zone") {
            const nn = childList(form, "net_name");
            const v = nn && isValue(nn.items[1]) ? nn.items[1].v : "";
            if (v) return v;
        }
        const a = netNode.items[1];
        const b = netNode.items[2];
        if (a?.t === "atom" && NUMBER.test(a.v)) {
            const named = isValue(b) ? b.v : "";
            return named || table.get(Number(a.v)) || "";
        }
        if (isValue(a)) return a.v;
        return "";
    };
}

// ---------------------------------------------------------- allow-lists
// Step 1: direct child list heads kept per form head (field map table).
const L = (s) => new Set(s.split(/\s+/).filter(Boolean));
const ALLOW = {
    footprint: L("version embedded_fonts generator locked placed layer tedit at descr tags sheetname sheetfile path autoplace_cost90 autoplace_cost180 solder_mask_margin solder_paste_margin solder_paste_ratio clearance zone_connect thermal_width thermal_gap attr variant property model"),
    pad: L("locked at size rect_delta layers remove_unused_layers keep_end_layers roundrect_rratio chamfer_ratio chamfer pinfunction pintype die_length solder_mask_margin solder_paste_margin solder_paste_margin_ratio clearance thermal_width thermal_gap thermal_bridge_angle zone_connect drill net options primitives"),
    zone: L("locked net net_name name layer layers hatch priority connect_pads min_thickness filled_areas_thickness keepout fill polygon"),
    fp_line: L("layer locked start end width stroke"), gr_line: L("layer locked start end width stroke"),
    fp_circle: L("layer locked center end width fill stroke"), gr_circle: L("layer locked center end width fill stroke"),
    fp_arc: L("layer locked start mid end angle width stroke"), gr_arc: L("layer locked start mid end angle width stroke"),
    fp_poly: L("layer locked pts width fill island stroke"), gr_poly: L("layer locked pts width fill island stroke"),
    fp_rect: L("layer locked start end width fill stroke"), gr_rect: L("layer locked start end width fill stroke"),
    fp_text: L("locked at hide unlocked layer effects"), gr_text: L("at layer unlocked hide locked effects"),
    dimension: L("locked layer pts height orientation leader_length gr_text format style"),
    segment: L("start end width layer net locked"),
    via: L("at size drill layers remove_unused_layers keep_end_layers locked free net"),
    group: L("locked members"),
    symbol: L("lib_name lib_id at mirror exclude_from_sim unit convert body_style in_bom on_board in_pos_files dnp property default_instance instances"),
    sheet: L("at size exclude_from_sim in_bom on_board dnp stroke fill property instances"),
    wire: L("pts stroke"), bus: L("pts stroke"), bus_entry: L("at size stroke"), junction: L("at diameter color"), no_connect: L("at"),
    label: L("at effects"), global_label: L("at effects shape property"), hierarchical_label: L("at effects shape"),
    polyline: L("pts stroke fill"), bezier: L("pts stroke fill"), rectangle: L("start end stroke fill"), circle: L("center radius stroke fill"),
    text: L("at effects exclude_from_sim"), text_box: L("at size effects stroke fill exclude_from_sim margins"),
    image: L("at scale data"), table: L("column_count border separators column_widths row_heights cells"),
};
ALLOW.module = ALLOW.footprint;
const ALLOW_BOARD_ARC = L("start mid end width layer net locked");
const ALLOW_SCH_ARC = L("start mid end radius stroke fill");
const ALLOW_SYMBOL_PIN = L("alternate");
const ALLOW_SHEET_PIN = L("at effects");

function allowFor(form, parentHead, board) {
    const h = head(form);
    if (h === "arc") return board ? ALLOW_BOARD_ARC : ALLOW_SCH_ARC;
    if (h === "pin") return parentHead === "sheet" ? ALLOW_SHEET_PIN : ALLOW_SYMBOL_PIN;
    return ALLOW[h];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Digests of one document: returns (uuid) -> { start, digest, text? }. */
export function documentDigester(text, board) {
    const tree = parse(text);
    const byUuid = indexForms(tree);
    const ctx = {
        resolveNet: board ? boardNetResolver(tree) : () => "",
        childObjectId: (c) => {
            const id = identityOf(c);
            return id && UUID.test(id) ? id : undefined;
        },
    };
    return (uuid) => {
        const entry = byUuid.get(uuid);
        if (!entry) throw new Error(`no form with uuid ${uuid}`);
        const allow = allowFor(entry.node, head(entry.parent), board);
        if (!allow) throw new Error(`no allow-list for form ${head(entry.node)} (${uuid})`);
        const childHeads = CHILD_OBJECT_HEADS[head(entry.node)];
        const filtered = {
            t: "list",
            items: entry.node.items.filter((c, k) => k === 0 || c.t !== "list" || allow.has(head(c)) || childHeads?.has(head(c))),
        };
        return { start: entry.start, digest: digest(canonicalText(filtered, ctx)) };
    };
}
