"""The harness document (CONTRACTS.md §16.7): Release Studio sheets in WireViz's look.

Sheet 1 is the drawing: each end a connector table with a row per cavity in use,
every wire drawn in its colour from its cavity into the bundle, the bundle as
the route tree (a sheath per segment with its length and wire count, a dot at
each branch point), splices and loose ends as leaves. Not to scale. The wiring
table and the BOM follow on as many sheets as they need. Every sheet is A3
landscape with the Release Studio frame and title block; a drawing that does not
fit A3 legibly moves up the ISO ladder.

Pure and deterministic: no dates, nothing from the host.
"""

from __future__ import annotations

import math
from dataclasses import replace
from typing import Sequence

from app.release_studio.documents.layout import (
    SHEET_LADDER,
    SHEET_SIZES,
    Element,
    Polyline,
    Rect,
    Rectangle,
    Sheet,
    SheetBuilder,
    Table,
    Text,
    TitleBlockField,
    draw_frame,
    draw_title_block,
    fit_text,
    text_width,
)

from app.system_builder.harness_outputs.model import (
    End,
    HarnessModel,
    Node,
    Wire,
    colour_codes,
    colour_text,
)
from app.system_builder.output_sheets import (
    TITLE_BLOCK,
    Placed,
    draw_placed,
    paginate_tables,
    table_area,
)

INK, MUTED, RULE, HEAD, STRIPE, SHEATH, UNKNOWN = (
    "#1d1d1f", "#6b6b70", "#9a9aa0", "#eef0f3", "#f7f8fa", "#c4c8cf", "#c8c8cc",
)
SWATCHES = {
    "BK": "#232323", "BN": "#8b5a2b", "RD": "#e0322d", "OG": "#f28a1e", "YE": "#f5d000", "GN": "#2f9e44",
    "BU": "#2b6fd6", "VT": "#8a4fd1", "GY": "#9a9a9a", "WH": "#ffffff", "PK": "#f48fb1", "TQ": "#30c5c0",
    "GD": "#c9a227", "SR": "#c0c0c0",
}

# Drawing units are millimetres at scale 1.
ROW = 4.6          # a cavity row
HEADER = 5.2       # a connector header row
CAV_W = 9.0        # the cavity column
LEAD = 16.0        # the straight lead from a cavity, which carries the wire tag
FAN = 30.0         # room for the wires to fan into the bundle
COLUMN = 48.0      # per tree depth between branch points
GAP = 9.0          # between stacked leaves
TEXT = 2.3
SMALL = 1.9
#: The smallest scale the drawing may be shrunk to: its row text stays ≥ 1.8 mm.
MIN_FACTOR = 1.8 / SMALL
#: A small harness is drawn up to this much larger, so it fills the sheet.
MAX_FACTOR = 1.6
FONT_FAMILY = "sans"


# ------------------------------------------------------------- primitives


