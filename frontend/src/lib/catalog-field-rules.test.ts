import { describe, expect, it } from "vitest";

import cases from "./catalog-field-rules.cases.json";
import {
  blockingImportFindings,
  customImportProblems,
  fieldError,
  fieldVerdict,
  importMetadataProblems,
  type FieldRulesContext,
  type IdentityKind,
} from "./catalog-field-rules";

// The same table backend/tests/test_catalog_field_rules.py runs against the Python rules.
describe("catalog field rules case table", () => {
  it.each(cases.fields)("$field.key=$value in $context ($identity) -> '$verdict'", (testCase) => {
    expect(
      fieldVerdict(
        testCase.field,
        testCase.value,
        testCase.context as FieldRulesContext,
        testCase.identity as IdentityKind,
      ),
    ).toBe(testCase.verdict);
  });

  it.each(cases.imports)("import problems for %#", (testCase) => {
    expect(importMetadataProblems(testCase.values)).toEqual(testCase.problems);
  });

  it.each(cases.customImports)("custom import problems for %#", (testCase) => {
    expect(customImportProblems(testCase.fields, testCase.extra_fields)).toEqual(testCase.problems);
  });

  it.each(cases.findings)("blocking findings for %#", (testCase) => {
    expect(blockingImportFindings(testCase.findings, testCase.linked).map((finding) => finding.code)).toEqual(
      testCase.blocking,
    );
  });
});

describe("fieldError", () => {
  it("renders the contract's messages", () => {
    expect(fieldError({ key: "value", type: "text" }, "", "bulk")).toBe("Required");
    expect(fieldError({ key: "mass_g", type: "number" }, "abc", "bulk")).toBe("Enter a valid number");
    expect(fieldError({ key: "mass_g", type: "number" }, "abc", "editor")).toBe("");
  });
});
