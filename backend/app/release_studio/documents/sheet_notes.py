"""The note block each Release Studio sheet carries by default (split from `sheets`)."""

from __future__ import annotations

#: The note block each sheet carries when the configuration declares none.
#:
#: These are the statements Prism can make on its own authority: what the
#: released bytes are, which file governs, and what the drawing is a view of.
#: Anything that depends on the issuing organization -- IPC class, coupon
#: requirements, impedance tolerances -- is deliberately absent, because Prism
#: does not know it and a plausible-looking default would be worse than none.
#: `documents.notes.resolve_notes` replaces any of these from configuration.
DEFAULT_NOTES: dict[str, tuple[str, ...]] = {
    "cover": (
        # Deliberately not "the files listed above are the released bytes":
        # this sheet is itself a released member, and it is composed before the
        # other documentation members exist, so it can never list all of them.
        # A recipient reconciling the list against the dossier would find
        # extras and reasonably conclude the release had been tampered with.
        "The files listed above are released members produced before this "
        "sheet. manifest.json in this dossier lists the complete set, "
        "including the documentation sheets, with the SHA-256 digest of each.",
        "This sheet is generated from the board and schematic at the commit "
        "named in the title block. It carries no build time and no approver, "
        "so re-rendering it cannot change its digest.",
    ),
    "fabrication": (
        "The Gerber and Excellon files in this dossier are authoritative; this "
        "sheet is a view of them.",
        "Dimensions are in millimetres. The stated scale is the ratio the "
        "artwork was placed at.",
    ),
    "assembly-top": (
        "Reference designators follow the position file in this dossier.",
        "Do-not-populate parts are drawn and counted, and are listed separately "
        "above. They are present in the position file; do not fit them.",
    ),
    "assembly-bottom": (
        "Reference designators follow the position file in this dossier.",
        "Do-not-populate parts are drawn and counted, and are listed separately "
        "above. They are present in the position file; do not fit them.",
    ),
    "testpoint-top": (
        "Only testpoints are labelled. Every other component is omitted so the "
        "probe targets stand alone; the assembly drawings in this dossier show "
        "the full population.",
        "Schedule coordinates are each testpoint footprint's placement, read "
        "from the board and given as the position file gives them (KiCad's "
        "page origin, y up). Testpoints are commonly excluded from the "
        "position file, so that file may not list them.",
    ),
    "testpoint-bottom": (
        "Only testpoints are labelled. Every other component is omitted so the "
        "probe targets stand alone; the assembly drawings in this dossier show "
        "the full population.",
        "Schedule coordinates are each testpoint footprint's placement, read "
        "from the board and given as the position file gives them (KiCad's "
        "page origin, y up). Testpoints are commonly excluded from the "
        "position file, so that file may not list them.",
    ),
    "drill": (
        "Hole sizes are finished diameters unless a tolerance is stated.",
        "The Excellon file in this dossier is authoritative; this sheet is a view of it.",
    ),
}