class _Canvas:
    """Elements in drawing units, placed onto a sheet by :meth:`placed`."""

    def __init__(self) -> None:
        self.items: list[Element] = []

    def line(self, points: Sequence[tuple[float, float]], width: float, colour: str = INK) -> None:
        self.items.append(Polyline(tuple(points), width=width, colour=colour))

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str = "none", width: float = 0.3,
             colour: str = INK) -> None:
        self.items.append(Rectangle(Rect(x, y, w, h), width=width, colour=colour, fill=fill))

    def text(self, x: float, y: float, value: str, size: float = TEXT, *, bold: bool = False,
             colour: str = INK, anchor: str = "start") -> None:
        self.items.append(Text(x, y, value, size=size, bold=bold, colour=colour, anchor=anchor, family=FONT_FAMILY))  # type: ignore[arg-type]

    def circle(self, x: float, y: float, r: float, *, fill: str, colour: str = INK, width: float = 0.3) -> None:
        points = tuple((x + r * math.cos(2 * math.pi * k / 20), y + r * math.sin(2 * math.pi * k / 20)) for k in range(20))
        self.items.append(Polyline(points, width=width, colour=colour, fill=fill, close=True))

    def pill(self, x: float, y: float, value: str, size: float = SMALL) -> None:
        w = _width(value, size) + 2.6
        h = size + 1.4
        self.rect(x - w / 2, y - h / 2, w, h, fill="#ffffff", width=0.2, colour=RULE)
        self.text(x, y + size * 0.36, value, size, anchor="middle")

    def bounds(self) -> tuple[float, float, float, float]:
        xs: list[float] = []
        ys: list[float] = []
        for item in self.items:
            if isinstance(item, Polyline):
                xs += [p[0] for p in item.points]
                ys += [p[1] for p in item.points]
            elif isinstance(item, Rectangle):
                xs += [item.rect.x, item.rect.right]
                ys += [item.rect.y, item.rect.bottom]
            elif isinstance(item, Text):
                w = _width(item.value, item.size)
                left = item.x - (w if item.anchor == "end" else w / 2 if item.anchor == "middle" else 0)
                xs += [left, left + w]
                ys += [item.y - item.size, item.y]
        return (min(xs), min(ys), max(xs), max(ys)) if xs else (0.0, 0.0, 0.0, 0.0)

    def placed(self, factor: float, dx: float, dy: float) -> list[Element]:
        def at(x: float, y: float) -> tuple[float, float]:
            return (x * factor + dx, y * factor + dy)

        out: list[Element] = []
        for item in self.items:
            if isinstance(item, Polyline):
                out.append(replace(item, points=tuple(at(*p) for p in item.points), width=item.width * factor))
            elif isinstance(item, Rectangle):
                x, y = at(item.rect.x, item.rect.y)
                out.append(replace(item, rect=Rect(x, y, item.rect.width * factor, item.rect.height * factor),
                                   width=item.width * factor))
            elif isinstance(item, Text):
                x, y = at(item.x, item.y)
                out.append(replace(item, x=x, y=y, size=item.size * factor))
        return out


def _width(value: str, size: float, bold: bool = False) -> float:
    return text_width(value, size, family=FONT_FAMILY, bold=bold)  # type: ignore[arg-type]


def _fit(value: str, size: float, room: float, bold: bool = False) -> str:
    return fit_text(value, room, size, family=FONT_FAMILY, bold=bold)  # type: ignore[arg-type]


def _bezier(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float], d: tuple[float, float],
            steps: int = 14) -> list[tuple[float, float]]:
    out = []
    for k in range(steps + 1):
        t = k / steps
        u = 1 - t
        out.append((
            u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
            u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1],
        ))
    return out


def _fills(colour: str) -> tuple[str, str | None]:
    codes = colour_codes(colour)
    if not codes:
        return UNKNOWN, None
    return SWATCHES[codes[0]], SWATCHES[codes[1]] if len(codes) > 1 else None


def _wire(canvas: _Canvas, points: Sequence[tuple[float, float]], colour: str, width: float = 0.75) -> None:
    base, stripe = _fills(colour)
    canvas.line(points, width + 0.35, INK)
    canvas.line(points, width, base)
    if stripe:
        canvas.line(points, width / 3, stripe)


def _sheath(count: int) -> float:
    return min(7.0, 1.6 + 1.1 * math.sqrt(max(count, 1)))


# --------------------------------------------------------------- the tree


