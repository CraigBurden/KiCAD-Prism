import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/types/project";
import type { ProjectComponentImportProposal, ProjectComponentImportSession } from "@/types/catalog";
import { ApiHttpError } from "@/lib/api";
import {
  createFolderSnapshot,
  deleteImportSession,
  listFolderImportRoots,
  listImportProposals,
  listImportSessions,
  uploadSnapshotFile,
} from "./catalog-client";
import { LibraryImportCenter } from "./library-import-center";

vi.mock("./catalog-client");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

import { toast } from "sonner";

const project: Project = {
  id: "project-1",
  name: "thunderscope",
  display_name: "Thunderscope Rev 5.3",
  description: "",
  path: "/projects/thunderscope",
  last_modified: "2026-08-27T00:00:00Z",
};

describe("LibraryImportCenter sources", () => {
  beforeEach(() => {
    vi.mocked(listImportSessions).mockResolvedValue({ items: [] });
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [{ name: "cern", path_hint: "/libraries/cern" }] });
  });

  it("groups project and library imports on one toolbar", async () => {
    render(
      <LibraryImportCenter
        projects={[project]}
        user={{ name: "Admin", email: "admin@example.com", role: "admin" }}
      />,
    );

    const projects = await screen.findByRole("group", { name: "Project components" });
    expect(within(projects).getByRole("button", { name: "Scan" })).toBeInTheDocument();
    expect(within(projects).getByRole("button", { name: "All projects" })).toBeInTheDocument();
    const libraries = screen.getByRole("group", { name: "KiCad libraries" });
    expect(within(libraries).getByRole("button", { name: "Local folder" })).toBeInTheDocument();
    expect(await within(libraries).findByRole("button", { name: "Server folder" })).toBeInTheDocument();
  });

  it("offers a server folder only when the server has import roots", async () => {
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [] });
    render(
      <LibraryImportCenter
        projects={[project]}
        user={{ name: "Admin", email: "admin@example.com", role: "admin" }}
      />,
    );

    expect(await screen.findByRole("button", { name: "Local folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Server folder" })).not.toBeInTheDocument();
  });
});

function importSession(id: string, status: ProjectComponentImportSession["status"] = "staged"): ProjectComponentImportSession {
  return {
    id,
    scope: "folder",
    project_id: "",
    project_ids: [],
    project_revisions: {},
    source_revision: "",
    status,
    created_by: "admin@example.com",
    created_at: "2026-08-27T00:00:00Z",
    updated_at: "2026-08-27T00:00:00Z",
    error_message: "",
    proposal_count: 1,
    candidate_count: 1,
    selection: { display_name: id },
  };
}

function importProposal(sessionId: string, reference: string): ProjectComponentImportProposal {
  return {
    id: `${sessionId}-${reference}`,
    session_id: sessionId,
    dedupe_key: reference,
    component_uid: reference,
    reference,
    status: "candidate",
    accepted_component_id: "",
    metadata: { references: [reference], value: "10k" },
    assets: [],
    provenance: [],
    findings: [],
  };
}

describe("LibraryImportCenter session proposals", () => {
  beforeEach(() => {
    vi.mocked(listImportProposals).mockReset();
  });

  it("does not show session A proposals after switching to session B", async () => {
    let finishA: ((value: { items: ProjectComponentImportProposal[] }) => void) | undefined;
    vi.mocked(listImportSessions).mockResolvedValue({ items: [importSession("session-a"), importSession("session-b")] });
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [] });
    vi.mocked(listImportProposals).mockImplementation(async (sessionId) => {
      if (sessionId === "session-a") {
        return new Promise((resolve) => {
          finishA = resolve;
        });
      }
      return { items: [importProposal("session-b", "R-B")] };
    });

    render(
      <LibraryImportCenter
        projects={[project]}
        user={{ name: "Admin", email: "admin@example.com", role: "admin" }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /session-b/i }));
    expect(await screen.findByText("R-B")).toBeInTheDocument();

    await act(async () => {
      finishA!({ items: [importProposal("session-a", "R-A")] });
    });
    await waitFor(() => expect(screen.queryByText("R-A")).not.toBeInTheDocument());
    expect(screen.getByText("R-B")).toBeInTheDocument();
  });
});

