"""Golden for ``projections/board-objects.json`` (``prism.board_objects.a0``).

Field map ``board-objects.md``, "How a golden is produced from today's code":

1. Inputs: the project directory of the prepared case, copied as Design
   Comparison materializes it (``COMPARE_INPUTS`` under the project directory,
   flattened to it) into this member's scratch, never into a fixture.
2. Today's index: ``index_snapshot`` of dev's ``backend/design-compare-parser/
   ecad-parse.mjs`` with ``ECAD_INDEX_CACHE=0`` (``board_objects_today.mjs``).
3. Transform: grouped by document, kinds kebab-cased, coordinates to integer
   nanometres, renames, drops (divergences 4, 5, 6), file order; review-only
   objects sorted by id; ``contentDigest`` from the reference implementation
   (``board_objects_sexpr.mjs``, ported from the W0 prototype) and
   cross-checked with an independent Python implementation
   (``board_objects_digest.py``, the W0 ``digest_ref.py``).

Paths are RepoPaths (conventions §8, divergence 13): ``ctx.repo_path`` of
today's project-relative ``documentPath``.

Sidecar ``today-hash``: ObjectRef (``<RepoPath>#<uuid>``, review-only
``<RepoPath>#<id>``) -> today's ``hash`` of every listed object, for the
runner's step-4 equality pattern on revision pairs.

Check ``rebuild``: today's ``nativeObjects`` and ``componentObjects``
(``ecad-diff.mjs:194-236``) re-derived from the golden with "Rebuilding
today's index entry" and compared with today's, as maps keyed by ObjectRef.
"""

from __future__ import annotations

import re
import shutil
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from .. import jsonvalue
from . import Context, NotCaptured, Result
from . import board_objects_digest

MEMBER = "board-objects"
SCHEMA = "prism.board_objects.a0"
HERE = Path(__file__).resolve().parent
HELPER = HERE / "board_objects_today.mjs"

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
KIID_PATH = re.compile(r"^(?:/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})+$")
REVIEW_ID = re.compile(r"^[a-z]+(?:-[a-z]+)*:[0-9a-f]{16}$")
PARSED = (".kicad_sch", ".kicad_pcb", ".kicad_pro", ".kicad_dru")


# ------------------------------------------------------------ today's index


def snapshot(ctx: Context) -> Path:
    """Step 1: the project directory as DC materializes it, in this member's scratch.

    ``project_revision.materialize(..., source_set=COMPARE_INPUTS, scope=<project dir>,
    strip_scope=True)`` keeps the files ``COMPARE_INPUTS.keeps`` under the project
    directory and writes them relative to it. ``index_snapshot`` reads only the
    four parsed kinds, so only those are copied.
    """

    from app.services import project_revision

    def build() -> Path:
        root = ctx.scratch / "ecad-snapshot" / "snapshot"
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True)
        scope = ctx.src / ctx.project_dir if ctx.project_dir else ctx.src
        for path in sorted(scope.rglob("*")):
            if not path.is_file() or not path.name.lower().endswith(PARSED):
                continue
            scoped = path.relative_to(scope).as_posix()
            repo = path.relative_to(ctx.src).as_posix()
            if any(part == ".git" for part in Path(repo).parts):
                continue
            if not project_revision.COMPARE_INPUTS.keeps(repo, scoped):
                continue
            target = root / scoped
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
        return root

    return ctx.shared("ecad-snapshot", build)


def today_index(ctx: Context) -> dict:
    """Step 2: today's ``index_snapshot`` on the snapshot, plus reference digests per object."""

    def run() -> dict:
        root = snapshot(ctx)
        parser = ctx.today / "backend" / "design-compare-parser" / "ecad-parse.mjs"
        index = ctx.run_node(HELPER, str(parser), str(root))
        index["snapshot"] = str(root)
        stray = [p.name for p in root.parent.iterdir() if p.name != root.name]
        if stray:
            raise RuntimeError(f"index_snapshot wrote beside the snapshot: {stray}")
        return index

    return ctx.shared("ecad-index", run)


