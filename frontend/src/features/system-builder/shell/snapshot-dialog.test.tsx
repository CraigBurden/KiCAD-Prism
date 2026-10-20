import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSnapshot, listSnapshots } from "../model/api";
import type { SystemSnapshot } from "../model/types";
import { SnapshotDialog } from "./snapshot-dialog";

vi.mock("../model/api", () => ({
  createSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
}));

const create = vi.mocked(createSnapshot);
const list = vi.mocked(listSnapshots);

const SNAPSHOT: SystemSnapshot = {
  snapshotId: "snap_2",
  systemId: "sys_1",
  version: 3,
  name: "Release candidate",
  note: null,
  createdBy: "ada@example.com",
  createdAt: "2026-01-02T10:00:00Z",
};

beforeEach(() => {
  create.mockReset();
  list.mockReset();
  list.mockResolvedValue([]);
});

describe("SnapshotDialog", () => {
  it("starts from the current version and reports the created snapshot", async () => {
    create.mockResolvedValue(SNAPSHOT);
    const onCreated = vi.fn();
    render(<SnapshotDialog systemId="sys_1" defaultName="v3" onClose={vi.fn()} onCreated={onCreated} />);

    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("v3");
    fireEvent.change(name, { target: { value: "Release candidate" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Frozen for QA" } });
    fireEvent.click(screen.getByRole("button", { name: "Take snapshot" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith("sys_1", { name: "Release candidate", note: "Frozen for QA" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(SNAPSHOT));
  });

  it("lists the latest snapshots", async () => {
    list.mockResolvedValue([SNAPSHOT]);
    render(<SnapshotDialog systemId="sys_1" defaultName="v3" onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(await screen.findByText("Release candidate")).toBeTruthy();
    expect(screen.getByText(/v3 · ada@example.com/)).toBeTruthy();
  });
});
