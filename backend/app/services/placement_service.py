"""Pick-and-place positions and the BOM, parsed and cross-checked.

A fabrication package ships a position file (what the assembler's machine
places, and where) and a BOM (what the design says should be placed).  Both go
wrong in ordinary ways: a part missing from one, a part that should not be
placed but is, a rotation that nobody re-checked.  This module reads the two
files and says which of those has happened.

Pure: text in, view model out.  Tools disagree on column names (KiCad writes
``Ref,PosX,PosY,Rot``; the JLCPCB plugin writes ``Designator,Mid X,Mid Y,
Rotation``), so columns are matched by what they mean, not what they are called.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple, Union

from app.core import errors

_SPLIT_REFS = re.compile(r"[,;\s]+")
_RANGE = re.compile(r"^([A-Za-z_]+)(\d+)-(?:\1)?(\d+)$")
#: A range this long is a typo, not a run of parts.
_MAX_RANGE = 500
_NATURAL = re.compile(r"(\d+)")
_NUMBER = re.compile(r"^\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*([a-zA-Z]*)\s*$")

#: Header words, normalised to lowercase letters and digits only.
_POSITION_COLUMNS: Dict[str, Tuple[str, ...]] = {
    "ref": ("ref", "reference", "designator", "refdes", "part"),
    "value": ("val", "value", "comment"),
    "package": ("package", "footprint", "pattern"),
    "x": ("posx", "x", "midx", "centerx", "centrex"),
    "y": ("posy", "y", "midy", "centery", "centrey"),
    "rotation": ("rot", "rotation", "angle", "orientation"),
    "side": ("side", "layer", "tb", "topbottom"),
}
_BOM_COLUMNS: Dict[str, Tuple[str, ...]] = {
    "refs": ("refs", "reference", "references", "designator", "designators", "refdes"),
    "value": ("value", "val", "comment", "description"),
    "footprint": ("footprint", "package", "pattern"),
    "qty": ("qty", "quantity", "count"),
    "dnp": ("dnp", "donotplace", "donotpopulate", "nostuff", "exclude"),
}
_TRUTHY = {"dnp", "yes", "y", "true", "1", "x", "donotplace", "donotpopulate", "nostuff"}
_UNIT_MM = {"": 1.0, "mm": 1.0, "cm": 10.0, "in": 25.4, "inch": 25.4, "mil": 0.0254, "mils": 0.0254}

STATUS_OK = "ok"
STATUS_NOT_IN_BOM = "not-in-bom"
STATUS_DNP = "dnp-placed"
STATUS_NO_BOM = "no-bom"
STATUS_NOT_PLACED = "not-placed"


class PlacementError(errors.Invalid):
    """The file is not a position file or a BOM this module can read."""


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.casefold())


#: Rows scanned for the header; some tools write a title or units block first.
_HEADER_SCAN_ROWS = 25


def _rows(
    text: str,
    wanted: Optional[Mapping[str, Tuple[str, ...]]] = None,
    required: Tuple[str, ...] = (),
) -> Tuple[List[str], List[List[str]]]:
    """The header and the rows under it.

    With ``required`` the header is the first row that has all those columns, so a
    preamble above it is skipped. When none does, the first row is used and the
    caller reports which columns are missing.
    """

    text = text.lstrip("\ufeff")
    if not text.strip():
        raise PlacementError("The file is empty")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = [row for row in csv.reader(io.StringIO(text), dialect) if any(cell.strip() for cell in row)]
    if len(rows) < 1:
        raise PlacementError("The file is empty")
    start = 0
    if wanted is not None and required:
        for index, row in enumerate(rows[:_HEADER_SCAN_ROWS]):
            if all(key in _columns(row, wanted) for key in required):
                start = index
                break
    return [cell.strip() for cell in rows[start]], rows[start + 1:]


def _columns(header: Sequence[str], wanted: Mapping[str, Tuple[str, ...]]) -> Dict[str, int]:
    """Column index for each meaning, by the first header that matches, in order of preference."""

    normalised = [_norm(cell) for cell in header]
    found: Dict[str, int] = {}
    for meaning, names in wanted.items():
        for name in names:
            if name in normalised:
                found[meaning] = normalised.index(name)
                break
    return found


def _cell(row: Sequence[str], columns: Mapping[str, int], key: str) -> str:
    index = columns.get(key)
    return row[index].strip() if index is not None and index < len(row) else ""


def _millimetres(raw: str) -> Optional[float]:
    """A coordinate in millimetres, from ``12.3``, ``12.3mm`` or ``482mil``."""

    match = _NUMBER.match(raw)
    if not match:
        return None
    factor = _UNIT_MM.get(match.group(2).casefold())
    if factor is None:
        return None
    return float(match.group(1)) * factor


def _degrees(raw: str) -> Optional[float]:
    match = _NUMBER.match(raw.replace("°", ""))
    return float(match.group(1)) % 360 if match else None


def _side(raw: str) -> str:
    return "bottom" if raw.strip().casefold().startswith("b") else "top"


def _expand_refs(cell: str) -> Tuple[str, ...]:
    """References in a BOM cell: ``R1, R2``, and ranges such as ``R1-R4`` or ``R1-4``."""

    refs: List[str] = []
    for token in _SPLIT_REFS.split(re.sub(r"\s*-\s*", "-", cell)):
        match = _RANGE.match(token)
        if match and 0 <= int(match.group(3)) - int(match.group(2)) < _MAX_RANGE:
            refs.extend(
                f"{match.group(1)}{number}"
                for number in range(int(match.group(2)), int(match.group(3)) + 1)
            )
        elif token:
            refs.append(token)
    return tuple(refs)


def natural_key(ref: str) -> List[Any]:
    return [int(part) if part.isdigit() else part.casefold() for part in _NATURAL.split(ref)]


@dataclass(frozen=True)
class Part:
    ref: str
    value: str
    package: str
    x: float
    y: float
    rotation: float
    side: str


def parse_positions(text: str) -> Tuple[List[Part], List[str]]:
    """Parts from a position file, and a warning for each row that was skipped."""

    header, rows = _rows(text, _POSITION_COLUMNS, ("ref", "x", "y"))
    columns = _columns(header, _POSITION_COLUMNS)
    missing = [key for key in ("ref", "x", "y") if key not in columns]
    if missing:
        raise PlacementError("Not a position file: no " + ", ".join(missing) + " column")
    parts: List[Part] = []
    warnings: List[str] = []
    seen: set[str] = set()
    for number, row in enumerate(rows, start=2):
        ref = _cell(row, columns, "ref")
        x = _millimetres(_cell(row, columns, "x"))
        y = _millimetres(_cell(row, columns, "y"))
        if not ref or x is None or y is None:
            warnings.append(f"Line {number}: no usable position for {ref or 'a row'}")
            continue
        if ref in seen:
            warnings.append(f"{ref} appears more than once in the position file")
        seen.add(ref)
        parts.append(Part(
            ref=ref,
            value=_cell(row, columns, "value"),
            package=_cell(row, columns, "package"),
            x=x,
            y=y,
            rotation=_degrees(_cell(row, columns, "rotation")) or 0.0,
            side=_side(_cell(row, columns, "side")),
        ))
    if not parts:
        raise PlacementError("The position file has no parts")
    return parts, warnings


@dataclass(frozen=True)
class BomLine:
    refs: Tuple[str, ...]
    value: str
    footprint: str
    dnp: bool


def parse_bom(text: str) -> List[BomLine]:
    header, rows = _rows(text, _BOM_COLUMNS, ("refs",))
    columns = _columns(header, _BOM_COLUMNS)
    if "refs" not in columns:
        raise PlacementError("Not a BOM: no reference column")
    lines: List[BomLine] = []
    for row in rows:
        refs = _expand_refs(_cell(row, columns, "refs"))
        if not refs:
            continue
        dnp = _norm(_cell(row, columns, "dnp")) in _TRUTHY
        lines.append(BomLine(
            refs=refs,
            value=_cell(row, columns, "value"),
            footprint=_cell(row, columns, "footprint"),
            dnp=dnp,
        ))
    if not lines:
        raise PlacementError("The BOM has no parts")
    return lines


def _check(parts: Iterable[Part], bom: Sequence[BomLine]) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    """Status of each placed part, and the BOM parts that were never placed."""

    placed = {part.ref for part in parts}
    by_ref = {ref: line for line in bom for ref in line.refs}
    statuses: Dict[str, str] = {}
    for ref in placed:
        line = by_ref.get(ref)
        statuses[ref] = (
            STATUS_NOT_IN_BOM if line is None else STATUS_DNP if line.dnp else STATUS_OK
        )
    missing = [
        {"ref": ref, "value": line.value, "package": line.footprint, "status": STATUS_NOT_PLACED}
        for ref, line in by_ref.items()
        if ref not in placed and not line.dnp
    ]
    missing.sort(key=lambda item: natural_key(item["ref"]))
    return statuses, missing


def position_files(candidates: Sequence[Tuple[str, Sequence[Part]]]) -> List[str]:
    """Which of ``candidates`` (name, parsed parts), in order of preference, make one board's parts.

    The first readable position file is taken. Another one joins it only when it
    has none of the parts already taken: KiCad writes a top and a bottom file
    when asked to split them. A second export of the same board (KiCad's file
    beside a vendor's CPL) shares its parts and is left out.
    """

    chosen: List[str] = []
    taken: set[str] = set()
    for name, parts in candidates:
        refs = {part.ref for part in parts}
        if chosen and refs & taken:
            continue
        chosen.append(name)
        taken |= refs
    return chosen


def build_view(
    positions_text: Union[str, Sequence[str]],
    bom_text: Optional[str] = None,
    *,
    positions_name: str = "",
    bom_name: str = "",
) -> Dict[str, Any]:
    """Parts in board coordinates, with the BOM check when a BOM is given.

    ``positions_text`` is one position file, or several that together hold the
    board's parts (``position_files`` picks them). Position files are Y-up, like
    Gerber; the board frame the viewer draws in is KiCad's, Y-down, so ``y`` is
    negated here and nowhere else.
    """

    texts = [positions_text] if isinstance(positions_text, str) else list(positions_text)
    parsed = [parse_positions(text) for text in texts]
    bom: Optional[List[BomLine]] = None
    bom_warning = ""
    if bom_text is not None:
        try:
            bom = parse_bom(bom_text)
        except PlacementError as error:
            bom_warning = f"BOM not used: {error}"
    return view_of(parsed, bom, positions_name=positions_name, bom_name=bom_name, bom_warning=bom_warning)


def view_of(
    positions: Sequence[Tuple[Sequence[Part], Sequence[str]]],
    bom: Optional[Sequence[BomLine]],
    *,
    positions_name: str = "",
    bom_name: str = "",
    bom_warning: str = "",
) -> Dict[str, Any]:
    """The placement view from parsed position files and a parsed BOM (``None``: no BOM).

    ``build_view`` parses and calls this; a caller that has already parsed the
    files to choose among them passes the results, so nothing is read twice.
    """

    parts: List[Part] = [part for found, _notes in positions for part in found]
    warnings: List[str] = [note for _found, notes in positions for note in notes]
    if bom_warning:
        warnings.append(bom_warning)
    has_bom = bom is not None
    statuses, missing = _check(parts, bom) if bom is not None else ({}, [])
    ordered = sorted(parts, key=lambda part: natural_key(part.ref))
    rows = [
        {
            "ref": part.ref,
            "value": part.value,
            "package": part.package,
            "x": round(part.x, 4),
            "y": round(-part.y, 4),
            "rotation": round(part.rotation, 2),
            "side": part.side,
            "status": statuses.get(part.ref, STATUS_NO_BOM),
        }
        for part in ordered
    ]
    counts = {
        "placed": len(rows),
        "top": sum(1 for row in rows if row["side"] == "top"),
        "bottom": sum(1 for row in rows if row["side"] == "bottom"),
        "notInBom": sum(1 for row in rows if row["status"] == STATUS_NOT_IN_BOM),
        "dnpPlaced": sum(1 for row in rows if row["status"] == STATUS_DNP),
        "notPlaced": len(missing),
    }
    return {
        "present": True,
        "parts": rows,
        "missing": missing,
        "counts": counts,
        "hasBom": has_bom,
        "files": {"positions": positions_name, "bom": bom_name if has_bom else ""},
        "warnings": warnings,
    }
