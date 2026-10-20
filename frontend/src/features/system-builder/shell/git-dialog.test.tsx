import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commitGit, importGit, linkGit, readGit, readProjectBranches } from "../model/api";
import type { SystemGit, SystemRecord } from "../model/types";
import { GitDialog } from "./git-dialog";

vi.mock("../model/api", () => ({
  commitGit: vi.fn(),
  importGit: vi.fn(),
  linkGit: vi.fn(),
  readGit: vi.fn(),
  readProjectBranches: vi.fn(),
  unlinkGit: vi.fn(),
}));

const read = vi.mocked(readGit);
const link = vi.mocked(linkGit);
const commit = vi.mocked(commitGit);
const importFile = vi.mocked(importGit);
const branches = vi.mocked(readProjectBranches);

const PROJECTS = [{ id: "prj_1", name: "Rover carrier" }];

const LINK = {
  projectId: "prj_1",
  branch: "main",
  path: "systems/rover.system.json",
  lastCommit: "0123456789abcdef",
  lastBlob: "blob-1",
  lastVersion: 3,
  linkedBy: "ada@example.com",
  linkedAt: "2026-01-01T10:00:00Z",
};

const UNLINKED: SystemGit = { systemId: "sys_1", link: null, lastJob: null };
const LINKED: SystemGit = { systemId: "sys_1", link: LINK, lastJob: null };
const LINKED_DONE: SystemGit = {
  systemId: "sys_1",
  link: { ...LINK, lastCommit: "89abcdef01234567" },
  lastJob: {
    jobId: "job_1",
    status: "completed",
    errorCode: null,
    errorMessage: null,
    blob: "blob-2",
    createdAt: "2026-01-01T10:01:00Z",
    updatedAt: "2026-01-01T10:02:00Z",
  },
};

const BRANCH = {
  name: "main",
  ref: "refs/heads/main",
  source: "remote" as const,
  is_current: true,
  commit: "0123456789abcdef",
  hash: "0123456",
  message: "Initial",
  date: "2026-01-01T10:00:00Z",
};

const RECORD = { systemId: "sys_1", name: "Rover", version: 6 } as unknown as SystemRecord;

function renderDialog(onImported = vi.fn()) {
  render(
    <GitDialog
      systemId="sys_1"
      version={4}
      systemName="Rover"
      projects={PROJECTS}
      onClose={vi.fn()}
      onImported={onImported}
    />,
  );
  return onImported;
}

beforeEach(() => {
  read.mockReset();
  link.mockReset();
  commit.mockReset();
  importFile.mockReset();
  branches.mockReset();
  branches.mockResolvedValue({ branches: [BRANCH], default_ref: "refs/heads/main" });
});

describe("GitDialog", () => {
  it("links an unlinked system from the form", async () => {
    let linked = false;
    read.mockImplementation(async () => (linked ? LINKED : UNLINKED));
    link.mockImplementation(async () => {
      linked = true;
      return LINKED;
    });
    renderDialog();

    expect(await screen.findByLabelText("Project")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("Branch")).toHaveValue("refs/heads/main"));
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() => expect(link).toHaveBeenCalledWith("sys_1", { projectId: "prj_1", branch: "main", path: undefined }));
    expect(await screen.findByText("systems/rover.system.json")).toBeTruthy();
  });

  it("commits from the linked state with the default message", async () => {
    let committed = false;
    read.mockImplementation(async () => (committed ? LINKED_DONE : LINKED));
    commit.mockImplementation(async () => {
      committed = true;
      return LINKED_DONE;
    });
    renderDialog();

    expect(await screen.findByText("systems/rover.system.json")).toBeTruthy();
    const message = screen.getByLabelText("Commit message") as HTMLTextAreaElement;
    expect(message.value).toBe("Update Rover");
    fireEvent.change(message, { target: { value: "Release the rover" } });
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));

    await waitFor(() => expect(commit).toHaveBeenCalledWith("sys_1", 4, "Release the rover"));
    expect(await screen.findByText(/Committed 89abcde/)).toBeTruthy();
  });

  it("offers the import when the file diverged in Git", async () => {
    read.mockResolvedValue({
      systemId: "sys_1",
      link: LINK,
      lastJob: {
        jobId: "job_1",
        status: "failed",
        errorCode: "system_git_diverged",
        errorMessage: "The file on main changed outside Prism",
        blob: "other-blob",
        createdAt: "2026-01-01T10:01:00Z",
        updatedAt: "2026-01-01T10:02:00Z",
      },
    });
    importFile.mockResolvedValue(RECORD);
    const onImported = renderDialog();

    expect(await screen.findByText("The file changed in Git since Prism last committed it.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import the file" }));

    await waitFor(() => expect(importFile).toHaveBeenCalledWith("sys_1", 4));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(RECORD));
  });

  it("ignores a job queued under an earlier link", async () => {
    read.mockResolvedValue({
      ...LINKED_DONE,
      lastJob: { ...LINKED_DONE.lastJob!, status: "failed", errorCode: "system_git_unavailable", errorMessage: "Could not push", createdAt: "2025-12-31T09:00:00Z" },
    });
    renderDialog();

    expect(await screen.findByText("systems/rover.system.json")).toBeTruthy();
    expect(screen.queryByText("Could not push")).toBeNull();
  });
});
