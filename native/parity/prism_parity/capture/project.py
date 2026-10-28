"""Golden for ``projections/project.json`` (``prism.project.a0``).

Field map ``project.md``. The member is a new shape, so the golden is the W0
prototype producer (``proto_project_a0.py``) ported here, and
``Result.checks`` holds the field map's three adapters ("Card", "3D",
"Closure"; ``project_checks.py``), each re-deriving one of today's outputs from
the golden and comparing it with what today's code returns on the same copy.

Changes from the prototype:
- every path is repository-relative (conventions.md §8): ``projectFile``,
  ``documents[].path``, ``documentPath`` and ``target.path`` carry the anchor's
  directory, and joins and the ``outside-repository`` test are made on
  repository segments (the prototype wrote project-relative paths, which only
  coincide for a project at the repository root);
- the materialized source set is the revision key's name rules applied to the
  prepared copy ``ctx.src`` (regular files only, no symlinks, the case's
  excluded directories left out), not ``git ls-files`` of a host repository;
- the atoms already listed under another kind are tracked by their position in
  the parsed tree, not by ``id()`` of the string, which interning can share.

Sources are already upgraded (decisions.md, Occurrences 1). Nothing reads the
host: no environment variable, no KiCad installation.
"""

from __future__ import annotations

import decimal
import json
import os
import re
from pathlib import Path
from typing import Any

from . import Context, NotCaptured, Result

MEMBER = "project"
SCHEMA = "prism.project.a0"

# Revision-key name rules (revision-key-a1.tsp, RevisionKeySourceCategory), ASCII case-insensitive.
_NAMES = {"fp-lib-table", "sym-lib-table", ".prism.json"}
_SUFFIXES = (
    ".kicad_pro", ".kicad_sch", ".kicad_pcb", ".kicad_dru", ".kicad_wks", ".kicad_jobset",
    ".kicad_sym", ".lib", ".dcm", ".kicad_mod",
    ".step", ".stp", ".stpz", ".stepz", ".step.gz", ".stp.gz", ".wrl", ".wrz", ".vrml",
    ".x3d", ".igs", ".iges", ".idf", ".emn", ".wings",
)
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def source_set(root: Path, excluded: list[str]) -> set[str]:
    """The materialized source set of the prepared copy (``.git`` and symlinks excluded)."""

    selected: set[str] = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d != ".git" and not (Path(dirpath) / d).is_symlink())
        for name in filenames:
            path = Path(dirpath) / name
            if path.is_symlink() or not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if any(rel == d or rel.startswith(d.rstrip("/") + "/") for d in excluded):
                continue
            lower = name.lower()
            if lower in _NAMES or lower.endswith(_SUFFIXES):
                selected.add(rel)
    return selected


# ---------------------------------------------------------------- helpers


def nm(value_mm: float) -> int:
    """conventions.md §6: round half away from zero on the double product."""

    return int(decimal.Decimal(value_mm * 1e6).quantize(decimal.Decimal(1), rounding=decimal.ROUND_HALF_UP))


def project_string(value: Any) -> str:
    """fork ``project.rs:945-952`` (D8)."""

    if value is None or value is False:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool) and float(value) == 0.0:
        return ""
    return json.dumps(value, separators=(",", ":"))


def child(form: list, head: str):
    for item in form[1:]:
        if isinstance(item, list) and item and item[0] == head:
            return item
    return None


def children(form: list, head: str):
    return [item for item in form[1:] if isinstance(item, list) and item and item[0] == head]


def atom(form, index=1):
    if form is None or len(form) <= index:
        return None
    value = form[index]
    return None if isinstance(value, list) else value


def str_atom(form, index=1):
    value = atom(form, index)
    if value is None or isinstance(value, bool):
        return None
    return str(value)


def uuid_of(form: list):
    value = str_atom(child(form, "uuid"))
    return value if value and UUID.match(value) else None


def normalize(base: list[str], rest: str) -> list[str]:
    """Join ``rest`` to ``base`` lexically (field map, Resolution step 5)."""

    stack = list(base)
    for seg in rest.split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if stack and stack[-1] != "..":
                stack.pop()
            else:
                stack.append("..")
        else:
            stack.append(seg)
    return stack


