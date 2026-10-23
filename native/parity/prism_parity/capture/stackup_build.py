"""The golden producer of ``prism.stackup.a0``: the W0 prototype, ported.

Independent of today's three producers and of the code under test: it reads
the board's S-expression tree (kicad_monkey's tokenizer only) and applies the
producer rules of ``field-maps/stackup.md`` (1-8) and the frozen
``stackup-a0.tsp``, with decisions.md Stackup 1-3:

1. one entry per dielectric sub-layer (``addsublayer``);
2. a ``type`` or layer-table type token outside the KiCad set is omitted, with
   the stage-parse warning ``stackup-unknown-token``;
3. a stackup whose copper differs from the layer table's still drives
   ``copperLayers`` and the via spans, with the warning ``stackup-copper-mismatch``.

The warnings are the manifest's (stage parse), not the member's; ``build``
returns them beside the document and the capture records them as notes.
"""

from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

SCHEMA = "prism.stackup.a0"
STACKUP_TYPES = {
    "Top Silk Screen", "Top Solder Paste", "Top Solder Mask", "copper", "core",
    "prepreg", "Bottom Solder Mask", "Bottom Solder Paste", "Bottom Silk Screen",
}
BOARD_LAYER_TYPES = {"signal", "power", "mixed", "jumper", "auxiliary", "front", "back", "user"}
VIA_TYPES = ("blind", "buried", "micro")  # header-token priority (fork vias.rs:63-66, kicad_monkey)
EDGE_CONNECTORS = ("yes", "bevelled")
DEFAULT_THICKNESS_NM = 1_600_000  # KiCad's 1.6 mm (fork extended.rs:10,159-160)