describe("LibraryImportCenter session delete", () => {
  beforeEach(() => {
    vi.mocked(listImportProposals).mockResolvedValue({ items: [] });
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [] });
    vi.mocked(deleteImportSession).mockReset();
  });

  it("deletes a reviewed session after confirmation and selects the next one", async () => {
    vi.mocked(listImportSessions).mockResolvedValue({
      items: [{ ...importSession("session-a"), candidate_count: 0 }, importSession("session-b")],
    });
    vi.mocked(deleteImportSession).mockResolvedValue(undefined);
    render(<LibraryImportCenter projects={[project]} user={{ name: "Admin", email: "admin@example.com", role: "admin" }} />);

    expect(await screen.findByRole("button", { name: /session-a/i })).toHaveAttribute("title", expect.stringContaining("0 of 1 open"));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete import session" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteImportSession).toHaveBeenCalledWith("session-a"));
    await waitFor(() => expect(screen.queryByRole("button", { name: /session-a/i })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /session-b/i })).toHaveAttribute("aria-current", "true");
  });

  it("offers no delete while a session is still scanning, or to a reader", async () => {
    vi.mocked(listImportSessions).mockResolvedValue({ items: [importSession("session-a", "scanning")] });
    const { unmount } = render(<LibraryImportCenter projects={[project]} user={{ name: "Admin", email: "admin@example.com", role: "admin" }} />);
    expect(await screen.findByRole("button", { name: /session-a/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete import session" })).not.toBeInTheDocument();
    unmount();

    vi.mocked(listImportSessions).mockResolvedValue({ items: [importSession("session-a")] });
    render(<LibraryImportCenter projects={[project]} user={{ name: "Viewer", email: "viewer@example.com", role: "viewer" }} />);
    expect(await screen.findByRole("button", { name: /session-a/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete import session" })).not.toBeInTheDocument();
  });
});

describe("LibraryImportCenter folder capture", () => {
  beforeEach(() => {
    vi.mocked(listImportSessions).mockResolvedValue({ items: [] });
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [] });
    vi.mocked(createFolderSnapshot).mockResolvedValue({ id: "snap-1" });
    vi.mocked(uploadSnapshotFile).mockReset();
    vi.mocked(toast.error).mockClear();
  });

  async function chooseFolder() {
    const { container } = render(
      <LibraryImportCenter projects={[project]} user={{ name: "Admin", email: "admin@example.com", role: "admin" }} />,
    );
    await screen.findByRole("button", { name: "Local folder" });
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["(kicad_symbol_lib)"], "R.kicad_sym");
    Object.defineProperty(file, "webkitRelativePath", { value: "libs/R.kicad_sym" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    fireEvent.change(input);
  }

  it("names the proxy limit when an upload is refused with a bare 413, without retrying", async () => {
    vi.mocked(uploadSnapshotFile).mockRejectedValue(new ApiHttpError(413, "Failed to upload R.kicad_sym"));
    await chooseFolder();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "1 file could not be captured. R.kicad_sym: R.kicad_sym exceeds the reverse-proxy upload limit",
    ));
    expect(uploadSnapshotFile).toHaveBeenCalledTimes(1);
    expect(uploadSnapshotFile).toHaveBeenCalledWith("snap-1", "libs/R.kicad_sym", expect.any(File), "Failed to upload R.kicad_sym");
  });

  it("retries a retryable refusal and reports the server's message", async () => {
    vi.mocked(uploadSnapshotFile).mockRejectedValue(new ApiHttpError(503, "Storage is busy"));
    await chooseFolder();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "1 file could not be captured. R.kicad_sym: Storage is busy",
    ), { timeout: 5000 });
    expect(uploadSnapshotFile).toHaveBeenCalledTimes(3);
  });
});