# --------------------------------------------------------------- resolution
_VAR = re.compile(r"\$(?:\{([A-Za-z0-9_:]+)\}|\(([A-Za-z0-9_:]+)\)|([A-Za-z0-9_:]+))")
_NONDET = {"CURRENT_DATE", "CURRENT_TIME_HH_MM_SS", "CURRENT_TIME_LOCALE", "VCSHASH", "VCSSHORTHASH"}
_URI = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
_DRIVE = re.compile(r"^[A-Za-z]:/")
_EMBED = "kicad-embed://"
_PRJ = "\x00PRJ\x00"
_MARKER = re.compile(r"\x00(?:PRJ|LIB:[A-Za-z0-9_:]+)\x00")


def library_of(name: str):
    m = re.fullmatch(r"KICAD[0-9]+_(3DMODEL_DIR|SYMBOL_DIR|FOOTPRINT_DIR|TEMPLATE_DIR|3RD_PARTY)", name)
    if m:
        return {"3DMODEL_DIR": "model-3d", "SYMBOL_DIR": "symbol", "FOOTPRINT_DIR": "footprint",
                "TEMPLATE_DIR": "template", "3RD_PARTY": "third-party"}[m.group(1)]
    return {"KISYS3DMOD": "model-3d", "KICAD_SYMBOL_DIR": "symbol", "KISYSMOD": "footprint",
            "KICAD_PTEMPLATES": "template", "KICAD_USER_TEMPLATE_DIR": "user-template"}.get(name)


def lib_marker(name: str) -> str:
    return f"\x00LIB:{name}\x00"


def unresolved(reason: str, variable: str | None = None) -> dict:
    target = {"kind": "unresolved", "reason": reason}
    if variable is not None:
        target["variable"] = variable
    return target


