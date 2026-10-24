"""Themed replacements for wx's native message, entry and choice dialogs.

The panel is drawn entirely in the app's own palette, and then every question it asked
arrived as a system dialog: grey where the panel is dark, a different type stack, and
the OS's own button order. The break was most obvious on the destructive prompts, which
are exactly the ones the user should be reading carefully.

These take what the wx helpers they replace took and return what those returned, so a
call site changes by its name:

    wx.MessageBox(text, title, wx.YES_NO)     -> ask(parent, text, title)
    wx.GetTextFromUser(prompt, title, "")     -> ask_text(parent, prompt, title)
    wx.GetSingleChoice(prompt, title, items)  -> ask_choice(parent, prompt, title, items)

What they deliberately do NOT do is reimplement wx's flag vocabulary. A prompt is
either a statement or a question, and a question is either ordinary or destructive.
That is the whole surface, because it is all the panel ever needed.
"""

from __future__ import annotations

import wx

from . import prism_theme as th
from .widgets import Button, Card, ui_font


def _c(hex_value):
    return wx.Colour(*th.hex_to_rgb(hex_value))


def palette() -> dict:
    """The palette these dialogs draw in, following the system appearance."""
    return th.palette(dark=wx.SystemSettings.GetAppearance().IsDark())


class _Prompt(wx.Dialog):
    """The shared shell: a card, a message, a row of buttons.

    Subclasses add whatever sits between the message and the buttons (an entry field,
    a list) and say what Enter means.
    """

    def __init__(self, parent, message, title, pal=None):
        super().__init__(parent, title=title, style=wx.DEFAULT_DIALOG_STYLE)
        self.pal = pal or palette()
        self.SetFont(ui_font(self))
        self.result = None

        self.SetBackgroundColour(_c(self.pal["background"]))

        outer = wx.BoxSizer(wx.VERTICAL)
        card = Card(self, "", self.pal)
        self.card = card

        if message:
            card.body.Add(
                card.label(message, wrap=True), 0, wx.EXPAND | wx.ALL, th.SP_MD
            )

        self._build_body(card)

        row = wx.BoxSizer(wx.HORIZONTAL)
        row.AddStretchSpacer()
        self._build_buttons(card, row)
        card.body.Add(row, 0, wx.EXPAND | wx.ALL, th.SP_MD)

        outer.Add(card, 1, wx.EXPAND | wx.ALL, th.SP_MD)
        self.SetSizer(outer)
        self.SetMinSize(wx.Size(420, -1))
        self.Fit()
        self.CentreOnParent()

        # Escape closes, as in any dialog. Enter is bound per subclass, because what it
        # should do differs: confirming a question is not the same as accepting a typed
        # value, and on a destructive prompt it must do neither.
        self.Bind(wx.EVT_CHAR_HOOK, self._on_key)

    # -- for subclasses ----------------------------------------------------

    def _build_body(self, card):
        """Anything between the message and the buttons."""

    def _build_buttons(self, card, row):
        raise NotImplementedError

    def _on_key(self, event):
        if event.GetKeyCode() == wx.WXK_ESCAPE:
            self._cancel()
            return
        event.Skip()

    # -- outcomes ----------------------------------------------------------

    def _accept(self, value=True):
        self.result = value
        self.EndModal(wx.ID_OK)

    def _cancel(self):
        self.result = None
        self.EndModal(wx.ID_CANCEL)


class _Message(_Prompt):
    """A statement with one button, or a question with two."""

    def __init__(
        self, parent, message, title, *, question, destructive, yes, no, pal=None
    ):
        self._question = question
        self._destructive = destructive
        self._yes = yes
        self._no = no
        super().__init__(parent, message, title, pal=pal)

    def _build_buttons(self, card, row):
        if self._question:
            row.Add(
                Button(
                    card, self._no, self.pal, variant="secondary", on_click=self._cancel
                ),
                0,
                wx.RIGHT,
                th.SP_SM,
            )
        # A destructive yes is drawn in red rather than as the primary action: it must
        # not be the button the eye lands on first.
        row.Add(
            Button(
                card,
                self._yes,
                self.pal,
                variant="destructive-ghost" if self._destructive else "primary",
                on_click=self._accept,
            ),
            0,
        )

    def _on_key(self, event):
        # Enter confirms an ordinary question and does nothing on a destructive one: a
        # reflex Enter on a dialog nobody read must not discard a board.
        if event.GetKeyCode() in (wx.WXK_RETURN, wx.WXK_NUMPAD_ENTER):
            if not self._destructive:
                self._accept()
            return
        super()._on_key(event)


