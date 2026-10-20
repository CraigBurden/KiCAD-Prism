import { describe, expect, it } from "vitest";

import { freshLabel } from "./add-board-dialog";

describe("freshLabel", () => {
  it("numbers a second board of the same project", () => {
    expect(freshLabel("Carrier", [])).toBe("Carrier");
    expect(freshLabel("Carrier", ["Carrier", "Carrier 2"])).toBe("Carrier 3");
  });
});
