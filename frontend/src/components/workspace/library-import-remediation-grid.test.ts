import { describe, expect, it } from "vitest";

import { rowProblems, type RowEdits } from "./library-import-remediation-grid";
import type { ProjectComponentImportProposal } from "@/types/catalog";

function proposal(
  overrides: Partial<ProjectComponentImportProposal> = {}
): ProjectComponentImportProposal {
  return {
    id: "proposal-1",
    session_id: "session-1",
    dedupe_key: "key-1",
    component_uid: "uid-1",
    reference: "C149",
    status: "candidate",
    accepted_component_id: "",
    metadata: {
      value: "22uF_25V_1210",
      manufacturer: "TDK Corporation",
      manufacturer_part_number: "CGA6P3X7R1E226M250AE",
      description: "Unpolarized capacitor, small symbol",
      datasheet: "https://product.tdk.com/en/system/datasheet.pdf",
      footprint: "Pixxel_Capacitors:CAP1210",
    },
    assets: [
      {
        asset_type: "symbol",
        filename: "C.kicad_sym",
        sha256: "a".repeat(64),
        size_bytes: 128,
        target_library: "Prism_Imported",
        target_name: "C",
        source_path: "project/C.kicad_sym",
      },
    ],
    provenance: [],
    findings: [],
    ...overrides,
  };
}

const NO_EDITS: RowEdits = {};

describe("rowProblems", () => {
  it("reports a complete row with a linked footprint as ready", () => {
    const row = proposal();
    const edits: RowEdits = { "proposal-1": { metadata: {}, footprintAssetId: "asset-9" } };
    expect(rowProblems(row, edits)).toEqual([]);
  });

  it("clears a footprint_not_resolved finding once a footprint is linked", () => {
    // The reported bug: every field filled and a footprint linked, yet the row stayed
    // flagged because the scan-time error finding was treated as permanent.
    const row = proposal({
      findings: [
        {
          code: "footprint_not_resolved",
          severity: "error",
          message: "Embedded footprint for C149 was not found.",
        },
      ],
    });

    expect(rowProblems(row, NO_EDITS).length).toBeGreaterThan(0);

    const linked: RowEdits = { "proposal-1": { metadata: {}, footprintAssetId: "asset-9" } };
    expect(rowProblems(row, linked)).toEqual([]);
  });

  it("keeps blocking on an unresolved symbol even when a footprint is linked", () => {
    const row = proposal({
      assets: [],
      findings: [
        {
          code: "symbol_not_resolved",
          severity: "error",
          message: "Embedded symbol for C149 was not found.",
        },
      ],
    });
    const linked: RowEdits = { "proposal-1": { metadata: {}, footprintAssetId: "asset-9" } };
    const problems = rowProblems(row, linked);
    expect(problems).toContain("No symbol was extracted");
    expect(problems).toContain("Embedded symbol for C149 was not found.");
  });

  it("treats a saved draft link the same as a local edit", () => {
    const row = proposal({
      findings: [
        {
          code: "footprint_not_resolved",
          severity: "error",
          message: "Embedded footprint for C149 was not found.",
        },
      ],
      draft: { asset_links: { footprint: "asset-9" } },
    });
    expect(rowProblems(row, NO_EDITS)).toEqual([]);
  });

  it("still requires the mandatory metadata fields", () => {
    const row = proposal({ metadata: { ...proposal().metadata, manufacturer: "" } });
    const linked: RowEdits = { "proposal-1": { metadata: {}, footprintAssetId: "asset-9" } };
    expect(rowProblems(row, linked)).toContain("Manufacturer is required");
  });

  it("rejects a datasheet that is not an HTTP(S) URL", () => {
    const row = proposal({ metadata: { ...proposal().metadata, datasheet: "see intranet" } });
    const linked: RowEdits = { "proposal-1": { metadata: {}, footprintAssetId: "asset-9" } };
    expect(rowProblems(row, linked)).toContain("Datasheet must be an HTTP(S) URL");
  });
});
