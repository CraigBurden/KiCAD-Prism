import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/types/project";
import { fetchJson } from "@/lib/api";
import { LibraryImportCenter } from "./library-import-center";

vi.mock("@/lib/api", () => ({
  fetchApi: vi.fn(),
  fetchJson: vi.fn(),
  readApiError: vi.fn(),
}));

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
    vi.mocked(fetchJson).mockImplementation(async <T,>(input: RequestInfo | URL) => {
      const path = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (path === "/api/catalog/import-sessions") return { items: [] } as T;
      if (path === "/api/catalog/import-sources/folder-roots") {
        return { items: [{ name: "cern", path_hint: "/libraries/cern" }] } as T;
      }
      throw new Error(`Unexpected request: ${path}`);
    });
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
    expect(screen.getByTestId("import-source-groups")).toHaveClass("gap-2", "xl:grid-cols-2");
    expect(screen.getByRole("heading", { name: "KiCad libraries" }).closest("section")).toHaveClass("p-2");
    expect(screen.getByRole("heading", { name: "Project components" }).closest("section")).toHaveClass("p-2");
  });
});
