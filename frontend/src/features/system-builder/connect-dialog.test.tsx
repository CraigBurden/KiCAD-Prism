import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SystemDocument } from "@/types/system";

import { ConnectDialog, connectorOptions } from "./connect-dialog";
import { memorySystem, renderInSession } from "./session/memory-session";
import { instance, link, systemDocument } from "./test-fixtures";
import { chooseOption } from "@/test/select";

const obc = instance("OBC");
const cmbd = instance("CMBD");
const lp = instance("LPDRM");
const withPorts = (doc: SystemDocument): SystemDocument => ({
  ...doc,
  instances: doc.instances.map((item) => ({
    ...item,
    ports: [
      { portKey: "key-J1", memberKeys: [], reference: "J1", libId: null, footprint: null, value: "M80-5402642", dnp: false,
        candidate: true, candidateReason: null, override: null, exposed: true, pinCount: 26 },
      { portKey: "key-J2", memberKeys: [], reference: "J2", libId: null, footprint: null, value: "ADF6-30", dnp: false,
        candidate: true, candidateReason: null, override: null, exposed: true, pinCount: 120 },
    ],
  })),
});
// OBC J2 is already in a board-to-board mate with CMBD J2.
const document = withPorts(systemDocument([obc, cmbd, lp], [{ ...link("L1", obc.id, "J2", cmbd.id, "J2", 0), type: "b2b" }]));

describe("ConnectDialog (SB2-115)", () => {
  it("lists every exposed connector with its MPN and pin count, mates marked", () => {
    const options = connectorOptions(document);
    expect(options.map((o) => `${o.label}|${o.value}|${o.pins}|${o.mated}`)).toContain("LPDRM J1|M80-5402642|26|false");
    expect(options.find((o) => o.label === "OBC J2")?.mated).toBe(true);
  });

  it("creates a board-to-board link from a port, refusing a connector that already mates, and opens it", async () => {
    const memory = memorySystem(document, { edits: { createLink: () => ({ id: "slk_9" }) } });
    const onCreated = vi.fn();
    renderInSession(<ConnectDialog document={document} from={{ instanceId: lp.id, portKey: "key-J2" }} onClose={vi.fn()} onCreated={onCreated} />,
      { document, transport: memory.transport });
    expect(screen.getByRole("heading", { name: "Connect LPDRM J2" })).toBeTruthy();
    await chooseOption("Kind", "Board-to-board");
    const to = screen.getByRole("list", { name: "To" });
    expect((within(to).getByRole("button", { name: /OBC J2/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("To: find a connector"), { target: { value: "cmbd j1" } });
    fireEvent.click(within(to).getByRole("button", { name: /CMBD J1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ kind: "link", id: "slk_9", edit: true }));
    expect(memory.calls).toEqual([{ name: "createLink", args: [{
      a: { instanceId: lp.id, portKey: "key-J2" }, b: { instanceId: cmbd.id, portKey: "key-J1" }, type: "b2b" }] }]);
  });
});