class Resolver:
    """Field map "Resolution (normative)", on repository segments."""

    def __init__(self, project_name: str, text_variables: dict[str, str], project_dir: list[str], sources: set[str]):
        self.project_name = project_name
        self.text_variables = text_variables
        self.project_dir = project_dir
        self.sources = sources
        self._prefixes = None

    def expand(self, text: str):
        used: set[str] = set()
        text = text.replace("\\", "/")
        for _ in range(8):
            if not _VAR.search(text):
                return text, used, None
            failure = None

            def sub(m):
                nonlocal failure
                name = m.group(1) or m.group(2) or m.group(3)
                if failure:
                    return m.group(0)
                if name == "PROJECTNAME":
                    used.add(name)
                    return self.project_name
                if name in _NONDET:
                    failure = unresolved("nondeterministic-variable", name)
                    return m.group(0)
                if name in self.text_variables:
                    used.add(name)
                    return self.text_variables[name].replace("\\", "/")
                if name == "KIPRJMOD":
                    used.add(name)
                    return _PRJ
                if library_of(name):
                    used.add(name)
                    return lib_marker(name)
                failure = unresolved("undefined-variable", name)
                return m.group(0)

            text = _VAR.sub(sub, text)
            if failure:
                return None, used, failure
        if _VAR.search(text):
            return None, used, unresolved("variable-loop")
        return text, used, None

    def in_sources(self, repo_path: str) -> bool:
        if repo_path in self.sources:
            return True
        prefix = repo_path + "/"
        return any(s.startswith(prefix) for s in self.sources)

    def resolve(self, raw: str, kind: str, document_path: str, embedded_stack=()):
        expanded, used, failure = self.expand(raw)
        variables = sorted(used)
        if failure:
            return variables, failure
        text = expanded
        markers = [(m.start(), m.group(0)) for m in _MARKER.finditer(text)]
        if markers and (markers[0][0] != 0 or len(markers) > 1):
            bad = markers[1] if markers[0][0] == 0 else markers[0]
            name = "KIPRJMOD" if bad[1] == _PRJ else bad[1][5:-1]
            return variables, unresolved("misplaced-variable", name)
        if text.startswith(_EMBED):
            if kind not in ("model-3d", "drawing-sheet"):
                return variables, unresolved("uri")
            name = text[len(_EMBED):]
            for doc, footprint_uuid, files in embedded_stack:
                if name in files:
                    target = {"kind": "embedded", "name": name, "documentPath": doc}
                    if footprint_uuid:
                        target["footprintUuid"] = footprint_uuid
                    target["fileType"] = files[name]
                    return variables, target
            return variables, unresolved("embedded-missing")
        if _URI.match(text):
            return variables, unresolved("uri")
        if text.startswith("~"):
            return variables, unresolved("home-relative")
        if text.startswith(":") and kind in ("model-3d", "drawing-sheet"):
            alias, colon, rest = text[1:].partition(":")
            library = library_of(alias)
            if not library or not colon:
                return variables, unresolved("alias")
            return variables, self._library(alias, library, rest)
        if text.startswith("\x00LIB:"):
            end = text.index("\x00", 1)
            name = text[5:end]
            return variables, self._library(name, library_of(name), text[end + 1:])
        if text.startswith(_PRJ):
            return variables, self._join(self.project_dir, text[len(_PRJ):], "project-variable")
        if text.startswith("/") or _DRIVE.match(text):
            drive = text[:2] if _DRIVE.match(text) else ""
            stack: list[str] = []
            for seg in text[len(drive):].split("/"):
                if seg in ("", "."):
                    continue
                if seg == "..":
                    if stack:
                        stack.pop()
                    continue
                stack.append(seg)
            return variables, {"kind": "absolute", "path": drive + "/" + "/".join(stack)}
        if kind == "sheet-file":
            return variables, self._join(document_path.split("/")[:-1], text, "document-directory")
        return variables, self._join(self.project_dir, text, "project-directory")

    @staticmethod
    def _library(variable: str, library: str, rest: str) -> dict:
        stack: list[str] = []
        for seg in rest.split("/"):
            if seg in ("", "."):
                continue
            if seg == "..":
                if not stack:
                    return unresolved("outside-library-root")
                stack.pop()
                continue
            stack.append(seg)
        if not stack:
            return unresolved("empty-path")
        if any(":" in s for s in stack):
            return unresolved("unrepresentable-path")
        return {"kind": "kicad-library", "variable": variable, "library": library, "relativePath": "/".join(stack)}

    def _join(self, base: list[str], rest: str, how: str) -> dict:
        stack = normalize(base, rest)
        if not stack:
            return unresolved("empty-path")
        if any(":" in s for s in stack):
            return unresolved("unrepresentable-path")
        path = "/".join(stack)
        if stack[0] == "..":
            return {"kind": "outside-repository", "path": path, "base": how}
        return {"kind": "repository", "path": path, "base": how, "inSources": self.in_sources(path)}


# ------------------------------------------------------------- text paths
_CLOSURE_VAR = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def is_path_reference(value: str) -> bool:
    """``closure_references.py:25-58`` (field map, "text-path detection")."""

    if not _CLOSURE_VAR.search(value):
        return False
    if any(m.group(1).upper() == "JOBSET_OUTPUT_WORK_PATH" for m in _CLOSURE_VAR.finditer(value)):
        return False
    if "/" in value or "\\" in value:
        return True
    m = _CLOSURE_VAR.fullmatch(value.strip())
    if not m:
        return False
    upper = m.group(1).upper()
    return upper == "KIPRJMOD" or upper.endswith("_DIR") or upper.endswith("_PATH")


def sexpr_text_paths(tree, typed: set[tuple[int, int]]) -> list[tuple[str, str]]:
    """(field, value) for every string atom that is a path reference, typed atoms excluded."""

    found: list[tuple[str, str]] = []

    def walk(form):
        if not isinstance(form, list) or not form:
            return
        head = form[0] if isinstance(form[0], str) else None
        for index, item in enumerate(form):
            if isinstance(item, list):
                walk(item)
            elif isinstance(item, str) and (id(form), index) not in typed and is_path_reference(item):
                if head == "property" and index == 2 and isinstance(form[1], str):
                    field = str(form[1])
                else:
                    field = head if head is not None else str(item)
                found.append((field, str(item)))

    walk(tree)
    return found


