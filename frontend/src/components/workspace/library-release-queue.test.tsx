import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

    expect(await screen.findByText("Release queue is clear")).toBeInTheDocument();
    expect(screen.queryByText(/Components submitted for QA/)).not.toBeInTheDocument();
  });

  it("retains recovery guidance when filters hide every result", async () => {
    render(
      <MemoryRouter initialEntries={["/?releaseQueueStage=qa_review"]}>
        <LibraryReleaseQueue onOpenComponent={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No matching release work")).toBeInTheDocument();
    expect(screen.getByText("Try a different search or stage filter.")).toBeInTheDocument();
  });
});
