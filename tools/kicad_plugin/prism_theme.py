"""Prism theme, mirrored from the web app so the KiCad plugin looks like it.

The web app's palette lives in frontend/src/index.css as shadcn HSL tokens. These
are the same colours converted to hex. If the web theme changes, regenerate these
rather than eyeballing new values.

Kept dependency-free (no wx import) so it can be unit-tested and reused by the
tray agent without pulling in a GUI toolkit.
"""

from __future__ import annotations

LIGHT = {
    "background": "#FFFFFF",
    "foreground": "#020817",
    "card": "#FFFFFF",
    "primary": "#2563EB",
    "primary_fg": "#F8FAFC",
    "muted": "#F1F5F9",
    "muted_fg": "#64748B",
    "accent": "#F1F5F9",
    "destructive": "#EF4444",
    "success": "#16A34A",
    "warning": "#D97706",
    "border": "#E2E8F0",
    # File kinds, same hues the web history list uses (blue schematic, emerald
    # PCB) so a file reads the same in both places.
    "sch": "#3B82F6",
    "pcb": "#10B981",
    "other": "#64748B",
}

DARK = {
    "background": "#020817",
    "foreground": "#F8FAFC",
    "card": "#020817",
    "primary": "#3B82F6",
    "primary_fg": "#0F172A",
    "muted": "#1E293B",
    "muted_fg": "#94A3B8",
    "accent": "#1E293B",
    # Keep semantic diff/error text legible on the dark surface.
    "destructive": "#EF4444",
    "success": "#22C55E",
    "warning": "#F59E0B",
    "border": "#1E293B",
    "sch": "#60A5FA",
    "pcb": "#34D399",
    "other": "#94A3B8",
}


# Diff kinds, matching the web UI's KIND_TINT / KIND_PREFIX.
KIND_SYMBOL = {"added": "+", "removed": "−", "changed": "~"}
KIND_TONE = {"added": "success", "removed": "destructive", "changed": "warning"}

# Type scale (points). wx sizes in points, unlike the web's rem.
FONT_BODY = 9
FONT_SMALL = 9
FONT_TITLE = 12

# Actual Prism component defaults, not the upstream shadcn defaults:
# button.tsx: text-xs/font-medium/h-8/px-2.5/rounded-none; card.tsx:
# rounded-none; p-4; badge.tsx: h-6/px-2.5/text-xs font-medium.
# CONTROL_SM is button.tsx's size "sm" (h-7), for row-adjacent actions like
# the per-file Stage/Unstage toggles, which a default-height button swamped.
CONTROL_HEIGHT = 32
CONTROL_SM = 28
CONTROL_PADDING_X = 10
CARD_PADDING = 16

# Spacing scale, mirroring the app's 4px rhythm.
SP_XS = 4
SP_SM = 8
SP_MD = 12
SP_LG = 16
SP_XL = 24


def palette(dark: bool) -> dict[str, str]:
    """The colour set for the given mode."""
    return DARK if dark else LIGHT


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    """'#RRGGBB' -> (r, g, b)."""
    v = value.lstrip("#")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)
