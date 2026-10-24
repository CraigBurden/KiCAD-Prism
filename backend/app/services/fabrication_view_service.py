"""View model for one fabrication package: layers, board extent, drill tools.

Design Comparison already parses Gerber and Excellon files and draws them as SVG,
but only as a two-revision diff.  This module answers the single-revision
question: what is in this package, how big is the board, which holes does it
drill, and what does each layer look like.  It adds no parser of its own; the
parsing, layer discovery and drawing all belong to ``fabrication_compare_service``.

Pure: files in, view model and SVG out.  Where the files come from (a Release
Studio build, committed outputs) is the caller's business.
"""

from __future__ import annotations

import re
import tempfile
import threading
from collections import Counter, OrderedDict
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from app.services import fabrication_compare_service as fab

#: Role names the viewer groups and colours by.
ROLES = ("silk", "paste", "mask", "copper", "outline", "drill", "other")

#: KiCad's own colours, as the Visualizer and Design Comparison draw them, so a layer
#: is the same colour wherever it is looked at. Each is drawn fully opaque.
_COLOURS = {
    ("copper", "top"): "#c83434",
    ("copper", "bottom"): "#4d7fc4",
    ("copper", "inner"): "#7fc87f",
    ("mask", "top"): "#d864ff",
    ("mask", "bottom"): "#02ffee",
    ("silk", "top"): "#f2eda1",
    ("silk", "bottom"): "#e8b2a7",
    ("paste", "top"): "#b4a09a",
    ("paste", "bottom"): "#00c2c2",
    ("outline", "both"): "#d0d2cd",
    ("drill", "both"): "#e3b72e",
}
#: The rest of KiCad's layers, by layer id.
_OTHER_COLOURS = {
    "f.adhesive": "#840084",
    "b.adhesive": "#000084",
    "f.fab": "#afafaf",
    "b.fab": "#585d84",
    "f.courtyard": "#ff26e2",
    "b.courtyard": "#26e9ff",
    "margin": "#ff26e2",
    "user.drawings": "#c2c2c2",
    "user.comments": "#5994dc",
    "user.eco1": "#b4dbd2",
    "user.eco2": "#d8c852",
    "user.1": "#c2c2c2",
    "user.2": "#5994dc",
    "user.3": "#b4dbd2",
    "user.4": "#d8c852",
    "user.5": "#c2c2c2",
    "user.6": "#5994dc",
    "user.7": "#b4dbd2",
    "user.8": "#d8c852",
    "user.9": "#e8b2a7",
}
_FALLBACK_COLOUR = "#afafaf"

#: The plot is first drawn white on black. A layer with nothing cleared is then drawn
#: straight in its colour; one with clear polarity (or an aperture with a hole) uses
#: that plot as a mask and fills its colour through it, so a cleared area cuts the
#: layer's own artwork without painting over the layers behind it. Either way the SVG
#: is its colour, fully opaque, where something is plotted and transparent elsewhere.
_MASK_ON = "#ffffff"
_MASK_OFF = "#000000"
_MASK_ID = "layer"

#: Bump whenever `svg()` draws differently. Layer URLs carry it, so a browser that
#: holds a year-long cached SVG from an older drawing fetches the new one instead
#: of stacking stale artwork (an opaque black layer once hid everything under it).
RENDER_VERSION = 3

#: A drawn line is never thinner than this on screen. A 0.1 mm silkscreen or outline
#: line is a fraction of a pixel when the whole board is in view, and anti-aliasing
#: then dims it well below its layer colour. 1.5 px always leaves at least three
#: quarters of a pixel fully covered, so the line reads in its own colour.
MIN_STROKE_PX = 1.5
#: How an SVG learns the size it is drawn at: an image SVG evaluates `width` media
#: queries against its own rendered width. One rule per step, each setting the
#: length of a pixel; steps are 20 % apart, so the line is at most 1.8 px.
_LADDER_FROM_PX = 160.0
_LADDER_TO_PX = 30000.0
_LADDER_STEP = 1.2
_POLYLINE_STROKE = re.compile(r'(<polyline\b[^>]*?) stroke-width="([0-9.]+)"')
_CIRCLE_RADIUS = re.compile(r'(<circle\b[^>]*?) r="([0-9.]+)"')


