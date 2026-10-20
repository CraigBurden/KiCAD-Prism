import { describe, expect, it } from "vitest";

import type { SystemSummary } from "../model/types";
import { systemsForLevel } from "./systems-section";

const system = (systemId: string, name: string, folderId: string | null): SystemSummary => ({
  systemId, name, folderId, version: 1, createdBy: "", createdAt: "", updatedAt: "",
});

describe("systemsForLevel", () => {
  const all = [system("sys_b", "Stack", "f1"), system("sys_a", "Avionics", null), system("sys_c", "Stack", null)];

  it("lists the level's systems by name", () => {
    expect(systemsForLevel(all, null, "").map((item) => item.systemId)).toEqual(["sys_a", "sys_c"]);
    expect(systemsForLevel(all, "f1", "").map((item) => item.systemId)).toEqual(["sys_b"]);
  });

  it("searches every level", () => {
    expect(systemsForLevel(all, null, "stack").map((item) => item.systemId)).toEqual(["sys_b", "sys_c"]);
  });
});