def json_text_paths(value, pointer: str = "", skip=frozenset()) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for k, v in value.items():
            found += json_text_paths(v, pointer + "/" + k.replace("~", "~0").replace("/", "~1"), skip)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            found += json_text_paths(v, f"{pointer}/{i}", skip)
    elif isinstance(value, str) and pointer not in skip and is_path_reference(value):
        found.append((pointer, value))
    return found


# --------------------------------------------------------------- title block
_TB_VAR = re.compile(r"\$\{(.+?)\}")


def tb_expand(text: str, variables: dict[str, str]) -> str:
    """``kicad_text_variables.py:51-71``."""

    def substitute(t, depth):
        def replace(m):
            value = variables.get(m.group(1))
            if value is None:
                return m.group(0)
            if depth >= 10:
                return value
            return substitute(value, depth + 1)

        return _TB_VAR.sub(replace, t)

    if not text or "${" not in text:
        return text
    return substitute(text, 0)


def title_block(form):
    if form is None:
        return None
    block: dict[str, Any] = {}
    for key in ("title", "date", "rev", "company"):
        value = str_atom(child(form, key))
        if value:
            block[key] = value
    comments: dict[int, str] = {}
    for c in children(form, "comment"):
        if len(c) >= 3 and isinstance(c[1], int) and not isinstance(c[1], bool) and 1 <= c[1] <= 9 and not isinstance(c[2], list):
            comments[c[1]] = str(c[2])
    block["comments"] = [{"number": n, "text": comments[n]} for n in sorted(comments) if comments[n]]
    return block


def expanded_block(block, properties, text_variables, project_name, filename):
    variables = {
        "TITLE": block.get("title", ""),
        "ISSUE_DATE": block.get("date", ""),
        "REVISION": block.get("rev", ""),
        "COMPANY": block.get("company", ""),
    }
    by_number = {c["number"]: c["text"] for c in block["comments"]}
    for n in range(1, 10):
        variables[f"COMMENT{n}"] = by_number.get(n, "")
    variables.update(properties)
    variables.update(text_variables)
    if project_name:
        variables["PROJECTNAME"] = project_name
    variables["FILENAME"] = filename
    out: dict[str, Any] = {}
    for key in ("title", "date", "rev", "company"):
        if key in block:
            value = tb_expand(block[key], variables)
            if value:
                out[key] = value
    out["comments"] = [{"number": c["number"], "text": t} for c in block["comments"] if (t := tb_expand(c["text"], variables))]
    return out


def embedded_files(form) -> dict[str, str]:
    files: dict[str, str] = {}
    holder = child(form, "embedded_files")
    if holder is None:
        return files
    for f in children(holder, "file"):
        name = str_atom(child(f, "name"))
        if not name:
            continue
        ftype = str_atom(child(f, "type")) or "other"
        files[name] = ftype if ftype in ("model", "worksheet", "datasheet", "font", "other") else "other"
    return files


# ------------------------------------------------------------------ produce