class _Tree:
    """The route tree rooted at one end; every end and node is a leaf of it."""

    def __init__(self, model: HarnessModel) -> None:
        ends = [end.id for end in model.ends]
        adjacent: dict[str, list[tuple[str, int]]] = {}
        for index, segment in enumerate(model.segments):
            adjacent.setdefault(segment.source, []).append((segment.target, index))
            adjacent.setdefault(segment.target, []).append((segment.source, index))
        routed_leaves = [end for end in ends if len(adjacent.get(end, [])) == 1]
        self.root = routed_leaves[0] if routed_leaves else (ends[0] if ends else "")
        self.parent: dict[str, tuple[str, int | None]] = {}
        self.depth = {self.root: 0}
        order = [self.root]
        for node in order:
            for nxt, index in sorted(adjacent.get(node, []), key=lambda item: (item[0], item[1])):
                if nxt not in self.depth:
                    self.depth[nxt] = self.depth[node] + 1
                    self.parent[nxt] = (node, index)
                    order.append(nxt)
        # Ends the route never reaches, splices and loose ends hang off the root, unrouted.
        for leaf in [*ends, *(node.id for node in model.nodes)]:
            if leaf not in self.depth:
                self.depth[leaf] = 1
                self.parent[leaf] = (self.root, None)
                order.append(leaf)
        self.order = order
        self.children: dict[str, list[str]] = {}
        for node in order[1:]:
            self.children.setdefault(self.parent[node][0], []).append(node)
        self.leaf_ids = set(ends) | {node.id for node in model.nodes}

    def leaves(self, node: str | None = None) -> list[str]:
        node = self.root if node is None else node
        if node != self.root and node in self.leaf_ids:
            return [node]
        return [leaf for child in self.children.get(node, []) for leaf in self.leaves(child)]


# ------------------------------------------------------------ the drawing


class _Box:
    """A connector table or a node card: header lines, a row per cavity or wire."""

    def __init__(self, title: str, lines: list[str], rows: list[tuple[str, str, tuple[str, ...]]]) -> None:
        self.title = title
        self.lines = lines
        self.rows = rows  # (cavity or tag, signal, wire numbers)
        longest = max([_width(signal, TEXT) for _, signal, _ in rows] + [0.0])
        header = max([_width(title, TEXT + 0.4, True)] + [_width(line, SMALL) for line in lines])
        self.width = max(48.0, min(84.0, max(longest + CAV_W + 6.0, header + 5.0)))
        self.top = HEADER * (1 + len(lines))
        self.height = self.top + (1.0 + ROW * len(rows) if rows else 0.0)

    def mouth(self) -> float:
        return self.top + 1.0 + ROW * len(self.rows) / 2 if self.rows else self.top / 2

    def draw(self, canvas: _Canvas, x: float, y: float, facing: str) -> dict[str, tuple[float, float]]:
        """Draw at (x, y); ports on the right edge (``facing="right"``) or the left. Returns port by row tag."""

        canvas.rect(x, y, self.width, self.height, fill="#ffffff", width=0.35)
        canvas.rect(x, y, self.width, self.top, fill=HEAD, width=0.35)
        canvas.text(x + 2.5, y + HEADER - 1.5, _fit(self.title, TEXT + 0.4, self.width - 5, True), TEXT + 0.4, bold=True)
        for n, line in enumerate(self.lines, 1):
            canvas.line([(x, y + HEADER * n), (x + self.width, y + HEADER * n)], 0.15, RULE)
            canvas.text(x + 2.5, y + HEADER * (n + 1) - 1.6, _fit(line, SMALL, self.width - 5), SMALL, colour=MUTED)
        ports: dict[str, tuple[float, float]] = {}
        for n, (tag, signal, wires) in enumerate(self.rows):
            ry = y + self.top + 1.0 + ROW * n
            cy = ry + ROW / 2
            if n % 2:
                canvas.rect(x + 0.3, ry, self.width - 0.6, ROW, fill=STRIPE, width=0.0, colour=STRIPE)
            cav_x = x + self.width - CAV_W if facing == "right" else x
            sig_x = x + 2.5 if facing == "right" else x + CAV_W + 2.5
            canvas.text(sig_x, cy + TEXT * 0.36, _fit(signal, TEXT, self.width - CAV_W - 5), TEXT)
            edge = cav_x if facing == "right" else cav_x + CAV_W
            canvas.line([(edge, ry), (edge, ry + ROW)], 0.15, RULE)
            canvas.text(cav_x + CAV_W / 2, cy + TEXT * 0.36, _fit(tag, TEXT, CAV_W - 1, True), TEXT, bold=True, anchor="middle")
            px = x + self.width if facing == "right" else x
            canvas.circle(px, cy, 0.75, fill=INK if len(wires) > 1 else "#ffffff", width=0.3)
            ports[tag] = (px, cy)
        return ports