def unbalanced(text: str) -> str | None:
    """Where an s-expression file's lists do not balance, as the fork's reader rejects it.

    Fork ``sexpr.rs:412-426``: at end of input the innermost unclosed list is
    reported (``UnbalancedOpeningParenthesis``); a ``)`` with no open list is an
    error too. Quoted strings (with backslash escapes) are skipped.
    """

    opened: list[int] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == '"':
            i += 1
            while i < n and text[i] != '"':
                i += 2 if text[i] == "\\" else 1
        elif c == "(":
            opened.append(i)
        elif c == ")":
            if not opened:
                return f"unbalanced closing parenthesis at offset {i}"
            opened.pop()
        i += 1
    if opened:
        offset = opened[-1]
        line = text.count("\n", 0, offset) + 1
        column = offset - (text.rfind("\n", 0, offset) + 1) + 1
        return f"unclosed '(' at line {line}, column {column}"
    return None


def design_parse_failures(ctx: Context, index: dict) -> list[str]:
    """Schematics and boards stage parse cannot read: today's index errors, and files whose lists do not balance.

    Today's Node reader tolerates an unclosed list (``design_variants/malformed``'s
    ``broken.kicad_sch`` is indexed with no error); the bundle's parser rejects it,
    and a malformed schematic or board fails stage parse (bundle-format.md §2.3,
    field-maps/cli.md), so no projection exists.
    """

    root = Path(index["snapshot"])
    failures = []
    for document in index["documents"]:
        path = document["path"]
        if not path.endswith((".kicad_sch", ".kicad_pcb")):
            continue
        if document.get("error"):
            failures.append(f"{path}: today's parser: {document['error']}")
            continue
        problem = unbalanced((root / path).read_text(encoding="utf-8"))
        if problem:
            failures.append(f"{path}: {problem} (today's parser accepts it)")
    return failures


# ------------------------------------------------------------------- units


