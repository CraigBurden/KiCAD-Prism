"""Second, independent implementation of board-objects' ``contentDigest``.

Written in W0 from ``field-maps/board-objects.md`` ("contentDigest") alone, not
from the Node reference (``board_objects_sexpr.mjs``); ported from the W0
``digest_ref.py``. ``board_objects.capture`` checks that both give every
listed object the same digest.
"""

from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

NUMBER = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class Lst(list):
    start = 0


def parse(text: str):
    root = Lst()
    stack = [root]
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == "(":
            node = Lst()
            node.start = i
            stack[-1].append(node)
            stack.append(node)
            i += 1
        elif c == ")":
            if len(stack) > 1:
                stack.pop()
            i += 1
        elif c == '"':
            i += 1
            out = []
            while i < n:
                ch = text[i]
                i += 1
                if ch == '"':
                    break
                if ch == "\\" and i < n:
                    e = text[i]
                    i += 1
                    out.append({"n": "\n", "t": "\t", "r": "\r"}.get(e, e))
                else:
                    out.append(ch)
            stack[-1].append(("str", "".join(out)))
        elif c in " \t\r\n":
            i += 1
        else:
            s = i
            while i < n and text[i] not in '() \t\r\n"':
                i += 1
            stack[-1].append(("atom", text[s:i]))
    return root[0]


def head(node):
    if isinstance(node, Lst) and node and isinstance(node[0], tuple) and node[0][0] == "atom":
        return node[0][1]
    return None


def child(node, name):
    for c in node:
        if head(c) == name:
            return c
    return None


def ident(node):
    for key in ("uuid", "tstamp"):
        c = child(node, key)
        if c is not None:
            return c[1][1] if len(c) > 1 and isinstance(c[1], tuple) else None
    return None


