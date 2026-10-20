import { describe, expect, it } from "vitest";

import type { BundleFinding } from "../model/types";
import { sortFindings } from "./review-pane";

const finding = (code: string, severity: BundleFinding["severity"], subject = "s"): BundleFinding => ({
  code, severity, subject, message: code, objects: [], waived: false,
});

describe("sortFindings", () => {
  it("puts errors first, then warnings, then info, each by code and subject", () => {
    const sorted = sortFindings([finding("b", "info"), finding("z", "warning"), finding("a", "warning"), finding("m", "error")]);
    expect(sorted.map((item) => item.code)).toEqual(["m", "a", "z", "b"]);
  });
});