def with_minimum_stroke(svg: str, extent_mm: float, holes: bool = False) -> str:
    """The SVG with every drawn line at least ``MIN_STROKE_PX`` wide where it is shown.

    Only polylines (tracks, legend, profile, outlines); the lines inside an
    aperture macro are part of a pad's shape and keep their size. Beyond the
    ladder, or in a viewer that ignores it, a line is just its own width.

    ``holes`` gives a drill layer's circles the same minimum as a diameter: a
    0.3 mm hole is a dot smaller than a pixel with the whole board in view, and
    dims the same way a thin line does. Pads and vias are left true to size.
    """

    rules = []
    width = _LADDER_FROM_PX
    while width <= _LADDER_TO_PX:
        pixel_mm = MIN_STROKE_PX * extent_mm / width
        rules.append(f"@media (min-width:{round(width)}px){{svg{{--m:{pixel_mm:.6f}px}}}}")
        width *= _LADDER_STEP

    def widen(match: "re.Match[str]") -> str:
        value = match.group(2)
        return (
            f'{match.group(1)} stroke-width="{value}"'
            f' style="stroke-width:max({value}px,var(--m,0px))"'
        )

    def enlarge(match: "re.Match[str]") -> str:
        value = match.group(2)
        return f'{match.group(1)} r="{value}" style="r:max({value}px,calc(var(--m,0px)/2))"'

    body = _POLYLINE_STROKE.sub(widen, svg)
    if holes:
        body = _CIRCLE_RADIUS.sub(enlarge, body)
    head = body.index(">", body.index("<svg")) + 1
    return body[:head] + "<style>" + "".join(rules) + "</style>" + body[head:]


#: Top of the stack first. Within a side the order follows how a board is built.
_ROLE_RANK = {"silk": 0, "paste": 1, "mask": 2, "copper": 3}
_SIDE_RANK = {"top": 0, "inner": 1, "bottom": 2, "both": 3}


class FabricationViewError(ValueError):
    """The package holds nothing the viewer can draw."""


@dataclass(frozen=True)
class LayerInfo:
    id: str
    name: str
    function: str
    role: str
    side: str
    colour: str
    filename: str
    kind: str

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "function": self.function,
            "role": self.role,
            "side": self.side,
            "colour": self.colour,
            "file": self.filename,
            "kind": self.kind,
        }


