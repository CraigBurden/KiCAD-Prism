"""Golden for ``projections/placements.json`` (``prism.placements.a1``).

No document of this shape exists today. Field map ``placements.md``, "How a
golden is produced from today's code": the goldens hold the member computed by
the normative rules R1-R13 (``placements_build.py``, an independent Python
producer: the W0 prototype is Rust on the fork core, the code under test), and
the consumer checks re-derive today's values from it (``placements_derive.py``):

- ``rs-testpoints``, ``rs-population``, ``rs-designators``: Release Studio, canonical JSON;
- ``sb-geometry``, ``sb-outline``: System Builder's ``_board_geometry`` and
  ``_board_outline``, with D2's tolerance, D4 and D5;
- ``catalog``: the catalog import's footprint blocks (bytes, references, model paths).

``capture.json`` notes also record the optional KiCad oracle
(``kicad-cli pcb export ipcd356`` on a scratch copy) when kicad-cli is available.

A project without a board gets the empty form (R1).
"""

from __future__ import annotations

from pathlib import Path

from . import Context, NotCaptured, Result
from . import placements_build as build
from . import placements_derive as derive
from . import placements_oracle as oracle

MEMBER = "placements"


def board_file(ctx: Context) -> Path | None:
    """The project's board: the anchor's stem with ``.kicad_pcb`` (no configuration file in any case)."""

    board = ctx.project_file.with_suffix(".kicad_pcb")
    return board if board.is_file() else None


def stage_parse_gate(ctx: Context, board: Path | None) -> None:
    """Stage parse fails, and writes no projection, when a design file does not parse."""

    from kicad_monkey.kicad_sexpr import parse_sexp

    schematic = ctx.project_file.with_suffix(".kicad_sch")
    for path in (schematic, board):
        if path is None or not path.is_file():
            continue
        try:
            parse_sexp(path.read_text(encoding="utf-8"))
        except Exception as error:  # noqa: BLE001 - the recorded outcome
            raise NotCaptured(
                f"stage parse fails: {path.name} does not parse ({type(error).__name__}: {error}); "
                "today's parsers reject it too"
            ) from error


def capture(ctx: Context) -> Result:
    board = board_file(ctx)
    stage_parse_gate(ctx, board)
    if board is None:
        return Result(
            document=build.empty_form(),
            notes=["no board: empty form (R1: footprints [], designators [], no outlineBounds); no consumer check"],
        )
    try:
        document, warnings = build.build(board.read_text(encoding="utf-8"))
    except build.PlacementsError as error:
        raise NotCaptured(f"stage parse fails: {error}") from error
    today = derive.today_values(board)
    checks = derive.checks(document, today, board)
    pads = sum(len(fp["pads"]) for fp in document["footprints"])
    models = sum(len(fp["models"]) for fp in document["footprints"])
    notes = [f"warning {code}: {message}" for code, message in warnings]
    notes.append(f"{len(document['footprints'])} footprints, {pads} pads, {models} models")
    off_axis = sorted({fp["rotationDeg"] for fp in document["footprints"] if float(fp["rotationDeg"]) % 90.0})
    if off_axis:
        notes.append(f"footprint rotations not a multiple of 90 degrees: {off_axis}")
    report = oracle.run(ctx, board, document)
    if report is not None:
        notes.append(report)
    return Result(document=document, checks=checks, notes=notes)
