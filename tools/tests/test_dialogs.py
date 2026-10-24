"""The agent's own dialogs.

These stand in front of cloning a repo, moving a working tree, and destroying
uncommitted work. So the property that matters is not that they look nice: it is that
**failing to ask is a NO**, never a silent yes. A URL handler that cannot open a window
must decline, not proceed.

The dialogs themselves need a display, so what is tested here is the decision logic and
the degradation, not the pixels.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import dialogs  # noqa: E402


@pytest.fixture
def no_display(monkeypatch):
    """A machine where no window can be opened."""
    monkeypatch.setattr(
        dialogs,
        "_Dialog",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("no display")),
    )


# -- failing to ask is a NO ------------------------------------------------


def test_a_yes_no_declines_when_it_cannot_ask(no_display):
    """Cloning a repo the user did not ask for, into a folder they did not choose, is
    not something a link should do because a dialog failed to open."""
    assert dialogs.ask("Clone it?") is False


def test_asking_for_text_returns_none_when_it_cannot_ask(no_display):
    assert dialogs.ask_text("What were you working on?") is None


def test_the_three_way_cancels_when_it_cannot_ask(no_display):
    """The harshest case: one of the buttons DESTROYS uncommitted work. A dialog that
    fails to open must never resolve to that."""
    action, message = dialogs.ask_stash_or_discard("You have uncommitted changes")
    assert action == "cancel"
    assert message == ""


def test_telling_the_user_something_never_raises(no_display):
    # Nothing to decide, but it must not take the process down on a headless box.
    dialogs.tell("Something happened.")


def test_clone_or_cancel_declines_when_it_cannot_ask(no_display):
    """Same rule as any clone consent: no dialog means no clone."""
    assert dialogs.ask_clone_or_cancel("Clone widget?") is False


def test_pick_clone_folder_returns_none_when_it_cannot_ask(no_display):
    """If the explanation dialog cannot open, the picker is never reached and the
    whole flow cancels."""
    assert dialogs.pick_clone_folder("Pick a folder") is None


# -- the three-way choice --------------------------------------------------


def fake_dialog(monkeypatch, result, text=""):
    class Fake:
        def __init__(self, *a, **k):
            pass

        def show(self):
            return result, text

    monkeypatch.setattr(dialogs, "_Dialog", Fake)


def test_set_aside_returns_the_message(monkeypatch):
    fake_dialog(monkeypatch, "stash", "rerouting the power rail")
    assert dialogs.ask_stash_or_discard("?") == ("stash", "rerouting the power rail")


def test_discard_is_reported_as_discard(monkeypatch):
    fake_dialog(monkeypatch, "discard", "ignored")
    action, _ = dialogs.ask_stash_or_discard("?")
    assert action == "discard"


def test_cancel_carries_no_message(monkeypatch):
    """A message typed and then cancelled is not consent to anything."""
    fake_dialog(monkeypatch, "cancel", "I typed this then thought better of it")
    assert dialogs.ask_stash_or_discard("?") == ("cancel", "")


def test_closing_the_window_is_a_cancel(monkeypatch):
    """Escape and the X button both return None. Neither is a yes."""
    fake_dialog(monkeypatch, None, "")
    assert dialogs.ask_stash_or_discard("?") == ("cancel", "")


def test_a_yes_no_needs_an_actual_yes(monkeypatch):
    fake_dialog(monkeypatch, False)
    assert dialogs.ask("?") is False

    fake_dialog(monkeypatch, True)
    assert dialogs.ask("?") is True


def test_text_is_only_returned_on_confirm(monkeypatch):
    """Cancelling with text in the box is still a cancel."""
    fake_dialog(monkeypatch, False, "typed but cancelled")
    assert dialogs.ask_text("?") is None


# -- the theme -------------------------------------------------------------


def test_the_palette_is_the_plugins_own(monkeypatch):
    """Loaded by path, not imported: kicad_plugin/__init__ imports pcbnew, which only
    exists inside KiCad, so a plain import explodes in this process."""
    dialogs._theme.cache_clear()
    theme = dialogs._theme()
    assert theme is not None

    pal = dialogs.palette()
    assert pal["destructive"] == theme.DARK["destructive"]


def test_it_falls_back_rather_than_failing_when_the_theme_is_missing(monkeypatch):
    """A dialog nobody can read is worse than one that does not match."""
    dialogs._theme.cache_clear()
    monkeypatch.setattr(dialogs, "_theme", lambda: None)

    pal = dialogs.palette()
    assert pal is dialogs._FALLBACK
    # And the fallback is legible: light text would vanish on the light background.
    assert pal["background"] != pal["foreground"]


def test_the_fallback_carries_every_colour_the_dialog_uses(monkeypatch):
    """A KeyError here would take down the dialog we fell back to draw."""
    dialogs._theme.cache_clear()
    monkeypatch.setattr(dialogs, "_theme", lambda: None)
    pal = dialogs.palette()

    for needed in (
        "background",
        "foreground",
        "muted",
        "muted_fg",
        "primary",
        "primary_fg",
        "destructive",
        "border",
    ):
        assert needed in pal, f"the fallback palette is missing {needed}"


def test_dark_mode_detection_never_raises(monkeypatch):
    # It reads a registry key / shells out to `defaults`. Neither is guaranteed.
    assert dialogs._prefers_dark() in (True, False)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
