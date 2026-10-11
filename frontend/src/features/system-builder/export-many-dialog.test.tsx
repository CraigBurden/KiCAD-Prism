import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SystemDocument } from "@/types/system";

import { ExportManyDialog, exportCandidates } from "./export-many-dialog";
import { memorySystem, renderInSession } from "./session/memory-session";
import { instance, link, systemDocument } from "./test-fixtures";

const obc = instance("OBC");
const cmbd = instance("CMBD");
const port = (reference: string) => ({ portKey: `key-${reference}`, memberKeys: [], reference, libId: null, footprint: null,
  value: "M80", dnp: false, candidate: true, candidateReason: null, override: null, exposed: true, pinCount: 10 });
// OBC J2 is linked; CMBD J3 is exported already as "J3".
const base = systemDocument([obc, cmbd], [link("L1", obc.id, "J2", cmbd.id, "J2", 0)]);
const document: SystemDocument = {
  ...base,
  instances: base.instances.map((item) => ({ ...item, ports: [port("J1"), port("J2"), port("J3")] })),
  exports: [{ id: "sxp_1", name: "J3", description: "", instanceId: cmbd.id, portKey: "key-J3" } as never],
};

describe("ExportManyDialog (SB2-121)", () => {
  it("offers free connectors with names that do not clash", () => {
    expect(exportCandidates(document).map((option) => `${option.label}=${option.name}`))
      .toEqual(["CMBD J1=CMBD J1", "OBC J1=OBC J1", "OBC J3=OBC J3"]);
  });

  it("exports the ticked connectors in one call", async () => {
    const memory = memorySystem(document, { edits: { createExports: () => ({ exports: [] }) } });
    const onClose = vi.fn();
    renderInSession(<ExportManyDialog document={document} onClose={onClose} />, { document, transport: memory.transport });
    fireEvent.click(screen.getByRole("checkbox", { name: "Export OBC J1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Export OBC J3" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name for OBC J3" }), { target: { value: "J3" } });
    expect(screen.getByText("Names must be unique")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Name for OBC J3" }), { target: { value: "DEBUG" } });
    fireEvent.click(screen.getByRole("button", { name: "Export 2" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(memory.calls.map((call) => call.name)).toEqual(["createExports"]);
    expect((memory.calls[0].args[0] as { name: string }[]).map((item) => item.name)).toEqual(["OBC J1", "DEBUG"]);
  });
});
