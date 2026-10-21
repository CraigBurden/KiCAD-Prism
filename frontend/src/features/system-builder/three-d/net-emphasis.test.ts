import { describe, expect, it } from "vitest";

import type { SystemBundle } from "../model/types";
import { pickedBoardNet, systemNetEmphasis } from "./net-emphasis";

const bundle = {
  nets: [
    {
      id: "net-a",
      name: "/GPIO_65",
      names: ["/GPIO_65", "/SOM/FC2_SCL"],
      boardNets: [
        { occurrence: "occ_som", net: "/GPIO_65" },
        { occurrence: "occ_carrier", net: "/SOM/FC2_SCL" },
      ],
      pins: [],
    },
  ],
} as unknown as SystemBundle;

describe("net emphasis", () => {
  it("reads the board net from a net or terminal selection on an occurrence", () => {
    expect(pickedBoardNet({ kind: "terminal", sourceContext: "3D", reference: "J1", pin: "1", netName: "/X", occurrence: "occ_a" })).toEqual({ occurrence: "occ_a", net: "/X" });
    expect(pickedBoardNet({ kind: "net", sourceContext: "3D", netName: "/Y", occurrence: "occ_a" })).toEqual({ occurrence: "occ_a", net: "/Y" });
    expect(pickedBoardNet({ kind: "component", sourceContext: "3D", reference: "U1", occurrence: "occ_a" })).toBeNull();
    expect(pickedBoardNet({ kind: "net", sourceContext: "3D", netName: "/Y" })).toBeNull();
    expect(pickedBoardNet(null)).toBeNull();
  });

  it("lights every board net the system net joins", () => {
    expect(systemNetEmphasis(bundle, { occurrence: "occ_som", net: "/GPIO_65" })).toEqual({
      key: "net-a",
      members: [
        { occurrence: "occ_som", net: "/GPIO_65" },
        { occurrence: "occ_carrier", net: "/SOM/FC2_SCL" },
      ],
    });
  });

  it("still lights a board net the bundle does not list, on its own board", () => {
    expect(systemNetEmphasis(bundle, { occurrence: "occ_som", net: "/LOCAL" })).toEqual({
      key: "board:occ_som:/LOCAL",
      members: [{ occurrence: "occ_som", net: "/LOCAL" }],
    });
    expect(systemNetEmphasis(null, null)).toBeNull();
  });
});
