"""Cross-probe a changed item into KiCad itself, select it and zoom to it.

Clicking a change row should take you to that item *in the editor you're already
in*, not to a web page. Two different mechanisms are needed, because KiCad exposes
two very different APIs:

PCB (all versions)
    pcbnew.FocusOnItem(item) selects the item and centres the canvas on it. We
    resolve our diff item back to a real BOARD_ITEM by uuid (KIID), falling back
    to a footprint reference when the item has no usable uuid, segments, for
    instance, are keyed by geometry in the diff, not by uuid.

Schematic (not possible on any current KiCad, verified against 10.0.4)
    KiCad 8 has no schematic Python API at all; the plugin system is pcbnew-only.

    KiCad 9/10 added the IPC API, and it is tempting to conclude from kipy that
    selection is board-only, because kipy's Schematic class exposes no
    add_to_selection(). That inference is wrong, and worth not repeating: the
    selection commands are *generic editor commands*
    (kiapi.common.commands.AddToSelection), they take an ItemHeader whose
    DocumentSpecifier explicitly supports schematics (DOCTYPE_SCHEMATIC,
    sheet_path), and board.py's implementation does nothing board-specific, it
    just points the header at its own document.

    The real blocker is one layer deeper, and only KiCad can answer it. Sending
    those commands at a live schematic document on 10.0.4 returns:

        ApiError: no handler available for request of type
                  kiapi.common.commands.GetSelection

    while the identical commands against the open PCB document succeed. So the
    protocol defines selection for any document, but *eeschema has not implemented
    the handlers*. There is nothing to call, and no way to route around it.

    (Aside: kipy's Schematic wrapper doesn't even import on KiCad 10, it targets
    KiCad 11's protobufs and dies on `ImportError: BusEntryType`. Any future
    implementation here should talk the raw commands, not that wrapper.)

    Rather than ship a row that throws on first click, schematic rows are simply
    not clickable. When eeschema ships the handlers,
    schematic_probe_available() is the single place to flip.
"""

from __future__ import annotations

import pcbnew


class ProbeError(Exception):
    """Cross-probe couldn't be done, with a reason worth showing the user."""


def kicad_version() -> tuple[int, ...]:
    """(major, minor) of the running KiCad."""
    raw = pcbnew.GetBuildVersion()  # e.g. "8.0.7" or "9.0.1-rc1"
    parts = []
    for chunk in raw.lstrip("v").split(".")[:2]:
        digits = ""
        for ch in chunk:
            if ch.isdigit():
                digits += ch
            else:
                break
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


# -- PCB ------------------------------------------------------------------


def _find_board_item(board, item_id: str, reference: str = ""):
    """Resolve a diff item back to the live BOARD_ITEM.

    Diff items key on uuid where KiCad has one. Segments/vias don't get a stable
    uuid in our extractor (they're keyed by geometry), so for those we fall back
    to the footprint reference when one is available.
    """
    if item_id:
        try:
            kiid = pcbnew.KIID(item_id)
        except Exception:
            kiid = None
        if kiid is not None:
            try:
                found = board.GetItem(kiid)
            except AttributeError:
                found = None  # older SWIG bindings lack BOARD.GetItem
            # GetTypeDesc() distinguishes a real item from the null/placeholder
            # BOARD.GetItem returns for an unknown kiid, but it can itself throw on
            # some SWIG wrappers; treat any failure as "not found" rather than
            # letting it escape and crash the plugin.
            try:
                if found is not None and found.GetTypeDesc():
                    return found
            except Exception:
                pass

            # No BOARD.GetItem (KiCad 8): scan. A board has thousands of items,
            # not millions, and this only runs on an explicit click.
            for fp in board.GetFootprints():
                if str(fp.m_Uuid.AsString()) == item_id:
                    return fp
            for trk in board.GetTracks():
                if str(trk.m_Uuid.AsString()) == item_id:
                    return trk
            for dwg in board.GetDrawings():
                if str(dwg.m_Uuid.AsString()) == item_id:
                    return dwg

    if reference:
        for fp in board.GetFootprints():
            if fp.GetReference() == reference:
                return fp
    return None


def probe_pcb(item_id: str, reference: str = "") -> None:
    """Select the item in pcbnew and zoom to it."""
    board = pcbnew.GetBoard()
    if board is None:
        raise ProbeError("No board is open in pcbnew.")

    item = _find_board_item(board, item_id, reference)
    if item is None:
        raise ProbeError(
            "Couldn't find that item on the current board.\n\n"
            "It may have been changed or removed since the diff was computed, "
            "hit Refresh."
        )

    # FocusOnItem selects it and centres the view. Clear first so we don't
    # accumulate a growing selection across clicks.
    try:
        pcbnew.FocusOnItem(None)
    except Exception:
        pass
    try:
        pcbnew.FocusOnItem(item)
        pcbnew.Refresh()
    except Exception as exc:
        # FocusOnItem can reject an item type it doesn't handle, or a stale SWIG
        # wrapper, with a raw error. Surface it as a ProbeError so the dialog
        # shows a message instead of crashing.
        raise ProbeError(
            "KiCad couldn't focus that item. It may be a kind KiCad can't "
            "select from a plugin, or the board has changed, hit Refresh."
        ) from exc


# -- Schematic ------------------------------------------------------------


def schematic_probe_available() -> bool:
    """Can we select a symbol in eeschema?

    No, not on any KiCad released so far, so this returns False everywhere. It's a
    function rather than a constant so the dialog asks the question instead of
    hard-coding the answer, and so there is exactly one place to flip when eeschema
    ships the handlers.

    See the module docstring for the evidence. The short version: the selection
    commands ARE generic and DO name schematic documents, but sending them at a
    live schematic on KiCad 10.0.4 returns "no handler available", while the same
    commands against the open PCB succeed. eeschema hasn't implemented them.
    """
    return False


def probe_schematic(item_id: str, reference: str = "") -> None:
    """Would select a symbol in eeschema, if any KiCad API allowed it."""
    version = ".".join(str(n) for n in kicad_version())
    if kicad_version() < (9,):
        raise ProbeError(
            "KiCad %s has no Python API for the schematic editor, so the plugin "
            "can't jump to a symbol here.\n\n"
            "Board items still cross-probe normally." % version
        )
    raise ProbeError(
        "KiCad %s's schematic editor doesn't answer the API's selection commands "
        "yet, it replies 'no handler available', while the same commands work on "
        "the board. So the plugin can't jump to a symbol.\n\n"
        "Board items still cross-probe normally." % version
    )


def probe(kind: str, item_id: str, reference: str = "") -> None:
    """Cross-probe a change row into the right KiCad editor."""
    if kind == "pcb":
        probe_pcb(item_id, reference)
    elif kind == "sch":
        probe_schematic(item_id, reference)
    else:
        raise ProbeError("That change isn't something KiCad can jump to.")