def produce(src: Path, project_file: str, sources: set[str]) -> tuple[dict, list]:
    """The member for the anchor ``project_file`` (a RepoPath) of the tree ``src``."""

    from kicad_monkey import parse_sexp

    project_dir = [] if "/" not in project_file else project_file.split("/")[:-1]
    stem = project_file.rsplit("/", 1)[-1][: -len(".kicad_pro")]

    def repo(project_relative: str) -> str:
        return "/".join(normalize(project_dir, project_relative))

    def read(repo_path: str) -> str:
        return (src / repo_path).read_text(encoding="utf-8")

    pro = json.loads(read(project_file))
    text_variables = {str(k): project_string(v) for k, v in (pro.get("text_variables") or {}).items()}
    project_name = stem
    resolver = Resolver(project_name, text_variables, project_dir, sources)

    warnings: list[tuple[str, str]] = []
    net_classes = []
    for c in ((pro.get("net_settings") or {}).get("classes") or []):
        if not isinstance(c, dict):
            continue
        entry: dict[str, Any] = {"name": project_string(c.get("name"))}
        for key, field in (("track_width", "trackWidthNm"), ("clearance", "clearanceNm"),
                           ("diff_pair_width", "diffPairWidthNm"), ("diff_pair_gap", "diffPairGapNm"),
                           ("via_diameter", "viaDiameterNm"), ("via_drill", "viaDrillNm")):
            v = c.get(key)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                n = nm(float(v))
                if 0 <= n < 2 ** 53:
                    entry[field] = n
                else:
                    warnings.append(("project-net-class-value-invalid", f"{entry['name']}.{key}"))
        net_classes.append(entry)

    documents: list[dict] = []
    references: list[dict] = []

    def add_ref(kind, document_path, raw, embedded_stack=(), **extra):
        if raw is None or raw == "":
            return None
        variables, target = resolver.resolve(raw, kind, document_path, embedded_stack)
        ref: dict[str, Any] = {"kind": kind, "documentPath": document_path}
        for key in ("sheetUuid", "sheetName", "libraryName", "field"):
            if extra.get(key) is not None:
                ref[key] = extra[key]
        ref["raw"] = raw
        ref["variables"] = variables
        ref["target"] = target
        references.append(ref)
        return ref

    def header(tree, path, kind):
        doc: dict[str, Any] = {"path": path, "kind": kind}
        v = atom(child(tree, "version"))
        if isinstance(v, int) and not isinstance(v, bool) and v >= 1:
            doc["formatVersion"] = v
        g = str_atom(child(tree, "generator"))
        if g is not None:
            doc["generator"] = g
        gv = str_atom(child(tree, "generator_version"))
        if gv is not None:
            doc["generatorVersion"] = gv
        props: dict[str, str] = {}
        for p in children(tree, "property"):
            if len(p) >= 3 and isinstance(p[1], str) and p[1] and not isinstance(p[2], list):
                props[str(p[1])] = str(p[2])
        tb = title_block(child(tree, "title_block"))
        if tb is not None:
            doc["titleBlock"] = tb
            doc["expandedTitleBlock"] = expanded_block(tb, props, text_variables, project_name, path.rsplit("/", 1)[-1])
        doc["properties"] = dict(sorted(props.items()))
        return doc

    scanned: list[tuple[str, Any, set]] = []  # (documentPath, tree, typed atom positions)

    root_sch = repo(f"{stem}.kicad_sch")
    root_embedded: dict[str, str] = {}
    if root_sch in sources:
        queue = [root_sch]
        seen = {root_sch}
        while queue:
            path = queue.pop(0)
            tree = parse_sexp(read(path))
            if path == root_sch:
                root_embedded = embedded_files(tree)
            documents.append(header(tree, path, "root-schematic" if path == root_sch else "schematic"))
            typed: set[tuple[int, int]] = set()
            for sheet in children(tree, "sheet"):
                sid = uuid_of(sheet)
                file_value = None
                for prop in children(sheet, "property"):
                    if len(prop) >= 3 and prop[1] in ("Sheetfile", "Sheet file") and not isinstance(prop[2], list):
                        typed.add((id(prop), 2))
                        if file_value is None:
                            file_value = prop[2]  # the first wins (fork schematic_bundle.rs:570)
                name = next(
                    (str(p[2]) for p in children(sheet, "property")
                     if len(p) >= 3 and p[1] in ("Sheetname", "Sheet name") and not isinstance(p[2], list)),
                    None,
                ) or None
                if sid is None:
                    warnings.append(("project-sheet-without-uuid", path))
                    continue
                ref = add_ref("sheet-file", path, None if file_value is None else str(file_value), sheetUuid=sid, sheetName=name)
                if ref and ref["target"]["kind"] == "repository" and ref["target"]["inSources"]:
                    child_path = ref["target"]["path"]
                    if child_path not in seen:
                        seen.add(child_path)
                        queue.append(child_path)
            scanned.append((path, tree, typed))

    board = repo(f"{stem}.kicad_pcb")
    board_embedded: dict[str, str] = {}
    if board in sources:
        tree = parse_sexp(read(board))
        documents.append(header(tree, board, "board"))
        board_embedded = embedded_files(tree)
        typed = set()
        model_keys: set = set()
        for fp in children(tree, "footprint"):
            fp_uuid = uuid_of(fp)
            own = embedded_files(fp)
            for model in children(fp, "model"):
                if len(model) < 2 or isinstance(model[1], list):
                    continue
                typed.add((id(model), 1))
                raw = str(model[1])
                if raw == "":
                    continue
                stack = [(board, fp_uuid, own), (board, None, board_embedded)]
                variables, target = resolver.resolve(raw, "model-3d", board, stack)
                key = (raw, target.get("footprintUuid") if target["kind"] == "embedded" else None)
                if key in model_keys:
                    continue
                model_keys.add(key)
                references.append({"kind": "model-3d", "documentPath": board, "raw": raw, "variables": variables, "target": target})
        scanned.append((board, tree, typed))

    for table, kind in (("fp-lib-table", "footprint-library"), ("sym-lib-table", "symbol-library")):
        table_path = repo(table)
        if table_path not in sources:
            continue
        tree = parse_sexp(read(table_path))
        typed = set()
        names: set[str] = set()
        for lib in children(tree, "lib"):
            name = str_atom(child(lib, "name"))
            uri_form = child(lib, "uri")
            if uri_form is not None and len(uri_form) > 1:
                typed.add((id(uri_form), 1))
            uri = str_atom(uri_form)
            if not name or not uri:
                warnings.append(("project-library-row-invalid", table_path))
                continue
            if name in names:
                warnings.append(("project-library-name-duplicate", f"{table_path}: {name}"))
                continue
            names.add(name)
            add_ref(kind, table_path, uri, libraryName=name)
        scanned.append((table_path, tree, typed))

    drawing_pointers = {
        "/schematic/page_layout_descr_file": [(root_sch, None, root_embedded)],
        "/pcbnew/page_layout_descr_file": [(board, None, board_embedded)],
    }
    for pointer, stack in drawing_pointers.items():
        section, key = pointer.split("/")[1:]
        value = (pro.get(section) or {}).get(key) if isinstance(pro.get(section), dict) else None
        if isinstance(value, str) and value:
            ref = add_ref("drawing-sheet", project_file, value, stack, field=pointer)
            target = ref["target"]
            if target["kind"] == "repository" and target["inSources"]:
                scanned.append((target["path"], parse_sexp(read(target["path"])), set()))

    seen_text: set[tuple[str, str, str]] = set()
    for pointer, value in json_text_paths(pro, skip=frozenset(drawing_pointers)):
        if (project_file, pointer, value) not in seen_text:
            seen_text.add((project_file, pointer, value))
            add_ref("text-path", project_file, value, field=pointer)
    for path, tree, typed in scanned:
        for field, value in sexpr_text_paths(tree, typed):
            if (path, field, value) not in seen_text:
                seen_text.add((path, field, value))
                add_ref("text-path", path, value, field=field)

    def absent_first(v):
        return (0, "") if v is None else (1, v)

    def ref_key(r):
        t = r["target"]
        return (r["documentPath"], r["kind"], r["raw"], absent_first(r.get("sheetUuid")), absent_first(r.get("field")),
                absent_first(r.get("libraryName")), absent_first(t.get("footprintUuid") if t["kind"] == "embedded" else None))

    references.sort(key=ref_key)
    documents.sort(key=lambda d: d["path"])
    return {
        "schema": SCHEMA,
        "projectFile": project_file,
        "projectName": project_name,
        "textVariables": dict(sorted(text_variables.items())),
        "netClasses": net_classes,
        "documents": documents,
        "references": references,
    }, warnings


def capture(ctx: Context) -> Result:
    from .project_checks import run_checks

    src = ctx.src.resolve()
    sources = source_set(src, ctx.case.excluded_dirs)
    try:
        document, warnings = produce(src, ctx.project, sources)
    except Exception as error:  # noqa: BLE001 - a file today's reader rejects: stage parse fails
        raise NotCaptured(f"project producer raised {type(error).__name__}: {error}") from error
    notes = [f"warning {code}: {where}" for code, where in warnings]
    kinds = {d["kind"] for d in document["documents"]}
    if "root-schematic" not in kinds:
        notes.append("no root schematic: no schematic documents or sheet references")
    if "board" not in kinds:
        notes.append("no board: no board document or model references")
    checks, check_notes = run_checks(ctx, document)
    return Result(document=document, checks=checks, notes=notes + check_notes)
