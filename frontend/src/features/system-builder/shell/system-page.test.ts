import { describe, expect, it } from "vitest";

import type { SystemDocument } from "../model/types";
import { drawnSelection } from "./system-page";

describe("drawnSelection", () => {
  it("shows a finding on a harness link as its block", () => {
    const document = {
      harnesses: [{ id: "har_a", links: [{ id: "link_a" }], wires: [], splices: [], cables: [], markers: [] }],
    } as unknown as SystemDocument;
    expect([...drawnSelection(document, new Set(["link_a"]))].sort()).toEqual(["har_a", "link_a"]);
    expect([...drawnSelection(document, new Set(["occ_x"]))]).toEqual(["occ_x"]);
  });
});
