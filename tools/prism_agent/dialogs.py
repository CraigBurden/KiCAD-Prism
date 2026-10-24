"""The agent's own dialogs, themed to match the rest of Prism.

These belong to the `prism://` handler, which is a short-lived process the OS spawns for
a URL. It is NOT the plugin: there is no KiCad around it and no wx, so the plugin's
owner-drawn widgets are unavailable.

Until now it used each platform's native dialog: MessageBoxW, osascript, zenity/kdialog.
That was three code paths, three sets of quirks, and a popup that looked like nothing
else in Prism. tkinter replaces all three. It ships with Python, so it costs nothing, and
it gives one dialog that behaves the same everywhere and can carry the app's palette.

What tkinter does NOT give us is the plugin's fidelity: no rounded corners, no
owner-drawn buttons. The aim here is "recognisably Prism", not pixel parity with the web
app. A URL handler's popup is a thing you read and dismiss.

Everything degrades to False/None if a window cannot be opened. Failing to ask is a NO,
never a silent yes: these dialogs stand in front of cloning a repo, moving a working
tree, and destroying uncommitted work.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from functools import lru_cache
from pathlib import Path

log = logging.getLogger(__name__)

# Fallbacks, used only if the theme can't be loaded. Light mode: a dialog nobody can read
# is worse than one that doesn't match.
_FALLBACK = {
    "background": "#FFFFFF",
    "foreground": "#020817",
    "muted_fg": "#64748B",
    "primary": "#2563EB",
    "primary_fg": "#F8FAFC",
    "destructive": "#EF4444",
    "border": "#E2E8F0",
    "muted": "#F1F5F9",
}


@lru_cache(maxsize=1)
def _theme():
    """The plugin's palette, loaded by path.
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        candidate = Path(base) / "prism_theme.py"
    else:
        candidate = (
            Path(__file__).resolve().parents[1] / "kicad_plugin" / "prism_theme.py"
        )

    if not candidate.is_file():
        log.debug("prism_theme not found at %s; using fallback colours", candidate)
        return None
    try:
        spec = importlib.util.spec_from_file_location("prism_theme", candidate)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except Exception:
        log.warning("couldn't load prism_theme; using fallback colours", exc_info=True)
        return None


def palette() -> dict:
    """Prism's colours, in the OS's light/dark mode.
    """
    theme = _theme()
    if theme is None:
        return _FALLBACK
    try:
        return theme.palette(dark=_prefers_dark())
    except Exception:
        return _FALLBACK