def nm(value_mm: Any) -> int:
    """conventions.md §6: round half away from zero of the binary64 product mm × 1e6."""

    return int(Decimal(float(value_mm) * 1e6).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def is_form(item: Any, head: str | None = None) -> bool:
    return isinstance(item, list) and bool(item) and (head is None or str(item[0]) == head)


def child(form: list | None, head: str) -> list | None:
    if form is None:
        return None
    for item in form[1:]:
        if is_form(item, head):
            return item
    return None


def value(form: list | None, head: str) -> Any:
    found = child(form, head)
    return found[1] if found is not None and len(found) > 1 else None


def text(raw: Any) -> str | None:
    """A token as a string; ``None`` for an absent or empty one (rule 4: empty strings are absent)."""

    if raw is None or isinstance(raw, list):
        return None
    result = str(raw)
    return result or None


def kind_of(name: str) -> str:
    """Rule 3: the entry's kind from its name alone."""

    if name.endswith(".Cu"):
        return "copper"
    if name in ("F.Mask", "B.Mask"):
        return "soldermask"
    if name in ("F.Paste", "B.Paste"):
        return "paste"
    if name in ("F.SilkS", "B.SilkS"):
        return "silkscreen"
    if name.startswith("dielectric"):
        return "dielectric"
    return "other"


def empty_form() -> dict:
    """The document for a project without a board (bundle-format.md §2.1).

    The stackup contract states no empty form. This is what the producer rules
    give for "no board file": no stackup (``present`` false, ``layers`` empty,
    no ``settings``, no ``stackThicknessNm``), KiCad's default board thickness
    (rule 1, ``(general (thickness))`` absent), no layer table, so no copper
    layers, and no vias. Reported to the lead as a contract gap.
    """

    return {
        "schema": SCHEMA,
        "present": False,
        "boardThicknessNm": DEFAULT_THICKNESS_NM,
        "layers": [],
        "copperLayers": [],
        "maskColors": {},
        "viaSpans": [],
        "boardLayers": [],
    }


def _stackup_entries(form: list, warnings: list) -> list[dict]:
    """Rule 2: one entry per sub-layer of one stackup ``(layer …)`` form."""

    name = str(form[1])
    kind = kind_of(name)
    layer_type = text(value(form, "type"))
    if layer_type is not None and layer_type not in STACKUP_TYPES:
        warnings.append(("stackup-unknown-token", f"stackup layer {name!r}: type {layer_type!r} is not a KiCad stackup type"))
        layer_type = None
    groups: list[list] = [[]]
    for item in form[2:]:
        if not isinstance(item, list) and str(item) == "addsublayer":
            groups.append([])
        elif isinstance(item, list):
            groups[-1].append(item)
    entries = []
    for index, group in enumerate(groups):
        pseudo = ["layer", *group]
        entry: dict = {"name": name, "sublayer": index, "kind": kind}
        if layer_type is not None:
            entry["type"] = layer_type
        thickness = child(pseudo, "thickness")
        if thickness is not None and len(thickness) > 1 and not isinstance(thickness[1], list):
            amount = nm(thickness[1])  # "(thickness <mm> locked)": the value is the thickness
            if amount > 0:
                entry["thicknessNm"] = amount
        material = text(value(pseudo, "material"))
        if material is not None:
            entry["material"] = material
        for key, field in (("epsilon_r", "epsilonR"), ("loss_tangent", "lossTangent")):
            raw = value(pseudo, key)
            if raw is not None and not isinstance(raw, list):
                entry[field] = float(raw)
        color = text(value(pseudo, "color"))
        if color is not None:
            entry["color"] = color
        entries.append(entry)
    return entries


def _yes(form: list, head: str) -> bool:
    return str(value(form, head) or "") == "yes"


def _drill(via: list, head: str) -> dict | None:
    form = child(via, head)
    if form is None:
        return None
    result: dict = {}
    size = value(form, "size")
    if size is not None and not isinstance(size, list):
        result["sizeNm"] = nm(size)
    layers = child(form, "layers")
    if layers is not None and len(layers) >= 3:
        if text(layers[1]):
            result["startLayer"] = str(layers[1])
        if text(layers[2]):
            result["stopLayer"] = str(layers[2])
    return result or None


def _drill_key(item: dict | None) -> tuple:
    if item is None:
        return (0, -1, "", "")
    return (1, item.get("sizeNm", -1), item.get("startLayer", ""), item.get("stopLayer", ""))


def build(board_text: str) -> tuple[dict, list[tuple[str, str]]]:
    """``(document, warnings)`` for one ``.kicad_pcb`` text."""

    from kicad_monkey.kicad_sexpr import parse_sexp

    warnings: list[tuple[str, str]] = []
    root = parse_sexp(board_text)
    if not is_form(root, "kicad_pcb"):
        raise ValueError("not a kicad_pcb")

    thickness = value(child(root, "general"), "thickness")
    board_thickness = nm(thickness) if thickness is not None and not isinstance(thickness, list) else DEFAULT_THICKNESS_NM

    board_layers = []
    table = child(root, "layers")
    for row in (table[1:] if table is not None else ()):
        if not isinstance(row, list) or len(row) < 2:
            continue
        item: dict = {"ordinal": int(row[0]), "name": str(row[1])}
        if len(row) > 2:
            token = text(row[2])
            if token in BOARD_LAYER_TYPES:
                item["type"] = token
            elif token is not None:
                warnings.append(("stackup-unknown-token", f"layer {row[1]!r}: type {token!r} is not a KiCad layer type"))
        if len(row) > 3 and text(row[3]):
            item["userName"] = str(row[3])
        board_layers.append(item)

    stackup = child(child(root, "setup"), "stackup")
    present = stackup is not None
    layers: list[dict] = []
    settings = None
    if present:
        for form in stackup[1:]:
            if is_form(form, "layer") and len(form) > 1:
                layers.extend(_stackup_entries(form, warnings))
        settings = {}
        finish = text(value(stackup, "copper_finish"))
        if finish is not None:
            settings["copperFinish"] = finish
        settings["dielectricConstraints"] = _yes(stackup, "dielectric_constraints")
        edge = text(value(stackup, "edge_connector"))
        if edge is not None and edge not in EDGE_CONNECTORS:
            warnings.append(("stackup-unknown-token", f"edge_connector {edge!r} is not a KiCad value"))
        settings["edgeConnector"] = edge if edge in EDGE_CONNECTORS else "none"
        settings["castellatedPads"] = _yes(stackup, "castellated_pads")
        settings["edgePlating"] = _yes(stackup, "edge_plating")

    table_copper = [row["name"] for row in board_layers if row["name"].endswith(".Cu")]
    if present:
        copper = [entry["name"] for entry in layers if entry["kind"] == "copper"]
        if copper != table_copper:
            warnings.append(("stackup-copper-mismatch", f"stackup copper {copper} differs from the layer table's {table_copper}"))
    else:
        copper = table_copper

    physical = [entry for entry in layers if entry["kind"] in ("copper", "dielectric", "soldermask")]
    stack_thickness = (
        sum(entry["thicknessNm"] for entry in physical)
        if present and physical and all("thicknessNm" in entry for entry in physical)
        else None
    )

    mask = {}
    for side, name in (("front", "F.Mask"), ("back", "B.Mask")):
        entry = next((e for e in layers if e["name"] == name and e["sublayer"] == 0), None)
        if entry is not None and "color" in entry:
            mask[side] = entry["color"]

    groups: dict = {}
    for via in root[1:]:
        if not is_form(via, "via"):
            continue
        header = {str(token) for token in via[1:] if not isinstance(token, list)}
        via_type = next((name for name in VIA_TYPES if name in header), "through")
        names_form = child(via, "layers")
        names = [str(token) for token in names_form[1:]] if names_form is not None else []
        start = names[0] if len(names) >= 1 and names[0] else None
        stop = names[1] if len(names) >= 2 and names[1] else None
        backdrill = _drill(via, "backdrill")
        tertiary = _drill(via, "tertiary_drill")
        key = (via_type, start, stop, json.dumps(backdrill, sort_keys=True), json.dumps(tertiary, sort_keys=True))
        if key not in groups:
            if start in copper and stop in copper:
                lo, hi = sorted((copper.index(start), copper.index(stop)))
                span = copper[lo:hi + 1]
            else:
                span = []
            record: dict = {"viaType": via_type}
            if start is not None:
                record["startLayer"] = start
            if stop is not None:
                record["stopLayer"] = stop
            record["spanLayers"] = span
            if backdrill is not None:
                record["backdrill"] = backdrill
            if tertiary is not None:
                record["tertiaryDrill"] = tertiary
            record["count"] = 0
            groups[key] = record
        groups[key]["count"] += 1

    def index_of(name: str | None) -> int:
        return copper.index(name) if name in copper else len(copper)

    spans = sorted(
        groups.values(),
        key=lambda r: (
            index_of(r.get("startLayer")), index_of(r.get("stopLayer")), r["viaType"],
            r.get("startLayer", ""), r.get("stopLayer", ""),
            _drill_key(r.get("backdrill")), _drill_key(r.get("tertiaryDrill")),
        ),
    )

    doc: dict = {"schema": SCHEMA, "present": present, "boardThicknessNm": board_thickness}
    if stack_thickness is not None:
        doc["stackThicknessNm"] = stack_thickness
    doc["layers"] = layers
    doc["copperLayers"] = copper
    if settings is not None:
        doc["settings"] = settings
    doc["maskColors"] = mask
    doc["viaSpans"] = spans
    doc["boardLayers"] = board_layers
    return doc, warnings
