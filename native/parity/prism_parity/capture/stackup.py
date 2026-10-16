"""Golden for ``projections/stackup.json`` (``prism.stackup.a0``).

No document of this shape exists today. Field map ``stackup.md``, "How a golden
is produced from today's code": the golden is the W0 prototype producer (the
producer rules 1-8 applied to the board's S-expression tree, kicad_monkey's
tokenizer only, ``stackup_build.py``), and its consumer checks re-derive each
of today's shapes from the golden with the field map's reader adapters
(``stackup_derive.py``) and compare them by JSON value with what today's code
writes on the same prepared board:

- ``rs``: Release Studio ``project_stackup``;
- ``dc``: Design Comparison ``_extract_stackup`` (the board copied alone);
- ``3d``: the legacy 3D pipeline's ``pcb_metadata.board`` ``thickness_mm`` and ``stackup``;
- ``topology-layers`` / ``topology-board``: the topology compiler on that metadata;
- ``mid-plane``: System Builder ``mid_plane_from_layers`` on the topology layers,
  and ``mid-plane-nm``: the exact nm formula against today's value after
  ``poses._clean`` (``round(·, 9)``);
- ``board-looks``: the reference branch's ``board_looks``.

A project without a board gets the empty form (``stackup_build.empty_form``).
"""

from __future__ import annotations

from pathlib import Path

from . import Context, NotCaptured, Result
from . import stackup_build as build
from . import stackup_derive as derive

MEMBER = "stackup"


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
            notes=[
                "no board: empty form (present false, KiCad's default board thickness, every array empty); "
                "the stackup contract does not define its empty form explicitly (reported)",
                "no consumer check: today's shapes need a board (RS/3D raise; DC returns its own "
                "{present: false, layers: [], settings: {}})",
            ],
        )
    document, warnings = build.build(board.read_text(encoding="utf-8"))
    today = derive.today_shapes(ctx, board)
    checks = derive.checks(ctx, document, today)
    notes = [f"warning {code}: {message}" for code, message in warnings]
    notes.append(
        f"{len(document['layers'])} stackup entries, {len(document['copperLayers'])} copper layers, "
        f"{sum(span['count'] for span in document['viaSpans'])} vias in {len(document['viaSpans'])} spans"
    )
    notes.append(f"mid-plane today {today['mid']!r}, exact {derive.mid_plane_exact(document)!r}")
    return Result(document=document, checks=checks, notes=notes)
