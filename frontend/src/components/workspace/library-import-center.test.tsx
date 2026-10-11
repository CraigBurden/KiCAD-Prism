import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/types/project";
import type { ProjectComponentImportProposal, ProjectComponentImportSession } from "@/types/catalog";
import { ApiHttpError } from "@/lib/api";
import {
  createFolderSnapshot,
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

  it("separates library and project imports and uses source-oriented project labels", async () => {
    render(
      <LibraryImportCenter
        projects={[project]}
        user={{ name: "Admin", email: "admin@example.com", role: "admin" }}
      />,
    );

    expect(await screen.findByRole("heading", { name: "KiCad libraries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project components" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose local folder" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Import server folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import From Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import From All Projects" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Import Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("import-source-groups")).toHaveClass("grid-cols-1", "gap-2");
    expect(screen.getByTestId("import-source-groups")).not.toHaveClass("import-source-groups--split");
    expect(screen.getByRole("heading", { name: "KiCad libraries" }).closest("section")).toHaveClass("p-2");
    expect(screen.getByRole("heading", { name: "Project components" }).closest("section")).toHaveClass("p-2");
  });

  it("allocates more space to project imports when the cards share a row", async () => {
    vi.mocked(listFolderImportRoots).mockResolvedValue({ items: [] });

    render(
      <LibraryImportCenter
        projects={[project]}
        user={{ name: "Admin", email: "admin@example.com", role: "admin" }}
      />,
    );

    expect(await screen.findByTestId("import-source-groups")).toHaveClass(
      "grid-cols-1",
      "import-source-groups--split",
    );
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
    await screen.findByRole("button", { name: "Choose local folder" });
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
