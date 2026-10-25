import Fuse from "fuse.js";
import { describe, expect, it } from "vitest";

import { componentWorkspacePath, PALETTE_SEARCH_OPTIONS } from "./command-palette";

/**
 * The component workspace has no route of its own — it is the workspace shell
 * reading `component` out of the query string. That makes the deep link a
 * contract between the palette and the shell, and worth pinning: a missing
 * `section` lands the user on the project gallery instead, with no error.
 */
describe("componentWorkspacePath", () => {
  it("names every parameter the workspace shell needs", () => {
    const params = new URLSearchParams(componentWorkspacePath("abc-123").slice(2));
    expect(params.get("section")).toBe("library-manager");
    expect(params.get("libraryView")).toBe("catalog");
    expect(params.get("component")).toBe("abc-123");
    expect(params.get("componentTab")).toBe("overview");
  });

  it("targets the workspace root so the link works from a project page", () => {
    expect(componentWorkspacePath("abc-123").startsWith("/?")).toBe(true);
  });

  it("escapes ids that would otherwise break the query string", () => {
    const path = componentWorkspacePath("a&b=c d");
    expect(path).not.toContain("a&b=c d");
    expect(new URLSearchParams(path.slice(2)).get("component")).toBe("a&b=c d");
  });
});

describe("palette matching", () => {
  const project = (label: string, path: string) => ({ label, group: "Projects", keywords: `${label} ${path}` });
  const commands = [
    project("GNSS_RECEIVER", "/app/projects/type1/GNSS_RECEIVER"),
    project("SSD-XX-200-CNDH-BP", "/app/projects/type1/SSD-XX-200-CNDH-BP"),
    project("Proto100", "/app/projects/type2/SSD_XX_200_Proto1/Proto100"),
    project("JTYU-TSMC", "/app/projects/type1/JTYU-TSMC"),
  ];
  const search = (query: string) => new Fuse(commands, PALETTE_SEARCH_OPTIONS).search(query).map((hit) => hit.item.label);

  it("does not match a short query that is one letter off", () => {
    expect(search("GND")).toEqual([]);
  });

  it("still forgives a typo in a longer query and finds exact names", () => {
    expect(search("GNSS_RECIEVER")).toEqual(["GNSS_RECEIVER"]);
    expect(search("tsmc")).toEqual(["JTYU-TSMC"]);
    expect(search("CNDH")).toEqual(["SSD-XX-200-CNDH-BP"]);
  });
});
