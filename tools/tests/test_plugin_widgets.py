"""Real wx component checks; run with KiCad's Python and a desktop display.

The plain agent-test environment lacks wx, so these explicitly skip there.
Loading a synthetic package avoids registering an action plugin in pcbnew.
"""

import importlib
import sys
import types
from pathlib import Path

import pytest

wx = pytest.importorskip("wx", reason="requires KiCad's wxPython and a display")

package = types.ModuleType("_prism_widget_tests")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "kicad_plugin")]
sys.modules[package.__name__] = package
widgets = importlib.import_module(f"{package.__name__}.widgets")
theme = importlib.import_module(f"{package.__name__}.prism_theme")


@pytest.fixture(scope="module")
def app():
    app = wx.App(False)
    yield app


@pytest.fixture
def frame(app):
    frame = wx.Frame(None)
    yield frame
    frame.Destroy()
    app.ProcessPendingEvents()


@pytest.mark.parametrize("dark", [False, True])
def test_control_geometry_and_fonts(frame, dark):
    pal = theme.palette(dark)
    card = widgets.Card(frame, "Repository", pal)
    button = widgets.Button(card, "Commit", pal)
    icon = widgets.IconButton(card, "open", pal, "Open in KiCad")
    badge = widgets.Badge(card, "main", pal)
    assert button.GetMinSize().height == button.FromDIP(32)
    assert icon.GetMinSize().height == button.GetMinSize().height
    assert badge.GetMinSize().height >= badge.FromDIP(24)
    assert card.RADIUS == button.RADIUS == badge.RADIUS == 0
    assert widgets.ui_font(card, mono=True).IsOk()
    assert card.label("HEAD", mono=True).GetFont().IsOk()
    assert button._font().GetWeight() == wx.FONTWEIGHT_MEDIUM
    assert button.AcceptsFocusFromKeyboard()
    button.Disable()
    assert not button.AcceptsFocusFromKeyboard()
    # The compact size rides next to normal-height primaries inside rows.
    row_button = widgets.Button(card, "Stage", pal, size="sm")
    assert row_button.GetMinSize().height == row_button.FromDIP(28)
    assert row_button.GetMinSize().height < button.GetMinSize().height
    assert widgets.IconButton(
        card, "trash", pal, "Discard", size="sm"
    ).GetMinSize().height == row_button.GetMinSize().height


def key(code):
    # wx.KeyEvent has no public key-code setter; assigning m_keyCode just adds a
    # Python attribute without changing GetKeyCode() on the underlying C++ event.
    return types.SimpleNamespace(GetKeyCode=lambda: code, Skip=lambda: None)


def test_keyboard_activates_once_on_release(frame):
    clicks = []
    button = widgets.Button(frame, "Commit", theme.LIGHT,
                            on_click=lambda: clicks.append(True))
    for code in (wx.WXK_SPACE, wx.WXK_RETURN, wx.WXK_NUMPAD_ENTER):
        button._on_key_down(key(code))
        button._on_key_down(key(code))  # auto-repeat must not execute the action
        before = len(clicks)
        button._on_key_up(key(code))
        assert len(clicks) == before + 1
        button._on_key_up(key(code))
        assert len(clicks) == before + 1
    button.Disable()
    button._on_key_down(key(wx.WXK_SPACE))
    button._on_key_up(key(wx.WXK_SPACE))
    assert len(clicks) == 3


def test_theme_checkbox_and_link_label(frame):
    pal = theme.LIGHT
    box = widgets.Checkbox(frame, "Start the Prism agent at login", pal)
    assert box.GetValue() is False
    changes = []
    ticked = widgets.Checkbox(frame, "Open prism:// links", pal, checked=True,
                              on_change=changes.append)
    assert ticked.GetValue() is True
    ticked._on_click(None)
    assert changes == [False] and ticked.GetValue() is False
    box._on_click(None)
    assert box.GetValue() is True
    # Space toggles via the key handler too.
    box._on_key(types.SimpleNamespace(GetKeyCode=lambda: wx.WXK_SPACE,
                                      Skip=lambda: None))
    assert box.GetValue() is False
    box.Disable()
    box._on_click(None)
    assert box.GetValue() is False  # disabled boxes don't toggle

    link = widgets.LinkLabel(frame, "Testing Prism Agent", pal, on_click=lambda: None)
    assert link.GetMinSize().width > 0
    link._set_hover(types.SimpleNamespace(Enter=lambda: True))
    assert link._hover

    clicks = []
    badge = widgets.Badge(frame, "main", pal, on_click=lambda: clicks.append(True))
    badge._set_hover(types.SimpleNamespace(Enter=lambda: True))
    assert badge._hover


def test_release_outside_does_not_click(frame):
    clicks = []
    button = widgets.Button(frame, "Discard", theme.LIGHT,
                            on_click=lambda: clicks.append(True))
    button.SetSize(button.GetMinSize())
    button._pressed = True
    event = wx.MouseEvent(wx.wxEVT_LEFT_UP)
    event.SetPosition(wx.Point(-10, -10))
    button._on_up(event)
    assert not clicks
    assert not button._pressed


def test_destructive_prompt_enter_still_does_nothing(frame):
    prompts = importlib.import_module(f"{package.__name__}.prompts")
    prompt = prompts._Message(frame, "Discard changes?", "Prism",
                              question=True, destructive=True,
                              yes="Discard", no="Cancel", pal=theme.LIGHT)
    prompt._on_key(key(wx.WXK_RETURN))
    assert prompt.result is None
    prompt.Destroy()