def _end_box(end: End) -> _Box:
    housing = end.housing.label + (f" · {end.housing.manufacturer}" if end.housing and end.housing.manufacturer else "") \
        if end.housing else ("housing not in the catalog" if end.housing_reference else "no housing")
    contacts = sorted({cavity.contact.label for cavity in end.cavities if cavity.contact})
    lines = [
        housing,
        f"{end.ways}-way · {len(end.cavities)} used · contact {', '.join(contacts) if contacts else '—'}",
    ]
    if end.connector:
        lines.insert(0, f"mates {end.connector}")
    return _Box(end.title, lines, [(cavity.cavity, cavity.signal, cavity.wires) for cavity in end.cavities])


def _node_box(node: Node, wires: dict[str, Wire]) -> _Box:
    kind = {"splice": "Splice", "pigtail": "Pigtail", "test-point": "Test point"}.get(node.kind, "Open end")
    rows = [(number, wires[number].net or wires[number].label or "", (number,)) for number in node.wires if number in wires]
    lines = [node.detail or kind.lower()]
    if not rows:
        lines.append("no wires yet")
    return _Box(f"{node.name} · {kind}", lines, rows)


def _drawing(model: HarnessModel) -> _Canvas:
    canvas = _Canvas()
    tree = _Tree(model)
    wires = {wire.number: wire for wire in model.wires}
    boxes: dict[str, _Box] = {end.id: _end_box(end) for end in model.ends}
    boxes.update({node.id: _node_box(node, wires) for node in model.nodes})
    if not tree.root:
        canvas.text(0, 0, "This harness has no ends yet.", TEXT, colour=MUTED)
        return canvas

    leaves = tree.leaves()
    root_box = boxes[tree.root]
    max_depth = max([tree.depth[n] for n in tree.order if n not in tree.leaf_ids or n == tree.root] + [0])
    trunk_x0 = root_box.width + FAN
    right_x = trunk_x0 + COLUMN * max_depth + FAN + 8.0
    right_w = max([boxes[leaf].width for leaf in leaves] + [48.0])

    anchor: dict[str, tuple[float, float]] = {}
    leaf_y: dict[str, float] = {}
    top = 0.0
    for leaf in leaves:
        leaf_y[leaf] = top
        anchor[leaf] = (right_x - FAN + 8.0 if boxes[leaf].rows else right_x, top + boxes[leaf].mouth())
        top += boxes[leaf].height + GAP
    mid = sum(anchor[leaf][1] for leaf in leaves) / len(leaves) if leaves else root_box.mouth()
    root_y = max(0.0, mid - root_box.mouth())
    anchor[tree.root] = (trunk_x0, root_y + root_box.mouth())

    def place(node: str) -> float:
        if node not in anchor:
            ys = [place(child) for child in tree.children.get(node, [])] or [anchor[tree.root][1]]
            anchor[node] = (trunk_x0 + COLUMN * tree.depth[node], sum(ys) / len(ys))
        return anchor[node][1]

    for node in tree.order:
        place(node)

    # The bundle: a sheath per segment, a dashed stub to whatever the route does not reach.
    for node in tree.order[1:]:
        up, index = tree.parent[node]
        (x1, y1), (x2, y2) = anchor[up], anchor[node]
        if abs(y1 - y2) < 0.2:
            points = [(x1, y1), (x2, y2)]
        else:  # level out of the parent, an S-bend, level into the child
            a, b = x1 + (x2 - x1) * 0.15, x1 + (x2 - x1) * 0.55
            points = [(x1, y1), *_bezier((a, y1), ((a + b) / 2, y1), ((a + b) / 2, y2), (b, y2)), (x2, y2)]
        mx, my = _lerp(points, 0.5)
        if index is None:
            for k in range(0, 40):
                t0, t1 = k / 40, (k + 0.55) / 40
                seg = [_lerp(points, t0), _lerp(points, t1)]
                canvas.line(seg, 0.35, MUTED)
            canvas.pill(mx, my, "not routed")
            continue
        segment = model.segments[index]
        width = _sheath(len(segment.wires))
        canvas.line(points, width + 0.6, INK)
        canvas.line(points, width, SHEATH)
        canvas.pill(mx, my, f"{segment.length_nm / 1e6:.0f} mm")
        caption = f"{len(segment.wires)} wire{'s' if len(segment.wires) != 1 else ''}"
        if segment.coverings:
            caption += " · " + ", ".join(segment.coverings)
        canvas.text(mx + width / 2 + 2.0, my + SMALL + 2.4, caption, SMALL, colour=MUTED)
        if node not in tree.leaf_ids:
            r = width / 2 + 0.8
            canvas.circle(x2, y2, r, fill=INK)
            canvas.text(x2 - r - 1.5, y2 + 0.9, model.node_names.get(node, node), TEXT, bold=True, anchor="end")

    # Wires from each cavity into the bundle, then the boxes over them.
    tags: list[tuple[float, float, str]] = []
    for box_id in [tree.root, *leaves]:
        box = boxes[box_id]
        facing = "right" if box_id == tree.root else "left"
        x = 0.0 if box_id == tree.root else right_x
        y = root_y if box_id == tree.root else leaf_y[box_id]
        ports = _ports(box, x, y, facing)
        ax, ay = anchor[box_id]
        count = sum(len(numbers) for _, _, numbers in box.rows)
        spacing = min(0.9, _sheath(count) / max(count, 1))
        sign = 1 if facing == "right" else -1
        k = 0
        for tag, _, numbers in box.rows:
            px, py = ports[tag]
            lead = px + sign * LEAD
            for number in numbers:
                offset = (k - (count - 1) / 2) * spacing
                k += 1
                c = sign * 9.0
                path = [(px, py), (lead, py), *_bezier((lead, py), (lead + c, py), (ax - c, ay + offset), (ax, ay + offset))[1:]]
                _wire(canvas, path, wires[number].colour if number in wires else "")
            wire = wires.get(numbers[0]) if numbers else None
            label = (
                f"{wire.number} {colour_text(wire.colour)}".strip() if wire and len(numbers) == 1 else " ".join(numbers)
            )
            if numbers:
                tags.append((px + sign * (LEAD / 2 + 0.5), py, label))
    for x, y, label in tags:
        canvas.pill(x, y, _fit(label, SMALL, LEAD - 2))
    for box_id in [tree.root, *leaves]:
        facing = "right" if box_id == tree.root else "left"
        boxes[box_id].draw(canvas, 0.0 if box_id == tree.root else right_x,
                           root_y if box_id == tree.root else leaf_y[box_id], facing)
    return canvas