def _prefers_dark() -> bool:
    """Is the OS in dark mode? False if we can't tell.

    Light is the safer default: every platform's default is light, and a light dialog on
    a light desktop is merely plain, while the reverse is a black rectangle.
    """
    if sys.platform == "win32":
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            ) as key:
                # 0 = dark. The name is about *apps*, not the taskbar.
                return winreg.QueryValueEx(key, "AppsUseLightTheme")[0] == 0
        except OSError:
            return False

    if sys.platform == "darwin":
        import subprocess

        try:
            result = subprocess.run(
                ["defaults", "read", "-g", "AppleInterfaceStyle"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            # The key only EXISTS in dark mode; reading it in light mode fails.
            return "dark" in result.stdout.strip().lower()
        except (OSError, subprocess.SubprocessError):
            return False

    return False  # Linux has no single answer worth guessing at


class _Dialog:
    """One themed modal. Returns whatever the chosen button carries."""

    PAD = 16

    def __init__(self, title: str, message: str, buttons, entry: bool = False):
        import tkinter as tk

        self.pal = palette()
        self.result = None
        self.entry_value = ""

        self.root = tk.Tk()
        self.root.title(title)
        self.root.configure(bg=self.pal["background"])
        self.root.resizable(False, False)
        # Otherwise it can open behind KiCad and look like nothing happened.
        self.root.attributes("-topmost", True)
        self._dark_title_bar()

        body = tk.Frame(self.root, bg=self.pal["background"])
        body.pack(fill="both", expand=True, padx=self.PAD, pady=self.PAD)

        tk.Label(
            body,
            text=message,
            bg=self.pal["background"],
            fg=self.pal["foreground"],
            justify="left",
            anchor="w",
            wraplength=380,
        ).pack(fill="x", anchor="w")

        self.entry = None
        if entry:
            self.entry = tk.Entry(
                body,
                bg=self.pal["muted"],
                fg=self.pal["foreground"],
                insertbackground=self.pal["foreground"],
                relief="flat",
                highlightthickness=1,
                highlightbackground=self.pal["border"],
                highlightcolor=self.pal["primary"],
            )
            self.entry.pack(fill="x", pady=(12, 0), ipady=4)
            self.entry.focus_set()

        row = tk.Frame(body, bg=self.pal["background"])
        row.pack(fill="x", pady=(16, 0))

        # Right to left, so the first button in the list ends up rightmost: the
        # platform convention for the affirmative action.
        for label, value, kind in reversed(buttons):
            self._button(row, label, value, kind).pack(side="right", padx=(8, 0))

        self.root.bind("<Escape>", lambda _e: self._choose(None))
        self.root.protocol("WM_DELETE_WINDOW", lambda: self._choose(None))
        self._centre()

    def _dark_title_bar(self) -> None:
        """Darken the title bar on Windows, so a dark dialog isn't capped in white.

        tkinter draws the body; the frame is the OS's. Without this the two disagree and
        the dialog looks broken rather than themed. Windows 10 1809+ only, via DWM, and
        entirely optional: an older build just keeps its light bar.
        """
        if sys.platform != "win32" or not _prefers_dark():
            return
        try:
            import ctypes

            self.root.update_idletasks()  # the HWND does not exist until now
            hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
            # 20 on current builds; 19 on 1809..1903. Try both, ignore the miss.
            for attribute in (20, 19):
                ctypes.windll.dwmapi.DwmSetWindowAttribute(
                    hwnd, attribute, ctypes.byref(ctypes.c_int(1)), 4
                )
        except Exception:
            log.debug("couldn't darken the title bar", exc_info=True)

    def _button(self, parent, label, value, kind):
        import tkinter as tk

        colours = {
            "primary": (self.pal["primary"], self.pal["primary_fg"]),
            "destructive": (self.pal["background"], self.pal["destructive"]),
            "ghost": (self.pal["background"], self.pal["muted_fg"]),
        }[kind]

        return tk.Button(
            parent,
            text=label,
            command=lambda: self._choose(value),
            bg=colours[0],
            fg=colours[1],
            activebackground=colours[0],
            activeforeground=colours[1],
            relief="flat",
            borderwidth=0,
            padx=14,
            pady=6,
            cursor="hand2",
            # Windows ignores bg on a native button unless this is off.
            highlightthickness=0,
        )

    def _choose(self, value):
        self.result = value
        self.entry_value = self.entry.get().strip() if self.entry else ""
        self.root.quit()

    def _centre(self):
        self.root.update_idletasks()
        w, h = self.root.winfo_width(), self.root.winfo_height()
        x = (self.root.winfo_screenwidth() - w) // 2
        y = (self.root.winfo_screenheight() - h) // 3  # a third down reads better
        self.root.geometry(f"+{x}+{y}")

    def show(self):
        self.root.mainloop()
        self.root.destroy()
        return self.result, self.entry_value


def _run(title, message, buttons, entry=False):
    """Show a dialog, or return (None, "") if we cannot.

    Never raises. A URL handler that crashes on a missing display is worse than one that
    quietly declines, because declining is the safe answer for everything these dialogs
    guard.
    """
    try:
        return _Dialog(title, message, buttons, entry).show()
    except Exception:
        log.warning("couldn't show a dialog", exc_info=True)
        return None, ""


# -- what the handler actually calls ---------------------------------------


def tell(message: str, title: str = "Prism") -> None:
    """Say something. One button, nothing to decide."""
    _run(title, message, [("OK", True, "primary")])


def ask(message: str, title: str = "Prism", confirm: str = "Continue") -> bool:
    """A yes/no. False if the user declines OR if we could not ask."""
    result, _ = _run(
        title, message, [(confirm, True, "primary"), ("Cancel", False, "ghost")]
    )
    return result is True


def ask_text(message: str, title: str = "Prism", confirm: str = "OK") -> str | None:
    """Ask for a line of text. None if cancelled."""
    result, text = _run(
        title,
        message,
        [(confirm, True, "primary"), ("Cancel", False, "ghost")],
        entry=True,
    )
    return text if result is True else None


def ask_reapply(message: str, title: str = "Prism") -> bool:
    """Offer to apply a stash. True = apply, default is to leave it.

    Leaving it is the safe default: a restore can conflict, and the stash stays in the
    list either way, so "Not now" loses nothing.
    """
    result, _ = _run(
        title,
        message,
        [("Apply stash", True, "primary"), ("Not now", False, "ghost")],
    )
    return result is True


def ask_clone_or_cancel(message: str, title: str = "Prism") -> bool:
    """Offer to clone a project we do not have, or cancel. True = clone.

    The first gate of the clone flow: a link is not consent to write to disk, so
    the user says yes here before we go anywhere near a folder picker.
    """
    result, _ = _run(
        title, message, [("Clone", True, "primary"), ("Cancel", False, "ghost")]
    )
    return result is True


def pick_clone_folder(message: str, title: str = "Prism") -> str | None:
    """Explain the folder choice, then open a native directory picker.

    Two steps in one call so the explanation and the picker feel like one action:
    a dialog with "Select folder" / "Cancel", and choosing "Select folder" opens
    the OS directory chooser. Returns the chosen parent directory, or None if the
    user cancelled at either step or no picker could be shown.

    The picked folder is a PARENT: the clone lands in ``<parent>/<name>``, the way
    ``git clone <url>`` names the directory itself, so an existing folder is never
    clobbered.
    """
    result, _ = _run(
        title,
        message,
        [("Select folder", True, "primary"), ("Cancel", False, "ghost")],
    )
    if result is not True:
        return None

    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        chosen = filedialog.askdirectory(
            title="Choose a folder to clone into", mustexist=True
        )
        root.destroy()
    except Exception:
        log.warning("couldn't show a folder picker", exc_info=True)
        return None

    return chosen or None


def ask_stash_or_discard(message: str, title: str = "Prism") -> tuple[str, str]:
    """The three-way choice for uncommitted work: stash, discard, or cancel.

    Returns (action, message) where action is "stash" | "discard" | "cancel".

    Discard is NOT a lookalike of Stash. A stash can still be recovered with
    `git stash apply` for a while; discarding uncommitted changes is gone immediately. So
    it is styled destructive, it is not the default, and Escape means cancel.
    """
    result, text = _run(
        title,
        message,
        [
            ("Stash", "stash", "primary"),
            ("Discard", "discard", "destructive"),
            ("Cancel", "cancel", "ghost"),
        ],
        entry=True,
    )
    if result in (None, "cancel"):
        return "cancel", ""
    return result, text
