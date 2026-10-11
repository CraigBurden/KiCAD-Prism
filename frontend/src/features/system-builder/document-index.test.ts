import { describe, expect, it } from "vitest";

import { documentIndex } from "./document-index";
import { instance, link, systemDocument } from "./test-fixtures";

describe("document index (SB2-99)", () => {
  const obc = instance("OBC");
  const pwr = instance("PWR");
  const doc = systemDocument([obc, pwr], [link("L1", obc.id, "J1", pwr.id, "J2", 3)]);

  it("is built once per document and finds by id", () => {
    const index = documentIndex(doc);
    expect(documentIndex(doc)).toBe(index);
    expect(index.instances.get(pwr.id)?.label).toBe("PWR");
    expect(index.links.get("L1")?.id).toBe("L1");
    expect(documentIndex({ ...doc })).not.toBe(index);
  });
});