def mm_to_nm(value: float) -> int:
    """conventions §6 and field map step 3: round half away from zero of the double product."""

    return int(Decimal(value * 1e6).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def point(at: list | None) -> dict | None:
    if at is None:
        return None
    return {"xNm": mm_to_nm(at[0]), "yNm": mm_to_nm(at[1])}


def unpoint(p: dict | None) -> list | None:
    return None if p is None else [p["xNm"] / 1e6, p["yNm"] / 1e6]


def clean(d: dict) -> dict:
    """Drop absent values (JavaScript ``undefined``)."""

    return {k: v for k, v in d.items() if v is not None}


# ---------------------------------------------------------- review values


def _number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _scalar(v: Any) -> bool:
    return isinstance(v, (str, bool)) or _number(v)


def _flat(v: Any) -> bool:
    return isinstance(v, dict) and all(_scalar(x) for x in v.values())


def review_value(v: Any) -> Any:
    """``BoardObjectsReviewValue``: the closed union of review value shapes (field map, "Review fields")."""

    if _scalar(v) or _flat(v):
        return v
    if isinstance(v, list) and (
        all(isinstance(x, str) for x in v) or all(_number(x) for x in v) or all(_flat(x) for x in v)
    ):
        return v
    # Divergence 9: the field map writes such a value as its canonical JSON text.
    # No fixture has one; fail loudly rather than guess at today's canonical().
    raise RuntimeError(f"review value outside BoardObjectsReviewValue: {v!r}")


def review_fields(fields: dict | None) -> dict:
    return {k: review_value(fields[k]) for k in sorted(fields or {})}


# ----------------------------------------------------------------- effects


def _half_up(v: float) -> int:
    return int(Decimal(v).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def effects(e: dict | None) -> dict | None:
    if e is None:
        return None
    f = e.get("font")
    font = None
    if f is not None:
        size = f.get("size")
        color = f.get("color")
        font = clean({
            "face": f.get("face"),
            "size": {"heightNm": mm_to_nm(size["x"]), "widthNm": mm_to_nm(size["y"])} if size is not None else None,
            "thicknessNm": mm_to_nm(f["thickness"]) if f.get("thickness") is not None else None,
            "bold": f.get("bold"),
            "italic": f.get("italic"),
            "lineSpacing": f.get("line_spacing"),
            "color": clean({
                "red": _half_up(color["r"] * 255),
                "green": _half_up(color["g"] * 255),
                "blue": _half_up(color["b"] * 255),
                "alpha": color.get("a"),
            }) if color is not None else None,
        })
    j = e.get("justify")
    return clean({
        "font": font,
        "justify": {"horizontal": j["horiz"], "vertical": j["vert"], "mirror": j["mirror"]} if j is not None else None,
        "hide": e.get("hide"),
        "href": e.get("href"),
    })


def uneffects(e: dict | None) -> dict | None:
    if e is None:
        return None
    f = e.get("font")
    font = None
    if f is not None:
        size = f.get("size")
        color = f.get("color")
        font = clean({
            "face": f.get("face"),
            "size": {"x": size["heightNm"] / 1e6, "y": size["widthNm"] / 1e6} if size is not None else None,
            "thickness": f["thicknessNm"] / 1e6 if "thicknessNm" in f else None,
            "bold": f.get("bold"),
            "italic": f.get("italic"),
            "line_spacing": f.get("lineSpacing"),
            "color": {
                "r": color["red"] / 255, "g": color["green"] / 255, "b": color["blue"] / 255,
                "a": color.get("alpha", 1),
            } if color is not None else None,
        })
    j = e.get("justify")
    return clean({
        "font": font,
        "justify": {"horiz": j["horizontal"], "vert": j["vertical"], "mirror": j["mirror"]} if j is not None else None,
        "hide": e.get("hide"),
        "href": e.get("href"),
    })


# -------------------------------------------------------------- properties


def sch_property(p: dict) -> dict:
    return clean({
        "name": p.get("name"), "value": p.get("value"), "at": point(p.get("at")),
        "rotationDeg": p.get("rotation") if p.get("at") is not None else None,
        "hide": p.get("hide") is True, "effects": effects(p.get("effects")),
    })


def un_sch_property(p: dict) -> dict:
    return clean({
        "name": p["name"], "value": p["value"], "at": unpoint(p.get("at")),
        "rotation": p.get("rotationDeg") if "at" in p else None,
        "hide": True if p["hide"] else None, "effects": uneffects(p.get("effects")),
    })


def fp_property(p: dict) -> dict:
    return clean({"name": p.get("name"), "value": p.get("value"), "at": point(p.get("at")), "hide": p.get("hide") is True})


def un_fp_property(p: dict) -> dict:
    return clean({"name": p["name"], "value": p["value"], "at": unpoint(p.get("at")), "hide": True if p["hide"] else None})


def valid_paths(paths: list | None) -> list:
    """Divergence 5: invalid KIID paths are dropped."""

    return [p for p in (paths or []) if KIID_PATH.match(p)]


def refdes(r: str | None) -> str | None:
    """Divergence 6: an empty refdes is absent."""

    return None if r == "" else r


# ---------------------------------------------------------- object mapping

KIND_TO_BUNDLE = {"sheet_pin": "sheet-pin", "footprint_graphic": "footprint-graphic", "footprint_text": "footprint-text"}


def review_kind(kind: str) -> str:
    return kind if kind == "bus_alias" else kind.replace("_", "-")


def kind_today(kind: str) -> str:
    return kind.replace("-", "_")


def to_object(o: dict, digest: str) -> dict:
    """Today's index entry -> ``BoardObjectsObject`` (field map "Fields"; W0 ``mapping.mjs`` ``toObject``)."""

    kind = o["kind"]
    base = {"kind": KIND_TO_BUNDLE.get(kind, kind), "uuid": o["uuid"], "contentDigest": digest}
    rf = review_fields(o.get("reviewFields"))
    g = o.get
    if kind == "symbol":
        return clean({
            **base, "libId": g("libId"), "at": point(g("at")), "rotationDeg": g("rotation"), "mirror": g("mirror"),
            "dnp": g("dnp"), "inBom": g("inBom"), "onBoard": g("onBoard"), "refdes": refdes(g("refdes")),
            "kiidPaths": valid_paths(g("kiidPaths")),
            "instances": [
                clean({"reference": refdes(i.get("reference")),
                       "path": i["path"] if i.get("path") and KIID_PATH.match(i["path"]) else None})
                for i in g("instances") or []
            ],
            "properties": [sch_property(p) for p in g("properties") or []], "reviewFields": rf,
        })
    if kind == "pin":
        return clean({**base, "parentUuid": g("parentUuid"), "number": g("number"), "refdes": refdes(g("refdes")),
                      "at": point(g("at")), "reviewFields": rf})
    if kind == "sheet":
        return clean({**base, "at": point(g("at")), "kiidPaths": valid_paths(g("kiidPaths")),
                      "properties": [sch_property(p) for p in g("properties") or []]})
    if kind == "sheet_pin":
        return clean({**base, "parentUuid": g("parentUuid"), "name": g("name"), "text": g("text"), "at": point(g("at")),
                      "rotationDeg": g("rotation"), "reviewFields": rf})
    if kind in ("wire", "bus", "junction", "no_connect", "bus_entry", "image"):
        return clean({**base, "at": point(g("at")), "reviewFields": rf})
    if kind == "label":
        return clean({**base, "text": g("text"), "net": g("net"), "at": point(g("at")), "rotationDeg": g("rotation"),
                      "reviewFields": rf})
    if kind == "graphic":
        return clean({**base, "at": point(g("at")), "layer": g("layer"), "text": g("text"), "reviewFields": rf})
    if kind == "table":
        return clean({**base, "reviewFields": rf})
    if kind == "footprint":
        paths = valid_paths(g("kiidPaths"))
        return clean({
            **base, "libId": g("libId") or None, "at": point(g("at")), "rotationDeg": g("rotation"), "layer": g("layer"),
            "footprintPath": paths[0] if paths else None, "refdes": refdes(g("refdes")),
            "properties": [fp_property(p) for p in g("properties") or []], "reviewFields": rf,
        })
    if kind == "pad":
        return clean({**base, "parentUuid": g("parentUuid"), "number": g("number"), "refdes": refdes(g("refdes")),
                      "at": point(g("at")), "rotationDeg": g("rotation"), "layer": g("layer"), "net": g("net"),
                      "reviewFields": rf})
    if kind == "zone":
        return clean({**base, "parentUuid": g("parentUuid"), "refdes": refdes(g("refdes")), "at": point(g("at")),
                      "layer": g("layer"), "net": g("net"), "name": g("name"), "reviewFields": rf})
    if kind == "footprint_graphic":
        if g("text") is not None:
            raise RuntimeError(f"footprint_graphic with text: {o['uuid']}")
        return clean({**base, "parentUuid": g("parentUuid"), "refdes": refdes(g("refdes")), "at": point(g("at")),
                      "layer": g("layer"), "reviewFields": rf})
    if kind == "footprint_text":
        return clean({**base, "parentUuid": g("parentUuid"), "refdes": refdes(g("refdes")), "at": point(g("at")),
                      "rotationDeg": g("rotation"), "layer": g("layer"), "text": g("text"), "reviewFields": rf})
    if kind in ("track", "arc"):
        return clean({**base, "at": point(g("at")), "layer": g("layer"), "net": g("net"), "reviewFields": rf})
    if kind == "via":
        return clean({**base, "at": point(g("at")), "layer": g("layer"), "layers": g("layers") or [], "net": g("net"),
                      "reviewFields": rf})
    if kind == "group":
        return clean({**base, "name": g("name"), "reviewFields": rf})
    raise RuntimeError(f"unmapped kind {kind!r} ({o['uuid']})")


def from_object(c: dict, document_path: str, hash_: Any) -> dict:
    """"Rebuilding today's index entry" (field map; W0 ``mapping.mjs`` ``fromObject``)."""

    o = {"uuid": c["uuid"], "kind": kind_today(c["kind"]), "documentPath": document_path, "hash": hash_}
    at = unpoint(c.get("at"))
    g = c.get
    kind = c["kind"]
    if kind == "symbol":
        return clean({
            **o, "libId": g("libId"), "at": at, "rotation": g("rotationDeg"), "mirror": g("mirror"), "dnp": c["dnp"],
            "inBom": c["inBom"], "onBoard": c["onBoard"], "refdes": g("refdes"),
            "kiidPaths": c["kiidPaths"] or None, "instances": c["instances"] or None,
            "properties": [un_sch_property(p) for p in c["properties"]], "reviewFields": c["reviewFields"],
        })
    if kind == "pin":
        return clean({**o, "parentUuid": g("parentUuid"), "number": g("number"), "refdes": g("refdes"), "at": at,
                      "reviewFields": c["reviewFields"]})
    if kind == "sheet":
        return clean({**o, "at": at, "kiidPaths": c["kiidPaths"] or None,
                      "properties": [un_sch_property(p) for p in c["properties"]]})
    if kind == "sheet-pin":
        return clean({**o, "parentUuid": g("parentUuid"), "name": g("name"), "text": g("text"), "at": at,
                      "rotation": g("rotationDeg"), "reviewFields": c["reviewFields"]})
    if kind == "label":
        return clean({**o, "text": g("text"), "net": g("net"), "at": at, "rotation": g("rotationDeg"),
                      "reviewFields": c["reviewFields"]})
    if kind == "footprint":
        return clean({
            **o, "libId": g("libId"), "at": at, "rotation": g("rotationDeg"), "layer": g("layer"),
            "kiidPaths": [c["footprintPath"]] if "footprintPath" in c else None, "refdes": g("refdes"),
            "properties": [un_fp_property(p) for p in c["properties"]], "reviewFields": c["reviewFields"],
        })
    rebuilt = {**o, **c, "kind": kind_today(kind), "at": at, "rotation": g("rotationDeg"),
               "documentPath": document_path, "hash": hash_}
    rebuilt.pop("rotationDeg", None)
    rebuilt.pop("contentDigest", None)
    return clean(rebuilt)


def from_review_only(c: dict, document_path: str) -> dict:
    return {"uuid": c["id"], "kind": kind_today(c["kind"]), "name": c["name"], "documentPath": document_path,
            "reviewFields": c["reviewFields"], "reviewOnly": True, "hash": None}


# --------------------------------------------------------------- transform


def transform(ctx: Context, index: dict) -> tuple[dict, dict, list[str]]:
    """Step 3. Returns (golden, today-hash sidecar, notes)."""

    notes: list[str] = []
    stats = {"invalidUuid": 0, "duplicateUuid": 0, "duplicateReviewId": 0}
    by_document: dict[str, list[dict]] = {}
    for o in index["objects"]:
        by_document.setdefault(o["documentPath"], []).append(o)
    documents = []
    hashes: dict[str, str] = {}
    for d in index["documents"]:
        if d.get("error"):
            # Divergence 10: a document the parser rejects is not listed.
            notes.append(f"D10: {d['path']} not listed ({d['error']})")
            continue
        path = ctx.repo_path(d["path"])
        forms = index["forms"].get(d["path"], {})
        objects: dict[str, dict] = {}
        review_only: dict[str, dict] = {}
        for o in by_document.get(d["path"], []):
            if o.get("reviewOnly"):
                if not REVIEW_ID.match(o["uuid"]):
                    raise RuntimeError(f"review-only id outside the pattern: {d['path']}#{o['uuid']}")
                if o["uuid"] in review_only:
                    stats["duplicateReviewId"] += 1
                review_only[o["uuid"]] = o
                continue
            if not UUID.match(o["uuid"]):
                stats["invalidUuid"] += 1  # divergence 4
                continue
            if o["uuid"] in objects:
                stats["duplicateUuid"] += 1  # divergence 7
            objects[o["uuid"]] = o
        ordered = sorted(objects.values(), key=lambda o: forms[o["uuid"]]["start"])
        mapped = []
        for o in ordered:
            mapped.append(to_object(o, forms[o["uuid"]]["digest"]))
            hashes[f"{path}#{o['uuid']}"] = o["hash"]
        review = []
        for rid in sorted(review_only):
            o = review_only[rid]
            review.append({"kind": review_kind(o["kind"]), "id": rid, "name": o["name"],
                           "reviewFields": review_fields(o.get("reviewFields"))})
            hashes[f"{path}#{rid}"] = o["hash"]
        documents.append({"path": path, "objects": mapped, "reviewOnlyObjects": review})
    documents.sort(key=lambda d: d["path"])
    for key, value in stats.items():
        if value:
            notes.append(f"{key}: {value}")
    return {"schema": SCHEMA, "documents": documents}, dict(sorted(hashes.items())), notes


# ----------------------------------------------------------- rebuild check

NATIVE_OBJECT = ("uuid", "kind", "documentPath", "parentUuid", "at", "rotation", "mirror", "layer", "layers", "net",
                 "refdes", "libId", "dnp", "inBom", "onBoard", "kiidPaths", "instances", "properties", "number",
                 "text", "name", "reviewFields", "reviewOnly")
NATIVE_TARGET = ("uuid", "kind", "documentPath", "parentUuid", "at")


def _pick(o: dict, keys: tuple[str, ...]) -> dict:
    """``native_object`` / ``native_target`` (``ecad-diff.mjs:194-230``) after JSON serialization."""

    return {k: o[k] for k in keys if k in o}


def sides(objects: list[dict]) -> dict[str, dict[str, dict]]:
    native: dict[str, dict] = {}
    components: dict[str, dict] = {}
    for o in objects:
        key = f"{o['documentPath']}#{o['uuid']}"
        native[key] = _pick(o, NATIVE_TARGET)
        if o["kind"] in ("symbol", "footprint"):
            components[key] = _pick(o, NATIVE_OBJECT)
    return {"nativeObjects": native, "componentObjects": components}


def rebuilt_objects(golden: dict) -> list[dict]:
    out = []
    for d in golden["documents"]:
        out += [from_object(c, d["path"], c["contentDigest"]) for c in d["objects"]]
        out += [from_review_only(c, d["path"]) for c in d["reviewOnlyObjects"]]
    return out


def expected_today(ctx: Context, index: dict) -> tuple[list[dict], set[str]]:
    """Today's entries with the field map's documented divergences applied; returns the ids that changed something."""

    import copy

    used: set[str] = set()
    errored = {d["path"] for d in index["documents"] if d.get("error")}
    out = []
    for o in index["objects"]:
        if o["documentPath"] in errored:
            used.add("D10")
            continue
        if not o.get("reviewOnly") and not UUID.match(o["uuid"]):
            used.add("D4")
            continue
        c = copy.deepcopy(o)
        path = ctx.repo_path(c["documentPath"])
        if path != c["documentPath"]:
            used.add("D13")
            c["documentPath"] = path

        def rounded(at: list) -> list:
            r = [mm_to_nm(v) / 1e6 for v in at]
            if r != at:
                used.add("D1")
            return r

        if "at" in c:
            c["at"] = rounded(c["at"])
        for p in c.get("properties") or []:
            if "at" in p:
                p["at"] = rounded(p["at"])
        if c.get("refdes") == "":
            used.add("D6")
            del c["refdes"]
        if "kiidPaths" in c:
            kept = valid_paths(c["kiidPaths"])
            if kept != c["kiidPaths"]:
                used.add("D5")
            if kept:
                c["kiidPaths"] = kept
            else:
                del c["kiidPaths"]
        if "instances" in c:
            for i in c["instances"]:
                if i.get("reference") == "":
                    used.add("D6")
                    del i["reference"]
                if i.get("path") and not KIID_PATH.match(i["path"]):
                    used.add("D5")
                    del i["path"]
            if not c["instances"]:
                del c["instances"]
        out.append(c)
    return out, used


def describe(d: jsonvalue.Difference) -> str:
    """A difference of today's value (expected) against the one rebuilt from the golden (actual)."""

    def short(value: Any) -> str:
        text = "(absent)" if value is jsonvalue.MISSING else repr(value)
        return text if len(text) <= 160 else text[:157] + "..."

    return f"{d.pointer}: today {short(d.expected)} != rebuilt {short(d.actual)}"


def rebuild_check(ctx: Context, index: dict, golden: dict) -> tuple[dict, list[str]]:
    today = sides(index["objects"])
    rebuilt = sides(rebuilt_objects(golden))
    counts = (f"rebuild: nativeObjects {len(today['nativeObjects'])} today / {len(rebuilt['nativeObjects'])} golden, "
              f"componentObjects {len(today['componentObjects'])} / {len(rebuilt['componentObjects'])}")
    raw = [d for shape in today for d in jsonvalue.diff(today[shape], rebuilt[shape], f"/{shape}")]
    if not raw:
        return {"shape": "rebuild", "result": "equal"}, [counts]
    expected_objects, used = expected_today(ctx, index)
    expected = sides(expected_objects)
    left = [d for shape in expected for d in jsonvalue.diff(expected[shape], rebuilt[shape], f"/{shape}")]
    detail = [describe(d) for d in (left or raw)[:10]]
    if left:
        return {"shape": "rebuild", "result": "differs", "detail": detail}, [counts]
    return {"shape": "rebuild", "result": "divergence", "divergences": sorted(used),
            "detail": [f"{len(raw)} differences from today, all explained by {', '.join(sorted(used))}", *detail[:5]]}, [counts]


# --------------------------------------------------------- digest crosscheck


def digest_crosscheck(index: dict, golden: dict, ctx: Context) -> dict:
    """The reference digest (Node) against the independent Python implementation, every object."""

    root = Path(index["snapshot"])
    by_path = {ctx.repo_path(d["path"]): d["path"] for d in index["documents"]}
    checked = 0
    mismatches = []
    for d in golden["documents"]:
        if not d["objects"]:
            continue
        mine = board_objects_digest.digests(root / by_path[d["path"]])
        for o in d["objects"]:
            checked += 1
            if mine.get(o["uuid"]) != o["contentDigest"]:
                mismatches.append(f"{d['path']}#{o['uuid']} ({o['kind']}): node {o['contentDigest']} python {mine.get(o['uuid'])}")
    if mismatches:
        return {"shape": "digest-xcheck", "result": "differs", "detail": [f"{len(mismatches)} of {checked}", *mismatches[:10]]}
    return {"shape": "digest-xcheck", "result": "equal", "detail": [f"{checked} digests"]}


# ----------------------------------------------------------------- capture


def capture(ctx: Context) -> Result:
    index = today_index(ctx)
    failures = design_parse_failures(ctx, index)
    if failures:
        raise NotCaptured("malformed design, stage parse fails (no member): " + "; ".join(failures), status="stage-parse-fails")
    golden, hashes, notes = transform(ctx, index)
    rebuild, more = rebuild_check(ctx, index, golden)
    xcheck = digest_crosscheck(index, golden, ctx)
    objects = sum(len(d["objects"]) for d in golden["documents"])
    review = sum(len(d["reviewOnlyObjects"]) for d in golden["documents"])
    notes = [f"{len(golden['documents'])} documents, {objects} objects, {review} review-only objects",
             *more, *notes]
    return Result(document=golden, sidecars={"today-hash": hashes}, checks=[rebuild, xcheck], notes=notes)