#: Protel extensions, the convention KiCad, Altium and most CAM tools share.
_EXTENSION_ROLES: Dict[str, Tuple[str, str]] = {
    "gtl": ("copper", "top"), "gbl": ("copper", "bottom"),
    "gts": ("mask", "top"), "gbs": ("mask", "bottom"),
    "gto": ("silk", "top"), "gbo": ("silk", "bottom"),
    "gtp": ("paste", "top"), "gbp": ("paste", "bottom"),
    "gm1": ("outline", "both"), "gko": ("outline", "both"),
}
_TOKEN = re.compile(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+")
_TOP = {"top", "front", "f"}
_BOTTOM = {"bottom", "bot", "back", "b"}


def _classify_by_name(filename: str, name: str) -> Optional[Tuple[str, str]]:
    """Role and side of a layer a CAM tool named but did not attribute.

    Gerber X2 says what a file is.  Older exports and plugins (the JLCPCB one
    writes ``CuTop.gbr``, ``SilkBottom.gbr``) say it only in the name, so this
    reads the extension first and then the words in the name.  It is a fallback
    for files with no declared function, never an override of one.
    """

    suffix = Path(filename).suffix.lstrip(".").casefold()
    if suffix in _EXTENSION_ROLES:
        return _EXTENSION_ROLES[suffix]
    if re.fullmatch(r"g\d+", suffix):
        return "copper", "inner"
    tokens = [token.casefold() for token in _TOKEN.findall(name)]
    joined = "".join(tokens)
    if any(word in joined for word in ("edge", "outline", "profile")):
        return "outline", "both"
    side = "top" if _TOP & set(tokens) else "bottom" if _BOTTOM & set(tokens) else "both"
    for word, role in (("mask", "mask"), ("paste", "paste"), ("silk", "silk"), ("legend", "silk")):
        if word in joined:
            return role, side
    if {"cu", "copper"} & set(tokens):
        inner = bool(re.search(r"(?<![a-z])(in|inner|l)\d+", joined))
        return "copper", "inner" if inner and side == "both" else side
    return None


def classify(
    function: str, kind: str, filename: str = "", name: str = ""
) -> Tuple[str, str]:
    """Role and side of a layer from its Gerber X2 file function.

    ``Copper,L1,Top`` / ``Soldermask,Bot`` / ``Legend,Top`` / ``Profile,NP`` /
    ``NCDrill``.  A layer with no declared function falls back to its file name.
    Anything still unrecognised is ``other`` rather than dropped, so a package the
    viewer does not understand lists every file it holds.
    """

    if kind == "excellon":
        return "drill", "both"
    if function.startswith("Unknown"):
        guessed = _classify_by_name(filename, name or filename)
        if guessed:
            return guessed
    parts = [part.strip() for part in function.split(",")]
    head = parts[0].casefold()
    tail = parts[-1].casefold()
    side = {"top": "top", "bot": "bottom", "inr": "inner"}.get(tail, "both")
    if head == "copper":
        return "copper", side
    if head == "soldermask":
        return "mask", side
    if head == "legend":
        return "silk", side
    if head in {"paste", "solderpaste"}:
        return "paste", side
    if head == "profile":
        return "outline", "both"
    return "other", side if side != "inner" else "both"


def _natural(name: str) -> Tuple[Any, ...]:
    """``In2.Cu`` before ``In10.Cu``: digit runs compare as numbers."""

    return tuple(int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", name))


def _sort_key(info: LayerInfo) -> Tuple[Any, ...]:
    if info.role in _ROLE_RANK:
        # Group by side first so the list reads top to bottom through the board.
        return (_SIDE_RANK[info.side], _ROLE_RANK[info.role], _natural(info.name))
    return (10 + ROLES.index(info.role), 0, _natural(info.name))


def _unique_ids(layers: Sequence[fab.FabricationLayer]) -> List[str]:
    seen: Counter = Counter()
    ids: List[str] = []
    for layer in layers:
        base = fab._safe_name(layer.name).casefold()
        seen[base] += 1
        ids.append(base if seen[base] == 1 else f"{base}-{seen[base]}")
    return ids


def layers_from_files(files: Mapping[str, bytes]) -> List[fab.FabricationLayer]:
    """Discover layers in an in-memory file set, by the same rules as a directory."""

    with tempfile.TemporaryDirectory(prefix="prism-fab-view-") as scratch:
        root = Path(scratch)
        for name, data in files.items():
            # Members arrive with their archive path; only the file name matters.
            (root / Path(name).name).write_bytes(data)
        return fab.read_layers(root)


@dataclass
class FabricationPackage:
    """Parsed layers plus the extents every layer is drawn against."""

    layers: List[fab.FabricationLayer]
    infos: List[LayerInfo] = field(default_factory=list)
    _parsed: Dict[str, fab.GerberLayer] = field(default_factory=dict)
    _warnings: Dict[str, List[str]] = field(default_factory=dict)
    _bounds: Optional[Tuple[float, float, float, float]] = None
    _outline: Optional[Dict[str, Any]] = None

    @classmethod
    def from_files(cls, files: Mapping[str, bytes]) -> "FabricationPackage":
        layers = layers_from_files(files)
        if not layers:
            raise FabricationViewError("No Gerber or drill files in this package")
        package = cls(layers=layers)
        package._load()
        return package

    def _load(self) -> None:
        infos: List[LayerInfo] = []
        # Two layers can read the same ("Drill" for a PTH and an NPTH program);
        # the file name is then the only thing that tells them apart.
        names = Counter(layer.name for layer in self.layers)
        for layer, layer_id in zip(self.layers, _unique_ids(self.layers)):
            role, side = classify(layer.function, layer.kind, layer.filename, layer.name)
            colour = (
                _OTHER_COLOURS.get(layer_id, _FALLBACK_COLOUR)
                if role == "other"
                else _COLOURS.get((role, side)) or _COLOURS.get((role, "both"), _FALLBACK_COLOUR)
            )
            read = fab.parse_excellon if layer.kind == "excellon" else fab.parse_gerber
            try:
                parsed = read(layer.text)
            except fab.GerberParseError as error:
                self._warnings[layer_id] = [str(error)]
            else:
                self._parsed[layer_id] = parsed
                self._warnings[layer_id] = sorted(set(parsed.warnings))
            infos.append(LayerInfo(
                id=layer_id, name=layer.filename if names[layer.name] > 1 else layer.name,
                function=layer.function, role=role,
                side=side, colour=colour, filename=layer.filename, kind=layer.kind,
            ))
        infos.sort(key=_sort_key)
        self.infos = infos
        self._outline = fab._board_outline(self._outline_candidates(infos))
        self._bounds = self._extent()

    def _outline_candidates(self, infos: List[LayerInfo]) -> List[fab.FabricationLayer]:
        """The profile layer, under the name the outline finder looks for.

        It finds the board edge by KiCad's own layer name, which a plugin's
        ``EdgeCuts.gbr`` does not carry, so the layer classified as the profile
        is offered to it as ``Edge.Cuts``.
        """

        by_file = {layer.filename: layer for layer in self.layers}
        return [
            replace(by_file[info.filename], name="Edge.Cuts")
            for info in infos
            if info.role == "outline" and info.filename in by_file
        ]

    def _extent(self) -> Optional[Tuple[float, float, float, float]]:
        boxes: List[Tuple[float, float, float, float]] = []
        if self._outline:
            boxes.append(tuple(self._outline["bounds"]))  # type: ignore[arg-type]
        for parsed in self._parsed.values():
            box = fab._layer_bounds(parsed)
            if box is not None:
                # Gerber Y grows up; the board frame is KiCad's, Y down.
                boxes.append((box[0], -box[3], box[2], -box[1]))
        if not boxes:
            return None
        return (
            min(box[0] for box in boxes),
            min(box[1] for box in boxes),
            max(box[2] for box in boxes),
            max(box[3] for box in boxes),
        )

    def svg(self, layer_id: str) -> str:
        parsed = self._parsed.get(layer_id)
        info = next((item for item in self.infos if item.id == layer_id), None)
        if parsed is None or info is None or self._bounds is None:
            raise KeyError(layer_id)
        x0, y0, x1, y1 = self._bounds
        plot = fab.render_layer_svg(parsed, self._bounds, colour=_MASK_ON, background=_MASK_OFF)
        # The renderer's own SVG, minus its wrapper: a black rectangle, then the artwork.
        inner = plot[plot.index(">", plot.index("<svg")) + 1:plot.rindex("</svg>")]
        backdrop_end = inner.index("/>") + 2
        artwork = inner[backdrop_end:]
        box = f'x="{fab._fmt(x0)}" y="{fab._fmt(y0)}" width="{fab._fmt(x1 - x0)}" height="{fab._fmt(y1 - y0)}"'
        if f'"{_MASK_OFF}"' in artwork:
            # Something is cleared (clear polarity, or an aperture with a hole): fill the
            # colour through the plot as a mask, so the cut shows what is behind.
            body = (
                f'<defs><mask id="{_MASK_ID}" maskUnits="userSpaceOnUse" {box}>{inner}</mask></defs>'
                f'<rect {box} fill="{info.colour}" mask="url(#{_MASK_ID})"/>'
            )
        else:
            # Nothing is cleared, which is most layers: draw the artwork in the colour
            # directly. Same picture, and a mask costs the browser a second drawing.
            body = artwork.replace(f'"{_MASK_ON}"', f'"{info.colour}"')
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fab._fmt(x0)} {fab._fmt(y0)}'
            f' {fab._fmt(x1 - x0)} {fab._fmt(y1 - y0)}" preserveAspectRatio="xMidYMid meet">'
            f"{body}</svg>"
        )
        return with_minimum_stroke(svg, x1 - x0, holes=info.kind == "excellon")

    def drill_tools(self) -> List[Dict[str, Any]]:
        """One row per tool, hole count and slot count."""

        rows: List[Dict[str, Any]] = []
        for info in self.infos:
            parsed = self._parsed.get(info.id)
            if info.kind != "excellon" or parsed is None:
                continue
            hits: Counter = Counter()
            slots: Counter = Counter()
            for op in parsed.ops:
                (hits if op.kind == "flash" else slots)[op.aperture] += 1
            for key, aperture in parsed.apertures.items():
                if aperture.shape != "drill":
                    continue
                if not hits[key] and not slots[key]:
                    # Defined in the header and never used: nothing is drilled with it.
                    continue
                function = (aperture.macro or "").casefold()
                # The declared function decides; a file with none is read by its name,
                # where KiCad writes `-NPTH.drl` for the non-plated program.
                # The parser labels a tool with no attribute plain "drill".
                label = function if function not in ("", "drill") else info.filename.casefold()
                rows.append({
                    "diameter": aperture.params[0],
                    "plated": "nonplated" not in label and "npth" not in label,
                    "function": aperture.macro or "",
                    "hits": hits[key],
                    "slots": slots[key],
                    "file": info.filename,
                })
        rows.sort(key=lambda row: (not row["plated"], row["diameter"]))
        return rows

    def view(self) -> Dict[str, Any]:
        outline_bounds = self._outline["bounds"] if self._outline else None
        board = outline_bounds or (list(self._bounds) if self._bounds else None)
        tools = self.drill_tools()
        copper = [info for info in self.infos if info.role == "copper"]
        return {
            "present": True,
            "renderVersion": RENDER_VERSION,
            "bounds": list(self._bounds) if self._bounds else None,
            "board": board,
            "size": (
                {
                    "width": round(board[2] - board[0], 3),
                    "height": round(board[3] - board[1], 3),
                }
                if board
                else None
            ),
            "copperLayers": len(copper),
            "layers": [
                {**info.as_dict(), "warnings": self._warnings.get(info.id, [])}
                for info in self.infos
            ],
            "drill": {
                "tools": tools,
                "holes": sum(row["hits"] for row in tools),
                "slots": sum(row["slots"] for row in tools),
                "smallest": min((row["diameter"] for row in tools), default=None),
            },
        }


class BoundedCache:
    """A small bounded cache of parsed results, safe across request threads.

    A parsed package or placement view is expensive to build and cheap to hold
    only a few of, so this keeps the most recently used and drops the rest.
    """

    def __init__(self, size: int = 4) -> None:
        self._size = size
        self._items: "OrderedDict[Any, Any]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: Any) -> Optional[Any]:
        with self._lock:
            value = self._items.get(key)
            if value is not None:
                self._items.move_to_end(key)
            return value

    def put(self, key: Any, value: Any) -> None:
        with self._lock:
            self._items[key] = value
            while len(self._items) > self._size:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def __len__(self) -> int:
        return len(self._items)

    def __contains__(self, key: Any) -> bool:
        return key in self._items
