import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DesignDataFailed, DesignDataPending, WorkingTreeDirtyNotice } from "./design-data-state";

describe("design data states", () => {
  it("shows the calm pending line", () => {
    render(<DesignDataPending />);
    expect(screen.getByText("Preparing design data…")).toBeInTheDocument();
  });

  it("offers Check again when the read stopped polling", () => {
    const onRetry = vi.fn();
    render(<DesignDataPending onRetry={onRetry} />);
    screen.getByRole("button", { name: "Check again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the failure, its detail and a Retry", () => {
    const onRetry = vi.fn();
    render(<DesignDataFailed detail="parse failed" onRetry={onRetry} />);
    expect(screen.getByText("Design data could not be built")).toBeInTheDocument();
    expect(screen.getByText("parse failed")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the dirty notice", () => {
    render(<WorkingTreeDirtyNotice />);
    expect(screen.getByText("Local changes are not shown")).toBeInTheDocument();
  });
});
