import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogHealth } from "@/types/catalog";
import { getCatalogHealth } from "./catalog-client";
import { LibraryCatalogFileCheck } from "./library-catalog-file-check";

vi.mock("./catalog-client");

const health = (missing: number | null): CatalogHealth => ({
  total_components: 3,
  released: 2,
  place_ready: 3,
  missing_files: 0,
  released_assets_missing_on_disk: missing,
  preview_failed: 0,
  validation: { passed: 3, warning: 0, failed: 0, skipped: 0, not_run: 0 },
});

describe("LibraryCatalogFileCheck", () => {
  beforeEach(() => vi.mocked(getCatalogHealth).mockReset());

  it("checks files on disk only when asked", async () => {
    vi.mocked(getCatalogHealth).mockResolvedValue(health(2));
    render(<LibraryCatalogFileCheck />);

    expect(getCatalogHealth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Check released files/ }));

    expect(await screen.findByText("2 missing")).toBeInTheDocument();
    expect(getCatalogHealth).toHaveBeenCalledWith({ checkFiles: true });
  });

  it("shows a clean result when nothing is missing", async () => {
    vi.mocked(getCatalogHealth).mockResolvedValue(health(0));
    render(<LibraryCatalogFileCheck />);

    fireEvent.click(screen.getByRole("button", { name: /Check released files/ }));

    expect(await screen.findByText("Files OK")).toBeInTheDocument();
  });
});
