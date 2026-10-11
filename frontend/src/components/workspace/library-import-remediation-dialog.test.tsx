import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogMetadataField, ProjectComponentImportProposal } from "@/types/catalog";
import { LibraryImportRemediationDialog } from "./library-import-remediation-dialog";

const APPROVAL: CatalogMetadataField = {
  id: "field-1", key: "approval_ref", label: "Approval Ref", description: "", group: "custom", type: "text",
  unit: "", enum_values: [], storage_kind: "extra", storage_key: "approval_ref", built_in: false, required: true,
  display_order: 100, archived: false, created_by: "", updated_by: "", created_at: "", updated_at: "",
};

const PROPOSAL: ProjectComponentImportProposal = {
  id: "p1", session_id: "s1", dedupe_key: "p1", component_uid: "p1", reference: "R1", status: "candidate",
  accepted_component_id: "",
  metadata: {
    value: "10k", manufacturer: "Yageo", manufacturer_part_number: "RC0402", description: "Resistor",
    datasheet: "https://x.test/d.pdf", footprint: "R_0402", fields: { Tolerance: "1%" },
  },
  assets: [
    { asset_type: "symbol", filename: "R.kicad_sym", sha256: "a", size_bytes: 1, target_library: "L", target_name: "R", source_path: "R.kicad_sym" },
    { asset_type: "footprint", filename: "R.kicad_mod", sha256: "b", size_bytes: 1, target_library: "L", target_name: "R", source_path: "R.kicad_mod" },
  ],
  provenance: [], findings: [],
};

describe("remediation dialog custom fields (D43)", () => {
  it("blocks accept on a blank custom required field and sends it with the symbol's fields", () => {
    const onAccept = vi.fn();
    render(
      <LibraryImportRemediationDialog
        proposal={PROPOSAL} customFields={[APPROVAL]} open submitting={false}
        onOpenChange={vi.fn()} onAccept={onAccept}
      />,
    );
    const accept = screen.getByRole("button", { name: "Accept as draft revision" });
    expect(accept).toBeDisabled();
    expect(accept).toHaveAttribute("title", "Approval Ref is required");

    fireEvent.change(screen.getByLabelText(/Approval Ref/), { target: { value: "QA-9" } });
    expect(accept).toBeEnabled();
    fireEvent.click(accept);
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({
      metadata_overrides: expect.objectContaining({ value: "10k", extra_fields: { Tolerance: "1%", approval_ref: "QA-9" } }),
    }));
  });

  it("leaves extra_fields out when no custom value was edited", () => {
    const onAccept = vi.fn();
    render(
      <LibraryImportRemediationDialog
        proposal={PROPOSAL} customFields={[{ ...APPROVAL, required: false }]} open submitting={false}
        onOpenChange={vi.fn()} onAccept={onAccept}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept as draft revision" }));
    expect(onAccept.mock.calls[0][0].metadata_overrides).not.toHaveProperty("extra_fields");
  });
});
