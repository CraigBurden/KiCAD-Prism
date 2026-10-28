"""Sheet styles: the drawing furniture's colour and table treatment.

Two styles are released, chosen by the configuration's ``sheet_style`` key:

``prism`` (the default)
    The harness document's look: an ink-black frame, grey structure (rules,
    tints and captions), and colour only where it carries meaning -- a
    do-not-populate part stays red because that red *is* the datum.

``kicad``
    Today's output, unchanged: KiCad's red frame and title block, plain tables.
    It is retained as a selectable style because a project may need its
    documentation to match the rest of its KiCad drawing set.

The values are the reference rather than a second opinion about what "grey"
means.
Determinism: a style is a string, every colour is a literal, and nothing here
depends on the host or the clock.
"""

from __future__ import annotations

from typing import Literal

PRISM_STYLE = "prism"
KICAD_STYLE = "kicad"

SheetStyle = Literal["prism", "kicad"]

#: What a configuration gets when it declares no ``sheet_style``.
DEFAULT_SHEET_STYLE: str = PRISM_STYLE

SHEET_STYLES: frozenset[str] = frozenset({PRISM_STYLE, KICAD_STYLE})

#: Ink: frame, title-block values, table boxes, body text.
INK = "#1d1d1f"
#: Captions, labels and field names.  Structure, not content.
MUTED = "#6b6b70"
#: Table and title-block rules.
RULE = "#c4c8cf"
#: A header band's tint.
HEAD = "#eef0f3"
#: An alternate row's stripe.
STRIPE = "#f7f8fa"


def sheet_style(key: str | None = None) -> str:
    """Validate and normalize a sheet style key."""

    selected = str(key or DEFAULT_SHEET_STYLE).strip().lower()
    if selected not in SHEET_STYLES:
        supported = ", ".join(sorted(SHEET_STYLES))
        raise ValueError(
            f"unknown sheet style {selected!r}; choose one of: {supported}"
        )
    return selected


__all__ = [
    "DEFAULT_SHEET_STYLE",
    "HEAD",
    "INK",
    "KICAD_STYLE",
    "MUTED",
    "PRISM_STYLE",
    "RULE",
    "SHEET_STYLES",
    "STRIPE",
    "SheetStyle",
    "sheet_style",
]
