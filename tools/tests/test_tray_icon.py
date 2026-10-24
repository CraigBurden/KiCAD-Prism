"""The tray icon survives pystray's X11 backend, which has no transparency.

Found on Debian + GNOME (legacy icon hosted by the AppIndicator extension): pystray's
_xorg backend pastes our RGBA icon into an RGB image and drops alpha, so the
half-transparent anti-aliased edge showed at full strength, a jagged light-blue ring.
See __main__._flatten_for_xembed.
"""

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import __main__ as agent_main  # noqa: E402


def _icon_with(*pixels):
    icon = Image.new("RGBA", (len(pixels), 1))
    for x, p in enumerate(pixels):
        icon.putpixel((x, 0), p)
    return icon


def test_a_half_transparent_edge_blends_into_the_panel():
    edge = (120, 200, 255, 64)  # light blue at 25% opacity
    flat = agent_main._flatten_for_xembed(_icon_with(edge), Image)

    r, g, b = flat.getpixel((0, 0))
    # A quarter of the colour over black, not the full-strength light blue.
    assert (r, g, b) == (30, 50, 64)


def test_opaque_pixels_keep_their_colour_and_clear_ones_become_panel():
    flat = agent_main._flatten_for_xembed(
        _icon_with((37, 99, 235, 255), (255, 255, 255, 0)), Image
    )

    assert flat.mode == "RGB"
    assert flat.getpixel((0, 0)) == (37, 99, 235)
    assert flat.getpixel((1, 0)) == agent_main._XEMBED_PANEL_RGB


def test_the_shipped_icon_has_no_bright_fringe_once_flattened():
    icon = agent_main._make_icon(Image, None)
    flat = agent_main._flatten_for_xembed(icon, Image)

    # Every pixel is no brighter than the icon's own opaque colour would allow:
    # a fringe pixel at low alpha must end up dark, not at full intensity.
    flat_px, icon_px = flat.load(), icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            assert max(flat_px[x, y]) <= icon_px[x, y][3] + 1
