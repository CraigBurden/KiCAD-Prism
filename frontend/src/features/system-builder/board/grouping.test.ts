import { describe, expect, it } from "vitest";

import { busGroupLabel, memberSafe, proposeGroup } from "./grouping";

const J2201 = [
  { pad: "1", net: "GND" },
  { pad: "2", net: "+5V0" },
  { pad: "3", net: "/SOM/FAN_TACH_3V3" },
  { pad: "4", net: "/SOM/FAN_PWM_3V3" },
  { pad: "MP", net: "GND" },
];

describe("proposeGroup", () => {
  it("names the group after the shared part and the members after what differs", () => {
    expect(proposeGroup(J2201.slice(2, 4))).toEqual({ name: "FAN", members: ["TACH", "PWM"] });
  });

  it("handles differential pairs and KiCad's overbar braces", () => {
    expect(proposeGroup([{ pad: "2", net: "/PCIE_TX_N" }, { pad: "4", net: "/PCIE_TX_P" }])).toEqual({ name: "PCIE_TX", members: ["N", "P"] });
    expect(memberSafe("/~{PCIE_PERST}")).toBe("PCIE_PERST");
  });

  it("falls back to pad numbers for missing or colliding members", () => {
    expect(proposeGroup([{ pad: "1", net: "GND" }, { pad: "MP", net: "GND" }, { pad: "7" }])).toEqual({ name: "GND", members: ["1", "MP", "7"] });
  });
});

describe("busGroupLabel", () => {
  it("writes groups then ungrouped pads, as in the mockup", () => {
    expect(busGroupLabel("J2201", J2201, [{ name: "FAN", pins: ["3", "4"] }])).toBe("J2201{FAN{TACH PWM} 1 2 MP}");
  });

  it("shows the pin count without groups and shortens a long tail", () => {
    const pins = Array.from({ length: 20 }, (_, index) => ({ pad: String(index + 1), net: `N${index}` }));
    expect(busGroupLabel("J202", pins, [])).toBe("J202{20}");
    expect(busGroupLabel("J202", pins, [{ name: "A", pins: ["1", "2"] }])).toBe("J202{A{N0 N1} 3 4 5 6 7 8 9 +11}");
  });
});