def number(text: str) -> str:
    d = Decimal(text)
    if d == 0:
        return "0"
    s = format(d.normalize(), "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def literal(v: str) -> str:
    return json.dumps(v, ensure_ascii=False)


def A(s: str) -> set[str]:
    return set(s.split())


ALLOW = {
    "footprint": A("version embedded_fonts generator locked placed layer tedit at descr tags sheetname sheetfile path autoplace_cost90 autoplace_cost180 solder_mask_margin solder_paste_margin solder_paste_ratio clearance zone_connect thermal_width thermal_gap attr variant property model"),
    "pad": A("locked at size rect_delta layers remove_unused_layers keep_end_layers roundrect_rratio chamfer_ratio chamfer pinfunction pintype die_length solder_mask_margin solder_paste_margin solder_paste_margin_ratio clearance thermal_width thermal_gap thermal_bridge_angle zone_connect drill net options primitives"),
    "zone": A("locked net net_name name layer layers hatch priority connect_pads min_thickness filled_areas_thickness keepout fill polygon"),
    "fp_line": A("layer locked start end width stroke"), "gr_line": A("layer locked start end width stroke"),
    "fp_circle": A("layer locked center end width fill stroke"), "gr_circle": A("layer locked center end width fill stroke"),
    "fp_arc": A("layer locked start mid end angle width stroke"), "gr_arc": A("layer locked start mid end angle width stroke"),
    "fp_poly": A("layer locked pts width fill island stroke"), "gr_poly": A("layer locked pts width fill island stroke"),
    "fp_rect": A("layer locked start end width fill stroke"), "gr_rect": A("layer locked start end width fill stroke"),
    "fp_text": A("locked at hide unlocked layer effects"), "gr_text": A("at layer unlocked hide locked effects"),
    "dimension": A("locked layer pts height orientation leader_length gr_text format style"),
    "segment": A("start end width layer net locked"), "via": A("at size drill layers remove_unused_layers keep_end_layers locked free net"),
    "group": A("locked members"),
    "symbol": A("lib_name lib_id at mirror exclude_from_sim unit convert body_style in_bom on_board in_pos_files dnp property default_instance instances"),
    "sheet": A("at size exclude_from_sim in_bom on_board dnp stroke fill property instances"),
    "wire": A("pts stroke"), "bus": A("pts stroke"), "bus_entry": A("at size stroke"), "junction": A("at diameter color"), "no_connect": A("at"),
    "label": A("at effects"), "global_label": A("at effects shape property"), "hierarchical_label": A("at effects shape"),
    "polyline": A("pts stroke fill"), "bezier": A("pts stroke fill"), "rectangle": A("start end stroke fill"), "circle": A("center radius stroke fill"),
    "text": A("at effects exclude_from_sim"), "text_box": A("at size effects stroke fill exclude_from_sim margins"),
    "image": A("at scale data"), "table": A("column_count border separators column_widths row_heights cells"),
}
ALLOW["module"] = ALLOW["footprint"]
CHILD = {"footprint": A("pad zone fp_line fp_circle fp_arc fp_poly fp_rect fp_text"), "symbol": A("pin"), "sheet": A("pin")}
CHILD["module"] = CHILD["footprint"]
DROP = A("uuid tstamp fields_autoplaced filled_polygon render_cache")
NETS = A("pad segment arc via zone")


def allow_for(form, parent_head, board: bool):
    h = head(form)
    if h == "arc":
        return A("start mid end width layer net locked") if board else A("start mid end radius stroke fill")
    if h == "pin":
        return A("at effects") if parent_head == "sheet" else A("alternate")
    return ALLOW.get(h)


def canonical(form, allow, net_table) -> str:
    fh = head(form)
    children = CHILD.get(fh, set())

    def emit(node, depth, ancestors):
        if isinstance(node, tuple):
            kind, v = node
            if kind == "str":
                return literal(v)
            return number(v) if NUMBER.match(v) else v
        h = head(node)
        parts = []
        for k, c in enumerate(node):
            if not isinstance(c, Lst):
                parts.append(emit(c, depth + 1, ancestors))
                continue
            ch = head(c)
            if depth == 0 and k > 0 and ch not in allow and ch not in children:
                continue
            if ch in DROP:
                continue
            if ch == "page" and h == "path" and "instances" in ancestors:
                continue
            if depth == 0 and ch == "net" and fh in NETS:
                name = ""
                if fh == "zone":
                    nn = child(form, "net_name")
                    name = nn[1][1] if nn is not None and len(nn) > 1 and isinstance(nn[1], tuple) else ""
                if not name:
                    a = c[1] if len(c) > 1 else None
                    b = c[2] if len(c) > 2 else None
                    if isinstance(a, tuple) and a[0] == "atom" and NUMBER.match(a[1]):
                        name = (b[1] if isinstance(b, tuple) else "") or net_table.get(int(Decimal(a[1])), "")
                    elif isinstance(a, tuple):
                        name = a[1]
                if name:
                    parts.append(f"(net {literal(name)})")
                continue
            if depth == 0 and ch in children:
                cid = ident(c)
                parts.append(f"({ch} {literal(cid)})" if cid and UUID.match(cid) else f"({ch})")
                continue
            parts.append(emit(c, depth + 1, ancestors + [h]))
        return "(" + " ".join(parts) + ")"

    return emit(form, 0, [])


def digests(path: Path) -> dict[str, str]:
    """uuid -> contentDigest of every form with a canonical uuid and an allow-list (the later form wins)."""

    tree = parse(Path(path).read_text(encoding="utf-8"))
    board = str(path).endswith(".kicad_pcb")
    net_table = {}
    for c in tree:
        if head(c) == "net" and len(c) > 1 and isinstance(c[1], tuple) and c[1][0] == "atom" and NUMBER.match(c[1][1]):
            net_table[int(Decimal(c[1][1]))] = c[2][1] if len(c) > 2 and isinstance(c[2], tuple) else ""
    out: dict[str, str] = {}

    def walk(node, parent):
        if not isinstance(node, Lst):
            return
        i = ident(node)
        if i and UUID.match(i):
            allow = allow_for(node, head(parent) if parent is not None else None, board)
            if allow is not None:
                out[i] = hashlib.sha256(canonical(node, allow, net_table).encode("utf-8")).hexdigest()[:16]
        for c in node:
            walk(c, node)

    walk(tree, None)
    return out
