/* The net-class atlas's interactions, in plain DOM JavaScript.
 *
 * Three behaviours, each independent:
 *   - a copper layer's checkbox hides that layer's traces and zones, and hides
 *     a pad only when every one of its copper layers is off;
 *   - clicking a trace, a via, a zone, a pad or a table row isolates that net
 *     and dims every other net in the same drawing to 15 %; clicking it again
 *     restores the drawing;
 *   - the side switch changes which side's footprints are drawn in full,
 *     through the stylesheet's body[data-side] rules;
 *   - a group's Zones checkbox swaps its zone fills for dashed outlines.
 */
(() => {
  "use strict";

  const body = document.body;

  // ------------------------------------------------------------- layers

  const toggles = Array.from(document.querySelectorAll("[data-layer-toggle]"));

  const applyLayers = () => {
    const off = new Set(
      toggles.filter((input) => !input.checked).map((input) => input.value),
    );
    document.querySelectorAll("[data-layer]").forEach((element) => {
      element.style.display = off.has(element.dataset.layer) ? "none" : "";
    });
    document.querySelectorAll("[data-layers]").forEach((element) => {
      const layers = element.dataset.layers.split(" ").filter(Boolean);
      const hidden =
        layers.length > 0 && layers.every((layer) => off.has(layer));
      element.style.display = hidden ? "none" : "";
    });
  };

  toggles.forEach((input) => input.addEventListener("change", applyLayers));

  // --------------------------------------------------------- net focus

  const focusNet = (section, net) => {
    const next = section.dataset.focus === net ? "" : net;
    section.dataset.focus = next;
    section.querySelectorAll("[data-net]").forEach((element) => {
      element.style.opacity =
        next && element.dataset.net !== next ? "0.15" : "";
    });
    section.querySelectorAll("[data-net-row]").forEach((row) => {
      row.classList.toggle(
        "is-active",
        Boolean(next) && row.dataset.netRow === next,
      );
    });
  };

  document.querySelectorAll("svg [data-net]").forEach((element) => {
    element.addEventListener("click", () => {
      const section = element.closest("section");
      if (section && element.dataset.net) {
        focusNet(section, element.dataset.net);
      }
    });
  });

  document.querySelectorAll("[data-net-row]").forEach((row) => {
    row.addEventListener("click", () => {
      const section = row.closest("section");
      if (section) {
        focusNet(section, row.dataset.netRow);
      }
    });
  });

  // --------------------------------------------------------------- zones

  document.querySelectorAll("[data-zones-toggle]").forEach((input) => {
    const section = input.closest(".net-group");
    if (!section) {
      return;
    }
    const apply = () => {
      section.dataset.zones = input.checked ? "on" : "off";
    };
    input.addEventListener("change", apply);
    apply();
  });

  // --------------------------------------------------------------- side

  const sideButtons = Array.from(
    document.querySelectorAll("[data-side-option]"),
  );

  sideButtons.forEach((button) => {
    button.addEventListener("click", () => {
      body.dataset.side = button.dataset.sideOption;
      sideButtons.forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
    });
  });
})();