def _ports(box: _Box, x: float, y: float, facing: str) -> dict[str, tuple[float, float]]:
    px = x + box.width if facing == "right" else x
    return {tag: (px, y + box.top + 1.0 + ROW * n + ROW / 2) for n, (tag, _, _) in enumerate(box.rows)}


def _lerp(points: Sequence[tuple[float, float]], t: float) -> tuple[float, float]:
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths) or 1.0
    goal = t * total
    for (a, b), length in zip(zip(points, points[1:]), lengths):
        if goal <= length or length == lengths[-1]:
            f = goal / length if length else 0.0
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        goal -= length
    return points[-1]


# ----------------------------------------------------------------- tables


def _length(wire: Wire) -> str:
    if wire.length_nm is None:
        return "—"
    return f"{wire.length_nm / 1e6:.1f}" + (" (typed)" if wire.typed_length else "")


def terminal_text(model: HarnessModel, wire: Wire, side: str) -> str:
    terminal = wire.source if side == "from" else wire.target
    if terminal.kind == "contact":
        end = next((item for item in model.ends if item.id == terminal.node), None)
        return f"{end.title if end else terminal.node} : {terminal.cavity}"
    node = next((item for item in model.nodes if item.id == terminal.node), None)
    return node.name if node else terminal.node


def wire_rows(model: HarnessModel) -> list[tuple[str, ...]]:
    return [
        (
            wire.number,
            terminal_text(model, wire, "from"),
            terminal_text(model, wire, "to"),
            wire.net or "—",
            wire.gauge_awg or "—",
            colour_text(wire.colour) or "—",
            _length(wire),
            wire.label or (f"{wire.cable} · {wire.conductor}" if wire.cable else ""),
        )
        for wire in model.wires
    ]