class _TextPrompt(_Prompt):
    """A question with a value typed into it."""

    def __init__(self, parent, message, title, value="", pal=None):
        self._initial = value
        super().__init__(parent, message, title, pal=pal)
        self.field.SetFocus()
        self.field.SelectAll()

    def _build_body(self, card):
        self.field = wx.TextCtrl(card, value=self._initial)
        self.field.SetBackgroundColour(_c(self.pal["muted"]))
        self.field.SetForegroundColour(_c(self.pal["foreground"]))
        font = self.field.GetFont()
        font.SetPointSize(th.FONT_BODY)
        self.field.SetFont(font)
        card.body.Add(
            self.field, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, th.SP_MD
        )

    def _build_buttons(self, card, row):
        row.Add(
            Button(card, "Cancel", self.pal, variant="secondary", on_click=self._cancel),
            0,
            wx.RIGHT,
            th.SP_SM,
        )
        row.Add(
            Button(card, "OK", self.pal, variant="primary", on_click=self._submit), 0
        )

    def _submit(self):
        self._accept(self.field.GetValue())

    def _on_key(self, event):
        if event.GetKeyCode() in (wx.WXK_RETURN, wx.WXK_NUMPAD_ENTER):
            self._submit()
            return
        super()._on_key(event)


class _ChoicePrompt(_Prompt):
    """A question answered by picking one of a list."""

    def __init__(self, parent, message, title, choices, pal=None):
        self._choices = list(choices)
        super().__init__(parent, message, title, pal=pal)
        # Wide enough to read a long branch name, which is what the native picker got
        # wrong: it sized to the text and could not be resized.
        self.SetSize(wx.Size(520, 420))
        self.CentreOnParent()

    def _build_body(self, card):
        self.list = wx.ListBox(card, choices=self._choices, style=wx.LB_SINGLE)
        self.list.SetBackgroundColour(_c(self.pal["muted"]))
        self.list.SetForegroundColour(_c(self.pal["foreground"]))
        font = self.list.GetFont()
        font.SetPointSize(th.FONT_BODY)
        self.list.SetFont(font)
        if self._choices:
            self.list.SetSelection(0)
        # Double-click is the gesture everyone tries on a list; without it the dialog
        # feels broken to half the people who open it.
        self.list.Bind(wx.EVT_LISTBOX_DCLICK, lambda _e: self._submit())
        card.body.Add(
            self.list, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, th.SP_MD
        )

    def _build_buttons(self, card, row):
        row.Add(
            Button(card, "Cancel", self.pal, variant="secondary", on_click=self._cancel),
            0,
            wx.RIGHT,
            th.SP_SM,
        )
        row.Add(
            Button(card, "OK", self.pal, variant="primary", on_click=self._submit), 0
        )

    def _submit(self):
        index = self.list.GetSelection()
        if index == wx.NOT_FOUND:
            return
        self._accept(index)

    def _on_key(self, event):
        if event.GetKeyCode() in (wx.WXK_RETURN, wx.WXK_NUMPAD_ENTER):
            self._submit()
            return
        super()._on_key(event)


# -- the API the panel calls ----------------------------------------------


def tell(parent, message, title="Prism", pal=None) -> None:
    """State something. One button, nothing to decide."""
    dlg = _Message(
        parent, message, title,
        question=False, destructive=False, yes="OK", no="", pal=pal,
    )
    try:
        dlg.ShowModal()
    finally:
        dlg.Destroy()


def ask(
    parent, message, title="Prism", *, yes="Yes", no="Cancel",
    destructive=False, pal=None,
) -> bool:
    """Ask a yes/no question. True only on an explicit yes.

    `destructive` draws the confirming button in red and stops Enter from pressing it,
    for the prompts that throw work away.
    """
    dlg = _Message(
        parent, message, title,
        question=True, destructive=destructive, yes=yes, no=no, pal=pal,
    )
    try:
        dlg.ShowModal()
        return dlg.result is True
    finally:
        dlg.Destroy()


def ask_text(parent, message, title="Prism", value="", pal=None):
    """Ask for a line of text. None if cancelled, which is NOT the same as "".

    The distinction matters: an empty stash message is allowed, cancelling is a
    different answer, and collapsing both to "" is how a cancel becomes an action.
    """
    dlg = _TextPrompt(parent, message, title, value=value, pal=pal)
    try:
        dlg.ShowModal()
        return dlg.result
    finally:
        dlg.Destroy()


def ask_choice(parent, message, title, choices, pal=None):
    """Ask the user to pick one. Returns its index, or None if cancelled.

    An index rather than the string, so a caller can map back to whatever it built the
    labels from instead of parsing its own label apart again.
    """
    if not choices:
        return None
    dlg = _ChoicePrompt(parent, message, title, choices, pal=pal)
    try:
        dlg.ShowModal()
        return dlg.result
    finally:
        dlg.Destroy()
