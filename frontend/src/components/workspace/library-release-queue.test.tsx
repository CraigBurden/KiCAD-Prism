import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogComponent } from "@/types/catalog";
import { getReleaseQueue } from "./catalog-client";
import { LibraryReleaseQueue } from "./library-release-queue";

vi.mock("./catalog-client");

describe("LibraryReleaseQueue empty states", () => {
  beforeEach(() => {
    vi.mocked(getReleaseQueue).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      pages: 1,
      summary: { qa_review: 0, done: 0, blocked: 0 },
    });
  });

  it("keeps the unfiltered empty state concise", async () => {
    render(
      <MemoryRouter>
        <LibraryReleaseQueue onOpenComponent={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Queue is clear")).toBeInTheDocument();
  });

  it("says when filters hide every result", async () => {
    render(
      <MemoryRouter initialEntries={["/?releaseQueueStage=qa_review"]}>
        <LibraryReleaseQueue onOpenComponent={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });
});

describe("LibraryReleaseQueue rows", () => {
  it("shows a queued revision on one row and opens its review", async () => {
    const component = {
      id: "comp-1",
      name: "LMT86DCKT",
      mpn: "LMT86DCK",
      value: "LMT86DCKT",
      manufacturer: "TI",
      workflow_stage: "qa_review",
      revision: 6,
      created_by: "qa@example.com",
      revision_updated_at: "2026-10-25T00:00:00Z",
      missing_assets: ["footprint"],
      validation: { status: "warning", error_count: 0, warning_count: 2 },
    } as unknown as CatalogComponent;
    vi.mocked(getReleaseQueue).mockResolvedValue({
      items: [component],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
      summary: { qa_review: 1, done: 0, blocked: 1 },
    });
    const onOpenComponent = vi.fn();
    render(
      <MemoryRouter>
        <LibraryReleaseQueue onOpenComponent={onOpenComponent} />
      </MemoryRouter>,
    );

    const row = await screen.findByRole("button", { name: /LMT86DCKT/ });
    expect(screen.getByText("Blocked").closest("[title]")).toHaveAttribute("title", "Missing footprint");
    expect(screen.getByText("1 blocked", { exact: false })).toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpenComponent).toHaveBeenCalledWith("comp-1", "review");
  });
});