def _tables(model: HarnessModel) -> list[Table]:
    wires = Table(
        columns=("Wire", "From", "To", "Net", "AWG", "Colour", "Length (mm)", "Label / cable"),
        rows=tuple(wire_rows(model)) or (("—",) * 8,),
        widths=(14.0, 70.0, 70.0, 62.0, 14.0, 20.0, 30.0, 60.0),
        title="WIRING TABLE",
        bordered=True,
    )
    bom = Table(
        columns=("#", "Kind", "Part", "Manufacturer", "Description", "Qty", "Where"),
        rows=tuple(
            (str(row.item), row.kind, row.part, row.manufacturer or "—", row.description or "—", row.quantity, row.where)
            for row in model.bom
        ) or (("—",) * 7,),
        widths=(8.0, 22.0, 56.0, 42.0, 82.0, 26.0, 104.0),
        title="BILL OF MATERIALS",
        bordered=True,
    )
    return [wires, bom]


# ----------------------------------------------------------------- sheets


def _title_block(builder: SheetBuilder, area: Rect, model: HarnessModel, sheet: int, total: int) -> Rect:
    fields = [
        TitleBlockField("System", f"{model.system} v{model.system_version}" if model.system_version else model.system),
        TitleBlockField("Harness", f"{model.label} · {len(model.wires)} wires"),
        TitleBlockField("Sheet", f"{sheet} of {total}"),
    ]
    if model.bundle_key:
        fields.append(TitleBlockField("Bundle", model.bundle_key[:16]))
    width, height = TITLE_BLOCK
    return draw_title_block(builder, area, title=f"{model.label} · Harness", fields=fields, width=width, height=height)


def _drawing_sheet(model: HarnessModel, total: int) -> Sheet:
    canvas = _drawing(model)
    x0, y0, x1, y1 = canvas.bounds()
    for size in SHEET_LADDER[SHEET_LADDER.index("A3"):]:
        width, height = SHEET_SIZES[size]
        inner = Rect(0, 0, width, height).inset(10.0)
        area = Rect(inner.x + 6, inner.y + 16, inner.width - 12, inner.height - 16 - TITLE_BLOCK[1] - 6)
        factor = min(MAX_FACTOR, area.width / max(x1 - x0, 1e-6), area.height / max(y1 - y0, 1e-6))
        if factor >= MIN_FACTOR or size == SHEET_LADDER[-1]:
            break
    builder = SheetBuilder("harness-drawing", f"{model.label} · drawing", size)
    inner = draw_frame(builder)
    builder.text(inner.x + 6, inner.y + 8, model.label, size=5.0, family="display", bold=True)
    builder.text(inner.x + 6, inner.y + 13, "Wiring and layout · not to scale · lengths are cut lengths "
                 "(route, housing depths and 10 % allowance)", size=2.2, colour=MUTED)
    dx = area.x + (area.width - (x1 - x0) * factor) / 2 - x0 * factor
    dy = area.y + (area.height - (y1 - y0) * factor) / 2 - y0 * factor
    builder.extend(canvas.placed(factor, dx, dy))
    _title_block(builder, inner, model, 1, total)
    return builder.build()


def _table_sheets(model: HarnessModel, first: int) -> list[list[Placed]]:
    """The tables as they fall on A3 sheets (a split table continues on the next)."""

    return paginate_tables(_tables(model), table_area("A3"))


def sheets(model: HarnessModel) -> list[Sheet]:
    """The harness document's sheets, in order."""

    pages = _table_sheets(model, 2)
    total = 1 + len(pages)
    out = [_drawing_sheet(model, total)]
    for index, tables in enumerate(pages, 2):
        builder = SheetBuilder(f"harness-tables-{index - 1}", f"{model.label} · wiring table and BOM", "A3")
        inner = draw_frame(builder)
        draw_placed(builder, tables)
        _title_block(builder, inner, model, index, total)
        out.append(builder.build())
    return out
